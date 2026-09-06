'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const projectRef = 'rprechiaglyjaydkmxsu';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const stages = [
  ['personal_state', 'sql/personal-state-compat/20260906/staging-apply.sql', 'sql/personal-state-compat/20260906/rollback.sql'],
  ['pipeline_action', 'sql/pipeline-action-bundle/20260906/staging-apply-after-personal.sql', 'sql/pipeline-action-bundle/20260906/rollback-after-personal.sql'],
  ['quote_version', 'sql/pipeline-quote-version/20260906/staging-apply-after-action.sql', 'sql/pipeline-quote-version/20260906/rollback-after-action.sql'],
  ['operational_source', 'sql/operational-read-source/20260906/candidate.sql', 'sql/operational-read-source/20260906/rollback.sql'],
  ['next_complete', 'sql/pipeline-next-complete/20260906/staging-apply-after-operational-source.sql', 'sql/pipeline-next-complete/20260906/rollback-after-operational-source.sql'],
  ['stage_check', 'sql/pipeline-stage-check/20260906/staging-apply-after-next-complete.sql', 'sql/pipeline-stage-check/20260906/rollback-after-next-complete.sql'],
  ['transition', 'sql/pipeline-transition/20260906/staging-apply-after-stage-check.sql', 'sql/pipeline-transition/20260906/rollback-after-stage-check.sql'],
  ['close_nonwon', 'sql/pipeline-close-nonwon/20260906/staging-apply-after-transition.sql', 'sql/pipeline-close-nonwon/20260906/rollback-after-transition.sql'],
  ['expected_amount', 'sql/pipeline-amount-expected/20260906/staging-apply-after-close.sql', 'sql/pipeline-amount-expected/20260906/rollback-after-close.sql'],
  ['waiting_context', 'sql/pipeline-waiting-context/20260906/staging-apply-after-amount.sql', 'sql/pipeline-waiting-context/20260906/rollback-after-amount.sql'],
  ['inquiry_reclassify', 'sql/inquiry-reclassify/20260906/staging-apply-after-waiting.sql', 'sql/inquiry-reclassify/20260906/rollback-after-waiting.sql'],
  ['inquiry_hold', 'sql/inquiry-hold/20260906/staging-apply-after-reclassify.sql', 'sql/inquiry-hold/20260906/rollback-after-reclassify.sql'],
  ['inquiry_trash_restore', 'sql/inquiry-trash-restore/20260906/staging-apply-after-hold.sql', 'sql/inquiry-trash-restore/20260906/rollback-after-hold.sql'],
  ['inquiry_purge', 'sql/inquiry-purge/20260906/staging-apply-after-trash-restore.sql', 'sql/inquiry-purge/20260906/rollback-after-trash-restore.sql'],
  ['inquiry_followup', 'sql/inquiry-followup/20260906/staging-apply-after-purge.sql', 'sql/inquiry-followup/20260906/rollback-after-purge.sql']
].map(([id, apply, rollback]) => ({ id, apply, rollback }));

const finalOperations = [
  'opportunity_work_set', 'inquiry_assign', 'service_change', 'inquiry_unassign',
  'favorite_set', 'opportunity_touch', 'next_action', 'activity', 'quote_version',
  'next_action_complete', 'stage_check', 'transition', 'close', 'amount',
  'waiting_context', 'inquiry_reclassify', 'inquiry_status', 'inquiry_trash',
  'inquiry_restore', 'inquiry_purge', 'inquiry_followup'
];

const baselineOperations = [
  'opportunity_work_set', 'inquiry_assign', 'service_change', 'inquiry_unassign'
];

const finalHelpers = [
  'crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)',
  'crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)',
  'crm_security.crm_operational_source_fragment_v1(text,uuid,integer)',
  'crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)',
  'crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)',
  'crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)',
  'crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)',
  'crm_security.crm_deal_close_nonwon_command_v1(uuid,uuid,integer,jsonb)',
  'crm_security.crm_deal_expected_amount_command_v1(uuid,uuid,integer,jsonb)',
  'crm_security.crm_deal_waiting_context_command_v1(uuid,uuid,integer,jsonb)',
  'crm_security.crm_inquiry_reclassify_command_v1(uuid,uuid,jsonb)',
  'crm_security.crm_inquiry_hold_command_v1(uuid,uuid,jsonb)',
  'crm_security.crm_inquiry_trash_command_v1(uuid,uuid,jsonb)',
  'crm_security.crm_inquiry_restore_command_v1(uuid,uuid,jsonb)',
  'crm_security.crm_inquiry_purge_command_v1(uuid,uuid,jsonb)',
  'crm_security.crm_inquiry_followup_command_v1(uuid,uuid,jsonb)'
];

const finalRelations = [
  'crm_security.user_opportunity_state',
  'crm_security.quote_versions',
  'crm_security.stage_transition_events',
  'crm_security.deal_close_events'
];

