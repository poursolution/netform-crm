-- Include orphan organizations that carry contacts even when they have no legacy note.
-- Candidate names and addresses remain review hints only; no row is auto-linked.
create or replace function crm_security.site_link_review_list_v1(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; page_size integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
 if (select auth.uid()) is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
 with pending as (
  select o.id organization_id,o.name,o.address,
   (select count(*) from public.notes n where n.organization_id=o.id and crm_security.can_read_legacy_note(n.deal_id,n.organization_id)) note_count,
   (select count(*) from public.contacts c where c.organization_id=o.id) contact_count,
   coalesce((select jsonb_agg(jsonb_build_object('name',x.name,'role',coalesce(x.role,x.title,'담당자')) order by x.name,x.id)
    from (select c.id,c.name,c.role,c.title from public.contacts c where c.organization_id=o.id order by c.name,c.id limit 3) x),'[]'::jsonb) contact_preview,
   pg_catalog.lower(pg_catalog.regexp_replace(coalesce(o.name,''),'[^0-9a-zA-Z가-힣]','','g')) norm_name,
   nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(o.address,''),'[^0-9a-zA-Z가-힣]','','g')),'') norm_address
  from public.organizations o where not exists(select 1 from public.deals d where d.organization_id=o.id)
   and (exists(select 1 from public.notes n where n.organization_id=o.id and crm_security.can_read_legacy_note(n.deal_id,n.organization_id))
    or exists(select 1 from public.contacts c where c.organization_id=o.id))
   and not exists(select 1 from crm_security.site_identity_links l where l.organization_id=o.id)
  order by o.name,o.id limit page_size
 ), ranked as (
  select p.*,s.site_id,s.site_name,s.address site_address,
   case when s.norm_name=p.norm_name and s.norm_address is not distinct from p.norm_address and p.norm_address is not null then 150
    when s.norm_name=p.norm_name then 100 when s.norm_address=p.norm_address and p.norm_address is not null then 90
    when least(pg_catalog.length(p.norm_name),pg_catalog.length(s.norm_name))>=7
     and least(pg_catalog.length(p.norm_name),pg_catalog.length(s.norm_name))::numeric/greatest(pg_catalog.length(p.norm_name),pg_catalog.length(s.norm_name))>=0.65
     and (s.norm_name like '%'||p.norm_name||'%' or p.norm_name like '%'||s.norm_name||'%') then 60 else 0 end match_score
  from pending p cross join lateral (select x.site_id,x.site_name,x.address,
   pg_catalog.lower(pg_catalog.regexp_replace(coalesce(x.site_name,''),'[^0-9a-zA-Z가-힣]','','g')) norm_name,
   nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(x.address,''),'[^0-9a-zA-Z가-힣]','','g')),'') norm_address from public.sites x) s
 ), candidates as (
  select p.organization_id,p.name,p.address,p.note_count,p.contact_count,p.contact_preview,coalesce((select jsonb_agg(jsonb_build_object(
   'site_id',r.site_id,'name',r.site_name,'address',r.site_address,'exact_address',r.match_score in (90,150),'match_score',r.match_score,
   'match_reason',case r.match_score when 150 then '이름·주소 일치' when 100 then '이름 일치' when 90 then '주소 일치' else '이름 변형 후보' end)
   order by r.match_score desc,r.site_name,r.site_id) from (select z.* from ranked z where z.organization_id=p.organization_id and z.match_score>0 order by z.match_score desc,z.site_name,z.site_id limit 8) r),'[]'::jsonb) site_candidates
  from pending p
 )
 select jsonb_build_object('contract_version',3,'items',coalesce(jsonb_agg(jsonb_build_object(
  'organization_id',organization_id,'name',name,'address',address,'note_count',note_count,'contact_count',contact_count,'contact_preview',contact_preview,
  'status',case when jsonb_array_length(site_candidates)=0 then 'separate_site_candidate' when jsonb_array_length(site_candidates)=1 then 'review_single_candidate' else 'review_multiple_candidates' end,
  'site_candidates',site_candidates) order by name,organization_id),'[]'::jsonb)) into result from candidates;
 return result;
end $$;

revoke all on function crm_security.site_link_review_list_v1(integer) from public,anon,authenticated;
grant execute on function crm_security.site_link_review_list_v1(integer) to authenticated;
