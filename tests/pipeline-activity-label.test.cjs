'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
function render(activities,amounts={}){
 const ctx={itemPatch:()=>({}),priorityInfo:()=>({}),actionObj:()=>null,contactInfo:()=>({}),dealKey:()=> 'test',repN:()=>'',stageNoLabel:()=>'',dealStage:()=>'',constructionYearOf:()=> '미입력',fmtAmt:x=>String(x)+'원',oppAmt:d=>Number(d.amt||0),quoteAmt:d=>Number(d.quoteAmt||0),splitInlinePanel:()=>'',esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')};
 vm.createContext(ctx);
 vm.runInContext(source.match(/^function siteActivityTitle\(type\).*$/m)[0]+'\n'+source.slice(source.indexOf('function quickPanelHTML(d){'),source.indexOf(' function selectSplitDeal(el){')),ctx);
 return ctx.quickPanelHTML({site:'합성 현장',activities,...amounts});
}
test('quick panel maps system activity names without changing records',()=>{
 const rows=[{type:'next_action_set',at:'2026-09-16'},{type:'next_action_completed',at:'2026-09-15'},{type:'assignment_changed',at:'2026-09-14'}],before=JSON.stringify(rows);
 const html=render(rows);for(const label of ['다음 일정 등록','다음 행동 완료','담당자 변경'])assert.ok(html.includes(label));
 assert.doesNotMatch(html,/next_action_set|next_action_completed|assignment_changed/);assert.equal(JSON.stringify(rows),before);
});
test('user note retains priority and remains escaped',()=>{
 const html=render([{type:'next_action_set',note:'<b>고객 요청</b>',result:'<img src=x>',at:'2026-09-16'}]);
 assert.ok(html.includes('&lt;b&gt;고객 요청&lt;/b&gt;'));assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(!html.includes('다음 일정 등록'));
});
test('empty history and existing Korean labels retain their display',()=>{
 assert.ok(render([]).includes('최근 활동이 없습니다'));
 assert.ok(render([{type:'전화',at:'2026-09-16'}]).includes('<b>전화</b>'));
});
test('quick panel never substitutes quote or contract for missing opportunity amount',()=>{
 for(const amounts of [{quoteAmt:900000},{wonAmt:800000},{amt:0,quoteAmt:900000},{}]){
  const before=JSON.stringify(amounts),html=render([],amounts);
  assert.ok(html.includes('<strong>예상금액 · 미입력</strong>'));assert.ok(!html.includes('900000원'));assert.equal(JSON.stringify(amounts),before);
 }
 assert.ok(render([],{amt:700000,quoteAmt:900000,wonAmt:800000}).includes('<strong>예상금액 · 700000원</strong>'));
});
