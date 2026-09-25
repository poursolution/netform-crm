-- Read existing verified contracts independently of operational Deal creation.
create or replace function public.crm_advisory_library_read_v1(p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from crm_security.actor()) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 with permitted as (
  select a.advisory_id,a.site_name,a.site_id,l.project_id,l.document_id,s.snapshot
  from public.advisory_deals a
  join crm_security.advisory_record_links l using(advisory_id)
  join crm_security.advisory_snapshots s on s.project_id=l.project_id
  where (p_after is null or a.advisory_id>p_after)
  and exists(select 1 from crm_security.actor() actor where actor.permission_role='admin'
    or exists(select 1 from crm_security.advisory_read_grants g
      where g.advisory_id=a.advisory_id and g.user_id=actor.user_id and g.expires_at>now()))
  order by a.advisory_id limit 51
 ), page as (select * from permitted order by advisory_id limit 50)
 select jsonb_build_object('ok',true,'items',coalesce((
   select jsonb_agg(jsonb_build_object('advisory_id',p.advisory_id,
    'site_name',p.site_name,'site_linked',p.site_id is not null,
    'contracts',coalesce((select jsonb_agg(c.value)
      from jsonb_array_elements(p.snapshot->'contracts') c
      where c.value->>'source_document_id'=p.document_id),'[]'::jsonb)) order by p.advisory_id)
   from page p),'[]'::jsonb),'next_cursor',case when (select count(*) from permitted)>50
     then (select advisory_id::text from page order by advisory_id desc limit 1) else null end)
 into result;
 return result;
end $$;
revoke all on function public.crm_advisory_library_read_v1(uuid) from public,anon;
grant execute on function public.crm_advisory_library_read_v1(uuid) to authenticated;
