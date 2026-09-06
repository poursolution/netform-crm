# Pipeline action bundle — local candidate review

상태: `LOCAL_CHAIN_CANDIDATE_AFTER_T03_NOT_APPLIED`

후속 판정: 이 문서에서 보류했던 `next_action_complete`는 operational source가 실제 Action UUID를 PC/mobile에 보존하도록 보충된 뒤 `sql/pipeline-next-complete/20260906`의 별도 10-op 체인 후보로 닫혔다. 이 action bundle 자체의 8-op 범위는 변경하지 않는다.

2026-09-06 추가 판정: private helper-only 단계에서 멈추지 않고, T03 개인화 6-op 계층 위에 `activity`/`next_action` 두 분기만 추가하는 8-op 체인 후보를 구성했다. Golden HTML은 수정하지 않고 최종 Overlay가 명시된 독립 핸들러 실행 중에만 `intent:'standalone'`을 추가한다. 인식되지 않은 parent-derived 호출은 계속 fail-closed다.

## 판정

| 외부 op / 의미 | 판정 | 근거와 부족한 규칙 한 줄 |
|---|---|---|
| `amount` | `NEEDS_VERIFICATION` | PC는 예상금액 `amount`, 견적금액 `quote_amount`, 수주금액 `won_amount`를 한 번에 저장하지만 실제 Staging Deal에는 `amount`만 있고 나머지 두 컬럼/정본 테이블이 없다. **부족 규칙:** 견적은 version table, 수주는 close/contract 중 어디가 정본인지 확정해야 한다. |
| `next_action` PC Deal 기본형 (`type,text,due_at,assignee?`) | `DERIVED_SAFE_LOCAL_CHAIN_CANDIDATE` | Overlay가 `saveNextAction`(Deal만)과 `spSaveNext`에만 standalone 문맥을 주입한다. 기존 open은 `cancelled`, 새 row는 `open`, Deal version은 1 증가한다. Mobile parent-derived Next는 연결하지 않는다. |
| `next_action` 예약/연기 확장 | `NEEDS_VERIFICATION` | 이 기초 후보에서는 확장 필드를 받지 않는다. 메시지 예약은 후속 `sql/message-reminder/20260906`, Today 연기는 `sql/next-action-postpone/20260906`에서 각각 독립 내부 intent와 원자 transaction을 가진 로컬 후보로 닫혔다. 이 기초 action bundle의 범위는 변경하지 않는다. |
| `next_action_complete` | `NEEDS_VERIFICATION` | mobile은 브라우저 `na-<timestamp>` ID를 보내고 PC Today는 text/due만 보내며 PC 상세 완료는 write 자체가 없다. 실제 PK는 UUID다. **부족 규칙:** ACK의 서버 UUID를 UI에 유지하거나 “현재 open 1건”을 완료한다는 규칙을 승인해야 한다. |
| 명시된 독립 `activity` | `DERIVED_SAFE_LOCAL_CHAIN_CANDIDATE` | PC 활동폼/split/전화시도와 mobile 통화메모/연락시도 핸들러에만 standalone 문맥을 주입한다. Stage·service·message·contact-save 등 parent 업무의 파생 Activity는 거절된다. |
| PC split `contact` meaningful marker | `DERIVED_SAFE_LOCAL_CHAIN_CANDIDATE` | `spSaveAct` 문맥에서 체크박스를 Activity의 `meaningful_contact` boolean으로 합치고 이어지는 legacy `contact` op는 Overlay에서 흡수한다. 서버 변경·Activity·contact timestamp·audit·receipt는 한 transaction이다. |

`amount`, `next_action_complete`, 예약/연기 Next, mobile parent-derived Next는 이 기초 후보의 adapter connected 목록에 포함하지 않는다. 확정된 후속 의미는 각 downstream package에서만 연결한다. PC split의 legacy `contact`는 별도 서버 op로 연결하지 않고 standalone Activity에 흡수한다.

## Golden payload

### amount — PC only

```json
{"opportunity_id":"uuid","amount":0,"quote_amount":null,"won_amount":null}
```

UI 라벨은 각각 예상금액/견적금액/수주금액이다. `0`은 허용되며 quote/won은 `0`일 때 `null`로 전송된다. Mobile에는 동일 `amount` 버튼이 없고 견적 version과 수주 close 흐름이 별도다. 세 값을 `deals.amount` 하나로 합치면 의미가 깨진다.

### next_action

기본형은 PC/mobile 모두 다음 필드를 보낸다.

```json
{"opportunity_id":"uuid","type":"전화","text":"후속 확인","due_at":"2026-09-09","assignee":"담당자 표시명(PC optional)"}
```

예약 메시지는 `scheduled_at/channel/template_key/draft_body`, mobile 연기는 `postpone_count`를 추가한다. 이 확장 필드는 기본형 helper에서 fail closed다.

### next_action_complete

- Mobile: `{opportunity_id, action_id:'na-<timestamp>'}`
- PC Today: `{opportunity_id, text, due_at, at}`
- PC 상세: local 완료/Activity 전환만 하고 write 없음

따라서 PK UUID를 기준으로 한 서버 함수에 현재 payload를 그대로 연결하지 않는다.

### activity/contact

activity 기본형:

```json
{"opportunity_id":"uuid","type":"전화","note":"통화 완료","result":"후속 협의","occurred_at":"ISO","meaningful_contact":true}
```

