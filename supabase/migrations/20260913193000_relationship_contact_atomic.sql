-- Atomically records one relationship-management contact and its next action.
-- Environment-bound to the Production dispatcher inspected on 2026-09-13.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';
set local search_path = pg_catalog;

do $guard$
declare p record;
begin
  select * into p from pg_proc
  where oid=to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)');
  if current_user <> 'postgres'
     or p.oid is null or not p.prosecdef or pg_get_userbyid(p.proowner) <> 'postgres'
     or p.proconfig is distinct from array['search_path=""']
     or p.proacl::text is distinct from '{postgres=X/postgres,authenticated=X/postgres}'
     or md5(pg_get_functiondef(p.oid)) <> 'c62e27739b30fa49953726bc638880f5'
     or to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') is null
     or md5(pg_get_functiondef(to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)'))) <> 'd076eedff22e663f9ce224079d282cc9'
     or to_regprocedure('crm_security.crm_write_command_v2_pre_relationship_contact_20260913(uuid,text,uuid,integer,jsonb)') is not null
  then raise exception 'relationship contact production baseline drift; no change applied'; end if;
end $guard$;

create function crm_security.crm_relationship_contact_command_v1(
  p_request_id uuid, p_object_id uuid, p_expected_version integer, p_payload jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
  a record; d public.deals%rowtype; activity_request uuid; next_request uuid;
  activity_ack jsonb; next_ack jsonb; prior_count integer;
  due_value date; occurred_value timestamptz;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform 1 from public.users where auth_uid=auth.uid() and active is true for share;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  perform 1 from crm_security.access_review
   where reviewed_auth_uid=auth.uid() and expires_at > clock_timestamp() for share;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select * into a from crm_security.actor();
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if p_request_id is null or p_object_id is null or p_expected_version is null
     or p_expected_version < 0 or p_expected_version > 2147483645
     or jsonb_typeof(p_payload) is distinct from 'object'
     or not p_payload ?& array['activity','next_action']
     or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('activity','next_action'))
     or jsonb_typeof(p_payload->'activity') is distinct from 'object'
     or jsonb_typeof(p_payload->'next_action') is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(p_payload->'activity') k where k not in ('type','note','result','occurred_at','meaningful_contact'))
     or exists(select 1 from jsonb_object_keys(p_payload->'next_action') k where k not in ('type','text','due_at'))
     or jsonb_typeof(p_payload->'activity'->'meaningful_contact') is distinct from 'boolean'
     or (p_payload->'next_action') ? 'assignee'
  then raise exception 'invalid relationship contact envelope' using errcode='22023'; end if;
  begin
    occurred_value := (p_payload->'activity'->>'occurred_at')::timestamptz;
    due_value := (p_payload->'next_action'->>'due_at')::date;
  exception when datetime_field_overflow or invalid_datetime_format then
    raise exception 'invalid contact date' using errcode='22023';
  end;
  if occurred_value is null or not isfinite(occurred_value) or due_value is null
     or not isfinite(due_value)
     or due_value < (occurred_value at time zone 'Asia/Seoul')::date
  then raise exception 'next contact precedes contact record' using errcode='22023'; end if;
  perform 1 from crm_security.object_scope where user_id=a.user_id and deal_id=p_object_id for share;
  select * into d from public.deals where id=p_object_id for update;
  if not found or not crm_security.can_deal(p_object_id,true)
  then raise exception 'forbidden' using errcode='42501'; end if;
  activity_request := md5('relationship-contact:activity:'||p_request_id::text)::uuid;
  next_request := md5('relationship-contact:next:'||p_request_id::text)::uuid;
  perform pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
  select count(*) into prior_count from crm_security.command_receipts
   where actor_auth_uid=a.auth_uid and request_id in (activity_request,next_request);
  if prior_count=1 then raise exception 'incomplete contact receipt pair' using errcode='PT409'; end if;
  if prior_count=0 then
    if d.version is distinct from p_expected_version then raise exception 'version conflict' using errcode='PT409'; end if;
    if d.stage_code not in ('rapport','silent','waiting') or d.stage_code is null
       or d.outcome is not null or d.lifecycle_status='closed'
    then raise exception 'not an open relationship deal' using errcode='22023'; end if;
    perform 1 from public.next_actions where deal_id=p_object_id and status='open' for update;
    if (select count(*) from public.next_actions where deal_id=p_object_id and status='open') > 1
    then raise exception 'multiple open actions require explicit resolution' using errcode='PT409'; end if;
  end if;
  activity_ack := crm_security.crm_pipeline_action_command_v1(activity_request,'activity',p_object_id,p_expected_version,p_payload->'activity');
  next_ack := crm_security.crm_pipeline_action_command_v1(next_request,'next_action',p_object_id,p_expected_version+1,p_payload->'next_action');
  if (activity_ack->>'replayed')::boolean is distinct from (next_ack->>'replayed')::boolean
  then raise exception 'inconsistent contact receipts' using errcode='PT409'; end if;
  if not (next_ack->>'replayed')::boolean then
    update public.next_actions set source_activity_id=(activity_ack->>'activity_id')::uuid
     where id=(next_ack->>'next_action_id')::uuid and deal_id=p_object_id;
  end if;
  return jsonb_build_object('ok',true,'operation','relationship_contact','contract_version',1,
    'request_id',p_request_id,'object_id',p_object_id,'previous_version',p_expected_version,
    'version',(next_ack->>'version')::integer,'replayed',(next_ack->>'replayed')::boolean,
    'activity_id',activity_ack->'activity_id','next_action_id',next_ack->'next_action_id',
    'activity_request_id',activity_request,'next_request_id',next_request,
    'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id);
end $fn$;
revoke all on function crm_security.crm_relationship_contact_command_v1(uuid,uuid,integer,jsonb)
 from public,anon,authenticated,service_role;

alter function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 rename to crm_write_command_v2_pre_relationship_contact_20260913;
alter function public.crm_write_command_v2_pre_relationship_contact_20260913(uuid,text,uuid,integer,jsonb)
 set schema crm_security;
revoke all on function crm_security.crm_write_command_v2_pre_relationship_contact_20260913(uuid,text,uuid,integer,jsonb)
 from public,anon,authenticated,service_role;
create function public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
begin
 if p_operation='relationship_contact' then
  return crm_security.crm_relationship_contact_command_v1(p_request_id,p_object_id,p_expected_version,p_payload);
 end if;
 return crm_security.crm_write_command_v2_pre_relationship_contact_20260913(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
end $fn$;
revoke all on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;

do $postcheck$
begin
 if has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','execute')
    or has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','execute')
    or not has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','execute')
 then raise exception 'relationship contact privilege regression'; end if;
end $postcheck$;
commit;
