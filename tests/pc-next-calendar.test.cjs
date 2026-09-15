'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Tests the PC reader alone: no candidate overlay, adapter or DB dependency.
const html=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8'),ctx={repN:x=>x};vm.createContext(ctx);
vm.runInContext(html.split(/\r?\n/).find(x=>x.startsWith('function actionObj(')),ctx);
const read=x=>ctx.actionObj({next_action:{id:'a',text:'확인',status:'open',due_at:x}},{});
test('KST boundaries include previous day, new year and leap day',()=>{
 for(const [instant,date] of [['2026-09-22T14:59:59Z','2026-09-22'],['2026-09-22T15:00:00Z','2026-09-23'],['2026-12-31T15:00:00Z','2027-01-01'],['2028-02-28T15:00:00Z','2028-02-29'],['2026-09-22T08:00:00-07:00','2026-09-23']])assert.equal(read(instant).due,date);
});
test('date-only, empty and invalid values are not inferred into another date',()=>{
 for(const value of ['2026-09-23','','not-a-date','2026-09-23T00:00:00'])assert.equal(read(value).due,value);
});
test('source ID, content, instant and object remain intact',()=>{
 const q={next_action:{id:'action-a',text:'고객 확인',assignee:'담당자',status:'open',due_at:'2026-09-22T15:00:00Z'}},before=JSON.stringify(q),r=ctx.actionObj(q,{});
 assert.equal(r.id,'action-a');assert.equal(r.text,'고객 확인');assert.equal(r.assignee,'담당자');assert.equal(r.due_at,q.next_action.due_at);assert.equal(JSON.stringify(q),before);
});
test('closed tasks remain closed and acknowledged local objects retain priority',()=>{
 for(const status of ['completed','cancelled'])assert.equal(ctx.actionObj({next_action:{status,due_at:'2026-09-22T15:00:00Z'}},{}),null);
 const local={id:'new',due:'2026-10-01',status:'open'};
 assert.equal(ctx.actionObj({next_action:{id:'old',due_at:'2026-09-22T15:00:00Z'}},{nextActionObj:local}),local);
});
