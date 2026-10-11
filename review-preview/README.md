# 승인 모바일 합성 검토

`node review-preview/server.cjs` 후 `http://127.0.0.1:8767/mobile.html?demo=1&screen=A`를 연다. 견적 v3는 `screen=K-1`, 입력 검토는 `screen=I-3`으로 연다.

운영 로그인·데이터 저장·고객 발송용 서버가 아니다. 외부 연결을 차단한 합성 예시다. 승인 원본의 화면 구성과 실제 저장 계약의 연결 상태는 `../docs/MOBILE_GITHUB_SYNC_20261011.md`를 참고한다.

검사에는 `npm ci`와 Playwright 브라우저가 필요하다. `PLAYWRIGHT_EXECUTABLE_PATH`로 설치된 Chromium 계열 실행 경로를 지정할 수 있다.
