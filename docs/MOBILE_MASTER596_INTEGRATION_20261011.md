# 모바일 후보와 master #596 통합 검증

검증일: 2026-10-11 (KST)  
대상 저장소: `poursolution/netform-crm`  
상태: 로컬 통합 및 합성 검사 완료. 이 문서는 GitHub 게시·병합·운영 배포·운영 DB 검증 완료를 뜻하지 않는다.

## 1. 비교 기준과 범위

| 구분 | 기준 |
| --- | --- |
| 공통 원본 | PR #595 이후 `7ba66adfb11d048a2061bd0a3a4a4bf8352873a4` |
| 가져올 최신 master | PR #596 이후 `ad209245d50bdc46569b9533fdcf3b601936f679` |
| 모바일 및 저장 기능 후보 | 로컬 `outputs/mobile-guide42-implementation` |

공통 원본에서 최신 master까지 바뀐 파일은 19개다. 이 중 후보에도 들어 있는 파일은 `crm.html`, `deal-detail-v3.js`, `pc-error-state.js`, `pc-manager-transport.js` 4개다. 이번 통합은 이 4개 파일만 수정했다.

후보 폴더는 저장소 전체 사본이 아닌 부분 덮어쓰기 묶음이다. 게시본은 최신 master를 바탕으로 만들고 후보 변경분을 얹어야 한다. 후보에 없는 최신 파일을 삭제하거나 이전 버전으로 되돌리면 안 된다.

줄 끝을 LF로 정규화한 3자 비교에서 실제 중첩은 다음과 같았다.

| 파일 | 두 변경이 겹친 부분 | 통합 방법 |
| --- | --- | --- |
| `crm.html` | 스타일·스크립트 asset 태그가 모인 긴 줄 | 최신 견적 모듈 순서와 버전을 반영하고 후보의 저장 보조 모듈·저장 경로를 유지 |
| `pc-manager-transport.js` | RPC 허용 목록 | 최신 견적 RPC 2개와 후보 추가 RPC를 모두 유지 |
| `pc-error-state.js` | RPC별 오류 이름 | 두 쪽에서 추가한 이름을 함께 유지 |
| `deal-detail-v3.js` | 내용 변경 지점은 겹치지 않음 | 최신 견적 연결 4개 변경을 그대로 가져오고 후보 변경을 유지 |

CRLF/LF 차이 때문에 원시 병합에서는 파일 전체가 충돌한 것처럼 보였다. 이를 의미 있는 코드 충돌로 집계하지 않았다.

## 2. 보존한 최신 PC 견적 기능

### `deal-detail-v3.js`

- 자료 영역의 기존 `견적 작성` 동작을 최신 master와 동일하게 유지했다.
- `QuoteComposer`, `QuoteCompose`, 기존 편집 권한 및 `crm_quote_version_save_v1` 배포 가능 여부를 확인하는 기존 조건을 유지했다.
- 기존 견적 작성 칸의 `.qc-host`에 `QuoteComposer.mount()`를 연결했다.
- 기존 `data-v="compose"` 동작이 `openP7('quote')`로 이어지도록 최신 master의 코드를 반영했다.
- 최신 master에서 이 파일에 추가·변경된 4개 줄이 후보에도 그대로 존재함을 정적 검사했다.

### 전송·오류 계약

`pc-manager-transport.js`에 최신 master의 `crm_quote_compose_v1`, `crm_quote_version_save_v1`을 반영했다. 최신 master의 RPC 이름이 모두 남아 있음을 확인했다.

`pc-error-state.js`에는 같은 두 함수의 기존 이름인 `견적 계산`, `견적 수정본 확정`을 반영했다.

### `crm.html` 로딩 순서

최신 master의 `quote-calc.js` → `quote-compose.js` → `quote-composer.js`를 `quote-excel.js` 앞에 순서대로 연결했다. 최신 `deal-frame7.css`, `deal-frame7.js`, `quote-standards.js`, `cost-admin.js`를 참조하도록 asset 버전을 갱신했다. 두 쪽 변경이 있는 PC 전송·오류·상세 파일은 통합 버전 문자열을 사용했다.

새 디자인이나 새 배치를 만들지 않았다. 최신 master에 이미 있는 PC 견적 화면과 연결 코드를 보존하는 통합이다.

## 3. 보존한 후보 기능

다음 후보 RPC 9개가 최신 견적 RPC와 함께 남아 있음을 검사했다.

```text
crm_contact_command_v1
crm_inquiry_response_confirm_v1
crm_schedule_list_v1
crm_schedule_write_v1
crm_schedule_receipt_v1
crm_work_request_inquiry_contact_v2
crm_work_request_objectives_read_v1
crm_work_request_objectives_write_v1
crm_work_request_objective_followup_v1
```

