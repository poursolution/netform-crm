'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260913213000_harden_inquiry_mirror_race.sql'), 'utf8');

test('mirror bridge is narrow, opposite-path only and serialized by phone plus brand', () => {
  assert.match(sql, /crm_inquiry_mirror:/);
  assert.match(sql, /v_sheet_row is null and i\.sheet_row is not null/);
  assert.match(sql, /v_sheet_row is not null and i\.sheet_row is null/);
  assert.match(sql, /interval '30 seconds'/);
  assert.match(sql, /v_event_date is not null/);
  assert.match(sql, /v_mirror_candidate_count = 1/);
  assert.match(sql, /INGEST_MIRROR_IDENTITY_CONFLICT/);
});

test('mirror bridge preserves the installed monotonic owner update path', () => {
  assert.doesNotMatch(sql, /update public\.inquiries[\s\S]*assigned_to\s*=/i);
  assert.match(sql, /private\.inquiry_ingest_idempotency/);
  assert.match(sql, /signature drift; no change applied/);
});

test('browser roles remain unable to execute the service ingest RPC', () => {
  assert.match(sql, /revoke execute[\s\S]*public, anon, authenticated/);
  assert.match(sql, /grant execute[\s\S]*to service_role/);
  assert.match(sql, /has_function_privilege\('anon'/);
  assert.match(sql, /has_function_privilege\('authenticated'/);
});
