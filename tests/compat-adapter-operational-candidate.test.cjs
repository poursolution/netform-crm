'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bridge=require('../staging-write/compat-adapter-operational-candidate.js');
const frozen=require('../staging-write/compat-adapter.js');
const WriteAck=require('../write-ack.js');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','compat-adapter-operational.json'),'utf8'));
const auth='f6090500-0001-4000-8000-000000000001',user='f6090500-0001-4000-8000-000000000002',rep='f6090500-0001-4000-8000-000000000003';
const identity=(version=7)=>({project_ref:bridge.project_ref,auth_uid:auth,user_id:user,expected_version:version});
const options=fetch=>({project_ref:bridge.project_ref,url:'https://'+bridge.project_ref+'.supabase.co',publishable_key:'sb_publishable_TEST_ONLY',auth:{getSession:async()=>({data:{session:{user:{id:auth},access_token:'TEST_ONLY'}}})},fetch});
const commonAck=(q,extra)=>({ok:true,contract_version:1,request_id:q.rpc.p_request_id,operation:q.rpc.p_operation||q.operation,object_id:q.rpc.p_object_id||q.rpc.p_inquiry_id,actor_auth_uid:auth,actor_user_id:user,replayed:false,...extra});

test('candidate leaves current work/direct normalization byte-for-byte frozen',async()=>{
 const work={write_id:'WORK-1',op:'opportunity_work_set',payload:{opportunity_id:'f6090500-0006-4000-8000-000000000001',primaryWork:'A',workItems:['A'],workSummary:'A',reason:'업무 근거'}};
 const direct={write_id:'DIRECT-1',op:'inquiry_assign',payload:{inquiry_id:'f6090500-0005-4000-8000-000000000001',from:'미배정',to:'TEST REP',status:'배정완료',changed_by:'FORGED',at:'FORGED'}};
 assert.deepEqual(await bridge.prepare(work,identity()),await frozen.prepare(work,identity()));
 assert.deepEqual(await bridge.prepare(direct,identity()),await frozen.prepare(direct,identity()));
});

test('actual PC inquiry_unassign fixture becomes reason-only RPC with version sentinel zero',async()=>{
 const source=JSON.stringify(fixture.pc_inquiry_unassign),q=await bridge.prepare(fixture.pc_inquiry_unassign,identity());
 assert.equal(JSON.stringify(fixture.pc_inquiry_unassign),source);
 assert.equal(q.rpc.p_operation,'inquiry_unassign');assert.equal(q.rpc.p_expected_version,0);
 assert.deepEqual(q.rpc,{p_request_id:q.rpc.p_request_id,p_operation:'inquiry_unassign',p_object_id:fixture.pc_inquiry_unassign.payload.inquiry_id,p_expected_version:0,p_payload:{reason:'담당 권역 변경'}});
 for(const key of ['from','changed_by','actor_name','at','status'])assert.equal(key in q.rpc.p_payload,false);
});

test('PC and mobile service payloads use only canonical server command fields',async()=>{
 const pc=await bridge.prepare(fixture.pc_service_change,identity());
 assert.deepEqual(pc.rpc.p_payload,{to_service:'기술자문',reason:'계약 형태 변경 확정',reason_source:'text',next_action:'기술자문 계약서 작성',next_due:'2026-09-09'});
 const noNext=await bridge.prepare(fixture.pc_service_without_next,identity());
 assert.deepEqual(noNext.rpc.p_payload,{to_service:'기술자문',reason:'다음 행동 없이 사업유형만 변경',reason_source:'text'});
 const mobile=await bridge.prepare(fixture.mobile_service_change,identity());
 assert.deepEqual(mobile.rpc.p_payload,{to_service:'기술자문',reason:'모바일 계약 형태 변경',reason_source:'voice',next_action:'계약 검토'});
 for(const q of [pc,noNext,mobile]){assert.equal(q.rpc.p_expected_version,7);for(const key of ['from_service','origin_channel','actor_id','actor_name','changed_by','at','expected_version'])assert.equal(key in q.rpc.p_payload,false);}
});

test('only Deal commands require the read version; inquiry operations use zero',async()=>{
 await assert.rejects(bridge.prepare(fixture.pc_service_change,{project_ref:bridge.project_ref,auth_uid:auth,user_id:user}),{code:'READ_VERSION_REQUIRED'});
 const unassign=await bridge.prepare(fixture.pc_inquiry_unassign,{project_ref:bridge.project_ref,auth_uid:auth,user_id:user});assert.equal(unassign.rpc.p_expected_version,0);
 const direct={write_id:'DIRECT-NO-VERSION',op:'inquiry_assign',payload:{inquiry_id:fixture.pc_inquiry_unassign.payload.inquiry_id,to:'TEST REP'}};
 assert.equal((await bridge.prepare(direct,{project_ref:bridge.project_ref,auth_uid:auth,user_id:user})).rpc.p_expected_version,0);
});

test('replay preparation is stable and keeps legacy write_id through correlated ACK',async()=>{
 const w=fixture.pc_inquiry_unassign,a=await bridge.prepare(w,identity()),b=await bridge.prepare(JSON.parse(JSON.stringify(w)),identity());assert.deepEqual(a,b);
 let calls=0;const client=bridge.create(options(async(url,init)=>{calls++;assert.equal(url,'https://'+bridge.project_ref+'.supabase.co/rest/v1/rpc/crm_write_command_v2');assert.deepEqual(JSON.parse(init.body),a.rpc);return Response.json(commonAck(a,{assigned_to:null,status:'접수',changed:true,inquiry_audit_event_id:'f6090500-0012-4000-8000-000000000001'}));}));
 const ack=await WriteAck.read(await client.response(a),w);assert.equal(ack.write_id,w.write_id);assert.equal(ack.operation,w.op);assert.equal(calls,1);
});

