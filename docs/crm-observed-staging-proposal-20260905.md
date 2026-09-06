# 실측 구조 기반 Staging SQL 제안 · 2026-09-05

> **이 문서는 이전 Phase A → B 제안의 이력이다. 실행 순서는 폐기되었다.**
> 최신 정본은 [v2-first 실행·호환성 계획](crm-v2-first-plan-20260905.md)이다.
> 아래에 언급된 SQL 파일도 v2 선추가 → 마지막 Legacy 차단 방식으로 수정되었다.
> 과거의 17개 함수/241개 컬럼 전제와 3개 v2 RPC 설명은 cutover 시점의 최신 인벤토리가 아니다.
> 어떤 파일도 시간순으로 일괄 db push하지 않는다. 신규 원격 적용 승인은 아직 없다.

## 판정: NO-GO — 검토용 초안, 적용 승인 요청 단계도 아님

이번 산출물은 **로컬 파일만 작성**했다. 운영·Staging에 migration/seed/계정 생성/업로드/배포/결제 변경을 하지 않았다.
SQL Editor에서 앞서 승인된 범위의 카탈로그 메타데이터를 추가 확인했으며 CRM 고객 행이나 Auth 사용자 행은 조회하지 않았다.
실제 침해·유출 여부는 확인되지 않았다. 사용자가 전달한 Advisor/API 로그/leaked-password 설정 내용은 이번 작업에서 독립 재확인하지 않았다.

정본은 `crm-production-readonly-findings-20260905.md`와 이번 카탈로그 확인이다.
운영 `ymfbmpnizxvqsamnczow`, 격리 Staging `rprechiaglyjaydkmxsu`를 구분한다. 프로젝트 ref는 비밀키가 아니다.
SQL 안의 설정값은 승인·대상 확인에 대한 **실행자의 확인 표시**일 뿐, 실제 연결 호스트를 입증하지 못한다.
어떤 실행기든 승인된 Staging URL/ref를 별도로 검증해야 한다. 현재 이 실행 권한은 없다.

## 1. 이번에 확정한 구조와 미확인 사항

- public 일반 테이블 18개, View 5개, 함수 17개, 컬럼 241개, 제약조건 63개, 인덱스 67개, 사용자 트리거 8개를 카탈로그에서 확인했다.
- 전체 함수 정의 17개와 View 정의 5개를 메타데이터로 수집했다. 전체 함수의 업무 동작·외부 의존성까지 검증했다는 뜻은 아니다.
- `users.user_id`는 CRM UUID PK, `users.auth_uid`는 **nullable UUID + 비고유 인덱스**다. Auth UUID와 CRM UUID는 서로 다른 키다.
- `users.name`은 UNIQUE다. 이름을 복제해서 동명이인 fixture를 만드는 기존 가정도 실제 제약조건과 맞지 않는다.
- `deals.owner_id`와 `inquiries.assigned_to`는 `users.user_id` FK다.
- 실제 `users.role` 값의 제약은 `rep/admin/dual/viewer`다. 상담·지사·manager 역할로 자동 변환할 근거가 없다.
- `audit_logs.actor_id`와 `stage_history.actor_id` 역시 **users.user_id FK**다. 여기에 `auth.uid()`를 그대로 넣는 구현은 잘못이다.
- 운영 사용자 행을 조회하지 않았으므로 auth_uid NULL/중복/퇴사자/역할별 실제 건수와 계정 매핑은 미확인이다.
- View 5개 정의는 읽었다. 모두 일반 View이며 `security_invoker=true` 후보이나 실제 의존성·기능 회귀시험은 미실행이다.

### 기존 candidate 사용 금지

기존 `20260905_crm_uuid_identity.sql`, `crm_uuid_backfill.sql`, `crm_direct_read.sql`, `crm_export.sql`과
`build-staging-seed.cjs`를 새 Staging에 그대로 실행하지 않는다. 새 crm_users/assignee_user_id 및 일부 컬럼을 가정한다.
기존 파일은 사용자 작업이므로 삭제하거나 덮어쓰지 않았다. 이번 파일들은 별도 대안이며 기존 파일들과 함께 일괄 실행하면 안 된다.

