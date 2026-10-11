# 명함 입력의 공통 저장 계약 점검 및 Claude 화면 연결 인수인계

작성일: 2026-10-11. 대상은 영업운영 CRM `poursolution/netform-crm`이다.

> 후속 구현: 생략한 동의·거부 값 보존에 한해 [공통 저장 보존 보고](MOBILE_CONTACT_CONSENT_PRESERVATION_20261011.md)의 로컬 후보를 추가했다. 아래는 운영 카탈로그·기존 코드 점검 기록이며, 현재 후보의 변경 범위는 후속 보고를 우선한다. 회사·동일인·현장 연결은 미결정/미구현 상태를 유지한다. 운영 적용은 하지 않았다.

## 1. 이번 확인의 범위와 결론

승인된 모바일 I-3 화면은 유지한다. 명함에서 읽은 후보를 확인·수정하는 기능과 기존 사람·현장에 저장하는 기능을 구분한다. 현재 후보의 연락처 저장은 계속 차단한다.

초기 조사는 로컬 소스와 보관된 스키마를 대조했고, 이후 Supabase 도구로 **운영 PostgreSQL의 함수 정의·열·인덱스만 읽어 확인**했다. 고객 행 조회, 업무 저장 함수 실행, SQL 설치, 데이터 변경, 공개 업로드는 하지 않았다. 실제 담당자 계정의 저장 성공을 검증했다는 뜻은 아니다.

운영 확인 결과는 아래 2-3절과 `review-preview/contact-live-catalog-20261011.json`이 우선한다. 9/8 마이그레이션과 어댑터의 차이는 저장소 안의 잠재적인 호환성 문제이며 현재 운영 장애로 확정하지 않는다.

확인한 기준:

- 최신 확인 로컬 master: PR #596 병합본 `ad209245d50bdc46569b9533fdcf3b601936f679`.
- 기존 후보의 기본 소스: `7ba66adfb11d048a2061bd0a3a4a4bf8352873a4`.
- master 대조 기록: 후보 루트의 `master-596-comparison.json`.
- 스키마 근거: master 안의 `sql/baseline/20260905/source-metadata.json`과 이후 SQL·마이그레이션. 이 metadata는 **2026-09-05 보관본**이며 현재 운영 카탈로그가 아니다.
- 로컬 master 경로: `outputs/mobile-handoff-20261011/netform-crm-ad209245d50bdc46569b9533fdcf3b601936f679/`.
- 모바일 후보 경로: `outputs/mobile-guide42-implementation/`.

현재 공통 어댑터와 저장 SQL 사이에 서로 다른 계약이 남아 있다. 명시적인 연락처 ID로 기존 사람을 재사용하고, 여러 현장·영업건을 연결하며, 생략한 동의 값을 보존하는 저장 의미도 현재 계약에 없다. **이 문서는 새 함수명·스키마·저장 payload를 확정하지 않는다.** 아래의 현재 사실과 합의가 필요한 요구를 분리해서 검토한다.

## 2. 코드로 확인한 현재 경로

### 2-1. PC·모바일 공통 저장 경로

PC `saveQuickContact` / `pcSetPrimaryContact` → `pushWrite('contact_upsert', payload)` → `Phase1.queue` → `OperationalAdapter.normalize` → `crm_write_command_v2` → `OperationalAdapter.validateAck` 순서다.

| 근거 파일·줄 | 확인한 내용 |
| --- | --- |
| `pc-primary-contact.js:57`, `:81` | 대표 지정과 연락처 저장은 공통 `contact_upsert`를 사용한다. 서버 ACK 전에는 완료로 확정하지 않는다. |
| `operational-overlay.js:57` | 연락처 저장은 현재 영업건 버전과 요청 UUID를 사용해 공통 큐에 넣는다. |
| `operational-adapter.js:85` | `contact_id`, `company`, 연결 전용 intent는 허용하지 않는다. `person_key`는 `mobile:` + 010 휴대폰으로 강제한다. `site_id`는 항상 정규화 결과에 들어간다(null 포함). |
| `operational-adapter.js:89` | ACK의 연락처 UUID, person_key, 요청 당시 버전, 증가한 버전, 감사 이벤트 UUID, 서버 시각을 검사한다. |

