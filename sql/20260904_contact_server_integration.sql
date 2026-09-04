-- Existing Relate contacts -> CRM contact/workplace integration.
-- Idempotent: existing CRM contact values and active assignments are preserved.
begin;

with ranked as (
  select
    c.id,
    nullif(regexp_replace(coalesce(c.mobile, c.phone, ''), '\D', '', 'g'), '') as digits,
    count(*) over (
      partition by nullif(regexp_replace(coalesce(c.mobile, c.phone, ''), '\D', '', 'g'), '')
    ) as phone_count
  from public.contacts c
), prepared as (
  select
    r.id,
    o.name as site_name,
    case
      when r.digits is not null and r.phone_count = 1 then 'mobile:' || r.digits
      else 'contact:' || r.id::text
    end as person_key
  from ranked r
  join public.contacts c on c.id = r.id
  left join public.organizations o on o.id = c.organization_id
)
update public.contacts c
set
  person_key = coalesce(c.person_key, p.person_key),
  mobile = coalesce(c.mobile, c.phone),
  role = coalesce(c.role, nullif(c.title, ''), '관리소장'),
  current_site = coalesce(c.current_site, p.site_name),
  updated_at = now()
from prepared p
where c.id = p.id
  and c.person_key is null;

-- Only organizations with exactly one manager are auto-linked.
with one_manager as (
  select c.organization_id, max(c.id::text)::uuid as contact_id
  from public.contacts c
  where c.organization_id is not null
    and (
      coalesce(c.title, '') ilike '%관리소장%'
      or coalesce(c.role, '') ilike '%관리소장%'
    )
  group by c.organization_id
  having count(*) = 1
), src as (
  select
    d.id as deal_id,
    c.person_key,
    c.name,
    c.mobile,
    c.phone,
    c.role,
    o.name as site_name,
    coalesce(c.created_at, d.created_at, now())::date as started_at
  from one_manager x
  join public.contacts c on c.id = x.contact_id
  join public.organizations o on o.id = x.organization_id
  join public.deals d on d.organization_id = x.organization_id
)
update public.deals d
set
  manager_name = coalesce(d.manager_name, s.name),
  manager_mobile = coalesce(d.manager_mobile, s.mobile, s.phone),
  person_key = coalesce(d.person_key, s.person_key),
  manager_role = coalesce(d.manager_role, s.role, '관리소장'),
  manager_current_site = coalesce(d.manager_current_site, s.site_name),
  manager_started_at = coalesce(d.manager_started_at, s.started_at),
  manager_status = coalesce(d.manager_status, 'current'),
  updated_at = now()
from src s
where d.id = s.deal_id
  and d.manager_mobile is null;

with one_manager as (
  select c.organization_id, max(c.id::text)::uuid as contact_id
  from public.contacts c
  where c.organization_id is not null
    and (
      coalesce(c.title, '') ilike '%관리소장%'
      or coalesce(c.role, '') ilike '%관리소장%'
    )
  group by c.organization_id
  having count(*) = 1
), src as (
  select distinct on (c.person_key, o.name)
    c.person_key,
    d.id as deal_id,
    o.name as site_name,
    coalesce(c.created_at, d.created_at, now())::date as started_at
  from one_manager x
  join public.contacts c on c.id = x.contact_id
  join public.organizations o on o.id = x.organization_id
  join public.deals d on d.organization_id = x.organization_id
  where c.person_key is not null
  order by c.person_key, o.name, d.updated_at desc nulls last
)
insert into public.contact_assignments (
  person_key, opportunity_id, site_name, started_at, status, reason
)
select
  person_key,
  deal_id,
  site_name,
  started_at,
  'current',
  '기존 CRM 조직 연결 자동 이관'
from src
on conflict (person_key, site_name) where ended_at is null do nothing;

commit;

-- Preserve the established crm_bundle query and add only the contact fields.
do $$
declare
  fn text;
begin
  select pg_get_functiondef('public.crm_bundle()'::regprocedure) into fn;
  if position('''office_phone''' in fn) = 0 then
    fn := replace(
      fn,
      '''serviceHistory'', d.service_history',
      '''serviceHistory'', d.service_history,
       ''office_phone'', d.office_phone,
       ''office_email'', d.office_email,
       ''manager_name'', d.manager_name,
       ''manager_mobile'', d.manager_mobile,
       ''person_key'', d.person_key,
       ''manager_role'', d.manager_role,
       ''manager_current_site'', d.manager_current_site,
       ''manager_started_at'', d.manager_started_at,
       ''manager_status'', d.manager_status,
       ''manager_left_at'', d.manager_left_at'
    );
    execute fn;
  end if;
end
$$;

-- Verification: bundle size must stay unchanged; only contact fields are added.
with bundle as (select public.crm_bundle()::jsonb as body)
select
  jsonb_array_length(body -> 'deals') as bundle_deals,
  (
    select count(*)
    from jsonb_array_elements(body -> 'deals') deal
    where nullif(deal ->> 'manager_mobile', '') is not null
  ) as bundle_with_manager
from bundle;
