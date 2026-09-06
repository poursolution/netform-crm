# P05E expected amount local chain candidate

판정: `DERIVED_SAFE_LOCAL_CANDIDATE`, Staging 미적용.

- 실제 `public.deals.amount`와 PC/모바일 forecast의 `amt`는 예상금액이다. `0`은 현재 UI에서 미입력으로 되돌리는 값이며 별도 `amount_unknown_reason`을 위조하지 않는다.
- PC 상세와 문제함의 기존 외부 op `amount`/ACK를 유지한다. 다만 `quote_amount`는 최신 append-only `quote_version`의 concurrency snapshot으로만 허용하고, 서버 정본과 다르면 409다.
- `won_amount`는 Closed Won transaction의 정본이므로 이 경로에서는 반드시 null이다. 견적·수주 금액 직접 편집을 성공으로 가장하지 않는다.
- actor/scope/version/receipt/private audit를 서버에서 확정하며 동일 request replay는 추가 audit 0, payload 재사용과 stale version은 409다.
- read overlay는 actual `amount`를 PC `amt`, 모바일 `amt`로 명시적으로 alias하고 최신 견적 projection을 유지한다.

P05Q(사유 없는 견적 직접 편집)와 P05W(수주 전 수주금액 직접 편집)는 `NEEDS_VERIFICATION`이다. P05Q는 기존 `quote_version`의 append-only/사유 필수 규칙과 충돌하고, P05W는 아직 닫히지 않은 Closed Won 계약을 우회한다.

적용 순서는 기존 로컬 chain의 `pipeline-close-nonwon/20260906` 뒤다. live OID/hash guard와 Staging JWT/PC 검증 전에는 PASS로 계산하지 않는다.
