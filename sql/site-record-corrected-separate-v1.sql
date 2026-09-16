-- Explicit corrected-name Site creation for placeholder review rows.
create or replace function crm_security.site_record_corrected_separate_v1(p_source_type text,p_source_id uuid,p_site_name text,p_address text default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=(select auth.uid()); chosen_site uuid:=gen_random_uuid(); clean_name text:=nullif(pg_catalog.btrim(p_site_name),''); existing record;
begin
 if actor_id is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if p_source_type not in ('deal','inquiry') or clean_name is null or not crm_security.site_record_separate_name_allowed_v1(clean_name) then raise exception 'invalid corrected site name' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_type||':'||p_source_id::text,60917));
 select * into existing from crm_security.site_record_link_decisions x where x.source_type=p_source_type and x.source_id=p_source_id;
 if found then return jsonb_build_object('ok',true,'source_type',p_source_type,'source_id',p_source_id,'site_id',existing.site_id,'resolution',existing.resolution,'replayed',true); end if;
 if p_source_type='deal' then perform 1 from public.deals d where d.id=p_source_id and d.site_id is null for update;
 else perform 1 from public.inquiries q where q.id=p_source_id and q.site_id is null for update; end if;
 if not found then raise exception 'source not found or already linked' using errcode='P0002'; end if;
 insert into public.sites(site_id,site_name,norm_name,address) values(chosen_site,clean_name,pg_catalog.lower(pg_catalog.regexp_replace(clean_name,'[^0-9a-zA-Z가-힣]','','g')),nullif(pg_catalog.btrim(p_address),''));
 if p_source_type='deal' then update public.deals set site_id=chosen_site,updated_at=statement_timestamp() where id=p_source_id and site_id is null;
 else update public.inquiries set site_id=chosen_site,updated_at=statement_timestamp() where id=p_source_id and site_id is null; end if;
 if not found then raise exception 'source assignment race' using errcode='40001'; end if;
 insert into crm_security.site_record_link_decisions(source_type,source_id,site_id,resolution,reviewed_by) values(p_source_type,p_source_id,chosen_site,'separate',actor_id);
 return jsonb_build_object('ok',true,'source_type',p_source_type,'source_id',p_source_id,'site_id',chosen_site,'resolution','separate','site_name',clean_name,'replayed',false);
end $$;

revoke all on function crm_security.site_record_corrected_separate_v1(text,uuid,text,text) from public,anon,authenticated;
grant execute on function crm_security.site_record_corrected_separate_v1(text,uuid,text,text) to authenticated;
create or replace function public.crm_site_record_corrected_separate_v1(p_source_type text,p_source_id uuid,p_site_name text,p_address text default null) returns jsonb language sql volatile security invoker set search_path='' return crm_security.site_record_corrected_separate_v1(p_source_type,p_source_id,p_site_name,p_address);
revoke all on function public.crm_site_record_corrected_separate_v1(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.crm_site_record_corrected_separate_v1(text,uuid,text,text) to authenticated;
