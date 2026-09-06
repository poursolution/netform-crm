# M04 담당자 발송 알림 예약 — 로컬 호환 후보

판정: `DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED`.

현재 PC `relationshipSchedule`과 mobile `rmScheduleM`은 동일한 의미다. 문자·카카오를 자동 발송하지 않고, 지정 시각에 Deal 담당자가 직접 실행하도록 알림을 만든다. 기존 외부 op `next_action`과 ACK를 유지하고 내부 intent만 `message_reminder`로 분리한다.

한 transaction에서 현재 open Deal Next Action을 취소하고 새 `메시지발송` Next Action, private 예약 metadata, `meaningful_contact=false` Activity, Deal version, private audit와 공통 receipt를 기록한다. 담당자는 현재 Deal owner UUID에서 서버가 확정하며 Auth/CRM actor와 시각도 서버 정본이다. `scheduled_at`의 Asia/Seoul 날짜와 `due_at`이 일치해야 하고 과거 예약은 거절한다.

예약 metadata는 `crm_security.message_reminders`에 보존하고 actor-scoped `deal_core.next_action`에만 투영한다. 기존 relation의 의미를 바꾸지 않는다. 이 후보는 provider 발송·delivery, campaign queue, M02 발송결과를 구현하거나 성공으로 간주하지 않는다.

Rollback은 metadata/audit/receipt를 private archive로 옮기고 X02 계층을 복원한다. 이미 생성된 업무 Next Action과 Activity는 삭제하지 않는다. Staging DDL/DML은 수행하지 않았다.
