# 기술자문 트랙 인수인계 (2026-09-25 · 대표 확정 사항 포함)

코덱스가 낙찰 실적 구조(1~5단계)를 진행할 때 반드시 따라야 할 합의·규약 기록.

## 실적 정책 정본 (2026-09-25 추가 확정 — 컨설턴트 정제안)
- **bid_amount(낙찰금액) = 영업실적 정본. advisory_fee(자문료)=계약 관리용, settled(정산)=참고값, 수금액=입금 관리용 — 네 값을 절대 섞지 않는다.** 정산·설계변경·수금은 실적을 바꾸지 않는다(공식 낙찰금액 정정 시에만 수정).
- 실적 생성은 **낙찰 확정 이벤트** 시점: 상태 흐름 `낙찰 확인 전 → 낙찰 확정 → 영업실적 반영`. 필수값: 현장·공사명·낙찰업체·낙찰금액·낙찰확정일·귀속 담당자·유입 브랜드·근거자료.
- **중복 인식 금지**: 실적 이벤트에 source_type(normal_sales | technical_advisory) 저장, 동일 현장+공사+낙찰 건은 실적 이벤트 1개만. 현 원장에서는 reason 접두어('기술자문 … 문서 <id>')가 source 구분+멱등 키 역할 — 새 구조도 같은 키를 승계할 것.
- 대시보드 집계: 전체 영업매출 = 일반 계약실적 + 기술자문 낙찰실적(분리 표기 + 합계).
- **잔여 3건 대표 확정 완료(2026-09-25)**:
  1. 낙찰금액 = **VAT 별도(공급가액)** — 기존 44건 검증도 이 기준.
  2. 공식 낙찰금액 정정 시: **관리자만, 원장 amended(증감) 이벤트로** — 원본 보존·근거 사유 필수(기존 원장 정책과 동일).
  3. 수의계약 등 공식 낙찰가 없는 건: **수의계약서의 공사금액(VAT 별도)을 실적으로**, 확정일=계약 체결일.

## 대표 확정 사항
- CRM 수기 기술자문 브랜드 딜 47건 **삭제 완료** — 백업: `crm_security.manual_delete_backup` batch=`advisory-deals-20260925`(49행). 복구는 이 배치에서 재삽입.
- 이후 기술자문은 **연동(advisory) 경로 전용**. CRM에 기술자문 브랜드 딜을 다시 만들지 말 것.
- 실적 금액 기준: **낙찰금액(VAT 별도)**. 화면 라벨도 "낙찰금액 (VAT 별도)"로 고정.
- 실적 귀속일: **낙찰확정일**(컨설턴트 추천안 기준으로 UI 라벨 반영됨 — 최종 정책 문구는 대표 재확인 시 갱신).
- 연동 건은 어디에 보이든 현장명 옆 **"기술자문" 배지** 필수(전역 헬퍼 `advisoryBadge`, crm.html).

## 원장 멱등 규약 (이중 반영 금지 — 필수 준수)
- 계약 문서를 원장(`crm_contract_sales_write_v1`)에 반영할 때 reason에 반드시
  `문서 <source_document_id>` 문자열 포함. 예: `기술자문 계약 반영 · 문서 abc123`.
- 미반영 판정은 `crm_security.contract_sales_events.reason LIKE '%문서 <id>%'` 로 검사
  (`crm_advisory_ledger_pending_v1` 구현 참조). 코덱스의 46건 보완 큐가 원장에 쓸 때도 **같은 키**를 쓸 것.

## 이번에 추가된 서버 함수 (적용 완료)
- `crm_advisory_ledger_pending_v1` — 관리자 전용. 서명 완료 계약 중 원장 미반영 목록.
  매핑: 스냅샷 `crm_deal_id` 우선 → `deals.site_id` 단일 딜. 저장소 `sql/advisory-ledger-autosync.sql`.
- `crm_advisory_bid_summary_v1` — 관리자 전용. advisory_deals 낙찰 현황 합계·담당자별.