## 2. 준비한 SQL과 실행 순서 후보

| 순서 | 로컬 산출물 | 하는 일 | 지금 실행 가능한가 |
| --- | --- | --- | --- |
| 0 | `sql/20260905_observed_schema_extract.sql` | SELECT로 schema-only DDL 조각과 ACL/정책 메타데이터를 **문자열로 반환** | 이번 파일 자체는 원격에서 실행하지 않음 |
| 1 | 검토된 schema-only 재구성본 | 실제 18개 테이블/17개 함수/5개 View 및 의존성 복원 | **아직 완성·승인되지 않음** |
| 2 | `supabase/migrations/20260905111432_crm_observed_p0_staging_candidate.sql` | 기존 공개 경로 일괄 차단 | 별도 Staging 승인 전 실행 금지 |
| 3 | `supabase/migrations/20260905111739_crm_observed_uuid_scoped_candidate.sql` | 기존 UUID 연결에 기반한 제한 reader/공종 RPC 초안 | 역할·대상 권한 계약 승인 전 실행 금지 |
| 4 | 사용자 검토 후 테스트 계정/합성 데이터/권한 승인행 | 실제 Auth UUID 및 명시적 대상 범위 연결 | 이번에는 생성하지 않음 |
| 5 | 실제 JWT·회귀·복구시험 | 로컬 모형과 운영 스키마 차이를 검증 | 미실행 |

CLI의 `migration new`로 로컬 migration 이름만 생성했다. `db push`, `db reset`, `link`, 원격 migration은 실행하지 않았다.
두 migration은 기본 상태에서 승인 guard가 예외를 발생시킨다. **일반 migration 디렉터리에 있으므로 승인 전 db push를 시도하지 말 것.**

### schema-only 재구성의 한계 — 중요

추출 SELECT는 고객 데이터를 읽지 않고, 시퀀스의 현재 값도 가져오지 않는다. 테이블/기본값/제약/인덱스/시퀀스 설정/함수/View/트리거 DDL 조각을 반환한다.
아직 완전한 재현용 `pg_dump` 파일을 확보한 것은 아니다. 반환된 조각을 그대로 연달아 실행하면 안 된다.

- owner/ACL/default ACL/정책/View options 복원은 별도 검토가 필요하다.
- 함수→View, 함수→함수 등의 실제 의존 순서 확인이 필요하다. 숫자 phase는 초안 정렬이지 의존성 위상 정렬 보장이 아니다.
- unsupported 필드에 domain/enum/identity/generated/partition/materialized view 등이 있으면 생성기를 중단해야 한다.
- 외부 schema·extension·collation·DB 설정 및 Data API 노출 설정까지 동일함을 보장하지 않는다.
- 실제 함수 본문에 비밀값이 하드코딩됐는지 검토한 후만 파일로 보관한다. 고객 행이나 키를 dump하지 않는다.
- 취약한 원본 definer 함수가 생성 직후 공개되는 시간이 생기지 않도록, 검토된 private 재현 환경/트랜잭션 및 즉시 차단 절차가 필요하다.

따라서 **현재 Staging 적용용 완전한 baseline DDL은 준비 완료로 표시하지 않는다.** 이번에는 안전한 추출 SQL 및 차단/권한 candidate를 제공한다.

## 3. Phase A: 공개 경로 차단

5개 P0 함수만 막으면 invoker 함수·테이블·View 경로가 남는다. 초안은 보수적으로 다음을 닫는다.

- 기존 public 함수 17개 모두 PUBLIC/anon/authenticated EXECUTE 회수, service_role 기존 EXECUTE 유지.
- public 테이블 18개와 View 5개에 PUBLIC/anon/authenticated 권한 회수. 컬럼 단위 권한도 별도로 회수.
- 모든 18개 테이블 RLS 활성화. dashboard_state `allow all`, users 이메일 기반 `own row read` 정책 제거.
- View 5개 `security_invoker=true`. View의 브라우저 SELECT를 동시에 닫으므로 이것만으로 기능을 복구하지 않는다.
- public 시퀀스 브라우저 권한 회수.
- postgres의 global/public 함수 default EXECUTE 및 public table/sequence client default grant 차단.
- 함수/객체 인벤토리·주요 UUID FK·기존 ACL/정책의 사전 검사와 잔여 권한/RLS/View/시퀀스의 사후 검사. 예외 발생 시 트랜잭션 중단.

