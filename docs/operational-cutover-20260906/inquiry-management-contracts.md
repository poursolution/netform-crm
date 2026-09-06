# 견적문의 관리 묶음 계약 대조

작성일: 2026-09-06  
대상: `inquiry_status`, `inquiry_followup`, `inquiry_trash`, `inquiry_restore`, `inquiry_purge`, `inquiry_reclassify`, `inquiry_consultant`, `inquiry_duplicate`  
검증 범위: Golden PC/mobile, Actual snapshot 및 명시된 Staging read-only preflight 대조. Staging DDL/DML 없음.

## 최종 판정

| Operation | 현재 reachability | 원자 경계 | 최종 판정 | 부족한 규칙 한 줄 |
|---|---|---|---|---|
| `inquiry_status` · 보류 | PC Control Center에서 reachable | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | `sql/inquiry-hold/20260906`가 actual status와 private audit/receipt, sanitized hold read projection을 한 transaction으로 연결한다. Staging 미적용. |
| `inquiry_status` · 기술자문 영업전환 | `opportunity_create` 뒤 호출됨 | `DERIVED_SAFE` | `NEEDS_VERIFICATION` | Deal 생성·lineage·문의 상태를 한 transaction으로 묶는 Pipeline 계약이 먼저 확정돼야 한다. |
| `inquiry_followup` | Mobile 오늘 할 일의 문의 연기에서 reachable | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | `sql/inquiry-followup/20260906`가 exact scalar `next_action_date`와 Mobile Today 소비, private audit/receipt를 연결한다. generic Next 생성은 차단한다. Staging 미적용. |
| `inquiry_trash` | PC 단건/일괄 휴지통에서 reachable | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | `sql/inquiry-trash-restore/20260906`가 private current-trash state·snapshot·서버 purge/protection·receipt와 scoped projection을 연결한다. Staging 미적용. |
| `inquiry_restore` | PC 휴지통 row에서 reachable | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | 같은 후보가 원 영업상태/담당자를 변경하지 않은 채 latest restore state와 서버 actor/time을 기록한다. Staging 미적용. |
| `inquiry_purge` | PC 관리자 휴지통 row에서 reachable | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | `sql/inquiry-purge/20260906`가 latest trash·admin scope·양방향 lineage·scope/FK cascade·private audit/receipt를 연결한다. 자동 purge는 차단한다. Staging 미적용. |
| `inquiry_reclassify` | PC 기존 기술자문 검토에서 reachable | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | `sql/inquiry-reclassify/20260906`가 brand 변경·서버 review actor/time·private audit/receipt와 sanitized read history를 한 transaction으로 연결한다. Staging 미적용. |
| `inquiry_consultant` | PC 빠른 메뉴에서 지정·해제 reachable | `DERIVED_SAFE` | `NEEDS_VERIFICATION` | UUID 상담대상 eligibility, consultant fields/history, legacy 영업담당 해제와 상태 전환 규칙의 actual 정본이 필요하다. |
| `inquiry_duplicate` | 현재 quick menu에서는 직접 호출 불가 | 해당 없음 | `CONFIRMED_DEAD_REPLACED` | 기존 op를 구현하지 말고 실제 reachable `crm_cleanup_preview/apply` 흐름을 별도 Data Cleanup 계약으로 검증해야 한다. |

`DERIVED_SAFE`는 한 사용자 행동에서 함께 commit/rollback되어야 할 row 집합에 대한 판정이다. 실제 schema에 없는 필드를 `inquiries.raw`, `close_reason`, `stage_history.reason` 등에 임의로 접어 넣지 않는다. 후속 검증에서 `inquiry_reclassify`, 보류, 휴지통/복원/수동 완전삭제, 문의 후속일이 기존 actual field와 private inquiry audit을 사용해 저장 정본이 확정됐고, 나머지 operation은 계속 `NEEDS_VERIFICATION`이다.

## Reachable 근거

- PC 보류: `crm.html:7815-7816`
- PC 기술자문 이관의 상태 변경: `crm.html:7788`
- Mobile 문의 후속 연기: `mobile.html:2380-2381`
- PC 휴지통/복원/완전삭제: `crm.html:7817-7822`
- PC 기술자문 재분류: `crm.html:7787`
- PC 상담담당 지정·해제: `crm.html:7823-7824`
- PC 빠른 메뉴의 중복 버튼: `crm.html:7825-7827`
- 사용되지 않는 legacy duplicate handler: `crm.html:7828`

