-- Candidate follow-up for a canonical Site detail. Admin-only and read-only.
create or replace function crm_security.site_linked_history_v1(p_site uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.sites s where s.site_id=p_site) then raise exception 'site not found' using errcode='P0002'; end if;
 select jsonb_build_object(
  'contract_version',4,
  'site_id',p_site,
  'items',coalesce((
   select jsonb_agg(jsonb_build_object('id',n.id,'organization_id',n.organization_id,'body',n.body,'actor',n.author_name,'occurred_at',coalesce(n.posted_at,n.created_at)) order by coalesce(n.posted_at,n.created_at),n.id)
   from crm_security.site_identity_links l join public.notes n on n.organization_id=l.organization_id
   where l.site_id=p_site and l.resolution in ('linked','separate') and crm_security.can_read_legacy_note(n.deal_id,n.organization_id)
  ),'[]'::jsonb),
  'contacts',coalesce((
   select jsonb_agg(jsonb_build_object('id',c.id,'organization_id',c.organization_id,'person_key',c.person_key,'name',c.name,'role',coalesce(c.role,c.title,'담당자'),'mobile',coalesce(c.mobile,c.phone),'current_site',c.current_site) order by c.name,c.id)
   from public.contacts c
   where exists(
    select 1 from crm_security.site_identity_links l
    where l.site_id=p_site and l.organization_id=c.organization_id and l.resolution in ('linked','separate')
   )
   and not exists(
    select 1 from public.contact_assignments ca join public.deals d on d.id=ca.opportunity_id
    where ca.person_key=c.person_key and d.site_id=p_site
   )
   and not exists(select 1 from public.deals d where d.contact_id=c.id and d.site_id=p_site)
  ),'[]'::jsonb),
  'organizations',coalesce((
   select jsonb_agg(jsonb_build_object('organization_id',o.id,'name',o.name,'address',o.address,'resolution',l.resolution,'reviewed_at',l.reviewed_at) order by o.name,o.id)
   from crm_security.site_identity_links l join public.organizations o on o.id=l.organization_id
   where l.site_id=p_site and l.resolution in ('linked','separate')
  ),'[]'::jsonb),
  'records',coalesce((
   select jsonb_agg(jsonb_build_object('source_type',d.source_type,'source_id',d.source_id,'name',case when d.source_type='deal' then coalesce(o.name,deal.list_name) else inquiry.site_name end,'address',case when d.source_type='deal' then o.address else inquiry.address end,'resolution',d.resolution,'reviewed_at',d.reviewed_at) order by d.reviewed_at,d.source_type,d.source_id)
   from crm_security.site_record_link_decisions d
   left join public.deals deal on d.source_type='deal' and deal.id=d.source_id
   left join public.organizations o on o.id=deal.organization_id
   left join public.inquiries inquiry on d.source_type='inquiry' and inquiry.id=d.source_id
   where d.site_id=p_site
  ),'[]'::jsonb),
  'corrections',coalesce((
   select jsonb_agg(jsonb_build_object('event_id',e.event_id,'target_type',e.target_type,'target_id',e.target_id,'previous_site_id',e.previous_site_id,'previous_site_name',old_site.site_name,'new_site_id',e.new_site_id,'new_site_name',new_site.site_name,'reason',e.reason,'changed_at',e.changed_at) order by e.changed_at desc,e.event_id)
   from crm_security.site_link_correction_events e
   join public.sites old_site on old_site.site_id=e.previous_site_id
   join public.sites new_site on new_site.site_id=e.new_site_id
   where e.previous_site_id=p_site or e.new_site_id=p_site
  ),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function crm_security.site_linked_history_v1(uuid) from public,anon,authenticated;grant execute on function crm_security.site_linked_history_v1(uuid) to authenticated;
create or replace function public.crm_site_linked_history_v1(p_site uuid) returns jsonb language sql stable security invoker set search_path='' return crm_security.site_linked_history_v1(p_site);
revoke all on function public.crm_site_linked_history_v1(uuid) from public,anon,authenticated;grant execute on function public.crm_site_linked_history_v1(uuid) to authenticated;

create or replace function crm_security.site_linked_assets_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 select jsonb_build_object('contract_version',2,'items',coalesce(jsonb_agg(jsonb_build_object('site_id',s.site_id,'name',s.site_name,'address',s.address,'linked_organization_count',coalesce(x.organization_count,0),'legacy_note_count',coalesce(x.note_count,0),'last_at',coalesce(x.last_at,s.created_at)) order by s.site_name,s.site_id),'[]'::jsonb)) into result
 from public.sites s left join (
  select l.site_id,count(distinct l.organization_id) organization_count,count(n.id) note_count,max(coalesce(n.posted_at,n.created_at)) last_at
  from crm_security.site_identity_links l
  left join public.notes n on n.organization_id=l.organization_id and crm_security.can_read_legacy_note(n.deal_id,n.organization_id)
  where l.resolution in ('linked','separate') group by l.site_id
 ) x on x.site_id=s.site_id;
 return result;
end $$;
revoke all on function crm_security.site_linked_assets_v1() from public,anon,authenticated;grant execute on function crm_security.site_linked_assets_v1() to authenticated;
create or replace function public.crm_site_linked_assets_v1() returns jsonb language sql stable security invoker set search_path='' return crm_security.site_linked_assets_v1();
revoke all on function public.crm_site_linked_assets_v1() from public,anon,authenticated;grant execute on function public.crm_site_linked_assets_v1() to authenticated;
