-- Admin-reviewed canonical Site assignment for deals and inquiries missing site_id.
create table if not exists crm_security.site_record_link_decisions (
 source_type text not null check (source_type in ('deal','inquiry')),
 source_id uuid not null,
 site_id uuid not null references public.sites(site_id) on delete restrict,
 resolution text not null check (resolution in ('linked','separate')),
 reviewed_by uuid not null,
 reviewed_at timestamptz not null default statement_timestamp(),
 primary key(source_type,source_id)
);
alter table crm_security.site_record_link_decisions enable row level security;
revoke all on table crm_security.site_record_link_decisions from public,anon,authenticated;
create index if not exists site_record_link_decisions_site_idx on crm_security.site_record_link_decisions(site_id);

create or replace function crm_security.site_record_link_review_list_v1(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; page_size integer:=greatest(1,least(coalesce(p_limit,100),200));
begin
 if (select auth.uid()) is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 with pending as (
  select 'deal'::text source_type,d.id source_id,
   coalesce(nullif(o.name,''),nullif(d.list_fields->>'name',''),nullif(d.list_name,'')) name,
   o.address,coalesce(d.updated_at,d.created_at) occurred_at
  from public.deals d left join public.organizations o on o.id=d.organization_id
  where d.site_id is null and coalesce(nullif(o.name,''),nullif(d.list_fields->>'name',''),nullif(d.list_name,'')) is not null
   and not exists(select 1 from crm_security.site_record_link_decisions x where x.source_type='deal' and x.source_id=d.id)
  union all
  select 'inquiry',q.id,nullif(q.site_name,''),q.address,coalesce(q.updated_at,q.created_at)
  from public.inquiries q
  where q.site_id is null and nullif(q.site_name,'') is not null
   and not exists(select 1 from crm_security.site_record_link_decisions x where x.source_type='inquiry' and x.source_id=q.id)
 ), limited as (
  select * from pending order by occurred_at desc nulls last,source_type,source_id limit page_size
 ), candidates as (
  select p.*,coalesce(jsonb_agg(jsonb_build_object('site_id',s.site_id,'name',s.site_name,'address',s.address,
   'exact_address',nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(s.address,''),'[^0-9a-zA-Z가-힣]','','g')),'')=
    nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(p.address,''),'[^0-9a-zA-Z가-힣]','','g')),'')) order by s.site_id)
   filter(where s.site_id is not null),'[]'::jsonb) site_candidates
  from limited p left join public.sites s on
   nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(s.site_name,''),'[^0-9a-zA-Z가-힣]','','g')),'')=
   nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(p.name,''),'[^0-9a-zA-Z가-힣]','','g')),'')
  group by p.source_type,p.source_id,p.name,p.address,p.occurred_at
 )
 select jsonb_build_object('contract_version',1,'items',coalesce(jsonb_agg(jsonb_build_object(
  'source_type',source_type,'source_id',source_id,'name',name,'address',address,'occurred_at',occurred_at,
  'status',case when jsonb_array_length(site_candidates)=0 then 'separate_site_candidate' when jsonb_array_length(site_candidates)=1 then 'review_single_candidate' else 'review_multiple_candidates' end,
  'site_candidates',site_candidates) order by occurred_at desc nulls last,source_type,source_id),'[]'::jsonb)) into result from candidates;
 return result;
end $$;

create or replace function crm_security.site_record_link_review_resolve_v1(p_source_type text,p_source_id uuid,p_resolution text,p_site uuid default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=(select auth.uid()); chosen_site uuid; item_name text; item_address text; existing record;
begin
 if actor_id is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if p_source_type not in ('deal','inquiry') or p_resolution not in ('linked','separate') or (p_resolution='linked' and p_site is null) or (p_resolution='separate' and p_site is not null) then raise exception 'invalid resolution' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_type||':'||p_source_id::text,60917));
 select * into existing from crm_security.site_record_link_decisions x where x.source_type=p_source_type and x.source_id=p_source_id;
 if found then return jsonb_build_object('ok',true,'source_type',p_source_type,'source_id',p_source_id,'site_id',existing.site_id,'resolution',existing.resolution,'replayed',true); end if;
 if p_source_type='deal' then
  select coalesce(nullif(o.name,''),nullif(d.list_fields->>'name',''),nullif(d.list_name,'')),o.address into item_name,item_address
  from public.deals d left join public.organizations o on o.id=d.organization_id where d.id=p_source_id and d.site_id is null for update of d;
 else
  select nullif(q.site_name,''),q.address into item_name,item_address from public.inquiries q where q.id=p_source_id and q.site_id is null for update;
 end if;
 if not found or item_name is null then raise exception 'source not found or already linked' using errcode='P0002'; end if;
 if p_resolution='linked' then
  if not exists(select 1 from public.sites s where s.site_id=p_site) then raise exception 'site not found' using errcode='P0002'; end if; chosen_site:=p_site;
 else
  chosen_site:=gen_random_uuid();
  insert into public.sites(site_id,site_name,norm_name,address) values(chosen_site,item_name,pg_catalog.lower(pg_catalog.regexp_replace(item_name,'[^0-9a-zA-Z가-힣]','','g')),item_address);
 end if;
 if p_source_type='deal' then update public.deals set site_id=chosen_site,updated_at=statement_timestamp() where id=p_source_id and site_id is null;
 else update public.inquiries set site_id=chosen_site,updated_at=statement_timestamp() where id=p_source_id and site_id is null; end if;
 if not found then raise exception 'source assignment race' using errcode='40001'; end if;
 insert into crm_security.site_record_link_decisions(source_type,source_id,site_id,resolution,reviewed_by) values(p_source_type,p_source_id,chosen_site,p_resolution,actor_id);
 return jsonb_build_object('ok',true,'source_type',p_source_type,'source_id',p_source_id,'site_id',chosen_site,'resolution',p_resolution,'replayed',false);
end $$;

revoke all on function crm_security.site_record_link_review_list_v1(integer) from public,anon,authenticated;
revoke all on function crm_security.site_record_link_review_resolve_v1(text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function crm_security.site_record_link_review_list_v1(integer) to authenticated;
grant execute on function crm_security.site_record_link_review_resolve_v1(text,uuid,text,uuid) to authenticated;
create or replace function public.crm_site_record_link_review_list_v1(p_limit integer default 100) returns jsonb language sql stable security invoker set search_path='' return crm_security.site_record_link_review_list_v1(p_limit);
create or replace function public.crm_site_record_link_review_resolve_v1(p_source_type text,p_source_id uuid,p_resolution text,p_site uuid default null) returns jsonb language sql volatile security invoker set search_path='' return crm_security.site_record_link_review_resolve_v1(p_source_type,p_source_id,p_resolution,p_site);
revoke all on function public.crm_site_record_link_review_list_v1(integer) from public,anon,authenticated;
revoke all on function public.crm_site_record_link_review_resolve_v1(text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.crm_site_record_link_review_list_v1(integer) to authenticated;
grant execute on function public.crm_site_record_link_review_resolve_v1(text,uuid,text,uuid) to authenticated;
