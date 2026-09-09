-- Review candidate only. This file has NOT been applied to Production.
-- Purpose: let the assigned rep/admin correct attribution on an advisory Deal
-- without changing current_business, brand, service_type, stage or amount.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='60s';

do $$ begin
  if current_user<>'postgres'
    or current_setting('crm.origin_business_ref',true) is distinct from 'ymfbmpnizxvqsamnczow'
    or to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') is null
    or to_regprocedure('crm_security.crm_write_command_v2_pre_origin_business_20260909(uuid,text,uuid,integer,jsonb)') is not null
  then raise exception 'Production origin-business correction approval required'; end if;
end $$;

alter table crm_security.command_receipts drop constraint command_receipts_operation_check;
alter table crm_security.command_receipts add constraint command_receipts_operation_check check(operation=any(array[
  'opportunity_work_set','inquiry_assign','service_change','origin_business_correct','inquiry_unassign',
  'favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete',
  'stage_check','transition','close','amount','waiting_context','inquiry_reclassify','inquiry_status',
  'inquiry_trash','inquiry_restore','inquiry_purge','inquiry_followup','opportunity_create','lineage_link',
  'attachment_prepare','attachment_complete','expansion_pool_update','expansion_note','customer_support_action',
  'message_log','relationship_hold','relationship_response','inquiry_consultant','assign','contact_upsert',
  'contact_relationship','contact_move','rep_manager_comment','expansion_quote_convert','campaign_create'
]::text[]));

