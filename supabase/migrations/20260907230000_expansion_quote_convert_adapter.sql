begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';
set local search_path = pg_catalog;

do $guard$
begin
  if current_user <> 'postgres'
     or to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') is null
     or to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') is null
     or to_regprocedure('public.crm_expansion_context(jsonb)') is null
     or to_regprocedure('crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)') is null
     or to_regclass('crm_security.expansion_pool') is null
     or to_regclass('crm_security.message_outcomes') is null
     or to_regclass('crm_security.quote_versions') is null
  then raise exception 'expansion conversion precondition failed';
  end if;
end
$guard$;

alter table crm_security.expansion_pool
  add column created_opportunity_id uuid unique
  references public.deals(id) on delete restrict;

alter table crm_security.command_receipts
  drop constraint command_receipts_operation_check;
alter table crm_security.command_receipts
  add constraint command_receipts_operation_check check(operation=any(array[
   'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
   'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
   'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
   'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete',
   'expansion_pool_update','expansion_note','customer_support_action','message_log','relationship_hold','relationship_response',
   'inquiry_consultant','assign','contact_upsert','contact_relationship','contact_move','rep_manager_comment',
   'expansion_quote_convert'
  ]::text[]));

alter table crm_security.expansion_pool_events
  drop constraint expansion_pool_events_kind_check;
alter table crm_security.expansion_pool_events
  add constraint expansion_pool_events_kind_check check(kind=any(array[
    'status_change','next_contact_change','status_and_next_contact','note','pipeline_convert'
  ]::text[]));

