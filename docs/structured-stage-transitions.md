# Target-specific stage transitions

PC Deal 상세/빠른 입력과 모바일 단계 이동은 `stage-transition.js`의 동일 규칙과
`stage-transition-ui.js`의 동일 양식을 사용한다. 일반 활동기록은 변경하지 않는다.

## Local implementation

- 공통: 목표 단계, 전환일, 선택 메모. 필수 질문은 목표 단계에서만 표시.
- 순방향 기본 경로 외 이동은 건너뛰기/되돌림 사유가 필수다.
- Closed Won은 completion에서만 선택 가능하고 공사/준공검사 완료 확인을 요구한다.
- 금액 입력은 쉼표 표시, 쓰기 payload에서는 숫자다.
- 후속확인/재접촉일이 명시된 경우에만 Next를 요청한다. 이동 자체는 유효접촉이 아니다.
- 준공 완료일과 CRM 입력일을 구분하며 확장 Pool은 실제 준공일을 기준으로 요청한다.
- 기존 전환 기록과 공종 데이터는 지우지 않는다. 질문의 공종·범위 텍스트는 전환 근거이며
  Opportunity의 구조화 공종 Master를 자동으로 덮어쓰지 않는다.

## Production integration — NOT yet verified/applied

이 저장소에는 운영 n8n crm-write 분기 원본이 없다. 기존 `transition`/`close` 요청에
구조화 필드를 추가했지만, 일반 성공 응답만으로 해당 필드 영구저장을 보장하지 않는다.
로컬 테스트는 네트워크 없는 fixture에 한정한다. 운영 고객의 단계는 테스트로 변경하지 않았다.

운영 반영 시 다음을 한 번에 연결해야 한다:

1. `sql/20260905_structured_stage_transition.sql` 적용.
2. crm-write의 transition/close가 `stage_context`를 처리하도록 수정.
   원본 Stage 행 잠금 → 권한·현재 단계·필수 필드·준공조건·날짜·금액 검증 →
   stage 변경 + `deals.stage_contexts[target]` 갱신 + 전환 ledger INSERT를 같은 transaction으로 처리.
   `write_id`는 멱등키, actor는 클라이언트 이름이 아니라 서버 인증 사용자에서 가져온다.
   클라이언트 `stage_contexts` 전체를 덮어쓰지 말고 해당 target snapshot만 병합한다.
3. 전환일을 stage_entered_at에 반영한다. contract_amount/completion_date는 실제 운영 schema의
   정본 필드에 매핑한다. 계약 체결은 outcome=won으로 바꾸지 않는다.
4. close(outcome=won)는 서버에서도 from=completion 및 준공일/공사완료/검사완료를 검사한다.
   새 전환 ledger와 동일한 검증이 없는 레거시 win 요청으로 우회하지 못하도록 한다.
5. Activity/Next/확장 Pool 요청은 기존 쓰기 큐로 별도 전달된다. 현재 클라이언트만으로
   이 다중 요청의 원자성을 보장하지 않는다. 운영 backend에서 동일 전환 키의 후속 작업으로
   묶고, 실패 시 재시도/중복방지 및 부분실패 표시를 구현해야 한다.
6. crm-api Deal 응답에 stage_contexts 및 권한 내 전환이력을 포함한다.
7. 승인된 테스트 Deal로 저장 → 강제 새로고침 → 다른 기기 조회 → 같은 질문/금액/날짜 유지,
   중복 제출/서버 실패/부분 실패/준공 이전 수주 종료 거부를 확인한다.

완료 문구는 현재 '저장 요청'이다. 서버 구조화 반영 검증 전 '영구저장 완료'로 표시하지 않는다.

검증: `node --test tests/stage-transition.test.cjs` (외부 쓰기 없음).
