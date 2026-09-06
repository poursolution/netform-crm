# 메시징 M01-M06 호환 계약 판정

판정일: 2026-09-06  
범위: 현재 로컬 Golden PC/mobile UI에서 도달 가능한 메시징 동작과 실제 Staging 정적 스냅샷의 대조  
제외: 외부 앱 실제 실행, 공급자 호출, Staging/Production/n8n/운영 Pages 접근 또는 변경

## 결론

| Coverage | 실제 사용자 행동 | 외부 동작과 서버 기록 경계 | 판정 |
|---|---|---|---|
| M01O | 전화·문자·카카오 앱 열기 | `tel:/sms:/kakao` deep-link는 외부 앱 실행이며 성공 증거가 아니다. | **CONFIRMED / EXTERNAL_APP** |
| M01A | 전화 앱 열기 전 시도 Activity | 최종 PC `contactDial → contactActivity`와 mobile `callContactM → addActivity`만 독립 Activity를 만든다. `meaningful_contact=false` 의미이며 발송·통화 성공이 아니다. | **DERIVED_SAFE / LOCAL_CHAIN_CANDIDATE** |
| M02 | 외부 앱 사용 후 발송완료·실패·취소 확인 | `sent`는 공급자 delivery가 아니라 사용자 사후 확인이다. 기존 2~3개 write를 한 versioned transaction으로 흡수하는 private outcome 후보를 만들었다. | **DERIVED_SAFE / LOCAL_CHAIN_CANDIDATE** |
| M03 | 문구만 복사 | Clipboard/prompt에 복사할 뿐 어떤 write도 하지 않으며 `sent`로 기록하지 않는다. | **CONFIRMED / EXTERNAL_APP** |
| M04 | 담당자 발송 알림 예약 | 자동발송 queue가 아니라 지정 시각의 담당자 실행 알림이다. Activity와 Next Action은 같은 사용자 행동이다. | **DERIVED_SAFE / LOCAL_CHAIN_CANDIDATE** |
| M05 | 접촉 보류·실제 회신에 따른 cadence 초기화 | M02 private outcome을 기준으로 hold+Next와 response+meaningful Activity를 원자 처리하고 단일 outbound/linked Next만 갱신하는 로컬 후보를 구현했다. | **DERIVED_SAFE / LOCAL_CHAIN_DB_UI_PASS** |
| M06 | 다중 대상 즉시·예약 대기열 등록 | PC에서만 도달 가능하다. queue 등록과 공급자 delivery callback은 서로 다른 transaction이며 callback 전에는 성공이 아니다. | **NEEDS_VERIFICATION** |

M01A의 전화 시도 Activity는 이후 `sql/pipeline-action-bundle/20260906`의 standalone Activity 후보로 흡수됐다. M04는 `sql/message-reminder/20260906`에서 Next Action·private 예약 metadata·비접촉 Activity·audit/receipt를 한 transaction으로 묶었다. M02는 `sql/message-log-compat/20260906`에서 user-attested 결과·sent Activity·선택적 Next Action·audit/receipt를 한 transaction과 scoped read로 묶었다. M05는 M02를 전제로 Adapter·private event ledger·scoped read·rollback을 구현해 로컬 DB/UI 검증을 통과했다. M01O/M03의 외부 동작은 서버 command가 아니며 M06은 provider/consent 계약이 아직 확정되지 않았다.

## PC/mobile reachable handler 대조

### M01 — 외부 앱 열기

PC `contactDial/contactSms/contactKakao/openRelationshipMessage/relationshipChannelHandoff`와 mobile `callContactM/smsContactM/kakaoContactM/rmLaunchM`이 현재 화면에서 호출된다.

- 전화는 `tel:` URI를 연다.
- SMS는 `sms:<number>?body=<encoded>` URI를 연다.
- 카카오는 번호·문구를 Clipboard에 복사한 뒤 Kakao deep-link를 연다.
- 외부 앱의 실제 실행·전송 결과는 브라우저가 증명하지 않는다.
- 현재 최종 override에서 독립 `activity`를 enqueue하는 연락처 버튼은 PC `contactDial`과 mobile `callContactM`이다. 이는 **전화 시도 기록**일 뿐 성공 기록이 아니다.
- 이전에 선언된 PC/mobile SMS·카카오 직접 handler는 최종 composer handler로 덮인다. 따라서 문자/카카오 준비 Activity를 현재 reachable standalone write로 중복 계산하지 않는다.

