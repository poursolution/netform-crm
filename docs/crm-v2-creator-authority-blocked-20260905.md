# Staging v2 선행 권한 Gate — 중단

**판정: v2 단계 BLOCKED / Production NO-GO. 원격 변경 0.**

2026-09-05 승인된 `netform-crm-staging / rprechiaglyjaydkmxsu` SQL Editor에서 SELECT-only creator 메타데이터 조회를 수행했다. rollback 설계에 필요한 실제 실행 권한을 확인하는 도중 사용자 지정 중단 조건이 확인됐다. Production에는 접속하지 않았다.

## 실제 관측

실행자와 세션 사용자는 모두 `postgres`, executor superuser=false, DB owner=postgres다. 역할 이름 두 개만 가정하지 않고 public CREATE 가능 역할, 기존 public 함수 owner, global/public 함수 default ACL 보유 역할의 합집합을 조회했다.

| 실제 creator | public CREATE | 현재 실행자의 MEMBER | 현재 실행자의 USAGE | 세션 SET ROLE | 기본권한 변경/probe Gate |
|---|---|---|---|---|---|
| pg_database_owner | true | true | true | true | 권한 메타데이터상 가능, 실제 probe 미실행 |
| postgres | true | true | true | true | 권한 메타데이터상 가능, 실제 probe 미실행 |
| supabase_admin | true | **false** | **false** | **false** | **차단** |

`supabase_admin`은 superuser지만 현재 `postgres`는 아니다. 현재 세션으로 그 creator의 default privilege 변경과 creator 본인으로 probe 생성을 완료할 수 없다. 실제 변경 SQL을 실행해 실패시킨 결과가 아니라, 권한 조회 결과와 PostgreSQL 권한 규칙에 근거한 사전 차단이다.

추가 관측:

- public 함수 17개.
- Auth 사용자 6명.
- `crm_security` schema 없음.
- global 함수 default ACL 행 0개. 이것은 PUBLIC EXECUTE가 없다는 뜻이 아니라 기본 ACL이 적용되는 상태다.
- postgres의 함수 default 설정은 public/storage에, supabase_admin의 설정은 public/extensions/realtime/graphql_public/graphql에 존재한다.

## 왜 지금 멈췄는가

사용자는 “managed role 권한이 예상과 다르거나 우회가 필요하면 중단” 및 “creator default → v2 → 승인장부 → 실제 JWT” 순서를 명시했다. 따라서 다음 조치를 하지 않았다.

- postgres만 먼저 hardening하고 전체 creator PASS로 처리.
- supabase_admin을 인벤토리에서 임의 제외.
- 멤버십 부여, superuser 승격, 관리형 내부 함수나 인증정보를 통한 우회.
- creator Gate를 생략하고 v2부터 적용.
- managed role 명의 probe 또는 실패가 예상되는 원격 ALTER 실행.

PostgreSQL의 `ALTER DEFAULT PRIVILEGES`는 자신 또는 허용된 역할의 미래 객체 권한을 변경한다. schema별 REVOKE만으로 global 기본 PUBLIC EXECUTE를 제거할 수 없으며 global 변경은 public 외 미래 함수에도 영향을 준다. [PostgreSQL 17 default privileges 문서](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

`pg_has_role(...,'SET')`는 그 역할로 SET ROLE할 수 있는지를 반환한다. 현재 관측값 false를 성공 가능으로 간주하지 않는다. [PostgreSQL 17 역할 권한 조회 문서](https://www.postgresql.org/docs/17/functions-info.html).

Supabase 스킬의 최소권한·검증 원칙과 사용자 중단 조건에 따라 안전한 사전검증 단계에서 중단했다. DB 권한을 높이는 방식으로 해결하지 않는다.

## 이번 단계의 실제 완료/미완료

| 항목 | 결과 |
|---|---|
| 실제 creator 목록·default ACL·세션 권한 SELECT | 완료 |
| 전체 creator 실행 권한 확보 | FAIL — supabase_admin |
| v2 단계 전용 rollback 작성·로컬 검증 | 미완료 — 실제 권한 선행조건 차단으로 설계 확정 전 중단 |
| creator default 변경 / probe | 미실행 |
| v2 migration / access_review / scope grant | 미실행 |
| 실제 Auth 로그인 / JWT 11개 시험 | 미실행, PASS 주장 없음 |
| audit actor 검증 | 미실행 |
| 원격 DDL/DML/권한/계정 변경 | 0 |
| Legacy / PC·모바일 / Storage / Export / MFA 등록 / Production 변경 | 0 |

기존 baseline 및 seed 파일은 수정하지 않았다. 이번에 전체 seed 행을 다시 조회하지 않았으므로 46행의 새 검증 결과를 주장하지 않는다. 이전 seed PASS 증거는 그대로 유지된다. 현재 작업의 회귀시험/rollback PASS 수치도 새로 만들지 않았다.

## 근거 파일

- `sql/v2-preflight/creator-authority.sql`: SELECT-only 조회 SQL.
- `sql/v2-preflight/creator-authority-observed.json`: 실제 Staging 결과; 키/비밀번호/고객 행 없음.
- 조회 UI: `https://supabase.com/dashboard/project/rprechiaglyjaydkmxsu/sql/5f47a3cd-2e5c-41d2-87e9-a978666d5c95`.

## 재개에 필요한 결정

현재 “모든 creator의 global default 변경 + 실제 creator probe” 조건을 유지하려면 Supabase가 지원하는 관리형 역할 처리 방식과 권한/영향 확인이 필요하다. Pro 업그레이드나 일반 서비스 키만으로 해결된다고 가정하지 않는다.

대안은 사용자 승인하에 **사용자 관리 creator의 default + 모든 v2 함수의 명시적 ACL/권한 검증**으로 이번 적용 범위를 재설계하고, managed creator의 future default 위험을 별도 미해결 Gate로 남기는 것이다. 이는 기존 전체-creator 합격조건을 만족하는 것이 아니므로 자동으로 선택하지 않는다. 그 대안도 정확한 rollback·로컬 검증을 먼저 완료해야 한다.

어느 방향이든 현재 Legacy 공개 위험은 남아 있고 전체 CRM anon 접근 0 또는 전체 보안 PASS로 판정하지 않는다.
