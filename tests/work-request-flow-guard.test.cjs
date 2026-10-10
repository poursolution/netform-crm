'use strict';
/* 요청 처리 흐름 보호(2026-10-10 코덱스 검수 '수정 이후 요청 처리 흐름' F3 · F4 · F5) — 합성 자료 · 네트워크 없음
   F3: 저장 전에 시작한 느린 목록 조회가 저장 뒤에 도착해도 완료 표시를 예전 상태로 되돌리지 않는다(그 응답은 버리고 다시 읽는다)
   F4: 견적 진행 확인의 완료 판정 = 화면의 완료 조건(견적 요청 등록 + 예정일)과 같다 — 요청에서 고른 목적마다 근거가 있어야 한다
   F5: 부재 뒤 재연락 일정이 잡힌 요청(working · 결과 부재)은 보낸 사람에게 '처리 중'이 아니라 '고객 회신 대기' + 재연락 날짜로 보인다 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
function setup(opt={}){
 const listeners={},calls=[],timers=[],storage=new Map();
 const q={id:id(10),assigned_to:id(1),status:'배정완료'};
 const deal=Object.assign({id:'d1',site:'합성 현장',stage_contexts:{consulting:{fields:{}}}},opt.deal||{});
 const r={id:id(20),target_type:'inquiry',target_id:q.id,kind:'first',label:'첫 연락 요청',asks:['고객 첫 연락'],status:'sent',to_user_id:id(1),to_me:true,to_name:'담당',site:'합성 문의'};
 let last=null;const pendingLists=[];
 const ack=p=>({ok:true,contract_version:1,operation_id:p.operation_id,inquiry_id:q.id,log_id:id(40),next_action_id:id(50),server_at:new Date().toISOString(),
  request:{...r,status:p.result==='부재'?'working':'done',result:p.result,next_text:p.next_text,next_due:p.next_due},
  state:{inquiry_id:q.id,logs:[{id:id(40),request_id:p.operation_id,result:p.result,kind:p.result==='부재'?'attempt':'connected',next_action:p.next_text,next_check_date:p.next_due}]},
  inquiry_update:{status:'전화응대 완료',next_action_date:p.next_due}});
 const R={G:{page:'today'},ME:{id:id(1),name:'담당'},B:{inquiries:[q],deals:[deal]},esc:String,escAttr:String,repN:String,dealKey:d=>String(d.id),
  crypto:{randomUUID:()=>id(30)},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  inqCtlFind:()=>q,paint:()=>{},toast:()=>{},CRMRelease:{has:()=>true},
  InquiryFlow:{take:()=>{},load:()=>{},on:()=>true,state:()=>({logs:[]})},
  InquiryListV3:{record:()=>{throw Error('legacy record must not run');}},
  OpsStore:{has:()=>true,rpc:async(fn,p)=>{calls.push([fn,JSON.parse(JSON.stringify(p))]);
   if(fn==='crm_work_request_list_v1'){if(opt.slowList)return new Promise(res=>pendingLists.push(snapshot=>res({ok:true,requests:snapshot})));return {ok:true,requests:[last||r]};}
   const x=ack(p);last=x.request;return x;}}};
 const document={addEventListener:(n,f)=>{listeners[n]=f;},getElementById:()=>null};
 vm.runInNewContext(read('work-request.js'),{window:R,document,Date,Map,Set,setTimeout:f=>{timers.push(f);}});
 const S=R.WorkRequest.state();Object.assign(S,{loaded:true,at:0,list:[r],card:{[r.id]:{res:'연결됨',busy:false,err:''}}});
 const save=()=>listeners.click({target:{closest:()=>({dataset:{wr:'save',id:r.id},closest:()=>true})},preventDefault(){},stopPropagation(){}});
 const tick=()=>new Promise(res=>setImmediate(res));
 return {R,S,q,r,deal,calls,timers,pendingLists,save,tick,W:R.WorkRequest};
}
test('F3: 저장 전에 시작한 느린 목록 응답은 저장 결과를 되돌리지 않고 버려진 뒤 다시 읽는다',async()=>{
 const x=setup({slowList:true});
 x.W.load(true);await x.tick();assert.equal(x.pendingLists.length,1,'목록 조회가 떠 있다(저장 전 상태를 들고 올 응답)');
 await x.save();await x.tick();
 assert.equal(x.S.list[0].status,'done','저장 ACK 로 완료');assert.equal(x.pendingLists.length,1,'조회 중에는 새 조회를 겹쳐 보내지 않는다');
 /* 예전 상태(sent)를 든 응답이 뒤늦게 도착 */
 x.pendingLists[0]([{...x.r,status:'sent'}]);await x.tick();await x.tick();
 assert.equal(x.S.list[0].status,'done','느린 응답이 완료를 sent 로 되돌리지 않는다');
 assert.ok(x.timers.length>=1,'버린 뒤 최신 조회를 예약한다');
 x.timers.splice(0).forEach(f=>f());await x.tick();
 assert.equal(x.pendingLists.length,2,'다시 읽는다');
 x.pendingLists[1]([{...x.r,status:'done',result:'연결됨'}]);await x.tick();await x.tick();
 assert.equal(x.S.list[0].status,'done');assert.equal(x.S.busy,false);
});
test('F3: 저장이 없었으면 목록 응답은 그대로 반영된다(기존 동작)',async()=>{
 const x=setup({slowList:true});x.W.load(true);await x.tick();
 x.pendingLists[0]([{...x.r,status:'seen'}]);await x.tick();await x.tick();
 assert.equal(x.S.list[0].status,'seen');assert.equal(x.S.busy,false);
});
test('F4: 견적 진행 확인 = 고른 목적마다 근거(견적 요청 등록 + 예정일 둘 다) — 하나만으로는 완료가 아니다',()=>{
 const mk=(fields,asks)=>{const x=setup({deal:{stage_contexts:{consulting:{fields}}}});const v=x.W.evidence({id:id(21),target_type:'deal',target_id:'d1',kind:'quote',label:'견적 진행 확인',asks,created_at:new Date().toISOString()});return v&&JSON.parse(JSON.stringify(v));/* 다른 실행 환경(vm)의 객체라 값으로 비교 */};
 const both=['견적 요청 등록','견적 예정일 입력'];
 assert.equal(mk({quote_due:'2026-10-20'},both),null,'예정일만 있고 요청 등록이 없으면 미완료');
 assert.equal(mk({quote_request:'옥상 방수 견적'},both),null,'요청 등록만 있고 예정일이 없으면 미완료');
 assert.deepEqual(mk({quote_request:'옥상 방수 견적',quote_due:'2026-10-20'},both),{result:'견적 요청 등록 · 예정일 입력 확인',absent:false});
 /* 요청에서 하나만 골랐으면 그 하나만 본다 */
 assert.deepEqual(mk({quote_due:'2026-10-20'},['견적 예정일 입력']),{result:'예정일 입력 확인',absent:false});
 assert.equal(mk({quote_due:'2026-10-20'},['견적 요청 등록']),null);
 assert.deepEqual(mk({quote_request:'옥상 방수 견적'},['견적 요청 등록']),{result:'견적 요청 등록 확인',absent:false});
 /* 목적이 비어 있는 예전 요청 = 완료 조건 문구 그대로 둘 다 */
 assert.equal(mk({quote_due:'2026-10-20'},[]),null);
});
test('F5: 부재 뒤 재연락 일정이 잡힌 요청은 보낸 사람에게 고객 회신 대기 + 재연락 날짜로 보인다',()=>{
 const x=setup();const due=new Date(Date.now()+5*36e5).toISOString();
 const base={...x.r,by_me:true,to_me:false,requested_by:'송보람',created_at:new Date().toISOString(),due_at:due,round:1};
 x.S.list=[{...base,status:'working',result:'부재',next_text:'다시 전화',next_due:'2026-10-11'}];
 let html=x.W.sideHtml();
 assert.match(html,/wrq-pill amb">고객 회신 대기</,'처리 중이 아니라 고객 회신 대기');
 assert.match(html,/담당 · 전화 시도 · 부재 → 재연락 10\/11 · 고객 회신 대기\(담당 미착수 아님 · 최초 응대 미완료\)/,'결과 · 재연락 일정이 그 줄에');
 assert.doesNotMatch(html,/wrq-pill amb">처리 중</);
 /* 결과 없이 처리 중인 요청은 그대로 '처리 중' */
 x.S.list=[{...base,status:'working',result:null}];html=x.W.sideHtml();
 assert.match(html,/wrq-pill amb">처리 중</);assert.doesNotMatch(html,/고객 회신 대기/);
});