## 클라이언트 표면 (모두 라이브)
- 컨트롤타워·성과 분석 상단 **[기술자문 반영]** 버튼 → 모달(낙찰 현황 요약 + 미반영 15건, 낙찰금액·낙찰확정일 입력→건별 ACK 반영).
- 성과 분석 **"기술자문 낙찰" 참고 카드** — "검증 전 참고 · 실적 합산 아님" 명시. 검증 완료 후 정식 집계로 승격 예정.
- 상세의 기술자문 계약 패널: 접힌 요약 헤더 + 3줄 카드(파이프라인 상세 no-details 불변식 준수 — `<details>` 사용 금지, 버튼 토글).

## 현재 데이터 상태 (2026-09-25 실측)
- advisory_deals 62건(이관 46 + jandi 16) · 낙찰금액 입력 59건 · 합계 106.37억(VAT 별도 검증 전).
- 계약문서 스냅샷 15건(전부 legacy fee-crosscheck): 금액·계약일·crm_deal_id 원본 부재 → 자동 반영 불가, 확정 큐 대상.
- 딜 삭제로 site_id 단일 딜 매핑 0건 — 계약문서 실적은 코덱스의 낙찰 구조 완성 후 그 축으로 귀속.

## 낙찰실적 확정 구조 v1 — Claude 착수·구현 (2026-09-25, 1~2단계 대체)
코덱스가 1~2단계를 시작하지 않은 상태여서 Claude가 구현함. **코덱스는 이 구조를 재구현하지 말고 승계할 것.**
- 저장소 `sql/advisory-attribution-v1.sql`. 원본 `public.advisory_deals`(연동 대상)는 수정하지 않음.
- `crm_security.advisory_attribution` (advisory_id PK = 1건 1실적, 중복 불가): decision(confirmed|hold|excluded) · origin_business · source_deal_id · performance_owner · bid_amount(VAT 별도) · bid_confirmed_at · award_type(bid|private_contract) · evidence_level(document|admin_judgment) · source_type='technical_advisory' · site_id · note · version.
  - confirmed = 원천·담당·금액·확정일·근거 수준 필수 / hold·excluded = 사유 필수 / 확정 실적 변경 = 정정 사유 필수 / 전 변경 `advisory_attribution_events`에 before·after 보존.
- RPC(관리자 전용): `crm_advisory_attribution_v1()` 전 건 + 원천 브랜드 후보(같은 site_id의 CRM 딜, coalesce(origin_business, brand), 최초 접촉순, 원장 계약 여부) + 현장 후보 + 확정값 / `crm_advisory_attribution_decide_v1(p jsonb)` expected_version 낙관적 잠금.
- 화면: 컨트롤타워·성과 분석 [기술자문 낙찰실적 확정] 큐(검증 대기·보류·확정·제외 탭, 이관 46건 진척률, 후보 1개면 원클릭 "○○로 확정", 후보 2개+ = "브랜드 귀속 확인 필요", 원장 계약 있는 후보 = "실적 중복 가능성") · 성과 분석 "기술자문 낙찰실적" 카드는 **확정분만 합산**(낙찰확정일 기준, 상단 필터: 기간·담당자·브랜드 칩=원천 브랜드) · 컨트롤타워 "데이터 위험" 스트립.
- 정책 기본값(대표 최종 합의 대상): 브랜드 실적 = 최초 유입 브랜드(원천), 담당자 실적 = 확정 시점 귀속 담당자 동결, 둘은 섞지 않음.
- 남은 것: ③ 신규 전환 자동 승계(잔디 수신 시 source_deal_id·원천·담당 자동 기록 — 연동 측) ④ 표준 단계 매핑(검토→견적→입찰→낙찰→계약→진행→완료)과 브랜드 퍼널 ⑤ 일반 계약실적 + 기술자문 낙찰실적 합계 대시보드.

## 코덱스 남은 단계 (컨설턴트 문서 ⑬)
1. 필드: origin_business / origin_channel 분리 / source_deal_id / bid_confirmed_at / performance_owner / origin_confirmed_*
2. 46건 보완 큐(부족 정보만: 원천 브랜드 46 · 현장연결 13 · 담당자 3 · 낙찰금액 2) — 자동 추천(단일 후보 8건) + 사람 확정
3. 신규 전환 자동 승계(원천 브랜드·담당·현장·source_deal_id)
4. 브랜드별 낙찰 퍼널 대시보드 — 완성 시 성과 분석 참고 카드를 정식 집계로 교체(담당: Claude)
