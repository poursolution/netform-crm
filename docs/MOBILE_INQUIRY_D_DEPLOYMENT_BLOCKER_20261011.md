# 승인 문의 D — 운영 저장 배포 차단 근거

## 최신 상태 — 사용자 승인 후 서버 설치·활성화

2026-10-11 사용자가 **“서버 설치·검증·활성화 승인”**을 명시했다. 아래 설치 전 감사 기록 이후, 루트 작업에서 승인된 3개 마이그레이션과 서버 플래그 활성화를 완료했다. **서버 계약 설치·활성화와 운영 UI 배포/실사용 저장 성공은 구분한다. 이 문서 갱신 시점에 UI 배포는 아직 완료로 확인하지 않았다.**

### 설치 이력과 현재 설정

운영 마이그레이션 목록에서 다음 순서와 버전을 확인했다.

| 순서 | 버전 | 이름 |
|---|---|---|
| 1 | `20261011112839` | `contact_consent_preserve_omitted` |
| 2 | `20261011112905` | `schedule_preserve_v1` |
| 3 | `20261011112915` | `inquiry_response_preserve_v1` |

설치 직후 `schedule_v1_settings.enabled=false`를 확인했다. 그 후 루트 작업이 승인 범위에서 true로 변경했고, 이 감사에서도 SELECT로 **enabled=true**를 다시 확인했다. 아래 설치 전의 ‘미설치/비활성’ 표는 과거 시점의 근거로 남기며 현재 상태를 뜻하지 않는다.

### 설치 후 완료한 읽기 전용 검증

- 신규 public RPC 5개가 모두 존재한다. 연락처 함수는 `(uuid,text,uuid,integer,jsonb)`, 일정 3개와 응대 확인은 `(jsonb)`로 후보와 동일하다. 모두 SECURITY DEFINER와 빈 search_path다.
- 신규 5개 public 함수 및 3개 private 일정 보조 함수의 실제 본문을 후보 SQL과 비교했다. CRLF 및 앞뒤 공백만 정규화한 MD5 기준 **8/8 일치**다. 기존 79개 사용 컬럼은 설치 후 다시 조회해 **79/79 존재·타입 호환**을 확인했다.
- `crm_release_manifest_v1()`은 새 5개 RPC를 모두 포함한다. 연락처 wrapper의 `preserve-omitted-v1`, 일정의 `crm.schedule.v1`, 응대 확인의 `crm.inquiry-response.v1` 표식을 확인했다.
- 기존 go 함수도 설치 후 `contact_consent_contract` 및 `preserve-omitted-v1` 표식이 실제 본문에 존재한다. `md5(pg_get_functiondef(...))`는 설치 전 `a0209794d0844913f287bd9da509e3e1`에서 설치 후 `3b3257674288f428d5527852d9268828`로 바뀌었다. go 본문 전체를 위 8/8 비교에 포함했다고 해석하지 않는다.
- 새 private 테이블 `schedule_v1_settings`, `schedule_v1_events`, `inquiry_response_v1_receipts`는 모두 RLS=true이고 정책은 0개다. PUBLIC/anon/authenticated/service_role 직접 SELECT·INSERT·UPDATE·DELETE 권한은 모두 없다. 3개 private 보조 함수도 이 4개 역할에 직접 EXECUTE가 없다.

### public 함수 실행 권한의 실제 상태

| RPC | authenticated | anon / PUBLIC | service_role |
|---|---|---|---|
| `crm_contact_command_v1` | 허용 | 거절 | 거절 |
| `crm_schedule_list_v1` | 허용 | 거절 | 허용 |
| `crm_schedule_write_v1` | 허용 | 거절 | 허용 |
| `crm_schedule_receipt_v1` | 허용 | 거절 | 허용 |
| `crm_inquiry_response_confirm_v1` | 허용 | 거절 | 허용 |

이 차이는 원본 SQL의 명시 REVOKE 범위와 일치한다. 연락처 SQL은 service_role도 회수하고, 일정/응대 SQL은 PUBLIC·anon·authenticated를 회수한 뒤 authenticated를 다시 부여한다. 설치 환경의 service_role public 함수 기본권한은 4개에 남는다. 이 감사에서 정책을 임의로 바꾸지 않았다.

