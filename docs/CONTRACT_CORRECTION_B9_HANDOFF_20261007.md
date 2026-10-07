# B9 계약금액 정정 — 서버 계약 및 Claude 연결

2026-10-07. 대상: poursolution/netform-crm. 화면 위치·디자인 변경 없음.

## 범위와 현재 상태

인수인계서 B9에 명시된 영업건 계약금액·계약실적 정정을 구현한다. 예상금액까지 승인 대상으로 확대하는 것은 미확정이므로 제외한다. 독립 기술자문 계약, 계약 취소/취소 복원, 최초 계약일·계약 당시 귀속 변경은 이 명령의 대상이 아니다.

원래 계약금액과 최초 체결 기록은 보존한다. 요청은 원장을 바꾸지 않는다. 기존 예외 승인자가 승인하면 실제 효력일의 차액을 `amended` 이벤트로 추가한다. 같은 요청자가 자신의 요청을 승인할 수 없다. 현재 영업건 쓰기 권한도 요구하므로 승인자라는 이유로 원래 접근하지 못하던 영업건을 수정할 수 없다.

아래 파일은 로컬 구현·검증 중이다. 운영 적용·화면 입력 연결 완료를 의미하지 않는다.

## 같은 PR에 포함할 파일

- `sql/contract-correction-approval-20261007.sql`: 기존 승인 종류에 `contract_amount` 추가. 기존 6종류/승인 함수는 보존. 승인 상태 변경 트리거가 원장 반영을 같은 트랜잭션으로 처리한다.
- 새 비공개 표 `crm_security.contract_correction_requests(actor_auth_uid, request_id, approval_id, payload, ledger_request_id, applied)`: 요청 재전송 방지와 적용된 원장 이벤트 ACK 보존. RLS 및 직접 접근 차단.
- `contract-correction.js`: 아래 두 RPC의 게이트/검증/동일 UUID 재시도. 새 입력 창을 그리지 않는다.
- `pc-manager-transport.js`, `pc-error-state.js`: 두 RPC 허용·오류 이름.
- `crm.html`: 기능 스크립트 연결 한 곳.
- `approval-inbox.js`: 기존 목록에서 요청 종류 이름을 표시하고 승인 후 원장을 재조회하는 기능만 추가. 마크업·CSS 유지.
- `tests/contract-correction-client.test.cjs`, `tests/contract-correction-postgres.test.mjs`, `package.json`: 회귀 검사.

## Claude가 연결할 데이터

`ContractCorrection.enabled()`가 참일 때만 다음 API를 사용한다. 이 모듈은 자동으로 요청을 생성하지 않는다.

1. `await ContractCorrection.preview(dealId)`
   - 선택한 영업건 한 건만 조회한다.
   - `deal_id`, `source_event_id`, `expected_version`, `balance`, `contract_amount`, `contract_date`, `sales_owner`, `last_effective_date`, `cancelled`, `previous_balance` 반환.
   - `previous_balance`는 마지막 원장 이벤트가 `amended`일 때만 그 이벤트 직전 잔액이다. 처음 체결된 계약이면 null이며 0원으로 해석하지 않는다.
2. 사용자가 실제 정정 금액과 실제 효력일·사유를 확인한 뒤 `await ContractCorrection.request({...})` 호출.

```js
await ContractCorrection.request({
  deal_id: preview.deal_id,
  source_event_id: preview.source_event_id,
  expected_version: preview.expected_version,
  target_balance: confirmedWon,       // 사용자가 확인한 양의 정수 원 금액
  effective_date: confirmedDate,     // 사용자가 확인한 YYYY-MM-DD
  reason: confirmedReason            // 1~300자
});
```

날짜를 승인일/오늘로 자동 채우지 않는다. `DecisionCollab.changes`의 표시용 `from`/`to`나 잘린 문장에서 금액을 추출하지 않는다. 표시 목록의 금액 변화가 원장 이벤트와 연결됐다는 증거 없이 `previous_balance`를 그 변화의 이전 값이라고 표시하지 않는다.

현재 `DecisionCollab.revert(kind='amount')`는 일반 `ApprovalRequest.open()`만 호출하며, 기존 창에는 위 원장 식별자·정정 금액·효력일을 전달하는 계약이 없다. 이 입력 연결/위치 결정은 Claude 몫이다. Codex는 새 입력 칸·새 창·배치를 만들지 않았다. 이 부분이 연결되기 전에는 금액 되돌리기 사용자 흐름이 완료된 것이 아니다.

## 승인과 실패

- 요청 ACK의 `request`를 기존 승인함에 반영한다. 요청 시 원장 금액은 유지한다.
- 기존 `crm_approval_decide_v1`의 승인/반려, `crm_approval_request_v1(cancel:true)`의 거두기를 그대로 사용한다.
- 원장 버전 또는 기준 이벤트가 바뀌면 승인 전체가 실패하고 요청은 pending으로 남는다. 새 금액으로 조용히 재계산하지 않는다. 오래된 요청을 반려/거둔 뒤 최신 조회로 다시 요청한다.
- 원장 쓰기 실패 시 승인 상태·원장·영수증이 모두 롤백된다.
- 같은 UUID 재전송은 같은 승인 건을 돌려준다. 다른 내용으로 UUID를 재사용하면 거부한다. 같은 영업건의 계약금액 정정은 대기 1건만 허용한다.
- cancelled 계약, 0원/음수 금액, 근거 없는 원장, 미래/이전 원장보다 이른 효력일, 변경 없는 금액은 거부한다.
- 금액 정정만으로 단계·현재 담당·최초 sales_owner·인센티브·수금·계약 건수를 바꾸지 않는다.

## 적용 순서

필수 CI → 위 SQL 적용 → 함수/권한/매니페스트 확인 → 같은 PR의 클라이언트 병합 → Pages 확인. 실제 고객 계약을 테스트로 변경하거나 승인하지 않는다. 입력 화면 연결은 Claude가 완료 후 합성 브라우저 검사로 검증한다.

보안 기준 참고: [Supabase Database Functions](https://supabase.com/docs/guides/database/functions) — 명시적 실행 권한과 빈 search_path 사용.
