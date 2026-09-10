'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(
  __dirname,
  '../supabase/migrations/20260911090000_harden_inquiry_ingest_idempotency.sql'
), 'utf8');

test('the installed ingest core is captured only after fail-closed drift checks', () => {
  assert.match(migration, /pg_get_functiondef\('public\.crm_inquiry_ingest_v1\(jsonb\)'::regprocedure\)/);
  assert.match(migration, /recent_sheet_phone_brand_site/);
  assert.match(migration, /v_business_type text;/);
  assert.match(migration, /core signature drift; no change applied/);
  assert.match(migration, /private\.crm_inquiry_ingest_core_20260911/);
});

test('idempotency keys are narrow event identities rather than broad customer identities', () => {
  assert.match(migration, /'sheet:' \|\| v_sheet_row::text/);
  assert.match(migration, /event_id/);
  assert.match(migration, /submission_id/);
  assert.match(migration, /message_id/);
  assert.match(migration, /form_response_id/);
  assert.match(migration, /request_id/);
  assert.match(migration, /v_event_date is not null and v_phone <> '' and v_brand <> '' and v_site <> ''/);
  assert.match(migration, /fingerprint:v1:/);
  assert.doesNotMatch(migration, /unique\s*\([^)]*phone[^)]*brand[^)]*site_name/i);
});

test('concurrent collection paths lock deterministically and conflicting aliases fail closed', () => {
  assert.match(migration, /array_agg\(distinct k order by k\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /INGEST_IDENTITY_CONFLICT/);
  assert.match(migration, /INGEST_SHEET_IDENTITY_CONFLICT/);
  assert.match(migration, /rolls back the core insert as well/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.inquiries/i);
});

test('replay enrichment never replaces an existing owner UUID', () => {
  assert.match(migration, /assigned_to = coalesce\(i\.assigned_to, v_assignee_user_id\)/);
  assert.match(migration, /where u\.active is true and btrim\(u\.name\) = v_assignee/);
  assert.match(migration, /if v_assignee_count <> 1 then[\s\S]*?v_assignee_user_id := null/);
  assert.match(migration, /when i\.business_type = '기술자문' or v_business_type = '기술자문'/);
});

test('the ingest boundary and its private state remain service-role only', () => {
  assert.match(migration, /security invoker/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /alter table private\.inquiry_ingest_idempotency enable row level security;/);
  assert.match(migration, /revoke all on table private\.inquiry_ingest_idempotency\s+from public, anon, authenticated;/);
  assert.match(migration, /revoke execute on function public\.crm_inquiry_ingest_v1\(jsonb\)\s+from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.crm_inquiry_ingest_v1\(jsonb\)\s+to service_role;/);
  assert.doesNotMatch(migration, /nfrnd\.app\.n8n\.cloud|jandi\.com|googleapis\.com/i);
});
