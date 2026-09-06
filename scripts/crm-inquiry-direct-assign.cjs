'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const work=require('./crm-work-compat.cjs');
const dir=path.resolve(__dirname,'../sql/inquiry-direct-assign/20260906');
const candidate=fs.readFileSync(path.join(dir,'candidate.sql'),'utf8');
const readProjection=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260906073500_crm_work_read_projection.sql'),'utf8');
const approval="SET crm.inquiry_direct_ref='rprechiaglyjaydkmxsu';\n";
async function setup(dataDir){const db=await work.setup(dataDir);await db.exec(work.approval+work.migration);await db.exec("SET crm.work_read_ref='rprechiaglyjaydkmxsu';\n"+readProjection);return db;}
async function capture(db){await db.exec('SET search_path=pg_catalog');return work.capture(db);}
function guardPair(snapshot){const s=require('./crm-phase1.cjs');return s.guard(snapshot.public)+'\n'+s.guard(snapshot.private,'crm_security');}
function rollback(before,after,previous){return `${approval}BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.inquiry_direct_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regnamespace('crm_inquiry_direct_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'Staging inquiry direct assignment rollback approval required'; END IF;
END $$;
${guardPair(after)}
LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
${previous};
DO $archive$ BEGIN
 IF EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events)
  OR EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='inquiry_assign') THEN
  CREATE SCHEMA crm_inquiry_direct_archive AUTHORIZATION postgres;
  REVOKE ALL ON SCHEMA crm_inquiry_direct_archive FROM PUBLIC,anon,authenticated,service_role;
 END IF;
 IF EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation='inquiry_assign') THEN
  CREATE TABLE crm_inquiry_direct_archive.command_receipts AS
   SELECT * FROM crm_security.command_receipts WHERE operation='inquiry_assign';
  REVOKE ALL ON TABLE crm_inquiry_direct_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
  DELETE FROM crm_security.command_receipts WHERE operation='inquiry_assign';
 END IF;
 IF EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events) THEN
  ALTER TABLE crm_security.inquiry_audit_events SET SCHEMA crm_inquiry_direct_archive;
 ELSE
  DROP TABLE crm_security.inquiry_audit_events;
 END IF;
END $archive$;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation='opportunity_work_set');
${guardPair(before)}
COMMIT;`;}
async function build(){const db=await setup();try{
 const before=await capture(db);
 const previous=(await db.query("SELECT pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure) d")).rows[0].d;
 await db.exec(approval+candidate);const after=await capture(db);
 const apply=approval+candidate.replace('-- BEFORE_METADATA_GUARD',guardPair(before)).replace('-- AFTER_METADATA_GUARD',guardPair(after));
 const undo=rollback(before,after,previous);
 const files={'before.json':JSON.stringify(before,null,2),'after.json':JSON.stringify(after,null,2),'staging-apply.sql':apply,'rollback.sql':undo};
 for(const [name,value] of Object.entries(files))fs.writeFileSync(path.join(dir,name),value);
 const hashes={adapter:'staging-write/compat-adapter.js',mobile_source:'mobile.html',mobile_staging:'staging-phase1/mobile.html',staging_transport:'staging-phase1/transport.js'};
 for(const [key,relative] of Object.entries(hashes))hashes[key]=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'..',relative))).digest('hex');
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({project_ref:'rprechiaglyjaydkmxsu',operation:'inquiry_assign',intent:'direct_assign',apply_sha256:crypto.createHash('sha256').update(apply).digest('hex'),rollback_sha256:crypto.createHash('sha256').update(undo).digest('hex'),file_sha256:hashes,status:'LOCAL_CANDIDATE_NOT_APPLIED'},null,2));
 return {before,after,previous};
 }finally{await db.close();}}
if(require.main===module)build().then(()=>console.log('Inquiry direct assignment guarded apply and rollback generated locally.')).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={setup,capture,candidate,approval,rollback,build,dir};
