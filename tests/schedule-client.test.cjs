const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const make=require('../schedule-contract.js'),fs=require('node:fs'),path=require('node:path');
function fixture(){
 const id=randomUUID(),a={auth_uid:randomUUID(),user_id:randomUUID()},calls=[],events={};
 const context={ok:true,contract:'crm.schedule.v1',enabled:true,writable:true,target_type:'deal',target_id:id,token:'a'.repeat(32),page:1,per:20,total:0,items:[],owner_id:a.user_id,actor_auth_uid:a.auth_uid,actor_user_id:a.user_id};
 const root={CRM_SCHEDULE_V1:true,CRMRelease:{has:()=>true,noteMissing:n=>calls.push(n)},addEventListener:(n,f)=>events[n]=f,Phase1:{profile:a,rpc:async(n,{p})=>{calls.push({n,p});return context;}}};
 return {root,id,calls,events,context,api:make(root)};
}
const input={operation:'add',due_on:'2026-10-20',date_basis:'internal_plan',action_type:'후속접촉',title:'견적 보내기'};
function ack(f,p){const aid=randomUUID();return {ok:true,contract:'crm.schedule.v1',request_id:p.command.request_id,target_type:'deal',target_id:f.id,operation:'add',actor_auth_uid:f.context.actor_auth_uid,actor_user_id:f.context.actor_user_id,due_on:input.due_on,date_basis:input.date_basis,action_id:aid,event_id:randomUUID(),action_status:'open',after:{id:aid,deal_id:f.id,status:'open',completed_at:null,due_at:input.due_on+'T00:00:00+09:00'},token:'b'.repeat(32),cancelled_action_ids:[],completed_action_ids:[]};}
test('flag and CRMRelease gate default closed even when server exists',async()=>{const f=fixture();delete f.root.CRM_SCHEDULE_V1;assert.equal((await f.api.list('deal',f.id)).ready,false);f.root.CRM_SCHEDULE_V1=true;delete f.root.CRMRelease;assert.equal((await f.api.list('deal',f.id)).ready,false);});
test('server disabled cannot prepare write',async()=>{const f=fixture();f.context.enabled=false;const c=await f.api.list('deal',f.id);assert.equal(c.ready,false);assert.throws(()=>f.api.prepare(c,input,randomUUID()),/RELEASE_DISABLED/);});
test('request UUID mandatory and retained for retry',async()=>{const f=fixture(),c=await f.api.list('deal',f.id);assert.throws(()=>f.api.prepare(c,input),/REQUEST_ID_REQUIRED/);const p=f.api.prepare(c,input,randomUUID()),r=ack(f,p);f.root.Phase1.rpc=async(n,{p:c})=>{f.calls.push(c);return r;};await f.api.write(p);await f.api.write(p);assert.equal(f.calls.at(-1).request_id,f.calls.at(-2).request_id);assert(Object.isFrozen(p.command));});
test('wrong target or completed ACK never succeeds',async()=>{const f=fixture(),p=f.api.prepare(await f.api.list('deal',f.id),input,randomUUID()),r=ack(f,p);f.root.Phase1.rpc=async()=>({...r,target_id:randomUUID()});await assert.rejects(()=>f.api.write(p),/ACK_MISMATCH/);f.root.Phase1.rpc=async()=>({...r,completed_action_ids:[randomUUID()]});await assert.rejects(()=>f.api.write(p),/ACK_MISMATCH/);});
test('unknown save can reconcile after flag off without resending',async()=>{const f=fixture(),p=f.api.prepare(await f.api.list('deal',f.id),input,randomUUID()),r=ack(f,p);f.root.CRM_SCHEDULE_V1=false;f.root.Phase1.rpc=async n=>{assert.equal(n,'crm_schedule_receipt_v1');return {ok:true,contract:'crm.schedule.v1',request_id:p.command.request_id,found:true,ack:r};};assert.equal((await f.api.receipt(p)).action_id,r.action_id);});
test('missing receipt is not completion and generates no command',async()=>{const f=fixture(),p=f.api.prepare(await f.api.list('deal',f.id),input,randomUUID());let calls=0;f.root.Phase1.rpc=async()=>{calls++;return {ok:true,contract:'crm.schedule.v1',request_id:p.command.request_id,found:false,ack:null};};assert.equal(await f.api.receipt(p),null);assert.equal(calls,1);});
test('identity change during await rejects result',async()=>{const f=fixture();f.root.Phase1.rpc=async()=>{f.events['phase1:identity-cleared']();return f.context;};await assert.rejects(()=>f.api.list('deal',f.id),/IDENTITY_CHANGED/);});
test('more than 20 items or mismatched page rejected',async()=>{const f=fixture();f.context.items=Array.from({length:21},()=>({id:randomUUID(),status:'open',date_basis:'unconfirmed'}));await assert.rejects(()=>f.api.list('deal',f.id),/CONTRACT_MISMATCH/);});
test('missing server function records CRMRelease failure',async()=>{const f=fixture();f.root.Phase1.rpc=async()=>{throw Object.assign(Error('missing'),{code:'PGRST202'});};await assert.rejects(()=>f.api.list('deal',f.id),/missing/);assert.equal(f.calls.at(-1),'crm_schedule_list_v1');});
test('same PR contract has SQL, PC/mobile allow lists and error names',()=>{const dir=path.resolve(__dirname,'..'),sql=fs.readFileSync(path.join(dir,'sql/schedule-preserve-v1-20261011.sql'),'utf8');for(const n of ['crm_schedule_list_v1','crm_schedule_write_v1','crm_schedule_receipt_v1']){assert(sql.includes('function public.'+n+'('));for(const file of ['transport.js','pc-manager-transport.js','pc-error-state.js'])assert(fs.readFileSync(path.join(dir,file),'utf8').includes(n));}});

