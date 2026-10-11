# Claude 모바일 원본 구현 — 단계 4 로컬 확인본

## [단계 4] 연락 결과 D · 초안 보존 · I-4 전송 대기 연결

사용자가 직접 지정한 8766 미리보기와 같은 `guide42-screens.json`의 D / I-4 원본 HTML을 표시 기준으로 사용했다. 화면을 별도로 재구성하지 않고 원본 노드에 입력·저장 기능을 연결했다. 아래 결과는 로컬 합성 확인본이며 운영 배포 결과가 아니다.

### 바뀐 파일

- `mobile-approved-d-source.js`: 제공된 D 원본 HTML.
- `mobile-contact-view.js`, `mobile-contact-view.css`: 원본 D 바인딩, 3칸 입력·미리보기, 원본 시각 크기를 유지한 터치 영역. 이전 CSS가 칩 높이와 링크 굵기를 바꾸던 상속을 이 화면에서 해제.
- `mobile-entry.js`: 저장 중 또는 일부 저장 이후 제출한 입력 잠금. 이미 저장된 응대는 재생성하지 않고 남은 요청 처리만 재시도. D 파일 누락 시 구형 입력으로 복귀하지 않음.
- `mobile-pending-model.js`: 현재 계정의 저장 journal과 기존 queue를 읽어 기록 단위로 묶음. 미저장 초안은 전송 건수에 포함하지 않으며, 읽기 실패는 0건으로 표시하지 않음. 조회만으로 재전송하지 않음.
- `mobile-pending-view.js`: I-4 원본 배너와 전송 대기 목록에 부분 저장·실패·충돌 상태를 연결.
- `mobile-guide-shell.js`, `mobile-guide-shell.css`, `mobile-approved-boot.js`, `mobile.html`: 오늘 배너 → I-4 → 해당 D 복원 연결. 현재 담당의 영업건만 다시 열며 목록은 공용 ListPager로 최대 20건. 문의·독립 일정 변경의 미연결 입력으로 우회하지 않음.
- `review-preview/fixture.js`: 같은 합성 예시를 새로고침할 때 미저장 초안 보존. 예시 범위 전환 또는 `reset=1`은 합성 초안을 초기화.
- `review-preview/verify-d-draft-lifecycle.cjs`, `verify-pending-model.cjs`, `verify-pending-flow.cjs`, `verify-design-d.cjs`, `verify-no-legacy-boot.cjs`: 집중 검사와 캡처.

### 추가·바꾼 데이터 필드

서버 필드·SQL 변경 없음. 기존 MobileSaveJournal / Phase1 queue를 읽는 화면 연결과 클라이언트 입력 잠금만 추가했다. 새 상태명은 서버 업무 상태가 아니라 로컬 저장 확인 상태이며, 관리자의 요청 완료 판정은 기존 공통 계약을 따른다.

### 점검표 통과 / 미통과

| 검사 | 결과 |
|---|---|
| D 원본 스타일 및 동작 | 8개 통과. 원본 28개 노드 인라인 선언 차이 0. 320 / 375 / 480px 가로 넘침 없음. 칩 시각 높이 40 / 38px, 별도 터치 영역 44px |
| 초안·저장 생명주기 | 7개 통과. 뒤로·재진입·실제 preview 새로고침 보존, 영업건별 분리, 제출 값 잠금, 부분 실패 시 ID 재사용 |
| 전송 대기 모델 | 20개 통과. 계정 분리, 응답 검증, 기록 단위 집계, 부분 저장·충돌 구분, 원본 I-4 HTML 일치 |
| 전송 대기 화면 흐름 | 9개 통과. 부분 실패 → 오늘 → I-4 → 복원 → 명시적 재시도 → 배너 제거, 21건 쪽 나눔 |
| 연락·요청 공통 동작 | 7개 통과. 연결·부재·미선택 요청 유지·복합 요청 자동 완료 차단·중복 방지·외부 쓰기 차단 |
| 기존 UI 차단 | 8개 통과. 로드 지연·실패·구형 renderer·debug·D source/view 누락 |
| A/B/C 회귀 | A 원본/이동 검사 및 B/C 8개 통과 |

저장 실패 예시는 실제 응대 1건이 먼저 확인된 뒤 관리자 요청 회신만 한 번 실패하도록 구성했다. I-4에서 열거나 뒤로 이동할 때는 추가 저장을 하지 않는다. 사용자가 재시도하면 같은 응대 ID를 유지하고 남은 회신만 처리한다. 성공 후 오늘 화면으로 돌아오면 보관 배너가 사라진다.

### PC와 다른 점 / 검증 경계

- 연락 결과 5값, ContactEntry 판단, 기존 저장 경로는 유지. PC 코드·계산식은 변경하지 않음.
- 실제 동일 계정으로 PC·모바일 저장 결과를 대조하지 않았음. fixture의 큐는 메모리 전용이며 운영 RPC·외부 발송은 차단.
- 미저장 초안은 기존 30분 보존 기준을 유지. 저장 진행 중 새로고침 이후 실제 큐 복구와 앱 종료 복원은 미검증.
- iOS Safari / Android Chrome 실기기 검증은 미실시.
- 사진 업로드·사진만 재전송하는 계약은 미연결. 사진 저장이 된 것처럼 보이는 합성 행을 만들지 않음.
- 방문·문의 전용 입력, 고객 정보 변경, E/F/H와 견적 9화면은 이 단계에서 연결하지 않았음. 안내만 제공하고 구형 입력 화면은 열지 않음.
- 자동 재전송 구현 완료를 주장하지 않음. I-4에서 기록을 열어 확인한 뒤 D의 재시도를 직접 누르는 경로를 검증.

