# Customer asset A01–A04 — local candidate review

상태: `LOCAL_READ_CANDIDATE / STAGING_CANONICAL_PREFLIGHT_PASS / WRITE_OPS_BLOCKED / STAGING_NOT_APPLIED`

## 2026-09-06 Staging read-only preflight

정확한 대상 `netform-crm-staging / rprechiaglyjaydkmxsu`에서 catalog만 읽었다. `crm_contacts_scoped_v2(uuid)`의 live OID는 `18065`이고 owner/ACL/config/실행 속성은 예상과 같다. 원문 definition MD5는 CRLF 때문에 달랐지만 LF 정규화 후 함수는 `1a58be86503cb53bdc3a9a784eb4add2`, `can_deal(uuid,boolean)`은 `05d51a3c77344504a05a0e932cfcb15d`로 로컬 기준과 정확히 일치했다. 본문 `prosrc` LF 해시도 각각 일치하므로 실제 schema/function drift가 아니라 줄바꿈 직렬화 차이로 확정했다. 적용은 하지 않았다. DDL/DML, Production, n8n 요청은 0이다. 증거는 `staging-preflight.json`과 `docs/operational-cutover-20260906/staging-function-canonical-compare.json`에 고정했다.

Write 세 op도 aggregate/catalog만 다시 확인했다. consent/relationship 전용 column·relation은 없고, 현재 `custom_fields` key는 synthetic fixture 표식뿐이다. 한 Site에 Deal이 여러 개인 경우가 실제 1개이며 `contact_assignments.opportunity_id`에는 FK가 없다. 따라서 A01–A03의 아래 blocker는 추정이 아니라 현재 Staging에서도 재확인됐다. 증거는 `docs/operational-cutover-20260906/staging-customer-asset-write-preflight-20260906.json`에 고정했다.

## 판정

| 항목 | 판정 | 근거와 부족한 규칙 한 줄 |
|---|---|---|
| A01 `contact_upsert` | `NEEDS_VERIFICATION / BLOCKED` | PC/mobile 현재 payload는 연락처·근무시작뿐 아니라 `sms_consent`, `kakao_consent`, `consent_at`, `opt_out_at`, `send_blocked`, `send_blocked_reason`을 함께 보낸다. 실제 Staging `contacts/contact_assignments`에는 동의 컬럼이 없고 `custom_fields`를 동의 정본으로 쓴다는 승인도 없다. **부족 규칙:** UUID person 식별 및 채널별 동의/철회 이력의 서버 정본을 확정해야 한다. |
| A02 `contact_relationship` | `NEEDS_VERIFICATION / BLOCKED` | UI는 동일 person의 Deal별 `decision_role/relationship_tone`을 저장하지만 실제 Staging에는 두 컬럼도 contact-opportunity 관계 table도 없다. 과거 Golden SQL은 값을 `contacts` 전역 컬럼으로 두므로 “동일 사람·다른 현장 분리” 계약과 충돌한다. **부족 규칙:** `(deal_id, contact_id)` 관계 저장소와 이력 규칙이 필요하다. |
| A03 `contact_move` | `NEEDS_VERIFICATION / BLOCKED` | 실제 `contact_assignments`는 기간 이력을 담을 수 있으나 UI 목적지는 `to_site` 문자열뿐이다. 같은 Site의 여러 Opportunity 중 목적 Deal을 유일하게 정할 수 없고, 현재 service-role 함수도 이름 기반 첫 Deal을 고른다. **부족 규칙:** `to_site_id`와 선택적 `to_opportunity_id` 또는 “Site-only assignment” 규칙이 필요하다. |
| A04 Deal 연락처/근무이력 read | `DERIVED_SAFE_LOCAL_READ` | 기존 `crm_contacts_scoped_v2(uuid)`의 `can_deal` gate와 ACL을 그대로 유지하면서 해당 Deal에 직접 연결된 연락처와 권한이 있는 assignment 자식만 투영할 수 있다. |
| A04 Site 1:N 전체 timeline | `NEEDS_VERIFICATION / BLOCKED` | 현재 read signature는 Deal 기준이고 Site 기준 권한 함수가 없다. **부족 규칙:** Site 접근은 “하나라도 접근 가능한 Deal”인지, 자식별 `can_deal/can_inquiry` 필터인지 확정해야 한다. |

## Golden reachable payload

`contact_upsert` 최신 PC/mobile 공통 형태:

