-- 수주 유형 v1 (2026-10-04 · design_handoff_rules 2-1 · 수주 처리 · 수주유형.dc.html)
-- 수주 유형 3가지: 직접 수주(own) / 협약시공사 수주 · 기술자문(partner_tech) / 타사 이관 수주(= crm_deal_transfers, 이 표에 두지 않는다).
-- 영업건의 단계 · 담당 · 계약실적 원장은 건드리지 않는다. 수주 유형 · 낙찰 시공사 · 낙찰금액 · 연결 계약만 이 표에 둔다.
-- 실적 금액 = 낙찰금액(VAT 별도). 기술자문 계약금액 · POUR 계약금액은 더하지 않고 연결 계약으로 따로 저장한다.
-- 직접 수주의 실적은 계속 계약실적 원장(계약 체결일 기준)에서 읽는다 — 이 표의 own 줄은 유형 · 계약 업체 표시용.
-- 협약시공사 수주에서 기술자문 발생 = 예 → 기술자문 관리 건(public.advisory_deals)을 한 번만 자동으로 만든다(source_sheet 'crm:deal:<영업건>').
-- 표는 RLS 를 켜고 정책을 두지 않는다 — 읽기 · 쓰기는 아래 함수로만. 바꿀 때마다 crm_deal_win_events 에 전 → 후가 남는다.
-- 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run. 화면은 CRMRelease 게이트로 함수가 있을 때만 기능을 연다.

