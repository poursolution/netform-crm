# Pipeline 생성·단계·종료 계약 대조

작성일: 2026-09-06  
범위: 현재 Golden PC/mobile에서 실제 도달 가능한 `opportunity_create`, `transition`, `close`, `assign` + `handover`  
검증 방식: 로컬 UI/Golden SQL과 보관된 actual Staging metadata snapshot 대조. 원격 접근 및 DDL/DML 없음.

## 결론

사용자 행동별 **원자 transaction 경계는 `DERIVED_SAFE`**하게 확정할 수 있다. 최초 대조 뒤 최종 구조화 UI의 비종결 전환, 직접 신규 Deal, 일반 본사 문의의 승격/신규생성 및 수동 lineage를 각각 로컬 candidate로 확정했다. 기술자문 이관·담당자 인계·수주/확장은 계속 `NEEDS_VERIFICATION`이다.

| Intent | Reachable 근거 | 원자 경계 | 최종 판정 | 부족한 규칙 한 줄 |
|---|---|---|---|---|
| 문의에서 기존 Deal 승격 | PC `transition` | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | 명시 lineage 우선·site fallback은 same-site/same-owner/no-conflict일 때만 허용하고, stage/history/activity/audit/receipt를 한 transaction으로 로컬 검증했다. Staging 미적용. |
| 문의에서 새 Deal 생성 | PC `opportunity_create` | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | `deals.origin_inquiry_id`만 lineage 정본으로 쓰고 inquiry advisory lock·중복 preflight·서버 중복검사로 inquiry당 Deal 하나 및 auto status 원자 갱신을 로컬 검증했다. Staging 미적용. |
| 기술자문 문의 이관 | PC `opportunity_create` + `inquiry_status` | `DERIVED_SAFE` | `NEEDS_VERIFICATION` | 영업담당 미배정 생성 허용 역할과 Deal 생성·문의 상태 변경의 단일 transaction 규칙이 필요하다. |
| PC 직접 신규 Deal | PC `opportunity_create` | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | 공통 exact Site key, broad-match 409, 승인된 본사 rep UUID owner, PC Activity 1/Next 0을 한 transaction으로 로컬 검증했다. Staging 미적용. |
| Mobile 직접 신규 Deal | Mobile `activity` + `next_action` + `opportunity_create` | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | child Activity/Next를 parent에 흡수하고 rep self-owner·branch self-owner·consultation 차단·admin rep picker와 Activity 1/Next 1을 로컬 검증했다. Staging 미적용. |
| 담당자 변경·인수인계 | PC/mobile `assign` + `handover` | `DERIVED_SAFE` | `NEEDS_VERIFICATION` | UUID from/to history와 구조화 handover summary의 actual 저장 정본, mobile 사유 규칙, 두 op의 correlation key가 필요하다. |
| 비종결 단계 전환 | PC/mobile `transition` + `activity` + optional `next_action` | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | Golden의 `deals.stage_contexts` 의도와 P09의 open Next 교체 규칙을 사용하고 child write를 parent transaction에 흡수했다. Staging 미적용. |
| 실주 종료 | PC/mobile `close` + `activity`/mobile `next_action_complete` | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | 선택 사유와 상세를 private event/context에 분리 보존하고 모든 open Next를 completed 처리하는 parent transaction을 검증했다. |
| 배드핏 종료 | PC/mobile `close` + `activity`/mobile `next_action_complete` | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | UI `badfit_lead`를 DB outcome `badfit`으로 정규화하고 source stage와 상세 context를 보존한다. |
| 연락두절 종료 | PC/mobile `close` + `activity`/mobile `next_action_complete` | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | PC/mobile 사유 vocabulary를 서버에서 명시 검증하고 상세·Next 완료·history를 한 transaction으로 처리한다. |
| 수주 종료 | PC/mobile `close` + `activity` + `expansion_pool_upsert` | `DERIVED_SAFE` | `DERIVED_SAFE_LOCAL_CANDIDATE` | `sql/pipeline-close-won/20260906`가 completion-only 증거, 별도 won 금액/준공일, private expansion Pool, history/Activity/audit/receipt를 한 transaction으로 묶고 child writes를 흡수한다. Staging 미적용. |

여기서 `DERIVED_SAFE`는 **함께 성공하거나 함께 실패해야 하는 row 집합**에 대한 판정이다. 저장 위치가 미확정인 데이터를 임의의 JSON/text 칼럼에 밀어 넣어 최종 intent를 승격하지 않는다.

