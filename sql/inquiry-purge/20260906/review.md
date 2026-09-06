# Inquiry manual purge — local candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE / NOT APPLIED`.

현재 PC의 관리자 휴지통에서만 `inquiry_purge`가 도달 가능하다. UI는 복구 불가 확인 뒤 즉시 완전삭제하며, Golden도 30일 만료 전 수동 삭제를 허용한다. 30일은 자동삭제 후보 시점이지 관리자 수동삭제의 대기시간이 아니다.

서버 계약은 admin + 현재 문의 scope, latest private state가 `inquiry_trash`, 양방향 Deal lineage 없음, server actor/time, exact request receipt다. client `purged_at/purged_by`는 버린다. 실제 FK의 `assignment_history`, `next_actions`, `stage_history`는 inquiry 삭제와 함께 cascade되고, RESTRICT인 `crm_security.object_scope`는 같은 transaction에서 먼저 제거한다. private inquiry audit와 receipt는 FK가 없어 purge 증거를 보존한다.

연결 보호는 trash 당시 flag만 믿지 않고 실행 시점에 `inquiries.deal_id`, `inquiries.opportunity_id`, `deals.origin_inquiry_id`를 모두 다시 검사한다. 자동 purge, non-admin purge, active/restored inquiry, 임의 payload는 차단한다. AAL2를 새로 요구하면 현재 admin UI/Golden 동작을 바꾸므로 이 호환 후보에는 추가하지 않는다.

런타임 purge는 의도적으로 복구 불가다. 따라서 migration rollback은 purge receipt/audit가 한 건도 없을 때만 실행된다. 실제 purge 후 schema rollback으로 삭제된 영업 데이터를 추측 복원하지 않는다.
