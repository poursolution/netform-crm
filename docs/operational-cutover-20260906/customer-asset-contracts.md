# 고객자산 reachable 계약 판정 — 2026-09-06

상태: `ANALYSIS_ONLY / STAGING_READ_ONLY_RECONFIRMED / NO_REMOTE_CHANGE / NO_WRITE_CANDIDATE`

범위는 현재 UI에서 실제 도달 가능한 `contact_upsert`, `contact_relationship`, `contact_move` 세 업무다. 판정 근거는 현재 `crm.html`/`mobile.html`, `dead-overrides.csv`, 기존 SQL, 그리고 `sql/inquiry-direct-assign/20260906/after.json`에 기록된 실제 Staging 메타데이터다.

## 요약

| op | 실제 reachable 화면 | 판정 | 현재 n8n 제거 가능 여부 |
|---|---|---|---|
| `contact_upsert` | PC 연락처 설정·기본 관리소장 폼, 모바일 최종 연락처 폼 | `NEEDS_VERIFICATION` | 불가 |
| `contact_relationship` | PC 연락처 저장 후 관계 저장, 모바일 고객 관계도 | `NEEDS_VERIFICATION` | 불가 |
| `contact_move` | PC 관리소장 근무지 이동 | `NEEDS_VERIFICATION` | 불가 |

현재 실제 스키마와 read 계약만으로 UI 부수효과를 모두 보존할 수 있는 op가 없으므로 local candidate SQL은 만들지 않았다. 일부 필드만 저장하는 partial adapter도 만들지 않는다.

2026-09-06 Staging read-only 재확인에서도 이 판정은 유지됐다. Contact 5건의 `custom_fields` key는 전부 synthetic fixture 표식뿐이며 동의/수신거부 관례가 없고, consent/relationship 전용 column·relation은 0개다. Assignment 4건은 모두 Deal UUID를 가지고 orphan은 없지만 `opportunity_id` FK는 없고, 실제로 한 Site에 Deal이 여러 개인 경우가 1개 존재한다. 따라서 `to_site` 이름만으로 목적 Deal을 고르는 A03도 안전하게 승격할 수 없다. 상세 aggregate/ACL 증거는 `staging-customer-asset-write-preflight-20260906.json`에 기록했다.

## 1. `contact_upsert`

판정: `NEEDS_VERIFICATION`

### Reachable UI 계약

- PC 최종 `saveQuickContact()`는 `opportunity_id`, 새 `person_key`, 현장명, 대표전화, 이메일, 이름, 휴대폰, 역할, 대표 여부, 재직 시작일과 함께 문자·카카오 동의, 동의시각, 수신거부시각, 발송차단 및 차단사유를 한 payload로 보낸다 (`crm.html:7459-7465`).
- PC 기본 관리소장 폼도 같은 op를 사용하며 기존 메시지 동의 상태를 유지해 다시 보낸다 (`crm.html:7467-7469`).
- 모바일에서 실제 효력이 있는 후대 override도 같은 연락처·동의 필드를 보낸다 (`mobile.html:2299`). `mobile.html:1499,1506`의 옛 정의는 shadow되어 `D04`로 제외돼 있다.
- PC 관계 확장 화면에서는 연락처 저장 성공 직후 별도 `contact_relationship`을 이어서 보낸다. 현재 두 write 사이 원자성은 없다 (`crm.html:7550-7553`).

### 실제 Staging과의 충돌

- `public.contacts`에는 `emails jsonb`, `custom_fields jsonb`, `person_key`, `mobile`, `role`, `current_site`가 있지만 `office_email`, `sms_consent`, `kakao_consent`, `consent_at`, `opt_out_at`, `send_blocked`, `send_blocked_reason` 전용 컬럼은 없다.
- 현행 `crm_contact_upsert(jsonb)`는 이름·전화·역할·현장, `contact_assignments`, 대표 연락처의 Deal legacy 필드만 갱신한다. UI가 보낸 수신동의·수신거부 필드는 전부 무시하며, 비대표 연락처 이메일도 `contacts.emails`에 저장하지 않는다.
- 연락처 수정 중 휴대폰이 바뀌면 UI는 새 `person_key=mobile:<new number>`만 보낸다. 로컬 UI는 `oldKey`로 기존 배열을 바꾸지만 transport payload에는 기존 contact UUID/old key가 없어 서버는 같은 사람 수정인지 새 사람 추가인지 판별할 수 없다.
- `crm_contacts_scoped_v2(uuid)`는 Deal의 단일 `contact_id`에 연결된 `id/name/phone/mobile`만 반환한다. 실제 UI가 요구하는 다중 연락처, 역할, 대표전화, 이메일, 동의·거부, 재직기간을 새로고침 후 복원하지 못한다.
- 현행 write RPC는 service-role 전용 n8n 후보이고 공통 request receipt, server actor audit, `{ok,write_id,operation}` ACK 계약이 없다.

부족한 규칙 한 줄: **휴대폰 변경에도 유지되는 contact UUID/이전 key를 payload에 포함할지와 `emails`·동의·거부 정보를 실제 어느 정본 구조에 저장할지 확정해야 한다.**

## 2. `contact_relationship`

판정: `NEEDS_VERIFICATION`

### Reachable UI 계약

