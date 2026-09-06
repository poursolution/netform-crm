# CRM schema-only baseline 검토 결과 — 2026-09-05

> 최신 판정: [Canonical baseline reproduction PASS / byte-identical reproduction NOT CLAIMED](crm-baseline-canonical-review-20260905.md). 아래 미적용·raw diff 중단 표현은 작성 당시 기록이다. 원본 적용 SQL은 변경하지 않았고, 후속 작업은 로컬 비교기와 rollback guard 검증에 한정했다. Production NO-GO는 유지한다.

> 후속 실행 상태는 [Staging 실제 적용 보고서](crm-staging-baseline-application-20260905.md)를 따른다. 아래 내용은 baseline 작성 당시 기록이며, 이후 Staging 적용에서 함수 13개의 줄바꿈 diff가 확인되어 재현 PASS 없이 중단했다.

판정: **검토용 public baseline 작성·로컬 복원 비교 완료. Production 적용 NO-GO. Staging 미적용.**

이번 범위는 baseline만이다. `v2 먼저 검증 → Legacy 마지막 차단` 순서는 유지하며, 기존 candidate migration·v2·Legacy 권한·프론트·배포는 변경하지 않았다. 운영에서는 카탈로그 메타데이터 SELECT만 실행했다. 고객 행, Auth 사용자 행, Storage 파일, 비밀키를 조회하지 않았다.

## 1. 산출물과 근거

모든 경로는 저장소 기준이다.

- `sql/baseline/20260905/public-baseline.sql`: 원래 public 객체 및 **기존 취약 권한까지 그대로** 재현하는 검토용 SQL. 보안 hardening이 아니다.
- `sql/baseline/20260905/source-metadata.json`: 함수 본문까지 포함한 실제 조회 결과. 원본 metadata MD5 `9872dac5bc6f60f19fc7c4a5514af0af`.
- `sql/baseline/20260905/capture-metadata.sql`: 같은 항목을 다시 수집하는 읽기 전용 카탈로그 SELECT. 개인정보 테이블의 행을 읽지 않는다.
- `sql/baseline/20260905/environment-review.json`: 별도 조회한 역할·멤버십·관리형 event trigger·ICU 환경 요약. **추가 조회 전체 원문은 아니며**, 보존한 부분과 범위를 명시했다.
- `sql/baseline/20260905/dependencies.json`: 원본 카탈로그 의존성 161건, 함수 본문 수동 검토 의존성, 전체 constraint/index/trigger 정의와 sequence ownership.
- `sql/baseline/20260905/before-security.json`: 원본 owner/ACL/RLS/policy/view option/default privileges 및 함수 정의 해시.
- `sql/baseline/20260905/manifest.json`: 개수, 복원 함수 순서, SQL SHA-256, 미적용 상태.
- `scripts/build-crm-baseline.cjs`: 위 원본으로 SQL을 재생성하는 오프라인 생성기.
- `tests/crm-baseline.test.cjs`: 전체 public 객체의 오프라인 복원 및 카탈로그 비교.

현재 SQL SHA-256: `1899adacb05b6fe07d187f76fe2fc57a1842be40fb73a47fad9a951eb5e4de78`.

## 2. 운영 구조와 일치 여부

운영 PostgreSQL은 17.6이다. 로컬은 PGlite 0.3.14 / PostgreSQL 17.5이며, **두 환경이 같다고 주장하지 않는다.** 로컬에서 관리형 역할을 모형으로 만들고 `auth.jwt()`를 NULL 반환 stub으로 제공했다. 연결 승인·버전·ICU·extension 사전조건은 테스트 메모리 안에서만 제외했다. 배포용 SQL 파일의 가드는 그대로다.

