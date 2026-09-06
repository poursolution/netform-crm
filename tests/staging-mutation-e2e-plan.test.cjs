'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.resolve(__dirname,'..');
const plan=JSON.parse(fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','staging-mutation-e2e-plan.json'),'utf8'));
const matrixText=fs.readFileSync(path.join(root,'docs','operational-cutover-20260906','coverage-matrix.csv'),'utf8');
const fixtureFile=path.join(root,'sql','baseline','20260905','synthetic','fixture.json');
const manifestFile=path.join(root,'sql','operational-full-local-candidate','20260906','manifest.json');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function parseCsv(text){
 const table=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;continue;}
  if(ch==='"'){quoted=true;continue;}if(ch===','){row.push(field);field='';continue;}
  if(ch==='\n'){row.push(field.replace(/\r$/,''));table.push(row);row=[];field='';continue;}field+=ch;
 }
 if(field||row.length){row.push(field);table.push(row);}const header=table.shift().map(value=>value.replace(/^\ufeff/,''));
 return table.filter(row=>row.some(Boolean)).map(row=>Object.fromEntries(header.map((key,index)=>[key,row[index]??''])));
}

test('mutation E2E plan is local-only, pinned to exact Staging, and candidate-compatible',()=>{
 assert.equal(plan.project_ref,'rprechiaglyjaydkmxsu');
 assert.equal(plan.status,'MUTATION_MATRIX_COMPLETE_FIXTURE_EXTENSION_PENDING_READONLY_PREFLIGHT');
 assert.equal(plan.execution,'SERIAL_ONLY_AFTER_EXPLICIT_STAGING_APPROVAL_AND_APPLY');
 assert.equal(plan.staging_ddl_dml_performed,false);
 assert.equal(plan.staging_jwt_mutation_performed,false);
 assert.equal(plan.production_accessed,false);
 assert.equal(plan.n8n_accessed,false);
 assert.equal(plan.sources.coverage_matrix_sha256,hash(path.join(root,plan.sources.coverage_matrix)));
 assert.equal(plan.sources.synthetic_fixture_sha256,hash(fixtureFile));
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 assert.equal(manifest.project_ref,plan.project_ref);
 assert.deepEqual(manifest.operations,plan.scope.candidate_operations);
 assert.equal(manifest.files_sha256['staging-apply.sql'],plan.sources.candidate_apply_sha256);
});

test('every frozen/local candidate coverage row belongs to exactly one scenario',()=>{
 const included=new Set(plan.scope.included_adapter_statuses);
 const completedByGoRun=new Set(['I16','I17','I18','P02','A01','A02','A03','O01']);
 const expected=parseCsv(matrixText).filter(row=>included.has(row.adapter_status)&&!completedByGoRun.has(row.id)).map(row=>row.id).sort();
 const assigned=plan.scenarios.flatMap(scenario=>scenario.coverage_ids);
 assert.equal(new Set(assigned).size,assigned.length,'coverage row assigned more than once');
 assert.deepEqual([...assigned].sort(),expected);
 assert.equal(plan.scope.included_coverage_rows,expected.length);
 assert.equal(Object.keys(plan.coverage_index).length,expected.length);
 for(const id of expected)assert.ok(plan.coverage_index[id]?.scenario_id,`${id} has no scenario index`);
});

test('blocked, unconnected, and other non-passed rows are explicitly excluded',()=>{
 const included=new Set(plan.scope.included_adapter_statuses);
 const completedByGoRun=new Set(['I16','I17','I18','P02','A01','A02','A03','O01']);
 const excluded=parseCsv(matrixText).filter(row=>!included.has(row.adapter_status)||completedByGoRun.has(row.id));
 assert.equal(plan.scope.excluded_coverage_rows,excluded.length);
 for(const row of excluded){
  assert.equal(plan.coverage_index[row.id],undefined,`${row.id} was falsely counted`);
  assert.equal(plan.excluded_index[row.id].adapter_status,row.adapter_status);
 }
 assert.equal(plan.scope.excluded_by_status.NEEDS_VERIFICATION_BLOCKED,undefined);
 assert.equal(plan.scope.excluded_by_status.NOT_CONNECTED,undefined);
 assert.equal(plan.scope.excluded_by_status.OUT_OF_SCOPE_31_OP_BOUNDARY.length,7);
 assert.equal(plan.scope.excluded_by_status.READ_CONTRACT_MISSING,undefined);
});

test('all 31 cumulative operations are planned and cross-cutting assertions cannot become PASS by skip',()=>{
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 assert.equal(manifest.operations.length,31);
 assert.deepEqual(plan.scope.candidate_operations,manifest.operations);
 const planned=new Set(plan.scenarios.flatMap(scenario=>scenario.operations));
 for(const operation of manifest.operations)assert.ok(planned.has(operation),`${operation} missing from mutation plan`);
 assert.equal(plan.standard_gates.skip_is_not_pass,true);
 assert.equal(plan.standard_gates.request_id_replay_no_duplicate,true);
 assert.equal(plan.standard_gates.request_id_payload_reuse_409,true);
 assert.equal(plan.standard_gates.private_receipt_audit_history_exact_counts,true);
});

test('destructive and forward-only scenarios never use canonical shared rows',()=>{
 const unsafe=new Set(['IRREVERSIBLE_DISPOSABLE_FIXTURE','FORWARD_ONLY_DISPOSABLE_FIXTURE','APPEND_ONLY_DEDICATED_FIXTURE','STORAGE_DISPOSABLE_OBJECT']);
 for(const scenario of plan.scenarios.filter(item=>unsafe.has(item.disposition))){
  assert.match(scenario.fixture_mode,/REQUIRED$/);
  assert.doesNotMatch(scenario.fixture_mode,/CANONICAL/);
 }
 assert.equal(plan.fixture_gap.present,true);
 assert.match(plan.fixture_gap.resolution_gate,/read-only catalog preflight/i);
 assert.match(plan.fixture_gap.resolution_gate,/Do not improvise runtime cleanup/i);
});

test('five-role UUID truth is pinned without credentials',()=>{
 const fixture=JSON.parse(fs.readFileSync(fixtureFile,'utf8'));
 const roles=['INTERNAL_REP','OTHER_REP','CONSULT','GYEONGNAM','ADMIN'];
 for(const role of roles){
  const expected=fixture.accounts.find(account=>account.kind===role);
  assert.equal(plan.fixture.accounts[role].auth_uid,expected.auth_uid);
  assert.equal(plan.fixture.accounts[role].user_id,expected.user_id);
 }
 assert.doesNotMatch(JSON.stringify(plan),/password|access_token|refresh_token|service_role|secret_key/i);
});
