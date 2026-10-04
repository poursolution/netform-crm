-- 타사 이관 v1 (2026-10-04 · design_handoff_transfer · 운영 기준 4단계)
-- 타사 이관은 영업단계가 아니라 처리 방식(상태값)이다 — 영업건의 단계 · 담당 · 계약실적 원장은 건드리지 않고, 이관 정보만 이 표에 둔다.
-- 흐름: 이관 등록(담당자) → 낙찰결과 대기 → 낙찰결과 등록(담당자) → 실적 인정(관리자) → 수주실적 · 메이드율에 반영.
-- 실적 금액 = 최종 낙찰금액(VAT 별도) 전액. 사전 정식 보고된 건만, 예외 승인자가 인정한 건만 incentive_eligible = true.
-- 표는 RLS 를 켜고 정책을 두지 않는다 — 읽기 · 쓰기는 아래 함수로만. 바꿀 때마다 crm_deal_transfer_events 에 전 → 후가 남는다.
-- 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run. 화면은 CRMRelease 게이트로 함수가 있을 때만 기능을 연다.

create table if not exists public.crm_deal_transfers(
 deal_id text primary key,
 transfer_status text not null default 'transferred' check (transfer_status in ('transferred','cancelled')),
 transfer_company text not null,
 transfer_reason text not null,
 transfer_date date not null,
 transfer_reported boolean not null default false,
 transfer_reported_at date,
 transfer_memo text,
 expected_amount numeric,
 award_result text not null default 'pending' check (award_result in ('pending','transferred_won','lost','cancelled')),
 award_company text,
 award_date date,
 award_amount numeric,
 award_evidence text,
 award_note text,
 performance_amount numeric,
 performance_owner text,
 performance_owner_id uuid,
 incentive_eligible boolean not null default false,
 approval_checks jsonb,
 approved_by uuid,
 approved_by_name text,
 approved_at timestamptz,
 rejected_reason text,
 created_by uuid,
 created_by_name text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.crm_deal_transfers enable row level security;
revoke all on table public.crm_deal_transfers from public, anon, authenticated;

create table if not exists public.crm_deal_transfer_events(
 id bigserial primary key,
 deal_id text not null,
 action text not null,
 before jsonb,
 after jsonb,
 actor uuid,
 actor_name text,
 at timestamptz not null default now()
);
alter table public.crm_deal_transfer_events enable row level security;
revoke all on table public.crm_deal_transfer_events from public, anon, authenticated;
create index if not exists crm_deal_transfer_events_deal on public.crm_deal_transfer_events(deal_id,at desc);

-- 읽기: 로그인한 CRM 사용자(수주실적 · 메이드율은 전 직원 공개)
create or replace function public.crm_deal_transfer_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'rows',coalesce((select jsonb_agg(to_jsonb(t) order by t.transfer_date desc,t.deal_id) from public.crm_deal_transfers t where t.transfer_status='transferred'),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_deal_transfer_list_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_transfer_list_v1(jsonb) to authenticated;

-- 이관 등록(담당자 또는 관리자). 낙찰결과가 등록되기 전까지 고칠 수 있다. cancel=true 면 등록을 거둔다(낙찰결과 대기 중일 때만)
create or replace function public.crm_deal_transfer_register_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; dj jsonb; old public.crm_deal_transfers%rowtype; cur public.crm_deal_transfers%rowtype; has_old boolean;
 v_deal text; v_company text; v_reason text; v_memo text; v_date date; v_rep boolean; v_rep_at date; v_exp numeric; v_name text; v_owner text; v_owner_id uuid; v_at timestamptz:=clock_timestamp();
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),'');
 if v_deal is null or length(v_deal)>80 then raise exception 'invalid payload' using errcode='22023'; end if;
 select to_jsonb(d) into dj from public.deals d where d.id::text=v_deal;
 if dj is null then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 select * into old from public.crm_deal_transfers t where t.deal_id=v_deal for update;
 has_old:=found;
 if a.permission_role<>'admin' and coalesce(dj->>'owner_id','')<>a.user_id::text and not (has_old and old.performance_owner_id=a.user_id) then
  raise exception '담당자 또는 관리자만 등록할 수 있습니다' using errcode='42501';
 end if;
 select u.name into v_name from public.users u where u.user_id=a.user_id;
 if has_old and old.transfer_status='transferred' and old.award_result<>'pending' then raise exception '낙찰결과가 등록된 건은 이관 정보를 바꿀 수 없습니다' using errcode='22023'; end if;
 if coalesce((p->>'cancel')::boolean,false) then
  if not has_old or old.transfer_status<>'transferred' then raise exception '등록된 타사 이관이 없습니다' using errcode='22023'; end if;
  update public.crm_deal_transfers t set transfer_status='cancelled',updated_at=v_at where t.deal_id=v_deal returning * into cur;
  insert into public.crm_deal_transfer_events(deal_id,action,before,after,actor,actor_name,at) values(v_deal,'cancel',to_jsonb(old),to_jsonb(cur),a.user_id,v_name,v_at);
  return jsonb_build_object('ok',true,'deal_id',v_deal,'transfer',null);
 end if;
 v_company:=nullif(btrim(coalesce(p->>'company','')),''); v_reason:=nullif(btrim(coalesce(p->>'reason','')),''); v_memo:=nullif(btrim(coalesce(p->>'memo','')),'');
 if v_company is null or length(v_company)>80 then raise exception '이관 업체를 적어 주세요' using errcode='22023'; end if;
 if v_reason is null or length(v_reason)>40 then raise exception '이관 사유를 골라 주세요' using errcode='22023'; end if;
 if v_memo is not null and length(v_memo)>300 then raise exception '메모는 300자 이내로 적어 주세요' using errcode='22023'; end if;
 begin v_date:=(p->>'date')::date; exception when others then raise exception '이관일을 확인해 주세요' using errcode='22023'; end;
 if v_date is null then raise exception '이관일을 확인해 주세요' using errcode='22023'; end if;
 if jsonb_typeof(p->'reported') is distinct from 'boolean' then raise exception '사전 보고 여부를 골라 주세요' using errcode='22023'; end if;
 v_rep:=(p->>'reported')::boolean;
 begin v_rep_at:=nullif(p->>'reported_at','')::date; exception when others then raise exception '보고일을 확인해 주세요' using errcode='22023'; end;
 if not v_rep then v_rep_at:=null; end if;
 begin v_exp:=nullif(p->>'expected_amount','')::numeric; exception when others then raise exception '예상 공사금액을 확인해 주세요' using errcode='22023'; end;
 if v_exp is not null and v_exp<0 then raise exception '예상 공사금액을 확인해 주세요' using errcode='22023'; end if;
 -- 실적 귀속 = 이관 전(등록 시점) 담당자. 한 번 정해지면 다시 등록해도 바뀌지 않는다
 if has_old and old.performance_owner is not null then v_owner:=old.performance_owner; v_owner_id:=old.performance_owner_id;
 else
  begin v_owner_id:=nullif(dj->>'owner_id','')::uuid; exception when others then v_owner_id:=null; end;
  v_owner:=coalesce(nullif(btrim(coalesce(dj->>'assignee_name','')),''),(select u.name from public.users u where u.user_id=v_owner_id));
 end if;
 insert into public.crm_deal_transfers(deal_id,transfer_status,transfer_company,transfer_reason,transfer_date,transfer_reported,transfer_reported_at,transfer_memo,expected_amount,award_result,performance_owner,performance_owner_id,created_by,created_by_name,created_at,updated_at)
  values(v_deal,'transferred',v_company,v_reason,v_date,v_rep,v_rep_at,v_memo,v_exp,'pending',v_owner,v_owner_id,a.user_id,v_name,v_at,v_at)
 on conflict (deal_id) do update set transfer_status='transferred',transfer_company=excluded.transfer_company,transfer_reason=excluded.transfer_reason,transfer_date=excluded.transfer_date,
  transfer_reported=excluded.transfer_reported,transfer_reported_at=excluded.transfer_reported_at,transfer_memo=excluded.transfer_memo,expected_amount=excluded.expected_amount,
  award_result='pending',award_company=null,award_date=null,award_amount=null,award_evidence=null,award_note=null,performance_amount=null,
  incentive_eligible=false,approval_checks=null,approved_by=null,approved_by_name=null,approved_at=null,rejected_reason=null,
  performance_owner=excluded.performance_owner,performance_owner_id=excluded.performance_owner_id,updated_at=v_at
 returning * into cur;
 insert into public.crm_deal_transfer_events(deal_id,action,before,after,actor,actor_name,at) values(v_deal,'register',case when has_old then to_jsonb(old) else null end,to_jsonb(cur),a.user_id,v_name,v_at);
 return jsonb_build_object('ok',true,'deal_id',v_deal,'transfer',to_jsonb(cur));
