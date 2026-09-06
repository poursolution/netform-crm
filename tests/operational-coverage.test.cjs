'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.resolve(__dirname,'..');
const matrix=fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','coverage-matrix.csv'),'utf8');
const dead=fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','dead-overrides.csv'),'utf8');

test('coverage matrix has the requested operational columns',()=>{
 const header=matrix.replace(/^\ufeff/,'').split(/\r?\n/,1)[0];
 for(const key of ['domain','surface','action','operations','payload','target','transport','n8n_dependency','rule_status','adapter_status','read_after_write','evidence','next'])assert.match(header,new RegExp('(?:^|,)'+key+'(?:,|$)'));
});

test('only Staging-evidenced business/read meanings are frozen',()=>{
 assert.match(matrix,/inquiry_assign\/direct_assign/);
 assert.match(matrix,/opportunity_work_set/);
 for(const id of ['I05','I19','P07'])assert.match(matrix,new RegExp(id+'[^\\n]*STAGING_COMPAT_PASS_FROZEN'));
 assert.doesNotMatch(matrix,/STAGING_COMPAT_PASS(?!_FROZEN)/);
});

test('response, consultant and branch meanings passed their real Staging JWT gates',()=>{
 for(const intent of ['response_progress','response_next_week_retry','response_missed_retry']){
  const line=matrix.split(/\r?\n/).find(x=>x.includes(intent));
  assert.ok(line,intent+' row missing');
  assert.match(line,/STAGING_JWT_E2E_PASS_20260906/);
 }
 for(const intent of ['branch_handoff','branch_owner_assign']){
  const line=matrix.split(/\r?\n/).find(x=>x.includes(intent));
  assert.ok(line,intent+' row missing');
  assert.match(line,/STAGING_JWT_E2E_PASS_20260906/);
 }
 const consultant=matrix.split(/\r?\n/).find(x=>x.startsWith('"I16"'));
 assert.match(consultant,/STAGING_JWT_E2E_PASS_20260906/);
});

test('shadowed or unreachable operation callsites are not counted as live coverage',()=>{
 for(const op of ['inquiry_duplicate','win','message_stage_advanced'])assert.match(dead,new RegExp(op));
});

test('inventory explicitly preserves local-only behavior, frozen-scope exclusions and visible mocks',()=>{
 assert.match(matrix,/LOCAL_ONLY_CONFIRMED/);
 assert.match(matrix,/OUT_OF_SCOPE_31_OP_BOUNDARY/);
 assert.match(matrix,/REACHABLE_MOCK_BLOCKER/);
});

