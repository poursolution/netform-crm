-- CRM 문자발송 Campaign Center
-- 선행: 20260905_relationship_messaging.sql
-- 적용: Supabase SQL Editor(service role) → n8n crm-write에 campaign_create / campaign_delivery 연결
-- 원칙: 브라우저의 요청은 queued/scheduled만 기록하고, 실제 발송 성공은 provider callback으로만 확정한다.

begin;

create table if not exists public.crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_ref text not null unique,
  channel text not null default 'sms' check (channel in ('sms','kakao')),
  category_key text not null,
  category_label text not null,
  category_group text not null,
  template_key text,
  body text not null,
  status text not null default 'queued'
    check (status in ('queued','scheduled','sending','sent','partial','failed','cancelled')),
  recipient_count integer not null default 0,
  excluded_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  response_count integer not null default 0,
  next_action_count integer not null default 0,
  stage_advanced_count integer not null default 0,
  won_count integer not null default 0,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.crm_campaigns(id) on delete cascade,
  opportunity_id uuid references public.deals(id) on delete set null,
  person_key text,
  recipient_phone text not null,
  site_name text,
  contact_name text,
  owner_name text,
  personalized_body text not null,
  status text not null default 'queued'
    check (status in ('queued','sending','sent','failed','cancelled','blocked')),
  exclusion_reason text,
  provider_message_id text,
  provider_response jsonb,
  sent_at timestamptz,
  failed_at timestamptz,
  response_at timestamptz,
  next_action_created boolean not null default false,
  stage_advanced_at timestamptz,
  won_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, recipient_phone)
);

create index if not exists crm_campaigns_status_schedule_idx
  on public.crm_campaigns(status, scheduled_at, created_at desc);
create index if not exists crm_campaign_recipients_campaign_status_idx
  on public.crm_campaign_recipients(campaign_id, status);
create index if not exists crm_campaign_recipients_person_idx
  on public.crm_campaign_recipients(person_key, created_at desc);

alter table public.crm_campaigns enable row level security;
alter table public.crm_campaign_recipients enable row level security;
revoke all on public.crm_campaigns from anon, authenticated;
revoke all on public.crm_campaign_recipients from anon, authenticated;
grant select, insert, update on public.crm_campaigns to service_role;
grant select, insert, update on public.crm_campaign_recipients to service_role;

