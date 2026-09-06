# Staging v2 권한층 실제 적용·JWT 검증 결과

판정: **v2 경로 격리 PASS / Production NO-GO**.

최종 로컬 회귀시험은 **77 PASS / 0 FAIL / 0 SKIP**(신규 v2 23개 포함), 별도 실제 Staging JWT 시험은 **11 PASS / 0 FAIL / 0 SKIP**이다. 두 종류의 검증을 구분하며 이전 단계의 전체 보안 승인조건이 모두 충족됐다고 주장하지 않는다.

대상은 `netform-crm-staging / rprechiaglyjaydkmxsu`만 사용했다. Production `ymfbmpnizxvqsamnczow` 접속·변경 0, Legacy revoke·PC/모바일·Storage·Export·MFA enrollment·배포 0이다. 이 결과는 전체 CRM 보안 PASS가 아니다.

## 결과 Gate

| 항목 | 기대값 | 실제값 | 판정 | Production 영향 |
|---|---|---|---|---|
| 새 CRM 객체 owner | postgres만 | entry RPC 4, helper 3, private schema/table/index 모두 postgres | PASS | 없음 |
| postgres future 함수 기본권한 | PUBLIC/anon/authenticated 실행 금지 | global/public defaults 정리, 같은 transaction의 임시 probe 검증 후 삭제 | PASS | 없음 |
| 개별 함수 ACL | 생성 transaction 안에서 명시 REVOKE 후 entry만 authenticated GRANT | 7개 모두 검증; helper의 authenticated 실행권한 없음 | PASS | 없음 |
| managed creator | 변경·우회 금지 | supabase_admin 및 기타 관리형 defaults 그대로 | PLATFORM_MANAGED_RESIDUAL | 없음 |
| 설명되지 않은 구조 diff | 0 | public/private 예상 구조 diff 0 | PASS | 없음 |
| 기존 baseline | 18 tables / 5 views / 17 Legacy functions / 2 sequences / 2 policies 유지 | 그대로, 기존 함수 정의·ACL 및 기존 RLS 변경 0 | PASS | 없음 |
| 합성 계정·업무 데이터 | Auth 6명 / CRM 46행 보존 | Auth 6명 / CRM 46행, 승인된 시험 쓰기 외 행 차이 0 | PASS | 없음 |
| 권한 승인 | 6명, 지사·관리자 명시 범위만 | 승인 6행, scope 6행; 승인 만료 7일 | PASS | 없음 |
| 실제 JWT 시험 | 11 PASS / 0 FAIL / 0 SKIP | 11 PASS / 0 FAIL / 0 SKIP | PASS | 없음 |
| 감사 actor | 서버 Auth UUID → CRM UUID | 감사 3건 모두 동일한 실제 Rep A Auth/CRM UUID, 위조 문자열 무시 | PASS | 없음 |
| v2 rollback | baseline·CRM·Auth·감사 보존 | 로컬 COMMIT→실제 DB close/reopen→rollback 성공, public metadata diff 0 | PASS (로컬) | 없음 |
| MFA 관리자 | 실제 AAL2만 AAL2로 기록 | MFA_NOT_ENROLLED / AAL1 | 미검증 | 없음 |
| 전체 CRM 익명 차단 | Legacy도 차단되어야 함 | Legacy 공개 ACL 유지 | 미완료 | 없음 |

실측 증거는 `sql/v2-owned/20260905/` 아래의 `staging-final-public.json`, `staging-after-private.json`, `staging-final-verification.json`, `jwt-final-results.json`, `jwt-final-audit.json`, `rollback-local-result.json`에 있다. 비밀번호·access/refresh token·서버 secret은 포함하지 않는다.

## 실제 JWT 11개

