// ID-only production response snapshot, irreversibly renamed before storing.
// No customer names, notes, contact information, tokens or original UUIDs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),sample=require('./fixtures/lineage-impact-anonymized.json');
const baseline=cp.execFileSync('git',['-c','safe.directory='+root.replace(/\\/g,'/'),'show','56e1502:crm.html'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
const current=fs.readFileSync(path.join(root,'crm.html'),'utf8');
function load(src){const start=src.indexOf('function inquiryDealRefs('),end=src.indexOf('function flowIndex(',start);assert.ok(start>=0&&end>start);const c={B:{deals:sample.deals},inqKey:q=>q.id||''};vm.createContext(c);vm.runInContext(src.slice(start,end),c);return c;}
const old=load(baseline),next=load(current);let changes=0,linked=0;
assert.equal(sample.complete,true);
for(const q of sample.inquiries){const a=old.linkedDeal(q)?.id||null,b=next.linkedDeal(q)?.id||null;if(a!==b)changes++;if(b)linked++;}
assert.equal(changes,0);assert.equal(linked,9);
console.log(JSON.stringify({sourceCounts:sample.counts,complete:sample.complete,linked,changes,scope:'server projection reference fields; excludes browser local patches'}));
