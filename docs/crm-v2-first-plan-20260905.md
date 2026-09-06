# v2 먼저 검증 → Legacy 마지막 차단 · 2026-09-05

## 현재 판정: NO-GO / 로컬 설계만 변경

요청에 따라 순서를 바꾸고 SQL의 선행조건·검증 인벤토리도 수정했다.
**운영·Staging DB, Auth, Storage, n8n, 배포사이트를 변경하거나 접속 시험하지 않았다.**
사용자가 전달한 Staging Healthy/Advisor 0건은 빈 프로젝트 상태에 대한 보고이며 보안시험 PASS로 사용하지 않는다.

현재 완성된 것은 아래 SQL **후보 모듈과 실행 설계**다. 완전 baseline과 모든 업무 계약이 없는 상태에서
빈 SQL을 정상 migration처럼 채우거나 “지금 실행 가능한 전체 SQL 묶음”이라고 표시하지 않는다.
[기계 판독용 검토 묶음](../sql/crm-v2-first-review-bundle.json)의 `completeExecutableBundle`과 `executionAuthorized`도 false다.

## 1. 새 실행 순서와 단계별 정지점

| 순서 | 내용 | 다음 단계 진입 조건 | 현재 |
| --- | --- | --- | --- |
| 1 | 완전 schema-only baseline 확보 | 테이블/함수/View/트리거/제약/인덱스/sequence/owner/ACL/default ACL/정책/의존성 일치 | 미완료 |
| 2 | 격리 Staging 재현 | 승인된 baseline 적용 및 스키마 diff 0, 고객·운영 Auth·비밀키 없음 | 미실행 |
| 3 | 합성 Auth 6명 + CRM seed | 실제 Auth UUID와 기존 users.user_id 연결, 가짜 데이터만 존재 | 미실행 |
| 4a | creator별 미래 기본 권한 정리 | 실제 허용 creator 전체 확인·승인·검증, 기존 객체 ACL은 보존 | SQL 초안 |
| 4b | v2 Reader/RPC/Profile 선추가 | 기존 Legacy ACL/RLS/정책 보존, 새 RPC의 anon 금지 | SQL 초안 |
| 4c | 권한 승인 장부/명시적 대상 범위 | source_role/지사/관리 범위 사람 검토, 미확인은 접근 거절 | seed 자동변환 금지 |
| 5 | Staging PC·모바일 호환 어댑터/기능회귀 | 아래 5개 핵심 화면 및 쓰기 큐 PASS, Legacy fallback 없이 v2만으로 동작 | 미완료 |
| 6 | Legacy 공개 경로 차단 | 명시적 별도 승인 + 기능/스키마/복구 근거 | SQL 초안, 실행 금지 |
| 7 | 실제 JWT 11개 공격/권한시험 | anon·역할·소유권·MFA·Storage + 기능 재시험 | 미실행 |
| 8 | rollback rehearsal | 실패 rollback, commit 후 역 migration, 이전 업무 회귀, 재-hardening 모두 검증 | 미완료 |

이 순서는 **가짜 데이터만 있는 격리 Staging 검증 순서**다. 위험한 Legacy를 보존한 중간 단계를 보안 완료로 인정하지 않는다.
Production에서 먼저 v2를 덧붙여 오래 병행 운영하라는 승인이 아니다. 운영 전환은 별도 영향·기간·복구·승인이 필요하다.
Staging은 별도 프로젝트여도 인터넷에서 접근 가능한 서비스다. 운영 데이터/사용자를 복사하지 않고 테스트 접근·계정을 제한해야 한다.

## 2. 정확한 후보 SQL 목록 — 파일명 시간순 실행 금지

### 준비용 SELECT

- [schema-only 추출](../sql/20260905_observed_schema_extract.sql): DDL을 문자열로 반환. 완전한 실행용 dump는 아님.
- [creator 인벤토리](../sql/20260905_crm_creator_inventory.sql): public CREATE 가능 역할, 기존 함수 owner, 함수 기본 ACL 설정 역할을 함께 열거.