서버가 외부 앱 open을 성공 ACK로 바꾸거나 전화 시도 Activity를 통화 완료로 해석하면 안 된다. 이 Activity는 `sql/pipeline-action-bundle/20260906`의 named-handler standalone gate로만 연결한다. M02 파생 Activity는 `sql/message-log-compat/20260906`의 named confirm-handler에서 parent에 흡수된 경우만 허용한다.

### M03 — Clipboard 복사

PC `relationshipCopy()`와 mobile `rmCopyM()`은 본문을 Clipboard에 복사하고 실패 시 prompt/toast로 안내한다. `pushWrite` 호출이 없고 launch flag도 발송 결과로 저장하지 않는다. 이 동작은 DB 계약이나 receipt 대상이 아니다.

### M02 — 사용자 확인 발송 결과

최종 override 기준으로 PC `relationshipConfirm()`과 mobile `rmConfirmM()`은 다음 payload를 `message_log`로 보낸다.

```text
opportunity_id, site_id, person_key, channel,
sender, recipient_phone,
template_key, template_title, template_kind, template_grade,
purpose, body, stage_code, message_context,
quote_version_no, quote_attachment_id, attachment_refs,
status, success, next_action_created,
sent_at, failed_at
```

PC/mobile 모두 `status='sent'`는 해당 composer의 `launched=true` 뒤에만 허용한다. 화면 문구도 “앱을 연 것만으로는 발송 이력이 남지 않는다”고 명시한다. 따라서 `sent`의 현재 의미는 **담당자가 외부 앱에서 보냈다고 확인한 상태**이며 provider-confirmed delivery가 아니다. 서버가 이를 delivery로 승격하면 안 된다.

`sent`일 때 UI는 이어서 별도 `activity`와 선택적 `next_action`을 보낸다. failed/cancelled는 `message_log`만 보낸다. 이 세 write는 현재 request ID와 version을 공유하지 않으므로 부분 성공과 중복이 가능하다.

저장 경계 후보는 다음 하나의 transaction이다.

```text
user-confirmed message outcome
  + sent일 때 outbound counter/state
  + sent Activity
  + 선택적 Next Action
  + receipt
  + private audit
```

로컬 후보는 이 경계를 다음처럼 확정했다.

- `crm_security.message_outcomes`는 RLS를 켜고 직접 grant를 제거한 private 원장이다.
- `sent/failed/cancelled`는 모두 `attestation_kind='user_attested'`이며 provider delivery를 뜻하지 않는다.
- `sent`만 non-meaningful Activity와 선택적 replacement Next Action을 같은 transaction에서 만든다.
- 연락처·전화번호·actor·시각은 잠근 Deal과 현재 연락처 관계에서 서버가 확정한다.
- 견적 version은 같은 Deal의 private quote version이어야 하고 첨부는 같은 Deal의 `ready` UUID만 허용한다.
- client `sender/recipient_phone/site/stage/sent_at/failed_at`는 정본으로 받지 않는다.
- 기존 ACK 외형을 유지하면서 version, outcome/activity/next/audit UUID와 user-attested 표지를 보충한다.
- read-back은 기존 `crm_operational_source_v1('message_log',...)`의 actor-scoped projection과 `messageLogs/message_logs` alias를 쓴다.

동의/opt-out 정본과 provider delivery callback은 M02에 포함하지 않는다. 이 후보는 local DB/UI 시험만 통과했으며 Staging에는 적용하지 않았다.

서버 후보가 생길 때도 `sender`, `recipient_phone`, `stage_code`, `sent_at/failed_at`은 client 정본이 아니다. JWT actor, Deal/Contact 관계, 현재 Stage와 서버 시각으로 확정하고 body/template/선택 상태만 사용자 입력으로 취급한다.

### M04 — 담당자 발송 알림 예약

PC `relationshipSchedule()`과 mobile `rmScheduleM()`의 payload는 같은 의미다.

