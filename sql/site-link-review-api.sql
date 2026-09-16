-- Candidate only. Apply after staging verification; no production deployment is implied.
-- Human decisions are durable. Names and addresses only rank candidates and never link rows.

create table if not exists crm_security.site_identity_links (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  site_id uuid references public.sites(site_id) on delete restrict,
  resolution text not null check (resolution in ('linked','separate')),
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default statement_timestamp(),
  check (site_id is not null)
);
alter table crm_security.site_identity_links enable row level security;
revoke all on table crm_security.site_identity_links from public,anon,authenticated;
create index if not exists site_identity_links_site_id_idx on crm_security.site_identity_links(site_id) where site_id is not null;

create or replace function crm_security.site_link_review_list_v1(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; page_size integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
 if not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then
  raise exception 'forbidden' using errcode='42501';
 end if;
 with pending as (
  select o.id organization_id,o.name,o.address,
   (select count(*) from public.notes n where n.organization_id=o.id and crm_security.can_read_legacy_note(n.deal_id,n.organization_id)) note_count
  from public.organizations o
  where not exists(select 1 from public.deals d where d.organization_id=o.id)
   and exists(select 1 from public.notes n where n.organization_id=o.id and crm_security.can_read_legacy_note(n.deal_id,n.organization_id))
   and not exists(select 1 from crm_security.site_identity_links l where l.organization_id=o.id)
  order by o.name,o.id limit page_size
 ), candidates as (
  select p.*,coalesce(jsonb_agg(jsonb_build_object('site_id',s.site_id,'name',s.site_name,'address',s.address,
    'exact_address',nullif(lower(regexp_replace(coalesce(s.address,''),'[^0-9a-zA-Z가-힣]','','g')),'')=
      nullif(lower(regexp_replace(coalesce(p.address,''),'[^0-9a-zA-Z가-힣]','','g')),'')) order by s.site_id)
    filter(where s.site_id is not null),'[]'::jsonb) site_candidates
  from pending p left join public.sites s on
   nullif(lower(regexp_replace(coalesce(s.site_name,''),'[^0-9a-zA-Z가-힣]','','g')),'')=
   nullif(lower(regexp_replace(coalesce(p.name,''),'[^0-9a-zA-Z가-힣]','','g')),'')
  group by p.organization_id,p.name,p.address,p.note_count
 )
 select jsonb_build_object('contract_version',1,'items',coalesce(jsonb_agg(jsonb_build_object(
  'organization_id',organization_id,'name',name,'address',address,'note_count',note_count,
  'status',case when jsonb_array_length(site_candidates)=0 then 'separate_site_candidate'
   when jsonb_array_length(site_candidates)=1 then 'review_single_candidate' else 'review_multiple_candidates' end,
  'site_candidates',site_candidates) order by name,organization_id),'[]'::jsonb)) into result from candidates;
 return result;
end $$;

create or replace function crm_security.site_link_review_resolve_v1(p_organization uuid,p_resolution text,p_site uuid default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=(select auth.uid());
begin
 if actor_id is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_resolution not in ('linked','separate') or (p_resolution='linked')<>(p_site is not null) then
  raise exception 'invalid resolution' using errcode='22023';
 end if;
 if not exists(select 1 from public.organizations o where o.id=p_organization) then
  raise exception 'organization not found' using errcode='P0002';
 end if;
 if p_site is not null and not exists(select 1 from public.sites s where s.site_id=p_site) then
  raise exception 'site not found' using errcode='P0002';
 end if;
 insert into crm_security.site_identity_links(organization_id,site_id,resolution,reviewed_by,reviewed_at)
 values(p_organization,p_site,p_resolution,actor_id,statement_timestamp())
 on conflict(organization_id) do update set site_id=excluded.site_id,resolution=excluded.resolution,
  reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at;
 return jsonb_build_object('ok',true,'organization_id',p_organization,'site_id',p_site,'resolution',p_resolution);
end $$;

revoke all on function crm_security.site_link_review_list_v1(integer) from public,anon,authenticated;
revoke all on function crm_security.site_link_review_resolve_v1(uuid,text,uuid) from public,anon,authenticated;
grant execute on function crm_security.site_link_review_list_v1(integer) to authenticated;
grant execute on function crm_security.site_link_review_resolve_v1(uuid,text,uuid) to authenticated;

create or replace function public.crm_site_link_review_list_v1(p_limit integer default 50)
returns jsonb language sql stable security invoker set search_path=''
return crm_security.site_link_review_list_v1(p_limit);
create or replace function public.crm_site_link_review_resolve_v1(p_organization uuid,p_resolution text,p_site uuid default null)
returns jsonb language sql volatile security invoker set search_path=''
return crm_security.site_link_review_resolve_v1(p_organization,p_resolution,p_site);
revoke all on function public.crm_site_link_review_list_v1(integer) from public,anon,authenticated;
revoke all on function public.crm_site_link_review_resolve_v1(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.crm_site_link_review_list_v1(integer) to authenticated;
grant execute on function public.crm_site_link_review_resolve_v1(uuid,text,uuid) to authenticated;
