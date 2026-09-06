# Baseline-only post-COMMIT rollback 결과

> 최신 상태: [Canonical 비교·rollback guard 검증](crm-baseline-canonical-review-20260905.md)은 PASS다. 아래는 변경 전 raw-MD5 guard 및 초기 로컬 검증의 역사적 기록이다. 현재 로컬 역 SQL은 함수 정의의 CRLF/CR만 정규화하며, 실제 Staging after 형태의 재접속 rollback 시험을 통과했다. 원격 rollback은 미실행이다.

> 후속 실제 적용 결과: [Staging 적용 보고서](crm-staging-baseline-application-20260905.md). 아래는 적용 전 로컬 검증 기록이다. 실제 Staging에는 baseline이 적용됐지만 13개 함수의 줄바꿈 차이로 중단했으며, 기존 rollback의 정의 해시 가드는 현재 상태에서 거절한다.

판정: **로컬 rollback PASS. Staging baseline 실제 적용은 실행 직전 확인 대기. Production NO-GO 유지.**

## 실제 작업 범위

- Production 접속/변경 0. Staging 외 프로젝트 변경 0.
- `netform-crm-staging` / `rprechiaglyjaydkmxsu`의 SQL Editor에서 메타데이터 SELECT 1회만 실행했다.
- Staging public relation/index 0, function 0, type 0, policy 0을 확인했다.
- 고객 행, Auth 사용자 행, Storage 파일, 키는 조회하거나 생성하지 않았다. seed/v2/Legacy revoke/UI/배포는 미실행이다.
- 브라우저에 표시되는 `main PRODUCTION`은 별도 Staging 프로젝트의 기본 branch 라벨이다. 프로젝트 이름과 ref로 대상을 구별했으며 실제 CRM Production ref `ymfbmpnizxvqsamnczow`에는 접속하지 않았다.

## 사전 스냅샷과 파일

- `sql/baseline/20260905/staging-before.json`: 실제 Staging 카탈로그 결과. 원문 AX 결과를 로컬 JSON으로 보존했으며 조회 URL과 방식 명시.
- `sql/baseline/20260905/baseline-only-rollback.sql`: 해당 before 상태로 돌아가는 재접속 가능한 역 SQL.
- `sql/baseline/20260905/rollback-local-result.json`: COMMIT/재접속/rollback/구조 diff의 로컬 시험 결과.
- `sql/baseline/20260905/staging-apply.sql`: 검토된 원본에 한 트랜잭션의 승인 설정 및 실제 before ACL/defaults 검사를 추가한 **미실행** 적용 묶음.
- 생성기: `scripts/build-crm-baseline-rollback.cjs`, `scripts/prepare-crm-staging-baseline.cjs`.
- 시험: `tests/crm-baseline-rollback.test.cjs`.

원본 baseline SHA-256: `1899adacb05b6fe07d187f76fe2fc57a1842be40fb73a47fad9a951eb5e4de78`.

Rollback SHA-256: `11d99eb7b933acaf6e2f0f7484a4ea7777db2f3d135c86eb96bbe76240eb5fbf`.

적용 묶음 SHA-256: `89dce8ae467f614a1857dca82b49a7d17cf5483da97d2540cd814c0d4a9ea2de`.

원본은 변경하지 않았다. Staging before의 public schema ACL, 두 creator의 default privileges, extension metadata는 보존된 원본과 정렬 순서를 제외하고 일치한다. 버전 17.6, ICU en-US/en_US.UTF-8 및 153.121, public owner pg_database_owner, auth.jwt, 관리형 event trigger 6개를 재확인했다. 운영 postgres는 supabase_admin 멤버가 아니며 Staging도 동일하다.

## Rollback 동작과 제한

1. 독립 Staging ref와 rollback 승인 설정을 요구한다. 설정값 자체는 연결 대상 증명이 아니므로 실행기에서도 실제 ref를 확인해야 한다.
2. 명시한 18개 테이블을 잠그고 baseline 메타데이터를 검증한다. 함수 원문은 MD5 비교, 나머지는 원본 캡처 속성 비교를 사용한다. 인증용 암호학적 서명이 아니라 변경 탐지다.
3. 테이블에 한 행이라도 있으면 **삭제하지 않고 중단**한다. 구조/ACL/policy/default privilege가 달라져도 중단한다. 합성 seed나 v2가 추가된 상태에서는 사용할 수 없는 baseline-only rollback이다.
4. 명시한 public trigger 8개와 함수 17개, View 5개, 테이블 18개만 RESTRICT 방식으로 제거한다. 테이블 소유 sequence/index/constraint/policy/composite type은 종속 객체로 함께 제거된다.
5. 실제 before와 달라진 public schema ACL/default privilege만 복원한다. 현재 실측 before는 원본과 같으므로 이 권한들의 되돌림 DDL은 필요하지 않다. 생성기는 postgres 권한 차이를 되돌리는 시험도 통과했다. 접근 불가능한 supabase_admin 권한 복원이 필요한 경우에는 SQL 생성을 중단한다.
6. public 객체 0 및 before ACL/default privilege 일치를 COMMIT 전에 확인한다.