| 항목 | 운영 기대값 | 로컬 복원 실제값 | 결과 | Production 영향 |
|---|---|---|---|---|
| public table / table column | 18 / 241 | 18 / 241, 캡처 필드 일치 | PASS | 없음 |
| View / View column | 5 / 40 | 5 / 40, 정의·option·owner·ACL 일치 | PASS | 없음 |
| 함수 | 17, 그중 SECURITY DEFINER 7 | signature/body/security/config/owner/ACL 등 일치 | PASS | 없음 |
| 컬럼 속성 | type/default/not-null/순서/identity/generated/storage/compression/collation/ACL | 281개 컬럼의 캡처 필드 일치 | PASS | 없음 |
| PK/FK/UNIQUE/CHECK | 63 | 정의·검증상태·지연속성 일치 | PASS | 없음 |
| index | 67 | 정의·valid/ready·constraint 소유·replica identity 일치 | PASS | 없음 |
| sequence | 2 | type/start/min/max/increment/cache/cycle/ownership 일치 | PASS | 없음 |
| 사용자 table trigger | 8 | 정의·활성상태 일치 | PASS | 없음 |
| RLS / policy | 11 ON, 7 OFF / 2 policies | force 상태 포함 일치 | PASS | 없음 |
| schema/table/view/function/sequence ACL | 실제 owner·grantor·grantee·privilege | 정렬 순서만 정규화한 비교 일치 | PASS | 없음 |
| 함수 등 default privileges | public 범위 6행, global 0행 | creator·ACL 일치 | PASS | 없음 |
| 캡처한 pg_depend | 161건 | OID가 아닌 객체 설명·의존 종류 비교 일치 | PASS | 없음 |
| 원본 고객 데이터 | 복사 0 | 로컬 18개 테이블 모두 0행 | PASS | 없음 |
| 승인 없이 실행 | DDL 전에 중단 | 실제 중단 및 public 객체 0 확인 | PASS | 없음 |
| 로컬 복원 도중 검증 실패 | transaction rollback | 오류 주입 후 객체·ACL·정책·기본권한 복원 확인 | PASS | 없음 |
| 실제 Supabase 환경·Auth/JWT·기능 회귀 | 별도 검증 필요 | 이번 범위에서 실행하지 않음 | 미검증 | 없음 |
| Staging 전체 rollback / 재접속 후 복원 | 별도 검증 필요 | 이번 범위에서 실행하지 않음 | 미검증 | 없음 |

시험 결과: **21 PASS / 0 FAIL / 0 SKIP**. 이 숫자는 이번 baseline 테스트만이며, 기존 JWT 11개 또는 이전 테스트 결과와 합산하지 않는다. 순수 DDL/ACL 복원 시험이지 사용자별 보안 통과 판정이 아니다.

처음 비교에서 새 함수가 creator 기본권한을 상속하여 `crm_contact_move`, `crm_contact_upsert`에 원본에 없는 anon/authenticated EXECUTE가 남는 오류를 발견했다. 생성기를 수정해 기본권한으로 생긴 권한까지 초기화한 후 원본 ACL을 재현한다. 최종 비교는 함수 본문 변경 없이 통과했다. COMMIT 전 ACL/default privilege 검증도 포함했다.

## 3. 복원 순서 및 안전장치

1. 별도 승인, 독립 Staging 연결, 합성 데이터 격리 확인. SQL의 ref 설정값만으로 실제 접속 프로젝트가 증명되지는 않는다. 실행기에서 별도로 검증해야 한다.
2. 트랜잭션 시작 및 사전조건: executor postgres, PG 17.6, public 앱 객체 없음, public schema owner, auth.jwt 존재, ICU 및 extension/creator 역할 조건 확인.
3. 원본 creator별 public default privileges 재현. 이미 같으면 변경하지 않으며 권한 부족 또는 사후 불일치는 실패 처리한다.
4. public schema ACL → sequence 설정 → 테이블/컬럼.
5. PK/UNIQUE/CHECK → 독립 index → FK. `contacts.person_key`를 참조하는 FK 때문에 독립 unique index를 먼저 만든다. FK 순환은 테이블 생성 이후에 처리한다.
6. sequence OWNED BY → View 5개 → 의존 순서의 함수 17개. `check_function_bodies=on`을 유지한다.
7. table trigger → 원본 RLS/policy → owner 및 객체별 원본 ACL.
8. COMMIT 전 실제 ACL/default privilege 비교. 실패하면 전체 트랜잭션 rollback. 성공하더라도 같은 카탈로그 SELECT로 전체 구조 diff를 추가 확인해야 한다.

