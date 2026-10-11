'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const row=(id=A)=>({id,target_type:'deal',target_id:id,kind:'first',label:'첫 연락 요청',asks:['고객 첫 연락'],to_me:true,status:'sent',open:true,closed_at:null});
function setup(){
 const calls=[],events={},doc={},root={G:{},document:{addEventListener:(n,f)=>doc[n]=f},addEventListener:(n,f)=>events[n]=f,DEALS:[],render(){},esc:String,escAttr:String};
 root.Phase1={profile:{auth_uid:A,user_id:A},rpc:(name,{p})=>new Promise((resolve,reject)=>calls.push({name,p,resolve,reject}))};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../mobile-requests.js'),'utf8'),{window:root,console,Date});
 const api=root.MobileRequests;
 const open=id=>doc.click({target:{closest:()=>({dataset:{mq:'open',id}})}});
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 const owner=id=>{root.Phase1.profile=id?{auth_uid:id,user_id:id}:null;};
 return {root,api,calls,events,open,settle,owner};
}
test('old account list cannot populate a different account',async()=>{
 const e=setup(),p=e.api.load(true);e.owner(B);e.calls[0].resolve({ok:true,requests:[row()]});await p;
 assert.equal(e.api.incoming().length,0);assert.equal(e.api.state().loaded,false);
});
test('new account loads while the previous account read is pending',async()=>{
 const e=setup(),p=e.api.load(true);e.owner(B);const q=e.api.load(true);assert.equal(e.calls.length,2);
 e.calls[0].resolve({ok:true,requests:[row()]});await p;assert.equal(e.api.state().busy,true);
 e.calls[1].resolve({ok:true,requests:[row(B)]});await q;assert.equal(e.api.incoming()[0].id,B);
});
test('old missing-function failure cannot disable new account',async()=>{
 const e=setup(),p=e.api.load(true);e.owner(B);e.calls[0].reject(Object.assign(Error('missing'),{code:'PGRST202'}));await p;
 assert.equal(e.api.enabled(),true);assert.equal(e.api.state().at,0);
});
test('logout and same-account login invalidate pending read',async()=>{
 const e=setup(),p=e.api.load(true);e.owner(null);e.events['phase1:identity-cleared']?.();e.owner(A);e.events['phase1:profile']?.();
 e.calls[0].resolve({ok:true,requests:[row()]});await p;assert.equal(e.api.incoming().length,0);
});
test('slow list cannot reopen a locally confirmed completion',async()=>{
 const e=setup();e.api._put(row());const p=e.api.load(true);e.api._put({...row(),status:'done',open:false,closed_at:'2026-10-11'});
 e.calls[0].resolve({ok:true,requests:[row()]});await p;
 assert.equal(e.api.incoming().length,0);assert.equal(e.api.state().list[0].status,'done');assert.equal(e.api.state().at,0);
});
test('failed seen acknowledgement can be retried',async()=>{
 const e=setup();e.api._put(row());e.open(A);e.calls[0].reject(Error('offline'));await e.settle();e.open(A);assert.equal(e.calls.length,2);
});
test('seen response from prior account cannot enter new cache',async()=>{
 const e=setup();e.api._put(row());e.open(A);e.owner(B);e.calls[0].resolve({ok:true,request:{...row(),status:'seen'}});await e.settle();assert.equal(e.api.incoming().length,0);
});
test('seen acknowledgement validates target and success',async()=>{
 for(const reply of [{ok:false,request:{...row(),status:'seen'}},{ok:true,request:{...row(),status:'seen',target_id:B}},{ok:true,request:{...row(),status:'seen',to_me:false}}]){
  const e=setup();e.api._put(row());e.open(A);e.calls[0].resolve(reply);await e.settle();assert.equal(e.api.state().list[0].status,'sent');e.open(A);assert.equal(e.calls.length,2);
 }
});
test('late seen does not regress a completed request',async()=>{
 const e=setup();e.api._put(row());e.open(A);e.api._put({...row(),status:'done',open:false,closed_at:'2026-10-11'});
 e.calls[0].resolve({ok:true,request:{...row(),status:'seen'}});await e.settle();assert.equal(e.api.state().list[0].status,'done');
});
test('profile refresh for same identity keeps current requests',()=>{
 const e=setup();e.api._put(row());e.events['phase1:profile']?.();assert.equal(e.api.incoming().length,1);
});
test('stale row click after account switch cannot issue seen write',()=>{
 const e=setup();e.api._put(row());e.owner(B);e.open(A);assert.equal(e.calls.length,0);
});
test('a newer list result invalidates an older seen response',async()=>{
 const e=setup();e.api._put(row());e.open(A);const p=e.api.load(true);
 e.calls[1].resolve({ok:true,requests:[{...row(),status:'done',open:false,closed_at:'2026-10-11'}]});await p;
 e.calls[0].resolve({ok:true,request:{...row(),status:'seen'}});await e.settle();assert.equal(e.api.state().list[0].status,'done');
});
test('completion cannot resume after logout and same-account login',async()=>{
 const e=setup(),p=e.api.complete(row(),{result:'연결됨',absent:false,next_text:'확인',next_due:'2026-12-20',activity:{ok:true,operation:'activity',object_id:A,activity_id:B,actor_auth_uid:A,actor_user_id:A,meaningful_contact:true}});
 e.owner(null);e.events['phase1:identity-cleared']();e.owner(A);e.events['phase1:profile']();
 e.calls[0].resolve({ok:true,requests:[row()]});await assert.rejects(p,/계정/);assert.equal(e.calls.length,1);
});