어댑터의 허용 payload 키는 다음과 같다.

`opportunity_id`, `site_id`, `person_key`, `site_name`, `office_phone`, `office_email`, `manager_name`, `manager_mobile`, `manager_role`, `is_primary`, `started_at`, `sms_consent`, `kakao_consent`, `consent_at`, `opt_out_at`, `send_blocked`, `send_blocked_reason`.

합성 정규화 실행으로 다음을 재확인했다. 운영 요청은 보내지 않았다.

- `contact_id`, `company`, `intent:'link_existing'` 추가는 `INVALID_CONTACT_PAYLOAD`로 거절된다.
- `contact:<UUID>`와 `inquiry:<UUID>` person_key는 `INVALID_CONTACT_CONSENT`로 거절된다.
- 동의 값을 생략하면 `sms_consent:false`, `kakao_consent:false`, `send_blocked:false`, `consent_at:null` 등이 만들어진다. 생략한 값을 유지하는 PATCH 계약이 아니다.

### 2-2. 서로 다른 서버 저장 정의

| 항목 | 9/7 go 정의 | 9/8 SMS 마이그레이션 정의 |
| --- | --- | --- |
| 공통 진입점 | `crm_write_command_v2` | 같은 이름의 후속 wrapper |
| 내부 처리 | `crm_security.crm_operational_go_command_v1` | `crm_security.crm_contact_upsert_command_v1` |
| 버전 | 영업건 `expected_version` 검사·증가 | `expected_version=0`만 허용, 영업건 버전 증가 없음 |
| 사람 찾기 | 전역 `contacts.person_key` 조회 | 전역 person_key 충돌로 upsert |
| `site_id` | 공통 어댑터는 보냄; 해당 분기에서는 활용하지 않음 | payload 허용 목록에 없어 거절 |
| 동의 보관 | `crm_security.contact_compat_state(contact_id, deal_id)` | 전역 `public.contacts`의 동의·차단 필드 |
| ACK | `previous_version`, `version`, `audit_event_id` 포함 | 세 필드 없음; 동의 boolean 포함 |
| 기본 원칙 | 요청 UUID receipt, 현재 영업건 권한 검사 | 요청 UUID receipt, 현재 영업건 권한 검사 |

근거:

- `sql/operational-go-candidate/20260907/staging-apply.sql:126` 함수, `:186` 권한·버전, `:203` 사람 조회, `:218` 동의, `:248` ACK, `:268` 공통 wrapper.
- 같은 정의가 `sql/production-cutover/20260907/production-cumulative-31-op.sql:6257` 이후에 포함된다.
- `supabase/migrations/20260908170000_sms_campaign_queue.sql:116` 함수, `:149` 허용 키, `:175` 전화번호 기반 식별, `:197` canonical payload, `:215` 연락처 저장, `:231` 연결 저장, `:244` ACK, `:524` 공통 wrapper.

**판단:** 9/8 정의가 실제 적용됐다면 현재 어댑터의 payload·버전·ACK와 맞지 않는다. 소스 파일이 존재하는 것만으로 운영에 적용됐다고 단정하지 않는다. 운영 적용 정의를 먼저 확인하고 PC와 모바일이 같은 계약을 사용하게 정리해야 한다. 모바일에서만 `site_id`나 버전 검사를 빼서 우회하지 않는다.

### 2-3. 실제 운영 정의 확인 결과

프로젝트 `ymfbmpnizxvqsamnczow`의 카탈로그를 읽어 다음 경로를 확인했다.

`public.crm_write_command_v2` → `crm_security.crm_write_command_v2_pre_aligo_20260919` → `crm_write_command_v2_pre_relationship_contact_20260913` → `crm_write_command_v2_pre_store_handoff_20260908` → `crm_write_command_v2_pre_expansion_convert_20260907` → `crm_operational_go_command_v1`.

