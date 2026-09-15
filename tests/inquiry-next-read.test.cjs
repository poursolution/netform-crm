'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const overlay=require('../operational-overlay.js');
const html=fs.readFileSync(require('node:path').join(__dirname,'../crm.html'),'utf8');
const ctx={repN:x=>x};vm.createContext(ctx);
vm.runInContext(html.split(/\r?\n/).find(x=>x.startsWith('function actionObj(')),ctx);
const next={id:'action-1',type:'전화',text:'도면 수신 확인',due_at:'2026-09-18',assignee:'테스트 담당',status:'open'};
const loaded=q=>overlay.shell({inquiries:[{id:'inquiry-1',...q}]}).inquiries[0];
test('server instant uses KST calendar date without changing original instant',()=>{
 for(const due of ['2026-09-22T15:00:00.000Z','2026-09-23T00:00:00+09:00']){
  const q=loaded({next_action:{...next,due,due_at:due}}),before=JSON.stringify(q),a=ctx.actionObj(q,{});
  assert.equal(a.due,'2026-09-23');assert.equal(a.due_at,due);assert.equal(JSON.stringify(q),before);
 }
});
test('PC reads server inquiry Next after shell reload without losing ID or content',()=>{
 const q=loaded({next_action:next,next_action_date:'2026-09-20'}),before=JSON.stringify(q);
 const a=ctx.actionObj(q,{});
 assert.equal(a.id,next.id);assert.equal(a.text,next.text);assert.equal(a.due,'2026-09-18');
 assert.equal(a.assignee,next.assignee);assert.equal(JSON.stringify(q),before);
});
test('an acknowledged UI Next still takes precedence over an older server projection',()=>{
 const q=loaded({next_action:next});q.nextActionObj={...next,id:'action-2',due:'2026-09-22'};
 assert.equal(ctx.actionObj(q,{}).id,'action-2');
 assert.equal(ctx.actionObj(q,{nextActionObj:{...q.nextActionObj,id:'action-3'}}).id,'action-3');
});
test('completed or cancelled actions cannot resurrect from scalar date aliases',()=>{
 for(const status of ['completed','cancelled']){
  assert.equal(ctx.actionObj(loaded({next_action:{...next,status},next_action_date:'2026-09-20'}),{}),null);
  assert.equal(ctx.actionObj({nextActionObj:{...next,status},nextActionDate:'2026-09-20'},{}),null);
 }
});
test('date-only legacy followup stays date-only, without inventing a persisted action ID',()=>{
 const a=ctx.actionObj(loaded({next_action:null,next_action_date:'2026-09-20'}),{});
 assert.equal(a.due,'2026-09-20');assert.equal(a.id,undefined);
});
test('no task and no scalar schedule remains empty',()=>{
 assert.equal(ctx.actionObj(loaded({next_action:null}),{}),null);
});
test('cleared UI action does not fall back to a stale pre-completion server object',()=>{
 const q=loaded({next_action:next});q.nextActionObj=null;q.nextAction=null;q.nextActionText='';
 assert.equal(ctx.actionObj(q,{}),null);
 assert.equal(ctx.actionObj(loaded({next_action:next}),{nextActionObj:null}),null);
});
