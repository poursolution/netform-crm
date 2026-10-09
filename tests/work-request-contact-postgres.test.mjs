import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const sql=f=>readFileSync(new URL('../sql/'+f,import.meta.url),'utf8');
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const owner=id(1),admin=id(2),other=id(3),inq=id(10),request=id(20);
let db,due;
const as=async actor=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await db.exec('set role authenticated');};
const call=async(p,fn='crm_work_request_inquiry_contact_v1')=>(await db.query('select public.'+fn+'($1::jsonb) r',[JSON.stringify(p)])).rows[0].r;
const body=(extra={})=>({id:request,operation_id:id(30),result:'연결됨',next_text:'고객 회신 확인',next_due:due,...extra});
const counts=async()=>{await db.exec('reset role');return(await db.query(`select
 (select count(*)::int from crm_security.inquiry_contact_logs) logs,
 (select count(*)::int from public.next_actions) tasks,
 (select count(*)::int from crm_security.work_request_contact_receipts) receipts,
 (select count(*)::int from crm_security.inquiry_audit_events) audits`)).rows[0];};
before(async()=>{
 db=new PGlite();await db.exec(fixture);
 await db.exec(`alter table public.users add column created_at timestamptz default now();
 create table crm_security.sales_directors(name text,active boolean);
 create table public.inquiries(id uuid primary key,assigned_to uuid,status text,brand text,inquiry_type text,work_type text,raw jsonb default '{}',
 deal_id uuid,opportunity_id uuid,qualified_at timestamptz,first_response_at timestamptz,responded_at timestamptz,next_action_date date,updated_at timestamptz,close_reason text);
 create table public.next_actions(id uuid primary key default gen_random_uuid(),inquiry_id uuid references inquiries(id),deal_id uuid,
 action_type text not null,title text not null,due_at timestamptz not null,assignee_name text not null,status text not null,
 created_at timestamptz,updated_at timestamptz,completed_at timestamptz);
 create table crm_security.inquiry_audit_events(event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid,actor_user_id uuid,inquiry_id uuid,
 action text,before_data jsonb,after_data jsonb,reason text,created_at timestamptz default now());
 create function crm_security.can_inquiry(x uuid) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from crm_security.actor() a join public.inquiries i on i.id=x where a.permission_role='admin' or i.assigned_to=a.user_id)$$;
 insert into public.users values('${owner}','${owner}','담당','rep',true,now()),('${admin}','${admin}','관리자','admin',true,now()),('${other}','${other}','다른 담당','rep',true,now());
 insert into crm_security.access_review values('${owner}','${owner}','rep','rep',true,now()+interval '1 day'),('${admin}','${admin}','admin','admin',true,now()+interval '1 day'),('${other}','${other}','rep','rep',true,now()+interval '1 day');`);
 // Actual schema/serializer and actual production contact command, not a mock acknowledgement.
 await db.exec(sql('inquiry-flow-v1-20261005.sql').split('create or replace function public.crm_inquiry_command_v1')[0]);
 await db.exec(sql('inquiry-contact-two-results-20261007.sql'));
 await db.exec(sql('work-request-v1-20261005.sql'));
 await db.exec(sql('20261009211508_request_contact_atomic.sql'));
 await db.exec(sql('20261009211508_request_contact_atomic.sql'));
 await db.exec(sql('20261009215629_request_compound_contact.sql'));
 await db.exec(sql('20261009215629_request_compound_contact.sql'));
 due=(await db.query("select ((now() at time zone 'Asia/Seoul')::date+2)::text d")).rows[0].d;
});
beforeEach(async()=>{
 await db.exec(`reset role;truncate crm_security.work_request_contact_receipts,crm_security.work_requests,crm_security.inquiry_contact_logs,crm_security.inquiry_flow_state,crm_security.schedules,crm_security.inquiry_quote_versions,crm_security.inquiry_audit_events,public.next_actions,public.inquiries cascade;
 insert into inquiries(id,assigned_to,status) values('${inq}','${owner}','배정완료');
 insert into crm_security.work_requests(id,target_type,target_id,kind,label,to_scope,to_user_id,to_name,asks,due_at,requested_by_user_id,requested_by_name)
 values('${request}','inquiry','${inq}','first','첫 연락 요청','user','${owner}','담당','["고객 첫 연락"]',now(),'${admin}','관리자');`);
 await as(owner);
});
after(async()=>{await db?.close();});

