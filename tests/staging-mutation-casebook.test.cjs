'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fixture=require('../sql/baseline/20260905/synthetic/fixture.json');
const mutationPlan=require('../docs/operational-cutover-20260906/staging-mutation-e2e-plan.json');
const compiler=require('../sql/operational-full-local-candidate/20260906/disposable-fixture.cjs');
const casebook=require('../sql/operational-full-local-candidate/20260906/staging-mutation-casebook.cjs');
const adapter=require('../sql/operational-full-local-candidate/20260906/operational-adapter.candidate.js');

function plan(){const run_id='stg-e2e-20260906t120000z-a1b2c3d4',allocation=compiler.allocate(run_id,mutationPlan);return {project_ref:compiler.PROJECT_REF,status:'GENERATED_NOT_APPROVED_NOT_RUN',run_id,canonical_rows_mutated:false,candidate_manifest_sha256:'a'.repeat(64),candidate_apply_sha256:'b'.repeat(64),catalog_sha256:'c'.repeat(64),...allocation};}

test('all 35 planned scenarios compile into ordered executable steps',()=>{
 const book=casebook.build(plan(),fixture),expected=mutationPlan.scenarios.map(x=>x.id);
 assert.equal(book.status,'COMPILED_NOT_RUN');assert.equal(book.scenario_count,35);assert.equal(book.operation_count,31);assert.deepEqual(book.scenarios.map(x=>x.id),expected);
 assert.ok(book.scenarios.every(x=>x.steps.length>0));assert.ok(book.scenarios.flatMap(x=>x.steps).every(x=>['write','read','direct_rpc','storage_put','policy_assertion'].includes(x.kind)));
});

test('every dispatcher operation has a normalized happy-path command and replay policy',()=>{
 const book=casebook.build(plan(),fixture),writes=book.scenarios.flatMap(x=>x.steps).filter(x=>x.kind==='write'),covered=new Set(writes.map(x=>x.operation));
 assert.deepEqual(covered,new Set(adapter.operations));assert.ok(writes.every(x=>x.replay===true));assert.ok(writes.every(x=>Array.isArray(x.proof)&&x.proof.includes('ack')&&x.proof.includes('refresh')&&x.proof.includes('receipt')&&x.proof.includes('audit')));
});

test('mutating canonical-snapshot scenarios receive disposable rows',()=>{
 const value=plan();
 for(const id of ['frozen-direct-assign-pc-mobile','frozen-inquiry-unassign','pipeline-expected-amount','frozen-opportunity-work','frozen-service-change'])assert.ok(value.entities.some(x=>x.scenario_id===id),`${id} lacks disposable row`);
 assert.equal(value.entities.some(x=>x.scenario_id==='frozen-inquiry-read-refresh'),false);
});

test('casebook is exact-target and contains no Production, n8n or credential material',()=>{
 const serialized=JSON.stringify(casebook.build(plan(),fixture));assert.match(serialized,/rprechiaglyjaydkmxsu/);assert.doesNotMatch(serialized,/ymfbmpnizxvqsamnczow|https?:\/\/[^" ]*n8n/i);assert.doesNotMatch(serialized,/password|access_token|refresh_token|service_role|secret_key|database_url/i);
});

test('casebook happy paths honor frozen role, state, date, contact and attachment prerequisites',()=>{
 const book=casebook.build(plan(),fixture,{now:'2026-09-06T12:00:00.000Z'}),scenario=id=>book.scenarios.find(x=>x.id===id).steps;
 for(const id of ['inquiry-hold','inquiry-reclassify','technical-inquiry-transfer'])assert.ok(scenario(id).every(x=>x.actor==='ADMIN'));
 assert.deepEqual(scenario('inquiry-purge').map(x=>x.operation),['inquiry_trash','inquiry_purge']);
 assert.equal(scenario('inquiry-purge')[1].actor,'ADMIN_MFA');
 assert.equal(scenario('pipeline-stage-transition')[0].payload.transition_date,'2026-09-06');
 assert.equal(scenario('pipeline-stage-transition')[0].payload.stage_context.fields.quote_request,'견적 산출 요청');
 assert.match(scenario('pipeline-close-nonwon')[0].payload.reason,/^고객 예산 무산 · /);
 assert.equal(scenario('pipeline-close-won-expansion')[0].payload.transition_date,'2026-09-06');
 assert.equal(scenario('attachment-lifecycle')[0].payload.mime_type,'application/pdf');
 assert.equal(scenario('attachment-lifecycle')[1].body.length,16);
 assert.equal(Object.hasOwn(scenario('message-log')[0].payload,'person_key'),false);
 assert.deepEqual(scenario('relationship-cadence').map(x=>x.operation),['relationship_hold','message_log','relationship_response']);
 assert.equal(scenario('relationship-cadence')[2].payload.response_at,'2026-09-06T12:01:00.000Z');
 assert.equal(scenario('expansion-pool-update-note-context')[1].expected_version,1);
});
