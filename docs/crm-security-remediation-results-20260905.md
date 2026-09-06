# CRM 보안 NO-GO 해소 작업 결과 · 2026-09-05

> 이전 단계 기록입니다. 후속 UUID 후보·Staging 준비와 최신 시험 결과는 [Staging 구축 준비서](crm-staging-setup-20260905.md)를 기준으로 확인하세요. 아래 이름 기반 reader 설명은 당시 상태입니다.

판정: **NO-GO**. 운영 적용 금지. 아래는 이번 작업에서 직접 실행해 확인한 결과이며,
이전 보고서의 “준비 완료”, PASS 숫자는 현재 운영 보안을 증명하지 않는다.

## 1. 실행 범위와 검증 결과

- 운영 Supabase SQL/RPC, n8n, 배포 사이트에 접속·변경하지 않았다. push/deploy하지 않았다.
- 로컬 HTML/JS/SQL/시험만 변경했다. Staging 프로젝트나 실제 계정은 생성하지 않았다.
- 로컬 격리 PostgreSQL 엔진(PGlite)과 DOM(jsdom)에서 합성 데이터만 사용했다.
- 실제 Supabase JWT, PostgREST, Storage, n8n 권한 경계 시험은 아직 실행하지 못했다.
- 전체 시험 최종 결과: **138 tests / 127 PASS / 0 FAIL / 11 SKIP**. 개수를 129에 맞추기 위해 시험을 줄이거나 SKIP을 PASS로 바꾸지 않았다.
- 승인용 명령은 Staging 설정이 없으면 exit 1로 실패한다. 현재 11개 모두 설정 사전검증 실패이며, 원격 시험 결과가 아니다.

| 구분 | 실제 입증한 것 | 입증하지 못한 것 |
| --- | --- | --- |
| PostgreSQL 실행 시험 6개 | ACL 회수/복구, 재실행, drift 중단, 상속권한 실패 시 전체 rollback, 읽기 전용 snapshot, Export 권한/로그/범위 | 실제 운영 스키마, Supabase Auth/JWT 검증, 전체 RLS |
| DOM/Export 시험 7개 | 실제 렌더러의 악성 문자열·클릭 후 원문 보존, 세션 변경/서버 거절 시 다운로드 차단 | 전체 UI의 Stored XSS 0, 브라우저·모바일 전체 회귀 |
| Live 통합시험 11개 | 실행 harness와 실패 판정 보강 | 실제 JWT 11 PASS: **미달** |

로컬 lab 의존성은 배포 저장소 밖의 ../crm-security-lab에 설치했다.
PostgreSQL 시험의 auth.uid()/auth.jwt()는 합성 claim 설정을 읽는 fixture이다.
이것을 “실제 JWT를 검증했다”라고 해석하면 안 된다.

## 2. 이번에 수정한 것

### ACL migration과 rollback

sql/20260905_crm_security_hardening.sql:

- public.crm_* SECURITY DEFINER 전체에 대해 검토된 **정확한 signature/definition MD5/ACL MD5** manifest를 요구한다.
- 같은 이름의 다른 overload, 같은 OID의 다른 표기 중복, 함수 수/owner/정의/ACL/policy/default ACL drift를 거절한다.
- 이름 allowlist나 함수 본문에 auth.uid 문자열이 있다는 이유만으로 허용하지 않는다.
- PUBLIC/anon/authenticated 회수 후 service_role, 검토 manifest의 authenticated allowlist만 명시적으로 허용한다.
- 실효 권한 사후검사에서 상속 권한 등의 우회가 남으면 transaction 전체가 실패한다.
- global 및 public schema의 함수 default EXECUTE를 모두 회수한다.
  global 변경은 **현재 migration owner가 앞으로 만드는 다른 schema 함수에도 영향**이 있으므로 별도 승인 항목이다.
- 동일 연결에서 동일 manifest로 재실행하는 경우를 검증했다. 새 연결에서 이전 manifest를 무조건 재사용하는 것은 허용하지 않는다.
- 고객 데이터 DML은 없다. 임시 백업 테이블만 생성한다.

sql/20260905_crm_security_rollback.sql:

- **같은 DB 연결에 남아 있는 임시 ACL 백업**으로만 복구한다.
- 적용 후 함수/ACL/default가 바뀌었으면 복구 전에 중단한다.
- 함수 및 default ACL 복원 후 비교하고 실패하면 전체 rollback한다.
- **Production의 영속적 rollback/backup-restore 완료가 아니다.**
  SQL Editor의 별도 실행이 같은 연결을 유지한다고 가정하면 안 된다.
- reader/Export 함수 정의와 새 audit 테이블을 이전 버전으로 되돌리는 전체 release rollback도 아니다.
- 원래 ACL로 복귀하면 기존 취약한 PUBLIC 권한도 다시 열릴 수 있다.
  사고 대응으로 자동 실행하지 말 것. 운영에는 영속 백업과 별도 승인된 안전 복구 계획이 필요하다.

### P0 우선 XSS 수정

| 실제 데이터 경로 | 수정 |
| --- | --- |
| PC Deal/문의 JSON → 카드·리스트 onclick → 상세창 | JS 문자열의 JSON 직렬화뿐 아니라 HTML 속성 문맥도 escape |
| PC 담당자 matrix / 담당자 관련 이벤트 인수 | HTML+JavaScript 문맥 분리, 문자열은 jsAttr로 보존 |
| 모바일 연락처 personKey → 전화/문자 버튼 onclick | HTML entity decoding 뒤에도 JS 문자열을 탈출하지 못하도록 처리 |
| 모바일 관리소장명/현장명 → 상담메모·이동·일부 안내문 intro | 사용자 문자열만 esc, 고정 아이콘/마크업은 유지 |
| 공통 text/textarea/value | escAttr 이중 인코딩 수정, 원문 보존 시험 |

시험 payload는 따옴표, 역슬래시, 태그, onerror, JavaScript 문자열 탈출, HTML entity, 한글을 포함한다.
주입 DOM/이벤트가 생기는지 확인하고 실제 버튼을 눌러 원문이 그대로 전달되는지 확인했다.

**P0 XSS = 0 판정은 하지 않는다.** 전 UI의 고객 입력→DB 저장→재조회→DOM까지 완전한 source/sink 추적은 아직 없다.
193 sink/524 event 수치는 이전 스캔 값이며 위험도나 잔여 취약점 개수를 뜻하지 않는다.
나머지 P1/P2 전체 리팩터링, CSP 강제, inline handler 전면 제거는 하지 않았다.

### 전체 CRM JSON Export

- PC의 buildFullExport 및 B/LOCAL/WRITE_Q 전체 직렬화 다운로드를 제거했다.
- 버튼은 crm-export.js의 안전한 DOM dialog → crm_export_create RPC로만 요청한다.
- 서버는 auth.uid() → public.users의 active/admin 확인 → JWT aal2 확인을 모두 수행한다.
- 최대 31일, 정확한 사업유형 1개, 최대 100행, site/brand/stage/created 4개 비연락처 컬럼만 허용한다.
- 감사로그 actor는 서버 uid이며 필터/행수를 저장한다. audit INSERT 실패 시 결과 반환도 실패한다.
- actor별 advisory transaction lock과 5분 제한을 적용했다.
- RPC 미배포/실패, MFA 부족, actor 불일치, 로그 ID 누락, 계정 변경 시 로컬 전체 Export로 fallback하지 않는다.
- audit는 비노출 schema crm_private에 두고 browser/table 접근을 회수했다.
  해당 schema가 Data API에 노출되지 않는지는 실제 환경에서 추가 확인해야 한다.
- MFA 등록/챌린지 UI는 구현하지 않았다. 따라서 현재 일반 로그인만으로 이 Export를 사용할 수 없다.
- 기존 별도 exportPromotions(로컬 생성 인계건 다운로드)는 전체 CRM Export와 달라 이번에 제거하지 않았다.
- 내부 reader가 이미 전체 데이터를 반환한다면 사용자는 개발자 도구로 이를 저장할 수 있다.
  **Export 버튼 차단은 DB 읽기 범위 제한을 대체하지 않는다.**
