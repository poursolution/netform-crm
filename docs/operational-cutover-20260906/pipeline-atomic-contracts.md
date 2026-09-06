# Pipeline + Next/Activity 원자 계약 분석

작성일: 2026-09-06  
범위: Golden PC/mobile UI에서 실제 도달 가능한 Pipeline, Next Action, Activity 쓰기  
판정 범위: 정적 코드와 보관된 actual Staging metadata snapshot 대조만 수행. DDL/DML 및 원격 접근 없음.

## 1. 결론

현재 Pipeline 계열 command는 실제 Staging Dispatcher에 연결되어 있지 않다. UI가 한 번의 사용자 행동에서 여러 `pushWrite()`를 순서대로 발생시키는 경우가 많지만, 운영 전환 계약에서는 **한 번의 사용자 행동이 약속하는 업무 결과 전체를 서버의 한 transaction으로 처리**해야 한다.

원자 경계 자체가 확정된 항목은 다음과 같다.

| 업무 | 원자 경계 판정 | 전체 계약 판정 | 핵심 이유 |
|---|---|---|---|
| 신규 Pipeline 생성 | DERIVED_SAFE | NEEDS_VERIFICATION | Deal·현장·연락처·초기 Activity를 함께 저장해야 하나 PC/mobile의 초기 Next Action 규칙과 중복 식별 규칙이 다름 |
| 담당자 변경 + 인계 | DERIVED_SAFE | NEEDS_VERIFICATION | 소유자 변경·배정이력·인계요약은 한 업무이나 actual Staging에 UUID 기반 인계 저장 정본이 없음 |
| 비종결 Stage 전환 | DERIVED_SAFE | DERIVED_SAFE_LOCAL_CANDIDATE | Golden의 `deals.stage_contexts` 의도와 P09 open Next 교체 규칙을 사용한 단일 transaction candidate가 로컬 DB/UI 시험을 통과함; Staging 미적용 |
| 실주/배드핏/연락두절 종결 | DERIVED_SAFE | DERIVED_SAFE_LOCAL_CANDIDATE | 종료 전 stage 보존, reason/detail 분리, open Next 완료, history/Activity/private event/audit/receipt 단일 transaction이 로컬 검증됨; Staging 미적용 |
| Closed Won 종결 | DERIVED_SAFE | NEEDS_VERIFICATION | 금액/완료일/확장 Pool 정본과 전체 원자성이 아직 없음 |
| 금액 변경 | DERIVED_SAFE | NEEDS_VERIFICATION | 한 Deal row 변경이지만 UI의 `amount/quote_amount/won_amount` 3종을 actual `deals.amount` 하나로 보존할 수 없음 |
| 사업유형 변경 | DERIVED_SAFE | DERIVED_SAFE | actual 함수와 history 구조로 기존 규칙이 확인됨. 단 기존 함수를 직접 공개 호출하지 않고 Dispatcher transaction에 흡수해야 함 |
| 독립 Activity 추가 | DERIVED_SAFE | NEEDS_VERIFICATION | `activities.detail`로 payload 보존 가능하나 type vocabulary와 meaningful-contact 시계 규칙을 확정해야 함 |
| Next Action 설정/연기 | DERIVED_SAFE | NEEDS_VERIFICATION | 저장 row는 있으나 replace/append, 한 건 open 규칙, assignee UUID 정본이 불명확 |
| Next Action 완료 | DERIVED_SAFE | NEEDS_VERIFICATION | 완료 transaction은 명확하나 PC/mobile 식별자가 `action_id`와 `text/due_at`으로 갈리고 PC 상세화면은 write가 없음 |

따라서 이 문서는 SQL 구현 승인이 아니다. `service_change`만 의미 계약을 `DERIVED_SAFE`로 닫을 수 있고, 나머지는 표에 적은 **부족한 규칙 한 줄**을 확정한 뒤 구현해야 한다.

## 2. 확인 근거

### Reachable UI

