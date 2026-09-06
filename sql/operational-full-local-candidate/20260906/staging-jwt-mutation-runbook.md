# Staging JWT mutation runbook

Status: `READY_HAPPY_REPLAY_NOT_RUN`. This document and its harness do not authorize Staging apply, fixture setup, mutation, or cleanup.

The harness uses only the exact Staging origin `https://rprechiaglyjaydkmxsu.supabase.co`, a publishable key, and six synthetic user password sessions. Service-role/secret keys, database URLs, Production, n8n, redirects, and direct private-table access are rejected before the first request. This follows Supabase's separation of table grants from RLS and keeps authorization proof on real user JWTs.

## Reviewed execution order

1. Obtain separate approval for the cumulative apply and execute the already reviewed `staging-apply.sql` only on `rprechiaglyjaydkmxsu`.
2. Capture and validate the post-apply catalog.
3. Compile a new run-owned fixture directory with `build-staging-disposable-fixture.cjs`. Review `setup.sql`, `cleanup.sql`, `fixture-plan.json`, and the Storage cleanup plan.
4. Execute only the approved generated `setup.sql` on Staging. Do not alter canonical synthetic rows.
5. Set all harness variables named in `tests/operational-full-jwt-mutation.test.cjs`. `STAGING_MUTATION_PROOF_FILE` must be a new file under `docs/operational-cutover-20260906`; existing proof is never overwritten.
6. Run only `node --test tests/operational-full-jwt-mutation.test.cjs`. The run is serial. Every dispatcher happy-path mutation and `crm_expansion_note` is replayed with the same request id; ACKs are checked against the compatibility adapter. Read-only scenarios and the signed Storage upload lifecycle also execute.
7. If the harness fails, preserve the proof and generated fixture directory. Do not improvise repairs or run rollback. Report the exact failure point and whether fixture cleanup is still safe.
8. After evidence review, remove only the exact Storage run prefix through the Storage API, execute the generated child-before-parent `cleanup.sql`, and require zero run-owned rows/objects. Never delete from `storage.objects` with SQL.

## Deliberate remaining gate

This harness is not yet the final mutation PASS gate. It covers concrete happy paths and exact-request replay for all 31 operations, but request-id changed-payload `409`, stale-version `409`, foreign-owner denial, per-domain evidence cardinality, and exact refresh assertions still need to be encoded per scenario. Its result mode is therefore `JWT_DISPOSABLE_MUTATION_HAPPY_REPLAY`, not `STAGING_COMPAT_PASS`.

Supabase references used for the harness design: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [JavaScript RPC](https://supabase.com/docs/reference/javascript/rpc), [createSignedUploadUrl](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl), and [uploadToSignedUrl](https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl).