PC split view의 일반 상태 선택 `splitSaveStatus()`는 `crm.html:6505-6518`에서 로컬 상태만 바꾸고 `inquiry_status`를 전송하지 않는다. qualified 상태는 이어서 `transition` 또는 `opportunity_create`를 보낼 수 있지만 문의 상태 자체의 server write는 없다. 따라서 이 control은 현재 op 계약으로 포함할 수 없으며 별도 UI transport 누락이다.

`inquiry_duplicate`도 마찬가지로 문자열이 존재한다고 reachable op로 세면 안 된다. 현재 빠른 메뉴는 `inqCtlOpenDuplicate()`에서 Data Cleanup 화면으로 이동하여 `crm_cleanup_state`, `crm_cleanup_preview`, `crm_cleanup_apply`를 사용한다. `inqCtlResolveDuplicate()`의 호출 UI는 없고 `dead-overrides.csv` D03에도 대체 경로로 기록돼 있다.

## Actual Staging 대조

### 현재 있는 필드와 테이블

`inquiries`에는 UUID `id`, `brand`, `status`, UUID `assigned_to`, `assigned_at`, `first_response_at`, `responded_at`, `next_action_date`, `close_reason`, `deal_id`, `opportunity_id`, `raw`, `updated_at`이 있다.

연관 public table은 다음과 같다.

- `assignment_history`: inquiry FK가 있지만 assignment 전용이며 from/to가 text다.
- `stage_history`: inquiry FK와 UUID actor가 있지만 stage transition 전용이다.
- `next_actions`: inquiry FK가 있고 title/type/due/assignee/status를 요구한다.
- `activities`: Deal/organization FK만 있고 inquiry FK가 없다.

현재 private `inquiry_audit_events`와 `command_receipts`는 존재하지만 action/operation CHECK가 frozen 완료 기능만 허용한다. 요청 대상 8개는 현재 Dispatcher allow-list에 없다.

### 현재 없는 필드와 정본

`response_update` 재검토(2026-09-06): 실제 Staging에는 `first_response_at`, `responded_at`, `next_action_date`가 있고, 과거 `business-v2`의 `crm_inquiry_response_scoped_v2()`는 최초시각을 `coalesce`로 보존하면서 마지막 응대시각을 서버에서 기록한다. 최종 모바일은 세 결과의 status와 3/7/1일 동작을 명시하고, 미응대 KPI는 `first_response_at IS NULL`을 사용한다. 이에 따라 세 결과를 별도 내부 intent로 분리하고 private `inquiry_audit_events`와 actor-scoped sanitized history를 공통 정본으로 쓴다.

- 보류: 물리 컬럼은 없으며 local candidate가 private audit의 `reason/created_at/server actor`를 `hold_reason/held_at/held_by`와 status change history로 제한 투영한다.
- 휴지통: 물리 컬럼은 없으며 local candidate가 private audit의 latest trash/restore 사건을 `valid_inquiry`, `deleted_at/by`, `delete_reason/note`, `purge_at`, `archive_protected/reason`, `trash_snapshot`, `restored_at/by`로 제한 투영한다.
- 재분류: `business_type`, `legacy_review_status`, `legacy_reviewed_at/by`, inquiry data-cleanup history
- 상담담당: `consultant_id/name`, `consulted_at`, `consultation_status`, consultation history
- 중복 legacy op: `duplicate_resolution`, UUID `duplicate_of_inquiry_id`, `duplicate_reviewed_at/by`

`crm_read_scoped_v2`도 위 필드를 반환하지 않는다. soft-delete 상태를 쓸 장소만 추가하고 read projection을 그대로 두면 휴지통/복원이 새로고침 뒤 사라지며, consultant/reclass review도 동일하다.

Golden `20260905_inquiry_control_center.sql`과 `20260905_people_roles_and_consultation.sql`은 의도 증거지만 actual schema와 다르다. text ID/actor/assignee, client-supplied time, broad authenticated policy, 공개 `SECURITY DEFINER` 함수 형태를 그대로 재사용하지 않는다.

## Operation별 원자 경계

### `inquiry_assign / response_*`

