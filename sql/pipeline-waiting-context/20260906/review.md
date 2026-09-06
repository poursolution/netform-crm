# P13 waiting context local chain candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE`, Staging 미적용.

- 현재 도달 가능한 `dccSaveWaitingContext()`는 이미 `waiting`인 Deal에서 대기 사유·발언자·고객 발언·재접촉일·예상 재개일·근거를 저장하고 replacement Next를 만든다.
- 외부 op/ACK는 `waiting_context` 그대로 유지한다. client actor/time은 버리고 서버 Auth UUID/CRM UUID/time을 사용한다.
- 한 transaction에서 `stage_contexts.waiting`, `wake_up_at`, open Next 교체, `대기정보` Activity, Deal summary/version, private audit/receipt를 처리한다. 뒤따르는 legacy `next_action`은 overlay가 흡수한다.
- `stage_code='waiting'`이고 active인 Deal만 허용한다. 대기 단계로 들어가는 구조화 전환은 P03의 별도 transaction이며 이 후보가 우회하지 않는다.
- reload 후 기존 DCC alias가 유지되도록 `stage_contexts.waiting.fields`를 top-level waiting aliases로 투영한다.

적용 순서는 `pipeline-amount-expected/20260906` 뒤다. live guard와 Staging JWT/PC button/replay/conflict/read-back 검증 전에는 PASS로 계산하지 않는다.
