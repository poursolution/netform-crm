# 운영 메타데이터 실측 및 Staging 차이 보고 · 2026-09-05

## 판정: NO-GO

사용자가 운영 구조의 읽기 전용 조회를 승인한 뒤 Supabase Dashboard SQL Editor에서 SELECT만 실행했다.
조회 대상은 PostgreSQL 카탈로그, information_schema, pg_policies, Storage bucket 설정이다.
고객 행, Auth 사용자 행, 첨부파일, 비밀키는 조회하지 않았다. CRM RPC 자체도 호출하지 않았다.
운영/Staging에 DDL, DML, GRANT/REVOKE, migration, seed, Auth 생성, 배포, 결제 변경은 실행하지 않았다.
SQL Editor에는 조회용 `Untitled query` 초안/실행 이력이 남을 수 있다. DB 구조 변경과는 구분한다.

- 운영 ref: `ymfbmpnizxvqsamnczow`
- Staging ref: `rprechiaglyjaydkmxsu` (`netform-crm-staging`)
- 조직: Free, 프로젝트 2개. Billing에서 최근 청구 $0 확인.
- Staging: Healthy, public 테이블/함수 없음, Storage bucket 없음.
- Staging Auth: 사용자 목록은 없음. 하단 추정 10명과 불일치하여 6개 테스트 계정 준비 완료로 인정하지 않음.

이 보고서는 **부분 실측 메타데이터 감사**다. 전체 schema-only dump, 전체 snapshot JSON,
Data API 노출 설정 전수검증, 실제 anon/JWT 침투시험 또는 복구시험 완료를 의미하지 않는다.
기존 준비서의 "Staging 없음 / 운영 조회 안 함"은 과거 작업 시점의 기록이다. 현재 상태는 본 보고서를 따른다.

## 1. 실제 운영 인벤토리

public 일반 테이블 18개, view 5개, 일반 함수 17개. 그중 SECURITY DEFINER 7개.
SECURITY DEFINER 5개는 PUBLIC/anon/authenticated EXECUTE가 열려 있고, 2개는 서버 역할로 제한되어 있다.
모든 public 함수 owner는 postgres이며, 해당 역할의 BYPASSRLS=true를 확인했다.

### SECURITY DEFINER 7개 전수 ACL

| 함수 signature | PUBLIC | anon | authenticated | service_role | 본문 확인 |
| --- | --- | --- | --- | --- | --- |
| crm_bundle() | 허용 | 허용 | 허용 | 허용 | 확인, 호출자/소유권 제한 없음 |
| crm_site_contacts(uuid) | 허용 | 허용 | 허용 | 허용 | 확인, 입력 Deal ID만 조건 |
| crm_opportunity_work_set(jsonb) | 허용 | 허용 | 허용 | 허용 | 확인, 권한검사 없이 변경 및 감사기록 |
| today_counts() | 허용 | 허용 | 허용 | 허용 | 확인, 고정 담당자 목록으로 today_tasks 호출 |
| today_tasks(text) | 허용 | 허용 | 허용 | 허용 | 확인, 요청자가 준 담당자 이름으로 필터 |
| crm_contact_move(jsonb) | 금지 | 금지 | 금지 | 허용 | ACL만 확인 |
| crm_contact_upsert(jsonb) | 금지 | 금지 | 금지 | 허용 | ACL만 확인 |

나머지 SECURITY INVOKER 함수 10개도 PUBLIC/anon/authenticated/service_role EXECUTE 허용:

- `_done_today(text)`
- `apply_business_change(uuid,text,text,text,text,text,date)`
- `metrics_channel_flow()`
- `metrics_lost_breakdown(text)`
- `metrics_operations(text)`
- `parse_responses(text)`
- `require_reason(text,text)`
- `set_updated_at()`
- `stage_sla_days(text)`
- `work_items_today(text)`

Invoker 함수의 실행권한만으로 데이터 접근 성공을 단정하지 않는다. 호출자 테이블 권한/RLS,
호출되는 하위 함수 및 trigger를 함께 검토해야 한다. 이 10개 본문 전수검토는 이번에 하지 않았다.

## 2. 확인된 위험 경로

### P0 후보: crm_bundle의 무인증 전체 집계 경로

실제 정의는 SECURITY DEFINER / owner postgres / search_path public,pg_temp.
auth.uid(), 사용자 역할, 소유권 검증이 없다.
반환 구조에 Deal 금액·담당자·현장, 관리소 연락처/이메일/휴대폰,
문의 전화번호·상담 원문·주소·메모·응대 이력, 중복현장 메모, 활성 사용자 이름/역할이 포함된다.
Deal은 brand/badfit 조건이 있지만 사용자 범위 조건이 아니며, 문의 집계에는 사용자별 제한이 없다.
실제 데이터값/행 수/유출 발생 여부는 조사하지 않았다. 정의 주석의 과거 건수는 현재 건수 증거가 아니다.

