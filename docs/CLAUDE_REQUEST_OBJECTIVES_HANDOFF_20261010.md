# Claude 인수인계 — 복합 요청 저장 계약 및 master 통합
## #581 이후 추가 확인 — F2 진입 경로 재확인 필요

비교한 최신 master: `5814d2c6053825111a4bcf742cf907399aded671`(#581). #550 검증 head: `b585f2ee2cc9f5205ecb880a5ae22ac88003600d`. 이 추가 확인은 아래 4개 서버 계약을 바꾸지 않는다.

- #581은 `day-zones.js`의 목록 아래 입력을 `G.rowInlineKeep`이 켜진 경우에만 열고, 기본 경로는 상세 창으로 연결한다. `work-request.js topHtml()`도 오늘 업무에 행이 있는 일반 요청은 상단 카드에서 제외한다. 따라서 아래의 기존 “받은 요청 카드” 위치가 모든 대상에서 보인다고 가정하면 안 된다.
- 현재 일반 문의 상세 응대는 기본 요청 연결 경로를 사용하며, 복합 요청에 필요한 v2 응대 영수증까지 자동으로 만든다고 확인되지 않았다. 복합 요청은 그 영수증이 없으면 항목 판단·후속 업무 저장을 거절하는 기존 안전 조건을 유지한다.
- Claude가 현재 화면에서 실제로 접근 가능한 F2 입력 진입점을 확인해 연결해야 한다. Codex는 카드·줄 펼침·버튼을 복원하거나 새 표시 위치를 정하지 않는다. 기존 디자인 결정과 충돌하면 Claude가 위치 결정을 갱신해야 한다.
- 연결 검사에서는 목록 진입 → 실제 v2 응대 저장 → 후보 조회 → 항목별 판단 → 전체 완료까지 한 흐름으로 확인한다. 끄기 스위치를 켜서 예전 카드에서만 검사한 결과를 기본 화면 검증으로 대신하지 않는다. 게이트가 꺼진 동안 기존 화면을 유지한다.

### 이번 추가 검증의 범위와 한계

#581의 변경 파일 11개를 격리 폴더에 그대로 받아 #550과 함께 검사했다. 저장·클라이언트/Postgres 검사 95/95와 기존 요청 브라우저 검사는 통과했다. 운영 데이터·SQL·화면은 변경하지 않았다.

최신 `verify-day-zones-browser.cjs`는 Windows Edge 로컬 검사에서 “줄 클릭 = 상세 창” 지점이 실패했다. #550 클라이언트 변경을 모두 제외한 최신 master 대조에서도 같은 실패가 재현됐다. 해당 행의 프로그램 방식 click은 올바른 상세 호출로 이어졌으나, 실제 포인터 클릭에서는 이벤트가 기록되지 않았다. 원인은 미확정이며 성공으로 처리하지 않는다. #581 자체 GitHub Quality Gate는 성공 상태였다(run 38040640886). 기본 화면에서 실제 사용자 클릭과 복합 저장을 잇는 최종 검증은 별도로 남는다.

---

## 2026-10-10 최신 master 통합 및 Claude의 4개 질문에 대한 답

이 절이 아래 초기 설계·이전 검사 기록보다 우선한다. 통합 기준 master: `69e52672e8ca358167b3786d44a5d14d4fc26437`. PR #550의 5개 충돌 파일을 정리하면서 master의 일반 응대 연결, 요청 조회 순서 보호, 받은/보낸 요청 기능, #579의 현재 화면을 유지했다. Codex는 입력 화면·배치·스타일을 추가하지 않았다. Claude의 `CLAUDE_REQUEST_OBJECTIVES_DISPLAY_DECISION_20261010.md`에 정한 위치는 그대로 사용한다.

### 1. 연결 가능한 견적·방문 업무 후보

`await WorkRequest.objectives.read(requestId, historyPage, candidatePage)`를 사용한다. 두 쪽 번호는 기본 1이며 각각 최대 20건이다. RPC는 `crm_work_request_objectives_read_v1({id, page, candidate_page})`이다.

추가 응답:

- `followup_contract: 1`
- `followup_candidates`: 실제 저장된 `id`, `title`, `action_type`(견적/방문), `due_at`, `status`(open/completed), `completed_at`, `plan_origin`, `agreement_note`, `source_recorded_at`
- `candidate_total`, `candidate_page`, `candidate_has_more`
- `plan_context`: 전체 일정의 변경 감지 `token`, 문의 `next_action_date`, `open_task_count`, `open_schedule_count`, 열린 업무/일정 각 최초 20개인 `tasks`/`schedules`. 이 둘은 충돌 요약이며 전체 후보 목록이 아니다. 전체 견적·방문 후보는 위 candidate_page를 사용한다.
- `change_requests`, `change_request_total`, `change_request_page`, `change_request_has_more`: 변경 제안 ACK 이력. historyPage로 최대 20건씩 조회한다.
- `can_write`: 현재 요청 수신자·문의 담당자 일치 및 열린 요청 여부. 실제 연결 근거와 종결/이관 여부는 저장 때 다시 검증한다.

다른 문의·다른 담당·취소 업무, 빈 제목, 유효 기한 없는 열린 업무, 완료시각 없는 완료 업무는 후보에서 제외한다. UUID를 생성하거나 화면 순번을 업무 ID로 보내지 않는다. 재배정되면 이전 요청의 후보·현재 일정 요약을 돌려주지 않는다(plan_context.available=false). 앞뒤 공백은 저장 결과와 같은 기준으로 정리하고 출처는 서버가 저장한 ACK와 대조한다.

### 2. 새 업무 저장 경로와 반환 ID

`await WorkRequest.objectives.followup.write(payload)` → `crm_work_request_objective_followup_v1(p)`.

```js
const ctx = await WorkRequest.objectives.read(requestId, 1, 1);
const ack = await WorkRequest.objectives.followup.write({
  id: requestId,
  operation_id: crypto.randomUUID(),
  expected_revision: ctx.revision,
  expected_updated_at: ctx.expected_updated_at,
  plan_token: ctx.plan_context.token,
  ask: '연락 후 견적 필요 여부 확인', // 또는 '현장방문 필요 여부 확인'
  title: '확인된 후속 업무 내용',
  due_date: 'YYYY-MM-DD',
  plan_origin: 'internal_plan',
  mode: 'additional',
  reason: '기존 업무와 별도로 필요한 이유'
});
// ack.status === 'created'이고 next_action_id가 있는 경우에만 연결 후보로 사용한다.
const fresh = await WorkRequest.objectives.read(requestId, 1, 1);
// 기존 objectives.write의 needed 결정에 ack.next_action_id를 전달한다.
// revision/expected_updated_at은 fresh를 사용한다.
```

현재 문의 담당자이자 요청 수신자인 계정만 저장한다. 실제 v2 연결 기록이 선행되어야 하며, 관리자 대리 저장은 추가하지 않았다. 새 견적·방문 업무와 출처 이력을 같은 트랜잭션으로 저장하고 `next_action_id`를 반환한다. 문의의 기존 다음 행동일·다른 업무·일정·관리자 요청 기한을 덮어쓰거나 취소하지 않는다. 항목 확인으로 관리자 요청이 완료되어도 새 후속 업무는 열린 상태를 유지한다.

ACK: `ok`, `contract_version:1`, `policy_version:'objective-followup-v1'`, `operation_id`, `request_id`, `inquiry_id`, `event_id`, `next_action_id`, `status`, `mode`, `ask`, `plan_origin`, `title`, `due_date`, `agreement_note`, `reason`, `revision`, `expected_updated_at`, `server_at`, `plan_token_before`.

응답 유실 시 입력을 지우거나 다른 저장 ID를 만들지 않는다. `WorkRequest.objectives.followup.pending(requestId)`와 `.retry(requestId)`를 사용한다. 같은 payload·operation_id는 같은 영수증을 반환하며 업무를 중복 생성하지 않는다. 서버의 명시적 롤백 오류는 재조회 후 수정 가능하고, 성공 여부를 모르는 네트워크 오류는 같은 저장을 재시도한다.

### 3. 고객 합의와 내부 계획 저장

- `plan_origin:'customer_agreed'`: 공백이 아닌 `agreement_note` 필수. 사용자가 확인한 합의 근거만 전달한다.
- `plan_origin:'internal_plan'`: agreement_note는 보내지 않거나 빈 값. 날짜가 있다는 이유로 고객 약속이라고 추정하지 않는다.
- 기존 업무의 출처는 `unknown`. 새 저장 이벤트가 있는 업무도 제목·날짜·담당이 바뀌면 기존 합의 표시를 그대로 재사용하지 않는다.

출처는 신규 비공개 `crm_security.work_request_followup_events`에 요청·문의·업무·입력자·저장 ID·payload·ACK·기록시각과 함께 보존한다. `public.next_actions` 기존 열을 추가/대체하지 않았다. 테이블 직접 조회/변경 권한은 공개하지 않는다.

### 4. 기존 일정 충돌 시 선택 계약

| mode | 저장 결과 | 기존 일정 | needed 완료 근거 |
|---|---|---|---|
| `create` | 기존 계획이 전혀 없을 때만 새 업무 생성 | 보존 | 반환 업무 ID 사용 가능 |
| `additional` | 명시적 사유로 별도 업무 생성 | 모두 보존 | 반환 업무 ID 사용 가능 |
| `request_change` | 변경 제안 이력만 저장 | 날짜·내용·상태 모두 보존 | 사용 불가 |

`request_change`는 `status:'change_requested', next_action_id:null`을 반환한다. 승인·반려·실제 일정 변경 엔진은 이번 PR에 없다. 제안 event_id를 업무 ID로 넘기거나 변경 완료라고 표시하면 안 된다. 아직 needed 조건을 충족하지 못하므로 항목은 미확인/진행 중으로 유지한다.

`REQUEST_PLAN_CONFLICT`: create인데 기존 계획 있음. 사용자의 명시적 선택과 사유가 필요하다.
`REQUEST_PLAN_CHANGED` / `REQUEST_REVIEW_CONFLICT`: 조회 뒤 문의·업무·일정 또는 요청이 변경됨. 자동 덮어쓰기하지 않고 재조회한다.
`REQUEST_FOLLOWUP_EXISTS`: 같은 담당·유형·제목·날짜의 열린 업무가 존재함. 후보 재조회 후 실제 업무를 확인해 연결한다.
`REQUEST_CONTACT_PROOF_REQUIRED`: v2의 실제 연결 근거 없음. 날짜를 복사하거나 연락 이력을 추정해서 우회하지 않는다.

### 배포 순서와 남은 범위

1. 기존 master 마이그레이션을 보존한 상태에서 `20261009215629_request_compound_contact.sql` 적용.
2. 이어서 `20261010090000_request_objective_followup.sql` 적용. sql/과 supabase/migrations/는 각각 동일 파일이며 같은 DB에 두 사본을 별도로 적용할 필요는 없다.
3. `pc-manager-transport.js` 허용 목록, `pc-error-state.js` 오류 이름, `ops-store.js`, `work-request.js`를 함께 배포하고 CRMRelease 설치 확인.
4. Claude는 정해 둔 F2 입력 위치에 연결. `WorkRequest.objectives.enabled()`는 read/write/followup 세 RPC가 모두 확인돼야 true. 비활성일 때 기존 화면 유지.

**현재는 Draft이며 운영 SQL 실행·master 병합·운영 배포는 하지 않았다.** 기존 일반 상세의 `crm_work_request_contact_link_v1`은 기본 요청 연결을 유지한다. 복합 목적의 연결 근거는 v2 응대 영수증 경로이며 일반 상세 저장만으로 복합 목적까지 처리된다고 주장하지 않는다. F2는 요청 카드의 기존 v2 응대 저장 후 남은 항목을 연결한다.

검증: 클라이언트+실제 로컬 Postgres 95/95, 관련 흐름·인계·지사 경과일·SQL 등록·출시 계약 19/19, 합성 브라우저 요청 흐름 PASS. 응답 유실 후 재시도·중복 방지·재배정·충돌·권한·롤백·후속 일정 보존을 확인했다. 운영 고객 데이터와 외부 발송은 사용하지 않았다. GitHub 최종 커밋 CI는 별도로 확인한다.

---

## 이하: 최초 설계와 이전 검증 이력

대상: 영업운영 CRM `poursolution/netform-crm`. 최초 준비 기준 커밋 `95d668a5ffa9860a98d0ec7a07209ddc1fcdb518`. 후속 통합 시 master의 #551 로딩 안내 수정을 그대로 보존한다.
사용자 지침: Codex는 저장·판정·검증, Claude는 디자인 담당. 기존 화면 위치·크기·색·배치를 Codex가 변경하지 않는다.

## 실제 확인한 문제

기본 `고객 첫 연락` 요청은 #549에서 응대·후속 일정·요청을 원자적으로 저장하도록 반영했다. 그러나 `고객 첫 연락 / 연락 후 견적 필요 여부 확인 / 현장방문 필요 여부 확인`을 함께 선택한 요청은 이전 접수 함수와 결과 문자열만으로 전체 완료되었다. 브라우저의 로컬 연락 이력만으로 자동 종료하는 경로도 있었다.

운영 읽기 전용 점검에서 이 세 항목을 포함한 `seen` 상태의 문의 요청 1건을 확인했다. 고객명·전화번호·요청 원문을 이 문서에 복제하지 않는다. 운영 기록은 변경하지 않았다.

## Codex가 준비한 기능 (미배포)

- `crm_work_request_inquiry_contact_v2(p jsonb)`: 기존 요청 카드의 결과·다음 행동·날짜를 실제 응대와 함께 저장한다. 단일 목적은 기존 v1을 유지한다.
- 지원 대상: 문의 대상, `kind:first`, `label:첫 연락 요청`, 기본 제공 항목 중 2~3개, `고객 첫 연락` 필수. 중복·알 수 없는 항목은 추정하지 않고 거절한다.
- 통화 연결 시 `고객 첫 연락`만 확인됨. 견적요청 결과를 골라도 `견적 필요 여부 확인` 전체가 처리됐다고 추정하지 않는다. 방문 필요 여부도 미확인으로 보존한다.
- 복합 요청 상태는 `working`, `closed_at:null`, `auto_done:false`. 부재도 진행 중이고 실제 연결 시각을 만들지 않는다.
- 응대·다음 일정·요청·저장 영수증을 한 트랜잭션으로 저장한다. 기존 방문·견적·고객 일정과 충돌하면 저장 전에 중단한다. 같은 요청이 만든 변경되지 않은 부재 재연락 일정만 처리 후 다음 일정으로 이어간다.
- 새로고침·응답 유실 후 같은 저장 ID로 재시도한다. 현재 담당자·요청 수신자·입력 계정이 일치해야 한다. 재배정 뒤 재시도 영수증을 새 상태에 덮어쓰지 않는다.
- 예전 `reply_v1` 결과 문자열과 클라이언트 이력만으로 문의 첫 연락 요청을 종료하지 못하게 한다. 취소·열람 확인과 다른 요청 종류는 기존 경로를 유지한다.
- 마크업·스타일·위치는 그대로이며 기존 저장 안내 문구만 실제 동작에 맞게 `응대 저장 · 추가 확인 항목은 진행 중`으로 조건부 표시한다.

### 저장 계약

입력은 기존 v1과 동일하다.

```json
{"id":"요청 UUID","operation_id":"저장 UUID","result":"연결됨","next_text":"고객 회신 확인","next_due":"YYYY-MM-DD"}
```

v2 응답은 `ok`, `contract_version:2`, `operation_id`, `inquiry_id`, `log_id`, `next_action_id`, `state`, `request`, `inquiry_update`, `server_at`과 아래 근거를 포함한다. 같은 저장 재시도는 `replayed:true`이다.

```json
{
  "completion": {
    "policy_version": "first-compound-v1",
    "requested_asks": ["고객 첫 연락", "연락 후 견적 필요 여부 확인", "현장방문 필요 여부 확인"],
    "satisfied_asks": ["고객 첫 연락"],
    "remaining_asks": ["연락 후 견적 필요 여부 확인", "현장방문 필요 여부 확인"],
    "contact_log_id": "서버에 저장된 응대 UUID",
    "request_complete": false
  }
}
```

이 근거는 비공개 `crm_security.work_request_contact_receipts.ack`에 보관한다. 공개 문의 필드를 새로 만들지 않는다. 응답의 근거를 고객 약속 또는 고객 회신 대기 상태로 해석하지 않는다. 일반 목록 RPC 대신 아래 전용 조회로 서버 근거를 다시 읽는다. 로컬 상태만으로 재구성하지 않는다.

### 항목별 판단 저장·조회 추가 (2026-10-10, #550 초안·미배포)

같은 미적용 SQL에 `crm_work_request_objectives_read_v1` / `crm_work_request_objectives_write_v1`와 비공개 `crm_security.work_request_objective_events`를 추가했다. 문의 필드와 기존 고객 일정은 수정하지 않는다.

- 조회: 요청자·수신자·관리자만 허용. 현재 판단·통화 근거·요청 상태·변경 이력을 함께 반환한다. 이력은 한 쪽 최대 20건이며 `page`로 넘긴다.
- 저장: 현재 문의 담당자이면서 요청 수신자인 계정만 허용. 관리자 대리 완료는 허용하지 않는다. 실제 연결된 응대 기록이 있어야 한다. 부재·결과 문자열만으로 판단을 완료하지 않는다.
- 추가 목표마다 `unknown`(아직 모름), `needed`(필요), `not_needed`(불필요)와 담당자의 근거 메모를 저장한다. 매번 전체 판단 스냅샷을 전달하며 과거 판단은 불변 이력으로 남는다.
- `needed`는 같은 문의·같은 현재 담당의 기존 견적/방문 업무 ID가 필요하다. 열린 업무 또는 완료시각이 있는 완료 업무만 연결한다. 고객 후속 업무는 요청 완료와 별개이며 자동 완료하지 않는다.
- `complete:true`는 추가 목표 전부가 확인되고 필요한 후속 업무가 연결됐을 때만 허용한다. 종결·전환·휴지통·재배정·취소 또는 동시 수정 충돌은 저장하지 않는다.
- 기준 버전 `first-compound-v1`, 당시 통화 ID·후속 업무 스냅샷·입력자·시각·판단 근거를 보존한다. 이는 다른 종류 요청 전체의 정책 버전화 완료를 뜻하지 않는다.

화면 없는 호출 API: `WorkRequest.objectives.enabled()` / `.read(id, page=1)` / `.write(payload)` / `.pending(id)` / `.retry(id)`. 읽기·쓰기 두 함수 모두 CRMRelease 확인 전에는 호출하지 않는다. API를 추가했으나 새 입력 창이나 버튼은 만들지 않았다.

```js
const context = await WorkRequest.objectives.read(requestId);
// 로그인 계정이 context.client_actor_id와 같은지 확인. 화면 선택값을 추정하지 않는다.
await WorkRequest.objectives.write({
  id: requestId, operation_id: crypto.randomUUID(),
  expected_revision: context.revision,
  expected_updated_at: context.expected_updated_at,
  decisions: [
    {ask:'연락 후 견적 필요 여부 확인', value:'needed', note:'고객 요청 확인', next_action_id:existingQuoteTaskId},
    {ask:'현장방문 필요 여부 확인', value:'not_needed', note:'고객과 방문 불필요 확인'}
  ],
  complete: true
});
// 과거 재시도 영수증을 최신 상태에 덮어쓰지 않는다. 저장 후 항상 현재 상태를 다시 읽는다.
const current = await WorkRequest.objectives.read(requestId);
```

요청에 포함된 추가 항목만 보낸다. 메모는 1~2,000자이며, `unknown`이 남으면 `complete:false`이다. 새 업무 생성은 기존 검증된 저장 경로를 사용하고 성공한 업무 ID만 연결한다. 이 API는 고객 연락이나 n8n 발송을 수행하지 않는다.

네트워크 오류·불완전 ACK는 원래 저장 내용을 계정별로 보존한다. `.pending(id)`가 있으면 편집한 새 작업을 보내지 말고 `.retry(id)`로 같은 작업을 확인한다. 서버가 명시적으로 거절한 `22023`·`40001`·`42501`만 대기 데이터를 해제한다. 충돌 후에는 다시 조회하고 판단한다. 반환 ACK만으로 문의·고객 일정·최신 요청 상태를 덮어쓰지 않는다.

## Claude가 결정할 표시·입력 연결

새 시안이나 배치를 Codex가 제안하지 않는다. 아래 의미가 현재 디자인 안에서 명확해지도록 위치와 흐름을 결정한 뒤 Codex에 전달한다.

1. **확인 항목별 결과 입력과 미확인 항목**: 견적·방문이 필요한지 `필요 / 불필요 / 아직 확인 못 함`을 구분하고, 판단 근거와 실제 응대 기록을 연결할 위치. 불필요도 사람이 확인한 결과이며 미확인을 불필요로 처리하지 않는다.
2. **기록 입력과 전체 완료 분리**: 통화 연결 기록이 있다고 나머지 항목을 자동 체크하지 않는다. 확인 완료 저장이 성공하기 전에는 전체 완료로 표시하지 않는다.
3. **고객 회신 대기**: 고객이 무엇을 언제 회신하기로 했는지, 확인된 고객 약속인지 내부 재확인 일정인지 구분할 위치. `검토중` 또는 다음 행동 날짜만으로 고객 대기라고 추정하지 않는다.
4. **요청자 결과 확인**: 응대 완료·남은 확인 항목·다음 일정과 실제 고객 대기 여부를 요청자가 확인하는 위치. 확인되지 않은 대기를 지연 평가에서 임의 제외하지 않는다.
5. **기존 일정 충돌**: 기존 계획을 보존하고 별도 추가 업무인지 일정 변경인지 확인하는 입력 흐름. 내부 요청 기한, 고객 약속, 입찰 마감은 서로 대신 쓰지 않는다.

팝업을 닫는 동작, 입력 중 알림 위치, 기존 업무 카드에 요청을 연결하는 배치도 Claude 결정 범위다. 기존 화면의 기능을 없애거나 예전 디자인을 복원하지 않는다.

## 배포와 남은 기능

**현재 PR은 초안으로 유지한다.** 조회·서버 저장·완료 판정과 호출 API는 준비했지만, 남은 견적·방문 항목을 사람이 확인할 정식 입력 화면은 아직 연결하지 않았다. 이를 완료된 운영 기능으로 소개하거나 승인 없이 배포하지 않는다.

Claude가 현재 디자인 안에서 입력 위치를 확정하면 위 `WorkRequest.objectives` API에 연결한다. 연결 후 실제 화면에서 서버 실패·다시 열기·부분 저장·완료를 검증한다. 모든 필수 항목이 실제로 확인된 경우에만 전체 요청을 완료하며, 후속 고객 업무는 별개로 열린 상태를 유지한다.

고객 회신 대기 상태, 야간 기한, 대리 입력 실적, 담당 변경 전 지연 귀속, 정책 변경 소급 방지, 후속 연락·영업건 요청은 이번 구현 완료 범위가 아니다. 새로운 n8n 반복 실행·발송은 추가하지 않는다.

설치 SQL: `sql/20261009215629_request_compound_contact.sql` 및 같은 `supabase/migrations/` 파일. 새 RPC를 `pc-manager-transport.js` 허용 목록과 `pc-error-state.js`에 함께 등록하고 CRMRelease가 v2 설치를 확인해야 호출한다. 기본 v1은 그대로 유지한다.

서버 함수의 권한·트랜잭션 구현은 [Supabase 공식 함수 문서](https://supabase.com/docs/guides/database/functions)를 대조했다.

## 검증 결과

- 응대·항목 판단 클라이언트 및 Postgres 회귀 검사 51개 통과. 복합 요청 부분 처리, 부재 후 연결, 기존 일정 보호, 재시도, 권한 변경, 전체 롤백, 항목별 완료 조건, 동시 수정 방지, 20건 이력 조회를 포함한다.
- 이 중 통합 검사 3개는 실제 `WorkRequest.objectives → OpsStore → SQL`을 로컬 PGlite에 연결한다. 실제 서버 ACK 수용, 저장 직후 응답 유실·새로고침·동일 작업 재시도, SQL 경합 거절 후 재조회·재저장을 검증했다. 완료 후에도 연결된 견적 업무는 열린 상태로 남고, 판단 이력은 재시도 때문에 늘어나지 않는다. 운영 서버·고객 자료에 시험 데이터를 쓰지 않았다.
- 계약 검사 첫 묶음 97개 통과, 다음 묶음 525개 중 524개 통과. 남은 빌드 버전 검사는 로컬 Git 실행 제한으로 실패했으며 같은 검사를 실행 권한을 갖춘 환경에서 다시 실행해 통과했다.
- 합성 데이터 브라우저 검사 통과. 견적요청 결과를 저장해도 추가 확인이 남으면 기존 요청 카드가 유지되고 전체 완료로 표시되지 않는 것을 확인했다. 운영 고객 자료를 변경한 검사가 아니다.
- 화면 틀·스타일·배치는 변경하지 않았다. 기존 저장 안내 한 곳만 실제 부분 처리 결과와 맞췄다.

## 후속 검증: 연결할 후속 업무의 필수 근거 (2026-10-10)

#550 미적용 SQL에서 빈 제목의 견적 업무를 연결해도 요청 전체가 완료되는 경로를 실제 SQL로 재현했다. 업무 ID·유형이 존재하는 것만으로 처리 가능한 후속 업무가 있다고 인정하지 않는다.

`needed` 판단에 연결하는 업무는 비어 있지 않은 제목이 있어야 한다. 열린 업무는 유효한 실제 기한이 필요하며, 완료 업무는 유효한 완료시각이 필요하다. null·무한 날짜와 취소/알 수 없는 상태는 완료 근거로 인정하지 않는다. 날짜를 추정하거나 채우지 않고 기존 REQUEST_FOLLOWUP_REQUIRED 오류로 거절한다. 사용자 입력 위치·표시 형식은 변경하지 않았다.

기한이 이미 지난 정상 업무는 그 날짜 그대로 연결할 수 있다. 관리자 요청을 완료해도 후속 업무를 자동 완료하거나 기한을 다시 잡지 않는다. 기한 경과가 사라지는 수정이 아니다. 완료된 업무도 원래 완료시각과 상태를 보존한다.

회귀 검사 9개를 추가하여 클라이언트+실제 Postgres 검사 총 60개 통과. 빈 제목(공백·줄바꿈), 무한 기한, 완료시각 미확인, 취소 상태 거절과 정상 업무 보존을 확인했다. 거절 시 요청 상태·판단 이력·고객 업무가 바뀌지 않는다. 이 검증은 로컬 합성 데이터이며 운영 원자료와 DB를 변경하지 않았다.

수정 파일: sql/20261009215629_request_compound_contact.sql 및 동일한 supabase/migrations 파일, tests/work-request-contact-postgres.test.mjs. SQL·RPC 이름·권한·화면 디자인·n8n 실행은 추가하지 않았다. Claude의 항목별 입력 연결은 계속 대기 중이며 PR은 Draft로 유지한다.

## 추가 로컬 검증: 빈 확인 사유 차단 (2026-10-10)

- 실제 PostgreSQL 함수 테스트에서 탭·줄바꿈만 있는 `note`가 필요한 업무/불필요/미확인 판단의 근거로 저장되는 오류를 재현했다. 완료 요청에서도 빈 근거가 통과했다.
- 기존 필수 사유 검증에 공백 외 문자가 있는지 확인하는 조건을 추가했다. 실제 내용이 있는 여러 줄 사유는 원문을 보존한다.
- 거절 시 요청 상태·revision·updated_at·판단 이력·고객 후속 업무가 변경되지 않는지 확인했다.
- 회귀 검사 4개를 추가하여 클라이언트·PostgreSQL 합계 64/64 통과. SQL과 migration은 로컬에서 동일하다.
- 사용자 명시 승인: “예, #550 마이그레이션·테스트·문서 업로드 승인”. 승인에 따라 #550 초안에 로컬 보완분을 반영한다. 운영 DB 적용·병합·배포·디자인 변경은 승인 범위에 포함하지 않으며 실행하지 않았다. 로컬 64개 통과와 최종 커밋 CI 결과는 구분하여 PR에 기록한다.
