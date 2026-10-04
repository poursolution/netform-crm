-- 예외 승인함 v1 (2026-10-04 · design_handoff_rules 2차 기능 4)
-- 현장에서 바로 고치지 않고 승인함으로 모으는 요청: 귀속 변경 · 중복 리드 정산 · 전략수주 · 특별 인센티브 · 결과 수정.
-- 타사 이관 실적은 기존 crm_deal_transfer_approve_v1 경로 그대로다 — 승인함 화면이 같이 보여 줄 뿐, 이 표에 넣지 않는다.
-- 이 함수들은 요청 · 결정(승인 / 반려 · 사유) · 이력만 기록한다. 영업건 · 담당 · 계약실적 원장 · 수주 유형은 건드리지 않는다.
-- 표는 RLS 를 켜고 정책을 두지 않는다 — 읽기 · 쓰기는 아래 함수로만. 바꿀 때마다 crm_approval_events 에 전 → 후가 남는다.
-- 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run. 화면은 함수가 있을 때만 이 요청들을 보여 준다.

create table if not exists public.crm_approval_requests(
 id bigserial primary key,
 type text not null check (type in ('owner_change','dup_lead','strategic_win','special_incentive','result_fix')),
 deal_id text,
 title text not null,
 reason text not null,
 payload jsonb not null default '{}'::jsonb,
 status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
 requested_by uuid,
 requested_by_name text,
 requested_at timestamptz not null default now(),
 decided_by uuid,
 decided_by_name text,
 decided_at timestamptz,
 decision_reason text
);
alter table public.crm_approval_requests enable row level security;
revoke all on table public.crm_approval_requests from public, anon, authenticated;
create index if not exists crm_approval_requests_status on public.crm_approval_requests(status,requested_at desc);

create table if not exists public.crm_approval_events(
 id bigserial primary key,
 request_id bigint not null,
 action text not null,
 before jsonb,
 after jsonb,
 actor uuid,
 actor_name text,
 at timestamptz not null default now()
);
alter table public.crm_approval_events enable row level security;
revoke all on table public.crm_approval_events from public, anon, authenticated;
create index if not exists crm_approval_events_request on public.crm_approval_events(request_id,at desc);

-- 읽기: 관리자 = 전부, 그 밖 = 자기가 올린 요청만. 거둔 요청은 빼고 최근 300건.
create or replace function public.crm_approval_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; adm boolean;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 adm:=a.permission_role='admin';
 return jsonb_build_object('ok',true,'admin',adm,'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.requested_at desc,r.id desc)
  from (select * from public.crm_approval_requests q where q.status<>'cancelled' and (adm or q.requested_by=a.user_id) order by q.requested_at desc,q.id desc limit 300) r),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_approval_list_v1(jsonb) from public, anon;
grant execute on function public.crm_approval_list_v1(jsonb) to authenticated;

