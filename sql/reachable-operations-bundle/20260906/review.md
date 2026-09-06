# Review decision

## 목적

기존의 개별 후보는 공통 Dispatcher를 계층적으로 감싸므로 적용 순서가 정확해야 한다. 각 SQL을 별도 transaction으로 사람이 실행하면 후반 guard 실패 시 앞 계층만 남을 수 있다. 이 번들은 현행 frozen 상태에서 최종 후보 상태까지의 apply를 하나의 transaction으로, rollback을 정확한 역순의 하나의 transaction으로 합성한다.

## 포함 범위

- frozen 회귀: `opportunity_work_set`, `inquiry_assign`, `service_change`, `inquiry_unassign`
- 개인화: `favorite_set`, `opportunity_touch`
- Pipeline/Next: `next_action`, `activity`, `quote_version`, `next_action_complete`, `stage_check`, `transition`, `close`의 non-won 의미, `amount`의 expected 의미, `waiting_context`
- 문의관리: `inquiry_reclassify`, `inquiry_status`의 hold 의미, `inquiry_trash`, `inquiry_restore`, 관리자 수동 `inquiry_purge`, `inquiry_followup`
- actor-scoped operational read source

## 명시적 차단

`response_update`, `branch_handoff`, `branch_owner_assign`, `opportunity_create`, `won`, attachments, provider messaging은 이 번들에서 성공할 수 없다. 각 기존 Adapter의 named-handler/intent gate도 유지된다.

## 안전성

- Production ref와 n8n 문자열을 생성 SQL에서 허용하지 않는다.
- 공개 write endpoint는 하나이며 authenticated만 실행한다.
- 새 helper와 private relation은 브라우저 역할에 직접 노출하지 않는다.
- 새로운 public operational read는 authenticated에만 실행을 허용하고 내부에서 기존 UUID scope 함수를 재사용한다.
- 각 delta의 기존 drift guard와 postcondition을 제거하지 않는다.
- 최종 postcondition이 21-op allowlist, private helper/relation ACL, 공개 endpoint ACL을 다시 확인한다.
- rollback은 final layer부터 역순으로 수행하며 frozen 4-op constraint와 기존 public read/write로 돌아왔는지 확인한다.
- 단, `inquiry_purge`가 runtime에서 한 번이라도 실제 삭제를 수행하면 migration rollback은 삭제된 업무행을 조작해 복원하지 않고 중단한다. 이 경우 Production 복구는 backup/PITR runbook 영역이다.

## 판정

2026-09-06 SELECT-only preflight에서 허용된 Staging ref, frozen function 4개의 OID/definition hash/ACL/config, 두 allowlist 및 모든 후보 object 부재가 다시 일치했다. 최신 Supabase Data API grant 변경에 대비해 공개 함수는 명시적으로 grant하고 private helper/relation은 브라우저 역할에서 revoke하는 현재 방식을 유지한다.

`LOCAL_CUMULATIVE_CANDIDATE_NOT_APPLIED`. 로컬 원자 apply/late-failure rollback/full reverse rollback 검증과 live baseline 일치 뒤에도 실제 Staging JWT/browser 검증 전에는 PASS가 아니다.
