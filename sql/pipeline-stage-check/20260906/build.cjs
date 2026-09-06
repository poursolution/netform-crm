'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const next=require('../../pipeline-next-complete/20260906/build.cjs');
const dir=__dirname,root=path.resolve(dir,'../../..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const ten=next.ten,eleven=`CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text, 'next_action'::text, 'activity'::text, 'quote_version'::text, 'next_action_complete'::text, 'stage_check'::text]))`;
const helper=()=>fs.readFileSync(path.join(dir,'helper.sql'),'utf8');
function one(text,needle,label){const n=text.split(needle).length-1;if(n!==1)throw Error(`${label} drift (${n})`);}
function sourceFragment(){const text=fs.readFileSync(path.join(root,'sql/operational-read-source/20260906/candidate.sql'),'utf8'),start=text.indexOf('CREATE FUNCTION crm_security.crm_operational_source_fragment_v1('),end=text.indexOf('REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1',start);if(start<0||end<0)throw Error('operational source fragment drift');let fn=text.slice(start,end);const old='d.work_scope_type,d.work_summary,d.version,';one(fn,old,'stage checklist read projection');fn=fn.replace(old,'d.work_scope_type,d.work_summary,d.stage_checklist,d.version,');return fn;}
function adapter(){let text=next.adapter();
 one(text,"'quote_version','next_action_complete']",'adapter operations');text=text.replace("'quote_version','next_action_complete']","'quote_version','next_action_complete','stage_check']");
 const marker=' function normalize(operation,objectId,expectedVersion,payload){';one(text,marker,'adapter normalize marker');text=text.replace(marker," const STAGE_MANUAL={first_contact:{1:'공사 예정시기 확인',3:'예산·견적 필요 여부 확인'},consulting:{3:'견적 작성 요청'},sent:{1:'자료 수신 확인',2:'검토 일정 확인'},rapport:{2:'예산·회의 시점 확인'},silent:{1:'진행·보류 여부 확인'},waiting:{0:'대기 사유 기록',1:'재개 조건 확인'},compete:{0:'경쟁업체 여부 확인',1:'PT·현설 일정 확인'},imminent:{0:'공사 예정일 확인',1:'현설·회의 일정 확인'},bidding:{0:'입찰조건 확인',1:'제출서류 확인',2:'예상 낙찰가 확인'},contract:{0:'계약조건 확인',3:'착수 일정 확인'},construction:{1:'현장 이슈 확인'},completion:{0:'준공검사 확인',2:'미해결 사항 확인'}};\n function normalizeStage(objectId,payload){const allowed=['opportunity_id','stage_code','item_index','item_text','checked'];if(Object.keys(payload).some(k=>!allowed.includes(k))||payload.opportunity_id!==objectId||typeof payload.stage_code!=='string'||!Number.isSafeInteger(payload.item_index)||typeof payload.checked!=='boolean'||STAGE_MANUAL[payload.stage_code]?.[payload.item_index]!==payload.item_text)fail('INVALID_STAGE_CHECK');return {stage_code:payload.stage_code,item_index:payload.item_index,checked:payload.checked};}\n"+marker);
 const old="else if(operation==='quote_version')normalized=normalizeQuote(objectId,payload);else normalized=normalizeComplete(objectId,payload);";one(text,old,'adapter dispatch');text=text.replace(old,"else if(operation==='quote_version')normalized=normalizeQuote(objectId,payload);else if(operation==='next_action_complete')normalized=normalizeComplete(objectId,payload);else normalized=normalizeStage(objectId,payload);");
 const ack="  if(command.operation==='stage_check'&&(ack.previous_version!==command.expected_version||ack.version!==command.expected_version+1||ack.stage_code!==command.payload.stage_code||ack.item_index!==command.payload.item_index||ack.checked!==command.payload.checked||typeof ack.item_text!=='string'||!ack.stage_checklist||typeof ack.stage_checklist!=='object'||!UUID.test(ack.audit_event_id)||typeof ack.server_at!=='string'))fail('ACK_CONTRACT_MISMATCH');\n";one(text,'  return ack;}','adapter ack return');return text.replace('  return ack;}',ack+'  return ack;}');
}
function overlay(){let text=next.overlay();
 const connected="const connected=new Set(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change','favorite_set','opportunity_touch','activity','next_action','quote_version','next_action_complete']);";one(text,connected,'overlay connected');text=text.replace(connected,connected.replace("'next_action_complete'","'next_action_complete','stage_check'"));
 const state='let compound=null,actionIntent=null,completeActionId=null;const versions=new Map(),seenAcks=new Set();';one(text,state,'overlay state');text=text.replace(state,'let compound=null,actionIntent=null,completeActionId=null,stageIntent=false;const versions=new Map(),seenAcks=new Set();');
 const applyNext="  function applyNextAck(q){const id=q.ack&&q.ack.next_action_id;if(!id)return;for(const rows of [root.B&&root.B.deals,root.DEALS])if(Array.isArray(rows))for(const d of rows)if(String(d.id||d.opportunity_id)===String(q.object_id)){if(d.nextActionObj)d.nextActionObj.id=id;if(d.nextAction&&typeof d.nextAction==='object')d.nextAction.id=id;}}";one(text,applyNext,'stage ACK marker');text=text.replace(applyNext,applyNext+"\n  function applyStageAck(q){const value=q.ack&&q.ack.stage_checklist;if(!value)return;for(const rows of [root.B&&root.B.deals,root.DEALS])if(Array.isArray(rows))for(const d of rows)if(String(d.id||d.opportunity_id)===String(q.object_id)){d.stage_checklist=value;d.stageChecklist=value;}}");
 const sync="if(q.operation==='next_action')applyNextAck(q);";one(text,sync,'stage ACK sync');text=text.replace(sync,sync+"if(q.operation==='stage_check')applyStageAck(q);");
 const push="root.pushWrite=function(op,payload){if(compound==='service_change'&&companion.has(op))return 'absorbed:'+op;";one(text,push,'overlay push');text=text.replace(push,"root.pushWrite=function(op,payload){if(op==='stage_check'&&!stageIntent)throw error('STAGE_CHECK_INTENT_NOT_CONNECTED');if(compound==='service_change'&&companion.has(op))return 'absorbed:'+op;");
 const handler="  if(typeof root.todoDone==='function')";one(text,handler,'stage handler marker');text=text.replace(handler,"  function wrapStage(name){if(typeof root[name]!=='function')return;const original=root[name];root[name]=function(){const previous=stageIntent;stageIntent=true;try{return original.apply(this,arguments);}finally{stageIntent=previous;}};}\n  wrapStage('toggleExecGuide');wrapStage('toggleStageGuideM');\n"+handler);
 const mobile="view_count:Number(d.view_count||0),nextAction:d.nextAction||d.next_action||d.nextActionObj||null,tl:[]";one(text,mobile,'mobile checklist mapping');text=text.replace(mobile,"view_count:Number(d.view_count||0),nextAction:d.nextAction||d.next_action||d.nextActionObj||null,stage_checklist:d.stage_checklist||{},stageChecklist:d.stage_checklist||{},tl:[]");
 return text;
}
function applySql(){return `SET crm.stage_check_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('crm.stage_check_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_quote_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_next_action_complete_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('public.crm_operational_source_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_stage_20260906(text,uuid,integer)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_checklist')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${ten}$expected$
 THEN RAISE EXCEPTION 'stage-check after-next-complete prerequisite drift'; END IF;
END $guard$;
CREATE TEMP TABLE stage_check_source_guard AS SELECT p.oid,p.prosrc,p.proconfig,coalesce(p.proacl::text,'') acl FROM pg_proc p WHERE p.oid='public.crm_operational_source_v1(text,uuid,integer)'::regprocedure;
ALTER FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2_next_complete_20260906;
ALTER FUNCTION public.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb) SET SCHEMA crm_security;
REVOKE EXECUTE ON FUNCTION crm_security.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) RENAME TO crm_operational_source_fragment_pre_stage_20260906;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_pre_stage_20260906(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.deals ADD COLUMN stage_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete','stage_check'));
${helper()}
${sourceFragment()}
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF p_operation='stage_check' THEN RETURN crm_security.crm_stage_check_command_v1(p_request_id,p_object_id,p_expected_version,p_payload); END IF;
 RETURN crm_security.crm_write_command_v2_next_complete_20260906(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DO $post$ DECLARE changed integer; BEGIN
 SELECT count(*) INTO changed FROM stage_check_source_guard g JOIN pg_proc p ON p.oid=g.oid WHERE p.prosrc IS DISTINCT FROM g.prosrc OR p.proconfig IS DISTINCT FROM g.proconfig OR coalesce(p.proacl::text,'') IS DISTINCT FROM g.acl;
 IF changed<>0 OR has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','crm_security.crm_operational_source_fragment_v1(text,uuid,integer)','EXECUTE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${eleven}$expected$
 THEN RAISE EXCEPTION 'stage-check post-apply drift'; END IF;
END $post$;
COMMIT;
`;}
function rollbackSql(){return `SET crm.stage_check_ref='rprechiaglyjaydkmxsu';
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('crm.stage_check_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_v1(text,uuid,integer)') IS NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_stage_20260906(text,uuid,integer)') IS NULL
  OR to_regnamespace('crm_stage_check_archive') IS NOT NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${eleven}$expected$
 THEN RAISE EXCEPTION 'stage-check rollback drift'; END IF;
END $guard$;
CREATE SCHEMA crm_stage_check_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_stage_check_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_stage_check_archive.deal_stage_checklist AS SELECT id AS deal_id,stage_checklist,clock_timestamp() AS archived_at FROM public.deals WHERE stage_checklist<>'{}'::jsonb;
CREATE TABLE crm_stage_check_archive.command_receipts AS SELECT * FROM crm_security.command_receipts WHERE operation='stage_check';
REVOKE ALL ON crm_stage_check_archive.deal_stage_checklist,crm_stage_check_archive.command_receipts FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts WHERE operation='stage_check';
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb);
DROP FUNCTION crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb);
ALTER FUNCTION crm_security.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb) RENAME TO crm_write_command_v2;
ALTER FUNCTION crm_security.crm_write_command_v2(uuid,text,uuid,integer,jsonb) SET SCHEMA public;
REVOKE EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) TO authenticated;
DROP FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer);
ALTER FUNCTION crm_security.crm_operational_source_fragment_pre_stage_20260906(text,uuid,integer) RENAME TO crm_operational_source_fragment_v1;
REVOKE EXECUTE ON FUNCTION crm_security.crm_operational_source_fragment_v1(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.deals DROP COLUMN stage_checklist;
ALTER TABLE crm_security.command_receipts DROP CONSTRAINT command_receipts_operation_check;
ALTER TABLE crm_security.command_receipts ADD CONSTRAINT command_receipts_operation_check CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch','next_action','activity','quote_version','next_action_complete'));
DO $post$ BEGIN
 IF to_regprocedure('crm_security.crm_write_command_v2_next_complete_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_stage_check_command_v1(uuid,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_operational_source_fragment_pre_stage_20260906(text,uuid,integer)') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_checklist')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check') IS DISTINCT FROM $expected$${ten}$expected$
 THEN RAISE EXCEPTION 'stage-check rollback verification drift'; END IF;
END $post$;
COMMIT;
`;}
function build(){fs.writeFileSync(path.join(dir,'staging-apply-after-next-complete.sql'),applySql());fs.writeFileSync(path.join(dir,'rollback-after-next-complete.sql'),rollbackSql());fs.writeFileSync(path.join(dir,'operational-adapter.candidate.js'),adapter());fs.writeFileSync(path.join(dir,'operational-overlay.candidate.js'),overlay());const names=['helper.sql','adapter-contract.js','contract.test.cjs','db.test.cjs','ui.test.cjs','review.md','staging-apply-after-next-complete.sql','rollback-after-next-complete.sql','operational-adapter.candidate.js','operational-overlay.candidate.js'];const manifest={project_ref:'rprechiaglyjaydkmxsu',status:'LOCAL_CHAIN_CANDIDATE_AFTER_NEXT_COMPLETE_NOT_APPLIED',prerequisites:['personal-state-compat/20260906','pipeline-action-bundle/20260906','pipeline-quote-version/20260906','operational-read-source/20260906','pipeline-next-complete/20260906'],operation:'stage_check',write_scope:'manual_checklist_items_only',automatic_items:'derived_from_operational_data_never_written',staging_ddl_dml_performed:false,files_sha256:Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))])),source_sha256:{golden_pc:sha(fs.readFileSync(path.join(root,'crm.html'))),golden_mobile:sha(fs.readFileSync(path.join(root,'mobile.html'))),golden_sql:sha(fs.readFileSync(path.join(root,'sql/20260905_sales_execution_engine.sql'))),next_manifest:sha(fs.readFileSync(path.join(root,'sql/pipeline-next-complete/20260906/manifest.json')))}};fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;}
if(require.main===module)console.log(JSON.stringify(build(),null,2));
module.exports={applySql,rollbackSql,adapter,overlay,build,ten,eleven,sourceFragment};
