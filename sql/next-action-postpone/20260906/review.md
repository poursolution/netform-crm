# P09X PC/mobile Today 연기 — 로컬 호환 후보

판정: `DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED`.

PC `todoDelay`와 mobile `applyTodayPostponeM`의 Deal 경로는 현재 open Next Action의 기한을 뒤로 미루고 연기 횟수를 표시하는 같은 의미다. 외부 op는 `next_action`을 유지하고 내부 intent만 `postpone`으로 분리한다. Overlay는 actor-scoped read에서 받은 실제 Action UUID를 payload에 보충하며 임시 `na-*` ID는 거절한다.

서버는 Action UUID가 해당 Deal의 현재 open Action인지, 새 날짜가 기존 날짜와 서버 KST 오늘보다 뒤인지, Deal version과 write scope가 일치하는지 확인한다. 같은 Action row의 due를 갱신하고 append-only 연기 event, `meaningful_contact=false` Activity, Deal summary/version, audit와 receipt를 한 transaction으로 기록한다. `postpone_count`는 client 값을 버리고 Deal별 event 수로 서버가 계산해 read/ACK에 반환한다. 이 범위는 Golden PC의 `itemPatch(deal).postponeCount`와 mobile의 `deal.postpone`가 모두 Action이 아니라 Deal에 붙는다는 근거를 따른다.

문의 Today 연기는 기존 `inquiry_followup` 후보를 그대로 사용한다. 메시지 예약 M04, 일반 Next 생성 P09, 완료 P10/P11과 의미를 합치지 않는다. Rollback은 event/audit/receipt를 archive하고 이미 변경된 업무 기한과 Activity는 보존하며 M04 계층을 복원한다. Staging DDL/DML은 수행하지 않았다.