const readReview=page=>call({id:request,...(page?{page}:{})},'crm_work_request_objectives_read_v1');
const writeReview=p=>call(p,'crm_work_request_objectives_write_v1');
const reviewBody=(context,extra={})=>({id:request,operation_id:id(70),expected_revision:context.revision,expected_updated_at:context.expected_updated_at,
 decisions:allAsks.slice(1).map(ask=>({ask,value:'not_needed',note:'고객과 필요 여부 확인'})),complete:true,...extra});
const connectedReview=async()=>{await compound();await call2(body());return readReview();};

// Exercise the real WorkRequest -> OpsStore -> PostgreSQL chain. Only the network boundary is simulated.
function objectiveClient({storage=new Map(),loseWriteAck=false}={}){
 const allowed=new Set(['crm_work_request_objectives_read_v1','crm_work_request_objectives_write_v1']);
 const R={G:{},ME:{id:owner,name:'담당'},esc:String,escAttr:String,CRMRelease:{has:n=>allowed.has(n)},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  SB:{rpc:async(name,{p})=>{assert.ok(allowed.has(name));let data;
   try{data=await call(p,name);}catch(e){return {error:{code:e.code,message:e.message}};}
   if(loseWriteAck&&name==='crm_work_request_objectives_write_v1')throw Error('response lost after commit');
   return {data};}}
 };
 const context={window:R,document:{addEventListener(){}},Date,Map,Set,setTimeout:()=>{}};
 for(const f of ['ops-store.js','work-request.js'])runInNewContext(readFileSync(new URL('../'+f,import.meta.url),'utf8'),context);
 return {api:R.WorkRequest.objectives,R,storage};
}

test('integrated objective API accepts actual SQL ACK and preserves the linked quote followup',async()=>{
 await compound();const contact=await call2(body({result:'견적요청'}));const x=objectiveClient(),c=await x.api.read(request);
 const a=await x.api.write(reviewBody(c,{decisions:[
  {ask:allAsks[1],value:'needed',note:'견적 요청 확인',next_action_id:contact.next_action_id},
  {ask:allAsks[2],value:'not_needed',note:'방문은 필요 없다고 확인'}]}));
 assert.equal(a.request_complete,true);assert.equal(x.storage.size,0);const fresh=await x.api.read(request);
 assert.equal(fresh.request.status,'done');assert.equal(fresh.decisions[0].next_action.id,contact.next_action_id);
 await db.exec('reset role');const task=(await db.query('select status,due_at from next_actions where id=$1',[contact.next_action_id])).rows[0];
 assert.equal(task.status,'open');assert.ok(task.due_at);assert.equal((await db.query('select count(*)::int n from crm_security.work_request_objective_events')).rows[0].n,1);
});

test('integrated lost SQL ACK is recovered after reload without duplicate decisions or stale local state',async()=>{
 await connectedReview();const storage=new Map(),a=objectiveClient({storage,loseWriteAck:true});const c=await a.api.read(request);
 await assert.rejects(a.api.write(reviewBody(c)),/response lost/);assert.equal(storage.size,1);
 const b=objectiveClient({storage});const replay=await b.api.retry(request);assert.equal(replay.replayed,true);assert.equal(storage.size,0);
 const fresh=await b.api.read(request);assert.equal(fresh.revision,1);assert.equal(fresh.history_total,1);assert.equal(fresh.request_complete,true);
 assert.equal(b.R.G.workReq,undefined,'receipt does not overwrite shared request state');
});

