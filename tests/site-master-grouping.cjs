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
vm.createContext(c);vm.runInContext(fn,c);
function run(deals,inquiries=[],archived=[]){c.B={deals,inquiries,inquiryCleanupArchived:archived};c.SITE_MASTER_DATA_CACHE=null;return c.siteMasterData();}
let rows=run([{id:'d1',site:'이전 이름',site_id:'s1'},{id:'d2',site:'새 이름',site_id:'s1',outcome:'lost'}],[{id:'q1',site:'다른 표기',site_id:'s1'}],[{id:'q2',site:'옛 표기',site_id:'s1'}]);
assert.equal(rows.length,1);assert.equal(rows[0].deals.length,2);assert.equal(rows[0].inquiries.length,2);assert.equal(rows[0].lost.length,1);
rows=run([{id:'d1',site:'동명',site_id:'s1'},{id:'d2',site:'동명',site_id:'s2'}]);assert.equal(rows.length,2);
rows=run([{id:'d1',site:'동명',site_id:'s1'}],[{id:'q1',site:'동명'}]);assert.equal(rows.length,2,'Missing ID must not inherit by name');
rows=run([{id:'d1',site:'동명',address:'주소A'},{id:'d2',site:'동명',address:'주소B'}]);assert.equal(rows.length,2);
console.log('4 actual Site Master grouping scenarios passed (display helpers stubbed)');
