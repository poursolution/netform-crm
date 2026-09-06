# Next Action completion — local chained candidate

상태: `LOCAL_CHAIN_CANDIDATE_AFTER_OPERATIONAL_SOURCE_NOT_APPLIED`

## 판정

`next_action_complete = DERIVED_SAFE_LOCAL_CHAIN_CANDIDATE`.

P09 후보가 Deal당 open Next Action을 한 건으로 교체하고 ACK에 실제 UUID를 반환하며, operational source 후보가 같은 UUID를 PC `nextActionObj.id`와 mobile `nextAction.id`로 공급한다. 따라서 과거의 PC text/due 및 mobile `na-<timestamp>` 모호성은 read compatibility alias와 transport 정규화로 제거할 수 있다.

완료 command는 `{action_id: UUID}`만 서버에 보낸다. client text/due/time은 표시 호환 입력으로만 받고 canonical payload에서 제거한다. 대상 Action은 반드시 해당 Deal의 현재 `open` row여야 한다.

## 한 사용자 행동의 transaction

- JWT actor와 Deal write scope, expected version, receipt를 확인한다.
- Action을 `completed`, server `completed_at`으로 갱신한다.
- 다음 open Action이 있으면 Deal summary에 반영하고, 없으면 null로 비운다.
- `다음 행동 완료` Activity 한 건, Deal version 1회, private audit와 receipt를 같은 transaction에 기록한다.
- PC Today/mobile Today가 별도로 만드는 완료 Activity는 Adapter가 parent completion에 흡수한다.
- replay는 같은 ACK를 반환하며 Action/Activity/audit 중복은 0이다. 다른 payload 재사용, stale version, 이미 완료된 Action은 409다.

PC 상세 `completeNextAction()`에는 원래 server write가 없으므로 Overlay가 기존 local UI 갱신 뒤 같은 완료 command를 한 번 추가한다. 이 후보는 예약/연기, parent close/win에서의 자동 완료, inquiry follow-up을 연결하지 않는다.

## Rollback

Rollback은 public Dispatcher를 quote-version 9-op 상태로 복원하고 completion receipt를 private archive에 보존한다. 이미 완료된 Action과 생성된 Activity/audit는 업무 증거이므로 삭제하거나 역변경하지 않는다.

Staging/Production/n8n 변경은 수행하지 않았다.
