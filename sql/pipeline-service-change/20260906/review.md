# Pipeline `service_change` — local candidate review

상태: `DERIVED_SAFE / LOCAL_CANDIDATE_NOT_APPLIED`

## 범위

- 외부 op와 ACK의 `operation`은 기존 `service_change`를 유지한다.
- Staging에서 이미 PASS한 `opportunity_work_set`, `inquiry_assign/direct_assign` 함수 body는 수정하지 않는다. 기존 함수 OID/body를 private 이름으로 이동하고 새 Dispatcher가 두 op를 그대로 위임한다.
- `branch_handoff`, Stage, 금액, 일반 Activity/Next Action op는 연결하지 않는다.
- Staging/Production/n8n/Pages에는 접근하거나 적용하지 않았다.

## 서버 계약

- 대상 Deal과 `expected_version`을 서버에서 잠그고 `crm_security.can_deal(id,true)` 및 `rep/branch/admin` 역할을 검사한다.
- Auth UUID와 CRM user UUID는 `crm_security.actor()`가 확정한다. client `from_service`, `origin_channel`, `at`, actor 표시는 권한·시간·기존값 정본으로 쓰지 않는다.
- 기존 `apply_business_change()`와 동일하게 `from=coalesce(current_business,brand)`, `current_business/brand/service_type=to`, `origin_business=coalesce(origin_business,from)`을 적용한다.
- 사유는 trim 후 최소 5자이며, `business_history` public row와 `deals.business_history` JSON entry에 동일한 from/to/reason/source/server actor/time을 기록한다.
- `activities`에는 server actor/time으로 `사업유형전환` 1건을 같은 transaction에서 기록한다. meaningful customer contact가 아니므로 `last_customer_contact_at`은 변경하지 않고 `last_activity_at`만 갱신한다.
- optional `next_action`은 실제 `apply_business_change()` 규칙만 유지한다: `기타/open`, 지정일 또는 `current_date+3`, date cast 뒤 `+09:00`, server actor 이름. 기존 open action 취소나 `deals.next_action*` 동기화는 이 후보 범위에 넣지 않는다.
- Deal version은 사용자 command당 1회 증가하고 private `audit_events`와 `command_receipts`가 같은 transaction에 기록된다.

## UI Activity 중복 방지 계약

현재 Mobile `commitBiz()`는 `addActivity()`를 호출한 뒤 `service_change`를 enqueue한다. PC도 로컬 Activity를 먼저 만든다. 서버 command가 Activity 1건을 원자적으로 생성하므로, Compatibility Adapter 연결 시 **같은 service-change 사용자 행동에서 파생된 별도 Activity queue item은 전송하지 않는다.**

- 서버가 생성하는 Activity가 유일한 durable row다.
- 사용자가 Activity 화면에서 독립적으로 입력한 `activity` op는 억제하지 않는다.
- 구분은 시간/문구 추측이 아니라 parent write ID 또는 명시적인 local correlation으로 해야 한다.
- service-change replay는 receipt ACK만 반환하므로 Activity/history/Next/audit를 추가하지 않는다.

이번 후보는 기존 `staging-write/compat-adapter.js`를 수정하지 않는다. 따라서 UI 연결 전 adapter가 legacy payload를 `{to_service,reason,reason_source,next_action,next_due}`와 허용된 표시 필드로 정규화하고 위 중복 억제 계약을 구현해야 한다.

## ACK

기존 공통 `{ok:true, write_id, operation:'service_change'}` 소비 계약을 유지한다. RPC ACK는 request/object/actor UUID, previous/current version, server from/to, business history/activity/optional next/audit ID를 반환한다. Compatibility Adapter는 검증 후 기존 `write_id`만 다시 붙인다.

## Rollback

Rollback은 새 wrapper를 제거하고 동일 OID/body의 frozen Dispatcher를 원래 public 이름으로 되돌린다. `service_change` receipt는 삭제하지 않고 private archive schema로 복사한 뒤 live constraint에서 분리한다. 이미 생긴 Deal/history/activity/Next/audit 업무 증거는 삭제하거나 역변경하지 않는다.

