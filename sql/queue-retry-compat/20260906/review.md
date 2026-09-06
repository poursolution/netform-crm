# PC/mobile uncertain write retry compatibility

상태: `DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED`

C04는 새 업무 op가 아니라 기존 명령 큐의 수동 복구 기능이다. 서버 응답을 확인하지 못한 `uncertain` 항목만 같은 `request_id`, operation, object, expected version, payload로 다시 전송한다. 서버의 공통 receipt가 실제 반영 여부를 판정하고 동일 요청이면 기존 ACK를 replay한다.

`409 conflict`와 확정적인 `rejected`는 재전송 대상이 아니다. PC와 모바일 배지는 두 상태를 “서버 확인 필요”로 표시하고 자동·수동 재전송 버튼을 제공하지 않는다. 네트워크/응답 유실인 `uncertain`만 “같은 요청 다시 시도” 버튼을 제공한다.

이 후보는 최신 O02 누적 UI overlay에만 추가된다. DB 함수·테이블·ACL·RLS를 변경하지 않으며, Staging/Production/n8n에 접근하거나 적용하지 않았다. 실제 Staging 승격은 현재 연결된 모든 operation에 대해 응답 유실 → 수동 재시도 → receipt replay → 중복 0을 PC/mobile 실제 JWT로 검증한 뒤에만 가능하다.