### 실행 승인 이후 검토할 SQL 모듈

1. [creator 기본 권한](../supabase/migrations/20260905112543_crm_creator_defaults_review.sql)
2. [v2 선추가](../supabase/migrations/20260905111739_crm_observed_uuid_scoped_candidate.sql)
3. **기능회귀 및 승인 대기 — 여기서 자동 진행 금지**
4. [마지막 Legacy 차단](../supabase/migrations/20260905111432_crm_observed_p0_staging_candidate.sql)

SQL 파일의 숫자 순서는 과거 생성시각이다. 기존 A 파일이 먼저 정렬되므로 `supabase db push`로 일괄 적용하면 안 된다.
승인 guard는 모두 기본적으로 실패하며, ref 설정값은 실제 연결 대상 증명이 아니라 실행자의 확인 표시다.
별도 승인된 실행기는 실제 연결 URL/ref, 운영 ref 제외, 스키마 manifest, SQL 파일 해시를 함께 검증해야 한다.
이번에 실행기나 접속 자격증명은 만들지 않았다.

### 수정한 SQL 동작

- v2 SQL의 “crm_bundle 차단 완료” 선행조건을 제거했다. 대신 격리·합성 Staging 확인을 요구한다.
- v2 선추가 단계는 기존 public 테이블 GRANT/RLS/정책/Legacy EXECUTE를 건드리지 않는다. private 승인 장부와 v2 함수, audit의 Auth UUID 컬럼만 추가한다.
- `crm_profile_scoped_v2()`를 추가했다. 이메일 조회 없이 `auth.uid()`를 기존 users에 연결하여 검토된 프로필을 반환한다.
- 마지막 차단은 **Legacy 17개만** revoke하고 v2 4개 EXECUTE를 보존·검사한다.
- cutover 인벤토리는 public 함수 21개(17+4), 테이블 18개, View 5개, 컬럼 242개(기존 241 + actor_auth_uid)다.
- cutover에 profile/dashboard/inquiries/pipeline/mobile_today/write_queue/v2_rpc/creator_defaults/baseline/rollback_plan 근거가 하나라도 없으면 중단한다.
- 기존 이메일 정책/allow-all 제거와 새 RLS 정책은 마지막 차단에 배치했다. direct table grant는 최종적으로 닫고 v2 RPC를 사용한다.

**한계:** 근거 설정값이나 개수 검사는 실제 스키마/기능시험의 대체물이 아니다. 근거 파일과 전체 DDL/ACL diff가 별도로 필요하다.
새 RPC를 더 완성하면 함수 signature 및 반환 계약이 달라질 수 있으므로, 위 21개 인벤토리도 검토 후 함께 갱신해야 한다.

## 3. PC·모바일 호환성 표

아래 “차단 전/후”는 승인된 Staging에서 달성해야 할 동작이다. 현재 PASS라는 뜻이 아니다.

