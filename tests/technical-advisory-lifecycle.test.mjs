import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalSnapshot as snap,lifecycleDecision as decide,transitionPlan as plan} from '../server/technical-advisory/lifecycle.mjs';
const today='2026-09-25';
test('contract, construction and completed map independently of payments',()=>{
 assert.equal(decide(snap({status:'signing_in_progress'}),today).stage,'contract');
 assert.equal(decide(snap({siteInfo:{progressRate:40}}),today).stage,'construction');
 assert.equal(decide(snap({siteInfo:{isCompleted:true,completionDate:'2026-09-24'}}),today).stage,'won');
 assert.equal(decide(snap({siteInfo:{progressRate:'100'}}),today).reason,'COMPLETION_FACTS_REQUIRED');
 assert.equal(decide(snap({status:'contract_completed',paymentInfo:{isSettled:true}}),today).stage,'contract');
});
test('scheduled dates do not imply completed work or early construction',()=>{
 assert.equal(decide(snap({status:'contract_completed',siteInfo:{startDate:'2026-10-06',completionDate:'2026-01-01'}}),today).stage,'contract');
 assert.equal(decide(snap({siteInfo:{startDate:'2026-09-24'}}),today).stage,null);
 assert.equal(decide(snap({siteInfo:{completionDate:'2026-01-01'}}),today).stage,null);
 assert.equal(snap({siteInfo:{startDate:'2026-02-30',isCompleted:'false',progressRate:101}}).start_date,null);
});
test('termination and insufficient evidence require review',()=>{
 for(const status of ['termination_sent','contract_terminated','archived']) assert.equal(decide(snap({status,siteInfo:{isCompleted:true}}),today).stage,null);
 assert.equal(decide(snap({status:'pre_bid'}),today).stage,null);
});
test('exact identity, ordering, retries and manual stage conflicts are guarded',()=>{
 const base={snapshot:snap({siteInfo:{progressRate:50}}),today,revision:'200',dealId:'verified-deal',currentStage:'contract'};
 assert.equal(plan({...base,dealId:null}).reason,'EXACT_DEAL_LINK_REQUIRED');
 assert.equal(plan({...base,appliedRevision:'201'}).reason,'STALE_REVISION');
 assert.equal(plan({...base,currentStage:'construction'}).reason,'ALREADY_CURRENT');
 assert.equal(plan({...base,currentStage:'lost',lastSyncedStage:'contract'}).reason,'CLOSED_DEAL_REVIEW');
 assert.equal(plan({...base,currentStage:'won'}).reason,'REGRESSION_REVIEW_REQUIRED');
 assert.equal(plan(base).apply,true);
});
test('schedule passage never invents an actual start',()=>{
 const snapshot=snap({status:'contract_completed',siteInfo:{startDate:'2026-09-26'}});
 assert.equal(plan({snapshot,today,dealId:'verified',currentStage:'contract',revision:'200',appliedRevision:'200'}).apply,false);
 assert.equal(plan({snapshot,today:'2026-09-26',dealId:'verified',currentStage:'contract',revision:'200',appliedRevision:'200'}).stage,'contract');
});

test('legacy completion snapshot cannot substitute a planned date for actual completion',()=>{
 assert.equal(decide({schema_version:1,completed:true,completion_date:'2020-01-01'},today).reason,'COMPLETION_FACTS_REQUIRED');
});

test('authenticated status-only webhook forwards operational contract stage without inventing performance',async()=>{
 const {handler}=await import('../supabase/functions/technical-advisory-ingest/handler.mjs');
 const {createHmac}=await import('node:crypto');
 const secret='synthetic-test-secret-with-32-characters',timestamp='1791050400',calls=[];
 const body=JSON.stringify({projectId:'synthetic',revision:'1',data:{status:'signing_in_progress'}});
 const signature=createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
 const run=handler({secret,now:()=>Number(timestamp)*1000,store:async(...args)=>{calls.push(args);return {ok:true}}});
 const request=sig=>new Request('https://example.invalid/ingest',{method:'POST',body,headers:{'x-crm-timestamp':timestamp,'x-crm-signature':sig}});
 assert.equal((await run(request('0'.repeat(64)))).status,401);assert.equal(calls.length,0);
 assert.equal((await run(request(signature))).status,200);assert.equal(calls.length,1);
 assert.equal(decide(calls[0][3],today).stage,'contract');
 assert.equal(calls[0][2].contracts.length,0);
});
