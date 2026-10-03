# 견적문의 응대 문자 — CRM 직접 발송 (2026-10-03)

대표 지시("진행해"): 견적문의 상세 창의 문자 탭에서 [CRM에서 보내기]를 누르면 넷폼 발신번호로 고객 휴대폰에 바로 발송된다.

## 흐름
1. 담당자(또는 관리자)가 상세 창 문자 탭에서 문구 확인 → [CRM에서 보내기] → 한 번 더 눌러 확인(받는 번호 표시).
2. 화면이 `crm_inquiry_sms_request_v1`(SQL `sql/inquiry-sms-reply-v1-20261003.sql`)로 큐 `crm_security.inquiry_sms_requests`에 넣는다.
   - 관리자 또는 그 문의의 담당자만 · 종결 문의 금지 · 받는 번호는 문의에 적힌 010 번호 그대로(화면이 못 바꿈) · 문의당 24시간 3건.
   - 응대 이력에 «문자 · 회신대기 … (CRM 발송)»이 기존 경로로 기록되고, 배정된 건은 3일 뒤 '회신 확인'이 오늘 업무에 생긴다.
3. 대표 PC의 알리고 실행기가 15초마다 큐를 집어 보낸다(`crm_sms_worker_claim_inquiry_v1`, service_role 전용). 요청한 사용자가 지금도 승인된 활성 사용자일 때만 집고, 24시간 지난 요청은 `cancelled(EXPIRED_24H)`.
4. 결과(`submitted → sent / failed / unknown`)는 `crm_inquiry_sms_list_v1`로 상세 창 타임라인에 «CRM 문자 전송됨 / 실패 / 대기 중»으로 뜬다.

광고성 캠페인 큐(`sms_campaign_*` · 수신동의 · 허용 번호 목록)와는 분리된 별도 큐다. 고객이 먼저 문의한 건에 대한 응대 안내 문자이므로 광고 수신동의 · 080 번호 대상이 아니다. 광고 문구는 여기로 보내지 않는다.

## 켜는 순서 (대표 PC)
1. Supabase SQL 편집기에서 `sql/inquiry-sms-reply-v1-20261003.sql` Run (관리자). 적용 전에는 화면에 [CRM에서 보내기]가 보이지 않는다(릴리스 게이트).
2. 기존 알리고 실행기와 같은 자격(`%LOCALAPPDATA%\netform-crm\aligo\credentials.dpapi`, `crm-backend.dpapi`)으로, 환경 변수를 하나 더 켜고 실행:
   ```powershell
   $env:ALIGO_CAMPAIGN_ENABLED='true'; $env:ALIGO_INQUIRY_REPLIES='true'; node server/aligo/run-campaign-worker.mjs
   ```
   - `ALIGO_INQUIRY_REPLIES`가 없으면 캠페인 큐만 돌고 문의 응대 큐는 쌓이기만 한다(보내지 않음).
   - 로그 한 줄: `{"at":…,"pending":0,"claimed":0,"inquiry":{"pending":0,"claimed":1}}` — `inquiry.claimed`가 보낸 건수.
   - PC 종료 · 절전이면 멈춘다. 켜 두는 동안만 발송된다.
3. 첫 발송은 대표 본인 010 번호를 문의자 연락처로 둔 시험 문의로 확인한 뒤 실제 고객에게 쓴다.

## 검사
- `npm run test:aligo` — 실행기 단위 + pglite SQL(요청 · claim · 결과 전이) 포함.
- `scripts/verify-inquiry-detail-v2-browser.cjs` — 화면(두 번 확인 · 요청 · 이력 · 상태 표시).

## 2026-10-03 PC 실행 재개

- 기존 9월 19일 DPAPI 서버 인증 파일이 남아 있었으며 서버 인증 및 캠페인/문의 pending 조회 성공. 키 재발급·덮어쓰기 없음.
- 문의 claim RPC의 `q.deleted_at` 직접 참조가 운영 inquiries 스키마에 없는 컬럼이라 42703 오류를 발생시킴. 사용자 승인 후 `(to_jsonb(q)->>'deleted_at') is null`로 교체. 문의 존재 여부를 검사하는 inner join과 기존 권한 조건은 유지. 운영 스키마에는 삭제 컬럼이 없으며, 컬럼이 있는 스키마에서는 삭제 표식을 계속 검사함.
- 롤백 검증 후 운영 함수 반영 확인. `ALIGO_CAMPAIGN_ENABLED=true`, `ALIGO_INQUIRY_REPLIES=true`의 단일 실행이 종료 코드 0으로 성공. 캠페인 pending/claimed 및 문의 pending/claimed 모두 0.
- 동일 환경 변수로 숨김 백그라운드 실행을 시작. 캠페인은 기존 수신번호 허용목록 유지, 문의 응대는 CRM에서 요청된 고객 문자 큐 처리. 자동 시작 등록 없음. PC 종료·절전 또는 실행기 오류로 프로세스가 종료되면 별도 재시작이 필요함.
