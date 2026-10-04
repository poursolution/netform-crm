-- 담당 · 귀속 분리 v1 (2026-10-04 · design_handoff_rules 2차 기능 8)
-- 현재 담당(영업건의 담당자)과 따로, 최초 담당 · 실적 귀속(주담당)을 이 표에 둔다.
-- 담당이 바뀌어도 귀속은 그대로(기본). 귀속 변경은 바로 바뀌지 않고 예외 승인함으로 가서, 예외 승인자가 승인하면 여기 값이 바뀐다(이전 귀속은 이력에 남는다).
-- 계약실적 원장(계약 체결일 · sales_owner)과 영업건의 담당자 · 단계는 건드리지 않는다. 이미 확정된 수주 · 타사 이관의 실적 귀속도 바꾸지 않는다.
-- 이 표에 귀속이 고정된 영업건은, 그 뒤 협약시공사 수주 · 타사 이관을 등록할 때 실적 귀속이 그 사람으로 들어간다(sql/deal-win-type-v1 · sql/deal-transfer-v1).
-- 표는 RLS 를 켜고 정책을 두지 않는다 — 읽기 · 쓰기는 아래 함수로만. 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run.

create table if not exists public.crm_deal_owners(
 deal_id text primary key,
 first_owner text,
 first_owner_id uuid,
 first_connected_at date,
 performance_owner text not null,
 performance_owner_id uuid,
 updated_by uuid,
 updated_by_name text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.crm_deal_owners enable row level security;
revoke all on table public.crm_deal_owners from public, anon, authenticated;

create table if not exists public.crm_deal_owner_events(
 id bigserial primary key,
 deal_id text not null,
 action text not null check (action in ('reassign','attribution_change')),
 from_owner text,
 to_owner text,
 reason text,
 attribution text,
 before jsonb,
 after jsonb,
 actor uuid,
 actor_name text,
 at timestamptz not null default now()
);
alter table public.crm_deal_owner_events enable row level security;
revoke all on table public.crm_deal_owner_events from public, anon, authenticated;
create index if not exists crm_deal_owner_events_deal on public.crm_deal_owner_events(deal_id,at desc);

-- 읽기: 로그인한 CRM 사용자(실적 귀속은 전 직원 공개). deal_id 를 주면 그 영업건의 변경 이력도 함께.
create or replace function public.crm_deal_owner_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; v_deal text;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),'');
 return jsonb_build_object('ok',true,
  'rows',coalesce((select jsonb_agg(to_jsonb(o) order by o.deal_id) from public.crm_deal_owners o),'[]'::jsonb),
  'events',case when v_deal is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(e) order by e.at,e.id) from (select * from public.crm_deal_owner_events x where x.deal_id=v_deal order by x.at desc,x.id desc limit 30) e),'[]'::jsonb) end);
end $fn$;
revoke all on function public.crm_deal_owner_list_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_owner_list_v1(jsonb) to authenticated;

