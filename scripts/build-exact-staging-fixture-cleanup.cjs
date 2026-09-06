'use strict';

// Builds a narrow, reviewable cleanup for one already-captured disposable run.
// It does not execute SQL and never deletes Storage metadata directly.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const REF = 'rprechiaglyjaydkmxsu';
const RUN = 'stg-e2e-20260906t125239z-fc70f2d2';
const dir = path.resolve(__dirname, '../docs/operational-cutover-20260906/staging-fixture-runs', RUN);
const planFile = path.join(dir, 'fixture-plan.json');
const proofFile = path.join(dir, 'browser-mutation-proof.json');
const outputFile = path.join(dir, 'cleanup-exact.sql');
const verificationFile = path.join(dir, 'cleanup-exact-verify.sql');
const canonicalBaselineFile = path.join(dir, 'cleanup-canonical-baseline-final.json');

const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const proof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
const canonicalBaseline = JSON.parse(fs.readFileSync(canonicalBaselineFile, 'utf8'));
assert.equal(plan.project_ref, REF);
assert.equal(plan.run_id, RUN);
assert.equal(proof.project_ref, REF);
assert.equal(proof.run_id, RUN);
assert.equal(proof.status, 'PASS');
assert.equal(canonicalBaseline.project_ref, REF);
assert.equal(canonicalBaseline.run_id, RUN);
assert.equal(canonicalBaseline.transaction_mode, 'READ ONLY');
assert.ok(Number.isInteger(canonicalBaseline.canonical_deals?.count));
assert.ok(Number.isInteger(canonicalBaseline.canonical_inquiries?.count));
assert.match(canonicalBaseline.canonical_deals?.md5 || '', /^[0-9a-f]{32}$/);
assert.match(canonicalBaseline.canonical_inquiries?.md5 || '', /^[0-9a-f]{32}$/);

const entities = [...new Map(plan.entities.map((item) => [item.id, { kind: item.kind, id: item.id }])).values()];
const requests = [...new Set(proof.results.map((item) => item.request_id).filter(Boolean))];
assert.equal(entities.length, 41);
assert.equal(requests.length, 67);
for (const item of entities) assert.match(item.id, /^[0-9a-f-]{36}$/i);
for (const id of requests) assert.match(id, /^[0-9a-f-]{36}$/i);

