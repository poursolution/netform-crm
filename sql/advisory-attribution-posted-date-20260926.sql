-- 기술자문 확정 창: 잔디 글 날짜(posted_date) 함께 조회 (2026-09-26) — 읽기 함수 교체만, 데이터 변경 없음
-- 운영 적용: Supabase SQL 편집기에서 Run. 되돌리기: sql/advisory-attribution-v1.sql 이전 판의 같은 함수 블록
-- 조회: 기술자문 전 건 + 원천 브랜드 후보(같은 현장의 CRM 영업 이력) + 현장 후보 + 확정값
create or replace function public.crm_advisory_attribution_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
begin
 if not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then
  raise exception 'forbidden' using errcode='42501';
 end if;
 return jsonb_build_object('ok',true,'contract_version',1,'rows',coalesce((
  select jsonb_agg(q.j order by q.is_jandi, q.sn)
  from (
   select (coalesce(ad.origin_channel,'')='jandi') as is_jandi, coalesce(ad.site_name,'') as sn,
    jsonb_build_object(
     'advisory_id',ad.advisory_id,
     'channel',case when ad.origin_channel='jandi' then 'jandi' else 'legacy' end,
     'site_name',ad.site_name,'work_name',ad.work_name,'contractor',ad.contractor,
     'owner_name',nullif(ad.owner_name,''),'owner_kind',ad.owner_kind,
     'bid_amount',nullif(ad.bid_amount,0),'contract_date',ad.contract_date,'status',ad.status,
     -- 잔디(기술자문컨설팅) 글 날짜: source_row 앞 6자리 YYMMDD (2026-09-26 — 계약일 칸이 비어 확정 창이 날짜를 못 채우던 것)
     'posted_date',case when ad.origin_channel='jandi' and ad.source_row::text ~ '^[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{3}$' then
       make_date(2000+substr(ad.source_row::text,1,2)::int,substr(ad.source_row::text,3,2)::int,1)
       +(least(substr(ad.source_row::text,5,2)::int,extract(day from make_date(2000+substr(ad.source_row::text,1,2)::int,substr(ad.source_row::text,3,2)::int,1)+interval '1 month -1 day')::int)-1) end,
     'site_id',coalesce(att.site_id,ad.site_id),
     'site_linked',case when ad.site_id is not null then 'source' when att.site_id is not null then 'confirmed' else null end,
     'candidates',coalesce((
       select jsonb_agg(jsonb_build_object('brand',c.b,'deal_id',c.id,'owner',c.assignee_name,'opened',c.opened,
               'outcome',c.outcome,'lifecycle',c.lifecycle_status,'deals',c.n,'has_contract',c.has_contract) order by c.opened)
       from (
        select distinct on (x.b) x.b, x.id, x.assignee_name, x.opened, x.outcome, x.lifecycle_status, x.n,
               exists(select 1 from crm_security.contract_sales cs where cs.deal_id=x.id) as has_contract
        from (
         select coalesce(nullif(d.origin_business,''),nullif(d.brand,'')) as b, d.id, d.assignee_name,
                coalesce(d.opened_at,d.created_at) as opened, d.outcome, d.lifecycle_status,
                count(*) over (partition by coalesce(nullif(d.origin_business,''),nullif(d.brand,''))) as n
         from public.deals d
         where d.site_id=coalesce(att.site_id,ad.site_id)
        ) x
        where x.b is not null and x.b<>'기술자문'
        order by x.b, x.opened
       ) c),'[]'::jsonb),
     'untyped_history',(select count(*) from public.deals d where d.site_id=coalesce(att.site_id,ad.site_id)
                         and coalesce(nullif(d.origin_business,''),nullif(d.brand,'')) is null),
     'site_candidates',case when coalesce(att.site_id,ad.site_id) is null then coalesce((
       select jsonb_agg(jsonb_build_object('site_id',s2.site_id,'site_name',s2.site_name,'address',s2.address))
       from (
        select s.site_id, s.site_name, s.address
        from public.sites s
        where length(crm_security.advisory_site_key(ad.site_name))>=3
          and (crm_security.advisory_site_key(s.site_name)=crm_security.advisory_site_key(ad.site_name)
           or (least(length(crm_security.advisory_site_key(s.site_name)),length(crm_security.advisory_site_key(ad.site_name)))>=4
               and (strpos(crm_security.advisory_site_key(s.site_name),crm_security.advisory_site_key(ad.site_name))>0
                 or strpos(crm_security.advisory_site_key(ad.site_name),crm_security.advisory_site_key(s.site_name))>0)))
        order by (crm_security.advisory_site_key(s.site_name)=crm_security.advisory_site_key(ad.site_name)) desc, s.site_name
        limit 3
       ) s2),'[]'::jsonb) else '[]'::jsonb end,
     'attribution',case when att.advisory_id is null then null else jsonb_build_object(
       'decision',att.decision,'origin_business',att.origin_business,'source_deal_id',att.source_deal_id,
       'performance_owner',att.performance_owner,'bid_amount',att.bid_amount,'bid_confirmed_at',att.bid_confirmed_at,
       'award_type',att.award_type,'evidence_level',att.evidence_level,'source_type',att.source_type,
       'site_id',att.site_id,'note',att.note,'version',att.version,'decided_at',att.decided_at,'decided_by_name',att.decided_by_name) end
    ) as j
   from public.advisory_deals ad
   left join crm_security.advisory_attribution att on att.advisory_id=ad.advisory_id
  ) q),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_advisory_attribution_v1() from public, anon;
grant execute on function public.crm_advisory_attribution_v1() to authenticated;
