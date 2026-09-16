-- A reviewed "separate" decision creates a real canonical Site atomically.
drop index if exists public.uq_sites_norm;
create index if not exists sites_norm_name_idx on public.sites(norm_name);
alter table crm_security.site_identity_links drop constraint if exists site_identity_links_check;
alter table crm_security.site_identity_links drop constraint if exists site_identity_links_site_required_check;
alter table crm_security.site_identity_links add constraint site_identity_links_site_required_check check (site_id is not null);
create or replace function crm_security.site_link_review_resolve_v1(p_organization uuid,p_resolution text,p_site uuid default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=(select auth.uid()); chosen_site uuid; org record; existing record;
begin
 if actor_id is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if p_resolution not in ('linked','separate') or (p_resolution='linked' and p_site is null) or (p_resolution='separate' and p_site is not null) then raise exception 'invalid resolution' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization::text,60916));
 select * into existing from crm_security.site_identity_links l where l.organization_id=p_organization;
 if found then return jsonb_build_object('ok',true,'organization_id',p_organization,'site_id',existing.site_id,'resolution',existing.resolution,'replayed',true); end if;
 select o.id,o.name,o.address into org from public.organizations o where o.id=p_organization;if not found then raise exception 'organization not found' using errcode='P0002'; end if;
 if p_resolution='linked' then if not exists(select 1 from public.sites s where s.site_id=p_site) then raise exception 'site not found' using errcode='P0002'; end if;chosen_site:=p_site;
 else if nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(org.name,''),'[^0-9a-zA-Z가-힣]','','g')),'') is null then raise exception 'site name required' using errcode='22023'; end if;chosen_site:=gen_random_uuid();insert into public.sites(site_id,site_name,norm_name,address) values(chosen_site,org.name,pg_catalog.lower(pg_catalog.regexp_replace(org.name,'[^0-9a-zA-Z가-힣]','','g')),org.address);end if;
 insert into crm_security.site_identity_links(organization_id,site_id,resolution,reviewed_by,reviewed_at) values(p_organization,chosen_site,p_resolution,actor_id,statement_timestamp());
 return jsonb_build_object('ok',true,'organization_id',p_organization,'site_id',chosen_site,'resolution',p_resolution,'replayed',false);
end $$;
revoke all on function crm_security.site_link_review_resolve_v1(uuid,text,uuid) from public,anon,authenticated;grant execute on function crm_security.site_link_review_resolve_v1(uuid,text,uuid) to authenticated;