- PC 신규 생성: `crm.html:7171-7214`
- Mobile 신규 생성: `mobile.html:2106-2125`
- PC 담당자 변경/인계: `crm.html:5263-5264`, `crm.html:7561-7562`
- Mobile 담당자 변경/인계: `mobile.html:2401`
- PC/Mobile 최종 Stage UI: `stage-transition-ui.js:39-79`
- PC 금액 저장: `crm.html:4661-4672`
- PC/Mobile 사업유형 변경: `crm.html:7106-7124`, `mobile.html:1765-1777`
- PC Activity/Next Action: `crm.html:4675-4683`, `crm.html:3539-3560`
- Mobile Activity/Next Action: `mobile.html:764-781`, `mobile.html:2379-2381`

### Actual Staging 정적 증거

정본은 `sql/inquiry-direct-assign/20260906/after.json`에 보관된 적용 후 metadata snapshot이다.

- 실제 `crm_write_command_v2`는 현재 `opportunity_work_set`, `inquiry_assign`만 처리한다.
- `command_receipts` operation 허용값도 위 두 op뿐이다.
- `deals`에는 `amount`만 있고 `quote_amount`, `won_amount`, `completion_date`, `stage_contexts`, `stage_history`가 없다.
- `activities`에는 `deal_id`, actor 표시값, `type`, `detail`, `occurred_at`가 있다.
- `next_actions`에는 Deal/문의 배타 참조, type/title/due/assignee_name/status/completed_at/source_activity_id가 있다.
- `assignment_history`는 from/to/actor가 text이고 UUID FK가 없다.
- `business_history`와 `deals.business_history`가 모두 존재한다.
- `crm_expansion_pool`, `crm_quote_versions`, `crm_handover_summaries`, `crm_stage_transition_records`는 actual snapshot에 없다.
- `crm_security.can_deal()`은 rep에게 자신의 `owner_id`만 허용하고 branch/admin은 object scope를 검사한다.

### Golden SQL의 위치

- `sql/20260905_structured_stage_transition.sql`: transition record 후보. 프론트 미적용 주석이 있고 actual Staging에는 테이블이 없다.
- `sql/20260905_expansion_management.sql`: 수주 후 expansion pool 후보. actual Staging에는 없다.
- `sql/20260905_sales_execution_engine.sql`: quote version/handover summary 후보. actual Staging에는 없다.
- `sql/20260905_expansion_quote_handoff.sql`: expansion event 후보. actual Staging에는 없다.
- actual `apply_business_change(...)`: 현재 사업유형·history·선택적 Next Action을 한 transaction에 처리하지만, 직접 실행 권한이 넓고 auth/can_deal/version/receipt/private audit가 없다.

Golden SQL은 업무 의도 근거로만 사용한다. actual schema와 일치하지 않는 후보 테이블이나 text identity를 그대로 재사용하지 않는다.

## 3. 공통 원자성 규칙

하나의 사용자 클릭/submit이 약속하는 결과는 다음 순서의 **단일 Dispatcher transaction**이다.

1. JWT에서 Auth UUID를 확정하고 active/approved/미만료 CRM user UUID를 해석한다.
2. payload의 표시용 이름·actor·시간은 권한 정본으로 사용하지 않는다.
3. 대상 Deal을 `FOR UPDATE`로 잠그고 `can_deal()` 및 역할별 command 권한을 검사한다.
4. `expected_version`을 검사한다. stale이면 어느 부수효과도 남기지 않고 409다.
5. `request_id + operation + canonical payload hash` receipt를 검사한다.
6. 핵심 row, history, Activity, Next Action, private audit를 같은 transaction에서 쓴다.
7. `deals.version`은 사용자 행동당 정확히 한 번 증가한다. 내부 부수효과마다 증가시키지 않는다.
8. receipt도 같은 transaction에서 확정한다.
9. 기존 ACK `{ok:true, write_id, operation, ...}`는 transaction commit 후에만 반환한다.
10. 같은 request와 같은 payload의 replay는 원 ACK를 반환하고 row/history/audit를 추가하지 않는다. 같은 request와 다른 payload는 409다.

현재 UI가 `transition → activity → next_action`처럼 여러 queue item을 만든다는 사실은 서버 transaction을 분리할 근거가 아니다. Compatibility Adapter가 한 사용자 intent로 정규화한 뒤 내부 부수효과를 한 command로 실행해야 한다. 별도 queue item을 유지해야 한다면 parent command의 receipt에 종속시켜 중복 저장을 막아야 한다.

