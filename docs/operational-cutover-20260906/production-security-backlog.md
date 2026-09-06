# Production cutover 보안 Backlog

상태: `OPEN / CURRENT STAGING LEGACY DEBT / NOT PART OF CURRENT FUNCTION CANDIDATE`

2026-09-06 Staging read-only Supabase inspection에서 아래 `public` 테이블 7개가 RLS 비활성으로 다시 확인됐다.

- `advisory_deals`
- `assignment_history`
- `business_history`
- `notes`
- `projects`
- `stage_catalog`
- `stage_history`

이번 기능 후보의 실패나 rollback 사유로 섞지 않는다. 그러나 Production cutover 전에는 각 테이블의 실제 UI/API reachability와 현재 GRANT를 확인하고, 필요한 정책을 설계한 뒤 역할별 JWT 회귀를 통과해야 한다. 정책 없이 RLS만 켜면 기존 read/write가 차단될 수 있으므로 자동 적용하지 않는다.

추가 cutover 항목:

1. `public` 신규 table/function의 Data API 노출을 명시적 GRANT로 관리한다.
2. 노출된 `SECURITY DEFINER` 함수는 `PUBLIC`/`anon` execute를 취소하고 의도된 `authenticated` endpoint만 유지한다.
3. private helper는 노출 schema 밖에 두고 `PUBLIC`/`anon`/`authenticated`/`service_role` 직접 execute를 모두 차단한다.
4. RLS 정책은 단순 `TO authenticated`가 아니라 CRM UUID scope와 역할 predicate를 포함한다.
5. advisor 결과와 역할별 JWT test evidence를 Production cutover 문서에 연결한다.

근거:

- Staging project: `netform-crm-staging / rprechiaglyjaydkmxsu`
- Supabase read-only table inspection: 2026-09-06
- Supabase Security Advisor remediation은 검토용으로만 보관하며 이번 단계에서 실행하지 않았다.
- Production/n8n 접근 및 변경: 0
