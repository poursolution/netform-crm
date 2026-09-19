-- netform-crm only; supersedes the unapplied September 8 queue design.
-- Uses existing per-deal consent and preserves current contact/Site/relationship behavior.
set local lock_timeout='3s';
set local statement_timeout='30s';
do $preflight$
begin
 if to_regclass('crm_security.sms_campaigns') is not null
 or to_regprocedure('crm_security.crm_write_command_v2_pre_aligo_20260919(uuid,text,uuid,integer,jsonb)') is not null
 then raise exception 'campaign schema already exists; review current deployment'; end if;
 if to_regclass('crm_security.contact_compat_state') is null
 or to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') is null
 or to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') is null
 then raise exception 'current CRM prerequisites missing'; end if;
end $preflight$;
create table crm_security.sms_campaigns (
  id uuid primary key,
  client_ref text not null unique,
  request_id uuid not null unique,
  category_key text not null,
  category_label text not null,
  category_group text not null,
  template_key text not null,
  body text not null,
  status text not null check (status in ('queued','scheduled','sending','submitted','sent','partial','failed','cancelled','unknown')),
  scheduled_at timestamptz,
  recipient_count integer not null check (recipient_count between 1 and 500),
  excluded_count integer not null default 0 check (excluded_count >= 0),
  submitted_count integer not null default 0 check (submitted_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  response_count integer not null default 0 check (response_count >= 0),
  next_action_count integer not null default 0 check (next_action_count >= 0),
  stage_advanced_count integer not null default 0 check (stage_advanced_count >= 0),
  won_count integer not null default 0 check (won_count >= 0),
  created_by_user_id uuid not null references public.users(user_id),
  created_by_auth_uid uuid not null,
  created_by_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table crm_security.sms_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references crm_security.sms_campaigns(id) on delete cascade,
  deal_id uuid not null references public.deals(id),
  contact_id uuid not null references public.contacts(id),
  person_key text not null,
  phone text not null,
  site_name text not null,
  contact_name text not null,
  owner_name text not null,
  personalized_body text not null,
  status text not null default 'queued' check (status in ('queued','sending','submitted','sent','failed','cancelled','unknown')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null,
  claimed_at timestamptz,
  worker_id uuid,
  claim_token uuid,
  submitted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  provider_message_id text,
  provider_response jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (campaign_id, phone)
);

create index sms_campaigns_status_schedule_idx
  on crm_security.sms_campaigns(status, scheduled_at, created_at)
  where status in ('queued','scheduled','sending','submitted');
create index sms_campaign_recipients_campaign_status_idx
  on crm_security.sms_campaign_recipients(campaign_id, status);
create index sms_campaign_recipients_claim_idx
  on crm_security.sms_campaign_recipients(available_at, created_at, id)
  where status = 'queued';
create index sms_campaign_recipients_deal_idx
  on crm_security.sms_campaign_recipients(deal_id);
create index sms_campaign_recipients_contact_idx
  on crm_security.sms_campaign_recipients(contact_id);

revoke all on table crm_security.sms_campaigns from public, anon, authenticated;
revoke all on table crm_security.sms_campaign_recipients from public, anon, authenticated;


alter table crm_security.sms_campaigns enable row level security;
alter table crm_security.sms_campaign_recipients enable row level security;
grant usage on schema crm_security to service_role;
do $receipt$
declare old_expression text;
begin
 select pg_get_expr(conbin,conrelid) into strict old_expression from pg_constraint
 where conrelid='crm_security.command_receipts'::regclass and conname='command_receipts_operation_check';
 alter table crm_security.command_receipts drop constraint command_receipts_operation_check;
 execute format('alter table crm_security.command_receipts add constraint command_receipts_operation_check check ((%s) or operation=%L)',old_expression,'campaign_create');
end $receipt$;
create function crm_security.crm_sms_campaign_create_command_v1(
  p_request_id uuid,
  p_object_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  prior crm_security.command_receipts%rowtype;
  canonical jsonb;
  ack jsonb;
  recipient jsonb;
  deal_value uuid;
  contact_value uuid;
  person_value text;
  phone_value text;
  linked_count integer;
  recipient_total integer;
  excluded_total integer;
  status_value text;
  scheduled_value timestamptz;
  server_at timestamptz;
  seen_phones text[]:='{}'::text[];
begin
  if p_request_id is null or p_object_id is null or jsonb_typeof(p_payload) is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(p_payload) k where k not in
       ('campaign_id','category_key','category_label','category_group','template_key','body','status','scheduled_at',
        'created_at','created_by','recipient_count','excluded_count','recipients','activity_on_success'))
     or not p_payload ?& array['campaign_id','category_key','category_label','category_group','template_key','body',
       'status','recipient_count','excluded_count','recipients']
     or jsonb_typeof(p_payload->'recipients') is distinct from 'array' then
    raise exception 'invalid campaign payload' using errcode='22023';
  end if;
  recipient_total:=jsonb_array_length(p_payload->'recipients');
  excluded_total:=coalesce((p_payload->>'excluded_count')::integer,0);
  status_value:=p_payload->>'status';
  scheduled_value:=nullif(p_payload->>'scheduled_at','')::timestamptz;
  if recipient_total not between 1 and 500 or (p_payload->>'recipient_count')::integer is distinct from recipient_total
     or excluded_total<0 or status_value is null or status_value not in ('queued','scheduled')
     or (status_value='scheduled' and (scheduled_value is null or scheduled_value<=clock_timestamp()))
     or (status_value='queued' and scheduled_value is not null)
     or coalesce(length(btrim(p_payload->>'campaign_id')),0) not between 1 and 100
     or coalesce(length(btrim(p_payload->>'category_key')),0) not between 1 and 100
     or coalesce(length(btrim(p_payload->>'category_label')),0) not between 1 and 200
     or coalesce(length(btrim(p_payload->>'category_group')),0) not between 1 and 200
     or coalesce(length(btrim(p_payload->>'template_key')),0) not between 1 and 200
     or coalesce(length(btrim(p_payload->>'body')),0) not between 1 and 5000 then
    raise exception 'invalid campaign values' using errcode='22023';
  end if;

  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform 1 from public.users u where u.auth_uid=auth.uid() for share;
  perform 1 from crm_security.access_review r where r.reviewed_auth_uid=auth.uid() for share;
  select * into a from crm_security.actor();
  if not found or a.permission_role<>'admin' then raise exception 'admin required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));

  canonical:=jsonb_build_object('campaign_id',btrim(p_payload->>'campaign_id'),
    'category_key',btrim(p_payload->>'category_key'),'category_label',btrim(p_payload->>'category_label'),
    'category_group',btrim(p_payload->>'category_group'),'template_key',btrim(p_payload->>'template_key'),
    'body',btrim(p_payload->>'body'),'status',status_value,'scheduled_at',scheduled_value,
    'recipient_count',recipient_total,'excluded_count',excluded_total,'recipients',p_payload->'recipients',
    'activity_on_success',coalesce((p_payload->>'activity_on_success')::boolean,true));
  select * into prior from crm_security.command_receipts r where r.actor_auth_uid=a.auth_uid and r.request_id=p_request_id;
  if found then
    if prior.actor_user_id is distinct from a.user_id or prior.operation is distinct from 'campaign_create'
       or prior.object_id is distinct from p_object_id or prior.expected_version is distinct from 0
       or prior.payload is distinct from canonical then
      raise exception 'REQUEST_ID_REUSE' using errcode='PT409';
    end if;
    return prior.ack||jsonb_build_object('replayed',true);
  end if;

  for recipient in select value from jsonb_array_elements(p_payload->'recipients') loop
    if jsonb_typeof(recipient) is distinct from 'object'
       or exists(select 1 from jsonb_object_keys(recipient) k where k not in
         ('recipient_key','opportunity_id','person_key','phone','site_name','contact_name','owner','personalized_body'))
       or not recipient ?& array['opportunity_id','person_key','phone','site_name','contact_name','owner','personalized_body']
       or recipient->>'opportunity_id' is null or recipient->>'opportunity_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'invalid campaign recipient' using errcode='22023';
    end if;
    deal_value:=(recipient->>'opportunity_id')::uuid;
    person_value:=btrim(recipient->>'person_key');
    phone_value:=regexp_replace(coalesce(recipient->>'phone',''),'[^0-9]','','g');
    if person_value is null or phone_value !~ '^010[0-9]{8}$' or phone_value=any(seen_phones)
       or coalesce(length(btrim(recipient->>'site_name')),0) not between 1 and 300
       or coalesce(length(btrim(recipient->>'contact_name')),0) not between 1 and 200
       or coalesce(length(btrim(recipient->>'owner')),0) not between 1 and 200
       or coalesce(octet_length(btrim(recipient->>'personalized_body')),0) not between 1 and 2000
       or not crm_security.can_deal(deal_value,false) then
      raise exception 'unsafe campaign recipient' using errcode='22023';
    end if;
    perform 1 from public.contacts c join crm_security.contact_compat_state cs on cs.contact_id=c.id
    where c.person_key=person_value and cs.deal_id=deal_value for share of c,cs;
    select count(*)::integer,max(c.id::text)::uuid into linked_count,contact_value
    from public.contacts c join public.deals d on d.id=deal_value
    join crm_security.contact_compat_state cs on cs.contact_id=c.id and cs.deal_id=d.id
    where c.person_key=person_value
      and (c.id=d.contact_id or c.person_key=d.person_key or exists(
        select 1 from public.contact_assignments ca where ca.person_key=c.person_key
          and ca.opportunity_id=deal_value and ca.status='current' and ca.ended_at is null))
      and regexp_replace(coalesce(nullif(c.mobile,''),nullif(c.phone,''),''),'[^0-9]','','g')=phone_value
      and cs.sms_consent and cs.consent_at is not null and cs.consent_at<=now() and not coalesce(cs.send_blocked,true) and cs.opt_out_at is null;
    if linked_count<>1 then raise exception 'recipient consent or identity not verified' using errcode='22023'; end if;
    seen_phones:=array_append(seen_phones,phone_value);
  end loop;

  server_at:=clock_timestamp();
  insert into crm_security.sms_campaigns(id,client_ref,request_id,category_key,category_label,category_group,
    template_key,body,status,scheduled_at,recipient_count,excluded_count,created_by_user_id,created_by_auth_uid,
    created_by_name,created_at,updated_at)
  values(p_object_id,btrim(p_payload->>'campaign_id'),p_request_id,btrim(p_payload->>'category_key'),
    btrim(p_payload->>'category_label'),btrim(p_payload->>'category_group'),btrim(p_payload->>'template_key'),
    btrim(p_payload->>'body'),status_value,scheduled_value,recipient_total,excluded_total,a.user_id,a.auth_uid,
    a.display_name,server_at,server_at);

  for recipient in select value from jsonb_array_elements(p_payload->'recipients') loop
    deal_value:=(recipient->>'opportunity_id')::uuid;
    person_value:=btrim(recipient->>'person_key');
    phone_value:=regexp_replace(recipient->>'phone','[^0-9]','','g');
    select c.id into strict contact_value from public.contacts c join public.deals d on d.id=deal_value
    join crm_security.contact_compat_state cs on cs.contact_id=c.id and cs.deal_id=d.id
    where c.person_key=person_value and (c.id=d.contact_id or c.person_key=d.person_key or exists(
      select 1 from public.contact_assignments ca where ca.person_key=c.person_key
        and ca.opportunity_id=deal_value and ca.status='current' and ca.ended_at is null));
    insert into crm_security.sms_campaign_recipients(campaign_id,deal_id,contact_id,person_key,phone,site_name,
      contact_name,owner_name,personalized_body,status,available_at,created_at,updated_at)
    values(p_object_id,deal_value,contact_value,person_value,phone_value,btrim(recipient->>'site_name'),
      btrim(recipient->>'contact_name'),btrim(recipient->>'owner'),btrim(recipient->>'personalized_body'),'queued',
      coalesce(scheduled_value,server_at),server_at,server_at);
  end loop;

  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'write_id',p_request_id,
    'operation','campaign_create','object_id',p_object_id,'campaign_id',btrim(p_payload->>'campaign_id'),
    'status',status_value,'recipient_count',recipient_total,'scheduled_at',scheduled_value,
    'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'actor_name',a.display_name,
    'server_at',server_at,'replayed',false);
  insert into crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
  values(a.auth_uid,p_request_id,a.user_id,'campaign_create',p_object_id,0,canonical,ack,server_at);
  return ack;
end $$;


-- Calls require the service-role API credential and return only the claimed rows.
create function crm_security.crm_sms_worker_claim_v1(p_worker_id uuid,p_allowed_receivers text[],p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_worker_id is null or p_limit is null or p_limit not between 1 and 50
 or coalesce(cardinality(p_allowed_receivers),0) not between 1 and 500
 or exists(select 1 from unnest(p_allowed_receivers) p where p is null or p !~ '^010[0-9]{8}$')
 then raise exception 'invalid worker claim' using errcode='22023'; end if;
 -- Never requeue sending rows: a timeout is not evidence that Aligo rejected a send.
 with picked as (
 select r.id from crm_security.sms_campaign_recipients r
 join crm_security.sms_campaigns c on c.id=r.campaign_id
 join public.contacts ct on ct.id=r.contact_id
 join crm_security.contact_compat_state cs on cs.contact_id=r.contact_id and cs.deal_id=r.deal_id
 join public.deals d on d.id=r.deal_id
 join public.users u on u.user_id=c.created_by_user_id
 join crm_security.access_review ar on ar.user_id=u.user_id
 where r.status='queued' and r.available_at<=clock_timestamp() and r.phone=any(p_allowed_receivers)
 and c.status in ('queued','scheduled','sending','submitted','unknown')
 and u.active and u.auth_uid=c.created_by_auth_uid and ar.approved and ar.permission_role='admin'
 and ar.source_role=u.role and ar.reviewed_auth_uid=u.auth_uid and ar.expires_at>now()
 and cs.sms_consent and cs.consent_at is not null and cs.consent_at<=now()
 and not coalesce(cs.send_blocked,true) and cs.opt_out_at is null
 and ct.person_key=r.person_key
 and regexp_replace(coalesce(nullif(ct.mobile,''),ct.phone,''),'[^0-9]','','g')=r.phone
 and (ct.id=d.contact_id or ct.person_key=d.person_key or exists(
 select 1 from public.contact_assignments ca where ca.person_key=ct.person_key
 and ca.opportunity_id=d.id and ca.status='current' and ca.ended_at is null))
 order by r.available_at,r.id for update of r skip locked limit p_limit
 ), updated as (
 update crm_security.sms_campaign_recipients r set status='sending',worker_id=p_worker_id,
 claim_token=gen_random_uuid(),claimed_at=clock_timestamp(),attempt_count=attempt_count+1,updated_at=clock_timestamp()
 from picked where picked.id=r.id returning r.*
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'claim_token',claim_token,'receiver',phone,
 'message',personalized_body,'type',case when octet_length(personalized_body)<=90 then 'SMS' else 'LMS' end,
 'status',status,'provider_message_id',provider_message_id)),'[]'::jsonb) into result from updated;
 return jsonb_build_object('contract_version',1,'items',result);
