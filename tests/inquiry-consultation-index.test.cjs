const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../inquiry-consultation-index.js'),'utf8');
function setup(rpc){
 const events={};const w={Phase1:{profile:{auth_uid:'a',user_id:'u'},rpc},CRM_RPC_ALLOW:['crm_inquiry_consultation_list_v1'],CRMRelease:{has:()=>true,noteMissing(){}},CustomEvent:class{constructor(type){this.type=type;}},
 addEventListener:(n,f)=>events[n]=f,dispatchEvent(){},console};
 w.window=w;vm.runInNewContext(source,w);return {w,x:w.InquiryConsultationIndex,events};
}
test('selected inquiry only, deduplicated read and server reload persistence',async()=>{
 let calls=[];const rpc=async(n,p)=>{calls.push(p);return {ok:true,items:[{id:'b',at:'2026-10-07',by:'관리자'}]};};
 const {x}=setup(rpc);assert.equal(calls.length,0);assert.equal(x.of('a'),null);
 await Promise.all([x.load('a'),x.load('a')]);assert.equal(calls.length,1);assert.equal(calls[0].p_inquiry,'a');
 assert.equal(x.of('a').partner_id,'b');assert.equal(x.of('a').by,'관리자');await x.load('a');assert.equal(calls.length,1);
 const fresh=setup(rpc).x;await fresh.load('a');assert.equal(fresh.of('a').partner_id,'b');
});
test('logout or identity change cannot commit an in-flight result',async()=>{
 let done;const {x,w,events}=setup(()=>new Promise(r=>done=r));
 const p=x.load('a');await Promise.resolve();w.Phase1.profile={auth_uid:'other',user_id:'other'};events['phase1:profile']();
 done({ok:true,items:[{id:'secret'}]});assert.equal(await p,false);assert.equal(x.of('a'),null);assert.equal(x.loaded('a'),false);
});
test('unlink invalidates old in-flight read; empty response is authoritative',async()=>{
 const complete=[];const {x}=setup(()=>new Promise(r=>complete.push(r)));
 const old=x.load('a');await Promise.resolve();x.invalidate(['a']);const fresh=x.load('a');await Promise.resolve();
 complete[1]({ok:true,items:[]});assert.equal(await fresh,true);
 complete[0]({ok:true,items:[{id:'stale'}]});assert.equal(await old,false);assert.equal(x.of('a'),null);assert.equal(x.loaded('a'),true);
});
test('RPC missing or failure is not a verified empty relationship',async()=>{
 const {x,w}=setup(async()=>{throw Object.assign(Error('forbidden'),{code:'42501'});});
 await x.load('a');assert.equal(x.loaded('a'),false);assert.equal(x.error('a').code,'42501');
 w.CRMRelease.has=()=>false;assert.equal(await x.load('b'),false);assert.equal(x.loaded('b'),false);
});
