/* 잔디 응대 페이지(n8n) → CRM 연락 결과 · 견적 발송 · 영업건 전환 (20261109120000). 실제 SQL 을 PGlite 로 돌린다. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {PGlite}=require('@electric-sql/pglite');
const mig=f=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',f),'utf8');
const migration=mig('20261109120000_inquiry_external_response_contact_quote.sql');
const deployedQueue=fs.readFileSync(path.join(__dirname,'fixtures/inquiry-change-events-v1.deployed-20261004.sql'),'utf8');
const twoResults=fs.readFileSync(path.join(__dirname,'../sql/inquiry-contact-two-results-20261007.sql'),'utf8');
const OWNER='10000000-0000-4000-8000-000000000001',OWNER_AUTH='20000000-0000-4000-8000-000000000001';
const NOLOGIN='10000000-0000-4000-8000-000000000003',CONSULT='10000000-0000-4000-8000-000000000004',CONSULT_AUTH='20000000-0000-4000-8000-000000000004';

async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema crm_security; create schema private;
 grant usage on schema private to service_role;
 create table users(user_id uuid primary key,auth_uid uuid,name text,email text,active boolean default true,role text default 'sales');
 create table inquiries(id uuid primary key default gen_random_uuid(),assigned_to uuid,assignee_name text,status text,brand text,inquiry_type text,work_type text,raw jsonb,
  deal_id uuid,opportunity_id uuid,qualified_at timestamptz,next_action_date date,close_reason text,updated_at timestamptz,phone text,sheet_row integer,
  received_at timestamptz,created_at timestamptz default now(),responded_at timestamptz,first_response_at timestamptz,site_name text,site_id uuid,address text);
 create table sites(site_id uuid primary key default gen_random_uuid(),site_name text,norm_name text,address text);
 create table deals(id uuid primary key,brand text,list_name text,stage_code text,stage_raw text,stage_group text,assignee_name text,assignee_email text,amount bigint,
  source text,list_fields jsonb,created_at timestamptz,updated_at timestamptz,site_id uuid,owner_id uuid,origin_inquiry_id uuid,lifecycle_status text,stage_entered_at timestamptz,
  last_activity_at timestamptz,opened_at timestamptz,version integer,service_type text,origin_business text,current_business text,organization_id uuid);
 create table next_actions(id uuid primary key default gen_random_uuid(),inquiry_id uuid,action_type text,title text,due_at timestamptz,assignee_name text,status text,created_at timestamptz,updated_at timestamptz);
 create table stage_history(id uuid primary key default gen_random_uuid(),opportunity_id uuid,inquiry_id uuid,from_stage text,to_stage text,reason text,actor_id uuid,actor_name text,changed_at timestamptz);
 create table activities(id uuid primary key default gen_random_uuid(),deal_id uuid,organization_id uuid,actor_email text,actor_name text,type text,detail jsonb,occurred_at timestamptz);
 create table crm_security.access_review(user_id uuid,reviewed_auth_uid uuid,source_role text,approved boolean,expires_at timestamptz,permission_role text);
 create table crm_security.audit_events(event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid not null,actor_user_id uuid,actor_name text,deal_id uuid,action text,before_data jsonb,after_data jsonb,reason text,created_at timestamptz);
 create table crm_security.inquiry_audit_events(event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid not null,actor_user_id uuid,inquiry_id uuid,action text,before_data jsonb,after_data jsonb,reason text,created_at timestamptz default now());
 alter table crm_security.inquiry_audit_events add constraint inquiry_audit_events_action_check check(action in ('field_update','inquiry_trash','inquiry_restore','inquiry_pipeline_promote'));
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql as $$select u.user_id,u.auth_uid,u.name,current_setting('test.role',true) from public.users u where u.name=current_setting('test.name',true)$$;
 create function crm_security.can_inquiry(x uuid) returns boolean language sql as $$select true$$;
 create function crm_security.crm_site_common_key_v1(p_name text) returns text language sql immutable strict set search_path='' as $fn$
  select pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.btrim(p_name),'\\[[^]]*\\]','','g'),'아파트',''),'[[:space:]]+','','g'))$fn$;
 create function crm_security.crm_site_pc_key_v1(p_name text) returns text language sql immutable strict set search_path='' as $fn$ select pg_catalog.replace(crm_security.crm_site_common_key_v1(p_name),'현장','')$fn$;
 create function crm_security.crm_site_mobile_key_v1(p_name text) returns text language sql immutable strict set search_path='' as $fn$
  select pg_catalog.regexp_replace(pg_catalog.regexp_replace(crm_security.crm_site_common_key_v1(p_name),'apt','','gi'),'[-_.,]','','g')$fn$;
 create function public.crm_inquiry_assignment_sync_v1(p jsonb) returns jsonb language sql as $$select '{"ok":true,"reason":"ASSIGNED"}'::jsonb$$;
 insert into users(user_id,auth_uid,name,email,role) values
  ('${OWNER}','${OWNER_AUTH}','이필선','rep1@example.test','sales'),
  ('${NOLOGIN}',null,'로그인없음',null,'sales'),
  ('${CONSULT}','${CONSULT_AUTH}','상담담당','c@example.test','consult');
 insert into crm_security.access_review values
  ('${OWNER}','${OWNER_AUTH}','sales',true,now()+interval '30 days','rep'),
  ('${CONSULT}','${CONSULT_AUTH}','consult',true,now()+interval '30 days','consultation');`);
 for(const f of ['20261005035250_inquiry_flow_audit_actions.sql','20261005035439_inquiry_flow_draft_audit.sql','20261005034655_inquiry_flow_runtime.sql'])await db.exec(mig(f));
 await db.exec(twoResults);await db.exec(deployedQueue);
 return db;
}
let phoneSeq=0;
async function inquiry(db,{owner=OWNER,status='배정완료',site=null,siteId=null}={}){
 const n=++phoneSeq,phone='0101234'+String(1000+n);site=site||'테스트현장'+n+'아파트';
 const id=(await db.query("insert into inquiries(assigned_to,status,brand,raw,phone,site_name,site_id,work_type,updated_at) values($1,$2,'POUR솔루션','{}',$3,$4,$5,'옥상방수',now()-interval '1 hour') returning id",[owner,status,phone,site,siteId])).rows[0].id;
 return {id,phone};
}
let seq=0;
const enqueue=(db,q,extra={})=>db.query("select set_config('request.jwt.claim.role','service_role',false); ").then(()=>db.query('select public.crm_inquiry_change_enqueue_v1($1::jsonb) r',[JSON.stringify({
 event_id:'n8n:test:'+(++seq)+':response',kind:'response',phone:q.phone,brand:'POUR솔루션',occurred_at:new Date().toISOString(),
 status:'전화응대 완료',response_content:'[연동 테스트·고객 아님] 시험 응대',...extra})])).then(r=>r.rows[0].r);
const state=async(db,id)=>(await db.query('select * from crm_security.inquiry_flow_state where inquiry_id=$1',[id])).rows[0];
const one=async(db,sql,args)=>(await db.query(sql,args)).rows[0];

test('without the new fields the queue behaves as before',async()=>{
 const db=await setup();
 await db.exec(migration);await db.exec(migration);
 const q=await inquiry(db);
 const r=await enqueue(db,q);
 assert.equal(r.status,'applied');assert.equal(r.reason,'RESPONSE_SYNCED');
 assert.equal((await one(db,'select count(*)::int n from crm_security.inquiry_contact_logs')).n,0);
 const i=await one(db,'select status,raw from inquiries where id=$1',[q.id]);
 assert.equal(i.status,'전화응대 완료');assert.match(i.raw['응대내용'],/시험 응대/);
});

test('contact result fills first attempt / first connected once, 문자 is recorded as 회신대기',async()=>{
 const db=await setup();await db.exec(migration);
 const q=await inquiry(db);
 let r=await enqueue(db,q,{contact_result:'부재',status:'응대중'});
 assert.equal(r.status,'applied');
 let s=await state(db,q.id);assert.ok(s.first_attempt_at);assert.equal(s.attempt_count,1);assert.equal(s.first_connected_at,null);
 const firstAttempt=s.first_attempt_at;
 r=await enqueue(db,q,{contact_result:'문자',status:'응대중'});assert.equal(r.status,'applied');
 s=await state(db,q.id);assert.equal(s.attempt_count,1);
 r=await enqueue(db,q,{contact_result:'연결됨'});assert.equal(r.status,'applied');
 r=await enqueue(db,q,{contact_result:'회신 받음'});assert.equal(r.status,'applied');
 s=await state(db,q.id);assert.ok(s.first_connected_at);assert.equal(s.connected_count,2);assert.deepEqual(s.first_attempt_at,firstAttempt);
 const logs=(await db.query('select channel,result,contact_result,kind,actor_name,content from crm_security.inquiry_contact_logs where inquiry_id=$1 order by occurred_at',[q.id])).rows;
 assert.deepEqual(logs.map(l=>[l.channel,l.result,l.contact_result,l.kind]),[['전화','부재','부재','attempt'],['문자','회신대기',null,'wait'],['전화','연결됨','연결됨','connected'],['전화','고객 회신','고객 회신','connected']]);
 assert.ok(logs.every(l=>l.actor_name==='이필선'&&/시험 응대/.test(l.content)));
 assert.equal((await one(db,"select count(*)::int n from crm_security.inquiry_audit_events where action='flow_contact_log' and inquiry_id=$1",[q.id])).n,4);
 r=await enqueue(db,q,{contact_result:'번호 오류'});assert.equal(r.status,'applied');
 assert.equal((await one(db,"select contact_result from crm_security.inquiry_contact_logs where inquiry_id=$1 and result='번호오류'",[q.id])).contact_result,'번호오류');
});

test('invalid new fields are refused before anything is stored',async()=>{
 const db=await setup();await db.exec(migration);
 const q=await inquiry(db),before=(await one(db,'select count(*)::int n from private.inquiry_change_events')).n;
 const tomorrow=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 await assert.rejects(enqueue(db,q,{contact_result:'통화함'}),/INVALID_CONTACT_RESULT/);
 await assert.rejects(enqueue(db,q,{quote_sent_on:tomorrow}),/INVALID_QUOTE_DATE/);
 await assert.rejects(enqueue(db,q,{quote_sent_on:'2026-13-01'}),/INVALID_QUOTE_DATE/);
 await assert.rejects(enqueue(db,q,{quote_amount:3000000}),/QUOTE_AMOUNT_WITHOUT_DATE/);
 await assert.rejects(enqueue(db,q,{quote_sent_on:new Date().toISOString().slice(0,10),quote_amount:-5}),/INVALID_QUOTE_AMOUNT/);
 await assert.rejects(enqueue(db,q,{quote_sent_on:new Date().toISOString().slice(0,10),status:'배드핏'}),/QUOTE_ON_CLOSED_STATUS/);
 assert.equal((await one(db,'select count(*)::int n from private.inquiry_change_events')).n,before);
 await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
 await assert.rejects(db.query("select private.inquiry_external_flow_apply_v1($1,'{\"contact_result\":\"부재\"}'::jsonb,'x',now())",[q.id]),/SERVICE_ROLE_REQUIRED/);
});

test('quote sent date → 견적 발송 완료 → 파이프라인 컨설팅 설계 영업건',async()=>{
 const db=await setup();await db.exec(migration);
 const q=await inquiry(db,{status:'현장방문예정'});
 const day=new Date(Date.now()-3*86400000+9*3600000).toISOString().slice(0,10);
 const r=await enqueue(db,q,{contact_result:'연결됨',status:'견적서 발송예정',quote_sent_on:day,quote_amount:'12500000'});
 assert.equal(r.status,'applied');assert.equal(r.reason,'RESPONSE_SYNCED');
 const i=await one(db,'select status,qualified_at,next_action_date::text d,raw from inquiries where id=$1',[q.id]);
 assert.equal(i.status,'견적서 발송완료');assert.ok(i.qualified_at);assert.equal(i.raw['진행상태'],'견적서 발송완료');
 const s=await state(db,q.id);assert.equal(s.qualified_by,'quote_sent');assert.ok(s.quote_sent_at);assert.ok(s.first_connected_at);
 const v=await one(db,'select version_no,amount::text a,sent_at,author_name from crm_security.inquiry_quote_versions where inquiry_id=$1',[q.id]);
 assert.equal(v.version_no,1);assert.equal(v.a,'12500000');assert.equal(v.author_name,'이필선');
 const na=(await db.query("select title,status,(due_at at time zone 'Asia/Seoul')::date::text d from next_actions where inquiry_id=$1",[q.id])).rows;
 assert.equal(na.length,1);assert.equal(na[0].title,'고객 반응 확인');assert.equal(na[0].status,'open');assert.equal(i.d,na[0].d);
 const d=await one(db,'select * from deals where origin_inquiry_id=$1',[q.id]);
 assert.equal(d.stage_code,'consulting');assert.equal(d.stage_group,'design');assert.equal(d.owner_id,OWNER);assert.equal(String(d.amount),'12500000');assert.equal(d.source,'inquiry_promotion');
 assert.equal((await one(db,'select to_stage from stage_history where inquiry_id=$1',[q.id])).to_stage,'consulting');
 assert.equal((await one(db,"select count(*)::int n from crm_security.inquiry_audit_events where inquiry_id=$1 and action in ('flow_quote_send','inquiry_pipeline_promote')",[q.id])).n,2);
 // 전환된 뒤의 응대 저장은 기존 규칙대로 손대지 않고 검토로
 const after=await enqueue(db,q,{contact_result:'연결됨'});assert.equal(after.status,'review');assert.equal(after.reason,'CONVERTED_REVIEW');
 assert.equal((await one(db,'select count(*)::int n from deals')).n,1);
});

test('blocked promotion keeps the quote and leaves the inquiry ready for the conversion list',async()=>{
 const db=await setup();await db.exec(migration);
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 // 담당이 승인된 본사 영업이 아님
 const c=await inquiry(db,{owner:CONSULT});
 let r=await enqueue(db,c,{quote_sent_on:today});
 assert.equal(r.status,'applied');assert.equal(r.reason,'RESPONSE_SYNCED_CONVERSION_REVIEW');
 assert.equal((await state(db,c.id)).qualified_by,'quote_sent');
 assert.equal((await one(db,'select status from inquiries where id=$1',[c.id])).status,'견적서 발송완료');
 assert.equal((await one(db,'select count(*)::int n from crm_security.inquiry_quote_versions where inquiry_id=$1',[c.id])).n,0);
 // 현장 이름이 애매함
 await db.exec("insert into sites(site_name) values('[A]공통현장'),('공통현장 아파트')");
 const a=await inquiry(db,{site:'공통현장'});
 r=await enqueue(db,a,{quote_sent_on:today,quote_amount:1000000});
 assert.equal(r.reason,'RESPONSE_SYNCED_CONVERSION_REVIEW');
 assert.equal((await one(db,'select count(*)::int n from deals')).n,0);
 const ev=await one(db,"select payload from private.inquiry_change_events where inquiry_id=$1",[a.id]);assert.ok(ev);
 // 담당 CRM 로그인이 없으면 연락 결과 · 견적은 건너뛰고 응대만 저장
 const n=await inquiry(db,{owner:NOLOGIN});
 r=await enqueue(db,n,{contact_result:'부재',quote_sent_on:today});
 assert.equal(r.status,'applied');assert.equal(r.reason,'RESPONSE_SYNCED_FLOW_REVIEW');
 assert.equal((await one(db,'select count(*)::int n from crm_security.inquiry_contact_logs where inquiry_id=$1',[n.id])).n,0);
 assert.equal((await one(db,'select status from inquiries where id=$1',[n.id])).status,'전화응대 완료');
});

test('migration refuses an unexpected function body and changes nothing',async()=>{
 const db=await setup();
 await db.exec("create or replace function public.crm_inquiry_change_apply_v1(p_event_id text) returns jsonb language plpgsql security invoker set search_path='' as $$ begin return '{}'::jsonb; end $$;");
 await assert.rejects(db.exec(migration),/Unexpected definition of public.crm_inquiry_change_apply_v1/);
 const body=(await one(db,"select pg_get_functiondef('public.crm_inquiry_change_enqueue_v1(jsonb)'::regprocedure) d")).d;
 assert.equal(body.includes('inquiry_external_flow_v1'),false);
});