create table if not exists public.crm_deal_wins(
 deal_id text primary key,
 win_status text not null default 'confirmed' check (win_status in ('confirmed','cancelled')),
 won_type text not null check (won_type in ('own','partner_tech')),
 sales_channel_brand text,
 award_company text not null,
 award_amount numeric not null check (award_amount>0),
 award_date date not null,
 tech_advisory boolean not null default false,
 tech_advisory_company text,
 tech_advisory_amount numeric,
 pour_contract_amount numeric,
 advisory_id uuid,
 performance_owner text,
 performance_owner_id uuid,
 created_by uuid,
 created_by_name text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.crm_deal_wins enable row level security;
revoke all on table public.crm_deal_wins from public, anon, authenticated;

create table if not exists public.crm_deal_win_events(
 id bigserial primary key,
 deal_id text not null,
 action text not null,
 before jsonb,
 after jsonb,
 actor uuid,
 actor_name text,
 at timestamptz not null default now()
);
alter table public.crm_deal_win_events enable row level security;
revoke all on table public.crm_deal_win_events from public, anon, authenticated;
create index if not exists crm_deal_win_events_deal on public.crm_deal_win_events(deal_id,at desc);

-- 읽기: 로그인한 CRM 사용자(수주실적 · 메이드율은 전 직원 공개)
-- rows = 수주 유형이 확정된 영업건, advisory = 확정된 기술자문 낙찰실적(협약시공사 수주 · 기술자문 집계용 — 유입 브랜드 · 낙찰 시공사 · 낙찰금액 · 연결 계약)
create or replace function public.crm_deal_win_list_v1(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare a record;
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,
  'rows',coalesce((select jsonb_agg(to_jsonb(w) order by w.award_date desc,w.deal_id) from public.crm_deal_wins w where w.win_status='confirmed'),'[]'::jsonb),
  'advisory',coalesce((select jsonb_agg(jsonb_build_object(
     'advisory_id',ad.advisory_id,'site_name',ad.site_name,'contractor',ad.contractor,
     'decision',att.decision,'origin_business',att.origin_business,'source_deal_id',att.source_deal_id,
     'performance_owner',att.performance_owner,'bid_amount',att.bid_amount,'bid_confirmed_at',att.bid_confirmed_at,
     'advisory_fee',ad.advisory_fee,'pour_amount',ad.pour_amount) order by att.bid_confirmed_at desc,ad.advisory_id)
    from crm_security.advisory_attribution att join public.advisory_deals ad on ad.advisory_id=att.advisory_id
    where att.decision='confirmed'),'[]'::jsonb));
end $fn$;
revoke all on function public.crm_deal_win_list_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_win_list_v1(jsonb) to authenticated;

-- 수주 확정(담당자 또는 관리자): type own | partner_tech. 다시 부르면 같은 영업건의 값을 고친다. cancel=true 면 확정을 거둔다.
-- partner_tech + tech=true → 기술자문 관리 건을 만들거나(처음) 같은 건의 값을 맞춘다(다시 저장).
create or replace function public.crm_deal_win_register_v1(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 a record; dj jsonb; old public.crm_deal_wins%rowtype; cur public.crm_deal_wins%rowtype; has_old boolean;
 v_deal text; v_type text; v_company text; v_amt numeric; v_date date; v_tech boolean; v_tco text; v_tamt numeric; v_pour numeric;
 v_name text; v_owner text; v_owner_id uuid; v_po text; v_po_id uuid; v_brand text; v_site uuid; v_site_name text; v_work text; v_adv uuid; v_created boolean:=false; v_at timestamptz:=clock_timestamp();
begin
 select * into a from crm_security.actor();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid payload' using errcode='22023'; end if;
 v_deal:=nullif(btrim(coalesce(p->>'deal_id','')),'');
 if v_deal is null or length(v_deal)>80 then raise exception 'invalid payload' using errcode='22023'; end if;
 select to_jsonb(d) into dj from public.deals d where d.id::text=v_deal;
 if dj is null then raise exception '영업건을 찾을 수 없습니다' using errcode='22023'; end if;
 select * into old from public.crm_deal_wins w where w.deal_id=v_deal for update;
 has_old:=found;
 if a.permission_role<>'admin' and coalesce(dj->>'owner_id','')<>a.user_id::text and not (has_old and old.performance_owner_id=a.user_id) then
  raise exception '담당자 또는 관리자만 수주를 확정할 수 있습니다' using errcode='42501';
 end if;
 select u.name into v_name from public.users u where u.user_id=a.user_id;
 if coalesce((p->>'cancel')::boolean,false) then
  if not has_old or old.win_status<>'confirmed' then raise exception '확정된 수주가 없습니다' using errcode='22023'; end if;
  update public.crm_deal_wins w set win_status='cancelled',updated_at=v_at where w.deal_id=v_deal returning * into cur;
  insert into public.crm_deal_win_events(deal_id,action,before,after,actor,actor_name,at) values(v_deal,'cancel',to_jsonb(old),to_jsonb(cur),a.user_id,v_name,v_at);
  return jsonb_build_object('ok',true,'deal_id',v_deal,'win',null);
 end if;
 v_type:=coalesce(p->>'type','');
 if v_type not in ('own','partner_tech') then raise exception '수주 유형을 골라 주세요' using errcode='22023'; end if;
 v_company:=nullif(btrim(coalesce(p->>'company','')),'');
 if v_company is null or length(v_company)>80 then raise exception '낙찰 시공사(계약 업체)를 적어 주세요' using errcode='22023'; end if;
 begin v_amt:=(p->>'amount')::numeric; exception when others then raise exception '낙찰금액을 확인해 주세요' using errcode='22023'; end;
 if v_amt is null or v_amt<=0 or v_amt<>trunc(v_amt) then raise exception '낙찰금액(VAT 별도)을 원 단위 숫자로 적어 주세요' using errcode='22023'; end if;
 begin v_date:=(p->>'date')::date; exception when others then raise exception '낙찰일을 확인해 주세요' using errcode='22023'; end;
 if v_date is null or v_date>(v_at at time zone 'Asia/Seoul')::date then raise exception '낙찰일은 오늘까지의 날짜로 넣어 주세요' using errcode='22023'; end if;
 v_tech:=false; v_tco:=null; v_tamt:=null; v_pour:=null;
 if v_type='partner_tech' then
  if jsonb_typeof(p->'tech') is distinct from 'boolean' then raise exception '기술자문 발생 여부를 골라 주세요' using errcode='22023'; end if;
  v_tech:=(p->>'tech')::boolean;
  if v_tech then
   v_tco:=nullif(btrim(coalesce(p->>'tech_company','')),'');
   if v_tco is null or length(v_tco)>80 then raise exception '기술자문 계약 상대를 적어 주세요' using errcode='22023'; end if;
   begin v_tamt:=(p->>'tech_amount')::numeric; exception when others then raise exception '기술자문 계약금액을 확인해 주세요' using errcode='22023'; end;
   if v_tamt is null or v_tamt<=0 or v_tamt<>trunc(v_tamt) then raise exception '기술자문 계약금액을 원 단위 숫자로 적어 주세요' using errcode='22023'; end if;
   begin v_pour:=nullif(p->>'pour_amount','')::numeric; exception when others then raise exception 'POUR 계약금액을 확인해 주세요' using errcode='22023'; end;
   if v_pour is not null and (v_pour<0 or v_pour<>trunc(v_pour)) then raise exception 'POUR 계약금액을 확인해 주세요' using errcode='22023'; end if;
   if v_pour=0 then v_pour:=null; end if;
  end if;
 end if;
 -- 실적 귀속 = 수주 확정 시점 담당자. 한 번 정해지면 다시 저장해도 바뀌지 않는다
 if has_old and old.performance_owner is not null then v_owner:=old.performance_owner; v_owner_id:=old.performance_owner_id; v_brand:=old.sales_channel_brand;
 else
  begin v_owner_id:=nullif(dj->>'owner_id','')::uuid; exception when others then v_owner_id:=null; end;
  v_owner:=coalesce(nullif(btrim(coalesce(dj->>'assignee_name','')),''),(select u.name from public.users u where u.user_id=v_owner_id));
  v_brand:=coalesce(nullif(btrim(coalesce(dj->>'origin_business','')),''),nullif(btrim(coalesce(dj->>'brand','')),''));
  -- 담당 · 귀속 분리(2차 기능 8): 그 영업건에 고정된 실적 귀속(주담당)이 있으면 그 사람에게(sql/deal-owner-v1)
  if to_regclass('public.crm_deal_owners') is not null then
   execute 'select o.performance_owner,o.performance_owner_id from public.crm_deal_owners o where o.deal_id=$1' into v_po,v_po_id using v_deal;
   if v_po is not null then v_owner:=v_po; v_owner_id:=v_po_id; end if;
  end if;
 end if;
 v_adv:=case when has_old then old.advisory_id else null end;
 -- 기술자문 관리 건: 처음이면 만들고, 이미 이 영업건으로 만든 건이 있으면 값을 맞춘다. 발생 = 아니오로 바꿔도 만든 건은 지우지 않는다(기술자문 관리에서 정리)
 if v_type='partner_tech' and v_tech then
  begin v_site:=nullif(dj->>'site_id','')::uuid; exception when others then v_site:=null; end;
  v_site_name:=coalesce((select nullif(btrim(s.site_name),'') from public.sites s where s.site_id=v_site),nullif(btrim(coalesce(p->>'site_name','')),''));
  if v_site_name is null or length(v_site_name)>200 then raise exception '현장명을 확인할 수 없습니다' using errcode='22023'; end if;
  v_work:=nullif(left(btrim(coalesce(dj->>'work_summary',dj->>'primary_work','')),200),'');
  if v_adv is null then select ad.advisory_id into v_adv from public.advisory_deals ad where ad.source_sheet='crm:deal:'||v_deal and ad.source_row=1; end if;
  if v_adv is null then
   insert into public.advisory_deals(site_id,site_name,work_name,contractor,owner_name,owner_kind,bid_amount,advisory_fee,pour_amount,contract_date,status,origin_channel,source_sheet,source_row,raw)
    values(v_site,v_site_name,v_work,v_company,v_owner,case when v_owner is null then '미지정' else '내부' end,v_amt::bigint,v_tamt::bigint,v_pour::bigint,v_date,'낙찰','crm','crm:deal:'||v_deal,1,
     jsonb_build_object('source','crm_deal_win','crm_deal_id',v_deal,'origin_business',v_brand,'tech_advisory_company',v_tco,'created_by_name',v_name))
    returning advisory_id into v_adv;
   v_created:=true;
  else
   update public.advisory_deals ad set contractor=v_company,bid_amount=v_amt::bigint,advisory_fee=v_tamt::bigint,pour_amount=v_pour::bigint,contract_date=v_date,
    raw=coalesce(ad.raw,'{}'::jsonb)||jsonb_build_object('tech_advisory_company',v_tco,'updated_by_name',v_name)
    where ad.advisory_id=v_adv and ad.source_sheet='crm:deal:'||v_deal;
  end if;
 end if;
 insert into public.crm_deal_wins(deal_id,win_status,won_type,sales_channel_brand,award_company,award_amount,award_date,tech_advisory,tech_advisory_company,tech_advisory_amount,pour_contract_amount,advisory_id,performance_owner,performance_owner_id,created_by,created_by_name,created_at,updated_at)
  values(v_deal,'confirmed',v_type,v_brand,v_company,v_amt,v_date,v_tech,v_tco,v_tamt,v_pour,v_adv,v_owner,v_owner_id,a.user_id,v_name,v_at,v_at)
 on conflict (deal_id) do update set win_status='confirmed',won_type=excluded.won_type,sales_channel_brand=excluded.sales_channel_brand,award_company=excluded.award_company,
  award_amount=excluded.award_amount,award_date=excluded.award_date,tech_advisory=excluded.tech_advisory,tech_advisory_company=excluded.tech_advisory_company,
  tech_advisory_amount=excluded.tech_advisory_amount,pour_contract_amount=excluded.pour_contract_amount,advisory_id=excluded.advisory_id,
  performance_owner=excluded.performance_owner,performance_owner_id=excluded.performance_owner_id,updated_at=v_at
 returning * into cur;
 insert into public.crm_deal_win_events(deal_id,action,before,after,actor,actor_name,at) values(v_deal,'register',case when has_old then to_jsonb(old) else null end,to_jsonb(cur),a.user_id,v_name,v_at);
 return jsonb_build_object('ok',true,'deal_id',v_deal,'win',to_jsonb(cur),'advisory_created',v_created);
end $fn$;
revoke all on function public.crm_deal_win_register_v1(jsonb) from public, anon;
grant execute on function public.crm_deal_win_register_v1(jsonb) to authenticated;
