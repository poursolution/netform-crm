# 알리고 공급자 연결 결과 — 2026-09-19

대상: 영업운영 CRM (`poursolution/netform-crm`).
상태: **PROVIDER_CONNECTED / DB_QUEUE_DEPLOYED / WORKER_AUTH_PENDING**.

## 완료

- 기존 알리고 회사 계정, 기존 API Key, 기존 허용 서버 IP와 등록 발신번호를 사용했다.
- 현재 Windows 컴퓨터에서 `remain/` API 인증 성공. 인증 시 SMS 4,340건 가능을 확인했다.
- `testmode_yn=Y` 시험 통과 후 사용자가 지정한 테스트 수신번호에 실제 SMS **1건만** 전송했다.
- 실제 접수 ID `1456288462`를 `sms_list/`로 조회하고 원래 수신번호와 발신번호가 일치하는 **발송완료** 결과를 확인했다. 장부 상태는 `sent`다.
- 인증 정보는 소스 디렉터리 밖 Windows 사용자 DPAPI 암호화 파일에 저장했다. 비공개 디렉터리는 현재 사용자와 SYSTEM만 접근하도록 NTFS ACL을 제한했다.
- API 키·실제 전화번호·허용 IP는 저장소, 문서, 로그에 기록하지 않는다.
- Node.js 24 알리고 테스트 26개(로컬 Postgres 포함)와 기존 CRM 계약 158개 통과. Windows DPAPI 암호화/복호화 왕복 검증 통과.

## 구현

- `server/aligo/client.mjs`: 고정 HTTPS API, 잔여건수, 단일 수신자 test/live 전송, 메시지 ID 기준 결과 조회, 시간대 포함 예약의 한국시간 변환.
- `server/aligo/dispatcher.mjs`: SQLite 영구 요청 장부. 같은 요청 ID의 중복 발송 및 내용 변경 차단. 응답 유실·타임아웃·재시작 뒤 미확정 요청은 자동 재발송하지 않는다.
- `server/aligo/cli.mjs`: 서버 전용 도구. 실제 발송 기본 차단, 수신번호 허용목록 확인, 장부는 소스 밖에 저장.
- `server/aligo/windows-credentials.mjs`: DPAPI CurrentUser 암호화. 비밀값을 프로세스 인수가 아닌 표준입력으로 전달.
- `server/aligo/setup-server.mjs`: 127.0.0.1 전용 운영자 연결 도구. Host/Origin/CSRF 검증, 기존 인증 암호화 저장, 고정 테스트 작업과 결과 조회. 동일 테스트 작업은 반복 클릭해도 새로 발송하지 않는다.

## 실행과 보관

현재 Windows 사용자로 `node server/aligo/setup-server.mjs`를 실행하고 로컬 주소 `http://127.0.0.1:45873/`에 접속하면 보관된 프로필을 사용한다.
새 컴퓨터/사용자에서는 기존 암호화 파일을 복사해 사용할 수 없다. 새 위치에 배포할 때 비공개 폴더 ACL과 공급자 허용 IP부터 설정한다.
이 컴퓨터의 전원이 꺼지면 로컬 실행기는 동작하지 않는다. 자동 시작/예약 작업은 등록하지 않았다.

환경 변수 기반 CLI는 `ALIGO_API_KEY`, `ALIGO_USER_ID`, `ALIGO_SENDER`, 비공개 `ALIGO_STATE_DIR`, `ALIGO_ALLOWED_RECEIVERS`를 사용한다.
`ALIGO_LIVE_ENABLED=true`는 승인된 실제 발송 시에만 설정한다. 작업 JSON은 명령행이 아닌 표준입력으로 전달한다.
`balance`, `send`, `status` 명령을 지원한다. 작업은 requestId(UUID), receiver, message, type(SMS/LMS), mode(test/live), optional scheduledAt(명시적 UTC offset)이다.

## 아직 완료하지 않은 범위

1. 지속 실행 worker의 서버 인증과 운영 실행. Queue 및 CRM 읽기/쓰기 API는 배포했고 worker는 구현·검증했지만, 사용자가 Supabase 서버 키 화면 접근과 암호화 저장을 승인했지만 자동 승인 검토에서 작업공간 설정 접근 지침을 이유로 차단해 실제 키 저장과 자동 발송은 미완료다.
2. 예약 발송, 실패 결과, callback 경로의 실제 E2E 검증. 로컬 계약 테스트 통과를 실제 운영 시험으로 대체해 표기하지 않는다.
3. 카카오 알림톡 API 인증, 승인 템플릿 변수 연결, 실제 발송 검증. 정상 채널과 승인 템플릿 7개는 확인했으며 실제 발송 검증은 SMS 1건이다.
4. 새 서버 코드 병합과 실행기 활성화. Draft PR #87(https://github.com/poursolution/netform-crm/pull/87)에 서버 코드와 검증 파일을 올렸으며 최초 코드 커밋의 GitHub Quality Gate가 통과했다. 병합·자동발송 활성화는 아직 하지 않았다. 웹 프런트엔드에 비밀키를 포함하지 않는다.

