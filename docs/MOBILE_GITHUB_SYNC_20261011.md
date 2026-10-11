# 모바일 승인 디자인 구현 — GitHub 검토본

사용자가 요청한 누적 모바일 작업의 검토용 통합본이다. 기준은 master `ad209245d50bdc46569b9533fdcf3b601936f679`(PR #596). 운영 배포나 모든 기능의 완성을 뜻하지 않는다.

## 포함 범위

- Claude 승인 원본을 사용하는 모바일 셸·오늘·내 현장·상세·상담 입력·등록·일정·단계 업무·마감 및 입력 지원 화면. 이전 모바일 UI를 표시하는 대체 경로를 차단한다.
- source44 견적 v3의 모바일 9화면: 요청, 진행, 도착, 두 안, 이력, 간단견적, 새 기준, 공법견적, 제출금액. 원본 프레임과 선택·복귀·미전송 초안을 연결한다.
- PC·모바일 공통 응대 결과, 기존 일정 보존, 관리자 요청의 항목별 완료 근거, 저장 실패·늦은 응답·중복 저장 방지 계약 및 SQL 후보.
- 말하기·명함 검토의 입력 보존, 기존 연락처 후보 조회, 생략한 동의 값 보존, 전송 대기 구분.
- K1 날짜 선택은 승인 원본의 날짜 시트를 사용한다. K1 공종·K4 안의 선택은 20건 페이지 이동 중에도 유지한다.
- 최신 Claude PC 견적 기능은 보존한다. 통합 근거는 [master #596 대조](MOBILE_MASTER596_INTEGRATION_20261011.md)에 기록했다.

## 남은 연결

| 범위 | 상태 |
|---|---|
| 승인 화면·합성 예시·초안·복귀 | 로컬 검증 완료 범위를 단계별 문서에 기록 |
| 견적 계산·수정본 저장·제출 확정 | 공통 서버 계약과 운영 설치 확인 전 차단. 모바일 전용 계산 없음 |
| I3 연락처 저장 | 회사·기존 사람 연결 계약이 남아 차단 |
| 음성·명함·PC/모바일 동일 실계정 결과 | 기기 및 운영 연동 검증 필요 |
| SQL 설치·데이터 이관·발송·운영 배포 | 이 게시 작업에서 실행하지 않음 |

## 검토 방법

저장소에서 `npm ci` 후 `node review-preview/server.cjs`를 실행하면 합성 검토 서버가 127.0.0.1:8767에 열린다. 이 서버는 외부 연결과 쓰기 요청을 차단한다. `mobile.html?demo=1&screen=A` 또는 `screen=K-1`, `screen=I-3`으로 확인한다. 원본 디자인 미리보기 8766과 구분한다.

집중 검사는 `node review-preview/verify-quote-calendar.cjs`, `node review-preview/verify-quote-calendar-browser.cjs`, `node review-preview/verify-quote-pagination-selection.cjs`, `node review-preview/verify-quote-draft-recovery.cjs`, `node review-preview/verify-no-legacy-boot.cjs`로 실행한다. 브라우저는 Playwright Chromium 또는 `PLAYWRIGHT_EXECUTABLE_PATH`를 사용한다.

소스·테스트·최소 합성 fixture·인수인계 문서만 게시한다. 운영 조회 원본, 자격정보, 임시 캐시, 중간 패치, 개인 로컬 경로에 의존하는 과거 생성 스크립트는 게시 대상에서 제외한다. 단계별 과거 보고의 로컬 캡처/결과 파일은 그 당시 검증 근거이며 이번 저장소 파일 목록과 같지 않을 수 있다.

상세: [단계 5](MOBILE_CLAUDE_STAGE5_20261011.md) · [단계 6](MOBILE_CLAUDE_STAGE6_20261011.md) · [견적 7](MOBILE_CLAUDE_STAGE7_20261011.md) · [입력 8](MOBILE_CLAUDE_STAGE8_20261011.md) · [날짜·페이지](MOBILE_QUOTE_CALENDAR_REVIEW_20261011.md).
