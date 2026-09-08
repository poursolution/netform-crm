begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
set local search_path=pg_catalog;

do $guard$
begin
  if current_user<>'postgres'
     or to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') is null
     or to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') is null
     or to_regprocedure('crm_security.actor()') is null
     or to_regprocedure('crm_security.can_inquiry(uuid)') is null
     or to_regclass('crm_security.inquiry_audit_events') is null
     or to_regclass('crm_security.command_receipts') is null
  then raise exception 'inquiry store handoff precondition failed';
  end if;
end
$guard$;

alter table crm_security.inquiry_audit_events drop constraint inquiry_audit_events_action_check;
alter table crm_security.inquiry_audit_events add constraint inquiry_audit_events_action_check check(action=any(array[
  'direct_assign','direct_reassign','inquiry_unassign','inquiry_reclassify','inquiry_hold','inquiry_trash',
  'inquiry_restore','inquiry_purge','inquiry_followup','inquiry_response_progress','inquiry_response_next_week_retry',
  'inquiry_response_missed_retry','inquiry_pipeline_promote','inquiry_lineage_link','inquiry_stage_progress',
  'inquiry_next_set','inquiry_next_complete','inquiry_check','technical_inquiry_transfer','inquiry_consultant',
  'inquiry_branch_handoff','inquiry_branch_owner_assign','inquiry_branch_owner_pool','inquiry_store_handoff'
]::text[]));

create function crm_security.crm_inquiry_store_handoff_command_v1(
  p_request_id uuid,p_inquiry_id uuid,p_payload jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
  a record; receipt crm_security.command_receipts%rowtype; oldrow public.inquiries%rowtype; newrow public.inquiries%rowtype;
  canonical jsonb; ack jsonb; audit_id uuid; server_at timestamptz;
  reason_value text; material_note_value text; delivery_value text; desired_value date;
  direct_install_value boolean; construction_value boolean; route_value jsonb;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform 1 from public.users u where u.auth_uid=auth.uid() for share;
  perform 1 from crm_security.access_review r where r.reviewed_auth_uid=auth.uid() for share;
  select * into a from crm_security.actor();
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  if p_request_id is null or p_inquiry_id is null or jsonb_typeof(p_payload) is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(p_payload) k where k not in
       ('intent','reason','material_note','delivery_method','desired_date','direct_install','needs_construction_consultation'))
     or not p_payload ?& array['intent','reason','material_note','delivery_method','desired_date','direct_install','needs_construction_consultation']
     or p_payload->>'intent' is distinct from 'store_handoff'
     or jsonb_typeof(p_payload->'reason') is distinct from 'string'
     or jsonb_typeof(p_payload->'material_note') is distinct from 'string'
     or jsonb_typeof(p_payload->'delivery_method') is distinct from 'string'
     or jsonb_typeof(p_payload->'direct_install') is distinct from 'boolean'
     or jsonb_typeof(p_payload->'needs_construction_consultation') is distinct from 'boolean'
  then raise exception 'invalid store handoff payload' using errcode='22023'; end if;

  reason_value:=btrim(p_payload->>'reason');
  material_note_value:=btrim(p_payload->>'material_note');
  delivery_value:=p_payload->>'delivery_method';
  direct_install_value:=(p_payload->>'direct_install')::boolean;
  construction_value:=(p_payload->>'needs_construction_consultation')::boolean;
  if reason_value not in ('자재만 구매','소규모 현장','고객 직접 시공')
     or length(material_note_value) not between 1 and 4000
     or delivery_value not in ('배송','방문수령','미정')
     or length(coalesce(p_payload->>'desired_date',''))>10
  then raise exception 'invalid store handoff values' using errcode='22023'; end if;
  if nullif(p_payload->>'desired_date','') is not null then
    begin desired_value:=(p_payload->>'desired_date')::date;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'invalid store desired date' using errcode='22023';
    end;
  end if;
  canonical:=jsonb_build_object(
    'intent','store_handoff','reason',reason_value,'material_note',material_note_value,
    'delivery_method',delivery_value,'desired_date',case when desired_value is null then '' else to_char(desired_value,'YYYY-MM-DD') end,
    'direct_install',direct_install_value,'needs_construction_consultation',construction_value
  );

  perform 1 from crm_security.object_scope s where s.user_id=a.user_id and s.inquiry_id=p_inquiry_id for share;
  select * into oldrow from public.inquiries i where i.id=p_inquiry_id for update;
  if not found or not crm_security.can_inquiry(p_inquiry_id)
     or a.permission_role not in ('admin','rep','consultation')
     or (a.permission_role<>'admin' and oldrow.assigned_to is distinct from a.user_id)
  then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
  select * into receipt from crm_security.command_receipts r where r.actor_auth_uid=a.auth_uid and r.request_id=p_request_id;
  if found then
    if receipt.actor_user_id is distinct from a.user_id or receipt.operation is distinct from 'inquiry_status'
       or receipt.object_id is distinct from p_inquiry_id or receipt.expected_version is distinct from 0
       or receipt.payload is distinct from canonical
    then raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
    return receipt.ack||jsonb_build_object('replayed',true);
  end if;
  if oldrow.deal_id is not null or oldrow.opportunity_id is not null
     or exists(select 1 from public.deals d where d.origin_inquiry_id=p_inquiry_id)
     or coalesce(oldrow.status,'') in ('수주','실주','배드핏','연락두절','종결','종료','POUR스토어 이관대기','POUR스토어 접수완료','자재 견적안내','자재 구매완료','미구매 종료')
  then raise exception 'inquiry cannot be routed to store' using errcode='PT409'; end if;

  server_at:=clock_timestamp();
  route_value:=jsonb_build_object(
    'queue','pour_store','reason',reason_value,'material_note',material_note_value,
    'delivery_method',delivery_value,'desired_date',case when desired_value is null then null else to_char(desired_value,'YYYY-MM-DD') end,
    'direct_install',direct_install_value,'needs_construction_consultation',construction_value,
    'routed_at',server_at,'routed_by',a.display_name,'previous_assigned_to',oldrow.assigned_to,'previous_assignee_name',oldrow.assignee_name
  );
  update public.inquiries set
    status='POUR스토어 이관대기',close_reason='POUR스토어 이관',next_action_date=null,
    raw=coalesce(raw,'{}'::jsonb)||jsonb_build_object('store_handoff',route_value),updated_at=server_at
  where id=p_inquiry_id returning * into newrow;
  insert into crm_security.inquiry_audit_events(
    actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at
  ) values(
    a.auth_uid,a.user_id,p_inquiry_id,'inquiry_store_handoff',
    jsonb_build_object('status',oldrow.status,'assigned_to',oldrow.assigned_to,'assignee_name',oldrow.assignee_name,'next_action_date',oldrow.next_action_date),
    jsonb_build_object('status',newrow.status,'store_handoff',route_value),reason_value,server_at
  ) returning event_id into audit_id;
  ack:=jsonb_build_object(
    'contract_version',1,'ok',true,'request_id',p_request_id,'operation','inquiry_status','object_id',p_inquiry_id,
    'intent','store_handoff','actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
    'from_status',coalesce(oldrow.status,''),'to_status','POUR스토어 이관대기','queue_code','pour_store',
    'reason',reason_value,'material_note',material_note_value,'delivery_method',delivery_value,
    'desired_date',case when desired_value is null then '' else to_char(desired_value,'YYYY-MM-DD') end,
    'direct_install',direct_install_value,'needs_construction_consultation',construction_value,
    'routed_at',server_at,'routed_by',a.display_name,'inquiry_audit_event_id',audit_id,'replayed',false
  );
  insert into crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack)
  values(a.auth_uid,p_request_id,a.user_id,'inquiry_status',p_inquiry_id,0,canonical,ack);
  return ack;
