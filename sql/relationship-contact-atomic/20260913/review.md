# 관계관리 연락 기록 + 다음 연락일 통합 저장

상태: UI_ADAPTER_QUEUE_CONNECTED / PRODUCTION_MIGRATION_READY / 운영 DB 미적용.

## 현재 계약 확인

현재 `relationship_response`는 발송한 메시지에 대한 유효한 고객 응답을 연결하는 계약이다. 일반 전화 기록과 다음 연락일을 저장하려고 임의의 발송 이력을 만들거나 이 계약을 우회하지 않는다.
기존 `activity`, `next_action`은 각각 별도의 버전 증가와 receipt를 가진다. 브라우저에서 두 번 호출하면 원자 저장이 아니다.

## 구현 상태

`helper.local.sql`의 비공개 함수 안에서 두 기존 private helper를 호출한다. 하나의 DB 호출/트랜잭션이므로 두 번째 쓰기 또는 마지막 연결 작업 실패 시 첫 번째 쓰기도 롤백된다. 이 helper 파일 자체는 공개 RPC, 기존 함수, 테이블 및 receipt 제약을 변경하지 않는다. 별도 `dispatcher.local.sql`은 로컬에서만 새 operation 연결을 검증한다.

운영 UI는 `relationship_contact` 한 작업만 영속 큐에 넣는다. `operational-adapter.js`는 입력과 ACK를 검증하고, `operational-overlay.js`는 검증된 ACK 이후에만 화면 정본을 갱신한다. 운영 적용용 migration은 `supabase/migrations/20260913193000_relationship_contact_atomic.sql`, 역방향 복구는 `rollback.production.sql`이다. 두 파일은 아직 Production DB에 실행하지 않았다.

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

## 저장큐 / 클라이언트 / 복구 검증 추가

- `client.candidate.js`: 입력과 ACK를 엄격히 검증하는 선택적 adapter 확장. 기존 `operational-adapter.js` 객체를 수정하지 않으며 어느 운영 HTML에서도 로드하지 않는다.
- `extendAdapter()`는 기존 `transport.js`의 영속 큐를 그대로 사용한다. 같은 UUID 재시도, 저장 중 새로고침의 uncertain 복원, 계정 종료 시 큐 제거를 검증했다.
- `createController()`는 단독 연결 검증용이다. 운영에는 이 메모리 컨트롤러와 기존 큐를 중복 설치하지 않는다. 운영 연결 시 기존 영속 큐를 사용한다.
- `queue.test.cjs`는 현재 transport 원본 + 합성 SDK/fetch + PGlite의 공개 dispatcher를 연결한다. DB 호출은 `SET ROLE authenticated`로 수행한다. 외부 HTTP·실제 로그인·Production 데이터 쓰기는 없다.
- 공개 dispatcher는 authenticated만 실행 가능하며 private helper/이전 delegate는 직접 실행을 금지한다.
- `rollback.local.sql`은 이전 dispatcher의 OID/본문/ACL을 복구하고 activity/next/audit/receipt는 삭제하지 않는다.
- 운영 helper 대조에서 일반 action 본문은 로컬 기본 helper와 일치했으나, 앞에 postpone/message_reminder routing이 존재했다. 이 routing을 통한 의미 변경을 막도록 자식 payload 키를 delegate 호출 전에 제한했다.

검증 실행: `node --test sql/relationship-contact-atomic/20260913/*.test.cjs`.
현재 결과: 27 PASS / 0 FAIL / 0 SKIP.

## 운영 적용 전 남은 작업

1. 최신 운영 helper 정의/권한과 로컬 기반의 차이를 재대조한다. 과거 fixture 통과는 현재 Production 통과를 뜻하지 않는다.
2. 운영 migration/rollback의 guard hash·owner·ACL을 적용 직전 최신 Production 정의와 재확인한다. transport는 기존 `crm_write_command_v2`만 사용하며 RPC URL allowlist를 늘리지 않는다.
3. 실제 승인된 테스트 계정/대상에서 HTTP 저장, RLS, 두 세션 동시 편집을 검증한다. PGlite 직렬 테스트를 실제 동시성 E2E라고 보고하지 않는다.
4. 활동을 선택해 기존 Next를 완료하는 의미와 여러 일정 중 교체 대상을 지정하는 기능은 별도 계약으로 유지한다. 현재 저장이 임의로 기존 일정을 닫지 않는다.

실행: `node --test sql/relationship-contact-atomic/20260913/db.test.cjs`

롤백: 로컬 체인 복구까지 검증했다. 테스트 종료 시 임시 DB를 닫으며 운영 변경은 없다. 운영용 rollback은 실제 적용 직전 정의와 배포 이력에 맞춰 별도 검증해야 한다.