## 4. 업무별 계약

### 4.1 신규 Pipeline 생성 — `opportunity_create`

#### Reachable payload

PC는 `name/work_name/work_type`, 공종 호환 필드, `brand`, 이름 기반 `owner`, 주소·금액·연락처, 생성 사유, `source_opportunity_id/origin_source/client_ref`를 보낸다. 화면은 “영업기회와 연락처 등록”을 하나의 성공으로 표시한다.

Mobile은 같은 기본 필드에 `site_id`, `origin`, `gj`, 담당자 연락처 및 `contact_started_at`을 보낸다. 그리고 로컬 temp Deal ID로 `activity`와 `next_action`을 별도 enqueue한다.

#### 서버 transaction 경계

- 현장/조직/연락처의 기존 identity resolve 또는 필요한 row 생성
- 서버 UUID Deal 생성 및 `origin_inquiry_id`/source lineage 보존
- owner 이름을 승인된 사용자 UUID로 정규화
- 공종 호환 필드, 금액, business/brand, 연락처 호환 필드 저장
- 초기 생성 Activity 1건
- 확정될 경우 초기 Next Action 1건
- private audit와 receipt
- commit 후 server Deal UUID와 기존 ACK 반환; temp ID remap은 ACK에 포함

중간에 contact/history/next 저장이 실패하면 Deal도 없어야 한다.

#### 판정

원자 경계는 `DERIVED_SAFE`, 전체 계약은 `NEEDS_VERIFICATION`.

부족한 규칙 한 줄: **초기 Next Action을 모든 신규 Deal에 필수로 만들지, mobile만의 로컬 기본값으로 둘지와 같은 현장/연락처 재입력 시 merge identity를 확정해야 한다.**

### 4.2 담당자 변경 + 인계 — `assign` + `handover`

#### Reachable payload

- PC `assign`: `{opportunity_id, from, to, reason, reason_source, at}`
- PC `handover`: `{opportunity_id, from, to, reason, summary, created_at}`
- Mobile `assign`: `{opportunity_id, from, to, handover}`
- Mobile `handover`: `{opportunity_id, from, to, summary}`

Mobile은 같은 클릭에서 로컬 Activity도 생성한다. PC도 화면상 소유자 변경과 인계 이력을 한 성공으로 취급한다.

#### 서버 transaction 경계

- current `owner_id`를 서버에서 읽어 `from` 확정
- target을 active/approved/미만료 허용 역할의 CRM UUID로 정규화
- `deals.owner_id`, 호환 `assignee_name/email`, version 갱신
- UUID 보존 가능한 assignment history
- 인계 summary/reason의 durable history
- 담당자 변경 Activity 1건
- private audit와 receipt

`assign`만 성공하고 `handover`가 빠지는 상태는 허용하지 않는다. 외부 op 두 개를 유지하더라도 첫 command가 parent receipt를 소유하고 두 번째 command는 replay-safe acknowledgement여야 한다.

#### 판정

원자 경계는 `DERIVED_SAFE`, 전체 계약은 `NEEDS_VERIFICATION`.

부족한 규칙 한 줄: **Mobile의 사유 필수 여부와 UUID from/to/actor 및 인계 summary의 actual 저장 정본을 확정해야 한다.**

현재 `assignment_history`의 text from/to/actor를 권한 또는 identity 정본으로 사용해서는 안 된다.

### 4.3 비종결 Stage 전환 — `transition`

#### Reachable payload

최종 PC/mobile Stage UI는 다음을 보낸다.

`{opportunity_id, from, to, stage_code, at, transition_date, note, reason, stage_context, stage_contexts, contract_amount, completion_date}`

그 뒤 같은 저장 동작에서 `activity`와 선택적 `next_action`을 enqueue한다.

#### 서버 transaction 경계

- current stage/version을 서버에서 읽어 from 검증
- 허용 transition과 단계별 필수 context 검증
- `deals.stage_code/stage_raw/stage_group/stage_entered_at` 갱신
- 구조화 transition history/context 보존
- Stage Activity 1건
- 새 Next Action이 있으면 기존 open action 정책에 따라 교체/생성
- private audit와 receipt