`DROP SCHEMA`, `DROP OWNED`, `DROP EXTENSION`, `DROP EVENT TRIGGER`, `CASCADE`는 없다. 관리형 auth/storage/realtime/graphql/extension/event trigger를 직접 DROP/변경하는 SQL도 없다. baseline 바깥에서 추적 가능한 의존성이 추가되면 RESTRICT로 실패한다. [PostgreSQL DROP OWNED 문서](https://www.postgresql.org/docs/17/sql-drop-owned.html)가 설명하는 광범위한 제거를 피하도록 명시 대상만 사용했다. 기본권한은 global과 schema 범위를 구분한다. [ALTER DEFAULT PRIVILEGES 문서](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)

## 검증 결과

로컬은 **PGlite 0.3.14 / PostgreSQL 17.5**이다. 실제 Supabase 17.6 검증과 동일시하지 않는다. 관리형 객체는 로컬 stub/sentinel로 보호 여부만 검사했다.

| 항목 | 적용 전 | baseline COMMIT 후 | rollback COMMIT 후 | 결과 |
|---|---|---|---|---|
| 로컬 테이블 | 0 | 18 | 0 | PASS |
| 로컬 View / 함수 / sequence | 0 / 0 / 0 | 5 / 17 / 2 | 0 / 0 / 0 | PASS |
| 로컬 전체 캡처 메타데이터 diff | 정본 before | 원본 public 구조 diff 0 | before 대비 diff 0 | PASS |
| 로컬 관리형 sentinel/extension/event metadata | before 저장 | 유지 | diff 0 | PASS |
| COMMIT 후 연결 종료/재접속 | 이전 세션 없음 | 디스크 기반 DB를 닫고 재개방 | rollback 후 다시 열어 before 확인 | PASS |
| 잘못된 프로젝트 / 기존 객체가 있던 before | 해당 없음 | 생성 거절 | 해당 없음 | PASS |
| 변경된 구조 | baseline 뒤 컬럼 추가 | rollback 거절 | 원상태 유지 | PASS |
| 변경된 public ACL / postgres default privilege | 별도 before 구성 | baseline으로 변경 | 정확한 before로 복원 | PASS |
| 실제 Staging | 모든 public 객체 0 | **미실행** | 실제 rollback 미실행 | 대기 |
| 실제 Staging source schema diff | 실행 전 empty 상태 | **아직 결과 없음** | 해당 없음 | 미검증 |

시험 명령:

```powershell
node --test tests/crm-baseline.test.cjs tests/crm-baseline-rollback.test.cjs
```

기존 baseline 21개와 신규 rollback/적용 묶음 6개, 총 **27 PASS / 0 FAIL / 0 SKIP**. 이는 JWT 11개 또는 실제 Staging 보안시험 결과가 아니다.

## 현재 중단 사유와 다음 실행 범위

사용자의 조건부 진행 승인과 로컬 시험 조건은 충족했다. 다만 현재 callable Supabase connector/CLI 연결이 없어 브라우저 SQL Editor 경로를 사용하고 있다. Computer Use의 실행 직전 확인 규칙은 공개 접근 권한 생성에 추가 확인을 요구한다. baseline은 기존 anon/authenticated 읽기·쓰기/EXECUTE 권한을 그대로 만들므로 **실제 Run을 누르기 전에 확인을 요청하고 멈췄다**.

로컬 파일 전달용 임시 loopback 경로는 브라우저가 차단해 사용하지 않았고 임시 서버도 종료했다. 원격 DDL 제출 시도는 없었다. 이 보고서는 실제 적용 성공을 주장하지 않는다.

확인 후에도 대상 ref 및 before 상태를 다시 검증하고, 해시가 일치하는 묶음만 한 트랜잭션으로 실행한다. 직후 capture-metadata.sql 결과와 source-metadata.json을 비교한다. 설명되지 않은 diff가 있으면 추가 적용 없이 중단한다. diff 0일 때에도 baseline 재현 PASS까지만 기록하고 Auth/seed/v2로 넘어가지 않는다.
