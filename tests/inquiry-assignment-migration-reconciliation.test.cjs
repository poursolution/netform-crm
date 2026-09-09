'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const original = fs.readFileSync(path.join(root, 'supabase/migrations/20260908091500_inquiry_assignment_race_repair.sql'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260909232153_reconcile_inquiry_assignment_and_reverse_race.sql'), 'utf8');

test('the previously committed migration remains immutable', () => {
  assert.doesNotMatch(original, /서비스운영팀\(송보람\)|recent_sheet_phone_brand_site|903f0af2-de76-4a7f-9976-9d4b367fc08b/);
});

test('the follow-up migration records both arrival orders and the approved alias', () => {
  assert.match(migration, /서비스운영팀\(송보람\)/);
  assert.match(migration, /target_name := ''송보람''/);
  assert.match(migration, /v_assignee := ''송보람''/);
  assert.match(migration, /recent_sheet_phone_brand_site/);
  assert.match(migration, /10 minutes/);
  assert.match(migration, /idx_inquiries_sheet_phone_brand_site_received/);
  assert.match(migration, /inquiry ingest reverse-race signature drift/);
  assert.match(original, /target_name := btrim\(coalesce\(p_payload->>'to', p_payload->>'assignee_name', ''\)\);/);
  assert.match(original, /v_assignee := nullif\(btrim\(coalesce\([\s\S]*?p_payload ->> '담당자'[\s\S]*?\)\), ''\);/);
  assert.match(original, /if v_candidate\.id is not null then[\s\S]*?status = coalesce\(v_status, i\.status, '접수'\),/);
});

test('only the five reviewed duplicates and exact row 402 are reconciled', () => {
  const duplicateIds = [
    'a59391de-3cda-456f-be21-812cbc44ce79',
    '284b7335-31db-483d-97ad-d87f3b1a4a46',
    '99ec9878-acfd-48cb-a105-d0620ddbc9d8',
    'dfdf123e-0a3a-4160-8099-34e4103301fd',
    '08d701c3-034c-4954-8083-cba90a36b923'
  ];
  for (const id of duplicateIds) assert.match(migration, new RegExp(id));
  assert.match(migration, /'sheet_row', 402/);
  assert.match(migration, /83ee1e70-a002-4a32-9044-c10992034f81/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.inquiries/i);
  assert.doesNotMatch(migration, /nfrnd\.app\.n8n\.cloud|jandi\.com|googleapis\.com/i);
});

test('repeat execution accepts the verified post-state and rechecks it', () => {
  assert.match(migration, /or \(\s*d\.status = '종결'/);
  assert.match(migration, /approved duplicate postcheck failed/);
  assert.match(migration, /reverse-race cleanup postcheck failed/);
  assert.match(migration, /and coalesce\(i\.status, ''\) not in \('종결', '종료'\)/);
});

test('both service functions remain unavailable to browser roles', () => {
  for (const fn of ['crm_inquiry_assignment_sync_v1', 'crm_inquiry_ingest_v1']) {
    assert.match(migration, new RegExp(`revoke execute on function public\\.${fn}\\(jsonb\\)\\s+from public, anon, authenticated;`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\(jsonb\\)\\s+to service_role;`));
  }
});