Stage 변경만 저장되고 Activity/Next가 빠지는 상태는 허용하지 않는다.

#### 판정

원자 경계와 최종 구조화 비종결 intent는 `DERIVED_SAFE_LOCAL_CANDIDATE`다. `sql/pipeline-transition/20260906`가 Deal context, private event, history, Activity, optional replacement Next, audit, receipt를 한 transaction으로 처리하고 derived child write를 흡수한다. Staging 미적용이며 문의 promote·terminal close는 이 판정에 포함되지 않는다.

### 4.4 종결 — `close`

#### Reachable payload

구조화 Stage UI는 terminal outcome과 `closed_at`, 수주 시 `won_amount`, 공통 `contract_amount/completion_date`, note/reason/context를 보낸다. 수주 흐름은 추가로 `expansion_pool_upsert`를 enqueue한다.

#### 서버 transaction 경계

- terminal transition 검증
- `lifecycle_status='closed'`, outcome, stage, closed_at 갱신
- lost/badfit 사유 및 종결 context/history 보존
- terminal Activity 1건
- 열린 Next Action의 completed/cancelled 처리
- 수주 금액·완료일 정본 저장
- 수주일 때 expansion 대상 upsert/event를 같은 transaction에서 처리
- private audit와 receipt

비수주 종료는 `sql/pipeline-close-nonwon/20260906` candidate에서 별도로 닫혔다. Deal 종결은 성공했지만 expansion 생성이 빠지거나, expansion만 생성된 상태를 허용하지 않는 조건은 Closed Won에 계속 적용된다.

#### 판정

실주·배드핏·연락두절은 `DERIVED_SAFE_LOCAL_CANDIDATE`, Closed Won은 `NEEDS_VERIFICATION`이다.

Closed Won의 부족한 규칙 한 줄: **actual schema에서 `contract_amount/won_amount/completion_date`와 expansion pool의 정본을 확정해야 한다.**

Golden의 expansion/quote 후보 테이블은 actual Staging에 없으므로 존재한다고 가정하지 않는다.

### 4.5 금액 — `amount`

#### Reachable payload

PC 상세 저장은 `{opportunity_id, amount, quote_amount, won_amount}`를 보낸다. Mobile에는 생성/Stage 전환의 금액 입력은 있으나 동일한 독립 3종 금액 편집은 확인되지 않았다.

#### 서버 transaction 경계

- Deal 잠금, 권한/version/receipt 검사
- 예상·견적·수주 금액의 확정된 정본 갱신
- before/after private audit
- commit 후 ACK

#### 판정

세 의미를 분리한다.

- P05E 예상금액: `DERIVED_SAFE_LOCAL_CANDIDATE`. actual `deals.amount`가 정본이다. PC 상세와 문제함의 기존 `amount` op를 유지하고 actor/scope/version/receipt/private audit를 한 transaction으로 처리한다. UI가 함께 보내는 `quote_amount`는 최신 append-only quote와 일치하는 concurrency snapshot일 때만 허용하며 저장 대상이 아니다. `won_amount`는 null만 허용한다.
- P05Q 사유 없는 견적금액 직접 편집: `NEEDS_VERIFICATION`. 기존 P14 `quote_version`은 조정 사유 필수·append-only이므로 상세 입력의 무사유 덮어쓰기와 충돌한다.
- P05W 수주 전 수주금액 직접 편집: `NEEDS_VERIFICATION`. 수주금액은 Closed Won/준공 증거 transaction 밖에서 확정할 수 없다.

로컬 후보: `sql/pipeline-amount-expected/20260906`. 부족한 규칙 한 줄: **P05Q는 quote version 사유 입력으로 통합할지, P05W는 Closed Won에서만 입력하게 할지 UI 호환 방식을 승인해야 한다.**

### 4.5.1 대기 근거·재접촉 — `waiting_context`

현재 도달 가능한 DCC 저장은 이미 `waiting`인 Deal에 `{waiting_reason, waiting_speaker, waiting_customer_statement, wake_up_at, waiting_evidence, expected_resume_at}`를 보내고 곧바로 replacement `next_action`을 보낸다. client actor/time은 표시값이다.

