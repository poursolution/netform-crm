# CRM Staging 구축 준비서 · UUID 권한 검증판 · 2026-09-05

**최종 상태: NO-GO. 현재 Staging은 없으며, 이 작업에서는 생성/접속하지 않았다.**
운영 Supabase/n8n/GitHub Pages 변경, 운영 SQL 실행, 배포/push는 하지 않았다.
비밀키·비밀번호·토큰을 새 파일이나 채팅에 기록하지 않았다.

## 1. 사용자가 새 프로젝트 생성

1. Supabase Dashboard에서 사용자가 별도의 새 프로젝트를 생성한다. 예: netform-crm-staging.
2. 비용/조직/region은 사용자가 확인한다. 운영 DB 비밀번호·Auth 설정·외부 메시징 secret을 복사하지 않는다.
3. 독립적인 DB 비밀번호와 프로젝트 ref/URL을 확인한다. **운영 ref와 다른지 먼저 확인한다.**
4. 운영 데이터/전화번호/첨부파일/Auth 사용자 백업을 복원하지 않는다.
5. 필요 구조는 사람이 검토한 **schema-only DDL**로 옮긴다. Auth/Storage 서비스 자체 테이블은 Supabase가 관리한다.
6. SMS/email/n8n/cron/webhook 외부 전송 자동화는 연결하지 않는다.
7. 실제 프로젝트 생성과 키 설정은 사용자 작업이며, 아래 명령은 준비 완료 후에만 실행한다.

**동일 스키마 주의:** 저장소에는 운영 deals/inquiries의 완전한 최초 CREATE TABLE과
운영 crm_bundle 본문이 없다. 권한 snapshot의 definition hash만으로 이 구조를 재현할 수 없다.
따라서 사람이 확인한 schema-only 정의가 추가로 필요하다.
tests/fixtures/uuid-contract-schema.sql은 PGlite 단위시험 전용 축약 스키마이며,
**이를 Staging에 올려 “운영과 같은 구조”라고 판정하면 안 된다.**

