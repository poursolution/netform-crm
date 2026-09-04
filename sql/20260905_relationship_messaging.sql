-- CRM relationship messaging engine.
-- Run with the service-role migration account. The browser never writes these
-- tables directly; authenticated requests continue to pass through crm-write.
begin;

alter table public.contacts add column if not exists sms_consent boolean not null default false;
alter table public.contacts add column if not exists kakao_consent boolean not null default false;
alter table public.contacts add column if not exists consent_at timestamptz;
alter table public.contacts add column if not exists opt_out_at timestamptz;
alter table public.contacts add column if not exists send_blocked boolean not null default false;
alter table public.contacts add column if not exists send_blocked_reason text;

alter table public.deals add column if not exists last_meaningful_contact_at timestamptz;
alter table public.deals add column if not exists last_outbound_at timestamptz;
alter table public.deals add column if not exists outbound_attempts integer not null default 0;
alter table public.deals add column if not exists waiting_reason text;
alter table public.deals add column if not exists wake_up_at date;
alter table public.deals add column if not exists relationship_state text;
alter table public.deals add column if not exists last_customer_response_at timestamptz;
alter table public.deals add column if not exists relationship_hold_until date;

create table if not exists public.crm_message_logs (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.deals(id) on delete cascade,
  person_key text,
  channel text not null check (channel in ('sms','kakao')),
  sender text,
  recipient_phone text,
  template_key text,
  template_title text,
  template_kind text not null check (template_kind in ('info','promo','mixed')),
  template_grade text not null default 'suggested' check (template_grade in ('approved','suggested','custom')),
  purpose text check (purpose in ('관계 유지','공사 일정 확인','견적 후속','자료 제공','재활성','대기 종료','확장 영업','명절 인사')),
  body text not null,
  stage_code text,
  status text not null check (status in ('sent','failed','cancelled')),
  success boolean not null default false,
  sent_at timestamptz,
  failed_at timestamptz,
  response_at timestamptz,
  response_kind text,
  next_action_created boolean not null default false,
  stage_advanced_at timestamptz,
  resulting_stage_code text,
  created_at timestamptz not null default now(),
  write_id text unique
);

alter table public.crm_message_logs add column if not exists template_grade text not null default 'suggested';
alter table public.crm_message_logs add column if not exists purpose text;
alter table public.crm_message_logs add column if not exists response_at timestamptz;
alter table public.crm_message_logs add column if not exists response_kind text;
alter table public.crm_message_logs add column if not exists next_action_created boolean not null default false;
alter table public.crm_message_logs add column if not exists stage_advanced_at timestamptz;
alter table public.crm_message_logs add column if not exists resulting_stage_code text;

create index if not exists crm_message_logs_opportunity_created_idx
  on public.crm_message_logs(opportunity_id, created_at desc);
create index if not exists crm_message_logs_person_created_idx
  on public.crm_message_logs(person_key, created_at desc);

alter table public.crm_message_logs enable row level security;
revoke all on public.crm_message_logs from anon, authenticated;
grant select, insert, update on public.crm_message_logs to service_role;