판정: `DERIVED_SAFE_LOCAL_CANDIDATE`. `sql/pipeline-waiting-context/20260906` 후보는 `stage_contexts.waiting`, `wake_up_at`, 기존 open Next 취소와 새 Next, `대기정보` Activity, Deal summary/version, private audit/receipt를 한 transaction으로 처리하고 legacy child Next를 흡수한다. server actor/time만 정본이며, reload 시 existing DCC aliases는 context fields에서 복구한다. `stage_code='waiting'`인 active Deal만 허용하므로 대기 단계 진입은 P03 구조화 전환을 우회하지 않는다.

### 4.6 사업유형 변경 — `service_change`

#### Reachable payload

- PC: from/to business, reason/source, 선택적 next action/due
- Mobile: `{opportunity_id, from_service, to_service, origin_channel, reason, reason_source, next_action, at}`

두 UI 모두 current business/brand, history, Activity, 선택적 Next Action을 한 사용자 행동으로 취급한다.

#### 서버 transaction 경계

- 허용 사업유형과 current value 검증
- `current_business`, 호환 `brand`, 필요 시 `origin_business/service_type` 갱신
- `business_history` row와 Deal JSON history를 동일 규칙으로 기록
- 사업유형 변경 Activity 1건
- 선택적 Next Action 교체/생성
- private audit와 receipt

#### 판정

`DERIVED_SAFE`.

actual `apply_business_change(...)`가 update + history + optional Next Action 의도를 입증한다. 하지만 이 함수는 보안 경계가 아니므로 UI가 직접 호출해서는 안 된다. Dispatcher가 auth UUID, `can_deal`, expected version, server clock, receipt, private audit를 적용한 transaction 내부에서 같은 저장 규칙을 실행해야 한다.

Mobile이 먼저 enqueue하는 별도 `activity`는 parent `service_change`에 흡수하거나 parent request에 종속시켜 Activity가 2건 생기지 않게 한다.

### 4.7 독립 Activity — `activity`

#### Reachable payload

공통 형태는 `{opportunity_id, type, note, result, occurred_at, meaningful_contact}`이다. 전화/문자/카카오/완료/연기/Stage/사업유형/첨부 등 여러 UI 경로가 Activity를 만든다.

#### 서버 transaction 경계

- Deal 권한/version/receipt 검사
- client type을 허용 vocabulary로 정규화
- client note/result를 `activities.detail`의 고정 JSON 계약으로 저장
- `occurred_at`, actor Auth/CRM UUID는 서버가 확정; 표시 이름은 복제값
- meaningful contact이면 `last_customer_contact_at`, 모든 Activity이면 `last_activity_at` 갱신
- Deal version, private audit, receipt

#### 판정

원자 경계는 `DERIVED_SAFE`, 전체 계약은 `NEEDS_VERIFICATION`.

부족한 규칙 한 줄: **현재 reachable 전체 Activity type과 어떤 type/result가 meaningful contact로 인정되는지 확정해야 한다.**

기존 후보 함수의 제한된 type 목록을 모바일의 넓은 type 집합에 그대로 강제하면 안 된다.

### 4.8 Next Action 설정/연기 — `next_action`

#### Reachable payload

- PC 상세: `{opportunity_id, type, text, due_at, assignee}`
- PC Today 연기: type/text/due 중심
- Mobile: `{opportunity_id, type, text, due_at}`

actual `next_actions`에는 `assignee_name`만 있고 담당자 UUID FK가 없다. `deals`에는 호환 summary인 `next_action`, `next_action_date`도 있다.

#### 서버 transaction 경계

- Deal 잠금과 권한/version/receipt 검사
- 기존 open Next Action을 정해진 정책으로 유지/완료/취소
- 새 Next Action row 생성 또는 기존 row 변경
- Deal 호환 summary/date 동기화
- 필요 시 연기 Activity 1건
- private audit와 receipt

#### 판정

원자 경계는 `DERIVED_SAFE`, 전체 계약은 `NEEDS_VERIFICATION`.

부족한 규칙 한 줄: **Deal당 open Next Action이 한 건인지, 새 저장이 replace인지 append인지, assignee를 UUID로 어느 필드에 보존할지 확정해야 한다.**

