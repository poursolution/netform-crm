-- 운영 기준 공통 설정 v1 (2026-10-04 · design_handoff_rules)
-- 모든 화면이 같은 기준(메이드율 · 수주실적 · 놓침)을 보도록, '조건부' 값만 한곳(crm_settings 의 'ops_rules' 한 줄)에 둔다.
-- 읽기 = 로그인한 CRM 사용자, 바꾸기 = 관리자만. 바꿀 때마다 변경 이력(누가 · 언제 · 전 → 후)을 남긴다.
-- '확정' 값(첫 연락 2시간 · 활동 없음 7일 · 견적 후속 7일 · 메이드율 식 등)은 여기서 바꿀 수 없다 — 화면 코드(ops-rules.js)의 기본값이다.
-- 영업 데이터(문의 · 영업건 · 계약실적)는 건드리지 않는다. 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run.

create table if not exists public.crm_rule_history(
 id bigserial primary key,
 key text not null,
 before jsonb,
 after jsonb not null,
 changed_by uuid,
 changed_by_name text,
 changed_at timestamptz not null default now()
);
alter table public.crm_rule_history enable row level security;
revoke all on table public.crm_rule_history from public, anon, authenticated;
create index if not exists crm_rule_history_at on public.crm_rule_history(changed_at desc);

create or replace function public.crm_ops_rules_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; k text; v jsonb; cur jsonb; old jsonb; n numeric; lo numeric; hi numeric; v_name text; v_at timestamptz:=clock_timestamp(); changed int:=0;
 -- 조건부 숫자 항목과 범위(ops-rules.js 의 SPEC 과 같아야 한다)
 lim constant jsonb:='{"assign_minutes":[10,240],"unreachable_attempts":[1,10],"unreachable_interval_days":[1,7],"long_wait_contact_days":[30,180],"transfer_result_check_days":[3,60],"nearby_radius_km":[1,20]}'::jsonb;
 bools constant text[]:=array['stage_gates','year_management','year_required_on_convert','year_future_skip_focus','auto_owner_attribution','owner_keep_on_reassign','nearby_map'];
 lists constant text[]:=array['reasons_bad_fit','reasons_lost','reasons_transfer','contact_channels','approvers'];
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 select s.value into cur from public.crm_settings s where s.key='ops_rules';
 if cur is null or jsonb_typeof(cur)<>'object' then cur:='{}'::jsonb; end if;
 if jsonb_typeof(p->'set')='object' then
  if a.permission_role<>'admin' then raise exception '관리자만 운영 기준을 바꿀 수 있습니다' using errcode='42501'; end if;
  select u.name into v_name from public.users u where u.user_id=a.user_id;
  for k,v in select * from jsonb_each(p->'set') loop
   if lim ? k then
    if jsonb_typeof(v)<>'number' then raise exception 'invalid payload' using errcode='22023'; end if;
    n:=(v#>>'{}')::numeric; lo:=(lim->k->>0)::numeric; hi:=(lim->k->>1)::numeric;
    if n<>trunc(n) or n<lo or n>hi then raise exception '범위를 벗어난 값입니다: %', k using errcode='22023'; end if;
   elsif k=any(bools) then
    if jsonb_typeof(v)<>'boolean' then raise exception 'invalid payload' using errcode='22023'; end if;
   elsif k=any(lists) then
    if jsonb_typeof(v)<>'array' or jsonb_array_length(v)<1 or jsonb_array_length(v)>20
       or exists(select 1 from jsonb_array_elements(v) e where jsonb_typeof(e)<>'string' or length(btrim(e#>>'{}'))<1 or length(e#>>'{}')>30) then
     raise exception '목록은 1~20개, 한 항목 30자 이내여야 합니다: %', k using errcode='22023';
    end if;
    -- 예외 승인자는 사용 중인 계정 이름이어야 한다(오타로 승인할 사람이 없어지는 일을 막는다)
    if k='approvers' and exists(select 1 from jsonb_array_elements_text(v) x where not exists(select 1 from public.users u where u.active is true and btrim(u.name)=btrim(x))) then
     raise exception '예외 승인자는 사용 중인 계정 이름이어야 합니다' using errcode='22023';
    end if;
   else
    raise exception '바꿀 수 없는 항목입니다: %', k using errcode='22023';
   end if;
   old:=cur->k;
   if old is distinct from v then
    insert into public.crm_rule_history(key,before,after,changed_by,changed_by_name,changed_at) values(k,old,v,a.user_id,v_name,v_at);
    cur:=cur||jsonb_build_object(k,v); changed:=changed+1;
   end if;
  end loop;
  if changed>0 then
   insert into public.crm_settings(key,value,updated_by,updated_at) values('ops_rules',cur,a.user_id,v_at)
    on conflict (key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end if;
 end if;
 return jsonb_build_object('ok',true,'rules',cur,'changed',changed,
  'updated_at',(select s.updated_at from public.crm_settings s where s.key='ops_rules'),
  'updated_by_name',(select u.name from public.crm_settings s join public.users u on u.user_id=s.updated_by where s.key='ops_rules'),
  'history',coalesce((select jsonb_agg(jsonb_build_object('key',h.key,'before',h.before,'after',h.after,'by',h.changed_by_name,'at',h.changed_at) order by h.changed_at desc,h.id desc)
    from (select * from public.crm_rule_history order by changed_at desc,id desc limit 20) h),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_ops_rules_v1(jsonb) from public, anon;
grant execute on function public.crm_ops_rules_v1(jsonb) to authenticated;

-- 예외 승인자(2026-10-04 대표 지정): 승인 요청은 운영 기준의 '예외 승인자' 목록(기본 이승우 · 황윤선)에게 가고, 그중 한 사람만 승인해도 된다.
-- 승인 함수들(crm_approval_decide_v1 · crm_deal_transfer_approve_v1)이 이 함수로 권한을 본다. 목록의 이름과 같은, 사용 중인 계정만 승인자다.
create or replace function crm_security.approval_approver(p_user uuid)
returns boolean language plpgsql stable security definer set search_path='' as $fn$
declare l jsonb;
begin
 select s.value->'approvers' into l from public.crm_settings s where s.key='ops_rules';
 if l is null or jsonb_typeof(l)<>'array' or jsonb_array_length(l)<1 then l:='["이승우","황윤선"]'::jsonb; end if;
 return exists(select 1 from public.users u where u.user_id=p_user and u.active is true and btrim(u.name) in (select btrim(x) from jsonb_array_elements_text(l) x));
end $fn$;
revoke all on function crm_security.approval_approver(uuid) from public, anon, authenticated;
