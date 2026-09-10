'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260910025323_add_inquiry_business_type.sql'),
  'utf8'
);
const projectionMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260910030754_project_inquiry_business_type.sql'),
  'utf8'
);

test('business type is separate from origin brand and customer type', () => {
  assert.match(migration, /add column if not exists business_type text/);
  assert.match(migration, /business_type in \('견적문의', '기술자문'\)/);
  assert.doesNotMatch(migration, /set\s+brand\s*=/i);
  assert.doesNotMatch(migration, /set\s+inquiry_type\s*=/i);
  assert.doesNotMatch(migration, /set business_type[\s\S]{0,500}updated_at\s*=/i);
  assert.match(migration, /inquiry_type\(customer type\) remain unchanged/);
});

test('ingest accepts an explicit class and has a conservative text fallback', () => {
  assert.match(migration, /p_payload ->> ''business_type''/);
  assert.match(migration, /p_payload ->> ''문의종류''/);
  assert.match(migration, /INVALID_BUSINESS_TYPE/);
  assert.match(migration, /기술\\s\*자문\.\{0,12\}\(아님\|아니\|해당\\s\*없\|무관\)/);
  assert.match(migration, /v_business_type_source := ''explicit''/);
  assert.match(migration, /v_business_type_source := ''message''/);
  assert.match(migration, /v_business_type_source := ''default''/);
});

test('dedup can upgrade to technical advisory but never silently downgrade it', () => {
  assert.match(migration, /when i\.business_type = ''기술자문'' or v_business_type = ''기술자문'' then ''기술자문''/);
  assert.match(migration, /''견적문의'', v_business_type, v_assignee_user_id/);
  assert.match(migration, /''business_type'', v_business_type/);
});

test('only the three reviewed legacy candidates are required by the postcheck', () => {
  for (const id of [
    '7beba9d3-996c-4035-899b-0dea7f1e4e52',
    'ae0e7dc9-094f-415f-bfe3-f93d454cd0ed',
    'cb75ebfd-7c5d-4013-b715-17c6c6bf650e'
  ]) assert.match(migration, new RegExp(id));
  assert.match(migration, /expected 3, got %/);
  assert.doesNotMatch(migration, /delete\s+from/i);
});

test('service RPC remains browser-inaccessible and fails closed on source drift', () => {
  assert.match(migration, /signature drift; no change applied/);
  assert.match(migration, /revoke execute on function public\.crm_inquiry_ingest_v1\(jsonb\)\s+from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.crm_inquiry_ingest_v1\(jsonb\)\s+to service_role;/);
});

test('operational inquiry read projects business type without replacing adjacent fields', () => {
  assert.match(projectionMigration, /i\.brand,i\.inquiry_type,i\.business_type,i\.work_type/);
  assert.match(projectionMigration, /marker_count <> 1/);
  assert.match(projectionMigration, /crm_operational_source_fragment_pre_inquiry_response_20260906\(text,uuid,integer\)/);
  assert.match(projectionMigration, /active operational inquiry projection chain drift/);
  assert.match(projectionMigration, /has_function_privilege\('authenticated', function_oid, 'EXECUTE'\)/);
});
