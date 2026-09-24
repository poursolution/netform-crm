import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration=read('../supabase/migrations/20260924230000_admin_password_reset.sql');
const rollback=read('../sql/admin-password-reset-rollback.sql');

const ADMIN='11111111-1111-4111-8111-111111111111',ADMIN_AUTH='aaaaaaaa-1111-4111-8111-111111111111';
const REP='22222222-2222-4222-8222-222222222222',REP_AUTH='bbbbbbbb-2222-4222-8222-222222222222';
const NOAUTH='33333333-3333-4333-8333-333333333333';

test('admin password reset: admin-only, eligibility, session revocation, audit log and rollback',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema crm_security; create schema auth; create schema extensions;
   create table public.users(user_id uuid primary key, auth_uid uuid, name text, role text, active boolean not null default true);
   create table auth.users(id uuid primary key, email text, encrypted_password text, updated_at timestamptz, last_sign_in_at timestamptz);
   create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid);
   create table auth.refresh_tokens(id serial primary key, user_id varchar);
   create function extensions.gen_salt(t text) returns text language sql as $$ select 'bfsalt' $$;
   create function extensions.crypt(p text, s text) returns text language sql as $$ select 'hashed:'||p||':'||s $$;
   create table crm_security.test_actor(user_id uuid, auth_uid uuid, display_name text, permission_role text);
   create function crm_security.actor() returns table(user_id uuid, auth_uid uuid, display_name text, permission_role text)
    language sql stable as $$ select * from crm_security.test_actor $$;
   insert into public.users values
    ('${ADMIN}','${ADMIN_AUTH}','송보람','admin',true),
    ('${REP}','${REP_AUTH}','이필선','rep',true),
    ('${NOAUTH}',null,'미연결사원','rep',true);
   insert into auth.users values ('${ADMIN_AUTH}','admin@x','old-admin',now()),('${REP_AUTH}','rep@x','old-rep',now());
   insert into auth.sessions(user_id) values ('${REP_AUTH}'),('${REP_AUTH}'),('${ADMIN_AUTH}');
   insert into auth.refresh_tokens(user_id) values ('${REP_AUTH}'),('${ADMIN_AUTH}');
  `);
  await db.exec(migration);
  const asActor=(uid,auth,name,role)=>db.exec(`delete from crm_security.test_actor; insert into crm_security.test_actor values ${uid?`('${uid}','${auth}','${name}','${role}')`:'(null,null,null,null) limit 0'};`);
  const reset=(target,pw)=>db.query('select public.crm_admin_reset_password_v1($1,$2) as r',[target,pw]);

  // 비관리자·미인증 거부
  await db.exec('delete from crm_security.test_actor;');
  await assert.rejects(reset(REP,'temp-password-1'),/forbidden/);
  await asActor(REP,REP_AUTH,'이필선','rep');
  await assert.rejects(reset(ADMIN,'temp-password-1'),/forbidden/);

  // 관리자: 검증 규칙
  await asActor(ADMIN,ADMIN_AUTH,'송보람','admin');
  await assert.rejects(reset(REP,'short'),/invalid new password/);
  await assert.rejects(reset(NOAUTH,'temp-password-1'),/target not eligible/);
  await assert.rejects(reset(ADMIN,'temp-password-1'),/use self password change/);

  // 정상 재설정: 해시 교체 + 대상 세션·토큰만 무효화 + 감사 기록
  const ack=(await reset(REP,'01012345678')).rows[0].r;
  assert.equal(ack.ok,true);assert.equal(ack.policy,'admin-password-reset-v1');assert.equal(ack.target_name,'이필선');
  const pw=(await db.query(`select encrypted_password from auth.users where id='${REP_AUTH}'`)).rows[0].encrypted_password;
  assert.equal(pw,'hashed:01012345678:bfsalt');
  assert.equal((await db.query(`select count(*)::int as n from auth.sessions where user_id='${REP_AUTH}'`)).rows[0].n,0);
  assert.equal((await db.query(`select count(*)::int as n from auth.sessions where user_id='${ADMIN_AUTH}'`)).rows[0].n,1);
  assert.equal((await db.query(`select count(*)::int as n from auth.refresh_tokens where user_id='${REP_AUTH}'`)).rows[0].n,0);
  const log=(await db.query('select actor_name,target_name,action from crm_security.credential_events')).rows;
  assert.deepEqual(log,[{actor_name:'송보람',target_name:'이필선',action:'password_reset'}]);

  // 계정 목록: 관리자 전용, linked/self 플래그
  const list=(await db.query('select public.crm_admin_list_accounts_v1() as r')).rows[0].r;
  assert.equal(list.policy,'admin-accounts-v1');
  const byName=Object.fromEntries(list.items.map(x=>[x.name,x]));
  assert.equal(byName['송보람'].self,true);
  assert.equal(byName['이필선'].linked,true);
  assert.equal(byName['미연결사원'].linked,false);
  await asActor(REP,REP_AUTH,'이필선','rep');
  await assert.rejects(db.query('select public.crm_admin_list_accounts_v1()'),/forbidden/);

  // 롤백: 함수 제거 · 감사 기록 보존 · 재실행 무해
  await db.exec(rollback);
  await db.exec(rollback);
  assert.equal((await db.query("select to_regprocedure('public.crm_admin_reset_password_v1(uuid,text)') as p")).rows[0].p,null);
  assert.equal((await db.query('select count(*)::int as n from crm_security.credential_events')).rows[0].n,1);
 }finally{await db.close();}
});