## 확인 근거

### 현재 도달 가능한 UI

- 문의 자동 승격/생성: `crm.html:6549-6592`
- 문의 수동 승격/생성: `crm.html:6743-6783`
- 기술자문 문의 이관: `crm.html:7788`
- PC 직접 생성: `crm.html:7171-7214`
- Mobile 직접 생성: `mobile.html:2106-2125`
- PC 담당자 변경과 후속 handover wrapper: `crm.html:5263-5264`, `crm.html:7561-7562`
- Mobile 담당자 변경과 handover: `mobile.html:2401`
- 최종 PC/mobile 단계·종료 화면: `stage-transition-ui.js:1-99`
- 단계별 필드와 전환 검증: `stage-transition.js:1-78`
- 최종 화면 script는 PC `crm.html:8060-8061`, Mobile `mobile.html:2610-2611`에서 구형 handler 뒤에 로드된다.

구형 Mobile `win`/inline transition handler는 `dead-overrides.csv`의 D06/D07처럼 최종 `StageTransitionUI`에 의해 대체된다. 계약은 최종 구조화 payload를 정본으로 보고, 구형 payload는 현재 reachable 계약으로 세지 않는다.

### Actual Staging snapshot

정본은 `sql/operational-bundle/20260906/after.json`이다.

- `deals`는 UUID `id`, UUID `owner_id`, UUID `origin_inquiry_id`, `stage_code`, `stage_*`, `amount`, `lifecycle_status`, `outcome`, `closed_at`, `lost_reason`, `badfit_type`, `next_action/date`, `version`을 보유한다.
- `deals.origin_inquiry_id`는 nullable FK지만 unique가 아니다. Deal 중복을 막는 unique는 `relate_id`뿐이며 UI `client_ref`나 inquiry lineage의 정본이라고 확인되지 않았다.
- `inquiries`에는 `deal_id`와 `opportunity_id`가 모두 있고 둘 다 Deal FK다. 일반 문의 승격은 UI 주석대로 Deal 쪽 `origin_inquiry_id`만 쓰고 문의 reverse-link를 갱신하지 않는다. 기술자문 이관은 별도 `inquiry_status`를 보내므로 이 계약에 포함하지 않는다.
- `stage_history`는 실제로 존재하며 Deal/inquiry FK, from/to, reason, UUID `actor_id`, actor display name, changed time을 가진다. 단 structured context 칼럼과 Deal/inquiry exactly-one 제약은 없다.
- `assignment_history`도 실제로 존재하지만 from/to/actor가 text이고 UUID from/to FK 및 handover summary가 없다.
- `activities.detail` JSON과 `next_actions`는 존재한다. `next_actions`에는 UUID assignee가 없고 Deal당 open 1건 unique도 없다.
- `deals`에는 `stage_context`, `stage_contexts`, `completion_date`, `won_amount`, `contract_amount`가 없다.

### 담당자 변경·인수인계(P02) 최종 분류

PC는 사용자 입력 사유와 client-side same-team eligibility를 요구하지만, 모바일 최종 handler는 `관리자 재배정`을 고정 문구로 사용한다. 양쪽 모두 `assign` 뒤에 별도 `handover`를 보내며 두 write 사이 correlation key는 없다. 실제 Staging에는 handover 전용 relation도, `users.user_id`별 `head_office / external / gyeongnam` 팀 정본도 없다.

따라서 UUID owner/history/audit 구현만으로 P02를 연결하지 않는다. 승인된 서버 team/assignability 정본이 생긴 뒤 `assign` 한 transaction에서 owner 변경·history·Activity·서버 생성 handover summary·audit·receipt를 처리하고, 뒤따르는 `handover` child를 compatibility layer에서 흡수한다. 모바일에는 PC와 같은 사용자 입력 reason을 받는 최소 보완을 적용한다. 상세 근거와 계약은 `pipeline-owner-handover-resolution-20260906.md`에 고정했다.
- `crm_handover_summaries`, `crm_stage_transition_records`, `crm_expansion_pool`은 actual snapshot에 없다.
- 현재 receipt operation은 `opportunity_work_set`, `inquiry_assign`, `service_change`, `inquiry_unassign`뿐이다. Pipeline op는 Dispatcher/receipt에 아직 연결되지 않았다.

