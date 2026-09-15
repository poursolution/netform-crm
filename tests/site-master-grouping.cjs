// Actual siteMasterData, with unrelated display/financial helpers stubbed.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
const fn=src.split(/\r?\n/).find(x=>x.startsWith('function siteMasterData('));
assert.ok(fn);
const c={B:{},SITE_MASTER_DATA_CACHE:null,SITE_MASTER_DATA_REV:0,
 normSite:s=>String(s||'').replace(/\s/g,''),CleanupCore:{norm:s=>String(s||'').replace(/\s/g,'')},
 detailAddress:x=>x.address||'미입력',inquiryCreatedAt:x=>x.created||'',isOpen:x=>x.outcome!=='won'&&x.outcome!=='lost',isWon:x=>x.outcome==='won',
 sumBy:(a,f)=>a.reduce((v,x)=>v+f(x),0),oppAmt:x=>x.amount||0,wonAmt:x=>x.won_amount||0,
 repN:x=>x||'',repCompare:(a,b)=>a.localeCompare(b),customerContacts:()=>[],
 siteMinDate:a=>a.filter(Boolean).sort()[0]||'',siteMaxDate:a=>a.filter(Boolean).sort().pop()||'',siteItemDates:()=>[],siteDays:()=>null,siteHealth:()=> 'dormant'};
c.ContractPerformance=require('../contract-performance.js');c.itemPatch=x=>x.patch||{};c.fmtAmt=n=>n+'원';
vm.createContext(c);vm.runInContext(fn,c);
['wonAmt','hasWonAmt','siteWonDealAmountLabel','siteWonAmountLabel'].forEach(name=>vm.runInContext(src.split(/\r?\n/).find(x=>x.startsWith('function '+name+'(')),c));
function run(deals,inquiries=[],archived=[]){c.B={deals,inquiries,inquiryCleanupArchived:archived};c.SITE_MASTER_DATA_CACHE=null;return c.siteMasterData();}
let rows=run([{id:'d1',site:'이전 이름',site_id:'s1'},{id:'d2',site:'새 이름',site_id:'s1',outcome:'lost'}],[{id:'q1',site:'다른 표기',site_id:'s1'}],[{id:'q2',site:'옛 표기',site_id:'s1'}]);
assert.equal(rows.length,1);assert.equal(rows[0].deals.length,2);assert.equal(rows[0].inquiries.length,2);assert.equal(rows[0].lost.length,1);
rows=run([{id:'d1',site:'동명',site_id:'s1'},{id:'d2',site:'동명',site_id:'s2'}]);assert.equal(rows.length,2);
rows=run([{id:'d1',site:'동명',site_id:'s1'}],[{id:'q1',site:'동명'}]);assert.equal(rows.length,2,'Missing ID must not inherit by name');
rows=run([{id:'d1',site:'동명',address:'주소A'},{id:'d2',site:'동명',address:'주소B'}]);assert.equal(rows.length,2);
console.log('4 actual Site Master grouping scenarios passed (display helpers stubbed)');
rows=run([{id:'d1',site:'동명',site_id:'same-id'},{id:'d2',site:'동명',organization_id:'same-id'}]);
assert.equal(rows.length,2,'Site and Organization namespaces must stay distinct');
assert.deepEqual(Array.from(rows,x=>x.key).sort(),['id:same-id','org:same-id']);
rows=run([{id:'d1',site:'이전 이름',organization_id:'org1'},{id:'d2',site:'변경 이름',organization_id:'org1'}]);assert.equal(rows.length,1);assert.equal(rows[0].key,'org:org1');
rows=run([{id:'d1',site:'현장',site_id:'s1',organization_id:'o1'},{id:'d2',site:'현장',organization_id:'o1'}]);assert.equal(rows.length,2,'Organization membership must not infer a Site mapping');
rows=run([{id:'d1',site:'현장',cleanup_site_id:'reviewed',site_id:'old'},{id:'d2',site:'현장',site_id:'reviewed'}]);assert.equal(rows.length,1,'Keep existing reviewed Site projection');
console.log('4 Site/Organization namespace and reviewed-link cases passed');
const won=(fields)=>Object.assign({site:'금액 검증',site_id:'money',outcome:'won',amount:99999},fields);
rows=run([won({won_amount:null,wonAmt:700})]);
assert.equal(rows[0].wonAmount,0);assert.equal(rows[0].wonMissingAmountCount,1);
assert.equal(c.siteWonAmountLabel(rows[0]),'계약금액 미입력 1건');
assert.equal(c.siteWonDealAmountLabel(rows[0].won[0]),'계약금액 미입력');
rows=run([won({won_amount:0})]);assert.equal(rows[0].wonMissingAmountCount,0);
assert.equal(c.siteWonAmountLabel(rows[0]),'0원');assert.equal(c.siteWonDealAmountLabel(rows[0].won[0]),'0원');
rows=run([won({won_amount:120}),won({won_amount:''}),won({won_amount:0}),won({won_amount:300,patch:{won_amount:null}})]);
assert.equal(rows[0].wonAmount,120);assert.equal(rows[0].wonMissingAmountCount,2);
assert.equal(c.siteWonAmountLabel(rows[0]),'120원 · 계약금액 미입력 2건');
rows=run([won({wonAmt:80}),won({won_amount:10,patch:{won_amount:20}})]);
assert.equal(rows[0].wonAmount,100);assert.equal(rows[0].wonMissingAmountCount,0);
rows=run([{site:'미수주',outcome:'lost',amount:400}]);assert.equal(c.siteWonAmountLabel(rows[0]),'0원');
for(const name of ['siteMasterData','siteTimeline','siteWorkBookHTML','openSiteMaster']) {
 const line=src.split(/\r?\n/).find(x=>x.startsWith('function '+name+'('));
 assert.ok(!line.includes('wonAmt(d)||oppAmt(d)'),name+' must not substitute estimated amount');
 new vm.Script(line);
}
assert.ok(src.includes('esc(siteWonAmountLabel(s))'));
console.log('5 Site Master financial scenarios passed using actual ContractPerformance and CRM helpers');
