'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const lines=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8').split(/\r?\n/);
function setup(version){const body={innerHTML:''},input={value:''},deals=[{site:'예상만',amt:900000000,quoteAmt:0},{site:'견적큰',amt:1,quoteAmt:300000000},{site:'견적작은',amt:800000000,quoteAmt:100000000},{site:'금액없음',amt:0,quoteAmt:0}];
 const ctx={B:{deals},PERFORMANCE_TARGET_NAMES:[],isOpen:()=>true,oppAmt:d=>d.amt,quoteAmt:d=>d.quoteAmt,execAskNext:()=>null,siteContacts:()=>[],itemPatch:()=>({}),repN:()=>'',stageLabel:()=>'',stageNoLabel:()=>'',dealStage:()=>'',bizOf:()=>'',dealWorkSummary:()=>'',esc:x=>String(x),fmtAmt:x=>String(x)+'원',$:s=>s==='#execAskInput'?input:body};vm.createContext(ctx);
 for(const name of ['execAskQuery','runExecAsk'])vm.runInContext(lines.filter(x=>x.startsWith('function '+name+'('))[version],ctx);
 return {ctx,body,input,deals};}
for(const version of [0,1]){
 test('quote threshold, sorting and rendered amount agree, version '+version,()=>{const f=setup(version),before=JSON.stringify(f.deals);const r=f.ctx.execAskQuery('견적 1억 이상인데 다음 행동 없는 곳');assert.deepEqual(Array.from(r.list,x=>x.site),['견적큰','견적작은']);assert.equal(r.amountKind,'quote');f.input.value='견적 1억 이상인데 다음 행동 없는 곳';f.ctx.runExecAsk();assert.ok(f.body.innerHTML.includes('견적금액'));assert.ok(f.body.innerHTML.includes('300000000원'));assert.ok(!f.body.innerHTML.includes('800000000원'));assert.equal(JSON.stringify(f.deals),before);});
 test('general search uses expected amounts only, version '+version,()=>{const f=setup(version);const r=f.ctx.execAskQuery('');assert.equal(r.amountKind,'expected');assert.deepEqual(Array.from(r.list,x=>x.site),['예상만','견적작은','견적큰','금액없음']);f.ctx.runExecAsk();assert.ok(f.body.innerHTML.includes('예상금액'));assert.ok(f.body.innerHTML.includes('미입력'));assert.ok(!f.body.innerHTML.includes('300000000원'));});
}