**주의:** 사전 검사는 개수·signature·일부 핵심 구조 검사다. 전체 함수 본문/컬럼/제약/정책의 해시 기반 동일성 검사를 대체하지 않는다.
`schema_diff_reviewed` 확인값만 설정해서 이 검토를 생략하면 안 된다.
재실행은 변경 없는 containment 상태에서만 검토하며 Phase B 적용 후에는 함수/정책 인벤토리가 달라지므로 A를 다시 실행하지 않는다.

### 의도된 중단/영향

| 대상 | 영향 |
| --- | --- |
| `crm_bundle`, `crm_site_contacts`, `today_tasks`, `today_counts` 직접 RPC | anon/authenticated 호출 실패 |
| `crm_opportunity_work_set` 직접 RPC | anon/authenticated 공종 수정 실패 |
| 나머지 12개 기존 public 함수 직접 호출 | 브라우저 호출 실패, 서버 EXECUTE 유지 |
| PC/모바일 `users` 조회 | 로그인 후 프로필/역할 확인 실패 가능. Auth 로그인 자체 차단과 구분 |
| 공통 dashboard_state·테이블·View 직접 API | authenticated도 차단. 단순히 RLS만 추가하는 무중단 패치가 아님 |
| service_role/n8n | 기존 명시 권한 유지가 목표지만 실제 workflow 의존성/업무 동작 미검증 |
| Storage/Realtime/외부 schema | 이번 SQL로 전체 접근 차단을 입증하지 않음. 별도 시험 필요 |

운영 default ACL에는 **supabase_admin** creator도 있다. 본 초안은 postgres 기본권한만 수정하며, managed creator의 기존 public default grant를 임의 변경하지 않는다.
따라서 “미래 모든 SECURITY DEFINER의 PUBLIC EXECUTE=0”은 **아직 미완료**다. 해당 creator의 권한·운영 영향 검토와 허용 creator 목록이 승인되기 전 NO-GO다.

## 4. Phase B: 기존 사용자 UUID + 검토된 권한 범위

정본: `auth.uid() → users.auth_uid → users.user_id → deals.owner_id / inquiries.assigned_to`.
이름·이메일은 보안 조건에서 사용하지 않는다. `crm_security.access_review`는 새 사용자 등록부가 아니라 기존 users PK에 연결된 **권한 승인 장부**다.
기존 role을 임의 변환하지 않고 사람이 source_role/permission_role/검토자/만료일을 승인해야 한다. 승인행 자동 생성은 없다.

Auth UUID 누락/중복(비활성 중복 포함), active=false, 권한 미승인·만료, Auth UUID 재연결, source_role 변경은 모두 fail-closed다.
`manual_review`는 승인행 없음/approved=false 상태로 표현한다. 실제 운영 행을 읽어 자동 매칭하거나 수정하지 않는다.
권한 승인 장부·대상 허용 장부에는 브라우저/서비스 API의 쓰기 권한을 주지 않는다. 검토된 관리자 SQL 절차만 대상으로 한다.

| 제안 permission_role | Deal 읽기/공종 쓰기 | 문의 읽기 |
| --- | --- | --- |
| rep | owner_id = 로그인 사용자의 CRM UUID | assigned_to = 해당 CRM UUID |
| consultation | 금지 | 본인 배정 문의만 |
| branch | 명시된 Deal grant만, 쓰기는 can_write 필요 | 명시된 inquiry grant만 |
| manager/admin | 명시된 관리 대상 grant만, 전역 허용 없음 | 명시된 inquiry grant만 |

branch를 “경남”으로 결정할 데이터 규칙은 아직 없다. 이름/지역 문자열 추측으로 배정하지 않는다.
승인된 대상 ID 목록이 정말 해당 지사 범위인지 사람이 검증해야 한다. 이 표는 제안 계약이며 실제 조직 역할 매핑 완료가 아니다.

새 RPC 3개만 authenticated에 허용한다.

