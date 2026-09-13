'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const api=require('./client.candidate.js');
const uuid=n=>`f6091300-0013-4000-8000-${String(n).padStart(12,'0')}`;
const actor={auth_uid:uuid(10),user_id:uuid(11)};
const input=()=>({object_id:uuid(1),expected_version:5,activity:{type:'전화',note:'통화 완료',result:'재검토 예정',occurred_at:'2026-09-13T09:00:00+09:00',meaningful_contact:true},next_action:{type:'전화',text:'공사계획 확인',due_at:'2026-09-20'}});
const ack=c=>({ok:true,operation:c.operation,contract_version:1,request_id:c.request_id,object_id:c.object_id,previous_version:c.expected_version,version:c.expected_version+2,replayed:false,actor_auth_uid:actor.auth_uid,actor_user_id:actor.user_id,activity_id:uuid(20),next_action_id:uuid(21),activity_request_id:uuid(22),next_request_id:uuid(23)});
test('contact candidate creates one immutable command, preserves false contact outcome',()=>{
 const p=input();p.activity.meaningful_contact=false;const n=api.normalize(p);
 assert.equal(n.payload.activity.meaningful_contact,false);assert.equal(n.payload.activity.occurred_at,'2026-09-13T00:00:00.000Z');
 p.activity.note='changed later';assert.equal(n.payload.activity.note,'통화 완료');assert.ok(Object.isFrozen(n.payload.activity));
});
test('unknown authority/intent and invalid dates fail before transport',()=>{
 for(const mutate of [p=>p.actor_id=uuid(10),p=>p.next_action.intent='postpone',p=>p.next_action.assignee='다른 담당자',p=>p.activity.meaningful_contact='true',p=>p.activity.occurred_at='2026-02-30T01:00:00Z',p=>p.activity.occurred_at='2026-09-13T10:00:00',p=>p.next_action.due_at='2026-02-30',p=>p.next_action.due_at='2026-09-12',p=>p.expected_version=1.2]){
  const p=input();mutate(p);assert.throws(()=>api.normalize(p));
 }
 const p=input();p.activity.occurred_at='2026-09-13T23:30:00Z';p.next_action.due_at='2026-09-13';assert.throws(()=>api.normalize(p),/NEXT_DATE_BEFORE_CONTACT/);
});
test('unrelated, incomplete, wrong actor and wrong version ACKs fail closed',()=>{
 const c={...api.normalize(input()),request_id:uuid(30)};
 for(const patch of [{ok:false},{contract_version:2},{operation:'activity'},{request_id:uuid(31)},{object_id:uuid(32)},{previous_version:4},{version:6},{replayed:null},{actor_auth_uid:uuid(12)},{actor_user_id:uuid(12)},{activity_id:null},{next_action_id:'local-1'},{activity_request_id:uuid(23)}])assert.throws(()=>api.validateAck(c,{...ack(c),...patch},actor),/ACK_CONTRACT_MISMATCH/);
});
test('double-click sends once and shows saved only after validated ACK',async()=>{
 let release,count=0;const c=api.createController({actor,uuid:()=>uuid(30),send:command=>{count++;return new Promise(r=>release=()=>r(ack(command)))}});
 const first=c.save(input()),second=c.save(input());assert.equal(first,second);assert.equal(c.state().phase,'saving');
 const changed=input();changed.next_action.text='다른 요청';assert.throws(()=>c.save(changed),/SAVE_IN_PROGRESS/);
 await Promise.resolve();assert.equal(count,1);release();await first;assert.equal(c.state().phase,'saved');
});
test('lost response retries exact request and blocks replacement while uncertain',async()=>{
 const sent=[];let ids=0;const c=api.createController({actor,uuid:()=>uuid(30+(ids++)),send:async command=>{sent.push(command);if(sent.length===1)throw Error('connection lost');return {...ack(command),replayed:true}}});
 await assert.rejects(c.save(input()));assert.equal(c.state().phase,'uncertain');assert.throws(()=>c.save(input()),/PREVIOUS_RESULT_UNCERTAIN/);
 const result=await c.retry();assert.equal(result.replayed,true);assert.equal(ids,1);assert.equal(sent[0],sent[1]);assert.equal(c.state().phase,'saved');
});
test('malformed success remains uncertain instead of reporting completion',async()=>{
 const c=api.createController({actor,uuid:()=>uuid(30),send:async command=>({...ack(command),version:6})});
 await assert.rejects(c.save(input()),/ACK_CONTRACT_MISMATCH/);assert.equal(c.state().phase,'uncertain');
});
test('confirmed SQL rejection allows corrected new request without optimistic success',async()=>{
 const sent=[];let ids=0;const c=api.createController({actor,uuid:()=>uuid(30+(ids++)),send:async command=>{sent.push(command);if(sent.length===1)throw Object.assign(Error('stale'),{code:'PT409'});return ack(command)}});
 await assert.rejects(c.save(input()),/stale/);assert.equal(c.state().phase,'rejected');assert.throws(()=>c.retry(),/NO_UNCERTAIN_REQUEST/);
 const p=input();p.expected_version=6;await c.save(p);assert.notEqual(sent[0].request_id,sent[1].request_id);assert.equal(c.state().phase,'saved');
});