create function crm_security.crm_expansion_quote_convert_command_v1(
  p_request_id uuid,
  p_object_id uuid,
  p_expected_version integer,
  p_payload jsonb
) returns jsonb
language plpgsql volatile security definer set search_path='' as $fn$
declare
  a record;
  prior crm_security.command_receipts%rowtype;
  pool crm_security.expansion_pool%rowtype;
  sent_message crm_security.message_outcomes%rowtype;
  quote_row crm_security.quote_versions%rowtype;
  source_row public.deals%rowtype;
  opportunity jsonb;
  create_payload jsonb;
  create_ack jsonb;
  ack jsonb;
  create_request_id uuid:=gen_random_uuid();
  quote_dispatch_id uuid;
  child_id uuid;
  stage_history_id uuid;
  transition_activity_id uuid;
  expansion_event_id uuid;
  audit_id uuid;
  before_status text;
  before_next_contact_at date;
  server_at timestamptz:=clock_timestamp();
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  select * into a from crm_security.actor();
  if not found or a.permission_role not in ('rep','branch','admin')
  then raise exception 'forbidden' using errcode='42501'; end if;
  if p_request_id is null or p_object_id is null or p_expected_version < 1
     or jsonb_typeof(p_payload) is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('source_opportunity_id','site_id','quote_dispatch_id','idempotency_key','opportunity'))
     or p_payload->>'source_opportunity_id' is distinct from p_object_id::text
     or p_payload->>'idempotency_key' is distinct from 'expansion:'||p_object_id::text
     or jsonb_typeof(p_payload->'opportunity') is distinct from 'object'
  then raise exception 'invalid expansion conversion contract' using errcode='22023'; end if;
  begin quote_dispatch_id:=(p_payload->>'quote_dispatch_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid quote dispatch identity' using errcode='22023';
  end;
  opportunity:=p_payload->'opportunity';
  if opportunity->>'source_opportunity_id' is distinct from p_object_id::text
     or opportunity->>'origin' is distinct from 'expansion'
     or opportunity->>'origin_source' is distinct from 'expansion'
     or opportunity->>'stage_code' is distinct from 'sent'
     or opportunity->>'code' is distinct from 'sent'
     or opportunity->>'stage' is distinct from '컨설팅 자료 발송완료'
     or coalesce((opportunity->>'amount')::numeric,0)<=0
  then raise exception 'invalid expansion opportunity' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(a.auth_uid::text||p_request_id::text,0));
  select * into prior from crm_security.command_receipts
   where actor_auth_uid=a.auth_uid and request_id=p_request_id;
  if found then
    if prior.actor_user_id is distinct from a.user_id
       or prior.operation is distinct from 'expansion_quote_convert'
       or prior.object_id is distinct from p_object_id
       or prior.expected_version is distinct from p_expected_version
       or prior.payload is distinct from p_payload
    then raise exception 'REQUEST_ID_REUSE' using errcode='PT409'; end if;
    return prior.ack||jsonb_build_object('replayed',true);
  end if;

  perform 1 from crm_security.object_scope s where s.user_id=a.user_id and s.deal_id=p_object_id for share;
  select * into source_row from public.deals where id=p_object_id for update;
  select * into pool from crm_security.expansion_pool where source_deal_id=p_object_id for update;
  if source_row.id is null or pool.source_deal_id is null
     or source_row.outcome is distinct from 'won'
     or source_row.stage_code is distinct from 'won'
     or source_row.lifecycle_status is distinct from 'closed'
     or not crm_security.can_deal(p_object_id,true)
  then raise exception 'expansion pool state conflict' using errcode='PT409'; end if;

  if pool.created_opportunity_id is not null then
    if not exists(select 1 from public.deals d where d.id=pool.created_opportunity_id
      and d.list_fields->>'source_opportunity_id'=p_object_id::text
      and d.list_fields->>'quote_dispatch_id'=quote_dispatch_id::text)
    then raise exception 'expansion already converted' using errcode='PT409'; end if;
    ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,
      'operation','expansion_quote_convert','object_id',p_object_id,
      'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
      'source_opportunity_id',p_object_id,'new_opportunity_id',pool.created_opportunity_id,
      'quote_dispatch_id',quote_dispatch_id,'stage_code','sent','origin','expansion',
      'expansion_status','Pipeline 전환','previous_version',p_expected_version,
      'version',pool.version,'server_at',server_at,'replayed',true);
    insert into crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
    values(a.auth_uid,p_request_id,a.user_id,'expansion_quote_convert',p_object_id,p_expected_version,p_payload,ack,server_at);
    return ack;
  end if;
  if pool.version is distinct from p_expected_version
  then raise exception 'version conflict' using errcode='PT409'; end if;
  before_status:=pool.expansion_status;
  before_next_contact_at:=pool.next_contact_at;

  select * into sent_message from crm_security.message_outcomes m
   where m.id=quote_dispatch_id and m.deal_id=p_object_id and m.status='sent'
     and m.quote_version_no is not null and m.quote_attachment_id is not null
   for share;
  if not found then raise exception 'verified sent quote required' using errcode='22023'; end if;
  select * into quote_row from crm_security.quote_versions q
   where q.deal_id=p_object_id and q.version_no=sent_message.quote_version_no for share;
  if not found or quote_row.amount is distinct from (opportunity->>'amount')::bigint
  then raise exception 'sent quote amount mismatch' using errcode='PT409'; end if;

  create_payload:=jsonb_strip_nulls(jsonb_build_object(
    'surface','pc','site_id',coalesce(p_payload->'site_id',opportunity->'site_id'),
    'name',opportunity->>'name','work_name',opportunity->>'work_name',
    'work_type',regexp_replace(opportunity->>'primary_work','^.*>',''),
    'primary_work',opportunity->>'primary_work','work_items',opportunity->'work_items',
    'work_scope_type',opportunity->>'work_scope_type','work_summary',opportunity->>'work_summary',
    'brand',opportunity->>'brand','owner',opportunity->>'owner','amount',opportunity->'amount',
    'address',opportunity->'address','reason',opportunity->>'reason',
    'reason_source',coalesce(opportunity->>'reason_source','expansion_quote_convert'),
    'office_phone',opportunity->>'office_phone','office_email',opportunity->'office_email',
    'manager_name',opportunity->>'manager_name','manager_mobile',opportunity->>'manager_mobile',
    'manager_role','관리소장','person_key',opportunity->>'person_key',
    'client_ref','expansion:'||p_object_id::text
  ));
  create_ack:=crm_security.crm_opportunity_create_command_v1(create_request_id,create_request_id,create_payload);
  child_id:=(create_ack->>'new_opportunity_id')::uuid;

  update public.deals set
    stage_code='sent',stage_raw='컨설팅 자료 발송완료',source='existing_customer_expansion',
    list_fields=list_fields||jsonb_build_object('origin','expansion','origin_source','expansion',
      'source_opportunity_id',p_object_id,'quote_dispatch_id',quote_dispatch_id),
    stage_entered_at=server_at,last_activity_at=server_at,updated_at=server_at
   where id=child_id;
  insert into public.stage_history(opportunity_id,from_stage,to_stage,reason,actor_id,actor_name,changed_at)
  values(child_id,'first_contact','sent','실제 발송 견적 기준 확장 영업 전환',a.user_id,a.display_name,server_at)
  returning id into stage_history_id;
  insert into public.activities(deal_id,organization_id,actor_name,type,detail,occurred_at)
  select child_id,d.organization_id,a.display_name,'단계전환',jsonb_build_object(
    'from','first_contact','to','sent','source_opportunity_id',p_object_id,
    'quote_dispatch_id',quote_dispatch_id,'meaningful_contact',false),server_at
  from public.deals d where d.id=child_id returning id into transition_activity_id;
  update crm_security.expansion_pool set created_opportunity_id=child_id,
    expansion_status='신규 영업기회 생성',updated_at=server_at,version=version+1
   where source_deal_id=p_object_id and version=p_expected_version returning * into pool;
  if pool.source_deal_id is null then raise exception 'unexpected expansion version mutation' using errcode='PT409'; end if;
  insert into crm_security.expansion_pool_events(request_id,source_deal_id,kind,before_status,after_status,
    before_next_contact_at,after_next_contact_at,actor_auth_uid,actor_user_id,actor_name,occurred_at)
  values(p_request_id,p_object_id,'pipeline_convert',before_status,'신규 영업기회 생성',
    before_next_contact_at,before_next_contact_at,a.auth_uid,a.user_id,a.display_name,server_at)
  returning event_id into expansion_event_id;
  insert into crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason,created_at)
  values(a.auth_uid,a.user_id,a.display_name,p_object_id,'expansion_quote_convert',
    jsonb_build_object('pool_version',p_expected_version,'expansion_status',before_status),
    jsonb_build_object('pool_version',pool.version,'expansion_status',pool.expansion_status,
      'new_opportunity_id',child_id,'quote_dispatch_id',quote_dispatch_id,
      'stage_history_id',stage_history_id,'activity_id',transition_activity_id),
    opportunity->>'reason',server_at) returning event_id into audit_id;

  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,
    'operation','expansion_quote_convert','object_id',p_object_id,
    'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,
    'source_opportunity_id',p_object_id,'new_opportunity_id',child_id,
    'quote_dispatch_id',quote_dispatch_id,'stage_code','sent','origin','expansion',
    'expansion_status','Pipeline 전환','previous_version',p_expected_version,'version',pool.version,
    'stage_history_id',stage_history_id,'activity_id',transition_activity_id,
    'expansion_event_id',expansion_event_id,'audit_event_id',audit_id,
    'server_at',server_at,'replayed',false);
  insert into crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
  values(a.auth_uid,p_request_id,a.user_id,'expansion_quote_convert',p_object_id,p_expected_version,p_payload,ack,server_at);
  return ack;
