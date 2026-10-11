'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../work-request.js'),'utf8');
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
function setup(type='deal',kind='first',asks=['고객 첫 연락']){
 const listeners={},calls=[],records=[],item={id:id(10),assigned_to:id(1),assignee:'담당',nextActionObj:{id:id(11),text:'기존 방문 약속',due:'2026-10-15'}};
 const r={id:id(20),target_type:type,target_id:item.id,kind,label:kind==='first'?'첫 연락 요청':'후속 연락 요청',asks,status:'sent',to_me:true,to_user_id:id(1),created_at:'2026-10-10T00:00:00Z'};
 const R={G:{page:'today'},ME:{id:id(1),name:'담당'},B:{deals:[item]},esc:String,escAttr:String,repN:String,dealKey:d=>d.id,inqCtlFind:()=>item,
  salesActivityAt:()=>new Date().toISOString(),paint(){},toast(){},todayIsAdmin:()=>true,
  InquiryFlow:{on:()=>true,state:()=>({logs:[{at:new Date().toISOString(),kind:'connected'},{at:new Date().toISOString(),kind:'attempt'}]})},
  DealDetailV3:{record:async()=>{records.push('deal');},NXT:{연결됨:['다시 연락',3],부재:['다시 전화',1]}},
  InquiryListV3:{record:()=>{records.push('inquiry');return true;}},CRMRelease:{has:()=>false},
  OpsStore:{has:()=>true,rpc:async(name,p)=>{calls.push({name,p});throw Error('synthetic write not allowed');}}};
 const document={addEventListener:(name,fn)=>listeners[name]=fn,getElementById:()=>null,querySelector:()=>null};
 vm.runInNewContext(source,{window:R,document,Date,Map,Set,setTimeout:()=>{}});
 const W=R.WorkRequest,S=W.state();Object.assign(S,{loaded:true,list:[r],card:{[r.id]:{res:'연결됨',busy:false,err:''}}});
 const save=()=>listeners.click({target:{closest:()=>({dataset:{wr:'save',id:r.id},closest:()=>true})},preventDefault(){},stopPropagation(){}});
 return {R,W,S,r,item,calls,records,save};
}
for(const type of ['deal','inquiry']){
 test(type+': compound request cannot write contact, close old plan or complete whole request',async()=>{
  const x=setup(type,'first',['고객 첫 연락','현장방문 필요 여부 확인']);const before=JSON.stringify(x.item);
  await x.save();await x.save();assert.equal(x.calls.length,0);assert.equal(x.records.length,0);assert.equal(JSON.stringify(x.item),before);
  assert.equal(x.S.card[x.r.id].res,'연결됨');assert.match(x.S.card[x.r.id].err,/항목별 완료 연결은 아직 지원하지/);assert.equal(x.r.status,'sent');
 });
 test(type+': follow-up request needs its own receipt/reaction proof, not a connected log',async()=>{
  const x=setup(type,'follow',['수신 확인','고객 반응 기록']);assert.equal(x.W.evidence(x.r),null);x.W.autoClose();await x.save();await new Promise(setImmediate);
  assert.equal(x.calls.length,0);assert.equal(x.records.length,0);assert.equal(x.r.status,'sent');
 });
 test(type+': absence never closes a compound request',async()=>{
  const x=setup(type,'first',['고객 첫 연락','견적 필요 여부 확인']);x.S.card[x.r.id].res='부재';await x.save();x.W.autoClose();await new Promise(setImmediate);
  assert.equal(x.calls.length,0);assert.equal(x.records.length,0);assert.equal(x.S.card[x.r.id].res,'부재');assert.equal(x.r.status,'sent');
 });
}
test('deal: even recent activity on a single-contact request cannot auto-complete it',()=>{
 const x=setup();assert.equal(x.W.evidence(x.r),null);x.W.autoClose();assert.equal(x.calls.length,0);
});
test('inquiry quote/contract requests cannot be completed by a connected or attempted call',()=>{
 for(const kind of ['quote','contract','award']){const x=setup('inquiry',kind,[]);assert.equal(x.W.evidence(x.r),null);x.W.autoClose();assert.equal(x.calls.length,0);}
});
test('closed and reassigned cards cannot enter even the supported atomic save',async()=>{
 for(const change of [r=>r.status='done',r=>r.status='cancelled',r=>r.to_me=false]){const x=setup('inquiry');change(x.r);await x.save();assert.equal(x.calls.length,0);assert.match(x.S.card[x.r.id].err,/현재 담당자의 열린 요청/);}
});
test('existing legacy resume and deal quote proof remain distinct from contact proof',()=>{
 const x=setup();x.r.label='과거 자료 재개';x.R.PipelineScope={on:()=>true,isLegacy:()=>false};assert.equal(x.W.evidence(x.r).result,'영업 재개 확인');
 x.r.label='견적 진행 확인';x.r.kind='quote';x.r.asks=['견적 요청 등록','견적 예정일 입력'];x.item.stage_contexts={consulting:{fields:{quote_request:'합성 견적'}}};
 assert.equal(x.W.evidence(x.r),null);x.item.stage_contexts.consulting.fields.quote_due='2026-10-15';assert.ok(x.W.evidence(x.r));
});
