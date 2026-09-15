'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
// Current shipped adapter, not historical candidate copies. No network/DB writes.
const api=require('../operational-adapter.js');
const id='f6091600-0001-4000-8000-000000000001';
const action='f6091600-0001-4000-8000-000000000002';
test('inquiry Next keeps inquiry identity and sentinel version',()=>{
 const p={inquiry_id:id,intent:'inquiry_next_set',type:'전화',text:'계획 확인',due_at:'2026-10-01'};
 const c=api.normalize('next_action',id,0,p);
 assert.equal(c.object_id,id);assert.equal(c.payload.intent,'inquiry_next_set');
 assert.throws(()=>api.normalize('next_action',id,1,p));
 assert.throws(()=>api.normalize('next_action',action,0,p));
});
test('deal Next keeps existing versioned command without inquiry intent',()=>{
 const c=api.normalize('next_action',id,7,{opportunity_id:id,intent:'standalone',type:'전화',text:'계획 확인',due_at:'2026-10-01'});
 assert.equal(c.expected_version,7);assert.equal(c.payload.text,'계획 확인');
 assert.equal(c.payload.intent,undefined);
});
test('completion requires original action ID in both domains',()=>{
 for(const inquiry of [false,true]){
  const p=inquiry?{inquiry_id:id,intent:'inquiry_next_complete',action_id:action}:{opportunity_id:id,action_id:action};
  assert.equal(api.normalize('next_action_complete',id,inquiry?0:7,p).payload.action_id,action);
  const missing={...p};delete missing.action_id;
  assert.throws(()=>api.normalize('next_action_complete',id,inquiry?0:7,missing));
 }
});
test('date-only inquiry followup does not invent an action title or completion',()=>{
 const c=api.normalize('inquiry_followup',id,0,{inquiry_id:id,due_at:'2026-10-01',reason:'담당자 연기'});
 assert.deepEqual(c.payload,{due_at:'2026-10-01',reason:'담당자 연기'});
});
test('relationship contact retains activity and next action as one command',()=>{
 const p={opportunity_id:id,activity:{type:'전화',note:'계획 확인',result:'재확인 예정',occurred_at:'2026-09-16T09:00:00+09:00',meaningful_contact:true},next_action:{type:'전화',text:'재확인',due_at:'2026-10-01'}};
 const c=api.normalize('relationship_contact',id,7,p);
 assert.equal(c.operation,'relationship_contact');assert.equal(c.expected_version,7);
 assert.equal(c.payload.activity.note,'계획 확인');assert.equal(c.payload.next_action.text,'재확인');
 assert.throws(()=>api.normalize('relationship_contact',id,7,{...p,next_action:undefined}));
});