### 4.9 Next Action 완료 — `next_action_complete`

#### Reachable 차이

- Mobile Today는 `{opportunity_id, action_id}`로 완료한다.
- PC Today는 `{opportunity_id, text, due_at, at}`로 완료한다.
- PC Deal 상세 `completeNextAction()`은 로컬 상태와 Activity만 바꾸고 server write를 보내지 않는다.

#### 서버 transaction 경계

- stable `action_id`로 대상 open row를 잠금
- 이미 completed/cancelled면 replay인지 충돌인지 receipt로 판정
- status/completed_at 갱신
- Deal 호환 next summary/date를 다음 open action 또는 null로 동기화
- 완료 Activity 1건
- Deal version, private audit, receipt

#### 판정

원자 경계는 `DERIVED_SAFE`, 전체 계약은 `NEEDS_VERIFICATION`.

부족한 규칙 한 줄: **모든 read/UI가 stable action UUID를 사용하도록 맞추고 PC 상세의 누락 write를 보완해야 한다.**

텍스트와 날짜만으로 완료 row를 찾으면 같은 제목/기한의 복수 action을 구분할 수 없으므로 정본 key로 허용하지 않는다.

## 5. Compatibility Adapter 정규화 원칙

외부 UI의 기존 op와 ACK는 유지한다. 내부 intent는 다음처럼 묶는다.

| 기존 외부 흐름 | 내부 원자 intent |
|---|---|
| `opportunity_create` 뒤 별도 초기 `activity/next_action` | `pipeline_create` 한 transaction |
| 같은 클릭의 `assign` + `handover` + Activity | `deal_assign_handover` 한 transaction |
| `transition` + Activity + 선택 Next | `deal_transition` 한 transaction |
| `close` + Activity + 선택 Next + `expansion_pool_upsert` | `deal_close` 한 transaction |
| `service_change` + Activity + 선택 Next | `deal_service_change` 한 transaction |
| 사용자가 독립적으로 기록한 Activity | `deal_activity_add` |
| 사용자가 독립적으로 설정/연기한 Next | `deal_next_action_set` |
| 사용자가 독립적으로 완료한 Next | `deal_next_action_complete` |

서버 내부 intent 이름은 구현 세부다. 외부 operation은 기존 ACK 호환을 위해 최초 UI op를 그대로 반환할 수 있다. 다만 한 사용자 행동에 request ID가 여러 개 생성되는 현재 queue 동작은 부모 request ID 또는 deterministic child key로 묶어야 한다.

## 6. 필수 검증 계약

각 구현은 로컬 contract test 뒤 actual Staging JWT 시험에서 다음을 증명해야 한다.

- 허용 역할 success와 타 담당자/타 scope 거절
- server actor Auth UUID/CRM UUID, server timestamp 정확성
- expected version stale 409 및 부수효과 0
- 같은 request/payload replay 시 core/history/activity/next/audit 중복 0
- 같은 request/다른 payload 409
- transaction 중간 실패를 주입했을 때 모든 row rollback
- Activity/Next Action이 compound command와 독립 command 양쪽에서 중복되지 않음
- 새로고침 후 PC/mobile이 같은 current state를 읽음
- 기존 ACK shape 유지
- frozen `opportunity_work_set`와 `direct_assign` 회귀 PASS
- n8n/Production 요청 0

## 7. 구현 전 남은 결정 목록

우선순위대로 다음 규칙만 확정하면 된다.

1. 신규 생성 시 초기 Next Action 필수 여부와 site/contact merge identity.
2. 담당자 변경의 Mobile 사유 규칙 및 UUID 인계 history 저장 위치.
3. Stage context/transition history 저장 위치와 open Next 교체 규칙.
4. 예상/견적/수주 금액 및 completion date의 actual 정본.
5. expansion pool actual 정본과 close transaction 포함 방식.
6. reachable Activity type/meaningful-contact 분류.
7. Next Action one-open/replace/append 및 assignee UUID 규칙.
8. stable action UUID를 PC/mobile read와 완료 payload에 공통 제공.

이 결정 전에도 `service_change`는 독립 후보 구현이 가능하다. 나머지는 atom boundary를 유지한 채 `NEEDS_VERIFICATION`으로 둔다.
