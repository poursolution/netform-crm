# Stage checklist manual toggle — local chained candidate

상태: `LOCAL_CHAIN_CANDIDATE_AFTER_NEXT_COMPLETE_NOT_APPLIED`

## 판정

`stage_check = DERIVED_SAFE_LOCAL_CHAIN_CANDIDATE`.

최종 PC/mobile UI의 13단계 guide 정의는 동일하며 자동 항목은 연락처·공종·Next Action·견적·첨부·활동 등 실제 CRM 데이터에서 계산되어 write를 보내지 않는다. 수동 항목만 기존 `stage_check` payload를 보내며, Golden의 `stage_checklist` JSON 저장 의미와 일치한다.

후보는 client `item_text`를 권한 정본으로 저장하지 않는다. Adapter와 서버가 현재 UI 목록의 `(stage_code,item_index)`를 독립적으로 검증하고 서버 label을 audit에 기록한다. 현재 Deal 단계와 payload 단계가 다르거나 자동 항목을 직접 호출하면 거절한다.

## 한 사용자 행동의 transaction

- JWT actor, Deal write scope, expected version, receipt를 확인한다.
- `deals.stage_checklist[stage_code][item_index]`의 boolean 한 값만 변경한다.
- Deal version을 한 번 올리고 private audit와 receipt를 같은 transaction에 기록한다.
- 같은 상태 재요청, stale version, 변경된 request ID 재사용은 409다.
- 응답은 기존 `{ok:true, write_id/request_id, operation:'stage_check'}` 의미를 유지하면서 서버 checklist와 새 version을 포함한다.

Operational source에는 `stage_checklist`를 그대로 보충해 PC `stage_checklist`와 mobile `stageChecklist`가 동일 값을 읽는다. 자동 체크 결과는 계속 다른 실제 데이터에서 계산하며 이 JSON에 복제하지 않는다.

Rollback은 Dispatcher/read source를 이전 10-op 상태로 복원하고 non-empty checklist와 receipt를 private archive에 보존한 뒤 추가 컬럼을 제거한다. private audit는 업무 증거로 보존한다.

Staging/Production/n8n 변경은 수행하지 않았다.