- `contact_upsert`는 **9/7 go 계약**으로 분기한다. `crm_contact_upsert_command_v1`은 해당 스키마에 존재하지 않았다.
- 현재 함수는 영업건 권한·버전을 검사하고, person_key로 기존 사람을 찾아 이름·역할·현재 소속을 갱신한다.
- 동의는 현재 `crm_security.contact_compat_state(contact_id, deal_id)`에 저장하며, 생략한 동의/거부 값도 false/null로 교체하는 코드가 남아 있다. 전역 동의를 덮는 9/8 경로는 현재 운영 경로가 아니다.
- 운영의 `contacts`와 `contact_assignments`에도 `site_id`·회사 전용 열이 없고, 열린 연결 고유키는 실제로 `(person_key, site_name)`이었다. `site_contacts` 열 조회 결과도 없었다.
- 정의 해시: 공통 wrapper `7598f1d798052c4f061188d9eb3a2f9e`, 실제 처리 함수 `a0209794d0844913f287bd9da509e3e1`, scoped 조회 `7e811c93e73ba945a0dfea164da55fcd`.

따라서 **적용 경로의 불확실성은 해소**했다. 남은 문제는 기존 사람 명시 선택, 기존 값 보존, 회사 귀속, UUID 기반 복수 연결의 저장 의미다. 현장명 고유키 충돌 가능성과 동의 보존 위험은 현재 설치 코드에서도 확인되지만, 고객 데이터를 수정하는 재현은 하지 않았다.

## 3. 현재 사람·현장·동의 모델과 제약

| 대상 | 보관 스키마·후속 코드에서 확인한 구조 |
| --- | --- |
| `public.contacts` | `id` UUID PK, nullable `person_key` UNIQUE, `organization_id` FK, `name/title/phone/mobile/role`, `emails` JSONB, `custom_fields` JSONB, `current_site` text, 생성·수정 시각 |
| person_key 이관값 | 유일한 번호는 `mobile:…`, 중복·번호 부족은 `contact:<UUID>`, 문의 이관은 `inquiry:<UUID>`도 사용한다. 따라서 현재 모든 연락처가 mobile 키라는 전제는 틀리다. |
| `public.contact_assignments` | UUID `id` PK, `person_key` NOT NULL FK → contacts(person_key), nullable `opportunity_id` UUID, `site_name` NOT NULL, `office_phone`, 시작·종료일, 상태·사유 |
| 활성 연결 고유키 | `contact_assign_open`: `(person_key, site_name) WHERE ended_at IS NULL` |
| site ID | 보관된 `contacts`와 `contact_assignments`에는 `site_id`가 없다. 조사한 후속 SQL에서도 추가 정의를 찾지 못했다. |
| `site_contacts` | 이 이름의 테이블 정의를 찾지 못했다. `crm_site_contacts(uuid)`라는 과거 조회 함수와 혼동하면 안 된다. |
| 9/7 동의 | `contact_compat_state` PK `(contact_id, deal_id)`, sms/kakao 동의·확인 시각·거부 시각·차단 사유 등 |
| 9/8 동의 | contacts에 sms/kakao 동의·consent_at·consent_source·opt_out_at·차단 필드를 추가한다. 동의 true이면 확인시각이 있고 차단/거부가 없어야 한다. |

근거:

- `sql/baseline/20260905/source-metadata.json:4164` 활성 연결 UNIQUE, `:4184` person_key UNIQUE, `:5737` assignment의 person_key FK, `:5755` organization FK. 이 metadata에는 assignment의 opportunity_id FK가 없다.
- `sql/20260904_contact_server_integration.sql:19` contact 키, `:160` inquiry 키, `:189` 과거 조회, `:207` 과거 저장 함수.
- `sql/operational-go-candidate/20260907/staging-apply.sql:77` 현장별 호환 동의 테이블.
- `supabase/migrations/20260908170000_sms_campaign_queue.sql:24` 전역 동의 열, `:34` 동의 CHECK.

