-- 기술자문 낙찰실적 확정 v1 (2026-09-25) — 원천 브랜드 귀속 · 낙찰확정일 · 낙찰금액(VAT 별도) 검증
-- 정책 정본: docs/advisory-track-handoff-20260925.md
-- 원본 public.advisory_deals 는 연동 동기화 대상이므로 수정하지 않는다. 사람의 확정값만 별도 보관한다.
-- advisory_id 1:1 보관이므로 같은 기술자문 건이 실적에 두 번 잡히지 않는다(중복 인식 금지).
-- 정식 실적 = decision='confirmed' 행의 bid_amount(VAT 별도) · 귀속일 bid_confirmed_at · 귀속 담당 performance_owner.
-- 원천 브랜드(origin_business)와 현재 사업(기술자문)은 절대 합치지 않는다.

create table if not exists crm_security.advisory_attribution (
 advisory_id uuid primary key,
 decision text not null check (decision in ('confirmed','hold','excluded')),
 origin_business text check (origin_business in ('석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어','POUR스토어','기술자문 직접영업','기타 브랜드')),
 source_deal_id uuid,
 performance_owner text check (performance_owner is null or length(performance_owner) between 1 and 40),
 bid_amount bigint check (bid_amount is null or bid_amount>0),
 bid_confirmed_at date,
 award_type text not null default 'bid' check (award_type in ('bid','private_contract')),
 evidence_level text check (evidence_level in ('document','admin_judgment')),
 source_type text not null default 'technical_advisory' check (source_type='technical_advisory'),
 site_id uuid,
 note text check (note is null or length(note)<=500),
 version integer not null default 1,
 decided_by uuid,
 decided_by_name text,
 decided_at timestamptz not null default now(),
 constraint advisory_attribution_confirmed_ck check (decision<>'confirmed' or (origin_business is not null and performance_owner is not null and bid_amount is not null and bid_confirmed_at is not null and evidence_level is not null)),
 constraint advisory_attribution_reason_ck check (decision='confirmed' or length(coalesce(note,''))>0)
);

create table if not exists crm_security.advisory_attribution_events (
 event_id bigserial primary key,
 advisory_id uuid not null,
 before_data jsonb,
 after_data jsonb not null,
 reason text,
 actor_user_id uuid,
 actor_name text,
 created_at timestamptz not null default now()
);

revoke all on table crm_security.advisory_attribution from public, anon, authenticated;
revoke all on table crm_security.advisory_attribution_events from public, anon, authenticated;

-- 현장명 비교 키(현장 미연결 건의 후보 추천용): 괄호·'아파트'·기호 제거
create or replace function crm_security.advisory_site_key(p text)
returns text language sql immutable set search_path='' as $k$
 select lower(regexp_replace(regexp_replace(coalesce(p,''),'\([^)]*\)','','g'),'아파트|[^0-9A-Za-z가-힣]','','gi'))
$k$;
revoke all on function crm_security.advisory_site_key(text) from public, anon, authenticated;

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

-- 확정·보류·제외 (관리자 전용 · expected_version 낙관적 잠금 · 확정 실적 변경은 정정 사유 필수 · 전 이력 보존)
create or replace function public.crm_advisory_attribution_decide_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; cur crm_security.advisory_attribution%rowtype; had boolean;
 v_id uuid; v_expected integer; v_decision text; v_origin text; v_source uuid; v_owner text;
 v_amount bigint; v_date date; v_site uuid; v_note text; v_reason text; v_version integer;
 v_award text; v_evidence text;
 before_j jsonb; after_j jsonb;
