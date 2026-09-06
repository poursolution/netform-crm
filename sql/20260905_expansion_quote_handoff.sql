-- Requires 20260905_expansion_management.sql. No customer data is deleted.
-- crm-write's expansion_quote_convert adapter must create the Deal and call
-- crm_expansion_finish IN ONE TRANSACTION (see README). This is not a sender.
begin;
alter table public.deals add column if not exists origin text;
alter table public.crm_expansion_pool add column if not exists converted_at timestamptz;
alter table public.crm_expansion_pool add column if not exists conversion_quote_dispatch_id uuid;
alter table public.crm_expansion_pool drop constraint if exists crm_expansion_pool_status_check;
alter table public.crm_expansion_pool add constraint crm_expansion_pool_status_check check(expansion_status in (
 '신규 대상','접촉 예정','관계 관리중','추가 니즈 확인','신규 영업기회 생성','보류/휴면',
 '관리대상','접촉예정','관계관리','니즈확인','Pipeline 전환','보류'));

create table if not exists public.crm_expansion_events (
 id uuid primary key default gen_random_uuid(),
 source_opportunity_id uuid not null references public.deals(id) on delete restrict,
 kind text not null,note text not null,actor text not null,
 created_at timestamptz not null default now()
);
-- ONLY the verified server delivery callback writes this ledger. A browser
-- checkbox, message launch, draft or manual client-side 'sent' is not proof.
create table if not exists public.crm_expansion_quote_dispatches (
 id uuid primary key default gen_random_uuid(),
 source_opportunity_id uuid not null references public.deals(id) on delete restrict,
 quote_version_id text not null,quote_title text,recipient text not null,
 status text not null check(status in ('sent','failed','scheduled','draft')),
 sent_at timestamptz,provider_receipt_id text unique,
 quote_snapshot jsonb not null,
 check(status<>'sent' or (sent_at is not null and provider_receipt_id is not null))
);
alter table public.crm_expansion_events enable row level security;
alter table public.crm_expansion_quote_dispatches enable row level security;
revoke all on public.crm_expansion_events,public.crm_expansion_quote_dispatches from anon,authenticated;
grant select,insert on public.crm_expansion_events to service_role;
grant select,insert,update on public.crm_expansion_quote_dispatches to service_role;

create or replace function public.crm_expansion_actor(oid uuid) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare n text;r text;assigned text;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다';end if;
 select name,lower(role::text) into n,r from public.users
 where lower(email)=lower(auth.jwt()->>'email') and active;
 select owner_name into assigned from public.crm_expansion_pool where source_opportunity_id=oid;
 if n is null or (n is distinct from assigned and r not in ('admin','owner','exec','executive','lead','manager','관리자','대표')) then
  raise exception '본인 담당 고객 또는 관리자만 접근할 수 있습니다';end if;
 return n;
end $$;

create or replace function public.crm_expansion_note(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare oid uuid:=(p->>'source_opportunity_id')::uuid;n text;pool public.crm_expansion_pool;ev public.crm_expansion_events;
begin
 n:=public.crm_expansion_actor(oid);
 select * into pool from public.crm_expansion_pool where source_opportunity_id=oid for update;
 if pool.id is null then raise exception '확장관리 대상이 없습니다';end if;
 if pool.created_opportunity_id is not null or pool.expansion_status in ('Pipeline 전환','신규 영업기회 생성') then raise exception '전환 완료 이력은 읽기 전용입니다';end if;
 if length(trim(coalesce(p->>'note','')))<1 then raise exception '기록 내용이 필요합니다';end if;
 insert into public.crm_expansion_events(id,source_opportunity_id,kind,note,actor)
 values((p->>'request_id')::uuid,oid,'접촉·니즈 기록',trim(p->>'note'),n)
 on conflict(id) do nothing returning * into ev;
 if ev.id is null then select * into ev from public.crm_expansion_events where id=(p->>'request_id')::uuid and source_opportunity_id=oid and actor=n;end if;
 if ev.id is null then raise exception '기록 ID 충돌';end if;
 return jsonb_build_object('ok',true,'event',to_jsonb(ev));
end $$;

create or replace function public.crm_expansion_context(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare oid uuid:=(p->>'source_opportunity_id')::uuid;
begin
 perform public.crm_expansion_actor(oid);
 return jsonb_build_object('ok',true,
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by created_at),'[]') from public.crm_expansion_events e where source_opportunity_id=oid),
 'dispatches',(select coalesce(jsonb_agg(to_jsonb(q)-'provider_receipt_id'),'[]') from public.crm_expansion_quote_dispatches q where source_opportunity_id=oid));
end $$;

