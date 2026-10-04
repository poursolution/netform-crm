-- 예외 승인함 v1 (2026-10-04 · design_handoff_rules 2차 기능 4)
-- 현장에서 바로 고치지 않고 승인함으로 모으는 요청: 귀속 변경 · 중복 리드 정산 · 전략수주 · 특별 인센티브 · 결과 수정.
-- 타사 이관 실적은 두 길로 온다: 기존 타사 이관 흐름(등록 → 낙찰결과 → crm_deal_transfer_approve_v1)과, 승인 요청 창에서 바로 올린 요청(이 표 · type = transfer).
-- 승인 · 반려는 예외 승인자(운영 기준 '예외 승인자' 목록 · 기본 이승우 · 황윤선) 중 한 사람이 한다 — crm_security.approval_approver (sql/ops-rules-v1 에 있다 · 먼저 적용).
-- 본인이 올린 요청은 다른 승인자가 처리한다. 누가 언제 승인 · 반려했는지는 요청(decided_by_name · decided_at)과 이력에 남는다.
-- 이 함수들은 요청 · 결정(승인 / 반려 · 사유) · 이력만 기록한다. 영업건 · 담당 · 계약실적 원장 · 수주 유형은 건드리지 않는다.
-- 승인되면 시안(승인 요청 창 · 2026-10-04 보완)의 안내대로 반영한다 — 승인 전에는 아무것도 바꾸지 않는다. 날짜는 요청에 적힌 실제 날(승인한 날로 대신하지 않는다):
--   귀속 변경 = 그 영업건의 실적 귀속 / 중복 리드 정산 = 실적 나눔 비율(합 100%)로 귀속 + 정산 내역(crm_deal_owners — sql/deal-owner-v1 · sql/settlement-v1)
--   타사 이관 실적 = 이관일 · 낙찰일대로 타사 이관 수주 실적 인정(crm_deal_transfers — sql/deal-transfer-v1)
--   결과 수정 = 수주 결과 · 낙찰일 · 낙찰금액(crm_deal_wins — sql/deal-win-type-v1), 직접 수주는 계약일 · 계약금액으로 계약실적 원장의 계약 체결까지(기존 기록 함수 그대로)
--   특별 인센티브 = 정산 내역에 별도 항목(대상자 · 금액 · 지급 월) / 전략수주 = 승인 기록 자체가 반영(승인선 예외).
--   영업건의 단계 · 담당과 계약실적 원장의 실적 귀속 방식은 건드리지 않는다. 반영에 실패하면 승인도 되돌린다.
-- 표는 RLS 를 켜고 정책을 두지 않는다 — 읽기 · 쓰기는 아래 함수로만. 바꿀 때마다 crm_approval_events 에 전 → 후가 남는다.
-- 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run. 화면은 함수가 있을 때만 이 요청들을 보여 준다.

