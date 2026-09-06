'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),build=require('./build.cjs');
function load(text,name){const m=new Module(name);m._compile(text,name+'.js');return m.exports;}
const inquiry='f6090500-0005-4000-8000-000000000005',deal='f6090500-0006-4000-8000-000000000005',request='f6090600-0115-4000-8000-000000000001';
test('create and existing promotion normalize to separate intents with server-derived stage vocabulary',()=>{const a=load(build.adapter(),'inq-pipe-contract');
 const create=a.normalize('opportunity_create',request,0,{intent:'inquiry_promote_create',inquiry_id:inquiry,promotion_mode:'manual',inquiry_status:'견적서 발송완료',owner:'TEST INTERNAL_REP',from:'',to:'sent',note:'견적 발송완료로 파이프라인 인계',amount:123,name:'TEST 아파트 ADMIN',work_name:'TEST 공종',brand:'TEST',site_id:'f6090500-0002-4000-8000-000000000005',client_ref:'local-1'});
 assert.equal(create.payload.intent,'inquiry_promote_create');assert.equal(create.payload.to,'sent');
 const existing=a.normalize('transition',deal,7,{intent:'inquiry_promote_existing',inquiry_id:inquiry,promotion_mode:'auto',inquiry_status:'견적서 발송예정',owner:'TEST INTERNAL_REP',opportunity_id:deal,from:'first_contact',to:'consulting',note:'견적 준비 단계로 파이프라인 인계'});
 assert.equal(existing.payload.intent,'inquiry_promote_existing');assert.equal(existing.payload.to,'consulting');
});
test('forged stage/reason, technical brand and branch-shaped raw fields fail closed',()=>{const a=load(build.adapter(),'inq-pipe-block');
 const base={intent:'inquiry_promote_create',inquiry_id:inquiry,promotion_mode:'manual',inquiry_status:'견적서 발송완료',owner:'TEST INTERNAL_REP',from:'',to:'sent',note:'견적 발송완료로 파이프라인 인계',name:'TEST',work_name:'',brand:'TEST',client_ref:'local-1'};
 for(const p of [{...base,to:'consulting'},{...base,note:'임의 사유'},{...base,brand:'기술자문'},{...base,branch_code:'gyeongnam'}])assert.throws(()=>a.normalize('opportunity_create',request,0,p),/INQUIRY_PROMOTION|INVALID_INQUIRY_PROMOTION/);
});
test('lineage_link strips display fields and retains Deal version contract',()=>{const a=load(build.adapter(),'inq-lineage-contract'),c=a.normalize('lineage_link',deal,9,{opportunity_id:deal,origin_inquiry_id:inquiry,site_id:'f6090500-0002-4000-8000-000000000005',inquiry_site:'TEST'});assert.deepEqual(c.payload,{intent:'lineage_link',inquiry_id:inquiry});
 const q={request_id:request,operation:'lineage_link',object_id:deal,expected_version:9,auth_uid:'f6090500-0001-4000-8000-000000000005',user_id:'f6090500-0001-4000-8000-000000000005',payload:c.payload},ack={contract_version:1,ok:true,request_id:request,operation:'lineage_link',object_id:deal,actor_auth_uid:q.auth_uid,actor_user_id:q.user_id,intent:'lineage_link',inquiry_id:inquiry,opportunity_id:deal,previous_version:9,version:10,changed:true,audit_event_id:'f6090600-0115-4000-8000-000000000002',inquiry_audit_event_id:'f6090600-0115-4000-8000-000000000003',server_at:'2026-09-06T00:00:00Z',replayed:false};assert.equal(a.validateAck(ack,q),ack);
});
