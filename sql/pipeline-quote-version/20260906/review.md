# P14 quote_version — local chained candidate

상태: `LOCAL_CHAIN_CANDIDATE_AFTER_ACTION / STAGING_NOT_APPLIED`

PC와 모바일의 최종 handler는 모두 `quote_version`에 양수 금액과 2자 이상 조정 사유를 보낸다. 과거 Golden SQL도 Deal row lock 아래 서버가 다음 version을 계산하고 append-only 이력을 남기는 의미다. 따라서 이 하위 의미는 `DERIVED_SAFE` 후보다.

- client `version_no/created_at/created_by`는 권한·순서·감사 정본으로 사용하지 않는다.
- 서버가 Deal lock, can_deal(write), expected version, receipt를 확인하고 다음 quote version을 계산한다.
- 실제 DB에 없는 `deals.quote_amount`를 만들거나 `deals.amount`에 견적을 덮어쓰지 않는다. private `crm_security.quote_versions`에 보존하고 기존 Deal version만 1 증가시킨다.
- private audit와 기존 ACK correlation을 유지한다.
- 동일 request replay는 이력/audit 0건 추가, 다른 payload 재사용과 stale version은 409다.
- P05의 예상/견적/수주 3축 동시 편집, won amount, close/expansion은 계속 `NEEDS_VERIFICATION`이다.

이 후보는 T03과 pipeline action 8-op layer 뒤에 순서대로 적용해야 한다. live OID/hash guard와 Staging JWT/PC/mobile 검증 전에는 적용 가능 또는 PASS로 계산하지 않는다. rollback은 quote rows/receipt를 private archive로 옮기고 8-op action layer를 복원한다.
