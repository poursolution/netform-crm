# Cumulative Staging JWT read-only runbook

Status: `READY_NOT_RUN`. This is the post-apply read/authorization gate, not write E2E and not a deployment approval.

Allowed target: `netform-crm-staging / rprechiaglyjaydkmxsu` only. Production `ymfbmpnizxvqsamnczow`, n8n, operating Pages, service-role/secret keys, and database credentials are forbidden.

The opt-in harness is `tests/operational-full-jwt-readonly.test.cjs`. Without every required environment value it performs no network request and reports `SKIP (not PASS)`.

Required environment:

```text
CRM_RUN_OPERATIONAL_FULL_STAGING_READONLY=1
STAGING_PROJECT_REF=rprechiaglyjaydkmxsu
STAGING_CONFIRM_PROJECT_REF=rprechiaglyjaydkmxsu
STAGING_SUPABASE_URL=https://rprechiaglyjaydkmxsu.supabase.co
STAGING_PUBLISHABLE_KEY=<sb_publishable_...>
STAGING_SYNTHETIC_AUTH_FILE=<local synthetic account JSON>
```

The harness authenticates the five reviewed synthetic roles (`INTERNAL_REP`, `OTHER_REP`, `CONSULT`, `GYEONGNAM`, `ADMIN`) and verifies:

- Auth UUID to CRM UUID profile mapping;
- real SQL `42501` denial for anonymous profile/scoped reads;
- complete, duplicate-free pagination for `deal_core`, `inquiry_core`, `expansion_pool`, `customer_support_action`, and `message_log` for every role;
- the legacy `crm_read_scoped_v2` contract for every role;
- all generated `crm_security` helpers and relations remain absent from the public PostgREST surface;
- exact Staging origin, redirect refusal, publishable-key-only access, and zero CRM writes/Production/n8n requests.

On an actual run it writes only the local evidence file `docs/operational-cutover-20260906/operational-full-jwt-readonly-results.json`; it does not write CRM rows. A PASS is required before mutation E2E but cannot substitute for the per-feature success/replay/reuse/scope/read-back/audit/restore suite.
