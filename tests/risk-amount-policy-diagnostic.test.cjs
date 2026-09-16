'use strict';
// Diagnostic of current behavior, not proof that the amount policy is correct.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
const source=html.slice(html.indexOf('function dccRisk('),html.indexOf('function dccRecommendations('));
function run(d,expectedOnly=false){const ctx={oppAmt:d=>d.amt||0,quoteAmt:d=>d.quoteAmt||0,relationshipMeta:()=>({days:30}),dccWaitingData:()=>({}),dealStage:()=> 'sent',actionObj:()=>null,forecastProbability:()=>0,dccHasContact:()=>true,fmtAmt:String};vm.createContext(ctx);vm.runInContext(expectedOnly?source.replace('oppAmt(d)||quoteAmt(d)||0','oppAmt(d)||0'):source,ctx);return ctx.dccRisk(d,{});}
test('removing quote fallback changes a quote-only case from watch to stable',()=>{
 const d={quoteAmt:100000000},before=JSON.stringify(d),current=run(d),candidate=run(d,true);
 assert.equal(current.score,55);assert.equal(current.cls,'watch');assert.equal(candidate.score,35);assert.equal(candidate.cls,'stable');assert.equal(JSON.stringify(d),before);
});
test('quote-only billion case loses critical status under expected-only policy',()=>{
 assert.equal(run({quoteAmt:1000000000}).score,69);assert.equal(run({quoteAmt:1000000000}).cls,'critical');assert.equal(run({quoteAmt:1000000000},true).cls,'stable');
});
test('existing expected amount takes precedence even when quote is much larger',()=>{
 const d={amt:10000000,quoteAmt:1000000000};assert.equal(run(d).score,45);assert.equal(run(d,true).score,45);
});
test('missing all amounts and expected-only rows do not change',()=>{
 for(const d of [{},{amt:100000000},{amt:1000000000}])assert.deepEqual(JSON.parse(JSON.stringify(run(d))),JSON.parse(JSON.stringify(run(d,true))));
});
test('risk detail identifies its amount source without replacing the stored amounts',()=>{
 for(const [d,prefix] of [[{amt:10000000,quoteAmt:1000000000},'예상금액 기준 10000000'],[{quoteAmt:1000000000},'견적금액 기준 1000000000'],[{amt:0,quoteAmt:100000000},'견적금액 기준 100000000']]){
  const before=JSON.stringify(d);assert.ok(run(d).detail.startsWith(prefix));assert.equal(JSON.stringify(d),before);
 }
 assert.doesNotMatch(run({}).detail,/금액 기준/);
});
test('amount source labels preserve all amount scoring boundaries',()=>{
 for(const [amount,points] of [[0,0],[1,10],[99999999,10],[100000000,20],[499999999,20],[500000000,28],[999999999,28],[1000000000,34]]){
  for(const d of [{amt:amount},{quoteAmt:amount}]){const r=run(d);assert.equal(r.score,35+points);assert.equal(r.cls,r.score>=65?'critical':r.score>=38?'watch':'stable');}
 }
});
