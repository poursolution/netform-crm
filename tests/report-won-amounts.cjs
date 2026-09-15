const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'../crm.html'),'utf8');
const lines=src.split(/\r?\n/);
const c={ContractPerformance:require('../contract-performance.js'),itemPatch:d=>d.patch||{},sumBy:(a,f)=>a.reduce((s,d)=>s+f(d),0)};
vm.createContext(c);
for(const name of ['wonAmt','hasWonAmt'])vm.runInContext(lines.find(l=>l.startsWith('function '+name+'(')),c);
const data=[{won_amount:100,amt:900},{won_amount:0,amt:800},{won_amount:null,wonAmt:700,amt:700},{amt:600},{won_amount:200,patch:{won_amount:null}}];
assert.equal(c.sumBy(data,c.wonAmt),100);
const avg=src.match(/avg=(function\(A\)\{var known=A.filter\(hasWonAmt\);[^}]+\})/);
assert.ok(avg,'average must exclude unentered contract values');
vm.runInContext('var average='+avg[1],c);
assert.equal(c.average(data),50);assert.equal(c.average(data.slice(2)),null);assert.equal(c.average([]),null);
const remaining=lines.filter(l=>l.includes('wonAmt(d)||oppAmt(d)'));
assert.equal(remaining.length,1,'Only general-purpose deal amount remains');
assert.ok(remaining.every(l=>/function dealAmt/.test(l)));
let scripts=0;
for(const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
 if(/\bsrc=|application\/json|application\/ld\+json/.test(m[1]))continue;
 new vm.Script(m[2]);scripts++;
}
assert.ok(scripts>0);
console.log('Report sum, explicit zero, missing values, average denominator, write-scope guard and '+scripts+' inline scripts passed');
