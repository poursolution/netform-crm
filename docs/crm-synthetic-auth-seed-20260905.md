# Staging 합성 Auth + CRM seed 결과 — 2026-09-05

**Auth + synthetic seed 적용·검증 PASS. Production NO-GO 유지. 여기서 중단.**

대상은 `netform-crm-staging` / `rprechiaglyjaydkmxsu` 하나다. Production `ymfbmpnizxvqsamnczow`에는 접속·조회·변경하지 않았다. baseline SQL/함수/ACL/default privileges, v2, Legacy revoke, PC/모바일, Storage, 배포는 변경하지 않았다.

## 실제 적용 및 검증

| 항목 | 기대값 | 실제값 | 판정 |
|---|---|---|---|
| 적용 전 상태 | canonical baseline, CRM/Auth 비어 있음 | metadata diff 0, public 18개 테이블 모든 행 0, Auth 0, Auth 사용자 커스텀 trigger 0 | PASS |
| Auth 테스트 계정 | 6명, 테스트 도메인 | 6명, 전부 `example.invalid`, 이메일 확인됨 | PASS |
| CRM UUID 연결 | Auth → users → 소유/배정 | Auth 연결 6, Deal 소유 연결 5, 문의 배정 연결 5 | PASS |
| 테스트 `users.auth_uid` NULL/중복 | 각각 0 | 각각 0 | PASS |
| 실제 FK 무결성 | 오류 0 | FK 28개 검사, 오류 0, 미검증 constraint 0 | PASS |
| 전체 CRM 행 | 작성한 합성 fixture와 정확히 일치 | 18개 테이블 전체 비교, 46행, diff 0 | PASS |
| 운영 개인정보 유입 | 0 | 실제 전체 행이 합성 allowlist와 일치, 추가/변경 행 0 | PASS |
| seed 전후 baseline | 불변 | raw/canonical metadata diff 모두 0 | PASS |
| ADMIN_MFA | 사실대로 기록 | factor 0, **MFA_NOT_ENROLLED**, AAL2 미발급 | 미등록 |
| 로컬 회귀 | 실패·skip 없음 | 54 PASS / 0 FAIL / 0 SKIP (기존 46 + seed 8) | PASS |
| 원격 seed rollback | 이번 단계에서는 수행하지 않음 | 미실행; CRM 역 SQL 로컬 시험 PASS | 미실행 |

