-- Prevent aggregate/placeholder labels from becoming permanent canonical Sites.
create or replace function crm_security.site_record_separate_name_allowed_v1(p_name text)
returns boolean language sql immutable security invoker set search_path='' return
 case when nullif(pg_catalog.btrim(coalesce(p_name,'')),'') is null then false
  when pg_catalog.btrim(p_name) ~ '^\[[^]]+\]$' then false
  when pg_catalog.lower(pg_catalog.regexp_replace(p_name,'[^0-9a-zA-Z가-힣]','','g')) in ('황윤선전체고객','아파트스퀘어','감리') then false
  when p_name ~ '지역미상.*문의[- ]*[0-9]+' then false
  else true end;

revoke all on function crm_security.site_record_separate_name_allowed_v1(text) from public,anon,authenticated;

create or replace function crm_security.site_record_link_review_resolve_v1(p_source_type text,p_source_id uuid,p_resolution text,p_site uuid default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=(select auth.uid()); chosen_site uuid; item_name text; item_address text; existing record;
begin
 if actor_id is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if p_source_type not in ('deal','inquiry') or p_resolution not in ('linked','separate') or (p_resolution='linked' and p_site is null) or (p_resolution='separate' and p_site is not null) then raise exception 'invalid resolution' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_type||':'||p_source_id::text,60917));
 select * into existing from crm_security.site_record_link_decisions x where x.source_type=p_source_type and x.source_id=p_source_id;
 if found then return jsonb_build_object('ok',true,'source_type',p_source_type,'source_id',p_source_id,'site_id',existing.site_id,'resolution',existing.resolution,'replayed',true); end if;
 if p_source_type='deal' then select coalesce(nullif(o.name,''),nullif(d.list_fields->>'name',''),nullif(d.list_name,'')),o.address into item_name,item_address from public.deals d left join public.organizations o on o.id=d.organization_id where d.id=p_source_id and d.site_id is null for update of d;
 else select nullif(q.site_name,''),q.address into item_name,item_address from public.inquiries q where q.id=p_source_id and q.site_id is null for update; end if;
 if not found or item_name is null then raise exception 'source not found or already linked' using errcode='P0002'; end if;
 if p_resolution='linked' then if not exists(select 1 from public.sites s where s.site_id=p_site) then raise exception 'site not found' using errcode='P0002'; end if; chosen_site:=p_site;
 else
  if not crm_security.site_record_separate_name_allowed_v1(item_name) then raise exception 'site name requires correction' using errcode='22023'; end if;
  chosen_site:=gen_random_uuid();insert into public.sites(site_id,site_name,norm_name,address) values(chosen_site,item_name,pg_catalog.lower(pg_catalog.regexp_replace(item_name,'[^0-9a-zA-Z가-힣]','','g')),item_address);
 end if;
 if p_source_type='deal' then update public.deals set site_id=chosen_site,updated_at=statement_timestamp() where id=p_source_id and site_id is null;
 else update public.inquiries set site_id=chosen_site,updated_at=statement_timestamp() where id=p_source_id and site_id is null; end if;
 if not found then raise exception 'source assignment race' using errcode='40001'; end if;
 insert into crm_security.site_record_link_decisions(source_type,source_id,site_id,resolution,reviewed_by) values(p_source_type,p_source_id,chosen_site,p_resolution,actor_id);
 return jsonb_build_object('ok',true,'source_type',p_source_type,'source_id',p_source_id,'site_id',chosen_site,'resolution',p_resolution,'replayed',false);
end $$;

revoke all on function crm_security.site_record_link_review_resolve_v1(text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function crm_security.site_record_link_review_resolve_v1(text,uuid,text,uuid) to authenticated;