기존 `pipeline-atomic-contracts.md`의 “`stage_history`가 없다”는 기술은 older snapshot 해석이다. current actual snapshot 기준으로는 **테이블은 있지만 구조화 UI 계약을 담기에 부족하다**가 정확한 판정이다.

## Payload 차이와 부수효과

### 신규 생성

PC 직접 생성은 site/work/공종/brand/owner/amount/address와 관리사무소·관리소장 연락처 및 생성 사유를 한 `opportunity_create`에 보낸다. 화면은 Deal과 연락처가 함께 등록되었다고 안내하며 초기 Activity를 로컬 Deal에 넣지만 별도 `activity` op는 보내지 않는다.

Mobile 직접 생성은 같은 핵심 필드에 현재 사용자 owner와 선택적 기존 `site_id`를 보낸다. 저장 직전에 temp Deal ID로 `activity`와 `next_action`을 먼저 enqueue하고, 이후 `opportunity_create`를 enqueue한다. queue는 create ACK의 `new_opportunity_id`로 temp ID를 바꾼 뒤 child op를 보낸다. 이 때문에 서버 create가 초기 Activity/Next를 자체 생성하면서 child op도 그대로 처리하면 중복이 생긴다. 현 UI 의미를 보존하는 유일한 Adapter 규칙은 mobile의 두 child payload를 먼저 포착해 parent transaction에 넣고 별도 enqueue를 흡수하는 것이다. PC는 초기 Activity만 만들고 초기 Next는 만들지 않으므로 서버가 모든 신규 Deal에 Next를 강제해서는 안 된다.

2026-09-06 최초 Staging read-only 재확인 결과는 `staging-opportunity-create-preflight-20260906.json`에 고정했다. `sites.norm_name`은 NOT NULL+unique지만 default/trigger가 없어 호출자가 값을 정해야 한다. `contacts.person_key`와 open `(person_key,site_name)` assignment에는 실제 unique index가 있고 Deal의 Site/owner/contact/origin inquiry 및 Activity/Next FK도 존재한다. 최초 preflight의 두 blocker는 뒤이은 UI 호출부 전수대조와 Staging aggregate-only 검사로 보수적 fail-closed 규칙을 도출했으며, 해소 근거는 `opportunity-create-resolution-20260906.json`과 `sql/pipeline-opportunity-create/20260906/`에 분리 기록한다.

현행 UI에도 하나의 정규화식은 없다. PC `normSite()`는 대괄호 지역표시·공백·`아파트`·`현장`을 제거하지만, Mobile `normSiteM()`은 대괄호 지역표시·`아파트`·`APT`·공백과 `-_.,`를 제거한다. Mobile 신규 생성의 실제 중복 gate는 이 둘과도 달리 선행 대괄호만 걷은 문자열 포함 비교를 사용한다. 따라서 이들 중 하나를 서버 정본으로 임의 선택하면 기존 화면에서 별개로 보던 Site를 합치거나 같은 Site를 둘로 만들 수 있다.

역할 규칙도 UI와 Staging 사이에 실제 충돌이 있었다. PC 일반 신규기회는 `new_sales`로 본사 active sales만, 확장 신규기회는 원 Deal 조직의 active sales만 owner 후보로 허용한다. 반면 Mobile 신규영업은 별도 선택·eligibility gate 없이 로그인 사용자를 owner로 보냈다. 이 충돌은 직접 생성에 한해 서버 권한 정본으로 닫는다. 본사 rep/admin은 승인·활성·미만료 `permission_role='rep'` UUID만 owner로 지정하고, branch는 기존 모바일 self-owner 의미만 유지하며, consultation은 버튼과 서버 양쪽에서 차단한다. admin/dual 모바일에는 기존 본사 rep 목록을 쓰는 최소 picker를 보충한다. 확장 신규기회는 직접 생성이 아니므로 이 후보에 섞지 않는다.

Mobile만 현장 core + 공사명 + 공종 summary로 로컬 중복을 차단한다. PC 직접 생성에는 같은 gate가 없고, DB에도 해당 semantic unique가 없다. `client_ref`는 temp ID/ACK correlation이지 중복 판정 정본으로 확정되지 않았다.

