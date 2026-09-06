# inquiry_assign / direct_assign — Staging 적용 전 검토

상태: `DERIVED_SAFE / LOCAL_CANDIDATE_NOT_APPLIED`

## 범위

- 연결: 본사 개인 최초 배정, 사유가 있는 본사 개인 재배정
- 보류: `branch_handoff`, `branch_owner_assign`, `response_update`
- 외부 op 이름: `inquiry_assign` 유지
- Staging/Production DDL·DML: 실행하지 않음

## 서버 계약

- `inquiry_id`는 UUID만 허용한다.
- Adapter는 `response` 또는 경남지사 표지가 있는 payload를 연결하지 않는다.
- direct payload는 `{intent:'direct_assign',to_name,reason?}`로만 정규화한다.
- 서버는 현재 inquiry와 actor를 다시 읽고, 승인·활성·미만료 `permission_role='rep'` 사용자의 UUID만 `assigned_to`에 기록한다.
- 최초 배정만 초기 상태를 `배정완료`로 바꾸며 재배정은 상태를 유지한다.
- 재배정 사유가 없으면 거절한다.
- client `from/status/changed_by/actor_name/at`은 권한 또는 감사 정본으로 사용하지 않는다.
- `assignment_history`와 private `crm_security.inquiry_audit_events`는 같은 트랜잭션에 기록한다.
- 기존 `command_receipts`에 `inquiry_assign`만 추가하고 동일 request replay와 payload 재사용 충돌을 유지한다.

## ACK 호환

서버 ACK는 `ok`, `operation`, 내부 `request_id`, object/actor UUID, `intent`, 최종 담당 UUID·상태, private audit event UUID를 반환한다. Compatibility Adapter가 기존 `write_id`를 다시 붙이므로 PC/모바일 `WriteAck`의 `{ok:true, write_id, operation}` 검사를 유지한다.

## Rollback

Rollback은 이전 Dispatcher 정의와 receipt operation constraint를 복원한다. 이미 생성된 문의 receipt/audit은 삭제하지 않고 private archive schema로 옮긴다. 실제 inquiry와 `assignment_history`의 업무 증거도 되돌리거나 삭제하지 않는다.
