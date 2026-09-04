-- CRM sales execution engine.
-- Adds customer relationship roles, quote versions, stage playbooks,
-- handover summaries and site coordinates used by the mobile route helper.
-- Apply with the service-role migration account. Browsers continue to write
-- only through the authenticated crm-write workflow.
begin;

alter table public.contacts
  add column if not exists decision_role text,
  add column if not exists relationship_tone text,
  add column if not exists influence_level text;

alter table public.contacts drop constraint if exists contacts_decision_role_check;
alter table public.contacts add constraint contacts_decision_role_check check (
  decision_role is null or decision_role in ('의사결정자','핵심담당자','실무자','영향자','정보제공자')
);
alter table public.contacts drop constraint if exists contacts_relationship_tone_check;
alter table public.contacts add constraint contacts_relationship_tone_check check (
  relationship_tone is null or relationship_tone in ('우호적','중립','부정적','미확인')
);

alter table public.deals
  add column if not exists stage_checklist jsonb not null default '{}'::jsonb;

alter table public.organizations
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7);

create table if not exists public.crm_quote_versions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.deals(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  amount numeric(18,2) not null check (amount > 0),
  reason text not null check (length(trim(reason)) >= 2),
  created_by text,
  created_at timestamptz not null default now(),
  write_id text unique,
  unique (opportunity_id, version_no)
);
create index if not exists crm_quote_versions_opportunity_idx
  on public.crm_quote_versions(opportunity_id, version_no);

create table if not exists public.crm_handover_summaries (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.deals(id) on delete cascade,
  from_owner text,
  to_owner text not null,
  reason text,
  summary jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  write_id text unique
);
create index if not exists crm_handover_opportunity_created_idx
  on public.crm_handover_summaries(opportunity_id, created_at desc);

alter table public.crm_quote_versions enable row level security;
alter table public.crm_handover_summaries enable row level security;
revoke all on public.crm_quote_versions, public.crm_handover_summaries from anon, authenticated;
grant select, insert, update on public.crm_quote_versions, public.crm_handover_summaries to service_role;

