'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const objectiveAsks=['고객 첫 연락','연락 후 견적 필요 여부 확인'];
const objectivePayload=()=>({id:id(20),operation_id:id(70),expected_revision:0,expected_updated_at:'2026-10-10T00:00:00Z',decisions:[{ask:objectiveAsks[1],value:'not_needed',note:'고객 확인'}],complete:true});
function objectiveAck(p){const proof={contact_log_id:id(40),satisfied_asks:['고객 첫 연락'],requested_asks:objectiveAsks};return {
 ok:true,contract_version:1,request_id:p.id,operation_id:p.operation_id,revision:1,policy_version:'first-compound-v1',expected_updated_at:'2026-10-10T01:00:00Z',
 request:{id:p.id,target_type:'inquiry',kind:'first',status:p.complete?'done':'working',asks:objectiveAsks},request_complete:p.complete,
 requested_asks:objectiveAsks,contact_proof:proof,decisions:p.decisions.map(d=>({...d,contact_log_id:id(40),next_action:d.value==='needed'?{id:d.next_action_id}:null}))};}
function setup({storage=new Map(),gate=true,rpc,asks=['고객 첫 연락']}={}){
 const listeners={},calls=[],takes=[],messages=[];
 const q={id:id(10),assigned_to:id(1),status:'배정완료'};
 const r={id:id(20),target_type:'inquiry',target_id:q.id,kind:'first',label:'첫 연락 요청',asks,status:'sent',to_user_id:id(1),to_me:true};
 let last;
 const R={G:{page:'today'},ME:{id:id(1),name:'담당'},B:{inquiries:[q]},esc:String,escAttr:String,repN:String,
  crypto:{randomUUID:()=>id(30)},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  inqCtlFind:()=>q,paint:()=>{},toast:m=>messages.push(m),CRMRelease:{has:()=>gate},
  InquiryFlow:{take:s=>takes.push(s),load:()=>{},on:()=>true,state:()=>({logs:[{at:new Date().toISOString(),kind:'connected'}]})},
  InquiryListV3:{record:()=>{throw Error('legacy record must not run');}},
  OpsStore:{has:()=>true,rpc:async(fn,p)=>{calls.push([fn,JSON.parse(JSON.stringify(p))]);if(fn==='crm_work_request_list_v1')return {ok:true,requests:[last||r]};
   const x=rpc?await rpc(fn,p,ack):ack(p);last=x.request;return x;}}
 };
 function ack(p){const compound=asks.length>1,satisfied=p.result==='부재'?[]:['고객 첫 연락'];return {ok:true,contract_version:compound?2:1,operation_id:p.operation_id,inquiry_id:q.id,log_id:id(40),next_action_id:id(50),server_at:new Date().toISOString(),
  completion:compound?{policy_version:'first-compound-v1',requested_asks:asks,satisfied_asks:satisfied,remaining_asks:asks.filter(a=>!satisfied.includes(a)),contact_log_id:id(40),request_complete:false}:undefined,
  request:{...r,status:compound||p.result==='부재'?'working':'done',closed_at:null,auto_done:!compound,result:p.result,next_text:p.next_text,next_due:p.next_due},
  state:{inquiry_id:q.id,logs:[{id:id(40),request_id:p.operation_id,result:p.result,kind:p.result==='부재'?'attempt':'connected',next_action:p.next_text,next_check_date:p.next_due}]},
  inquiry_update:{status:'전화응대 완료',next_action_date:p.next_due}};}
 const document={addEventListener:(n,f)=>listeners[n]=f,getElementById:()=>null};
 vm.runInNewContext(read('work-request.js'),{window:R,document,Date,Map,Set,setTimeout:()=>{}});
 const S=R.WorkRequest.state();Object.assign(S,{loaded:true,list:[r],card:{[r.id]:{res:'연결됨',busy:false,err:''}}});
 const save=()=>listeners.click({target:{closest:()=>({dataset:{wr:'save',id:r.id},closest:()=>true})},preventDefault(){},stopPropagation(){}});
 return {R,S,q,r,calls,takes,messages,storage,save};
}
test('only server-confirmed atomic ACK updates state; no legacy fire-and-forget or result-only completion',async()=>{
 const x=setup();await x.save();assert.equal(x.calls[0][0],'crm_work_request_inquiry_contact_v1');
 assert.equal(x.calls.some(c=>c[0]==='crm_work_request_reply_v1'),false);assert.equal(x.takes.length,1);assert.equal(x.q.status,'전화응대 완료');assert.equal(x.storage.size,0);
});

