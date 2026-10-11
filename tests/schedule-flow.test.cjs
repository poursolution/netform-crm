const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const contract=require('../schedule-contract'),flow=require('../schedule-flow'),CE=require('../contact-entry');
function fixture(count=1){
 const id=randomUUID(),uid=randomUUID(),rows=Array.from({length:count},(_,i)=>({id:randomUUID(),title:'업무 '+i,action_type:'전화',status:'open',due_on:'2026-10-25',due_at:'2026-10-24T15:00:00Z',date_basis:'unconfirmed'}));
 let version=1,serial=1,owner=uid,failAfter=false,failRefresh=false;const events=new Map(),writes=[],pages=[],stored=[];
 const root={crypto:{randomUUID},CRM_SCHEDULE_V1:true,CRMRelease:{has:()=>true},Phase1:{profile:{auth_uid:uid,user_id:uid}},addEventListener:()=>{}};
 const token=()=>serial.toString(16).padStart(32,'0');
 root.Phase1.rpc=async(name,{p})=>{
  if(name==='crm_schedule_list_v1'){
   if(failRefresh){failRefresh=false;throw Error('refresh lost');}pages.push(p.page);
   return {ok:true,contract:'crm.schedule.v1',target_type:'deal',target_id:id,enabled:true,writable:true,version,token:token(),owner_id:owner,actor_auth_uid:uid,actor_user_id:uid,page:p.page,per:20,total:rows.length,items:structuredClone(rows.slice((p.page-1)*20,p.page*20))};
  }
  if(name==='crm_schedule_receipt_v1')return {ok:true,contract:'crm.schedule.v1',request_id:p.request_id,found:events.has(p.request_id),ack:events.get(p.request_id)||null};
  writes.push(structuredClone(p));assert.equal(p.expected_token,token());let row;
  if(p.operation==='reschedule')row=rows.find(r=>r.id===p.action_id);
  else{row={id:randomUUID(),title:p.title,action_type:p.action_type,status:'open'};rows.push(row);}
  row.due_on=p.due_on;row.due_at=p.due_on+'T00:00:00+09:00';row.date_basis=p.date_basis;version++;serial++;
  const ack={ok:true,contract:'crm.schedule.v1',target_type:'deal',target_id:id,request_id:p.request_id,operation:p.operation,actor_auth_uid:uid,actor_user_id:uid,due_on:p.due_on,date_basis:p.date_basis,action_id:row.id,event_id:randomUUID(),action_status:'open',after:{id:row.id,deal_id:id,status:'open',completed_at:null,due_at:row.due_at},token:token(),cancelled_action_ids:[],completed_action_ids:[]};events.set(p.request_id,ack);
  if(failAfter){failAfter=false;throw Error('response lost');}return ack;
 };
 root.ScheduleContract=contract(root);const api=flow(root),d={id,version},progress={},existing=rows[0]?{id:rows[0].id,text:rows[0].title,due:rows[0].due_on}:null;
 const plan={next:{type:'후속접촉',text:'견적 발송',due:'2026-10-26',plan:'internal'}};
 const persist=()=>stored.push(structuredClone(progress));
 return {root,api,d,progress,existing,plan,rows,writes,pages,stored,events,persist,
  activity(){const previous_version=version;version++;serial++;return {ok:true,operation:'activity',object_id:id,actor_auth_uid:uid,actor_user_id:uid,previous_version,version};},
  mutate(){rows[0].title='다른 사람이 바꿈';serial++;},reassign(){owner=randomUUID();serial++;},loseResponse(){failAfter=true;},loseRefresh(){failRefresh=true;}};
}
test('reads every page before saving and preserves all 23 existing tasks',async()=>{const f=fixture(23);await f.api.begin(f.d,f.plan,f.existing,f.progress,f.persist);assert.deepEqual(f.pages,[1,2]);const ack=f.activity();await f.api.finish(f.d,f.progress,ack,f.persist);assert.equal(f.rows.length,24);assert(f.rows.every(x=>x.status==='open'));assert.equal(f.writes.length,1);});
test('a later unrelated activity cannot be mistaken for this save',async()=>{const f=fixture();await f.api.begin(f.d,f.plan,f.existing,f.progress,f.persist);const ack=f.activity();f.activity();await assert.rejects(()=>f.api.finish(f.d,f.progress,ack,f.persist),/STALE/);assert.equal(f.writes.length,0);});
test('task edits and reassignment block the second write',async()=>{for(const mutate of ['mutate','reassign']){const f=fixture();await f.api.begin(f.d,f.plan,f.existing,f.progress,f.persist);const ack=f.activity();f[mutate]();await assert.rejects(()=>f.api.finish(f.d,f.progress,ack,f.persist),/STALE/);assert.equal(f.writes.length,0);}});
test('lost save response recovers receipt without a second insert',async()=>{const f=fixture();await f.api.begin(f.d,f.plan,f.existing,f.progress,f.persist);const ack=f.activity();f.loseResponse();await assert.rejects(()=>f.api.finish(f.d,f.progress,ack,f.persist),/response lost/);const restored=structuredClone(f.stored.at(-1));await f.api.finish(f.d,restored,ack,f.persist);assert.equal(f.rows.length,2);assert.equal(f.writes.length,1);});
test('missing receipt after a known successful ACK never repeats the command',async()=>{const f=fixture();await f.api.begin(f.d,f.plan,f.existing,f.progress,f.persist);const ack=f.activity();await f.api.finish(f.d,f.progress,ack,f.persist);f.events.clear();await assert.rejects(()=>f.api.finish(f.d,f.progress,ack,f.persist),/RECEIPT_MISSING/);assert.equal(f.writes.length,1);});
test('direct reschedule keeps the ID and records internal change, not customer agreement',async()=>{const f=fixture(),plan={change:{id:f.existing.id,due:'2026-10-20',reason:'내부 준비 일정 조정'}};await f.api.begin(f.d,plan,f.existing,f.progress,f.persist);const result=await f.api.finish(f.d,f.progress,null,f.persist);const patch={};f.api.project(f.d,result,patch);assert.equal(f.d.nextActionObj.id,f.existing.id);assert.equal(f.rows.length,1);assert.equal(f.writes[0].date_basis,'internal_plan');assert.equal(patch.version,2);});
test('unknown UI version or hidden existing task blocks before activity',async()=>{for(const kind of ['version','task']){const f=fixture();if(kind==='version')delete f.d.version;await assert.rejects(()=>f.api.begin(f.d,f.plan,kind==='task'?null:f.existing,f.progress,f.persist),/STALE/);assert.equal(f.writes.length,0);}});
test('unavailable durable storage blocks before activity',async()=>{const f=fixture();await assert.rejects(()=>f.api.begin(f.d,f.plan,f.existing,f.progress,()=>{throw Error('quota')}),/quota/);assert.equal(f.writes.length,0);});
test('customer promise is preserved until evidence-based re-agreement exists',async()=>{const f=fixture();f.rows[0].date_basis='customer_agreed';await assert.rejects(()=>f.api.begin(f.d,{change:{id:f.existing.id,due:'2026-10-20',reason:'내부 일정'}},f.existing,f.progress,f.persist),/재합의/);assert.equal(f.writes.length,0);assert.equal(f.progress.schedule,undefined);});
test('account switch cannot reuse an old prepared request',async()=>{const f=fixture();await f.api.begin(f.d,f.plan,f.existing,f.progress,f.persist);const ack=f.activity();f.loseResponse();await assert.rejects(()=>f.api.finish(f.d,f.progress,ack,f.persist));f.root.Phase1.profile={auth_uid:randomUUID(),user_id:randomUUID()};await assert.rejects(()=>f.api.finish(f.d,f.progress,ack,f.persist),/IDENTITY_CHANGED/);assert.equal(f.writes.length,1);});
test('restored context validates identity and durable storage before any new activity',async()=>{const f=fixture();await f.api.begin(f.d,f.plan,f.existing,f.progress,f.persist);await assert.rejects(()=>f.api.begin(f.d,f.plan,f.existing,f.progress,()=>{throw Error('quota')}),/quota/);f.root.Phase1.profile={auth_uid:randomUUID(),user_id:randomUUID()};await assert.rejects(()=>f.api.begin(f.d,f.plan,f.existing,f.progress,f.persist),/IDENTITY_CHANGED/);assert.equal(f.writes.length,0);});
test('gate permits explicit new task or earlier date only with a reason',()=>{const ex={id:randomUUID(),text:'통화',due:'2026-10-25'},ctx={today:'2026-10-11',existing:ex,scheduleV1:true};const x={res:'연결됨',ch:'전화',memo:'검토',mode:'change',date:'2026-10-11'};assert.equal(CE.plan(x,ctx).ok,false);const p=CE.plan({...x,reason:'내부 일정 조정'},ctx);assert.equal(p.ok,true);assert.equal(p.completeCurrent,false);const n=CE.plan({...x,mode:'new',purpose:'견적 발송',date:'2026-10-26'},ctx);assert.equal(n.ok,true);assert.equal(n.completeCurrent,false);});
test('session invalidated during receipt prevents a new schedule write',async()=>{
 const f=fixture();let valid=true;const persist=()=>{if(!valid)throw Error('SESSION_ENDED');f.persist();};
 await f.api.begin(f.d,f.plan,f.existing,f.progress,persist);const ack=f.activity(),rpc=f.root.Phase1.rpc;
 f.root.Phase1.rpc=async(name,args)=>{const r=await rpc(name,args);if(name==='crm_schedule_receipt_v1')valid=false;return r;};
 await assert.rejects(()=>f.api.finish(f.d,f.progress,ack,persist),/SESSION_ENDED/);assert.equal(f.writes.length,0);
});
