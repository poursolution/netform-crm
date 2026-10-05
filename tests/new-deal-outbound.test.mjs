import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
/* 새 영업 등록 v2(2026-10-05 design_handoff_new_deal): 기존 영업 생성 명령에 유입 구분 · 소개한 사람 · 연락처 하나 이상 · 역할 4종 · 첫 다음 행동을 더한다.
   예전 요청은 그대로 통과하고(유입 = direct_ui), 그 밖의 검사 · 중복 방지 · 감사 기록은 바뀌지 않는다. */
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const base=read('../sql/pipeline-opportunity-create/20260906/helper.sql');
const v2=read('../sql/new-deal-outbound-v1-20261005.sql');
const U=n=>`${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const ADMIN=U(1),ADMIN_AUTH=U('a'),REP=U(2),REP_AUTH=U('b'),DUAL=U(3),DUAL_AUTH=U('c'),BR=U(4),BR_AUTH=U('d');

test('새 영업 등록 v2: 유입 구분 · 연락처 하나 이상 · 역할 · 첫 다음 행동 — 예전 요청은 그대로',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema crm_security; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
   create table public.users(user_id uuid primary key, name text unique, email text, role text, active boolean default true, auth_uid uuid);
   create table crm_security.access_review(user_id uuid primary key, reviewed_auth_uid uuid, source_role text, permission_role text, approved boolean, expires_at timestamptz);
   create function crm_security.actor() returns table(user_id uuid, auth_uid uuid, display_name text, permission_role text) language sql stable as $$
    select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id
    where u.auth_uid=auth.uid() and u.active and r.approved and r.reviewed_auth_uid=u.auth_uid and r.source_role=u.role and r.expires_at>now() $$;
   create table crm_security.command_receipts(actor_auth_uid uuid, request_id uuid, actor_user_id uuid, operation text, object_id uuid, expected_version integer, payload jsonb, ack jsonb, created_at timestamptz, primary key(actor_auth_uid,request_id));
   create table public.sites(site_id uuid primary key default gen_random_uuid(), site_name text, norm_name text, address text);
   create table public.contacts(id uuid primary key default gen_random_uuid(), name text, title text, phone text, mobile text, role text, person_key text unique, current_site text, created_at timestamptz, updated_at timestamptz);
   create table public.deals(id uuid primary key, contact_id uuid, brand text, list_name text, stage_code text, assignee_name text, assignee_email text, amount bigint, source text, list_fields jsonb,
    created_at timestamptz, updated_at timestamptz, site_id uuid, owner_id uuid, lifecycle_status text, stage_entered_at timestamptz, last_activity_at timestamptz, opened_at timestamptz, version integer,
    service_type text, origin_business text, current_business text, office_phone text, office_email text, manager_name text, manager_mobile text, person_key text, manager_role text, manager_current_site text,
    manager_started_at date, manager_status text, primary_work text, work_items jsonb, work_scope_type text, work_summary text);
   create table public.contact_assignments(id uuid primary key default gen_random_uuid(), person_key text not null, opportunity_id uuid, site_name text not null, office_phone text, started_at date not null, status text, reason text, ended_at date);
   create unique index contact_assign_open on public.contact_assignments(person_key,site_name) where ended_at is null;
   create table public.activities(id uuid primary key default gen_random_uuid(), deal_id uuid, actor_email text, actor_name text, type text, detail jsonb, occurred_at timestamptz);
   create table public.next_actions(id uuid primary key default gen_random_uuid(), deal_id uuid, inquiry_id uuid, action_type text, title text not null, due_at timestamptz not null, assignee_name text not null, status text, source_activity_id uuid, created_at timestamptz, updated_at timestamptz);
   create table crm_security.object_scope(scope_id uuid primary key, user_id uuid, deal_id uuid, can_write boolean, reviewed_by text, expires_at timestamptz);
   create table crm_security.audit_events(event_id uuid primary key default gen_random_uuid(), actor_auth_uid uuid, actor_user_id uuid, actor_name text, deal_id uuid, action text, before_data jsonb, after_data jsonb, reason text, created_at timestamptz);
   insert into public.users values ('${ADMIN}','송보람','a@x','admin',true,'${ADMIN_AUTH}'),('${REP}','이필선','r@x','rep',true,'${REP_AUTH}'),('${DUAL}','황윤선','d@x','dual',true,'${DUAL_AUTH}'),('${BR}','경남지사','b@x','rep',true,'${BR_AUTH}');
   insert into crm_security.access_review values ('${ADMIN}','${ADMIN_AUTH}','admin','admin',true,'infinity'),('${REP}','${REP_AUTH}','rep','rep',true,'infinity'),('${DUAL}','${DUAL_AUTH}','dual','admin',true,'infinity'),('${BR}','${BR_AUTH}','rep','branch',true,'infinity');
  `);
  await db.exec(base);
  const md5=async()=>(await db.query(`select md5(regexp_replace(pg_get_functiondef('crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)'::regprocedure),'\\s+','','g')) as m`)).rows[0].m;
  assert.equal(await md5(),'2cbad0e5db376ca03547410c6bb8a2a4','저장소 원본 = 운영 원본(2026-10-05 읽기 전용 확인)');
  await db.exec(v2);
  const after=await md5();
  await db.exec(v2);/* 다시 실행해도 안전 */
  assert.equal(await md5(),after);
  const as=uid=>db.exec(`select set_config('test.uid','${uid||''}',false);`);
  let seq=0;const rid=()=>{seq++;const h=seq.toString(16).padStart(12,'0');return `99999999-9999-4999-8999-${h}`;};
  const run=async(p,id)=>{id=id||rid();return (await db.query('select crm_security.crm_opportunity_create_command_v1($1,$1,$2::jsonb) as r',[id,JSON.stringify(p)])).rows[0].r;};
  const one=async(sql,args)=>(await db.query(sql,args)).rows[0];
  const old={surface:'pc',name:'[서울 마포] 예전방식아파트',work_name:'옥상 방수',work_type:'우레탄',primary_work:'옥상>우레탄',work_items:['옥상>우레탄'],work_scope_type:'single',work_summary:'옥상 › 우레탄',
   brand:'POUR솔루션',owner:'이필선',reason:'직접 발굴한 현장',office_phone:'02-123-4567',manager_name:'김소장',manager_mobile:'010-1111-2222',manager_role:'관리소장',person_key:'mobile:01011112222',client_ref:'new-1'};

  /* 1) 예전 요청은 그대로: 유입 = direct_ui · PC 는 다음 행동을 만들지 않는다 */
  await as(REP_AUTH);
  const a1=await run(old);assert.equal(a1.ok,true);assert.equal(a1.next_action_id,null);
  const d1=await one('select * from public.deals where id=$1',[a1.new_opportunity_id]);
  assert.deepEqual([d1.source,d1.stage_code,d1.manager_role,d1.office_phone,d1.manager_mobile,d1.assignee_name,d1.list_fields.source_type],['direct_ui','first_contact','관리소장','021234567','01011112222','이필선',undefined]);

  /* 2) 소개 · 대표전화만 · 입대의 회장 · 첫 다음 행동 */
  const ref={...old,name:'[경기 수원] 소개받은아파트',client_ref:'new-2',brand:'POUR공법',manager_name:'박회장',manager_role:'입대의 회장',office_phone:'031-222-3333',person_key:'office:0312223333:박회장',
   source_type:'referral',referrer_name:'김OO 소장 · 동탄푸른마을',referrer_phone:'010-9999-8888',first_action_type:'현장방문',first_action_title:'1차 현장미팅',first_action_due:'2026-10-08'};
  delete ref.manager_mobile;
  const a2=await run(ref);assert.equal(a2.ok,true);assert.ok(a2.next_action_id,'첫 다음 행동이 바로 생긴다');
  const d2=await one('select * from public.deals where id=$1',[a2.new_opportunity_id]);
  assert.deepEqual([d2.source,d2.stage_code,d2.brand,d2.manager_role,d2.office_phone,d2.manager_mobile,d2.person_key],['referral','first_contact','POUR공법','입대의 회장','0312223333',null,'office:0312223333:박회장']);
  assert.deepEqual([d2.list_fields.source_type,d2.list_fields.referrer_name,d2.list_fields.referrer_phone,d2.list_fields.work_name],['referral','김OO 소장 · 동탄푸른마을','01099998888','옥상 방수']);
  const c2=await one('select * from public.contacts where id=$1',[d2.contact_id]);
  assert.deepEqual([c2.name,c2.title,c2.role,c2.phone,c2.mobile,c2.person_key],['박회장','입대의 회장','입대의 회장','0312223333',null,'office:0312223333:박회장']);
  const n2=await one('select action_type,title,due_at::date::text as due,assignee_name,status,deal_id from public.next_actions where id=$1',[a2.next_action_id]);
  assert.deepEqual([n2.action_type,n2.title,n2.due,n2.assignee_name,n2.status,n2.deal_id],['현장방문','1차 현장미팅','2026-10-08','이필선','open',a2.new_opportunity_id]);
  const au=await one(`select after_data from crm_security.audit_events where deal_id=$1`,[a2.new_opportunity_id]);
  assert.deepEqual([au.after_data.source_type,au.after_data.next_action_id],['referral',a2.next_action_id],'감사 기록에도 유입 구분');

  /* 3) 휴대폰만 · 아웃바운드 */
  const out={...old,name:'[인천] 아웃바운드현장',client_ref:'new-3',manager_mobile:'010-3333-4444',person_key:'mobile:01033334444',source_type:'outbound',first_action_type:'전화',first_action_title:'전화 · 니즈 확인',first_action_due:'2026-10-07'};
  delete out.office_phone;
  const a3=await run(out),d3=await one('select source,office_phone,manager_mobile from public.deals where id=$1',[a3.new_opportunity_id]);
  assert.deepEqual([d3.source,d3.office_phone,d3.manager_mobile],['outbound',null,'01033334444']);

  /* 4) 막는 것: 연락처 없음 · 사람 열쇠 불일치 · 역할 · 유입 구분 · 다음 행동 반쪽 · 모르는 칸 */
  const bad=(patch,drop)=>{const p={...ref,name:'[부산] 거절현장',client_ref:'bad-'+seq,...patch};(drop||[]).forEach(k=>delete p[k]);return run(p);};
  await assert.rejects(bad({person_key:'office::박회장'},['office_phone']),/invalid contact identity/);
  await assert.rejects(bad({person_key:'mobile:0312223333'}),/invalid contact identity/);
  await assert.rejects(bad({office_phone:'123',person_key:'office:123:박회장'}),/invalid contact identity/);
  await assert.rejects(bad({manager_role:'대표'}),/invalid opportunity create values/);
  await assert.rejects(bad({source_type:'inbound'}),/invalid opportunity create values/);
  await assert.rejects(bad({},['first_action_due']),/invalid opportunity create values/);
  await assert.rejects(bad({first_action_due:'10/8'}),/invalid opportunity create values/);
  await assert.rejects(bad({first_action_due:'2026-13-40'}),/invalid opportunity create values/);
  await assert.rejects(bad({extra:'x'}),/invalid opportunity create contract/);
  await assert.rejects(bad({},['manager_name']),/invalid opportunity create contract/);
  assert.equal((await one(`select count(*)::int as n from public.deals where list_fields->>'client_ref' like 'bad-%'`)).n,0,'거절된 요청은 아무것도 남기지 않는다');

  /* 5) 같은 요청을 다시 보내면 한 번만 만든다 */
  const id=rid(),p5={...out,name:'[대구] 재전송현장',client_ref:'new-5',manager_mobile:'010-5555-6666',person_key:'mobile:01055556666'};
  const x1=await run(p5,id),x2=await run(p5,id);assert.equal(x2.replayed,true);assert.equal(x2.new_opportunity_id,x1.new_opportunity_id);
  assert.equal((await one(`select count(*)::int as n from public.deals where list_fields->>'client_ref'='new-5'`)).n,1);

  /* 6) 같은 현장의 다른 공사: 현장은 하나, 영업건은 둘 */
  const again={...old,client_ref:'new-6',work_name:'지하주차장 재도장',work_type:'에폭시',primary_work:'지하주차장>에폭시',work_items:['지하주차장>에폭시'],work_summary:'지하주차장 › 에폭시',site_id:d1.site_id,source_type:'re_sales',first_action_type:'전화',first_action_title:'전화 · 니즈 확인',first_action_due:'2026-10-09'};
  const a6=await run(again),d6=await one('select site_id,source from public.deals where id=$1',[a6.new_opportunity_id]);
  assert.equal(d6.site_id,d1.site_id);assert.equal(d6.source,'re_sales');assert.equal((await one('select count(*)::int as n from public.sites where site_id=$1',[d1.site_id])).n,1);

  /* 7) 담당: 관리자 본인 · 겸직 영업은 되고, 지사 계정으로 넘기는 것은 안 된다 */
  await as(ADMIN_AUTH);
  const mine={...out,name:'[세종] 관리자담당현장',client_ref:'new-7',owner:'황윤선',manager_mobile:'010-7777-0000',person_key:'mobile:01077770000'};
  assert.equal((await run(mine)).ok,true);
  await assert.rejects(run({...mine,name:'[세종] 지사담당현장',client_ref:'new-8',owner:'경남지사',manager_mobile:'010-7777-0001',person_key:'mobile:01077770001'}),/owner is not an approved head-office rep/);

  /* 8) 표식 함수 · 바깥에서는 못 부른다 */
  assert.equal((await one('select public.crm_new_deal_contract_v1() as r')).r.policy,'new-deal-outbound-v1');
  await as('');await assert.rejects(db.query('select public.crm_new_deal_contract_v1()'),/forbidden/);await assert.rejects(run({...old,client_ref:'x'}),/forbidden/);
  const acl=await one(`select has_function_privilege('authenticated','crm_security.crm_opportunity_create_command_v1(uuid,uuid,jsonb)','EXECUTE') as a,has_function_privilege('anon','public.crm_new_deal_contract_v1()','EXECUTE') as b,has_function_privilege('authenticated','public.crm_new_deal_contract_v1()','EXECUTE') as c`);
  assert.deepEqual([acl.a,acl.b,acl.c],[false,false,true]);

  /* 9) 원본이 달라져 있으면 아무것도 바꾸지 않고 멈춘다 */
  await db.exec(`create or replace function crm_security.crm_opportunity_create_command_v1(p_request_id uuid,p_object_id uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $f$ begin return '{}'::jsonb; end $f$;`);
  await assert.rejects(db.exec(v2),/예상한 원본과 다릅니다/);
 }finally{await db.close();}
});
