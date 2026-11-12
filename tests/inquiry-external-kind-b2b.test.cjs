/* 잔디 배정 · 응대 페이지 「문의 성격: 견적 / B2B」 → CRM (sql/inquiry-external-kind-b2b-v1-20261112.sql).
   운영과 같은 순서로 깐다: #738 마이그레이션 → 11/10 응대 상태로 영업건 SQL → 이번 SQL. 실제 SQL 을 PGlite 로 돌린다. */
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

const onContact=fs.readFileSync(path.join(__dirname,'../sql/inquiry-external-promote-on-contact-v1-20261110.sql'),'utf8');
const kindSql=fs.readFileSync(path.join(__dirname,'../sql/inquiry-external-kind-b2b-v1-20261112.sql'),'utf8');
const kindRollback=fs.readFileSync(path.join(__dirname,'../sql/inquiry-external-kind-b2b-v1-20261112-rollback.sql'),'utf8');
const FNS=['public.crm_inquiry_change_enqueue_v1(jsonb)','public.crm_inquiry_change_apply_v1(text)','private.inquiry_external_promote_v1(uuid,text)','private.inquiry_external_promote_v2(uuid,text,text)'];
const marks=async db=>{let n=0;for(const f of FNS){const d=(await one(db,'select pg_get_functiondef($1::regprocedure) d',[f])).d;n+=d.split('inquiry_external_kind_v1').length-1;}return n;};
const bodies=async db=>{const o={};for(const f of FNS)o[f]=(await one(db,'select pg_get_functiondef($1::regprocedure) d',[f])).d;return o;};
async function ready(){const db=await setup();await db.exec(migration);await db.exec(onContact);return db;}
const withRaw=async(db,q,raw,work='옥상방수')=>db.query('update inquiries set raw=$2,work_type=$3 where id=$1',[q.id,JSON.stringify(raw),work]);
const inq=async(db,id)=>one(db,'select work_type,raw,status from inquiries where id=$1',[id]);
const deals=async(db,id)=>(await one(db,'select count(*)::int n from deals where origin_inquiry_id=$1',[id])).n;
const assign=(db,q,extra={})=>db.query("select set_config('request.jwt.claim.role','service_role',false)").then(()=>db.query('select public.crm_inquiry_change_enqueue_v1($1::jsonb) r',[JSON.stringify({
 event_id:'n8n:test:'+(++seq)+':assign',kind:'assign',phone:q.phone,brand:'POUR솔루션',occurred_at:new Date().toISOString(),to:'이필선',...extra})])).then(r=>r.rows[0].r);

test('applies once on top of #738 + 11/10, marks 4 functions, idempotent',async()=>{
 const db=await ready();
 await db.exec(kindSql);await db.exec(kindSql);
 assert.equal(await marks(db),4);
 // 문의 성격이 없으면 지금과 같다: 응대 상태로 영업건(11/10)
 const q=await inquiry(db);await withRaw(db,q,{'공사유형':'옥상방수'});
 const r=await enqueue(db,q);assert.equal(r.status,'applied');assert.equal(r.reason,'RESPONSE_SYNCED');
 assert.equal(await deals(db,q.id),1);
 assert.equal((await inq(db,q.id)).work_type,'옥상방수');
});

test('B2B: work_type · 공사유형 앞에 협약/B2B, 영업건 안 만듦 / 견적으로 돌리면 떼고 영업건',async()=>{
 const db=await ready();await db.exec(kindSql);
 const q=await inquiry(db);await withRaw(db,q,{'공사유형':'옥상방수'});
 let r=await enqueue(db,q,{inquiry_kind:'B2B'});
 assert.equal(r.status,'applied');assert.equal(r.reason,'RESPONSE_SYNCED');
 let i=await inq(db,q.id);
 assert.equal(i.work_type,'협약/B2B · 옥상방수');assert.equal(i.raw['공사유형'],'협약/B2B · 옥상방수');assert.equal(i.raw['문의성격'],'B2B');assert.equal(i.status,'전화응대 완료');
 assert.equal(await deals(db,q.id),0);
 const audit=await one(db,"select after_data from crm_security.inquiry_audit_events where inquiry_id=$1 and action='flow_field_set'",[q.id]);
 assert.equal(audit.after_data.field,'inquiry_kind');assert.equal(audit.after_data.value,'B2B');
 // 같은 B2B 다시 → 바뀐 것 없음(감사 기록 1건 그대로)
 r=await enqueue(db,q,{inquiry_kind:'B2B',status:'보류'});assert.equal(r.status,'applied');
 assert.equal((await one(db,"select count(*)::int n from crm_security.inquiry_audit_events where inquiry_id=$1 and action='flow_field_set'",[q.id])).n,1);
 // 견적으로 돌림 → 붙인 말만 뗌, 응대 상태로 영업건
 r=await enqueue(db,q,{inquiry_kind:'견적'});assert.equal(r.status,'applied');
 i=await inq(db,q.id);assert.equal(i.work_type,'옥상방수');assert.equal(i.raw['공사유형'],'옥상방수');assert.equal(i.raw['문의성격'],'견적');
 assert.equal(await deals(db,q.id),1);
});

