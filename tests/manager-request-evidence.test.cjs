'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createClient}=require('../manager-request-client.js');
const id=n=>`f6091600-0916-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.now(),at=n=>new Date(now+n).toISOString();
const row=()=>({id:id(1),target_id:id(2),target_type:'inq',assignee_id:id(3),kind:'call',state:'requested',instruction:'고객 전화 후 결과 기록',requested_by:'테스트 관리자',requested_at:at(-60000),due_at:at(60000),delivery:'not_sent',completion:null});
function fixture(rpc){const transport={profile:{auth_uid:id(9)},storage:{getItem:()=>null,setItem(){},removeItem(){}},rpc};return {transport,client:createClient(transport)};}
test('requested/overdue requests with no proof stay incomplete',async()=>{
 for(const state of ['requested','overdue']){const r={...row(),state};const f=fixture(async()=>[r]);assert.equal((await f.client.list())[0].state,state);}
});
test('completed request requires assignee event after request time',async()=>{
 const r={...row(),state:'completed',completion:{event_id:id(4),actor_id:id(3),completed_at:at(-30000)}};
 assert.equal((await fixture(async()=>[r]).client.list())[0].state,'completed');
 for(const completion of [null,{}, {...r.completion,event_id:'invalid'}, {...r.completion,actor_id:id(5)}, {...r.completion,completed_at:at(-60000)}, {...r.completion,completed_at:at(-90000)}, {...r.completion,completed_at:at(120000)}]){
  await assert.rejects(fixture(async()=>[{...r,completion}]).client.list(),/INVALID_REQUEST_LIST/);
 }
});
test('pending state with completion proof is rejected, not silently counted',async()=>{
 await assert.rejects(fixture(async()=>[{...row(),completion:{event_id:id(4),actor_id:id(3),completed_at:at(-30000)}}]).client.list(),/INVALID_REQUEST_LIST/);
});
test('delivery claims cannot stand in for completion or pretend Kakao is connected',async()=>{
 for(const delivery of ['sent','delivered','failed'])await assert.rejects(fixture(async()=>[{...row(),delivery}]).client.list(),/INVALID_REQUEST_LIST/);
});
test('duplicate request IDs and unsupported targets reject the whole list',async()=>{
 await assert.rejects(fixture(async()=>[row(),row()]).client.list(),/INVALID_REQUEST_LIST/);
 await assert.rejects(fixture(async()=>[{...row(),target_type:'deal'}]).client.list(),/INVALID_REQUEST_LIST/);
});
test('identity change during request list cannot expose previous actor response',async()=>{
 let finish;const f=fixture(()=>new Promise(r=>finish=r));const pending=f.client.list();f.transport.profile.auth_uid=id(10);finish([row()]);await assert.rejects(pending,/IDENTITY_CHANGED/);
});
test('create ACK must match request ID and must not claim delivery',async()=>{
 const payload={p_id:id(6),p_target:id(2),p_kind:'call',p_due:at(60000),p_instruction:'전화 요청'};
 for(const ack of [{ok:true,id:id(1),request_id:id(7),delivery:'not_sent'},{ok:true,id:id(1),request_id:id(6),delivery:'sent'}])await assert.rejects(fixture(async()=>ack).client.create(payload),/INVALID_REQUEST_ACK/);
});

test('unsupported or malformed create requests never reach transport',async()=>{
 const base={p_id:id(6),p_target:id(2),p_kind:'call',p_due:at(60000),p_instruction:'전화 요청'};
 let calls=0;const f=fixture(async()=>{calls++;return {ok:true,id:id(1),request_id:id(6),delivery:'not_sent'};});
 for(const p of [null,[],{...base,p_kind:'report'},{...base,p_kind:'other'},{...base,p_due:'bad'},{...base,p_instruction:'  '},{...base,p_instruction:'x'.repeat(2001)},{...base,actor_id:id(9)}])await assert.rejects(f.client.create(p));
 assert.equal(calls,0);
});

test('valid retries keep the exact payload and request ID even after deadline',async()=>{
 for(const kind of ['call','next']){
  const p={p_id:id(6),p_target:id(2),p_kind:kind,p_due:at(-60000),p_instruction:'  원본 요청  '};const before=JSON.stringify(p);let submitted;
  const f=fixture(async(name,args)=>{assert.equal(name,'crm_manager_request_create_v1');submitted=args;return {ok:true,id:id(1),request_id:id(6),delivery:'not_sent',replayed:true};});
  assert.equal((await f.client.create(p)).replayed,true);assert.deepEqual(submitted,p);assert.equal(JSON.stringify(p),before);
 }
});

test('unsupported report retry journal is rejected without deleting it',()=>{
 const payload={p_id:id(6),p_target:id(2),p_kind:'report',p_due:at(60000),p_instruction:'보고 요청'};
 const signature=JSON.stringify({p_target:payload.p_target,p_kind:payload.p_kind,p_due:payload.p_due,p_instruction:payload.p_instruction});
 const f=fixture(async()=>{});let removed=0;f.transport.storage.getItem=()=>JSON.stringify({payload,signature});f.transport.storage.removeItem=()=>removed++;
 assert.throws(()=>f.client.retryStore.get(id(2)),/INVALID_PENDING_REQUEST/);assert.equal(removed,0);
});
