# Staging advisor — operational bundle 적용 후

대상: `netform-crm-staging / rprechiaglyjaydkmxsu`

판정: bundle의 공개 Dispatcher/private helper ACL과 빈 `search_path` 검증은 PASS했다. Advisor에는 이번 bundle에서 새로 만든 테이블·view가 없으며, 기존 legacy 보안·성능 경고가 계속 남아 있다.

Production cutover 전 별도 backlog:

- RLS disabled public tables: `advisory_deals`, `assignment_history`, `business_history`, `notes`, `projects`, `stage_catalog`, `stage_history`
- security-definer legacy views: `opportunities`, `v_assignee`, `v_dup_org`, `v_funnel`, `v_kanban`
- mutable `search_path` legacy functions와 RLS policy/performance/index advisory

이번 업무 bundle에 섞어 수정하지 않았으며 rollback 사유로 처리하지 않는다. 정본 backlog는 `production-security-backlog.md`다.

Supabase remediation reference: https://supabase.com/docs/guides/database/database-linter
