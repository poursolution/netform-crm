'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),action=require('../../pipeline-action-bundle/20260906/build.cjs');
const dir=__dirname,root=path.resolve(dir,'../../..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const eight=action.eight,nine=`CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text]))`;
const helper=()=>fs.readFileSync(path.join(dir,'helper.sql'),'utf8');
function one(text,needle,label){const n=text.split(needle).length-1;if(n!==1)throw Error(`${label} drift (${n})`);}
function adapter(){let text=fs.readFileSync(path.join(root,'sql/pipeline-action-bundle/20260906/operational-adapter.candidate.js'),'utf8');
 one(text,"'activity','next_action']",'adapter operations');text=text.replace("'activity','next_action']","'activity','next_action','quote_version']");
 const marker=" function normalize(operation,objectId,expectedVersion,payload){";
 one(text,marker,'adapter normalize marker');text=text.replace(marker," function normalizeQuote(objectId,payload){const allowed=['opportunity_id','version_no','amount','reason','created_at','created_by'];if(Object.keys(payload).some(k=>!allowed.includes(k))||payload.opportunity_id!==objectId||!Number.isSafeInteger(payload.amount)||payload.amount<=0)fail('INVALID_QUOTE_VERSION');return {amount:payload.amount,reason:text(payload.reason,2,2000,'INVALID_QUOTE_VERSION')};}\n"+marker);
 const old="else if(operation==='activity')normalized=normalizeActivity(payload);else normalized=normalizeNext(payload);";
 const next="else if(operation==='activity')normalized=normalizeActivity(payload);else if(operation==='next_action')normalized=normalizeNext(payload);else normalized=normalizeQuote(objectId,payload);";
 one(text,old,'adapter dispatch');text=text.replace(old,next);
 const ack="  if(command.operation==='quote_version'&&(ack.previous_version!==command.expected_version||ack.version!==command.expected_version+1||!UUID.test(ack.quote_version_id)||!Number.isSafeInteger(ack.version_no)||ack.version_no<1||ack.amount!==command.payload.amount||!UUID.test(ack.audit_event_id)||typeof ack.server_at!=='string'))fail('ACK_CONTRACT_MISMATCH');\n";
 one(text,'  return ack;}','adapter ack return');return text.replace('  return ack;}',ack+'  return ack;}');
}
function overlay(){let text=fs.readFileSync(path.join(root,'sql/pipeline-action-bundle/20260906/operational-overlay.candidate.js'),'utf8');const old="const connected=new Set(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change','favorite_set','opportunity_touch','activity','next_action']);";one(text,old,'overlay connected');return text.replace(old,old.replace("'next_action'","'next_action','quote_version'"));}
function applySql(){return `SET crm.quote_version_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.quote_version_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_security.quote_versions') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${eight}$expected$
 THEN RAISE EXCEPTION 'quote-version after-action prerequisite drift'; END IF;
END $guard$;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_action_20260906;
ALTER FUNCTION public.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version'));
${helper()}
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='quote_version' THEN RETURN crm_security.crm_quote_version_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_action_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','crm_security.quote_versions','SELECT,INSERT,UPDATE,DELETE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${nine}$expected$
 THEN RAISE EXCEPTION 'quote-version post-apply drift'; END IF;
END $post$;
COMMIT;
`;}
function rollbackSql(){return `SET crm.quote_version_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.quote_version_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.quote_versions') IS NULL OR to_regnamespace('crm_quote_version_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${nine}$expected$
 THEN RAISE EXCEPTION 'quote-version rollback drift'; END IF;
END $guard$;
CREATE SCHEMA crm_quote_version_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_quote_version_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_quote_version_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='quote_version';
REVOKE ALL ON crm_quote_version_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='quote_version';
ALTER TABLE crm_security.quote_versions SET SCHEMA crm_quote_version_archive;
REVOKE ALL ON crm_quote_version_archive.quote_versions FROM PUBLIC,anon,authenticated,service_role;
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL OR to_regclass('crm_security.quote_versions') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${eight}$expected$ THEN RAISE EXCEPTION 'quote-version rollback verification drift'; END IF; END $post$;
COMMIT;
`;}
function build(){fs.writeFileSync(path.join(dir,'staging-apply-after-action.sql'),applySql());fs.writeFileSync(path.join(dir,'rollback-after-action.sql'),rollbackSql());fs.writeFileSync(path.join(dir,'operational-adapter.candidate.js'),adapter());fs.writeFileSync(path.join(dir,'operational-overlay.candidate.js'),overlay());const names=['helper.sql','adapter-contract.js','contract.test.cjs','db.test.cjs','ui.test.cjs','review.md','staging-apply-after-action.sql','rollback-after-action.sql','operational-adapter.candidate.js','operational-overlay.candidate.js'];const manifest={project_ref:'rprechiaglyjaydkmxsu',status:'LOCAL_CHAIN_CANDIDATE_AFTER_ACTION_NOT_APPLIED',prerequisites:['personal-state-compat/20260906','pipeline-action-bundle/20260906'],operation:'quote_version',meaning:'append_only_server_numbered_quote_version',amount_axes:{deals_amount:'expected',quote_versions:'append_only_private_table',won_amount:'blocked'},staging_ddl_dml_performed:false,files_sha256:Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))])),source_sha256:{golden_sql:sha(fs.readFileSync(path.join(root,'sql/20260905_sales_execution_engine.sql'))),golden_pc:sha(fs.readFileSync(path.join(root,'crm.html'))),golden_mobile:sha(fs.readFileSync(path.join(root,'mobile.html'))),action_manifest:sha(fs.readFileSync(path.join(root,'sql/pipeline-action-bundle/20260906/manifest.json')))}};fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;}
if(require.main===module)console.log(JSON.stringify(build(),null,2));module.exports={applySql,rollbackSql,adapter,overlay,build,eight,nine};
