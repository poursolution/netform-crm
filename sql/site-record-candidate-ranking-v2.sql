-- Read-only candidate ranking. Assignment remains exclusive to the reviewed resolve RPC.
create or replace function crm_security.site_record_link_review_list_v1(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; page_size integer:=greatest(1,least(coalesce(p_limit,100),200));
begin
 if (select auth.uid()) is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 with pending as (
  select 'deal'::text source_type,d.id source_id,coalesce(nullif(o.name,''),nullif(d.list_fields->>'name',''),nullif(d.list_name,'')) name,o.address,coalesce(d.updated_at,d.created_at) occurred_at
  from public.deals d left join public.organizations o on o.id=d.organization_id
  where d.site_id is null and coalesce(nullif(o.name,''),nullif(d.list_fields->>'name',''),nullif(d.list_name,'')) is not null
   and not exists(select 1 from crm_security.site_record_link_decisions x where x.source_type='deal' and x.source_id=d.id)
  union all
  select 'inquiry',q.id,nullif(q.site_name,''),q.address,coalesce(q.updated_at,q.created_at)
  from public.inquiries q where q.site_id is null and nullif(q.site_name,'') is not null
   and not exists(select 1 from crm_security.site_record_link_decisions x where x.source_type='inquiry' and x.source_id=q.id)
 ), limited as (
  select *,pg_catalog.lower(pg_catalog.regexp_replace(coalesce(name,''),'[^0-9a-zA-Z가-힣]','','g')) norm_name,
   nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(address,''),'[^0-9a-zA-Z가-힣]','','g')),'') norm_address
  from pending order by occurred_at desc nulls last,source_type,source_id limit page_size
 ), ranked as (
  select p.*,s.site_id,s.site_name,s.address site_address,
   case when s.norm_name=p.norm_name and s.norm_address is not distinct from p.norm_address and p.norm_address is not null then 150
    when s.norm_name=p.norm_name then 100 when s.norm_address=p.norm_address and p.norm_address is not null then 90
    when pg_catalog.least(pg_catalog.length(p.norm_name),pg_catalog.length(s.norm_name))>=7
     and pg_catalog.least(pg_catalog.length(p.norm_name),pg_catalog.length(s.norm_name))::numeric/pg_catalog.greatest(pg_catalog.length(p.norm_name),pg_catalog.length(s.norm_name))>=0.65
     and (s.norm_name like '%'||p.norm_name||'%' or p.norm_name like '%'||s.norm_name||'%') then 60 else 0 end match_score
  from limited p cross join lateral (
   select x.site_id,x.site_name,x.address,pg_catalog.lower(pg_catalog.regexp_replace(coalesce(x.site_name,''),'[^0-9a-zA-Z가-힣]','','g')) norm_name,
    nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(x.address,''),'[^0-9a-zA-Z가-힣]','','g')),'') norm_address from public.sites x
  ) s
 ), candidates as (
  select p.source_type,p.source_id,p.name,p.address,p.occurred_at,coalesce((select jsonb_agg(jsonb_build_object(
   'site_id',r.site_id,'name',r.site_name,'address',r.site_address,'exact_address',r.match_score in (90,150),'match_score',r.match_score,
   'match_reason',case r.match_score when 150 then '이름·주소 일치' when 100 then '이름 일치' when 90 then '주소 일치' else '이름 변형 후보' end)
   order by r.match_score desc,r.site_name,r.site_id) from (select z.* from ranked z where z.source_type=p.source_type and z.source_id=p.source_id and z.match_score>0 order by z.match_score desc,z.site_name,z.site_id limit 8) r),'[]'::jsonb) site_candidates
  from limited p
 )
 select jsonb_build_object('contract_version',2,'items',coalesce(jsonb_agg(jsonb_build_object(
  'source_type',source_type,'source_id',source_id,'name',name,'address',address,'occurred_at',occurred_at,
  'status',case when jsonb_array_length(site_candidates)=0 then 'separate_site_candidate' when jsonb_array_length(site_candidates)=1 then 'review_single_candidate' else 'review_multiple_candidates' end,
  'site_candidates',site_candidates) order by occurred_at desc nulls last,source_type,source_id),'[]'::jsonb)) into result from candidates;
 return result;
end $$;

revoke all on function crm_security.site_record_link_review_list_v1(integer) from public,anon,authenticated;
grant execute on function crm_security.site_record_link_review_list_v1(integer) to authenticated;
