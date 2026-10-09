import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
