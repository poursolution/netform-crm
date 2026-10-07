# Codex 서버 인수인계 진행 — 2026-10-07

기준: `CODEX_HANDOFF_20261007.md`, master `626403318059a9301aa1088e27248165b921c2db`.
Claude가 배포한 화면·배치·스타일은 유지한다. 아래의 로컬 검증과 운영 적용을 구분한다.

## A 1–4 운영 확인

- A1: #497에서 상담 preview/write/list RPC, 허용 목록, 오류 이름, 서버 조회 인덱스를 연결했다. 이번 점검에서도 authenticated 실행 권한을 확인했다.
- A2: #497에서 문의 contact_result/customer_reaction을 추가했다. 운영 inquiry_contact_logs의 두 칸을 재확인했다. 기존 result 유지, 영업건 기록에는 미적용.
- A3: create/list/reply/reask 요청 엔진 4개가 운영에 존재하며 authenticated 실행이 허용된다. inquiry/deal 대상 제약도 존재한다. 실제 고객 요청을 테스트로 보내지 않았다.
- A4: #497의 대시보드 전용 source/contracts RPC 두 개가 운영에 존재한다. 일반 목록·쓰기 권한을 넓히지 않는다.

## B5 재배정 인계 — 운영 반영 완료

새 요청 종류는 `handover`. 과거 `support + 재배정 인계`는 수정·삭제하지 않고 같은 인계 기록으로 읽는다. 다른 종류에 같은 표시명이 붙어도 인계로 오인하지 않는다. 일반 응대 기록만으로 인계를 자동 완료하지 않는다.

연결 점검 중 기존 담당 변경 화면이 로컬 담당부터 바꾸고 지원되지 않는 `assign` 큐 명령을 보내는 경로를 확인했다. 새 `crm_deal_reassign_handover_v1`은 담당 변경, 변경 이력, 기존 인계 종료 및 신규 인계 요청을 하나의 트랜잭션에 저장한다. ACK를 확인한 뒤에만 클라이언트 담당/이력을 변경한다. 관리자 권한·현재 담당 일치·활성 신규 담당을 확인한다. 요청 UUID 재시도는 기존 ACK를 돌려주며 내용이 달라지면 거부한다. 본인에게 재배정하면 자기 자신에게 인계 요청을 만들지 않는다.

기존 실적 귀속은 유지한다. 담당 없는 과거 자료의 과거 귀속은 추정하지 않는다. 귀속 변경 선택은 기존 예외 승인함에 요청만 생성하며 실패 시 담당 변경도 롤백한다.

### 바뀐 파일

- `deal-owner.js`: 서버 저장·ACK·재시도 연결.
- `deal-owner-v2.js`: 저장 완료를 기다린 뒤 입력 상태 초기화. 화면 마크업·스타일 변경 없음.
- `work-request.js`: handover 종류 및 과거 표시명 호환 판정.
- `pc-manager-transport.js`, `pc-error-state.js`: 새 RPC 허용 및 오류 이름.
- `package.json`, `tests/work-request-handover.test.cjs`, `tests/work-request-handover-postgres.test.mjs`: 필수 검사 연결.

### 추가 서버 항목 및 적용 순서

1. `sql/work-request-handover-20261007.sql`: work_requests.kind 제약에 handover 추가, 과거/신규 인계 중복 차단, 현재 담당 검증, `crm_work_request_handover_v1` 설치.
2. `sql/deal-reassign-handover-20261007.sql`: `crm_security.deal_reassignment_receipts(actor_id,request_id,payload,ack,created_at)`와 원자적 재배정 RPC 설치. 표 직접 접근 차단, RPC는 기존 관리자 권한만 사용.
3. DB 매니페스트에서 두 함수를 확인한 뒤 화면 병합. 클라이언트의 CRMRelease/전송 게이트를 함께 배포.

### 검증

합성 PostgreSQL 검사: 관리자 권한, 새 담당 저장, 실적 귀속 유지, 재시도 중복 방지, 낡은 담당 정보 거부, 승인 오류 전체 롤백, 이전 인계 보존, 수신자 인수 확인, 익명 실행 차단 통과.
클라이언트 검사: 저장 전 로컬 상태 불변, 실패 후 재시도 UUID 유지, ACK 후 이력 한 번 반영, 과거 인계 호환 통과.
전체 DB 회귀 45개 통과. 계약/기능 검사 479개 중 478개가 첫 실행에 통과했고 production-build-version 1개는 읽기 전용 git 자식 실행을 허용한 재실행에서 통과했다. 로컬 빌드 버전 검사는 상위 작업 폴더의 Git 메타데이터를 사용하므로, 배포 커밋 검증은 PR 필수 CI 결과로 한다.
두 SQL 적용 후 PR #509를 병합했다(merge c4879d631da72be4cab5db748710702c2876a8c9). PR 필수 검사, 병합 후 전체 검사 37571230722, Pages 배포 37571230640 모두 성공. 공개 배포 파일에 새 RPC가 포함된 것을 확인했다. 기존 사용자 탭은 오래된 iframe 버전 식별자가 남아 있어 해당 탭에서 새 재배정 저장을 검증했다고 주장하지 않는다.

## 남은 순서

B6 연락 연결 표 → B7 구조화 메모 표 → B8 확장관리 단지 연락 표 → B9 금액 되돌리기 승인/원장 연결 → B10 NULL 단계 원본 대조. B5 완료로 이 항목들이 완료된 것은 아니다. 기존 원문·표식을 보존하고 권한 범위 안에서 연결한다. 금액·과거 귀속·단계는 근거 없이 보정하지 않는다.

## B6 연락 연결 표 — 검증 완료, 운영 반영 전

원본 응대 기록의 연결 표식을 그대로 보존하고, 같은 트랜잭션의 트리거가 연결 색인을 만든다. 원본과 대상의 기록 권한을 모두 확인하며 읽을 때도 두 대상의 현재 접근 권한을 재검사한다. 원본 삭제/휴지통 중에는 연결 기록을 숨기고 복원하면 다시 읽는다.

- SQL: `sql/activity-links-20261007.sql` (B5 뒤 적용).
- 새 표: `crm_security.activity_links(source_type,activity_id,source_id,target_type,target_id,created_at)`. 직접 읽기/쓰기 차단. 기존 원문은 수정하지 않는다.
- 새 조회 RPC: `crm_activity_links_v1(p)` — 선택된 영업건/문의만 커서당 최대 20건 조회.
- 파일: `contact-link.js`, `deal-detail-v2.js`, `deal-detail-v3.js`, `inquiry-detail-v2.js`, `inquiry-v4.js`, `pc-manager-transport.js`, `pc-error-state.js`, `package.json`, SQL, 두 계약 검사, `scripts/verify-contact-link-browser.cjs`. CSS 변경 없음.
- CRMRelease와 전송 허용 목록이 준비된 뒤 서버 조회를 사용한다. 전체 영업건 activities 훑기를 없애고 선택 대상의 캐시/진행 중 요청을 재사용한다. 로그인 사용자가 바뀌면 캐시를 비운다. 연결 기록은 새 고객 응대 횟수로 중복 계산하지 않는다.
- 합성 DB 검사: 정확한 표식, 권한 실패 시 원본 저장 롤백, 중복 제거, 20건 커서, 휴지통/복원, 원문 보존, 직접 접근/익명 차단 통과. 클라이언트: 선택 대상 조회, 캐시, 계정 변경 시 응답 폐기 통과. 실제 브라우저 합성 검사에서 로딩 중 작성 메모 보존 및 기존 영업건/문의 상세 4개 검증 통과.
