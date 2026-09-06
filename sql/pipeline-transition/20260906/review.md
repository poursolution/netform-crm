# Structured non-terminal Pipeline transition — local chained candidate

상태: `LOCAL_CHAIN_CANDIDATE_AFTER_STAGE_CHECK_NOT_APPLIED`

## 판정

최종 `StageTransitionUI`의 비종결 `transition`만 `DERIVED_SAFE_LOCAL_CHAIN_CANDIDATE`로 승격한다.

과거 차단점 중 구조화 context 저장 위치는 Golden `20260905_structured_stage_transition.sql`의 `deals.stage_contexts + append-only transition record` 의도로 확정되고, open Next 교체 정책은 이미 검증한 P09 규칙으로 확정됐다. 따라서 두 의미를 현재 private receipt/audit 레일 뒤의 한 transaction으로 연결한다.

문의 promote가 보내는 단순 `transition`, 종결 `close`, 수주/확장, 금액 편집은 이 후보에 포함하지 않는다. `stage_context`가 없는 기존 transition payload는 fail-closed 한다.

## 한 사용자 행동의 transaction

- 서버가 현재 stage, 허용 전환 graph, 단계별 필수 fields/date/enum/money를 다시 검증한다.
- 예외 이동은 5자 이상의 skip reason을 요구한다.
- `deals.stage_code/stage_raw/stage_group/lifecycle_status/stage_entered_at/stage_contexts`를 갱신한다.
- `stage_history`, private append-only transition event, `단계전환` Activity를 각각 정확히 한 건 기록한다.
- sent/rapport/silent/waiting에서 날짜가 파생될 때만 기존 open Next를 cancel하고 새 Next를 한 건 만든다.
- Deal version, private audit, receipt까지 같은 transaction에서 확정한다.
- UI가 뒤이어 보내는 `activity`와 `next_action`은 Adapter가 parent transition에 흡수해 중복을 막는다.

Operational source는 `stage_contexts`와 상세 stage history alias를 PC/mobile에 동일하게 공급한다. client actor/recorded_at/terminal/누적 contexts는 정본으로 사용하지 않는다.

Rollback은 Dispatcher/read source를 11-op stage-check 상태로 복원하고 stage contexts, private transition events, receipts를 private archive에 보존한다. 이미 기록된 public stage history/Activity/Next/audit는 업무 증거이므로 삭제하지 않는다.

Staging/Production/n8n 변경은 수행하지 않았다.
