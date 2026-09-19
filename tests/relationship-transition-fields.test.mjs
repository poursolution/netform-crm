import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const stage=require('../stage-transition.js');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration=read('../supabase/migrations/20260919200000_relationship_transition_fields.sql');
const rollback=read('../sql/relationship-transition-fields-rollback.sql');
test('production validator accepts actual relationship forms, preserves legacy validation and rolls back',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create schema crm_security; create role anon; create role authenticated; create role service_role;');
  await db.exec(read('../sql/pipeline-transition/20260906/validator.sql'));
  const signature=async()=>(await db.query("select oid,prosrc,proacl,proowner,proconfig from pg_proc where oid='crm_security.crm_transition_validate_v1(text,jsonb,date)'::regprocedure")).rows[0];
  const validate=(to,fields)=>db.query('select crm_security.crm_transition_validate_v1($1,$2::jsonb,$3::date)',[to,JSON.stringify(fields),'2026-09-20']);
  const input=(to,reason='내년도 사업 검토')=>Object.fromEntries(stage.definitions[to].fields.map(f=>[f.key,({relationship_reason:reason,relationship_reason_detail:reason==='기타'?'내부 검증':'',reaction:'고객 연락 없음',likelihood:'미확인',contact_date:'2026-09-27',last_contact:''})[f.key]??'']));
  const before=await signature();
  await assert.rejects(validate('rapport',input('rapport')),/invalid transition fields/);
  await db.exec(migration);
  const after=await signature();
  for(const key of ['oid','proacl','proowner','proconfig'])assert.deepEqual(after[key],before[key]);
  for(const to of ['rapport','silent']){
   for(const reason of stage.definitions[to].fields.find(f=>f.key==='relationship_reason').options)await validate(to,input(to,reason));
   await assert.rejects(validate(to,{...input(to),relationship_reason:'invented'}),/invalid relationship reason/);
   await assert.rejects(validate(to,{...input(to),relationship_reason:'기타',relationship_reason_detail:' '}),/invalid relationship reason/);
   await assert.rejects(validate(to,{...input(to),relationship_reason_detail:{unsafe:true}}),/invalid relationship reason/);
   await assert.rejects(validate(to,{...input(to),unknown:true}),/invalid transition fields/);
   await assert.rejects(validate(to,{...input(to),contact_date:'2026-02-30'}),/invalid transition date field/);
  }
  await validate('rapport',{reaction:'legacy',likelihood:'',contact_date:'2026-09-27'});
  await validate('silent',{reason:'legacy',last_contact:'',contact_date:'2026-09-27'});
  await validate('waiting',{reason:'legacy',contact_date:'2026-09-27'});
  await assert.rejects(validate('silent',{last_contact:'',contact_date:'2026-09-27'}),/waiting reason is required/);
  await assert.rejects(validate('waiting',{relationship_reason:'기타',contact_date:'2026-09-27'}),/invalid transition fields/);
  await assert.rejects(validate('consulting',{quote_request:'x',quote_due:''}),/missing transition date field/);
  await db.exec(migration);assert.deepEqual(await signature(),after);
  await db.exec(rollback);assert.deepEqual(await signature(),before);
  await db.exec(rollback);assert.deepEqual(await signature(),before);
  await db.exec("alter function crm_security.crm_transition_validate_v1(text,jsonb,date) rename to old_validator; create function crm_security.crm_transition_validate_v1(text,jsonb,date) returns void language plpgsql as $$begin null; end$$;");
  await assert.rejects(db.exec(migration),/unexpected transition validator/);
 }finally{await db.close();}
});
