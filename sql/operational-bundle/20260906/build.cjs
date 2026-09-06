'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const direct=require('../../../scripts/crm-inquiry-direct-assign.cjs');
const phase=require('../../../scripts/crm-phase1.cjs');
const inquiryRead=require('../../../scripts/crm-inquiry-read-compat.cjs');
const dir=__dirname;
const root=path.resolve(dir,'../../..');
const approval="SET crm.operational_bundle_ref='rprechiaglyjaydkmxsu';\n";
const livePreflightPath=path.join(root,'docs/operational-cutover-20260906/staging-preflight-20260906.json');
const livePreflight=JSON.parse(fs.readFileSync(livePreflightPath,'utf8'));
const serviceSource=fs.readFileSync(path.join(root,'sql/pipeline-service-change/20260906/candidate.sql'),'utf8');
const unassignSource=fs.readFileSync(path.join(root,'sql/inquiry-domain/20260906/candidate.sql'),'utf8');
function one(source,needle,label){const n=source.split(needle).length-1;if(n!==1)throw Error(`${label} composition drift (${n})`);}
function unassignHelper(){
 const match=unassignSource.match(/CREATE FUNCTION public\.crm_inquiry_unassign_command_v1\([\s\S]*?END \$fn\$;/);
 if(!match)throw Error('inquiry_unassign helper source drift');
 return match[0].replace('CREATE FUNCTION public.crm_inquiry_unassign_command_v1','CREATE FUNCTION crm_security.crm_inquiry_unassign_command_v1');
}
function compose(){let sql=serviceSource;
 sql=sql.replace(
  '-- Staging-only candidate. Generate and review staging-apply.sql before execution.\n-- Adds only service_change. The frozen work/direct-assignment implementation is moved,\n-- not rewritten, and remains the delegate for its two operations.',
  '-- Combined Staging write/read candidate. Generate and review staging-apply.sql before execution.\n-- Adds service_change and inquiry_unassign behind the single public Dispatcher, then\n-- installs the inquiry-compatible scoped read projection in the same transaction.');
 one(sql,"current_setting('crm.pipeline_service_ref',true)",'service approval');
 sql=sql.replaceAll('crm.pipeline_service_ref','crm.operational_bundle_ref')
  .replace('Staging pipeline service-change approval required','Staging operational bundle approval required')
  .replace("CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change'));",
   "CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign'));\n\nALTER TABLE crm_security.inquiry_audit_events\n DROP CONSTRAINT inquiry_audit_events_action_check;\nALTER TABLE crm_security.inquiry_audit_events\n ADD CONSTRAINT inquiry_audit_events_action_check\n CHECK(action IN ('direct_assign','direct_reassign','inquiry_unassign'));" );
 const liveGuard=`DO $live_baseline$ DECLARE write_fn record; read_fn record; BEGIN
 SELECT * INTO write_fn FROM pg_proc
  WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO read_fn FROM pg_proc
  WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF md5(pg_get_functiondef(write_fn.oid)) IS DISTINCT FROM '${livePreflight.dispatcher.definition_md5}'
  OR pg_get_userbyid(write_fn.proowner) IS DISTINCT FROM 'postgres'
  OR NOT write_fn.prosecdef OR write_fn.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(write_fn.proacl::text,'') IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}'
  OR md5(pg_get_functiondef(read_fn.oid)) IS DISTINCT FROM '${livePreflight.read.definition_md5}'
  OR pg_get_userbyid(read_fn.proowner) IS DISTINCT FROM 'postgres'
  OR NOT read_fn.prosecdef OR read_fn.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(read_fn.proacl::text,'') IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}'
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$${livePreflight.constraints['crm_security.command_receipts.command_receipts_operation_check']}$expected$
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.inquiry_audit_events'::regclass
       AND conname='inquiry_audit_events_action_check')
     IS DISTINCT FROM $expected$${livePreflight.constraints['crm_security.inquiry_audit_events.inquiry_audit_events_action_check']}$expected$
  OR to_regprocedure('crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)') IS NOT NULL
  OR to_regprocedure('public.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'live Staging definition/ACL/config/constraint baseline drift'; END IF;
END $live_baseline$;`;
 one(sql,'-- BEFORE_METADATA_GUARD','before guard marker');
 sql=sql.replace('-- BEFORE_METADATA_GUARD',liveGuard+'\n-- BEFORE_METADATA_GUARD');
 const helper=`${unassignHelper()}\n\nREVOKE EXECUTE ON FUNCTION crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)\n FROM PUBLIC,anon,authenticated,service_role;\n`;
 one(sql,'CREATE FUNCTION public.crm_write_command_v2(','wrapper create');
 sql=sql.replace('CREATE FUNCTION public.crm_write_command_v2(',helper+'\nCREATE FUNCTION public.crm_write_command_v2(');
 const dispatch=`BEGIN
 IF p_operation='inquiry_unassign' THEN
  IF p_expected_version IS DISTINCT FROM 0 THEN
   RAISE EXCEPTION 'invalid inquiry_unassign version sentinel' USING ERRCODE='22023';
  END IF;
  RETURN crm_security.crm_inquiry_unassign_command_v1(p_request_id,p_object_id,p_payload);
 ELSIF p_operation IS DISTINCT FROM 'service_change' THEN
  RETURN crm_security.crm_write_command_v2_frozen_20260906(
   p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
 END IF;`;
 const oldDispatch=`BEGIN
 IF p_operation IS DISTINCT FROM 'service_change' THEN
  RETURN crm_security.crm_write_command_v2_frozen_20260906(
   p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
 END IF;`;
 one(sql,oldDispatch,'wrapper dispatch');sql=sql.replace(oldDispatch,dispatch);
 one(sql,'DO $$ DECLARE p record; frozen record; BEGIN','ACL verifier');
 sql=sql.replace('DO $$ DECLARE p record; frozen record; BEGIN',()=> 'DO $$ DECLARE p record; frozen record; helper record; BEGIN')
  .replace(" SELECT * INTO frozen FROM pg_proc\n  WHERE oid='crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;",
` SELECT * INTO frozen FROM pg_proc
  WHERE oid='crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO helper FROM pg_proc
  WHERE oid='crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)'::regprocedure;`)
  .replace("  OR EXISTS(SELECT 1 FROM aclexplode(frozen.proacl) x WHERE x.grantee=0)\n THEN RAISE EXCEPTION 'pipeline service-change ACL/config drift'; END IF;",
`  OR EXISTS(SELECT 1 FROM aclexplode(frozen.proacl) x WHERE x.grantee=0)
  OR helper.oid IS NULL OR pg_get_userbyid(helper.proowner)<>'postgres'
  OR NOT helper.prosecdef OR helper.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR has_function_privilege('anon',helper.oid,'EXECUTE')
  OR has_function_privilege('authenticated',helper.oid,'EXECUTE')
  OR has_function_privilege('service_role',helper.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(helper.proacl) x WHERE x.grantee=0)
  OR to_regprocedure('public.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'operational bundle ACL/config drift'; END IF;`);
 if(!sql.includes("helper.oid IS NULL")||sql.includes("pipeline service-change ACL/config drift"))throw Error('private helper verifier composition drift');
 const readSql=inquiryRead.definition();
 one(sql,'-- AFTER_METADATA_GUARD','after guard marker');
 sql=sql.replace('-- AFTER_METADATA_GUARD',`${readSql};\n\n-- AFTER_METADATA_GUARD`);
 return sql;
}
async function setup(dataDir){const db=await direct.setup(dataDir);await db.exec(direct.approval+direct.candidate);return db;}
async function capture(db){return direct.capture(db);}
function guards(snapshot){return phase.guard(snapshot.public)+'\n'+phase.guard(snapshot.private,'crm_security');}
function rollback(before,after,previousRead){return `${approval}BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.operational_bundle_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)') IS NULL
  OR to_regnamespace('crm_operational_bundle_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'Staging operational bundle rollback approval required'; END IF;
END $$;
${guards(after)}
LOCK TABLE crm_security.command_receipts,crm_security.inquiry_audit_events IN ACCESS EXCLUSIVE MODE;
DO $archive$ BEGIN
 IF EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation IN ('service_change','inquiry_unassign'))
  OR EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events WHERE action='inquiry_unassign') THEN
  CREATE SCHEMA crm_operational_bundle_archive AUTHORIZATION postgres;
  REVOKE ALL ON SCHEMA crm_operational_bundle_archive FROM PUBLIC,anon,authenticated,service_role;
 END IF;
 IF EXISTS(SELECT 1 FROM crm_security.command_receipts WHERE operation IN ('service_change','inquiry_unassign')) THEN
  CREATE TABLE crm_operational_bundle_archive.command_receipts AS
   SELECT * FROM crm_security.command_receipts WHERE operation IN ('service_change','inquiry_unassign');
  REVOKE ALL ON TABLE crm_operational_bundle_archive.command_receipts
   FROM PUBLIC,anon,authenticated,service_role;
  DELETE FROM crm_security.command_receipts WHERE operation IN ('service_change','inquiry_unassign');
 END IF;
 IF EXISTS(SELECT 1 FROM crm_security.inquiry_audit_events WHERE action='inquiry_unassign') THEN
  CREATE TABLE crm_operational_bundle_archive.inquiry_audit_events AS
   SELECT * FROM crm_security.inquiry_audit_events WHERE action='inquiry_unassign';
  REVOKE ALL ON TABLE crm_operational_bundle_archive.inquiry_audit_events
   FROM PUBLIC,anon,authenticated,service_role;
  DELETE FROM crm_security.inquiry_audit_events WHERE action='inquiry_unassign';
 END IF;
END $archive$;
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
DROP FUNCTION crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb) RESTRICT;
ALTER FUNCTION crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign'));
ALTER TABLE crm_security.inquiry_audit_events DROP CONSTRAINT inquiry_audit_events_action_check;
ALTER TABLE crm_security.inquiry_audit_events ADD CONSTRAINT inquiry_audit_events_action_check
 CHECK(action IN ('direct_assign','direct_reassign'));
${previousRead};
${guards(before)}
COMMIT;`;}
function sha(value){return crypto.createHash('sha256').update(value).digest('hex');}
async function build(){const candidate=compose(),db=await setup();try{
 const before=await capture(db);
 const previousRead=(await db.query("SELECT pg_get_functiondef('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure) d")).rows[0].d;
 const frozenBefore=(await db.query("SELECT oid,prosrc,proconfig,prosecdef,provolatile FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
 await db.exec(approval+candidate);
 const after=await capture(db);
 const frozenAfter=(await db.query("SELECT oid,prosrc,proconfig,prosecdef,provolatile FROM pg_proc WHERE oid='crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
 for(const key of ['oid','prosrc','prosecdef','provolatile'])if(frozenBefore[key]!==frozenAfter[key])throw Error('Frozen dispatcher drift: '+key);
 if(frozenBefore.proconfig.join('|')!==frozenAfter.proconfig.join('|'))throw Error('Frozen dispatcher config drift');
 const apply=approval+candidate.replace('-- BEFORE_METADATA_GUARD',guards(before)).replace('-- AFTER_METADATA_GUARD',guards(after));
 const undo=rollback(before,after,previousRead);
 const outputs={'candidate.sql':candidate,'before.json':JSON.stringify(before,null,2),'after.json':JSON.stringify(after,null,2),'staging-apply.sql':apply,'rollback.sql':undo};
 for(const [name,value] of Object.entries(outputs))fs.writeFileSync(path.join(dir,name),value);
 const manifest={project_ref:'rprechiaglyjaydkmxsu',operations:['opportunity_work_set','inquiry_assign','service_change','inquiry_unassign'],read:'crm_read_scoped_v2 inquiry compatibility',classification:'LOCAL_COMBINED_CANDIDATE_NOT_APPLIED',apply_order:'single transaction',live_guard:{dispatcher_definition_md5:livePreflight.dispatcher.definition_md5,read_definition_md5:livePreflight.read.definition_md5,oid_enforced:false},apply_sha256:sha(apply),rollback_sha256:sha(undo),candidate_sha256:sha(candidate),source_sha256:{staging_snapshot:sha(fs.readFileSync(path.join(root,'sql/inquiry-direct-assign/20260906/after.json'))),live_staging_preflight:sha(fs.readFileSync(livePreflightPath)),service_candidate:sha(serviceSource),unassign_candidate:sha(unassignSource),read_candidate:sha(fs.readFileSync(path.join(root,'sql/inquiry-read-compat/20260906/candidate.sql')))},local_fixture_dispatcher_oid:frozenBefore.oid,frozen_dispatcher_body_sha256:sha(frozenBefore.prosrc),readme_sha256:sha(fs.readFileSync(path.join(dir,'README.md'))),review_sha256:sha(fs.readFileSync(path.join(dir,'review.md'))),test_sha256:sha(fs.readFileSync(path.join(dir,'db.test.cjs'))),status:'LOCAL_CANDIDATE_NOT_APPLIED'};
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return {candidate,before,after,apply,undo};
 }finally{await db.close();}}
if(require.main===module)build().then(()=>console.log('Operational write/read bundle generated locally.')).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={dir,approval,compose,setup,capture,rollback,build};