- `crm_read_scoped_v2`: 행 제한 후 고정 컬럼을 반환. 원본 bundle 전체 조회 후 필터하지 않음. 원문 raw/전역 연락처/전체 매출은 반환하지 않음. 별도 UI 어댑터가 필요하다.
- `crm_contacts_scoped_v2`: 권한 있는 Deal의 명시 contact_id + organization 일치만 반환. 공통 organization만으로 다른 연락처를 열지 않음. 기존의 여러 현장 연락처 기능을 전부 대체하지 않는다.
- `crm_work_set_scoped_v2`: 대상 UUID/공종 배열/사유/version만 받음. 본인 또는 쓰기 승인 대상만 변경. actor 인자를 받지 않음.

공종 RPC의 audit `actor_id`에는 서버가 찾은 CRM UUID, 새 `actor_auth_uid`에는 실제 Auth UUID를 기록한다.
기존 감사행을 이름으로 역추적하지 않고 신규 컬럼의 과거 NULL을 그대로 둔다. 활동 detail도 서버가 UUID를 만든다.
이 RPC 정의를 작성했을 뿐, 운영·Staging의 데이터 수정은 실행하지 않았다.
기존 service_role 전용 legacy 함수의 actor 문자열 신뢰는 남아 있다. 신뢰할 수 없는 클라이언트를 대신 전달하는 n8n을 안전하다고 인정하지 않는다.

RLS 정책도 추가하지만 direct table grant는 주지 않는다. private helper는 브라우저에서 직접 실행할 수 없다.
**현재 지원 경로는 명시적 권한검사를 수행하는 definer RPC뿐**이다. 향후 direct SELECT를 열려면 helper 실행권한·컬럼 projection·RLS 정책을 다시 설계/시험해야 한다.

Export/purge/담당자 변경/today_tasks 대체/파일 signed URL은 새로 노출하지 않았다. 상담 쓰기 계약도 미완성이다.
현재 프론트의 `crm_read_bundle`, `crm_export_create` 이름과 새 v2 함수는 같지 않다. 자동 호환을 주장하지 않는다.

## 5. 호출 위치와 미확인 경계

로컬 작업 트리 기준 PC/모바일 모두 `users`를 이메일로 조회한다. 읽기 URL은 `crm_read_bundle` 후보를 가리키고,
write 경로에는 n8n `crm-write`가 남아 있다. `crm-export.js`는 `crm_export_create`를 호출한다.
이 두 candidate RPC는 실측된 운영 public 함수 목록에 없었다.

현재 로컬 프론트에서 5개 legacy RPC의 직접 호출을 찾지 못한 것은 **미사용 증거가 아니다**.
운영 GitHub Pages 실제 배포본/구버전/운영 n8n workflow/외부 연동 호출을 전수 확인하지 않았다.
따라서 가동 중단 범위 확정 전 Production REVOKE는 승인 대상이 아니다.

## 6. 로컬 시험과 복구 한계

실행 명령: `node --test tests/crm-observed-candidate.test.cjs` (netform-crm 폴더).
이번 실행 결과: **24 PASS / 0 FAIL / 0 SKIP** (상위 그룹 1개 포함, 세부 시험 23개).
이 숫자는 새 로컬 candidate 시험만 집계한 것이며, 이전 140 PASS나 미실행 JWT 11개와 합쳐 보안 완료로 표시하지 않는다.
PGlite는 이미 설치된 로컬 lab 의존성을 사용한다. 테스트는 네트워크 연결 없이 합성 데이터만 사용한다.
fixture는 실측 컬럼 타입을 따른 **부분 SQL 모형**이며 완전한 운영 schema-only 복제본이 아니다.
Auth UUID는 로컬 session claim으로 모의한다. Supabase JWT 서명/Auth/MFA/Storage 시험으로 계산하지 않는다.

검증 대상: 기본 실행 guard, UUID 초안 컴파일/재실행, anon 거절, rep 격리, 상담·지사·관리자 범위,
타 Deal 연락처 거절, 서버 감사 actor, 버전 충돌, 이름 변경, 중복 Auth UID, 비활성/역할 변경/권한 만료/승인 장부 차단.
Phase A 전체 적용 및 복구는 완전한 baseline이 없어서 아직 시험하지 않았다. Guard 거절 시험만 통과했다고 전체 migration PASS로 표시하지 않는다.

