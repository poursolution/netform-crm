# 릴리스 계약 (Release Contract) — 2026-09-25

컨설턴트 진단 1순위: **화면은 배포됐는데 서버 함수가 없는 상태(Release Drift)**. 실제로 2026-09-25 PR #193 병합 후
운영 DB에 `crm_advisory_attribution_v1`/`_decide_v1`이 없었고, 9/20 TRUNCATE 회수 SQL(PR #105)도 운영 미적용 상태였다.
사람이 순서를 기억하는 대신 아래 세 겹으로 막는다.

## 세 겹의 확인
1. **PR 시점 — 저장소 계약** (`tests/release-contract.test.cjs`, quality-gate 포함)
   전송 허용 목록(`pc-manager-transport.js`의 rpcAllow)에 있는 RPC는 전부 저장소 `sql/`·`docs/`·`supabase/`에 `create function` 정의가 있어야 한다.
   운영에만 있고 저장소에 없던 4개는 `sql/prod-snapshot-20260925-rpcs.sql`로 운영에서 추출해 보존했다.
2. **로그인 시점 — 운영 대조** (`release-contract.js` + `crm_release_manifest_v1`)
   관리자 로그인 시 운영 DB의 crm_* 함수 목록을 받아 허용 목록과 대조한다. 빠진 함수가 있으면 관리자 화면 상단에 **'서버 적용 대기'** 배너(함수 이름 목록).
3. **호출 시점 — 즉시 감지** (전송 계층)
   어떤 RPC든 '함수 없음(PGRST202)' 응답이 오면 즉시 기록 → 배너 + 해당 기능 버튼 숨김(`CRMRelease.has(name)`).

## 배포 순서 (필수)
1. SQL 파일을 저장소에 추가 (PR에 포함 — 1번 검사가 강제)
2. **운영에 SQL 적용** (관리자 Run) → 결과 확인 쿼리 값 대조
3. 프론트 PR 병합 → 관리자 로그인 시 배너가 없으면 완료

SQL 적용 전에 프론트가 먼저 나가도 2·3번 검사가 기능을 숨기고 관리자에게 알리므로 사용자는 깨진 버튼을 누르지 않는다.

## 새 기능이 서버 함수를 쓸 때
- 버튼·카드 노출 조건에 `root.CRMRelease?.has?.('함수명')!==false`를 넣는다.
- 새 RPC 이름은 rpcAllow에 추가하고, 같은 PR에 SQL 파일을 넣는다.
