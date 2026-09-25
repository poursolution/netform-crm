# 기술자문 트랙 인수인계 (2026-09-25 · 대표 확정 사항 포함)

코덱스가 낙찰 실적 구조(1~5단계)를 진행할 때 반드시 따라야 할 합의·규약 기록.

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

## 코덱스 남은 단계 (컨설턴트 문서 ⑬)
1. 필드: origin_business / origin_channel 분리 / source_deal_id / bid_confirmed_at / performance_owner / origin_confirmed_*
2. 46건 보완 큐(부족 정보만: 원천 브랜드 46 · 현장연결 13 · 담당자 3 · 낙찰금액 2) — 자동 추천(단일 후보 8건) + 사람 확정
3. 신규 전환 자동 승계(원천 브랜드·담당·현장·source_deal_id)
4. 브랜드별 낙찰 퍼널 대시보드 — 완성 시 성과 분석 참고 카드를 정식 집계로 교체(담당: Claude)