재실행 시 기존 객체를 덮어쓰는 방식이 아니다. public 앱 객체가 있으면 중단한다. 새 빈 Staging용 baseline이므로 `DROP IF EXISTS`나 기존 객체 교체로 억지로 맞추지 않는다. 승인 설정값도 파일에서 자동으로 활성화하지 않는다.

함수·View 본문에서 원래 취약한 권한/이름 기반 로직을 고치지 않았다. 복원 원본과 향후 v2/hardening은 반드시 분리한다.

## 4. 역할·환경 의존성과 제외한 객체

현재 public CREATE 권한/소유권/default ACL에서 확인한 관련 역할은 `pg_database_owner`, `postgres`, `supabase_admin`이다. **카탈로그 owner는 모든 객체의 역사적 생성자 증명이 아니다.** 현재 역할 상태와 미래 생성 가능 범위를 기록한 것이다.

원본 public owner는 `pg_database_owner`이며 PUBLIC USAGE가 있다. 테이블/View의 `arwdDxtm`에서 PostgreSQL 17의 `m`(MAINTAIN)도 보존했다. 함수 기본권한은 postgres와 supabase_admin 각각 public 범위에 존재한다. global default ACL 행은 없으므로 PostgreSQL 내장 PUBLIC EXECUTE 기본값도 여전히 고려해야 한다. **이번 baseline은 이를 차단하지 않는다.** 미래 creator 전체의 안전한 default privilege 설계는 후속 hardening 범위다.

운영 postgres는 supabase_admin의 멤버가 아니다. Staging에서 supabase_admin 기본권한이 원본과 다르고 정상 실행 계정으로 변경할 수 없다면 중단해야 한다. 역할 membership 추가, superuser 확보, 관리형 권한 우회는 포함하지 않는다.

필수 관리형 환경은 복사하지 않고 사전조건으로 남겼다.

| 항목 | 원본 실측 | 이번 처리 |
|---|---|---|
| database locale | ICU en-US, en_US.UTF-8, collation version 153.121 | SQL 가드로 일치 요구. 임의 locale 변경 없음 |
| extensions | pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1 | version/schema/owner 메타데이터 보존. 설치·교체하지 않음 |
| Auth 의존성 | users policy가 auth.jwt() 사용 | 기존 Supabase 관리형 함수 필요. Auth 사용자 복사 없음 |
| 관리형 역할/membership | environment-review.json에 요약 | 생성·변경하지 않음. 적용 전 대상 환경 비교 필요 |
| 관리형 event trigger | 6개, PostgREST DDL/drop watch 포함 | 정의/활성 메타데이터 요약만 보존. 복제·해제하지 않음 |
| public domain/enum/custom collation | 관측 0 | 임의 생성 없음 |
| 컬럼 type schema | pg_catalog만 관측 | 별도 사용자 type 복원 불필요 |
| inheritance / identity / generated | 해당 public 객체에서 관측 없음 | 추측한 추가 DDL 없음 |

제외: 고객/직원 테이블 행, Auth 사용자·비밀번호, Storage bucket/object 행·파일, Vault 내용, 키, sequence 현재값, seed, n8n, 배포 및 API 설정. 객체 설명 comment, 통계/물리 배치, Realtime publication 설정, Supabase 프로젝트 전체 관리형 스키마를 복제하는 `pg_dump` 전체 대체물도 아니다. 따라서 **요청한 public 18/17/5 객체 범위의 구조 재현 baseline**이며 전체 운영 프로젝트 복제 완료라는 의미가 아니다.

