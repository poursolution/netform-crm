const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function env(rpc){const handlers={},root={ME:{id:'one'},B:{expansion_events:[]},CRMRelease:{has:()=>true},OpsStore:{has:()=>true,rpc},addEventListener:(n,f)=>handlers[n]=f};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../expansion-contact.js'),'utf8'),{window:root,Map,Set,Promise,Date,crypto:require('node:crypto').webcrypto});return {root,A:root.ExpansionContact,handlers};}
test('one request with stable retry UUID, no partial group fallback, ACK required',async()=>{
 const calls=[];let fail=true;const {root,A}=env(async(n,p)=>{calls.push({n,p});if(fail)throw Error('lost ACK');return {ok:true,event:{id:'event'},linked_count:1,operation:n,request_id:p.request_id,source_opportunity_id:p.source_opportunity_id,target_ids:p.target_ids};});
 await assert.rejects(A.write('a','note',['b','b']),/lost ACK/);assert.equal(root.B.expansion_events.length,0);
 fail=false;await A.write('a','note',['b']);assert.equal(calls[0].p.request_id,calls[1].p.request_id);assert.deepEqual([...calls[1].p.target_ids],['b']);
 root.CRMRelease.has=()=>false;await assert.rejects(A.write('a','note',['b']),/준비되지/);assert.equal(calls.length,2);
});
test('selected pool context coalesces, caches and rejects other login response',async()=>{
 let done,calls=0;const {root,A,handlers}=env(()=>{calls++;return new Promise(r=>done=r);});const first=A.read('a'),second=A.read('a');assert.equal(first,second);done({ok:true,events:[{source_opportunity_id:'a',note:'original'}]});await first;
 await A.read('a');assert.equal(calls,1);assert.equal(root.B.expansion_events[0].note,'original');
 const p=A.read('b');root.ME={id:'two'};root.B={expansion_events:[]};handlers['phase1:identity-cleared']();done({ok:true,events:[{source_opportunity_id:'b',note:'hidden'}]});assert.equal(await p,false);assert.equal(root.B.expansion_events.length,0);
});
test('a read started before a successful save cannot replace acknowledged history',async()=>{
 let done;const {root,A}=env((n,p)=>n.includes('_context_')?new Promise(r=>done=r):Promise.resolve({ok:true,operation:n,request_id:p.request_id,source_opportunity_id:p.source_opportunity_id,target_ids:[],linked_count:0,event:{id:'new'}}));
 const read=A.read('a');await A.write('a','new',[]);root.B.expansion_events=[{id:'new'}];done({ok:true,events:[{id:'old'}]});assert.equal(await read,false);assert.equal(root.B.expansion_events[0].id,'new');
});
