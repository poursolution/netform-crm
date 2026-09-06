# Messaging domain M01-M06 — review-only bundle

상태: `CONTRACT_REVIEW_ONLY / NO_SQL_CANDIDATE / PUBLIC_DISPATCHER_UNCHANGED / STAGING_NOT_APPLIED`

## 판정

| ID | 판정 | 연결 여부 |
|---|---|---|
| M01 외부 앱 열기 | `CONFIRMED / EXTERNAL_APP` | DB command 아님 |
| M01 사전 시도 Activity | `NEEDS_VERIFICATION` | 미연결 |
| M02 발송 사후 확인 기록 | `NEEDS_VERIFICATION` | 미연결 |
| M03 Clipboard 복사 | `CONFIRMED / EXTERNAL_APP` | DB command 아님 |
| M04 담당자 발송 알림 예약 | `NEEDS_VERIFICATION` | 미연결 |
| M05 hold/response cadence | `NEEDS_VERIFICATION` | 미연결 |
| M06 campaign queue/callback | `NEEDS_VERIFICATION` | 미연결 |

완전한 서버 operation으로 `DERIVED_SAFE`인 항목이 없으므로 `candidate.sql`, `rollback.sql`, adapter는 만들지 않았다. 과거 messaging/campaign SQL은 실제 Staging에 없는 relation을 전제하고 현재 UUID 권한·receipt·audit·version/ACK 계약을 충족하지 않으므로 재사용하지 않는다.

상세 handler, payload, side effect, read-back과 각 부족 규칙은 `docs/operational-cutover-20260906/messaging-contracts.md`에 있다.

## 원자 경계만 확정 가능한 부분

- M02: user-attested message outcome + sent Activity + optional Next Action + counters + receipt/audit
- M04: reminder Activity + Next Action + receipt/audit
- M05 hold: Deal hold state + 재접촉 Next Action + Activity + receipt/audit
- M05 response: meaningful Activity + outbound linkage + cadence reset + receipt/audit
- M06: queue DB commit / provider execution / authenticated idempotent callback을 각각 분리

이 경계는 구현 승인이 아니다. 실제 storage/read/권한 규칙이 확정되기 전에는 연결하지 않는다.