function cold(f){const events={},root={...f.root,addEventListener:(n,fn)=>events[n]=fn};return {root,events,api:make(root)};}
test('cold document recovery rechecks scope and preserves the original prepared command',async()=>{
 const f=fixture();f.events['phase1:identity-cleared']();const c=await f.api.list('deal',f.id),p=f.api.prepare(c,input,randomUUID()),command=structuredClone(p.command),old=JSON.stringify(c),r=cold(f);
 f.context.token='b'.repeat(32);assert.equal(r.api.needsResume(c),true);const resumed=await r.api.resume(c,p);
 assert.notEqual(resumed.context.identity.document,c.identity.document);assert.equal(resumed.context.identity.epoch,0);assert.deepEqual(resumed.prepared.command,command);assert.equal(resumed.context.token,c.token);assert.equal(resumed.current.token,'b'.repeat(32));assert.equal(JSON.stringify(c),old);assert(Object.isFrozen(resumed.prepared.command));assert(f.calls.every(x=>x.n==='crm_schedule_list_v1'));
 const receipt=ack(f,p);r.root.Phase1.rpc=async n=>{assert.equal(n,'crm_schedule_receipt_v1');return {ok:true,contract:'crm.schedule.v1',request_id:p.command.request_id,found:true,ack:receipt};};assert.equal((await r.api.receipt(resumed.prepared)).action_id,receipt.action_id);
});
test('same-document relogin cannot rebind an earlier context or emit a read',async()=>{
 const f=fixture(),c=await f.api.list('deal',f.id),p=f.api.prepare(c,input,randomUUID()),count=f.calls.length;f.events['phase1:identity-cleared']();assert.throws(()=>f.api.needsResume(c),/IDENTITY_CHANGED/);await assert.rejects(()=>f.api.resume(c,p),/IDENTITY_CHANGED/);assert.equal(f.calls.length,count);
});
test('cold recovery rejects account, owner, disabled scope and mismatched target',async()=>{
 for(const which of ['actor','owner','disabled','target']){const f=fixture(),c=await f.api.list('deal',f.id),p=f.api.prepare(c,input,randomUUID()),r=cold(f),count=f.calls.length;
  if(which==='actor')r.root.Phase1={...r.root.Phase1,profile:{auth_uid:randomUUID(),user_id:randomUUID()}};if(which==='owner')f.context.owner_id=randomUUID();if(which==='disabled')f.context.writable=false;
  const saved=which==='target'?{...p,command:{...p.command,target_id:randomUUID()}}:p;await assert.rejects(()=>r.api.resume(c,saved),/IDENTITY_CHANGED|RECOVERY_/);assert.equal(f.calls.slice(count).some(x=>x.n==='crm_schedule_write_v1'),false);if(['actor','target'].includes(which))assert.equal(f.calls.length,count);
 }
});
test('identity change during recovery scope read rejects before rebinding',async()=>{
 const f=fixture(),c=await f.api.list('deal',f.id),p=f.api.prepare(c,input,randomUUID()),r=cold(f);r.root.Phase1.rpc=async()=>{r.events['phase1:identity-cleared']();return f.context;};await assert.rejects(()=>r.api.resume(c,p),/IDENTITY_CHANGED/);assert.equal(p.identity.document,c.identity.document);
});
test('legacy contexts without document provenance never bypass an epoch mismatch',async()=>{
 const f=fixture(),c=structuredClone(await f.api.list('deal',f.id));delete c.identity.document;f.events['phase1:identity-cleared']();await assert.rejects(()=>f.api.resume(c),/IDENTITY_CHANGED/);
});
