# Closed Won + expansion Pool compatibility candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE / NOT APPLIED`.

최종 PC/mobile `StageTransitionUI`는 현재 단계가 `completion`일 때만 `won`을 열고, 준공일·`공사 완료`·`준공검사 완료`·양수 최종 수주금액을 필수로 받는다. 따라서 별도 `win` op는 dead code로 유지하고, 기존 `close` ACK 아래 `won` intent만 추가한다.

서버는 예상금액 `deals.amount`를 덮어쓰지 않고 `won_amount`와 `completion_date`를 별도 정본으로 저장한다. terminal Deal 변경, open Next 완료, stage history, Activity, private audit/receipt, private expansion Pool 생성은 하나의 transaction이다. Pool의 Site·담당 UUID·공종·금액은 client child payload가 아니라 잠긴 Deal row에서 만들고, 다음 접촉일은 UI 규칙대로 준공일+30일이다. 뒤따르는 `activity`와 `expansion_pool_upsert`는 overlay가 흡수한다.

Golden의 broad public `crm_expansion_pool`/trigger/RLS는 재사용하지 않는다. 후보는 private `crm_security.expansion_pool`을 actor-scoped read로만 노출한다. 실제 won 사건이 한 건이라도 생기면 schema rollback은 business data 삭제를 피하기 위해 거절한다.

Staging read-only preflight에서 관련 저장 컬럼/Pool은 없고 won·completion row도 0임을 확인했다. 이는 적용 승인이 아니며 JWT/browser E2E 전에는 PASS가 아니다.
