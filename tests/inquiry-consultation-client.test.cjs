const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../inquiry-consultation-client.js');
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const L='20000000-0000-4000-8000-000000000001',R='20000000-0000-4000-8000-000000000002';
const REQ='30000000-0000-4000-8000-000000000001',EV='40000000-0000-4000-8000-000000000001';
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=()=>({ok:true,left_id:L,right_id:R,active:false,expected:{rows:{[L]:'1:a',[R]:'2:b'},relationship_version:0},inquiries:[{id:L,status:'배드핏',assigned_to:A},{id:R,status:'접수',assigned_to:null}]});
function harness(){
 const data=new Map(),calls=[],state={actor:{auth_uid:A,user_id:A},view:initial(),receipt:null,hook:null,writes:0};
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const rpc=async(name,args)=>{
  calls.push({name,args:clone(args)});
  if(state.hook){const value=await state.hook(name,args);if(value!==undefined)return value;}
  if(name.endsWith('preview_v1'))return clone(state.view);
  state.writes++;
  if(!state.receipt){state.receipt={ok:true,request_id:args.p_request_id,left_id:L,right_id:R,operation:args.p_operation,active:args.p_operation==='link',event_id:EV,version:args.p_expected.relationship_version+1,saved_at:'2026-10-06T12:00:00Z'};state.view.active=state.receipt.active;state.view.expected.relationship_version=state.receipt.version;}
  return clone(state.receipt);
 };
 const make=()=>create({profile:()=>state.actor,storage,rpc,uuid:()=>REQ});
 return {state,data,calls,storage,make,client:make()};
}
const rejection=(message,code)=>Object.assign(Error(message),{code});

