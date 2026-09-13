# 관계관리 연락 기록 + 다음 연락일 통합 저장

상태: LOCAL_VALIDATION_ONLY / 운영 미적용 / UI 미연결.

## 현재 계약 확인

현재 `relationship_response`는 발송한 메시지에 대한 유효한 고객 응답을 연결하는 계약이다. 일반 전화 기록과 다음 연락일을 저장하려고 임의의 발송 이력을 만들거나 이 계약을 우회하지 않는다.
기존 `activity`, `next_action`은 각각 별도의 버전 증가와 receipt를 가진다. 브라우저에서 두 번 호출하면 원자 저장이 아니다.

## 로컬 후보

`helper.local.sql`의 비공개 함수 안에서 두 기존 private helper를 호출한다. 하나의 DB 호출/트랜잭션이므로 두 번째 쓰기 또는 마지막 연결 작업 실패 시 첫 번째 쓰기도 롤백된다. 공개 RPC, 기존 함수, 테이블 및 receipt 제약은 변경하지 않는다.

- 입력: request UUID, Deal UUID, expected version, `{activity, next_action}`.
- 연락 성공 여부 `meaningful_contact`는 명시적으로 받는다. 부재/전화 시도는 성공 접촉일을 갱신하지 않는다.
- actor와 권한은 기존 서버 access review/can_deal로 결정한다. 클라이언트 actor/role/owner 필드는 거절한다.
- 다음 행동 담당자는 현재 승인된 Deal owner를 사용한다. 이 기능으로 재배정하지 않는다.
- 열린 관계관리 Deal(`rapport/silent/waiting`)만 새 요청을 받는다.
- 기존 미완료 일정이 두 개 이상이면 자동 취소하지 않고 충돌로 반환한다.
- request UUID로 두 child UUID를 결정한다. 재시도는 기존 receipt를 재사용하며 payload 변경은 충돌이다.
- Next Action의 `source_activity_id`를 이번 연락 기록에 연결한다.
- 기존 helper 두 개를 재사용하므로 **Deal version은 2 증가하고 audit/receipt는 각각 2개**다. 한 번 저장을 버전 1 증가로 오해하면 안 된다. 클라이언트는 ACK의 version을 사용해야 한다.
- 이메일·문자·카카오·잔디 알림이나 n8n 호출은 없다.

## 운영 적용 전 별도 작업

1. 최신 운영 helper 정의/권한과 로컬 기반의 차이를 재대조한다. 과거 fixture 통과는 현재 Production 통과를 뜻하지 않는다.
2. 공개 dispatcher/transport allowlist에 단일 operation을 추가하는 승인된 migration·rollback을 별도로 준비한다. 이 파일 자체는 배포용 migration이 아니다.
3. UI의 두 입력을 한 요청으로 연결하고 ACK 전 성공표시/로컬 정본 변경을 금지한다. 통신 응답 유실은 같은 request UUID로 조회/재시도한다.
4. 활동을 선택해 기존 Next를 완료하는 의미와, 여러 일정 중 교체 대상을 지정하는 기능은 이 후보에 포함하지 않는다.
5. 실제 승인된 테스트 계정/대상에서 HTTP 저장, RLS, 두 세션 동시 편집을 검증한다. PGlite 직렬 테스트를 실제 동시성 E2E라고 보고하지 않는다.

실행: `node --test sql/relationship-contact-atomic/20260913/db.test.cjs`

롤백: 이 후보는 로컬 임시 DB에만 설치된다. 테스트 종료 시 DB를 닫으며 운영 변경은 없다. 운영용 rollback은 공개 계약 확정 후 별도 작성해야 한다.