end
$fn$;
revoke execute on function crm_security.crm_inquiry_store_handoff_command_v1(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

alter function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) rename to crm_write_command_v2_pre_store_handoff_20260908;
alter function public.crm_write_command_v2_pre_store_handoff_20260908(uuid,text,uuid,integer,jsonb) set schema crm_security;
revoke execute on function crm_security.crm_write_command_v2_pre_store_handoff_20260908(uuid,text,uuid,integer,jsonb) from public,anon,authenticated,service_role;
create function public.crm_write_command_v2(
  p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
begin
  if p_operation='inquiry_status' and p_payload->>'intent'='store_handoff' then
    if p_expected_version is distinct from 0 then raise exception 'invalid inquiry status version sentinel' using errcode='22023'; end if;
    return crm_security.crm_inquiry_store_handoff_command_v1(p_request_id,p_object_id,p_payload);
  end if;
  return crm_security.crm_write_command_v2_pre_store_handoff_20260908(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
end
$fn$;
revoke execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;

alter function public.crm_operational_source_v1(text,uuid,integer) rename to crm_operational_source_v1_pre_store_handoff_20260908;
alter function public.crm_operational_source_v1_pre_store_handoff_20260908(text,uuid,integer) set schema crm_security;
revoke execute on function crm_security.crm_operational_source_v1_pre_store_handoff_20260908(text,uuid,integer) from public,anon,authenticated,service_role;
create function public.crm_operational_source_v1(p_domain text,p_after uuid default null,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare base jsonb; projected jsonb;
begin
  base:=crm_security.crm_operational_source_v1_pre_store_handoff_20260908(p_domain,p_after,p_limit);
  if p_domain<>'inquiry_core' then return base; end if;
  select coalesce(jsonb_agg(
    item||jsonb_build_object(
      'store_handoff',coalesce(i.raw->'store_handoff','null'::jsonb),
      'activities',coalesce(item->'activities','[]'::jsonb)||coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',e.event_id,'type','POUR스토어 이관','note',e.after_data->'store_handoff'->>'reason',
          'result',e.after_data->'store_handoff'->>'material_note','actor',e.after_data->'store_handoff'->>'routed_by','at',e.created_at
        ) order by e.created_at,e.event_id)
        from crm_security.inquiry_audit_events e
        where e.inquiry_id=i.id and e.action='inquiry_store_handoff'
      ),'[]'::jsonb)
    ) order by item->>'id'
  ),'[]'::jsonb) into projected
  from jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item
  join public.inquiries i on i.id=(item->>'id')::uuid;
  return jsonb_set(base,'{items}',projected,true);
end
$fn$;
revoke execute on function public.crm_operational_source_v1(text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.crm_operational_source_v1(text,uuid,integer) to authenticated;

commit;