create function crm_security.crm_origin_business_correct_command_v1(
  p_request_id uuid,
  p_object_id uuid,
  p_expected_version integer,
  p_payload jsonb
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $fn$
declare
  a record;
  prior crm_security.command_receipts%rowtype;
  oldrow public.deals%rowtype;
  newrow public.deals%rowtype;
  canonical jsonb;
  history_entry jsonb;
  ack jsonb;
  audit_id uuid;
  activity_id_value uuid;
  history_id_value bigint;
  server_at timestamptz:=clock_timestamp();
  from_origin_value text;
  to_origin_value text;
  reason_value text;
  reason_source_value text;
  current_business_value text;
  actor_email_value text;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  select * into a from crm_security.actor();
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  if p_request_id is null or p_object_id is null or p_expected_version is null or p_expected_version<0
    or jsonb_typeof(p_payload) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('to_origin','reason','reason_source'))
    or not p_payload ?& array['to_origin','reason']
    or jsonb_typeof(p_payload->'to_origin') is distinct from 'string'
    or btrim(p_payload->>'to_origin') not in ('POUR솔루션','POUR공법','아파트스퀘어','석민이앤씨','기술자문')
    or jsonb_typeof(p_payload->'reason') is distinct from 'string'
    or length(btrim(p_payload->>'reason'))<5 or length(p_payload->>'reason')>2000
    or (p_payload ? 'reason_source' and jsonb_typeof(p_payload->'reason_source') not in ('string','null'))
    or (p_payload ? 'reason_source' and coalesce(p_payload->>'reason_source','text') not in ('text','voice'))
  then raise exception 'invalid origin business payload' using errcode='22023'; end if;

  to_origin_value:=btrim(p_payload->>'to_origin');
  reason_value:=btrim(p_payload->>'reason');
  reason_source_value:=coalesce(nullif(btrim(p_payload->>'reason_source'),''),'text');
  canonical:=jsonb_build_object('to_origin',to_origin_value,'reason',reason_value,'reason_source',reason_source_value);

  perform 1 from public.users u where u.auth_uid=auth.uid() for share;
  perform 1 from crm_security.access_review r where r.reviewed_auth_uid=auth.uid() for share;
  perform 1 from crm_security.object_scope s where s.user_id=a.user_id and s.deal_id=p_object_id for share;
  select * into oldrow from public.deals d where d.id=p_object_id for update;
  if not found or a.permission_role not in ('rep','branch','admin') or not crm_security.can_deal(p_object_id,true)
  then raise exception 'forbidden' using errcode='42501'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
  select * into prior from crm_security.command_receipts r
    where r.actor_auth_uid=a.auth_uid and r.request_id=p_request_id;
  if found then
    if prior.actor_user_id is distinct from a.user_id or prior.operation is distinct from 'origin_business_correct'
      or prior.object_id is distinct from p_object_id or prior.expected_version is distinct from p_expected_version
      or prior.payload is distinct from canonical
    then raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
    return prior.ack||jsonb_build_object('replayed',true);
  end if;

  if oldrow.version is distinct from p_expected_version then raise exception 'version conflict' using errcode='PT409'; end if;
  current_business_value:=coalesce(oldrow.current_business,oldrow.brand);
  if current_business_value is distinct from '기술자문'
  then raise exception 'origin correction is advisory-only' using errcode='22023'; end if;
  from_origin_value:=coalesce(oldrow.origin_business,oldrow.brand,'기술자문');
  if from_origin_value=to_origin_value
  then raise exception 'origin business unchanged' using errcode='22023'; end if;

  history_entry:=jsonb_build_object(
    'kind','origin_correction','at',server_at,'from',from_origin_value,'to',to_origin_value,
    'reason',reason_value,'source',reason_source_value,'actor',a.display_name
  );
  update public.deals d set
    origin_business=to_origin_value,
    business_history=coalesce(oldrow.business_history,'[]'::jsonb)||history_entry,
    updated_at=server_at,
    version=oldrow.version+1
  where d.id=p_object_id and d.version=p_expected_version
  returning * into newrow;
  if not found then raise exception 'unexpected version mutation' using errcode='PT409'; end if;

  insert into public.business_history(
    deal_id,from_business,to_business,reason,reason_source,actor_name,changed_at
  ) values(
    p_object_id,from_origin_value,to_origin_value,reason_value,
    'origin_correction:'||reason_source_value,a.display_name,server_at
  ) returning id into history_id_value;

  select u.email into actor_email_value from public.users u where u.user_id=a.user_id for share;
  insert into public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
  values(
    p_object_id,oldrow.organization_id,actor_email_value,a.display_name,'원천영업브랜드수정',
    jsonb_build_object('note',from_origin_value||' → '||to_origin_value,'result',reason_value,
      'meaningful_contact',false,'current_business','기술자문'),server_at
  ) returning id into activity_id_value;

  insert into crm_security.audit_events(
    actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at
  ) values(
    a.auth_uid,a.user_id,a.display_name,p_object_id,'origin_business_correct',
    jsonb_build_object('origin_business',oldrow.origin_business,'current_business',oldrow.current_business,
      'brand',oldrow.brand,'service_type',oldrow.service_type,'stage_code',oldrow.stage_code,
      'version',oldrow.version),
    jsonb_build_object('origin_business',newrow.origin_business,'current_business',newrow.current_business,
      'brand',newrow.brand,'service_type',newrow.service_type,'stage_code',newrow.stage_code,
      'version',newrow.version,'business_history_id',history_id_value,'activity_id',activity_id_value),
    reason_value,server_at
  ) returning event_id into audit_id;

  ack:=jsonb_build_object(
    'contract_version',1,'ok',true,'operation','origin_business_correct','request_id',p_request_id,
    'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'actor_name',a.display_name,
    'object_id',p_object_id,'previous_version',p_expected_version,'version',newrow.version,
    'from_origin',from_origin_value,'to_origin',to_origin_value,'current_business','기술자문',
    'business_history_id',history_id_value,'activity_id',activity_id_value,'audit_event_id',audit_id,
    'server_at',server_at,'replayed',false
  );
  insert into crm_security.command_receipts(
    actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at
  ) values(
    a.auth_uid,p_request_id,a.user_id,'origin_business_correct',p_object_id,p_expected_version,canonical,ack,server_at
  );
  return ack;
end $fn$;

revoke all on function crm_security.crm_origin_business_correct_command_v1(uuid,uuid,integer,jsonb)
  from public,anon,authenticated,service_role;

alter function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) set schema crm_security;
alter function crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
  rename to crm_write_command_v2_pre_origin_business_20260909;
revoke all on function crm_security.crm_write_command_v2_pre_origin_business_20260909(uuid,text,uuid,integer,jsonb)
  from public,anon,authenticated,service_role;

create function public.crm_write_command_v2(
  p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) returns jsonb language plpgsql volatile security definer set search_path=''
as $fn$
begin
  if p_operation='origin_business_correct' then
    return crm_security.crm_origin_business_correct_command_v1(
      p_request_id,p_object_id,p_expected_version,p_payload
    );
  end if;
  return crm_security.crm_write_command_v2_pre_origin_business_20260909(
    p_request_id,p_operation,p_object_id,p_expected_version,p_payload
  );
end $fn$;

revoke all on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;

commit;
