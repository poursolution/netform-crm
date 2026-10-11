'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const base=path.join(__dirname,'..'),detail=fs.readFileSync(path.join(base,'deal-detail-v3.js'),'utf8'),overlay=fs.readFileSync(path.join(base,'operational-overlay.js'),'utf8');
const adapter=require('../operational-adapter');
function segment(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'production function boundary exists');return source.slice(a,b);}
const writeSource=segment(detail,' async function confirmOp',' async function saveRec(d)');
const draftSource=segment(detail,' function contactDraft','\n const toast=');
const journalSource=segment(overlay,"  const journalPrefix='crm:mobile-save:v1:';",'  function versionFor');
function rig(){
 const storage=new Map(),events=new Map(),rows=[],controls={status:'uncertain',quota:false,hold:false,release:null,badAck:false,begin:0,finish:0};
 const listeners=(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);};
 const task={id:crypto.randomUUID(),text:'고객 약속: 견적 확인',type:'전화',due_at:'2026-11-20',status:'open'};
 const d={id:crypto.randomUUID(),version:4,activities:[],nextActionObj:task,nextAction:task};
 const root={G:{},ME:{name:'합성 담당자'},repN:x=>x,dealStage:()=> 'consulting',actionObj:x=>x.nextActionObj,
  addEventListener:listeners,Phase1:{profile:{auth_uid:crypto.randomUUID(),user_id:crypto.randomUUID()}},OperationalAdapter:adapter,
  sessionStorage:{get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)||null,setItem(k,v){if(controls.quota)throw Error('quota');storage.set(k,v);},removeItem:k=>storage.delete(k)},
  ScheduleFlow:{enabled:()=>true,async begin(){controls.begin++;},async finish(){controls.finish++;throw Error('unexpected schedule write');}}};
 root.Phase1.queue={list:()=>rows,async flush(){if(controls.hold)await new Promise(r=>controls.release=r);for(const row of rows){row.status=controls.status;if(controls.status==='done')row.ack=controls.badAck?{ok:true}:ack(row);}}};
 root.queueDetailContactOperation=(operation,payload,actionId)=>{assert.equal(operation,'activity','keep/none must never complete or replace a schedule');const row={operation,payload:structuredClone(payload),actionId,request_id:crypto.randomUUID(),object_id:d.id,expected_version:4,auth_uid:root.Phase1.profile.auth_uid,user_id:root.Phase1.profile.user_id,status:'pending'};rows.push(row);return row.request_id;};
 function ack(q){return {contract_version:1,ok:true,operation:q.operation,request_id:q.request_id,object_id:q.object_id,replayed:false,actor_auth_uid:q.auth_uid,actor_user_id:q.user_id,previous_version:4,version:5,activity_id:q.activityId||(q.activityId=crypto.randomUUID()),audit_event_id:crypto.randomUUID(),meaningful_contact:true,occurred_at:q.payload.occurred_at};}
 const context={window:root,console,Date};
 vm.runInNewContext("const root=window,UUID=/^[0-9a-f-]{36}$/i,patchOf=d=>d,exOf=d=>d.nextActionObj,error=code=>Error(code);"+journalSource+writeSource+draftSource+';root.__contactTest={writeContact,contactDraft};',context);
 const input={ch:'전화',res:'연결됨',memo:'기존 고객 약속은 유지합니다',mode:'keep'};
 function command(P={},options={}){P.owner=P.owner||root.MobileSaveJournal.owner();return {P,ch:'전화',note:'[전화 · 연결됨] '+input.memo,at:'2026-10-11T01:00:00.000Z',meaningful:true,next:null,due:'',keepCurrent:true,schedulePlan:{ok:true,mode:'keep',scheduleV1:true},existing:structuredClone(task),input:structuredClone(input),...options};}
 return {root,d,task,rows,controls,storage,input,command,run:c=>root.__contactTest.writeContact(d,c),reopen:()=>root.__contactTest.contactDraft(d),read:()=>root.MobileSaveJournal.read('pc_contact',d.id),emit:type=>(events.get(type)||[]).forEach(fn=>fn()),snapshot:()=>JSON.parse(JSON.stringify(d))};
}
test('keep uncertain -> close/reopen preserves input and retries the exact activity once',async()=>{
 const r=rig(),before=structuredClone(r.task),c=r.command();await assert.rejects(r.run(c),/서버 확인 대기/);
 assert.equal(r.rows.length,1);assert.equal(r.d.activities.length,0);assert.deepEqual(r.task,before);
 const first=structuredClone(r.rows[0]),recovered=r.reopen();assert.equal(recovered.memo,r.input.memo);assert.equal(recovered.prog.act,first.request_id);
 r.controls.status='done';await r.run(r.command(recovered.prog,{input:recovered}));
 assert.equal(r.rows.length,1);assert.equal(r.rows[0].request_id,first.request_id);assert.deepEqual(r.rows[0].payload,first.payload);assert.equal(r.d.activities.length,1);assert.equal(r.read(),null);assert.equal(r.controls.begin,0);assert.equal(r.controls.finish,0);assert.deepEqual(r.task,before);
});
test('none also journals partial contact and leaves the existing task open',async()=>{
 const r=rig(),before=structuredClone(r.task),c=r.command({}, {schedulePlan:{ok:true,mode:'none',scheduleV1:true},input:{...r.input,mode:'none',reason:'고객 검토 중'}});
 await assert.rejects(r.run(c),/서버 확인 대기/);assert.equal(r.reopen().reason,'고객 검토 중');r.controls.status='done';const recovered=r.reopen();await r.run({...c,P:recovered.prog,input:recovered});assert.equal(r.rows.length,1);assert.equal(r.d.activities.length,1);assert.deepEqual(r.task,before);assert.equal(r.read(),null);
});
test('wrong ACK preserves journal and blocks local contact/schedule projection',async()=>{
 const r=rig(),before=r.snapshot();r.controls.status='done';r.controls.badAck=true;await assert.rejects(r.run(r.command()),/ACK_CONTRACT_MISMATCH/);assert.deepEqual(r.snapshot(),before);assert(r.read().progress.act);assert.equal(r.rows.length,1);
});
test('storage failure before queueing preserves inputs and sends no activity',async()=>{
 const r=rig(),c=r.command();r.controls.quota=true;await assert.rejects(r.run(c),/보관하지 못/);assert.equal(r.rows.length,0);assert.equal(r.d.activities.length,0);assert.equal(c.input.memo,r.input.memo);
});
test('owner replacement while ACK pending cannot project the old contact or remove its journal',async()=>{
 const r=rig(),before=r.snapshot();r.controls.status='done';r.controls.hold=true;const pending=r.run(r.command());assert(r.controls.release);const saved=[...r.storage.entries()];r.root.Phase1.profile={auth_uid:crypto.randomUUID(),user_id:crypto.randomUUID()};r.controls.release();await assert.rejects(pending,/로그인 계정/);assert.deepEqual(r.snapshot(),before);assert.deepEqual([...r.storage.entries()],saved);assert.equal(r.reopen().memo,'');
});
test('same auth/user identity-cleared epoch rejects a late ACK before projection',async()=>{
 const r=rig(),before=r.snapshot(),profile={...r.root.Phase1.profile};r.controls.status='done';r.controls.hold=true;const pending=r.run(r.command());r.emit('phase1:identity-cleared');Object.assign(r.root.Phase1.profile,profile);r.controls.release();await assert.rejects(pending,/로그인 상태/);assert.deepEqual(r.snapshot(),before);assert.equal(r.storage.size,0);assert.equal(r.rows.length,1);
});
test('legacy record caller keeps original schedule and recovers same ID through the common journal',async()=>{
 const r=rig(),before=structuredClone(r.task),c=r.command();delete c.schedulePlan;delete c.input;delete c.existing;
 await assert.rejects(r.run(c),/서버 확인 대기/);assert(r.read().progress.legacySignature);assert.equal(r.reopen().recoveryOnly,true);assert.match(r.reopen().recoveryError,/원래 입력 화면/);
 r.controls.status='done';await r.run({...c,P:{}});assert.equal(r.rows.length,1);assert.equal(r.d.activities.length,1);assert.deepEqual(r.task,before);assert.equal(r.read(),null);
});
test('legacy retry with changed input cannot replace its pending request or evidence',async()=>{
 const r=rig(),c=r.command();delete c.schedulePlan;delete c.input;await assert.rejects(r.run(c),/서버 확인 대기/);const saved=[...r.storage.entries()];await assert.rejects(r.run({...c,P:{},note:'새로 바꾼 메모'}),/원래 입력 화면/);assert.equal(r.rows.length,1);assert.deepEqual([...r.storage.entries()],saved);assert.equal(r.d.activities.length,0);
});
