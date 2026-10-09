'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
function setup({storage=new Map(),gate=true,rpc}={}){
 const listeners={},calls=[],takes=[],messages=[];
 const q={id:id(10),assigned_to:id(1),status:'배정완료'};
 const r={id:id(20),target_type:'inquiry',target_id:q.id,kind:'first',label:'첫 연락 요청',asks:['고객 첫 연락'],status:'sent',to_user_id:id(1),to_me:true};
 let last;
 const R={G:{page:'today'},ME:{id:id(1),name:'담당'},B:{inquiries:[q]},esc:String,escAttr:String,repN:String,
  crypto:{randomUUID:()=>id(30)},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  inqCtlFind:()=>q,paint:()=>{},toast:m=>messages.push(m),CRMRelease:{has:()=>gate},
  InquiryFlow:{take:s=>takes.push(s),load:()=>{},on:()=>true,state:()=>({logs:[{at:new Date().toISOString(),kind:'connected'}]})},
  InquiryListV3:{record:()=>{throw Error('legacy record must not run');}},
  OpsStore:{has:()=>true,rpc:async(fn,p)=>{calls.push([fn,JSON.parse(JSON.stringify(p))]);if(fn==='crm_work_request_list_v1')return {ok:true,requests:[last||r]};
   const x=rpc?await rpc(fn,p,ack):ack(p);last=x.request;return x;}}
 };
 function ack(p){return {ok:true,contract_version:1,operation_id:p.operation_id,inquiry_id:q.id,log_id:id(40),next_action_id:id(50),server_at:new Date().toISOString(),
  request:{...r,status:p.result==='부재'?'working':'done',result:p.result,next_text:p.next_text,next_due:p.next_due},
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
 assert.match(read('work-request.js'),/CRMRelease.has\(RPC.contact\)!==true/);
});

test('definite server rejection releases pending payload while uncertain errors retain it',async()=>{
 const x=setup({rpc:async()=>{throw Object.assign(Error('schedule rejected'),{code:'22023',databaseRejected:true});}});
 await x.save();assert.equal(x.storage.size,0);x.S.card[x.r.id].res='부재';await x.save();assert.equal(x.calls.length,2);assert.equal(x.takes.length,0);
 const y=setup({rpc:async()=>{throw Object.assign(Error('connection lost'),{code:'22023'});}});await y.save();assert.equal(y.storage.size,1);
});
test('OpsStore preserves only explicit PostgreSQL rollback evidence',async()=>{
 for(const code of ['22023','42501','PGRST301',undefined]){
  const R={ME:{},SB:{rpc:async()=>({error:{code,message:'rejected'}})}};
  vm.runInNewContext(read('ops-store.js'),{window:R,Date,Set,Map});
  await assert.rejects(R.OpsStore.rpc('crm_work_request_inquiry_contact_v1',{}),e=>e.code===code&&e.databaseRejected===['22023','42501'].includes(code));
 }
});
