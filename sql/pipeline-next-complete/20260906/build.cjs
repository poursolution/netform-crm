'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const personal=require('../../personal-state-compat/20260906/build.cjs'),action=require('../../pipeline-action-bundle/20260906/build.cjs'),quote=require('../../pipeline-quote-version/20260906/build.cjs'),source=require('../../operational-read-source/20260906/build.cjs');
const dir=__dirname,root=path.resolve(dir,'../../..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const nine=quote.nine,ten=`CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text]))`;
const helper=()=>fs.readFileSync(path.join(dir,'helper.sql'),'utf8');
function one(text,needle,label){const n=text.split(needle).length-1;if(n!==1)throw Error(`${label} drift (${n})`);}
function adapter(){let text=quote.adapter();
 one(text,"'activity','next_action','quote_version']",'adapter operations');text=text.replace("'activity','next_action','quote_version']","'activity','next_action','quote_version','next_action_complete']");
 const marker=" function normalize(operation,objectId,expectedVersion,payload){";
 one(text,marker,'adapter normalize marker');text=text.replace(marker," function normalizeComplete(objectId,payload){const allowed=['opportunity_id','action_id','text','due_at','at'];if(Object.keys(payload).some(k=>!allowed.includes(k))||payload.opportunity_id!==objectId||!UUID.test(payload.action_id))fail('INVALID_NEXT_ACTION_COMPLETE');return {action_id:payload.action_id};}\n"+marker);
 const old="else if(operation==='next_action')normalized=normalizeNext(payload);else normalized=normalizeQuote(objectId,payload);";
 const next="else if(operation==='next_action')normalized=normalizeNext(payload);else if(operation==='quote_version')normalized=normalizeQuote(objectId,payload);else normalized=normalizeComplete(objectId,payload);";
 one(text,old,'adapter dispatch');text=text.replace(old,next);
 const ack="  if(command.operation==='next_action_complete'&&(ack.previous_version!==command.expected_version||ack.version!==command.expected_version+1||ack.next_action_id!==command.payload.action_id||!UUID.test(ack.activity_id)||!UUID.test(ack.audit_event_id)||typeof ack.completed_at!=='string'))fail('ACK_CONTRACT_MISMATCH');\n";
 one(text,'  return ack;}','adapter ack return');return text.replace('  return ack;}',ack+'  return ack;}');
}
function overlay(){let text=source.overlay();
 const connected="const connected=new Set(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change','favorite_set','opportunity_touch','activity','next_action','quote_version']);";
 one(text,connected,'overlay connected');text=text.replace(connected,connected.replace("'quote_version'","'quote_version','next_action_complete'"));
 const state="let compound=null,actionIntent=null;const versions=new Map(),seenAcks=new Set();";
 one(text,state,'overlay state');text=text.replace(state,"let compound=null,actionIntent=null,completeActionId=null;const versions=new Map(),seenAcks=new Set();");
 const push="root.pushWrite=function(op,payload){if(compound==='service_change'&&companion.has(op))return 'absorbed:'+op;";
 one(text,push,'overlay push');text=text.replace(push,"root.pushWrite=function(op,payload){if(compound==='service_change'&&companion.has(op))return 'absorbed:'+op;if(compound==='next_action_complete'&&op==='activity')return 'absorbed:activity';if(op==='next_action_complete'){if(compound!=='next_action_complete'||!completeActionId)throw error('NEXT_ACTION_ID_REQUIRED');payload={opportunity_id:payload&&payload.opportunity_id,action_id:completeActionId};}");
 const insert="  wrap('spSaveNext','next_action');";
 one(text,insert,'overlay handler marker');text=text.replace(insert,insert+"\n  function pcAction(k){const rows=root.B&&root.B.deals||[];const d=rows.find(x=>String(root.dealKey?root.dealKey(x):x.id)===String(k));const a=d&&root.actionObj&&root.actionObj(d,root.itemPatch?root.itemPatch(d,'deal'):null);return {d,a};}\n  if(typeof root.todoDone==='function'){const original=root.todoDone;root.todoDone=function(k){const x=pcAction(k);if(!x.a||!x.a.id)throw error('NEXT_ACTION_ID_REQUIRED');const pc=compound,pi=completeActionId;compound='next_action_complete';completeActionId=x.a.id;try{return original.apply(this,arguments);}finally{compound=pc;completeActionId=pi;}};}\n  if(typeof root.todayCompleteM==='function'){const original=root.todayCompleteM;root.todayCompleteM=function(i){const d=root.todayDeal&&root.todayDeal(i),a=d&&root.execNextM&&root.execNextM(d);if(!d||!a)return original.apply(this,arguments);if(!a.id)throw error('NEXT_ACTION_ID_REQUIRED');const pc=compound,pi=completeActionId;compound='next_action_complete';completeActionId=a.id;try{return original.apply(this,arguments);}finally{compound=pc;completeActionId=pi;}};}\n  if(Object.prototype.hasOwnProperty.call(root,'CUR_DETAIL')&&typeof root.completeNextAction==='function'){const original=root.completeNextAction;root.completeNextAction=function(){const d=root.CUR_DETAIL&&root.CUR_DETAIL.item,a=d&&root.actionObj&&root.actionObj(d,root.itemPatch?root.itemPatch(d,'deal'):null);if(!d||!a)return original.apply(this,arguments);if(!a.id)throw error('NEXT_ACTION_ID_REQUIRED');const pc=compound,pi=completeActionId;compound='next_action_complete';completeActionId=a.id;try{const out=original.apply(this,arguments);root.pushWrite('next_action_complete',{opportunity_id:d.id,action_id:a.id});return out;}finally{compound=pc;completeActionId=pi;}};}");
 return text;
}
function applySql(){return `SET crm.next_complete_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.next_complete_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_action_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_quote_version_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.quote_versions') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${nine}$expected$
 THEN RAISE EXCEPTION 'next-complete after-operational-source prerequisite drift'; END IF;
END $guard$;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_quote_20260906;
ALTER FUNCTION public.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete'));
${helper()}
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='next_action_complete' THEN RETURN crm_security.crm_next_action_complete_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_quote_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ BEGIN
 IF has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${ten}$expected$
 THEN RAISE EXCEPTION 'next-complete post-apply drift'; END IF;
END $post$;
COMMIT;
`;}
function rollbackSql(){return `SET crm.next_complete_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.next_complete_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regnamespace('crm_next_complete_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${ten}$expected$
 THEN RAISE EXCEPTION 'next-complete rollback drift'; END IF;
END $guard$;
CREATE SCHEMA crm_next_complete_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_next_complete_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_next_complete_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='next_action_complete';
REVOKE ALL ON crm_next_complete_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='next_action_complete';
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version'));
DO $post$ BEGIN IF to_regprocedure('crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL OR to_regprocedure('crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${nine}$expected$ THEN RAISE EXCEPTION 'next-complete rollback verification drift'; END IF; END $post$;
COMMIT;
`;}
function build(){fs.writeFileSync(path.join(dir,'staging-apply-after-operational-source.sql'),applySql());fs.writeFileSync(path.join(dir,'rollback-after-operational-source.sql'),rollbackSql());fs.writeFileSync(path.join(dir,'operational-adapter.candidate.js'),adapter());fs.writeFileSync(path.join(dir,'operational-overlay.candidate.js'),overlay());const names=['helper.sql','adapter-contract.js','contract.test.cjs','db.test.cjs','ui.test.cjs','review.md','staging-apply-after-operational-source.sql','rollback-after-operational-source.sql','operational-adapter.candidate.js','operational-overlay.candidate.js'];const manifest={project_ref:'rprechiaglyjaydkmxsu',status:'LOCAL_CHAIN_CANDIDATE_AFTER_OPERATIONAL_SOURCE_NOT_APPLIED',prerequisites:['personal-state-compat/20260906','pipeline-action-bundle/20260906','pipeline-quote-version/20260906','operational-read-source/20260906'],operation:'next_action_complete',identity:'server_next_action_uuid_only',compound_activity:'absorbed_into_completion_transaction',staging_ddl_dml_performed:false,files_sha256:Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))])),source_sha256:{golden_pc:sha(fs.readFileSync(path.join(root,'crm.html'))),golden_mobile:sha(fs.readFileSync(path.join(root,'mobile.html'))),quote_manifest:sha(fs.readFileSync(path.join(root,'sql/pipeline-quote-version/20260906/manifest.json'))),operational_source_manifest:sha(fs.readFileSync(path.join(root,'sql/operational-read-source/20260906/manifest.json')))}};fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;}
if(require.main===module)console.log(JSON.stringify(build(),null,2));
module.exports={applySql,rollbackSql,adapter,overlay,build,nine,ten};
