-- 견적 기능 v3 · 1단계: 데이터 표 · 금액 이름 정리 (2026-10-11 design_handoff_quote_v3 README '2. 데이터' · '6. 작업 순서 1')
-- ★ 2026-10-11 수정: 예전 판은 public.crm_quote_versions 를 가리켜 틀렸다 — 아직 Run 하지 않았다면 이 판으로 Run, 이미 Run 했다면 이 판을 한 번 더 Run(예전 표의 열은 그대로 두어도 해롭지 않다).
-- ★ 이 파일은 운영 DB 를 바꿉니다 — 대표가 Supabase SQL 편집기에서 Run 합니다. 여러 번 실행해도 안전(if not exists · 값이 비어 있을 때만 채움).
-- 하는 일(표만 만든다 — 계산 함수 · 화면은 2단계부터):
--  ① 견적 수정본(crm_security.quote_versions)에 금액 두 층과 가산 · 상태 칸을 더한다. 기존 견적은 지우지도 덮지도 않는다.
--       · base_amount  = 적산 기준금액(원본 보존) · submit_amount = 고객 제출금액(영업이 가산 → 10만원 아래 절삭, VAT 별도)
--       · 기존 견적 첨부 → V1: 기존 amount 를 base_amount 로만 옮긴다(제출금액은 비움 = 가산 미확정). 날짜는 이미 있는 created_at 그대로(없는 날짜를 만들지 않는다).
--       · 파이프라인 · 리포트 · 발송의 '견적 금액' = 고객 제출금액, 아직 없으면 기존 amount(= 지금과 같은 숫자). 이 읽기 규칙은 화면 쪽(quote-amounts.js)과 같다.
--  ② 견적 요청(crm_quote_requests) · 계산 기준 5종(노임 · 원가 요율 · 자재 단가 · 공법 기준 · 브랜드 양식) 표를 새로 만든다. 값은 비어 있다 — 기준 담당이 3~5단계에서 채운다.
--  ③ 표는 전부 행 보안(RLS) 켬 · 익명 · 로그인 사용자 직접 접근 없음(service_role 만). 읽기 · 쓰기는 이후 단계의 서버 함수로만.
-- 하지 않는 것: 금액 계산 · 승인 흐름 · 화면 · 기존 deals.quote_amount 변경.

begin;

-- ① 견적 수정본 확장 — 지금 운영에서 쓰는 표는 crm_security.quote_versions(영업건 상세·파이프라인·리포트의 '견적 금액'이 읽는 표)
--    (예전 public.crm_quote_versions 가 아님 — 2026-10-11 확인). 기존 줄은 지우지도 덮지도 않는다.
alter table crm_security.quote_versions
  add column if not exists kind text,                        -- simple(간단) / method(공법)
  add column if not exists base_amount bigint,               -- 적산 기준금액(원본 보존)
  add column if not exists supply_amount bigint,             -- 공급가액(원가계산서 절삭 전)
  add column if not exists markup_type text,                 -- area ㎡당 / multiplier 배수 / flat 정액 / multi 여러 방식 / none
  add column if not exists markup_items jsonb,               -- [{type,value,area}] 배수 → ㎡당 → 정액 순서로 적용한 내역
  add column if not exists markup_value numeric(18,4),
  add column if not exists markup_area numeric(18,2),
  add column if not exists markup_display text,              -- line 별도 줄 / melt 단가에 녹임
  add column if not exists markup_note text,
  add column if not exists markup_by text,
  add column if not exists markup_at timestamptz,
  add column if not exists rounding_rule text,               -- floor_100k: 10만원 아래 절삭
  add column if not exists submit_amount bigint,             -- 고객 제출금액(VAT 별도)
  add column if not exists alt_label text,                   -- 두 안(A · B) 중 이 수정본이 가리키는 안 이름
  add column if not exists status text,                      -- draft 초안 / internal 내부 확인 / final 최종본 / superseded 대체됨
  add column if not exists basis jsonb,                      -- 쓴 기준 버전 {labor, cost, material, method, template}
  add column if not exists excel_file_id uuid,
  add column if not exists pdf_file_id uuid;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='crm_qv_kind_chk' and conrelid='crm_security.quote_versions'::regclass) then
    alter table crm_security.quote_versions add constraint crm_qv_kind_chk check (kind is null or kind in ('simple','method'));
  end if;
  if not exists(select 1 from pg_constraint where conname='crm_qv_markup_type_chk' and conrelid='crm_security.quote_versions'::regclass) then
    alter table crm_security.quote_versions add constraint crm_qv_markup_type_chk check (markup_type is null or markup_type in ('area','multiplier','flat','multi','none'));
  end if;
  if not exists(select 1 from pg_constraint where conname='crm_qv_markup_display_chk' and conrelid='crm_security.quote_versions'::regclass) then
    alter table crm_security.quote_versions add constraint crm_qv_markup_display_chk check (markup_display is null or markup_display in ('line','melt'));
  end if;
  if not exists(select 1 from pg_constraint where conname='crm_qv_status_chk' and conrelid='crm_security.quote_versions'::regclass) then
    alter table crm_security.quote_versions add constraint crm_qv_status_chk check (status is null or status in ('draft','internal','final','superseded'));
  end if;
  if not exists(select 1 from pg_constraint where conname='crm_qv_amounts_chk' and conrelid='crm_security.quote_versions'::regclass) then
    alter table crm_security.quote_versions add constraint crm_qv_amounts_chk check ((base_amount is null or base_amount>0) and (submit_amount is null or submit_amount>0));
  end if;
