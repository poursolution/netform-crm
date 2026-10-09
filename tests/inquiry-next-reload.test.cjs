'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(dir,'inquiry-assignment-clarity.js'),'utf8');
const html=fs.readFileSync(path.join(dir,'crm.html'),'utf8');
const ID='10000000-0000-4000-8000-000000000001';
const old={id:'20000000-0000-4000-8000-000000000002',type:'전화',text:'예전 확인 업무',due:'2026-10-09',status:'open'};
const fresh={...old,text:'서버에서 변경한 업무',due:'2026-10-12',due_at:'2026-10-11T15:00:00Z'};
function runtime(queue=[]){
 const c={window:null,repN:x=>x,Phase1:{queue:{list:()=>queue}}};c.window=c;vm.createContext(c);
 vm.runInContext(source.slice(0,source.indexOf(' function assignmentHistory(q)'))+'})(window);',c);
 vm.runInContext(html.split(/\r?\n/).find(x=>x.startsWith('function actionObj(')),c);
 return c;
}
function merge(c,next,patch,extra={}){
 const q={id:ID,assigned_to:'owner',assignee_name:'담당',next_action:next,next_action_date:next?.due||null,...extra};
 if(c.reconcileInquiryNextTruth)c.reconcileInquiryNextTruth(q,patch,ID);
 c.mergeInquiryAssignmentTruth(q,patch,ID);return {q,action:c.actionObj(q,patch)};
}
test('fresh server task replaces an acknowledged local snapshot after reload',()=>{
 const c=runtime(),patch={nextActionObj:{...old},memoDraft:'작성 내용',memoReview:{promises:{}}};
 const {action}=merge(c,fresh,patch);
 assert.equal(action.text,fresh.text);assert.equal(action.due,'2026-10-12');
 assert.equal(patch.memoDraft,'작성 내용');assert.deepEqual(patch.recoveredNextActionDraft.nextActionObj,old);
 assert.equal(patch.nextActionObj,undefined);
});
test('server completion cannot resurrect a local open task or old date',()=>{
 const c=runtime(),patch={nextActionObj:{...old},nextAction:old.due,nextActionText:old.text,nextActionDate:old.due,next_action_date:old.due,due:old.due};
 const {action}=merge(c,null,patch);assert.equal(action,null);
 assert.equal(patch.recoveredNextActionDraft.nextAction,old.due);
});
test('local null cannot hide a new server task',()=>{
 const {action}=merge(runtime(),fresh,{nextActionObj:null,nextAction:null,nextActionText:''});
 assert.equal(action.id,fresh.id);assert.equal(action.text,fresh.text);
});
test('live or uncertain same-inquiry requests preserve local work for reconciliation',()=>{
 for(const status of ['pending','queued','sending','processing','uncertain']){
  const patch={nextActionObj:{...old}};
  const {action}=merge(runtime([{object_id:ID,status,operation:'next_action'}]),fresh,patch);
  assert.equal(action.text,old.text);assert.equal(patch.recoveredNextActionDraft,undefined);
 }
});
test('other inquiry pending work and rejected requests do not mask fresh truth',()=>{
 for(const queue of [[{object_id:'other',status:'pending'}],[{object_id:ID,status:'rejected'}]]){
  const {action}=merge(runtime(queue),fresh,{nextActionObj:{...old}});assert.equal(action.text,fresh.text);
 }
});
test('missing projection and synthetic inquiries preserve legacy patches',()=>{
 const c=runtime();for(const q of [{id:ID},{id:'local-inquiry',next_action:fresh}]){
  const p={nextActionObj:{...old}};c.reconcileInquiryNextTruth(q,p,q.id);c.mergeInquiryAssignmentTruth(q,p,q.id);assert.equal(c.actionObj(q,p).text,old.text);
 }
});
test('fresh date-only followup remains ID-less and uses the server date',()=>{
 const {action}=merge(runtime(),null,{nextActionObj:{...old}},{next_action_date:'2026-11-01',nextActionDate:'2026-11-01'});
 assert.equal(action.id,undefined);assert.equal(action.due,'2026-11-01');
});
test('a read started before a newer ACK cannot erase the acknowledged patch',()=>{
 const c=runtime([{object_id:ID,status:'done',ack:{server_at:'2026-10-10T02:01:00Z'}}]);
 c.B={generated_at:'2026-10-10T02:00:00Z'};
 assert.equal(merge(c,fresh,{nextActionObj:{...old}}).action.text,old.text);
 c.B.generated_at='2026-10-10T02:02:00Z';
 assert.equal(merge(c,fresh,{nextActionObj:{...old}}).action.text,fresh.text);
});
test('queue inspection failure or malformed task does not discard a draft',()=>{
 const c=runtime();c.Phase1.queue.list=()=>{throw Error('queue unavailable')};
 assert.equal(merge(c,fresh,{nextActionObj:{...old}}).action.text,old.text);
 const d=runtime();assert.equal(merge(d,{}, {nextActionObj:{...old}}).action.text,old.text);
});
test('actual applyOverrides persists recovery and consumers read the same task',()=>{
 const c=runtime();let saved=0;
 c.LOCAL={deals:{},inquiries:{[ID]:{nextActionObj:{...old},noteDraft:'작성 중'}}};
 c.B={deals:[],inquiries:[{id:ID,next_action:fresh}]};
 c.loadLocal=()=>{};c.migrateDealKeys=()=>{};c.inqKey=q=>q.id;c.saveLocal=()=>{saved++};
 vm.runInContext(html.slice(html.indexOf('function applyOverrides(){'),html.indexOf('function inPeriod(')),c);
 c.applyOverrides();assert.equal(saved,1);assert.equal(c.LOCAL.inquiries[ID].noteDraft,'작성 중');
 assert.equal(c.actionObj(c.B.inquiries[0],c.LOCAL.inquiries[ID]).text,fresh.text);
 c.applyOverrides();assert.equal(saved,1);
});
