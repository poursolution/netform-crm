'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const direct=require('../../../scripts/crm-inquiry-direct-assign.cjs');
const phase=require('../../../scripts/crm-phase1.cjs');
const dir=__dirname;
const candidate=fs.readFileSync(path.join(dir,'candidate.sql'),'utf8');
const approval="SET crm.pipeline_service_ref='rprechiaglyjaydkmxsu';\n";
async function setup(dataDir){const db=await direct.setup(dataDir);await db.exec(direct.approval+direct.candidate);return db;}
async function capture(db){return direct.capture(db);}
function guards(snapshot){return phase.guard(snapshot.public)+'\n'+phase.guard(snapshot.private,'crm_security');}
function rollback(before,after){return `${approval}BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.pipeline_service_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regnamespace('crm_pipeline_service_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'Staging pipeline service-change rollback approval required'; END IF;
END $$;
${guards(after)}
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
DO $archive$ BEGIN
 IF EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='service_change') THEN
  CREATE SCHEMA crm_pipeline_service_archive AUTHORIZATION postgres;
  REVOKE ALL ON SCHEMA crm_pipeline_service_archive FROM PUBLIC,anon,authenticated,service_role;
  CREATE TABLE crm_pipeline_service_archive.command_receipts AS
   SELECT * FROM crm_security.command_receipts WHERE operation='service_change';
  REVOKE ALL ON TABLE crm_pipeline_service_archive.command_receipts
   FROM PUBLIC,anon,authenticated,service_role;
  DELETE FROM crm_security.command_receipts WHERE operation='service_change';
 END IF;
END $archive$;
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
ALTER FUNCTION crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 TO authenticated;
ALTER TABLE crm_security.command_receipts
 DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts
 ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign'));
${guards(before)}
COMMIT;`;}
function sha(x){return crypto.createHash('sha256').update(x).digest('hex');}
async function build(){const db=await setup();try{
 const before=await capture(db);
 const frozenBefore=(await db.query("SELECT oid,prosrc,proacl::text acl,proconfig,prosecdef,provolatile FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
 await db.exec(approval+candidate);
 const after=await capture(db);
 const frozenAfter=(await db.query("SELECT oid,prosrc,proacl::text acl,proconfig,prosecdef,provolatile FROM pg_proc WHERE oid='crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
 if(frozenBefore.oid!==frozenAfter.oid||frozenBefore.prosrc!==frozenAfter.prosrc||frozenBefore.proconfig.join('|')!==frozenAfter.proconfig.join('|')||frozenBefore.prosecdef!==frozenAfter.prosecdef||frozenBefore.provolatile!==frozenAfter.provolatile)throw Error('Frozen dispatcher body/config drift');
 const apply=approval+candidate.replace('-- BEFORE_METADATA_GUARD',guards(before)).replace('-- AFTER_METADATA_GUARD',guards(after));
 const undo=rollback(before,after);
 const outputs={'before.json':JSON.stringify(before,null,2),'after.json':JSON.stringify(after,null,2),'staging-apply.sql':apply,'rollback.sql':undo};
 for(const [name,value] of Object.entries(outputs))fs.writeFileSync(path.join(dir,name),value);
 const tracked=['candidate.sql','review.md','db.test.cjs'];
 const file_sha256=Object.fromEntries(tracked.map(name=>[name,sha(fs.readFileSync(path.join(dir,name))) ]));
 const source_sha256={
  staging_snapshot:sha(fs.readFileSync(path.resolve(dir,'../../inquiry-direct-assign/20260906/after.json'))),
  pc_ui:sha(fs.readFileSync(path.resolve(dir,'../../../crm.html'))),
  mobile_ui:sha(fs.readFileSync(path.resolve(dir,'../../../mobile.html')))
 };
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({
  project_ref:'rprechiaglyjaydkmxsu',operation:'service_change',classification:'DERIVED_SAFE',
  apply_sha256:sha(apply),rollback_sha256:sha(undo),file_sha256,source_sha256,
  frozen_dispatcher_oid:frozenBefore.oid,frozen_dispatcher_body_sha256:sha(frozenBefore.prosrc),
  status:'LOCAL_CANDIDATE_NOT_APPLIED'
 },null,2));
 return {before,after,apply,undo};
 }finally{await db.close();}}
if(require.main===module)build().then(()=>console.log('Pipeline service-change guarded candidate generated locally.')).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={setup,capture,candidate,approval,rollback,build,dir};

