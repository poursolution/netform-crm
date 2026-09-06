# Post-apply Staging fixture catalog runbook

Status: `READY_NOT_RUN`. This runbook does not authorize apply, fixture creation, or mutation E2E.

Allowed target: `netform-crm-staging / rprechiaglyjaydkmxsu` only. Production `ymfbmpnizxvqsamnczow`, n8n, and operating Pages are forbidden.

Prerequisites:

1. The cumulative read-only preflight has a captured validator PASS.
2. A separate user approval has authorized the exact 31-operation `staging-apply.sql` hash.
3. Apply completed without drift and before any runtime `opportunity_create`, `inquiry_purge`, or Closed Won event.

Procedure:

1. Reconfirm the selected project name/ref and the current cumulative manifest hashes.
2. Execute only `staging-fixture-catalog.sql`. It is one `BEGIN READ ONLY` transaction and emits one `fixture_catalog_result` JSON value.
3. Save only that emitted JSON value without editing it.
4. Run `node sql/operational-full-local-candidate/20260906/validate-staging-fixture-catalog.cjs <captured-result.json>`.
5. Stop on any SQL or validator failure. Do not compensate, create rows, alter grants, or weaken RLS.

The catalog records columns, constraints/FKs, indexes, non-internal triggers, policies, effective table privileges, the four public entrypoint ACLs, and exact presence of the checked-in canonical synthetic UUIDs. It proves no mutation behavior. Its only purpose is to make the later disposable fixture setup/cleanup SQL FK-aware and reviewable.

New `public` objects must not rely on historical automatic Data API grants. Any public entrypoint needed by the UI must have an explicit reviewed `GRANT EXECUTE`; private relations remain RLS-enabled with no `anon` or `authenticated` table privileges. Storage object cleanup must use the Storage API and a run-prefixed path, not direct SQL deletion from `storage.objects`.