현재 사람 정보 저장은 기존 사람의 이름·역할·휴대폰뿐 아니라 `organization_id/current_site`도 변경한다. 9/8 경로는 동일 person_key의 동의·차단 상태도 전부 교체한다. 명함을 읽었다는 이유로 기존 수신거부를 해제하거나 소속을 다른 현장으로 이동시키면 안 된다.

같은 사람·같은 현장명에 영업건이 둘이면 활성 연결 고유키가 충돌한다. 9/7 분기는 다른 영업건 연결 행을 추가하려다 UNIQUE 충돌이 날 수 있고, 9/8 분기는 기존 행의 `opportunity_id`를 새 영업건으로 교체한다. 서로 다른 현장이 같은 이름을 쓰는 경우에도 구분이 부족하다. 이 동작을 안전한 복수 현장·영업건 연결 완료로 표현하지 않는다.

### 현재 재사용 가능한 조회

`crm_contacts_scoped_v2(p_opportunity_id uuid)`는 `can_deal(..., false)`를 확인한다. 영업건의 contact_id 또는 contact_assignments를 통해 연락처 UUID·person_key·기본 정보·해당 영업건의 현장 정보와 접근 가능한 assignment_history를 반환한다.

- 근거: `sql/production-cutover/20260907/production-cumulative-31-op.sql:3525`.
- 여기서 반환하는 `site_id`는 `contacts.site_id`가 아니라 현재 조회 대상 `deals.site_id`다.
- 이 조회에는 최신 동의 전체·연락처 수정 버전·전체 회사 귀속 정보가 보장되지 않는다.
- 9/8 `crm_operational_source_v1`의 `deal_core` projection은 전역 연락처 동의를 포함한다(`supabase/migrations/20260908170000_sms_campaign_queue.sql:593`). 현재 운영의 실제 조회 반환 규격과 적용 경로는 별도 확인해야 한다.
- 과거 `crm_site_contacts(uuid)`는 9/19 차단 마이그레이션에서 PUBLIC/anon/authenticated 실행 권한을 회수한다. 새 모바일 조회 경로로 복구하지 않는다(`supabase/migrations/20260919105045_contain_legacy_client_access.sql:26`).

## 4. 합의·구현 확인이 필요한 최소 저장 요구

아래는 공통 계약의 **구현 요구와 미결정 사항**이며 새 API 이름이나 열을 결정한 목록이 아니다. 공통 기능·저장 계약의 구현과 검증은 Codex가 맡는다. Claude에는 승인 화면에 없는 동일인 선택 조작이 필요한 경우 그 데이터·판정 조건을 전달한다.

| 주제 | 최소 요구 |
| --- | --- |
| 신규 사람 / 기존 사람 재사용 | 선택한 연락처 UUID를 서버가 검증할 수 있어야 한다. 번호 일치만으로 사람을 자동 병합하거나 신규 생성하지 않는다. 기존 이관 person_key와 contact ID를 유지한다. |
| 번호 수정 | 번호 변경과 사람 변경을 구분한다. 전화번호 기반 키를 새로 만들어 기존 이력과 별개 사람이 되지 않도록 공통 규칙을 정한다. |
| 회사 귀속 | I-3의 ‘회사’가 고객 회사/관리회사/현장 조직 중 무엇인지, 어느 공통 엔티티에 저장되는지 확인한다. `site_name`, `current_site`, `organization_id`에 임의로 대입하지 않는다. |
| 기존 사람 연결 | 현장에 연결만 할 때 이름·역할·소속·동의를 다시 쓰지 않는다. 선택한 사람의 조회권한과 대상 영업건의 쓰기권한을 각각 검증한다. |
| 복수 현장 / 복수 영업건 | 현장 UUID와 영업건 UUID를 구분한다. 같은 현장 다른 공종·연도 영업건에 연결해도 기존 연결을 옮기거나 종료하지 않는다. 동명 현장도 구분한다. |
| 대표 연락처 | 명함 역할이 관리소장이라는 이유만으로 기존 대표를 자동 교체하지 않는다. PC와 같은 명시적 대표 지정 의도를 적용한다. |
| 동의·수신거부 | 생략은 보존이다. OCR은 동의의 근거가 아니다. 기존 true/false/거부 시각/차단 사유를 전체 덮어쓰지 않는다. 동의의 전역·현장별 적용 범위도 한 가지 공통 기준으로 정한다. |
| 변경 충돌 | 영업건 버전만으로 다른 현장에서 수정한 동일 연락처를 보호할 수 없다. 사람 정보 및 연결의 변경 충돌을 서버가 감지할 근거를 공통 계약에 정한다. |
| ACK | 저장한 contact ID, 기존 사람 재사용/신규 생성 여부, 실제 현장·영업건 연결, 대표 변경 여부, 보존·변경한 필드, 동의 결과를 검증할 수 있어야 한다. 현재 큐의 요청/계정/대상 검증·재생 표시는 유지한다. |
| 재시도 | 동일 요청 ID·동일 의미의 payload를 재전송하면 같은 결과를 돌려준다. 서버 성공 후 응답 유실 시 중복 사람·연결을 만들지 않는다. payload 변경 시 같은 ID 재사용은 거절한다. |
| 예외·중단 | 권한 변경, 계정 전환, 연락처 삭제/병합, 영업건 변경은 자동 재시도로 덮어쓰지 않는다. 실패 시 사용자가 수정한 입력을 보존한다. |

