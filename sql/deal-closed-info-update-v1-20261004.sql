-- 종료된 영업건(수주 · 실주 · 배드핏 · 연락두절) 참고 정보 제자리 입력 v1
-- (2026-10-04 대표 "실주에서 이거 입력 왜 뺐어 · 파이프라인 보고 일괄 적용해 · 수주도 마찬가지야")
-- 진행 중인 건은 crm_deal_stage_fields_update_v1(단계 항목) · 예상 금액 명령이 저장하는데, 둘 다 종료 건은 거절한다.
-- 그래서 종료 뒤에는 상세의 '현장 정보'가 읽기 전용이었다. 이 함수는 종료 건에서만 동작하고 아래만 고친다.
--   · stage_contexts[종료 단계].fields 중 허용 항목(글 · 선택 값):
--       customer_reaction · decision_maker · competitor · construction_plan      (현장 정보)
--       close_reason · close_detail · lesson · recontact_possibility · win_reason (이 단계 필수 정보)
--   · 예상 금액(deals.amount)
-- 건드리지 않는 것: 단계 · 종료 상태 · 종료일 · 수주금액(won_amount) · 준공일 · 담당 · 계약 단계 항목(stage_contexts.contract) · 계약 원장(contract_sales).
--   계약 체결 기록 트리거(capture_contract_signing)는 stage_contexts.contract.fields 가 바뀔 때만 움직이므로 이 함수로는 움직이지 않는다.
-- 권한: 역할(rep/branch/admin) + 담당 범위(crm_security.can_deal 쓰기). 활동(단계정보) · 감사(audit_events, 이전 값 보존) 기록.

create or replace function public.crm_deal_closed_info_update_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; oldrow public.deals%rowtype; newrow public.deals%rowtype;
 v_id uuid; v_stage text; v_fields jsonb; v_prev jsonb; v_ctx jsonb; v_at timestamptz:=clock_timestamp();
 v_amount bigint; v_has_amount boolean:=false; v_has_fields boolean:=false;
 v_audit uuid; v_act uuid; v_email text; v_summary text; r record;
 v_allowed constant text[]:=array['customer_reaction','decision_maker','competitor','construction_plan','close_reason','close_detail','lesson','recontact_possibility','win_reason'];
 v_closed constant text[]:=array['won','lost','badfit_lead','badfit_pipe','nocontact'];
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('rep','branch','admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'deal_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_stage:=nullif(btrim(coalesce(p->>'stage_code','')),'');
 if v_id is null or v_stage is null or not (v_stage = any(v_closed)) then raise exception 'invalid payload' using errcode='22023'; end if;
 v_fields:=coalesce(p->'fields','{}'::jsonb);
 if jsonb_typeof(v_fields) is distinct from 'object' or length(v_fields::text)>6000 then raise exception 'invalid payload' using errcode='22023'; end if;
 for r in select key,value from jsonb_each(v_fields) loop
  if not (r.key = any(v_allowed)) then raise exception '종료된 영업건에서는 바꿀 수 없는 항목입니다(%)',r.key using errcode='22023'; end if;
  if jsonb_typeof(r.value) not in ('string','null') then raise exception 'invalid field value' using errcode='22023'; end if;
  if jsonb_typeof(r.value)='string' and length(r.value#>>'{}')>500 then raise exception '내용이 너무 깁니다(500자 이내)' using errcode='22023'; end if;
  v_has_fields:=true;
 end loop;
 if p ? 'amount' and jsonb_typeof(p->'amount') is distinct from 'null' then
  if jsonb_typeof(p->'amount') not in ('number','string') then raise exception '예상 금액은 0 이상의 정수로 적어 주세요' using errcode='22023'; end if;
  begin v_amount:=(p->>'amount')::bigint; exception when others then raise exception '예상 금액은 0 이상의 정수로 적어 주세요' using errcode='22023'; end;
  if v_amount<0 then raise exception '예상 금액은 0 이상의 정수로 적어 주세요' using errcode='22023'; end if;
  v_has_amount:=true;
 end if;
 if not v_has_fields and not v_has_amount then raise exception 'invalid payload' using errcode='22023'; end if;
 select * into oldrow from public.deals d where d.id=v_id for update;
 if not found then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 if not crm_security.can_deal(v_id,true) then raise exception 'forbidden' using errcode='42501'; end if;
 if oldrow.outcome is null and oldrow.lifecycle_status is distinct from 'closed' then raise exception '진행 중인 영업건입니다. 상세를 다시 열어 주세요' using errcode='PT409'; end if;
 if oldrow.stage_code is distinct from v_stage then raise exception '단계가 바뀌었습니다. 상세를 다시 열어 주세요' using errcode='PT409'; end if;
 v_prev:=coalesce(oldrow.stage_contexts->v_stage,'{}'::jsonb);
 if jsonb_typeof(v_prev) is distinct from 'object' then v_prev:='{}'::jsonb; end if;
 v_ctx:=v_prev;
 if v_has_fields then
  v_ctx:=v_prev||jsonb_build_object(
   'to',coalesce(v_prev->>'to',v_stage),
   'fields',jsonb_strip_nulls(coalesce(case when jsonb_typeof(v_prev->'fields')='object' then v_prev->'fields' end,'{}'::jsonb)||v_fields),
   'edited_at',v_at,'edited_by',a.display_name);
 end if;
 if v_has_fields then
  update public.deals d set stage_contexts=jsonb_set(coalesce(d.stage_contexts,'{}'::jsonb),array[v_stage],v_ctx,true),
    amount=case when v_has_amount then v_amount else d.amount end,
    updated_at=v_at, version=coalesce(d.version,0)+1
   where d.id=v_id returning * into newrow;
 else
  update public.deals d set amount=v_amount, updated_at=v_at, version=coalesce(d.version,0)+1
   where d.id=v_id returning * into newrow;
 end if;
 select string_agg(key||': '||coalesce(value#>>'{}',''),' · ' order by key)
  into v_summary from jsonb_each(v_fields) where jsonb_typeof(value)<>'null';
 if v_has_amount then v_summary:=concat_ws(' · ',nullif(v_summary,''),'예상 금액: '||v_amount::text); end if;
 select u.email into v_email from public.users u where u.user_id=a.user_id;
 insert into public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
  values(v_id,oldrow.organization_id,v_email,a.display_name,'단계정보',
   jsonb_build_object('note','종료 건 정보 입력 · '||v_stage,'result',coalesce(v_summary,''),'meaningful_contact',false),v_at)
  returning id into v_act;
 insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,a.display_name,v_id,'closed_info_update',
   jsonb_build_object('version',oldrow.version,'stage_code',oldrow.stage_code,'outcome',oldrow.outcome,'context',v_prev,'amount',oldrow.amount),
   jsonb_build_object('version',newrow.version,'stage_code',newrow.stage_code,'outcome',newrow.outcome,'context',v_ctx,'amount',newrow.amount,'activity_id',v_act),
   coalesce(nullif(btrim(coalesce(p->>'reason','')),''),'종료 건 정보 입력'),v_at)
  returning event_id into v_audit;
 return jsonb_build_object('ok',true,'deal_id',v_id,'stage_code',v_stage,'version',newrow.version,'stage_context',v_ctx,'amount',newrow.amount,
  'activity_id',v_act,'audit_event_id',v_audit,'server_at',v_at);
end $fn$;
revoke all on function public.crm_deal_closed_info_update_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_closed_info_update_v1(jsonb) to authenticated;