공식 규격: https://smartsms.aligo.in/admin/api/spec.html
`send` 성공 응답은 접수이며 `sms_list`의 수신자별 명시적 발송완료만 최종 성공으로 처리한다.

## 후속 운영 대기열 적용

사용자가 운영 DB 적용을 명시적으로 승인한 후 Production migration `20260919114702_aligo_campaign_worker`를 적용했다. 과거 미적용 `20260908170000_sms_campaign_queue.sql`은 현재 운영 구조와 호환되지 않으며 이 migration으로 대체한다. 과거 파일을 운영에 추가 적용하지 않는다.

- 현재 `crm_security.contact_compat_state`의 Deal별 동의가 기준이다. 기존 연락처·Site 저장을 덮어쓰거나 새 동의 컬럼을 만들지 않았다.
- `campaign_create`와 `campaign_core`만 처리하고 나머지 기존 명령과 읽기는 직전 구현에 위임한다.
- 서버 API 3개는 service_role만 실행할 수 있다. 일반·미로그인 사용자 접근 차단과 새 private 테이블 2개의 RLS를 확인했다.
- 예약 시각과 현재 동의/차단/담당 관리자 권한을 확인한 후 승인 수신번호만 claim한다. 응답 유실은 unknown으로 보류하며 자동 재발송하지 않는다.
- 공급자 ID가 바뀐 응답·잘못된 claim·완료 결과의 되돌림을 거부한다. 발송완료 재처리는 활동 이력을 중복 생성하지 않는다.
- 운영 DB 롤백 검증 16개 통과. 재현 SQL: `aligo-campaign-production-rollback.sql`. 공급자 API 호출 없이 모든 테스트 데이터를 롤백했으며 campaigns/recipients/합성 사용자 잔여 각각 0건이다.
- 기존 관계관리 원자 저장 운영 롤백 10개도 다시 통과했다.
- 적용 후 보안 advisor ERROR 0, 기존 WARN 수 불변. 새 private 테이블 RLS 정책 없음 INFO 2건은 직접 접근 차단 설계에 따른다.
- 당시 운영 동의 검증을 통과하는 대상은 0건이었다. 동의 기록을 임의 생성하지 않았다.

`server/aligo/run-campaign-worker.mjs`는 명시적 활성화 변수와 DPAPI 서버 인증 파일이 모두 있어야 실행된다. 현재 설정은 기존 테스트 수신번호만 허용한다. 고객 전체 발송이나 자동 시작 작업은 등록하지 않았다. Supabase 서버 키는 `crm-backend.dpapi`로 저장해야 하며, 채팅·Git·명령행 인수에 넣지 않는다.

## 카카오 확인

로그인된 알리고 계정에서 @pour공법 채널 정상 및 승인 템플릿 7개를 확인했다. UL_4309(담당자 업무 요청), UL_0655(첫 상담), UL_0654/UL_0652(방문 일정), UL_0653/UL_0651(견적 검토), UI_7319(컨설팅 계약 진행)이다. 채널/템플릿을 새로 만들 필요가 있다는 이전 추정은 적용하지 않는다. 실제 카카오 API 인증·템플릿 변수 연결·발송은 아직 미실행이다.

## 서버 인증 저장 준비 후속

로컬 설정 도구에 이 CRM 프로젝트에 고정된 서버 인증 저장 기능을 추가했다. 기존 서버 키만 허용하며 다른 프로젝트의 legacy 키와 공개 키를 거부한다. 서버 인증은 pending 조회 RPC로만 확인하고, 성공 후 Windows DPAPI로 암호화 저장·복호화 일치를 확인한다. 기존 서버 인증 파일 덮어쓰기는 차단한다. 이 과정은 대기열 claim, 실제 발송, 자동 실행을 하지 않는다.

추가 테스트 5개를 포함해 알리고 테스트 26개가 통과했다. 실행 중인 로컬 연결 양식과 잘못된 Origin/CSRF의 HTTP 403 차단을 확인했다. 사용자가 해당 CRM 키 화면 접근과 기존 서버 키 암호화 저장을 명시적으로 승인했다. 이후에도 자동 승인 검토가 작업공간의 설정 접근 금지 지침을 이유로 접근을 차단하여 실제 키 저장은 미완료다. 관련 코드와 테스트는 PR #87의 후속 변경으로 관리한다.

로컬 연결 도구에서 GET /status가 Forbidden origin을 표시하던 문제를 수정했다. 폼 처리 뒤 303으로 기본 화면에 이동하여 새로고침 시 POST를 재제출하지 않는다. 기존 테스트 전송 결과의 sent 상태와 새로고침 정상 동작을 브라우저에서 확인했다. 새 문자를 발송하지 않았다.
