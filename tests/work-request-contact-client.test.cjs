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

const tick=()=>new Promise(setImmediate);
function existingContact(x,result='연결됨'){
 x.r.created_at=new Date(Date.now()-60000).toISOString();
 const log={id:id(41),occurred_at:new Date().toISOString(),contact_result:result};
 x.R.InquiryFlow.server=()=>({inquiry_id:x.q.id,logs:[log]});return log;
}
function linkAck(x,p,result='연결됨'){
 return {ok:true,contract_version:1,inquiry_id:x.q.id,log_id:p.log_id,linked:true,next_action_id:id(71),
  request:{...x.r,status:result==='부재'?'working':'done',next_text:'기존 후속 일정',next_due:'2026-10-12',result}};
}
test('server-loaded contact reconciliation has no optimistic completion and shares in-flight lock',async()=>{
 const x=setup();existingContact(x);let release;
 x.R.OpsStore.rpc=(fn,p)=>{x.calls.push([fn,p]);return fn==='crm_work_request_contact_link_v1'?new Promise(ok=>release=()=>ok(linkAck(x,p))):Promise.resolve({ok:true,requests:[x.S.list[0]]});};
 x.R.WorkRequest.autoClose();x.R.WorkRequest.autoClose();await tick();assert.equal(x.calls.length,1);assert.equal(x.S.list[0].status,'sent');
 release();await tick();assert.equal(x.S.list[0].status,'done');assert.equal(x.takes.length,0);
 assert.equal(x.calls.some(c=>['crm_work_request_reply_v1','crm_work_request_inquiry_contact_v1'].includes(c[0])),false);
});
test('unavailable deployment, local-only records, proxy and stale assignment cannot reconcile',async()=>{
 for(const mode of ['gate','local','proxy','owner','old','legacy']){
  const x=setup();const log=existingContact(x);
  if(mode==='gate')x.R.CRMRelease.has=()=>false;
  if(mode==='local')delete x.R.InquiryFlow.server;
  if(mode==='proxy'){x.r.to_me=false;x.R.todayIsAdmin=()=>true;}
  if(mode==='owner')x.q.assigned_to=id(3);
  if(mode==='old')log.occurred_at='2000-01-01T00:00:00Z';
  if(mode==='legacy')delete log.contact_result;
  x.R.WorkRequest.autoClose();await tick();assert.equal(x.calls.length,0,mode);
 }
});
test('link invalid ACK and uncertain error leave request open and suppress rapid repeated calls',async()=>{
 for(const fail of ['offline','wronglog','wrongowner','wrongstatus','missingtask']){
  const x=setup();existingContact(x);x.R.OpsStore.rpc=async(fn,p)=>{x.calls.push([fn,p]);if(fail==='offline')throw Error('offline');const a=linkAck(x,p);
   if(fail==='wronglog')a.log_id=id(99);if(fail==='wrongowner')a.request.to_user_id=id(3);if(fail==='wrongstatus')a.request.status='absent';if(fail==='missingtask')delete a.next_action_id;return a;};
  x.R.WorkRequest.autoClose();await tick();x.R.WorkRequest.autoClose();await tick();assert.equal(x.calls.length,1,fail);assert.equal(x.S.list[0].status,'sent');
 }
});
test('link result after account change or newer state never replaces current state',async()=>{
 for(const mode of ['account','save']){
  const x=setup();existingContact(x);let release;x.R.OpsStore.rpc=(fn,p)=>fn==='crm_work_request_contact_link_v1'?new Promise(ok=>release=()=>ok(linkAck(x,p))):Promise.resolve({ok:true,requests:[x.S.list[0]]});
  x.R.WorkRequest.autoClose();await tick();if(mode==='account')x.R.ME.id=id(3);else {x.S.list=[{...x.r,status:'cancelled'}];x.S.gen=1;}
  release();await tick();assert.equal(x.S.list[0].status,mode==='account'?'sent':'cancelled');
 }
});
test('absence link remains working and a new stored log can be reconciled independently',async()=>{
 const x=setup();let log=existingContact(x,'부재');x.R.OpsStore.rpc=async(fn,p)=>{x.calls.push([fn,p]);return fn==='crm_work_request_contact_link_v1'?linkAck(x,p,log.contact_result):{ok:true,requests:[x.S.list[0]]};};
 x.R.WorkRequest.autoClose();await tick();assert.equal(x.S.list[0].status,'working');x.R.WorkRequest.autoClose();await tick();assert.equal(x.calls.filter(c=>c[0]==='crm_work_request_contact_link_v1').length,1);
 log.id=id(42);log.contact_result='연결됨';x.R.WorkRequest.autoClose();await tick();assert.equal(x.S.list[0].status,'done');
});
test('contact-link SQL mirror, error name, allowlist and strict release gate are shipped together',()=>{
 const f='20261010013000_request_contact_link.sql';assert.equal(read('sql/'+f),read('supabase/migrations/'+f));
 for(const file of ['pc-manager-transport.js','pc-error-state.js'])assert.match(read(file),/crm_work_request_contact_link_v1/);
 assert.match(read('work-request.js'),/CRMRelease.has\(CONTACT_LINK\)!==true/);
});
test('lost link ACK resolves from current server request without replaying contact or task writes',async()=>{
 const x=setup();existingContact(x);let first=true,server;
 x.R.OpsStore.rpc=async(fn,p)=>{x.calls.push([fn,p]);if(fn==='crm_work_request_list_v1')return {ok:true,requests:[server]};
  if(first){first=false;server=linkAck(x,p).request;throw Error('lost ACK');}
  return {...linkAck(x,p),linked:false,reason:'request_closed',request:server};};
 x.R.WorkRequest.autoClose();await tick();assert.equal(x.S.list[0].status,'sent');
 Object.values(x.S.contactLinks).forEach(e=>e.at=0);x.R.WorkRequest.autoClose();await tick();
 assert.equal(x.S.list[0].status,'done');assert.equal(x.calls.filter(c=>c[0]==='crm_work_request_contact_link_v1').length,2);
});
test('slow pre-save list cannot revert confirmed completion and schedules one current reload',async()=>{
 const x=setup(),pending=[];let reads=0;const original=x.R.OpsStore.rpc;
 x.R.OpsStore.rpc=(fn,p)=>fn==='crm_work_request_list_v1'?(reads++,new Promise(resolve=>pending.push(resolve))):original(fn,p);
 const stale=JSON.parse(JSON.stringify(x.r));const first=x.R.WorkRequest.load(true);await tick();
 await x.save();assert.equal(x.S.list[0].status,'done');assert.equal(reads,1);
 x.R.WorkRequest.load(true);x.R.WorkRequest.load(true);
 pending.shift()({ok:true,requests:[stale]});await first;await tick();
 assert.equal(x.S.list[0].status,'done');assert.equal(reads,2);
 pending.shift()({ok:true,requests:[{...stale,status:'done'}]});await tick();
 assert.equal(x.S.list[0].status,'done');assert.equal(reads,2);assert.equal(x.S.busy,false);
});
test('forced refresh is retained after an in-flight failure; malformed lists preserve confirmed state',async()=>{
 const x=setup();let reject,reads=0;
 x.R.OpsStore.rpc=()=>++reads===1?new Promise((_ok,no)=>reject=no):Promise.resolve({ok:true,requests:[{...x.r,status:'working'}]});
 const first=x.R.WorkRequest.load(true);await tick();x.R.WorkRequest.load(true);reject(Error('offline'));await first;await tick();
 assert.equal(reads,2);assert.equal(x.S.list[0].status,'working');
 x.R.OpsStore.rpc=async()=>({ok:false,requests:[]});await x.R.WorkRequest.load(true);assert.equal(x.S.list[0].status,'working');
});
test('list response after identity or state replacement never changes the new session',async()=>{
 for(const change of ['account','state']){const x=setup();let resolve;
  x.R.OpsStore.rpc=()=>new Promise(ok=>resolve=ok);const read=x.R.WorkRequest.load(true);await tick();x.R.WorkRequest.load(true);
  if(change==='account')x.R.ME.id=id(3);else x.R.G.workReq={list:[],loaded:false};
  resolve({ok:true,requests:[{...x.r,status:'done'}]});await read;await tick();
  assert.equal(x.S.list[0].status,'sent');assert.equal(x.S.busy,false);assert.equal(x.S.again,false);
  if(change==='state')assert.equal(x.R.G.workReq.list.length,0);
 }
});
test('quote completion requires every selected known objective, preserving single-objective requests',()=>{
 const x=setup();x.R.dealKey=d=>d.id;const fields={};x.R.B.deals=[{id:'quote-deal',stage_contexts:{consulting:{fields}}}];
 const r={target_type:'deal',target_id:'quote-deal',kind:'quote',asks:['견적 요청 등록','견적 예정일 입력']};
 fields.quote_due='2026-10-20';assert.equal(x.R.WorkRequest.evidence(r),null);
 fields.quote_request='   ';assert.equal(x.R.WorkRequest.evidence(r),null);
 fields.quote_request='공식 견적 요청';assert.ok(x.R.WorkRequest.evidence(r));
 delete fields.quote_due;assert.equal(x.R.WorkRequest.evidence(r),null);
 assert.ok(x.R.WorkRequest.evidence({...r,asks:['견적 요청 등록']}));
 assert.equal(x.R.WorkRequest.evidence({...r,asks:['미지원 확인 항목']}),null);
 assert.equal(x.R.WorkRequest.evidence({...r,asks:[]}),null);
});
