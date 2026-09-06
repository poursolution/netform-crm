# Inquiry response outcomes local candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE / NOT APPLIED`

현재 모바일의 세 통화 결과는 label/status 조합으로 유일하게 분리되며 외부 `inquiry_assign`와 ACK는 유지한다. 서버 내부 intent만 `response_progress`, `response_next_week_retry`, `response_missed_retry`로 정규화한다.

- `진행됨 — 다음 잡음`: 최초응대 시각을 한 번만 기록하고 마지막 응대시각을 갱신하며 status를 `전화응대 완료`로 둔다.
- `다음주 다시`: 고객 응답이 있었으므로 같은 응대 timestamp 규칙을 적용하고 status를 `응대중`, `next_action_date`를 서버 KST 날짜 기준 7일 뒤로 둔다.
- `못 받으심 (내일 재시도)`: 미응대 KPI를 보존하기 위해 `first_response_at/responded_at`을 변경하지 않고 status를 `배정완료`, `next_action_date`를 서버 KST 날짜 기준 1일 뒤로 둔다.
- 각 결과는 status/timestamps/follow-up/audit/receipt를 한 transaction으로 처리한다. 별도 `next_actions` row는 만들지 않는다.
- 현재 담당 UUID와 서버 actor UUID가 같고 승인된 `rep` 또는 `consultation`일 때만 허용한다.
- client `from`, `to`, `status`, `at`은 intent 식별 형식만 검사하고 저장 정본으로 사용하지 않는다.
- private `inquiry_audit_events`의 결과별 append-only 사건이 응대/시도 이력 정본이며, scoped operational read에는 actor 이름·응대 라벨·상태·서버시각·후속일만 제한 투영한다.
- 기존 ACK의 `operation:'inquiry_assign'`와 request-id 멱등성을 유지한다.
- 알 수 없는 label/status 조합은 화면의 로컬 상태를 바꾸기 전에 차단한다.
- `direct_assign`, 공종 및 다른 누적 operation의 의미는 변경하지 않는다.
- rollback은 서버가 기록한 업무 timestamp/status/follow-up을 추측 복원하지 않고 세 response receipt/audit를 private archive로 보존한 뒤 이전 Dispatcher/read layer를 복구한다.

Staging DDL/DML, Production, n8n 접근은 모두 실행하지 않았다.
