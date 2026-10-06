const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {PGlite}=require('@electric-sql/pglite');
const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261005034655_inquiry_flow_runtime.sql'),'utf8');
test('runtime executes all commands, preserves source data and enforces ownership/lifecycle',async()=>{
 const db=new PGlite();let checks=0;
 try{
 await db.exec(`create role anon; create role authenticated; create schema crm_security;
 create table users(user_id uuid primary key,auth_uid uuid,name text);
 create table inquiries(id uuid primary key default gen_random_uuid(),assigned_to uuid,status text,brand text,inquiry_type text,work_type text,raw jsonb,deal_id uuid,opportunity_id uuid,qualified_at timestamptz,next_action_date date,close_reason text,updated_at timestamptz);
 create table deals(id uuid primary key);
 create table next_actions(id uuid primary key default gen_random_uuid(),inquiry_id uuid,action_type text,title text,due_at timestamptz,assignee_name text,status text,created_at timestamptz,updated_at timestamptz);
 create table crm_security.inquiry_audit_events(event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid,actor_user_id uuid,inquiry_id uuid,action text,before_data jsonb,after_data jsonb,reason text,created_at timestamptz default now());
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql as $$select u.user_id,u.auth_uid,u.name,current_setting('test.role',true) from public.users u where u.name=current_setting('test.name',true)$$;
 create function crm_security.can_inquiry(x uuid) returns boolean language sql as $$select exists(select 1 from crm_security.actor() a join public.inquiries i on i.id=x where a.permission_role='admin' or (a.permission_role in ('rep','consultation') and i.assigned_to=a.user_id))$$;
 insert into users values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','owner'),('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','other');
 set test.name='owner'; set test.role='rep';`);
 await db.exec("alter table crm_security.inquiry_audit_events add constraint inquiry_audit_events_action_check check(action in ('field_update','inquiry_trash','inquiry_restore'))");
 for(const file of ['20261005035250_inquiry_flow_audit_actions.sql','20261005035439_inquiry_flow_draft_audit.sql']){
  const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8');await db.exec(sql);await db.exec(sql);
 }
 await assert.rejects(db.query("insert into crm_security.inquiry_audit_events(action) values('arbitrary_action')"),/inquiry_audit_events_action_check/);
 await db.exec(migration);await db.exec(migration);
 const twoSql=fs.readFileSync(path.join(__dirname,'../sql/inquiry-contact-two-results-20261007.sql'),'utf8');
 await db.exec(twoSql);await db.exec(twoSql);
 const add=async(status='배정완료',raw={})=>(await db.query("insert into inquiries(assigned_to,status,brand,raw) values('10000000-0000-4000-8000-000000000001',$1,'POUR솔루션',$2) returning id",[status,JSON.stringify(raw)])).rows[0].id;
 const q=await add(),other=await add();
 await db.query("update inquiries set assigned_to='10000000-0000-4000-8000-000000000002' where id=$1",[other]);
 const call=async(type,fields={},id=q)=>(await db.query('select public.crm_inquiry_command_v1($1::jsonb) r',[JSON.stringify({type,inquiry_id:id,...fields})])).rows[0].r;
 const rid='30000000-0000-4000-8000-000000000001';
 let a=await call('contact_log',{request_id:rid,result:'부재'});assert.equal(a.state.attempt_count,1);assert.equal(a.state.first_connected_at,null);checks++;
 a=await call('contact_log',{request_id:rid,result:'부재'});assert.equal(a.replayed,true);assert.equal(a.state.attempt_count,1);checks++;
 await assert.rejects(call('contact_log',{request_id:rid,result:'연결됨'}),/REQUEST_ID_REUSE/);checks++;
 await assert.rejects(call('field_set',{field:'phone_handler',value:'test'},other),/담당자 또는 관리자/);checks++;
 a=await call('contact_log',{request_id:'30000000-0000-4000-8000-000000000002',result:'연결됨',content:'실제 통화 결과'});let first=a.state.first_connected_at;assert.ok(first);checks++;
 a=await call('contact_log',{request_id:'30000000-0000-4000-8000-000000000003',result:'자료요청'});assert.equal(a.state.first_connected_at,first);checks++;
 a=await call('quote_send',{request_id:'30000000-0000-4000-8000-000000000004',amount:1000000,draft:true});assert.equal(a.state.qualified_at,null);assert.equal(a.state.quotes[0].sent_at,null);assert.equal(a.state.schedules.length,0);checks++;
 a=await call('quote_send',{request_id:'30000000-0000-4000-8000-000000000005',amount:1000000,draft:false});assert.equal(a.state.quotes.length,1);assert.ok(a.state.quotes[0].sent_at);assert.equal(a.state.qualified_by,'quote_sent');assert.equal(a.state.schedules[0].type,'quote_followup');checks++;
 const day=(await db.query("select (clock_timestamp() at time zone 'Asia/Seoul')::date::text d")).rows[0].d;
 a=await call('schedule_set',{schedule_type:'meeting',at:day});assert.equal(a.state.meeting_date,day);checks++;
 a=await call('field_set',{field:'phone_handler',value:'담당 테스트'});assert.equal(a.state.phone_handler,'담당 테스트');checks++;
 a=await call('visit',{date:day,done:true});assert.ok(a.state.visit_done_at);assert.equal(a.state.qualified_by,'quote_sent');checks++;
 
 // Both fields round trip without altering legacy classification/first-contact time.
 for(const [contact,reaction,result] of [['고객 회신','자료요청','자료요청'],['연결됨','','연결됨'],['부재','','부재'],['번호오류','','번호오류'],['연결됨','거절','거절']]){
  const request_id=require('node:crypto').randomUUID();
  const payload={request_id,contact_result:contact,customer_reaction:reaction,result};
  const saved=await call('contact_log',payload),log=saved.state.logs.find(l=>l.request_id===request_id);
  assert.equal(log.contact_result,contact);assert.equal(log.customer_reaction,reaction||null);assert.equal(log.result,result);
  assert.equal(saved.state.first_connected_at,first);
  assert.equal((await call('contact_log',payload)).replayed,true);
  if(contact==='고객 회신')await assert.rejects(call('contact_log',{...payload,contact_result:'연결됨'}),/REQUEST_ID_REUSE/);
  checks++;
 }
 for(const fields of [
  {contact_result:'부재',customer_reaction:'거절',result:'거절'},
  {contact_result:'연결됨',customer_reaction:'자료 요청',result:'자료요청'},
  {contact_result:'연결됨',customer_reaction:'보류',result:'검토중'},
  {customer_reaction:'거절',result:'거절'},
  {contact_result:'통화불가',result:'통화불가'}]){
  await assert.rejects(call('contact_log',{request_id:require('node:crypto').randomUUID(),...fields}),/invalid payload/);checks++;
 }
 const legacy=(await call('contact_log',{request_id:require('node:crypto').randomUUID(),result:'회신대기'})).state.logs;
 assert.ok(legacy.some(l=>l.result==='회신대기'&&l.contact_result===null&&l.customer_reaction===null));checks++;
 a=await call('close',{kind:'consult_end',reason:'타사 선택'});assert.equal(a.status,'종결');assert.equal((await db.query("select count(*)::int n from next_actions where inquiry_id=$1 and status='open'",[q])).rows[0].n,0);checks++;
 await assert.rejects(call('quote_send',{amount:1}),/이미 종결/);checks++;
 const b2b=await add('배정완료',{문의내용:'기술 공법 협약 문의'});await assert.rejects(call('close',{kind:'consult_end',reason:'단순 문의'},b2b),/B2B/);checks++;
 const trash=await add();await db.query("insert into crm_security.inquiry_audit_events(inquiry_id,action) values($1,'inquiry_trash')",[trash]);await assert.rejects(call('field_set',{field:'phone_handler',value:'test'},trash),/찾을 수 없습니다/);checks++;
 await db.exec("set test.name='other';set test.role='rep'");let l=(await db.query("select public.crm_inquiry_flow_list_v1('{}') r")).rows[0].r;assert.equal(l.states.length,0);assert.equal(l.closed.length,0);checks++;
 await db.exec("set test.name='none'");await assert.rejects(call('field_set',{field:'phone_handler',value:'test'}),/forbidden/);await assert.rejects(db.query("select public.crm_inquiry_flow_list_v1('{}')"),/forbidden/);checks++;
 const perms=(await db.query("select has_function_privilege('anon','public.crm_inquiry_command_v1(jsonb)','execute') anon,has_function_privilege('authenticated','public.crm_inquiry_command_v1(jsonb)','execute') auth,has_table_privilege('authenticated','crm_security.inquiry_contact_logs','select') direct")).rows[0];assert.deepEqual(perms,{anon:false,auth:true,direct:false});checks++;
 assert.equal((await db.query('select count(*)::int n from deals')).rows[0].n,0);checks++;
 console.log('Assertions passed:',checks);
 }finally{await db.close();}
});

