# P09M mobile Today Deal 결과 — 로컬 호환 후보

판정: `DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED`.

현재 최종 mobile Today에서 실제 도달 가능한 Deal 결과 흐름은 `startTodayCall → callFlow → pickToday`이다. 이전 렌더러의 `quick/pickSkip`은 최종 `rToday/execTaskRowM`에서 호출되지 않으므로 dead code로 분리한다.

외부 op는 첫 child인 `next_action_complete`를 유지하고 내부 intent `today_outcome`만 추가한다. 허용 결과는 기존 세 칩과 일대일인 `progress / next_week / missed`다. 서버는 actor-scoped read가 공급한 현재 open Action UUID, Deal version, UUID owner와 권한을 재확인한다.

한 transaction에서 현재 Action 완료, 다른 legacy open Action 취소, 결과 Activity, 서버 KST 기준 3/7/1일 replacement Next Action, Deal summary/version/contact timestamp, private audit와 receipt를 기록한다. `next_week`만 Golden의 Deal 단위 연기 횟수를 증가시키며 P09X와 같은 private append-only ledger를 사용한다. 클라이언트 시간·Activity·Next 문구·연기 횟수는 정본으로 받지 않는다.

Overlay는 `pickToday` Deal 문맥에서 첫 `next_action_complete`만 parent command로 보내고 이어지는 `activity`와 `next_action`을 흡수한다. 문의 결과는 기존 `inquiry_assign/response_*` 후보를 그대로 사용한다. 전화 앱 열기 전 시도 Activity(M01A)도 별도 사용자 행동으로 유지한다.

Rollback은 Today 전용 event/audit/receipt를 private archive로 옮기고 P09X 계층을 복원한다. 이미 완료된 Action, replacement Next와 Activity 같은 업무 증거는 삭제하지 않는다. Staging DDL/DML은 수행하지 않았다.