end $fn$;
revoke all on function public.crm_deal_transfer_register_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_transfer_register_v1(jsonb) to authenticated;

-- 낙찰결과 등록(담당자 또는 관리자): transferred_won(낙찰 업체 · 낙찰일 · 낙찰금액 · 증빙 필수) | lost(사유 필수) | cancelled(입찰 취소 · 보류)
create or replace function public.crm_deal_transfer_award_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; dj jsonb; old public.crm_deal_transfers%rowtype; cur public.crm_deal_transfers%rowtype;
 v_deal text; v_res text; v_company text; v_date date; v_amt numeric; v_ev text; v_note text; v_name text; v_at timestamptz:=clock_timestamp();
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),''); v_res:=coalesce(p->>'result','');
 if v_deal is null or v_res not in ('transferred_won','lost','cancelled') then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into old from public.crm_deal_transfers t where t.deal_id=v_deal for update;
 if not found or old.transfer_status<>'transferred' then raise exception '등록된 타사 이관이 없습니다' using errcode='22023'; end if;
 select to_jsonb(d) into dj from public.deals d where d.id::text=v_deal;
 if a.permission_role<>'admin' and coalesce(dj->>'owner_id','')<>a.user_id::text and old.performance_owner_id is distinct from a.user_id then
  raise exception '담당자 또는 관리자만 등록할 수 있습니다' using errcode='42501';
 end if;
 if old.incentive_eligible then raise exception '실적이 인정된 건은 바꿀 수 없습니다' using errcode='22023'; end if;
 select u.name into v_name from public.users u where u.user_id=a.user_id;
 v_note:=nullif(btrim(coalesce(p->>'note','')),'');
 if v_note is not null and length(v_note)>300 then raise exception '메모는 300자 이내로 적어 주세요' using errcode='22023'; end if;
 if v_res='transferred_won' then
  v_company:=nullif(btrim(coalesce(p->>'company','')),''); v_ev:=nullif(btrim(coalesce(p->>'evidence','')),'');
  if v_company is null or length(v_company)>80 then raise exception '낙찰 업체를 적어 주세요' using errcode='22023'; end if;
  begin v_date:=(p->>'date')::date; exception when others then raise exception '낙찰일을 확인해 주세요' using errcode='22023'; end;
  if v_date is null then raise exception '낙찰일을 확인해 주세요' using errcode='22023'; end if;
  begin v_amt:=(p->>'amount')::numeric; exception when others then raise exception '낙찰금액을 확인해 주세요' using errcode='22023'; end;
  if v_amt is null or v_amt<=0 or v_amt<>trunc(v_amt) then raise exception '낙찰금액(VAT 별도)을 원 단위 숫자로 적어 주세요' using errcode='22023'; end if;
  if v_ev is null or length(v_ev)>300 then raise exception '증빙(낙찰공고 · 결과자료)을 적어 주세요' using errcode='22023'; end if;
 elsif v_res='lost' then
  if v_note is null then raise exception '실주 사유를 적어 주세요' using errcode='22023'; end if;
  begin v_date:=coalesce(nullif(p->>'date','')::date,(v_at at time zone 'Asia/Seoul')::date); exception when others then raise exception '날짜를 확인해 주세요' using errcode='22023'; end;
 else
  begin v_date:=coalesce(nullif(p->>'date','')::date,(v_at at time zone 'Asia/Seoul')::date); exception when others then raise exception '날짜를 확인해 주세요' using errcode='22023'; end;
 end if;
 update public.crm_deal_transfers t set award_result=v_res,award_company=v_company,award_date=v_date,award_amount=v_amt,award_evidence=v_ev,award_note=v_note,
  performance_amount=case when v_res='transferred_won' then v_amt else null end,
  incentive_eligible=false,approval_checks=null,approved_by=null,approved_by_name=null,approved_at=null,rejected_reason=null,updated_at=v_at
  where t.deal_id=v_deal returning * into cur;
 insert into public.crm_deal_transfer_events(deal_id,action,before,after,actor,actor_name,at) values(v_deal,'award',to_jsonb(old),to_jsonb(cur),a.user_id,v_name,v_at);
 return jsonb_build_object('ok',true,'deal_id',v_deal,'transfer',to_jsonb(cur));
