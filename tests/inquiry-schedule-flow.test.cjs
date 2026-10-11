const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const contract=require('../schedule-contract'),flow=require('../inquiry-schedule-flow');
function fixture(count=0){
 const id=randomUUID(),uid=randomUUID(),rows=Array.from({length:count},(_,i)=>({id:randomUUID(),title:'업무 '+i,action_type:'전화',status:'open',due_on:'2026-11-20',due_at:'2026-11-19T15:00:00Z',date_basis:'unconfirmed'}));
 let serial=1,guard=1,owner=uid,lost=false,race=false,refresh=false;const events=new Map(),writes=[],pages=[],stored=[],state={status:'배정완료',first_response_at:null,responded_at:null,updated_at:'2026-10-11T00:00:00+00:00'};
 const hex=n=>n.toString(16).padStart(32,'0');
 const root={crypto:{randomUUID},CRM_SCHEDULE_V1:true,CRMRelease:{has:()=>true},Phase1:{profile:{auth_uid:uid,user_id:uid}},addEventListener:()=>{}};
 root.Phase1.rpc=async(name,{p})=>{
  if(name==='crm_schedule_list_v1'){
   if(refresh){refresh=false;throw Error('refresh lost');}pages.push(p.page);
   return {ok:true,contract:'crm.schedule.v1',target_type:'inquiry',target_id:id,enabled:true,writable:true,version:null,token:hex(serial),inquiry_guard:hex(guard),response_state:{...state},owner_id:owner,actor_auth_uid:uid,actor_user_id:uid,page:p.page,per:20,total:rows.length,items:structuredClone(rows.slice((p.page-1)*20,p.page*20))};
  }
  if(name==='crm_schedule_receipt_v1')return {ok:true,contract:'crm.schedule.v1',request_id:p.request_id,found:events.has(p.request_id),ack:events.get(p.request_id)||null};
  if(race){serial++;guard++;race=false;}if(p.expected_token!==hex(serial))throw Error('SCHEDULE_STALE');
  writes.push(structuredClone(p));assert.equal(p.operation,'add');const row={id:randomUUID(),title:p.title,action_type:p.action_type,status:'open',due_on:p.due_on,due_at:p.due_on+'T00:00:00+09:00',date_basis:p.date_basis};rows.push(row);serial++;guard++;
  const ack={ok:true,contract:'crm.schedule.v1',target_type:'inquiry',target_id:id,request_id:p.request_id,operation:'add',actor_auth_uid:uid,actor_user_id:uid,due_on:p.due_on,date_basis:p.date_basis,action_id:row.id,event_id:randomUUID(),action_status:'open',after:{id:row.id,inquiry_id:id,status:'open',completed_at:null,due_at:row.due_at},token:hex(serial),cancelled_action_ids:[],completed_action_ids:[]};events.set(p.request_id,ack);
  if(lost){lost=false;throw Error('response lost');}return ack;
 };
 root.ScheduleContract=contract(root);const api=flow(root),progress={},existing=rows[0]?{id:rows[0].id,text:rows[0].title,due:rows[0].due_on}:null;
 const plan={next:{purpose:'고객 회신 확인',due:'2026-11-21'}},persist=()=>stored.push(structuredClone(progress));
 return {root,id,api,progress,existing,plan,rows,writes,pages,stored,events,persist,state,
  response(){serial++;state.status='전화응대 완료';state.first_response_at=state.responded_at=state.updated_at=`2026-10-11T00:00:${String(serial).padStart(2,'0')}+00:00`;progress.progressRequest=randomUUID();return {ok:true,operation:'inquiry_assign',intent:'response_progress',object_id:id,request_id:progress.progressRequest,inquiry_audit_event_id:randomUUID(),actor_auth_uid:uid,actor_user_id:uid,...state};},
  mutate(){serial++;guard++;},reassign(){serial++;guard++;owner=randomUUID();},lose(){lost=true;},race(){race=true;},loseRefresh(){refresh=true;}};
}
const begin=f=>f.api.begin(f.id,f.plan,f.existing,f.progress,f.persist,'배정완료');
test('inquiry has no version: response receipt and unchanged guard permit append',async()=>{const f=fixture();await begin(f);const ack=f.response();const c=await f.api.finish(f.id,f.progress,ack,f.persist);assert.equal(f.writes.length,1);assert.equal(f.writes[0].target_type,'inquiry');assert.equal(c.items.length,1);});
test('attempt without response progression preserves the original token',async()=>{const f=fixture();await begin(f);await f.api.finish(f.id,f.progress,null,f.persist);assert.equal(f.writes.length,1);});
test('keep all 23 existing tasks and do not create/complete anything',async()=>{const f=fixture(23);f.plan={};await begin(f);assert.deepEqual(f.pages,[1,2]);await f.api.finish(f.id,f.progress,f.response(),f.persist);assert.equal(f.writes.length,0);assert.equal(f.rows.length,23);});
test('unseen task, wrong task ID and stale status block before contact',async()=>{for(const mode of ['hidden','id','status']){const f=fixture(1);if(mode==='hidden')f.existing=null;if(mode==='id')f.existing.id=randomUUID();if(mode==='status')f.state.status='응대중';await assert.rejects(()=>begin(f),/STALE/);assert.equal(f.progress.inquirySchedule,undefined);}});
test('task, non-response parent change and reassignment prevent schedule write',async()=>{for(const method of ['mutate','reassign']){const f=fixture();await begin(f);const ack=f.response();f[method]();await assert.rejects(()=>f.api.finish(f.id,f.progress,ack,f.persist),/STALE/);assert.equal(f.writes.length,0);}});
test('another response cannot stand in for this response receipt',async()=>{const f=fixture();await begin(f);const ack=f.response();f.response();await assert.rejects(()=>f.api.finish(f.id,f.progress,ack,f.persist),/STALE/);assert.equal(f.writes.length,0);});
test('wrong actor, target or request response proof is rejected',async()=>{for(const field of ['actor_auth_uid','object_id','request_id']){const f=fixture();await begin(f);const ack=f.response();ack[field]=randomUUID();await assert.rejects(()=>f.api.finish(f.id,f.progress,ack,f.persist),/STALE/);}});
test('race after refresh is rejected by full expected token',async()=>{const f=fixture();await begin(f);const ack=f.response();f.race();await assert.rejects(()=>f.api.finish(f.id,f.progress,ack,f.persist),/STALE/);assert.equal(f.writes.length,0);});
test('committed response loss resumes by receipt with original request UUID',async()=>{const f=fixture();await begin(f);const ack=f.response();f.lose();await assert.rejects(()=>f.api.finish(f.id,f.progress,ack,f.persist),/response lost/);const restored=structuredClone(f.stored.at(-1));await f.api.finish(f.id,restored,ack,f.persist);assert.equal(f.writes.length,1);assert.equal(f.rows.length,1);});
test('known receipt disappearing never resends a command',async()=>{const f=fixture();await begin(f);const ack=f.response();await f.api.finish(f.id,f.progress,ack,f.persist);f.events.clear();await assert.rejects(()=>f.api.finish(f.id,f.progress,ack,f.persist),/RECEIPT_MISSING/);assert.equal(f.writes.length,1);});
test('account change and unavailable durable storage stop before writes',async()=>{const f=fixture();await begin(f);f.root.Phase1.profile={auth_uid:randomUUID(),user_id:randomUUID()};await assert.rejects(()=>begin(f),/IDENTITY_CHANGED/);const g=fixture();g.persist=()=>{throw Error('quota');};await assert.rejects(()=>begin(g),/quota/);assert.equal(g.writes.length,0);});
test('projection uses server earliest task, not the last requested date',async()=>{const f=fixture(1);f.plan={};await begin(f);const c=await f.api.finish(f.id,f.progress,null,f.persist),q={};f.api.project(q,c);assert.equal(q.nextActionObj.id,f.existing.id);assert.equal(q.next_action_date,f.existing.due);assert.equal(q.openNextActions.length,1);});
test('session invalidated during receipt prevents a new inquiry schedule write',async()=>{
 const f=fixture();let valid=true;const persist=()=>{if(!valid)throw Error('SESSION_ENDED');f.persist();};
 await f.api.begin(f.id,f.plan,f.existing,f.progress,persist,'배정완료');const ack=f.response(),rpc=f.root.Phase1.rpc;
 f.root.Phase1.rpc=async(name,args)=>{const r=await rpc(name,args);if(name==='crm_schedule_receipt_v1')valid=false;return r;};
 await assert.rejects(()=>f.api.finish(f.id,f.progress,ack,persist),/SESSION_ENDED/);assert.equal(f.writes.length,0);
});
