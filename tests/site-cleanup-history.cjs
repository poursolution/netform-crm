const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const c={CleanupCore:{},B:{cleanup_events:[]}};c.window=c;vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../data-cleanup-ui.js'),'utf8'),c);
const s={key:'id:s1',names:{동명아파트:1},deals:[{id:'d1',organization_id:'o1'}],inquiries:[{id:'q1'}]};
const base={source_name:'동명아파트',target_name:'다른 이름',action:'site_link',created_at:'2024-01-01',note:'원본 메모',actor:'작성자'};
function run(patch){c.B.cleanup_events=[{...base,...patch}];const before=JSON.stringify(c.B),result=c.DataCleanupUI.historyFor(s);assert.equal(JSON.stringify(c.B),before);return result;}
assert.equal(run({source:{type:'deal',id:'d1'}}).length,1);
assert.equal(run({source:{type:'deal',id:'other'}}).length,0,'Same name cannot override a foreign ID');
assert.equal(run({target:{type:'inquiry',id:'q1'},source_name:'이전 이름'}).length,1);
assert.equal(run({source:{type:'inquiry',id:'d1'}}).length,0,'Entity namespaces remain distinct');
assert.equal(run({source:{type:'organization',id:'o1'}}).length,1);
assert.equal(run({source:{type:'organization',id:'s1'}}).length,0,'Site ID is not an organization ID');
assert.equal(run({source:{type:'deal',id:''}}).length,0,'Malformed explicit ref cannot fall back to name');
assert.equal(run({source:{type:'unknown',id:'d1'}}).length,0);
const legacy=run({});assert.equal(legacy.length,1);assert.ok(legacy[0].title.includes('현장 연결 확인 필요'));assert.equal(legacy[0].at,'2024-01-01');assert.ok(legacy[0].sub.includes('원본 메모'));
assert.equal(run({source_name:'toString',target_name:'다른 이름'}).length,0);
assert.equal(run({source:{type:'deal',id:'other'},target:{type:'deal',id:'d1'},move_date:'2023-01-01'})[0].at,'2023-01-01');
console.log('Cleanup history: typed references, name collisions, malformed refs, legacy uncertainty, occurrence dates and no mutation passed');
