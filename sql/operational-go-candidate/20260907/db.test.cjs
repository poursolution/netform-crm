'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const personal=require('../../personal-state-compat/20260906/build.cjs');
const full=require('../../operational-full-local-candidate/20260906/build.cjs');
async function one(db,sql,params=[]){return (await db.query(sql,params)).rows[0];}
async function storage(db){await db.exec(`CREATE SCHEMA IF NOT EXISTS storage;CREATE TABLE IF NOT EXISTS storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE IF NOT EXISTS storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text NOT NULL REFERENCES storage.buckets(id),name text NOT NULL,owner_id text,metadata jsonb,UNIQUE(bucket_id,name));GRANT USAGE ON SCHEMA storage TO authenticated;GRANT INSERT ON storage.objects TO authenticated;`);}
test('GO candidate compiles over the current 31-operation local bundle and keeps the predecessors private',async()=>{
 const db=await personal.setup();try{
  await storage(db);await db.exec(full.compose('apply',{localPersonalCandidate:true}));
  const hashes=await one(db,`SELECT md5(pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure)) w,md5(pg_get_functiondef('public.crm_operational_source_v1(text,uuid,integer)'::regprocedure)) r`);
  let sql=fs.readFileSync(path.join(__dirname,'staging-apply.sql'),'utf8')
   .replace('432d79d939cd782a318034089fbb6c95',hashes.w)
   .replace('3883c86d284982544eb9e9cb380ca7c3',hashes.r);
  await db.exec(sql);
  for(const rel of ['user_capabilities','inquiry_routing','contact_compat_state','rep_manager_comments'])assert.equal((await one(db,'SELECT to_regclass($1) IS NOT NULL ok',['crm_security.'+rel])).ok,true);
  assert.equal((await one(db,"SELECT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') ok")).ok,true);
  assert.equal((await one(db,"SELECT has_function_privilege('authenticated','crm_security.crm_write_command_v2_pre_go_20260907(uuid,text,uuid,integer,jsonb)','EXECUTE') exposed")).exposed,false);
  const check=(await one(db,"SELECT pg_get_constraintdef(oid,true) d FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check'")).d;
  for(const op of ['inquiry_consultant','assign','contact_upsert','contact_relationship','contact_move','rep_manager_comment'])assert.match(check,new RegExp("'"+op+"'"));
 }finally{await db.close();}
});
