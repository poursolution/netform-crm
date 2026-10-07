const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const state={dec:[],blk:null,blkAt:'',prg:[],def:[],chk:{},wait:null};
function env(rpc){const events=[],handlers={},root={ME:{id:'one'},CRMRelease:{has:()=>true},OpsStore:{has:()=>true,rpc},addEventListener:(n,f)=>handlers[n]=f,dispatchEvent:e=>events.push(e),toast:()=>{}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../activity-context.js'),'utf8'),{window:root,Map,Set,Promise,Date,CustomEvent:class{constructor(type){this.type=type;}}});return {root,A:root.ActivityContext,events,handlers};}
const id=i=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i).padStart(12,'0');
test('memo context batches requested IDs, caches empty proven results, and clears identity data',async()=>{
 const calls=[],{root,A,handlers}=env(async(n,p)=>{calls.push(p.deal_ids);return {ok:true,items:Object.fromEntries(p.deal_ids.map(x=>[x,state]))};});
 for(let i=0;i<205;i++)assert.equal(A.of({id:id(i)}),null);await A.load();assert.deepEqual(calls.map(x=>x.length),[200,5]);assert.deepEqual(A.of({id:id(1)}),state);await A.load();assert.equal(calls.length,2);
 root.ME={id:'two'};handlers['phase1:identity-cleared']();assert.equal(A.of({id:id(1)}),null);await A.load();assert.equal(calls.length,3);
});
test('memo context never accepts late responses from previous login or unauthorized empty object as history',async()=>{
 let done;const {root,A,handlers}=env(()=>new Promise(r=>done=r));A.of({id:id(1)});const p=A.load();root.ME={id:'two'};handlers['phase1:profile']();done({ok:true,items:{[id(1)]:state}});await p;
 root.OpsStore.rpc=async()=>({ok:true,items:{}});assert.equal(A.of({id:id(1)}),null);await A.load();assert.equal(A.of({id:id(1)}),null);
});
