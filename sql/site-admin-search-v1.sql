-- Admin-only manual Site lookup for unresolved review rows. Read-only by design.
create or replace function crm_security.site_admin_search_v1(p_query text,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; q text:=pg_catalog.lower(pg_catalog.regexp_replace(coalesce(p_query,''),'[^0-9a-zA-Z가-힣]','','g')); page_size integer:=greatest(1,least(coalesce(p_limit,20),50));
begin
 if (select auth.uid()) is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 if pg_catalog.length(q)<2 then raise exception 'query too short' using errcode='22023'; end if;
 with matches as (
  select s.site_id,s.site_name,s.address,
   case when pg_catalog.lower(pg_catalog.regexp_replace(coalesce(s.site_name,''),'[^0-9a-zA-Z가-힣]','','g'))=q then 100
    when pg_catalog.lower(pg_catalog.regexp_replace(coalesce(s.site_name,''),'[^0-9a-zA-Z가-힣]','','g')) like '%'||q||'%' then 70
    when pg_catalog.lower(pg_catalog.regexp_replace(coalesce(s.address,''),'[^0-9a-zA-Z가-힣]','','g')) like '%'||q||'%' then 50 else 0 end score
  from public.sites s
 ), page as (select * from matches where score>0 order by score desc,site_name,site_id limit page_size)
 select jsonb_build_object('contract_version',1,'items',coalesce(jsonb_agg(jsonb_build_object('site_id',site_id,'name',site_name,'address',address,'match_score',score,'match_reason',case score when 100 then '이름 정확 일치' when 70 then '이름 검색 일치' else '주소 검색 일치' end) order by score desc,site_name,site_id),'[]'::jsonb)) into result from page;
 return result;
end $$;

revoke all on function crm_security.site_admin_search_v1(text,integer) from public,anon,authenticated;
grant execute on function crm_security.site_admin_search_v1(text,integer) to authenticated;
create or replace function public.crm_site_admin_search_v1(p_query text,p_limit integer default 20) returns jsonb language sql stable security invoker set search_path='' return crm_security.site_admin_search_v1(p_query,p_limit);
revoke all on function public.crm_site_admin_search_v1(text,integer) from public,anon,authenticated;
grant execute on function public.crm_site_admin_search_v1(text,integer) to authenticated;
