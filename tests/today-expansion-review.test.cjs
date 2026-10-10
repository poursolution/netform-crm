'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Flow=require('../expansion-flow.js');
function fixture(rows,opts={}){
 const c={console,Date,Map,Set};Object.assign(c,{window:c,G:{},OPS_RULES:{},LOCAL:{expansionPool:[]},B:{inquiries:[]},
  esc:String,escAttr:String,repN:v=>v||'',ExpansionFlow:Flow,ExpansionV2:{},
  document:{readyState:'loading',addEventListener(){}},
  expansionSourceDeal:r=>r._deal||{},dealWorkSummary:d=>d.work||'',expansionRecords:()=>rows,
  expServerRows:()=>opts.inferred?[]:rows.map(r=>({source_opportunity_id:r.sourceOpportunityId,next_contact_at:r.nextContactAt})),
  expSourceId:r=>r.source_opportunity_id,daysTo:d=>Math.round((Date.parse(d)-Date.parse('2026-10-10'))/86400000),fmtD:v=>v,
  todayHomeData:()=>({admin:opts.admin!==false,Q:[],D:[],inquiry:[],pipeline:[]}),todayOwner:()=>opts.me||'담당A',
  ME:{name:opts.me||'담당A',role:opts.admin===false?'rep':'admin'},actionObj:()=>null,itemPatch:()=>({})
 });
 for(const file of ['expansion-b.js','today-work-queue.js','today-tower.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../'+file),'utf8'),c);
 return c;
}
const row=(id,patch={})=>({id,sourceOpportunityId:id,site:'Synthetic '+id,owner:'담당A',status:'관계 관리중',
 completionDate:'2026-08-01',lastContactAt:'2026-10-01',nextContactAt:'2026-10-09',sourceWorkSummary:'옥상 방수',...patch});
test('record-review cases remain in Today but are not overdue or urgent',()=>{
 for(const patch of [{completionDate:''},{sourceWorkSummary:''},{lastContactAt:''}]){
  const r=row('a',patch),c=fixture([r]),before=JSON.stringify(r),x=c.TodayWorkQueue.data().rows[0];
  assert.equal(c.ExpansionB.classify(r).kind,'fix');assert.ok(x,'review work must remain discoverable');
  assert.equal(x.overdue,false);assert.equal(x.urgent,false);assert.equal(c.TodayWorkQueue.matches(x,'overdue'),false);
  assert.equal(x.due,'2026-10-09');assert.equal(JSON.stringify(r),before);
  assert.equal(c.TodayTower.classify(x,'rep').rk,'fix');
 }
});
test('tower also honors record review when an older queue passes overdue=true',()=>{
 const r=row('a',{lastContactAt:''}),c=fixture([r]);
 const x={key:'expansion:a',type:'expansion',kind:'expansion',item:r,overdue:true,dueDays:-1,delay:1};
 for(const role of ['rep','mgr','lead','vp','ceo']){
  const out=c.TodayTower.classify(x,role);assert.equal(out.rk,'fix');assert.equal(out.urg,'week');
 }
 assert.equal(x.overdue,true,'classification must not mutate caller data');
});
test('confirmed explicit overdue remains overdue and due today is preserved',()=>{
 const c=fixture([row('late'),row('today',{nextContactAt:'2026-10-10'})]);
 const rows=c.TodayWorkQueue.data().rows;
 const late=rows.find(x=>x.item.id==='late'),today=rows.find(x=>x.item.id==='today');
 assert.equal(late.overdue,true);assert.equal(late.urgent,true);assert.equal(c.TodayTower.classify(late,'rep').rk,'promise');
 assert.equal(today.overdue,false);assert.equal(today.dueDays,0);
});
test('inferred dates remain non-overdue and missing dates do not become real deadlines',()=>{
 const c=fixture([row('a'),row('b',{completionDate:'',nextContactAt:''})],{inferred:true});
 const rows=c.TodayWorkQueue.data().rows;
 const a=rows.find(x=>x.item.id==='a'),b=rows.find(x=>x.item.id==='b');
 assert.equal(a.inferred,true);assert.equal(a.overdue,false);assert.equal(b.dueDays,null);assert.equal(b.overdue,false);
});
test('future, hold and converted records stay out; rep owner scope remains intact',()=>{
 const c=fixture([row('mine'),row('other',{owner:'담당B'}),row('future',{nextContactAt:'2026-10-11'}),row('hold',{status:'보류/휴면'}),row('done',{createdOpportunityId:'child'})],{admin:false});
 assert.deepEqual(Array.from(c.TodayWorkQueue.data().rows,x=>x.item.id),['mine']);
});
test('pipeline and inquiry overdue classifications keep their existing route',()=>{
 const c=fixture([]);Object.assign(c,{dealStage:()=>'',oppAmt:()=>0,activityAge:()=>0,relationshipMeta:()=>({days:0}),stageAge:()=>0,inqCtlFirstResponseAt:()=>null});
 for(const type of ['deal','inq'])assert.equal(c.TodayTower.classify({key:type+':a',type,item:{},overdue:true,dueDays:-1},'rep').rk,'promise');
});
