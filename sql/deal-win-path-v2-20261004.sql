-- 수주 유형 v2: 영업 경로 · 금액 5개 데이터 구조 (2026-10-04 · design_handoff_rules 3차 기능 1 · 2 — 1차 때 미리 만들어 둔다)
-- 영업 경로 5칸: 유입(inflow_brand) → 최초 영업업체(first_sales_company) → 영업 담당(performance_owner) → 낙찰업체(award_company) → 기술자문업체(tech_advisory_company)
-- 금액 5개(절대 더하지 않는다): 예상(영업건 amount) / 낙찰(award_amount) / 자사계약(own_contract_amount) / 기술자문(tech_advisory_amount) / 인센티브 실적(incentive_amount = 낙찰금액 고정)
--   회사 매출 = 자사계약 + 기술자문. 직접 수주의 자사계약 = 낙찰금액, 협약시공사 수주의 자사계약 = POUR 계약금액.
-- 값은 수주 확정(crm_deal_win_register_v1)이 저장될 때 아래 트리거가 채운다 — 화면 · 함수는 바꾸지 않는다. 나중에 넣으면 쌓인 자료를 다시 나눠야 해서 지금 만든다.
-- 다시 실행해도 안전. 운영 적용: Supabase SQL 편집기에서 대표가 Run.

alter table public.crm_deal_wins
 add column if not exists inflow_brand text,
 add column if not exists first_sales_company text,
 add column if not exists own_contract_amount numeric,
 add column if not exists incentive_amount numeric;

create or replace function crm_security.deal_win_path_fill()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare dj jsonb;
begin
 select to_jsonb(d) into dj from public.deals d where d.id::text=new.deal_id;
 -- 유입 · 최초 영업업체는 처음 확정할 때의 값으로 굳힌다(영업건의 브랜드가 나중에 바뀌어도 그대로)
 new.inflow_brand:=coalesce(new.inflow_brand,new.sales_channel_brand,nullif(btrim(coalesce(dj->>'origin_business','')),''),nullif(btrim(coalesce(dj->>'brand','')),''));
 new.first_sales_company:=coalesce(new.first_sales_company,nullif(btrim(coalesce(dj->>'brand','')),''),new.sales_channel_brand);
 new.own_contract_amount:=case when new.won_type='own' then new.award_amount else new.pour_contract_amount end;
 new.incentive_amount:=new.award_amount;
 return new;
end $fn$;
revoke all on function crm_security.deal_win_path_fill() from public, anon, authenticated;

drop trigger if exists crm_deal_wins_path_fill on public.crm_deal_wins;
create trigger crm_deal_wins_path_fill before insert or update on public.crm_deal_wins
 for each row execute function crm_security.deal_win_path_fill();

-- 이미 확정된 건이 있으면 같은 규칙으로 채운다(없으면 아무 일도 없다)
update public.crm_deal_wins set updated_at=updated_at where inflow_brand is null or incentive_amount is null;