test('integrated PostgreSQL conflict clears retry state and allows fresh reviewed save',async()=>{
 await connectedReview();const x=objectiveClient(),stale=await x.api.read(request);
 await writeReview(reviewBody(stale,{operation_id:id(71),decisions:[],complete:false}));
 await assert.rejects(x.api.write(reviewBody(stale)),e=>e.code==='40001'&&e.databaseRejected===true);
 assert.equal(x.storage.size,0);let fresh=await x.api.read(request);assert.equal(fresh.revision,1);
 await x.api.write(reviewBody(fresh,{operation_id:id(72)}));fresh=await x.api.read(request);
 assert.equal(fresh.revision,2);assert.equal(fresh.request_complete,true);assert.equal(fresh.history_total,2);
});

test('objective context survives reload and allows requester/recipient only, including null recipient',async()=>{
 const c=await connectedReview();assert.equal(c.revision,0);assert.deepEqual(c.contact_proof.remaining_asks,allAsks.slice(1));assert.deepEqual(c.history,[]);
 await as(admin);assert.equal((await readReview()).request_id,request);
 await as(other);await assert.rejects(readReview(),/forbidden/);
 await db.exec(`reset role;update crm_security.work_requests set to_user_id=null`);await as(other);await assert.rejects(readReview(),/forbidden/);
 await as(owner);await assert.rejects(readReview(),/forbidden/);
});
test('objective completion requires real connection proof; absence and result text are insufficient',async()=>{
 await compound();let c=await readReview();await assert.rejects(writeReview(reviewBody(c)),/REQUEST_CONTACT_PROOF_REQUIRED/);
 await call2(body({result:'부재'}));c=await readReview();await assert.rejects(writeReview(reviewBody(c)),/REQUEST_CONTACT_PROOF_REQUIRED/);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from crm_security.work_request_objective_events')).rows[0].n,0);
});
test('partial decisions stay working; explicit full review closes request without completing customer task',async()=>{
 const c=await connectedReview();await db.exec('reset role');const plans=(await db.query('select * from next_actions')).rows;const inquiry=(await db.query('select * from inquiries')).rows;await as(owner);
 const partial=reviewBody(c,{decisions:[{ask:allAsks[1],value:'unknown',note:'자료 회신 후 판단'}],complete:false});
 const a=await writeReview(partial);assert.equal(a.request.status,'working');assert.equal(a.request_complete,false);assert.equal(a.revision,1);
 const b=await writeReview(reviewBody(await readReview(),{operation_id:id(71)}));assert.equal(b.request.status,'done');assert.equal(b.request_complete,true);assert.equal(b.request.auto_done,false);
 const reread=await readReview();assert.equal(reread.history.length,2);assert.equal(reread.history[1].decisions[0].value,'unknown');assert.equal(reread.request_complete,true);
 await db.exec('reset role');assert.deepEqual((await db.query('select * from next_actions')).rows,plans);assert.deepEqual((await db.query('select * from inquiries')).rows,inquiry);
});
test('needed decisions require matching persisted followup, never a fabricated or other inquiry task',async()=>{
 const c=await connectedReview();const decision={ask:allAsks[1],value:'needed',note:'고객 견적 요청 확인',next_action_id:id(90)};
 await assert.rejects(writeReview(reviewBody(c,{decisions:[decision],complete:false})),/REQUEST_FOLLOWUP_REQUIRED/);
 await db.exec(`reset role;insert into next_actions(id,inquiry_id,action_type,title,due_at,assignee_name,status) values('${id(90)}','${inq}','방문','현장 방문',now()+interval '2 day','담당','open')`);await as(owner);
 await assert.rejects(writeReview(reviewBody(c,{decisions:[decision],complete:false})),/REQUEST_FOLLOWUP_REQUIRED/);
 await db.exec(`reset role;update next_actions set action_type='견적' where id='${id(90)}'`);await as(owner);
 const a=await writeReview(reviewBody(c,{decisions:[decision],complete:false}));assert.equal(a.decisions[0].next_action.id,id(90));assert.equal(a.request_complete,false);
});
test('objective CAS and operation receipts reject stale, changed and duplicate completion',async()=>{
 const c=await connectedReview(),p=reviewBody(c),a=await writeReview(p);const again=await writeReview(p);assert.equal(again.replayed,true);assert.equal(again.revision,a.revision);
 await assert.rejects(writeReview({...p,complete:false}),/REQUEST_ID_REUSE/);
 await assert.rejects(writeReview({...p,operation_id:id(71)}),/REQUEST_CLOSED/);
 await db.exec(`reset role;update crm_security.work_requests set status='working',closed_at=null`);await as(owner);
 await assert.rejects(writeReview({...p,operation_id:id(72)}),/REQUEST_REVIEW_CONFLICT/);
 const fresh=await readReview();await assert.rejects(writeReview(reviewBody(fresh,{operation_id:id(73),expected_updated_at:'2000-01-01T00:00:00Z'})),/REQUEST_REVIEW_CONFLICT/);
});
test('objective completion rejects unknown, missing, duplicate and invented decisions',async()=>{
 const c=await connectedReview();for(const decisions of [[],[{ask:allAsks[1],value:'unknown',note:'미확인'}],
 [{ask:allAsks[1],value:'not_needed',note:'확인'}],allAsks.slice(1).map(()=>({ask:allAsks[1],value:'not_needed',note:'확인'})),
 [{ask:'고객 첫 연락',value:'not_needed',note:'확인'}],[{ask:allAsks[1],value:'not_needed',note:''}],
 [{ask:allAsks[1],value:'not_needed',note:'확인',next_action_id:id(90)}]])await assert.rejects(writeReview(reviewBody(c,{decisions})));
 assert.equal((await readReview()).revision,0);
});
test('objective writes reject admin proxy, reassignment, stage change and trash before persisting',async()=>{
 const c=await connectedReview();for(const actor of [admin,other]){await as(actor);await assert.rejects(writeReview(reviewBody(c)),/forbidden/);}
 for(const mutation of [`update inquiries set assigned_to='${other}'`,`update inquiries set status='실주'`,
 `insert into crm_security.inquiry_audit_events(inquiry_id,action) values('${inq}','inquiry_trash')`,
 `update crm_security.work_requests set status='cancelled'`]){
  await db.exec('reset role;begin');try{await db.exec(mutation);await as(owner);await db.exec('savepoint attempted');await assert.rejects(writeReview(reviewBody(c)));await db.exec('rollback to attempted');}
  finally{await db.exec('reset role;rollback');}
 }
 await as(owner);assert.equal((await readReview()).revision,0);
});
test('objective append failure rolls back completion and does not change customer work',async()=>{
 const c=await connectedReview();await db.exec(`reset role;create function crm_security.fail_objective() returns trigger language plpgsql as $$begin raise exception 'objective failure';end$$;
 create trigger fail_objective before insert on crm_security.work_request_objective_events for each row execute function crm_security.fail_objective()`);
 try{await as(owner);await assert.rejects(writeReview(reviewBody(c)),/objective failure/);const after=await readReview();assert.equal(after.revision,0);assert.equal(after.request.status,'working');assert.equal(after.expected_updated_at,c.expected_updated_at);}
 finally{await db.exec('reset role;drop trigger fail_objective on crm_security.work_request_objective_events;drop function crm_security.fail_objective()');}
});
test('objective history uses bounded twenty-row pages and private storage',async()=>{
 let c=await connectedReview();for(let n=0;n<21;n++){await writeReview(reviewBody(c,{operation_id:id(100+n),decisions:[],complete:false}));c=await readReview();}
 assert.equal(c.history.length,20);assert.equal(c.history_total,21);assert.equal(c.history_has_more,true);assert.equal(c.history[0].revision,21);
 const p2=await readReview(2);assert.equal(p2.history.length,1);assert.equal(p2.history[0].revision,1);assert.equal(p2.history_has_more,false);
 await assert.rejects(db.query('select * from crm_security.work_request_objective_events'),/permission denied/);
 await db.exec('reset role');for(const role of ['anon','service_role']){
  const p=(await db.query("select has_function_privilege($1,'public.crm_work_request_objectives_write_v1(jsonb)','EXECUTE') e,has_table_privilege($1,'crm_security.work_request_objective_events','SELECT') s",[role])).rows[0];assert.deepEqual(p,{e:false,s:false});
 }
});

