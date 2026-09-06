'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const build=require('./build.cjs');
function adapter(){const m=new Module('opportunity-create-adapter');m._compile(build.adapter(),'operational-adapter.candidate.js');return m.exports;}
const A=adapter(),request='f6090600-0110-4000-8000-000000000001';
const base={surface:'pc',client_ref:'new-local-1',name:'[테스트] 새 아파트',work_name:'옥상 방수',work_type:'옥상 방수',primaryWork:'방수',workItems:['방수'],workScopeType:'single',workSummary:'방수',brand:'아파트스퀘어',owner:'TEST INTERNAL_REP',amount:100000,address:'TEST 주소',reason:'신규 영업 등록 사유',office_phone:'055-123-4567',office_email:'office@example.invalid',manager_name:'테스트 소장',manager_mobile:'010-1234-5678',manager_role:'관리소장',person_key:'mobile:01012345678'};
test('direct PC and mobile create payloads normalize to the frozen direct intent',()=>{
 const pc=A.normalize('opportunity_create',request,0,base);
 assert.equal(pc.object_id,request);assert.equal(pc.payload.primary_work,'방수');assert.deepEqual(pc.payload.work_items,['방수']);assert.equal(pc.payload.office_phone,'0551234567');assert.equal(pc.payload.manager_mobile,'01012345678');
 const mobile=A.normalize('opportunity_create',request,0,{...base,surface:'mobile',site_id:'f6090500-0002-4000-8000-000000000001'});
 assert.equal(mobile.payload.surface,'mobile');assert.equal(mobile.payload.site_id,'f6090500-0002-4000-8000-000000000001');
});
test('create sentinel, aliases, contact identity and non-direct meanings fail closed',()=>{
 assert.throws(()=>A.normalize('opportunity_create','new-local-1',0,base),/INVALID_COMMAND/);
 assert.throws(()=>A.normalize('opportunity_create',request,1,base),/INVALID_VERSION/);
 assert.throws(()=>A.normalize('opportunity_create',request,0,{...base,primary_work:'다른 공종'}),/WORK_ALIAS_CONFLICT/);
 assert.throws(()=>A.normalize('opportunity_create',request,0,{...base,person_key:'mobile:01000000000'}),/INVALID_CONTACT_IDENTITY/);
 for(const extra of [{source_opportunity_id:request},{origin_source:'inquiry_promote'},{inquiry_id:request},{expansion_id:request}])assert.throws(()=>A.normalize('opportunity_create',request,0,{...base,...extra}),/OPPORTUNITY_CREATE_INTENT_NOT_CONNECTED/);
});
test('ACK binds every server-created identity and preserves the surface-specific Next rule',()=>{
 const command={request_id:request,operation:'opportunity_create',object_id:request,expected_version:0,payload:A.normalize('opportunity_create',request,0,base).payload};
 const id=n=>`f6090600-0110-4000-8000-${String(n).padStart(12,'0')}`;
 const ack={contract_version:1,ok:true,request_id:request,operation:'opportunity_create',object_id:request,new_opportunity_id:id(2),site_id:id(3),owner_id:id(4),contact_id:id(5),contact_assignment_id:id(6),activity_id:id(7),next_action_id:null,audit_event_id:id(8),version:1,server_at:'2026-09-06T00:00:00Z',replayed:false};
 assert.equal(A.validateAck(ack,command),ack);
 assert.throws(()=>A.validateAck({...ack,next_action_id:id(9)},command),/ACK_CONTRACT_MISMATCH/);
 const mobile={...command,payload:{...command.payload,surface:'mobile'}};assert.equal(A.validateAck({...ack,next_action_id:id(9)},mobile).next_action_id,id(9));
});
test('generated layers connect only the direct create command and absorb mobile children',()=>{
 const sql=build.applySql(),overlay=build.overlay(),source=build.sourceFragment();
 assert.match(sql,/p_operation='opportunity_create'/);assert.match(sql,/p_object_id IS DISTINCT FROM p_request_id/);assert.match(sql,/GRANT EXECUTE[^;]+TO authenticated/);assert.doesNotMatch(sql,/ymfbmpnizxvqsamnczow|n8n/i);
 assert.match(overlay,/createSurface==='mobile'&&companion\.has\(op\)/);assert.match(overlay,/wrapCreate\('saveNewDeal','pc'\)/);assert.match(overlay,/wrapCreate\('addProspect','mobile'\)/);assert.match(overlay,/role==='viewer'/);assert.match(overlay,/root\.crypto\.randomUUID\(\)/);
 assert.match(source,/list_fields->>'work_name' AS work_name/);
});
