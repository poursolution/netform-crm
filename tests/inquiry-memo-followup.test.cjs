const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../inquiry-memo.js'),'utf8');
function setup(action={}){
 const patch={},commands=[],ctx={console,Intl,Date,Map,WeakMap,Set,Math,JSON};
 Object.assign(ctx,{G:{},ME:{name:'테스트담당'},inquiryAssigned:()=>true,inqCtlIsAdmin:()=>true,
  repN:x=>x||'',inqKey:q=>q.id,itemPatch:()=>patch,detailPatchFor:()=>patch,
  inquiryCreatedAt:q=>q.created_at||'',saveLocal:()=>{},actionObj:()=>action,
  InquiryCommand:{run:(type,q,value)=>{commands.push({type,...value});Object.assign(action,value);return true;}}});
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {M:ctx.InquiryMemo,ctx,patch,commands,action};
}
const inquiry=()=>({id:'synthetic-followup',raw:{응대내용:'사진은 메일로 보내주신다. 내일 방문드리기로 함.'}});
test('uncompleted promise preserves a future customer schedule and its original task',()=>{
 const t=setup({text:'고객 요청일 재연락',due:'2030-01-15'}),q=inquiry();
 t.M.run('promise',q,{key:t.M.scan(q).promises[0].key,res:'미완료'});
 assert.equal(t.commands[0].due,'2030-01-15');assert.match(t.commands[0].text,/고객 요청일 재연락/);
});
test('second uncompleted promise retains the first schedule and both tasks',()=>{
 const t=setup({text:'원래 업무',due:'2030-01-15'}),q=inquiry(),p=t.M.scan(q).promises;
 for(const it of p)t.M.run('promise',q,{key:it.key,res:'미완료'});
 assert.equal(t.commands.length,2);assert.equal(t.commands[1].due,'2030-01-15');
 assert.match(t.commands[1].text,/사진 이메일로 받기/);assert.match(t.commands[1].text,/현장 방문/);
 assert.match(t.commands[1].text,/원래 업무/);
});
test('overdue schedule survives repeated review without resetting to today',()=>{
 const t=setup({text:'기존 재연락',due:'2020-01-15'}),q=inquiry(),key=t.M.scan(q).promises[0].key;
 t.M.run('promise',q,{key,res:'미완료'});t.M.run('promise',q,{key,res:'미완료'});
 assert.equal(t.commands[0].due,'2020-01-15');assert.equal(t.commands[1].due,'2020-01-15');
});
test('without a schedule a new review task is due today; completed/unknown do not change it',()=>{
 const t=setup(),q=inquiry(),key=t.M.scan(q).promises[0].key;
 t.M.run('promise',q,{key,res:'미완료'});assert.equal(t.commands[0].due,t.M.today());
 t.M.run('promise',q,{key,res:'완료'});t.M.run('promise',q,{key,res:'확인 불가'});assert.equal(t.commands.length,1);
});
test('failure to register next action does not persist an uncompleted decision',()=>{
 const t=setup(),q=inquiry(),key=t.M.scan(q).promises[0].key;
 t.ctx.InquiryCommand.run=()=>false;
 assert.throws(()=>t.M.run('promise',q,{key,res:'미완료'}),/등록하지 못했습니다/);
 assert.equal(t.M.promises(q)[0].res,'');
});
test('oversized combined task is rejected without silently truncating the original task',()=>{
 const action={text:'기존 업무 '.repeat(100),due:'2030-01-15'},before=JSON.stringify(action),t=setup(action),q=inquiry();
 assert.throws(()=>t.M.run('promise',q,{key:t.M.scan(q).promises[0].key,res:'미완료'}),/500자/);
 assert.equal(JSON.stringify(action),before);assert.equal(t.commands.length,0);assert.equal(t.M.promises(q)[0].res,'');
});
test('dated and undated memo calls require review without confirming actual contact',()=>{
 const t=setup();
 for(const note of ['2026/01/16 PM 05:02\n1차통화완료','관리소장 통화 완료']){
  const q={raw:{응대내용:note}},before=JSON.stringify(q),r=t.M.contactReview(q);
  assert.equal(r.required,true);assert.equal(r.reason,'memo_call_unconfirmed');
  assert.equal(t.M.connection(q).state,'none');assert.equal(JSON.stringify(q),before);
 }
 assert.equal(t.commands.length,0);assert.equal(Object.keys(t.patch).length,0);
});
test('copied receipt date requires review; real same-day contact does not',()=>{
 const t=setup(),at='2026-01-16T09:00:00+09:00',q={created_at:at,first_response_at:at};
 assert.equal(t.M.contactReview(q).reason,'copied_received_date');
 t.ctx.InquiryFlow={on:()=>true,firstConnectedAt:()=>at,state:()=>({logs:[{kind:'connected',at}]})};
 assert.equal(t.M.contactReview(q).required,false);
});
test('confirmed supplement clears review; no memo, failed call or feature-off does not create candidates',()=>{
 const t=setup(),q={id:'reviewed',raw:{응대내용:'1차통화완료'}};
 t.M.takeServer([{inquiry_id:q.id,kind:'call',on_date:'2026-01-16',decided_at:'2026-01-16T09:00:00Z'}]);
 assert.equal(t.M.contactReview(q).required,false);
 assert.equal(t.M.contactReview({}).required,false);
 assert.equal(t.M.contactReview({raw:{응대내용:'통화 시도했으나 부재'}}).required,false);
 t.ctx.G.inqMemoOff=true;assert.equal(t.M.contactReview({raw:{응대내용:'통화완료'}}).required,false);
});
test('review evidence is a copy and cannot corrupt the parsed memo cache',()=>{
 const t=setup(),q={raw:{응대내용:'2026/01/16 PM 05:02\n1차통화완료'}},r=t.M.contactReview(q);
 r.calls[0].date='2000-01-01';assert.equal(t.M.contactReview(q).candidateDate,'2026-01-16');
});