const archiveSchemas = [
  'crm_personal_state_archive',
  'crm_pipeline_action_archive',
  'crm_quote_version_archive',
  'crm_next_complete_archive',
  'crm_stage_check_archive',
  'crm_transition_archive',
  'crm_close_nonwon_archive',
  'crm_expected_amount_archive',
  'crm_waiting_context_archive',
  'crm_inquiry_reclassify_archive',
  'crm_inquiry_hold_archive',
  'crm_inquiry_trash_restore_archive',
  'crm_inquiry_followup_archive'
];

const stageRefs = {
  personal_state: 'personal_state_ref',
  pipeline_action: 'pipeline_action_ref',
  quote_version: 'quote_version_ref',
  operational_source: 'operational_source_ref',
  next_complete: 'next_complete_ref',
  stage_check: 'stage_check_ref',
  transition: 'transition_ref',
  close_nonwon: 'close_nonwon_ref',
  expected_amount: 'expected_amount_ref',
  waiting_context: 'waiting_context_ref',
  inquiry_reclassify: 'inquiry_reclassify_ref',
  inquiry_hold: 'inquiry_hold_ref',
  inquiry_trash_restore: 'inquiry_trash_restore_ref',
  inquiry_purge: 'inquiry_purge_ref',
  inquiry_followup: 'inquiry_followup_ref'
};

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n?/g, '\n');
}

function unwrap(sql, label) {
  let text = sql;
  const begin = text.match(/(?:^|\n)BEGIN;/);
  if (!begin) throw new Error(`${label}: transaction BEGIN missing`);
  const beginAt = begin.index + (begin[0].startsWith('\n') ? 1 : 0);
  text = text.slice(0, beginAt) + text.slice(beginAt + 'BEGIN;'.length);
  if (!/COMMIT;\s*$/.test(text)) throw new Error(`${label}: terminal COMMIT missing`);
  text = text.replace(/COMMIT;\s*$/, '');
  text = text.replace(/^SET crm\.([a-z0-9_]+)='([^']+)';$/gm, "SET LOCAL crm.$1='$2';");
  return text.trim();
}

function operationConstraint(operations) {
  return `CHECK (operation = ANY (ARRAY[${operations.map(x => `'${x}'::text`).join(', ')}]))`;
}

function applyPostGuard() {
  const helpers = finalHelpers.map(signature =>
    `to_regprocedure('${signature}') IS NULL OR has_function_privilege('authenticated','${signature}','EXECUTE')`
  ).join('\n  OR ');
  const relations = finalRelations.map(name =>
    `to_regclass('${name}') IS NULL OR has_table_privilege('authenticated','${name}','SELECT,INSERT,UPDATE,DELETE')`
  ).join('\n  OR ');
  return `DO $reachable_bundle_post$ BEGIN
 IF to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('anon','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_operational_source_v1(text,uuid,integer)','EXECUTE')
  OR ${helpers}
  OR ${relations}
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$${operationConstraint(finalOperations)}$expected$
 THEN RAISE EXCEPTION 'reachable operations cumulative post-apply drift'; END IF;
END $reachable_bundle_post$;`;
}

function rollbackPostGuard() {
  const helpers = finalHelpers.map(signature => `to_regprocedure('${signature}') IS NOT NULL`).join('\n  OR ');
  const relations = finalRelations.map(name => `to_regclass('${name}') IS NOT NULL`).join('\n  OR ');
  const archives = archiveSchemas.map(name => `to_regnamespace('${name}') IS NULL`).join('\n  OR ');
  return `DO $reachable_bundle_rollback_post$ BEGIN
 IF to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NOT NULL
  OR ${helpers}
  OR ${relations}
  OR ${archives}
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$${operationConstraint(baselineOperations)}$expected$
 THEN RAISE EXCEPTION 'reachable operations cumulative rollback drift'; END IF;
END $reachable_bundle_rollback_post$;`;
}

function compose(mode, options = {}) {
  const ordered = mode === 'apply' ? stages : [...stages].reverse();
  const parts = [
    '-- LOCAL REVIEW CANDIDATE ONLY. Staging execution requires separate explicit approval.',
    `-- Target project: netform-crm-staging / ${projectRef}. Production is forbidden.`,
    'BEGIN;',
    "SET LOCAL search_path=pg_catalog;",
    "SET LOCAL lock_timeout='3s';",
    "SET LOCAL statement_timeout='180s';",
    `SET LOCAL crm.reachable_operations_bundle_ref='${projectRef}';`,
    `DO $reachable_bundle_guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.reachable_operations_bundle_ref',true) IS DISTINCT FROM '${projectRef}'
 THEN RAISE EXCEPTION 'reachable operations bundle project/role guard failed'; END IF;
END $reachable_bundle_guard$;`
  ];
  for (const stage of ordered) {
    parts.push(`-- ===== ${mode.toUpperCase()} ${stage.id} =====`);
    parts.push(`SET LOCAL crm.${stageRefs[stage.id]}='${projectRef}';`);
    let sql;
    if (stage.id === 'personal_state' && mode === 'apply' && options.localPersonalCandidate) {
      sql = read('sql/personal-state-compat/20260906/candidate.sql');
    } else if (stage.id === 'personal_state' && mode === 'rollback' && options.localPersonalRollback) {
      sql = options.localPersonalRollback;
    } else {
      sql = read(stage[mode]);
    }
    parts.push(unwrap(sql, `${mode}:${stage.id}`));
  }
  parts.push(mode === 'apply' ? applyPostGuard() : rollbackPostGuard(), 'COMMIT;', '');
  return parts.join('\n');
}