end $$;

-- 기존 견적 → V1 · base_amount 만(이미 채워진 것은 건드리지 않는다). 제출금액 · 가산 · 양식은 비워 둔다 = 가산 미확정. 날짜는 원래 created_at 그대로.
update crm_security.quote_versions
   set base_amount=amount, status=coalesce(status,'final'), kind=coalesce(kind,'method')
 where base_amount is null and amount>0;
-- ② 견적 요청 -------------------------------------------------------------------------------------------------------
create table if not exists public.crm_quote_requests (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.deals(id) on delete cascade,
  work_items jsonb not null default '[]'::jsonb,            -- [{work, qty, unit(㎡ · m · 식)}]
  memo text,
  photos jsonb not null default '[]'::jsonb,                -- 자료 id 목록
  customer_due date,                                         -- 고객과 약속한 날
  internal_due date,                                         -- 내부 완료 예정일(적산 · 설계팀)
  status text not null default 'requested' check (status in ('requested','needs_info','working','done','cancelled')),
  expedite text check (expedite is null or expedite in ('requested','accepted','declined')),  -- 앞당기기는 '요청'일 뿐
  requested_by text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  write_id text unique
);
create index if not exists crm_quote_requests_opportunity_idx on public.crm_quote_requests(opportunity_id, requested_at desc);

-- ③ 계산 기준 5종(적용일 버전 · 상태 초안 / 사용 중 / 지난 기준) ----------------------------------------------------
create table if not exists public.crm_labor_rates (            -- 노임: 직종 · 하루 노임
  id uuid primary key default gen_random_uuid(),
  trade text not null, daily_wage numeric(14,2) not null check (daily_wage>0),
  effective_from date not null, status text not null default 'draft' check (status in ('draft','active','retired')),
  source text, created_by text, created_at timestamptz not null default now(), approved_by text, approved_at timestamptz,
  unique (trade, effective_from)
);
create table if not exists public.crm_cost_rates (             -- 원가 요율: 항목별 시행일 · 분류(법정 / 회사 기준 / 확인 필요)
  id uuid primary key default gen_random_uuid(),
  item text not null, category text not null check (category in ('statutory','company','needs_check')),
  base_of text,                                                -- 계산 대상(예: 직접노무비 · 재료비 합)
  rate numeric(12,6) not null check (rate>=0),
  effective_from date not null, status text not null default 'draft' check (status in ('draft','active','retired')),
  source text, created_by text, created_at timestamptz not null default now(), approved_by text, approved_at timestamptz,
  unique (item, effective_from)
);
create table if not exists public.crm_material_prices (       -- 자재 단가: 품목 · 규격 · 말 · 롤 단가 · 기준일
  id uuid primary key default gen_random_uuid(),
  item text not null, spec text, unit text, unit_price numeric(14,2) not null check (unit_price>=0),
  price_date date not null, status text not null default 'draft' check (status in ('draft','active','retired')),
  source text, created_by text, created_at timestamptz not null default now(), approved_by text, approved_at timestamptz,
  unique (item, spec, price_date)
);
create table if not exists public.crm_method_specs (           -- 공법 기준: 공법 · ㎡당 재료 · 노무 · 경비 구성
  id uuid primary key default gen_random_uuid(),
  method text not null, composition jsonb not null default '{}'::jsonb,   -- {materials:[{item,qty_per_m2}], labor:[{trade,days_per_m2}], expenses:[…]}
  effective_from date not null, status text not null default 'draft' check (status in ('draft','active','retired')),
  source text, created_by text, created_at timestamptz not null default now(), approved_by text, approved_at timestamptz,
  unique (method, effective_from)
);
create table if not exists public.crm_brand_templates (        -- 브랜드 양식: 표지 · 양식 버전 · 조건 문구 · 유효기간
  id uuid primary key default gen_random_uuid(),
  brand text not null, cover_title text, template_version text not null, terms text, valid_months integer check (valid_months is null or valid_months>0),
  effective_from date not null, status text not null default 'draft' check (status in ('draft','active','retired')),
  source text, created_by text, created_at timestamptz not null default now(), approved_by text, approved_at timestamptz,
  unique (brand, template_version)
);

-- 행 보안: 직접 접근 없음(service_role 만). 읽기 · 쓰기는 이후 단계의 서버 함수로만.
do $$
declare t text;
begin
  foreach t in array array['crm_quote_requests','crm_labor_rates','crm_cost_rates','crm_material_prices','crm_method_specs','crm_brand_templates'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select, insert, update on public.%I to service_role',t);
  end loop;
end $$;

commit;
