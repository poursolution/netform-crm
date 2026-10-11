'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),makeModel=require('../mobile-quote-review-model.js'),CE=require('../contact-entry.js');
const ID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222',Q='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',PICKER='chip-1';
const checks=[],failures=[],rigs=[],plain=x=>JSON.parse(JSON.stringify(x));
function rig(shared){
 const s=shared||{data:new Map(),epoch:0,failSet:false,at:Date.UTC(2026,9,11,3),io:[],d:{id:ID,version:3,nm:'합성 견적 현장',code:'consulting',quote_versions:[{id:Q,version_no:2,opportunity_id:ID,base_amount:290000000,status:'final'}],work_items:['슁글'],activities:[],nextAction:{id:OTHER,status:'open',text:'기존 방문',due_on:'2026-10-19'}}};
 const storage={get length(){return s.data.size;},key:i=>[...s.data.keys()][i]??null,getItem:k=>s.data.get(k)??null,setItem(k,v){if(s.failSet)throw Error('QUOTA');s.data.set(k,String(v));},removeItem:k=>s.data.delete(k)},noIO=name=>()=>{s.io.push(name);throw Error('FORBIDDEN '+name);};
 const dState={res:'연결됨',memo:'D에 작성한 원래 내용',mode:'keep',date:'2026-10-19',datePanel:false};
 const w={G:{mode:'rep',user:'합성 담당',deal:ID},DEMO:true,LIVE:false,Phase1:{profile:{auth_uid:ID,user_id:ID},rpc:noIO('rpc'),queue:{enqueue:noIO('queue')}},fetch:noIO('fetch'),pushWrite:noIO('write'),sessionStorage:storage,myDeals:()=>[s.d],addEventListener(){},ContactEntry:CE,MobileEntry:{state:()=>dState},MobileGuideShell:{state:{detailView:'quote'}}};
 w.MobileSaveJournal={owner:()=>ID+':'+ID,session:()=>w.MobileSaveJournal.owner()+':'+s.epoch};
 w.__approvedQuoteExample={owner:w.MobileSaveJournal.owner(),dealId:ID,models:{'K-1':{works:[{id:'roof',label:'슁글',selected:true}],quantities:[{id:'area',label:'슁글',value:'1,200 ㎡',editable:true}],dates:[{id:'chip-0',label:'금 10.16',date:'2026-10-16',selected:true},{id:PICKER,label:'날짜 고르기',action:'pick-date',selected:false},{id:'chip-2',label:'약속 없음',selected:false}],customerDue:null}}};
 w.MobileQuoteReviewModel=makeModel(w);w.MobileApprovedQuoteSource={'K-1':'source sentinel'};w.MobileApprovedQuote={render:(screen,m)=>JSON.stringify(m)};w.MobileApprovedDateSource={sheetHtml:'source sentinel'};w.MobileApprovedDate={render:()=>''};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[s.at]));}static now(){return s.at;}}
 vm.runInNewContext(fs.readFileSync(path.join(base,'mobile-quote-flow.js'),'utf8'),{window:w,Date:Clock,console});
 const api=w.MobileQuoteFlow,r={s,w,api,original:JSON.stringify(s.d),originalD:JSON.stringify(dState),open:()=>api.open(s.d,'K-1'),snap:()=>plain(api.snapshot()),rows:()=>[...s.data],model:()=>JSON.parse(api.render(s.d)),handle:(a,data={})=>api.handle(s.d,a,data),pick:()=>api.handle(s.d,'k1-date',{id:PICKER})};rigs.push(r);return r;
}
function test(name,fn){try{fn();checks.push(name);}catch(e){failures.push({name,error:String(e.stack||e)});}}
function confirm(r,date){assert.equal(r.pick().ok,true);assert.equal(r.api.calendarDate(r.s.d,date).ok,true);return r.handle('k1-calendar-confirm');}
test('opening the marked date picker changes only panel state, not draft or storage',()=>{
 const r=rig();assert(r.open());const before=r.snap().draft,raw=r.rows();assert(r.pick().ok);const s=r.snap();assert.equal(s.datePanel,true);assert.equal(s.calendarValue,'');assert.deepEqual(s.draft,before);assert.deepEqual(r.rows(),raw);assert.equal(r.model().calendarValid,false);
});
test('a rendered date option commits locally and closes, while unrendered options are rejected',()=>{
 const r=rig();assert(r.open());assert(r.pick().ok);assert(r.model().calendarOptions.some(x=>x[1]==='2026-10-16'));const before=r.snap().draft;
 assert.equal(r.handle('k1-calendar-option',{value:'2026-12-25'}).ok,false);assert.deepEqual(r.snap().draft,before);assert.deepEqual(r.rows(),[]);
 assert.equal(r.handle('k1-calendar-option',{value:'2026-10-16'}).ok,true);assert.equal(r.snap().datePanel,false);assert.equal(r.snap().draft.customer_due,'2026-10-16');assert.equal(r.rows().length,1);assert.match(r.model().customerDueState,/unconfirmed/);
});
test('valid confirmation stores only an explicitly unconfirmed local date',()=>{
 const r=rig();assert(r.open());assert.equal(confirm(r,'2028-02-29').ok,true);assert.equal(r.snap().datePanel,false);assert.equal(r.snap().draft.customer_due,'2028-02-29');assert.equal(r.snap().draft.datePreset,PICKER);assert.equal(r.model().customerDue,'2028-02-29');assert.match(r.model().customerDueState,/unconfirmed/);assert.equal(r.rows().length,1);
});
test('reopening a selected shortcut exposes that date only once',()=>{
 const r=rig();assert(r.open());assert(r.pick().ok);const chosen=r.model().calendarOptions[0][1];assert(r.handle('k1-calendar-option',{value:chosen}).ok);assert(r.pick().ok);const dates=r.model().calendarOptions.map(x=>x[1]);assert.equal(dates.filter(date=>date===chosen).length,1);assert.equal(new Set(dates).size,dates.length);assert(dates.length<=4);
});
test('invalid leap dates and nonexistent month days cannot be confirmed',()=>{
 for(const date of ['2027-02-29','2026-02-30','2026-04-31','2026-13-01','2026-00-10','','2026-2-03']){
  const r=rig();assert(r.open());assert(r.pick().ok);r.api.calendarDate(r.s.d,date);assert.equal(r.handle('k1-calendar-confirm').ok,false,date);assert.equal(r.snap().datePanel,true);assert.deepEqual(r.snap().draft,{});assert.deepEqual(r.rows(),[]);
 }
});
test('cancel and Back close the calendar while preserving a previously confirmed draft',()=>{
 for(const close of ['cancel','back']){
  const r=rig();assert(r.open());assert(confirm(r,'2028-02-29').ok);const before=r.snap().draft,raw=r.rows();assert(r.pick().ok);assert.equal(r.snap().calendarValue,'2028-02-29');r.api.calendarDate(r.s.d,'2028-03-01');
  if(close==='cancel')assert(r.handle('k1-calendar-cancel').ok);else assert.equal(r.api.back(r.s.d),true);
  assert.equal(r.snap().datePanel,false);assert.equal(r.snap().screen,'K-1');assert.deepEqual(r.snap().draft,before);assert.deepEqual(r.rows(),raw);
 }
});
test('unconfirmed calendar editing never writes a draft on ordinary reset or reentry',()=>{
 const r=rig();assert(r.open());assert(r.pick().ok);r.api.calendarDate(r.s.d,'2028-02-29');assert.equal(r.api.reset().ok,true);assert.deepEqual(r.rows(),[]);assert(r.open());assert.equal(r.model().customerDue,null);assert.equal(r.snap().datePanel||false,false);
});
test('same-account session and deal version recover the confirmed date after reentry',()=>{
 const r=rig();assert(r.open());assert(confirm(r,'2028-02-29').ok);assert(r.api.reset().ok);const next=rig(r.s);assert(next.open());assert.equal(next.model().customerDue,'2028-02-29');assert.equal(next.snap().draft.datePreset,PICKER);assert(next.pick().ok);assert.equal(next.snap().calendarValue,'2028-02-29');
});
test('failed confirmation storage preserves the selected date, old raw value and error until retry',()=>{
 const r=rig();assert(r.open());assert(confirm(r,'2028-02-29').ok);const old=r.rows();assert(r.pick().ok);r.api.calendarDate(r.s.d,'2028-03-01');r.s.failSet=true;const result=r.handle('k1-calendar-confirm');assert.equal(result.stored,false);assert.equal(r.snap().draft.customer_due,'2028-03-01');assert.deepEqual(r.rows(),old);assert.match(r.model().preview,/보관 실패/);assert.equal(r.api.reset().ok,false);r.s.failSet=false;assert(r.api.reset().ok);assert(r.open());assert.equal(r.model().customerDue,'2028-03-01');
});
test('a stale session cannot edit or confirm the open calendar',()=>{
 const r=rig();assert(r.open());assert(r.pick().ok);r.api.calendarDate(r.s.d,'2028-02-29');const before=r.snap(),raw=r.rows();r.s.epoch++;assert.equal(r.api.calendarDate(r.s.d,'2028-03-01').ok,false);assert.equal(r.handle('k1-calendar-confirm').ok,false);assert.deepEqual(r.snap().draft,before.draft);assert.deepEqual(r.rows(),raw);
});
test('the calendar requires an open marked picker and never touches D state, schedules or RPC',()=>{
 const r=rig();assert(r.open());assert.equal(r.api.calendarDate(r.s.d,'2028-02-29').ok,false);assert.equal(r.handle('k1-calendar-confirm').ok,false);assert.equal(r.handle('k1-calendar-option',{value:'2026-10-16'}).ok,false);
 for(const x of rigs){assert.deepEqual(x.s.io,[]);assert.equal(JSON.stringify(x.s.d),x.original);assert.equal(JSON.stringify(x.w.MobileEntry.state()),x.originalD);}
});
const report={at:new Date().toISOString(),ok:!failures.length,passed:checks.length,failed:failures.length,checks,failures,boundary:'Actual quote flow and shared quote model with synthetic clock/storage; no customer promise, request, schedule, D draft, server or production writes.'};fs.writeFileSync(path.join(__dirname,'quote-calendar-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