| 기능 | 현재 로컬 계약/문제 | v2 어댑터의 필요 계약 | Legacy 차단 전 시험 | Legacy 차단 후 시험 | 현재 차단 사유 |
| --- | --- | --- | --- | --- | --- |
| 로그인·프로필 | PC `authAdmit`: crm.html:2225, 모바일 mobile.html:925의 users 이메일 조회. 모바일 로그인은 비밀번호에서 숫자 외 문자 제거 | Auth 로그인은 유지하되 Staging 테스트 화면은 정상 email/password 입력. `crm_profile_scoped_v2`의 auth_uid/user_id/permission_role로 프로필 구성. unknown role은 숨김/거절 | Legacy users 조회를 사용하지 않아도 6개 테스트 계정의 승인·거절·로그아웃 동작 | users SELECT가 거절되어도 v2 프로필 정상. 계정 비활성/중복 UUID 즉시 거절 | 프로필 RPC 작성, 두 UI 연결·로그인 입력 수정 미실행 |
| 대시보드 | B.deals/B.inquiries 기간·금액·담당자별 집계, 생성일/브랜드/단계 등의 데이터 사용 | 허용 범위와 기간의 서버 집계 또는 완전성이 증명된 페이지 데이터. missing과 0을 구분. partial 페이지를 전체 매출로 표시 금지 | v2-only 집계와 합성 정답 비교, role별 범위 표시 | legacy bundle/view/dashboard_state 접근을 끊어도 동일한 허용 범위 결과 | 현재 v2에 금액·생성일·집계/완전성 계약 부족 |
| 견적문의 | 기존 inquiries 표시 계약, n8n crm-write에 배정·상태·응대 등 여러 동작 | UUID 담당자 + 표시 전용 이름, 명시적 문의 read projection, action별 auth-aware write/ack/version 계약 | 상담/rep/지사별 목록 및 허용 상태변경, 금지 배정 시도 검사 | 원본 RPC/테이블 직접 접근 불가해도 필요한 응대 업무 성공 | 현 v2는 제한된 문의 읽기만 구현. 배정/상태/응대 write 미완성 |
| Pipeline | 기존 read bundle → 단계·금액·현장 표시, 공종 이외 업무 변경과 낙관적 업데이트 | 행·컬럼 제한된 Deal projection, 단계사전/금액 권한, 개별 write RPC, version 충돌·재조회·ack | 공종 v2 write 및 다른 필요 write의 정상/거절/경합 시험 | legacy 차단 이후 새로고침·저장·실패 복구 재시험 | 공종 RPC만 존재. 단계/금액/계약 등 write와 표시 필드 부족 |
| 모바일 오늘업무 | `buildToday()`(mobile.html:1160 부근)가 문의·Deal·nextAction·기한·활동으로 계산 | 허용된 업무만 반환하는 today 계약 또는 완전한 scoped 원천 데이터. 권한상 금액/연락처가 빠진 경우 명시적 unavailable | 미응대/오늘/기한초과/담당변경 합성 정답, 전화/완료/응대 action 검증 | today_tasks/today_counts 및 n8n fallback 없이 같은 업무 결과 | next_actions/활동/기한 및 업무 완료 RPC가 현재 v2에 없음 |

### 공통 어댑터 규칙

현재 `crm-read.js`는 `deals/inquiries/dups/users` 배열, `_crmRead.version=1`, `scope=all|own`, generated_at을 요구한다.
새 v2는 다른 계약이다. 이름만 바꿔 기존 `CrmRead.validate()`에 통과시키거나, 없는 arrays/집계를 빈 값·0으로 채워 정상처럼 보이게 하면 안 된다.

- Staging 전용 v2 클라이언트/검증기를 따로 두고 계약 version, 허용 범위, pagination/완전성, 권한상 unavailable 상태를 검증한다.
- Auth UUID와 CRM UUID를 별도 필드로 유지한다. branch/manager/consultation을 기존 admin/dual로 억지 변환하지 않는다.
- 이름 기반 `myDeals`/담당자 필터는 UUID로 전환한다. 화면 필터는 보안 경계로 인정하지 않는다.
- v2 요청 실패 시 legacy/n8n/캐시로 조용히 fallback하지 않는다. 실패를 사용자에게 표시하고 민감한 이전 계정 데이터는 지운다.
- RPC 쓰기 ack를 받은 뒤 갱신한다. 미구현 action은 큐에 쌓거나 성공 표시하지 않는다.
- 기존 PC/모바일 localStorage 쓰기 큐는 Staging에서 재사용하지 않는다. 서버 ref+contract+auth UID별 namespace 및 명시적 이전 정책이 필요하다.
- 현재 두 HTML에 운영 URL과 n8n write 주소가 남아 있다. **그대로 Staging 테스트에 실행하지 않는다.** 별도 테스트 빌드의 모든 read/write/Auth/Realtime/Export URL을 Staging allowlist로 묶는다.
- 일반 rep 대량 Export, 상담 영업권한, 타 지사 조회를 UI 숨김만으로 해결하지 않는다. 서버 권한시험이 필요하다.

