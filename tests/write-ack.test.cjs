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
 const flush=code.slice(code.indexOf('function flushWrites(){'),code.indexOf('\n}',code.indexOf('function flushWrites(){'))+2);
 test(file+' 실제 저장큐: 확인된 응답만 완료, 애매하면 자동 재전송 중단',async()=>{
  let calls=0,result={};const item={write_id:'a',op:'assign',payload:{},status:'pending'};
  const c={TOKEN:'fixture-token',WRITE_Q:[item],WRITE_API:'fixture',WriteAck:A,authHeaders:x=>x,fetch:async()=>{calls++;return {ok:true,json:async()=>result}},isoNow:()=>'',saveWQ(){},saveQ(){},updateSyncBadge(){},updatePendingBadge(){},adoptServerId(){},isTempId:()=>false,ID_MAP:{}};
  vm.createContext(c);vm.runInContext(flush,c);c.flushWrites();await new Promise(setImmediate);
  assert.equal(item.status,'failed');c.flushWrites();assert.equal(calls,1);
  result={ok:true,write_id:'a'};item.status='pending';c.flushWrites();await new Promise(setImmediate);assert.equal(item.status,'done');
  c.TOKEN=null;item.status='pending';c.flushWrites();assert.equal(calls,2);
 });
 test(file+' 새로고침 중 전송건은 완료/자동재전송으로 변하지 않음',()=>{
  const line=code.split(/\r?\n/).find(x=>x.startsWith('var WRITE_Q='));
  const c={WQ_KEY:'fixture',localStorage:{getItem:()=>JSON.stringify([{status:'sending',write_id:'keep'}])}};
  vm.runInNewContext(line,c);assert.equal(c.WRITE_Q[0].status,'failed');assert.equal(c.WRITE_Q[0].write_id,'keep');
 });
}