create or replace function public.crm_contact_relationship_upsert(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare k text; affected integer; dr text; rt text;
begin
  k := nullif(p->>'person_key','');
  dr := nullif(p->>'decision_role','');
  rt := nullif(p->>'relationship_tone','');
  if k is null then raise exception 'person_key is required'; end if;
  if dr is not null and dr not in ('의사결정자','핵심담당자','실무자','영향자','정보제공자') then
    raise exception 'invalid decision_role';
  end if;
  if rt is not null and rt not in ('우호적','중립','부정적','미확인') then
    raise exception 'invalid relationship_tone';
  end if;
  update public.contacts
     set decision_role=dr,
         relationship_tone=rt,
         influence_level=nullif(p->>'influence_level',''),
         updated_at=now()
   where person_key=k;
  get diagnostics affected=row_count;
  return jsonb_build_object('ok',affected>0,'person_key',k,'updated',affected);
end $$;

create or replace function public.crm_quote_version_add(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare oid uuid; n integer; qid uuid; amount_value numeric; reason_value text;
begin
  oid := (p->>'opportunity_id')::uuid;
  amount_value := (p->>'amount')::numeric;
  reason_value := trim(coalesce(p->>'reason',''));
  if amount_value <= 0 then raise exception 'amount must be greater than zero'; end if;
  if length(reason_value) < 2 then raise exception 'quote adjustment reason is required'; end if;
  perform 1 from public.deals where id=oid for update;
  -- The deal row lock serializes writers. The server owns the version number so
  -- a stale browser cannot overwrite or collide with a newer quote version.
  n := (select coalesce(max(version_no),0)+1
        from public.crm_quote_versions where opportunity_id=oid);
  insert into public.crm_quote_versions(
    opportunity_id,version_no,amount,reason,created_by,created_at,write_id
  ) values (
    oid,n,amount_value,reason_value,nullif(p->>'created_by',''),
    coalesce(nullif(p->>'created_at','')::timestamptz,now()),nullif(p->>'write_id','')
  ) on conflict (write_id) do update set amount=excluded.amount,reason=excluded.reason
  returning id into qid;
  update public.deals set quote_amount=amount_value,updated_at=now() where id=oid;
  return jsonb_build_object('ok',true,'quote_version_id',qid,'version_no',n,'amount',amount_value);
end $$;

create or replace function public.crm_stage_check_set(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare oid uuid; code text; idx text; checked_value boolean; current_value jsonb;
begin
  oid := (p->>'opportunity_id')::uuid;
  code := nullif(p->>'stage_code','');
  idx := nullif(p->>'item_index','');
  checked_value := coalesce((p->>'checked')::boolean,false);
  if code is null or idx is null then raise exception 'stage_code and item_index are required'; end if;
  select stage_checklist into current_value from public.deals where id=oid for update;
  if current_value is null then current_value := '{}'::jsonb; end if;
  if not (current_value ? code) then current_value := current_value || jsonb_build_object(code,'{}'::jsonb); end if;
  current_value := jsonb_set(current_value,array[code,idx],to_jsonb(checked_value),true);
  update public.deals set stage_checklist=current_value,updated_at=now() where id=oid;
  return jsonb_build_object('ok',true,'opportunity_id',oid,'stage_checklist',current_value);
end $$;

create or replace function public.crm_handover_add(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare hid uuid; oid uuid; summary_value jsonb;
begin
  oid := (p->>'opportunity_id')::uuid;
  summary_value := coalesce(p->'summary','{}'::jsonb);
  if jsonb_typeof(summary_value) <> 'object' then raise exception 'summary must be an object'; end if;
  insert into public.crm_handover_summaries(
    opportunity_id,from_owner,to_owner,reason,summary,created_by,created_at,write_id
  ) values (
    oid,nullif(p->>'from',''),coalesce(nullif(p->>'to',''),'미배정'),nullif(p->>'reason',''),summary_value,
    nullif(p->>'created_by',''),coalesce(nullif(p->>'created_at','')::timestamptz,now()),nullif(p->>'write_id','')
  ) on conflict (write_id) do update set summary=excluded.summary
  returning id into hid;
  return jsonb_build_object('ok',true,'handover_id',hid);
end $$;

-- Keep the established multi-contact helper and add relationship fields.
create or replace function public.crm_site_contacts(p_opportunity_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  with rows as (
    select jsonb_build_object(
      'id',c.id,'person_key',c.person_key,'name',c.name,
      'role',coalesce(nullif(c.role,''),nullif(c.title,''),'담당자'),
      'mobile',coalesce(c.mobile,c.phone),'current_site',c.current_site,
      'office_phone',ca.office_phone,'started_at',ca.started_at,
      'ended_at',ca.ended_at,'status',coalesce(ca.status,'current'),
      'sms_consent',c.sms_consent,'kakao_consent',c.kakao_consent,
      'consent_at',c.consent_at,'opt_out_at',c.opt_out_at,
      'send_blocked',c.send_blocked,'send_blocked_reason',c.send_blocked_reason,
      'decision_role',c.decision_role,'relationship_tone',c.relationship_tone,
      'influence_level',c.influence_level
    ) obj, case when coalesce(c.role,c.title)='관리소장' then 0 else 1 end ord, c.name
    from public.deals d
    join public.contacts c on c.organization_id=d.organization_id
    left join public.contact_assignments ca on ca.person_key=c.person_key and ca.ended_at is null
    where d.id=p_opportunity_id
  )
  select case when count(*)>0 then jsonb_agg(obj order by ord,name) else '[]'::jsonb end from rows;
$$;

-- Add execution fields to crm_bundle without replacing its established query.
do $$
declare fn text;
begin
  select pg_get_functiondef('public.crm_bundle()'::regprocedure) into fn;
  if position('''quoteVersions''' in fn)=0 then
    if position('''workSummary'', d.work_summary' in fn)=0 then
      raise exception 'crm_bundle anchor not found; review function before migration';
    end if;
    fn := replace(fn,
      '''workSummary'', d.work_summary',
      '''workSummary'', d.work_summary,
       ''stageChecklist'', d.stage_checklist,
       ''latitude'', (select o.latitude from public.organizations o where o.id=d.organization_id),
       ''longitude'', (select o.longitude from public.organizations o where o.id=d.organization_id),
       ''quoteVersions'', (select coalesce(jsonb_agg(jsonb_build_object(
          ''version_no'',q.version_no,''amount'',q.amount,''reason'',q.reason,
          ''created_by'',q.created_by,''created_at'',q.created_at) order by q.version_no),''[]''::jsonb)
          from public.crm_quote_versions q where q.opportunity_id=d.id),
       ''handoverSummaries'', (select coalesce(jsonb_agg(h.summary || jsonb_build_object(
          ''from'',h.from_owner,''to'',h.to_owner,''reason'',h.reason,''at'',h.created_at)
          order by h.created_at),''[]''::jsonb) from public.crm_handover_summaries h where h.opportunity_id=d.id)'
    );
    execute fn;
  end if;
end $$;

grant execute on function public.crm_contact_relationship_upsert(jsonb) to service_role;
grant execute on function public.crm_quote_version_add(jsonb) to service_role;
grant execute on function public.crm_stage_check_set(jsonb) to service_role;
grant execute on function public.crm_handover_add(jsonb) to service_role;

commit;

select count(*) as quote_versions from public.crm_quote_versions;
select count(*) as handovers from public.crm_handover_summaries;
select count(*) filter (where decision_role is not null) as relationship_classified from public.contacts;