이번 범위는 SQL/설계 수정이므로 `crm.html`, `mobile.html`, `crm-read.js`의 실제 연결 코드는 변경하지 않았다.
미완성 화면을 비활성화하는 것만으로 “기능회귀 PASS”를 만들지 않는다. 필수 업무 제외는 사용자 별도 승인이 필요하다.

## 4. 모든 실제 creator의 미래 EXECUTE 해결안

postgres와 supabase_admin 두 이름을 고정하고 끝내지 않는다. 실제 staging metadata에서 다음 합집합을 확인한다.

1. public schema에 effective CREATE 가능한 모든 역할(상속·특수 역할 포함).
2. 기존 public 함수 owner.
3. global/public 함수 default ACL 설정 역할.

검토된 목록과 실행 직전 목록이 정확히 일치해야 한다. 새 creator, 상속 변화, 모르는 특수 역할이 나오면 중단한다.
`crm_creator_defaults_review.sql`은 목록에 postgres/supabase_admin을 포함하도록 요구하고, **각 creator 명의**로 아래를 수행하는 제안이다.

- global 함수 PUBLIC/anon/authenticated EXECUTE 회수.
- public schema의 명시적 함수 PUBLIC/anon/authenticated default grant도 회수.
- 실제 creator로 임시 함수 생성 → anon/authenticated의 effective EXECUTE와 PUBLIC ACL 확인 → 같은 트랜잭션에서 probe 삭제.
- 하나라도 권한 부족/SET ROLE 실패/잔여 EXECUTE가 있으면 전체 transaction 실패. 역할 멤버십을 부여하거나 managed 제한을 우회하지 않음.

스키마 단위 REVOKE만으로 global 기본 EXECUTE를 제거할 수 없다. 반대로 global 변경은 다른 schema의 **향후** 함수에도 영향을 줄 수 있다.
특히 managed creator의 플랫폼 기능 영향은 Supabase의 지원 범위·권한·회귀시험을 확인해야 한다.
이 때문에 SQL에 managed 영향 별도 승인 guard를 넣었다. 로컬의 동명 supabase_admin 역할로 통과한 결과는 실제 플랫폼 권한 검증이 아니다.

허용되지 않는 creator는 추후 별도 승인으로 CRM schema CREATE/DDL 경로를 제한하는 방안을 검토할 수 있지만,
현재 SQL은 managed/pseudo-role을 임의 제거·변경하거나 CREATE 권한을 회수하지 않는다.
지원되는 권한으로 변경·probe할 수 없는 creator가 남으면 **NO-GO 유지**다. 그 creator만 빼고 성공 처리하지 않는다.
실제 Data API에 다른 CRM schema가 노출되어 있으면 public 전용 인벤토리를 확장한 후 다시 검토해야 한다.
허용된 creator라도 명시적 GRANT로 재노출할 수 있으므로 기본권한만으로 미래 보안을 영구 보장하지 않는다. DDL 리뷰·snapshot diff가 계속 필요하다.