create or replace function public.crm_expansion_readonly() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if old.created_opportunity_id is not null or old.expansion_status in ('Pipeline 전환','신규 영업기회 생성') then
  if to_jsonb(new) is distinct from to_jsonb(old) then raise exception '전환 완료 확장관리는 수정할 수 없습니다';end if;
 end if;
 -- Completion is reserved for the transactional server adapter, not generic updates.
 if (new.created_opportunity_id is distinct from old.created_opportunity_id or new.expansion_status in ('Pipeline 전환','신규 영업기회 생성'))
 and coalesce(current_setting('crm.expansion_finishing',true),'')<>'yes' then raise exception '견적 발송 검증 후 전환해야 합니다';end if;
 return new;
end $$;
drop trigger if exists crm_expansion_readonly_guard on public.crm_expansion_pool;
create trigger crm_expansion_readonly_guard before update on public.crm_expansion_pool for each row execute function public.crm_expansion_readonly();

-- Trusted backend only. Verify authorization BEFORE calling. The adapter must
-- lock the Pool BEFORE creating a Deal, retry returning the same child ID, and
-- rollback both creation and finish on error. Never call as two HTTP writes.
create or replace function public.crm_expansion_finish(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare oid uuid:=(p->>'source_opportunity_id')::uuid;nid uuid:=(p->>'new_opportunity_id')::uuid;
 pool public.crm_expansion_pool;q public.crm_expansion_quote_dispatches;j jsonb;src jsonb;
begin
 select * into pool from public.crm_expansion_pool where source_opportunity_id=oid for update;
 if pool.id is null then raise exception '확장관리 대상 없음';end if;
 select * into q from public.crm_expansion_quote_dispatches where id=(p->>'quote_dispatch_id')::uuid and source_opportunity_id=oid;
 if q.id is null or q.status<>'sent' or q.sent_at is null then raise exception '실제 발송된 견적이 아닙니다';end if;
 if pool.created_opportunity_id is not null and pool.created_opportunity_id<>nid then raise exception '이미 다른 Pipeline으로 전환되었습니다';end if;
 if pool.created_opportunity_id is not null and pool.conversion_quote_dispatch_id is distinct from q.id then raise exception '기존 전환의 견적 발송이력과 다릅니다';end if;
 select to_jsonb(d) into src from public.deals d where id=oid;
 if coalesce(src->>'outcome',src->>'code',src->>'stage_code','') not in ('won','expansion') or pool.completion_date is null then raise exception '수주·준공 확인이 필요합니다';end if;
 select to_jsonb(d) into j from public.deals d where id=nid;
 if j is null or nid=oid or j->>'source_opportunity_id' is distinct from oid::text or j->>'origin' is distinct from 'expansion'
 or coalesce(j->>'code',j->>'stage_code','')<>'sent' then raise exception '새 Deal 연결·origin·sent 단계를 확인하세요';end if;
 -- The adapter maps its schema to these canonical quote fields before calling.
 if q.quote_snapshot->>'work_summary' is distinct from p->>'work_summary'
 or (q.quote_snapshot->>'amount')::numeric is distinct from (p->>'amount')::numeric then raise exception '발송 견적의 공종·금액과 전환 내용이 다릅니다';end if;
 if pool.created_opportunity_id is null then
  perform set_config('crm.expansion_finishing','yes',true);
  update public.crm_expansion_pool set created_opportunity_id=nid,expansion_status='Pipeline 전환',conversion_quote_dispatch_id=q.id,converted_at=now(),updated_at=now() where id=pool.id;
  perform set_config('crm.expansion_finishing','',true);
  insert into public.crm_expansion_events(source_opportunity_id,kind,note,actor) values(oid,'견적 발송 → Pipeline 전환',coalesce(q.quote_title,'견적')||' · 새 Deal '||nid,coalesce(p->>'actor','서버'));
 end if;
 return jsonb_build_object('ok',true,'operation','expansion_quote_convert','source_opportunity_id',oid,'new_opportunity_id',nid,
 'quote_dispatch_id',q.id,'stage_code','sent','origin','expansion','expansion_status','Pipeline 전환');
end $$;
revoke all on function public.crm_expansion_actor(uuid),public.crm_expansion_note(jsonb),public.crm_expansion_context(jsonb),public.crm_expansion_finish(jsonb) from public,anon,authenticated;
grant execute on function public.crm_expansion_note(jsonb),public.crm_expansion_context(jsonb) to authenticated;
grant execute on function public.crm_expansion_finish(jsonb) to service_role;
-- The older migration used service-role grants without removing PUBLIC execute.
revoke all on function public.crm_expansion_pool_upsert(jsonb),public.crm_expansion_pool_update(jsonb) from public,anon,authenticated;
commit;