EXECUTE 권한이 있어도 일정/응대는 `auth.uid()`와 `actor()`, 대상 scope·현재 담당을 확인하는 본문을 거친다. service_role이라는 이유만으로 담당 검증을 생략하는 코드는 없다. 후속 루트 검증에서 `auth.uid() IS NULL`과 `enabled=true`를 먼저 확인한 뒤, 읽기 전용 트랜잭션과 고정 합성 UUID로 새 5개 RPC를 호출했다. 일정 조회·저장·영수증·문의 응대 확인은 모두 `42501 SCHEDULE_FORBIDDEN`, 연락처 저장은 `42501 forbidden`으로 초기 권한 검사에서 거절됐다. **인증 정보 없는 호출 5/5 차단을 확인했으며, 로그인 사용자 저장 성공을 검증한 것은 아니다.** 고객 데이터 쓰기·메시지 발송은 하지 않았다. 기존 go 함수의 `effective_contact_consent` 병합 표식도 재확인했다.

### 변경 관련 Advisors 결과

신규 객체와 연락처 계약 관련 객체만 추려 확인했다. 아래 경고는 ‘프로젝트 전체 이상 없음’ 판정이 아니다.

- 신규 private 3개 테이블의 RLS 정책 없음은 INFO다. 직접 권한을 모두 회수하고 SECURITY DEFINER 경로만 사용하는 현재 설계와 함께 검토했다. [RLS 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- 신규 public 5개 함수의 authenticated SECURITY DEFINER 실행은 WARN이다. 의도한 RPC 경로이며 actor/scope 검사와 빈 search_path를 확인했다. 익명 공개로 바꾸거나 검사를 제거하지 않았다. [SECURITY DEFINER 실행 권한 안내](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- 신규 `schedule_v1_action_history` 인덱스 미사용은 INFO다. 막 설치된 감사 인덱스를 삭제하지 않았다. 기존 `contact_compat_state`의 FK 인덱스 INFO도 보였으며 이번 설치에서 인덱스 구조를 바꾼 항목은 아니다. [미사용 인덱스 안내](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [FK 인덱스 안내](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)

**클라이언트 연결:** PR #597의 `crm.html`과 `mobile.html`은 공통 일정 모듈 전에 `CRM_SCHEDULE_V1=true`를 설정하고 관련 6개 모듈의 캐시를 갱신한다. 집중 검사 84개가 통과했으며 서버 disabled/writable=false·권한/대상 불일치·허위 ACK는 계속 차단한다. 로컬 운영 조립 368개 자산과 해시 검사도 통과했다.

**남은 배포 확인:** 클라이언트 변경은 GitHub 검토 브랜치에 있으며 운영 UI/자산 배포는 아직 하지 않았다. 실제 로그인 권한에서 읽기/ACK 수신, 실제 저장·기기 간 반영·개인 알림은 별도 검증이 필요하다. 이 감사는 카탈로그·설정·인증 없는 호출 거절과 로컬 합성 검사 근거이며 실제 고객 저장 성공을 대신하지 않는다.

---

## 설치 전 감사 이력 — 아래는 승인·설치 이전 상태

확인일: 2026-10-11. 대상: `poursolution/netform-crm`. 이 문서는 준비 상태와 읽기 전용 확인 결과이며 SQL 설치·권한 변경·기능 활성화 승인이 아니다.

후속 실행 상태: 연락처 보존 마이그레이션 설치 요청은 자동 승인 검토가 실행 전에 거절했다. GitHub 동기화 요청에 운영 스키마·공통 저장 경로·실행 권한 변경의 구체적 승인이 포함되지 않았다는 사유다. 실제 SQL 설치·권한 변경·게이트 활성화는 실행되지 않았다. 같은 작업을 다른 경로로 우회 실행하지 않는다.

## 설치 전 결론

승인 D 화면의 로컬 연결과 운영 서버 저장은 별개다. 운영 서버에 필수 계약이 없어 **GitHub/화면 배포만으로 문의 D 저장 완료라고 표시할 수 없다.** 로컬 합성 예시는 메모리 RPC를 사용하며 운영 검증 결과가 아니다.

코드의 Supabase 프로젝트 주소와 같은 프로젝트에서 `pg_proc`, `pg_namespace`, `to_regclass`, `to_regprocedure`를 SELECT로만 확인했다. 고객·사용자 원자료는 조회하지 않았다.

| 운영 확인 대상 | 결과 |
|---|---|
| `public.crm_schedule_list_v1(jsonb)` | 없음 |
| `public.crm_schedule_write_v1(jsonb)` | 없음 |
| `public.crm_schedule_receipt_v1(jsonb)` | 없음 |
| `public.crm_inquiry_response_confirm_v1(jsonb)` | 없음 |
| `crm_security.schedule_v1_settings`, `schedule_v1_events`, `inquiry_response_v1_receipts` | 모두 없음 |
| `schedule_v1_context`, `schedule_v1_token`, `schedule_v1_provenance` 보조 함수 | 모두 없음 |
| 기존 `public.crm_inquiry_command_v1(jsonb)` | 있음. SECURITY DEFINER, authenticated 실행 허용, anon 불가 |

`crm_release_manifest_v1()`은 public 스키마의 `crm_*` 함수 중 authenticated 실행 권한이 있는 함수를 카탈로그에서 동적으로 수집한다. 현재 미설치 4개를 설치된 계약으로 보고하지 않는다. 후보 SQL과 운영 설치본의 동일성을 주장할 수 없다.

## 설치 후보와 순서

아래는 승인 후 별도 작업에서 필요한 절차 설명이다. 이 확인에서는 실행하지 않았다.

1. 기존 `users`, `deals`, `inquiries`, `next_actions`, `stage_history`, `crm_security.actor/can_deal/can_inquiry`, `access_review`, `object_scope`, `inquiry_contact_logs`, `inquiry_audit_events`의 사용 컬럼·타입·권한·트리거를 운영과 대조한다. 선택 연동인 `work_request_followup_events`는 존재할 때만 일정 출처 확인에 사용한다. 카탈로그의 함수 부재 확인은 이 선행조건 대조를 대신하지 않는다.
2. `sql/schedule-preserve-v1-20261011.sql`을 먼저 설치하는 후보 절차다. 3개 public RPC와 private 보조 함수·설정·감사 테이블을 만든다. 최초 설치의 `enabled`는 false다. 재실행은 기존 설정/이력을 지우지 않으므로 이미 true인 설정을 자동 false로 되돌리는 스크립트가 아니다.
3. `sql/inquiry-response-preserve-v1-20261011.sql`을 그다음 설치하는 후보 절차다. 저장된 본인 연결 기록을 근거로 응대 상태·단계 이력·감사·영수증만 한 트랜잭션에서 확인하며 기존 업무 완료/취소를 만들지 않는다.
4. 두 파일은 각각 `BEGIN/COMMIT`과 PostgREST 스키마 새로고침 알림을 포함한다. 함수 설치·ACK·실계정 권한·동시 변경·운영 트리거/알림 및 기존 일정 교체 경로 차단을 검증한 후 활성화를 별도로 판단해야 한다.
5. 클라이언트는 `CRM_SCHEDULE_V1 === true`, 일정 3개 RPC의 `CRMRelease.has()`, 응대 확인 RPC 설치를 요구한다. 조회 응답의 서버 `enabled`와 `writable`도 true여야 한다. 어느 한쪽만 켜서는 준비 완료가 아니다.

## 권한과 데이터 변화 범위

- 후보는 신규 4개 public RPC의 EXECUTE를 authenticated에 부여하므로 새 함수 실행 권한이 추가된다. public/anon은 허용하지 않는다. 기존 계정·역할·object scope 행은 변경하지 않으며, 함수 내부는 기존 actor/access review/object scope/현재 담당과 활성 상태를 다시 검사한다. 이 권한 부여도 설치 승인 범위에서 검토해야 한다.
- 새 private 테이블은 RLS를 켜고 public/anon/authenticated 직접 권한을 회수한다. private 보조 함수도 직접 실행 권한을 주지 않는다. 새 public 함수는 SECURITY DEFINER와 빈 search_path를 사용한다.
- 일정 쓰기는 추가 또는 같은 ID의 날짜 변경만 허용한다. 원기한·사유·이전/이후 값·요청 ID를 보존한다. 기존 고객 약속 변경은 재합의 근거 계약이 없으므로 차단한다. 다른 미완료 업무를 일괄 완료·취소하지 않는다.
- 과거 데이터 보정/backfill은 없다. 원본 일정 행 없이 평면 날짜만 있는 건, 이미 종료/이관된 문의, 담당 없는 건 등은 별도 검토 상태로 거절한다.

## 중단과 복구 후보

`sql/schedule-preserve-v1-disable.sql`은 설정을 false로 바꾸는 **비파괴 기능 중단** 파일이다. 이미 설치된 설정 테이블이 필요하다. 서버 신규 일정/응대 확인 쓰기를 막지만 업무·감사·영수증은 삭제하지 않는다. 같은 요청의 이미 커밋된 영수증 재반환은 서버에서 보존한다. 클라이언트 게이트 OFF는 새 호출도 막으므로 미확인 저장의 복구 절차를 별도로 관리해야 한다.

이 파일은 스키마를 제거하거나 기존 저장 데이터를 되돌리는 down migration이 아니다. 설치 전에는 실행할 대상 테이블 자체가 없다. 새 서버 기능 중단과 이전 화면/기존 교체 저장 경로 재노출을 같은 롤백으로 취급하면 안 된다.

## 집중 SQL 검사 상태

2026-10-11 아래 명령을 현재 후보에서 다시 실행해 통과했다.

```text
node tests/schedule-contract.test.cjs
```

- 실제 후보 SQL을 로컬 PGlite PostgreSQL의 합성 스키마에 적용: 일정 45개 + 응대 확인 16개 = **61개 통과**.
- 응대 16개는 `tests/inquiry-response-sql.cjs`를 위 실행기가 호출한다. 각각 SQL을 두 번 적용하는 재실행 검사도 포함한다.
- 기존 일정/기한 보존, 동일 요청 재시도, 변조 요청 거절, stale token, 다른 계정/담당 차단, 익명 거절, private 테이블 직접 접근 차단, 감사·영수증 실패 트랜잭션 롤백, 비활성 신규 쓰기 거절을 검사한다.
- 증거: `schedule-sql-result.json`, `inquiry-response-sql-result.json`. 실행 로그는 작업공간 `outputs/mobile-publication-review-20261011/inquiry-schedule-sql-readiness_20261011.log`.
- 표준 `test:contracts` 통과 수와 별도인 집중 SQL 실행 결과다. 운영 SQL 실행·운영 데이터 쓰기는 **0건**이다.
- 한계: 단일 세션 PGlite이며 운영 PostgreSQL 다중 연결 경쟁, 실제 운영 트리거·개인 알림/Realtime, 운영 계정 PC·iOS·Android 저장 성공을 증명하지 않는다.

## 현재 전달 가능한 상태

GitHub에 후보 코드·SQL·검증 근거를 전달하고 승인 디자인 화면을 확인할 수 있는 상태다. 운영 문의 D 저장은 서버 선행조건 검토·설치·검증·활성화가 남아 있다. 이 문서는 그 실행을 승인하거나 이미 완료됐다고 해석하지 않는다.

## 추가 차단: PC·모바일 공통 연락처 저장

같은 날 같은 운영 프로젝트의 함수 카탈로그를 추가 SELECT로 확인했다. 저장 RPC를 실제 실행하지 않았다.

| 운영 확인 대상 | 결과 |
|---|---|
| `public.crm_contact_command_v1(uuid,text,uuid,integer,jsonb)` | 모든 스키마에서 이름 조회 결과 없음. 실행 권한·계약을 확인할 설치본이 없음 |
| 기존 `public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)` | 있음. SECURITY DEFINER, authenticated 실행 허용, anon 불가. 신규 동의 보존 표식 없음 |
| `crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb)` | 있음. `contact_consent_contract` / `preserve-omitted-v1` 표식 없음 |
| 위 go 함수의 `md5(pg_get_functiondef(...))` | `a0209794d0844913f287bd9da509e3e1` — 후보가 요구하는 수정 전 기준과 일치 |

관련 후보는 `supabase/migrations/20261011080417_contact_consent_preserve_omitted.sql`이다. 일정 보존 SQL과 별도 계약이다. 이 마이그레이션은 기존 go 함수의 동의 저장/ACK 부분만 관찰된 원문 해시 기준으로 치환하고, 새 public wrapper를 추가한다. 설치 시점 정의가 바뀌면 `CONTACT_GO_BASE_HASH_MISMATCH`로 중단한다. 현재 기준 해시 일치는 설치 가능성의 선행 근거일 뿐 운영 설치·권한 승인·실제 저장 검증을 뜻하지 않는다.

### 프런트 배포 영향

`operational-adapter.js`의 `toRpc()`는 `contact_upsert`에 항상 `crm_contact_command_v1`을 선택한다. `transport.js`와 `pc-manager-transport.js` 양쪽이 이 경로를 사용하며 기존 `crm_write_command_v2`로 재시도/우회하지 않는다. 응답의 `contact_consent_contract='preserve-omitted-v1'`와 6개 최종 동의값도 필수다.

따라서 **서버 선행 적용 없이 이 후보 공통 프런트를 먼저 운영 배포하면 PC·모바일의 `contact_upsert` 연락처 저장이 실패한다.** PC 대표 연락처 지정·일반 연락처 수정·명시 동의 변경 등도 영향을 받는다. 이 문장은 지금 운영 화면 전체가 이미 실패한다는 관찰이 아니라, 확인한 서버 상태와 후보의 필수 경로가 불일치한다는 배포 차단 판단이다. 다른 operation은 계속 기존 공통 쓰기 함수를 사용한다.

승인 I-3 명함 저장은 별도 회사/동일인/현장 연결 계약도 미완료라 현재 차단 상태다. 공통 연락처 wrapper 설치만으로 I-3 전체 완료를 선언할 수 없다.

### 권한·응답·복구 조건

- 후보는 신규 wrapper의 EXECUTE를 authenticated에 부여하고 public/anon/service_role에서는 회수한다. 기존 사용자·역할·object scope 행을 변경하지 않는다. 내부는 `actor()`, 본인 auth 연결, 현재 영업건 쓰기 권한, `contact_upsert` operation, 요청/영업건 버전과 payload를 검사한다. 새 함수 권한 부여는 별도 설치 검토 대상이다.
- 서버에서 생략된 동의 6필드를 기존 `(contact_id, deal_id)` 상태와 병합한다. 새 관계에는 기존 false/null 기본값을 쓰며 다른 사람·영업건 동의를 복사하지 않는다. 저장 후 최종값과 표식을 원래 receipt에 보존한다. 명시 제출값·영수증·결과가 맞지 않으면 전체 트랜잭션을 취소한다.
- wrapper만 설치하고 go 패치가 빠진 상태, 또는 옛 표식 없는 receipt를 새 성공으로 재포장하는 동작은 허용되지 않는다. 원래 요청 ID/payload를 유지해 미확인 저장부터 대사해야 하며 새 ID를 자동 재발급하지 않는다.
- 파일은 한 트랜잭션이다. 이 파일 자체에 별도 disable/down migration이나 역치환 롤백 명령은 없다. 일정 `schedule-preserve-v1-disable.sql`로 이 연락처 계약을 끌 수 없다. 서버/adapter/양쪽 transport/PC 호출자/HTML 캐시 버전을 함께 관리하고 부분 롤백 시 동의값 보존과 미확인 큐를 먼저 검토해야 한다.
- 이 파일에는 명시적인 PostgREST 스키마 reload 알림이 없다. 설치 후 카탈로그뿐 아니라 RPC 노출과 엄격한 응답 계약까지 확인하는 별도 배포 검증이 필요하다. 이번 확인은 설치나 reload를 실행하지 않았다.

### 최신 집중 검사

아래 3개를 로컬 합성 환경에서 다시 실행하여 **63개 통과 / 실패 0**을 확인했다.

```text
node --test tests/contact-consent-postgres.test.mjs tests/contact-consent-transport.test.cjs tests/contact-consent-callers.test.cjs
```

PGlite 실제 후보 SQL, 양쪽 실제 transport, PC 호출자의 생략/false/null 구분·엄격 ACK·같은 ID 재시도·계정 변경·구/신 모듈 혼합 차단을 검사한다. 로그: 작업공간 `outputs/mobile-publication-review-20261011/contact-consent-readiness_20261011.log`. 운영 SQL/권한 변경·운영 연락처 저장은 0건이다. 설치 후 운영 트리거·실계정 저장 성공을 검증한 결과가 아니다.

## 운영 스키마 선행조건 대조 — 읽기 전용

같은 운영 프로젝트의 `information_schema.columns`, `pg_proc`, `pg_constraint`, `pg_trigger`를 사용했다. 후보에서 직접 참조하는 컬럼과 예상 PostgreSQL 타입을 VALUES 집합으로 만들어 LEFT JOIN 비교했다. `text`/`varchar`만 호환 문자열로 인정했고 날짜·시각·UUID·정수·boolean·jsonb는 실제 UDT를 대조했다. 레코드 내용과 운영 사용자 정보는 조회하지 않았다.

| 대조 항목 | 결과 |
|---|---|
| 일정/응대 SQL의 기존 9개 테이블 직접 사용 컬럼 | 60개 중 60개 존재·타입 호환, 누락/타입 불일치 0 |
| 연락처 patch·receipt의 기존 2개 테이블 직접 사용 컬럼 | 19개 중 19개 존재·타입 호환 |
| `next_actions`, `stage_history`, `inquiry_audit_events` INSERT에서 빠진 NOT NULL·기본값 없음·비생성 컬럼 | 0개 |
| `crm_security.actor()` | `TABLE(user_id uuid, auth_uid uuid, display_name text, permission_role text)` 일치 |
| `can_deal(uuid,boolean)`, `can_inquiry(uuid)` | boolean 반환 함수 존재 |
| `auth.uid()`, `pg_catalog.gen_random_uuid()` | 존재 |
| `contact_compat_state` PK | `(contact_id, deal_id)` 일치 |
| `command_receipts` PK | `(actor_auth_uid, request_id)` 일치 |
| 기존 CHECK·FK | `inquiry_stage_progress`, 연락 결과/connected, 업무 open 상태와 단일 대상, actor·문의 FK가 후보 사용과 충돌하는 구조는 확인되지 않음 |
| 선택 연동 `work_request_followup_events` | 미설치. 후보는 존재 확인 후 동적 참조하므로 이 테이블 부재 자체로 설치/조회 실패하지 않음 |

타입 대조한 일정/응대 테이블: `users`, `deals`, `inquiries`, `next_actions`, `stage_history`, `access_review`, `object_scope`, `inquiry_audit_events`, `inquiry_contact_logs`. 연락처는 `contact_compat_state`, `command_receipts`다. 이는 지정 컬럼에 대한 구조 비교이며 모든 운영 데이터가 새 계약을 만족한다는 의미가 아니다.

### 실제 트리거와 남은 검증

대상 8개 테이블에서 활성 사용자 트리거 14개를 확인했다. 실제 정의도 읽기 전용으로 대조했다.

- `next_actions` / `inquiries` / `deals`의 `set_updated_at()`는 BEFORE UPDATE에서 `updated_at=now()`를 지정한다. 후보는 RETURNING 또는 저장 후 재조회 값으로 ACK/token을 구성한다. 로컬에서 생성한 시각을 운영 저장 시각으로 간주하면 안 된다.
- `inquiry_audit_events`에는 `private.inquiry_personal_capture_audit()`가 붙어 있다. 응대 확정이 기록하는 `inquiry_stage_progress`는 기존 코드상 ‘문의 상태 변경’ 사건으로 분류된다. 알림 활성 상태와 실제 수신·발송 결과는 이번 카탈로그 감사에서 조회/실행하지 않았다.
- `next_actions` 및 `inquiries.next_action_date`에는 개인 알림 예정 생성·변경 트리거가 있고, `inquiry_contact_logs`에는 연락 후속 알림과 활동 연결 인덱스 트리거가 있다. 기존 중복 방지·현재 담당자 검증을 포함한 전체 외부 발송 성공은 로컬 대체 트리거 검사로 증명되지 않는다.
- `crm_change_signal()`은 change log/Realtime 갱신을 호출하며 오류를 포착해 업무 저장을 막지 않는 정의다. 함수가 있다는 사실은 실제 다른 기기의 갱신 도착을 증명하지 않는다.
- `capture_contract_signing`은 `deals.stage_contexts` 업데이트에만 붙어 있고 후보 일정 SQL은 그 컬럼을 쓰지 않는다.

이 카탈로그 대조에서는 후보의 지정 컬럼/필수 함수에 설치 즉시 실패를 확정할 구조 불일치를 찾지 못했다. 그러나 신규 RPC 미설치라는 배포 차단은 그대로다. 마이그레이션을 수행할 역할의 생성·함수 소유/실행 권한, 실제 다중 연결 경쟁, 운영 알림·트리거와 RPC ACK의 통합 검증은 완료로 처리하지 않는다. 설치 여부 및 권한 승인은 이 문서에서 추정하지 않는다.
