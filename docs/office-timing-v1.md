# AI 사무실 시간 기준 조회 `crm_office_timing_v1` (2026-11-08)

대표 지시 「시간 기준 4개 설정해」 — 사무실(Hermes)이 배정 30분 · 첫 연락 2시간 · 견적 후 7일 · 사유 빈칸을 스스로 점검할 수 있게 내보내는 **읽기 전용** 조회.
SQL: `sql/office-timing-v1-20261108.sql` · 되돌리기: `sql/office-timing-v1-20261108-rollback.sql` · 검사: `tests/office-timing-postgres.test.cjs`

- 기존 `crm_operational_source_v1`(CRM 화면 전체가 읽는 핵심 조회)은 바꾸지 않는다.
- 고객 이름 · 연락처 · 주소 · 현장명 · 메모 글은 내보내지 않는다. 레코드 id · 시각 · 있음/없음 · 단계 코드만.
- 기한을 넘겼는지는 판정하지 않는다(사무실이 기준 시간으로 판정). 장기정체 기준은 대표 결정 전이라 `stage_entered_at` 날짜만.
- 화면 전송 목록(`pc-manager-transport.js` rpcAllow)에 넣지 않는다 — 화면이 부르지 않으므로 '서버 적용 대기' 배너 대상이 아니다.
  운영 설치 여부는 `crm_release_manifest_v1` 목록에 `crm_office_timing_v1` 이 있는지로 사무실이 먼저 확인한다(없으면 '미확인' 유지).

## 호출

`POST /rest/v1/rpc/crm_office_timing_v1` `{ "p_domain": "inquiry_timing" | "deal_timing", "p_after": uuid|null, "p_limit": 1~500 (기본 200) }`
권한: 로그인한 CRM 계정(authenticated · 공개 키 + 계정 토큰). 관리자 = 전체, 그 밖 = 기존 담당 범위(can_inquiry · can_deal). anon 불가.

응답: `contract_version 1 · resource 'office_timing' · domain · definitions_version 1 · scope_completeness 'actor_authorized_rows_only' · actor_user_id · generated_at · items[] · pagination{completeness, has_more, next_cursor}` (id 순, `crm_operational_source_v1` 과 같은 쪽 넘김 규칙)

## 견적문의 `inquiry_timing`

| 칸 | 뜻 |
|---|---|
| `id` | 견적문의 id |
| `status` | 상태 글(접수 · 담당자 배정 · 보류 …) |
| `received_at` | 접수 시각(received_at, 없으면 created_at) — 화면 inquiryCreatedAt 과 같다 |
| `assigned` | 담당 있음(assigned_to 또는 '미배정'이 아닌 담당 이름) |
| `assigned_at` · `assigned_at_basis` | 배정 시각. `column` = 배정 칸 · `assignment_history` = 담당 변경 기록의 마지막 배정 · `none` = 모름 |
| `first_attempt_at` | 첫 연락 시도(부재 · 통화불가 · 번호오류 · 회신대기) — 서버 응대 기록 |
| `first_connected_at` | 첫 실제 연결 — 서버 응대 기록 값 그대로(inquiry_flow_state) |
| `memo_call_date` | 메모 속 통화로 보완한 날(날짜만) |
| `first_contact_at` | **화면 '첫 연락' 판정에 쓰는 첫 실제 연결 시각**(아래 순서) |
| `first_contact_precision` | `time` · `day`(메모 보완 날 = 그날 0시 서울) |
| `first_contact_basis` | `contact_log` 응대 기록 · `migrated` 예전 기록에서 옮긴 값 · `legacy_stamp` 예전 응대 시각(글이 시도만이면 제외) · `legacy_status` 예전 상태만 있고 시각 없음 → 마지막 수정 시각 · `memo_confirmed` 메모 보완 날 · `none` |
| `first_contact_approx` | 근사 여부(`contact_log` · `memo_confirmed` 이외는 true) |
| `review_needed_approx` | 화면 '이관 기록 확인'(첫 연결 시각이 접수일 복사로 보임) — 첫 연락 전 집계에서 빠짐 |
| `before_first_contact_approx` | 견적문의 목록 **'첫 연락 전'** 에 들어가는 건: 배정됨 · 전환 안 됨 · 종결 아님 · 첫 연결 없음 · 이관 기록 확인 아님 |
| `converted` | 영업건 전환·연결됨(deal_id · opportunity_id · 상태 영업전환) |
| `tracking_closed` | 종결 상태(수주 · 실주 · 배드핏 · 연락두절 · 종결 · 종료 · 스토어/자재 종료) 또는 협약 문의 |
| `close_kind` | 흐름 종결 종류 `bad_fit` · `unreachable` · `consult_end` · null |
| `close_reason_present` | 종결 사유 있음 |
| `on_hold` · `hold_reason_present` · `hold_review_date` | 보류 · 보류 사유 있음(마지막 보류 기록) · 재검토일(열린 다음 할 일 기한, 없으면 next_action_date) |
| `updated_at` | 마지막 수정 |

