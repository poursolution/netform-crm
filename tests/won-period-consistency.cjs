const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
const c={ContractPerformance:require('../contract-performance.js'),itemPatch:()=>({}),isWon:d=>d.code==='won',isOpen:d=>d.code==='open',G:{year:'2026',quarter:3,brand:'전체',rep:'전체',pipeOrigin:'wonPeriod'},B:{},repN:x=>x,workMatches:()=>true,constructionYearMatch:()=>true,metricDealMatch:()=>true,workScopeOf:()=> 'single'};vm.createContext(c);
function load(name){const start=src.indexOf('function '+name+'('),rest=src.slice(start),end=rest.indexOf('\nfunction ');vm.runInContext(rest.slice(0,end),c)}
for(const name of ['wonDate','inPeriod','wonPeriodMatch','wonInPeriod','pipeScoped','workAnalysisData'])load(name);
c.B.deals=[{id:'missing',code:'won',created:'2026-08-01',updated:'2026-09-01'},{id:'old',code:'won',closed:'2025-09-01',created:'2026-08-01'},{id:'canonical',code:'won',closed_at:'2026-09-01T12:00:00Z'},{id:'history',code:'won',stageHistory:[{to:'won',at:'2026-07-01'}]},{id:'lost',code:'lost',closed:'2026-08-01'},{id:'otherQuarter',code:'won',closed:'2026-04-01'}];
c.workAnalysisScope=()=>c.B.deals;
const ids=A=>Array.from(A,d=>d.id).sort();
assert.deepEqual(ids(c.wonInPeriod()),['canonical','history']);assert.deepEqual(ids(c.pipeScoped()),ids(c.wonInPeriod()));
let data=c.workAnalysisData();assert.deepEqual(ids(data.won),ids(c.wonInPeriod()));assert.deepEqual(ids(data.closed),['canonical','history','lost']);
c.G.year='전체';assert.ok(!ids(c.wonInPeriod()).includes('missing'));assert.ok(ids(c.wonInPeriod()).includes('old'));
c.G.year='2026';c.G.quarter=2;assert.deepEqual(ids(c.wonInPeriod()),['otherQuarter']);assert.deepEqual(ids(c.pipeScoped()),['otherQuarter']);
console.log('Actual won totals, drilldown and work-analysis date consistency passed, including all-period and quarter boundaries');