최종 모바일의 `pickToday()`와 `recordInquiryResponse()`가 보내는 세 payload는 label/status 조합으로 서로 유일하게 구분된다. 각각 `response_progress`, `response_next_week_retry`, `response_missed_retry`로 정규화하며 client actor/time/status는 저장 정본이 아니다.

서버는 current assigned UUID와 actor UUID가 같은 승인된 `rep` 또는 `consultation`인지 확인한다. 진행과 다음주 응답은 `first_response_at`을 한 번만 기록하고 `responded_at`을 갱신한다. 다음주 응답은 status `응대중`과 서버 KST+7의 `next_action_date`를 함께 저장한다. 부재는 미응대 KPI를 보존하도록 두 응대 timestamp를 변경하지 않고 status `배정완료`와 서버 KST+1의 후속일만 저장한다. private inquiry audit·receipt·기존 `inquiry_assign` ACK를 같은 transaction에 두며 Auth UUID는 read projection에 노출하지 않는다.

따라서 세 응대 결과는 모두 `DERIVED_SAFE_LOCAL_CANDIDATE`다. 두 모바일 handler, 결과별 timestamp/status/follow-up, rep/consultation 자기 담당 범위, foreign/closed 차단, replay/reuse, audit 실패 rollback, read-back, evidence-preserving migration rollback을 로컬에서 검증한다. 알 수 없는 label/status 조합은 UI가 로컬 상태를 바꾸기 전에 차단한다.

### `inquiry_status`

보류는 inquiry lock과 server current status 확인, `status='보류'`, hold reason/time, status history, 사용자에게 보이는 Activity 또는 동등한 inquiry history, private audit, receipt를 한 transaction으로 처리해야 한다. client `from_status/changed_by/at`은 현재값·actor·시각 정본이 아니다.

기술자문 영업전환은 별도 status command로 성공시키면 안 된다. Deal UUID 생성, `deals.origin_inquiry_id`, 문의 Deal back-link/상태/review metadata, 양쪽 history/audit/receipt가 한 transaction이어야 한다. Pipeline create가 실패하면 문의 상태도 그대로여야 한다.

현재 Control Center의 일괄 보류는 N개의 독립 request를 만든다. 업무 원자성은 최소 inquiry 1건 단위로 확정되지만, 화면이 “N건 처리” 성공을 언제 표시할지와 batch all-or-nothing 여부는 payload에 batch ID가 없어 확정되지 않았다.

후속 후보는 같은 외부 `inquiry_status` 중 `to_status='보류'`이고 사유가 있는 Control Center payload만 `intent='hold'`로 정규화한다. Actual `inquiries.status`를 변경하고 private audit에 원래 status와 사유·서버 시각·서버 actor를 보존하며, scoped read는 그중 UI에 필요한 `hold_reason/held_at/held_by` 및 `상태변경` history만 반환한다. 이미 보류인 문의의 새 request, 기술자문 `영업전환`, 임의 상태 전환, 보류 해제는 모두 차단한다.

따라서 보류 전환은 `DERIVED_SAFE_LOCAL_CANDIDATE`로 승격했으며, live schema/ACL guard와 Staging JWT/PC 단건·일괄/replay/read-back 검증 전에는 PASS가 아니다. 보류 해제의 별도 저장 규칙은 여전히 미확정이지만 단방향 hold command의 정본을 막지는 않는다.

### `inquiry_followup`

현재 reachable payload는 `inquiry_id`, 날짜형 `due_at`, 고정 reason `담당자 연기`뿐이고 Actual `inquiries.next_action_date`와 scoped inquiry source가 같은 필드를 이미 가진다. 이 사용자 행동에는 existing action UUID, title, type, assignee가 없으므로 generic `next_actions` row를 새로 만들거나 교체하지 않는다.

후속 후보는 current assigned UUID actor와 scope를 확인하고 KST 기준 미래 1~365일만 scalar에 저장한다. status/assignment는 유지하며 private audit/receipt를 같은 transaction으로 남긴다. Mobile overlay가 `inquiryViewM()`에서 persisted due를 보존하고 `buildToday()`에서 미래 문의는 숨기며 당일/지난 후속은 today/overdue로 다시 표시한다.

따라서 `inquiry_followup`은 `DERIVED_SAFE_LOCAL_CANDIDATE`로 승격했다. 동일 request replay, reuse conflict, same-date conflict, 타 담당·휴지통 문의 차단을 로컬에서 검증했다. 자동 알림과 generic Next 생성은 별도 의미로 계속 차단한다.