### P0 후보: crm_opportunity_work_set의 무권한 쓰기 및 actor 위조

입력 opportunity_id로 deals의 공종 필드를 UPDATE하고 activities/audit_logs에 INSERT한다.
사유 길이·배열·존재 여부 검사는 있지만 인증/역할/대상 소유권 검사는 없다.
actor_name 또는 actor_id, 시각 at를 클라이언트에서 받는다. UUID 형태의 actor 문자열을
audit_logs.actor_id에 넣을 수 있으므로 서버가 auth.uid()로 확정하는 구조가 아니다.
실제 변경 시험은 금지 범위이므로 실행하지 않았다.

### 기타 공개 reader

- crm_site_contacts: Deal ID로 organization/contact를 연결하고 휴대폰 등 반환. 권한검사 없음.
  결과가 2명 이상인 경우만 배열을 반환하는 업무 로직도 있어, 향후 정상 기능 회귀시험에 반영해야 한다.
- today_tasks: 요청자가 보낸 이름으로 Deal/문의/연락처 조회. 로그인 UUID와 요청 이름을 연결하지 않음.
- today_counts: 고정 담당자 목록의 today_tasks 결과 수를 집계. 호출자 검증 및 고정 search_path 없음.

### RLS/정책

아래 7개 테이블은 RLS=false이며 anon에 SELECT/INSERT/UPDATE/DELETE 테이블 권한이 있다:

`advisory_deals`, `assignment_history`, `business_history`, `notes`, `projects`, `stage_catalog`, `stage_history`.

나머지 11개 테이블은 RLS=true:

`activities`, `audit_logs`, `contact_assignments`, `contacts`, `dashboard_state`, `deals`,
`inquiries`, `next_actions`, `organizations`, `sites`, `users`.

이들 11개에도 anon 테이블 수준 CRUD GRANT가 있지만, 그것만으로 행 접근 가능을 의미하지 않는다.
public/storage에서 관측한 정책은 총 2개뿐이다:

| 테이블 | 정책 | 역할/명령 | 조건 |
| --- | --- | --- | --- |
| dashboard_state | allow all | PUBLIC / ALL | USING true, WITH CHECK true |
| users | own row read | authenticated / SELECT | lower(email) = lower(auth.jwt()->>'email') |

dashboard_state는 RLS가 켜져 있어도 모든 역할에 행 접근을 허용한다. 저장된 내용은 조회하지 않았다.
그 외 RLS=true 테이블은 관측된 범위에서 permissive policy가 없으므로 일반 역할의 직접 행 접근은
기본 거부지만, postgres definer/view 경로는 별도로 검토해야 한다.

### View / default privileges / role

- view 5개: opportunities, v_assignee, v_dup_org, v_funnel, v_kanban.
- 모두 owner postgres, reloptions=NULL; security_invoker=true 설정 없음. anon SELECT 권한 있음.
  view 본문 전체 검토와 실제 API 시험은 아직 미완료다. view의 RLS=false를 테이블의 RLS 누락과 혼동하지 않는다.
- postgres/supabase_admin의 public 함수 default ACL에 anon/authenticated EXECUTE가 명시되어 있다.
  관측된 전체 pg_default_acl 목록에는 전역 함수 default 행이 없었다. 기본 PUBLIC EXECUTE도 함께 처리해야 한다.
- postgres의 storage 및 다른 서비스 스키마 default도 존재한다. public 보강을 이유로 관리 스키마를 일괄 변경하지 않는다.
- anon/authenticated: superuser=false, BYPASSRLS=false, public USAGE=true, CREATE=false.
- service_role: BYPASSRLS=true, public USAGE=true, CREATE=false. 모든 역할의 상속 경로 전수감사는 미완료.
- Storage bucket은 운영에도 0개다. 따라서 "private bucket + signed URL 검증 완료"가 아니다.

## 3. 기존 로컬안과 실제 운영의 차이

