# 데이터 정본 사전 (Canonical Data Dictionary) — 2026-09-25

새 기능·리포트·쿼리는 **이 표의 정본 필드만** 쓴다. "구형/폐기" 필드는 과거 이관 데이터 호환용으로만 남아 있으며 새 계산에 쓰면 숫자가 틀린다.
근거: 운영 DB 실측(2026-09-25) + 컨설턴트 전체 진단(구형·신형 구조 공존이 근본 원인 1위).

## 1. 브랜드 · 사업 · 서비스 · 채널 (4개 축은 서로 다른 질문이다)

| 질문 | 정본 필드 | 값 예시 | 구형/혼용 필드 (새 계산 금지) |
|---|---|---|---|
| **어느 브랜드로 고객을 처음 만났나** (브랜드 실적 귀속) | `deals.origin_business` · 기술자문은 `crm_security.advisory_attribution.origin_business` | 석민이앤씨 · POUR솔루션 · POUR공법 · 아파트스퀘어 · POUR스토어 · 기술자문 직접영업 | `deals.brand` (이관 원본), `deals.origin_channel` (**실측: 브랜드명이 들어 있음** — 석민이앤씨 413 등) |
| **지금 어느 사업으로 진행 중인가** | `deals.current_business` (+ 변경 이력 `business_history`) | 위와 같은 브랜드 목록 / 기술자문은 `advisory_deals` | `deals.brand` |
| **어떤 서비스 유형인가** | `deals.service_type` (+ `service_history`) | 시공영업 · 컨설팅 · 설계·감리 | — (브랜드 값과 절대 섞지 않음) |
| **어떤 경로로 들어왔나** (유입 채널) | 문의: `inquiries` 접수 경로 / 기술자문: `advisory_deals.origin_channel`(jandi 등) | 홈페이지 · 전화 · 소개 · jandi | `deals.origin_channel` (브랜드 값 오염 — 정리 전까지 채널 분석에 쓰지 말 것) |

- 원천 브랜드는 기술자문 등 다른 사업으로 전환돼도 **바뀌지 않는다**(대표 확정 2026-09-25). 브랜드 실적과 담당자 실적은 섞지 않는다.
- ⚠ 구형 함수 `apply_business_change()`는 사업 변경 시 `current_business`·`brand`·`service_type`을 **같은 값으로** 덮는다 — 서비스 유형 축을 파괴하므로 사용 금지(전송 허용 목록에 없음, 새 코드에서 호출 금지).
- 실측(2026-09-25): 영업건 1,503건 중 브랜드·사업 값이 빈 건 920건(과거 '잠재고객'·담당자별 고객 목록 이관분).

## 2. 영업 상태

| 의미 | 정본 | 규칙 |
|---|---|---|
| 현재 단계 | `deals.stage_code` (`public.stage_catalog.code`) | 화면 라벨은 stage_catalog/STAGE_MASTER에서 |
| 단계 묶음 | `stage_catalog.stage_group` (lead/build/exec/post/closed) | 저장값 `deals.stage_group`은 파생값 |
| 진행 여부 | `deals.lifecycle_status` (active/parked/closed) | **종료 단계(won·lost·badfit_lead·badfit_pipe·nocontact)면 반드시 closed** — DB 제약 `deals_closed_stage_consistent` (sql/state-contract-20260925.sql) |
| 종료 결과 | `deals.outcome` (won/lost/badfit/nocontact) | 종료 명령(close)만 기록. 수주는 `deals_won_truth_consistent` 제약 |
| 단계 미분류 | `stage_code IS NULL` | 과거 목록 원본 단계명(`stage_raw`) 미매핑 184건 — 검토 대상, 새 건은 금지 |

## 3. 문의 → 영업 계보 (Lineage)

| 의미 | 정본 | 구형 (사용 금지) |
|---|---|---|
| 이 영업건은 어느 문의에서 왔나 | **`deals.origin_inquiry_id`** (전환 명령 `crm_inquiry_pipeline_promote_command_v1`이 기록 + 이력·감사) | `inquiries.deal_id`, `inquiries.opportunity_id` — 항상 비어 있음. 이걸로 전환율을 세면 0%가 나온다 |
| 전환 시점 | 대표 확정: 문의가 **'견적서 발송'** 상태가 되면 자동 전환 (구현 예정) | — |

## 4. 담당자 · 실적

| 의미 | 정본 |
|---|---|
| 현재 담당 | `deals.assignee_name` (화면 기준) · `deals.owner_id`(users FK) — 실측: 진행 1,071건 중 owner_id 739 · assignee 788, 정합 정리 필요 |
| 일반 영업 실적 | `crm_security.contract_sales` 원장(계약 체결일 기준, 체결 당시 담당자에게 동결) |
| 기술자문 실적 | `crm_security.advisory_attribution` decision='confirmed' — 낙찰금액(VAT 별도), 낙찰확정일 기준, 확정 시점 담당자 동결 |
| 전체 영업실적 | 일반 계약실적 + 기술자문 낙찰실적 (source_type로 분리 표기 후 합계) |

## 5. Live / Legacy

- 운영 KPI 기준일 `OPS_RULES.liveFrom = 2026-10-01`(대표 확정). Live = 기준일 이후 생성 또는 실제 조치가 기록된 영업. Legacy는 '과거 데이터 정상화율'로만 평가.
- 실측: 2026-09-08 이후 새로 생성된 영업건 0건.

## 6. 운영 규칙

- 화면이 쓰는 RPC는 전부 저장소에 SQL이 있어야 한다(`tests/release-contract.test.cjs`), 운영 적용 여부는 `crm_release_manifest_v1` + `release-contract.js`가 확인한다 → docs/release-contract.md.
- 폐기 필드는 DB 컬럼 주석으로도 표시한다(sql/data-dictionary-comments-20260925.sql).
