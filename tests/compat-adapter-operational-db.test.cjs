'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bridge=require('../staging-write/compat-adapter-operational-candidate.js');
const bundle=require('../sql/operational-bundle/20260906/build.cjs');
const s=require('../scripts/crm-phase1.cjs');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','compat-adapter-operational.json'),'utf8'));
const deal=s.uid(6,1),inquiry=s.uid(5,5),rep=s.uid(1,1),admin=s.uid(1,5);

function options(db,state,bodies,urls){return {
 project_ref:bridge.project_ref,url:'https://'+bridge.project_ref+'.supabase.co',publishable_key:'sb_publishable_TEST_LOCAL',
 auth:{getSession:async()=>({data:{session:{user:{id:s.mapping.accounts[state.account].auth_uid},access_token:'LOCAL_ONLY'}}})},
 fetch:async(url,init)=>{urls.push(url);const body=JSON.parse(init.body);bodies.push(body);await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${s.mapping.accounts[state.account].auth_uid}';`);try{const a=(await db.query('SELECT public.crm_write_command_v2($1,$2,$3,$4,$5) a',[body.p_request_id,body.p_operation,body.p_object_id,body.p_expected_version,JSON.stringify(body.p_payload)])).rows[0].a;return Response.json(a);}catch(e){return Response.json({code:e.code},{status:e.code==='PT409'?409:e.code==='42501'?403:400});}finally{await db.exec('RESET ROLE');}}
};}

test('operational adapter drives the combined local Dispatcher for service and unassign',async()=>{
 const db=await bundle.setup();try{await db.exec(bundle.approval+bundle.compose());await db.query("UPDATE public.inquiries SET assigned_to=$2,assigned_at=now(),status='배정완료',first_response_at=NULL,responded_at=NULL WHERE id=$1",[inquiry,rep]);
  const bodies=[],urls=[],state={account:0},client=bridge.create(options(db,state,bodies,urls));
  const serviceEnvelope={...fixture.pc_service_change,payload:{...fixture.pc_service_change.payload,opportunity_id:deal}},service=await bridge.prepare(serviceEnvelope,{project_ref:bridge.project_ref,auth_uid:s.mapping.accounts[0].auth_uid,user_id:rep,expected_version:1});
  const serviceAck=await client.send(service);assert.equal(serviceAck.operation,'service_change');assert.equal(serviceAck.write_id,serviceEnvelope.write_id);assert.equal(serviceAck.version,2);assert.deepEqual(bodies[0].p_payload,{to_service:'기술자문',reason:'계약 형태 변경 확정',reason_source:'text',next_action:'기술자문 계약서 작성',next_due:'2026-09-09'});
  state.account=4;const unassignEnvelope={...fixture.pc_inquiry_unassign,payload:{...fixture.pc_inquiry_unassign.payload,inquiry_id:inquiry}},unassign=await bridge.prepare(unassignEnvelope,{project_ref:bridge.project_ref,auth_uid:s.mapping.accounts[4].auth_uid,user_id:admin});
  const unassignAck=await client.send(unassign);assert.equal(unassignAck.operation,'inquiry_unassign');assert.equal(unassignAck.write_id,unassignEnvelope.write_id);assert.equal(unassignAck.assigned_to,null);assert.equal(bodies[1].p_expected_version,0);assert.deepEqual(bodies[1].p_payload,{reason:'담당 권역 변경'});
  const replay=await client.send(unassign);assert.equal(replay.replayed,true);assert.equal((await db.query("SELECT count(*)::int n FROM crm_security.command_receipts WHERE operation='inquiry_unassign'")).rows[0].n,1);assert.equal((await db.query("SELECT count(*)::int n FROM public.assignment_history WHERE inquiry_id=$1 AND to_owner='미배정'",[inquiry])).rows[0].n,1);
  assert.equal(new Set(urls).size,1);assert.equal(urls[0],'https://rprechiaglyjaydkmxsu.supabase.co/rest/v1/rpc/crm_write_command_v2');assert.equal(urls.some(x=>/crm_inquiry_unassign_command_v1|ymfbmpnizxvqsamnczow|n8n/i.test(x)),false);
 }finally{await db.close();}
});