-- 담당 변경 기록: 기존 담당자 변경이 끝난 뒤 화면이 부른다 — 사유와 귀속 선택(유지 / 변경 요청)을 남기고, 처음이면 주담당(바뀌기 전 귀속)을 고정한다.
-- 이미 귀속이 고정된 영업건은 귀속을 건드리지 않는다(바꾸려면 승인 요청).
create or replace function public.crm_deal_owner_reassign_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; dj jsonb; old public.crm_deal_owners%rowtype; cur public.crm_deal_owners%rowtype; has_old boolean;
 v_deal text; v_from text; v_to text; v_reason text; v_attr text; v_keep text; v_keep_id uuid; v_first text; v_first_id uuid; v_first_at date; v_name text; v_at timestamptz:=clock_timestamp();
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),'');
 if v_deal is null or length(v_deal)>80 then raise exception 'invalid payload' using errcode='22023'; end if;
 select to_jsonb(d) into dj from public.deals d where d.id::text=v_deal;
 if dj is null then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 select u.name into v_name from public.users u where u.user_id=a.user_id;
 v_from:=nullif(btrim(coalesce(p->>'from','')),''); v_to:=nullif(btrim(coalesce(p->>'to','')),'');
 if v_from is null or v_to is null or length(v_from)>40 or length(v_to)>40 or v_from=v_to then raise exception '바뀌기 전 · 후 담당을 확인해 주세요' using errcode='22023'; end if;
 v_reason:=nullif(btrim(coalesce(p->>'reason','')),'');
 if v_reason is null or length(v_reason)>300 then raise exception '변경 사유를 300자 이내로 적어 주세요' using errcode='22023'; end if;
 v_attr:=coalesce(p->>'attribution','');
 if v_attr not in ('keep','request') then raise exception '실적 귀속을 골라 주세요' using errcode='22023'; end if;
 -- 담당자 변경을 할 수 있는 사람만: 관리자 · 팀장 · 예외 승인자 · 그 영업건 담당 · 바뀌기 전후 담당 본인
 if a.permission_role not in ('admin','manager') and not crm_security.approval_approver(a.user_id) and coalesce(dj->>'owner_id','')<>a.user_id::text and btrim(coalesce(v_name,'')) not in (v_from,v_to) then
  raise exception '담당자 또는 관리자만 기록할 수 있습니다' using errcode='42501';
 end if;
 select * into old from public.crm_deal_owners o where o.deal_id=v_deal for update;
 has_old:=found;
 if has_old then cur:=old;
 else
  v_keep:=coalesce(nullif(btrim(coalesce(p->>'keep_owner','')),''),v_from);
  select u.user_id into v_keep_id from public.users u where btrim(u.name)=v_keep order by u.active desc nulls last limit 1;
  if v_keep_id is null then raise exception '주담당은 계정에 있는 이름이어야 합니다' using errcode='22023'; end if;
  v_first:=coalesce(nullif(btrim(coalesce(p->>'first_owner','')),''),v_keep);
  select u.user_id into v_first_id from public.users u where btrim(u.name)=v_first order by u.active desc nulls last limit 1;
  if v_first_id is null then v_first:=v_keep; v_first_id:=v_keep_id; end if;
  begin v_first_at:=nullif(p->>'first_connected_at','')::date; exception when others then v_first_at:=null; end;
  insert into public.crm_deal_owners(deal_id,first_owner,first_owner_id,first_connected_at,performance_owner,performance_owner_id,updated_by,updated_by_name,created_at,updated_at)
   values(v_deal,v_first,v_first_id,v_first_at,v_keep,v_keep_id,a.user_id,v_name,v_at,v_at) returning * into cur;
 end if;
 insert into public.crm_deal_owner_events(deal_id,action,from_owner,to_owner,reason,attribution,before,after,actor,actor_name,at)
  values(v_deal,'reassign',v_from,v_to,v_reason,v_attr,case when has_old then to_jsonb(old) end,to_jsonb(cur),a.user_id,v_name,v_at);
 return jsonb_build_object('ok',true,'deal_id',v_deal,'owner',to_jsonb(cur));
end $fn$;
revoke all on function public.crm_deal_owner_reassign_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_owner_reassign_v1(jsonb) to authenticated;

-- 귀속 변경 반영(내부용): 예외 승인함에서 '귀속 변경'이 승인될 때 crm_approval_decide_v1 이 부른다. 직접 부를 수 없다.
create or replace function crm_security.deal_owner_apply(p_deal text,p_from text,p_to text,p_reason text,p_actor uuid,p_actor_name text)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare old public.crm_deal_owners%rowtype; cur public.crm_deal_owners%rowtype; has_old boolean; v_to text; v_to_id uuid; v_from text; v_from_id uuid; v_at timestamptz:=clock_timestamp();
begin
 v_to:=nullif(btrim(coalesce(p_to,'')),'');
 select u.user_id into v_to_id from public.users u where u.active is true and btrim(u.name)=v_to limit 1;
 if v_to is null or v_to_id is null then raise exception '바꿀 귀속은 사용 중인 계정 이름이어야 합니다' using errcode='22023'; end if;
 select * into old from public.crm_deal_owners o where o.deal_id=p_deal for update;
 has_old:=found;
 if has_old then
  update public.crm_deal_owners o set performance_owner=v_to,performance_owner_id=v_to_id,updated_by=p_actor,updated_by_name=p_actor_name,updated_at=v_at where o.deal_id=p_deal returning * into cur;
 else
  -- 처음 고정하는 건: 요청에 적힌 '현재 귀속'을 최초 담당으로 남긴다(계정에 있는 이름일 때만)
  v_from:=nullif(btrim(coalesce(p_from,'')),'');
  select u.user_id into v_from_id from public.users u where btrim(u.name)=v_from order by u.active desc nulls last limit 1;
  insert into public.crm_deal_owners(deal_id,first_owner,first_owner_id,performance_owner,performance_owner_id,updated_by,updated_by_name,created_at,updated_at)
   values(p_deal,case when v_from_id is null then null else v_from end,v_from_id,v_to,v_to_id,p_actor,p_actor_name,v_at,v_at) returning * into cur;
 end if;
 insert into public.crm_deal_owner_events(deal_id,action,from_owner,to_owner,reason,attribution,before,after,actor,actor_name,at)
  values(p_deal,'attribution_change',coalesce(case when has_old then old.performance_owner end,nullif(btrim(coalesce(p_from,'')),'')),v_to,p_reason,'approved',case when has_old then to_jsonb(old) end,to_jsonb(cur),p_actor,p_actor_name,v_at);
 return to_jsonb(cur);
end $fn$;
revoke all on function crm_security.deal_owner_apply(text,text,text,text,uuid,text) from public, anon, authenticated;
