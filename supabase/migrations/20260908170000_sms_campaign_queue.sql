begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';
set local search_path = pg_catalog;

do $$
begin
  if to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') is null
     or to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') is null
     or to_regprocedure('crm_security.actor()') is null
     or to_regprocedure('crm_security.can_deal(uuid,boolean)') is null then
    raise exception 'sms campaign prerequisites are missing';
  end if;
  if to_regprocedure('crm_security.crm_write_command_v2_pre_sms_campaign_20260908(uuid,text,uuid,integer,jsonb)') is not null
     or to_regprocedure('crm_security.crm_operational_source_v1_pre_sms_campaign_20260908(text,uuid,integer)') is not null then
    raise exception 'sms campaign wrapper target already exists';
  end if;
end $$;

alter table public.contacts
  add column if not exists sms_consent boolean not null default false,
  add column if not exists kakao_consent boolean not null default false,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_source text,
  add column if not exists opt_out_at timestamptz,
  add column if not exists send_blocked boolean not null default false,
  add column if not exists send_blocked_reason text;

alter table public.contacts drop constraint if exists contacts_message_consent_check;
alter table public.contacts add constraint contacts_message_consent_check check (
  (not sms_consent and not kakao_consent)
  or (consent_at is not null and not send_blocked and opt_out_at is null)
);

