# Claude 인수인계 — 운영 기준 즉시 적용 저장 계약

대상: poursolution/netform-crm · Draft #553 · 2026-10-10.

## 합의와 구현

apply 전부 거절 보호안을 대체한다. 같은 crm_ops_rules_v1 함수와 기존 이력 칼럼을 유지한다. 운영 v2가 Run되었다는 사용자 전달 내용을 반영했으며 새 SQL은 운영 DB에 실행하지 않았다.

- apply는 {effective_on: 오늘의 KST 날짜, scope: 대상 설명}만 허용한다.
- 오늘 이외 날짜·existing 키(null 포함)·알 수 없는 키는 서버와 클라이언트 모두 변경 전에 거절한다.
- scope는 최대 300자 비어 있지 않은 설명이다. 대상별 정책 필터가 아니다. 저장·응답·이력에 그대로 보존한다.
- apply 없는 기존 즉시 저장은 유지한다. #555 UI의 null 인수는 apply를 보내지 않는 저장으로 처리한다.
- 예약 적용·대상별 정책 버전·기존 업무 유지 엔진은 미구현이다. Claude ②·③ 잠금과 디자인은 유지한다.

## 응답 계약

sql/ops-rules-v2-20261010.sql의 같은 RPC를 수정하되 응답 contract는 3으로 올린다. 운영 v2의 contract 2는 조건을 이력에만 남기므로 새 검증과 구분해야 한다.

읽기의 contract 3 확인 전에는 apply 포함 쓰기를 전송하지 않는다. 저장 응답의 ok·요청한 rules 값·contract 3·apply의 적용일/범위 완전 일치를 확인한 뒤 로컬 값을 반영한다. SQL은 clock_timestamp()의 Asia/Seoul 날짜를 사용한다.

응답: {ok:true,contract:3,rules:{...},apply:{effective_on:"YYYY-MM-DD",scope:"..."},changed:1,version:N,history:[...]}.
읽기·apply 없는 저장의 apply는 null이다. 같은 값 재저장은 changed=0이고 이력을 추가하지 않는다. 이때 apply는 검증한 요청 조건이며 실제 변경 여부는 changed로 구분한다.

느린 조회는 저장 뒤 값을 되돌릴 수 없다. 동시 조회는 진행 중 조회를 기다리고, 저장 중 조회는 저장 결과를 기다린다. 중복 저장은 전송 전에 거절하며 실패 후 재시도 가능하다. 적용 조건 인수는 await 전에 복사한다.

## Claude #555 연결

#555의 {effective_on:오늘,scope} 형식을 지원한다. #553 base는 master로 변경했고 #556까지 최신 master를 통합했다.

#555와 #553의 ops-rules.js save()가 겹치므로 #553의 ACK 검증·load/save 잠금·writeEpoch 보호를 유지하고 #555의 KST 버전 날짜 표기도 보존했다.

#555 커밋 4266f46376392a02023835c6e44b510cdb4b6b00의 rules-admin.js와 rules-admin.css는 수정 없이 통합한다. Codex가 새 디자인을 만들거나 배치·색·크기를 수정하지 않는다. crm.html은 최신 master 전체를 보존하고 rules-admin.css, ops-rules.js, rules-admin.js 세 파일 버전만 ar1에서 ar2로 바꾼다. #555를 나중에 별도로 병합하여 저장 보호를 덮어쓰지 않는다.

## 검증·운영 반영

로컬 31개 통과: ops-rules.test.cjs, ops-rules-runtime.test.cjs, rule-application-guard.test.cjs. 실제 PostgreSQL 함수, 권한, KST 경계, 과거·미래·existing 거절, 범위 검증, 무변경 저장, ACK 불일치, 구서버 전송 차단, 응답 순서 경합을 포함한다.

브라우저 검사 scripts/verify-rules-admin-browser.cjs는 합성 응답 대신 로컬 PGlite에 실제 v1/v2 SQL을 설치하고 호출한다. Claude 원본 화면 → #553 클라이언트 → 실제 SQL의 저장·DB 이력 3행·적용일/scope 원문·재조회 일치가 통과했다. 미래 적용일/existing 요청 거절 시 DB 불변, 구서버 응답 호환·잠금·관리자 전용·공통 계산 반영도 통과했다. 모든 자료는 합성 데이터이며 외부 네트워크 호출은 차단한다. 운영 반영 완료를 뜻하지 않는다.

통합 전 #553 8866b697 커밋은 CI 38005377364가 통과했다. 화면 원본 통합 후 새 커밋의 CI를 별도로 확인해야 한다.

운영 SQL 실행·병합·배포는 미실행이다. 기존 이력은 삭제·재작성하지 않는다. 운영 반영 승인 뒤 SQL을 먼저 적용하여 contract 3을 확인한 다음 클라이언트를 배포해야 한다. 향후 예약 기능은 새 계약으로 확장하며 과거 요청 기한을 소급 변경하지 않는다.