create or replace function public.crm_contact_consent_upsert(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare k text; affected integer;
begin
  k := coalesce(
    nullif(p->>'person_key',''),
    'mobile:' || regexp_replace(coalesce(p->>'manager_mobile',''), '\D','','g')
  );
  if coalesce(p->>'send_blocked','false')::boolean
     and nullif(p->>'send_blocked_reason','') is null then
    raise exception 'send_blocked_reason is required when a contact is blocked';
  end if;
  update public.contacts
     set sms_consent = case when coalesce(p->>'send_blocked','false')::boolean then false else coalesce((p->>'sms_consent')::boolean,false) end,
         kakao_consent = case when coalesce(p->>'send_blocked','false')::boolean then false else coalesce((p->>'kakao_consent')::boolean,false) end,
         consent_at = nullif(p->>'consent_at','')::timestamptz,
         opt_out_at = nullif(p->>'opt_out_at','')::timestamptz,
         send_blocked = coalesce((p->>'send_blocked')::boolean,false),
         send_blocked_reason = nullif(p->>'send_blocked_reason',''),
         updated_at = now()
   where person_key = k;
  get diagnostics affected = row_count;
  return jsonb_build_object('ok', affected > 0, 'person_key', k, 'updated', affected);
end $$;

create or replace function public.crm_message_log(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare mid uuid; oid uuid; st text; ch text; kind text;
begin
  oid := (p->>'opportunity_id')::uuid;
  st := coalesce(nullif(p->>'status',''),'cancelled');
  ch := p->>'channel';
  kind := coalesce(nullif(p->>'template_kind',''),'info');
  if st not in ('sent','failed','cancelled') then raise exception 'invalid message status'; end if;
  if ch not in ('sms','kakao') then raise exception 'invalid message channel'; end if;
  if kind not in ('info','promo','mixed') then raise exception 'invalid template kind'; end if;
  insert into public.crm_message_logs (
    opportunity_id, person_key, channel, sender, recipient_phone,
    template_key, template_title, template_kind, template_grade, purpose, body, stage_code,
    status, success, next_action_created, sent_at, failed_at, write_id
  ) values (
    oid, nullif(p->>'person_key',''), ch, nullif(p->>'sender',''), nullif(p->>'recipient_phone',''),
    nullif(p->>'template_key',''), nullif(p->>'template_title',''), kind,
    case when coalesce(nullif(p->>'template_grade',''),'suggested') in ('approved','suggested','custom') then coalesce(nullif(p->>'template_grade',''),'suggested') else 'suggested' end,
    nullif(p->>'purpose',''), coalesce(p->>'body',''), nullif(p->>'stage_code',''),
    st, st='sent', coalesce((p->>'next_action_created')::boolean,false),
    case when st='sent' then coalesce(nullif(p->>'sent_at','')::timestamptz,now()) end,
    case when st='failed' then coalesce(nullif(p->>'failed_at','')::timestamptz,now()) end, nullif(p->>'write_id','')
  )
  on conflict (write_id) do update set status=excluded.status
  returning id into mid;
  if st='sent' then
    update public.deals
       set last_outbound_at=coalesce(nullif(p->>'sent_at','')::timestamptz,now()),
           outbound_attempts=coalesce(outbound_attempts,0)+1,
           updated_at=now()
     where id=oid;
  end if;
  return jsonb_build_object('ok',true,'message_id',mid,'status',st);
end $$;

-- 고객의 실제 회신·통화·미팅이 기록되면 무응답 횟수를 초기화하고,
-- 아직 보내지 않은 관계관리 예약은 발송 전 재검토 대상으로 돌린다.
create or replace function public.crm_relationship_response(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare oid uuid; k text; at timestamptz; mid uuid;
begin
  oid := (p->>'opportunity_id')::uuid;
  k := nullif(p->>'person_key','');
  at := coalesce(nullif(p->>'response_at','')::timestamptz,now());
  select id into mid
    from public.crm_message_logs
   where status='sent'
     and ((k is not null and person_key=k) or (k is null and opportunity_id=oid))
     and sent_at <= at and response_at is null
   order by sent_at desc nulls last, created_at desc limit 1;
  if mid is not null then
    update public.crm_message_logs
       set response_at=at, response_kind=nullif(p->>'response_kind','')
     where id=mid;
  end if;
  update public.deals
     set last_customer_response_at=at, last_meaningful_contact_at=at,
         outbound_attempts=0, relationship_state='active', updated_at=now()
   where id=oid;
  return jsonb_build_object('ok',true,'message_id',mid,'cadence_reset',true,'response_at',at);
end $$;

-- 메시지 이후 실제 Stage 전진을 가장 가까운 발송 이력에 귀속한다.
create or replace function public.crm_message_stage_advanced(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare oid uuid; mid uuid; at timestamptz;
begin
  oid := (p->>'opportunity_id')::uuid;
  at := coalesce(nullif(p->>'advanced_at','')::timestamptz,now());
  select id into mid from public.crm_message_logs
   where opportunity_id=oid and status='sent' and sent_at <= at
     and stage_advanced_at is null
   order by sent_at desc nulls last, created_at desc limit 1;
  if mid is not null then
    update public.crm_message_logs
       set stage_advanced_at=at, resulting_stage_code=nullif(p->>'to_stage','')
     where id=mid;
  end if;
  return jsonb_build_object('ok',true,'message_id',mid,'stage_advanced_at',at);
end $$;

create or replace function public.crm_relationship_hold(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare oid uuid; until_date date;
begin
  oid := (p->>'opportunity_id')::uuid;
  until_date := (p->>'hold_until')::date;
  if until_date <= current_date then raise exception 'hold_until must be in the future'; end if;
  update public.deals set relationship_hold_until=until_date, wake_up_at=until_date,
    waiting_reason=coalesce(nullif(p->>'reason',''),'관계관리 접촉 보류'),
    relationship_state='hold', updated_at=now() where id=oid;
  return jsonb_build_object('ok',true,'hold_until',until_date);
end $$;

-- 같은 사람에게 여러 영업기회가 있어도 CONTACT 기준으로 최근 30일을 합산한다.
create or replace function public.crm_contact_message_stats(p_person_key text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'sent30',count(*) filter (where status='sent' and sent_at>=now()-interval '30 days'),
    'sent',count(*) filter (where status='sent'),
    'responded',count(*) filter (where response_at is not null),
    'stageAdvanced',count(*) filter (where stage_advanced_at is not null)
  ) from public.crm_message_logs where person_key=p_person_key;
$$;

create or replace function public.crm_message_logs_json(p_opportunity_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'opportunity_id',opportunity_id,'person_key',person_key,'channel',channel,
    'template_key',template_key,'template_title',template_title,'template_kind',template_kind,
    'template_grade',template_grade,'purpose',purpose,'status',status,'success',success,
    'sent_at',sent_at,'response_at',response_at,'response_kind',response_kind,
    'next_action_created',next_action_created,'stage_advanced_at',stage_advanced_at,
    'resulting_stage_code',resulting_stage_code,'created_at',created_at
  ) order by created_at desc),'[]'::jsonb)
  from public.crm_message_logs where opportunity_id=p_opportunity_id;
$$;

-- Recreate the multi-contact bundle helper with consent fields. The primary
-- deal manager_* columns remain a compatibility layer only.
create or replace function public.crm_site_contacts(p_opportunity_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  with rows as (
    select jsonb_build_object(
      'id', c.id, 'person_key', c.person_key, 'name', c.name,
      'role', coalesce(nullif(c.role,''), nullif(c.title,''), '담당자'),
      'mobile', coalesce(c.mobile,c.phone), 'current_site', c.current_site,
      'office_phone', ca.office_phone, 'started_at', ca.started_at,
      'ended_at', ca.ended_at, 'status', coalesce(ca.status,'current'),
      'sms_consent', c.sms_consent, 'kakao_consent', c.kakao_consent,
      'consent_at', c.consent_at, 'opt_out_at', c.opt_out_at,
      'send_blocked', c.send_blocked, 'send_blocked_reason', c.send_blocked_reason
    ) obj, case when coalesce(c.role,c.title)='관리소장' then 0 else 1 end ord, c.name
    from public.deals d
    join public.contacts c on c.organization_id = d.organization_id
    left join public.contact_assignments ca on ca.person_key=c.person_key and ca.ended_at is null
    where d.id=p_opportunity_id
  )
  select case when count(*) > 0 then jsonb_agg(obj order by ord,name) else '[]'::jsonb end from rows;
$$;

-- Add relationship timestamps to crm_bundle without replacing the established query.
do $$
declare fn text;
begin
  select pg_get_functiondef('public.crm_bundle()'::regprocedure) into fn;
  if position('''lastMeaningfulContactAt''' in fn)=0 then
    fn := replace(
      fn,
      '''manager_left_at'', d.manager_left_at',
      '''manager_left_at'', d.manager_left_at,
       ''lastMeaningfulContactAt'', d.last_meaningful_contact_at,
       ''lastOutboundAt'', d.last_outbound_at,
       ''outboundAttempts'', d.outbound_attempts,
       ''waitingReason'', d.waiting_reason,
       ''wakeUpAt'', d.wake_up_at,
       ''relationshipState'', d.relationship_state'
    );
    execute fn;
  end if;
end $$;

-- 기존 crm_bundle 정의는 보존하고 관계 성과 배열만 딜 JSON에 추가한다.
do $$
declare fn text;
begin
  select pg_get_functiondef('public.crm_bundle()'::regprocedure) into fn;
  if position('''messageLogs''' in fn)=0 then
    fn := replace(
      fn,
      '''relationshipState'', d.relationship_state',
      '''relationshipState'', d.relationship_state,
       ''lastCustomerResponseAt'', d.last_customer_response_at,
       ''relationshipHoldUntil'', d.relationship_hold_until,
       ''messageLogs'', public.crm_message_logs_json(d.id)'
    );
    execute fn;
  end if;
end $$;

grant execute on function public.crm_contact_consent_upsert(jsonb) to service_role;
grant execute on function public.crm_message_log(jsonb) to service_role;
grant execute on function public.crm_relationship_response(jsonb) to service_role;
grant execute on function public.crm_message_stage_advanced(jsonb) to service_role;
grant execute on function public.crm_relationship_hold(jsonb) to service_role;
grant execute on function public.crm_contact_message_stats(text) to service_role;
grant execute on function public.crm_message_logs_json(uuid) to service_role;

commit;

select count(*) as message_logs from public.crm_message_logs;
select count(*) filter (where send_blocked) as blocked_contacts,
       count(*) filter (where sms_consent) as sms_consented,
       count(*) filter (where kakao_consent) as kakao_consented
from public.contacts;
