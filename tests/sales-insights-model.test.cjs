const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../sales-insights-model.js');
const f={year:'2026',month:9,brand:'전체',owner:'전체'};
const d=(key,more={})=>({key,owner:'김성민',brand:'A',site:key,active:true,issues:[],expected:100,...more});
test('current pipeline survives period selection; wins use actual close date and amount',()=>{
 const s=M.summarize([d('old',{created:'2024-01-01'}),d('won',{active:false,won:true,created:'2024-01-01',wonAt:'2026-09-02',wonAmount:50,hasWonAmount:true}),d('missing',{active:false,won:true,wonAt:'2026-09-03',expected:900,hasWonAmount:false}),d('other-month',{active:false,won:true,wonAt:'2026-08-03',wonAmount:30,hasWonAmount:true})],[{key:'q',created:'2026-09-01'},{key:'old-q',created:'2026-08-31'}],f);
 assert.equal(s.active.length,1);assert.equal(s.expected,100);assert.equal(s.inquiries.length,1);assert.equal(s.won.length,2);assert.equal(s.wonAmount,50);assert.equal(s.missingWon,1);assert.equal(s.trend[8].amount,50);
});
test('risk count deduplicates sites; overlapping reasons still filter the same record',()=>{
 const x=d('x',{issues:['overdue','missing','contact']}),s=M.summarize([x,x,d('y')],[],f);
 assert.equal(s.risk.length,1);assert.equal(s.active.length,2);assert.equal(M.select(s,'risk',{issue:'missing'}).length,1);assert.equal(M.select(s,'risk',{issue:'urgent'}).length,1);
});
test('owner and brand constrain every metric and filtered list',()=>{
 const s=M.summarize([d('x'),d('y',{owner:'이필선'}),d('z',{brand:'B'})],[],{...f,owner:'김성민',brand:'A'});
 assert.deepEqual(s.active.map(x=>x.key),['x']);assert.deepEqual(M.select(s,'active',{search:'x'}).map(x=>x.key),['x']);assert.equal(M.select(s,'active',{stage:'sent'}).length,0);
});
test('Korean day boundary and absent contract dates do not leak into selected month',()=>{
 assert.equal(M.date('2026-08-31T16:00:00Z'),'2026-09-01');assert.equal(M.inPeriod('2026-08-31T16:00:00Z',f),true);assert.equal(M.inPeriod('',f),false);
 const s=M.summarize([d('x',{won:true,active:false,wonAt:'',wonAmount:300})],[],f);assert.equal(s.won.length,0);assert.equal(s.missingWonDate,1);
});

test('stage display follows workflow order instead of bundle row order',()=>{
 const s=M.summarize([d('a',{stage:'completion',stageLabel:'준공'}),d('b',{stage:'sent',stageLabel:'자료발송'}),d('c',{stage:'first_contact',stageLabel:'접촉'}),d('d',{stage:'contract',stageLabel:'계약'})],[],f);
 assert.deepEqual(s.stages.map(x=>x.code),['first_contact','sent','contract','completion']);
});
