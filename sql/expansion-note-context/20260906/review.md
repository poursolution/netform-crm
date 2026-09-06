# Expansion note/context local candidate

Verdict: `DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED` for X02.

The current PC button has one write meaning: append a trimmed contact/need note to the source Closed Won Pool. Refresh has one read meaning: return the actor-scoped Pool event history plus quote dispatch evidence. This candidate preserves the existing RPC names and ACK shapes, derives both Auth and CRM actors on the server, scopes through the source Deal, and uses the private event/audit/receipt rail added by X01.

There is still no verified quote-dispatch ledger. `crm_expansion_context` therefore returns an explicitly empty `dispatches` array with `dispatch_completeness=unavailable_until_X03`; this keeps “견적 발송 확인·전환” disabled instead of inventing provider evidence. X03 remains blocked.

Rollback archives note events/audits/receipts, restores the X01 receipt allowlist, and removes only these two public RPCs. No Staging DDL/DML has been performed.