첫 연결 정의 = `inquiry-v4.js`(base · step) · `inquiry-list-v3.js` model · `inquiry-flow.js` own() · `inquiry-memo.js` contactReview · `kpi-v7.js` 누적 첫 연락 전과 같은 순서.
서버가 볼 수 없어 **근사**인 것: 같은 현장 · 같은 브랜드 다른 문의에 남긴 연락(ContactState.siblings) · 메모 글 속 통화 후보(memo_call_unconfirmed) · 예전 시각 5초 안의 화면 기록 · 화면 담당 명단(퇴사 · 지사 풀) 판정.

## 영업건 `deal_timing`

| 칸 | 뜻 |
|---|---|
| `id` | 영업건 id |
| `owner_assigned` | 담당 있음 |
| `stage_code` · `stage_group` · `lifecycle_status` · `outcome` | 단계 · 상태 코드 |
| `created_at` · `stage_entered_at` | 만든 시각 · 단계 진입 시각(판정 안 함) |
| `quote_sent_date` | 견적 발송일(단계 정보 sent.fields.sent_date, 서울 날짜) — 없으면 null = 7일 판정 불가(화면 sentEvidence 와 같다) |
| `quote_sent_unverifiable` | 발송일 '확인 불가'로 기록됨 |
| `quote_reaction_present` | 고객 반응 기록 있음(화면은 반응이 있으면 후속 완료로 본다) |
| `first_activity_after_sent_at` | 발송 다음 날(서울)부터 첫 고객 접점(시도 포함: 전화 · 문자 · 카카오 · 메일 · 방문) |
| `first_connected_after_sent_at` | 발송 다음 날부터 첫 실제 연결(부재 · 회신대기 · 문자 제외) |
| `followup_approx` | 늘 true — 화면은 넘어온 견적문의의 연락 · 마지막 의미 있는 연락도 합친다 |
| `last_customer_contact_at` | 마지막 고객 연락 칸 |
| `hold_reason_present` · `hold_review_date` · `hold_review_basis` | 보류(대기) 사유 있음 · 재검토일 · `resume_date` / `wake_up_at` / `none` |
| `lost_reason_present` | 실주 사유 있음(단계 정보 lost.fields.close_reason, 없으면 lost_reason) |
| `updated_at` · `version` | 마지막 수정 · 버전 |

## 운영 적용 순서
1. 대표가 Supabase SQL 편집기에서 `sql/office-timing-v1-20261108.sql` Run
2. 확인: `crm_release_manifest_v1` 목록에 `crm_office_timing_v1` 이 보이는지
3. 사무실 연결(`Hermes\scripts-office\connect\harness-connector-crm.js`)이 목록 확인 뒤 이 조회를 읽어 4개 기준 판정
