# 단계 1 — PC 문의 첫 응대 저장의 일정 보존 계약

2026-10-11. **로컬 후보 / 운영 미적용 / PC 입력 화면 연결 전**. 기존 승인된 디자인 예시 및 PC 배치·스타일은 변경하지 않았다. 새 화면을 만든 작업이 아니다.

## 1. 확인한 기존 경로

기준 소스: `netform-crm` master `5fe1b714dff4c0b7efc963066b45242d96fa4d10`의 로컬 읽기 전용 복사본. 이 문서는 이 버전의 코드 검사 결과이며 운영 계정 저장 결과가 아니다.

- `inquiry-v4.js save()` → `InquiryListV3.record()` → `InquiryCommand.run('contact_log', …)`.
- `inquiry-detail-v2.js save()` → 같은 `InquiryCommand`.
- `InquiryCommand` 구현은 `inquiry-flow.js contactLog()`. 첫 연결 응대는 `iqApply(q, 'step:1')`를 먼저 호출하고, 응대 기록은 별도 outbox로 보낸다. 호출 즉시 반환한 `true`로 입력을 초기화하거나 다음 문의로 이동한다.
- PC의 `inquiry_status / progress` 서버 구현(`sql/inquiry-stage-progress/20260906/helper.sql`)은 열린 다음 업무를 취소하고 새 업무로 교체한다. 따라서 일정 저장만 새 경로로 바꾸면 먼저 취소된 업무를 보존할 수 없다.
- 모바일의 `inquiry_assign / response_progress`는 업무를 취소하지 않지만 역할 범위가 PC와 다르다. PC 관리자 저장을 모바일 명령으로 단순 교체하지 않는다.

## 2. 이번에 바꾼 파일과 동작

| 파일 | 내용 |
|---|---|
| `sql/inquiry-response-preserve-v1-20261011.sql` | 저장된 실제 연결 기록을 근거로 첫 응대 상태·단계 이력·감사 이력·중복 방지 영수증을 한 트랜잭션으로 저장 |
| `inquiry-response-contract.js` | 화면 없는 공통 전송 모듈. 계정·문의·담당·응대 기록·요청 ID·서버 이력·시각을 확인한 ACK만 성공 인정 |
| `transport.js`, `pc-manager-transport.js` | PC/모바일 허용 목록에 동일 RPC 추가 |
| `pc-error-state.js` | 동일 RPC 이름 추가 |
| `tests/inquiry-response-sql.cjs` | 기존 실제 일정 SQL 검사의 DB에서 신규 SQL도 실행 |
| `tests/schedule-contract.test.cjs` | 새 SQL 검사 연결. 기존 45개 유지 |
| `tests/inquiry-response-client.test.cjs` | 응답 오인·권한 변경·게이트·타임아웃 재시도 검사 |

`inquiry-v4.js`, `inquiry-detail-v2.js`, `inquiry-flow.js`의 기존 저장 버튼 경로는 **이번 후보에서 아직 바꾸지 않았다**. 새 모듈은 HTML에도 로드하지 않는다. 허용 목록 추가만으로 사용 가능하게 하지 않는다.

## 3. 추가한 서버 데이터·계약

새 표 `crm_security.inquiry_response_v1_receipts`:

- `(actor_auth_uid, request_id)` 기본키.
- `actor_user_id`, `inquiry_id`, `command`, `ack`, `created_at`.
- 직접 읽기·쓰기 권한 없음, RLS 활성화. 기록 보존을 위한 영수증이며 새로운 고객 입력란은 없다.

RPC `crm_inquiry_response_confirm_v1({p})`:

```json
{"inquiry_id":"UUID","request_id":"같은 재시도에 유지하는 UUID","contact_log_id":"이미 저장된 응대 기록 UUID","expected_token":"일정 조회에서 받은 지문"}
```

