import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
/* 직원 계정 관리 v2(2026-10-05): 계정 추가 · 계정 연결 · 임시 비밀번호(바꿔야 함 표시) · 비활성화 — 관리자만, 이력 기록, 삭제 없음 */
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const base=read('../supabase/migrations/20260924230000_admin_password_reset.sql');
const v2=read('../sql/admin-accounts-v2-20261005.sql');

const ADMIN='11111111-1111-4111-8111-111111111111',ADMIN_AUTH='aaaaaaaa-1111-4111-8111-111111111111';
const REP='22222222-2222-4222-8222-222222222222',REP_AUTH='bbbbbbbb-2222-4222-8222-222222222222';
const BRANCH='33333333-3333-4333-8333-333333333333',GONE='44444444-4444-4444-8444-444444444444';

test('계정 관리 v2: 관리자만 · 추가 · 연결 · 임시 비밀번호 · 비활성화 · 이력',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema crm_security; create schema auth; create schema extensions;
   create table public.users(user_id uuid primary key default gen_random_uuid(), name text not null unique, email text, role text not null default 'rep',
    active boolean not null default true, auth_uid uuid, created_at timestamptz default now(), updated_at timestamptz default now());
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
    ('${ADMIN}','송보람','admin',true,'${ADMIN_AUTH}'),('${REP}','이필선','rep',true,'${REP_AUTH}'),
    ('${BRANCH}','경남지사','rep',true,null),('${GONE}','주현진','rep',false,null);
   insert into auth.users(id,email,encrypted_password) values ('${ADMIN_AUTH}','admin@crm.netform.co.kr','old-admin'),('${REP_AUTH}','rep@crm.netform.co.kr','old-rep');
   insert into crm_security.access_review values
    ('${ADMIN}','${ADMIN_AUTH}','admin','admin',true,'seed',now(),'infinity'),('${REP}','${REP_AUTH}','rep','rep',true,'seed',now(),'infinity');
   insert into auth.sessions(user_id) values ('${REP_AUTH}'),('${ADMIN_AUTH}');
   insert into auth.refresh_tokens(user_id) values ('${REP_AUTH}'),('${ADMIN_AUTH}');
  `);
  await db.exec(base);
  await db.exec(v2);
  await db.exec(v2);/* 다시 실행해도 안전 */
  const as=uid=>db.exec(`select set_config('test.uid','${uid||''}',false);`);
  const one=async(sql,args)=>(await db.query(sql,args)).rows[0];
  const create=p=>one('select public.crm_admin_create_account_v1($1::jsonb) as r',[JSON.stringify(p)]).then(x=>x.r);
  const setActive=p=>one('select public.crm_admin_set_active_v1($1::jsonb) as r',[JSON.stringify(p)]).then(x=>x.r);
  const list=async()=>Object.fromEntries((await one('select public.crm_admin_list_accounts_v1() as r')).r.items.map(x=>[x.name,x]));
  const mine=()=>one('select public.crm_my_credential_state_v1() as r').then(x=>x.r);
  const events=async()=>(await db.query('select actor_name,target_name,action from crm_security.credential_events order by created_at,action')).rows.map(x=>x.actor_name+'>'+x.target_name+':'+x.action);
  const good={name:'박지훈',email:'ParkJihoon@crm.netform.co.kr',kind:'branch',team:'경남지사',temp_password:'NF-7K3Q-82MX'};

  /* 로그인 없음 · 영업사원은 전부 거절 */
  await as('');
  await assert.rejects(create(good),/forbidden/);
  await as(REP_AUTH);
  await assert.rejects(create(good),/forbidden/);
  await assert.rejects(setActive({user_id:BRANCH,active:false}),/forbidden/);
  await assert.rejects(list(),/forbidden/);

  /* 관리자: 입력 규칙 */
  await as(ADMIN_AUTH);
  await assert.rejects(create({...good,email:'not-an-email'}),/invalid payload/);
  await assert.rejects(create({...good,kind:'owner'}),/invalid payload/);
  await assert.rejects(create({...good,name:'  '}),/invalid payload/);
  await assert.rejects(create({...good,link_user_id:'nope'}),/invalid payload/);
  await assert.rejects(create({...good,temp_password:'short'}),/invalid new password/);
  await assert.rejects(create({...good,temp_password:'010-1234-5678'}),/invalid new password/);
  await assert.rejects(create({...good,email:'REP@crm.netform.co.kr'}),/email already used/);
  await assert.rejects(create({...good,name:'이필선'}),/name already used/);
  assert.equal((await one('select count(*)::int as n from auth.users')).n,2,'거절된 요청은 로그인 계정을 남기지 않는다');

  /* 계정 추가: 직원 줄 + 로그인 계정 + 권한 승인 + 바꿔야 함 표시 + 이력 */
  const made=await create(good);
  assert.equal(made.ok,true);assert.equal(made.policy,'admin-account-create-v1');assert.equal(made.linked,false);assert.equal(made.must_change,true);
  assert.equal(made.email,'parkjihoon@crm.netform.co.kr');
  const nu=await one(`select u.role,u.active,u.auth_uid,u.email from public.users u where u.user_id='${made.user_id}'`);
  assert.equal(nu.role,'rep');assert.equal(nu.active,true);assert.equal(nu.email,'parkjihoon@crm.netform.co.kr');
  const au=await one(`select * from auth.users where id='${nu.auth_uid}'`);
  assert.equal(au.encrypted_password,'hashed:NF-7K3Q-82MX:bfsalt');assert.equal(au.aud,'authenticated');assert.equal(au.role,'authenticated');
  assert.ok(au.email_confirmed_at);assert.equal(au.instance_id,'00000000-0000-0000-0000-000000000000');
  assert.deepEqual([au.confirmation_token,au.recovery_token,au.email_change_token_new,au.email_change],['','','','']);
  assert.deepEqual(au.raw_app_meta_data,{provider:'email',providers:['email']});
  const idn=await one(`select provider,provider_id,identity_data from auth.identities where user_id='${nu.auth_uid}'`);
  assert.equal(idn.provider,'email');assert.equal(idn.provider_id,nu.auth_uid);assert.equal(idn.identity_data.email,'parkjihoon@crm.netform.co.kr');
  const rv=await one(`select * from crm_security.access_review where user_id='${made.user_id}'`);
  assert.equal(rv.permission_role,'branch');assert.equal(rv.source_role,'rep');assert.equal(rv.approved,true);assert.equal(rv.reviewed_auth_uid,nu.auth_uid);assert.equal(rv.reviewed_by,'account-admin:송보람');
  let L=await list();
  assert.equal(L['박지훈'].kind,'branch');assert.equal(L['박지훈'].team,'경남지사');assert.equal(L['박지훈'].permission_role,'branch');assert.equal(L['박지훈'].must_change,true);assert.equal(L['박지훈'].linked,true);
  assert.equal(L['송보람'].self,true);assert.equal(L['송보람'].permission_role,'admin');assert.equal(L['송보람'].must_change,false);assert.equal(L['경남지사'].linked,false);assert.equal(L['경남지사'].permission_role,null);

  /* 새 계정으로 로그인: 권한이 실제로 통하고(지사), 임시 비밀번호를 바꿔야 표시가 풀린다 */
  await as(nu.auth_uid);
  assert.equal((await one('select permission_role from crm_security.actor()')).permission_role,'branch');
  assert.deepEqual({m:(await mine()).must_change},{m:true});
  assert.equal((await mine()).must_change,true,'바꾸기 전에는 다시 물어도 그대로');
  await assert.rejects(list(),/forbidden/);
  await db.exec(`update auth.users set encrypted_password='hashed:my-own-long-password:bfsalt' where id='${nu.auth_uid}'`);
  const cleared=await mine();
  assert.equal(cleared.must_change,false);assert.equal(cleared.cleared,true);
  assert.equal((await mine()).cleared,undefined,'한 번만 푼다');

  /* 계정 연결: 이미 있는 직원 줄에 로그인만 붙인다 — 이름은 바꾸지 않는다 */
  await as(ADMIN_AUTH);
  await assert.rejects(create({...good,email:'gone@crm.netform.co.kr',link_user_id:GONE}),/target not eligible/);
  await assert.rejects(create({...good,email:'x@crm.netform.co.kr',link_user_id:REP}),/target not eligible/);
  const linked=await create({name:'다른 이름',email:'gyeongnam@crm.netform.co.kr',kind:'branch',team:'경남지사',temp_password:'NF-AAAA-BBBB',link_user_id:BRANCH});
  assert.equal(linked.linked,true);assert.equal(linked.user_id,BRANCH);assert.equal(linked.name,'경남지사');
  const bu=await one(`select name,auth_uid,email from public.users where user_id='${BRANCH}'`);
  assert.equal(bu.name,'경남지사');assert.ok(bu.auth_uid);assert.equal(bu.email,'gyeongnam@crm.netform.co.kr');
  await assert.rejects(create({...good,email:'again@crm.netform.co.kr',link_user_id:BRANCH}),/target not eligible/);
  await as(bu.auth_uid);
  assert.equal((await one('select permission_role from crm_security.actor()')).permission_role,'branch');

  /* 비밀번호 재설정: 로그인 끊기 + 바꿔야 함 표시(본인 것은 안 됨) */
  await as(ADMIN_AUTH);
  await assert.rejects(one('select public.crm_admin_reset_password_v1($1,$2)',[ADMIN,'NF-CCCC-DDDD']),/use self password change/);
  const rs=(await one('select public.crm_admin_reset_password_v1($1,$2) as r',[REP,'NF-CCCC-DDDD'])).r;
  assert.equal(rs.policy,'admin-password-reset-v1');assert.equal(rs.must_change,true);assert.equal(String(rs.target_user_id),REP);
  assert.equal((await one(`select count(*)::int as n from auth.sessions where user_id='${REP_AUTH}'`)).n,0);
  assert.equal((await one(`select count(*)::int as n from auth.sessions where user_id='${ADMIN_AUTH}'`)).n,1);
  assert.equal((await list())['이필선'].must_change,true);
  await db.exec(`update auth.users set encrypted_password='hashed:changed-by-rep-123:bfsalt' where id='${REP_AUTH}'`);
  assert.equal((await list())['이필선'].must_change,false,'직원이 바꾼 뒤에는 목록에서도 풀려 보인다');

  /* 비활성화: 삭제하지 않는다 · 로그인 끊기 + 막기 · 본인은 안 됨 · 다시 활성화 */
  await db.exec(`insert into auth.sessions(user_id) values ('${REP_AUTH}'); insert into auth.refresh_tokens(user_id) values ('${REP_AUTH}');`);
  await assert.rejects(setActive({user_id:ADMIN,active:false}),/cannot change own account/);
  await assert.rejects(setActive({user_id:'nope',active:false}),/invalid payload/);
  await assert.rejects(setActive({user_id:REP}),/invalid payload/);
  const off=await setActive({user_id:REP,active:false});
  assert.equal(off.active,false);assert.equal(off.policy,'admin-account-active-v1');
  const ru=await one(`select u.active,a.banned_until>now()+interval '99 years' as b,isfinite(a.banned_until) as f from public.users u join auth.users a on a.id=u.auth_uid where u.user_id='${REP}'`);
  assert.equal(ru.active,false);assert.equal(ru.b,true,'다시 로그인하지 못하게 막는다');assert.equal(ru.f,true,'끝없는 날짜는 쓰지 않는다');
  assert.equal((await one(`select count(*)::int as n from auth.sessions where user_id='${REP_AUTH}'`)).n,0);
  assert.equal((await one(`select count(*)::int as n from auth.refresh_tokens where user_id='${REP_AUTH}'`)).n,0);
  assert.equal((await one(`select count(*)::int as n from public.users where user_id='${REP}'`)).n,1,'직원 줄은 남는다');
  assert.equal((await setActive({user_id:REP,active:false})).already,true);
  await assert.rejects(one('select public.crm_admin_reset_password_v1($1,$2)',[REP,'NF-EEEE-FFFF']),/target not eligible/);
  await as(REP_AUTH);
  assert.equal((await db.query('select 1 from crm_security.actor()')).rows.length,0,'비활성 계정은 권한이 통하지 않는다');
  await as(ADMIN_AUTH);
  const on=await setActive({user_id:REP,active:true});
  assert.equal(on.active,true);
  assert.equal((await one(`select banned_until from auth.users where id='${REP_AUTH}'`)).banned_until,null);
  assert.equal((await setActive({user_id:GONE,active:true})).active,true,'로그인 미연결 직원도 활성 · 비활성만 바꿀 수 있다');

  /* 이력: 누가 · 대상 · 무엇을 */
  const ev=await events();
  for(const want of ['송보람>박지훈:account_created','박지훈>박지훈:password_changed','송보람>경남지사:account_linked','송보람>이필선:password_reset','송보람>이필선:deactivated','송보람>이필선:reactivated','송보람>주현진:reactivated'])assert.ok(ev.includes(want),want+' 이력 없음: '+ev.join(' | '));
  assert.equal(ev.filter(x=>x.endsWith(':deactivated')).length,1,'이미 비활성인 계정은 이력을 또 남기지 않는다');

  /* 바깥에서는 못 부른다 */
  const acl=(await db.query(`select p.proname,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as auth,p.prosecdef
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('crm_admin_create_account_v1','crm_admin_set_active_v1','crm_my_credential_state_v1','crm_admin_reset_password_v1','crm_admin_list_accounts_v1')`)).rows;
  assert.equal(acl.length,5);
  for(const f of acl){assert.equal(f.anon,false,f.proname);assert.equal(f.auth,true,f.proname);assert.equal(f.prosecdef,true,f.proname);}
  for(const t of ['credential_state','account_profile'])assert.equal((await one(`select relrowsecurity as r from pg_class where oid='crm_security.${t}'::regclass`)).r,true,t);
 }finally{await db.close();}
});
