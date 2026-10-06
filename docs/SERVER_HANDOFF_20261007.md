# Server integration — 2026-10-07

Scope: Claude PR491/493/494 UI unchanged. No CSS, markup placement, pipeline response fields, n8n workflows or outbound notifications added.

## Consultation relationships

- Enable existing preview/write RPCs and the permission-filtered list RPC in transport/error names and CRMRelease.
- Install prerequisite `sql/inquiry-consultation-links.sql` only for a fresh database. It is already installed in production.
- Then install `sql/inquiry-consultation-index-20261007.sql` to add last link event time/actor to the existing paged lookup.
- `InquiryConsultationIndex.of(id)` uses a selected-inquiry read, memory cache, in-flight deduplication, and identity/invalidation epochs. A confirmed empty read differs from failure. No full sheet scans or scheduled polling.
- Existing detail placement and comparison evidence checks remain. The current single-partner UI uses the first authorized direct peer in stable UUID order. This does not merge inquiries or propagate assignments, status, bad fit, notifications or performance.
- No real inquiry pair was linked/unlinked during verification.

## Inquiry contact results

- Install `sql/inquiry-contact-two-results-20261007.sql`.
- Nullable `crm_security.inquiry_contact_logs.contact_result/customer_reaction`; no historical guesses/backfill. Existing `result`, classification and first-contact timestamps remain.
- Existing form labels normalize via InquiryFlow.TWO; both detail entry paths, the list intermediary and durable command payload retain the two fields.
- Server validates enums, connected-only reaction and agreement with legacy result. Idempotency includes both fields. Reads and audit retain them.
- Old clients/SMS events without the new fields remain valid. No changes to pipeline contact logs.

## Today requests

- Production refresh showed enabled [요청 보내기] plus [문구 복사].
- Existing server create RPC accepts target_type=inquiry and first/deadline/contract/quote/support/follow; administrator-only, self-recipient rejection and duplicate pending-request guard are present.
- No live request or message was sent as a test. No new request workflow was required.

## Dashboard company scope (additional user decision)

- Production has no `crm_direct_read`; current operational reads are `crm_operational_source_v1/v2`, with a separate contract ledger RPC.
- Install `sql/dashboard-read-all-20261007.sql`. New read-only source/ledger RPCs admit reviewed active admin/rep/branch actors; anonymous, missing/revoked identity and consultation-only roles are denied.
- Current ordinary read/write predicates, RLS and writer functions are not modified.
- DashboardData keeps its company snapshot separate from B and ordinary operational caches, only selected on dash/control/perf. It does not persist company data to browser storage. Partial failures never become a partial company total.
- Same existing OperationalUI normalization, SalesInsights/BriefB calculations and contract event ledger validation; no separate period or nextRate calculation.
- Core direct contact identifiers are omitted from the dashboard projection. Existing ordinary detail permissions still apply when opening a record.
- Contract amounts, dates, attribution and events are read as stored; no ledger rewrite. A reassign/complete operation cannot change attribution through this work.

## Release order and verification

1. Verify the current production function definitions still match the read-only capture before replacing the inquiry command/state/list bodies.
2. Apply the three reviewed SQL files in order: contact fields, consultation lookup, dashboard reads.
3. Verify manifest, role grants, schema, read-only company scope, unchanged write predicates and database advisors.
4. Required Quality Gate must pass before frontend merge; verify published assets and existing UI positions after Pages completes.

Synthetic database/client tests cover inquiry two-field validation/replay/ownership; link index reload/logout/unlink races; dashboard all-record pagination, ledger attribution, denied roles, unchanged foreign write predicate and isolated frontend cache.
Operational data changes and actual outgoing messages are not used as tests.
