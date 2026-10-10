-- 운영 기준 공통 설정 v2 (2026-10-10 · design_handoff_admin_request E · design_handoff_promise_gap ③ · design_handoff_day_zones §2)
-- v1(sql/ops-rules-v1-20261004.sql)과 같은 함수 이름(crm_ops_rules_v1)을 다시 정의한다 — 화면은 함수 이름을 바꾸지 않고 payload 에 apply 를 덧붙여 보낸다.
-- 바뀐 것:
--  1) 조건부 항목 추가: ongoing_unreachable_attempts(진행 중 연락두절 · 월 간격 횟수 1~10) · record_deadline_hour(기록 입력 마감 시각 9~18) · important_request_kinds(팝업으로 알릴 '중요' 요청 종류 · 0~20개 — 비어 있으면 새 배정 · 긴급 기한 변경만 팝업)
--  2) 변경 이력에 적용 범위를 함께 남긴다: effective_on(적용일) · scope(대상 · 단계 · 조건 · 건수) · existing_handling(기존 업무 처리 keep=그대로 · recalc=다시 계산 · ask=담당 확인)
--     contract 3은 오늘(KST)의 즉시 적용만 허용한다. scope는 설명 이력이고 대상별 정책 필터가 아니다.
--     예약 적용·기존 업무 처리 엔진이 없으므로 오늘 이외 날짜와 existing 키는 변경 전에 거절한다.
--  3) 응답에 contract=3 · apply(검증·저장한 조건) · version(이력 건수 = 기준 버전)을 넣는다.
-- 영업 데이터(문의 · 영업건 · 계약실적 · 요청)는 건드리지 않는다. 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run.

alter table public.crm_rule_history add column if not exists effective_on date;
alter table public.crm_rule_history add column if not exists scope text;
alter table public.crm_rule_history add column if not exists existing_handling text;

create or replace function public.crm_ops_rules_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; k text; v jsonb; cur jsonb; old jsonb; n numeric; lo numeric; hi numeric; v_name text; v_at timestamptz:=clock_timestamp(); changed int:=0;
 v_eff date; v_scope text; v_ex text; ap jsonb;
 -- 조건부 숫자 항목과 범위(ops-rules.js 의 SPEC 과 같아야 한다)
 lim constant jsonb:='{"assign_minutes":[10,240],"unreachable_attempts":[1,10],"unreachable_interval_days":[1,7],"long_wait_contact_days":[30,180],"transfer_result_check_days":[3,60],"nearby_radius_km":[1,20],"care_focus_months":[1,6],"care_general_months":[1,12],"ongoing_unreachable_attempts":[1,10],"record_deadline_hour":[9,18]}'::jsonb;
 bools constant text[]:=array['stage_gates','year_management','year_required_on_convert','year_future_skip_focus','auto_owner_attribution','owner_keep_on_reassign','nearby_map'];
 lists constant text[]:=array['reasons_bad_fit','reasons_lost','reasons_transfer','contact_channels','approvers','important_request_kinds'];
 -- 비어 있어도 되는 목록(중요 요청 종류 — 값은 대표 결정 전이라 기본 비어 있음)
 empty_ok constant text[]:=array['important_request_kinds'];
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 select s.value into cur from public.crm_settings s where s.key='ops_rules';
 if cur is null or jsonb_typeof(cur)<>'object' then cur:='{}'::jsonb; end if;
 if jsonb_typeof(p->'set')='object' then
  if a.permission_role<>'admin' then raise exception '관리자만 운영 기준을 바꿀 수 있습니다' using errcode='42501'; end if;
  select u.name into v_name from public.users u where u.user_id=a.user_id;
  -- v2 이력·칼럼은 보존한다. 지원하지 않는 적용 의미를 조용히 버리지 않는다.
  if p ? 'apply' then
   ap:=p->'apply';
   if jsonb_typeof(ap) is distinct from 'object' then raise exception 'invalid apply' using errcode='22023'; end if;
   if exists(select 1 from jsonb_object_keys(ap) x where x not in ('effective_on','scope'))
      or jsonb_typeof(ap->'effective_on') is distinct from 'string'
      or ap->>'effective_on' is distinct from to_char(v_at at time zone 'Asia/Seoul','YYYY-MM-DD')
      or jsonb_typeof(ap->'scope') is distinct from 'string'
      or coalesce(ap->>'scope','') !~ '[^[:space:]]' or length(ap->>'scope')>300 then
    raise exception '오늘(KST) 즉시 적용만 가능합니다. 예약 적용·기존 업무 처리 기능은 아직 연결되지 않아 저장하지 않았습니다' using errcode='22023';
   end if;
   v_eff:=(ap->>'effective_on')::date; v_scope:=ap->>'scope';
  end if;
  for k,v in select * from jsonb_each(p->'set') loop
   if lim ? k then
    if jsonb_typeof(v)<>'number' then raise exception 'invalid payload' using errcode='22023'; end if;
    n:=(v#>>'{}')::numeric; lo:=(lim->k->>0)::numeric; hi:=(lim->k->>1)::numeric;
    if n<>trunc(n) or n<lo or n>hi then raise exception '범위를 벗어난 값입니다: %', k using errcode='22023'; end if;
   elsif k=any(bools) then
    if jsonb_typeof(v)<>'boolean' then raise exception 'invalid payload' using errcode='22023'; end if;
   elsif k=any(lists) then
    if jsonb_typeof(v)<>'array' or (jsonb_array_length(v)<1 and not (k=any(empty_ok))) or jsonb_array_length(v)>20
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
    insert into public.crm_rule_history(key,before,after,changed_by,changed_by_name,changed_at,effective_on,scope,existing_handling) values(k,old,v,a.user_id,v_name,v_at,v_eff,v_scope,v_ex);
    cur:=cur||jsonb_build_object(k,v); changed:=changed+1;
   end if;
  end loop;
  if changed>0 then
   insert into public.crm_settings(key,value,updated_by,updated_at) values('ops_rules',cur,a.user_id,v_at)
    on conflict (key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end if;
 end if;
 return jsonb_build_object('ok',true,'contract',3,'apply',ap,'rules',cur,'changed',changed,
  'version',(select count(*) from public.crm_rule_history),
  'updated_at',(select s.updated_at from public.crm_settings s where s.key='ops_rules'),
  'updated_by_name',(select u.name from public.crm_settings s join public.users u on u.user_id=s.updated_by where s.key='ops_rules'),
  'history',coalesce((select jsonb_agg(jsonb_build_object('key',h.key,'before',h.before,'after',h.after,'by',h.changed_by_name,'at',h.changed_at,'effective_on',h.effective_on,'scope',h.scope,'existing',h.existing_handling) order by h.changed_at desc,h.id desc)
    from (select * from public.crm_rule_history order by changed_at desc,id desc limit 20) h),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_ops_rules_v1(jsonb) from public, anon;
grant execute on function public.crm_ops_rules_v1(jsonb) to authenticated;
