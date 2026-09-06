'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const snapshot = JSON.parse(read('sql/operational-bundle/20260906/after.json'));
const columns = table => new Set(snapshot.public.columns.filter(row => row.table === table).map(row => row.name));
const functions = new Set(snapshot.public.functions.map(row => row.signature));

test('current Golden UI contains each reachable inquiry management operation', () => {
  const pc = read('crm.html');
  const mobile = read('mobile.html');
  for (const op of ['inquiry_status', 'inquiry_trash', 'inquiry_restore', 'inquiry_purge', 'inquiry_reclassify', 'inquiry_consultant']) {
    assert.match(pc, new RegExp(`pushWrite\\('${op}'`));
  }
  assert.match(mobile, /pushWrite\('inquiry_followup'/);
});

test('legacy inquiry_duplicate handler is dead and the quick menu routes to Data Cleanup', () => {
  const pc = read('crm.html');
  assert.match(pc, /function inqCtlOpenDuplicate\(k\)\{goPage\('dup'\);DataCleanupUI\.search/);
  assert.match(pc, /function inqCtlResolveDuplicate/);
  assert.equal((pc.match(/inqCtlResolveDuplicate\(/g) || []).length, 1, 'legacy handler has no caller');
  assert.match(read('data-cleanup-ui.js'), /crm_cleanup_preview/);
  assert.match(read('data-cleanup-ui.js'), /crm_cleanup_apply/);
});

test('generic PC inquiry status selector has no server status write', () => {
  const pc = read('crm.html');
  const start = pc.indexOf('function splitSaveStatus()');
  const end = pc.indexOf('function localCreatedDeals()', start);
  assert.ok(start >= 0 && end > start);
  const segment = pc.slice(start, end);
  assert.doesNotMatch(segment, /pushWrite\('inquiry_status'/);
  assert.match(segment, /autoPromote\(q\)/);
});

test('actual inquiry schema lacks hold, trash, reclassification, consultant, and duplicate state', () => {
  const inquiry = columns('inquiries');
  for (const present of ['id', 'brand', 'status', 'assigned_to', 'assigned_at', 'next_action_date', 'deal_id', 'opportunity_id', 'raw', 'updated_at']) {
    assert.ok(inquiry.has(present), `inquiries.${present} must exist`);
  }
  for (const absent of [
    'hold_reason', 'held_at', 'valid_inquiry', 'deleted_at', 'deleted_by', 'delete_reason',
    'delete_note', 'purge_at', 'archive_protected', 'trash_snapshot', 'restored_at', 'restored_by',
    'business_type', 'legacy_review_status', 'legacy_reviewed_at', 'legacy_reviewed_by',
    'consultant_id', 'consultant_name', 'consulted_at', 'consultation_status',
    'duplicate_resolution', 'duplicate_of_inquiry_id', 'duplicate_reviewed_at'
  ]) {
    assert.equal(inquiry.has(absent), false, `inquiries.${absent} must remain an explicit blocker`);
  }
});

test('actual public schema has no dedicated inquiry management history or cleanup RPC', () => {
  const relations = new Set(snapshot.public.relations.map(row => row.name));
  for (const absent of ['crm_inquiry_status_history', 'crm_inquiry_consultation_history', 'crm_inquiry_trash_history']) {
    assert.equal(relations.has(absent), false);
  }
  for (const prefix of ['public.crm_cleanup_state', 'public.crm_cleanup_preview', 'public.crm_cleanup_apply']) {
    assert.equal([...functions].some(signature => signature.startsWith(prefix + '(')), false);
  }
});

test('current scoped inquiry read does not project the missing management state', () => {
  const fn = snapshot.public.functions.find(row => row.signature.startsWith('public.crm_read_scoped_v2('));
  assert.ok(fn);
  for (const absent of ['hold_reason', 'held_at', 'deleted_at', 'trash_snapshot', 'consultant_name', 'consultation_status', 'duplicate_resolution']) {
    assert.doesNotMatch(fn.definition, new RegExp(`i\\.${absent}\\b`));
  }
});

test('hard delete can silently sever reverse Deal lineage in the current schema', () => {
  const fk = snapshot.public.constraints.find(row =>
    row.table === 'deals' && row.name === 'deals_origin_inquiry_id_fkey');
  assert.ok(fk);
  assert.match(fk.definition, /REFERENCES public\.inquiries\(id\) ON DELETE SET NULL/);
});

test('Dispatcher receipt allow-list excludes inquiry management operations', () => {
  const check = snapshot.private.constraints.find(row =>
    row.table === 'command_receipts' && row.name === 'command_receipts_operation_check');
  assert.ok(check);
  for (const op of ['inquiry_status', 'inquiry_followup', 'inquiry_trash', 'inquiry_restore', 'inquiry_purge', 'inquiry_reclassify', 'inquiry_consultant', 'inquiry_duplicate']) {
    assert.doesNotMatch(check.definition, new RegExp(`'${op}'`));
  }
});