create table crm_security.sms_campaigns (
  id uuid primary key,
  client_ref text not null unique,
  request_id uuid not null unique,
  category_key text not null,
  category_label text not null,
  category_group text not null,
  template_key text not null,
  body text not null,
  status text not null check (status in ('queued','scheduled','sending','submitted','sent','partial','failed','cancelled')),
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
  status text not null default 'queued' check (status in ('queued','sending','submitted','sent','failed','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null,
  claimed_at timestamptz,
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

alter table crm_security.command_receipts drop constraint command_receipts_operation_check;
alter table crm_security.command_receipts add constraint command_receipts_operation_check check (operation = any (array[
 'opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch',
 'next_action','activity','quote_version','next_action_complete','stage_check','transition','close','amount',
 'waiting_context','inquiry_reclassify','inquiry_status','inquiry_trash','inquiry_restore','inquiry_purge',
 'inquiry_followup','opportunity_create','lineage_link','attachment_prepare','attachment_complete',
 'expansion_pool_update','expansion_note','customer_support_action','message_log','relationship_hold',
 'relationship_response','inquiry_consultant','assign','contact_upsert','contact_relationship','contact_move',
 'rep_manager_comment','expansion_quote_convert','campaign_create'
]::text[]));

create function crm_security.crm_contact_upsert_command_v1(
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
  d public.deals%rowtype;
  canonical jsonb;
  ack jsonb;
  contact_id_value uuid;
  person_key_value text;
  mobile_value text;
  office_value text;
  role_value text;
  name_value text;
  site_value text;
  email_value text;
  started_value date;
  sms_value boolean;
  kakao_value boolean;
  blocked_value boolean;
  consent_value timestamptz;
  opt_out_value timestamptz;
  block_reason_value text;
  primary_value boolean;
  server_at timestamptz;
begin
  if p_request_id is null or p_object_id is null or jsonb_typeof(p_payload) is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(p_payload) k where k not in
       ('opportunity_id','person_key','site_name','office_phone','office_email','manager_name','manager_mobile',
        'manager_role','is_primary','started_at','sms_consent','kakao_consent','consent_at','opt_out_at',
        'send_blocked','send_blocked_reason'))
     or not p_payload ?& array['opportunity_id','person_key','site_name','manager_name','manager_mobile','manager_role']
     or p_payload->>'opportunity_id' is distinct from p_object_id::text then
    raise exception 'invalid contact payload' using errcode='22023';
  end if;

  person_key_value:=btrim(p_payload->>'person_key');
  mobile_value:=regexp_replace(coalesce(p_payload->>'manager_mobile',''),'[^0-9]','','g');
  office_value:=nullif(regexp_replace(coalesce(p_payload->>'office_phone',''),'[^0-9]','','g'),'');
  role_value:=btrim(p_payload->>'manager_role');
  name_value:=btrim(p_payload->>'manager_name');
  site_value:=btrim(p_payload->>'site_name');
  email_value:=nullif(btrim(p_payload->>'office_email'),'');
  started_value:=coalesce(nullif(left(p_payload->>'started_at',10),'')::date,current_date);
  sms_value:=coalesce((p_payload->>'sms_consent')::boolean,false);
  kakao_value:=coalesce((p_payload->>'kakao_consent')::boolean,false);
  blocked_value:=coalesce((p_payload->>'send_blocked')::boolean,false);
  consent_value:=nullif(p_payload->>'consent_at','')::timestamptz;
  opt_out_value:=nullif(p_payload->>'opt_out_at','')::timestamptz;
  block_reason_value:=nullif(btrim(p_payload->>'send_blocked_reason'),'');
  primary_value:=coalesce((p_payload->>'is_primary')::boolean,false) or role_value='관리소장';

  if person_key_value is distinct from 'mobile:'||mobile_value
     or mobile_value !~ '^010[0-9]{8}$'
     or length(name_value) not between 1 and 200
     or length(role_value) not between 1 and 100
     or length(site_value) not between 1 and 300
     or (office_value is not null and length(office_value) not between 8 and 20)
     or (email_value is not null and (length(email_value)>320 or email_value !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'))
     or ((sms_value or kakao_value) and (consent_value is null or blocked_value or opt_out_value is not null))
     or (blocked_value and (sms_value or kakao_value or opt_out_value is null))
     or length(coalesce(block_reason_value,''))>1000 then
    raise exception 'invalid contact consent or identity' using errcode='22023';
  end if;

  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform 1 from public.users u where u.auth_uid=auth.uid() for share;
  perform 1 from crm_security.access_review r where r.reviewed_auth_uid=auth.uid() for share;
  select * into a from crm_security.actor();
  if not found or a.permission_role not in ('rep','branch','admin') then raise exception 'forbidden' using errcode='42501'; end if;
  select * into d from public.deals where id=p_object_id for update;
  if not found or not crm_security.can_deal(p_object_id,true) then raise exception 'forbidden' using errcode='42501'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.auth_uid::text||p_request_id::text,0));
  canonical:=jsonb_build_object(
    'opportunity_id',p_object_id,'person_key',person_key_value,'site_name',site_value,'office_phone',office_value,
    'office_email',email_value,'manager_name',name_value,'manager_mobile',mobile_value,'manager_role',role_value,
    'is_primary',primary_value,'started_at',started_value,'sms_consent',sms_value,'kakao_consent',kakao_value,
    'consent_at',consent_value,'opt_out_at',opt_out_value,'send_blocked',blocked_value,
    'send_blocked_reason',block_reason_value
  );
  select * into prior from crm_security.command_receipts r where r.actor_auth_uid=a.auth_uid and r.request_id=p_request_id;
  if found then
    if prior.actor_user_id is distinct from a.user_id or prior.operation is distinct from 'contact_upsert'
       or prior.object_id is distinct from p_object_id or prior.expected_version is distinct from 0
       or prior.payload is distinct from canonical then
      raise exception 'REQUEST_ID_REUSE' using errcode='PT409';
    end if;
    return prior.ack||jsonb_build_object('replayed',true);
  end if;

  server_at:=clock_timestamp();
  insert into public.contacts(
    organization_id,name,title,phone,mobile,role,person_key,current_site,created_at,updated_at,
    sms_consent,kakao_consent,consent_at,consent_source,opt_out_at,send_blocked,send_blocked_reason
  ) values(
    d.organization_id,name_value,role_value,mobile_value,mobile_value,role_value,person_key_value,site_value,
    server_at,server_at,sms_value,kakao_value,consent_value,
    case when consent_value is null then null else 'crm_user_recorded' end,opt_out_value,blocked_value,block_reason_value
  ) on conflict(person_key) do update set
    organization_id=coalesce(excluded.organization_id,public.contacts.organization_id),name=excluded.name,
    title=excluded.title,phone=excluded.phone,mobile=excluded.mobile,role=excluded.role,
    current_site=excluded.current_site,updated_at=excluded.updated_at,sms_consent=excluded.sms_consent,
    kakao_consent=excluded.kakao_consent,consent_at=excluded.consent_at,consent_source=excluded.consent_source,
    opt_out_at=excluded.opt_out_at,send_blocked=excluded.send_blocked,
    send_blocked_reason=excluded.send_blocked_reason
  returning id into contact_id_value;

  insert into public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason)
  values(person_key_value,p_object_id,site_value,office_value,started_value,'current','CRM 연락처·수신동의 저장')
  on conflict(person_key,site_name) where ended_at is null do update set
    opportunity_id=excluded.opportunity_id,office_phone=excluded.office_phone,status='current',reason=excluded.reason;

  if primary_value then
    update public.deals set contact_id=contact_id_value,office_phone=coalesce(office_value,office_phone),
      office_email=coalesce(email_value,office_email),manager_name=name_value,manager_mobile=mobile_value,
      manager_role=role_value,person_key=person_key_value,manager_current_site=site_value,
      manager_started_at=coalesce(manager_started_at,started_value),manager_status='current',updated_at=server_at
    where id=p_object_id;
  end if;

  ack:=jsonb_build_object('contract_version',1,'ok',true,'request_id',p_request_id,'write_id',p_request_id,
    'operation','contact_upsert','object_id',p_object_id,'contact_id',contact_id_value,'person_key',person_key_value,
    'sms_consent',sms_value,'kakao_consent',kakao_value,'send_blocked',blocked_value,
    'actor_auth_uid',a.auth_uid,'actor_user_id',a.user_id,'actor_name',a.display_name,
    'server_at',server_at,'replayed',false);
  insert into crm_security.command_receipts(actor_auth_uid,request_id,actor_user_id,operation,object_id,expected_version,payload,ack,created_at)
  values(a.auth_uid,p_request_id,a.user_id,'contact_upsert',p_object_id,0,canonical,ack,server_at);
  return ack;
end $$;

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
  if recipient_total not between 1 and 500 or (p_payload->>'recipient_count')::integer<>recipient_total
     or excluded_total<0 or status_value not in ('queued','scheduled')
     or (status_value='scheduled' and (scheduled_value is null or scheduled_value<=clock_timestamp()))
     or (status_value='queued' and scheduled_value is not null)
     or length(btrim(p_payload->>'campaign_id')) not between 1 and 100
     or length(btrim(p_payload->>'category_key')) not between 1 and 100
     or length(btrim(p_payload->>'category_label')) not between 1 and 200
     or length(btrim(p_payload->>'category_group')) not between 1 and 200
     or length(btrim(p_payload->>'template_key')) not between 1 and 200
     or length(btrim(p_payload->>'body')) not between 1 and 5000 then
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
       or recipient->>'opportunity_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'invalid campaign recipient' using errcode='22023';
    end if;
    deal_value:=(recipient->>'opportunity_id')::uuid;
    person_value:=btrim(recipient->>'person_key');
    phone_value:=regexp_replace(coalesce(recipient->>'phone',''),'[^0-9]','','g');
    if phone_value !~ '^010[0-9]{8}$' or phone_value=any(seen_phones)
       or length(btrim(recipient->>'site_name')) not between 1 and 300
       or length(btrim(recipient->>'contact_name')) not between 1 and 200
       or length(btrim(recipient->>'owner')) not between 1 and 200
       or length(btrim(recipient->>'personalized_body')) not between 1 and 5000
       or not crm_security.can_deal(deal_value,false) then
      raise exception 'unsafe campaign recipient' using errcode='22023';
    end if;
    select count(*)::integer,max(c.id::text)::uuid into linked_count,contact_value
    from public.contacts c join public.deals d on d.id=deal_value
    where c.person_key=person_value
      and (c.id=d.contact_id or c.person_key=d.person_key or exists(
        select 1 from public.contact_assignments ca where ca.person_key=c.person_key
          and ca.opportunity_id=deal_value and ca.status='current' and ca.ended_at is null))
      and regexp_replace(coalesce(nullif(c.mobile,''),nullif(c.phone,''),''),'[^0-9]','','g')=phone_value
      and c.sms_consent and c.consent_at is not null and not c.send_blocked and c.opt_out_at is null;
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

create function public.crm_sms_campaign_claim_batch(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
  if p_limit not between 1 and 100 then raise exception 'invalid limit' using errcode='22023'; end if;

  update crm_security.sms_campaign_recipients
  set status=case when attempt_count>=5 then 'failed' else 'queued' end,
      available_at=case when attempt_count>=5 then available_at else clock_timestamp() end,
      failed_at=case when attempt_count>=5 then clock_timestamp() else failed_at end,
      last_error=case when attempt_count>=5 then 'claim timeout limit' else last_error end,
      updated_at=clock_timestamp()
  where status='sending' and claimed_at<clock_timestamp()-interval '10 minutes';

  with picked as (
    select r.id from crm_security.sms_campaign_recipients r
    join crm_security.sms_campaigns c on c.id=r.campaign_id
    where r.status='queued' and r.available_at<=clock_timestamp()
      and c.status in ('queued','scheduled','sending','submitted')
    order by r.available_at,r.created_at,r.id
    for update of r skip locked
    limit p_limit
  ), claimed as (
    update crm_security.sms_campaign_recipients r set status='sending',claimed_at=clock_timestamp(),
      attempt_count=r.attempt_count+1,updated_at=clock_timestamp()
    from picked where r.id=picked.id
    returning r.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'recipient_id',r.id,'campaign_id',r.campaign_id,'campaign_ref',c.client_ref,'receiver',r.phone,
    'msg',r.personalized_body,'site_name',r.site_name,'contact_name',r.contact_name,'attempt',r.attempt_count
  ) order by r.available_at,r.created_at,r.id),'[]'::jsonb) into result
  from claimed r join crm_security.sms_campaigns c on c.id=r.campaign_id;

  update crm_security.sms_campaigns c set status='sending',updated_at=clock_timestamp()
  where exists(select 1 from crm_security.sms_campaign_recipients r where r.campaign_id=c.id and r.status='sending')
    and c.status in ('queued','scheduled','submitted');
  return jsonb_build_object('contract_version',1,'items',result,'claimed_count',jsonb_array_length(result),
    'server_at',clock_timestamp());
end $$;

create function public.crm_sms_campaign_provider_result(
  p_recipient_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_provider_response jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r crm_security.sms_campaign_recipients%rowtype;
  c crm_security.sms_campaigns%rowtype;
  now_value timestamptz:=clock_timestamp();
  actor_email text;
  final_status text;
  submitted_total integer;
  sent_total integer;
  failed_total integer;
  pending_total integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
  if p_recipient_id is null or p_status not in ('submitted','sent','failed')
     or jsonb_typeof(coalesce(p_provider_response,'{}'::jsonb)) is distinct from 'object'
     or length(coalesce(p_provider_message_id,''))>500 then
    raise exception 'invalid provider result' using errcode='22023';
  end if;
  select * into r from crm_security.sms_campaign_recipients where id=p_recipient_id for update;
  if not found then raise exception 'recipient not found' using errcode='22023'; end if;
  if r.status in ('sent','failed','cancelled') then
    if r.status is distinct from p_status then raise exception 'terminal result conflict' using errcode='PT409'; end if;
  else
    update crm_security.sms_campaign_recipients set status=p_status,
      submitted_at=case when p_status in ('submitted','sent') then coalesce(submitted_at,now_value) else submitted_at end,
      delivered_at=case when p_status='sent' then now_value else delivered_at end,
      failed_at=case when p_status='failed' then now_value else failed_at end,
      provider_message_id=coalesce(nullif(p_provider_message_id,''),provider_message_id),
      provider_response=coalesce(p_provider_response,'{}'::jsonb),
      last_error=case when p_status='failed' then left(coalesce(p_provider_response->>'message','provider rejected'),2000) else null end,
      updated_at=now_value
    where id=p_recipient_id returning * into r;
    if p_status='sent' then
      select u.email into actor_email from public.users u where u.user_id=(select created_by_user_id from crm_security.sms_campaigns where id=r.campaign_id);
      insert into public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
      select r.deal_id,d.organization_id,actor_email,c.created_by_name,'문자',
        jsonb_build_object('note',c.category_label||' 발송','result',r.personalized_body,'meaningful_contact',false,
          'sms_campaign_id',c.id,'sms_recipient_id',r.id,'provider_message_id',r.provider_message_id,
          'attestation_kind','provider_confirmed','status','sent'),now_value
      from public.deals d join crm_security.sms_campaigns c on c.id=r.campaign_id where d.id=r.deal_id;
    end if;
  end if;

  select count(*) filter(where status='submitted'),count(*) filter(where status='sent'),
    count(*) filter(where status='failed'),count(*) filter(where status in ('queued','sending'))
  into submitted_total,sent_total,failed_total,pending_total
  from crm_security.sms_campaign_recipients where campaign_id=r.campaign_id;
  select * into c from crm_security.sms_campaigns where id=r.campaign_id for update;
  final_status:=case
    when pending_total>0 then 'sending'
    when submitted_total>0 then 'submitted'
    when sent_total=c.recipient_count then 'sent'
    when sent_total>0 and failed_total>0 then 'partial'
    when failed_total=c.recipient_count then 'failed'
    else c.status end;
  update crm_security.sms_campaigns set status=final_status,submitted_count=submitted_total,
    sent_count=sent_total,failed_count=failed_total,updated_at=now_value where id=r.campaign_id;
  return jsonb_build_object('contract_version',1,'ok',true,'recipient_id',r.id,'campaign_id',r.campaign_id,
    'status',p_status,'campaign_status',final_status,'server_at',now_value);
end $$;

revoke all on function crm_security.crm_contact_upsert_command_v1(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function crm_security.crm_sms_campaign_create_command_v1(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.crm_sms_campaign_claim_batch(integer) from public, anon, authenticated;
revoke all on function public.crm_sms_campaign_provider_result(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.crm_sms_campaign_claim_batch(integer) to service_role;
grant execute on function public.crm_sms_campaign_provider_result(uuid,text,text,jsonb) to service_role;

alter function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) set schema crm_security;
alter function crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
  rename to crm_write_command_v2_pre_sms_campaign_20260908;
revoke all on function crm_security.crm_write_command_v2_pre_sms_campaign_20260908(uuid,text,uuid,integer,jsonb)
  from public, anon, authenticated;

create function public.crm_write_command_v2(
  p_request_id uuid,
  p_operation text,
  p_object_id uuid,
  p_expected_version integer,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_operation='contact_upsert' then
    if p_expected_version is distinct from 0 then raise exception 'invalid contact version sentinel' using errcode='22023'; end if;
    return crm_security.crm_contact_upsert_command_v1(p_request_id,p_object_id,p_payload);
  elsif p_operation='campaign_create' then
    if p_expected_version is distinct from 0 then raise exception 'invalid campaign version sentinel' using errcode='22023'; end if;
    return crm_security.crm_sms_campaign_create_command_v1(p_request_id,p_object_id,p_payload);
  end if;
  return crm_security.crm_write_command_v2_pre_sms_campaign_20260908(
    p_request_id,p_operation,p_object_id,p_expected_version,p_payload
  );
end $$;

revoke all on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) from public, anon;
grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;

alter function public.crm_operational_source_v1(text,uuid,integer) set schema crm_security;
alter function crm_security.crm_operational_source_v1(text,uuid,integer)
  rename to crm_operational_source_v1_pre_sms_campaign_20260908;
revoke all on function crm_security.crm_operational_source_v1_pre_sms_campaign_20260908(text,uuid,integer)
  from public, anon, authenticated;

create function public.crm_operational_source_v1(
  p_domain text,
  p_after uuid default null,
  p_limit integer default 100
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base jsonb;
  items jsonb;
  a record;
  next_cursor uuid;
  more boolean;
begin
  if p_limit not between 1 and 100 then raise exception 'invalid limit' using errcode='22023'; end if;
  if p_domain='campaign_core' then
    select * into a from crm_security.actor();
    if not found or a.permission_role<>'admin' then raise exception 'forbidden' using errcode='42501'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb),max(x.id),count(*)=p_limit
      into items,next_cursor,more
    from (
      select c.id,c.client_ref as campaign_id,c.category_key,c.category_label as category,c.category_group,
        c.template_key,c.body,c.status,c.scheduled_at,c.recipient_count,c.excluded_count,c.submitted_count,
        c.sent_count,c.failed_count,c.response_count,c.next_action_count,c.stage_advanced_count,c.won_count,
        c.created_by_name as created_by,c.created_at,c.updated_at
      from crm_security.sms_campaigns c
      where p_after is null or c.id>p_after order by c.id limit p_limit
    ) x;
    return jsonb_build_object('contract_version',1,'resource','operational_source','domain',p_domain,
      'scope_completeness','actor_authorized_rows_only','items',items,'pagination',jsonb_build_object(
        'completeness',case when more then 'partial' else 'complete' end,'has_more',more,
        'next_cursor',case when more then next_cursor::text else null end));
  end if;

  base:=crm_security.crm_operational_source_v1_pre_sms_campaign_20260908(p_domain,p_after,p_limit);
  if p_domain<>'deal_core' then return base; end if;
  select coalesce(jsonb_agg(item||jsonb_build_object('contacts',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',c.id,'person_key',c.person_key,'name',c.name,'role',coalesce(nullif(c.role,''),nullif(c.title,''),'담당자'),
      'phone',c.phone,'mobile',coalesce(c.mobile,c.phone),'current_site',c.current_site,
      'office_phone',ca.office_phone,'status',coalesce(ca.status,'current'),'started_at',ca.started_at,
      'sms_consent',c.sms_consent,'kakao_consent',c.kakao_consent,'consent_at',c.consent_at,
      'consent_source',c.consent_source,'opt_out_at',c.opt_out_at,'send_blocked',c.send_blocked,
      'send_blocked_reason',c.send_blocked_reason
    ) order by (c.id=d.contact_id or c.person_key=d.person_key) desc,c.name,c.id)
    from public.contacts c
    left join lateral(
      select x.office_phone,x.status,x.started_at from public.contact_assignments x
      where x.person_key=c.person_key and x.opportunity_id=d.id
      order by (x.ended_at is null) desc,x.started_at desc,x.id desc limit 1
    ) ca on true
    where c.id=d.contact_id or c.person_key=d.person_key or exists(
      select 1 from public.contact_assignments x where x.person_key=c.person_key and x.opportunity_id=d.id)
  ),'[]'::jsonb)) order by item->>'id'),'[]'::jsonb) into items
  from jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item
  join public.deals d on d.id=(item->>'id')::uuid;
  return jsonb_set(base,'{items}',items,true);
end $$;

revoke all on function public.crm_operational_source_v1(text,uuid,integer) from public, anon;
grant execute on function public.crm_operational_source_v1(text,uuid,integer) to authenticated;

do $$
begin
  if has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','execute')
     or not has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','execute')
     or has_function_privilege('authenticated','public.crm_sms_campaign_claim_batch(integer)','execute')
     or not has_function_privilege('service_role','public.crm_sms_campaign_claim_batch(integer)','execute') then
    raise exception 'sms campaign privilege postcondition failed';
  end if;
end $$;

commit;
