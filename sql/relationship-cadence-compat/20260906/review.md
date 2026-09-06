# M05 relationship cadence compatibility contract

Status: `DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED` — local Adapter/SQL/rollback and tests exist; no Staging DDL or DML has been performed.

## `relationship_hold`

- Reachable only through PC `relV8Hold` and mobile `relHoldM`.
- Absorb the immediately derived replacement Next Action into one versioned command.
- Persist a private hold event, update Deal `wake_up_at` and version, replace the current open Next Action, and write audit/receipt atomically.
- Do not invent an Activity: the current UI does not create one for hold.
- The server owns actor/time and requires a future KST date. Client reason is bounded business text, not authority.

## `relationship_response`

- Reachable only when the existing PC/mobile activity helper marks an Activity meaningful and emits the response child.
- Absorb that exact Activity into the response command; direct response writes remain blocked.
- Resolve and lock exactly one outbound: the latest same Deal/person `crm_security.message_outcomes` row whose status is `sent`, whose occurrence is not after the Activity, and which has no response yet.
- Mark that outcome responded, create one meaningful Activity and one private response event, update Deal activity/contact timestamps and version, and write audit/receipt atomically.
- Cancel only the linked message outcome's still-open `next_action_id`; never cancel unrelated Deal work.
- `sent` remains user-attested. A response does not fabricate provider delivery.

## Read contract

`last_outbound_at`, `outbound_attempts`, `last_customer_response_at`, current hold fields, and message `response_at/response_kind` are derived from the private M02 outcome and M05 event ledgers and exposed only through the existing actor-scoped operational read.

## Local candidate boundary

- PC `relV8Hold` and mobile `relHoldM` are the only hold entry points; their legacy `relationship_hold + next_action` pair is collapsed into one command.
- Only the existing meaningful PC `logActivity` / mobile `addActivity(..., true)` paths may create a response command. The exact Activity is absorbed so it cannot be written twice.
- Direct unwrapped calls, provider-delivery inference, unrelated Next Action cancellation, and synthetic hold Activity remain fail-closed.
- Apply order is after M02 `message-log-compat`; rollback archives M05 evidence and restores the M02 write/read layer.