### 질문(디자인 결정 필요한 것)

이번 D / I-4 적용에는 추가 디자인 결정 없음. 나머지 승인 화면은 별도 단계다. 이전 통합 패치·verification-manifest는 이번 변경을 포함하지 않으므로 배포용으로 사용하지 않는다.

### 확인 화면

- 연락 결과: http://127.0.0.1:8767/mobile.html?demo=1&review=contact
- 부분 실패 예시: http://127.0.0.1:8767/mobile.html?demo=1&review=retry
  - 연결됨 → 상담 내용 → 관리자 연락 요청 선택 → 저장 → 합성 실패 → 뒤로 → 오늘 → 보관 기록 보기 → 기록 → 재시도.
- D 캡처: `review-preview/approved-d-implemented.png`
- I-4 캡처: `review-preview/approved-i4-implemented.png`

아래는 앞 단계 이력이며 최신 D 및 전송 대기 결과는 위 표가 기준이다.

## 후속 단계 3 — A/B/C 원본 적용과 기존 UI 노출 차단

- 원본: `outputs/mobile-design-20261011/guide42-screens.json` A/B/C. 사용자가 8766의 A 화면을 직접 지정한 지시를 우선하여 같은 묶음의 B/C를 연결했다. 기존 임의 재구성 B/C 표시 함수와 CSS는 교체했다.
- A/B/C 원본 노드의 인라인 배치·스타일을 보존하고 데이터·행 선택·검색·뒤로 가기만 연결했다. 단계 필터명은 PC 공통 PipelineStages에서 읽는다. 원본 예시의 약칭과 실제 필터명은 다를 수 있다.
- B 검색·단계 필터·쪽 번호·검색 상태 복원 연결. 목록은 공용 ListPager로 최대 20건. 원본에 구체적인 필터 창이 없는 필터 버튼은 별도 디자인을 만들지 않고 미연결 안내로 유지.
- C 실제 연락 업무는 D에 연결한다. 발송·방문 등 다른 목적을 임의로 연락 결과 입력에 연결하지 않는다. 예시 C의 개략 금액 발송은 견적/발송 원본 연결 전까지 실행하지 않는다.
- 기존 방문 입력·독립 일정 변경·연락 입력 끄기 후 옛 입력으로의 복귀를 차단했다. 날짜 변경은 새 D 내부 흐름에서 가능하다.
- 첫 렌더 전에 boot CSS/JS로 앱 영역을 잠근다. 승인 renderer가 준비된 DOM만 노출하며, 느린 스크립트·실패·debug 화면·기존 renderer의 덮어쓰기에도 구형 화면을 보여주지 않는다. 화면 추가 없이 로딩 전에는 앱 영역을 숨긴다.

### 바뀐 파일

- `mobile-approved-bc-source.js`, `mobile-approved-bc.js`: B/C 원본과 데이터 바인딩.
- `mobile-approved-boot.css`, `mobile-approved-boot.js`: 초기/실패/구형 renderer 노출 차단.
- `mobile-guide-shell.js`, `mobile-guide-shell.css`: 원본 B/C 연결, 재구성 UI 제거, 검색·쪽 번호·복귀 상태.
- `mobile-entry.js`: 미연결 옛 입력 진입 차단. 저장 계약 변경 없음.
- `mobile.html`: boot 및 B/C 스크립트 로드.
- `review-preview/fixture.js`, `verify-approved-bc.cjs`, `verify-no-legacy-boot.cjs`: 합성 원본 예시와 검증.

### 점검 결과와 경계

- `approved-bc-verification.json`: 8개 통과. B/C 원본 인라인 스타일 대조, 검색 상태, 20건 제한, 다른 작업의 연락 입력 오연결 방지, 옛 경로 차단, 320/375/480px 가로 넘침 없음.
- `no-legacy-boot-verification.json`: 6개 통과. 로드 지연·실패·구형 직접 renderer 및 debug 진입.
- `approved-a-verification.json`: A 원본 스타일/텍스트 및 A→B→C→D→C→B 통과.
- `design-d-verification.json`: 기존 D 디자인/동작 7개 통과.
- `verification.json`: 연락/요청/실패 재시도/외부 쓰기 차단 7개 통과.
- 서버 필드·SQL·PC 변경 없음. 운영 데이터 저장·배포·실계정·실기기 검증 없음. 관리자 화면과 나머지 승인 화면은 미연결이며 전체 완료가 아니다.
- `?screen=B`와 `?screen=C`는 제공된 그림의 예시 데이터를 읽는 로컬 전용 검토다. 운영 데이터나 실제 연락/견적 금액을 의미하지 않는다. 예시에서 실제 외부 앱 이동·운영 저장은 차단한다.

검토: http://127.0.0.1:8767/mobile.html?demo=1&screen=B