const entityValues = entities.map((item) => `  ('${item.kind}', '${item.id}'::uuid)`).join(',\n');
const requestValues = requests.map((id) => `  ('${id}'::uuid)`).join(',\n');
const sql = `-- EXACT DISPOSABLE FIXTURE CLEANUP. REVIEW AND APPROVE BEFORE EXECUTION.
-- Project: netform-crm-staging / ${REF}
-- Run: ${RUN}
-- Scope: ${entities.length} preallocated entity UUIDs + ${requests.length} actually executed request UUIDs.
-- Storage bytes/metadata MUST be removed separately through the Supabase Storage API.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE fixture_ids(kind text NOT NULL, id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO fixture_ids(kind,id) VALUES
${entityValues};
CREATE TEMP TABLE fixture_requests(id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO fixture_requests(id) VALUES
${requestValues};

DO $guard$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'cleanup requires hosted postgres role'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.deals d JOIN fixture_ids f ON f.kind='deal' AND f.id=d.id
    WHERE d.list_fields->>'fixture_run_id' IS DISTINCT FROM '${RUN}'
  ) THEN RAISE EXCEPTION 'refuse cleanup: a Deal UUID is not owned by this fixture run'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.inquiries i JOIN fixture_ids f ON f.kind='inquiry' AND f.id=i.id
    WHERE i.raw->>'fixture_run_id' IS DISTINCT FROM '${RUN}'
  ) THEN RAISE EXCEPTION 'refuse cleanup: an inquiry UUID is not owned by this fixture run'; END IF;
END
$guard$;

CREATE TEMP TABLE cleanup_counts(table_name text PRIMARY KEY, row_count bigint NOT NULL) ON COMMIT DROP;
WITH d AS (DELETE FROM public.assignment_history WHERE opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry') RETURNING 1) INSERT INTO cleanup_counts SELECT 'public.assignment_history',count(*) FROM d;
WITH d AS (DELETE FROM public.contact_assignments WHERE opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'public.contact_assignments',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.audit_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.audit_events',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.command_receipts WHERE request_id IN (SELECT id FROM fixture_requests) OR object_id IN (SELECT id FROM fixture_ids) RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.command_receipts',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.inquiry_audit_events WHERE inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.inquiry_audit_events',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.object_scope WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.object_scope',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.attachment_audit_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.attachment_audit_events',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.customer_support_actions WHERE target_id IN (SELECT id FROM fixture_ids) RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.customer_support_actions',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.deal_attachments WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.deal_attachments',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.deal_close_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.deal_close_events',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.deal_won_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.deal_won_events',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.expansion_pool_events WHERE source_deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.expansion_pool_events',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.expansion_pool WHERE source_deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.expansion_pool',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.message_reminders WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.message_reminders',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.next_action_postponements WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.next_action_postponements',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.quote_versions WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.quote_versions',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.relationship_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.relationship_events',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.message_outcomes WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.message_outcomes',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.stage_transition_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.stage_transition_events',count(*) FROM d;
WITH d AS (DELETE FROM public.next_actions WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry') RETURNING 1) INSERT INTO cleanup_counts SELECT 'public.next_actions',count(*) FROM d;
WITH d AS (DELETE FROM public.activities WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'public.activities',count(*) FROM d;
WITH d AS (DELETE FROM public.stage_history WHERE opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry') RETURNING 1) INSERT INTO cleanup_counts SELECT 'public.stage_history',count(*) FROM d;
WITH d AS (DELETE FROM crm_security.user_opportunity_state WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'crm_security.user_opportunity_state',count(*) FROM d;
WITH d AS (DELETE FROM public.inquiries WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR id IN (SELECT id FROM fixture_ids WHERE kind='inquiry') RETURNING 1) INSERT INTO cleanup_counts SELECT 'public.inquiries',count(*) FROM d;
WITH d AS (DELETE FROM public.deals WHERE id IN (SELECT id FROM fixture_ids WHERE kind='deal') RETURNING 1) INSERT INTO cleanup_counts SELECT 'public.deals',count(*) FROM d;

SELECT table_name,row_count FROM cleanup_counts ORDER BY row_count DESC, table_name;

DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM public.deals WHERE list_fields->>'fixture_run_id'='${RUN}')
     OR EXISTS (SELECT 1 FROM public.inquiries WHERE raw->>'fixture_run_id'='${RUN}')
     OR EXISTS (SELECT 1 FROM crm_security.object_scope WHERE reviewed_by='fixture:${RUN}')
     OR EXISTS (SELECT 1 FROM crm_security.command_receipts WHERE request_id IN (SELECT id FROM fixture_requests))
  THEN RAISE EXCEPTION 'fixture cleanup incomplete'; END IF;
END
$verify$;
COMMIT;
`;