test('service ACK is version-, target-, actor-, and durable-ID correlated',async()=>{
 const w=fixture.pc_service_change,q=await bridge.prepare(w,identity()),good=commonAck(q,{previous_version:7,version:8,from_service:'POUR',to_service:'기술자문',business_history_id:12,activity_id:'f6090500-0020-4000-8000-000000000001',next_action_id:'f6090500-0021-4000-8000-000000000001',audit_event_id:'f6090500-0022-4000-8000-000000000001'});
 assert.equal(bridge.validateAck(good,q).write_id,w.write_id);
 for(const patch of [{request_id:user},{actor_user_id:rep},{previous_version:6},{version:7},{to_service:'POUR'},{activity_id:null},{next_action_id:null},{audit_event_id:null}])assert.throws(()=>bridge.validateAck({...good,...patch},q),{code:'ACK_MISMATCH'});
});

test('unassign no-op ACK permits no audit, while changed ACK requires it',async()=>{
 const q=await bridge.prepare(fixture.pc_inquiry_unassign,identity()),base=commonAck(q,{assigned_to:null,status:'응대중',changed:false,inquiry_audit_event_id:null});assert.equal(bridge.validateAck(base,q).changed,false);
 assert.throws(()=>bridge.validateAck({...base,changed:true},q),{code:'ACK_MISMATCH'});
 assert.throws(()=>bridge.validateAck({...base,assigned_to:rep},q),{code:'ACK_MISMATCH'});
});

test('blocked inquiry meanings, derived activity, unknown ops and unmapped fields fail closed',async()=>{
 const direct={write_id:'BLOCKED',op:'inquiry_assign',payload:{inquiry_id:fixture.pc_inquiry_unassign.payload.inquiry_id,to:'TEST REP'}};
 for(const patch of [{response:'완료'},{to:'경남지사'},{branch_code:'gyeongnam'},{assignment_group:'gyeongnam'}])await assert.rejects(bridge.prepare({...direct,payload:{...direct.payload,...patch}},identity()),{code:'INQUIRY_INTENT_NOT_CONNECTED'});
 for(const op of ['activity','inquiry_status','amount','branch_handoff'])await assert.rejects(bridge.prepare({write_id:'NO-'+op,op,payload:{}},identity()),{code:'OP_NOT_CONNECTED'});
 await assert.rejects(bridge.prepare({...fixture.pc_inquiry_unassign,payload:{...fixture.pc_inquiry_unassign.payload,response:'x'}},identity()),{code:'UNMAPPED_PAYLOAD_FIELD'});
});

test('a copied prepared command cannot reintroduce client-owned fields or inquiry versions',async()=>{
 let calls=0;const client=bridge.create(options(()=>{calls++;assert.fail('network must not run');}));
 const service=JSON.parse(JSON.stringify(await bridge.prepare(fixture.pc_service_change,identity())));service.rpc.p_payload.at='FORGED';
 await assert.rejects(client.send(service),{code:'INVALID_PREPARED_COMMAND'});
 const direct={write_id:'DIRECT-TAMPER',op:'inquiry_assign',payload:{inquiry_id:fixture.pc_inquiry_unassign.payload.inquiry_id,to:'TEST REP'}},prepared=JSON.parse(JSON.stringify(await bridge.prepare(direct,{project_ref:bridge.project_ref,auth_uid:auth,user_id:user})));prepared.rpc.p_expected_version=1;
 await assert.rejects(client.send(prepared),{code:'INVALID_PREPARED_COMMAND'});assert.equal(calls,0);
});

test('configuration and runtime can address only the Staging Supabase RPC hosts',async()=>{
 for(const patch of [{project_ref:'ymfbmpnizxvqsamnczow'},{url:'https://ymfbmpnizxvqsamnczow.supabase.co'},{url:'https://n8n.example.invalid/webhook/crm'},{url:'https://example.invalid'},{publishable_key:'sb_secret_TEST'}])assert.throws(()=>bridge.create({...options(()=>{}),...patch}),{code:'STAGING_CONFIG_REQUIRED'});
 const urls=[];const client=bridge.create(options(async(url,init)=>{urls.push(url);const body=JSON.parse(init.body),q={rpc:body,operation:body.p_operation,auth_uid:auth,user_id:user,write_id:'unused'};return Response.json(commonAck(q,{previous_version:7,version:8,from_service:'POUR',to_service:'기술자문',business_history_id:1,activity_id:'f6090500-0020-4000-8000-000000000001',next_action_id:'f6090500-0021-4000-8000-000000000001',audit_event_id:'f6090500-0022-4000-8000-000000000001'}));}));
 const q=await bridge.prepare(fixture.pc_service_change,identity());await client.send(q);assert.deepEqual(urls,['https://rprechiaglyjaydkmxsu.supabase.co/rest/v1/rpc/crm_write_command_v2']);assert.equal(urls.some(x=>/ymfbmpnizxvqsamnczow|n8n/i.test(x)),false);
});

test('all four operations use one public dispatcher and never call the private unassign helper',async()=>{
 const urls=[];const q=await bridge.prepare(fixture.pc_inquiry_unassign,identity()),client=bridge.create(options(async url=>{urls.push(url);return Response.json(commonAck(q,{assigned_to:null,status:'접수',changed:false,inquiry_audit_event_id:null}));}));
 await client.send(q);assert.deepEqual(bridge.endpoints,{dispatcher:'crm_write_command_v2'});assert.deepEqual(urls,['https://rprechiaglyjaydkmxsu.supabase.co/rest/v1/rpc/crm_write_command_v2']);assert.equal(urls.some(x=>x.includes('crm_inquiry_unassign_command_v1')),false);
});
