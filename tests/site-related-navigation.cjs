const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
let sites=[],opened=[],warnings=[];
const c={siteMasterData:()=>sites,normSite:s=>String(s||'').replace(/\s/g,''),openSiteMaster:i=>opened.push(i),alert:s=>warnings.push(s),SITE_MASTER_CACHE:['unchanged']};
vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8').split(/\r?\n/).find(l=>l.startsWith('function openRelatedSite(')),c);
sites=[{name:'동명',names:{동명:1},key:'id:a'},{name:'동명',names:{동명:1},key:'id:b'}];
c.openRelatedSite('동명');assert.equal(opened.length,0);assert.equal(c.SITE_MASTER_CACHE[0],'unchanged');assert.ok(warnings[0].includes('여러 곳'));
sites=[{name:'새 이름',names:{'옛 이름':1,'새 이름':1},key:'id:a'}];c.openRelatedSite('옛 이름');assert.deepEqual(opened,[0]);assert.equal(c.SITE_MASTER_CACHE,sites);
c.openRelatedSite('');c.openRelatedSite('없는 이름');assert.equal(opened.length,1);assert.equal(warnings.length,3);
console.log('Related site navigation: ambiguous/unknown names do not navigate, unique historical alias opens correctly');