| # | 시험 | 결과 |
|---|---|---|
| 1 | anon → v2 entry RPC 4개 모두 거절 | PASS |
| 2 | 실제 authenticated 6명, access_review 승인 전 profile 거절 | PASS |
| 3 | Rep A 자신의 Deal·문의·프로필 성공 | PASS |
| 4 | Rep A → Rep B Deal/문의 및 동일 Site의 타 Opportunity 거절 | PASS |
| 5 | Rep B → Rep A Deal/문의 거절 | PASS |
| 6 | 상담직원 본인 문의만 허용, Deal·공종 쓰기 거절 | PASS |
| 7 | 경남지사 명시 grant Deal/문의만 허용 | PASS |
| 8 | ADMIN·ADMIN_MFA도 명시 grant만 허용, 전역 관리자 아님 | PASS |
| 9 | 본인 연락처 허용, 타 Opportunity/동일 Site ID 변조 거절 | PASS |
| 10 | 본인 공종 쓰기 실제 저장, 타 Deal 쓰기 거절, 오래된 version HTTP 409 | PASS |
| 11 | 서로 다른 위조 actor 문자열을 보내도 서버 Auth UUID+CRM UUID 기록 | PASS |

테스트는 실제 Supabase Auth password endpoint로 발급한 6계정 JWT를 사용했다. 테스트 이메일은 `example.invalid`, 비밀번호는 저장소 밖 기존 합성 인증 파일만 사용했다. 로그인 응답 사용자 UUID와 토큰 issuer/sub/role/aal을 확인하고 실제 PostgREST가 각 토큰을 검증했다. 응답이 404/없는 RPC/잘못된 JWT인 경우를 권한 거절 PASS로 계산하지 않았다. 테스트 후 logout을 요청했고 토큰을 파일에 보관하지 않았다.

역할/source_role 변경, 비활성화, 승인 만료, auth_uid 누락·중복, 실제 표시 이름 변경 시 UUID 권한 유지도 **로컬 PostgreSQL 테스트**로 검증했다. 이 추가 변형들을 전부 hosted JWT로 실행했다고 주장하지 않는다. 실제 JWT의 이름 변형 시험은 클라이언트 actor 문자열 위조이며, 실제 `users.name` rename 시험은 로컬이다.

## 실제 변경

1. `postgres`의 global/public future function EXECUTE defaults만 정리했다. `supabase_admin`, `pg_database_owner` defaults/membership은 변경하지 않았다.
2. 비노출 내부 `crm_security` schema에 `access_review`, `object_scope`, `audit_events`와 helper 3개를 생성했다. 3개 테이블 RLS on, anon/authenticated schema USAGE false, 직접 table 권한 없음이다.
3. public에는 `crm_profile_scoped_v2`, `crm_read_scoped_v2`, `crm_contacts_scoped_v2`, `crm_work_set_scoped_v2`만 추가했다. 명시적인 `auth.uid() → users.auth_uid → users.user_id` 관계와 서버 permission/scope를 사용한다.
4. source users.role은 변경하지 않았다. 상담은 permission_role=consultation, 지사는 branch로 별도 승인했다. branch/admin은 synthetic ID grant만 가진다.
5. 공종 시험은 Rep A 합성 Deal 1개에 3회 성공 커밋되었다. version은 1→4, 공종은 `TEST JWT WORK`이다. 최초 실행의 성공 1건과 수정 후 재시험 성공 2건이며 중복 재시도로 숨기지 않았다. private 감사 3건을 보존했다. CRM 행은 계속 46개다.

v2 reader는 최소 권한 계약이다. 대시보드 전체 집계·문의 쓰기·Pipeline 변경·PC/모바일 호환·Export/Storage를 완성했다는 뜻이 아니다. SECURITY INVOKER는 현재 Legacy/RLS를 그대로 둔 상태에서 private 권한 테이블의 직접 접근권한을 추가해야 하므로, 이번에는 고정 빈 search_path와 완전한 schema qualification을 가진 좁은 SECURITY DEFINER entrypoint를 사용했다.

## 실행 중 발견·수정한 두 문제

### 1. C/ICU 메타데이터 정렬 차이

첫 적용은 DDL 전 `public.columns` 해시 가드에서 중단되었다. 사전/중단 후 객체 diff는 0이었다. Staging ICU 정렬과 로컬 C 정렬의 차이로, 같은 columns/indexes/functions/default_privileges 배열의 해시 순서만 달랐다.

해시 정렬에만 `COLLATE "C"`를 명시했다. 함수 본문은 기존 CRLF→LF·CR→LF 외에 정규화하지 않았고 공백·문자·signature·owner·ACL·config·RLS 비교를 유지했다. 읽기 전용 보정 가드 PASS 후 재적용 성공했다. `attempt-1-aborted.sql`, `staging-hash-diagnostic.json`, `staging-after-aborted-public.json`이 증거다.