```text
activity:    opportunity_id, type='예약', note, result, occurred_at
next_action: opportunity_id, type='메시지발송', text, due_at,
             scheduled_at, channel, template_key, draft_body
```

화면은 이를 “자동발송이 아닌 담당자 발송 알림”으로 명시한다. 따라서 M06 campaign queue와 합치면 안 된다. Activity와 Next Action은 한 번의 예약 행동이므로 서버에서는 같은 transaction, 같은 receipt/audit에 있어야 한다.

후속 로컬 후보는 기존 Next Action의 “현재 open 교체” 규칙을 그대로 재사용하고 예약 metadata만 private `crm_security.message_reminders`에 분리했다. 기존 open Deal Next Action은 취소 이력으로 남기고, 새 `메시지발송` Action·비접촉 Activity·Deal version·audit/receipt를 한 transaction으로 기록한다. `scheduled_at`의 Asia/Seoul 날짜와 `due_at`이 일치해야 하며 담당자는 현재 Deal owner UUID에서 서버가 확정한다. actor-scoped `deal_core.next_action` read에는 예약 시각·채널·템플릿·초안만 보충한다.

이 후보는 provider 자동발송, 발송 성공, M02 결과 기록 또는 M06 campaign queue를 뜻하지 않는다. Staging에는 적용하지 않았다.

### M05 — 접촉 보류와 회신 cadence

PC `relV8Hold()`과 mobile `relHoldM()`은 Deal의 wake/hold reason을 바꾸고 재접촉 Next Action을 만든 뒤 `relationship_hold`를 별도 전송한다. 실제 Deal에는 `wake_up_at`만 있으므로 hold_until/reason/state는 private event를 정본으로 삼고 read에서 alias를 계산한다.

PC/mobile의 `relationship_response`는 의미 있는 Activity가 만들어진 뒤 wrapper에서 따로 전송된다. M02 private outcome이 생겼으므로 같은 Deal/person에서 Activity 시각 이하인 가장 최근 `sent + response 미기록` outcome 하나를 서버가 잠그고 연결할 수 있다. client `response_at`은 흡수된 Activity의 업무 발생시각으로만 검증하고 actor·저장시각은 서버가 확정한다.

필요한 원자 경계는 두 개다.

1. hold: private hold event + Deal `wake_up_at`/version + open Next 교체 + receipt/audit. 현재 UI가 만들지 않는 Activity는 추가하지 않는다.
2. response: 의미 있는 Activity + 같은 Deal/person의 가장 최근 미응답 user-attested sent outcome 연결 + 그 outcome이 만든 open Next 하나만 취소 + private response event + Deal activity/contact timestamp/version + receipt/audit

현재 UI의 별도 request들을 그대로 연결하면 앞 write만 성공하는 부분 상태가 생기므로 named handler에서 child를 parent에 흡수해야 한다. 회신 때문에 Deal의 다른 업무 Next Action을 일괄 취소하거나 provider delivery를 추론해서는 안 된다. `outbound_attempts`, 최근 outbound/response, active/hold alias는 private outcome/event에서 계산한다.

이 계약과 구현 후보는 `sql/relationship-cadence-compat/20260906`에 고정했다. named PC/mobile wrapper, private RLS event ledger, M02 outcome 연계, actor-scoped read, rollback을 로컬 DB/UI 11건으로 검증했지만 Staging에는 적용하지 않았다. 따라서 `STAGING_COMPAT_PASS`가 아니라 `DERIVED_SAFE_LOCAL_CANDIDATE`다.

### M06 — Campaign queue와 provider callback

PC `campaignQueue()`는 client `cmp-<timestamp>` ID, campaign metadata와 개인화된 recipients를 `campaign_create`로 보낸다. 화면은 queue/scheduled 등록만 성공으로 표시하고 실제 발송 성공은 provider callback으로만 확정한다고 명시한다. Mobile에는 동등한 campaign 생성 화면/handler가 없다.

정상 경계는 다음과 같이 나뉜다.

1. DB transaction: 서버 campaign UUID 생성, 권한 범위의 recipients 재해석, 정규화 번호 중복 제거, consent snapshot, queue rows, receipt/audit
2. commit 이후: 외부 provider 발송
3. callback transaction: provider message ID로 idempotent하게 recipient outcome 기록; 성공 callback에서만 message log/Activity 생성

