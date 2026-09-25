'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
function fixture(patch={}){
 const ctx={itemPatch:()=>patch,esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')};vm.createContext(ctx);
 for(const name of ['siteActivityTitle','repManagerRecent','repManagerActivity'])vm.runInContext(source.match(new RegExp('^function '+name+'\\(.*$','m'))[0],ctx);
 return ctx;
}
test('rep recent activity uses shared labels and preserves both original sources',()=>{
 const patch={activities:[{type:'assignment_changed',at:'2026-09-16',note:'담당 변경'}]},r={deals:[{site:'합성 현장',activities:[{type:'next_action_set',at:'2026-09-15',note:'재통화'},{type:'next_action_completed',at:'2026-09-14'}]}]};
 const before=JSON.stringify({patch,r}),rows=fixture(patch).repManagerRecent(r);
 assert.deepEqual(Array.from(rows,x=>x.type),['담당자 변경','다음 할 일 등록','다음 할 일 완료']);
 assert.equal(JSON.stringify({patch,r}),before);
});
test('rep renderer escapes original content and uses translated activity',()=>{
 const r={deals:[{site:'<b>현장</b>',activities:[{type:'next_action_set',at:'2026-09-15',note:'<img src=x>'}]}],weekNew:1,weekTracked:false,weekCompete:0,weekBid:0,weekWon:0};
 const html=fixture().repManagerActivity(r,0);
 assert.ok(html.includes('다음 할 일 등록'));assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(html.includes('&lt;b&gt;현장&lt;/b&gt;'));assert.ok(!html.includes('next_action_set'));
});
test('empty history, sorting and five-row limit remain unchanged',()=>{
 const f=fixture();assert.equal(f.repManagerRecent({deals:[]}).length,0);
 const rows=f.repManagerRecent({deals:[{activities:Array.from({length:7},(_,i)=>({type:'전화',at:'2026-09-'+String(10+i).padStart(2,'0')}))}]});
 assert.equal(rows.length,5);assert.equal(rows[0].at,'2026-09-16');assert.equal(rows[4].at,'2026-09-12');assert.equal(rows[0].type,'전화');
});