9/8 경로는 `started_at`이 없으면 `current_date`를 canonical payload에 넣고 나서 기존 receipt와 비교한다(`:166`, `:197`, `:204`). 날짜를 넘겨 같은 요청을 재시도할 때 canonical 값이 달라져 REQUEST_ID_REUSE가 날 가능성이 있다. **코드로 추론한 위험이며 운영 재현은 하지 않았다.** 재시도 계약 정리 시 기본값을 처음 처리한 의미대로 보존하는지도 검사한다.

## 5. 모바일 I-3의 유지 범위

- 승인된 Claude I-3 원본의 위치·배치·색·크기·필드 구성은 유지한다. 별도 연락처 화면·모달·선택 목록을 임의 추가하지 않는다.
- 기존 사람 선택 또는 회사 귀속 확인에 승인 원본에 없는 조작이 필요하면 필요한 데이터와 선택 조건만 Claude에 전달한다. Codex가 새 UI를 정하지 않는다.
- 모바일 전용 계산·사람 식별·중복 판정·동의 기본값·직접 테이블 저장·별도 연락처 저장 API를 만들지 않는다. PC와 같은 공통 계약을 사용한다.
- 명함 OCR은 기존 `crm-ai`의 `kind:'contact_card'`로 후보만 반환한다. 이미지/인식 결과를 DB·Storage·제안 캐시에 저장하지 않는 기존 분기를 유지한다. 일반 `memo_tidy` 저장과 혼동하지 않는다.
- 현재 OCR 응답에는 name/role/mobile/office/email/note만 있으며 회사와 필드별 confidence, 확인된 contact ID는 없다. 회사는 미확인으로 남긴다.
- 현재 로컬 후보는 수동 수정값 보존, 취소·오래된 선택창 차단, 계정·현장 변경 차단, 실패 복구 및 임시 초안 보관을 갖춘다. 저장 계약이 미확정이므로 연락처 `canSave:false`를 유지한다.

근거: master `supabase/functions/crm-ai/handler.mjs:46`, `:55`, `supabase/functions/crm-ai/contact-card.mjs:17`; 후보 `mobile-input-review-model.js:61`, `:69` 및 `mobile-card-recognition.js`.

## 6. 공통 계약 확인 뒤 필요한 검증 시나리오

운영 고객을 수정하는 방식으로 시험하지 않는다. 승인된 별도 테스트 환경 또는 합성 로컬 데이터로 아래를 먼저 검증한다.

