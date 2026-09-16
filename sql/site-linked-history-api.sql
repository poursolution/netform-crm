-- Candidate follow-up for a canonical Site detail. Admin-only and read-only.
create or replace function crm_security.site_linked_history_v1(p_site uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.sites s where s.site_id=p_site) then raise exception 'site not found' using errcode='P0002'; end if;
 select jsonb_build_object('contract_version',1,'site_id',p_site,'items',coalesce(jsonb_agg(jsonb_build_object('id',n.id,'organization_id',n.organization_id,'body',n.body,'actor',n.author_name,'occurred_at',coalesce(n.posted_at,n.created_at)) order by coalesce(n.posted_at,n.created_at),n.id),'[]'::jsonb)) into result
 from crm_security.site_identity_links l join public.notes n on n.organization_id=l.organization_id
 where l.site_id=p_site and l.resolution in ('linked','separate') and crm_security.can_read_legacy_note(n.deal_id,n.organization_id);
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
 select jsonb_build_object('contract_version',1,'items',coalesce(jsonb_agg(jsonb_build_object('site_id',s.site_id,'name',s.site_name,'address',s.address,'linked_organization_count',x.organization_count,'legacy_note_count',x.note_count,'last_at',x.last_at) order by s.site_name,s.site_id),'[]'::jsonb)) into result
 from public.sites s join (
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