create table if not exists public.crm_approval_requests(
 id bigserial primary key,
 type text not null check (type in ('owner_change','dup_lead','strategic_win','special_incentive','result_fix','transfer')),
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
-- 이미 만들어진 표에도 종류 6개를 받게 한다(승인 요청 창의 타사 이관 실적)
alter table public.crm_approval_requests drop constraint if exists crm_approval_requests_type_check;
alter table public.crm_approval_requests add constraint crm_approval_requests_type_check check (type in ('owner_change','dup_lead','strategic_win','special_incentive','result_fix','transfer'));

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

-- 읽기: 관리자 · 승인자 = 전부, 그 밖 = 자기가 올린 요청 + 자기 영업건의 요청. 거둔 요청은 빼고 최근 300건.
create or replace function public.crm_approval_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record; adm boolean; apr boolean;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 adm:=a.permission_role='admin'; apr:=crm_security.approval_approver(a.user_id);
 return jsonb_build_object('ok',true,'admin',adm,'approver',apr,'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.requested_at desc,r.id desc)
  from (select * from public.crm_approval_requests q where q.status<>'cancelled' and (adm or apr or q.requested_by=a.user_id
    or (q.deal_id is not null and exists(select 1 from public.deals d where d.id::text=q.deal_id and to_jsonb(d)->>'owner_id'=a.user_id::text))) order by q.requested_at desc,q.id desc limit 300) r),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_approval_list_v1(jsonb) from public, anon;
grant execute on function public.crm_approval_list_v1(jsonb) to authenticated;

-- 요청 올리기(로그인한 CRM 사용자) / 거두기(cancel = true · 올린 사람 또는 관리자 · 대기 중인 것만)
create or replace function public.crm_approval_request_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; old public.crm_approval_requests%rowtype; cur public.crm_approval_requests%rowtype;
 v_id bigint; v_type text; v_deal text; v_title text; v_reason text; v_payload jsonb; v_name text; v_at timestamptz:=clock_timestamp(); v_today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date; d1 date; d2 date;
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
 if v_type not in ('owner_change','dup_lead','strategic_win','special_incentive','result_fix','transfer') then raise exception '요청 종류를 골라 주세요' using errcode='22023'; end if;
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
 -- 승인되면 그대로 반영되는 값은 올릴 때 확인한다
 if v_type='dup_lead' and v_payload ? 'to_owner' and (v_deal is null or not exists(select 1 from public.users u where u.active is true and btrim(u.name)=nullif(btrim(coalesce(v_payload->>'to_owner','')),''))) then
  raise exception '최초 연결 담당자는 사용 중인 계정 이름이어야 합니다' using errcode='22023';
 end if;
 -- 날짜는 실제 일어난 날(오늘까지)만 받는다 — 승인한 날로 대신하지 않는다
 if v_type='transfer' then
  if v_deal is null or nullif(btrim(coalesce(v_payload->>'company','')),'') is null or length(v_payload->>'company')>80 or coalesce(v_payload->>'amount','') !~ '^[1-9][0-9]{0,14}$' then
   raise exception '이관 업체와 낙찰금액(원 단위 숫자)을 적어 주세요' using errcode='22023';
  end if;
  begin d1:=(v_payload->>'transfer_date')::date; d2:=(v_payload->>'award_date')::date; exception when others then d1:=null; d2:=null; end;
  if d1 is null or d2 is null or d1>v_today or d2>v_today or d2<d1 then raise exception '이관일 · 낙찰일을 실제 일어난 날(오늘까지)로 적어 주세요 — 낙찰일은 이관일보다 앞설 수 없습니다' using errcode='22023'; end if;
 end if;
 if v_type='result_fix' and v_payload ? 'to_result' then
  if v_deal is null or v_payload->>'to_result' not in ('won_own','won_partner_tech','lost') then raise exception '바꿀 결과를 확인해 주세요' using errcode='22023'; end if;
  if v_payload->>'to_result'<>'lost' then
   if coalesce(v_payload->>'amount','') !~ '^[1-9][0-9]{0,14}$' then raise exception '낙찰금액(원 단위 숫자)을 적어 주세요' using errcode='22023'; end if;
   begin d1:=(v_payload->>'award_date')::date; exception when others then d1:=null; end;
   if d1 is null or d1>v_today then raise exception '낙찰일을 실제 일어난 날(오늘까지)로 적어 주세요' using errcode='22023'; end if;
  end if;
  if v_payload->>'to_result'='won_own' then
   begin d2:=(v_payload->>'contract_date')::date; exception when others then d2:=null; end;
   if d2 is null or d2>v_today or coalesce(v_payload->>'contract_amount','') !~ '^[1-9][0-9]{0,14}$' then raise exception '직접 수주는 계약일(오늘까지) · 계약금액을 함께 적어 주세요' using errcode='22023'; end if;
  end if;
 end if;
 -- 중복 리드 정산: 실적 나눔 = 사용 중인 계정 이름 + 비율, 합 100
 if v_type='dup_lead' and v_payload ? 'shares' and (v_deal is null or jsonb_typeof(v_payload->'shares')<>'array' or jsonb_array_length(v_payload->'shares') not between 2 and 5
   or exists(select 1 from jsonb_array_elements(v_payload->'shares') x where nullif(btrim(coalesce(x->>'name','')),'') is null or coalesce(x->>'ratio','') !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' or (x->>'ratio')::numeric<=0
     or not exists(select 1 from public.users u where u.active is true and btrim(u.name)=btrim(x->>'name')))
   or (select sum((x->>'ratio')::numeric) from jsonb_array_elements(v_payload->'shares') x)<>100
   or (select count(distinct btrim(x->>'name')) from jsonb_array_elements(v_payload->'shares') x)<>jsonb_array_length(v_payload->'shares')) then
  raise exception '실적 나눔은 담당자 이름과 비율로 적어 주세요 — 합이 100%%여야 합니다' using errcode='22023';
 end if;
 -- 특별 인센티브: 대상자 · 방식(금액 또는 비율) · 값 · 지급 월
 if v_type='special_incentive' and v_payload ? 'target' and (not exists(select 1 from public.users u where u.active is true and btrim(u.name)=nullif(btrim(coalesce(v_payload->>'target','')),''))
   or coalesce(v_payload->>'mode','') not in ('amount','ratio') or coalesce(v_payload->>'value','') !~ '^[0-9]{1,15}(\.[0-9]{1,2})?$' or (v_payload->>'value')::numeric<=0
   or (v_payload->>'mode'='ratio' and (v_payload->>'value')::numeric>100) or coalesce(v_payload->>'pay_month','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$') then
  raise exception '대상자 · 방식(금액 또는 비율) · 지급 월을 확인해 주세요' using errcode='22023';
 end if;
 -- 귀속 변경: 어느 영업건의 귀속을 누구로 바꿀지 분명해야 한다(승인되면 그대로 반영된다)
 if v_type='owner_change' and (v_deal is null or not exists(select 1 from public.users u where u.active is true and btrim(u.name)=nullif(btrim(coalesce(v_payload->>'to_owner','')),''))) then
  raise exception '바꿀 귀속은 사용 중인 계정 이름으로 적어 주세요' using errcode='22023';
 end if;
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

-- 승인 / 반려(예외 승인자 중 한 사람): 반려는 사유 필수. 대기 중인 요청만. 본인이 올린 요청은 다른 승인자가. 결정만 기록한다(다른 자료는 바꾸지 않는다).
create or replace function public.crm_approval_decide_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; old public.crm_approval_requests%rowtype; cur public.crm_approval_requests%rowtype;
 v_id bigint; v_dec text; v_reason text; v_name text; v_owner jsonb; v_applied jsonb; v_at timestamptz:=clock_timestamp();
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if not crm_security.approval_approver(a.user_id) then raise exception '승인 · 반려는 예외 승인자만 할 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'id')::bigint; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_dec:=coalesce(p->>'decision','');
 if v_id is null or v_dec not in ('approve','reject') then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into old from public.crm_approval_requests q where q.id=v_id for update;
 if not found then raise exception '요청을 찾을 수 없습니다' using errcode='22023'; end if;
 if old.status<>'pending' then raise exception '이미 처리된 요청입니다' using errcode='22023'; end if;
 if old.requested_by is not distinct from a.user_id then raise exception '본인이 올린 요청은 다른 승인자가 처리해야 합니다' using errcode='42501'; end if;
 v_reason:=nullif(btrim(coalesce(p->>'reason','')),'');
 if v_reason is not null and length(v_reason)>300 then raise exception '사유는 300자 이내로 적어 주세요' using errcode='22023'; end if;
 if v_dec='reject' and v_reason is null then raise exception '반려 사유를 적어 주세요' using errcode='22023'; end if;
 select u.name into v_name from public.users u where u.user_id=a.user_id;
 update public.crm_approval_requests q set status=case when v_dec='approve' then 'approved' else 'rejected' end,decided_by=a.user_id,decided_by_name=v_name,decided_at=v_at,decision_reason=v_reason
  where q.id=v_id returning * into cur;
 insert into public.crm_approval_events(request_id,action,before,after,actor,actor_name,at) values(v_id,v_dec,to_jsonb(old),to_jsonb(cur),a.user_id,v_name,v_at);
 -- 승인 = 시안의 안내대로 반영한다(해당 기능이 설치돼 있을 때). 반영에 실패하면 승인도 되돌린다.
 if v_dec='approve' and old.deal_id is not null then
  if old.type='dup_lead' and jsonb_typeof(old.payload->'shares')='array' and to_regprocedure('crm_security.deal_split_apply(text,jsonb,text,bigint,uuid,text)') is not null then
   execute 'select crm_security.deal_split_apply($1,$2,$3,$4,$5,$6)' into v_owner using old.deal_id,old.payload->'shares',old.reason,old.id,a.user_id,v_name;
  elsif old.type in ('owner_change','dup_lead') and nullif(btrim(coalesce(old.payload->>'to_owner','')),'') is not null and to_regprocedure('crm_security.deal_owner_apply(text,text,text,text,uuid,text)') is not null then
   execute 'select crm_security.deal_owner_apply($1,$2,$3,$4,$5,$6)' into v_owner using old.deal_id,old.payload->>'from_owner',old.payload->>'to_owner',old.reason,a.user_id,v_name;
  elsif old.type='transfer' and to_regprocedure('crm_security.deal_transfer_apply(text,text,numeric,text,date,date,uuid,text,uuid,text)') is not null then
   if not (old.payload ? 'transfer_date' and old.payload ? 'award_date') then raise exception '이관일 · 낙찰일이 없는 요청입니다 — 반려하고 날짜를 넣어 다시 올려 주세요' using errcode='22023'; end if;
   execute 'select crm_security.deal_transfer_apply($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)' into v_applied using old.deal_id,old.payload->>'company',(old.payload->>'amount')::numeric,left(old.reason||coalesce(' · '||nullif(old.payload#>>'{evidence,file_name}',''),''),300),
    (old.payload->>'transfer_date')::date,(old.payload->>'award_date')::date,old.requested_by,old.requested_by_name,a.user_id,v_name;
  elsif old.type='result_fix' and old.payload ? 'to_result' and to_regprocedure('crm_security.deal_win_apply(text,text,numeric,date,date,numeric,text,uuid,text)') is not null then
   if old.payload->>'to_result'<>'lost' and not (old.payload ? 'award_date') then raise exception '낙찰일이 없는 요청입니다 — 반려하고 날짜를 넣어 다시 올려 주세요' using errcode='22023'; end if;
   execute 'select crm_security.deal_win_apply($1,$2,$3,$4,$5,$6,$7,$8,$9)' into v_applied using old.deal_id,old.payload->>'to_result',nullif(old.payload->>'amount','')::numeric,nullif(old.payload->>'award_date','')::date,
    nullif(old.payload->>'contract_date','')::date,nullif(old.payload->>'contract_amount','')::numeric,old.reason,a.user_id,v_name;
  elsif old.type='special_incentive' and old.payload ? 'target' and to_regprocedure('crm_security.settlement_add(text,text,bigint,text,numeric,numeric,text,jsonb,uuid,text)') is not null then
   execute 'select crm_security.settlement_add($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)' into v_applied using 'incentive',old.deal_id,old.id,old.payload->>'target',
    case when old.payload->>'mode'='ratio' then (old.payload->>'value')::numeric end,
    case when old.payload->>'mode'='amount' then (old.payload->>'value')::numeric else nullif(old.payload->>'amount','')::numeric end,
    old.payload->>'pay_month',jsonb_build_object('mode',old.payload->>'mode','value',old.payload->>'value','base',old.payload->>'base','reason',old.reason),a.user_id,v_name;
  end if;
 end if;
 return jsonb_build_object('ok',true,'request',to_jsonb(cur),'owner',v_owner,'applied',v_applied);
end $fn$;
revoke all on function public.crm_approval_decide_v1(jsonb) from public, anon;
grant execute on function public.crm_approval_decide_v1(jsonb) to authenticated;
