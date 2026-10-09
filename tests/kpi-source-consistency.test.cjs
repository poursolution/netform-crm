'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
process.env.TZ='Asia/Seoul';
const NOW=Date.parse('2026-10-09T03:00:00Z');
class Clock extends Date{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}}
function fixture(){
 const deals=Array.from({length:156},(_,i)=>({id:'d'+i,site:'현장'+i,code:'consulting',assignee:i===155?'':'담당'+i%5,created:i<120?'2025-01-01':'2026-01-01',brand:'POUR솔루션',next_action:i<26?{text:'자료 발송',due:'2026-10-12'}:null}));
 const inquiries=[0,1,2].map(i=>({id:'q'+i,created_at:'2026-10-05T00:00:00Z',assigned_at:'2026-10-05T01:00:00Z',assignee:'담당0',first:i===0?'2026-10-05T02:00:00Z':''}));
 const calls=[],r={Date:Clock,Intl,console,document:{readyState:'loading',addEventListener(){}},G:{brand:'전체',workFilter:'전체',q:'',rep:'전체'},B:{deals,inquiries},ME:{name:'관리자'},esc:String,escAttr:String,
  repN:v=>v||'미배정',todayIsAdmin:()=>true,SalesScope:{state:()=>({owner:r.G.rep})},operationalInquiries:q=>q.filter(x=>!x.deleted),
  PipelineScope:{on:()=>true,isLegacy:d=>d.code==='legacy'},isOpen:d=>!['lost','won'].includes(d.code),itemPatch:()=>({}),actionObj:d=>d.next_action,dealKey:d=>d.id,
  inqKey:q=>q.id,targetNameFilter:()=>null,inquiryRoutedOwner:q=>q.assignee,inquiryCreatedAt:q=>q.created_at,inquiryAssignedAt:q=>q.assigned_at,inquiryAssigned:q=>!!q.assignee,inqCtlFirstResponseAt:q=>q.first,
  managementStats:()=>({D:deals.slice(0,36),Q:inquiries,assignRate:7,responseRate:3.5,unassigned:[],noResponse:inquiries.slice(1),nextMissing:deals.slice(10,36),sameDayAssigned:[],responseSla:[]}),
  PERFORMANCE_TARGET_NAMES:['담당0'],RecordingKPI:{stats:()=>({deals:0,activeN:0,activity:null})},salesActivityAt:()=>'',
  PipelineStageB:{CFG:{},model:()=>({items:[]})},PipelineWorkspace:{rows:()=>[]},
  OpsStore:{monday:n=>n===-1?'2026-09-28':'2026-10-05',rpc:async(n,p)=>{calls.push({n,p});return {saved:p.rows.length};},has:()=>false},
 };
 r.window=r;vm.createContext(r);
 for(const f of ['pipeline-judge.js','kpi-b.js','kpi-v7.js','today-tower.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),r,{filename:f});
 r.KpiB.weekly().rows=[{promise_key:'kpi:1',week_start:'2026-09-28',numerator:106,denominator:1000},{promise_key:'kpi:2',week_start:'2026-09-28',numerator:13,denominator:1000}];
 return {r,calls};
}
test('이번 주 표시·증감·추이·저장 모두 같은 분자와 분모: +89.4pp / +32.0pp',async()=>{
 const {r,calls}=fixture(),C=r.KpiB.compute(),rows=r.KpiV7.coreRows(C,[],false);
 const a=rows.find(x=>x.i===0),b=rows.find(x=>x.i===1);
 assert.equal(a.v,100);assert.equal(a.d,89.4);assert.equal(b.v,33.3);assert.equal(b.d,32);
 assert.match(b.meta,/지난주 1.3% ▲32%p/);assert.equal(C.M[1].trend[3],33.3);
 r.KpiB.saveWeek(null);await new Promise(setImmediate);
 const saved=calls.find(c=>c.n==='crm_kpi_weekly_save_v1').p.rows;
 assert.equal(saved.find(x=>x.promise_key==='kpi:1').numerator,3);
 assert.equal(saved.find(x=>x.promise_key==='kpi:2').numerator,1);
 assert.equal(saved.find(x=>x.promise_key==='kpi:2').denominator,3);
});
test('오늘 업무·KPI는 과거 생성 연도 및 내부 담당 명단과 무관하게 현재 진행 156건을 공유한다',()=>{
 const {r}=fixture(),m=r.KpiB.compute().M[2],today=r.TodayTower._week({D:r.B.deals,Q:r.B.inquiries},'mgr');
 assert.equal(m.num,26);assert.equal(m.den,156);assert.equal(m.v,17);
 assert.equal(today[1].v,'17%');assert.match(today[1].goal,/진행 156건 중 26건/);
 assert.equal(m.todos.length,m.den-m.num);assert.equal(new Set(m.todos.map(t=>t.id)).size,130);
 const row=r.KpiV7.coreRows(r.KpiB.compute(),[],false).find(x=>x.i===2);
 assert.match(row.reqSum,/미등록 130건 중 요청 가능 129건 · 담당 없음 1/);
 r.G.rep='담당0';const filtered=r.KpiB.compute().M[2],own=r.KpiB.personVals('담당0',{items:[]});
 assert.equal(filtered.den,31);assert.equal(filtered.num,6);assert.equal(own.vals[2],filtered.v);
 r.todayIsAdmin=()=>false;r.ME.name='담당1';r.G.rep='전체';
 assert.equal(r.KpiB.compute().M[2].den,31,'개인 권한은 확대하지 않는다');
});
test('지난주 접수·이번 주 배정도 첫 연락 분모에 포함하고 배정 전 연락은 SLA 성공이 아니다',()=>{
 const {r}=fixture();r.B.inquiries=[
 {created_at:'2026-09-20',assigned_at:'2026-10-05T01:00:00Z',assignee:'담당0',first:'2026-10-05T02:00:00Z'},
 {created_at:'2026-09-20',assigned_at:'2026-10-05T01:00:00Z',assignee:'담당0',first:'2026-10-05T00:00:00Z'},
 {created_at:'2026-10-10',assigned_at:'2026-10-10',assignee:'담당0',first:'2026-10-10'},
 ];
 const m=r.KpiB.compute().M;assert.equal(m[0].den,0);assert.equal(m[1].den,2);assert.equal(m[1].num,1);
 assert.equal(r.TodayTower._week({D:[],Q:[]},'mgr')[0].v,'50%');
});
test('공통 대상은 선택 브랜드를 유지하고 휴지통·협약문의·과거 이관을 제외한다',()=>{
 const {r}=fixture();r.SalesFilterState={matchesBrand:b=>['POUR솔루션','POUR공법'].includes(b)};
 r.B.deals=[
  {id:'ok',code:'consulting',brand:'POUR공법'},
  {id:'other',code:'consulting',brand:'아파트스퀘어'},
  {id:'trash',code:'consulting',brand:'POUR공법',deleted_at:'2026-10-09'},
  {id:'legacy',code:'legacy',brand:'POUR공법'},
  {id:'closed',code:'lost',brand:'POUR공법'},
 ];
 const J=r.PipelineJudge,N=J.nextRate(J.metricSource('deal'));
 assert.equal(N.den,1);assert.equal(N.list[0].id,'ok');
 r.InquiryB2B={isAgreement:q=>q.b2b};r.B.inquiries=[
  {id:'ok',brand:'POUR솔루션'},{id:'b2b',brand:'POUR솔루션',b2b:true},
  {id:'trash',brand:'POUR솔루션',deleted_at:'2026-10-09'},{id:'other',brand:'아파트스퀘어'},
 ];
 assert.deepEqual(Array.from(J.metricSource('inq'),q=>q.id),['ok']);
});
test('기존 담당자 묶음 요청 이력은 보존하되 미등록 건수를 영업건 단위로 분해한다',()=>{
 const {r}=fixture();r.G.kbDone=['kpi:3|rep:담당0'];
 const m=r.KpiB.compute().M[2],done=m.todos.filter(t=>t.done).length,none=m.todos.filter(t=>!t.owner||t.owner==='미배정').length;
 assert.equal(done,25);assert.equal(none,1);assert.equal(m.todos.length,130);
 const row=r.KpiV7.coreRows(r.KpiB.compute(),[],false).find(x=>x.i===2);
 assert.match(row.reqSum,/미등록 130건 중 요청 가능 104건 · 이미 요청 중 25 · 담당 없음 1/);
});
test('관계관리 미분류·접촉 미확인은 준수 분모에서 제외하고 각 주기는 해당 구분만 센다',()=>{
 const {r}=fixture();const items=[{bucket:'nodata',rs:['nosent'],row:{contactDays:null}},
 {bucket:'normal',rs:[],seg:{contact:2},row:{}},{bucket:'focus',rs:[],seg:{contact:null},row:{}},
 {bucket:'normal',rs:['month30'],seg:{contact:40},row:{key:'over',owner:'담당0'}}];
 r.PipelineWorkspace.rows=()=>items.map(item=>({group:'relationship',item}));
 r.PipelineStageB.CFG={relationship:{}};r.PipelineStageB.model=()=>({C:{name:'관계관리',RS:{focus7:['집중','','연락','7일'],month30:['일반','','연락','30일'],long60:['대기','','연락','60일']}},items,isRed:()=>true});
 const g=r.KpiV7.stageGroups(new Set())[0],normal=g.rules.find(x=>x.k==='month30'),focus=g.rules.find(x=>x.k==='focus7');
 assert.equal(normal.base,2);assert.equal(normal.n,1);assert.equal(normal.p,50);assert.equal(normal.unknown,1);
 assert.equal(focus.base,0);assert.equal(focus.p,null);assert.equal(focus.unknown,2);
});