begin
 select * into a from crm_security.actor();
 if not found or a.permission_role<>'admin' then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 begin
  v_id:=(p->>'advisory_id')::uuid;
  v_expected:=(p->>'expected_version')::integer;
  v_source:=nullif(p->>'source_deal_id','')::uuid;
  v_site:=nullif(p->>'site_id','')::uuid;
  v_amount:=nullif(p->>'bid_amount','')::bigint;
  v_date:=nullif(p->>'bid_confirmed_at','')::date;
 exception when others then raise exception 'invalid payload' using errcode='22023'; end;
 v_decision:=p->>'decision';
 v_origin:=nullif(trim(p->>'origin_business'),'');
 v_owner:=nullif(trim(p->>'performance_owner'),'');
 v_note:=nullif(trim(p->>'note'),'');
 v_reason:=nullif(trim(p->>'reason'),'');
 v_award:=coalesce(nullif(p->>'award_type',''),'bid');
 v_evidence:=nullif(p->>'evidence_level','');
 if v_award not in ('bid','private_contract') or (v_evidence is not null and v_evidence not in ('document','admin_judgment')) then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 if v_id is null or v_expected is null or v_decision is null or v_decision not in ('confirmed','hold','excluded') then
  raise exception 'invalid payload' using errcode='22023';
 end if;
 if not exists(select 1 from public.advisory_deals d where d.advisory_id=v_id) then
  raise exception '기술자문 건을 찾을 수 없습니다' using errcode='22023';
 end if;
 if v_source is not null and not exists(select 1 from public.deals d where d.id=v_source) then
  raise exception '원천 영업건을 찾을 수 없습니다' using errcode='22023';
 end if;
 if v_site is not null and not exists(select 1 from public.sites s where s.site_id=v_site) then
  raise exception '현장을 찾을 수 없습니다' using errcode='22023';
 end if;
 if v_decision='confirmed' then
  if v_origin is null or v_owner is null or v_amount is null or v_amount<=0 or v_date is null or v_evidence is null then
   raise exception '확정에는 원천 브랜드·담당자·낙찰금액·낙찰확정일·근거 수준이 모두 필요합니다' using errcode='22023';
  end if;
  if v_date>current_date+1 or v_date<date '2015-01-01' then
   raise exception '낙찰확정일이 올바르지 않습니다' using errcode='22023';
  end if;
 elsif v_note is null then
  raise exception '보류·제외에는 사유가 필요합니다' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('advisory_attribution:'||v_id::text,0));
 select * into cur from crm_security.advisory_attribution t where t.advisory_id=v_id for update;
 had:=found;
 if (case when had then cur.version else 0 end)<>v_expected then
  raise exception 'VERSION_CONFLICT' using errcode='PT409';
 end if;
 if had and cur.decision='confirmed' and v_reason is null then
  raise exception '확정된 실적을 바꾸려면 정정 사유가 필요합니다' using errcode='22023';
 end if;
 before_j:=case when had then to_jsonb(cur) else null end;
 v_version:=case when had then cur.version+1 else 1 end;
 insert into crm_security.advisory_attribution(advisory_id,decision,origin_business,source_deal_id,performance_owner,
   bid_amount,bid_confirmed_at,award_type,evidence_level,site_id,note,version,decided_by,decided_by_name,decided_at)
 values(v_id,v_decision,v_origin,v_source,v_owner,v_amount,v_date,v_award,v_evidence,v_site,v_note,v_version,a.user_id,a.display_name,now())
 on conflict (advisory_id) do update set
   decision=excluded.decision, origin_business=excluded.origin_business, source_deal_id=excluded.source_deal_id,
   performance_owner=excluded.performance_owner, bid_amount=excluded.bid_amount, bid_confirmed_at=excluded.bid_confirmed_at,
   award_type=excluded.award_type, evidence_level=excluded.evidence_level,
   site_id=excluded.site_id, note=excluded.note, version=excluded.version,
   decided_by=excluded.decided_by, decided_by_name=excluded.decided_by_name, decided_at=excluded.decided_at;
 select to_jsonb(t) into after_j from crm_security.advisory_attribution t where t.advisory_id=v_id;
 insert into crm_security.advisory_attribution_events(advisory_id,before_data,after_data,reason,actor_user_id,actor_name)
 values(v_id,before_j,after_j,coalesce(v_reason,v_note),a.user_id,a.display_name);
 return jsonb_build_object('ok',true,'advisory_id',v_id,'decision',v_decision,'version',v_version,
   'attribution',after_j-'decided_by');
end $fn$;
revoke all on function public.crm_advisory_attribution_decide_v1(jsonb) from public, anon;
grant execute on function public.crm_advisory_attribution_decide_v1(jsonb) to authenticated;

-- 적용 확인: 전 건이 조회되고 아직 확정 0건이어야 한다
select (select count(*) from public.advisory_deals) as advisory_rows,
       (select count(*) from crm_security.advisory_attribution) as decided_rows,
       has_function_privilege('anon','public.crm_advisory_attribution_decide_v1(jsonb)','EXECUTE') as anon_can_decide;
