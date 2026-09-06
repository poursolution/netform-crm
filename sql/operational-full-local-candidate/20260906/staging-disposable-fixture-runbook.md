# Disposable Staging fixture compiler runbook

Status: `COMPILER_READY_CATALOG_REQUIRED_NOT_RUN`. This does not authorize Staging apply, fixture setup, mutation E2E, Storage upload, or cleanup.

Allowed target: `netform-crm-staging / rprechiaglyjaydkmxsu` only. Production `ymfbmpnizxvqsamnczow`, n8n, and operating Pages are forbidden.

Prerequisites:

1. The exact cumulative apply has separate user approval and has completed successfully.
2. `staging-fixture-catalog.sql` was executed after that apply and its captured JSON passes `validate-staging-fixture-catalog.cjs`.
3. The generated Coverage Matrix and mutation E2E plan are source-fresh.
4. A unique run id is chosen in the form `stg-e2e-YYYYMMDDtHHMMSSz-xxxxxxxx` using lowercase UTC and eight random hexadecimal characters.

Compile locally:

```text
node sql/operational-full-local-candidate/20260906/build-staging-disposable-fixture.cjs <captured-catalog.json> <run-id> <empty-output-dir>
```

The compiler fails closed on a wrong project, incomplete catalog, candidate hash drift, secret-like input, missing cleanup selector, unsupported required column, or non-empty output directory. It emits four review artifacts and does not connect to Supabase:

- `fixture-plan.json`: deterministic Inquiry/Deal/request UUID inventory and scenario ownership.
- `setup.sql`: one guarded transaction. It copies only canonical synthetic templates into new run-owned UUID rows and adds Admin/Gyeongnam scopes. It never updates canonical rows.
- `cleanup.sql`: one guarded fixture-only finalizer. It derives runtime-created Deal IDs only from this run's fixed request receipt ACKs, clears the Inquiry/Deal cycle, and deletes FK children before parents.
- `storage-cleanup-plan.json`: exact bucket prefix and Storage API list/remove/re-list procedure.

Review gates before any setup execution:

1. Re-run both catalog and compiler tests; do not count SKIP as PASS.
2. Compare the catalog SHA-256 and cumulative apply SHA-256 printed in both SQL artifacts with the approved evidence.
3. Confirm every created row uses only the new run UUIDs and contains `fixture_run_id`; canonical fixture UUIDs may appear only as template/source rows or referenced user/site/contact assets.
4. Confirm `cleanup.sql` contains no broad date/name predicate and no Storage SQL.
5. Keep execution serial. Capture private receipt/audit/history counts before cleanup.

Storage cleanup must use the Supabase Storage API. Do not delete rows directly from `storage.objects`, because the database row and underlying object can diverge. Only exact object paths returned under `crm-staging-e2e/<run-id>/` may be removed.

The purge scenario may have no Inquiry row left at cleanup time. That absence is expected only for its preallocated purge UUID; every remaining run-marked Inquiry/Deal and scope must be zero after the finalizer.