function build() {
  const apply = compose('apply');
  const rollback = compose('rollback');
  const adapter = read('sql/inquiry-followup/20260906/operational-adapter.candidate.js');
  const overlay = read('sql/inquiry-followup/20260906/operational-overlay.candidate.js');
  const transport = read('sql/operational-read-source/20260906/transport.candidate.js');
  fs.writeFileSync(path.join(dir, 'staging-apply.sql'), apply);
  fs.writeFileSync(path.join(dir, 'rollback.sql'), rollback);
  fs.writeFileSync(path.join(dir, 'operational-adapter.candidate.js'), adapter);
  fs.writeFileSync(path.join(dir, 'operational-overlay.candidate.js'), overlay);
  fs.writeFileSync(path.join(dir, 'transport.candidate.js'), transport);
  const generated = [
    'staging-apply.sql', 'rollback.sql', 'operational-adapter.candidate.js',
    'operational-overlay.candidate.js', 'transport.candidate.js',
    'build.cjs', 'db.test.cjs', 'README.md', 'review.md', 'staging-preflight.json'
  ];
  const sourceFiles = stages.flatMap(stage => [stage.apply, stage.rollback]);
  const preflight = JSON.parse(fs.readFileSync(path.join(dir, 'staging-preflight.json'), 'utf8'));
  const preflightFunctions = new Map(preflight.functions.map(item => [item.signature, item]));
  const liveBaseline = JSON.parse(read('sql/personal-state-compat/20260906/staging-live-baseline.json'));
  const exactLiveMatch = preflight.project_ref === projectRef && preflight.project_name === 'netform-crm-staging' &&
    preflight.mode === 'READ_ONLY_SELECT_ONLY' && preflight.staging_ddl_dml_performed === false &&
    liveBaseline.functions.every(expected => {
      const actual = preflightFunctions.get(expected.signature);
      return actual && String(actual.oid) === String(expected.oid) && actual.definition_md5 === expected.definition_md5;
    }) && Object.values(preflight.candidate_absent).every(Boolean);
  if (!exactLiveMatch) throw new Error('reachable bundle live Staging preflight drift');
  const manifest = {
    project_ref: projectRef,
    status: 'LOCAL_CUMULATIVE_CANDIDATE_NOT_APPLIED',
    classification: 'DERIVED_SAFE_COMPONENTS_REQUIRING_STAGING_JWT_E2E',
    transactionality: {
      apply: 'single_transaction',
      rollback: 'single_transaction_reverse_order',
      rollback_runtime_limit: 'PRE_INQUIRY_PURGE_USE_ONLY'
    },
    irreversible_runtime_operation: {
      operation: 'inquiry_purge',
      behavior: 'physical inquiry aggregate deletion',
      guarantee: 'migration rollback refuses after runtime purge evidence; deleted business data is not fabricated',
      production_requirement: 'separate backup/PITR and irreversible-action runbook approval'
    },
    baseline_operations: baselineOperations,
    candidate_operations: finalOperations,
    stage_order: stages.map(stage => stage.id),
    frozen_operations_changed_semantically: false,
    live_staging_preflight: {
      captured_at: preflight.captured_at,
      status: 'EXACT_BASELINE_MATCH_NOT_APPLIED',
      candidate_absent: true
    },
    staging_ddl_dml_performed: false,
    production_accessed: false,
    n8n_accessed: false,
    blocked_not_included: ['response_update', 'branch_handoff', 'branch_owner_assign', 'opportunity_create', 'won', 'attachments', 'provider_messaging'],
    files_sha256: Object.fromEntries(generated.map(name => [name, sha256(fs.readFileSync(path.join(dir, name)))])),
    source_sha256: Object.fromEntries(sourceFiles.map(name => [name, sha256(fs.readFileSync(path.join(root, name)))]))
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (require.main === module) {
  try { console.log(JSON.stringify(build(), null, 2)); }
  catch (error) { console.error(error); process.exitCode = 1; }
}

module.exports = { projectRef, stages, finalOperations, baselineOperations, finalHelpers, finalRelations, archiveSchemas, stageRefs, unwrap, compose, build };