end $$;

create function crm_security.crm_sms_worker_pending_v1(p_worker_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_worker_id is null then raise exception 'invalid worker' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'claim_token',r.claim_token,'receiver',r.phone,
 'message',r.personalized_body,'type',case when octet_length(r.personalized_body)<=90 then 'SMS' else 'LMS' end,
 'status',r.status,'provider_message_id',r.provider_message_id)),'[]'::jsonb) into result
 from (select * from crm_security.sms_campaign_recipients
 where worker_id=p_worker_id and status in ('sending','submitted') order by updated_at,id limit 500) r;
 return jsonb_build_object('contract_version',1,'items',result);
end $$;

create function crm_security.crm_sms_worker_result_v1(
 p_worker_id uuid,p_recipient_id uuid,p_claim_token uuid,p_status text,p_provider_message_id text,p_error_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r crm_security.sms_campaign_recipients%rowtype; c crm_security.sms_campaigns%rowtype;
 cid uuid; totals record; now_at timestamptz:=clock_timestamp();
begin
 if p_worker_id is null or p_recipient_id is null or p_claim_token is null or p_status is null
 or p_status not in ('submitted','sent','failed','unknown')
 or (p_status in ('submitted','sent') and coalesce(p_provider_message_id,'') !~ '^[1-9][0-9]{0,19}$')
 or (p_provider_message_id is not null and p_provider_message_id !~ '^[1-9][0-9]{0,19}$')
 or (p_error_code is not null and p_error_code !~ '^[A-Z0-9_:-]{1,100}$')
 then raise exception 'invalid worker result' using errcode='22023'; end if;
 select campaign_id into cid from crm_security.sms_campaign_recipients where id=p_recipient_id;
 -- Serialize campaign counts before modifying any of its recipients.
 select * into c from crm_security.sms_campaigns where id=cid for update;
 select * into r from crm_security.sms_campaign_recipients where id=p_recipient_id for update;
 if not found or r.worker_id is distinct from p_worker_id or r.claim_token is distinct from p_claim_token
 then raise exception 'claim conflict' using errcode='PT409'; end if;
 if r.provider_message_id is not null and r.provider_message_id is distinct from p_provider_message_id
 then raise exception 'provider identity conflict' using errcode='PT409'; end if;
 if r.status in ('sent','failed','cancelled','unknown') then
  if r.status is distinct from p_status then raise exception 'terminal conflict' using errcode='PT409'; end if;
 elsif r.status not in ('sending','submitted') or (r.status='submitted' and p_status='unknown') then
  raise exception 'invalid transition' using errcode='PT409';
 else
  update crm_security.sms_campaign_recipients set status=p_status,provider_message_id=p_provider_message_id,
  last_error=p_error_code,updated_at=now_at,
  submitted_at=case when p_status in ('submitted','sent') then coalesce(submitted_at,now_at) else submitted_at end,
  delivered_at=case when p_status='sent' then now_at else delivered_at end,
  failed_at=case when p_status='failed' then now_at else failed_at end where id=r.id;
  if p_status='sent' then
   insert into public.activities(deal_id,organization_id,actor_name,type,detail,occurred_at)
   select d.id,d.organization_id,c.created_by_name,'문자',
    jsonb_build_object('note',c.category_label||' 발송','result',r.personalized_body,'meaningful_contact',false,
     'sms_campaign_id',c.id,'sms_recipient_id',r.id,'provider_message_id',p_provider_message_id,
     'attestation_kind','provider_confirmed','status','sent'),now_at
   from public.deals d where d.id=r.deal_id;
  end if;
 end if;
 select count(*) filter(where status='sent') sent,count(*) filter(where status='failed') failed,
 count(*) filter(where status='submitted') submitted,count(*) filter(where status='unknown') unknown,
 count(*) filter(where status in ('queued','sending')) pending into totals
 from crm_security.sms_campaign_recipients where campaign_id=cid;
 update crm_security.sms_campaigns set sent_count=totals.sent,failed_count=totals.failed,
 submitted_count=totals.submitted,updated_at=now_at,status=case
 when totals.pending>0 then 'sending' when totals.submitted>0 then 'submitted'
 when totals.unknown>0 then 'unknown' when totals.sent=recipient_count then 'sent'
 when totals.failed=recipient_count then 'failed' else 'partial' end where id=cid;
 return jsonb_build_object('ok',true,'recipient_id',r.id,'status',p_status);
end $$;

revoke all on function crm_security.crm_sms_worker_claim_v1(uuid,text[],integer) from public,anon,authenticated;
revoke all on function crm_security.crm_sms_worker_pending_v1(uuid) from public,anon,authenticated;
revoke all on function crm_security.crm_sms_worker_result_v1(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function crm_security.crm_sms_worker_claim_v1(uuid,text[],integer) to service_role;
grant execute on function crm_security.crm_sms_worker_pending_v1(uuid) to service_role;
grant execute on function crm_security.crm_sms_worker_result_v1(uuid,uuid,uuid,text,text,text) to service_role;

create function public.crm_sms_worker_claim_v1(p_worker_id uuid,p_allowed_receivers text[],p_limit integer default 10)
returns jsonb language sql security invoker set search_path='' as $$
 select crm_security.crm_sms_worker_claim_v1(p_worker_id,p_allowed_receivers,p_limit)
$$;
create function public.crm_sms_worker_pending_v1(p_worker_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select crm_security.crm_sms_worker_pending_v1(p_worker_id)
$$;
create function public.crm_sms_worker_result_v1(p_worker_id uuid,p_recipient_id uuid,p_claim_token uuid,
 p_status text,p_provider_message_id text default null,p_error_code text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select crm_security.crm_sms_worker_result_v1(p_worker_id,p_recipient_id,p_claim_token,p_status,p_provider_message_id,p_error_code)
$$;
revoke all on function public.crm_sms_worker_claim_v1(uuid,text[],integer) from public,anon,authenticated;
revoke all on function public.crm_sms_worker_pending_v1(uuid) from public,anon,authenticated;
revoke all on function public.crm_sms_worker_result_v1(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.crm_sms_worker_claim_v1(uuid,text[],integer) to service_role;
grant execute on function public.crm_sms_worker_pending_v1(uuid) to service_role;
grant execute on function public.crm_sms_worker_result_v1(uuid,uuid,uuid,text,text,text) to service_role;

-- Preserve every current command by delegating non-campaign operations.
alter function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) set schema crm_security;
alter function crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) rename to crm_write_command_v2_pre_aligo_20260919;
revoke all on function crm_security.crm_write_command_v2_pre_aligo_20260919(uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function crm_security.crm_sms_campaign_create_command_v1(uuid,uuid,jsonb) from public,anon,authenticated;
create function public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_operation='campaign_create' then
  if p_expected_version is distinct from 0 then raise exception 'invalid campaign version' using errcode='22023'; end if;
  return crm_security.crm_sms_campaign_create_command_v1(p_request_id,p_object_id,p_payload);
 end if;
 return crm_security.crm_write_command_v2_pre_aligo_20260919(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
end $$;
revoke all on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) from public,anon;
grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;

alter function public.crm_operational_source_v1(text,uuid,integer) set schema crm_security;
alter function crm_security.crm_operational_source_v1(text,uuid,integer) rename to crm_operational_source_v1_pre_aligo_20260919;
revoke all on function crm_security.crm_operational_source_v1_pre_aligo_20260919(text,uuid,integer) from public,anon,authenticated;
create function public.crm_operational_source_v1(p_domain text,p_after uuid default null,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a record; items jsonb; next_cursor uuid; more boolean;
begin
 if p_domain is distinct from 'campaign_core' then
 return crm_security.crm_operational_source_v1_pre_aligo_20260919(p_domain,p_after,p_limit); end if;
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid limit' using errcode='22023'; end if;
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception 'forbidden' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb),max(x.id::text)::uuid,count(*)=p_limit into items,next_cursor,more
 from (select c.id,c.client_ref as campaign_id,c.category_key,c.category_label as category,c.category_group,
 c.template_key,c.body,c.status,c.scheduled_at,c.recipient_count,c.excluded_count,c.submitted_count,
 c.sent_count,c.failed_count,c.response_count,c.next_action_count,c.stage_advanced_count,c.won_count,
 c.created_by_name as created_by,c.created_at,c.updated_at from crm_security.sms_campaigns c
 where p_after is null or c.id>p_after order by c.id limit p_limit) x;
 return jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,
 'scope_completeness','actor_authorized_rows_only','items',items,'pagination',jsonb_build_object(
 'completeness',case when more then 'partial' else 'complete' end,'has_more',more,
 'next_cursor',case when more then next_cursor::text else null end));
end $$;
revoke all on function public.crm_operational_source_v1(text,uuid,integer) from public,anon;
grant execute on function public.crm_operational_source_v1(text,uuid,integer) to authenticated;
