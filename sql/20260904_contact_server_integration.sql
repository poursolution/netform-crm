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

-- Multi-contact extension. The legacy manager_* columns remain the primary-contact
-- compatibility layer; every other site stakeholder is stored as a Contact.
begin;

-- Bring the customer name/phone already present in quotation inquiries into the
-- site directory. raw."담당자" is an internal sales rep and is intentionally ignored.
insert into public.contacts (organization_id, name, title, phone, mobile, role, person_key, current_site, created_at, updated_at)
select d.organization_id, trim(i.contact_name), '담당자', trim(i.phone), trim(i.phone), '담당자',
       'inquiry:' || i.id::text, coalesce(o.name, i.site_name), coalesce(i.received_at, now()), now()
from public.inquiries i
join public.deals d on d.id = i.deal_id
left join public.organizations o on o.id = d.organization_id
where nullif(trim(i.contact_name), '') is not null
  and length(regexp_replace(coalesce(i.phone,''), '\D', '', 'g')) >= 8
  and not exists (
    select 1 from public.contacts c
    where c.organization_id = d.organization_id
      and regexp_replace(coalesce(c.mobile,c.phone,''), '\D', '', 'g') = regexp_replace(i.phone, '\D', '', 'g')
  );

-- All existing organization contacts are valid site contacts. Multiple people at
-- the same apartment are expected and must not be collapsed to one manager.
with src as (
  select distinct on (c.person_key, o.name)
    c.person_key, d.id deal_id, o.name site_name,
    coalesce(c.created_at, d.created_at, now())::date started_at
  from public.contacts c
  join public.organizations o on o.id = c.organization_id
  join public.deals d on d.organization_id = c.organization_id
  where c.person_key is not null
  order by c.person_key, o.name, d.updated_at desc nulls last
)
insert into public.contact_assignments (person_key, opportunity_id, site_name, started_at, status, reason)
select person_key, deal_id, site_name, started_at, 'current', '현장 복수 연락처 연결'
from src
on conflict (person_key, site_name) where ended_at is null do nothing;

create or replace function public.crm_site_contacts(p_opportunity_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  with rows as (
    select jsonb_build_object(
      'id', c.id, 'person_key', c.person_key, 'name', c.name,
      'role', coalesce(nullif(c.role,''), nullif(c.title,''), '담당자'),
      'mobile', coalesce(c.mobile,c.phone), 'current_site', c.current_site,
      'office_phone', ca.office_phone, 'started_at', ca.started_at,
      'ended_at', ca.ended_at, 'status', coalesce(ca.status,'current')
    ) obj, case when coalesce(c.role,c.title)='관리소장' then 0 else 1 end ord, c.name
    from public.deals d
    join public.contacts c on c.organization_id = d.organization_id
    left join public.contact_assignments ca on ca.person_key=c.person_key and ca.ended_at is null
    where d.id=p_opportunity_id
  )
  select case when count(*) > 1 then jsonb_agg(obj order by ord,name) else '[]'::jsonb end from rows;
$$;

create or replace function public.crm_contact_upsert(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare k text; cid uuid; org uuid; primary_contact boolean;
begin
  k := coalesce(nullif(p->>'person_key',''), 'mobile:' || regexp_replace(coalesce(p->>'manager_mobile',''), '\D','','g'));
  select organization_id into org from public.deals where id=(p->>'opportunity_id')::uuid;
  update public.contacts set organization_id=coalesce(org,organization_id), name=p->>'manager_name',
    title=coalesce(p->>'manager_role','담당자'), phone=p->>'manager_mobile', mobile=p->>'manager_mobile',
    role=coalesce(p->>'manager_role','담당자'), current_site=p->>'site_name', updated_at=now()
  where person_key=k returning id into cid;
  if cid is null then
    insert into public.contacts (organization_id,name,title,phone,mobile,role,person_key,current_site,created_at,updated_at)
    values (org,p->>'manager_name',coalesce(p->>'manager_role','담당자'),p->>'manager_mobile',p->>'manager_mobile',coalesce(p->>'manager_role','담당자'),k,p->>'site_name',now(),now())
    returning id into cid;
  end if;
  insert into public.contact_assignments(person_key,opportunity_id,site_name,office_phone,started_at,status,reason)
  values(k,(p->>'opportunity_id')::uuid,p->>'site_name',p->>'office_phone',coalesce((p->>'started_at')::date,current_date),'current','CRM 연락처 저장')
  on conflict (person_key,site_name) where ended_at is null do update set office_phone=excluded.office_phone,status='current';
  primary_contact := coalesce((p->>'is_primary')::boolean,false) or coalesce(p->>'manager_role','')='관리소장';
  if primary_contact then
    update public.deals set office_phone=coalesce(nullif(p->>'office_phone',''),office_phone), office_email=coalesce(nullif(p->>'office_email',''),office_email),
      manager_name=p->>'manager_name',manager_mobile=p->>'manager_mobile',manager_role=p->>'manager_role',person_key=k,
      manager_current_site=p->>'site_name',manager_status='current',updated_at=now()
    where id=(p->>'opportunity_id')::uuid;
  end if;
  return jsonb_build_object('ok',true,'contact_id',cid,'person_key',k,'is_primary',primary_contact);
end $$;

do $$
declare fn text;
begin
  select pg_get_functiondef('public.crm_bundle()'::regprocedure) into fn;
  if position('''contacts''' in fn)=0 then
    fn := replace(fn, '''office_phone'', d.office_phone', '''contacts'', public.crm_site_contacts(d.id), ''office_phone'', d.office_phone');
    execute fn;
  end if;
end $$;

commit;

select count(*) as contacts, count(distinct organization_id) as sites_with_contacts from public.contacts;
select jsonb_array_length(public.crm_site_contacts(id)) as contact_count from public.deals order by contact_count desc limit 5;
