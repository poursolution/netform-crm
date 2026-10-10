import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
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
 await db.exec(sql('20261010013000_request_contact_link.sql'));
 await db.exec(sql('20261010013000_request_contact_link.sql'));
 await db.exec(sql('20261009215629_request_compound_contact.sql'));
 await db.exec(sql('20261009215629_request_compound_contact.sql'));
 await db.exec(sql('20261010090000_request_objective_followup.sql'));
 await db.exec(sql('20261010090000_request_objective_followup.sql'));
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
const followup=p=>call(p,'crm_work_request_objective_followup_v1');
const followupBody=(c,extra={})=>({id:request,operation_id:id(801),expected_revision:c.revision,expected_updated_at:c.expected_updated_at,plan_token:c.plan_context.token,
 ask:'연락 후 견적 필요 여부 확인',title:'견적 자료 준비',due_date:due,plan_origin:'internal_plan',agreement_note:'',mode:'additional',reason:'고객 요청에 따른 견적 검토',...extra});
const writeReview=p=>call(p,'crm_work_request_objectives_write_v1');
const reviewBody=(context,extra={})=>({id:request,operation_id:id(70),expected_revision:context.revision,expected_updated_at:context.expected_updated_at,
 decisions:allAsks.slice(1).map(ask=>({ask,value:'not_needed',note:'고객과 필요 여부 확인'})),complete:true,...extra});
const connectedReview=async()=>{await compound();await call2(body());return readReview();};