Auth는 대시보드의 **Create new user**로 생성했다. Auto confirm을 사용했고 초대/확인 이메일을 발송하지 않았다. `auth.users`에 SQL로 직접 INSERT하지 않았으며, 서비스 키도 가져오지 않았다. [Supabase 사용자 관리](https://supabase.com/docs/guides/auth/managing-user-data), [관리자 계정 생성 문서](https://supabase.com/docs/reference/javascript/auth-admin-createuser)를 확인했다.

원격 CRM seed는 baseline 구조/ACL guard, Auth UUID·이메일 확인, 전체 CRM 빈 데이터 guard를 포함한 단일 BEGIN/COMMIT으로 적용했다. SQL Editor에서 `Success. No rows returned`를 확인한 뒤 별도 SELECT 검증을 수행했다. 재적용은 기존 데이터를 덮어쓰지 않고 중단하도록 설계했다.

## 테스트 계정 매핑

| 유형 | 실제 `users.role` | Auth UUID | CRM `users.user_id` |
|---|---|---|---|
| INTERNAL_REP | rep | `b5295979-d6c9-48f2-971a-2dea418b75e6` | `f6090500-0001-4000-8000-000000000001` |
| OTHER_REP | rep | `ebf842f3-a2ca-4408-ab67-c10d44538d5e` | `f6090500-0001-4000-8000-000000000002` |
| CONSULT | viewer | `7dcd36d5-03ed-4e25-aa57-ce88512ee130` | `f6090500-0001-4000-8000-000000000003` |
| GYEONGNAM | rep | `c55d57b1-8fdf-4263-9425-296ebb57df18` | `f6090500-0001-4000-8000-000000000004` |
| ADMIN | admin | `2ed567fb-ce77-438c-804b-0dec3abda6f8` | `f6090500-0001-4000-8000-000000000005` |
| ADMIN_MFA | admin | `171a2449-3eca-4ee2-9f33-c4a10fc8a29f` | `f6090500-0001-4000-8000-000000000006` |

표시 이름은 모두 `TEST <유형>`으로 고유하다. 이메일은 `crm-internal-rep@example.invalid` 등의 테스트 주소다. CONSULT의 `viewer`는 현행 CHECK에 맞춘 source role일 뿐 상담 쓰기 권한을 구현했다는 뜻이 아니다. GYEONGNAM도 아직 지사별 권한 분리가 없다. 향후 명시적 permission-role/scope 승인이 필요하며 이번에 `access_review` 객체를 만들지 않았다.

계정별 무작위 44자 비밀번호는 저장소 밖 `C:\Users\Administrator\crm-staging-private\auth-synthetic-20260905.json`에만 보관한다. 파일 자체의 상속 권한도 제거한 뒤 최종 ACL이 Administrator/SYSTEM 두 항목뿐임을 확인했다. 기존 `staging.env`를 덮어쓰지 않았다. 비밀번호·토큰·키는 채팅/SQL/저장소에 기록하지 않았다.

## 합성 데이터 구성

| 테이블 | 행 수 | 용도 |
|---|---:|---|
| users | 6 | 위 Auth UUID 명시적 연결 |
| sites | 5 | TEST 아파트 A/B/CONSULT/GYEONGNAM/ADMIN |
| organizations | 5 | 합성 조직·가상 주소 |
| contacts | 5 | TEST 연락처, `010-0000-0001`~`0005`, `example.invalid` |
| inquiries | 5 | Rep A/B·상담·지사·관리자 후보 문의 |
| deals | 5 | Rep A 1, Rep B 2, 지사 후보 1, 관리자 후보 1 |
| contact_assignments | 4 | 실제 `(person_key, site_name)` 활성 UNIQUE 제약 준수 |
| activities | 5 | 합성 활동·메모, 운영 메시지 없음 |
| next_actions | 6 | Deal 후속 5 + 상담 문의 후속 1 |
| 나머지 9개 public 테이블 | 0 | 데이터 미생성 |

같은 Site A에 서로 다른 Rep A/B의 Opportunity 두 개가 존재한다. Site가 같다는 이유로 권한을 합쳐도 된다는 뜻이 아니다. Deal은 `owner_id`, 문의는 `assigned_to`로 CRM UUID를 연결했다. 문의→Deal 순서로 INSERT하여 FK를 충족했고 Deal의 `origin_inquiry_id`를 연결했다. 문의의 역방향 `deal_id/opportunity_id`는 NULL로 유지했다.

`activities.actor_name` 등 기존 문자열 필드는 합성 표시값으로만 채웠다. 이는 서버 확정 actor/RPC 권한 구현을 대체하지 않는다. `stage_catalog` 등 운영 코드표 데이터도 복사하지 않았으므로 기존 화면 전체 기능회귀가 완료된 상태가 아니다.

개인정보 검증은 운영 명부를 조회하거나 비교하는 방식이 아니다. 승인된 합성 상수로만 만든 모든 필드와 실제 전체 행을 `EXCEPT ALL` 양방향으로 비교해 diff 0을 확인했다. 운영 고객·직원·Auth 행은 복사 0건이다. 기존 baseline 함수 본문의 하드코딩 이름은 이번 seed 데이터와 별개인 기존 메타데이터이며, baseline 수정 금지에 따라 그대로 유지했다.

## 증거 및 재현 파일

디렉터리: `sql/baseline/20260905/synthetic/`

- `auth-mapping.json`, `auth-observed.json`: 비밀값 없는 계정 UUID/확인 상태.
- `fixture.json`: 새 관측 스키마 전용 합성 행 전체.
- `seed.sql`: 승인 guard 포함 데이터 INSERT SQL. 기존 옛 seed generator 사용 안 함.
- `verify-seed.sql`, `seed-observed.json`: 전체 데이터 일치 및 UUID 연결 결과.
- `fk-observed.json`: 실제 FK 검사 결과.
- `after-metadata.json`, `metadata-comparison.json`: seed 전후 구조·권한 diff 0 증거.
- `seed-rollback.sql`: 아래 제한의 CRM 데이터 전용 rollback.

적용 전 snapshot/count는 상위 디렉터리의 `staging-before-seed-observed.json`, `staging-before-seed-counts.json`에 있다.

| 파일 | SHA-256 |
|---|---|
| seed.sql | `552556f6c444f048f8873786a60ab0b23a4c3c9e8ffd04476f9351d8e407dec0` |
| seed-rollback.sql | `3796dcee993d5ed671b6e918f226fb65dbbfa1ccdfce56a224c10f73cc0b5dd0` |
| 기존 staging-apply.sql (불변) | `89dce8ae467f614a1857dca82b49a7d17cf5483da97d2540cd814c0d4a9ea2de` |

로컬 시험:

```powershell
node --test tests/crm-baseline.test.cjs tests/crm-baseline-rollback.test.cjs tests/observed-synthetic-seed.test.cjs
```

PGlite/PostgreSQL 17.5 로컬 시험이며, Auth 부분은 로컬 모형이다. 실제 원격 생성 결과와 별도로 구분한다. JWT 로그인·권한 공격시험은 아직 실행하지 않았다.

## seed 전체 rollback 방법 — 지금은 실행하지 않음

이 단계의 rollback은 **CRM seed 제거 → Auth 테스트 계정 제거**의 두 부분이다. Auth 관리 API와 DB 트랜잭션 사이에 분산 원자성을 주장하지 않는다.

1. UI/연결 project ref가 `rprechiaglyjaydkmxsu`인지 다시 확인한다. Production이면 중단한다. 후속 v2/seed 변경이나 신규 데이터가 있으면 현재 rollback을 그대로 실행하지 않는다.
2. `verify-seed.sql`로 fixture diff 0을 재확인하고 `seed-rollback.sql` 해시를 확인한다. CRM 데이터가 수정됐거나 다른 데이터가 추가된 경우 역 SQL은 삭제 전에 거절한다. 가드를 해제하지 않는다.
3. 별도 rollback 승인 후 `seed-rollback.sql`의 BEGIN 직후 동일 트랜잭션에 다음 두 SET LOCAL을 넣어 실행한다. 승인 변수는 연결 ref 검증을 대신하지 않는다.

   ```sql
   SET LOCAL crm.synthetic_staging_ref='rprechiaglyjaydkmxsu';
   SET LOCAL crm.synthetic_seed_approved='yes';
   ```

4. 역 SQL은 18개 테이블을 잠근 뒤 baseline 구조/ACL·Auth 매핑·**전체 행의 정확한 일치**를 다시 검사하고, 명시된 fixture PK만 자식→부모 순서로 DELETE한다. DELETE 후 public 테이블이 모두 비었는지 검사한다. DDL/TRUNCATE/함수 호출/sequence 변경은 하지 않는다. SQL 실패 시 전체 CRM 삭제를 rollback한다.
5. CRM 행이 0인 것을 확인한 뒤 Supabase Authentication UI 또는 서버의 지원되는 Admin `deleteUser`로 **위 Auth UUID 6개만** 제거한다. `auth.users` 직접 DELETE는 하지 않는다. 향후 테스트 로그인으로 세션이 발급됐다면 먼저 세션을 취소하고 남은 access token 유효기간을 고려한다. 사용자 삭제만으로 기존 JWT가 즉시 무효화된다고 가정하지 않는다.
6. Auth 0 / CRM 전체 행 0 / baseline metadata diff 0을 확인한다. 해당 테스트 자격증명 파일은 별도 승인 하에 폐기한다. baseline 객체를 제거하는 `baseline-only-rollback.sql`은 이 단계의 rollback에 실행하지 않는다.

CRM rollback은 로컬에서 COMMIT 후 적용하여 원래 빈 CRM 데이터와 동일한 baseline metadata로 돌아오는 것을 검증했다. 실제 Staging 계정 삭제/seed 제거는 요청 범위를 넘어 재실행하지 않았다.

## 다음 단계의 경계

현재 취약 ACL을 그대로 둔 **테스트 데이터 준비 PASS**다. anon 접근 차단·Rep 간 격리·상담/지사 범위·MFA 강제·Storage는 아직 검증되지 않았다. Supabase 스킬의 신원/키 취급 원칙에 따라 Auth는 지원 UI로 생성하고 비밀값을 보호했으며, 사용자 지시대로 기존 ACL 보강은 이번에 하지 않았다.

v2 migration·creator default 변경·Legacy revoke·프론트 변경·Storage 생성·Production 변경을 하지 않고 Auth+seed 검증까지만 종료한다.
