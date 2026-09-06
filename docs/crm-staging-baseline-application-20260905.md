# Staging baseline 실제 적용 결과 — 2026-09-05

> 후속 로컬 검증: [Canonical baseline 보고서](crm-baseline-canonical-review-20260905.md). 사용자 승인 규칙(CRLF→LF, CR→LF만)에 따라 canonical diff 0 및 rollback guard 시험을 통과했다. 아래 raw diff 13개와 당시 중단 기록은 원문 증거로 유지한다. 수정된 guard의 원격 실행은 하지 않았다.

**실제 적용 성공 / 엄격한 baseline 재현 PASS 미충족 / diff 발견 후 중단. Production NO-GO 유지.**

## 실행 대상 및 승인 검증

- 실행 대상: `netform-crm-staging` / `rprechiaglyjaydkmxsu`만.
- 사용자 지정 `staging-apply.sql` SHA-256 `89dce8ae467f614a1857dca82b49a7d17cf5483da97d2540cd814c0d4a9ea2de` 일치를 파일 읽기와 실행 직전에 확인했다. 파일 자체는 변경하지 않았다.
- 실행 직전 메타데이터 SELECT에서 public relation/function/policy/custom domain·enum 없음, PostgreSQL 17.6 및 schema ACL/default privilege/extension 일치를 재확인했다. 별도 before 스냅샷을 저장했다.
- SQL Editor에 BEGIN~COMMIT 전체를 선택하여 한 번 제출했고, `Success. No rows returned`를 확인했다. UI의 RLS 경고에서는 승인된 원본의 RLS 상태를 보존하도록 `Run without RLS`를 선택했다. 자동 RLS 변경은 하지 않았다.
- UI 표시 `main PRODUCTION`은 이 별도 Staging 프로젝트의 branch 라벨이다. 실제 CRM Production `ymfbmpnizxvqsamnczow`에는 접속하거나 실행하지 않았다.

## 적용 전후 객체 수

| 항목 | 적용 전 Staging | 적용 후 Staging | 원본 기대값 |
|---|---:|---:|---:|
| tables | 0 | 18 | 18 |
| views | 0 | 5 | 5 |
| functions | 0 | 17 | 17 |
| sequences | 0 | 2 | 2 |
| constraints | 0 | 63 | 63 |
| indexes | 0 | 67 | 67 |
| table triggers | 0 | 8 | 8 |
| policies | 0 | 2 | 2 |

Auth 계정·고객 행·seed·Storage 파일은 생성하지 않았다. CRM 함수도 호출하지 않았다. 이 실행 흐름 외의 동시 쓰기 유무를 확인하기 위한 고객 테이블 행 조회는 수행하지 않았다.

## 적용 직후 diff

요청한 `capture-metadata.sql`을 그대로 실행하여 `source-metadata.json`과 비교했다. 결과를 로컬 Node 비교 코드로도 재확인했다.

- 모든 payload 항목 중 차이가 있는 항목: **functions.definition만**.
- 엄격한 원문 비교: **13개 함수에서 차이**.
- 13개 모두 CRLF를 LF로 변환하면 원문이 일치한다. 줄바꿈 외 문자 차이는 발견하지 못했다.
- 함수 signature/security/search_path/owner/ACL 및 나머지 속성은 동일하다.
- View 5개의 정의/options/owner/ACL, table/column/constraint/index/sequence/trigger, RLS/policy, default privileges, 캡처된 의존성은 모두 일치한다.
- **원문 줄바꿈 차이를 자동 예외로 승인하거나 expected baseline을 수정하지 않았다. 따라서 strict diff 0 / baseline 재현 PASS로 기록하지 않는다.**

차이 함수:

```text
_done_today(text)
apply_business_change(uuid,text,text,text,text,text,date)
crm_bundle()
metrics_channel_flow()
metrics_lost_breakdown(text)
metrics_operations(text)
parse_responses(text)
require_reason(text,text)
set_updated_at()
stage_sla_days(text)
today_counts()
today_tasks(text)
work_items_today(text)
```

편집기에 입력한 내용은 줄바꿈을 제외하면 승인 파일과 일치했지만, Windows/브라우저 SQL 편집 경로에서 줄바꿈이 CRLF로 변환되었다. 편집기에서 복사한 텍스트 해시는 `3cbc5a4df1e8dece3f8098a122006ccd24860ef1e54ebb2a52602f5cf15dd3d6`이며 승인 파일의 바이트 해시와는 다르다. 이 변환을 숨기거나 바이트 동일 제출로 주장하지 않는다.

초기 접근성 화면 추출은 연속 공백을 축약하여 View와 함수 들여쓰기 차이까지 표시했다. **그 결과를 최종 diff 근거로 사용하지 않았다.** 동일 조회 결과의 실제 DOM `gridcell.textContent` 원문을 가져와 다시 비교한 최종 결과가 위의 함수 13개 줄바꿈 차이다. 추가 DDL이나 함수 재생성은 하지 않았다.

## 현재 상태와 rollback 주의

- Staging에는 baseline이 COMMIT된 상태로 남아 있다.
- 사용자 지시대로 차이 발견 후 수정·추가 적용을 중단했다. rollback도 실제 실행하지 않았다.
- **기존 baseline-only rollback은 원본 함수 정의 MD5를 엄격하게 확인하므로, 현재 13개의 줄바꿈 차이 상태에서 그대로 실행하면 사전검증에서 거절된다.** 가드를 해제하거나 rollback SQL을 자동 수정하지 않았다. 후속 복원 검토에는 이번 실제 after 스냅샷을 사용해야 한다.
- 앞서 로컬 rollback/복원 시험 27 PASS는 원본 바이트가 보존된 로컬 모형의 결과이다. 이번 실제 Staging과 동일한 rollback 성공 증거로 확대하지 않는다.
- Production 접속/변경 **0**, Staging 외 프로젝트 변경 **0**, Auth/seed/v2/Legacy revoke/프론트/배포 실행 **0**.
- 원래 취약 ACL도 재현되어 있으므로 고객정보/운영 Auth를 넣을 수 있는 보안 승인 상태가 아니다.

## 보존한 실행 근거

- `sql/baseline/20260905/staging-before-apply-observed.json`: 실행 직전 전체 snapshot 및 환경 메타데이터.
- `sql/baseline/20260905/staging-after-apply-observed.json`: 실행 직후 원문 결과. metadata MD5 `ee9a0407d84f3080bec238f368cc20fb`.
- `sql/baseline/20260905/staging-apply-result.json`: 대상, 승인/편집기 해시, 객체 수, 13개 정의 해시 차이, 중단 상태.
- before metadata MD5: `79ac8834d044680a11becab8df6bd1d6`.
- source metadata MD5: `9872dac5bc6f60f19fc7c4a5514af0af`.

SQL Editor 조회/실행 화면: https://supabase.com/dashboard/project/rprechiaglyjaydkmxsu/sql/5f47a3cd-2e5c-41d2-87e9-a978666d5c95

**최종: baseline 실제 적용은 완료했으나 원문 diff 13건으로 재현 PASS는 보류한다. 요청된 중단 조건에 따라 여기서 멈춘다.**
