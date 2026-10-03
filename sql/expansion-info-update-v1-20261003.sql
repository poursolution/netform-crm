-- 확장관리 상세 '관리 정보' 빈 칸 바로 입력 v1 (2026-10-03 대표 "이것두 견적문의처럼 입력-저장할 수 있게")
-- 확장관리 기록(crm_expansion_pool)의 준공일 · 현재 담당을 상세 창 그 자리에서 채운다. 관리자 또는 원 수주 건의 담당 범위(can_deal) 안에서만, 현재 담당 변경은 관리자만.
-- 계약일 · 수주 금액은 계약실적 원장(contract sales policy 2026-09-20)이 주인이라 여기서 바꾸지 않는다. 공종은 기존 공종 편집기(영업건) 경로를 쓴다.
-- 활동(업무) · 감사(audit_events) 기록. 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run. 화면은 CRMRelease 게이트로 함수가 있을 때만 입력 칸을 연다.
create or replace function public.crm_expansion_info_update_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a record; v_oid uuid; v_field text; v_value text; v_at timestamptz:=clock_timestamp(); v_old jsonb; v_new jsonb; v_rid uuid; v_audit uuid; d record;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role not in ('rep','branch','admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin v_oid:=(p->>'source_opportunity_id')::uuid; exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_field:=nullif(btrim(coalesce(p->>'field','')),''); v_value:=nullif(btrim(coalesce(p->>'value','')),'');
 if v_oid is null or v_field is null or v_value is null or length(v_value)>80 or v_field not in ('completion_date','owner_name') then raise exception 'invalid payload' using errcode='22023'; end if;
 if v_field='completion_date' and v_value !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '날짜는 YYYY-MM-DD 형식이어야 합니다' using errcode='22023'; end if;
 if v_field='owner_name' and a.permission_role<>'admin' then raise exception '현재 담당은 관리자만 바꿀 수 있습니다' using errcode='42501'; end if;
 if v_field='owner_name' and not exists(select 1 from public.users u where u.name=v_value and u.active) then raise exception '등록된 사용자 이름이어야 합니다' using errcode='22023'; end if;
 select * into d from public.deals x where x.id=v_oid for update;
 if not found then raise exception '원 수주 건을 찾을 수 없습니다' using errcode='22023'; end if;
 if not crm_security.can_deal(v_oid,true) then raise exception 'forbidden' using errcode='42501'; end if;
 select to_jsonb(e) into v_old from public.crm_expansion_pool e where e.source_opportunity_id=v_oid;
 if v_old is null then
  insert into public.crm_expansion_pool(source_opportunity_id,site_id,site_name,completion_date,owner_name,expansion_status)
   values(v_oid,d.site_id,coalesce(d.site,'현장명 미입력'),case when v_field='completion_date' then v_value::date else null end,case when v_field='owner_name' then v_value else null end,'신규 대상')
   returning id into v_rid;
 else
  update public.crm_expansion_pool e set
   completion_date=case when v_field='completion_date' then v_value::date else e.completion_date end,
   owner_name=case when v_field='owner_name' then v_value else e.owner_name end,
   updated_at=v_at where e.source_opportunity_id=v_oid returning e.id into v_rid;
 end if;
 select to_jsonb(e) into v_new from public.crm_expansion_pool e where e.id=v_rid;
 insert into public.activities(deal_id,organization_id,actor_name,type,detail,occurred_at)
  values(v_oid,d.organization_id,a.display_name,'업무',jsonb_build_object('note','확장관리 정보 입력','result',case v_field when 'completion_date' then '준공일 '||v_value else '현재 담당 '||v_value end,'meaningful_contact',false),v_at);
 insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,a.display_name,v_oid,'expansion_info_update',coalesce(v_old,'{}'::jsonb),v_new||jsonb_build_object('field',v_field),'확장관리 상세 빈 칸 입력: '||v_field,v_at) returning event_id into v_audit;
 return jsonb_build_object('ok',true,'source_opportunity_id',v_oid,'expansion_record_id',v_rid,'field',v_field,'value',v_value,'audit_event_id',v_audit);
end $fn$;
revoke all on function public.crm_expansion_info_update_v1(jsonb) from public, anon;
grant execute on function public.crm_expansion_info_update_v1(jsonb) to authenticated;