### 2. 업무 version 충돌에 40001 사용

최초 실제 JWT 시험은 본인 쓰기 1회 커밋 후 오래된 version 요청에서 20초 클라이언트 타임아웃이 발생했다. audit/Deal 조회로 커밋 범위를 확인한 뒤 중복 요청 없이 대응했다.

`40001`은 serialization failure 코드라 업무상 버전 충돌에 부적절한 재시도 신호를 줄 수 있다. timeout의 인프라 내부 원인 전체를 확정한 것은 아니다. 버전 비교·소유권 로직을 바꾸지 않고 이 v2 함수의 오류 코드만 `PT409`로 수정했다. 이후 실제 요청은 HTTP 409로 즉시 거절되고 전체 JWT 시험이 통과했다. [PostgREST custom errors](https://docs.postgrest.org/en/v14/references/errors.html#raise-errors-with-http-status-codes), [관련 재시도 이슈](https://github.com/PostgREST/postgrest/issues/3673).

## 실행 SQL 및 rollback

실제로 적용한 순서:

1. `staging-v2-applied-initial.sql` — SHA-256 `036e11fa2e3753a948148d8e9cebe856de90b816110254535adc5db05f0135fd`
2. `permission-approvals.sql` — 합성 승인·scope 등록
3. `conflict-patch-apply.sql` — SHA-256 `dbdb733147530982ef07c45c5ddcc359253b24d085c4d9ff09acb44e4f69fc3d`

원본 migration은 `20260905132335_crm_owned_v2_staging.sql`, 후속 오류코드 수정은 `20260905134532_crm_v2_version_conflict_http.sql`이다. 현재 생성된 `staging-v2-apply.sql`은 이 둘을 포함하는 **빈 v2 상태용 통합 패키지**이며 현재 Staging에 다시 실행하면 안 된다. `supabase db push`는 사용하지 않았다.

`v2-only-rollback.sql`은 현재 수정된 v2 정의/ACL 가드를 사용한다. hosted rollback은 실행하지 않았다.

- 함수·owner·ACL·config·schema drift 시 중단한다.
- baseline table/view/Legacy function 및 업무 행/Auth를 삭제하거나 과거 값으로 되돌리지 않는다.
- rollback 전 현재 업무 행을 transaction-local로 기록하고 종료 전 동일성을 검사한다. 정상 v2 쓰기로 변경된 업무값도 보존한다.
- 빈 audit table만 제거할 수 있다. 감사 데이터가 있으면 비노출 `crm_v2_archive.audit_events`로 이동해 Auth/CRM actor UUID까지 보존한다.
- baseline 업무 테이블과 audit table을 잠가 감사 INSERT와 빈 테이블 분기의 경쟁을 방지한다. CASCADE는 사용하지 않는다.
- 실제 로컬 파일 DB를 닫고 다시 열어 post-COMMIT rollback, business write·감사 보존, public before metadata diff 0을 검증했다.

## 남은 조건 / 다음 단계

`supabase_admin`은 [Supabase 내부 관리 역할](https://supabase.com/docs/guides/database/postgres/roles)이므로 future defaults의 안전을 보장했다고 표시하지 않는다. `PLATFORM_MANAGED_RESIDUAL`을 유지하고 향후 snapshot/Advisor에서 새 exposed 객체·ACL을 확인해야 한다. **이번 작업에서 자동 지속감시를 등록하지 않았다.**

현재 Legacy 공개 경로, 전체 CRM anon 차단, PC/모바일 연결, Storage, Export, AAL2, hosted 전체 rollback은 미완료다. 따라서 **Production NO-GO**를 유지한다. 이 단계는 v2 자체의 격리 검증까지만 완료하고 종료한다.

검증 명령:

```powershell
node --test tests/crm-baseline.test.cjs tests/crm-baseline-rollback.test.cjs tests/observed-synthetic-seed.test.cjs tests/crm-owned-v2.test.cjs
```

JWT 쓰기 스크립트는 현재 version 4 상태에서 재실행하도록 설계하지 않았다. 재시험 시 먼저 현재 fixture/audit를 확인해야 한다. 무조건 seed를 초기화하거나 감사기록을 삭제해서는 안 된다.