1. PC·모바일이 같은 사람을 신규 저장할 때 같은 필수값·정규화·권한·ACK를 사용한다.
2. `contact:<UUID>` / `inquiry:<UUID>` 사람을 선택해 연결하면 기존 contact ID와 이력이 보존된다.
3. 동일 번호의 후보가 여러 사람이면 자동 선택·병합·저장하지 않는다. 권한 밖 후보의 개인정보도 노출하지 않는다.
4. 동일 사람을 두 현장에 연결해도 기존 소속·연결·대표·동의가 변하지 않는다.
5. 한 현장에 공종·연도가 다른 두 영업건을 연결하고, 같은 이름의 다른 현장도 별개로 유지한다.
6. 회사 입력의 실제 저장 엔티티와 명함 필드가 일치한다. 공란·미확인은 기존 회사 삭제가 아니다.
7. 동의 필드 없이 연결할 때 기존 동의 true, false, 수신거부, 차단 사유가 모두 보존된다. OCR 결과는 동의를 만들지 않는다.
8. 대표 변경을 요청하지 않으면 역할이 관리소장이어도 기존 대표를 유지한다.
9. 다른 영업건에서 같은 사람을 먼저 수정한 뒤 오래된 입력을 저장하면 충돌을 알리고 원본을 덮어쓰지 않는다.
10. 서버 저장 후 응답 유실 → 같은 요청 재시도 → 사람·연결·감사 이력은 한 번만 생성된다. 날짜 경계를 넘어도 동일하다.
11. 같은 요청 ID로 수정된 payload를 보내면 거절한다. 계정 변경·권한 회수 뒤 재시도도 거절한다.
12. 서버 오류·부분 실패·저장소 오류 때 입력이 보존되고 완료 표시는 나오지 않는다. contact ID나 연결 ACK가 누락돼도 성공으로 표시하지 않는다.
13. 저장 완료 후 PC 상세·모바일 I-3·고객 연락처 조회에서 사람 ID와 현장 연결·동의가 일치한다. 고객 접촉 활동이나 단계·후속 업무가 생성되지 않는다.

이미 끝난 로컬 검사는 OCR 읽기 어댑터 31개(`review-preview/card-recognition-verification.json`)와 I-3 연결 흐름 16개(`review-preview/stage8-ocr-flow-verification.json`)다. 실제 파일 읽기·운영 OCR 호출·연락처 저장은 0회이며, 이 결과는 **연락처 저장 서버 계약 검증 완료가 아니다.**

## 7. 이어서 할 작업과 필요한 결정

2026-10-11 후속: 번호가 같은 **읽기 전용 후보 조회**를 로컬 공통 RPC `crm_contact_match_read_v1`로 준비했다. contact UUID·접근 가능한 영업건 연결·조회 범위의 후보 수를 반환한다. 후보 선택·연결·회사·대표·동의 변경은 포함하지 않으며 운영 미적용이다. 아래 2번의 저장 계약과 3번의 승인 조작은 계속 남아 있다. 자세한 내용은 [조회 구현·검사 보고](MOBILE_CONTACT_MATCH_REVIEW_20261011.md)를 참조한다.

1. **사용자 결정:** 명함의 회사가 현장에 연결된 소속인지 사람의 공통 소속인지 확인한다. 현재 질문 중이며 답변 없이 정하지 않는다.
2. **Codex 기능 작업:** 확인한 운영 go 계약을 기준으로 기존 연락처 UUID 선택, 연결만 하기와 사람 정보 수정 분리, 동의 생략 보존, 복수 영업건 연결·재시도·저장 응답을 PC·모바일 공통으로 보완한다. 모바일만 다른 저장 경로를 만들지 않는다.
3. **Claude 화면 연결:** I-3 원본의 ‘같은 분?’은 현재 안내문이며 선택 조작이 없다. 동일인 선택이 필요한 경우 원본 안에서 승인된 선택 동작을 지정받는다. Codex가 새 화면·버튼·배치를 만들지 않는다.
4. **검증:** 합성 환경에서 위 13개 시나리오를 검증하고, 운영 적용·실계정 저장 확인은 별도 결과로 기록한다.

필요한 결정과 검증 전에는 저장 버튼을 활성화하지 않는다. 이 문서 작성은 공개 업로드·운영 SQL 적용·고객 연락처 변경 승인이 아니다.
