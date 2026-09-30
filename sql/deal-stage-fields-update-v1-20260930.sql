-- 이 단계에서 챙길 정보 제자리 입력 v1 (2026-09-30 대표 "이게 맞니?" → "진행해")
-- 단계 정보(deals.stage_contexts[현재 단계].fields)는 지금까지 진행상태를 바꿀 때만 저장됐다. 같은 단계에 머문 채로
-- 값만 채우거나 고치는 길이 없어 '입력하기'가 연락 결과 창을 여는 임시 방편이었다. 이 함수는 현재 단계의 항목만 갱신한다.
-- 단계·종료 상태·금액·다음 할 일은 건드리지 않는다(그건 진행상태 변경 명령의 몫).
-- 담당 범위(crm_security.can_deal)·역할(rep/branch/admin) 확인, 활동(단계정보)·감사(audit_events) 기록, 이전 값은 감사 before_data에 보존.

create or replace function public.crm_deal_stage_fields_update_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; oldrow public.deals%rowtype; newrow public.deals%rowtype;
 v_id uuid; v_stage text; v_fields jsonb; v_prev jsonb; v_ctx jsonb; v_at timestamptz:=clock_timestamp();
 v_audit uuid; v_act uuid; v_email text; v_summary text; r record;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('rep','branch','admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_id:=(p->>'deal_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_stage:=nullif(btrim(coalesce(p->>'stage_code','')),'');
 v_fields:=p->'fields';
 if v_id is null or v_stage is null or v_stage !~ '^[a-z_]{1,40}$' or jsonb_typeof(v_fields) is distinct from 'object' then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 if (select count(*) from jsonb_object_keys(v_fields))>40 or length(v_fields::text)>8000 then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 for r in select key,value from jsonb_each(v_fields) loop
  if r.key !~ '^[a-z_]{1,40}$' then raise exception 'invalid field key' using errcode='22023'; end if;
  if jsonb_typeof(r.value) not in ('string','number','null','array') then raise exception 'invalid field value' using errcode='22023'; end if;
  if jsonb_typeof(r.value)='array' and exists(select 1 from jsonb_array_elements(r.value) e where jsonb_typeof(e) is distinct from 'string') then
   raise exception 'invalid field value' using errcode='22023';
  end if;
 end loop;
 select * into oldrow from public.deals d where d.id=v_id for update;
 if not found then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 if not crm_security.can_deal(v_id,true) then raise exception 'forbidden' using errcode='42501'; end if;
 if oldrow.outcome is not null or oldrow.lifecycle_status='closed' then raise exception '종료된 영업건은 단계 정보를 바꿀 수 없습니다' using errcode='22023'; end if;
 if oldrow.stage_code is distinct from v_stage then raise exception '단계가 바뀌었습니다. 상세를 다시 열어 주세요' using errcode='PT409'; end if;
 v_prev:=coalesce(oldrow.stage_contexts->v_stage,'{}'::jsonb);
 if jsonb_typeof(v_prev) is distinct from 'object' then v_prev:='{}'::jsonb; end if;
 v_ctx:=v_prev||jsonb_build_object(
  'to',v_stage,
  'fields',jsonb_strip_nulls(coalesce(case when jsonb_typeof(v_prev->'fields')='object' then v_prev->'fields' end,'{}'::jsonb)||v_fields),
  'edited_at',v_at,'edited_by',a.display_name);
 update public.deals d set stage_contexts=jsonb_set(coalesce(d.stage_contexts,'{}'::jsonb),array[v_stage],v_ctx,true),
   updated_at=v_at, version=coalesce(d.version,0)+1
  where d.id=v_id returning * into newrow;
 select string_agg(key||': '||coalesce(case when jsonb_typeof(value)='string' then value#>>'{}' else value::text end,''),' · ' order by key)
  into v_summary from jsonb_each(v_fields) where jsonb_typeof(value)<>'null';
 select u.email into v_email from public.users u where u.user_id=a.user_id;
 insert into public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
  values(v_id,oldrow.organization_id,v_email,a.display_name,'단계정보',
   jsonb_build_object('note','단계 정보 입력 · '||v_stage,'result',coalesce(v_summary,''),'meaningful_contact',false),v_at)
  returning id into v_act;
 insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,a.display_name,v_id,'stage_fields_update',
   jsonb_build_object('version',oldrow.version,'stage_code',oldrow.stage_code,'context',v_prev),
   jsonb_build_object('version',newrow.version,'stage_code',newrow.stage_code,'context',v_ctx,'activity_id',v_act),
   nullif(btrim(coalesce(p->>'reason','')),''),v_at)
  returning event_id into v_audit;
 return jsonb_build_object('ok',true,'deal_id',v_id,'stage_code',v_stage,'version',newrow.version,'stage_context',v_ctx,
  'activity_id',v_act,'audit_event_id',v_audit,'server_at',v_at);
end $fn$;
revoke all on function public.crm_deal_stage_fields_update_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_stage_fields_update_v1(jsonb) to authenticated;
