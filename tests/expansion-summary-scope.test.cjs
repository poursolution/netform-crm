const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const Flow=require('../expansion-flow.js');

function render(rows){
 const host={innerHTML:'',addEventListener(){}},context={console,Date,Map,Set};
 Object.assign(context,{window:context,G:{expansionYear:'전체'},OPS_RULES:{},ExpansionFlow:Flow,
  esc:String,escAttr:String,expansionRecords:()=>rows,expansionSourceDeal:r=>r._deal||{},
  dealWorkSummary:d=>d.work||'',daysTo:d=>Math.round((Date.parse(d)-Date.parse('2026-10-10'))/86400000),
  SalesScope:{matches:()=>true},SalesFilterState:{matchesBrand:()=>true},
  document:{readyState:'complete',getElementById:()=>null,createElement:()=>({})},
  requestAnimationFrame:()=>{},addEventListener(){},ExpansionV2:{paint(){}},
  StageBoard:{state:()=>({bucket:'all'}),bind(){},html(C,items){
   context.items=items;context.config=C;
   return '';
  }}
 });
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../expansion-b.js'),'utf8'),context);
 context.ExpansionV2.paint(host);
 const ranked=context.items.map(i=>({...i,red:i.rs.some(k=>context.config.RS[k]?.[1]==='#d93a3a')}));
 return {context,summary:context.config.overSplit(ranked),side:context.config.sideHtml};
}
const row=(id,patch={})=>({id,sourceOpportunityId:id,site:'Synthetic '+id,status:'관계 관리중',
 completionDate:'2026-08-01',lastContactAt:'2026-10-01',nextContactAt:'2026-10-20',
 sourceWorkSummary:'옥상 방수',_deal:{id,brand:'POUR솔루션'},...patch});

test('uncolored missing completion is not counted as measurable',()=>{
 const r=render([row('a',{completionDate:''})]);
 assert.equal(r.summary.check,1);assert.equal(r.summary.over,0);
 assert.match(r.summary.text,/표본 판정 가능 0건/);assert.match(r.side,/기록 보완 필요 1/);
});
test('uncolored work and contact gaps match the existing split totals',()=>{
 const r=render([row('a',{sourceWorkSummary:''}),row('b',{completionDate:'2026-10-05',lastContactAt:''}),row('c')]);
 assert.equal(r.summary.check,2);assert.equal(r.summary.over,0);
 assert.match(r.summary.text,/대상 3건.*표본 판정 가능 1건/);assert.match(r.side,/기록 보완 필요 2/);
});
test('confirmed overdue and record review remain distinct without double counting',()=>{
 const r=render([row('a',{nextContactAt:'2026-10-09'}),row('b',{nextContactAt:'2026-10-09',sourceWorkSummary:''}),row('c',{lastContactAt:''}),row('d')]);
 assert.equal(r.summary.over,1);assert.equal(r.summary.check,2);
 assert.match(r.side,/기한 경과·결과 확인 1/);assert.match(r.side,/기록 보완 필요 2/);assert.match(r.side,/사후 연락 대상 1/);
});
test('hold and converted records do not increase review or measurable cohorts',()=>{
 const r=render([row('a',{status:'보류/휴면',completionDate:''}),row('b',{createdOpportunityId:'new',lastContactAt:''}),row('c')]);
 assert.equal(r.summary.check,0);assert.equal(r.summary.over,0);
 assert.match(r.summary.text,/대상 1건.*표본 판정 가능 1건/);
});
test('empty pool and healthy records do not manufacture review work',()=>{
 const a=render([]),b=render([row('a'),row('b')]);
 assert.equal(a.summary.check,0);assert.equal(a.summary.over,0);assert.match(a.summary.text,/표본 판정 가능 0건/);
 assert.equal(b.summary.check,0);assert.equal(b.summary.over,0);assert.match(b.summary.text,/표본 판정 가능 2건/);
});
test('summary review count equals per-record classifier and preserves originals',()=>{
 const rows=[row('a',{completionDate:''}),row('b',{sourceWorkSummary:''}),row('c',{lastContactAt:''}),row('d',{nextContactAt:'2026-10-01'}),row('e')];
 const before=JSON.stringify(rows),r=render(rows);
 const kinds=rows.map(x=>r.context.ExpansionB.classify(x).kind);
 assert.equal(r.summary.check,kinds.filter(k=>k==='fix').length);
 assert.equal(r.summary.over,kinds.filter(k=>k==='miss').length);
 assert.equal(JSON.stringify(rows),before);
});
