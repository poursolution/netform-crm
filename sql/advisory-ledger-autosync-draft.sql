-- ═══════════════════════════════════════════════════════════════════
-- 기술자문 계약 → 계약실적 원장 자동 반영 (초안 · 2026-09-25 대표 승인 설계)
-- 상태: DRAFT — ⚠️ 아직 실행 금지. 딜↔기술자문 매핑(1곳)만 확정하면 완성.
--
-- 승인된 규칙:
--  · 대상: 서명 완료 + 금액 확인 + 계약일 존재. 문서ID로 중복 반영 방지.
--  · 체결일: 계약서 표시일(source_printed_contract_date) 우선,
--            없으면 서명 완료 수신일(completion_observed_at::date).
--  · 귀속: 원본 담당자(current_source_manager)가 CRM 영업담당자로 매핑되면 동결 귀속.
--          매핑 불가 건은 반영하지 않고 '확인 필요' 목록으로만 노출(임의 추정 금지).
--  · 근거: reason = '기술자문 자동 반영 · 문서 ' || source_document_id
--  · 반영은 기존 crm_contract_sales_write_v1 정본 경로/원장 테이블 규약을 그대로 따른다.
-- ═══════════════════════════════════════════════════════════════════

-- [확인 필요 ①] 딜 매핑: 아래 둘 중 실제 스키마에 맞는 조인을 확정할 것.
--   후보 A) public.advisory_deals.site_id 가 CRM deal id 를 직접 가리킴
--   후보 B) crm_advisory_site_read_v1(p_deal_id) 내부가 쓰는 별도 링크 테이블 존재
--   → 라이브에서 확인:  select column_name,data_type from information_schema.columns
--                        where table_name='advisory_deals';
--      그리고 \sf public.crm_advisory_site_read_v1

-- 1) 미반영 조회(관리자 신호·일괄 반영 목록용)
create or replace function public.crm_advisory_ledger_pending_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from crm_security.actor() a where a.permission_role='admin') then
  raise exception 'forbidden' using errcode='42501';
 end if;
 return (
  with signed as (
   select a.advisory_id,
          a.site_id            as deal_id,          -- [확인 필요 ①]
          c.value->>'source_document_id'                 as document_id,
          (c.value->>'document_amount')::bigint          as amount,
          coalesce(nullif(c.value->>'source_printed_contract_date',''),
                   left(c.value->>'completion_observed_at',10))::date as effective_date,
          c.value->>'current_source_manager'             as source_manager,
          c.value->>'contract_kind'                      as contract_kind
   from public.advisory_deals a
   join crm_security.advisory_record_links l using(advisory_id)
   join crm_security.advisory_snapshots s on s.project_id=l.project_id
   cross join jsonb_array_elements(s.snapshot->'contracts') c
   where c.value->>'source_status' in ('completed','document_all_signed')
     and (c.value->>'document_amount') ~ '^[0-9]+$'
  )
  select jsonb_build_object('ok',true,'items',coalesce(jsonb_agg(jsonb_build_object(
    'deal_id',sg.deal_id,'document_id',sg.document_id,'amount',sg.amount,
    'effective_date',sg.effective_date,'source_manager',sg.source_manager,
    'contract_kind',sg.contract_kind,
    'owner_mapped', exists(select 1 from public.sales_people sp    -- [확인 필요 ②] 담당자 매핑 테이블명
                           where sp.name=sg.source_manager and sp.active)
   )),'[]'::jsonb))
  from signed sg
  where sg.deal_id is not null
    and sg.effective_date is not null
    -- 이미 원장에 반영된 문서는 제외 (reason 태그 기준 멱등)
    and not exists (
      select 1 from public.contract_sales_events e                 -- [확인 필요 ③] 원장 이벤트 테이블명
      where e.reason like '%문서 '||sg.document_id||'%'
    )
 );
end $$;

-- 2) 일괄 반영: pending 중 owner_mapped=true 건을 signed 이벤트로 기록.
--    crm_contract_sales_write_v1 을 건별 호출하는 클라이언트 방식(검증된 ACK 경로)을 우선하고,
--    서버 일괄 함수는 매핑 확정 후 같은 규약으로 작성한다.