- PC는 연락처 저장 뒤 `{opportunity_id, person_key, decision_role, relationship_tone}`을 보낸다 (`crm.html:7553`).
- 모바일 관계도는 같은 네 필드를 보낸다 (`mobile.html:2394`).
- UI 선택값은 의사결정자·핵심담당자·실무자·영향자·정보제공자와 우호적·중립·부정적·미확인이다.

### 실제 Staging과의 충돌

- 실제 `public.contacts`에는 `decision_role`, `relationship_tone`, `influence_level` 컬럼이 없다. 실제 함수 목록에도 `crm_contact_relationship_upsert(jsonb)`가 없다.
- 과거 `20260905_sales_execution_engine.sql`은 이 값을 `contacts` 행에 저장해 동일 사람의 모든 현장·Opportunity에 전역 적용한다.
- 반면 현재 UI payload에는 `opportunity_id`가 있으며 Coverage 기준도 “동일 사람·다른 현장 분리”를 요구한다. Contact 전역 속성인지 `deal/contact` 관계 속성인지 서로 충돌한다.
- 현재 strict read는 관계값과 다중 연락처를 반환하지 않아 새로고침 검증도 불가능하다.

부족한 규칙 한 줄: **의사결정 역할과 관계 톤을 사람 전역값으로 볼지, `opportunity/site + contact`별 관계값으로 볼지 먼저 확정하고 그 의미를 보존하는 실제 저장 위치가 필요하다.**

## 3. `contact_move`

판정: `NEEDS_VERIFICATION`

### Reachable UI 계약

- 현재 살아 있는 호출은 PC `saveManagerMove()` 한 곳이다 (`crm.html:4614-4619`).
- payload는 `opportunity_id`, `person_key`, 표시용 이름·휴대폰·출발 현장, 새 현장, 새 대표전화, 이동일, 필수 사유다.
- UI는 기존 근무이력을 종료하고 새 현장 근무이력을 시작하며, 원래 Deal은 `moved` 상태로 남긴다. 같은 이름의 대상 Deal이 있고 대표 연락처가 비어 있으면 그 Deal에도 현재 연락처를 표시한다.
- 모바일의 옛 이동 함수는 최종 연락처 카드에서 진입할 버튼이 없어 `D05` dead 경로로 제외한다.

### 실제 Staging에서 확인된 부분

- `contact_assignments`의 `person_key`, `opportunity_id`, `site_name`, `office_phone`, `started_at`, `ended_at`, `status`, `reason`은 과거·현재 근무이력을 보존할 수 있다.
- `contacts.current_site`와 Deal의 `manager_current_site`, `manager_status`, `manager_left_at`도 UI의 요약 상태를 담을 수 있다.
- 따라서 “기존 assignment 종료 + 새 assignment 생성 + 사람 current_site 변경”이라는 핵심 의미 자체는 일관된다.

### 아직 안전하지 않은 이유

- 현행 `crm_contact_move(jsonb)`는 client `manager_name`, `manager_mobile`, `from_site`, `moved_at`을 그대로 신뢰하고 reason·미래 날짜·현재 assignment 소속·actor 권한을 충분히 검증하지 않는다.
- 대상 현장을 이름으로 찾아 최신 Deal 한 건을 임의 선택한다. 같은 Site의 여러 Deal 또는 동일 정규화 이름이 있을 때 어떤 객체에 귀속할지 정본이 없다.
- `crm_site_contacts(uuid)`는 active `contact_assignments`가 아니라 Contact의 기존 `organization_id`를 기준으로 사람을 고른다. 이동 함수는 `organization_id`를 바꾸지 않으므로 새로고침 뒤 원래 현장과 새 현장 목록이 UI의 이동 결과와 달라질 수 있다.
- `contact_assignments.opportunity_id`에는 실제 FK가 없고, 공통 receipt/audit/ACK도 없다. 이 상태에서 기존 함수를 authenticated에 노출하거나 wrapper로 재사용하지 않는다.

부족한 규칙 한 줄: **동일 현장에 여러 Deal이 있을 때 새 assignment의 정본 대상과, 이동 후 연락처 조회를 `organization_id`가 아닌 어느 site/assignment 기준으로 양쪽 현장에 노출할지 확정해야 한다.**

## 공통 cutover 조건

세 op를 구현하기 전에 다음이 모두 필요하다.

1. `crm_write_command_v2`의 이미 PASS된 공종·`direct_assign` 분기를 변경하지 않는 별도 확장 방식
2. 서버가 Deal 권한, Contact/assignment 소속, 현재 값을 다시 읽는 UUID 기반 권한검사
3. client actor/시각/출발 현장·현재 상태를 감사 정본으로 사용하지 않는 처리
4. 기존 `command_receipts`, 적절한 private deal/contact audit, `{ok:true, write_id, operation}` ACK 재사용
5. PC/모바일이 요구하는 다중 연락처·동의·관계·근무이력을 모두 반환하는 scoped read 계약
6. 동일 request replay 중복 0, payload 재사용 409, 타 Deal/Contact 거절, 새로고침 동일성에 대한 local DB 및 Staging JWT 검증

Production, n8n, 운영 Pages 접근과 Staging DDL/DML은 수행하지 않았다. Staging 접근은 위 aggregate/catalog read-only preflight뿐이다.
