# Expansion Pool update local candidate

Verdict: `DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED` for X01 only.

The reachable PC controls call `expansionSetStatus` and `expansionSetNext`, which converge on the existing external operation `expansion_pool_update`. The visible status vocabulary maps uniquely to five legacy stored values. `Pipeline 전환` is deliberately excluded because it belongs to X03 and requires sent-quote evidence plus atomic child Deal creation.

The candidate runs only after the local Closed Won candidate. It adds a private Pool version and private change-event ledger, keeps the existing external operation and ACK envelope, checks the source Deal through `crm_security.can_deal(..., true)`, and writes status/date/event/Deal audit/receipt atomically. Client `updated_at`, actor, last-contact, need-note, relationship, and created-Deal fields never become authority.

Rollback retains the business status/date, archives events/audits/receipts, removes only this versioned compatibility layer, and restores the exact Closed Won dispatcher/read functions. No Staging DDL/DML has been performed.
