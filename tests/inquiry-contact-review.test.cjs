'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
process.env.TZ='Asia/Seoul';
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),NOW=Date.parse('2026-10-09T03:00:00Z');
class Clock extends Date{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}}
const q=(id,extra={})=>({id,site:'합성 검증 현장 '+id,brand:'POUR솔루션',assignee:'담당',received_at:'2026-01-16T00:00:00Z',assigned_at:'2026-10-05T01:00:00Z',phone:'010-0000-0000',raw:{응대내용:'2026/01/16 PM 05:02 1차통화완료'},...extra});
function setup(Q){
 const w={Date:Clock,Intl,console,setTimeout,clearTimeout,document:{readyState:'loading',addEventListener(){}},addEventListener(){},G:{page:'inq'},B:{inquiries:Q,deals:[],users:[]},ME:{name:'담당'},OPS_RULES:{liveFrom:'2026-10-01'},INQUIRY_RESPONSE_SLA_HOURS:2};w.window=w;
 Object.assign(w,{esc:String,escAttr:String,inqKey:q=>q.id,repN:v=>v||'',repDisplay:v=>v,repCompare:(a,b)=>a.localeCompare(b),itemPatch:q=>q.patch||{},inquiryAssigned:q=>!!q.assignee,inquiryRoutedOwner:q=>q.assignee,inquirySalesOwner:q=>q.assignee,inqCtlConverted:q=>!!q.deal_id,isClosedInq:q=>q.closed,
  inquiryCreatedAt:q=>q.received_at,inquiryAssignedAt:q=>q.assigned_at,inqCtlAssignedAt:q=>q.assigned_at,inqCtlFirstResponseAt:q=>q.responded_at||'',inquiryResponded:q=>!!q.responded_at,
  inqCtlContactLabel:q=>q.phone,inqCtlWorkLabel:()=>'',linkedDeal:()=>null,normSite:()=>'',actionObj:q=>q.nextActionObj||null,
  inquiryConsultant:()=>'',todayHoursFrom:v=>Number.isFinite(Date.parse(v))?(NOW-Date.parse(v))/36e5:null,todayOwner:()=> '담당',todayRecent:()=>'',todayIsAdmin:()=>true,
  operationalInquiries:qs=>qs.filter(q=>!q.closed),inqCtlScopeActive:()=>Q.filter(q=>!q.closed),InquiryWorkbench:{task:()=>({kind:'open'}),gist:()=>'',originalText:()=>''},InquiryCommand:{},ListPager:{},
  SalesScope:{state:()=>({})},OpsStore:{has:()=>false},
 });
 vm.createContext(w);
 for(const f of ['inquiry-flow.js','inquiry-memo.js','inquiry-list-v2.js','inquiry-list-v3.js','inquiry-v4.js','today-work-queue.js','today-tower.js','pipeline-judge.js','kpi-v7.js','exec-wording.js'])vm.runInContext(read(f),w,{filename:f});
 vm.runInContext(read('crm.html').split(/\r?\n/).find(l=>l.startsWith('function inquiryResponseLate(')),w);
 w.todayHomeData=()=>({admin:true,Q,D:[],inquiry:[],pipeline:[]});
 return w;
}
test('telephone response completion is an unconfirmed dated candidate across the shared review path',()=>{
 for(const text of ['3/26 전화응대완료','3/26 전화 응대 완료']){
  const x=q('telephone',{received_at:'2026-03-26T00:00:00Z',raw:{응대내용:text}}),before=JSON.stringify(x),w=setup([x]);
  const calls=w.InquiryMemo.parse(text,'2026-03-26').calls;
  assert.equal(calls.length,1);assert.equal(calls[0].date,'2026-03-26');
  assert.equal(w.InquiryMemo.contactReview(x).required,true);
  const m=w.InquiryV4.compute().all[0];assert.equal(m.st,5);assert.equal(m.g,4);assert.equal(m.late,false);assert.equal(m.due,null);
  assert.equal(w.inquiryResponseLate(x),false);assert.equal(JSON.stringify(x),before);
 }
});

test('planned, incomplete and absent telephone responses do not become call evidence',()=>{
 const w=setup([]);
 for(const text of ['3/26 전화응대완료 예정','3/26 전화 응대 예정','3/26 전화응대 미완료','3/26 전화응대완료 못함','3/26 전화응대 시도 부재']){
  assert.equal(w.InquiryMemo.parse(text,'2026-03-26').calls.length,0,text);
 }
});