test('Staging-passed rows include the authenticated attachment lifecycle',()=>{
 assert.match(matrix,/T01[^\n]*STAGING_JWT_E2E_PASS_20260906/);
 assert.match(matrix,/T02[^\n]*STAGING_JWT_E2E_PASS_20260906/);
 const gate=JSON.parse(fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','gate-status.json'),'utf8'));
 for(const id of ['T01','T02'])assert.ok(!gate.coverage.local_candidate_ids.includes(id));
 assert.match(matrix,/P08C[^\n]*LOCAL_CHAIN_DB_UI_PASS/);
 assert.match(matrix,/P09M[^\n]*next_action_complete\/today_outcome[^\n]*LOCAL_CHAIN_DB_UI_PASS/);
 assert.match(matrix,/C04[^\n]*all queued ops[^\n]*STAGING_JWT_E2E_PASS_20260906[^\n]*LOCAL_UI_QUEUE_PASS/);
 const support=matrix.split(/\r?\n/).find(x=>x.startsWith('"O02"'));
 const weeklyComment=matrix.split(/\r?\n/).find(x=>x.startsWith('"O01"'));
 assert.match(support,/customer_support_action[^\n]*STAGING_JWT_E2E_PASS_20260906[^\n]*LOCAL_CHAIN_DB_UI_PASS/);
 assert.match(weeklyComment,/STAGING_JWT_E2E_PASS_20260906/);
 assert.ok(!gate.coverage.local_candidate_ids.includes('O02'));
 assert.ok(!gate.coverage.local_candidate_ids.includes('C04'));
 assert.match(matrix,/M02[^\n]*message_log[^\n]*STAGING_JWT_E2E_PASS_20260906[^\n]*LOCAL_CHAIN_DB_UI_PASS/);
 assert.ok(!gate.coverage.local_candidate_ids.includes('M02'));
 assert.match(matrix,/M05[^\n]*relationship_hold; relationship_response[^\n]*STAGING_JWT_E2E_PASS_20260906[^\n]*LOCAL_CHAIN_DB_UI_PASS/);
 assert.ok(!gate.coverage.local_candidate_ids.includes('M05'));
 assert.ok(!gate.coverage.contract_only_ids.includes('M05'));
 assert.ok(!gate.coverage.contract_only_ids.includes('T02'));
 assert.equal(gate.coverage.denominator,'64_LOGICAL_REACHABLE_ACTIONS');
 assert.equal(gate.coverage.actions,64);
 assert.equal(gate.coverage.pass,53);
 assert.equal(gate.coverage.blocked,0);
 assert.equal(gate.coverage.out_of_scope,11);
 assert.equal(gate.coverage.completion_percent,82.8);
 const runDir=path.join(root,'docs','operational-cutover-20260906','staging-fixture-runs','stg-e2e-20260906t125239z-fc70f2d2');
 const historicalCleanup=JSON.parse(fs.readFileSync(path.join(runDir,'cleanup-verification.json'),'utf8'));
 const completedCleanup=JSON.parse(fs.readFileSync(path.join(runDir,'cleanup-pending-audit.json'),'utf8'));
 const currentCleanup=JSON.parse(fs.readFileSync(path.join(runDir,'cleanup-verification-current.json'),'utf8'));
 const storagePlan=JSON.parse(fs.readFileSync(path.join(runDir,'storage-cleanup-plan.json'),'utf8'));
 assert.equal(historicalCleanup.status,'SUPERSEDED_BY_LATER_BROWSER_MUTATION_RUN');
 assert.equal(completedCleanup.status,'COMPLETED_EXACT_FIXTURE_CLEANUP_PASS');
 assert.equal(completedCleanup.verified_fixture_db_rows_remaining,0);
 assert.equal(Object.values(completedCleanup.pre_cleanup_table_counts).reduce((sum,count)=>sum+count,0),433);
 assert.equal(completedCleanup.total_database_rows_deleted,448);
 assert.equal(completedCleanup.storage.objects_remaining,0);
 assert.equal(storagePlan.status,'COMPLETED_EXACT_FIXTURE_CLEANUP_PASS');
 assert.equal(storagePlan.execution_method,'SUPABASE_DASHBOARD_EXACT_OBJECT_DELETE');
 assert.equal(storagePlan.temporary_policy_status,'NOT_APPLIED_NOT_NEEDED');
 assert.equal(storagePlan.broad_prefix_delete,false);
 assert.equal(storagePlan.direct_sql_delete,false);
 const cleanupRunbook=fs.readFileSync(path.join(root,storagePlan.runbook),'utf8');
 assert.equal(crypto.createHash('sha256').update(cleanupRunbook).digest('hex'),storagePlan.runbook_sha256);
 assert.match(cleanupRunbook,/사용자의 \*\*정확 범위 삭제 승인 후에만\*\* 실행/);
 assert.match(cleanupRunbook,/`cleanup\.sql`은 범위가 넓으므로 실행하지 않는다/);
 assert.deepEqual(storagePlan.temporary_policies.map(({name,command,role})=>({name,command,role})),[
  {name:'crm_fixture_cleanup_select_20260906',command:'SELECT',role:'authenticated'},
  {name:'crm_fixture_cleanup_delete_20260906',command:'DELETE',role:'authenticated'}
 ]);
 assert.deepEqual(storagePlan.temporary_policy_scope,{
  object_id:completedCleanup.storage.object_id,
  bucket:completedCleanup.storage.bucket_id,
  object_path:completedCleanup.storage.object_path,
  owner_id:completedCleanup.storage.owner_id,
  jwt_owner_must_match:true
 });
 for(const [file,expected] of [
  [storagePlan.temporary_policy_apply_file,storagePlan.temporary_policy_apply_sha256],
  [storagePlan.temporary_policy_rollback_file,storagePlan.temporary_policy_rollback_sha256]
 ]){
  const sql=fs.readFileSync(path.join(runDir,file),'utf8');
  assert.equal(crypto.createHash('sha256').update(sql).digest('hex'),expected);
  assert.match(sql,new RegExp(storagePlan.object_id,'i'));
  assert.match(sql,new RegExp(storagePlan.owner_id,'i'));
  assert.match(sql,new RegExp(storagePlan.object_path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(sql,/crm_attachment_insert_v1/);
 }
 const databaseCleanup=fs.readFileSync(path.join(runDir,storagePlan.database_cleanup_file),'utf8');
 assert.equal(crypto.createHash('sha256').update(databaseCleanup).digest('hex'),storagePlan.database_cleanup_sha256);
 assert.match(databaseCleanup,/41 preallocated entity UUIDs \+ 67 actually executed request UUIDs/);
 assert.match(databaseCleanup,/Storage bytes\/metadata MUST be removed separately through the Supabase Storage API/);
 const cleanupVerify=fs.readFileSync(path.join(runDir,storagePlan.post_cleanup_verification_file),'utf8');
 assert.equal(crypto.createHash('sha256').update(cleanupVerify).digest('hex'),storagePlan.post_cleanup_verification_sha256);
 assert.match(cleanupVerify,/BEGIN TRANSACTION READ ONLY/);
 assert.equal((cleanupVerify.match(/^ (?:UNION ALL )?SELECT '[^']+',count\(\*\) FROM /gm)||[]).length,25);
 assert.doesNotMatch(cleanupVerify,/CREATE TEMP TABLE|INSERT INTO/);
 assert.match(cleanupVerify,/storage_objects_remaining/);
 assert.match(cleanupVerify,/temporary_storage_policies_remaining/);
 assert.match(cleanupVerify,/canonical_inquiries[\s\S]*canonical_deals/);
 assert.match(cleanupVerify,/canonical_inquiries_md5[\s\S]*canonical_deals_md5/);
 const canonicalBaseline=JSON.parse(fs.readFileSync(path.join(runDir,storagePlan.canonical_baseline_file),'utf8'));
 const canonicalBaselineBytes=fs.readFileSync(path.join(runDir,storagePlan.canonical_baseline_file));
 assert.equal(crypto.createHash('sha256').update(canonicalBaselineBytes).digest('hex'),storagePlan.canonical_baseline_sha256);
 assert.deepEqual(storagePlan.canonical_baseline,{
  deals:canonicalBaseline.canonical_deals,
  inquiries:canonicalBaseline.canonical_inquiries
 });
 assert.deepEqual(storagePlan.canonical_baseline.deals,{count:5,md5:'30b2067a1a74de986aa33a36b9c0942b'});
 assert.deepEqual(storagePlan.canonical_baseline.inquiries,{count:5,md5:'d15e22087063729eedf6e5211d4ff327'});
 const cleanupBuilder=fs.readFileSync(path.join(root,storagePlan.cleanup_builder),'utf8');
 assert.equal(crypto.createHash('sha256').update(cleanupBuilder).digest('hex'),storagePlan.cleanup_builder_sha256);
 const cleanupScript=fs.readFileSync(path.join(root,storagePlan.cleanup_script),'utf8');
 assert.equal(crypto.createHash('sha256').update(cleanupScript).digest('hex'),storagePlan.cleanup_script_sha256);
 assert.match(cleanupScript,/STAGING_PUBLISHABLE_KEY/);
 assert.match(cleanupScript,/SUPABASE_SERVICE_ROLE_KEY[\s\S]*privileged credential prohibited/);
 assert.doesNotMatch(cleanupScript,/Authorization:\s*`Bearer \$\{env\.[^}]*SERVICE/i);
 assert.equal(currentCleanup.status,'PASS');
 assert.equal(currentCleanup.cleanup.total_database_rows_deleted,448);
 assert.equal(currentCleanup.cleanup.storage_objects_deleted,1);
 assert.equal(currentCleanup.post_cleanup.verified_fixture_db_rows_remaining,0);
 assert.equal(currentCleanup.post_cleanup.generated_residual_rows_remaining,0);
 assert.equal(currentCleanup.post_cleanup.storage_objects_remaining,0);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(runDir,storagePlan.current_verification))).digest('hex'),storagePlan.current_verification_sha256);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(runDir,storagePlan.residual_cleanup_plan))).digest('hex'),storagePlan.residual_cleanup_plan_sha256);
 const roleMatrix=JSON.parse(fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','role-matrix-e2e.json'),'utf8'));
 const denialHarness=roleMatrix.mutation_matrix.negative_role_harness;
 assert.equal(denialHarness.status,'READY_NOT_RUN');
 assert.equal(denialHarness.expected_denials,6);
 for(const [file,expected] of [
  [denialHarness.script,denialHarness.script_sha256],
  [path.join('docs','operational-cutover-20260906',denialHarness.runbook),denialHarness.runbook_sha256]
 ]){
  const content=fs.readFileSync(path.join(root,file),'utf8');
  assert.equal(crypto.createHash('sha256').update(content).digest('hex'),expected);
 }
 const stagingE2e=JSON.parse(fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','staging-e2e.json'),'utf8'));
 for(const [file,expected] of [
  [stagingE2e.cleanup.exact_cleanup,stagingE2e.cleanup.exact_cleanup_sha256],
  [stagingE2e.cleanup.exact_cleanup_verification,stagingE2e.cleanup.exact_cleanup_verification_sha256],
  [stagingE2e.cleanup.residual_cleanup,stagingE2e.cleanup.residual_cleanup_sha256],
  [stagingE2e.cleanup.current_verification,stagingE2e.cleanup.current_verification_sha256],
  [stagingE2e.cleanup.storage_policy_apply,stagingE2e.cleanup.storage_policy_apply_sha256],
  [stagingE2e.cleanup.storage_policy_rollback,stagingE2e.cleanup.storage_policy_rollback_sha256],
  [path.join('docs','operational-cutover-20260906',stagingE2e.cleanup.runbook),stagingE2e.cleanup.runbook_sha256],
  [stagingE2e.evidence.negative_role_harness,stagingE2e.evidence.negative_role_harness_sha256]
 ]){
  const resolved=file.startsWith('staging-fixture-runs/')?path.join(root,'docs','operational-cutover-20260906',file):path.join(root,file);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex'),expected);
 }
 const n8nProof=JSON.parse(fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','n8n-off-network-proof.json'),'utf8'));
 assert.equal(n8nProof.evidence.mutation_proof,stagingE2e.evidence.browser_mutation_proof);
 assert.equal(n8nProof.evidence.mutation_proof_sha256,stagingE2e.evidence.browser_mutation_proof_sha256);
 for(const id of ['I05','I19','P07'])assert.ok(!gate.coverage.legacy_unresolved_ids.includes(id));
 for(const id of ['P05Q','P05W','P12','O01'])assert.ok(!gate.coverage.legacy_unresolved_ids.includes(id));
 assert.deepEqual([...gate.coverage.legacy_unresolved_ids].sort(),['O05','O06']);
 assert.ok(!gate.coverage.legacy_unresolved_ids.includes('O03'));
 assert.ok(!gate.coverage.legacy_unresolved_ids.includes('C02L'));
 for(const id of ['I04','I07','P04W','P05E','P09X','P10','P11','P15','O02','X01','X02','M04','C04','M02','M05'])assert.ok(!gate.coverage.legacy_unresolved_ids.includes(id));
 assert.ok(!gate.coverage.legacy_unresolved_ids.includes('T02'));
});

test('source manifest covers both entrypoints and directly loaded compatibility files',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','source-manifest.json'),'utf8'));
 const files=new Set(manifest.files.map(x=>x.file));
 for(const file of ['index.html','crm.html','mobile.html','crm-read.js','write-ack.js'])assert.ok(files.has(file),file+' missing');
 for(const item of manifest.files)assert.match(item.sha256,/^[0-9a-f]{64}$/);
});

test('cutover gate reports Staging GO only after the four operational gates pass',()=>{
 const gate=JSON.parse(fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','gate-status.json'),'utf8'));
 const cutover=fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','production-cutover.md'),'utf8');
 const rollback=fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','production-rollback.md'),'utf8');
 assert.match(cutover,/877 PASS \/ 0 FAIL \/ 16 SKIP/);
 assert.match(cutover,/53 PASS \/ 0 BLOCKED \/ 11 OUT_OF_SCOPE/);
 assert.match(cutover,/fixture cleanup: \*\*PASS\*\*[\s\S]*DB `448행`[\s\S]*Storage object `1개`/);
 assert.match(cutover,/\[x\] exact fixture DB 448행·Storage object 1개 cleanup/);
 assert.match(rollback,/Storage lifecycle과 exact fixture cleanup이 PASS/);
 assert.equal(gate.status,'STAGING_GO_PRODUCTION_NOT_APPLIED');
 assert.deepEqual(gate.operational_gates,{
  gate_1_local:true,
  gate_2_staging:true,
  gate_3_coverage:true,
  gate_4_cutover_readiness:true
 });
 assert.equal(gate.coverage.pass,53);
 assert.equal(gate.coverage.blocked,0);
 assert.equal(gate.coverage.out_of_scope,11);
 assert.equal(gate.coverage.scope_completion_percent,100);
 assert.equal(gate.local_gate.status,'PASS');
 assert.equal(gate.local_gate.pass,877);
 assert.equal(gate.local_gate.fail,0);
 assert.equal(gate.local_gate.skip,16);
 assert.equal(gate.local_gate.fixture_setup_cleanup_restore.status,'PASS');
 assert.deepEqual(gate.full_ui_candidate.forbidden_references,{n8n:0,production_ref:0});
 assert.equal(gate.gates.frozen_evidence,true);
 assert.equal(gate.production_requests,0);
 assert.equal(gate.n8n_body_requests,0);
 assert.match(cutover,/STATUS: READY/);
 assert.match(rollback,/STATUS: READY/);
 return;
 assert.match(cutover,/874 PASS \/ 0 FAIL \/ 15 SKIP/);
 assert.match(cutover,/45 PASS \/ 15 BLOCKED \/ 4 OUT_OF_SCOPE/);
 assert.match(cutover,/fixture cleanup: \*\*PASS\*\*[\s\S]*DB `448행`[\s\S]*Storage object `1개`/);
 assert.match(cutover,/\[x\] exact fixture DB 448행·Storage object 1개 cleanup/);
 assert.match(rollback,/DB 448행·Storage object 1개 cleanup이 PASS/);
 assert.equal(gate.status,'NO_GO');
 assert.equal(gate.gates.local_gate_pass,true);
 assert.equal(gate.gates.full_ui_candidate_assembled,true);
 assert.equal(gate.gates.full_ui_browser_read_pass,true);
 assert.equal(gate.gates.fixture_cleanup_pass,true);
 assert.equal(gate.local_gate.status,'PASS');
 assert.equal(gate.local_gate.pass,874);
 assert.equal(gate.local_gate.fail,0);
 assert.equal(gate.local_gate.skip,15);
 assert.equal(gate.local_gate.fixture_setup_cleanup_restore.status,'PASS');
 assert.equal(gate.full_ui_candidate.status,'LOCAL_31_OP_UI_ASSEMBLED_NOT_DEPLOYED');
 assert.equal(gate.full_ui_candidate.operations,31);
 assert.deepEqual(gate.full_ui_candidate.forbidden_references,{n8n:0,production_ref:0});
 assert.deepEqual(gate.full_ui_browser_read,{status:'PASS',checks:12,pass:12,fail:0,violations:0,production_requests:0,n8n_requests:0,business_write_requests:0,at:gate.full_ui_browser_read.at});
 assert.equal(gate.gates.frozen_evidence,true);
 assert.equal(gate.gates.reachable_candidate_bundle_fresh,true);
 assert.equal(gate.gates.opportunity_create_candidate_fresh,true);
 assert.equal(gate.gates.inquiry_response_candidate_fresh,true);
 assert.equal(gate.gates.inquiry_pipeline_candidate_fresh,true);
 assert.equal(gate.gates.inquiry_stage_progress_candidate_fresh,true);
 assert.equal(gate.gates.inquiry_action_check_candidate_fresh,true);
 assert.equal(gate.gates.technical_inquiry_transfer_candidate_fresh,true);
 assert.equal(gate.gates.attachment_candidate_fresh,true);
 assert.equal(gate.gates.close_won_candidate_fresh,true);
 assert.equal(gate.gates.expansion_pool_update_candidate_fresh,true);
 assert.equal(gate.gates.expansion_note_context_candidate_fresh,true);
 assert.equal(gate.gates.message_reminder_candidate_fresh,true);
 assert.equal(gate.gates.next_action_postpone_candidate_fresh,true);
 assert.equal(gate.gates.mobile_today_outcome_candidate_fresh,true);
 assert.equal(gate.gates.customer_support_action_candidate_fresh,true);
 assert.equal(gate.gates.queue_retry_candidate_fresh,true);
 assert.equal(gate.gates.message_log_candidate_fresh,true);
 assert.equal(gate.gates.relationship_cadence_candidate_fresh,true);
 assert.equal(gate.gates.operational_cutover_staging_readonly_preflight,true);
 assert.equal(gate.gates.operational_cutover_candidate_fresh,true);
 assert.equal(gate.candidate_bundle.status,'LOCAL_CUMULATIVE_CANDIDATE_NOT_APPLIED');
 assert.equal(gate.candidate_bundle.operations,21);
 assert.equal(gate.candidate_bundle.files_fresh,true);
 assert.equal(gate.candidate_bundle.sources_fresh,true);
 assert.equal(gate.candidate_bundle.staging_ddl_dml_performed,false);
 assert.equal(gate.candidate_bundle.rollback_runtime_limit,'PRE_INQUIRY_PURGE_USE_ONLY');
 assert.equal(gate.candidate_bundle.irreversible_runtime_operation,'inquiry_purge');
 assert.equal(gate.opportunity_create_candidate.operation,'opportunity_create');
 assert.equal(gate.opportunity_create_candidate.files_fresh,true);
 assert.equal(gate.opportunity_create_candidate.sources_fresh,true);
 assert.equal(gate.opportunity_create_candidate.staging_ddl_dml_performed,false);
 assert.deepEqual(gate.inquiry_response_candidate.intents,['response_progress','response_next_week_retry','response_missed_retry']);
 assert.deepEqual(gate.inquiry_response_candidate.blocked_responses,[]);
 assert.equal(gate.inquiry_response_candidate.server_rules.response_missed_retry.response_timestamps,'preserve');
 assert.deepEqual(gate.inquiry_pipeline_candidate.operations,['opportunity_create','transition','lineage_link']);
 assert.deepEqual(gate.inquiry_pipeline_candidate.intents,['inquiry_promote_create','inquiry_promote_existing','lineage_link']);
 assert.equal(gate.inquiry_pipeline_candidate.staging_readonly_preflight,'PASS');
 assert.equal(gate.inquiry_pipeline_candidate.files_fresh,true);
 assert.equal(gate.inquiry_pipeline_candidate.sources_fresh,true);
 assert.equal(gate.inquiry_pipeline_candidate.staging_ddl_dml_performed,false);
 assert.equal(gate.inquiry_stage_progress_candidate.operation,'inquiry_status');
 assert.equal(gate.inquiry_stage_progress_candidate.intent,'progress');
 assert.deepEqual(gate.inquiry_stage_progress_candidate.allowed_targets,['step:0','step:1','step:2','step:3','step:4','step:5']);
 assert.equal(gate.inquiry_stage_progress_candidate.files_fresh,true);
 assert.equal(gate.inquiry_stage_progress_candidate.sources_fresh,true);
 assert.equal(gate.inquiry_stage_progress_candidate.staging_ddl_dml_performed,false);
 assert.deepEqual(gate.inquiry_action_check_candidate.operations,['next_action','next_action_complete','stage_check']);
 assert.deepEqual(gate.inquiry_action_check_candidate.intents,['inquiry_next_set','inquiry_next_complete','inquiry_check']);
 assert.equal(gate.inquiry_action_check_candidate.deal_meanings_preserved,true);
 assert.equal(gate.inquiry_action_check_candidate.files_fresh,true);
 assert.equal(gate.inquiry_action_check_candidate.sources_fresh,true);
 assert.equal(gate.inquiry_action_check_candidate.staging_ddl_dml_performed,false);
 assert.deepEqual(gate.technical_inquiry_transfer_candidate.operations,['opportunity_create']);
 assert.deepEqual(gate.technical_inquiry_transfer_candidate.intents,['technical_inquiry_transfer']);
 assert.deepEqual(gate.technical_inquiry_transfer_candidate.absorbed_child_operations,['inquiry_status']);
 assert.equal(gate.technical_inquiry_transfer_candidate.server_helper_implemented,true);
 assert.equal(gate.technical_inquiry_transfer_candidate.files_fresh,true);
 assert.equal(gate.technical_inquiry_transfer_candidate.sources_fresh,true);
 assert.equal(gate.operational_cutover_candidate.operations,25);
 assert.equal(gate.close_won_candidate.operation,'close');
 assert.equal(gate.close_won_candidate.intent,'won');
 assert.deepEqual(gate.close_won_candidate.ui_coverage_candidate,['P04W','P16']);
 assert.deepEqual(gate.close_won_candidate.absorbed_children,['activity','expansion_pool_upsert']);
 assert.equal(gate.close_won_candidate.server_rules.from_stage,'completion');
 assert.equal(gate.close_won_candidate.server_rules.next_contact_days,30);
 assert.equal(gate.close_won_candidate.rollback_runtime_limit,'BEFORE_ANY_DEAL_WON_EVENT');
 assert.equal(gate.close_won_candidate.staging_readonly_preflight,'PASS');
 assert.equal(gate.close_won_candidate.files_fresh,true);
 assert.equal(gate.close_won_candidate.sources_fresh,true);
 assert.equal(gate.expansion_pool_update_candidate.operation,'expansion_pool_update');
 assert.deepEqual(gate.expansion_pool_update_candidate.ui_coverage_candidate,['X01']);
 assert.deepEqual(gate.expansion_pool_update_candidate.allowed_changes,['expansion_status','next_contact_at']);
 assert.equal(gate.expansion_pool_update_candidate.allowed_statuses.length,5);
 assert.ok(gate.expansion_pool_update_candidate.blocked_changes.includes('Pipeline 전환'));
 assert.equal(gate.expansion_pool_update_candidate.server_rules.concurrency,'private expansion pool version');
 assert.equal(gate.expansion_pool_update_candidate.files_fresh,true);
 assert.equal(gate.expansion_pool_update_candidate.sources_fresh,true);
 assert.equal(gate.expansion_pool_update_candidate.staging_ddl_dml_performed,false);
 assert.deepEqual(gate.expansion_note_context_candidate.rpcs,['crm_expansion_note','crm_expansion_context']);
 assert.deepEqual(gate.expansion_note_context_candidate.ui_coverage_candidate,['X02']);
 assert.equal(gate.expansion_note_context_candidate.note_contract.idempotency,'request_id common receipt');
 assert.equal(gate.expansion_note_context_candidate.context_contract.dispatches,'empty until verified X03 provider ledger');
 assert.ok(gate.expansion_note_context_candidate.blocked.includes('Pipeline conversion'));
 assert.equal(gate.expansion_note_context_candidate.files_fresh,true);
 assert.equal(gate.expansion_note_context_candidate.sources_fresh,true);
 assert.equal(gate.expansion_note_context_candidate.staging_ddl_dml_performed,false);
 assert.equal(gate.message_reminder_candidate.operation,'next_action');
 assert.equal(gate.message_reminder_candidate.intent,'message_reminder');
 assert.deepEqual(gate.message_reminder_candidate.ui_coverage_candidate,['M04']);
 assert.equal(gate.message_reminder_candidate.meaning,'staff execution reminder, never provider auto-send');
 assert.equal(gate.message_reminder_candidate.server_rules.replacement,'cancel all current open Deal Next Actions');
 assert.ok(gate.message_reminder_candidate.read_additions.includes('next_action.draft_body'));
 assert.ok(gate.message_reminder_candidate.blocked.includes('provider delivery claim'));
 assert.equal(gate.message_reminder_candidate.files_fresh,true);
 assert.equal(gate.message_reminder_candidate.sources_fresh,true);
 assert.equal(gate.message_reminder_candidate.staging_ddl_dml_performed,false);
 assert.equal(gate.next_action_postpone_candidate.operation,'next_action');
 assert.equal(gate.next_action_postpone_candidate.intent,'postpone');
 assert.deepEqual(gate.next_action_postpone_candidate.ui_coverage_candidate,['P09X']);
 assert.deepEqual(gate.next_action_postpone_candidate.payload,['action_id','due_at']);
 assert.equal(gate.next_action_postpone_candidate.server_rules.identity,'server-projected current open Next Action UUID');
 assert.equal(gate.next_action_postpone_candidate.server_rules.counter,'append-only per-Deal server count');
 assert.ok(gate.next_action_postpone_candidate.read_additions.includes('next_action.postpone_count'));
 assert.ok(gate.next_action_postpone_candidate.blocked.includes('temporary client action id'));
 assert.equal(gate.next_action_postpone_candidate.files_fresh,true);
 assert.equal(gate.next_action_postpone_candidate.sources_fresh,true);
 assert.equal(gate.next_action_postpone_candidate.staging_ddl_dml_performed,false);
 assert.equal(gate.mobile_today_outcome_candidate.operation,'next_action_complete');
 assert.equal(gate.mobile_today_outcome_candidate.intent,'today_outcome');
 assert.deepEqual(gate.mobile_today_outcome_candidate.ui_coverage_candidate,['P09M']);
 assert.deepEqual(gate.mobile_today_outcome_candidate.allowed_outcomes,['progress','next_week','missed']);
 assert.deepEqual(gate.mobile_today_outcome_candidate.absorbed_children,['activity','next_action']);
 assert.equal(gate.mobile_today_outcome_candidate.server_rules.counter,'Deal-level; increment only next_week');
 assert.equal(gate.mobile_today_outcome_candidate.files_fresh,true);
 assert.equal(gate.mobile_today_outcome_candidate.sources_fresh,true);
 assert.equal(gate.mobile_today_outcome_candidate.staging_ddl_dml_performed,false);
 assert.equal(gate.mobile_today_outcome_candidate.production_accessed,false);
 assert.equal(gate.mobile_today_outcome_candidate.n8n_accessed,false);
 assert.equal(gate.customer_support_action_candidate.operation,'customer_support_action');
 assert.deepEqual(gate.customer_support_action_candidate.ui_coverage_candidate,['O02']);
 assert.equal(gate.customer_support_action_candidate.meaning,'append-only requested support record; downstream action is independent');
 assert.equal(gate.customer_support_action_candidate.allowed_action_keys.length,16);
 assert.equal(gate.customer_support_action_candidate.server_rules.status,'requested only');
 assert.equal(gate.customer_support_action_candidate.files_fresh,true);
 assert.equal(gate.customer_support_action_candidate.sources_fresh,true);
 assert.equal(gate.customer_support_action_candidate.staging_ddl_dml_performed,false);
 assert.equal(gate.customer_support_action_candidate.production_accessed,false);
 assert.equal(gate.customer_support_action_candidate.n8n_accessed,false);
 assert.equal(gate.queue_retry_candidate.capability,'queue_retry');
 assert.deepEqual(gate.queue_retry_candidate.ui_coverage_candidate,['C04']);
 assert.deepEqual(gate.queue_retry_candidate.retryable_statuses,['uncertain']);
 assert.deepEqual(gate.queue_retry_candidate.non_retryable_statuses,['conflict','rejected']);
 assert.equal(gate.queue_retry_candidate.database_changes,false);
 assert.equal(gate.queue_retry_candidate.files_fresh,true);
 assert.equal(gate.queue_retry_candidate.sources_fresh,true);
 assert.equal(gate.queue_retry_candidate.staging_ddl_dml_performed,false);
 assert.equal(gate.queue_retry_candidate.production_accessed,false);
 assert.equal(gate.queue_retry_candidate.n8n_accessed,false);
 assert.equal(gate.message_log_candidate.operation,'message_log');
 assert.deepEqual(gate.message_log_candidate.ui_coverage_candidate,['M02']);
 assert.equal(gate.message_log_candidate.meaning,'user-attested external send outcome; never provider delivery evidence');
 assert.equal(gate.message_log_candidate.files_fresh,true);
 assert.equal(gate.message_log_candidate.sources_fresh,true);
 assert.equal(gate.message_log_candidate.staging_ddl_dml_performed,false);
 assert.equal(gate.message_log_candidate.production_accessed,false);
 assert.equal(gate.message_log_candidate.n8n_accessed,false);
 assert.deepEqual(gate.relationship_cadence_candidate.operations,['relationship_hold','relationship_response']);
 assert.equal(gate.relationship_cadence_candidate.status,'DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED');
 assert.equal(gate.relationship_cadence_candidate.implementation_present,true);
 assert.equal(gate.relationship_cadence_candidate.files_fresh,true);
 assert.equal(gate.relationship_cadence_candidate.sources_fresh,true);
 assert.equal(gate.gates.operational_full_staging_readonly_preflight_plan_fresh,true);
 assert.equal(gate.gates.operational_full_staging_jwt_readonly_harness_fresh,true);
 assert.equal(gate.gates.operational_full_staging_fixture_catalog_plan_fresh,true);
 assert.equal(gate.gates.operational_full_staging_disposable_fixture_compiler_fresh,true);
 assert.equal(gate.gates.operational_full_staging_mutation_e2e_plan_fresh,true);
 assert.equal(gate.gates.operational_full_local_candidate_fresh,true);
 assert.equal(gate.operational_full_local_candidate.status,'LOCAL_CUMULATIVE_31_OP_M02_M05_NOT_APPLIED');
 assert.equal(gate.operational_full_local_candidate.operations,31);
 assert.deepEqual(gate.operational_full_local_candidate.stage_order,['operational_cutover','close_won','expansion_pool_update','expansion_note_context','message_reminder','next_action_postpone','mobile_today_outcome','customer_support_action','message_log','relationship_cadence']);
 assert.equal(gate.operational_full_local_candidate.files_fresh,true);
 assert.equal(gate.operational_full_local_candidate.sources_fresh,true);
 assert.equal(gate.operational_full_local_candidate.staging_preflight_required,true);
 assert.equal(gate.operational_full_local_candidate.staging_preflight_plan,'READY_NOT_RUN');
 assert.equal(gate.operational_full_local_candidate.staging_preflight_runbook,'staging-readonly-preflight-runbook.md');
 assert.equal(gate.operational_full_local_candidate.staging_preflight_plan_fresh,true);
 assert.equal(gate.operational_full_local_candidate.staging_jwt_readonly_harness,'READY_NOT_RUN');
 assert.equal(gate.operational_full_local_candidate.staging_jwt_readonly_harness_fresh,true);
 assert.equal(gate.operational_full_local_candidate.staging_fixture_catalog,'READY_NOT_RUN_POST_APPLY');
 assert.equal(gate.operational_full_local_candidate.staging_fixture_catalog_fresh,true);
 assert.equal(gate.operational_full_local_candidate.staging_disposable_fixture_compiler,'READY_CATALOG_REQUIRED_NOT_RUN');
 assert.equal(gate.operational_full_local_candidate.staging_disposable_fixture_compiler_fresh,true);
 assert.equal(gate.operational_full_local_candidate.staging_mutation_e2e_plan,'READY_WITH_CATALOG_GATED_FIXTURE_COMPILER');
 assert.equal(gate.operational_full_local_candidate.staging_mutation_e2e_plan_fresh,true);
 assert.equal(gate.operational_full_local_candidate.staging_mutation_e2e_plan_status,'MUTATION_MATRIX_COMPLETE_FIXTURE_EXTENSION_PENDING_READONLY_PREFLIGHT');
 assert.equal(gate.operational_full_local_candidate.staging_mutation_e2e_coverage_rows,60);
 assert.equal(gate.operational_full_local_candidate.staging_mutation_e2e_scenarios,35);
 assert.equal(gate.operational_full_local_candidate.staging_mutation_fixture_gap,true);
 assert.deepEqual(gate.operational_full_local_candidate.candidate_inventory_counts,{functions:88,relations:14,archive_schemas:10,candidate_columns:4});
 assert.equal(gate.operational_full_local_candidate.staging_ddl_dml_performed,false);
 assert.equal(gate.operational_cutover_candidate.staging_readonly_preflight,'PASS');
 assert.equal(gate.operational_cutover_candidate.staging_readonly_preflight_fresh,true);
 assert.deepEqual(gate.operational_cutover_candidate.read_additions,['deal_contact_timeline','inquiry_response_history','lineage_first_deal_resolution','inquiry_stage_history_activity_next_action','inquiry_checklist_and_action_history','deal_ready_attachments']);
 assert.equal(gate.operational_cutover_candidate.files_fresh,true);
 assert.equal(gate.operational_cutover_candidate.sources_fresh,true);
 assert.equal(gate.operational_cutover_candidate.staging_ddl_dml_performed,false);
 assert.equal(gate.gates.unresolved_reachable_rows_zero,false);
 assert.equal(gate.gates.required_final_artifacts,false);
});