PC 일반 저장은 `meaningful_contact`를 생략하지만 최종 UI의 `isMeaningfulContact()` 규칙으로 local metric을 계산한다. Mobile은 boolean을 명시한다. PC split의 체크박스는 activity 다음에 `{opportunity_id,type,at}`인 `contact`를 별도 전송한다.

## 실제 Staging schema 대조

정적 대조 정본은 `sql/inquiry-direct-assign/20260906/after.json`이다.

- `deals`: `amount bigint`, `amount_unknown_reason text`, `next_action text`, `next_action_date date`, `last_activity_at`, `last_customer_contact_at`, `version`; `quote_amount/won_amount` 없음.
- `next_actions`: UUID PK, Deal/Inquiry 중 하나, `action_type/title/due_at/assignee_name/status/completed_at/source_activity_id`; status는 `open/completed/cancelled`.
- `activities`: UUID PK, Deal/organization, server actor email/name, type, JSON detail, occurred_at.
- scoped amount/activity/next command와 current public Dispatcher 분기는 현재 실제 스냅샷에 없다.

## local helper 의미

`candidate.sql`은 `crm_security.crm_pipeline_action_command_v1()` 하나만 private으로 추가한다. 공개 endpoint와 현재 `crm_write_command_v2`, 그 private frozen delegate는 변경하지 않는다.

지원하는 내부 의미:

1. `next_action`
   - canonical payload: `type,text,due_at,assignee?`만 허용한다.
   - Deal `can_deal(id,true)`와 read version을 확인한다.
   - assignee는 승인·활성·미만료 CRM user 표시명으로 서버가 재확인하며 미지정이면 Deal UUID owner를 사용한다.
   - 기존 open row를 cancelled로 남기고 새 open row 한 건을 만든다.
   - Deal `next_action/next_action_date`와 version을 같은 transaction에서 갱신한다.
2. `activity`
   - canonical payload: `type,note,result?,occurred_at,meaningful_contact?`만 허용한다.
   - actor email/name은 server Auth UUID/CRM UUID에서 정한다.
   - explicit boolean이 없으면 Golden의 negative/positive text 규칙을 보수적으로 적용한다.
   - Activity insert, last activity/contact timestamp, Deal version, audit, receipt를 한 transaction에 둔다.

두 의미 모두 request replay는 추가 row를 만들지 않고, 같은 request ID의 다른 payload는 `PT409`, stale version은 `PT409`다. ACK는 공통 `{ok:true,contract_version:1,request_id,operation,object_id,actor_auth_uid,actor_user_id,previous_version,version,replayed}`와 생성 ID를 반환한다.

## 중복 Activity와 composition gate

현재 Mobile은 service change, stage/close, next complete, message, contact save 등의 parent 동작 전후에 같은 `activity` op를 별도로 enqueue한다. 이미 원자 Activity를 만드는 parent command와 이를 모두 연결하면 중복 row 또는 stale version 충돌이 생긴다.

기존 `adapter-contract.js`는 private helper canonical input 증거로 유지한다. 추가된 `operational-adapter.candidate.js`와 `operational-overlay.candidate.js`가 실제 network 연결 후보이다.

- Overlay가 승인된 독립 핸들러 실행 중에만 `intent:'standalone'` discriminator를 추가한다.
- parent command에 흡수된 derived activity/next는 별도 전송하지 않는다.
- 독립 Activity/Next만 `crm_write_command_v2`의 새 분기로 private helper에 위임한다.
- 한 user action에서 여러 Deal-version command를 순차 전송할 경우 앞 ACK version을 다음 command expected version으로 넘기거나 parent transaction으로 합친다.

시간/문구 추측만으로 derived row를 억제하지 않는다.

메시징 Coverage M01A 중 현재 최종 override에서 실제 독립 write로 남는 것은 PC `contactDial → contactActivity`와 mobile `callContactM → addActivity`의 **전화 시도**뿐이다. 이 두 handler는 위 standalone Activity gate에 이미 포함되며, 성공 통화로 해석하지 않고 `meaningful_contact=false` 또는 보수적 부정 판정을 유지한다. 최종 PC/mobile SMS·카카오 handler는 composer의 M02 결과 확인 흐름으로 덮여 있으므로 “앱 열기 전 standalone Activity”로 중복 계산하지 않는다.

## wrapper composition 전략

생성된 `staging-apply-after-personal.sql`은 T03이 먼저 적용된 정확한 6-op 상태에서만 다음 구조를 만든다.

```text
public.crm_write_command_v2 (유일한 authenticated endpoint)
  ├─ frozen opportunity_work_set / inquiry_assign delegate
  ├─ inquiry_unassign private helper
  ├─ service_change existing branch
  ├─ favorite_set / opportunity_touch personal delegate
  ├─ next_action private helper      (PC Deal standalone only)
  └─ activity private helper         (named standalone handlers only)
```

private helper와 중간 delegate는 `PUBLIC/anon/authenticated/service_role` 직접 EXECUTE를 모두 금지한다. public wrapper만 `authenticated` EXECUTE를 가진다. T03 적용 후 live OID/hash를 재캡기 전에는 이 SQL을 Staging-ready로 판정하지 않는다.

## Rollback

`rollback-after-personal.sql`은 action wrapper/helper만 제거하고 T03의 6-op public wrapper 식별/OID를 복원한다. action receipt는 private archive에 보존하고, 이미 생성된 next/activity/audit 업무 증거는 삭제하거나 역변경하지 않는다. 로컬 체인·UI 시험은 15/15 PASS였다.