### `inquiry_trash` / `inquiry_restore`

Trash는 server current status/assignment snapshot, server deleted time/actor, validated reason/note, server-calculated purge time, 모든 Deal lineage를 검사한 archive protection, active read 제외, history/audit/receipt를 함께 기록한다. client `archive_protected`와 `purge_at`은 정본으로 쓰지 않는다.

Restore는 persisted snapshot과 현재 row를 잠그고 latest trash 상태를 해제하며 restore history/audit/receipt를 남겨야 한다. 현재 UI trash는 status/assignee를 지우지 않고 snapshot만 보관하므로 서버도 그 업무값을 덮어쓰지 않고 unhide한다. 이 방식이 “삭제 직전 상태와 담당자로 복원” 문구를 원값 손실 없이 만족한다.

일괄 trash 역시 N개 독립 request다. 한 inquiry의 transaction 경계는 확정되지만 batch 결과 표시와 부분실패 UX는 미확정이다.

후속 후보는 Actual `inquiries`의 영업 status/assigned UUID/time을 trash 시 변경하지 않고 private audit의 최신 `inquiry_trash` 또는 `inquiry_restore` 사건을 현재 soft-delete 상태로 사용한다. Trash는 서버가 원 상태 snapshot, 삭제시각, 30일 purge 시각과 direct/reverse Deal lineage 보호를 계산한다. Restore는 latest trash가 있을 때만 허용하며 서버 actor/time을 기록한다. scoped read는 UI가 쓰는 삭제/복원 별칭만 투영하고 PC `inqCtlPartition()`과 모바일 활성 문의 필터가 이를 소비한다.

따라서 `inquiry_trash`와 `inquiry_restore`는 `DERIVED_SAFE_LOCAL_CANDIDATE`로 승격했다. 완전삭제는 뒤따르는 별도 candidate이며 자동 purge는 포함하지 않는다. live schema/ACL guard와 Staging JWT/PC 단건·일괄/mobile exclusion/replay/read-back 검증 전에는 PASS가 아니다.

### `inquiry_purge`

Purge는 destructive command다. PC 관리자 휴지통의 명시적 confirm이 즉시 수동삭제 override이고, 30일은 자동삭제 후보 시점이다. server는 latest persisted trash state를 확인하고 다음 모든 lineage를 검사한다.

- `inquiries.deal_id`
- `inquiries.opportunity_id`
- reverse `deals.origin_inquiry_id`
- 관련 assignment/stage/next history

Actual FK는 reverse Deal lineage를 `ON DELETE SET NULL`로 조용히 끊을 수 있으므로 UI의 `deal_id`만 확인하면 부족하다. `assignment_history`, `next_actions`, `stage_history`는 inquiry FK cascade 대상이고, `crm_security.object_scope`는 RESTRICT이므로 같은 transaction에서 먼저 명시 삭제한다. 삭제 전 private immutable audit에 full before snapshot, actor Auth/CRM UUID, request ID와 cascade count를 보존하고 delete와 receipt를 한 transaction으로 처리한다.

현재 UI와 Golden은 관리자 수동삭제에 AAL2를 요구하지 않는다. 새 AAL2 조건을 추가하면 현재 기능을 바꾸므로 호환 candidate는 active/approved/unexpired admin + inquiry scope만 요구한다. client `purged_at/purged_by`는 버리고 `{intent:'purge'}`만 canonical payload로 쓴다.

`inquiry_purge`는 `DERIVED_SAFE_LOCAL_CANDIDATE`로 승격했다. runtime purge는 UI 문구대로 복구 불가이므로 migration rollback은 purge audit/receipt가 0건인 사용 전 상태에서만 허용한다. 삭제 데이터를 추측 복원하지 않는다. 자동 purge는 scheduler·운영 승인·배치 감사 계약이 없어 계속 차단한다.

### `inquiry_reclassify`

Server가 current `brand='기술자문'`인지 확인하고 허용된 견적문의 brand로만 변경해야 한다. original brand, review status/time, server actor, 사용자에게 보이는 데이터정리 history, audit/receipt가 한 transaction이다. client `from_brand/reviewed_at/reviewed_by`는 정본이 아니다.