근거: [PostgreSQL ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html),
[Supabase 함수 권한](https://supabase.com/docs/guides/database/functions).
Supabase 지침에 따라 [변경 이력](https://supabase.com/changelog)도 확인했고, managed `realtime` schema 변경은 설계에 포함하지 않았다.

## 5. 완전 baseline / rollback이 아직 막는 부분

현재 갖춘 것은 카탈로그 실측 기록과 SELECT 추출기다. 완전 baseline dump가 없어 재구성 SQL을 임의로 완성했다고 할 수 없다.
표준 schema-only dump와 정책/ACL/creator/의존 설정을 확보한 뒤, 모든 DDL을 검토하여 운영 데이터·원격 호출·하드코딩 비밀값이 없는지 확인해야 한다.
`auth.users` 행, 운영 Auth 비밀번호, customer rows, Storage 객체, sequence 현재값은 복제 대상이 아니다.
기존 축약 fixture/seed를 운영과 동일한 baseline으로 사용하지 않는다.

Rollback은 두 가지를 분리한다.

- **v2 추가 실패:** Legacy 접근을 건드리지 않은 상태에서 새 변경을 트랜잭션 rollback. 성공 후 되돌릴 경우 새 감사행을 보존하며 별도 역 migration 검토.
- **Legacy cutover 실패:** commit 전에는 transaction rollback. commit 후에는 before ACL/policy/column ACL/default privileges/grantor/View option 등의 정확한 복구본 필요.

Legacy ACL 복구는 취약 경로도 다시 여는 행위다. 별도 승인 없이 “복구니까 허용”하지 않는다.
actor_auth_uid나 새 감사행을 DROP/삭제하는 역 migration은 금지한다. 재접속 후에도 복구 가능한 영구 metadata backup이 필요하다.
현재 full reverse SQL은 미완료이며 이 때문에 cutover guard의 rollback_plan 근거도 아직 PASS로 설정할 수 없다.

## 6. 이번 로컬 검증과 최종 Gate

실행: `node --test tests/crm-observed-candidate.test.cjs tests/crm-v2-first.test.cjs`.
이번 실행 결과: **33 PASS / 0 FAIL / 0 SKIP** (상위 그룹 2개 포함). 실제 JWT 11개를 포함하거나 대체하지 않는다.
PGlite의 실측 타입 기반 **부분 모형**과 합성 데이터만 사용한다. Auth JWT 서명·Storage·MFA·운영 전체 DDL을 검증하는 시험이 아니다.

신규 순서 시험은 v2가 기존 grant/policy를 보존하는지, 프로필 UUID 연결, creator 누락 시 중단,
postgres/supabase_admin의 미래 함수 기본 ACL, 차단 근거 없을 때 중단, revoke 구성요소가 v2를 보존하는지 확인한다.
차단 SQL의 전체 21함수/18테이블/5View 스키마 preflight와 전체 적용·역 migration은 아직 검증하지 않았다.

| 항목 | 기대값 | 현재 | 판정 |
| --- | --- | --- | --- |
| 실행 순서 | v2 검증 후 Legacy 차단 | SQL/manifest/보고서 수정 | PASS(설계) |
| 기존 경로 보존 | 선추가 단계에서 기존 ACL/RLS/정책 불변 | 로컬 부분 모형 통과 | PASS(로컬) |
| v2 프로필 | 이메일 아닌 Auth UUID 연결 | SQL 및 로컬 시험 통과, UI 미연결 | 미완료 |
| 완전 baseline | 실제 운영 schema-only 재현 | 미확보 | FAIL |
| 5개 화면 호환성 | 차단 전후 기능 PASS | 계약 공백, 어댑터·실제 회귀 미실행 | FAIL |
| 모든 실제 creator | 실제 Staging default/probe PASS | 전체 목록 검증 SQL 작성, 실제 managed 권한 미검증 | FAIL |
| 실제 JWT 11개 / Storage | 11 PASS + 파일 권한 PASS | 미실행 | FAIL |
| full rollback | 적용 전후/재접속 복구 성공 | 미완료 | FAIL |
| 원격 무변경 | Production·Staging 변경 0 | 이번 작업에서 원격 접속/실행 없음 | PASS |

**NO-GO. 지금은 SQL 후보/영향/순서만 작성하고 멈춘다. Staging 적용·Auth 생성·seed·배포 승인은 요청하거나 실행하지 않는다.**
