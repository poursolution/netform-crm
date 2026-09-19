# 영업운영 CRM 미완료 재점검 — 2026-09-19

## 확인 기준

- 대상: https://poursolution.github.io/netform-crm/?view=pc
- 제품명 표기: 영업운영 CRM (`netform-crm`)
- ASQ 기능이 처음 운영 반영된 코드 빌드: `333f10ca087250d2a7ce85593f7229e17dd71c10` (이후 문서 전용 배포 SHA는 달라질 수 있음)
- 로그인 전 PC 화면 로드와 메뉴 구성을 확인했고 브라우저 콘솔 오류·경고는 없었다.
- 정적 화면, 저장소 소스, migration, 최근 운영 감사 문서를 대조했다.
- Supabase 연결로 운영 migration 이력·ACL·RLS를 확인했고, 롤백 트랜잭션 안에서 서비스 동기화와 인증 사용자 읽기를 검증했다.

## 확실히 남아 있는 문제

| 우선순위 | 항목 | 판정 근거 | 필요한 조치 |
|---:|---|---|---|
| P0 | 휴대폰 번호를 비밀번호로 사용하는 로그인 | PC·모바일 로그인 안내와 입력값이 본인 휴대폰 번호 전체를 비밀번호로 사용한다. | 개인별 임시 비밀번호 또는 SSO/OTP로 전환하고 초기 변경, 재설정, 퇴사자 회수 흐름 적용 |
| P1 | 구글시트 담당자 동기화 실행 경로 미확인 | 확인했던 Apps Script 프로젝트에는 동기화 파일·트리거·최근 실행이 없었고 실제 프로젝트 또는 n8n 경로를 찾지 못했다. | 실제 실행 프로젝트/워크플로 식별, 최근 성공·실패 로그와 Sheets→DB read-back 대조 |
| P1 | 고객자산 분리 데이터 복구 미실행 | 2026-09-16 운영 읽기 감사에서 `site_id` 없는 Deal 60, Inquiry 85, Organization에만 연결된 Contact 702건이 확인됐고 자동 병합은 수행하지 않았다. | 후보 생성 → 사람 검토 → 영구 Site 연결 → 재조회 순서로 정리 |
| P1 | Site 연결 검토 Queue는 Staging까지만 완료 | 합성 데이터와 Staging 검증은 통과했지만 Production 적용 증거가 없다. | 운영 복제/격리 데이터 검증, 배포 manifest, 운영 적용 후 read-back |
| P2 | 문자·카카오의 실제 공급자 전송 완료 확인 | CRM의 개인 발송은 외부 앱 실행 후 사용자 확인 기록이다. Campaign DB queue와 provider callback 함수는 소스에 있으나 실제 provider worker·즉시/예약/callback E2E 완료 증거가 없다. | 테스트 수신자로 즉시·예약·실패 callback, 중복 방지, provider message ID read-back 검증 |
| P2 | 남은 고객자산 원본 정리 | 중복 후보 제외와 검토 화면은 개선됐지만 과거 Organization/Note, Site 미연결 레코드가 남아 있다. | 원본 보존 상태에서 검토 Queue를 통해 단계적으로 연결 |
| P3 | 남은 코드 정리 | 주요 중첩 override는 제거했지만 과거 보조 함수와 미사용 DCC 정리는 보류돼 있다. | 작은 단위 삭제 후 주요 화면·저장 회귀 |

## 구현은 됐지만 운영 완료를 확인하지 못한 항목

| 우선순위 | 항목 | 소스에서 확인한 것 | 운영에서 필요한 확인 |
|---:|---|---|---|
| P0 | 관계관리 연락 기록 + 다음 연락 원자 저장 | UI, adapter, ACK 검사, migration, rollback이 연결돼 있다. | Production migration/ACL, 실계정 저장, 새로고침, 두 세션 충돌 |
| P0 | 데이터 정리 실행 | UI가 `crm_cleanup_state/preview/apply`를 호출하며 계약이 없으면 검토 전용으로 안전 차단한다. | 운영 RPC 존재·권한·fingerprint·원본 보존·apply read-back. 과거 운영 snapshot에는 세 RPC가 없었다. |
| P0 | 실계정 권한과 동시성 | 로컬·합성·Staging 검증은 있다. | Production에서 admin/rep/branch/consultation 계정별 조회·쓰기 범위, 권한 회수, 두 세션 충돌 |
| P0 | ASQ 운영정보 읽기 | `asq_project` 운영 도메인, 사용자별 Deal 권한 필터, PC·모바일 번들 연결과 Production migration 적용·DB read-back까지 통과했다. | ASQ sync worker 연결, 실제 프로젝트 1건의 PC·모바일 read-back |
| P1 | 확장관리 견적 발송 → 새 Pipeline | UI, `expansion_quote_convert` queue, adapter, DB migration과 ACK 검사가 구현돼 있다. | Production migration과 ACL, provider 발송증명, 단일 transaction, 재시도 중복 0, 새 Deal read-back |
| P1 | Campaign Center 서버 경로 | `campaign_create`, campaign/recipient queue, claim, provider-result callback SQL이 구현돼 있다. | Production 적용, 실제 실행 worker, callback 인증·멱등성·시간대 검증 |
| P1 | Production 보안 상태 | 과거 Staging 감사와 로컬 보안 테스트가 있다. | 현재 Production의 GRANT/RLS/함수 execute/advisor를 다시 읽기 전용 감사 |

## 완료로 확인된 범위

- PR #78과 ASQ 운영 읽기 PR #79 병합, master Quality Gate와 GitHub Pages 배포 성공.
- 운영 페이지에서 PR #79 코드 빌드와 ASQ 캐시 키 `20260919-asq-1` 로드를 확인했다.
- Production에 `asq_operational_read`와 `fix_asq_operational_cursor` migration을 적용했다. UUID 커서의 `max(uuid)` 오류는 후속 migration으로 수정했다.
- Production 롤백 검증에서 서비스 동기화 → 권한 있는 사용자 `asq_project` 읽기 → 기존 `deal_core` 위임이 모두 통과했다. 검증 행은 롤백됐고 실제 ASQ 미러는 0건이다.
- ASQ 테이블은 인증 사용자 직접 SELECT와 sync RPC 실행을 차단하고 service role만 동기화할 수 있다. Production advisor의 ASQ 관련 WARN/ERROR는 0건이다.
- 로그인 전 PC 화면과 16개 업무 메뉴가 정상 렌더링되고 콘솔 오류가 없다.
- 최근 로컬 계약 테스트 146개와 PC smoke 12개 명령이 통과했다.
- 캠페인 CSV 내보내기, 관계관리 원자 저장 연결 검사, 데이터 정리 계약 부재 시 안전 차단 검사가 품질 게이트에 포함됐다.
- 확장관리 전환 코드는 미연결 상태가 아니다. 운영 적용과 실제 E2E만 미확인이다.

## 다음 실행 순서

1. ASQ API/Webhook 또는 n8n worker에 service role 호출을 연결하고 실제 프로젝트 1건을 동기화한다.
2. 해당 프로젝트가 권한 있는 계정의 PC·모바일 화면에 표시되는지 새로고침 후 확인한다.
3. 관계관리 원자 저장과 데이터 정리 RPC를 테스트 계정/테스트 레코드로 검증한다.
4. 구글시트 담당자 동기화의 실제 실행 위치를 찾는다.
5. Site 연결 Queue와 고객자산 미연결 데이터를 사람 검토 방식으로 정리한다.
6. 문자 provider와 Campaign callback을 테스트 수신자로 E2E 검증한다.