test('server acknowledgement, not optimistic local call/supplement, clears review',()=>{
 const x=q('queued'),w=setup([x]),M=w.InquiryMemo;
 assert.equal(M.contactReview(x).required,true);
 x.patch={memoReview:{call:{on_date:'2026-01-16',at:'2026-10-09T01:00:00Z'}},activities:[{type:'전화',result:'연결됨',at:'2026-10-09T01:00:00Z'}]};
 assert.equal(M.connection(x).state,'supplemented','existing editor may show a local draft');
 assert.equal(M.contactReview(x).required,true,'pending or failed queue remains review');
 w.InquiryFlow.take({inquiry_id:x.id,logs:[{kind:'attempt',occurred_at:'2026-10-09T01:00:00Z'}]});
 assert.equal(M.contactReview(x).required,true,'unsuccessful contact is not actual connection');
 w.InquiryFlow.take({inquiry_id:x.id,logs:[{kind:'connected',occurred_at:'2026-10-09T01:00:00Z'}]});
 assert.equal(M.contactReview(x).required,false);
 const y=q('reviewed');M.takeServer([{inquiry_id:y.id,kind:'call',on_date:'2026-01-16',decided_at:'2026-10-09T01:00:00Z'}]);
 assert.equal(M.contactReview(y).required,false);
});
test('list partitions conserve all rows, retain step, prioritize assignment and clear copied-date urgency',()=>{
 const Q=[q('dated'),q('undated',{raw:{응대내용:'관리소장 통화 완료'}}),q('copied',{raw:{},responded_at:'2026-01-16T00:00:00Z'}),q('none',{assignee:'',phone:''}),q('first',{raw:{}}),q('no-phone',{phone:''}),q('linked',{deal_id:'d'})],before=JSON.stringify(Q),w=setup(Q),V=w.InquiryV4;
 const A=V.compute().all;assert.equal(A.length,6);
 const counts=[1,2,3,4,5].map(s=>A.filter(m=>m.st===s).length);assert.equal(counts.reduce((a,b)=>a+b),6);
 for(const id of ['dated','undated','copied']){const m=A.find(m=>m.key===id);assert.equal(m.st,5);assert.equal(m.g,4);assert.equal(m.late,false);assert.equal(m.due,null);assert.equal(m.elapsed,'—');assert.equal(m.act,'기록 확인');}
 assert.equal(A.find(m=>m.key==='dated').step,1);assert.equal(A.find(m=>m.key==='copied').step,2);
 assert.equal(A.find(m=>m.key==='none').st,1);assert.equal(A.find(m=>m.key==='first').st,2);
 assert.equal(A.find(m=>m.key==='no-phone').stLabel,'연락처 보완');
 assert.equal(w.inquiryResponseLate(Q[0]),false);assert.equal(w.inquiryResponseLate(Q[4]),true);
 assert.equal(JSON.stringify(Q),before);
 w.G.inqMemoOff=true;V.fresh();assert.equal(V.compute().all.find(m=>m.key==='dated').st,2,'feature-off restores old classification');
});
test('review stays in Today without a fake deadline, and KPI requests/denominators exclude it',()=>{
 const a=q('review'),b=q('first',{raw:{}}),w=setup([a,b]),rows=w.TodayWorkQueue.data().rows;
 assert.equal(rows.length,2);
 const r=rows.find(x=>x.item===a);assert.equal(r.contactReview,true);assert.equal(r.band,3);assert.equal(r.lag,0);assert.equal(r.dueDays,null);assert.equal(r.responseLate,false);assert.equal(r.processingLate,false);
 const item=w.TodayTower.classify(r,'mgr');assert.equal(item.rk,'fix');assert.equal(item.days,0);assert.equal(item.short,'—');
 const g=w.KpiV7.stageGroups(new Set()).find(x=>x.key==='inquiry');assert.equal(g.total,2);assert.equal(g.rules[0].base,1);assert.equal(g.rules[0].n,1);assert.equal(g.rules[0].targets[0].id,'first');assert.match(g.rules[0].how,/이관 기록 확인 1건/);
 const week=w.PipelineJudge.inquiryWeek([a,b])[1];assert.equal(week.total,2);assert.equal(week.den,1);assert.equal(week.unknown,1);assert.equal(week.num,0);
 assert.deepEqual(Array.from(w.ExecWording.firstBefore('담당'),q=>q.id),['first']);
 const l=w.ExecWording.loadOf({nm:'담당',current:[]},[]);assert.equal(l.counts.first,1);assert.equal(l.counts.fix,1);assert.equal(l.review.length,1);
});
test('same-case server contact only clears review after receipt; unrelated/local evidence does not',()=>{
 const a=q('a'),b=q('b'),w=setup([a,b]);w.ContactState={on:()=>true,siblings:()=>[b]};
 w.InquiryFlow.take({inquiry_id:b.id,logs:[{kind:'connected',occurred_at:'2025-01-01'}]});assert.equal(w.InquiryMemo.contactReview(a).required,true);
 w.InquiryFlow.take({inquiry_id:b.id,logs:[{kind:'connected',occurred_at:'2026-10-09'}]});assert.equal(w.InquiryMemo.contactReview(a).required,false);
 w.ContactState.siblings=()=>[];assert.equal(w.InquiryMemo.contactReview(a).required,true);
});
test('acknowledged date moves to follow-up without inventing an hour for first-contact SLA',()=>{
 const a=q('dated-ack'),w=setup([a]),before=JSON.stringify(a);
 w.InquiryMemo.takeServer([{inquiry_id:a.id,kind:'call',on_date:'2026-01-16',decided_at:'2026-10-09'}]);
 const m=w.InquiryV4.compute().all[0];assert.equal(m.step,2);assert.equal(m.st,3);assert.equal(m.review.required,false);
 assert.equal(w.inquiryResponseLate(a),false);assert.equal(w.ExecWording.firstBefore('담당').length,0);
 const metric=w.PipelineJudge.inquiryWeek([a])[1];assert.equal(metric.den,0);assert.equal(metric.num,0);assert.equal(metric.unknown,1);
 assert.equal(JSON.stringify(a),before,'raw first-response timestamp and contact performance remain untouched');
});