end
$fn$;
revoke execute on function crm_security.crm_expansion_quote_convert_command_v1(uuid,uuid,integer,jsonb)
  from public,anon,authenticated,service_role;

alter function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
  rename to crm_write_command_v2_pre_expansion_convert_20260907;
alter function public.crm_write_command_v2_pre_expansion_convert_20260907(uuid,text,uuid,integer,jsonb)
  set schema crm_security;
revoke execute on function crm_security.crm_write_command_v2_pre_expansion_convert_20260907(uuid,text,uuid,integer,jsonb)
  from public,anon,authenticated,service_role;
create function public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
begin
  if p_operation='expansion_quote_convert' then
    return crm_security.crm_expansion_quote_convert_command_v1(p_request_id,p_object_id,p_expected_version,p_payload);
  end if;
  return crm_security.crm_write_command_v2_pre_expansion_convert_20260907(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
end
$fn$;
revoke execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;

alter function public.crm_expansion_context(jsonb) rename to crm_expansion_context_pre_convert_20260907;
alter function public.crm_expansion_context_pre_convert_20260907(jsonb) set schema crm_security;
revoke execute on function crm_security.crm_expansion_context_pre_convert_20260907(jsonb) from public,anon,authenticated,service_role;
create function public.crm_expansion_context(p jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare base jsonb; source_id uuid; dispatches jsonb;
begin
  base:=crm_security.crm_expansion_context_pre_convert_20260907(p);
  source_id:=(base->>'source_opportunity_id')::uuid;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'dispatch_id',m.id,'source_opportunity_id',m.deal_id,'status',m.status,
    'sent_at',m.occurred_at,'recipient',m.recipient_phone,'quote_title',m.template_title,
    'quote_version_id',q.id,'quote_version_no',m.quote_version_no,'quote_attachment_id',m.quote_attachment_id
  ) order by m.occurred_at desc,m.id),'[]'::jsonb) into dispatches
  from crm_security.message_outcomes m
  join crm_security.quote_versions q on q.deal_id=m.deal_id and q.version_no=m.quote_version_no
  where m.deal_id=source_id and m.status='sent' and m.quote_attachment_id is not null;
  return base||jsonb_build_object('dispatches',dispatches,'dispatch_completeness','verified_message_outcomes');
