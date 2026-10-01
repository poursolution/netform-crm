-- 과거자료 연결 검토 목록 — 서버 오류 500 수정 (2026-10-01 컨설턴트 P0-5)
-- 원인(운영 실측): authenticated 역할 statement_timeout=8s. 운영에 깔린 v3 본문은 ranked CTE(후보 조직 × 현장 1,129개, 정규식 4회)를
-- 조직마다 다시 계산해(CTE가 한 번만 참조돼 인라인됨) 수천만 번 정규식을 돌려 8초를 넘겼다 → 57014 → PostgREST 500.
-- 수정: pending·site_norm·ranked를 materialized로 한 번만 계산하고, 현장 정규화는 sites.norm_name을 쓴다. 관리자만 부르므로
-- 메모 수는 바로 센다(can_read_legacy_note는 관리자에게 항상 true). 응답 모양·contract_version 3·권한은 그대로.

create or replace function crm_security.site_link_review_list_v1(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare result jsonb; page_size integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
 if (select auth.uid()) is null or not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then
  raise exception 'forbidden' using errcode='42501';
 end if;
 with pending as materialized (
  select o.id organization_id,o.name,o.address,
   (select count(*) from public.notes n where n.organization_id=o.id) note_count,
   (select count(*) from public.contacts c where c.organization_id=o.id) contact_count,
   coalesce((select jsonb_agg(jsonb_build_object('name',x.name,'role',coalesce(x.role,x.title,'담당자')) order by x.name,x.id)
     from (select c.id,c.name,c.role,c.title from public.contacts c where c.organization_id=o.id order by c.name,c.id limit 3) x),'[]'::jsonb) contact_preview,
   pg_catalog.lower(pg_catalog.regexp_replace(coalesce(o.name,''),'[^0-9a-zA-Z가-힣]','','g')) norm_name,
   nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(o.address,''),'[^0-9a-zA-Z가-힣]','','g')),'') norm_address
  from public.organizations o
  where not exists(select 1 from public.deals d where d.organization_id=o.id)
   and (exists(select 1 from public.notes n where n.organization_id=o.id) or exists(select 1 from public.contacts c where c.organization_id=o.id))
   and not exists(select 1 from crm_security.site_identity_links l where l.organization_id=o.id)
  order by o.name,o.id limit page_size
 ), site_norm as materialized (
  select x.site_id,x.site_name,x.address,
   coalesce(nullif(x.norm_name,''),pg_catalog.lower(pg_catalog.regexp_replace(coalesce(x.site_name,''),'[^0-9a-zA-Z가-힣]','','g'))) norm_name,
   nullif(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(x.address,''),'[^0-9a-zA-Z가-힣]','','g')),'') norm_address
  from public.sites x
 ), ranked as materialized (
  select * from (
   select p.organization_id,s.site_id,s.site_name,s.address site_address,
    case when s.norm_name=p.norm_name and s.norm_address is not distinct from p.norm_address and p.norm_address is not null then 150
         when s.norm_name=p.norm_name then 100
         when s.norm_address=p.norm_address and p.norm_address is not null then 90
         when least(pg_catalog.length(p.norm_name),pg_catalog.length(s.norm_name))>=7
          and least(pg_catalog.length(p.norm_name),pg_catalog.length(s.norm_name))::numeric/greatest(pg_catalog.length(p.norm_name),pg_catalog.length(s.norm_name))>=0.65
          and (s.norm_name like '%'||p.norm_name||'%' or p.norm_name like '%'||s.norm_name||'%') then 60
         else 0 end match_score
   from pending p cross join site_norm s
  ) z where z.match_score>0
 ), top8 as (
  select r.*,row_number() over (partition by r.organization_id order by r.match_score desc,r.site_name,r.site_id) rn from ranked r
 ), cand_agg as (
  select t.organization_id,jsonb_agg(jsonb_build_object(
     'site_id',t.site_id,'name',t.site_name,'address',t.site_address,'exact_address',t.match_score in (90,150),'match_score',t.match_score,
     'match_reason',case t.match_score when 150 then '이름·주소 일치' when 100 then '이름 일치' when 90 then '주소 일치' else '이름 변형 후보' end)
     order by t.match_score desc,t.site_name,t.site_id) site_candidates
  from top8 t where t.rn<=8 group by t.organization_id
 ), candidates as (
  select p.organization_id,p.name,p.address,p.note_count,p.contact_count,p.contact_preview,coalesce(a.site_candidates,'[]'::jsonb) site_candidates
  from pending p left join cand_agg a on a.organization_id=p.organization_id
 )
 select jsonb_build_object('contract_version',3,'items',coalesce(jsonb_agg(jsonb_build_object(
  'organization_id',organization_id,'name',name,'address',address,'note_count',note_count,'contact_count',contact_count,'contact_preview',contact_preview,
  'status',case when jsonb_array_length(site_candidates)=0 then 'separate_site_candidate'
   when jsonb_array_length(site_candidates)=1 then 'review_single_candidate' else 'review_multiple_candidates' end,
  'site_candidates',site_candidates) order by name,organization_id),'[]'::jsonb)) into result from candidates;
 return result;
end $function$;

-- 확인(관리자 로그인 없이는 forbidden이 정상): 설치만 확인
select proname, prosrc like '%as materialized%' as fast from pg_proc where proname='site_link_review_list_v1';
