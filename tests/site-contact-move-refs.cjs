const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const c={CleanupCore:{phone:s=>String(s||'').replace(/\D/g,'')},B:{}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../data-cleanup-ui.js'),'utf8'),c);
const site=id=>({key:'id:'+id,names:{동명:1},deals:[{id}],inquiries:[]});
const move={source:{type:'deal',id:'a'},target:{type:'deal',id:'b'},person_key:'mobile:01012345678',from_site:'동명',to_site:'동명',moved_on:'2024-05-01'};
const contact={mobile:'010-1234-5678',current:true,currentSite:'원본',from:'2023-01-01',to:''};
function run(s,patch={},person=contact){c.B.cleanup_moves=[{...move,...patch}];const before=JSON.stringify(c.B),out=c.DataCleanupUI.projectContacts(s,[{...person}])[0];assert.equal(JSON.stringify(c.B),before,'Original move records unchanged');return out;}
let out=run(site('a'));assert.equal(out.current,false);assert.equal(out.to,'2024-05-01');assert.equal(out.from,'2023-01-01');
out=run(site('b'));assert.equal(out.current,true);assert.equal(out.from,'2024-05-01');
assert.deepEqual(run(site('other')),contact,'Same-name third site is untouched');
assert.deepEqual(run(site('a'),{source:null,target:null}),contact,'Legacy name-only move is not authoritative');
assert.deepEqual(run(site('a'),{source:{type:'unknown',id:'a'}}),contact);
assert.deepEqual(run(site('a'),{moved_on:''}),contact);
assert.deepEqual(run({names:{동명:1},deals:[{id:'a'},{id:'b'}]}),contact,'Both refs in one grouped site require review');
const empty={...contact,mobile:''};assert.deepEqual(run(site('a'),{person_key:'mobile:'},empty),empty);
assert.deepEqual(run(site('a'),{target:{type:'inquiry',id:'a'},source:{type:'deal',id:'other'}}),contact,'Do not confuse inquiry and deal IDs');
console.log('Contact move projection: exact endpoint refs, same-name isolation, uncertain/empty-phone guards and original move preservation passed');
c.B.cleanup_moves=[move,{...move,source:{type:'deal',id:'b'},target:{type:'deal',id:'c'},to_site:'세 번째 현장',moved_on:'2025-01-01'}];
out=c.DataCleanupUI.projectContacts(site('a'),[{...contact}])[0];assert.equal(out.current,false);assert.equal(out.to,'2024-05-01');assert.equal(out.currentSite,'세 번째 현장');
out=c.DataCleanupUI.projectContacts(site('b'),[{...contact}])[0];assert.equal(out.from,'2024-05-01');assert.equal(out.to,'2025-01-01');assert.equal(out.current,false);
out=c.DataCleanupUI.projectContacts(site('c'),[{...contact,to:'old'}])[0];assert.equal(out.current,true);assert.equal(out.from,'2025-01-01');assert.equal(out.to,'');
console.log('Multi-step moves retain each site tenure and latest destination; arrival clears stale departure');
const conflicting={...move,target:{type:'deal',id:'c'},to_site:'다른 도착지'};
for(const rows of [[move,conflicting],[conflicting,move]]){
 c.B.cleanup_moves=rows;const before=JSON.stringify(rows);
 for(const id of ['a','b','c'])assert.deepEqual(c.DataCleanupUI.projectContacts(site(id),[{...contact}])[0],contact,'Same-day ambiguity must not depend on response order');
 assert.equal(JSON.stringify(rows),before);
}
c.B.cleanup_moves=[move,{...move,id:'duplicate-copy'}];
assert.equal(c.DataCleanupUI.projectContacts(site('a'),[{...contact}])[0].current,false,'Identical duplicate moves are not a conflict');
c.B.cleanup_moves=[move,{...conflicting,person_key:'mobile:01099999999'}];
assert.equal(c.DataCleanupUI.projectContacts(site('a'),[{...contact}])[0].current,false,'Other people do not block this contact');
c.B.cleanup_moves=[move,conflicting,{...move,moved_on:'2025-01-01'}];
assert.deepEqual(c.DataCleanupUI.projectContacts(site('a'),[{...contact}])[0],contact,'Later record does not silently resolve an earlier tenure conflict');
console.log('Same-day conflicts: order-independent preservation, identical duplicate tolerance and per-person isolation passed');
