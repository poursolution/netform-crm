# Staging read-only preflight runbook

Status: `READY_NOT_RUN`. This runbook is not approval to apply the candidate.

Allowed target: `netform-crm-staging / rprechiaglyjaydkmxsu` only. Production `ymfbmpnizxvqsamnczow`, n8n, and operating Pages are forbidden.

1. Confirm the selected Supabase project name and ref in the database client before opening the SQL file.
2. Rebuild the package with `node sql/operational-full-local-candidate/20260906/build.cjs` and require a clean freshness result from `node scripts/verify-operational-cutover.cjs`.
3. Execute only `staging-readonly-preflight.sql`. It starts `BEGIN READ ONLY`, performs catalog `SELECT`/`DO` checks, emits one `preflight_result` JSON value, and commits without DDL/DML.
4. Save the emitted JSON value as a new evidence file. Do not edit fields or copy the earlier 25-operation preflight result.
5. Validate it with `node sql/operational-full-local-candidate/20260906/validate-staging-readonly-preflight.cjs <captured-result.json>`.
6. Stop on any SQL exception or validator failure. Report the first drift only; do not apply compensating SQL and do not run `staging-apply.sql`.
7. A validator PASS proves only the current read-only baseline. Separate approval is still required for apply, JWT role-matrix/E2E, UI read-back, n8n-zero network evidence, and rollback rehearsal.

The result must match the exact apply/rollback SHA-256 values embedded by the builder, the frozen four-operation Dispatcher/read/helper metadata, and all candidate inventory counts. `READY_NOT_RUN` must not be relabeled as Staging PASS before an actual captured result validates.
