'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname,root=path.resolve(dir,'../../..');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const six=`CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text]))`;
const eight=`CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text]))`;
function helperBlock(){const source=read('candidate.sql'),match=source.match(/CREATE FUNCTION crm_security\.crm_pipeline_action_command_v1\([\s\S]*?FROM PUBLIC,anon,authenticated,service_role;/);if(!match)throw Error('private helper extraction drift');return match[0];}
function applySql(){return `SET crm.pipeline_action_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.pipeline_action_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.user_opportunity_state') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regnamespace('crm_pipeline_action_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${six}$expected$
 THEN RAISE EXCEPTION 'pipeline-action after-personal prerequisite drift'; END IF;
END $guard$;
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2_personal_20260906;
ALTER FUNCTION public.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)
 SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity'));
${helperBlock()}
CREATE FUNCTION public.crm_write_command_v2(
 p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation IN ('next_action','activity') THEN
  RETURN crm_security.crm_pipeline_action_command_v1(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
 END IF;
 RETURN crm_security.crm_write_command_v2_personal_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR has_function_privilege('public','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${eight}$expected$
 THEN RAISE EXCEPTION 'pipeline-action targeted post-apply drift'; END IF;
END $post$;
COMMIT;
`;}
function rollbackSql(){return `SET crm.pipeline_action_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.pipeline_action_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regnamespace('crm_pipeline_action_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${eight}$expected$
 THEN RAISE EXCEPTION 'pipeline-action rollback prerequisite drift'; END IF;
END $guard$;
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA crm_pipeline_action_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_pipeline_action_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_pipeline_action_archive.command_receipts AS
 SELECT * FROM crm_security.command_receipts WHERE operation IN ('next_action','activity');
REVOKE ALL ON crm_pipeline_action_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation IN ('next_action','activity');
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
DROP FUNCTION crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb) RESTRICT;
ALTER FUNCTION crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)
 RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch'));
DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${six}$expected$
 THEN RAISE EXCEPTION 'pipeline-action targeted rollback drift'; END IF;
END $post$;
COMMIT;
`;}
function build(){
 fs.writeFileSync(path.join(dir,'staging-apply-after-personal.sql'),applySql());
 fs.writeFileSync(path.join(dir,'rollback-after-personal.sql'),rollbackSql());
 const names=['candidate.sql','rollback.sql','adapter-contract.js','fixtures.json','review.md','contract.test.cjs','db.test.cjs','operational-adapter.candidate.js','operational-overlay.candidate.js','ui.test.cjs','chain-db.test.cjs','staging-apply-after-personal.sql','rollback-after-personal.sql'];
 const files=Object.fromEntries(names.filter(name=>fs.existsSync(path.join(dir,name))).map(name=>[name,sha(fs.readFileSync(path.join(dir,name)))]));
 const source={golden_pc_sha256:sha(fs.readFileSync(path.join(root,'crm.html'))),golden_mobile_sha256:sha(fs.readFileSync(path.join(root,'mobile.html'))),personal_state_manifest_sha256:sha(fs.readFileSync(path.join(root,'sql/personal-state-compat/20260906/manifest.json'))),operational_bundle_sha256:sha(fs.readFileSync(path.join(root,'sql/operational-bundle/20260906/staging-apply.sql')))};
 const manifest={project_ref:'rprechiaglyjaydkmxsu',status:'LOCAL_CHAIN_CANDIDATE_AFTER_T03_NOT_APPLIED',prerequisite:'personal-state-compat/20260906 must be applied and live baseline recaptured',public_dispatcher_changed_in_candidate:true,connected_operations_candidate:['next_action','activity'],standalone_handlers:{pc:['addDetailActivity','spSaveAct','saveNextAction','spSaveNext','briefCall','contactActivity','todoCall'],mobile:['saveCallMemoM','startTodayCall','callContactM','smsContactM','kakaoContactM']},absorbed_legacy_operation:'contact within spSaveAct',needs_verification:['amount','next_action_complete','next_action:scheduling','next_action:postpone','mobile derived next actions'],files_sha256:files,source_sha256:source};
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(require.main===module)console.log(JSON.stringify(build(),null,2));
module.exports={dir,root,six,eight,helperBlock,applySql,rollbackSql,build};