문의 promote는 명시적 lineage 외에 site fallback으로 기존 Deal을 찾는다. 로컬 candidate는 `deals.origin_inquiry_id`의 명시 lineage를 먼저 사용하고, site fallback은 same-site/same-owner/no-conflict인 일반 본사 문의에만 허용한다. 기존 Deal이면 server current stage 기준 forward-only `transition`, 없으면 `opportunity_create`를 수행한다. 자동 승격만 qualifying 문의 status를 같은 transaction에서 갱신하고, 수동 승격은 UI가 본 status와 server current status 일치를 요구한다. 기술자문 flow는 별도 `inquiry_status` 의미이므로 계속 차단한다.

### 단계와 종료

최종 구조화 UI의 parent payload는 다음 필드를 보낸다.

`opportunity_id, from, to, stage_code, at, transition_date, note, reason, stage_context, stage_contexts, contract_amount, completion_date`

종결이면 `outcome, closed_at, won_amount`가 추가된다. 그 뒤 별도 request ID로 Activity를 항상 보내고, stage가 날짜를 파생하면 Next Action도 보낸다. 수주면 expansion upsert를 한 번 더 보낸다.

또한 UI 내부에도 의미 충돌이 남아 있다. PC core의 `PARKED_CODES`는 `waiting`과 `silent`를 진도 Stage가 아닌 lifecycle로 설명하지만, 최종 structured form은 둘을 stage definitions/choices에 포함한다. actual `deals`는 `lifecycle_status`, `wake_up_at`와 `stage_code`를 모두 가진다. 서버는 이 둘의 정본 관계가 확정되기 전 client `to`만 믿고 갱신하면 안 된다.

### 담당자 변경과 인수인계

PC는 user-entered reason이 필수이며 `assign` 뒤 wrapper가 structured `handover`를 추가한다. Mobile은 같은 클릭에서 `assign`과 `handover`를 보내지만 user-entered reason이 없고 summary 내부의 고정값 `관리자 재배정`만 있다. 두 op에는 같은 parent request/correlation ID가 없으므로 현재 형태만으로 서로 같은 클릭인지 안전하게 합칠 수 없다.

Golden `20260905_sales_execution_engine.sql`의 `crm_handover_summaries`와 `crm_handover_add()`는 업무 의도 증거일 뿐 actual schema에는 없다. 또한 client created_by/created_at을 그대로 쓰는 과거 후보라 현재 UUID/JWT 감사 정본으로 재사용하지 않는다.

## 원자 transaction 계약

모든 Pipeline command가 공통으로 지켜야 할 순서는 다음과 같다.

1. JWT Auth UUID에서 active/approved/미만료 CRM user UUID와 역할을 서버가 확정한다.
2. client `actor/from/at/status/stage_code`는 표시·충돌 감지 입력일 뿐 권한·시간·현재값 정본으로 쓰지 않는다.
3. 대상 inquiry/Deal/site/contact를 정해진 lock 순서로 잠그고 object scope와 intent별 역할을 검사한다.
4. 기존 object가 있는 command는 server current version과 `expected_version`을 비교한다. stale이면 409이며 부수효과 0이다.
5. `request_id`, operation, object/canonical payload hash를 receipt와 비교한다. 같은 payload replay는 원 ACK, 다른 payload reuse는 409다.
6. core row, lineage, history, Activity, Next Action, private audit, receipt를 하나의 transaction에 기록한다.
7. Deal version은 사용자 intent당 정확히 한 번 증가한다. 내부 history/Activity/Next마다 추가 증가시키지 않는다.
8. commit 뒤에만 기존 ACK를 반환한다.

새 Deal 생성 ACK는 최소 `{ok:true, write_id, operation:'opportunity_create', new_opportunity_id}`를 유지해야 한다. UUID는 서버가 생성하고 replay에서 동일 UUID를 반환한다. 기존 object command는 `{ok:true, write_id, operation, ...}`와 결과 version을 유지한다.

## Intent별 원자 경계

### Inquiry promote

Inquiry와 연결 Deal을 함께 잠근다. existing path는 server current stage를 기준으로 forward-only 여부를 판정하고 stage/history/Activity/선택 금액을 함께 반영한다. create path는 Deal UUID, owner UUID, origin lineage, 초기 Activity를 저장하며 auto mode에서만 qualifying inquiry status/qualified time을 함께 갱신한다. 일반 문의의 reverse `inquiries.deal_id/opportunity_id`는 UI 주석대로 쓰지 않는다. 동일 request replay와 동시 promote에서 신규 Deal은 0개 추가되어야 한다.

