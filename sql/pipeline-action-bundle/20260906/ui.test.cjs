'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const adapter=require('./operational-adapter.candidate.js');
const overlay=require('./operational-overlay.candidate.js');
const deal='f6090500-0006-4000-8000-000000000001';
const inquiry='f6090500-0005-4000-8000-000000000005';

test('candidate adapter requires the standalone discriminator and strips it before RPC',()=>{
 const activity=adapter.normalize('activity',deal,7,{opportunity_id:deal,intent:'standalone',type:'\uC804\uD654',note:'\uACE0\uAC1D \uD1B5\uD654 \uC644\uB8CC',result:'\uACAC\uC801 \uAC80\uD1A0',occurred_at:'2026-09-06T01:00:00.000Z',meaningful_contact:true});
 assert.deepEqual(activity.payload,{type:'\uC804\uD654',note:'\uACE0\uAC1D \uD1B5\uD654 \uC644\uB8CC',result:'\uACAC\uC801 \uAC80\uD1A0',occurred_at:'2026-09-06T01:00:00.000Z',meaningful_contact:true});
 const next=adapter.normalize('next_action',deal,8,{opportunity_id:deal,intent:'standalone',type:'\uC804\uD654',text:'\uACAC\uC801 \uD655\uC778',due_at:'2026-09-12',assignee:'TEST INTERNAL_REP'});
 assert.deepEqual(next.payload,{type:'\uC804\uD654',text:'\uACAC\uC801 \uD655\uC778',due_at:'2026-09-12',assignee:'TEST INTERNAL_REP'});
 assert.throws(()=>adapter.normalize('activity',deal,7,{opportunity_id:deal,type:'\uC804\uD654',note:'x',occurred_at:'2026-09-06T01:00:00Z'}),/ACTIVITY_INTENT_NOT_CONNECTED/);
 assert.throws(()=>adapter.normalize('next_action',deal,7,{opportunity_id:deal,intent:'derived',type:'\uC804\uD654',text:'x',due_at:'2026-09-12'}),/NEXT_ACTION_INTENT_NOT_CONNECTED/);
 assert.throws(()=>adapter.normalize('next_action',deal,7,{opportunity_id:deal,intent:'standalone',type:'\uC804\uD654',text:'x',due_at:'2026-09-12',postpone_count:1}),/NEXT_ACTION_INTENT_NOT_CONNECTED/);
});

test('overlay connects only named standalone handlers and folds split contact into activity',async()=>{
 const queued=[],listeners={};
 const root={OperationalAdapter:adapter,TOKEN:'jwt',ME:{id:'u'},CUR_DETAIL:{kind:'deal'},WRITE_Q:[],console,
  addEventListener:(name,fn)=>{listeners[name]=fn},
  document:{getElementById:id=>id==='sp-act-contact'?{checked:true}:null},
  Phase1:{read:async()=>({data:{deals:[{id:deal,version:7,brand:'\uAE30\uC874'}],inquiries:[{id:inquiry}]}}),queue:{
   enqueue(op,id,version,payload){const normalized=adapter.normalize(op,id,version,payload),q={request_id:'r'+(queued.length+1),operation:op,object_id:id,expected_version:version,payload:normalized.payload,status:'pending'};queued.push(q);return q;},list:()=>queued,flush:async()=>queued}},
  applyBundle(){},
  addDetailActivity(){this.pushWrite('activity',{opportunity_id:deal,type:'\uC804\uD654',note:'\uD1B5\uD654 \uC644\uB8CC',result:'ok',occurred_at:'2026-09-06T01:00:00Z'});},
  contactActivity(){this.pushWrite('activity',{opportunity_id:deal,type:'\uC804\uD654',note:'\uAD00\uB9AC\uC18C\uC7A5 \uC804\uD654 \uC2DC\uB3C4',result:'010-0000-0001',occurred_at:'2026-09-06T01:10:00Z'});},
  callContactM(){this.pushWrite('activity',{opportunity_id:deal,type:'\uC804\uD654',note:'\uB2F4\uB2F9\uC790 \uC804\uD654 \uC2DC\uB3C4',result:'010-0000-0001',occurred_at:'2026-09-06T01:20:00Z',meaningful_contact:false});},
  spSaveAct(){this.pushWrite('activity',{opportunity_id:deal,type:'\uBC29\uBB38',note:'\uD604\uC7A5 \uBC29\uBB38',result:'ok',occurred_at:'2026-09-06T02:00:00Z'});this.pushWrite('contact',{opportunity_id:deal,type:'\uBC29\uBB38',at:'2026-09-06T02:00:00Z'});},
  saveNextAction(){this.pushWrite('next_action',{opportunity_id:deal,type:'\uC804\uD654',text:'\uD6C4\uC18D \uD655\uC778',due_at:'2026-09-12'});},
  commitBiz(){this.pushWrite('activity',{opportunity_id:deal});this.pushWrite('next_action',{opportunity_id:deal});this.pushWrite('service_change',{opportunity_id:deal,to_service:'\uC2E0\uADDC',reason:'\uC0AC\uC5C5\uC720\uD615 \uBCC0\uACBD \uC0AC\uC720'});}
 };
 overlay.install(root);await root.loadData();
 root.addDetailActivity();root.contactActivity();root.callContactM();root.spSaveAct();root.saveNextAction();root.commitBiz();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(queued.map(q=>q.operation),['activity','activity','activity','activity','next_action','service_change']);
 assert.equal(queued[0].payload.meaningful_contact,undefined);
 assert.equal(queued[1].payload.note,'\uAD00\uB9AC\uC18C\uC7A5 \uC804\uD654 \uC2DC\uB3C4');
 assert.equal(queued[1].payload.meaningful_contact,undefined);
 assert.equal(queued[2].payload.meaningful_contact,false);
 assert.equal(queued[3].payload.meaningful_contact,true);
 assert.equal(Object.hasOwn(queued[3].payload,'intent'),false);
 assert.throws(()=>root.pushWrite('activity',{opportunity_id:deal,type:'\uC804\uD654',note:'\uC678\uBD80',occurred_at:'2026-09-06T03:00:00Z'}),/ACTIVITY_INTENT_NOT_CONNECTED/);
 root.CUR_DETAIL={kind:'inq'};
 assert.throws(()=>root.saveNextAction(),/NEXT_ACTION_INTENT_NOT_CONNECTED/);
});

test('candidate validates action ACK identity and version fields',()=>{
 const command={request_id:'00000000-0000-4000-8000-000000000001',operation:'activity',object_id:deal,expected_version:7,payload:{},auth_uid:'00000000-0000-4000-8000-000000000002',user_id:'00000000-0000-4000-8000-000000000003'};
 const ack={contract_version:1,ok:true,request_id:command.request_id,operation:'activity',object_id:deal,actor_auth_uid:command.auth_uid,actor_user_id:command.user_id,previous_version:7,version:8,replayed:false,activity_id:'00000000-0000-4000-8000-000000000004',audit_event_id:'00000000-0000-4000-8000-000000000005',meaningful_contact:true,occurred_at:'2026-09-06T01:00:00Z'};
 assert.equal(adapter.validateAck(ack,command),ack);
 assert.throws(()=>adapter.validateAck({...ack,version:9},command),/ACK_CONTRACT_MISMATCH/);
});