test('connected save commits response, pending customer task, completion and immutable retry receipt together',async()=>{
 const p=body(),a=await call(p);assert.equal(a.request.status,'done');assert.equal(a.request.to_user_id,owner);assert.equal(a.request.next_due,due);assert.ok(a.inquiry_update.first_response_at);
 assert.equal(a.state.logs[0].contact_result,'연결됨');assert.equal(a.state.logs[0].kind,'connected');
 assert.deepEqual(await counts(),{logs:1,tasks:1,receipts:1,audits:1});
 assert.equal((await db.query('select status from next_actions')).rows[0].status,'open','customer followup is independent of request completion');
 await as(owner);const retry=await call(p);assert.equal(retry.replayed,true);assert.equal(retry.log_id,a.log_id);
 await assert.rejects(call(body({result:'부재'})),/REQUEST_ID_REUSE/);
 assert.deepEqual(await counts(),{logs:1,tasks:1,receipts:1,audits:1});
});
test('absence records attempt and retry date, keeps connection request working and first connection unset',async()=>{
 const a=await call(body({result:'부재'}));assert.equal(a.request.status,'working');assert.equal(a.request.closed_at,null);
 assert.equal(a.inquiry_update.first_response_at,null);assert.equal(a.state.first_connected_at,null);assert.equal(a.state.logs[0].kind,'attempt');
 assert.deepEqual(await counts(),{logs:1,tasks:1,receipts:1,audits:1});
});
test('existing customer plans and imported response evidence are preserved before any writes',async()=>{
 const guards=[
  "update inquiries set next_action_date=current_date",
  `insert into next_actions(inquiry_id,action_type,title,due_at,assignee_name,status) values('${inq}','방문','기존 고객 방문',now(),'담당','open')`,
  `insert into crm_security.schedules(type,at,inquiry_id,created_by_name) values('meeting',current_date,'${inq}','담당')`,
  `insert into crm_security.inquiry_flow_state(inquiry_id,reply_due) values('${inq}',current_date)`,
  `update inquiries set raw='{"응대내용":"사진을 보내주신다. 일정이 맞으면 방문"}'`,
  'update inquiries set responded_at=now()'
 ];
 for(const setup of guards){await db.exec('reset role;begin');try{
  await db.exec(setup);const before=await counts();await as(owner);
  await db.exec('savepoint attempt');await assert.rejects(call(body()),/REQUEST_(PLAN_CONFLICT|CONTACT_REVIEW_REQUIRED)/);await db.exec('rollback to attempt');assert.deepEqual(await counts(),before);
 }finally{await db.exec('rollback;reset role');}}
});
test('wrong recipient, admin proxy, stale assignment, closed/converted and trash do not save',async()=>{
 for(const actor of [admin,other]){await as(actor);await assert.rejects(call(body()),/받는 담당자/);}
 for(const change of [`assigned_to='${other}'`,"status='실주'",`deal_id='${id(99)}'`]){
  await db.exec('reset role;begin');try{await db.exec('update inquiries set '+change);await as(owner);await assert.rejects(call(body()),/담당자|REQUEST_STAGE/);}finally{await db.exec('rollback;reset role');}
 }
 await db.exec(`insert into crm_security.inquiry_audit_events(inquiry_id,action) values('${inq}','inquiry_trash')`);await as(owner);
 await assert.rejects(call(body()),/문의를 찾을 수 없습니다/);assert.equal((await counts()).logs,0);
});
test('malformed input and requests with additional goals require review without inferred completion',async()=>{
 for(const p of [body({result:'통화완료'}),body({next_due:'2000-01-01'}),body({next_text:''}),body({absent:false}),body({operation_id:null})])await assert.rejects(call(p));
 await db.exec(`reset role;update crm_security.work_requests set asks='["고객 첫 연락","방문 필요 여부 확인"]'`);await as(owner);
 await assert.rejects(call(body()),/REQUEST_CONTACT_REVIEW_REQUIRED/);assert.equal((await counts()).logs,0);
});
test('failure after contact write rolls back contact, inquiry timestamp, followup and request completion',async()=>{
 await db.exec(`reset role;create function crm_security.synthetic_fail() returns trigger language plpgsql as $$begin raise exception 'synthetic failure';end$$;
 create trigger synthetic_fail before insert on public.next_actions for each row execute function crm_security.synthetic_fail();`);
 try{await as(owner);await assert.rejects(call(body()),/synthetic failure/);assert.deepEqual(await counts(),{logs:0,tasks:0,receipts:0,audits:0});
  assert.equal((await db.query('select first_response_at from inquiries')).rows[0].first_response_at,null);
  assert.equal((await db.query('select status from crm_security.work_requests')).rows[0].status,'sent');
 }finally{await db.exec('reset role;drop trigger synthetic_fail on public.next_actions;drop function crm_security.synthetic_fail()');}
});
test('old result-only completion is blocked for the protected template; seen/cancel remain available',async()=>{
 for(const action of ['done','reply'])await assert.rejects(call({id:request,action,result:'연결됨'},'crm_work_request_reply_v1'),/REQUEST_CONTACT_PROOF_REQUIRED/);
 const seen=await call({id:request,action:'seen'},'crm_work_request_reply_v1');assert.equal(seen.request.status,'seen');
 await as(admin);const cancelled=await call({id:request,action:'cancel'},'crm_work_request_reply_v1');assert.equal(cancelled.request.status,'cancelled');
});
test('receipt retry after reassignment never replays writes; private functions/tables are inaccessible',async()=>{
 const a=await call(body());await db.exec(`reset role;update inquiries set assigned_to='${other}',next_action_date=current_date+10`);
 const before=(await db.query('select * from inquiries')).rows;await as(owner);const retry=await call(body());assert.equal(retry.log_id,a.log_id);assert.equal(retry.replayed,true);
 await db.exec('reset role');assert.deepEqual((await db.query('select * from inquiries')).rows,before);
 for(const role of ['anon','authenticated','service_role']){
  const x=(await db.query("select has_function_privilege($1,'crm_security.work_request_reply_pre_contact_guard(jsonb)','execute') f,has_table_privilege($1,'crm_security.work_request_contact_receipts','SELECT,INSERT,UPDATE,DELETE') t",[role])).rows[0];assert.deepEqual(x,{f:false,t:false});
 }
 for(const role of ['anon','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.crm_work_request_inquiry_contact_v1(jsonb)','execute') f",[role])).rows[0].f,false);
});

test('absence retry resolves only its unchanged task and preserves original due/history',async()=>{
 const a=await call(body({result:'부재'}));await db.exec('reset role');const original=(await db.query('select * from next_actions')).rows[0];await as(owner);
 const b=await call(body({operation_id:id(31)}));assert.equal(b.request.status,'done');await db.exec('reset role');
 const prior=(await db.query('select * from next_actions where id=$1',[original.id])).rows[0];assert.equal(prior.status,'completed');assert.equal(prior.title,original.title);assert.deepEqual(prior.due_at,original.due_at);
 assert.equal((await db.query("select count(*)::int n from next_actions where status='open'")).rows[0].n,1);
 await as(owner);await call(body({result:'부재'}));await db.exec('reset role');assert.equal((await db.query('select status from crm_security.work_requests')).rows[0].status,'done');
});
test('changed retry task cannot be overwritten by a new contact operation',async()=>{
 await call(body({result:'부재'}));await db.exec("reset role;update next_actions set title='고객이 별도로 잡은 방문'");const before=await counts();await as(owner);
 await assert.rejects(call(body({operation_id:id(31)})),/REQUEST_PLAN_CONFLICT/);assert.deepEqual(await counts(),before);
 assert.equal((await db.query('select title from next_actions')).rows[0].title,'고객이 별도로 잡은 방문');
});

const allAsks=['고객 첫 연락','연락 후 견적 필요 여부 확인','현장방문 필요 여부 확인'];
const compound=async(asks=allAsks)=>{await db.exec('reset role');await db.query('update crm_security.work_requests set asks=$1::jsonb',[JSON.stringify(asks)]);await as(owner);};
const call2=p=>call(p,'crm_work_request_inquiry_contact_v2');

test('compound connection saves contact and next task but leaves all extra goals unresolved',async()=>{
 await compound();const p=body({result:'견적요청'}),a=await call2(p);
 assert.equal(a.contract_version,2);assert.equal(a.request.status,'working');assert.equal(a.request.closed_at,null);assert.equal(a.request.auto_done,false);
 assert.deepEqual(a.completion,{policy_version:'first-compound-v1',requested_asks:allAsks,satisfied_asks:['고객 첫 연락'],remaining_asks:allAsks.slice(1),contact_log_id:a.log_id,request_complete:false});
 assert.deepEqual(await counts(),{logs:1,tasks:1,receipts:1,audits:1});
 assert.equal((await db.query('select status from next_actions')).rows[0].status,'open');
 assert.equal((await db.query('select first_response_at is not null b from inquiries')).rows[0].b,true);
 await as(owner);const retry=await call2(p);assert.equal(retry.replayed,true);assert.equal(retry.log_id,a.log_id);
 await assert.rejects(call2(body({operation_id:id(31)})),/REQUEST_CONTACT_REVIEW_REQUIRED/,'already connected is reviewed, never another automatic contact');
 assert.equal((await counts()).logs,1);
});

test('compound absence retries preserve original task and never complete unresolved quote/visit goals',async()=>{
 await compound();const a=await call2(body({result:'부재'}));assert.deepEqual(a.completion.satisfied_asks,[]);assert.deepEqual(a.completion.remaining_asks,allAsks);
 assert.equal(a.inquiry_update.first_response_at,null);await db.exec('reset role');const old=(await db.query('select * from next_actions')).rows[0];
 await as(owner);const b=await call2(body({operation_id:id(31)}));assert.equal(b.request.status,'working');assert.deepEqual(b.completion.remaining_asks,allAsks.slice(1));
 await db.exec('reset role');const before=(await db.query('select * from next_actions where id=$1',[old.id])).rows[0];
 assert.equal(before.status,'completed');assert.deepEqual(before.due_at,old.due_at);assert.equal(before.title,old.title);
 assert.equal((await db.query("select count(*)::int n from next_actions where status='open'")).rows[0].n,1);
});

test('compound old reply/automatic/manual result-only closure is blocked while seen and cancellation work',async()=>{
 await compound();
 for(const p of [{action:'done',result:'연결됨'},{action:'done',result:'부재',absent:true},{action:'done',result:'연락 기록 확인',auto:true},{action:'reply',result:'견적요청'}])
  await assert.rejects(call({id:request,...p},'crm_work_request_reply_v1'),/REQUEST_CONTACT_PROOF_REQUIRED/);
 const seen=await call({id:request,action:'seen'},'crm_work_request_reply_v1');assert.equal(seen.request.status,'seen');
 await as(admin);const cancelled=await call({id:request,action:'cancel'},'crm_work_request_reply_v1');assert.equal(cancelled.request.status,'cancelled');
});

test('compound refuses invented/duplicate/missing objectives and cannot bypass v1 basic contract',async()=>{
 for(const asks of [['고객 첫 연락'],[],['고객 첫 연락','임의 요청'],['고객 첫 연락','고객 첫 연락'],['연락 후 견적 필요 여부 확인','현장방문 필요 여부 확인'],{other:'고객 첫 연락'}]){
  await compound(asks);await assert.rejects(call2(body()),/REQUEST_CONTACT_REVIEW_REQUIRED/);assert.equal((await counts()).logs,0);
 }
 await compound();await assert.rejects(call(body()),/REQUEST_CONTACT_REVIEW_REQUIRED/);
 for(const extra of [{completion:{request_complete:true}},{fulfilled_asks:allAsks},{result:'통화완료'},{next_text:''},{next_due:'2000-01-01'}])await assert.rejects(call2(body(extra)));
 assert.equal((await counts()).logs,0);
});

test('compound cannot overwrite plans, imported response, changed owner, converted or trashed inquiry',async()=>{
 await compound();
 for(const setup of ["update inquiries set next_action_date=current_date",`insert into next_actions(inquiry_id,action_type,title,due_at,assignee_name,status) values('${inq}','방문','약속한 방문',now(),'담당','open')`,
  `update inquiries set raw='{"응대내용":"기존 응대 확인 필요"}'`,`update inquiries set assigned_to='${other}'`,"update inquiries set status='실주'",
  `insert into crm_security.inquiry_audit_events(inquiry_id,action) values('${inq}','inquiry_trash')`]){
  await db.exec('reset role;begin');try{await db.exec(setup);const before=await counts();await as(owner);await db.exec('savepoint attempt');await assert.rejects(call2(body()));
   await db.exec('rollback to attempt');assert.deepEqual(await counts(),before);
  }finally{await db.exec('rollback;reset role');}
 }
});

test('compound failure after contact creation rolls back response, next task, request and receipt',async()=>{
 await compound();await db.exec(`reset role;create function crm_security.synthetic_compound_fail() returns trigger language plpgsql as $$begin raise exception 'compound failure';end$$;
 create trigger synthetic_compound_fail before insert on crm_security.work_request_contact_receipts for each row execute function crm_security.synthetic_compound_fail();`);
 try{await as(owner);await assert.rejects(call2(body()),/compound failure/);assert.deepEqual(await counts(),{logs:0,tasks:0,receipts:0,audits:0});
  assert.equal((await db.query('select first_response_at from inquiries')).rows[0].first_response_at,null);
  assert.equal((await db.query('select status from crm_security.work_requests')).rows[0].status,'sent');
 }finally{await db.exec('reset role;drop trigger synthetic_compound_fail on crm_security.work_request_contact_receipts;drop function crm_security.synthetic_compound_fail()');}
});

test('compound permissions and receipt replay preserve actor isolation and reassignment',async()=>{
 await compound();for(const actor of [admin,other]){await as(actor);await assert.rejects(call2(body()),/받는 담당자/);}
 await as(owner);const a=await call2(body());await db.exec(`reset role;update inquiries set assigned_to='${other}',next_action_date=current_date+20`);
 const before=(await db.query('select * from inquiries')).rows;await as(owner);const retry=await call2(body());assert.equal(retry.replayed,true);assert.equal(retry.log_id,a.log_id);
 await db.exec('reset role');assert.deepEqual((await db.query('select * from inquiries')).rows,before);
 for(const role of ['anon','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.crm_work_request_inquiry_contact_v2(jsonb)','execute') f",[role])).rows[0].f,false);
});

test('compound objective order is preserved and unrelated request kinds retain existing reply behavior',async()=>{
 await compound(['현장방문 필요 여부 확인','고객 첫 연락']);const a=await call2(body());assert.deepEqual(a.completion.remaining_asks,['현장방문 필요 여부 확인']);
 await db.exec("reset role;update crm_security.work_requests set kind='support',label='지원처리 확인',status='sent'");await as(owner);
 const b=await call({id:request,action:'done',result:'처리 확인'},'crm_work_request_reply_v1');assert.equal(b.request.status,'done');
});
