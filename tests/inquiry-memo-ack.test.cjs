const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require.resolve('../inquiry-memo.js'),'utf8');
const ID='10000000-0000-4000-8000-000000000001';
const tick=()=>new Promise(r=>setImmediate(r));
function setup(){
 const patch={},sent=[],storage=new Map(),q={id:ID,created_at:'2026-01-01',raw:{응대내용:'2026/01/07 오후 5:00 통화완료. 사진은 메일로 보내주신다.'}};
 const ctx={console,Intl,Date,Map,WeakMap,Set,Math,JSON,G:{},ME:{name:'합성 담당'},inquiryAssigned:()=>true,inqCtlIsAdmin:()=>true,repN:x=>x||'',inqKey:q=>q.id,itemPatch:()=>patch,detailPatchFor:()=>patch,inquiryCreatedAt:q=>q.created_at,saveLocal(){},actionObj:()=>null,InquiryCommand:{run:()=>true},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 let reply=async body=>({ok:true,inquiry_id:ID,review:{kind:body.type==='promise'?'promise':'call',item_key:body.item_key,title:body.title||'',result:body.result||null,on_date:body.on_date||null,decided_at:'2026-10-09T00:00:00Z',decided_by:'합성 담당'}});
 ctx.OpsStore={has:()=>true,rpc:async(name,body)=>{sent.push({name,body});return name.endsWith('_list_v1')?{ok:true,reviews:[]}:reply(body);}};
 vm.createContext(ctx);vm.runInContext(src,ctx);const M=ctx.InquiryMemo;
 return {M,ctx,q,patch,sent,storage,setReply:f=>{reply=f;},key:M.scan(q).promises[0].key,call:M.scan(q).calls[0].key};
}
test('promise stays unconfirmed and writes no completion history until server acknowledgement',async()=>{
 const t=setup();let resolve;t.setReply(body=>new Promise(r=>{resolve=()=>r({ok:true,inquiry_id:ID,review:{kind:'promise',item_key:body.item_key,result:body.result,decided_at:'2026-10-09',decided_by:'서버 담당'}});}));
 const save=t.M.run('promise',t.q,{key:t.key,res:'완료'});await tick();
 assert.equal(t.M.pendingN(t.q),1);assert.equal(t.patch.activities,undefined);
 assert.throws(()=>t.M.run('promise',t.q,{key:t.key,res:'확인 불가'}),/저장 중/);
 resolve();assert.equal(await save,true);assert.equal(t.M.pendingN(t.q),0);assert.equal(t.M.review(t.q).promises[t.key].by,'서버 담당');assert.equal(t.patch.activities.length,1);
});
test('forbidden and network failure keep previous confirmed decision, allowing an explicit retry',async()=>{
 for(const message of ['forbidden','network failed']){
  const t=setup();t.M.takeServer([{inquiry_id:ID,kind:'promise',item_key:t.key,result:'확인 불가',decided_at:'2026-10-08'}]);
  t.setReply(async()=>{throw Error(message);});
  await assert.rejects(t.M.run('promise',t.q,{key:t.key,res:'완료'}),new RegExp(message));
  assert.equal(t.M.promises(t.q)[0].res,'확인 불가');assert.equal(t.patch.activities,undefined);
  t.setReply(async body=>({ok:true,inquiry_id:ID,review:{kind:'promise',item_key:body.item_key,result:'완료',decided_at:'2026-10-09'}}));
  assert.equal(await t.M.run('promise',t.q,{key:t.key,res:'완료'}),true);
 }
});
test('old optimistic local call and promise never count as confirmed for persisted inquiries',()=>{
 const t=setup();t.patch.memoReview={call:{on_date:'2026-01-07',at:'2099-01-01'},promises:{[t.key]:{res:'완료',at:'2099-01-01'}}};
 assert.equal(t.M.pendingN(t.q),1);assert.equal(t.M.connection(t.q).state,'none');assert.equal(t.M.contactReview(t.q).required,true);
 t.M.takeServer([{inquiry_id:ID,kind:'promise',item_key:t.key,result:'확인 불가',decided_at:'2026-10-08'}]);
 assert.equal(t.M.promises(t.q)[0].res,'확인 불가');
});
test('rejected call supplement does not alter original date or record completed history',async()=>{
 const t=setup(),before=JSON.stringify(t.q);t.setReply(async()=>{throw Error('forbidden');});
 await assert.rejects(t.M.run('call_supplement',t.q,{key:t.call}),/forbidden/);
 assert.equal(t.M.connection(t.q).state,'none');assert.equal(t.M.confirmedCallDay(t.q),'');assert.equal(t.patch.activities,undefined);assert.equal(JSON.stringify(t.q),before);
});
test('malformed acknowledgement cannot publish a decision or success history',async()=>{
 for(const override of [{ok:false},{inquiry_id:'another'},{review:{}},{review:{kind:'promise',item_key:'other',result:'완료',decided_at:'2026-10-09'}}]){
  const t=setup();t.setReply(async()=>({ok:true,inquiry_id:ID,...override}));
  await assert.rejects(t.M.run('promise',t.q,{key:t.key,res:'완료'}),/확인 응답/);
  assert.equal(t.M.pendingN(t.q),1);assert.equal(t.patch.activities,undefined);
 }
});
test('unavailable server fails before creating an uncompleted follow-up',()=>{
 const t=setup();let count=0;t.ctx.OpsStore.has=()=>false;t.ctx.InquiryCommand.run=()=>{count++;return true;};
 assert.throws(()=>t.M.run('promise',t.q,{key:t.key,res:'미완료'}),/서버 저장 연결/);assert.equal(count,0);
});
test('pending older request blocks a newer decision, including across reload',async()=>{
 const t=setup();t.storage.set('crm.inqMemo.outbox.v1',JSON.stringify([{queued_at:Date.now(),type:'promise',inquiry_id:ID,item_key:t.key,result:'미완료',request_id:'old'}]));
 t.setReply(async()=>{throw Error('network failed');});
 await assert.rejects(t.M.run('promise',t.q,{key:t.key,res:'완료'}),/이전 판단/);
 assert.equal(t.sent.filter(x=>x.body.result==='완료').length,0);assert.equal(JSON.parse(t.storage.get('crm.inqMemo.outbox.v1')).length,1);assert.equal(t.M.pendingN(t.q),1);
});
test('rejected older request is removed without trusting its optimistic local patch',async()=>{
 const t=setup();t.patch.memoReview={promises:{[t.key]:{res:'완료',at:'2099-01-01'}}};
 t.storage.set('crm.inqMemo.outbox.v1',JSON.stringify([{queued_at:Date.now(),type:'promise',inquiry_id:ID,item_key:t.key,result:'완료',request_id:'old'}]));
 t.setReply(async()=>{throw Error('forbidden');});await t.M.flush();
 assert.equal(t.M.pendingN(t.q),1);assert.equal(JSON.parse(t.storage.get('crm.inqMemo.outbox.v1')).length,0);
});
test('a read started before a successful save cannot erase its acknowledgement',async()=>{
 const t=setup(),rpc=t.ctx.OpsStore.rpc;let resolve;
 t.ctx.OpsStore.rpc=(name,body)=>name.endsWith('_list_v1')?new Promise(r=>{resolve=r;}):rpc(name,body);
 const loading=t.M.load(true);await t.M.run('promise',t.q,{key:t.key,res:'완료'});resolve({ok:true,reviews:[]});await loading;
 assert.equal(t.M.promises(t.q)[0].res,'완료');
});

test('superseded server receipt rejection removes only the stale queue item and preserves confirmed completion',async()=>{
 const t=setup();
 t.M.takeServer([{inquiry_id:ID,kind:'promise',item_key:t.key,result:'완료',decided_at:'2026-10-09'}]);
 t.patch.memoReview={promises:{[t.key]:{res:'미완료',at:'2099-01-01'}}};
 t.storage.set('crm.inqMemo.outbox.v1',JSON.stringify([{queued_at:Date.now(),type:'promise',inquiry_id:ID,item_key:t.key,result:'미완료',request_id:'old'}]));
 t.setReply(async()=>{throw Error('invalid payload: 이미 처리한 이전 요청입니다. 최신 판단을 다시 확인해 주세요');});
 await t.M.flush();
 assert.equal(t.M.promises(t.q)[0].res,'완료');
 assert.equal(JSON.parse(t.storage.get('crm.inqMemo.outbox.v1')).length,0);
 assert.equal(t.patch.activities,undefined);
});