현재 schema의 `origin_inquiry_id`는 unique가 아니므로 apply preflight가 기존 중복을 거절한다. runtime에는 inquiry id advisory lock과 inquiry row lock 뒤 `origin_inquiry_id` 중복을 서버에서 재확인한다. 이 조합이 한 inquiry→한 Deal 계약을 보장하며, 수동 lineage도 same Site·same owner UUID·Deal created-after-inquiry·기존 lineage 무충돌을 요구한다.

### Direct create

site/contact identity resolve 또는 생성, Deal 생성, owner UUID/공종/금액/연락처 저장, 초기 Activity, 확정된 초기 Next Action, audit/receipt가 한 transaction이다. 어느 contact/history write라도 실패하면 Deal도 없어야 한다.

중복 기준은 최소 다음 두 종류를 분리해야 한다.

- retry duplicate: 같은 request는 receipt로 무조건 같은 Deal UUID를 반환한다.
- semantic duplicate: 다른 request로 같은 현장/공사/공종을 만들 때 기존 Deal을 열지, 409로 막을지, 별도 Deal을 허용할지 업무 규칙이 필요하다.

직접 생성 후보는 양쪽 UI가 공통으로 제거하는 대괄호 태그·공백·`아파트`만 exact key로 사용한다. exact 1건만 재사용하고 2건 이상은 409다. exact가 없는데 PC 전용 `현장`, 모바일 전용 `APT`·구두점 또는 기존 `norm_name`의 broad match가 있으면 자동 병합/신규 생성을 하지 않고 명시적 Site 선택을 요구한다. 모바일의 substring match는 사용하지 않는다. 새 Site만 `crm:v1:<common-key>`를 기록하고 advisory lock으로 동시 중복을 막는다.

creator/owner는 서버가 active·approved·미만료 review와 UUID를 확정한다. 본사 rep/admin은 승인된 rep를 지정하고 branch는 자기 자신만, consultation은 거절한다. 같은 transaction에서 Site, Contact, Deal, contact assignment, PC Activity 1건 또는 모바일 Activity+Next 각 1건, 필요 scope, private audit, receipt를 기록한다. request UUID를 create sentinel/idempotency key로 사용하며 replay는 같은 Deal UUID를 반환한다. 다른 request의 모바일 exact semantic duplicate는 409, PC는 기존처럼 별도 생성을 허용한다. 일반 본사 문의 promote는 별도 내부 intent 후보로 분리했으며, 기술자문 이관·경남 승격·확장견적 전환은 계속 `NEEDS_VERIFICATION`이다.

### Assign + handover

server current owner, new owner UUID, `deals.owner_id`와 표시 이름, UUID assignment history, structured handover summary, Activity, audit/receipt가 한 transaction이다. `assign`만 성공하고 `handover`가 빠지는 상태는 허용하지 않는다. 기존 외부 op를 둘 다 유지하려면 UI transport에 최소 parent correlation/discriminator를 추가하거나 한 op가 full transaction을 소유하고 다른 op는 deterministic child receipt로 replay 처리해야 한다.

### Transition

Deal을 잠그고 server current stage/version, terminal 여부, server-side allowed transition과 target-stage required fields를 검증한다. 로컬 candidate는 Deal stage/timestamps/context, private structured transition event, `stage_history`, Activity, 선택 replacement Next Action, audit/receipt를 한 transaction으로 처리한다. UI가 뒤이어 enqueue하던 Activity/Next는 parent에 흡수한다.

현재 `stage_history.reason`에 `stage_context`를 문자열로 접어 넣으면 UI 재편집/검증 가능한 구조를 잃는다. `activities.detail`은 Activity 정본이지 transition 정본이 아니므로 대체 저장소로 임의 사용하지 않는다.

### Close

비수주 종료 candidate는 terminal validation, Deal `lifecycle_status/outcome/closed_at`와 종료 전 stage 보존, 사유/detail/context/history, terminal Activity, 모든 open Next Action 완료, audit/receipt를 한 transaction으로 처리한다. 수주 candidate도 동일한 원자 경계에 최종 금액·준공일·expansion lineage를 포함한다. 하나라도 실패하면 Deal은 열린 상태로 남아야 한다.