- 연락처 동의의 미전송 필드 보존, 새 저장 계약 확인, 서버 ACK 검증 및 기존 서버로 우회하지 않는 동작을 유지했다.
- 재시도 시 같은 요청 ID·내용을 사용하고, 계정 또는 내부 사용자 ID가 바뀌면 기존 요청을 보내지 않는 보호를 유지했다.
- 문의 응대 기록 → 실제 응대 확인 → 다음 일정의 서버 확인 순서를 유지했다.
- 기존 일정 보존·변경 사유·확인되지 않은 저장 결과 복구 기능을 유지했다.
- HTML의 `schedule-contract.js`, `schedule-flow.js`, `inquiry-schedule-flow.js`, `inquiry-response-contract.js`, `pc-inquiry-save.js`, `inquiry-message-handoff.js` 6개 후보 모듈 및 기존 연락처 공통 저장 연결을 유지했다.

## 4. 수행한 검사

### 최신 PC 기능의 브라우저 검사

최신 master의 검사 스크립트를 메모리에서 실행하되, 로컬 정적 서버가 후보에 존재하는 파일을 우선 제공하고 나머지는 최신 master에서 제공하도록 연결했다. 검사 파일 자체는 변경하지 않았다.

Headless Edge를 사용했고, localhost 이외의 네트워크 요청은 차단했다. 영업건·기준 자료와 RPC 응답은 검사 스크립트의 합성 fixture를 사용했다. 따라서 아래 결과는 운영 서버 저장 또는 실제 고객 데이터 검증 결과가 아니다.

| 최신 master 검사 | 결과 | 확인한 범위 |
| --- | --- | --- |
| `scripts/verify-quote-composer-browser.cjs` | 통과 — `quote composer ok` | PC 견적 작성 진입, 공법·간단견적, 기준 및 금액 표시, 합성 서버 요청·거절, 수정본 연결, 함수 미배포 시 진입 제한 |
| `scripts/verify-cost-admin-browser.cjs` | 통과 — `cost admin ok` | 최신 원가 기준 관리의 기존 합성 브라우저 시나리오 |
| `scripts/verify-quote-submit-browser.cjs` | 통과 — `quote submit ok` | 최신 제출금액 기능의 기존 합성 브라우저 시나리오 |

세 검사 모두 종료 코드 0이며, 검사에서 수집하는 화면 오류 목록도 통과했다.

### 후보 저장 기능의 집중 검사

| 검사 | 결과 |
| --- | --- |
| `tests/contact-consent-transport.test.cjs` | 30/30 통과 |
| `tests/contact-consent-callers.test.cjs` | 14/14 통과 |
| `tests/pc-inquiry-save.test.cjs` | 12/12 통과 |
| `tests/inquiry-response-client.test.cjs` | 9/9 통과 |
| `tests/schedule-contract.test.cjs` | 일정 계약 45개 통과; 함께 실행한 문의 응대 SQL 검사 16개 통과 |
| `tests/schedule-flow.test.cjs` | 13/13 통과 |

수정한 JS 3개의 `node --check`와 `crm.html`의 인라인 스크립트 3개 구문 검사도 통과했다.

추가 정적 검사에서 최신 PC RPC 목록, 후보 RPC 9개, 최신 상세 변경 4개 줄, 견적 스크립트 순서, 후보 보조 모듈 6개 및 양쪽 오류 이름의 보존을 확인했다.

## 5. 게시본 구성과 검증 한계

최신 master의 다음 15개 파일도 그대로 포함해야 한다. 이번 4개 파일 통합 과정에서는 수정하지 않았다.

```text
cost-admin.js
deal-frame7.css
deal-frame7.js
package.json
quote-standards.js
scripts/verify-cost-admin-browser.cjs
sql/quote-v3-step5-20261011.sql
tests/helpers/make-xlsx.cjs
quote-compose.js
quote-composer.js
scripts/verify-quote-composer-browser.cjs
sql/quote-v3-step6-20261011.sql
tests/fixtures/method-sheets-20260825.json
tests/quote-compose-sql.test.cjs
tests/quote-compose.test.cjs
```

후보 폴더의 비교용 스냅샷·임시 실행 파일·`supabase/.temp/cli-latest` 같은 실행 부산물은 소스 변경과 구분한다. 최종 게시 파일은 별도 목록으로 확정한다.

이 문서 작성 단계에서는 앱 파일을 추가 수정하지 않았다. stage 7/8 등 산출물 manifest의 해시는 다른 검사 파일 변경까지 끝난 뒤 최종 게시본 전체를 기준으로 통합 담당자가 재계산한다.

이번 검사는 최신 PC 견적 기능과 후보 저장 계약의 통합에 집중했다. 전체 CRM·모바일 실계정·모든 권한·운영 DB 마이그레이션 및 실제 발송을 검증한 것은 아니다. GitHub 게시·필수 CI·배포 확인은 각 실행 결과로 따로 기록해야 한다.
