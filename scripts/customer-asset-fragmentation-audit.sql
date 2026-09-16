-- Customer Asset fragmentation audit (read-only).
-- Run with an administrator-owned, read-only database connection or in the
-- Supabase SQL editor. This statement returns one JSON document and performs
-- no DDL or DML.

begin transaction read only;
set local statement_timeout = '60s';
set local lock_timeout = '3s';

with
site_base as materialized (
  select
    s.site_id,
    s.site_name,
    nullif(lower(regexp_replace(coalesce(s.site_name, ''),
      '[^0-9a-zA-Z가-힣]', '', 'g')), '') as norm_name,
    nullif(lower(regexp_replace(coalesce(s.address, ''),
      '[^0-9a-zA-Z가-힣]', '', 'g')), '') as norm_address
  from public.sites s
),
organization_base as materialized (
  select
    o.id as organization_id,
    o.name,
    nullif(lower(regexp_replace(coalesce(o.name, ''),
      '[^0-9a-zA-Z가-힣]', '', 'g')), '') as norm_name,
    nullif(lower(regexp_replace(coalesce(o.address, ''),
      '[^0-9a-zA-Z가-힣]', '', 'g')), '') as norm_address
  from public.organizations o
),
deal_base as materialized (
  select
    d.id,
    d.site_id,
    d.organization_id,
    coalesce(s.site_name, o.name, nullif(d.list_fields->>'name', ''),
      nullif(d.list_name, '')) as display_name,
    nullif(lower(regexp_replace(coalesce(s.site_name, o.name,
      d.list_fields->>'name', d.list_name, ''),
      '[^0-9a-zA-Z가-힣]', '', 'g')), '') as norm_name
  from public.deals d
  left join site_base s on s.site_id = d.site_id
  left join organization_base o on o.organization_id = d.organization_id
),
inquiry_base as materialized (
  select
    q.id,
    q.site_id,
    q.site_name as display_name,
    nullif(lower(regexp_replace(coalesce(q.site_name, ''),
      '[^0-9a-zA-Z가-힣]', '', 'g')), '') as norm_name
  from public.inquiries q
),
organization_usage as materialized (
  select
    o.organization_id,
    count(distinct d.id) as deal_count,
    count(distinct c.id) as contact_count,
    count(distinct n.id) as note_count
  from organization_base o
  left join public.deals d on d.organization_id = o.organization_id
  left join public.contacts c on c.organization_id = o.organization_id
  left join public.notes n on n.organization_id = o.organization_id
  group by o.organization_id
),
orphan_candidates as materialized (
  select
    o.organization_id,
    o.name,
    o.norm_name,
    o.norm_address,
    u.contact_count,
    u.note_count,
    count(s.site_id) filter (where s.norm_name = o.norm_name) as name_candidate_count,
    count(s.site_id) filter (
      where s.norm_name = o.norm_name
        and o.norm_address is not null
        and s.norm_address = o.norm_address
    ) as exact_address_candidate_count,
    array_agg(s.site_id order by s.site_id)
      filter (where s.norm_name = o.norm_name) as candidate_site_ids
  from organization_base o
  join organization_usage u on u.organization_id = o.organization_id
  left join site_base s on s.norm_name = o.norm_name
  where u.deal_count = 0
    and u.note_count > 0
  group by o.organization_id, o.name, o.norm_name, o.norm_address,
    u.contact_count, u.note_count
),
fragment_sources as materialized (
  select 'site'::text as source_type, s.site_id::text as source_id,
    s.norm_name, 'site:' || s.site_id::text as fragment_key
  from site_base s where s.norm_name is not null
  union all
  select 'organization', o.organization_id::text, o.norm_name,
    'organization:' || o.organization_id::text
  from organization_base o where o.norm_name is not null
  union all
  select 'deal', d.id::text, d.norm_name,
    case
      when d.site_id is not null then 'site:' || d.site_id::text
      when d.organization_id is not null then 'organization:' || d.organization_id::text
      else 'unlinked-deal:' || d.id::text
    end
  from deal_base d where d.norm_name is not null
  union all
  select 'inquiry', q.id::text, q.norm_name,
    case when q.site_id is not null then 'site:' || q.site_id::text
      else 'unlinked-inquiry:' || q.id::text end
  from inquiry_base q where q.norm_name is not null
),
fragment_groups as materialized (
  select
    norm_name,
    count(distinct fragment_key) as fragment_count,
    count(*) filter (where source_type = 'site') as site_rows,
    count(*) filter (where source_type = 'organization') as organization_rows,
    count(*) filter (where source_type = 'deal') as deal_rows,
    count(*) filter (where source_type = 'inquiry') as inquiry_rows,
    count(*) filter (where fragment_key like 'unlinked-%') as unlinked_rows
  from fragment_sources
  group by norm_name
  having count(distinct fragment_key) > 1
),
source_gaps as (
  select 'deal_without_site_id'::text as gap,
    count(*)::bigint as row_count from deal_base where site_id is null
  union all
  select 'deal_organization_only', count(*)::bigint from deal_base
    where site_id is null and organization_id is not null
  union all
  select 'deal_without_site_or_organization', count(*)::bigint from deal_base
    where site_id is null and organization_id is null
  union all
  select 'inquiry_without_site_id', count(*)::bigint from inquiry_base
    where site_id is null
  union all
  select 'contact_organization_only', count(*)::bigint from public.contacts c
    where c.organization_id is not null
  union all
  select 'contact_assignment_without_site_reference', count(*)::bigint
    from public.contact_assignments ca
    left join deal_base d on d.id = ca.opportunity_id
    where d.site_id is null
),
candidate_status as (
  select
    case
      when exact_address_candidate_count = 1 then 'auto_candidate_exact_address'
      when name_candidate_count = 1 then 'review_single_name_candidate'
      when name_candidate_count > 1 then 'review_multiple_candidates'
      else 'separate_site_candidate'
    end as status,
    count(*)::bigint as organization_count,
    coalesce(sum(note_count), 0)::bigint as note_count,
    coalesce(sum(contact_count), 0)::bigint as contact_count
  from orphan_candidates
  group by 1
),
top_fragments as (
  select
    norm_name,
    fragment_count,
    site_rows,
    organization_rows,
    deal_rows,
    inquiry_rows,
    unlinked_rows
  from fragment_groups
  order by fragment_count desc, (deal_rows + inquiry_rows) desc, norm_name
  limit 200
)
select jsonb_build_object(
  'audit_version', '2026-09-16-v1',
  'generated_at', clock_timestamp(),
  'read_only', true,
  'summary', jsonb_build_object(
    'canonical_sites', (select count(*) from site_base),
    'organizations', (select count(*) from organization_base),
    'fragmented_normalized_names', (select count(*) from fragment_groups),
    'orphan_history_organizations', (select count(*) from orphan_candidates),
    'orphan_history_notes', (select coalesce(sum(note_count), 0) from orphan_candidates)
  ),
  'candidate_status', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.status) from candidate_status x
  ), '[]'::jsonb),
  'source_gaps', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.gap) from source_gaps x
  ), '[]'::jsonb),
  'top_fragmented_names', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.fragment_count desc,
      (x.deal_rows + x.inquiry_rows) desc, x.norm_name)
    from top_fragments x
  ), '[]'::jsonb)
) as customer_asset_fragmentation_audit;

rollback;