| 항목 | 로컬 후보/가정 | 실제 운영 | 필요한 조치 |
| --- | --- | --- | --- |
| 사용자 정본 | 새 crm_users.user_id = Auth UUID | public.users.user_id와 nullable auth_uid가 별도 존재 | 기존 UUID 연결 보존 설계 우선 |
| Deal 담당자 | 새 assignee_user_id | owner_id → users(user_id) FK; 표시 assignee_name | 기존 업무 UUID와 Auth UUID를 혼동하지 않음 |
| 문의 담당자 | seed의 assigned_to를 표시 이름처럼 취급 | assigned_to uuid → users(user_id) FK; assignee_name 별도 | seed/identity evidence 추출 수정 필요 |
| 역할 | rep/consultation/branch_rep/manager/admin | CHECK: rep/admin/dual/viewer | dual/viewer를 새 역할로 자동 매핑하지 않음 |
| 사용자 제약 | Auth UUID FK 및 고유성 | users.name UNIQUE; 조회한 constraints에 auth_uid FK/UNIQUE 없음 | 별도 인덱스까지 확인 후 제약 설계; 실제 매핑 데이터 검증 별도 |
| seed Deal 컬럼 | site/assignee/stage/created | 해당 이름 없음; organization/site_id, assignee_name, stage_code, created_at 등 | 현재 seed generator 실행 금지 |
| seed 문의 컬럼 | site/created/amount | site_name/created_at; amount 없음 | 실제 스키마용 합성 seed adapter 필요 |
| 문의 reader created | bundle e->'created' 참조 | 운영 bundle 문의에는 at(=received_at), created 없음 | 응답 계약 수정/회귀 검증 필요 |
| 문의 write RPC | assign/unassign/status/trash 등 파일 존재 | public 함수 17개 목록에는 crm_inquiry_* 없음 | 파일 존재와 운영 배포를 구분 |
| Hardening 대상 | public crm_* SECURITY DEFINER | today_counts/today_tasks도 공개 definer | 현재 이름 prefix 필터로는 2개가 빠짐 |
| 테이블/뷰 보강 | 함수 ACL 위주 보강 | RLS 미설정 7개, allow-all 정책, postgres view 5개 | 함수 회수만으로 보안완료 불가 |
| Write/Audit/Storage fixture | ownWrite/readWriteAudit/signedUrl 미정 | 기존 쓰기 함수가 UUID 인증 계약이 아님, bucket 없음 | 가짜 PASS 대신 실제 계약 설계 필요 |

권장 연결은 기존 IDs를 버리지 않는 방식이다:

`auth.uid() → users.auth_uid → users.user_id → deals.owner_id / inquiries.assigned_to`.

이는 설계 권고이며 적용된 상태가 아니다. auth_uid의 NULL/중복/퇴사/역할/team 매핑은
고객·사용자 행을 읽지 않은 이번 점검으로 검증할 수 없다. 불명확한 연결은 manual_review로 남긴다.
새 crm_users를 유지할지 기존 users를 확장할지도 이 연결 계약을 검토한 후 확정해야 한다.

## 4. 다음 작업과 승인 경계

1. 현재 로컬 Hardening/identity/seed 파일을 운영 또는 빈 Staging에 그대로 실행하지 않는다.
2. 미수집한 전체 컬럼 default/identity/generated 속성, 모든 FK/check/index/trigger,
   view 정의, 의존 함수, enum/extension/sequence를 schema-only로 확보·검토한다.
   이번 정보는 기본 구조 diff용이며 완전 복원 가능한 DDL dump가 아니다.
3. 위 차이에 맞춘 로컬 seed/UUID/reader/ACL 대상 수정안을 작성하고 synthetic 로컬 회귀시험을 한다.
4. Staging에 적용할 정확한 SQL과 영향 범위를 제시하고 별도 적용 승인을 받는다.
5. 승인 후 Staging schema-only → 합성 Auth/seed → 권한 migration → 실제 JWT/Storage/rollback 순서.
6. 운영 위험 경로가 현재 존재하므로 임시 차단안도 별도로 검토할 가치가 있다.
   회수 시 PC/모바일/n8n 업무 중단 가능성이 있어 이번 조회 승인을 변경 승인으로 해석하지 않는다.

Supabase 보안 지침에 따라 "로그인 역할", "테이블 GRANT", "RLS", "definer owner"를 나눠 판정했다.
공개 ACL을 관측했다고 기존 manifest에 자동 allowlist 등록하지 않았다.

| Gate | 실제값 | 판정 | 이번 Production 영향 |
| --- | --- | --- | --- |
| anon CRM 접근 0 | definer 5개 공개, RLS 미설정 7개, allow-all 정책 | FAIL(메타데이터상) | SELECT만 |
| UUID 기반 권한 | 기존 UUID FK는 있지만 공개 함수에서 사용자 검증 안 함 | FAIL | 변경 없음 |
| Staging 동일 스키마 | public 비어 있음 | FAIL | 없음 |
| 실제 JWT 11개 | 이번 실행 안 함 | 미검증 | 없음 |
| Storage authorization | bucket 없음, 시험 안 함 | 미검증 | 없음 |
| P0 XSS = 0 | 이번 프론트 검증 안 함 | 미검증 | 없음 |
| 전체 rollback | 실행 안 함 | 미검증 | 없음 |
| Production 적용 | 금지 유지 | NO-GO | migration/데이터/ACL 변경 0 |

이전 151 tests / 140 PASS / 11 SKIP은 이전 로컬 실행 기록이며, 이번 실측 결과를 반영한 재시험 결과가 아니다.
