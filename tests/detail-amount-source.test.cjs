'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
function health(d){const ctx={relationshipMeta:()=>({meaningfulAt:'2026-09-16'}),dccWaitingData:()=>({}),dealStage:()=> 'sent',repN:()=> '담당자',oppAmt:d=>Number(d.amt||0),quoteAmt:()=>{throw Error('quote must not substitute for expected amount');},workScopeOf:()=> 'single',dccHasContact:()=>true,actionObj:()=>({})};vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function dccHealth('),html.indexOf('function dccRisk(')),ctx);return ctx.dccHealth(d,{});}
test('quote or contract alone cannot mark expected amount complete',()=>{
 for(const d of [{quoteAmt:900000},{wonAmt:800000},{amt:0,quoteAmt:900000},{}]){const before=JSON.stringify(d),r=health(d);assert.ok(r.missing.includes('예상금액'));assert.equal(r.done,7);assert.equal(JSON.stringify(d),before);}
});
test('expected amount completes only its own existing check',()=>{
 const r=health({amt:700000,quoteAmt:900000});assert.equal(r.done,8);assert.equal(r.total,8);assert.equal(r.rate,100);assert.equal(r.missing.length,0);
});
test('both detail hero definitions bind expected amount without quote fallback',()=>{
 const definitions=html.split(/\r?\n/).filter(x=>x.startsWith('function dccHeroHTML(')||x.startsWith('dccHeroHTML=function('));
 assert.equal(definitions.length,2);
 for(const line of definitions){assert.match(line,/amount=oppAmt\(d\),/);assert.doesNotMatch(line,/amount=oppAmt\(d\)\|\|quoteAmt/);}
});