실제 Staging에는 campaign/recipient/message relation과 provider callback command가 없다. UI가 계산한 recipient, owner, consent, counts, `created_by/created_at`을 서버 정본으로 사용할 수도 없다. 예약 timezone과 실행 직전 재동의/수신거부 검사 규칙도 없다.

**부족 규칙 한 줄:** provider·callback 인증/멱등키, 예약 timezone, 실행 시점 consent 재검사와 campaign read-back 계약이 없다.

## 실제 Staging 스냅샷 대조

정적 정본은 `sql/operational-bundle/20260906/after.json`이다.

- `contacts`: 이름·전화·person key 등은 있으나 `sms_consent`, `kakao_consent`, `consent_at`, `opt_out_at`, `send_blocked`가 없다.
- `deals`: `outbound_channel`, `wake_up_at`, 활동 timestamp는 있으나 message log/cadence/hold reason/outbound counter 필드가 없다.
- `activities`: Deal, server actor 표시값, type, JSON detail, occurred time을 저장할 수 있다.
- `next_actions`: Deal/Inquiry, type/title/due/assignee/status/source Activity를 저장할 수 있지만 reminder channel/template/draft 전용 필드가 없다.
- `crm_message_logs`, `crm_campaigns`, `crm_campaign_recipients` relation이 없다.
- public function 중 message/campaign/relationship command나 read helper가 없다.
- `crm_read_scoped_v2` Deal projection은 Deal의 일부 필드만 반환하고 contacts/activities/next actions/message logs/campaigns를 반환하지 않는다.

따라서 기존 relation의 JSON 필드에 임의로 메시지 상태를 끼워 넣는 것은 기존 UI read 계약을 보존하지 못하고 정본 위치를 새로 설계하는 일이므로 하지 않는다.

## 과거 Golden SQL은 증거일 뿐 후보가 아니다

`20260905_relationship_messaging.sql`, `20260905_contextual_message_composer.sql`, `20260905_campaign_center.sql`은 UI 의도를 설명하지만 실제 Staging 계약과 다음 차이가 있다.

- `can_deal`, JWT Auth UUID/CRM UUID, version conflict가 없다.
- client `sender/created_by/created_at/sent_at/phone/stage`를 그대로 사용한다.
- receipt canonical hash와 같은 request replay/다른 payload 409가 없다.
- private inquiry/deal audit 규칙과 기존 ACK가 없다.
- `SECURITY DEFINER SET search_path=public`이고 service role 중심 ACL이다.
- campaign callback의 공급자 인증과 provider message ID uniqueness가 없다.
- `write_id` conflict에서 기존 row를 update하여 다른 payload 재사용을 거절하지 않는다.

이 파일들을 현 Dispatcher에 그대로 연결하지 않는다.

## ACK·receipt·audit 최소 요구

향후 각 차단 규칙이 확정돼도 브라우저가 호출할 수 있는 endpoint는 public Dispatcher 하나여야 한다.

- `{ok:true, write_id, operation, ...}` ACK와 request correlation을 유지한다.
- 같은 request ID + canonical payload replay는 row/activity/next/audit를 늘리지 않는다.
- 같은 request ID + 다른 payload는 409다.
- client actor/time/status/phone/stage는 권한 또는 시각 정본이 아니다.
- provider delivery callback은 브라우저 message outcome command와 별도 인증 경계다.
- private audit/receipt ACL을 공개하지 않는다.

## 이번 결과

- local candidate operation: `message_log`, `next_action/message_reminder`, standalone `activity`
- contract-only operation: `relationship_hold`, `relationship_response`
- public Dispatcher/frozen functions 변경 0
- M02/M04 candidate SQL/rollback/adapter는 생성했으나 Staging 적용 0
- 테스트는 reachable handler, 외부/서버 경계, 실제 스키마 부재, 과거 SQL의 차이와 M05 계약을 고정한다.

이 문서는 local contract evidence이며 Staging 적용 승인이나 M02/M04/M05/M06 PASS 증거가 아니다. M02·M04·M05는 local candidate일 뿐 `STAGING_COMPAT_PASS`가 아니다.