test('B2B 문의는 견적 날짜 · 응대 상태 어느 쪽으로도 영업건 안 됨, 견적 날짜와 같이 오면 거부',async()=>{
 const db=await ready();await db.exec(kindSql);
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const q=await inquiry(db);await withRaw(db,q,{'공사유형':'옥상방수'});
 const before=(await one(db,'select count(*)::int n from private.inquiry_change_events')).n;
 await assert.rejects(enqueue(db,q,{inquiry_kind:'B2B',quote_sent_on:today}),/QUOTE_ON_B2B/);
 await assert.rejects(enqueue(db,q,{inquiry_kind:'협약'}),/INVALID_INQUIRY_KIND/);
 await assert.rejects(enqueue(db,q,{inquiry_kind:1}),/INVALID_INQUIRY_KIND/);
 assert.equal((await one(db,'select count(*)::int n from private.inquiry_change_events')).n,before);
 // 이미 B2B 로 바뀐 문의에 문의 성격 없이 견적 날짜가 오면: 견적 기록은 남되 영업건은 안 만듦(전환 검토로도 안 남김)
 await enqueue(db,q,{inquiry_kind:'B2B',status:'보류'});
 const r=await enqueue(db,q,{quote_sent_on:today,status:'전화응대 완료'});
 assert.equal(r.status,'applied');assert.equal(r.reason,'RESPONSE_SYNCED');
 assert.equal(await deals(db,q.id),0);
 // 원래 공사유형에 '협약'이 있는 예전 문의도 잔디 응대로 영업건 안 됨
 const old=await inquiry(db);await withRaw(db,old,{'공사유형':'협약 문의'},'협약');
 assert.equal((await enqueue(db,old)).reason,'RESPONSE_SYNCED');assert.equal(await deals(db,old.id),0);
 // 그 문의를 견적으로 고르면 '협약' 글자는 그대로 두되 영업건으로 넘어감
 await enqueue(db,old,{inquiry_kind:'견적'});
 const o=await inq(db,old.id);assert.equal(o.work_type,'협약');assert.equal(o.raw['문의성격'],'견적');assert.equal(await deals(db,old.id),1);
});

test('배정 이벤트도 문의 성격을 받는다',async()=>{
 const db=await ready();await db.exec(kindSql);
 const q=await inquiry(db);await withRaw(db,q,{'공사유형':'도장'},'도장');
 const r=await assign(db,q,{inquiry_kind:'B2B'});assert.equal(r.status,'applied');
 assert.equal((await inq(db,q.id)).work_type,'협약/B2B · 도장');
 await assert.rejects(assign(db,q,{inquiry_kind:'기타'}),/INVALID_INQUIRY_KIND/);
});

test('되돌리기 SQL 은 덧붙인 줄만 빼서 원래 본문으로',async()=>{
 const db=await ready();const orig=await bodies(db);
 await db.exec(kindSql);await db.exec(kindRollback);await db.exec(kindRollback);
 assert.equal(await marks(db),0);assert.deepEqual(await bodies(db),orig);
 const q=await inquiry(db);const r=await enqueue(db,q,{inquiry_kind:'B2B'});assert.equal(r.status,'applied');
 assert.equal((await inq(db,q.id)).work_type,'옥상방수');
});

test('본문이 예상과 다르면 아무것도 안 바꾸고 멈춘다',async()=>{
 const db=await ready();
 await db.exec("create or replace function private.inquiry_external_promote_v2(p_inquiry_id uuid,p_event_id text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ begin return '{}'::jsonb; end $$;");
 const orig=await bodies(db);
 await assert.rejects(db.exec(kindSql),/Unexpected definition of private.inquiry_external_promote_v2/);
 assert.equal(await marks(db),0);assert.deepEqual(await bodies(db),orig);
});