### Rollback

Phase A는 변경 전 함수/관계/정책/default ACL을 세션 임시 테이블에 보관한다. 이는 재접속하면 사라지며 영구 rollback 패키지가 아니다.
**컬럼 ACL·grantor·의존 객체까지 포함한 재접속 가능한 역 migration은 아직 준비/실행 검증되지 않았다.**
Phase B 후 생성된 감사데이터를 잃지 않도록 `actor_auth_uid`를 단순 DROP하는 rollback은 금지한다.
원본 ACL로 돌리는 것은 공개 취약 경로도 복원하므로 비상 복구 승인과 별개 보안 판단이 필요하다.

승인된 격리 Staging에서만 다음을 검증해야 한다:

1. 실제 baseline + before schema/ACL snapshot + 복구 산출물 확보.
2. 하나의 명시적 트랜잭션에서 A/B 적용, 실패 주입 후 ROLLBACK 및 before/after 메타데이터 동일성 확인.
3. 합성 업무 데이터의 적용 전후 무손실 확인.
4. 별도 승인된 commit 적용 → 실제 JWT/기능 시험 → 검토된 역 migration → 기존 기능 시험.
5. 다시 hardening하고 위험 ACL 재개방이 남지 않았는지 확인. Production 복구시험으로 대체 인정하지 않음.

## 7. 최종 Gate

| 항목 | 기대값 | 실제값 | PASS·FAIL | Production 영향 |
| --- | --- | --- | --- | --- |
| 원격 변경 금지 | DDL/DML/배포 0 | 실행하지 않음 | PASS | 없음 |
| 실측 구조 기반 설계 | 기존 users/owner/assigned UUID 사용 | 새 candidate에 반영 | PASS(설계) | 미적용 |
| 이름 기반 접근제어 | 0 | 신규 candidate 0, legacy 함수에는 잔존 | FAIL(전체) | 미개선 |
| 완전한 schema-only baseline | 운영 의존성/ACL까지 재현 | 추출 SQL 준비, 완전 재현 미완료 | FAIL | 적용 차단 |
| anon CRM read/write | 전체 경로 0 | 로컬 신규 RPC만 검증, 운영 위험 ACL 잔존 | FAIL | 위험 미차단 |
| 미래 PUBLIC EXECUTE | 모든 허용 creator에서 0 | postgres 초안, supabase_admin 검토 필요 | FAIL | 운영 미변경 |
| 역할별 실제 JWT 11개 | 11 PASS / 0 SKIP | 이번에 실행하지 않음 | FAIL | 승인 차단 |
| 신규 candidate 로컬 모형 시험 | 실패 0 | 24 PASS / 0 FAIL / 0 SKIP | PASS(로컬 한정) | 미적용 |
| Storage | metadata/URL/download 변조 거절 | 실검증 없음 | FAIL | 승인 차단 |
| P0 XSS | 0 입증 | 이번 범위에서 수정·전수검증하지 않음 | FAIL | 기존 상태 |
| 전체 Export | admin+MFA+audit | 신규 경로 열지 않음, 전체 경로 실검증 없음 | FAIL | 승인 차단 |
| rollback | 완전한 역 migration·복구 성공 | 미완료 | FAIL | 승인 차단 |
| 운영 호출 영향 | PC/모바일/구버전/n8n 전수 확정 | 일부 로컬 코드만 확인 | FAIL | 중단 위험 미확정 |

**NO-GO. 지금은 SQL 검토 자료만 전달하고 멈춘다. Staging도 별도 승인 없이 적용하지 않는다.**

## 근거 문서

설계 시 [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Database Functions](https://supabase.com/docs/guides/database/functions),
[CLI migration new](https://supabase.com/docs/reference/cli/supabase-migration-new),
[변경 이력](https://supabase.com/changelog)을 확인했다. 계정별 상태의 정본은 위 실측 기록이며 요금제 정보는 이번 설계의 근거로 사용하지 않았다.
