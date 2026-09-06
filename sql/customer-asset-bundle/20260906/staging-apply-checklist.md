# A04D Staging pre-apply checklist

This bundle is not approved or applied. Complete every item immediately before a future Staging-only application.

- [ ] Target project name/ref is exactly `netform-crm-staging / rprechiaglyjaydkmxsu`.
- [ ] Production, n8n bodies and operating Pages have not been opened.
- [ ] Run `SET crm.customer_asset_ref='rprechiaglyjaydkmxsu';` plus `preflight.sql` as a read-only session.
- [ ] Save the returned JSON as new evidence; `matches_expected=true` and a numeric live OID are mandatory.
- [ ] Compare that evidence hash with the approval note. Do not infer or substitute an OID.
- [ ] Rebuild `manifest.json`; every listed file/source hash must match.
- [ ] Confirm public `crm_write_command_v2` and frozen work/direct-assign functions are outside candidate/rollback diffs.
- [ ] Confirm the function signature, LF-normalized definition MD5, owner, definer flag, language, volatility, strictness, parallel, leakproof, config, ACL and LF-normalized `can_deal` MD5 match the preflight expected block. Keep raw MD5 only as evidence of the source serialization.
- [ ] Confirm required `deals`, `contacts`, `contact_assignments`, `sites` columns/types match candidate guards.
- [ ] Any normalized definition or metadata mismatch is drift: stop. Do not patch around it.
- [ ] If later approved, apply `candidate.sql` only once. It must preserve the captured live OID.
- [ ] Run authenticated owner/scoped-admin/foreign/anonymous read tests and PC/mobile projection checks.
- [ ] Confirm all business table row counts/checksums are unchanged and n8n/Production requests are zero.
- [ ] On failure, run `rollback.sql` only if its candidate-definition guard passes; verify exact baseline MD5/ACL/config/OID restoration.