- 현 Export SQL은 내부에서 crm_bundle을 호출한 뒤 제한 투영한다. 대규모 부하와 실제 created/brand 계약은 Staging 검증 대상이다.
- 성공 Export의 로그·속도 제한은 검증했지만, 모든 실패 요청의 감사로그·시스템 전체 DoS 제한까지 입증한 것은 아니다.

## 3. 기존 상태에서 확인한 미해결 차단 사유

1. **Staging + 운영 snapshot 없음**: 운영 실제 ACL/RLS/default/storage 결과가 없고, 격리 endpoint·Auth 계정·합성 데이터도 없다.
2. **role/ownership 모델 불완전**: crm_read_bundle은 rep 데이터를 actor.name ↔ assignee 이름으로 비교한다.
   admin/dual/viewer는 전체 bundle을 받는다. 상담/경남지사 분리가 DB에서 어떻게 표현되는지 확정되지 않았다.
   auth.uid()로 로그인 사용자를 식별하는 것과 대상 데이터 ownership을 UUID로 검사하는 것은 다르다.
3. **쓰기/Storage 통합 계약 없음**: 기존 n8n attachment 경로의 실제 서버 권한검사를 이 저장소만으로 입증할 수 없다.
   자체 test probe RPC를 만들어 성공으로 위장하지 않았다.
   auth-aware 본인 write + 영속 audit readback, signed URL 발급의 실제 앱 계약이 확정되어야 fixture를 완성할 수 있다.
4. **P0 전 경로 검증 미완료**: 위 수정 경로의 회귀시험 통과와 전체 P0 0은 다르다.
5. **기능 호환성**: 기존 browser 호출 RPC의 권한을 모두 회수하면 업무 기능이 막힐 수 있다.
   manifest allow_authenticated를 단순히 true로 바꿔 시험을 통과시키면 안 된다.
6. **로그인/로컬 잔여정보**:
   PC authSignIn 및 mobile doSignIn은 입력에서 숫자만 남겨 signInWithPassword에 전달한다.
   두 화면 모두 전화번호 비밀번호를 안내한다. 즉 코드 경로는 실제 Supabase Auth 비밀번호 로그인이다.
   운영 계정의 실제 비밀번호가 전화번호인지 직접 로그인/DB 조회로 확인하지는 않았다.
   이미 Auth를 쓰므로 개선은 “Auth 신규 도입”이 아니라 안전한 비밀번호/SSO·복구·MFA 전환이다.
   세션 지속은 PC SDK 기본값, 모바일 persistSession:true/autoRefreshToken:true를 사용한다.
   로그아웃은 signOut 후 reload이며 LOCAL/쓰기큐/연락처 등 앱 localStorage 전체를 지우지 않는다.
   전역 로그아웃만으로 이미 발급된 access JWT가 즉시 무효화되지는 않는다.
   활성 membership/권한을 매 요청 검사하고, 퇴사자 차단·남은 JWT 유효기간·앱 캐시 삭제를 별도 시험해야 한다.
7. **Production 복구/키 rotation 미검증**: durable rollback, 실제 backup restore, key rotation 계획의 실행 증거가 없다.

## 4. Staging 준비와 역할별 허용/금지 matrix

