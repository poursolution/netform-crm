import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
/* 직원 계정 관리 v3(2026-10-22): 역할 · 소속 변경 + 외부 영업이사 명단 관리 — 관리자만, 본인 제외, 권한 즉시 반영, 이력, 삭제 없음 */
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const base=read('../supabase/migrations/20260924230000_admin_password_reset.sql');
const v2=read('../sql/admin-accounts-v2-20261005.sql');
const v3=read('../sql/admin-accounts-v3-20261022.sql');

const ADMIN='11111111-1111-4111-8111-111111111111',ADMIN_AUTH='aaaaaaaa-1111-4111-8111-111111111111';
const REP='22222222-2222-4222-8222-222222222222',REP_AUTH='bbbbbbbb-2222-4222-8222-222222222222';
const DUAL='55555555-5555-4555-8555-555555555555',DUAL_AUTH='cccccccc-5555-4555-8555-555555555555';
const BRANCH='33333333-3333-4333-8333-333333333333',GONE='44444444-4444-4444-8444-444444444444';

test('계정 관리 v3: 역할 변경 · 영업이사 명단',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema crm_security; create schema auth; create schema extensions;
   create table public.users(user_id uuid primary key default gen_random_uuid(), name text not null unique, email text, role text not null default 'rep',
    active boolean not null default true, auth_uid uuid, created_at timestamptz default now(), updated_at timestamptz default now());
   create table public.inquiries(id uuid primary key default gen_random_uuid(), assignee_name text, assigned_to uuid, status text);
   create table auth.users(id uuid primary key, instance_id uuid, aud varchar, role varchar, email varchar, encrypted_password varchar, email_confirmed_at timestamptz,
    raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz,
    confirmation_token varchar, recovery_token varchar, email_change_token_new varchar, email_change varchar, is_sso_user boolean not null default false, is_anonymous boolean not null default false);
   create table auth.identities(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), provider_id text not null, provider text not null,
    identity_data jsonb not null, created_at timestamptz, updated_at timestamptz, unique(provider_id,provider));
   create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid);
   create table auth.refresh_tokens(id serial primary key, user_id varchar);
   create table crm_security.access_review(user_id uuid primary key references public.users(user_id), reviewed_auth_uid uuid not null unique, source_role text not null,
    permission_role text not null check(permission_role in('rep','consultation','branch','admin')), approved boolean not null, reviewed_by text not null, reviewed_at timestamptz not null, expires_at timestamptz not null);
   create function extensions.gen_salt(t text) returns text language sql as $$ select 'bfsalt' $$;
   create function extensions.gen_salt(t text, n integer) returns text language sql as $$ select 'bfsalt' $$;
   create function extensions.crypt(p text, s text) returns text language sql as $$ select 'hashed:'||p||':'||s $$;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
   create function crm_security.actor() returns table(user_id uuid, auth_uid uuid, display_name text, permission_role text) language sql stable as $$
    select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id
    where u.auth_uid=auth.uid() and u.active and r.approved and r.reviewed_auth_uid=u.auth_uid and r.source_role=u.role and r.expires_at>now() $$;
   insert into public.users(user_id,name,role,active,auth_uid) values
    ('${ADMIN}','송보람','admin',true,'${ADMIN_AUTH}'),('${REP}','이필선','rep',true,'${REP_AUTH}'),('${DUAL}','황윤선','dual',true,'${DUAL_AUTH}'),
    ('${BRANCH}','경남지사','rep',true,null),('${GONE}','주현진','rep',false,null);
   insert into auth.users(id,email,encrypted_password) values ('${ADMIN_AUTH}','admin@crm.netform.co.kr','a'),('${REP_AUTH}','rep@crm.netform.co.kr','r'),('${DUAL_AUTH}','dual@crm.netform.co.kr','d');
   insert into crm_security.access_review values
    ('${ADMIN}','${ADMIN_AUTH}','admin','admin',true,'seed',now(),'infinity'),('${REP}','${REP_AUTH}','rep','rep',true,'seed',now(),'infinity'),('${DUAL}','${DUAL_AUTH}','dual','admin',true,'seed',now(),'infinity');
   insert into auth.sessions(user_id) values ('${REP_AUTH}'),('${ADMIN_AUTH}'),('${DUAL_AUTH}');
   insert into auth.refresh_tokens(user_id) values ('${REP_AUTH}'),('${ADMIN_AUTH}'),('${DUAL_AUTH}');
   create table crm_security.sales_directors(name text primary key check (length(btrim(name)) between 1 and 40), active boolean not null default true, created_at timestamptz not null default now());
   insert into crm_security.sales_directors(name) values ('전용성'),('조성용');
   insert into public.inquiries(assignee_name,assigned_to,status) values ('전용성',null,'배정완료'),('전용성',null,'종결'),('조성용',null,'응대중');
  `);
  await db.exec(base);await db.exec(v2);await db.exec(v3);await db.exec(v3);/* 다시 실행해도 안전 */
  const as=uid=>db.exec(`select set_config('test.uid','${uid||''}',false);`);
  const one=async(sql,args)=>(await db.query(sql,args)).rows[0];
  const setRole=p=>one('select public.crm_admin_set_role_v1($1::jsonb) as r',[JSON.stringify(p)]).then(x=>x.r);
  const dirList=async()=>(await one('select public.crm_admin_director_list_v1() as r')).r;
  const dirSet=p=>one('select public.crm_admin_director_set_v1($1::jsonb) as r',[JSON.stringify(p)]).then(x=>x.r);
  const perm=async uid=>{await as(uid);const r=await db.query('select permission_role from crm_security.actor()');return r.rows[0]?r.rows[0].permission_role:null;};
  const list=async()=>{await as(ADMIN_AUTH);return Object.fromEntries((await one('select public.crm_admin_list_accounts_v1() as r')).r.items.map(x=>[x.name,x]));};

  /* 로그인 없음 · 영업사원은 거절 */
  await as('');await assert.rejects(setRole({user_id:REP,kind:'lead'}),/forbidden/);await assert.rejects(dirList(),/forbidden/);
  await as(REP_AUTH);await assert.rejects(setRole({user_id:DUAL,kind:'rep'}),/forbidden/);await assert.rejects(dirSet({name:'고영운'}),/forbidden/);

  /* 역할 변경: 입력 규칙 · 본인 제외 · 비활성 제외 */
  await as(ADMIN_AUTH);
  await assert.rejects(setRole({user_id:'nope',kind:'lead'}),/invalid payload/);
  await assert.rejects(setRole({user_id:REP,kind:'owner'}),/invalid payload/);
  await assert.rejects(setRole({user_id:ADMIN,kind:'rep'}),/cannot change own account/);
  await assert.rejects(setRole({user_id:GONE,kind:'rep'}),/target not eligible/);

  /* 영업사원 → 팀장: 권한은 rep 그대로, 꼬리표 · 소속만 */
  let r=await setRole({user_id:REP,kind:'lead',team:'본사 영업'});
  assert.equal(r.policy,'admin-account-role-v1');assert.equal(r.kind,'lead');assert.equal(r.permission_role,'rep');assert.equal(r.session_cleared,false);
  let L=await list();assert.equal(L['이필선'].kind,'lead');assert.equal(L['이필선'].team,'본사 영업');assert.equal(L['이필선'].permission_role,'rep');
  assert.equal(await perm(REP_AUTH),'rep');
  assert.equal((await one(`select count(*)::int as n from auth.sessions where user_id='${REP_AUTH}'`)).n,1,'권한이 그대로면 로그인을 끊지 않는다');

  /* 영업사원 → 지사: 서버 권한이 바로 branch */
  await as(ADMIN_AUTH);r=await setRole({user_id:REP,kind:'branch',team:'경남지사'});
  assert.equal(r.permission_role,'branch');assert.equal(await perm(REP_AUTH),'branch');
  await as(ADMIN_AUTH);r=await setRole({user_id:REP,kind:'admin',team:'영업관리'});
  assert.equal(r.permission_role,'admin');assert.equal(await perm(REP_AUTH),'admin');
  assert.equal((await one(`select role from public.users where user_id='${REP}'`)).role,'admin');

  /* 대표 겸직(admin 권한) → 영업사원: 권한 내리기 = 로그인 끊기 */
  await as(ADMIN_AUTH);r=await setRole({user_id:DUAL,kind:'rep',team:'본사 영업'});
  assert.equal(r.permission_role,'rep');assert.equal(r.session_cleared,true);
  assert.equal((await one(`select count(*)::int as n from auth.sessions where user_id='${DUAL_AUTH}'`)).n,0);
  assert.equal((await one(`select count(*)::int as n from auth.refresh_tokens where user_id='${DUAL_AUTH}'`)).n,0);
  assert.equal(await perm(DUAL_AUTH),'rep');
  assert.equal((await one(`select role from public.users where user_id='${DUAL}'`)).role,'rep');

  /* 로그인 미연결 직원: 꼬리표 · users.role 만(권한 승인은 연결 때) */
  await as(ADMIN_AUTH);r=await setRole({user_id:BRANCH,kind:'branch',team:'경남지사'});
  assert.equal(r.permission_role,null);assert.equal((await one(`select count(*)::int as n from crm_security.access_review where user_id='${BRANCH}'`)).n,0);
  L=await list();assert.equal(L['경남지사'].kind,'branch');

  /* 영업이사 명단: 목록(배정 중 건수) · 추가 · 비활성 · 다시 활성 · 메모 · 직원 이름 금지 · 삭제 없음 */
  await as(ADMIN_AUTH);
  let D=await dirList();assert.equal(D.policy,'admin-directors-v1');
  assert.deepEqual(D.items.map(x=>[x.name,x.active,x.assigned_open]),[['전용성',true,1],['조성용',true,1]]);
  await assert.rejects(dirSet({name:'  '}),/invalid payload/);
  await assert.rejects(dirSet({name:'이필선'}),/name already used/);
  r=await dirSet({name:' 고영운 ',note:'외부 영업 · 경기 남부'});
  assert.equal(r.created,true);assert.equal(r.name,'고영운');assert.equal(r.action,'added');assert.equal(r.active,true);
  assert.equal((await dirSet({name:'고영운'})).already,true,'같은 상태면 이력을 또 남기지 않는다');
  r=await dirSet({name:'조성용',active:false});assert.equal(r.action,'deactivated');assert.equal(r.active,false);
  D=await dirList();assert.deepEqual(D.items.map(x=>[x.name,x.active]),[['전용성',true],['고영운',true],['조성용',false]]);
  assert.equal(D.items.find(x=>x.name==='고영운').note,'외부 영업 · 경기 남부');
  r=await dirSet({name:'조성용',active:true});assert.equal(r.action,'activated');
  r=await dirSet({name:'전용성',note:'본사 협력'});assert.equal(r.action,'noted');
  assert.equal((await one('select count(*)::int as n from crm_security.sales_directors')).n,3,'지우지 않는다');
  const ev=(await db.query('select actor_name,director_name,action from crm_security.director_events order by created_at')).rows.map(x=>x.actor_name+'>'+x.director_name+':'+x.action);
  assert.deepEqual(ev,['송보람>고영운:added','송보람>조성용:deactivated','송보람>조성용:activated','송보람>전용성:noted']);
  const ce=(await db.query("select target_name,action from crm_security.credential_events where action='role_changed' order by created_at")).rows.map(x=>x.target_name);
  assert.deepEqual(ce,['이필선','이필선','이필선','황윤선','경남지사']);
 }finally{await db.close();}
});
