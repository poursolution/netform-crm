const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('../../crm-security-lab/node_modules/@electric-sql/pglite');
const sql=name=>fs.readFileSync(path.join(__dirname,'../sql',name),'utf8');
const hardening=sql('20260905_crm_security_hardening.sql');
const rollback=sql('20260905_crm_security_rollback.sql');
const exportSql=sql('20260905_crm_export.sql');
const uid='10000000-0000-0000-0000-000000000001';
test('Postgres: read-only snapshot handles aggregates and an explicitly empty function ACL',async()=>{
 const db=await fixture();
 try{
  await db.exec("create schema storage; create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create aggregate public.fixture_sum(integer)(sfunc=int4pl,stype=integer,initcond='0'); revoke all on function public.crm_internal() from public,authenticated; revoke all on function public.crm_internal() from current_user;");
  await db.exec('begin read only');
  const results=await db.exec(sql('20260905_crm_security_snapshot.sql'));
  assert.ok(results.length>=9);await db.exec('commit');
  await manifest(db);await db.exec(hardening);await db.exec(rollback);
  assert.equal((await db.query("select has_function_privilege('anon','public.crm_internal()','execute') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
test('Postgres: inherited execute triggers postcondition and rolls back the entire migration',async()=>{
 const db=await fixture();
 try{
  await db.exec('create role inherited_reader; grant inherited_reader to anon; grant execute on function public.crm_internal() to inherited_reader;');
  await manifest(db);
  await assert.rejects(db.exec(hardening),/ACL postcondition failed/);await db.exec('rollback');
  // A different function that was processed earlier must also retain its original ACL.
  assert.equal((await db.query("select has_function_privilege('anon','public.crm_bundle()','execute') allowed")).rows[0].allowed,true);
 }finally{await db.close();}
});
test('Postgres: rollback refuses post-apply function drift without changing remaining ACLs',async()=>{
 const db=await fixture();
 try{
  await manifest(db);await db.exec(hardening);
  await db.exec('create or replace function public.crm_internal() returns int language sql security definer as $$select 999$$');
  await assert.rejects(db.exec(rollback),/Function changed after apply/);await db.exec('rollback');
  assert.equal((await db.query("select has_function_privilege('anon','public.crm_bundle()','execute') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
async function fixture(){
 const db=new PGlite();
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth to anon,authenticated,service_role;
 create table public.users(user_id uuid,auth_uid uuid,name text,role text,active boolean);
 insert into public.users values('${uid}','${uid}','Synthetic admin','admin',true);
 create table public.crm_users(user_id uuid primary key,role text,active boolean);
 insert into public.crm_users values('${uid}','admin',true);
 create function public.crm_bundle() returns jsonb language sql stable security definer as $$
 select '{"deals":[{"id":"fixture-only","site":"Synthetic site","brand":"TEST","stage":"open","created":"2026-09-01","manager_mobile":"never-export","notes":"never-export"}]}'::jsonb $$;
 create function public.crm_internal() returns int language sql security definer as $$select 1$$;
 grant execute on function public.crm_internal() to authenticated;
 `);
 return db;
}
async function manifest(db){
 await db.exec(`
 create temp table crm_security_expected as select p.oid::regprocedure::text signature,
 md5(pg_get_functiondef(p.oid)) definition_md5,md5(coalesce(p.proacl,acldefault('f',p.proowner))::text) acl_md5,
 p.proname='crm_export_create' allow_authenticated
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef;
 create temp table crm_security_expected_meta as select
 (select md5(coalesce(string_agg(row_to_json(p)::text,'|' order by schemaname,tablename,policyname),'')) from pg_policies p where schemaname in ('public','storage')) policy_md5,
 (select md5(coalesce(string_agg(row_to_json(d)::text,'|' order by defaclrole,defaclnamespace,defaclobjtype),'')) from pg_default_acl d) defaults_md5;
 `);
}
async function asRole(db,role,sub,claims,fn){
 await db.exec(`begin; set local role ${role};`);
 await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[sub||'',JSON.stringify(claims)]);
 try {const result=await fn();await db.exec('commit');return result;}
 catch(e){await db.exec('rollback');throw e;}
}
const filters={from:'2026-09-01',to:'2026-09-05',brand:'TEST',reason:'Synthetic test export',columns:['site','brand','stage','created'],limit:1};
const exportCall=(db,p=filters)=>db.query('select public.crm_export_create($1::jsonb) result',[JSON.stringify(p)]);
test('Postgres: exact ACL hardening and rollback preserve data and restore grants',async()=>{
 const db=await fixture();
 try{
  await manifest(db);await db.exec(hardening);await db.exec(hardening);
  for(const role of ['anon','authenticated'])await assert.rejects(asRole(db,role,null,{},()=>db.query('select public.crm_internal()')),e=>e.code==='42501');
  assert.equal((await asRole(db,'service_role',null,{},()=>db.query('select public.crm_internal() n'))).rows[0].n,1);
  await db.exec('create function public.future_function() returns int language sql as $$select 1$$');
  assert.equal((await db.query("select has_function_privilege('anon','public.future_function()','execute') allowed")).rows[0].allowed,false);
  await db.exec(rollback);
  assert.equal((await db.query("select has_function_privilege('anon','public.crm_internal()','execute') allowed")).rows[0].allowed,true);
  await db.exec('create function public.after_rollback() returns int language sql as $$select 1$$');
  assert.equal((await db.query("select has_function_privilege('anon','public.after_rollback()','execute') allowed")).rows[0].allowed,true);
  assert.equal((await db.query('select count(*)::int n from public.users')).rows[0].n,1);
 }finally{await db.close();}
});
test('Postgres: missing manifest and definition drift abort before ACL changes',async()=>{
 const db=await fixture();
 try{
  await assert.rejects(db.exec(hardening),/manifest required/);await db.exec('rollback');
  await manifest(db);
  await db.exec('create or replace function public.crm_internal() returns int language sql security definer as $$select 2$$');
  await assert.rejects(db.exec(hardening),/mismatch/);await db.exec('rollback');
  assert.equal((await db.query("select has_function_privilege('anon','public.crm_internal()','execute') allowed")).rows[0].allowed,true);
 }finally{await db.close();}
});
test('Postgres: export DB role + membership + aal2 + audit + column projection + rate limit',async()=>{
 const db=await fixture();
 try{
  await db.exec(exportSql);await manifest(db);await db.exec(hardening);
  await assert.rejects(asRole(db,'anon',null,{},()=>exportCall(db)),e=>e.code==='42501');
  await assert.rejects(asRole(db,'authenticated',uid,{aal:'aal1'},()=>exportCall(db)),e=>e.code==='42501');
  await db.query("update public.crm_users set role='rep'");
  await assert.rejects(asRole(db,'authenticated',uid,{aal:'aal2',role:'admin'},()=>exportCall(db)),e=>e.code==='42501');
  await db.query("update public.crm_users set role='admin',active=false");
  await assert.rejects(asRole(db,'authenticated',uid,{aal:'aal2'},()=>exportCall(db)),e=>e.code==='42501');
  await db.query("update public.crm_users set active=true");
  await assert.rejects(asRole(db,'authenticated',uid,{aal:'aal2'},()=>exportCall(db,{...filters,columns:['manager_mobile']})),e=>e.code==='22023');
  await assert.rejects(asRole(db,'authenticated',uid,{aal:'aal2'},()=>exportCall(db,{...filters,actor_name:'spoof'})),e=>e.code==='22023');
  const result=(await asRole(db,'authenticated',uid,{aal:'aal2'},()=>exportCall(db))).rows[0].result;
  assert.equal(result.actor_id,uid);assert.ok(result.audit_id);assert.equal(result.rows.length,1);
  assert.deepEqual(Object.keys(result.rows[0]).sort(),filters.columns.toSorted());
  const audit=(await db.query('select * from crm_private.export_audit')).rows;
  assert.equal(audit.length,1);assert.equal(audit[0].actor_id,uid);
  await assert.rejects(asRole(db,'authenticated',uid,{aal:'aal2'},()=>db.query('delete from crm_private.export_audit')),e=>e.code==='42501');
  await assert.rejects(asRole(db,'authenticated',uid,{aal:'aal2'},()=>exportCall(db)),e=>e.code==='P0001');
 }finally{await db.close();}
});