end $fn$;
revoke all on function public.crm_deal_transfer_award_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_transfer_award_v1(jsonb) to authenticated;

-- 실적 인정(예외 승인자 중 한 사람 · 2026-10-04 대표 지정 — crm_security.approval_approver 는 sql/ops-rules-v1 에 있다 · 본인 건은 다른 승인자가): approve = 사전 보고 · 낙찰결과 · 낙찰금액 세 가지를 모두 확인해야 한다 / reject = 사유 필수(실적 제외)
create or replace function public.crm_deal_transfer_approve_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; old public.crm_deal_transfers%rowtype; cur public.crm_deal_transfers%rowtype;
 v_deal text; v_dec text; v_reason text; v_name text; v_at timestamptz:=clock_timestamp(); c jsonb;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if not crm_security.approval_approver(a.user_id) then raise exception '실적 인정은 예외 승인자만 할 수 있습니다' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),''); v_dec:=coalesce(p->>'decision','');
 if v_deal is null or v_dec not in ('approve','reject') then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into old from public.crm_deal_transfers t where t.deal_id=v_deal for update;
 if not found or old.transfer_status<>'transferred' or old.award_result<>'transferred_won' then raise exception '낙찰결과(타사 이관 수주)가 등록된 건만 처리할 수 있습니다' using errcode='22023'; end if;
 if old.performance_owner_id is not distinct from a.user_id or old.created_by is not distinct from a.user_id then raise exception '본인 건은 다른 승인자가 처리해야 합니다' using errcode='42501'; end if;
 select u.name into v_name from public.users u where u.user_id=a.user_id;
 if v_dec='approve' then
  if not old.transfer_reported then raise exception '사전 보고되지 않은 이관은 실적으로 인정할 수 없습니다' using errcode='22023'; end if;
  c:=p->'checks';
  if jsonb_typeof(c) is distinct from 'object' or coalesce((c->>'reported')::boolean,false) is not true or coalesce((c->>'result')::boolean,false) is not true or coalesce((c->>'amount')::boolean,false) is not true then
   raise exception '사전 보고 · 낙찰결과 · 낙찰금액을 모두 확인해 주세요' using errcode='22023';
  end if;
  update public.crm_deal_transfers t set incentive_eligible=true,approval_checks=c,approved_by=a.user_id,approved_by_name=v_name,approved_at=v_at,rejected_reason=null,performance_amount=t.award_amount,updated_at=v_at
   where t.deal_id=v_deal returning * into cur;
 else
  v_reason:=nullif(btrim(coalesce(p->>'reason','')),'');
  if v_reason is null or length(v_reason)>300 then raise exception '제외 사유를 적어 주세요' using errcode='22023'; end if;
  update public.crm_deal_transfers t set incentive_eligible=false,approval_checks=null,approved_by=a.user_id,approved_by_name=v_name,approved_at=v_at,rejected_reason=v_reason,updated_at=v_at
   where t.deal_id=v_deal returning * into cur;
 end if;
 insert into public.crm_deal_transfer_events(deal_id,action,before,after,actor,actor_name,at) values(v_deal,v_dec,to_jsonb(old),to_jsonb(cur),a.user_id,v_name,v_at);
 return jsonb_build_object('ok',true,'deal_id',v_deal,'transfer',to_jsonb(cur));
end $fn$;
revoke all on function public.crm_deal_transfer_approve_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_transfer_approve_v1(jsonb) to authenticated;
