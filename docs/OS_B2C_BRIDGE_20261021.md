# OS 업무페이지(B2C 아파트 접수) ↔ 영업 CRM 연결 — 담당 범위 정리 (2026-10-21)

근거: 잔디 `03_송보람_AI작업지시`(공통 구현 기준 2026-10-20 · 시험 봉투 `OS_STAFF_HANDOFF_V1`). 담당: 송보람 — B2C 아파트 접수 ↔ 영업 CRM.
이 CRM(netform-crm)은 공통 기준 8번의 **B. 별도 시스템**이다. OS 안에 CRM 을 다시 만들지 않고, OS 가 보낼 입력과 받을 결과를 CRM 쪽에서 준비했다.

## 1. 처리 위치(공통 기준 8번)
| 단계 | 처리 위치 | 지금 상태 |
|---|---|---|
| B2C 문의 접수 · 1차 연락 · 담당 배정 | OS(OS_B2C · dsx-b2c) | OS 담당(이 묶음 범위 밖 · 수정 안 함) |
| 영업 진행(연락 · 견적 · 단계 · 수주/실주) | CRM(netform-crm) | 운영 중 |
| OS → CRM 입력 전달 | CRM 어댑터 `os-b2c-bridge.js` → 기존 서버 명령 `crm_inquiry_manual_create_v1(request_id, payload)` | **가짜 응답 검증** (실제 전송 경로 미연결) |
| CRM 진행 조회 · 결과 반영 | CRM 어댑터 `pull/receive` → OS 봉투 result | **가짜 응답 검증** (실제 조회 API 미정) |
| OS 에서 CRM 업무 바로 열기 | CRM 상세 주소 `crm.html#...`(영업건 상세 열기 경로는 DealDetailV3.openFrom) | **미검증** — 문의 ID → CRM 주소 규칙은 통합 담당과 확정 필요 |

## 2. 기존 값 ↔ 봉투 필드 대응
| OS_B2C 문의(getById) | 봉투 OS_STAFF_HANDOFF_V1 | CRM payload(crm_inquiry_manual_create_v1) |
|---|---|---|
| `id` (B2C 문의 ID · 바꾸지 않음) | `source.id` · `receiptRefs[].sourceId`(os-b2c) | `raw.os_b2c_id` |
| (OS 내부 ID) | `receiptRefs[].osInternalId` | `raw.os_internal_id` |
| (앱 접수번호 없음) | `receiptRefs[].displayNo = null` 허용 | `raw.display_no` |
| `brand` / `site_name` / `region`+`address` | — | `brand` / `site_name` / `address` |
| `customer_name` / `phone` / `office_phone` | — (개인정보는 봉투에 넣지 않음) | `contact_name` / `phone` / `raw.office_phone` |
| `work_types[]` · `work_type_raw` / `content` / `consult_channel` | — | `work_type` / `message` / `channel` |
| `owner` (OS 배정 담당) | — | `raw.os_owner` (CRM 담당 배정은 CRM 명령으로 따로 · 미연결) |
| — | `handoffKey` | `request_id`(handoffKey 로 결정적 uuid · 재시도 = 서버 replay) · `raw.handoff_key` |
| — | `caseRef` (null 허용 · 이름으로 안 만듦) | `raw.case_ref` |
| — | `documents[]` | `raw.documents` |

CRM → OS 결과(`toHandoff`): `result = {status(라벨), code, crmId, originalInquiryId(=source.id), crmStatus, dealStage, dealOutcome, assignee, updatedAt, editor:'crm', osContract:false}`. 봉투의 식별 필드(handoffKey · source · receiptRefs · caseRef · documents)는 받은 그대로 돌려준다. `mode:'prepared'`.

## 3. 상태 대응(수정 주체 = CRM) — OS 계약 완료로 자동 치환하지 않음
| CRM 값 | code | OS 에 보이는 뜻 |
|---|---|---|
| 문의 접수 / 배정 / 응대 / 진행 / 영업건 / 종결 / 배드핏 | crm_received … crm_badfit | 각각의 라벨(코드 참고) |
| 영업건 open | crm_deal_open | CRM 영업건 진행 중 |
| 영업건 won | crm_won | **CRM 수주 결과 — OS 계약 체결 완료 아님 · 계약 근거 확인 뒤 OS 에서 처리** (`osContract:false` 고정) |
| 영업건 lost | crm_lost | CRM 실주 |
OS 배정(owner)은 OS 가 고치고(`assign` · editor os), CRM 진행(status · deal)은 CRM 이 고친다(`receive` · editor crm). 서로 상대 값을 건드리지 않는다.

## 4. 실패 · 중복 · 지연 규칙(어댑터에 구현 · 검사 tests/os-b2c-bridge.test.cjs)
- 연결 전: `state.link='unlinked'`, 결과 봉투 `unresolved: CRM ID 없음`.
- 전송 실패: `retryable` · 기존 mapping 유지 · 같은 handoffKey 재시도 = 같은 request_id → 서버 replay(새 문의 안 만듦).
- 조회 실패: 이전 정상 결과 유지 · lastError 만 기록(완료로 바꾸지 않음).
- 같은 응답 두 번: 변경 없음(duplicate). 다른 문의 응답(crmId 또는 os_b2c_id 불일치): 무시. 이전 시각 응답(지연): 무시(최신 유지).

## 5. 미연결 · 통합 필요(실제로 확인 못 한 것)
1. **실제 전송 경로**: OS → CRM 서버 호출(인증 · 어느 계정으로 `crm_inquiry_manual_create_v1` 을 부를지) 미정. 지금은 가짜 transport 만. `request_id` 규칙(handoffKey → uuid · FNV 시험용)은 통합 담당과 확정 필요.
2. **진행 조회 API**: OS 가 CRM 상태를 읽는 서버 함수 없음(`crm_inquiry_flow_list_v1` 은 CRM 로그인 사용자용). 조회 전용 함수 또는 이벤트 필요 — 신규 서버 함수는 독자 확정하지 않음.
3. **담당 배정 반영**: OS 배정 담당(이름) → CRM 담당(계정) 대응표 없음. `raw.os_owner` 로 보존만.
4. **OS 에서 CRM 업무 열기**: 문의/영업건 상세 주소 규칙 미확정(현재는 CRM 홈 열기만 가능하다고 표시해야 함).
5. 저장 위치: 어댑터 mapping 은 메모리(시험). 운영 저장(브라우저 저장소 vs 서버 테이블)은 통합 필요사항.
6. 공사 연결(`caseRef`)·자동 연결 카탈로그: CRM 은 읽기만 보존(raw.case_ref). 카탈로그 확장은 통합 범위.
7. 문자 · 잔디 · 실데이터 전송: 하지 않음(시험 응답만).

## 6. 로딩 · 파일
- 새 파일 `os-b2c-bridge.js`(전역 `OSB2CBridge` 하나 · 의존 없음) — crm.html 에서 `inquiry-assignment-clarity.js` 다음에 로드(순서 의존 없음).
- 검사 `tests/os-b2c-bridge.test.cjs`, 예시 `tests/fixtures/os-handoff/`(묶음의 예시 그대로 · 개인정보 없음).
- 실행: `node --test tests/os-b2c-bridge.test.cjs` (서버 · 브라우저 불필요). 묶음 공통 검증 `node 검증/run.cjs` 은 공통 모델 시험이며 이 어댑터 검증을 대체하지 않음.