fs.writeFileSync(outputFile, sql);
const sha256 = crypto.createHash('sha256').update(sql).digest('hex');
const verificationSql = `-- EXACT DISPOSABLE FIXTURE CLEANUP VERIFICATION. READ ONLY.
-- Project: netform-crm-staging / ${REF}
-- Run: ${RUN}
-- Run only after exact Storage removal, temporary policy rollback and cleanup-exact.sql.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '30s';
WITH fixture_ids(kind,id) AS (VALUES
${entityValues}
), fixture_requests(id) AS (VALUES
${requestValues}
), remaining_counts(table_name,row_count) AS (
 SELECT 'public.assignment_history',count(*) FROM public.assignment_history WHERE opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'public.contact_assignments',count(*) FROM public.contact_assignments WHERE opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.audit_events',count(*) FROM crm_security.audit_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.command_receipts',count(*) FROM crm_security.command_receipts WHERE request_id IN (SELECT id FROM fixture_requests) OR object_id IN (SELECT id FROM fixture_ids)
 UNION ALL SELECT 'crm_security.inquiry_audit_events',count(*) FROM crm_security.inquiry_audit_events WHERE inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'crm_security.object_scope',count(*) FROM crm_security.object_scope WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'crm_security.attachment_audit_events',count(*) FROM crm_security.attachment_audit_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.customer_support_actions',count(*) FROM crm_security.customer_support_actions WHERE target_id IN (SELECT id FROM fixture_ids)
 UNION ALL SELECT 'crm_security.deal_attachments',count(*) FROM crm_security.deal_attachments WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.deal_close_events',count(*) FROM crm_security.deal_close_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.deal_won_events',count(*) FROM crm_security.deal_won_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.expansion_pool_events',count(*) FROM crm_security.expansion_pool_events WHERE source_deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.expansion_pool',count(*) FROM crm_security.expansion_pool WHERE source_deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.message_reminders',count(*) FROM crm_security.message_reminders WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.next_action_postponements',count(*) FROM crm_security.next_action_postponements WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.quote_versions',count(*) FROM crm_security.quote_versions WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.relationship_events',count(*) FROM crm_security.relationship_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.message_outcomes',count(*) FROM crm_security.message_outcomes WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'crm_security.stage_transition_events',count(*) FROM crm_security.stage_transition_events WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'public.next_actions',count(*) FROM public.next_actions WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'public.activities',count(*) FROM public.activities WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'public.stage_history',count(*) FROM public.stage_history WHERE opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR inquiry_id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'crm_security.user_opportunity_state',count(*) FROM crm_security.user_opportunity_state WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal')
 UNION ALL SELECT 'public.inquiries',count(*) FROM public.inquiries WHERE deal_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR opportunity_id IN (SELECT id FROM fixture_ids WHERE kind='deal') OR id IN (SELECT id FROM fixture_ids WHERE kind='inquiry')
 UNION ALL SELECT 'public.deals',count(*) FROM public.deals WHERE id IN (SELECT id FROM fixture_ids WHERE kind='deal')
), facts AS (
 SELECT
  (SELECT coalesce(sum(row_count),0) FROM remaining_counts) AS fixture_rows,
  (SELECT count(*) FROM storage.objects WHERE id='c5838a9b-7aee-44fd-af88-58331d88f772'::uuid OR (bucket_id='crm-site-files' AND name='deals/431d2489-6e72-44c3-a8d4-41e95d0f0804/31b422c8-ad61-4336-b161-b8c00432d6db')) AS storage_objects,
  (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('crm_fixture_cleanup_select_20260906','crm_fixture_cleanup_delete_20260906')) AS temporary_policies,
  (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='crm_attachment_insert_v1' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[] AND cmd='INSERT' AND qual IS NULL AND with_check LIKE '%crm-site-files%' AND with_check LIKE '%crm_attachment_object_insert_allowed%') AS permanent_insert_policy,
  (SELECT count(*) FROM public.inquiries WHERE raw->>'fixture_run_id' IS DISTINCT FROM '${RUN}') AS canonical_inquiries,
  (SELECT count(*) FROM public.deals WHERE list_fields->>'fixture_run_id' IS DISTINCT FROM '${RUN}') AS canonical_deals,
  (SELECT md5(coalesce(string_agg(to_jsonb(i)::text,'|' ORDER BY i.id),'')) FROM public.inquiries i WHERE i.raw->>'fixture_run_id' IS DISTINCT FROM '${RUN}') AS canonical_inquiries_md5,
  (SELECT md5(coalesce(string_agg(to_jsonb(d)::text,'|' ORDER BY d.id),'')) FROM public.deals d WHERE d.list_fields->>'fixture_run_id' IS DISTINCT FROM '${RUN}') AS canonical_deals_md5
)
SELECT jsonb_build_object(
 'project_ref','${REF}',
 'project_name','netform-crm-staging',
 'run_id','${RUN}',
 'status',CASE WHEN fixture_rows=0 AND storage_objects=0 AND temporary_policies=0 AND permanent_insert_policy=1
   AND canonical_inquiries=${canonicalBaseline.canonical_inquiries.count}
   AND canonical_deals=${canonicalBaseline.canonical_deals.count}
   AND canonical_inquiries_md5='${canonicalBaseline.canonical_inquiries.md5}'
   AND canonical_deals_md5='${canonicalBaseline.canonical_deals.md5}' THEN 'PASS' ELSE 'FAIL' END,
 'table_counts',(SELECT jsonb_object_agg(table_name,row_count ORDER BY table_name) FROM remaining_counts),
 'verified_fixture_db_rows_remaining',fixture_rows,
 'storage_objects_remaining',storage_objects,
 'temporary_storage_policies_remaining',temporary_policies,
 'permanent_insert_policy_count',permanent_insert_policy,
 'canonical_inquiries',canonical_inquiries,
 'canonical_deals',canonical_deals,
 'canonical_inquiries_md5',canonical_inquiries_md5,
 'canonical_deals_md5',canonical_deals_md5,
 'transaction_mode','READ ONLY',
 'production_requests',0,
 'n8n_requests',0
) AS cleanup_verification FROM facts;
ROLLBACK;
`;

fs.writeFileSync(verificationFile, verificationSql);
const verificationSha256 = crypto.createHash('sha256').update(verificationSql).digest('hex');
console.log(JSON.stringify({
 status: 'GENERATED_NOT_RUN', project_ref: REF, run_id: RUN,
 entities: entities.length, requests: requests.length,
 output: outputFile, sha256,
 verification: verificationFile, verification_sha256: verificationSha256
}));