test('objective API is data-only, gated, and does not apply old receipt to customer or request state',async()=>{
 const x=setup({rpc:async(_f,p)=>objectiveAck(p)}),p=objectivePayload();const a=await x.R.WorkRequest.objectives.write(p);
 assert.equal(a.request_complete,true);assert.equal(x.calls[0][0],'crm_work_request_objectives_write_v1');assert.equal(x.r.status,'sent');assert.equal(x.q.status,'배정완료');assert.equal(x.storage.size,0);
 const off=setup({gate:false});assert.equal(off.R.WorkRequest.objectives.enabled(),false);await assert.rejects(off.R.WorkRequest.objectives.write(p));assert.equal(off.calls.length,0);
});
test('objective lost response retries exact payload across reload and blocks edits while uncertain',async()=>{
 const storage=new Map(),p=objectivePayload(),x=setup({storage,rpc:async()=>{throw Error('network');}});
 await assert.rejects(x.R.WorkRequest.objectives.write(p));await assert.rejects(x.R.WorkRequest.objectives.write({...p,complete:false}));assert.equal(x.calls.length,1);
 const y=setup({storage,rpc:async(_f,p)=>({...objectiveAck(p),replayed:true})});await y.R.WorkRequest.objectives.retry(p.id);
 assert.deepEqual(y.calls[0][1],p);assert.equal(storage.size,0);assert.equal(y.r.status,'sent');
});
test('objective malformed ACK, login change and concurrent click never imply completion',async()=>{
 for(const mutate of [a=>a.revision=5,a=>a.decisions[0].note='다른 판단',a=>a.contact_proof.satisfied_asks=[],a=>a.request.asks=[]]){
  const x=setup({rpc:async(_f,p)=>{const a=objectiveAck(p);mutate(a);return a;}});await assert.rejects(x.R.WorkRequest.objectives.write(objectivePayload()));assert.equal(x.storage.size,1);assert.equal(x.r.status,'sent');
 }
 let release;const x=setup({rpc:(_f,p)=>new Promise(resolve=>{release=()=>resolve(objectiveAck(p));})});const pending=x.R.WorkRequest.objectives.write(objectivePayload());
 await assert.rejects(x.R.WorkRequest.objectives.write(objectivePayload()));assert.equal(x.calls.length,1);x.R.ME.id=id(3);release();await assert.rejects(pending);assert.equal(x.storage.size,1);
});
test('objective definite rollback clears retry data; storage failure prevents RPC',async()=>{
 const x=setup({rpc:async()=>{throw Object.assign(Error('conflict'),{code:'40001',databaseRejected:true});}});await assert.rejects(x.R.WorkRequest.objectives.write(objectivePayload()));assert.equal(x.storage.size,0);
 const uncertain=setup({rpc:async()=>{throw Object.assign(Error('connection lost'),{code:'40001'});}});await assert.rejects(uncertain.R.WorkRequest.objectives.write(objectivePayload()));assert.equal(uncertain.storage.size,1);
 const y=setup();y.R.localStorage.setItem=()=>{throw Error('quota');};await assert.rejects(y.R.WorkRequest.objectives.write(objectivePayload()));assert.equal(y.calls.length,0);
});
test('objective read validates context, account and twenty-row page without writing',async()=>{
 const x=setup({rpc:async(_f,p)=>({...objectiveAck({...objectivePayload(),complete:false}),history:[],history_page:p.page,history_total:0,history_has_more:false})});
 const c=await x.R.WorkRequest.objectives.read(id(20),2);assert.equal(c.client_actor_id,id(1));assert.equal(x.calls[0][0],'crm_work_request_objectives_read_v1');assert.equal(x.storage.size,0);
 await assert.rejects(x.R.WorkRequest.objectives.read(id(20),0));assert.equal(x.calls.length,1);
 const bad=setup({rpc:async()=>({...objectiveAck(objectivePayload()),history:Array(21).fill({}),history_page:1,history_total:21,history_has_more:false})});await assert.rejects(bad.R.WorkRequest.objectives.read(id(20)));
 for(const file of ['pc-manager-transport.js','pc-error-state.js','work-request.js'])for(const name of ['crm_work_request_objectives_read_v1','crm_work_request_objectives_write_v1'])assert.ok(read(file).includes(name));
});
test('pending response has no optimistic completion and double-click cannot write twice',async()=>{
 let release;const x=setup({rpc:(_f,p,ack)=>new Promise(resolve=>{release=()=>resolve(ack(p));})});const pending=x.save();await x.save();
 assert.equal(x.calls.length,1);assert.equal(x.r.status,'sent');assert.equal(x.q.status,'배정완료');assert.equal(x.takes.length,0);release();await pending;
});
test('lost ACK persists operation across reload and retries exact payload without applying historical state',async()=>{
 const storage=new Map(),a=setup({storage,rpc:async()=>{throw Error('connection lost');}});await a.save();const original=a.calls[0][1];assert.equal(storage.size,1);assert.equal(a.q.status,'배정완료');
 const b=setup({storage,rpc:async(_f,p,ack)=>({...ack(p),replayed:true})});await b.save();assert.deepEqual(b.calls[0][1],original);assert.equal(b.takes.length,0);assert.equal(b.q.status,'배정완료');assert.equal(storage.size,0);
});
test('changed choice after uncertain save is blocked, no new operation silently replaces it',async()=>{
 const x=setup({rpc:async()=>{throw Error('unknown');}});await x.save();x.S.card[x.r.id].res='부재';await x.save();assert.equal(x.calls.length,1);assert.equal(x.storage.size,1);
});
test('invalid/mismatched acknowledgement keeps pending receipt and request open',async()=>{
 for(const change of [a=>a.ok=false,a=>a.operation_id=id(31),a=>a.request.to_user_id=id(3),a=>a.state.logs=[],a=>a.request.status='absent',a=>a.inquiry_update.next_action_date='2000-01-01']){
  const x=setup({rpc:async(_f,p,ack)=>{const a=ack(p);change(a);return a;}});await x.save();assert.equal(x.takes.length,0);assert.equal(x.storage.size,1);assert.equal(x.r.status,'sent');assert.equal(x.q.status,'배정완료');
 }
});
test('absent ACK keeps working state and messages do not claim completion',async()=>{
 const x=setup();x.S.card[x.r.id].res='부재';await x.save();assert.equal(x.S.list[0].status,'working');assert.match(x.messages[0],/진행 중/);assert.doesNotMatch(x.messages[0],/완료/);
});
test('deployment gate and unavailable persistent storage prevent writes',async()=>{
 for(const gate of [false,null,undefined]){const x=setup({gate:gate===undefined?null:gate});await x.save();assert.equal(x.calls.length,0);assert.equal(x.takes.length,0);}
 const x=setup();x.R.localStorage.setItem=()=>{throw Error('quota');};await x.save();assert.equal(x.calls.length,0);
});
test('account change/stale assignment never applies original ACK; basic request cannot auto-close from local evidence',async()=>{
 let x;x=setup({rpc:async(_f,p,ack)=>{x.R.ME.id=id(3);return ack(p);}});await x.save();assert.equal(x.takes.length,0);assert.equal(x.storage.size,1);
 const y=setup();y.q.assigned_to=id(3);await y.save();assert.equal(y.takes.length,0);assert.equal(y.q.status,'배정완료');
 const z=setup();assert.equal(z.R.WorkRequest.evidence(z.r),null);z.R.WorkRequest.autoClose();assert.equal(z.calls.length,0);
});
test('migration mirror, transport and error registry stay coupled with strict release gate',()=>{
 const f='20261009211508_request_contact_atomic.sql';assert.equal(read('sql/'+f),read('supabase/migrations/'+f));
 for(const file of ['pc-manager-transport.js','pc-error-state.js'])assert.match(read(file),/crm_work_request_inquiry_contact_v1/);
 assert.match(read('work-request.js'),/CRMRelease.has\(fn\)!==true/);
});