```json
{
  "opportunity_id":"uuid", "person_key":"mobile:01012345678", "site_name":"현장",
  "office_phone":"02-000-0000", "office_email":"office@example.com",
  "manager_name":"홍길동", "manager_mobile":"010-1234-5678", "manager_role":"관리소장",
  "is_primary":true, "started_at":"ISO",
  "sms_consent":true, "kakao_consent":false, "consent_at":"ISO",
  "opt_out_at":null, "send_blocked":false, "send_blocked_reason":null
}
```

`contact_relationship`은 PC/mobile 모두 `{opportunity_id,person_key,decision_role,relationship_tone}`다.

`contact_move`는 PC/mobile 모두 `{opportunity_id,person_key,manager_name,manager_mobile,from_site,to_site,to_office_phone,moved_at,reason}`다. 목적 Site/Deal UUID는 없다.

## 실제 Staging snapshot

정본은 `sql/inquiry-direct-assign/20260906/after.json`이다.

- `contacts`: UUID PK, optional organization FK, unique `person_key`, name/title/phone/mobile/role/current_site, `emails`, `custom_fields`.
- `contact_assignments`: UUID PK, `person_key` FK, optional `opportunity_id`(FK 없음), site/office phone, started/ended/status/reason. Open unique key는 `(person_key,site_name) WHERE ended_at IS NULL`이다.
- `deals`: contact/organization/site UUID FK와 대표 연락처 호환 필드가 있다.
- `crm_contact_upsert(jsonb)` 및 `crm_contact_move(jsonb)`는 `service_role` 전용이지만 actor/scope/version/receipt/audit가 없어서 Compatibility Dispatcher 정본으로 직접 재사용하지 않는다.
- `crm_site_contacts(uuid)`는 `PUBLIC/anon` 실행 가능하고 `can_deal` 검사가 없으며 한 건일 때 빈 배열을 반환한다. 새 경로에서 호출하지 않는다.
- `crm_contacts_scoped_v2(uuid)`는 authenticated 전용이고 `can_deal`을 검사하지만 현재 `deals.contact_id` 한 건의 id/name/phone/mobile만 반환한다.

## 최소 read 후보

`candidate.sql`은 기존 `crm_contacts_scoped_v2(uuid)`만 `CREATE OR REPLACE`한다.

- 함수 signature, OID, owner, `SECURITY DEFINER`, empty `search_path`, authenticated-only ACL을 유지한다.
- 최상위 Deal에 `can_deal(id,false)`를 그대로 적용한다.
- 연락처는 `deals.contact_id` 또는 `contact_assignments.opportunity_id = deal.id`로 직접 연결된 것만 반환한다. 같은 organization/Site라는 이유만으로 다른 Opportunity 연락처를 섞지 않는다.
- 이력은 같은 person 중 `opportunity_id`가 있고 현재 actor에게 `can_deal`인 assignment만 반환한다. scope를 증명할 수 없는 NULL/text-only assignment는 제외한다.
- UI가 즉시 쓰는 id/person/name/role/phone/mobile/current site/office phone/start/end/status와 근무이력만 반환한다. raw `custom_fields`, emails, 동의 추정값, 관계 추정값은 투영하지 않는다.

Public write Dispatcher와 frozen delegate는 바꾸지 않으며 `connected_operations=[]`이다.

`preflight.sql`은 읽기 전용 transaction에서 실제 live OID와 원문/LF 정규화 definition/config/ACL을 캡처한다. 숫자 OID는 추정하지 않는다. 적용 SQL은 LF 정규화된 baseline과 현재 OID를 검증하고 transaction-local setting에 보존한 뒤 `CREATE OR REPLACE` 전후 동일성을 강제한다.

PC/mobile projection 호환은 `adapter-contract.js`의 `projectDeal()`과 `timelineFor()`로 고정했다. RPC 배열은 기존 Deal의 `contacts`에 주입하면 PC `siteContacts()`와 mobile `siteContactsM()`이 읽는 snake_case 필드를 그대로 제공한다. `assignment_history`는 `{site_name,office_phone,started_at,ended_at,status}`에서 두 UI가 사용하는 `{site,officeTel,from,to,status}` timeline으로만 정규화한다. UI 자체는 이번 후보에서 수정하지 않는다.

## Rollback

Rollback은 candidate definition MD5가 정확히 일치할 때만 실행되며 `crm_contacts_scoped_v2(uuid)`의 실제 Staging 이전 정의와 exact OID/owner/language/volatility/strict/parallel/leakproof/ACL/config을 복원·재검증한다. 이 후보는 DML, receipt, audit 또는 업무 데이터를 만들지 않는다. 적용 전 절차는 `staging-apply-checklist.md`를 따른다.