-- 요청 올리기(로그인한 CRM 사용자) / 거두기(cancel = true · 올린 사람 또는 관리자 · 대기 중인 것만)
create or replace function public.crm_approval_request_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; old public.crm_approval_requests%rowtype; cur public.crm_approval_requests%rowtype;
 v_id bigint; v_type text; v_deal text; v_title text; v_reason text; v_payload jsonb; v_name text; v_at timestamptz:=clock_timestamp();
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 select u.name into v_name from public.users u where u.user_id=a.user_id;
 if p->'cancel'='true'::jsonb then
  begin v_id:=(p->>'id')::bigint; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
  select * into old from public.crm_approval_requests q where q.id=v_id for update;
  if not found then raise exception '요청을 찾을 수 없습니다' using errcode='22023'; end if;
  if a.permission_role<>'admin' and old.requested_by is distinct from a.user_id then raise exception '올린 사람 또는 관리자만 거둘 수 있습니다' using errcode='42501'; end if;
  if old.status<>'pending' then raise exception '이미 처리된 요청입니다' using errcode='22023'; end if;
  update public.crm_approval_requests q set status='cancelled',decided_by=a.user_id,decided_by_name=v_name,decided_at=v_at where q.id=v_id returning * into cur;
  insert into public.crm_approval_events(request_id,action,before,after,actor,actor_name,at) values(v_id,'cancel',to_jsonb(old),to_jsonb(cur),a.user_id,v_name,v_at);
  return jsonb_build_object('ok',true,'request',to_jsonb(cur));
 end if;
 v_type:=coalesce(p->>'type','');
 if v_type not in ('owner_change','dup_lead','strategic_win','special_incentive','result_fix') then raise exception '요청 종류를 골라 주세요' using errcode='22023'; end if;
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),'');
 if v_deal is not null then
  if length(v_deal)>80 then raise exception 'invalid payload' using errcode='22023'; end if;
  if not exists(select 1 from public.deals d where d.id::text=v_deal) then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 end if;
 v_title:=nullif(btrim(coalesce(p->>'title','')),''); v_reason:=nullif(btrim(coalesce(p->>'reason','')),'');
 if v_title is null or length(v_title)>120 then raise exception '요청 내용을 120자 이내로 적어 주세요' using errcode='22023'; end if;
 if v_reason is null or length(v_reason)>300 then raise exception '요청 사유를 300자 이내로 적어 주세요' using errcode='22023'; end if;
 v_payload:=coalesce(p->'payload','{}'::jsonb);
 if jsonb_typeof(v_payload)<>'object' or length(v_payload::text)>2000 then raise exception 'invalid payload' using errcode='22023'; end if;
 -- 같은 영업건 · 같은 종류로 이미 대기 중이면 새로 만들지 않는다
 if v_deal is not null and exists(select 1 from public.crm_approval_requests q where q.deal_id=v_deal and q.type=v_type and q.status='pending') then
  raise exception '같은 요청이 이미 승인 대기 중입니다' using errcode='22023';
 end if;
 insert into public.crm_approval_requests(type,deal_id,title,reason,payload,status,requested_by,requested_by_name,requested_at)
  values(v_type,v_deal,v_title,v_reason,v_payload,'pending',a.user_id,v_name,v_at) returning * into cur;
 insert into public.crm_approval_events(request_id,action,before,after,actor,actor_name,at) values(cur.id,'request',null,to_jsonb(cur),a.user_id,v_name,v_at);
 return jsonb_build_object('ok',true,'request',to_jsonb(cur));
end $fn$;
revoke all on function public.crm_approval_request_v1(jsonb) from public, anon;
grant execute on function public.crm_approval_request_v1(jsonb) to authenticated;

-- 승인 / 반려(관리자 전용): 반려는 사유 필수. 대기 중인 요청만. 결정만 기록한다(다른 자료는 바꾸지 않는다).
create or replace function public.crm_approval_decide_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; old public.crm_approval_requests%rowtype; cur public.crm_approval_requests%rowtype;
 v_id bigint; v_dec text; v_reason text; v_name text; v_at timestamptz:=clock_timestamp();
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if a.permission_role<>'admin' then raise exception '승인 · 반려는 관리자만 할 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'id')::bigint; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_dec:=coalesce(p->>'decision','');
 if v_id is null or v_dec not in ('approve','reject') then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into old from public.crm_approval_requests q where q.id=v_id for update;
 if not found then raise exception '요청을 찾을 수 없습니다' using errcode='22023'; end if;
 if old.status<>'pending' then raise exception '이미 처리된 요청입니다' using errcode='22023'; end if;
 v_reason:=nullif(btrim(coalesce(p->>'reason','')),'');
 if v_reason is not null and length(v_reason)>300 then raise exception '사유는 300자 이내로 적어 주세요' using errcode='22023'; end if;
 if v_dec='reject' and v_reason is null then raise exception '반려 사유를 적어 주세요' using errcode='22023'; end if;
 select u.name into v_name from public.users u where u.user_id=a.user_id;
 update public.crm_approval_requests q set status=case when v_dec='approve' then 'approved' else 'rejected' end,decided_by=a.user_id,decided_by_name=v_name,decided_at=v_at,decision_reason=v_reason
  where q.id=v_id returning * into cur;
 insert into public.crm_approval_events(request_id,action,before,after,actor,actor_name,at) values(v_id,v_dec,to_jsonb(old),to_jsonb(cur),a.user_id,v_name,v_at);
 return jsonb_build_object('ok',true,'request',to_jsonb(cur));
end $fn$;
revoke all on function public.crm_approval_decide_v1(jsonb) from public, anon;
grant execute on function public.crm_approval_decide_v1(jsonb) to authenticated;
