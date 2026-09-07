const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../write-ack.js');
test('빈 응답·애매한 성공·최상위 실패를 저장 성공으로 오인하지 않음',()=>{
 for(const x of [null,{},[],[{ok:true},{ok:true}],{success:true},{ok:false,data:{ok:true}}])assert.throws(()=>A.validate(x));
 assert.equal(A.validate([{data:{ok:true,write_id:'a'}}],{write_id:'a'}).ok,true);
});
test('다른 요청/작업 응답과 생성 ID 누락 차단',()=>{
 assert.throws(()=>A.validate({ok:true,write_id:'b'},{write_id:'a'}));
 assert.throws(()=>A.validate({ok:true,operation:'delete'},{op:'assign'}));
 assert.throws(()=>A.validate({ok:true},{op:'opportunity_create'}));
 assert.equal(A.validate({ok:true,new_opportunity_id:'new'},{op:'opportunity_create'}).new_opportunity_id,'new');
});
test('HTTP 200 파싱 실패와 HTTP 오류는 미확인',async()=>{
 await assert.rejects(A.read({ok:true,json:async()=>{throw Error('bad json')}}),/저장 확인 필요/);
 await assert.rejects(A.read({ok:false,status:503}),/HTTP 503/);
});
for(const file of ['crm.html','mobile.html']){
 const code=fs.readFileSync(require.resolve('../'+file),'utf8');
 const flush=code.match(/function flushWrites\(\)\{[^\n]+\}/)[0];
 test(file+' 실제 저장큐는 Production Phase1 멱등 큐에만 위임',async()=>{
  let calls=0;const c={console,Promise,Phase1:{profile:{user_id:'u'},queue:{flush:async()=>{calls++}}}};
  vm.createContext(c);vm.runInContext(flush,c);await c.flushWrites();assert.equal(calls,1);
  c.Phase1.profile=null;await c.flushWrites();assert.equal(calls,1);
  assert.doesNotMatch(flush,/fetch|WRITE_API|nfrnd/);
 });
 test(file+' 새로고침 중 전송건은 완료/자동재전송으로 변하지 않음',()=>{
  const line=code.split(/\r?\n/).find(x=>x.startsWith('var WRITE_Q='));
  const c={WQ_KEY:'fixture',Phase1:{storage:{getItem:()=>JSON.stringify([{status:'sending',write_id:'keep'}])}}};
  vm.runInNewContext(line,c);assert.equal(c.WRITE_Q[0].status,'failed');assert.equal(c.WRITE_Q[0].write_id,'keep');
 });
}