create or replace function public.crm_campaign_create(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  campaign_uuid uuid;
  recipient jsonb;
  requested_status text;
  normalized_phone text;
  recipient_opportunity uuid;
  unique_count integer := 0;
begin
  requested_status := coalesce(nullif(p->>'status',''),'queued');
  if requested_status not in ('queued','scheduled') then
    raise exception 'campaign create status must be queued or scheduled';
  end if;
  if requested_status='scheduled' and nullif(p->>'scheduled_at','') is null then
    raise exception 'scheduled_at is required';
  end if;
  if jsonb_typeof(p->'recipients') is distinct from 'array' then
    raise exception 'recipients array is required';
  end if;

  insert into public.crm_campaigns (
    client_ref,channel,category_key,category_label,category_group,template_key,body,
    status,recipient_count,excluded_count,scheduled_at,created_by,created_at
  ) values (
    p->>'campaign_id',coalesce(nullif(p->>'channel',''),'sms'),p->>'category_key',
    p->>'category_label',p->>'category_group',nullif(p->>'template_key',''),
    coalesce(p->>'body',''),requested_status,0,coalesce((p->>'excluded_count')::integer,0),
    nullif(p->>'scheduled_at','')::timestamptz,coalesce(nullif(p->>'created_by',''),'CRM 사용자'),
    coalesce(nullif(p->>'created_at','')::timestamptz,now())
  ) on conflict (client_ref) do update set updated_at=now()
  returning id into campaign_uuid;

  for recipient in select value from jsonb_array_elements(p->'recipients') loop
    normalized_phone := regexp_replace(coalesce(recipient->>'phone',''), '\D','','g');
    if normalized_phone !~ '^010[0-9]{8}$' then
      continue;
    end if;
    recipient_opportunity := case
      when coalesce(recipient->>'opportunity_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (recipient->>'opportunity_id')::uuid
      else null
    end;
    insert into public.crm_campaign_recipients (
      campaign_id,opportunity_id,person_key,recipient_phone,site_name,contact_name,
      owner_name,personalized_body,status
    ) values (
      campaign_uuid,recipient_opportunity,
      nullif(recipient->>'person_key',''),normalized_phone,
      nullif(recipient->>'site_name',''),nullif(recipient->>'contact_name',''),
      nullif(recipient->>'owner',''),coalesce(recipient->>'personalized_body',''),'queued'
    ) on conflict (campaign_id,recipient_phone) do nothing;
  end loop;

  select count(*) into unique_count
  from public.crm_campaign_recipients where campaign_id=campaign_uuid;
  update public.crm_campaigns set recipient_count=unique_count,updated_at=now()
  where id=campaign_uuid;

  return jsonb_build_object('ok',true,'campaign_id',campaign_uuid,
    'client_ref',p->>'campaign_id','recipient_count',unique_count,'status',requested_status);
end $$;

-- 문자 공급자의 개별 성공/실패 콜백에서만 호출한다.
-- 성공 시 기존 crm_message_logs와 Activity를 함께 확정한다.
create or replace function public.crm_campaign_delivery(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  recipient_row public.crm_campaign_recipients;
  campaign_row public.crm_campaigns;
  delivery_status text;
  delivered_at timestamptz;
begin
  delivery_status := p->>'status';
  if delivery_status not in ('sent','failed') then
    raise exception 'delivery status must be sent or failed';
  end if;
  delivered_at := coalesce(nullif(p->>'occurred_at','')::timestamptz,now());

  select r.* into recipient_row
  from public.crm_campaign_recipients r
  join public.crm_campaigns c on c.id=r.campaign_id
  where c.client_ref=p->>'campaign_id'
    and r.recipient_phone=regexp_replace(coalesce(p->>'phone',''),'\D','','g')
  for update;
  if not found then raise exception 'campaign recipient not found'; end if;

  select * into campaign_row from public.crm_campaigns where id=recipient_row.campaign_id;
  update public.crm_campaign_recipients set
    status=delivery_status,
    provider_message_id=nullif(p->>'provider_message_id',''),
    provider_response=p->'provider_response',
    sent_at=case when delivery_status='sent' then delivered_at else sent_at end,
    failed_at=case when delivery_status='failed' then delivered_at else failed_at end,
    updated_at=now()
  where id=recipient_row.id;

  -- Provider 재시도 콜백이 와도 Activity는 최초 성공 때 한 번만 남긴다.
  if delivery_status='sent' and recipient_row.status<>'sent'
     and recipient_row.opportunity_id is not null then
    insert into public.crm_message_logs (
      opportunity_id,person_key,channel,sender,recipient_phone,template_key,
      template_title,template_kind,template_grade,purpose,body,stage_code,
      status,success,sent_at,write_id
    ) values (
      recipient_row.opportunity_id,recipient_row.person_key,campaign_row.channel,
      campaign_row.created_by,recipient_row.recipient_phone,campaign_row.template_key,
      campaign_row.category_label,
      case when campaign_row.category_group='운영알림' then 'info' else 'promo' end,
      'approved',
      case when campaign_row.category_group='운영알림' then '자료 제공'
           when campaign_row.category_group='재활성' then '재활성'
           when campaign_row.category_group='시즌·인사' then '명절 인사'
           else '관계 유지' end,
      recipient_row.personalized_body,
      (select stage_code from public.deals where id=recipient_row.opportunity_id),
      'sent',true,delivered_at,
      'campaign:'||campaign_row.client_ref||':'||recipient_row.recipient_phone
    ) on conflict (write_id) do nothing;

    insert into public.activities (deal_id,actor_name,type,detail,occurred_at)
    values (
      recipient_row.opportunity_id,campaign_row.created_by,'문자',
      jsonb_build_object('note','문자 일괄발송 · '||campaign_row.category_label,
        'result',recipient_row.personalized_body,'campaign_id',campaign_row.client_ref,
        'recipient_phone',recipient_row.recipient_phone),delivered_at
    );
  end if;

  update public.crm_campaigns c set
    sent_count=(select count(*) from public.crm_campaign_recipients r where r.campaign_id=c.id and r.status='sent'),
    failed_count=(select count(*) from public.crm_campaign_recipients r where r.campaign_id=c.id and r.status='failed'),
    status=case
      when (select count(*) from public.crm_campaign_recipients r where r.campaign_id=c.id and r.status in ('queued','sending'))>0 then 'sending'
      when (select count(*) from public.crm_campaign_recipients r where r.campaign_id=c.id and r.status='failed')>0
        and (select count(*) from public.crm_campaign_recipients r where r.campaign_id=c.id and r.status='sent')>0 then 'partial'
      when (select count(*) from public.crm_campaign_recipients r where r.campaign_id=c.id and r.status='failed')>0 then 'failed'
      else 'sent' end,
    completed_at=case when (select count(*) from public.crm_campaign_recipients r where r.campaign_id=c.id and r.status in ('queued','sending'))=0 then now() else null end,
    updated_at=now()
  where c.id=recipient_row.campaign_id;

  return jsonb_build_object('ok',true,'recipient_id',recipient_row.id,'status',delivery_status);
end $$;

create or replace function public.crm_campaigns_json()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'campaign_id',client_ref,'channel',channel,'category_key',category_key,
    'category',category_label,'category_group',category_group,'template_key',template_key,
    'status',status,'recipient_count',recipient_count,'excluded_count',excluded_count,
    'sent_count',sent_count,'failed_count',failed_count,'response_count',response_count,
    'next_action_count',next_action_count,'stage_advanced_count',stage_advanced_count,
    'won_count',won_count,'scheduled_at',scheduled_at,'created_by',created_by,
    'created_at',created_at,'completed_at',completed_at
  ) order by created_at desc),'[]'::jsonb)
  from public.crm_campaigns;
$$;

grant execute on function public.crm_campaign_create(jsonb) to service_role;
grant execute on function public.crm_campaign_delivery(jsonb) to service_role;
grant execute on function public.crm_campaigns_json() to service_role;

commit;