공식 [Supabase 문서](https://supabase.com/docs)에서 프로젝트 설정 절차를 확인한다.

## 2. 필요한 로컬 환경변수 — 이름만

현재 코드가 실제로 읽는 이름은 다음과 같다.
앞서 예시로 든 STAGING_SUPABASE_ANON_KEY/STAGING_SUPABASE_SERVICE_ROLE_KEY는
이 스크립트의 변수명이 아니다. 아래 이름으로 맞춘다.

| 이름 | 용도 |
| --- | --- |
| CRM_RUN_STAGING | 실제 원격시험 때만 1. 미설정이면 일반 로컬 시험은 11 SKIP |
| STAGING_PROJECT_REF | 새 테스트 프로젝트 ref |
| STAGING_CONFIRM_PROJECT_REF | 위와 같은 ref를 별도 확인 |
| STAGING_SUPABASE_URL | 정확히 https://해당-ref.supabase.co |
| STAGING_PUBLISHABLE_KEY | Staging publishable key 또는 legacy anon key |
| STAGING_SERVICE_ROLE_KEY | Staging 서버용 secret key 또는 legacy service_role JWT |
| STAGING_FIXTURE_FILE | 저장소 밖의 검토된 fixture JSON 절대 경로 |
| STAGING_INTERNAL_REP_EMAIL / STAGING_INTERNAL_REP_PASSWORD | 영업 A |
| STAGING_OTHER_REP_EMAIL / STAGING_OTHER_REP_PASSWORD | 영업 B |
| STAGING_CONSULT_EMAIL / STAGING_CONSULT_PASSWORD | 상담 |
| STAGING_GYEONGNAM_EMAIL / STAGING_GYEONGNAM_PASSWORD | 지사 |
| STAGING_ADMIN_EMAIL / STAGING_ADMIN_PASSWORD | 일반 관리자 |
| STAGING_ADMIN_MFA_EMAIL / STAGING_ADMIN_MFA_PASSWORD | 별도 MFA 관리자 생성용 |
| STAGING_ADMIN_AAL2_TOKEN | MFA 관리자 실제 challenge/verify 후 발급된 access JWT |
| CRM_PROVISION_STAGING | 테스트 Auth 계정 생성 스크립트 실행 때만 1 |

DB migration/backup용 연결 정보는 별도로 사용자가 관리한다.
위 API key는 DB SQL 연결 비밀번호가 아니다.

API 키 종류는 [공식 API keys 안내](https://supabase.com/docs/guides/getting-started/api-keys)를 따른다.
opaque server secret은 apikey로, legacy service_role JWT는 Bearer로 전송하도록 준비했다.
실제 키를 사용한 원격 연결은 시험하지 않았다.

.env 파일은 **netform-crm 저장소와 배포 경로 밖**에 둔다.
예시 위치: C:/Users/Administrator/Documents/영업관리/crm-staging-private/staging.env.
이 파일은 이번 작업에서 생성하지 않았다. 사용자 계정만 읽도록 권한을 제한하고 Git에 추가하지 않는다.
터미널 출력/스크린샷/로그에 환경변수 전체를 출력하지 않는다.

현재 Node는 --env-file을 지원한다. 저장소에서 나중에 다음처럼 실행할 수 있다:

~~~powershell
node --env-file=../crm-staging-private/staging.env scripts/test-staging-security.cjs
~~~

환경변수의 실제 값은 이 문서나 채팅에 붙이지 않는다.
실행 프로세스 환경에 이미 같은 이름이 있으면 .env 값보다 우선할 수 있으므로
운영 값을 상속하지 않는 새 터미널에서 확인한다.

## 3. 테스트 Auth 계정 6개

아래 이메일은 합성 fixture용이며 실주소가 아니다. 각 계정에는 서로 다른 무작위 20자 이상 비밀번호를 사용한다.

| fixture role | 이메일 | CRM 역할 | 팀/범위 |
| --- | --- | --- | --- |
| INTERNAL_REP | internal_rep@example.invalid | rep | 본사, Deal A만 |
| OTHER_REP | other_rep@example.invalid | rep | 본사, Deal B만 |
| CONSULT | consult@example.invalid | consultation | 본사, 상담 문의만 |
| GYEONGNAM | gyeongnam@example.invalid | branch_rep | 지사, 본인 지사 Deal만 |
| ADMIN | admin@example.invalid | admin | 검토된 관리 데이터, aal1 |
| ADMIN_MFA | admin_mfa@example.invalid | admin | 별도 계정, 실제 aal2 |

- scripts/provision-staging-auth.cjs는 확인된 Staging에만 Auth 계정을 만든다.
  현재 실행하지 않았다. 실제 사용 시 CRM_PROVISION_STAGING=1을 별도로 지정한다.
- 그 결과에서 사용자 UUID만 로컬 auth-ids.json에 기록한다. 비밀번호/키는 넣지 않는다.
- public.crm_users.user_id에는 **실제 Auth UUID**를 넣는다.
  seed JSON의 localAuthId는 PGlite용 가짜 값이며 실제 Supabase에 그대로 넣지 않는다.
- ADMIN_MFA는 ADMIN과 다른 계정이다. Dashboard 운영자 MFA와 앱 Auth 사용자의 MFA는 별개다.
- Auth API/SDK에서 로그인 → TOTP enroll → challenge/verify → 실제 aal2 토큰 발급 순서로 준비한다.
  JWT payload의 aal을 직접 수정하거나 가짜 서명을 만들지 않는다.
  [Supabase MFA 안내](https://supabase.com/docs/guides/auth/auth-mfa)
- CRM role/team은 서버 관리 테이블에서만 정한다. user_metadata나 표시 이름을 권한에 사용하지 않는다.

Auth 생성 명령(사용자가 프로젝트/키를 준비한 다음에만):

~~~powershell
node --env-file=../crm-staging-private/staging.env scripts/provision-staging-auth.cjs
~~~

스크립트는 이메일을 합성 example.invalid 도메인으로 제한하고, 생성된 UUID만 출력한다.
중간 실패 시 이미 생성한 테스트 계정을 자동 삭제하지 않는다. Staging 상태를 확인하고 재시도한다.

## 4. 가짜 CRM seed

제공 파일:

- tests/fixtures/staging-crm-seed.json: 테스트 팀 2개, 사용자 6개, Deal 4개, 문의 5개.
- 영업 A/B는 일부러 **같은 표시 이름**을 사용한다. UUID는 별개다.
- Deal/문의 각각 1개는 미매칭 상태로 두어 manual_review/조회 차단을 시험한다.
- 연락처·실제 고객·전화번호는 포함하지 않는다.
- tests/fixtures/uuid-contract-schema.sql: **로컬 PGlite 전용**, Supabase 배포 금지.
- scripts/build-staging-seed.cjs: **오프라인 SQL 생성기**. 네트워크·자격증명·파일쓰기 없음.

auth-ids.json의 형식은 projectRef와 authUserIds 객체다.
authUserIds의 키는 INTERNAL_REP / OTHER_REP / CONSULT / GYEONGNAM / ADMIN / ADMIN_MFA,
값은 각 계정의 실제 Auth UUID다. 이 파일에는 비밀키가 필요 없다.

~~~powershell
node scripts/build-staging-seed.cjs ../crm-staging-private/auth-ids.json
~~~

표준 출력 SQL을 사용자가 검토하고 별도의 로컬 seed.sql로 보관한다.
실행 전에 같은 DB 연결에서 crm.seed_project_ref를 실제 Staging ref로 명시해야 한다.
이 설정 자체가 DB 신원을 증명하지는 않는다. 연결창 URL/ref도 사람이 확인한다.

생성 SQL은 다음을 확인한 뒤 하나의 transaction으로 INSERT한다:

- Auth 사용자 정확히 6명, 검토한 UUID와 합성 이메일 일치
- 기존 deals/inquiries/crm_users가 비어 있음
- 필요한 기본 필드 존재; 맞지 않으면 “Base schema adapter required”로 중단
- 데이터는 합성 이름/현장/TEST 사업유형뿐
- 이름으로 owner를 검색하지 않고, 검토된 UUID mapping을 임시 테이블에 준비

**실제 스키마에 컬럼명이나 필수값이 다르면 seed adapter를 수정·재검토해야 한다.**
운영과 비슷해 보이는 이름을 추측해 자동 보정하지 않는다.
한 번 들어간 seed를 덮어쓰는 방식이 아니다. 이미 데이터가 있으면 멈춘다.
Storage 파일/metadata는 별도의 합성 파일과 실제 스키마 검토 후 추가해야 한다.

## 5. Migration 순서와 현재 권한 설계

모든 SQL은 로컬/Staging candidate이며 운영 실행 승인이 아니다.

1. 사용자가 확인한 운영과 동일한 **기본 schema-only DDL** 준비. 과거 sql/*.sql을 일괄 실행하지 않는다.
2. 테스트 Auth 6계정 생성 및 실제 UUID 수집.
3. sql/20260905_crm_uuid_identity.sql 적용.
4. 실제 스키마에 맞게 검토한 합성 seed SQL 실행.
5. **같은 연결에서** sql/20260905_crm_uuid_backfill.sql 실행.
6. sql/20260905_crm_direct_read.sql 적용.
7. sql/20260905_crm_export.sql 적용.
8. Staging snapshot 수집 → signature/body/ACL/policy/default manifest를 사람이 검토.
9. sql/20260905_crm_security_hardening.sql 적용.
10. read/write/Storage 계약이 준비된 후 실제 JWT 11개 시험.
11. 아래 rollback rehearsal 및 PC/모바일 업무 회귀.
12. 별도로 사람이 제공한 Production snapshot을 오프라인 비교. Production 적용은 여전히 금지.

UUID 구조:

- crm_users.user_id = auth.users.id = auth.uid()
- crm_users.sales_person_id → crm_sales_people의 불변 ID
- crm_users.team_id → UUID 팀 ID
- deals / inquiries: assignee_user_id + crm_team_id 복합 FK
- 표시 이름은 UI/수동검토 증거뿐. 소유권 판정에서 비교하지 않음
- UUID 매칭이 없는 행은 일반 조회에서 제외, identity_review.manual_review 유지
- rep/branch_rep: 본인 UUID + 소속 팀 일치
- consultation: 본인 문의의 id/site/created/status만. Deal·영업실적·금액 제외
- manager: 소속 팀 범위, admin: 매핑된 관리 범위
- 직접 테이블 write 금지. 기존 permissive policy/추가 grant로 우회되지 않도록 restrictive policy 사용
- 상담은 문의 테이블의 직접 column SELECT가 나중에 부여돼도 금액을 못 보도록 테이블 RLS에서 차단
- 고객의 기존 표시명·활동내역을 삭제하지 않는다. 명시적 backfill만 신규 UUID ownership 필드를 설정한다.

[PostgreSQL restrictive policy](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)는 기존 permissive 정책과 AND로 적용된다.
로컬 실행시험에서도 기존 using(true) 정책을 함께 둔 상태로 차단을 확인했다.

중요한 제한:

- 기존 legacy RPC에 이름/email 기반 권한검사가 남아 있다. UUID reader 교체만으로 전부 고쳐진 것은 아니다.
- 해당 legacy 함수는 hardening manifest의 authenticated allowlist에 넣으면 안 된다.
  현재 재허용 후보는 검증한 reader/Export 등 **정확한 signature/definition**만 별도 심사한다.
- 기존 PC/모바일 로그인 UI는 public.users/email 조회 계약을 갖고 있어 새 membership과 실제 화면 호환 검증도 필요하다.
- 쓰기 RPC 전체/Storage 서버 어댑터는 아직 UUID 계약으로 완성되지 않았다.
- identity/backfill은 신설 테이블·FK·RLS·권한·ownership 필드를 바꾼다.
  잠금/실행시간/rollback 영향이 있으므로 실제 운영 snapshot 없이 적용하면 안 된다.
- 새 identity migration은 최초 추가와 동일 후보의 재실행을 로컬에서 시험했다.
  운영의 임의 drift/다른 migration과의 호환성을 입증한 것은 아니다.

## 6. 실제 JWT 11개 통합시험 실행

현재 tests/fixtures/staging-security.example.json을 저장소 밖으로 복사하여 검토한다.

- users에 실제 6계정 Auth UUID
- ownOpportunityId/otherOpportunityId/gyeongnamOpportunityId 및 consultInquiryId
- otherInquiryId/otherUserKey
- Export 기간/사업유형/컬럼/limit
- **실제** ownWrite / readWriteAudit / signedUrl 계약과 합성 파일 ID/path
- reviewedSyntheticOnly / contractsReviewed는 사실을 확인한 다음에만 true

현재 ownWrite/readWriteAudit/signedUrl은 null이다.
이는 단순 자격증명 누락이 아니라 **실제 업무 API 계약 미완성**도 의미한다.
가짜 성공 응답을 반환하는 test probe를 만들어 채우지 않는다.

실행 명령:

~~~powershell
node --env-file=../crm-staging-private/staging.env scripts/test-staging-security.cjs
~~~

검증 방법:

- 매 사용자 토큰을 Auth /user로 검증하고 fixture UUID와 대조
- 타인 데이터가 실제 존재함을 service-role control로 먼저 확인
- 정상 본인 write가 영속 저장되고 UUID actor audit가 남는지 확인
- 상담 문의만 허용/지사 범위 제한, admin과 별도 MFA admin 구분
- opportunity_id / attachment_id 교차치환 및 object_path 위조 요청 거절
- 허용 signed URL의 실제 합성 바이트 다운로드 확인
- 404(없는 RPC), 파라미터 오류, 만료 JWT, 네트워크 실패를 권한 차단 PASS로 인정하지 않음
- Staging URL/ref 확인, 운영 ref 금지, redirect 금지, timeout
- 승인용 명령에서는 자격증명/fixture 미설정도 실패. 11 SKIP을 승인하지 않음

Storage 주의: signed URL은 보유자에게 제한 시간 접근권을 주는 bearer URL이다.
“권한 없는 사용자에게 새 URL을 발급하지 않음”과
“이미 정상 발급된 URL을 받은 제3자가 다운로드하지 못함”은 같은 보장이 아니다.
후자까지 필요하면 사용자 인증 다운로드 프록시 등 별도 설계 결정을 해야 하며 이번에 임의 추가하지 않았다.
[Supabase signed URL 설명](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurls)

지금은 이 실제 환경 실행 단계에서 멈춘다.

## 7. Rollback 검증 절차

두 종류를 구분한다.

### A. 함수 ACL hardening의 같은 연결 rollback

1. identity/seed/reader/Export 준비 후 **hardening 직전**의 Staging snapshot과 기능 결과를 보관한다.
2. DB SQL 연결 하나를 계속 유지한다. 새 SQL Editor 요청이 같은 연결이라는 보장은 없다.
3. 그 연결에서 검토된 manifest → hardening 실행. 임시 before/after ACL 백업을 유지한다.
4. 연결을 유지한 채 다른 로컬 터미널에서 JWT 11개 시험을 실행한다.
5. 원래 SQL 연결에서 20260905_crm_security_rollback.sql 실행.
6. 함수/default ACL을 baseline과 대조하고 기존 서버 함수·필요 업무를 실제 JWT로 다시 시험한다.
7. 중간에 정의/ACL/default가 바뀌거나 연결이 끊겼으면 자동 복구하지 않고 중단한다.
8. 기존 ACL로 돌아가면 취약한 권한도 복원될 수 있으므로 해당 Staging을 외부 공개하지 않는다.

이 절차는 로컬 PGlite에서 ACL 범위만 실행 검증했다.
새 identity 컬럼/테이블/정책, reader 정의, Export audit를 없애는 전체 rollback은 아니다.

### B. 전체 UUID release/데이터 restore rehearsal

1. 최초 migration 전의 **합성 Staging**에 대해 schema/data/ACL backup과 Storage 합성 파일 목록을 보관한다.
2. 사용자가 별도의 폐기 가능한 복구용 환경에 restore하고 기준 기능을 실행한다.
3. 원래 합성 Staging에 identity → seed/backfill → reader/export → hardening → 보안시험 순서로 적용한다.
4. 복구 대상에 baseline을 restore한 다음 기존 기능/데이터/ACL/파일을 비교한다.
5. backup/restore의 실패·누락·시간을 기록한다. 보안시험 PASS와 복구 PASS를 별도 기록한다.

운영 backup을 사용하지 않는다. 데이터 삭제/프로젝트 삭제 명령을 자동 실행하지 않는다.
현재 실제 Staging이 없으므로 이 전체 restore는 **미실행**이다.
검증된 full rollback SQL이 있다고 주장하지 않는다.

## 8. 사람이 전달할 Production snapshot

Production DB 조회는 사용자가 직접 한다.
sql/20260905_crm_security_snapshot.sql은 SELECT-only 재확인 및 로컬 실행시험을 통과했다.
다만 실제 운영 결과는 받지 않았으며 운영에 접속하지 않았다.

오프라인 비교 JSON 필수 배열:

functions / relations / policies / storage_buckets / default_function_privileges /
manifest_meta / effective_function_defaults / role_security / schema_access.

검토된 expected에는 authenticated_function_allowlist를 별도 작성한다.
각 항목은 정확한 signature와 definition_md5다. 관측된 grant를 자동 승인하지 않는다.

~~~powershell
node scripts/compare-security-snapshot.cjs ../crm-staging-private/reviewed.json ../crm-staging-private/actual.json
~~~

두 snapshot이 같더라도 위험 ACL이 같으면 FAIL이다.
결과의 catalog_status가 PASS여도 production_decision은 NO-GO다.
실제 JWT/Storage/XSS/복구/사람 승인을 카탈로그 비교로 대체하지 않는다.
Production과 Staging의 OID/hash 차이를 무조건 허용하도록 expected를 자동 갱신하지 않는다.

## 9. 이번 로컬 결과 및 최종 Gate

최종 실행: node --test tests/*.test.cjs
**151 tests / 140 PASS / 0 FAIL / 11 SKIP**.
기존 138개에 UUID·snapshot·전송 검증 시험이 추가되었다. 테스트 개수를 맞추기 위해 줄이지 않았다.

| 항목 | 기대값 | 실제값 | PASS·FAIL | Production 영향 |
| --- | --- | --- | --- | --- |
| UUID reader/소유권 | 이름 비교 0 | 새 후보는 UUID로 판단, 동명이인·이름변경 로컬 차단 통과 | PASS(로컬 후보) | 미적용 |
| 모든 노출 RPC의 이름 권한 제거 | 0 | legacy 함수는 남아 있으며 deny-by-default/추가 심사 필요 | FAIL(미완료) | 미적용 |
| 상담·지사·rep 분리 | 실제 JWT 통과 | 합성 PostgreSQL에서 통과, 실제 JWT 미실행 | FAIL(실환경 미검증) | 미적용 |
| 실제 JWT 11개 | 11 PASS / 0 SKIP | 11 SKIP, Staging 없음/API 계약 일부 미완성 | FAIL | 연결 안 함 |
| P0 XSS | 전 경로 0 | 이전 수정 경로 회귀 통과, 전체 source→sink 0 미입증 | FAIL(미검증) | 미배포 |
| Storage ID/path 변조 | metadata/발급/다운로드 거절 | 시험 케이스 보강, 실제 Storage 미실행 | FAIL(미검증) | 미접속 |
| admin+MFA+audit Export | 서버 검증 | canonical UUID+aal2+audit 로컬 통과 | PASS(로컬) / 실환경 미검증 | 미적용 |
| 운영 위험 ACL | 0 | snapshot 미제공 | FAIL(미검증) | 운영 조회도 안 함 |
| Staging rollback | 기존기능 포함 복구 성공 | 로컬 ACL 복구만 통과, 실제 full restore 없음 | FAIL(미검증) | 미실행 |
| 운영 변경 금지 | 변경 0 | DB/n8n/배포/키 변경 0 | PASS | 없음 |

**최종 판정: NO-GO.**
사용자가 별도 프로젝트와 안전한 로컬 키 설정을 준비한 뒤, 실제 기본 스키마·API 계약 확인부터 재개한다.