프로젝트 생성/비용/운영 cloning은 자동 실행하지 않았다.
권한 있는 사람이 별도의 disposable Supabase 프로젝트를 준비하고, **schema-only** 구조를 검토하여 옮긴다.
운영 고객·첨부파일·Auth 사용자 dump는 복사하지 않는다.
저장소 sql/*.sql을 일괄 실행하지 말 것: 과거 파일에는 데이터 변경·cron·누적 재정의가 포함된다.

| 역할 | 읽기 | 쓰기/Export |
| --- | --- | --- |
| anon | CRM 0 | CRM write 0 |
| internal rep / other rep | 각자의 별도 합성 Deal만 | 허용 Deal의 필요한 auth-aware write만, 재배정·purge·Export 금지 |
| consultation | 승인된 상담 범위만, 영업실적/타 rep 데이터 금지 | 영업 배정 금지 |
| gyeongnam rep | 승인된 지사 범위만, 본사 데이터 금지 | 본사 재배정 금지 |
| admin aal1 | 승인된 관리자 범위 | Export 금지 |
| 동일 admin aal2 | 승인된 관리자 범위 | 제한 Export + audit 성공, 반복 제한 |
| service_role | 서버용 업무 함수 | 브라우저 노출 금지; 사용자용 Export MFA 우회 용도로 사용하지 않음 |

상담/지사 정확한 DB 매핑은 사람이 승인해야 한다. role 문자열이나 user_metadata를 임의로 넣어 권한을 만들지 않는다.
rep A, rep B, 상담, 지사 별로 실재하는 합성 Deal 4개와 별도 문의/연락처/텍스트 첨부를 준비한다.
금지시험이 실패하면 합성 문의가 수정/삭제될 수 있으므로 일회용 fixture만 사용한다.

### 제공한 실행 준비물

- scripts/provision-staging-auth.cjs: explicit opt-in + 확인된 staging origin에서만 합성 Auth 사용자 생성.
  5개 계정(rep/other/consult/지사/admin), admin 동일 계정의 MFA JWT를 별도로 사용한다.
  @example.invalid 계정, 서로 다른 20자 이상 무작위 비밀번호가 필요하다.
  CRM membership/데이터는 이 스크립트가 만들지 않는다. 중간 실패 시 기존 생성 계정은 삭제하지 않는다.
- tests/fixtures/staging-security.example.json: **의도적으로 미완성 표시**.
  실제 Auth UUID·합성 ID·권한 매핑 후 reviewedSyntheticOnly를 검토한다.
  ownWrite/readWriteAudit/signedUrl이 null이며 contractsReviewed:false이므로 현재는 원격시험 전에 차단된다.
- tests/staging-guard.cjs: 운영 ref 금지, 정확한 staging HTTPS origin/확인문자 필수, redirect 금지, timeout.
- tests/crm-security.integration.test.cjs: 실제 Auth /user로 토큰의 사용자 확인, service bundle로 타인 fixture 존재 확인.
  HTTP 404/파라미터 오류/만료 JWT/네트워크 오류를 “권한 차단 성공”으로 인정하지 않는다.
- scripts/test-staging-security.cjs: 승인용 실행. 미설정 SKIP을 허용하지 않는다.
- sql/20260905_crm_security_snapshot.sql: 사람이 실행할 읽기 전용 조회 SQL. 실제 운영에서는 실행하지 않았다.
  function definition/ACL hash, aggregate 안전 처리, owner, ACL, RLS, view options, policy, bucket, defaults를 수집한다.
  catalog 플래그만으로 모든 역할의 실제 row 접근을 증명하지 않는다.
- scripts/compare-security-snapshot.cjs: 두 JSON snapshot을 **오프라인 비교**한다.
  functions/relations/policies/storage_buckets/default_function_privileges/manifest_meta 배열이 필요하다.
  동일 DB의 reviewed/actual 비교용이다. 환경별 OID를 포함한 hash가 달라질 수 있어 운영 hash를 Staging에 재사용하지 않는다.
  diff가 없다는 것 역시 보안 승인과 다르다.

### 실행 순서

1. 사람이 운영에서 snapshot을 실행하고 결과를 전달. 수정 SQL 실행 아님.
2. Staging의 실제 기본 스키마·users/auth_uid·crm_bundle 계약 확인 후 합성 fixture 준비.
3. Staging에 candidate reader/Export 정의를 검토 후 적용. 현재 이름 기반 reader는 역할 Gate 해결 전 승인 불가.
4. **해당 Staging에서** snapshot을 다시 수집. 함수별 authenticated 허용 사유를 검토하여 manifest 작성.
5. 동일 연결에서 manifest → hardening → 역할시험 → 별도 rollback rehearsal.
6. backup/restore, 앱 PC/모바일 회귀, 운영 Preview 검토 후 사람 승인. 아직 이 단계에 도달하지 않았다.

Hardening manifest는 아래 temp 테이블에 사람이 검토한 값만 INSERT한다.
“현재 카탈로그 전체를 SELECT해서 allow=true”로 자동 생성하면 검토 안전장치가 무의미해진다.

~~~sql
create temp table crm_security_expected (
  signature text not null, definition_md5 text not null,
  acl_md5 text not null, allow_authenticated boolean not null
) on commit preserve rows;
create temp table crm_security_expected_meta (
  policy_md5 text not null, defaults_md5 text not null
) on commit preserve rows;
-- 검토된 snapshot의 정확한 값 INSERT 후 migration 실행.
-- 빈 manifest는 실패한다. 이 템플릿은 운영에서 실행하지 않는다.
~~~

실제 시험 설정은 비밀 저장소/프로세스 환경으로 주입한다. 배포되는 저장소나 채팅에 키를 넣지 않는다:

- CRM_RUN_STAGING=1, STAGING_PROJECT_REF, STAGING_CONFIRM_PROJECT_REF, STAGING_SUPABASE_URL
- STAGING_PUBLISHABLE_KEY, STAGING_SERVICE_ROLE_KEY, STAGING_FIXTURE_FILE
- STAGING_INTERNAL_REP_EMAIL/PASSWORD, STAGING_OTHER_REP_EMAIL/PASSWORD
- STAGING_CONSULT_EMAIL/PASSWORD, STAGING_GYEONGNAM_EMAIL/PASSWORD, STAGING_ADMIN_EMAIL/PASSWORD
- STAGING_ADMIN_AAL2_TOKEN: 실제 MFA 챌린지를 통과한 admin JWT, 토큰 내용을 임의 편집/서명하지 않음
- Auth 생성 시에만 CRM_PROVISION_STAGING=1 추가.

ownWrite 계약: {name, body:{p:{...}}, expectedReadFields:{변경필드:기대값}}.
반환 actor_id/audit_id 및 bundle read-back을 검사한다.
readWriteAudit 계약: 서버용 RPC {name}; p_audit_id로 영속 actor_id/opportunity_id를 읽는다.
signedUrl 계약: {path, ownAttachmentId, otherAttachmentId, expectedSyntheticText}.
path는 해당 Staging의 실제 앱 endpoint이며, 승인된 현장의 합성 첨부를 직접 다운로드해 확인한다.
이 계약을 맞추는 테스트 전용 fake 응답기를 만들면 안 된다.

## 5. 재현 명령

저장소 폴더에서 실행:

~~~powershell
npm.cmd install --prefix ../crm-security-lab --no-audit --no-fund --ignore-scripts --save-exact @electric-sql/pglite@0.3.14 jsdom@26.1.0
node --test tests/*.test.cjs
node scripts/test-staging-security.cjs
~~~

첫 명령은 로컬 lab 의존성 설치뿐이다. 두 번째는 실제 Staging opt-in이 없으면 통합시험 11 SKIP을 보고한다.
세 번째는 자격증명/fixture가 없으면 **실패**해야 정상이며, 네트워크 요청 전에 중단한다.
staging fixture 비밀 파일/의존성은 GitHub Pages 배포 경로 밖에 보관한다.

## 6. 최종 승인 Gate

- [ ] 운영 snapshot 검토, anon table/view/function/storage 실제 CRM 접근 0
- [ ] 모든 exposed SECURITY DEFINER 정확한 allowlist, 다른 owner/default/role 상속 포함
- [ ] auth.uid 기반 actor와 UUID ownership, 상담/지사/관리자 역할 매핑 승인
- [ ] 필요한 read/write 성공 + 금지 read/write 실패, 실제 JWT 11 PASS / 0 SKIP
- [ ] Storage 권한 있는 현장 signed URL 성공·다른 현장 실패
- [ ] 전체 P0 source→sink 검증 완료, P0 XSS 0
- [ ] 일반 사용자 전체데이터 읽기/Export 우회 불가, admin MFA Export Staging 검증
- [ ] 안전한 로그인/퇴사 차단/앱 잔여정보/세션·MFA 운영 절차 확인
- [ ] 실제 backup/restore, 영속 rollback과 key rotation 계획 검증
- [ ] 최종 SQL·영향범위 Preview + 사람의 명시적 Production 승인

지금은 **NO-GO**. 운영 변경이나 n8n 직접연결 전환을 진행하지 않는다.

참고:
PostgreSQL의 global/per-schema default privilege 동작은
[공식 문서](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)를 따른다.
signOut 뒤 access JWT 유효기간은
[Supabase 공식 문서](https://supabase.com/docs/guides/auth/signout)에서 확인할 수 있다.
