'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const snapshot = JSON.parse(read('sql/operational-bundle/20260906/after.json'));
const relation = name => snapshot.public.relations.find(row => row.name === name);
const columns = name => new Set(snapshot.public.columns.filter(row => row.table === name).map(row => row.name));
const constraints = name => snapshot.public.constraints.filter(row => row.table === name);
const createPreflight = JSON.parse(read('docs/operational-cutover-20260906/staging-opportunity-create-preflight-20260906.json'));
const createResolution = JSON.parse(read('docs/operational-cutover-20260906/opportunity-create-resolution-20260906.json'));

test('final structured transition handler is loaded after the shared definitions in PC and mobile', () => {
  const pc = read('crm.html');
  const mobile = read('mobile.html');
  for (const html of [pc, mobile]) {
    const definitions = html.lastIndexOf('stage-transition.js');
    const handler = html.lastIndexOf('stage-transition-ui.js');
    assert.ok(definitions >= 0, 'shared transition definitions must be loaded');
    assert.ok(handler > definitions, 'final structured UI must load after definitions');
  }
});

test('reachable Pipeline lifecycle operations remain present in Golden UI', () => {
  const pc = read('crm.html');
  const mobile = read('mobile.html');
  const transition = read('stage-transition-ui.js');

  assert.match(pc, /pushWrite\('opportunity_create'/);
  assert.match(mobile, /pushWrite\('opportunity_create'/);
  assert.match(pc, /pushWrite\('assign'/);
  assert.match(pc, /pushWrite\('handover'/);
  assert.match(mobile, /pushWrite\('assign'/);
  assert.match(mobile, /pushWrite\('handover'/);
  assert.match(transition, /pushWrite\(terminal\?'close':'transition'/);
  assert.match(transition, /pushWrite\('activity'/);
  assert.match(transition, /pushWrite\('next_action'/);
  assert.match(transition, /pushWrite\('expansion_pool_upsert'/);
});

test('actual schema has scalar lifecycle/history support but not structured transition, handover, or expansion storage', () => {
  for (const table of ['deals', 'inquiries', 'stage_history', 'assignment_history', 'activities', 'next_actions']) {
    assert.ok(relation(table), `${table} must exist in the actual snapshot`);
  }

  const deal = columns('deals');
  for (const name of ['id', 'owner_id', 'origin_inquiry_id', 'stage_code', 'lifecycle_status', 'outcome', 'closed_at', 'amount', 'version']) {
    assert.ok(deal.has(name), `deals.${name} must exist`);
  }
  for (const name of ['stage_context', 'stage_contexts', 'completion_date', 'won_amount', 'contract_amount']) {
    assert.equal(deal.has(name), false, `deals.${name} must remain an explicit blocker`);
  }

  const stage = columns('stage_history');
  for (const name of ['opportunity_id', 'inquiry_id', 'from_stage', 'to_stage', 'reason', 'actor_id', 'changed_at']) {
    assert.ok(stage.has(name), `stage_history.${name} must exist`);
  }
  assert.equal(stage.has('stage_context'), false);
  assert.equal(stage.has('context'), false);

  const assignment = columns('assignment_history');
  assert.ok(assignment.has('from_owner'));
  assert.ok(assignment.has('to_owner'));
  assert.equal(assignment.has('from_owner_id'), false);
  assert.equal(assignment.has('to_owner_id'), false);
  assert.equal(assignment.has('summary'), false);

  for (const absent of ['crm_handover_summaries', 'crm_stage_transition_records', 'crm_expansion_pool']) {
    assert.equal(Boolean(relation(absent)), false, `${absent} is Golden-only, not actual schema`);
  }
});

test('actual schema does not enforce inquiry lineage or one-open-next semantic uniqueness', () => {
  const dealDefs = constraints('deals').map(row => row.definition).join('\n');
  assert.match(dealDefs, /UNIQUE \(relate_id\)/);
  assert.doesNotMatch(dealDefs, /UNIQUE \(origin_inquiry_id\)/);

  const nextDefs = constraints('next_actions').map(row => row.definition).join('\n');
  assert.doesNotMatch(nextDefs, /UNIQUE/);
});

test('current Dispatcher receipt allow-list excludes every Pipeline lifecycle operation', () => {
  const receiptCheck = snapshot.private.constraints.find(row =>
    row.table === 'command_receipts' && row.name === 'command_receipts_operation_check');
  assert.ok(receiptCheck, 'receipt operation check must exist');
  for (const frozen of ['opportunity_work_set', 'inquiry_assign', 'service_change', 'inquiry_unassign']) {
    assert.match(receiptCheck.definition, new RegExp(`'${frozen}'`));
  }
  for (const blocked of ['opportunity_create', 'transition', 'close', 'assign', 'handover']) {
    assert.doesNotMatch(receiptCheck.definition, new RegExp(`'${blocked}'`));
  }
});

test('legacy public histories remain a security backlog and are not mistaken for a new secure API', () => {
  assert.equal(relation('stage_history').rls, false);
  assert.equal(relation('assignment_history').rls, false);
});

test('read-only Staging create preflight proves atomic shape but keeps site normalization and role scope blocked', () => {
  assert.equal(createPreflight.project_ref, 'rprechiaglyjaydkmxsu');
  assert.equal(createPreflight.mode, 'READ_ONLY');
  assert.equal(createPreflight.verified_structure.sites.norm_name.unique_index, 'uq_sites_norm');
  assert.equal(createPreflight.verified_structure.sites.norm_name.default, null);
  assert.equal(createPreflight.verified_structure.sites.norm_name.automatic_trigger, false);
  assert.equal(createPreflight.verified_structure.contacts.person_key_unique_index, 'contacts_person_key_uq');
  assert.equal(createPreflight.conclusion.atomic_storage_supported, true);
  assert.equal(createPreflight.conclusion.safe_candidate_ready, false);
  assert.equal(createPreflight.ui_contract_findings.pc_initial_next_action, false);
  assert.equal(createPreflight.ui_contract_findings.mobile_initial_next_action.due_days, 1);
  assert.match(createPreflight.ui_contract_findings.site_normalization_conflict.pc, /현장/);
  assert.match(createPreflight.ui_contract_findings.site_normalization_conflict.mobile, /APT/);
  assert.match(createPreflight.ui_contract_findings.site_normalization_conflict.mobile_duplicate_gate, /substring/);
  assert.equal(createPreflight.ui_contract_findings.creator_assignee_conflict.pc_direct_assignee, 'required active head_office sales candidate');
  assert.match(createPreflight.ui_contract_findings.creator_assignee_conflict.mobile_assignee, /signed-in user/);
  assert.deepEqual(createPreflight.staging_actor_matrix.approved_active_unexpired, {
    admin: 2,
    rep: 2,
    branch: 1,
    consultation: 1
  });
  assert.equal(createPreflight.conclusion.blocker_class, 'REACHABLE_UI_CONTRACT_CONFLICT');
  assert.equal(createPreflight.conclusion.missing_rules.length, 2);
  assert.equal(createPreflight.writes_performed, 0);
  assert.equal(createPreflight.production_requests, 0);
  assert.equal(createPreflight.n8n_requests, 0);
});

test('direct PC/mobile create resolves the two preflight conflicts with a fail-closed local candidate', () => {
  assert.equal(createResolution.project_ref, 'rprechiaglyjaydkmxsu');
  assert.equal(createResolution.classification, 'DERIVED_SAFE_LOCAL_CANDIDATE');
  assert.equal(createResolution.staging_aggregate_findings.mobile_substring_overlap_pairs, 1);
  assert.equal(createResolution.staging_aggregate_findings.pc_mobile_key_difference_rows, 5);
  assert.equal(createResolution.resolved_contract.substring_match, 'forbidden');
  assert.match(createResolution.resolved_contract.broad_pc_or_mobile_match, /409/);
  assert.equal(createResolution.resolved_contract.owner_matrix.branch, 'self only');
  assert.equal(createResolution.resolved_contract.owner_matrix.consultation, 'denied');
  assert.deepEqual(createResolution.resolved_contract.pc_children, {activity: 1, next_action: 0});
  assert.deepEqual(createResolution.resolved_contract.mobile_children, {activity: 1, next_action: 1});
  assert.deepEqual(createResolution.blocked_meanings, ['inquiry_promote', 'technical_inquiry_transfer', 'expansion_convert']);
  assert.equal(createResolution.staging_ddl_dml_performed, false);
});
