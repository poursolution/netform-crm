'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const modules=path.resolve(__dirname,'..');
function setup(){
 const html=fs.readFileSync(path.join(modules,'crm.html'),'utf8');
 const c={G:{year:'2026',quarter:0,brand:'전체',rep:'전체',workFilter:'전체',q:''},B:{deals:[]},CLOSED_ST:['종결'],repN:x=>x,workMatches:()=>true,dealWorkSummary:()=>'',workScopeOf:()=> 'unclassified',wonPeriodMatch:d=>d.code==='won'};c.window=c;vm.createContext(c);
 for(const name of ['outcomeOf','isOpen','isLegacyDeal','isActiveDeal','isWon','inPeriod','workAnalysisScope','workAnalysisData']){const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+1);assert.ok(start>=0);vm.runInContext(html.slice(start,end),c);}
 for(const f of ['pipeline-stages.js','pipeline-scope.js'])vm.runInContext(fs.readFileSync(path.join(modules,f),'utf8'),c);
 const d=(id,code,amt,created='2026-09-01')=>({id,code,amt,created,site:id,assignee:'owner',brand:'POUR솔루션'});
 c.B.deals=[d('active','consulting',100),d('legacy','qualified',200),d('won','won',300),d('lost','lost',400),d('badfit','badfit',500),d('prior','consulting',600,'2025-09-01'),d('no-stage','',700),d('badfit-lead','badfit_lead',800),d('silent','silent',900),d('no-date','consulting',1000,'')];
 return c;
}
const ids=l=>Array.from(l,d=>d.id);
test('progress amount uses canonical active scope without hiding classification records or altering source',()=>{
 const c=setup(),before=JSON.stringify(c.B),r=c.workAnalysisData();
 assert.deepEqual(ids(r.open),['active','silent']);assert.equal(r.open.reduce((s,d)=>s+d.amt,0),1000);
 assert.deepEqual(ids(r.flow),['active','legacy','won','lost','badfit','no-stage','badfit-lead','silent']);
 assert.deepEqual(ids(r.won),['won']);assert.equal(JSON.stringify(c.B),before);
});
test('registration period is preserved, all-years includes prior and undated active records',()=>{
 const c=setup();c.G.year='전체';assert.deepEqual(ids(c.workAnalysisData().open),['active','prior','silent','no-date']);
 c.G.year='2026';c.G.quarter=4;assert.equal(c.workAnalysisData().open.length,0);
});
test('brand and owner filters still apply before aggregation',()=>{
 const c=setup();c.G.brand='POUR공법';assert.equal(c.workAnalysisData().open.length,0);
 c.G.brand='전체';c.G.rep='another';assert.equal(c.workAnalysisData().open.length,0);
});
test('canonical scope switch remains respected',()=>{
 const c=setup();c.G.pipeScopeOff=true;assert.deepEqual(ids(c.workAnalysisData().open),['active','legacy','no-stage','badfit-lead','silent']);
});

test('current work model retains all classification rows while using the canonical progress cohort',()=>{
 const c=setup();c.document={readyState:'loading',addEventListener:()=>{}};
 c.oppAmt=d=>d.amt;c.workItemsOf=()=>[];
 vm.runInContext(fs.readFileSync(path.join(modules,'work-v2.js'),'utf8'),c);
 const m=c.Gongjong.model();
 assert.deepEqual(ids(m.open),['active','silent']);
 assert.deepEqual(ids(m.rows),ids(c.workAnalysisData().flow));
});

for(const classified of [false,true])test('fallback money breakdown matches progress total with '+(classified?'confirmed':'unclassified')+' works',()=>{
 const c=setup();c.B.deals.forEach(d=>d.amt*=1e8);
 c.root=c;c.amt=d=>d.amt;c.eok=String;c.fmtAmt=String;
 c.workAnalysisGroup=x=>x;c.workAnalysisPrimary=()=> 'synthetic';
 c.wonAmt=d=>d.amt;c.hasWonAmt=()=>true;
 c.PipelineDiagnosis={render:x=>x};
 const code=fs.readFileSync(path.join(modules,'work-v2.js'),'utf8');
 const start=code.indexOf(' function diagnosis(m){'),end=code.indexOf('\n function rowHtml',start);
 assert.ok(start>=0&&end>start);vm.runInContext(code.slice(start,end),c);
 const data=c.workAnalysisData(),rows=Array.from(data.flow,d=>({d,scope:classified?'single':'unclassified',guess:null}));
 const result=c.diagnosis({data,rows});
 const breakdown=result.cards[1].bars.reduce((s,r)=>s+r[1]*1e8,0);
 assert.equal(breakdown,data.open.reduce((s,d)=>s+d.amt,0));
 assert.equal(breakdown,1000e8);
});