end
$fn$;
revoke execute on function public.crm_expansion_context(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_expansion_context(jsonb) to authenticated;

alter function public.crm_operational_source_v1(text,uuid,integer)
  rename to crm_operational_source_v1_pre_expansion_convert_20260907;
alter function public.crm_operational_source_v1_pre_expansion_convert_20260907(text,uuid,integer)
  set schema crm_security;
revoke execute on function crm_security.crm_operational_source_v1_pre_expansion_convert_20260907(text,uuid,integer)
  from public,anon,authenticated,service_role;
create function public.crm_operational_source_v1(p_domain text,p_after uuid default null,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare base jsonb; rows jsonb;
begin
  base:=crm_security.crm_operational_source_v1_pre_expansion_convert_20260907(p_domain,p_after,p_limit);
  if p_domain<>'expansion_pool' then return base; end if;
  select coalesce(jsonb_agg(item||jsonb_build_object('created_opportunity_id',x.created_opportunity_id)
    order by (item->>'id')::uuid),'[]'::jsonb) into rows
  from jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item
  join crm_security.expansion_pool x on x.source_deal_id=(item->>'id')::uuid;
  return jsonb_set(base,'{items}',rows,false);
end
$fn$;
revoke execute on function public.crm_operational_source_v1(text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.crm_operational_source_v1(text,uuid,integer) to authenticated;

do $post$
begin
  if has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','execute')
     or not has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','execute')
     or has_function_privilege('authenticated','crm_security.crm_expansion_quote_convert_command_v1(uuid,uuid,integer,jsonb)','execute')
     or not exists(select 1 from information_schema.columns where table_schema='crm_security' and table_name='expansion_pool' and column_name='created_opportunity_id')
  then raise exception 'expansion conversion postcondition failed'; end if;
end
$post$;

commit;
