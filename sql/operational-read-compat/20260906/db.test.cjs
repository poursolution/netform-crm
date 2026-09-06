'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bundle=require('../../operational-bundle/20260906/build.cjs');
const approval="SET crm.operational_read_compat_ref='rprechiaglyjaydkmxsu';\n";
const candidate=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8'),rollback=fs.readFileSync(path.join(__dirname,'rollback.sql'),'utf8');
async function meta(db){return (await db.query("SELECT oid,md5(pg_get_functiondef(oid)) body,pg_get_userbyid(proowner) owner,prosecdef,provolatile,proconfig,proacl::text acl,pronargs,proargtypes::text argtypes FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure")).rows[0];}

test('decision candidate and rollback are exact no-change gates',async()=>{
 const db=await bundle.setup();try{
  await db.exec(bundle.approval+bundle.compose());
  const before=await meta(db),functions=(await db.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='public'::regnamespace")).rows[0].n;
  await db.exec(approval+candidate);assert.deepEqual(await meta(db),before);
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='public'::regnamespace")).rows[0].n,functions);
  await db.exec(approval+rollback);assert.deepEqual(await meta(db),before);
  assert.equal((await db.query("SELECT to_regprocedure('crm_security.crm_operational_read_fragment_v1(text,uuid,integer)') IS NULL absent")).rows[0].absent,true);
 }finally{await db.close();}
});

test('wrong target and public definition drift fail closed',async()=>{
 const db=await bundle.setup();try{
  await db.exec(bundle.approval+bundle.compose());
  await assert.rejects(db.exec("SET crm.operational_read_compat_ref='wrong';\n"+candidate),/baseline drift/);
  await db.exec('ROLLBACK');
  await db.exec("CREATE OR REPLACE FUNCTION public.crm_read_scoped_v2(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_deal_id uuid DEFAULT NULL,p_inquiry_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT jsonb_build_object('contract_version',2)$$");
  await assert.rejects(db.exec(approval+candidate),/baseline drift/);
 }finally{await db.close();}
});
