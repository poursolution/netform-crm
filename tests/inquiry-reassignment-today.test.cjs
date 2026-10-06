'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const now=Date.parse('2026-10-06T03:00:00Z'),assigned='2026-10-05T09:05:00Z',after='2026-10-06T01:00:00Z';
class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
const row=(extra={})=>Object.assign({id:'q1',site:'검증 현장',brand:'POUR솔루션',assignee:'조민준',assignee_name:'조민준',assigned_to:'10000000-0000-4000-8000-000000000001',assigned_at:assigned,status:'응대중',received_at:'2026-03-11T04:15:00Z',responded_at:'2026-03-11T04:15:00Z',assignment_history:[{changed_at:assigned,from_owner:'이필선',to_owner:'조민준'}],activities:[]},extra);
function setup(Q=[]){
 const w={Date:Clock,console,setTimeout,clearTimeout,document:{addEventListener(){}},G:{},ME:{name:'조민준'},OPS_RULES:{liveFrom:'2026-10-01',longContactDays:90},B:{inquiries:Q,users:[],deals:[]},LOCAL:{},FLOW_STEPS:['접수','응대중'],TODAY_INQUIRY_RECENT_DAYS:14,INQUIRY_RESPONSE_SLA_HOURS:2};w.window=w;
 Object.assign(w,{repN:v=>String(v||''),repDisplay:v=>v,repProfile:()=>({active:true,salesRep:true}),itemPatch:q=>q.patch||{},inqKey:q=>q.id,inqCtlConverted:q=>!!q.deal_id,isClosedInq:q=>['종결','배드핏','영업전환','협약완료'].includes(q.status)||q.b2b,inquiryConsultant:()=>'',inqCtlFirstResponseAt:q=>q.responded_at||'',inquiryCreatedAt:q=>q.received_at,todayHoursFrom:v=>Number.isFinite(Date.parse(v))?(now-Date.parse(v))/36e5:null,flowIndex:()=>1,actionObj:q=>q.nextActionObj||null,daysTo:v=>Math.ceil((Date.parse(v)-now)/864e5),todayInquiryMissing:()=>[],todayRecentEnough:(v,n)=>(now-Date.parse(v))/864e5<=n,todayRecent:q=>q.responded_at||'기록 없음',inqCtlNeedsAction:()=>true,inquiryResponseLate:q=>!q.responded_at,inqCtlAssignedAt:q=>q.assigned_at,todayOwner:()=> '조민준',esc:String,escAttr:String});
 vm.createContext(w);for(const f of ['inquiry-assignment-clarity.js','inquiry-flow.js','today-work-queue.js','today-tower.js','today-v3.js'])vm.runInContext(read(f),w);
 vm.runInContext(read('crm.html').split(/\r?\n/).find(l=>l.startsWith('function todayInquiryEntry(')),w);
 w.todayHomeData=()=>({admin:true,Q,D:[],inquiry:Q.map(w.todayInquiryEntry).filter(Boolean),pipeline:[]});return w;
}
test('old receipt and response remain intact while live reassignment returns to Today',()=>{
 const q=row(),before=JSON.stringify(q),w=setup([q]);assert.equal(w.inquiryReassignmentPending(q),true);
 const x=w.TodayWorkQueue.data().rows[0];assert.ok(x.reassignmentPending);assert.equal(x.owner,'조민준');
 const i=w.TodayTower.classify(x,'mgr');assert.ok(i);assert.equal(i.days,1);assert.equal(i.dLabel,'재배정 후');assert.equal(w.TodayV3.isBack(i),false);
 assert.equal(JSON.stringify(q),before,'source dates/history are not rewritten');
});
test('recent assignment with no response escapes old-receipt backlog',()=>{
 const q=row({responded_at:''}),w=setup([q]),x=w.TodayWorkQueue.data().rows[0];assert.equal(w.TodayV3.isBack(w.TodayTower.classify(x,'mgr')),false);
});
test('historical, initial, same-owner, mismatched or unconfirmed assignment is not revived',()=>{
 for(const extra of [{assignment_history:[]},{assignment_history:[{at:assigned,from:'미배정',to:'조민준'}]},{assignment_history:[{at:assigned,from:'조민준',to:'조민준'}]},{assignment_history:[{at:assigned,from:'이필선',to:'한준엽'}]},{_assignmentOptimistic:true},{assigned_at:'invalid'},{assigned_at:'2026-10-04'},{assigned_at:'2026-09-01',assignment_history:[{at:'2026-09-01',from:'이필선',to:'조민준'}]},{assigned_at:'2026-10-07',assignment_history:[{at:'2026-10-07',from:'이필선',to:'조민준'}]}]){
  const q=row(extra),w=setup([q]);assert.equal(w.inquiryReassignmentPending(q),false,JSON.stringify(extra));
 }
});
test('closed, B2B, held and converted inquiries stay excluded',()=>{
 for(const extra of [{status:'종결'},{status:'배드핏'},{status:'보류'},{status:'스토어 이관'},{deal_id:'deal1'},{b2b:true}]){const q=row(extra),w=setup();assert.equal(w.inquiryReassignmentPending(q),false);}
});
test('current owner contact after reassignment clears pending; unrelated records do not',()=>{
 const cases=[
  [{type:'전화',actor:'조민준',at:after},false],
  [{type:'방문',actor:'조민준',at:after},false],
  [{type:'전화',actor:'10000000-0000-4000-8000-000000000001',at:after,note:'부재'},false],
  [{type:'전화',actor:'이필선',at:after},true],
  [{type:'전화',at:after},true],
  [{type:'전화',actor:'조민준',at:'2026-09-01'},true],
  [{type:'전화',actor:'조민준',at:'2026-10-07'},true],
  [{type:'내부 메모',actor:'조민준',at:after,note:'[전화 · 연결됨] 내부 검토'},true],
  [{type:'영업담당자변경',actor:'조민준',at:after,note:'인계완료'},true],
  [{type:'처리 요청',actor:'조민준',at:after,note:'전화 요청'},true]
 ];
 for(const [a,expected] of cases){const q=row({activities:[a]}),w=setup([q]);assert.equal(w.inquiryReassignmentPending(q),expected,JSON.stringify(a));}
});
test('server flow records and local patch records recognize the new owner',()=>{
 const q=row(),w=setup();w.InquiryFlow.take({inquiry_id:q.id,logs:[{occurred_at:after,actor_name:'조민준',kind:'attempt'}]});assert.equal(w.inquiryReassignmentPending(q),false);
 const p=row({patch:{activities:[{type:'전화',at:after,actor:'조민준'}]}});assert.equal(setup().inquiryReassignmentPending(p),false);
});
test('future next action does not conceal pending reassignment and is preserved',()=>{
 const q=row({nextActionObj:{text:'예약된 방문',due:'2026-10-09'}}),w=setup([q]),x=w.TodayWorkQueue.data().rows[0];assert.ok(w.TodayTower.classify(x,'rep'));assert.equal(q.nextActionObj.due,'2026-10-09');
});
test('pending flag survives duplicate case grouping on the older retained row',()=>{
 const old=row({id:'older',received_at:'2026-01-01',assigned_at:'2026-09-01',assignment_history:[],responded_at:''}),fresh=row({id:'fresh'}),w=setup([old,fresh]);
 w.ContactState={on:()=>true,caseKey:()=> 'same-case'};const rows=w.TodayWorkQueue.data().rows;
 assert.equal(rows.length,1);assert.equal(rows[0].key,'inq:older');assert.equal(rows[0].reassignmentPending,true);assert.equal(w.TodayV3.isBack(w.TodayTower.classify(rows[0],'mgr')),false);
});
test('post-assignment contact returns to existing rules, without being permanently sticky',()=>{
 const q=row({activities:[{type:'전화',at:after,actor:'조민준'}]}),w=setup([q]);assert.equal(w.todayInquiryEntry(q),null);
});

test('contact on retained same-case row clears duplicate reassignment, never a different owner',()=>{
 const q=row(),other=row({id:'retained',activities:[{type:'전화',actor:'조민준',at:after}]}),w=setup();
 w.ContactState={on:()=>true,siblings:()=>[other]};assert.equal(w.inquiryReassignmentPending(q),false);
 other.assigned_to=null;other.assignee_name='한준엽';assert.equal(w.inquiryReassignmentPending(q),true);
});