test('load performs no RPC; preview normalizes pair; save validates receipt and reads current relation without changing original inquiries',async()=>{
 const h=harness(),before=initial();assert.equal(h.calls.length,0);
 const p=await h.client.preview(R,L);const result=await h.client.save(p,'link',' same work ');
 assert.equal(result.saved,true);assert.equal(result.verified,true);assert.equal(result.superseded,false);
 assert.equal(h.calls[1].args.p_reason,'same work');assert.equal(h.calls[0].args.p_left,L);
 assert.deepEqual(p,before);assert.deepEqual(result.current.inquiries,before.inquiries);assert.equal(h.client.pending(),null);
});
test('duplicate clicks share the pending promise; different intent cannot replace it',async()=>{
 const h=harness();let release;h.state.hook=async n=>{if(n.endsWith('write_v1'))await new Promise(r=>release=r);};
 const one=h.client.save(initial(),'link','same work'),two=h.client.save(initial(),'link','same work');
 assert.equal(one,two);assert.throws(()=>h.client.save(initial(),'link','different work'),/PENDING_REQUEST_EXISTS/);
 release();await one;assert.equal(h.state.writes,1);
});
test('uncertain response survives client recreation and retries exact request and snapshot',async()=>{
 const h=harness();let first=true;h.state.hook=async n=>{if(first&&n.endsWith('write_v1')){first=false;throw Error('connection lost');}};
 await assert.rejects(h.client.save(initial(),'link','same work'),/connection lost/);
 const old=clone(h.client.pending());const client=h.make();await client.retry();
 const writes=h.calls.filter(c=>c.name.endsWith('write_v1'));assert.equal(writes.length,2);assert.deepEqual(writes[0].args,writes[1].args);assert.equal(writes[1].args.p_request_id,old.args.p_request_id);
});
test('saved receipt survives failed readback: retry only reads and reports a later unlink as superseded',async()=>{
 const h=harness();h.state.hook=async n=>{if(n.endsWith('preview_v1'))throw Error('offline');};
 const one=await h.client.save(initial(),'link','same work');assert.equal(one.saved,true);assert.equal(one.verified,false);assert.ok(h.client.pending().ack);
 h.state.hook=null;h.state.view.active=false;h.state.view.expected.relationship_version=2;
 const two=await h.make().retry();assert.equal(h.state.writes,1);assert.equal(two.superseded,true);assert.equal(two.current.active,false);assert.equal(two.receipt.active,true);
});
test('partial or mismatched ACK cannot be treated as saved and remains pending',async()=>{
 for(const patch of [{ok:true},{request_id:B},{left_id:R},{operation:'unlink'},{active:false},{version:20},{event_id:'x'},{saved_at:'x'}]){
  const h=harness();h.state.hook=async n=>n.endsWith('write_v1')?{ok:true,request_id:REQ,left_id:L,right_id:R,operation:'link',active:true,event_id:EV,version:1,saved_at:'2026-10-06T12:00:00Z',...patch,...(Object.keys(patch).length===1&&patch.ok?{event_id:undefined}:{})}:undefined;
  await assert.rejects(h.client.save(initial(),'link','same work'),/INVALID_ACK/);assert.ok(h.client.pending());
 }
});
test('explicit stale rejection clears only rejected command, never automatically renews preview or retries',async()=>{
 const h=harness();h.state.hook=async()=>{throw rejection('STALE_PREVIEW','PT409');};
 await assert.rejects(h.client.save(initial(),'link','same work'),/STALE_PREVIEW/);assert.equal(h.client.pending(),null);assert.equal(h.calls.length,1);
 const uncertain=harness();uncertain.state.hook=async()=>{throw Error('STALE_PREVIEW');};
 await assert.rejects(uncertain.client.save(initial(),'link','same work'));assert.ok(uncertain.client.pending());
});
test('account switch during save never reports success or replays previous user pending command',async()=>{
 const h=harness();h.state.hook=async n=>{if(n.endsWith('write_v1'))h.state.actor={auth_uid:B,user_id:B};};
 await assert.rejects(h.client.save(initial(),'link','same work'),/IDENTITY_CHANGED/);
 assert.equal(h.client.pending(),null);assert.throws(()=>h.client.retry(),/NO_PENDING_REQUEST/);assert.equal(h.data.size,1);
 h.state.actor={auth_uid:A,user_id:A};h.state.hook=null;assert.equal((await h.client.retry()).verified,true);
});
test('account switch during readback cannot expose the previous account result',async()=>{
 const h=harness();h.state.hook=async n=>{if(n.endsWith('preview_v1'))h.state.actor={auth_uid:B,user_id:B};};
 await assert.rejects(h.client.save(initial(),'link','same work'),/IDENTITY_CHANGED/);assert.equal(h.data.size,1);
});
test('invalid preview, same pair, missing reason and storage failure cause no write',async()=>{
 const h=harness();await assert.rejects(h.client.preview(L,L),/INVALID_PAIR/);
 assert.throws(()=>h.client.save({...initial(),expected:{}},'link','same work'),/INVALID_PREVIEW/);
 assert.throws(()=>h.client.save(initial(),'link','  '),/INVALID_REQUEST/);
 h.storage.setItem=()=>{throw Error('quota');};assert.throws(()=>h.client.save(initial(),'link','same work'),/quota/);assert.equal(h.calls.length,0);
});
test('mutating a returned pending copy cannot change the persisted request',async()=>{
 const h=harness();h.state.hook=async()=>{throw Error('offline');};await assert.rejects(h.client.save(initial(),'link','same work'));
 const p=h.client.pending();p.args.p_operation='unlink';p.args.p_expected.rows[L]='changed';
 assert.equal(h.client.pending().args.p_operation,'link');assert.equal(h.client.pending().args.p_expected.rows[L],'1:a');
});
test('readback cannot regress version or disagree with the receipt at the same version',async()=>{
 for(const [version,active] of [[0,false],[1,false]]){
  const h=harness();h.state.hook=async n=>{if(n.endsWith('preview_v1')){const v=initial();v.expected.relationship_version=version;v.active=active;return v;}};
  await assert.rejects(h.client.save(initial(),'link','same work'),/READBACK_MISMATCH/);assert.ok(h.client.pending().ack);
 }
});