- 기존 서버 actor·접근 검토를 사용한다. PC에서 허용하던 담당 rep/consultation 및 admin 범위에서 처리한다. 기술자문·미배정·종결·휴지통·영업 전환 대상은 거절한다.
- 동일 문의, 동일 입력자의 서버 연락 기록이며 `kind=connected`여야 한다. 부재·대기 기록, 다른 문의/입력자의 기록으로 첫 응대를 확정하지 않는다.
- 조회 이후 부모 정보나 업무가 바뀌면 저장을 거절한다. 이미 응대 처리된 상태에 새 요청 ID로 반복 기록하지 않는다.
- `inquiries.status`, `first_response_at`, `responded_at`, `updated_at`만 기존 PC 상태 전진 의미로 변경한다. 이 시각은 서버의 상태 처리 시각이며 연락 기록의 `occurred_at`을 덮어쓰지 않는다.
- `next_actions`, `next_action_date`, 관리자 요청은 바꾸지 않는다. 기존 방문·견적 업무의 완료 또는 취소를 추정하지 않는다.
- 단계 이력·감사 이력·영수증 중 하나라도 실패하면 이번 상태 변경 전체가 롤백된다. 앞서 별도로 저장된 연락 기록은 유지된다.
- 같은 요청·같은 입력 재시도는 이전 응답만 반환한다. 같은 요청 ID의 내용 변경은 거절한다.
- 응답 `contract='crm.inquiry-response.v1'`, 저장한 문의/기록/입력자/담당/시각/단계·감사 이력 ID/새 token을 반환한다. `cancelled_action_ids`, `completed_action_ids`는 빈 배열이다.

## 4. SQL 적용 순서·게이트

아래는 **적용 후보 순서**이며 이번 작업에서 운영 실행하지 않았다.

1. `sql/schedule-preserve-v1-20261011.sql` — 공통 일정 기반, 기본 `enabled=false`.
2. `sql/inquiry-response-preserve-v1-20261011.sql` — 위 기반과 기존 문의 연락·감사·단계 이력 스키마가 필요하다.
3. 모든 기존 일정 교체 경로 및 PC/모바일 비동기 저장 연결 검증 이후에만 기능 활성화 검토.

클라이언트는 공통 `CRM_SCHEDULE_V1` 및 기존 일정 3개 RPC의 `CRMRelease` 확인에 더해 새 RPC의 `CRMRelease.has()`까지 요구한다. 서버가 없으면 `noteMissing()`을 기록한다. 서버 플래그가 꺼져도 이미 커밋된 동일 요청의 직접 재조회성 재시도는 기존 영수증을 반환하지만, 클라이언트는 게이트 OFF 상태에서 새 호출을 하지 않는다.

기존 `sql/schedule-preserve-v1-disable.sql`로 같은 설정을 끄면 새 첫 응대 저장도 차단된다. 기존 데이터·영수증을 삭제하지 않는다.

## 5. 검증 결과와 제한

| 검사 | 결과 |
|---|---|
| 신규 실제 SQL, PGlite PostgreSQL | 16개 통과 |
| 기존 실제 일정 SQL | 45개 통과 |
| 신규 클라이언트 계약 | 9개 통과 |
| 기존 공통 입력·일정 클라이언트·영업건/문의 흐름 | 46개 통과 |
| 기존 실제 PC 문의 버튼 → 새 경로 | 아직 연결 전 |
| 운영 SQL 적용·운영 계정 저장·발송 | 실행 0건 |

PGlite는 합성 사용자·스키마의 단일 세션이다. 실제 PostgreSQL 여러 연결의 동시 쓰기, 운영 트리거·개인 알림, 운영 계정/iOS/Android 저장을 검증한 결과가 아니다. 이번 서버 변경은 UI·브라우저 파일을 변경하지 않아 이전 브라우저 통과 결과를 신규 경로의 통과 결과로 재사용하지 않았다.

## 6. 다음 단계 및 PC 차이

PC 두 응대 입력의 저장을 비동기로 연결해 서버 확인 전 입력 초기화·다음 문의 이동을 막아야 한다. 계정별 저장 진행 정보를 먼저 보관하고, 응대 → 상태 → 일정이 부분 저장됐을 때 원래 요청 ID로 남은 것만 이어가야 한다. 현재 `InquiryScheduleFlow`는 기존 모바일 response_progress ACK만 받으므로 새 계약 ACK를 명시적으로 연결해야 한다.

견적 요청·자료 발송 등 남은 업무 교체 경로 전환과 실계정 검증도 필요하다. **단계 1 전체 완료 및 모바일 운영 반영이 아니다.** 포트 8766의 승인 디자인 예시는 그대로다. 견적 v3 서버 계산·데이터 계약과 누락된 최신 모바일 9화면 매핑은 Claude 측 계약 확인 사항으로 남겨 두며 별도 규격을 만들지 않는다.
