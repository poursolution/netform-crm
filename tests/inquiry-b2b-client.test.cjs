const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const adapter=require('../operational-adapter.js'),code=fs.readFileSync(require('node:path').join(__dirname,'../inquiry-b2b-client.js'),'utf8');
const id='11111111-1111-4111-8111-111111111111',rid='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333';
const inquiry=()=>({id,status:'접수',work_type:'협약문의',updated_at:'2026-10-04T01:00:00Z',raw:{문의내용:'협약 문의'}});
function load(queue){const w={Phase1:{queue}};vm.runInNewContext(code,{window:w});return w.InquiryB2B;}
test('B2B 클라이언트는 결과·선택 메모만 만들며 과거 영업종료/전환 건을 자동 재개하지 않는다',()=>{
 const b=load();assert.equal(b.state(inquiry()),'pending');assert.equal(b.state({...inquiry(),status:'종결'}),'done');assert.equal(b.state({...inquiry(),status:'배드핏'}),'review');
 assert.equal(b.request(inquiry(),'해결완료').note,'');assert.throws(()=>b.request(inquiry(),'수주'),/INVALID/);assert.throws(()=>b.request({...inquiry(),updated_at:null},'해결완료'),/READ_VERSION/);
});
test('기존 어댑터가 B2B 입력/ACK를 검증하고 일반 응대 규칙은 유지한다',()=>{
 const b=load(),p=b.request(inquiry(),'협약완료',' 메모 '),c=adapter.normalize('inquiry_status',id,0,p);
 assert.equal(c.payload.note,'메모');assert.equal(c.payload.intent,'b2b_complete');assert.equal('next' in c.payload,false);
 assert.throws(()=>adapter.normalize('inquiry_status',id,0,{...p,result:'수주'}),/INVALID/);
 assert.throws(()=>adapter.normalize('inquiry_status',id,0,{...p,next:'전화'}),/INVALID/);
 const command={...c,request_id:rid,auth_uid:aid,user_id:aid},ack={contract_version:1,ok:true,operation:'inquiry_status',request_id:rid,object_id:id,replayed:false,actor_auth_uid:aid,actor_user_id:aid,intent:'b2b_complete',status:'협약완료',note:'메모',next_action_date:null,inquiry_audit_event_id:aid,cancelled_action_ids:[],sync_event_id:rid,sync_status:'pending',completed_at:'2026-10-04T01:00:00Z'};
 assert.equal(adapter.validateAck(ack,command),ack);assert.throws(()=>adapter.validateAck({...ack,status:'수주'},command),/ACK/);
 const ordinary=adapter.normalize('inquiry_status',id,0,{inquiry_id:id,from_status:'접수',to_status:'보류',reason:'고객 요청'});assert.equal(ordinary.payload.intent,'hold');
});
test('저장 ACK 전에는 완료를 표시하지 않고 중복 클릭·미확정 재요청은 같은 명령을 사용한다',async()=>{
 let items=[],calls=0,release;const q={list:()=>items,enqueue:(op,object_id,version,payload)=>{calls++;const x={operation:op,object_id,payload,request_id:rid,status:'pending'};items.push(x);return x;},flush:()=>new Promise(r=>{release=r;})};
 const b=load(q),i=inquiry(),first=b.complete(i,'협약완료');assert.equal(b.complete(i,'협약완료'),first);assert.equal(calls,1);assert.throws(()=>b.complete(i,'종결'),/PENDING_RESULT/);release();const uncertain=await first;assert.equal(uncertain.saved,false);assert.equal(i.status,'접수');
 const retry=b.complete(i,'협약완료');assert.equal(calls,1);items[0].status='done';items[0].ack={ok:true,object_id:id,request_id:rid,intent:'b2b_complete',status:'협약완료',note:'',completed_at:'2026-10-04',sync_status:'pending'};release();assert.equal((await retry).saved,true);assert.equal(i.status,'접수');
});