// Exercise the real WorkRequest -> OpsStore -> PostgreSQL chain. Only the network boundary is simulated.
function objectiveClient({storage=new Map(),loseWriteAck=false,loseFollowupAck=false}={}){
 const allowed=new Set(['crm_work_request_objectives_read_v1','crm_work_request_objectives_write_v1','crm_work_request_objective_followup_v1']);
 const R={G:{},ME:{id:owner,name:'담당'},esc:String,escAttr:String,CRMRelease:{has:n=>allowed.has(n)},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  SB:{rpc:async(name,{p})=>{assert.ok(allowed.has(name));let data;
   try{data=await call(p,name);}catch(e){return {error:{code:e.code,message:e.message}};}
   if(loseWriteAck&&name==='crm_work_request_objectives_write_v1')throw Error('response lost after commit');
   if(loseFollowupAck&&name==='crm_work_request_objective_followup_v1')throw Error('response lost after commit');
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
 const invalidFollowups=[{title:'   ',status:'open',due:'2030-01-01',completed:null},{title:'\t\n',status:'open',due:'2030-01-01',completed:null},
  {title:'견적 준비',status:'open',due:'infinity',completed:null},{title:'견적 준비',status:'open',due:'-infinity',completed:null},
  {title:'견적 준비',status:'completed',due:'2030-01-01',completed:null},{title:'견적 준비',status:'completed',due:'2030-01-01',completed:'infinity'},
  {title:'견적 준비',status:'cancelled',due:'2030-01-01',completed:null}];
 for(const [index,item] of invalidFollowups.entries())test('incomplete linked followup '+index+' cannot finish a request or create decision history',async()=>{
  const c=await connectedReview();await db.exec('reset role');
  await db.query('insert into next_actions(id,inquiry_id,action_type,title,due_at,assignee_name,status,completed_at) values($1,$2,$3,$4,$5,$6,$7,$8)',[id(90),inq,'견적',item.title,item.due,'담당',item.status,item.completed]);
  const before=(await db.query('select id,title,status,due_at::text,completed_at::text from next_actions order by id')).rows;
  await as(owner);const p=reviewBody(c,{decisions:[{ask:allAsks[1],value:'needed',note:'고객 견적 요청 확인',next_action_id:id(90)}, {ask:allAsks[2],value:'not_needed',note:'방문 불필요 확인'}]});
  await assert.rejects(writeReview(p),/REQUEST_FOLLOWUP_REQUIRED/,JSON.stringify(item));
  const after=await readReview();assert.equal(after.revision,0);assert.equal(after.request.status,'working');assert.equal(after.expected_updated_at,c.expected_updated_at);
  await db.exec('reset role');assert.deepEqual((await db.query('select id,title,status,due_at::text,completed_at::text from next_actions order by id')).rows,before);
});
for(const status of ['open','completed'])test('valid '+status+' followup retains its original dates and independent status',async()=>{
  const c=await connectedReview();await db.exec('reset role');
  await db.query('insert into next_actions(id,inquiry_id,action_type,title,due_at,assignee_name,status,completed_at) values($1,$2,$3,$4,$5,$6,$7,$8)',[id(90),inq,'견적','기존 견적 준비','2000-01-01','담당',status,status==='completed'?'2000-01-02':null]);
  const before=(await db.query('select id,title,status,due_at::text,completed_at::text from next_actions order by id')).rows;await as(owner);
  const a=await writeReview(reviewBody(c,{decisions:[{ask:allAsks[1],value:'needed',note:'기존 업무와 같은 견적 요청 확인',next_action_id:id(90)},{ask:allAsks[2],value:'not_needed',note:'방문 불필요 확인'}]}));
  assert.equal(a.request_complete,true);await db.exec('reset role');assert.deepEqual((await db.query('select id,title,status,due_at::text,completed_at::text from next_actions order by id')).rows,before);
});
for(const value of ['needed','not_needed','unknown'])test('whitespace-only '+value+' decision cannot create proof or complete a request',async()=>{
 await compound();const contact=await call2(body({result:'견적요청'}));const c=await readReview();
 await db.exec('reset role');const plans=(await db.query('select * from next_actions order by id')).rows;await as(owner);
 for(const note of ['\t','\n','\r\n',' \t\n ']){
  const decision={ask:allAsks[1],value,note,...(value==='needed'?{next_action_id:contact.next_action_id}:{})};
  await assert.rejects(writeReview(reviewBody(c,{decisions:[decision,{ask:allAsks[2],value:'not_needed',note:'방문 불필요 확인'}],complete:value!=='unknown'})),/invalid decisions/);
 }
 const after=await readReview();assert.equal(after.revision,0);assert.equal(after.request.status,'working');assert.equal(after.expected_updated_at,c.expected_updated_at);assert.deepEqual(after.history,[]);
 await db.exec('reset role');assert.deepEqual((await db.query('select * from next_actions order by id')).rows,plans);
});
test('multiline decision evidence is preserved when it contains an actual reason',async()=>{
 const c=await connectedReview(),note='고객 확인\n견적은 필요 없음\t방문도 불필요';
 const a=await writeReview(reviewBody(c,{decisions:allAsks.slice(1).map(ask=>({ask,value:'not_needed',note}))}));
 assert.equal(a.request_complete,true);assert.equal((await readReview()).decisions[0].note,note);
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

// Ordinary detail saves reuse the persisted log and already saved next action.
const link=(log_id)=>call({id:request,log_id},'crm_work_request_contact_link_v1');
async function ordinary(result='연결됨',{task=true,explicit=true}={}){
 const p={type:'contact_log',inquiry_id:inq,request_id:id(60),channel:'전화',result,
  content:'상세에서 기록',next_action:'고객 회신 확인',next_check_date:due,occurred_at:new Date().toISOString()};
 if(explicit)p.contact_result=result;
 const saved=await call(p,'crm_inquiry_command_v1');
 if(task){await db.exec('reset role');await db.query(`insert into next_actions(id,inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
 values($1,$2,'전화','고객 회신 확인',$3::date::timestamp at time zone 'Asia/Seoul','담당','open',clock_timestamp(),clock_timestamp())`,[id(70),inq,due]);await as(owner);}
 return saved.log_id;
}
async function customerSnapshot(){await db.exec('reset role');return (await db.query(`select
 (select jsonb_agg(to_jsonb(x) order by id) from inquiries x) inquiries,
 (select jsonb_agg(to_jsonb(x) order by id) from next_actions x) tasks,
 (select jsonb_agg(to_jsonb(x) order by id) from crm_security.inquiry_contact_logs x) logs,
 (select jsonb_agg(to_jsonb(x) order by inquiry_id) from crm_security.inquiry_flow_state x) state,
 (select count(*)::int from crm_security.work_request_contact_links) links`)).rows[0];}

test('ordinary detail saved log links the request without creating a second contact or overwriting any plan',async()=>{
 const lid=await ordinary();await db.exec(`reset role;insert into next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at) values('${inq}','방문','별도 방문 약속',now()+interval '5 days','담당','open',now())`);
 const before=await customerSnapshot();await as(owner);const a=await link(lid);
 assert.equal(a.linked,true);assert.equal(a.request.status,'done');assert.equal(a.next_action_id,id(70));
 const after=await customerSnapshot();assert.deepEqual({...after,links:0},before);assert.equal(after.links,1);
 await as(owner);const retry=await link(lid);assert.equal(retry.linked,false);assert.equal(retry.request.status,'done');assert.equal((await customerSnapshot()).links,1);
});

test('ordinary absence remains working, stores retry date, and repeated reconciliation changes nothing',async()=>{
 const lid=await ordinary('부재');const a=await link(lid);assert.equal(a.request.status,'working');assert.equal(a.request.next_due,due);assert.equal(a.request.closed_at,null);
 const before=await customerSnapshot();await as(owner);const b=await link(lid);assert.equal(b.replayed,true);assert.equal(b.linked,false);assert.deepEqual(await customerSnapshot(),before);
 assert.equal(before.state[0].first_connected_at,null);
});

test('contact ACK arriving before next-action ACK does not prematurely complete; later persisted task resolves same contact',async()=>{
 const lid=await ordinary('연결됨',{task:false});const a=await link(lid);assert.equal(a.reason,'followup_proof_missing');assert.equal(a.request.status,'sent');
 await db.exec(`reset role;insert into next_actions(id,inquiry_id,action_type,title,due_at,assignee_name,status,created_at) values('${id(70)}','${inq}','전화','고객 회신 확인','${due}'::date::timestamp at time zone 'Asia/Seoul','담당','open',clock_timestamp())`);
 await as(owner);assert.equal((await link(lid)).linked,true);const snapshot=await customerSnapshot();assert.equal(snapshot.logs.length,1);assert.equal(snapshot.tasks.length,1);
});

test('missing explicit result, unknown/foreign log and historical or reasked-before contact never complete',async()=>{
 const old=await ordinary('연결됨',{explicit:false});assert.equal((await link(old)).reason,'contact_proof_missing');
 await db.exec('reset role');await db.query("update crm_security.inquiry_contact_logs set contact_result='연결됨' where id=$1",[old]);await as(owner);
 assert.equal((await link(id(999))).reason,'contact_proof_missing');
 for(const change of ["occurred_at=now()-interval '1 day'","actor_user_id='"+other+"'","actor_auth_uid='"+other+"'","occurred_at='infinity'::timestamptz"]){
  await db.exec('reset role;begin');try{await db.exec('update crm_security.inquiry_contact_logs set '+change);await as(owner);assert.equal((await link(old)).linked,false);}finally{await db.exec('rollback;reset role');}
 }
 await db.exec("update crm_security.work_requests set reasked_at=clock_timestamp()+interval '1 second'");await as(owner);assert.equal((await link(old)).linked,false);
 assert.equal((await customerSnapshot()).links,0);
});

test('reassignment, admin proxy, trash, cancellation, stage conversion and compound objectives are guarded',async()=>{
 const lid=await ordinary();for(const actor of [admin,other]){await as(actor);await assert.rejects(link(lid),/forbidden/);}
 for(const change of ["status='실주'",`deal_id='${id(99)}'`,`qualified_at=now()`]){
  await db.exec('reset role;begin');try{await db.exec('update inquiries set '+change);await as(owner);assert.equal((await link(lid)).reason,'stage_review');}finally{await db.exec('rollback;reset role');}
 }
 await db.exec(`update crm_security.work_requests set asks='["고객 첫 연락","현장방문 필요 여부 확인"]'`);await as(owner);assert.equal((await link(lid)).reason,'unsupported_objectives');
 await db.exec("reset role;update crm_security.work_requests set status='cancelled'");await as(owner);assert.equal((await link(lid)).reason,'request_closed');
 await db.exec(`reset role;update inquiries set assigned_to='${other}'`);await as(owner);await assert.rejects(link(lid),/forbidden/);
 await db.exec(`reset role;update inquiries set assigned_to='${owner}';insert into crm_security.inquiry_audit_events(inquiry_id,action) values('${inq}','inquiry_trash')`);await as(owner);await assert.rejects(link(lid),/forbidden/);
 assert.equal((await customerSnapshot()).links,0);
});

test('changed, cancelled, ambiguous or old followup cannot be reused as completion evidence',async()=>{
 const lid=await ordinary();for(const change of ["title='다른 약속'","assignee_name='다른 담당'","status='cancelled'","due_at='infinity'::timestamptz","created_at=now()-interval '1 day'","status='completed',completed_at=null"]){
  await db.exec('reset role;begin');try{await db.exec('update next_actions set '+change);await as(owner);assert.equal((await link(lid)).reason,'followup_proof_missing');}finally{await db.exec('rollback;reset role');}
 }
 await db.exec(`insert into next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at) select inquiry_id,action_type,title,due_at,assignee_name,status,created_at from next_actions`);await as(owner);
 assert.equal((await link(lid)).reason,'followup_proof_missing');assert.equal((await customerSnapshot()).links,0);
});

test('older evidence cannot override a newer contact result; link insertion failure rolls back request status',async()=>{
 const lid=await ordinary();await db.exec('reset role;begin');try{
  await db.exec(`insert into crm_security.inquiry_contact_logs(inquiry_id,request_id,channel,result,contact_result,kind,content,occurred_at,actor_auth_uid,actor_user_id,actor_name)
   values('${inq}','${id(61)}','전화','부재','부재','attempt','최근 부재',clock_timestamp(),'${owner}','${owner}','담당')`);await as(owner);assert.equal((await link(lid)).reason,'newer_contact_exists');
 }finally{await db.exec('rollback;reset role');}
 await db.exec(`create function crm_security.fail_link() returns trigger language plpgsql as $$begin raise exception 'link failure';end$$;
 create trigger fail_link before insert on crm_security.work_request_contact_links for each row execute function crm_security.fail_link()`);
 try{await as(owner);await assert.rejects(link(lid),/link failure/);await db.exec('reset role');assert.equal((await db.query('select status from crm_security.work_requests')).rows[0].status,'sent');assert.equal((await customerSnapshot()).links,0);}
 finally{await db.exec('reset role;drop trigger fail_link on crm_security.work_request_contact_links;drop function crm_security.fail_link()');}
});

test('link proof is private and result-only/extra completion arguments cannot bypass persisted evidence',async()=>{
 await db.exec('reset role');
 for(const role of ['anon','authenticated','service_role']){
  assert.equal((await db.query("select has_table_privilege($1,'crm_security.work_request_contact_links','SELECT,INSERT,UPDATE,DELETE') allowed",[role])).rows[0].allowed,false);
 }
 for(const role of ['anon','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.crm_work_request_contact_link_v1(jsonb)','execute') allowed",[role])).rows[0].allowed,false);
 await as(owner);await assert.rejects(call({id:request,log_id:id(60),result:'연결됨'},'crm_work_request_contact_link_v1'),/invalid payload/);
});

test('actual WorkRequest client consumes the SQL serializer and ACK, preserving the existing customer task',async()=>{
 const lid=await ordinary();const source=await call({days:30},'crm_work_request_list_v1');
 // The production serializer is already installed by the two-results migration.
 await db.exec('reset role');const state=(await db.query('select crm_security.inquiry_flow_state_json($1) s',[inq])).rows[0].s;await as(owner);
 const calls=[],pending=[];const q={id:inq,assigned_to:owner};
 const R={G:{page:'today'},ME:{id:owner,name:'담당'},esc:String,escAttr:String,repN:String,paint(){},inqCtlFind:()=>q,
  CRMRelease:{has:()=>true},InquiryFlow:{server:()=>state},OpsStore:{has:()=>true,rpc:(fn,p)=>{calls.push(fn);const promise=call(p,fn);pending.push(promise);return promise;}}};
 vm.runInNewContext(readFileSync(new URL('../work-request.js',import.meta.url),'utf8'),{window:R,document:{addEventListener(){},getElementById:()=>null},Date,Map,Set,setTimeout(){}});
 Object.assign(R.WorkRequest.state(),{loaded:true,list:source.requests});R.WorkRequest.autoClose();
 await new Promise(setImmediate);for(let i=0;i<pending.length;i++){await pending[i];await new Promise(setImmediate);}
 assert.equal(R.WorkRequest.state().list[0].status,'done');assert.deepEqual(calls,['crm_work_request_contact_link_v1','crm_work_request_list_v1']);
 const after=await customerSnapshot();assert.equal(after.logs.length,1);assert.equal(after.tasks.length,1);assert.equal(after.tasks[0].status,'open');assert.equal(after.links,1);assert.equal(after.logs[0].id,lid);
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

test('followup candidates use actual IDs, bounded pages, matching owner and valid evidence only',async()=>{
 await connectedReview();await db.exec('reset role');
 for(let i=0;i<22;i++)await db.query(`insert into next_actions(id,inquiry_id,action_type,title,due_at,assignee_name,status) values($1,$2,'견적',$3,$4,'담당','open')`,[id(900+i),inq,'견적 '+i,due]);
 await db.exec(`insert into next_actions(inquiry_id,action_type,title,due_at,assignee_name,status) values('${inq}','견적','다른 담당',now(),'다른 담당','open'),('${inq}','방문','취소됨',now(),'담당','cancelled')`);
 await as(owner);const a=await readReview();assert.equal(a.candidate_total,22);assert.equal(a.followup_candidates.length,20);assert.equal(a.candidate_has_more,true);assert.equal(a.followup_candidates[0].plan_origin,'unknown');
 const b=await call({id:request,candidate_page:2},'crm_work_request_objectives_read_v1');assert.equal(b.followup_candidates.length,2);
 assert.equal(new Set([...a.followup_candidates,...b.followup_candidates].map(x=>x.id)).size,22);assert.equal(a.plan_context.token,b.plan_context.token);
 await as(other);await assert.rejects(readReview(),/forbidden/);await as(admin);assert.equal((await readReview()).can_write,false);
 await db.exec(`reset role;update inquiries set assigned_to='${other}'`);await as(owner);assert.equal((await readReview()).followup_candidates.length,0);
});

test('additional followup is atomic, returns a persisted ID and preserves original plans and request deadline',async()=>{
 const c=await connectedReview();const before=await customerSnapshot();await as(owner);const p=followupBody(c);const a=await followup(p);
 assert.equal(a.status,'created');assert.equal(a.plan_origin,'internal_plan');assert.ok(a.next_action_id);
 const current=await readReview();assert.equal(current.followup_candidates[0].id,a.next_action_id);assert.equal(current.followup_candidates[0].plan_origin,'internal_plan');
 const after=await customerSnapshot();assert.deepEqual(after.inquiries,before.inquiries);assert.deepEqual(after.logs,before.logs);assert.deepEqual(after.state,before.state);
 assert.deepEqual(after.tasks.filter(t=>t.id!==a.next_action_id),before.tasks);assert.equal(after.tasks.length,before.tasks.length+1);
 await as(owner);const replay=await followup(p);assert.equal(replay.replayed,true);assert.equal(replay.next_action_id,a.next_action_id);
 await assert.rejects(followup({...p,title:'바뀐 내용'}),/REQUEST_ID_REUSE/);
 const review=await readReview();await writeReview(reviewBody(review,{decisions:[{ask:allAsks[1],value:'needed',note:'견적 요청 확인',next_action_id:a.next_action_id},{ask:allAsks[2],value:'not_needed',note:'방문 불필요 확인'}]}));
 await db.exec('reset role');assert.equal((await db.query('select status from next_actions where id=$1',[a.next_action_id])).rows[0].status,'open');
});

test('explicit customer agreement is stored separately; existing tasks remain unknown',async()=>{
 const c=await connectedReview();await assert.rejects(followup(followupBody(c,{plan_origin:'customer_agreed',agreement_note:'  '})),/invalid plan evidence/);
 const a=await followup(followupBody(c,{plan_origin:'customer_agreed',agreement_note:'고객이 이 날짜에 견적 회신을 요청함'}));
 const n=(await readReview()).followup_candidates.find(n=>n.id===a.next_action_id);assert.equal(n.plan_origin,'customer_agreed');assert.equal(n.agreement_note,'고객이 이 날짜에 견적 회신을 요청함');assert.ok(n.source_recorded_at);
 await db.exec('reset role');await db.query('update next_actions set title=$1 where id=$2',['나중에 변경된 일정',a.next_action_id]);await as(owner);assert.equal((await readReview()).followup_candidates.find(n=>n.id===a.next_action_id).plan_origin,'unknown');
});

test('conflicting plans require explicit additional choice; stale snapshots reject with no writes',async()=>{
 const c=await connectedReview();await assert.rejects(followup(followupBody(c,{mode:'create'})),/REQUEST_PLAN_CONFLICT/);
 await db.exec("reset role;update next_actions set title='변경된 고객 일정'");await as(owner);
 await assert.rejects(followup(followupBody(c)),/REQUEST_PLAN_CHANGED/);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from crm_security.work_request_followup_events')).rows[0].n,0);await as(owner);
 const d=await readReview();await followup(followupBody(d));const e=await readReview();await assert.rejects(followup(followupBody(e,{operation_id:id(802)})),/REQUEST_FOLLOWUP_EXISTS/);
});

test('change request preserves original task and date, creates no followup evidence, and is readable to requester',async()=>{
 const c=await connectedReview(),before=await customerSnapshot();await as(owner);
 const a=await followup(followupBody(c,{mode:'request_change'}));assert.equal(a.status,'change_requested');assert.equal(a.next_action_id,null);
 assert.deepEqual(await customerSnapshot(),before);await as(admin);const context=await readReview();assert.equal(context.change_request_total,1);assert.equal(context.change_requests[0].event_id,a.event_id);
 await as(owner);await assert.rejects(writeReview(reviewBody(context,{decisions:[{ask:allAsks[1],value:'needed',note:'일정 변경 요청 중',next_action_id:a.event_id},{ask:allAsks[2],value:'not_needed',note:'방문 없음'}]})),/REQUEST_FOLLOWUP_REQUIRED/);
});

test('followup write rejects wrong owner, no contact proof, closed/stale request and stage conversion',async()=>{
 await compound();let c=await readReview();await assert.rejects(followup(followupBody(c)),/REQUEST_CONTACT_PROOF_REQUIRED/);
 await call2(body());c=await readReview();for(const actor of [admin,other]){await as(actor);await assert.rejects(followup(followupBody(c)),/forbidden/);}
 for(const change of ["update inquiries set status='실주'",`update inquiries set assigned_to='${other}'`,"update crm_security.work_requests set status='cancelled'","update crm_security.work_requests set updated_at=clock_timestamp()"]){
  await db.exec('reset role;begin');try{await db.exec(change);await as(owner);await assert.rejects(followup(followupBody(c)));}finally{await db.exec('rollback;reset role');}
 }
 for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_table_privilege($1,'crm_security.work_request_followup_events','SELECT,INSERT,UPDATE,DELETE') b",[role])).rows[0].b,false);
 for(const role of ['anon','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.crm_work_request_objective_followup_v1(jsonb)','execute') b",[role])).rows[0].b,false);
});

test('followup event failure rolls back newly inserted task',async()=>{
 const c=await connectedReview(),before=await customerSnapshot();await db.exec(`create function crm_security.fail_followup() returns trigger language plpgsql as $$begin raise exception 'synthetic failure';end$$;create trigger fail_followup before insert on crm_security.work_request_followup_events for each row execute function crm_security.fail_followup();`);
 try{await as(owner);await assert.rejects(followup(followupBody(c)),/synthetic failure/);assert.deepEqual(await customerSnapshot(),before);}finally{await db.exec('reset role;drop trigger fail_followup on crm_security.work_request_followup_events;drop function crm_security.fail_followup()');}
});

test('real client reads candidates and retries an acknowledged followup without optimistic state',async()=>{
 await connectedReview();const x=objectiveClient();const c=await x.R.WorkRequest.objectives.read(request);const p=followupBody(c);const a=await x.R.WorkRequest.objectives.followup.write(p);
 assert.ok(a.next_action_id);assert.equal(x.storage.size,0);const current=await x.R.WorkRequest.objectives.read(request);assert.equal(current.followup_candidates[0].id,a.next_action_id);
 assert.equal(current.request.status,'working');
});

test('lost followup ACK retries the identical operation after reload without duplicate tasks',async()=>{
 await connectedReview();const storage=new Map(),x=objectiveClient({storage,loseFollowupAck:true}),c=await x.api.read(request),p=followupBody(c);
 await assert.rejects(x.api.followup.write(p),/response lost/);assert.ok(x.api.followup.pending(request));
 await assert.rejects(x.api.followup.write({...p,title:'새 문구'}),/앞선 저장/);
 const before=await customerSnapshot();await as(owner);const y=objectiveClient({storage}),a=await y.api.followup.retry(request);
 assert.equal(a.replayed,true);assert.equal(storage.size,0);assert.deepEqual(await customerSnapshot(),before);
});

test('candidate pages, malformed source and unknown mode never bypass the server contract',async()=>{
 const c=await connectedReview();
 for(const candidate_page of [0,-1,1.5,'2',100001])await assert.rejects(call({id:request,candidate_page},'crm_work_request_objectives_read_v1'),/invalid/);
 for(const extra of [{mode:'replace'},{plan_origin:'assumed'},{due_date:'infinity'},{due_date:'2000-01-01'},{title:'\n\t '},{reason:' '},{plan_token:'guess'},{next_action_id:id(800)},{agreement_note:'고객 약속이라고 추정'}])await assert.rejects(followup(followupBody(c,extra)));
 const x=objectiveClient();await assert.rejects(x.api.followup.write(followupBody(c,{mode:'create'})),/REQUEST_PLAN_CONFLICT/);assert.equal(x.storage.size,0);
});