Closed Won 재검토(2026-09-06): 최종 PC/mobile `StageTransitionUI`는 현재 `completion`에서만 `won`을 열고, 준공일·`공사 완료`·`준공검사 완료`·양수 최종 수주금액을 필수로 받는다. Staging read-only 확인에서는 `won_amount`, `completion_date`, expansion Pool이 없고 기존 won/completion row도 0건이었다. 후보는 예상금액 `deals.amount`를 덮어쓰지 않고 `won_amount`/`completion_date`를 최소 보충하며, public trigger나 broad RLS 대신 private `crm_security.expansion_pool`과 actor-scoped projection을 사용한다. Pool의 Site/owner/work는 client child payload가 아니라 잠긴 Deal UUID 정본에서 만들고 다음 접촉일은 준공일+30일이다. 구형 `win` op는 계속 dead code이며, standalone `expansion_pool_upsert`는 부모 `close/won` 밖에서 차단한다.

DB outcome CHECK는 `won/lost/badfit/nocontact`이고 PC 구조화 UI는 배드핏에 `badfit_lead`, 모바일 legacy UI는 `badfit`을 사용한다. Adapter가 둘을 DB `badfit`으로 정규화하고 새로고침에서는 보존된 stage와 outcome을 함께 공급한다.

## 구현 전 결정 목록

1. ~~일반 문의 promote의 Deal 수/back-link/status/site fallback 규칙~~ — `deals.origin_inquiry_id` 정본, inquiry당 Deal 하나, auto-only status 갱신, lineage-first/safe legacy fallback으로 로컬 후보 확정. 기술자문·경남은 별도 미결.
2. PC/mobile 공통 semantic duplicate key와 site/contact merge identity.
3. 신규 Deal의 초기 Activity/Next Action을 parent가 소유하는지, child queue를 correlation하는지.
4. close detail의 durable 저장 정본.
5. terminal 전환에서 기존 open Next Action의 cancel/complete 규칙.
6. Mobile 담당자 변경 reason UI/서버 규칙, UUID assignment history, handover summary 정본, 두 op correlation.
7. 예상/계약/최종수주 금액과 준공일 필드, expansion pool/storage와 수주 transaction 포함 방식.
8. create/transition/close/assign별 역할과 branch scope, create의 `expected_version` sentinel 및 ACK version 규칙.

## 후보와 테스트 판정

후속 작업으로 `sql/pipeline-transition/20260906`에 구조화된 비종결 전환 candidate를 생성했다. Golden이 의도한 `deals.stage_contexts`와 private append-only event를 사용하며, 문의 promote의 단순 `transition`, terminal `close`, 수주/확장/금액은 명시적으로 거절한다. 로컬 계약·DB·UI 시험은 PASS했지만 Staging에는 적용하지 않았다.

`sql/inquiry-pipeline-lineage/20260906`에는 일반 본사 문의의 기존 Deal 승격·신규 Deal 생성·수동 lineage candidate를 분리했다. 외부 `transition`/`opportunity_create`/`lineage_link`와 ACK는 유지하고 내부 intent만 정규화한다. 한 inquiry→한 Deal, lineage-first read, auto/manual status 차이, same-site/same-owner 수동 연결, replay/reuse와 late-audit rollback을 격리 PostgreSQL·UI 계약 시험으로 검증했다. Staging에는 적용하지 않았다.

로컬 정적 검증은 `tests/pipeline-lifecycle-contracts.test.cjs`에 둔다. 이 테스트는 reachable op, 최종 structured handler 로드, actual table/column/constraint, current receipt operation 범위를 확인하며 원격 요청을 하지 않는다. 업무 규칙이 확정되면 별도 candidate와 DB transaction test에서 다음을 추가해야 한다.

- 허용 역할 성공, 타 owner/branch/scope 거절
- 새 Deal replay/reuse 및 동시 생성 duplicate 0
- inquiry lineage와 back-link/status 원자성
- stale version 409와 core/history/activity/next/audit 부수효과 0
- compound parent와 child queue의 Activity/Next/history 중복 0
- stage/close required context, terminal 재오픈 거절
- close outcome별 read refresh와 open Next Action 처리
- 수주 금액/준공/expansion의 all-or-nothing
- server Auth UUID/CRM UUID/time과 private audit exact count
- 기존 ACK와 PC/mobile 새로고침 parity
- frozen `opportunity_work_set`, `direct_assign`, `inquiry_unassign`, `service_change` 회귀

기존 `stage_history`와 `assignment_history`의 wide ACL/RLS 부채는 Production cutover backlog로 유지한다. 이번 분석에서 ACL을 완화하거나 frozen Dispatcher를 변경하지 않는다.