const compoundAsks=['고객 첫 연락','연락 후 견적 필요 여부 확인','현장방문 필요 여부 확인'];
test('compound contact saves through v2 and never infers remaining objectives or full completion',async()=>{
 for(const result of ['연결됨','검토중','견적요청','부재']){
  const x=setup({asks:compoundAsks});x.S.card[x.r.id].res=result;await x.save();
  assert.equal(x.calls[0][0],'crm_work_request_inquiry_contact_v2');assert.equal(x.S.list[0].status,'working');
  assert.equal(x.takes.length,1);assert.equal(x.storage.size,0);assert.match(x.messages[0],/진행 중/);assert.doesNotMatch(x.messages[0],/요청 완료/);
  assert.equal(x.calls.some(c=>c[0]==='crm_work_request_reply_v1'),false);
 }
});
test('compound acknowledgement cannot claim done, omit or invent fulfilled objectives',async()=>{
 for(const change of [a=>a.request.status='done',a=>a.request.closed_at=new Date().toISOString(),a=>a.request.auto_done=true,a=>a.completion=null,
  a=>a.completion.request_complete=true,a=>a.completion.remaining_asks=[],a=>a.completion.satisfied_asks=compoundAsks,a=>a.completion.contact_log_id=id(90)]){
  const x=setup({asks:compoundAsks,rpc:async(_f,p,ack)=>{const a=ack(p);change(a);return a;}});await x.save();
  assert.equal(x.takes.length,0);assert.equal(x.r.status,'sent');assert.equal(x.storage.size,1);
 }
});
test('all first-contact requests exclude local automatic close and unsupported asks never use legacy writes',async()=>{
 for(const asks of [compoundAsks,['고객 첫 연락','임의 요청'],['현장방문 필요 여부 확인'],['고객 첫 연락','고객 첫 연락']]){
  const x=setup({asks});assert.equal(x.R.WorkRequest.evidence(x.r),null);x.R.WorkRequest.autoClose();assert.equal(x.calls.length,0);
  if(asks!==compoundAsks){await x.save();assert.equal(x.calls.length,0);assert.match(x.S.card[x.r.id].err,/확인 항목/);}
 }
});
test('compound release gate, uncertain retry and account switch retain first-contact safeguards',async()=>{
 const x=setup({asks:compoundAsks});x.R.CRMRelease.has=fn=>fn!=='crm_work_request_inquiry_contact_v2';await x.save();assert.equal(x.calls.length,0);
 const storage=new Map(),a=setup({asks:compoundAsks,storage,rpc:async()=>{throw Error('network unknown');}});await a.save();
 const b=setup({asks:compoundAsks,storage,rpc:async(_f,p,ack)=>({...ack(p),replayed:true})});await b.save();
 assert.deepEqual(b.calls[0],a.calls[0]);assert.equal(b.takes.length,0);assert.equal(storage.size,0);
 let c;c=setup({asks:compoundAsks,rpc:async(_f,p,ack)=>{c.R.ME.id=id(3);return ack(p);}});await c.save();assert.equal(c.takes.length,0);assert.equal(c.storage.size,1);
});
test('compound migration and exposed RPC registry accompany the feature',()=>{
 const f='20261009215629_request_compound_contact.sql';assert.equal(read('sql/'+f),read('supabase/migrations/'+f));
 for(const file of ['pc-manager-transport.js','pc-error-state.js'])assert.match(read(file),/crm_work_request_inquiry_contact_v2/);
});

test('definite server rejection releases pending payload while uncertain errors retain it',async()=>{
 const x=setup({rpc:async()=>{throw Object.assign(Error('schedule rejected'),{code:'22023',databaseRejected:true});}});
 await x.save();assert.equal(x.storage.size,0);x.S.card[x.r.id].res='부재';await x.save();assert.equal(x.calls.length,2);assert.equal(x.takes.length,0);
 const y=setup({rpc:async()=>{throw Object.assign(Error('connection lost'),{code:'22023'});}});await y.save();assert.equal(y.storage.size,1);
});
test('OpsStore preserves only explicit PostgreSQL rollback evidence',async()=>{
 for(const code of ['22023','42501','40001','PGRST301',undefined]){
  const R={ME:{},SB:{rpc:async()=>({error:{code,message:'rejected'}})}};
  vm.runInNewContext(read('ops-store.js'),{window:R,Date,Set,Map});
  await assert.rejects(R.OpsStore.rpc('crm_work_request_inquiry_contact_v1',{}),e=>e.code===code&&e.databaseRejected===['22023','42501','40001'].includes(code));
 }
});
