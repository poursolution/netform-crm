# 운영 전환 누적 후보 — 25 operations + 문의·Pipeline·기술자문·첨부 + Deal contact/attachment read

판정: `LOCAL_CUMULATIVE_CANDIDATE / NOT APPLIED`.

2026-09-06 Staging read-only preflight는 `PASS`다. `netform-crm-staging / rprechiaglyjaydkmxsu`를 다시 확인했고, 동결 4-op Dispatcher/read/private helper의 OID·정의 해시·ACL·`search_path`, receipt constraint, Deal/문의/사용자 핵심 컬럼, contact read와 `can_deal` 정규화 해시, Storage 사전조건이 누적 SQL guard와 일치했다. 이 결과는 적용 승인이나 JWT/E2E PASS가 아니며 DDL/DML은 수행하지 않았다. 증거는 `staging-readonly-preflight-20260906.json`이다.

현재 누적 외부 operation 수는 25개다. 기존 23-op 설명에 `attachment_prepare`, `attachment_complete`와 ready-only Deal attachment projection을 마지막 레이어로 추가했다. 첨부는 private pending metadata와 현재 JWT의 Supabase signed upload를 사용하고, complete가 실제 Storage owner/size/MIME를 검증한 뒤 ready로 전환한다. read에는 object path나 URL을 노출하지 않는다. SQL rollback은 Storage bytes를 삭제하지 않으며, 만료 pending/고아 object의 Storage API cleanup operator는 cutover 전 별도 gate다.

첨부 레이어 직전 23-op 기준에서 기존 `inquiry_assign` 안에 모바일의 세 응대 결과를 각각 `response_progress`, `response_next_week_retry`, `response_missed_retry`로 분리했다. 진행·다음주 응답만 first/last response timestamp를 갱신하고, 부재는 미응대 timestamp를 보존한다. 다음주와 부재는 각각 서버 KST 기준 7일·1일 후속일을 같은 transaction에 저장한다. 문의 응대/시도 이력은 private audit에 append-only로 남고 actor-scoped read에는 제한 필드만 반환한다.

PC 일반 문의의 기존 Deal 승격과 신규 Deal 생성은 각각 기존 외부 `transition`, `opportunity_create`를 유지하면서 내부 `inquiry_promote_existing`, `inquiry_promote_create`로 분리한다. 수동 lineage는 기존 `lineage_link` ACK를 유지한다. `deals.origin_inquiry_id`를 계보 정본으로 사용하고, inquiry advisory lock·적용 전 중복 preflight·서버 중복 검사를 결합해 inquiry당 Deal 하나를 보장한다. UI 조회는 명시 계보를 먼저 사용하고 이름 기반 조회는 legacy fallback으로만 남긴다.

PC 문의 상세의 비종료 단계 0~5는 기존 `inquiry_status` 아래 `progress` intent로 묶는다. 현재 status 일치, 한 일/결과, 다음 행동/기한을 서버가 검증하고 문의 status·최초/최근 응대시각·기존 open 후속 취소·새 Next Action·stage history·private audit·receipt를 한 transaction으로 저장한다. 보류와 실주/배드핏/연락두절은 별도 규칙이므로 이 intent에서 차단한다.

PC 문의 split/bulk의 Next 등록·교체, 현재 행동 완료, 고정 6개 응대 체크도 기존 `next_action`, `next_action_complete`, `stage_check` 외부 op를 유지한다. `inquiry_id` 기반 내부 intent일 때만 문의 helper로 분기하며 Deal의 version/저장 의미는 변경하지 않는다. 체크 상태는 새 public 업무 컬럼 대신 private append-only audit의 최신 값을 scoped read에 projection한다.

기존 frozen 4-op 위에 검증된 21-op 누적 후보, 직접 PC/mobile `opportunity_create`, Deal-scoped 연락처/근무이력 read, 문의 응대, 문의→Pipeline/lineage, PC 문의 진행·Next·체크, 기술자문 문의 이관을 순서대로 한 transaction에 합성한다. rollback은 그 역순이며 역시 한 transaction이다. 어느 마지막 단계가 실패해도 앞선 candidate schema가 남지 않는다.

기술자문 문의 이관은 외부 `opportunity_create` ACK를 유지하되 내부 `technical_inquiry_transfer` intent로만 허용한다. 서버가 현재 기술자문 분류·site UUID·승인된 선택적 rep UUID를 다시 읽고, owner/site가 없거나 부적격이면 `NULL`로 보존한다. 클라이언트 owner/site/amount/status/actor/time은 받지 않는다. 하나의 transaction이 기술자문 Deal, 문의 상태와 양방향 backlink, stage history, activity, Deal/문의 audit, admin object scope, receipt를 생성하며 기존 UI의 후속 `inquiry_status`는 흡수한다.

업무 command는 25개다. 일반 본사 문의 승격/생성, 기술자문 이관과 수동 lineage만 별도 intent로 허용하고, 경남 문의 승격·확장견적 전환은 계속 차단한다. 연락처 read는 기존 `crm_contacts_scoped_v2(uuid)`의 signature/OID/security-definer/ACL과 `can_deal` 경계를 유지한다. `contact_upsert`, `contact_relationship`, `contact_move`, Site 1:N timeline은 이 누적 후보에 포함하지 않는다.

Runtime `opportunity_create` 또는 irreversible `inquiry_purge` 증거가 생긴 뒤에는 schema rollback이 business row를 지우거나 복구를 가장하지 않도록 전체 rollback은 거절된다. 실제 Staging 적용과 JWT/browser E2E는 별도 승인 전까지 수행하지 않는다. Production/n8n 접근은 0이다.
