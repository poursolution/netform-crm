# 견적문의 도메인 후보 판정 — 2026-09-06

상태: `LOCAL_CANDIDATE_ONLY / STAGING_NOT_APPLIED`

적용 파일 해시는 같은 디렉터리의 `manifest.json`을 정본으로 하며 `node scripts/crm-inquiry-domain-candidate.cjs`로 재생성한다.

## 판정

| 기능 | 판정 | 근거 / 부족한 규칙 |
|---|---|---|
| `inquiry_unassign` | `DERIVED_SAFE` | 실제 Staging의 `assigned_to uuid`, `assigned_at`, `status`, `first_response_at`, `responded_at`, 기존 `assignment_history`만으로 UI의 회수 의미를 보존할 수 있다. 사유는 필수이고 actor/시각/현재 상태는 서버가 확정한다. |
| `inquiry_status` (`보류`) | `NEEDS_VERIFICATION` | UI가 요구하는 `hold_reason`, `held_at` 및 상태변경 이력이 실제 Staging에 없다. `close_reason`을 대용하면 의미가 바뀐다. |
| `inquiry_trash` / `inquiry_restore` | `NEEDS_VERIFICATION` | 실제 Staging에 `deleted_at/by`, `delete_reason/note`, `purge_at`, `archive_protected`, `trash_snapshot`, `restored_at/by`, `valid_inquiry`가 없다. `raw`에 임의 저장하지 않는다. |
| `inquiry_consultant` | `NEEDS_VERIFICATION` | 실제 Staging에 `consultant_name`, `consulted_at`, `consultation_status`, 상담 이력 테이블과 UUID 대상 FK가 없다. 과거 text 기반 후보 SQL은 재사용하지 않는다. |
| `inquiry_followup` | `NEEDS_VERIFICATION` | `inquiries.next_action_date`와 `next_actions`는 존재하지만 payload에는 기존 action 식별자·제목·유형이 없고, 현재 모바일 `buildToday()`는 inquiry의 저장된 후속일을 소비하지 않는다. update/create 및 새로고침 의미가 유일하지 않다. |

`response_update`, `branch_handoff`, `branch_owner_assign`은 기존 `BLOCKED` 판정을 유지한다.

## `inquiry_unassign` 계약

- 호출 권한은 현재 `direct_assign`과 같은 승인·미만료 `permission_role='admin'` 및 inquiry scope로 제한한다.
- 입력 정규형은 `{reason}`뿐이다. 기존 payload의 `from`, `changed_by`, `at`, `status`는 Adapter 표시값이며 서버 권한·감사 정본으로 사용하지 않는다.
- 현재 담당자가 있으면 `assigned_to`와 `assigned_at`을 비운다.
- `first_response_at`과 `responded_at`이 모두 없을 때만 상태를 `접수`로 돌리고, 하나라도 있으면 기존 상태를 유지한다.
- 변경 시 기존 `assignment_history`에 `from → 미배정`, 사유, 서버 actor와 서버 시각을 정확히 한 건 기록한다.
- 기존 private `inquiry_audit_events`와 `command_receipts`를 재사용한다. 같은 request replay는 업무·이력·감사를 추가하지 않고, 다른 payload 재사용은 `PT409`이다.
- ACK는 `{ok:true, operation:'inquiry_unassign', request_id, object_id, actor_auth_uid, actor_user_id, changed, status, ...}`이며 이후 Compatibility Adapter가 원래 `write_id`를 붙일 수 있다.
- 이미 미배정이면 멱등 no-op ACK와 receipt만 남기고 history/audit은 만들지 않는다.

## 동결 경계

- `crm_write_command_v2`와 기존 `opportunity_work_set` / `inquiry_assign:direct_assign` 분기는 수정하지 않는다. Candidate와 rollback은 snapshot 정의 MD5를 검사한다.
- Compatibility Adapter도 이번 후보에서 변경하지 않는다. 따라서 이 SQL은 Staging 적용본이 아니며 UI 연결 전 별도 adapter review가 필요하다.
- Staging DDL/DML, Production, n8n, 운영 Pages 접근은 수행하지 않았다.

## Rollback

Rollback은 전용 RPC와 두 allowlist 확장만 제거한다. 이미 생긴 unassign receipt/audit은 비노출 private archive schema로 이동하고, assignment history 및 현재 inquiry 업무상태는 삭제하거나 되돌리지 않는다.