문자열 본문의 함수 의존성은 pg_depend만으로 완결되지 않는다. 따라서 17개 원문을 별도 검토해 함수→함수/테이블/View 의존성을 기록했다. 동적 SQL, 외부 HTTP/dblink 호출은 검토한 본문에서 발견하지 못했다. [PostgreSQL 의존성 문서](https://www.postgresql.org/docs/current/ddl-depend.html)도 문자열 함수 본문의 미추적 의존성을 설명한다.

## 5. 하드코딩 비밀값 및 실행 영향

17개 함수 본문을 검토했고 URL/JWT/sb_secret 및 key/password/token 대입 패턴 검사 결과 의심 매치 0건이었다. **모든 형태의 비밀값이 수학적으로 없다는 보장은 아니다.** 최종 사람 검토가 필요하다. `today_counts()`에는 직원 표시명 9개가 원래부터 하드코딩되어 있다. 원본 함수 구조이므로 그대로 보존했으며, 고객 행을 추출한 것이 아니다. 검토 자료에는 내부 역할·직원 표시명·보안 취약 구조가 포함되므로 외부 공개를 피한다.

이 SQL을 나중에 실행하면 빈 Staging public에 18개 테이블, 5개 View, 17개 함수, 2개 sequence와 나머지 제약/index/trigger/정책을 만든다. public schema ACL 및 두 creator의 public default privileges도 영향을 받는다. 관리형 DDL watch가 반응할 수 있다. 고객 행과 Auth 계정은 생성하지 않지만 **기존 익명 접근 위험도 재현하므로 테스트 프로젝트를 안전한 운영 서비스처럼 사용하면 안 된다.**

덤프/DDL도 소스에 정의된 코드를 실행할 수 있으므로 검토 없이 복원하지 않는다. 이번 SQL은 함수 정의를 생성하지만 CRM RPC를 호출하지 않는다. [PostgreSQL pg_dump 문서](https://www.postgresql.org/docs/current/app-pgdump.html)의 복원 코드 검토 주의와도 같은 원칙이다.

## 6. Rollback에 필요한 before metadata

`before-security.json`은 **Production 원본 보안 메타데이터**다. 실제 Staging 실행 직전 상태의 백업이나 완성된 역 migration이 아니다.

향후 적용 승인 후에도 먼저 Staging 자체의 다음 항목을 연결 종료 후 읽을 수 있는 로컬 산출물로 별도 보존해야 한다.

- schema 및 모든 대상 객체 owner, grantor, ACL, grant option와 column ACL.
- table RLS enable/force, policy 이름·roles·cmd·permissive·USING/WITH CHECK.
- View 정의/options/owner/ACL, 함수 원문/signature/security/config/owner/ACL.
- creator별 global/schema default privileges와 역할·membership 상태.
- baseline 이전 객체 목록, 의존성, 적용 묶음 해시 및 실제 DB/프로젝트 식별 근거.

이번에는 로컬 transaction 실패 시 객체와 ACL이 되돌아오는 것만 검증했다. **성공 COMMIT 이후 재접속하여 Legacy 차단을 되돌리는 역 migration, 실제 Staging restore, 데이터 backup/restore는 미검증**이다. 관리형 객체를 DROP CASCADE하거나 Production의 원본 취약 ACL을 자동 재개방하는 rollback은 제공하지 않는다.

## 7. Baseline 재현 후 schema diff 합격 기준

이 기준은 **baseline 복원 직후, seed/v2/hardening 적용 전**에 사용한다. 현재 Staging에서는 실행하지 않았다. 기존 설계 시험 33 PASS와 이번 baseline 시험 21 PASS는 서로 다른 범위이며 합산하거나 실제 JWT 시험으로 취급하지 않는다.

비교 정본은 `source-metadata.json`이다. 승인된 Staging 복원 후 `capture-metadata.sql` 결과를 별도로 받아 아래 기준으로 비교한다. Production을 다시 조회해야 한다면 메타데이터 SELECT만 사용하며, 기존 원본을 조용히 덮어쓰지 않고 별도 시점의 스냅샷으로 보존한다.

| 비교 구분 | 합격 기준 | 차이 발생 시 |
|---|---|---|
| 객체 inventory | table 18, View 5, function 17, sequence 2, index 67, constraint 63, table trigger 8, policy 2. 누락·추가·동명 다른 signature 모두 0 | 복원 불일치. 다음 단계 중단 |
| 컬럼/제약/index/sequence/trigger | 2절의 모든 캡처 속성이 동일. 컬럼 ordinal, identity/generated, 정밀도, FK 대상, partial index 조건 등도 비교 | 표시상 차이로 임의 무시하지 않고 원인 검토 |
| 함수/View | signature·본문·정의·security·search_path/config·owner·ACL·option 동일 | 본문 공백까지 우선 차이로 보고. 자동 수정/정규식 삭제로 통과시키지 않음 |
| RLS/policy/ACL/default privileges | owner·grantor·grantee·grant option·권한 종류·RLS force·policy 식까지 동일. 예상 외 권한 0 | 누락된 차단뿐 아니라 예상보다 더 제한적인 권한도 baseline 불일치 |
| 의존성 | 캡처한 catalog edge가 객체 이름/signature 기준으로 동일하며, 별도 본문 검토 의존성이 모두 해소됨 | pg_depend만 통과해도 본문 의존성 누락이면 실패 |
| 관리형 사전조건 | PostgreSQL/ICU/extension 및 owner, 역할 속성/membership, auth.jwt, 관련 event trigger의 대상 환경 검토 완료 | 알려진 차이라도 자동 예외 처리하지 않음. 검토·승인 전 미검증 유지 |
| 금지 데이터 | 운영 행/파일/키 복사 0, 합성 seed 전 public 업무 테이블 0행 | 즉시 중단. 실제 고객 데이터로 기능 검증하지 않음 |

정규화 허용 범위는 JSON 객체 키 순서, 객체 목록·ACL 목록·의존 edge의 출력 순서다. 내부 OID는 프로젝트마다 달라질 수 있으므로 이름/signature를 사용한다. 컬럼 ordinal, 함수 본문, policy 식, default 식, search_path 순서, 권한 자체는 정규화로 없애지 않는다. 시퀀스 최대값 같은 큰 정수는 문자열로 비교하여 정밀도 손실을 막는다.

원본 metadata MD5는 해당 스냅샷의 식별·무결성 참고값이지 다른 서버의 전체 JSON MD5가 같아야 한다는 기준이 아니다. 서버 버전·환경과 출력 순서가 포함되어 있으므로 항목별 비교를 사용한다. 관리형 환경 차이는 public 구조 diff에서 분리해 기록하되, 무시하거나 전체 복제 PASS에 포함하지 않는다.

**예상 결과: 요청한 public 구조의 설명되지 않은 diff 0건.** 여기에는 원본에 있던 취약 ACL/RLS 상태도 포함된다. baseline diff 0은 보안 통과가 아니라 원본 재현 통과다. 이후 보안 변경은 별도 승인된 expected diff로 추적하며, baseline을 그 변경에 맞춰 다시 써서 차이를 숨기지 않는다.

최종 단계 구분: public baseline 작성 완료 / 로컬 복원 비교 완료 / 실제 Staging 환경 및 복원 미검증 / full reverse SQL 미완성 / Production NO-GO. 현재 요청 범위에서 추가 DB 실행은 하지 않는다.

## 재현 명령과 다음 승인 경계

저장소 루트에서 아래 명령은 로컬 파일 생성/오프라인 테스트만 수행한다. 외부 DB 연결은 없다.

```powershell
node scripts/build-crm-baseline.cjs
node --test tests/crm-baseline.test.cjs
```

테스트는 상위 `crm-security-lab/node_modules/@electric-sql/pglite`를 사용한다. 이 의존성 없는 PC에서는 임의 원격 DB로 대신 실행하지 않는다.

다음 단계는 이 baseline과 관리형 환경 차이를 사람에게 검토받는 것이다. **이번에는 여기서 멈춘다. Staging 적용·합성 계정/seed·v2·Legacy 차단·Production 변경은 실행하지 않았다.**