후속 후보는 Actual `brand`를 변경하면서 기존 `crm_security.inquiry_audit_events`에 `review_status/reviewed_at/reviewed_by`를 서버 정본으로 기록한다. scoped inquiry read는 이 audit 중 `inquiry_reclassify`의 sanitized 필드와 `데이터정리` history만 투영하므로 raw 감사 UUID나 임의 JSON 업무필드를 공개하지 않는다. 연결 Deal(`deal_id`, `opportunity_id`, reverse `deals.origin_inquiry_id`)이 하나라도 있으면 409로 막고 기술자문 이관 의미와 섞지 않는다.

따라서 `inquiry_reclassify`는 `DERIVED_SAFE_LOCAL_CANDIDATE`로 승격했으며, live schema/ACL guard와 Staging JWT/PC button/replay/read-back 검증 전에는 PASS가 아니다.

### `inquiry_consultant`

Inquiry lock, server current consultant와 legacy sales owner 확인, target UUID eligibility, consultant current row/history, 조건부 `assigned_to/assigned_at` clear, 조건부 status 전환, Activity/history, audit/receipt가 한 transaction이다.

UI는 회사 상담역과 상담 가능한 영업담당을 모두 후보로 보지만 actual `users.role`에는 consultant가 없고 `access_review.permission_role`에는 `consultation`이 있다. 2026-09-06 Staging read-only preflight에서 `public.sales_people`는 존재하지 않았고, reviewed identity는 `admin`, `rep`, `branch`, `consultation`까지만 구분됐다. 활성 사용자 이름 중복은 0건이지만 이름 유일성은 상담 eligibility 정본이 아니다. 따라서 `permission_role='consultation'`만 허용해 UI 후보를 축소하거나 모든 `rep`를 허용해 권한을 확대하지 않는다. 기존 영업담당이 상담역이었다는 legacy 판정도 같은 UUID eligibility 정본이 생기기 전에는 확정할 수 없다.

판정은 `NEEDS_VERIFICATION_BLOCKED`다. **부족 규칙 한 줄:** 상담 가능한 `rep`와 회사 상담역을 함께 식별하는 UUID 기반 eligibility 정본을 승인해야 한다. 이름을 UUID 정본 대신 사용하지 않는다.

### `inquiry_duplicate`

기존 `inquiry_duplicate`는 구현 대상이 아니다. 현재 reachable Data Cleanup은 server preview fingerprint를 확인한 뒤 `crm_cleanup_apply` 하나로 `inquiry_merge`, `inquiry_activity`, `site_link`, `separate`, `defer` 등을 처리하는 별도 업무다. legacy `linked/keep_separate` 2분기와 의미가 같지 않다.

또한 actual snapshot에는 `crm_cleanup_state/preview/apply` 함수가 없으므로 replacement 화면 자체는 별도 coverage에서 `NEEDS_VERIFICATION`으로 남겨야 한다. 이 문제를 죽은 `inquiry_duplicate` op를 되살려 우회하지 않는다.

## 공통 서버 계약

향후 확정된 command는 다음을 공통 적용한다.

1. JWT Auth UUID와 active/approved/미만료 CRM UUID/role을 서버에서 확정한다.
2. `can_inquiry()`와 intent별 admin/consultation/scope 권한을 검사한다.
3. client actor/time/current status는 정본으로 사용하지 않는다.
4. row lock 뒤 server current state와 version 또는 명시 sentinel을 검사한다.
5. 같은 request/canonical payload replay는 원 ACK, 다른 payload reuse는 409다.
6. core/history/audit/receipt를 한 transaction으로 처리한다.
7. 기존 `{ok:true, write_id, operation, ...}` ACK를 commit 뒤 반환한다.
8. public history ACL을 넓히거나 private schema를 Data API에 노출하지 않는다.

## 후보·테스트 결과

안전한 complete operation이 없어 candidate/rollback은 생성하지 않았다. `tests/inquiry-management-contracts.test.cjs`는 다음 차단 조건을 로컬에서 검증한다.

- 현재 reachable op와 legacy duplicate 비도달성
- actual 필드/테이블 부족
- `crm_read_scoped_v2` projection 부족
- purge 시 reverse Deal lineage가 `ON DELETE SET NULL`인 위험
- Dispatcher/receipt allow-list에 요청 op가 없음

규칙이 확정된 뒤 DB test에는 success/role denial/stale/replay/reuse, history/audit exact count, batch 부분실패, refresh parity, destructive purge lineage 보호, frozen 기능 회귀를 포함해야 한다.
