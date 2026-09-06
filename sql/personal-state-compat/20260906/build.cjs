'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const operational=require('../../operational-bundle/20260906/build.cjs');
const phase=require('../../../scripts/crm-phase1.cjs');
const dir=__dirname,root=path.resolve(dir,'../../..');
const approval="SET crm.personal_state_ref='rprechiaglyjaydkmxsu';\n";
const source=()=>fs.readFileSync(path.join(dir,'candidate.sql'),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const md5=x=>crypto.createHash('md5').update(x).digest('hex');
function one(text,needle,label){const n=text.split(needle).length-1;if(n!==1)throw Error(`${label} drift (${n})`);}
function snapshotsGuard(snapshot){return phase.guard(snapshot.public)+'\n'+phase.guard(snapshot.private,'crm_security');}
async function setup(){const db=await operational.setup();await db.exec(operational.approval+operational.compose());return db;}
async function capture(db){return operational.capture(db);}
function functionFromSnapshot(snapshot,signature){const f=[...(snapshot.public.functions||[]),...(snapshot.private.functions||[])].find(x=>x.signature===signature);if(!f)throw Error('missing snapshot function '+signature);return f;}
function liveFunction(live,signature){const f=(live?.functions||[]).find(x=>x.signature===signature);if(!f)throw Error('missing live function evidence '+signature);return f;}
function liveGuard(before,live){
 const write=functionFromSnapshot(before,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)');
 const read=functionFromSnapshot(before,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)');
 const frozen=functionFromSnapshot(before,'crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)');
 const unassign=functionFromSnapshot(before,'crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)');
 const liveWrite=liveFunction(live,write.signature),liveRead=liveFunction(live,read.signature);
 const liveFrozen=liveFunction(live,frozen.signature),liveUnassign=liveFunction(live,unassign.signature);
 const constraint=(before.private.constraints||[]).find(x=>x.table==='command_receipts'&&x.name==='command_receipts_operation_check');
 if(!constraint)throw Error('missing receipt constraint');
 return `DO $live_baseline$ DECLARE w record; r record; f record; u record; BEGIN
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 SELECT * INTO f FROM pg_proc WHERE oid='crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO u FROM pg_proc WHERE oid='crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)'::regprocedure;
 IF w.oid<>${liveWrite.oid} OR md5(pg_get_functiondef(w.oid)) IS DISTINCT FROM '${liveWrite.definition_md5}'
  OR pg_get_userbyid(w.proowner)<>'postgres' OR NOT w.prosecdef
  OR w.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(w.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR r.oid<>${liveRead.oid} OR md5(pg_get_functiondef(r.oid)) IS DISTINCT FROM '${liveRead.definition_md5}'
  OR pg_get_userbyid(r.proowner)<>'postgres' OR NOT r.prosecdef
  OR r.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(r.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres}'
  OR f.oid<>${liveFrozen.oid} OR md5(pg_get_functiondef(f.oid)) IS DISTINCT FROM '${liveFrozen.definition_md5}'
  OR pg_get_userbyid(f.proowner)<>'postgres' OR NOT f.prosecdef
  OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(f.proacl::text,'')<>'{postgres=X/postgres}'
  OR u.oid<>${liveUnassign.oid} OR md5(pg_get_functiondef(u.oid)) IS DISTINCT FROM '${liveUnassign.definition_md5}'
  OR pg_get_userbyid(u.proowner)<>'postgres' OR NOT u.prosecdef
  OR u.proconfig IS DISTINCT FROM ARRAY['search_path=""']
  OR coalesce(u.proacl::text,'')<>'{postgres=X/postgres}'
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$${constraint.definition}$expected$
 THEN RAISE EXCEPTION 'deployed operational bundle OID/definition/ACL/config drift'; END IF;
END $live_baseline$;`;
}
function targetPostGuard(after,live){
 const write=functionFromSnapshot(after,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)');
 const read=functionFromSnapshot(after,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)');
 const helper=functionFromSnapshot(after,'crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)');
 const liveWrite=liveFunction(live,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)');
 return `DO $target_post_guard$ DECLARE w record; r record; h record; moved record; state_rel record; BEGIN
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 SELECT * INTO h FROM pg_proc WHERE oid='crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO moved FROM pg_proc WHERE oid='crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO state_rel FROM pg_class WHERE oid='crm_security.user_opportunity_state'::regclass;
 IF md5(pg_get_functiondef(w.oid))<>'${md5(write.definition)}'
  OR md5(pg_get_functiondef(r.oid))<>'${md5(read.definition)}'
  OR md5(pg_get_functiondef(h.oid))<>'${md5(helper.definition)}'
  OR moved.oid<>${liveWrite.oid}
  OR pg_get_userbyid(state_rel.relowner)<>'postgres' OR NOT state_rel.relrowsecurity
  OR has_table_privilege('public',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('anon',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('authenticated',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('service_role',state_rel.oid,'SELECT,INSERT,UPDATE,DELETE')
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text, 'favorite_set'::text, 'opportunity_touch'::text]))$expected$
 THEN RAISE EXCEPTION 'personal-state targeted post-apply drift'; END IF;
END $target_post_guard$;`;
}
function restoredGuard(live){
 const write=liveFunction(live,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)');
 const read=liveFunction(live,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)');
 return `DO $restored_guard$ DECLARE w record; r record; BEGIN
 SELECT * INTO w FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure;
 SELECT * INTO r FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure;
 IF w.oid<>${write.oid} OR md5(pg_get_functiondef(w.oid))<>'${write.definition_md5}'
  OR r.oid<>${read.oid} OR md5(pg_get_functiondef(r.oid))<>'${read.definition_md5}'
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NOT NULL
  OR to_regclass('crm_personal_state_archive.user_opportunity_state') IS NULL
  OR (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint
      WHERE conrelid='crm_security.command_receipts'::regclass
       AND conname='command_receipts_operation_check')
     IS DISTINCT FROM $expected$CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text, 'service_change'::text, 'inquiry_unassign'::text]))$expected$
 THEN RAISE EXCEPTION 'personal-state targeted rollback verification drift'; END IF;
END $restored_guard$;`;
}
function rollback(before,after,previousRead,live){return `${approval}BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $approval$ BEGIN
 IF current_user<>'postgres'
  OR current_setting('crm.personal_state_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
  OR to_regprocedure('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL
  OR to_regclass('crm_security.user_opportunity_state') IS NULL
  OR to_regnamespace('crm_personal_state_archive') IS NOT NULL
 THEN RAISE EXCEPTION 'personal-state rollback approval/drift failure'; END IF;
END $approval$;
${targetPostGuard(after,live)}
LOCK TABLE crm_security.command_receipts,crm_security.user_opportunity_state IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA crm_personal_state_archive AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA crm_personal_state_archive FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE crm_personal_state_archive.command_receipts AS
 SELECT * FROM crm_security.command_receipts
 WHERE operation IN ('favorite_set','opportunity_touch');
REVOKE ALL ON crm_personal_state_archive.command_receipts
 FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM crm_security.command_receipts
 WHERE operation IN ('favorite_set','opportunity_touch');
${previousRead};
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
DROP FUNCTION crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
ALTER FUNCTION crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)
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
 CHECK(operation IN ('opportunity_work_set','inquiry_assign','service_change','inquiry_unassign'));
ALTER TABLE crm_security.user_opportunity_state
 SET SCHEMA crm_personal_state_archive;
REVOKE ALL ON crm_personal_state_archive.user_opportunity_state
 FROM PUBLIC,anon,authenticated,service_role;
${restoredGuard(live)}
COMMIT;`}
function patchUi(){
 const uiDir=path.join(root,'sql','operational-ui','20260906');
 let adapter=fs.readFileSync(path.join(uiDir,'operational-adapter.js'),'utf8');
 one(adapter,"const operations=Object.freeze(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change']);",'adapter operations');
 adapter=adapter.replace("const operations=Object.freeze(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change']);","const operations=Object.freeze(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change','favorite_set','opportunity_touch']);");
 const oldNormalize="function normalize(operation,objectId,expectedVersion,payload){if(!operations.includes(operation))fail('OP_NOT_CONNECTED');if(!UUID.test(objectId)||!object(payload))fail('INVALID_COMMAND');const inquiry=operation==='inquiry_assign'||operation==='inquiry_unassign';if(inquiry){if(expectedVersion!==0)fail('INVALID_VERSION');}else if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)fail('READ_VERSION_REQUIRED');const normalized=operation==='opportunity_work_set'?normalizeWork(payload):operation==='inquiry_assign'?normalizeAssign(payload):operation==='inquiry_unassign'?normalizeUnassign(payload):normalizeService(payload);return Object.freeze({operation,object_id:objectId,expected_version:expectedVersion,payload:Object.freeze(normalized)});}";
 const newNormalize="function normalizePersonal(operation,objectId,payload){if(payload.opportunity_id!==undefined&&payload.opportunity_id!==objectId)fail('OBJECT_MISMATCH');if(operation==='favorite_set'){if(Object.keys(payload).some(k=>!['opportunity_id','user_key','favorite'].includes(k))||typeof payload.favorite!=='boolean')fail('INVALID_FAVORITE_PAYLOAD');return {favorite:payload.favorite};}if(Object.keys(payload).some(k=>!['opportunity_id','user_key','touch_kind','touched_at'].includes(k))||!['view','work'].includes(payload.touch_kind))fail('INVALID_TOUCH_PAYLOAD');return {touch_kind:payload.touch_kind};}\n function normalize(operation,objectId,expectedVersion,payload){if(!operations.includes(operation))fail('OP_NOT_CONNECTED');if(!UUID.test(objectId)||!object(payload))fail('INVALID_COMMAND');const sentinel=operation==='inquiry_assign'||operation==='inquiry_unassign'||operation==='favorite_set'||operation==='opportunity_touch';if(sentinel){if(expectedVersion!==0)fail('INVALID_VERSION');}else if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)fail('READ_VERSION_REQUIRED');const normalized=operation==='opportunity_work_set'?normalizeWork(payload):operation==='inquiry_assign'?normalizeAssign(payload):operation==='inquiry_unassign'?normalizeUnassign(payload):operation==='service_change'?normalizeService(payload):normalizePersonal(operation,objectId,payload);return Object.freeze({operation,object_id:objectId,expected_version:expectedVersion,payload:Object.freeze(normalized)});}";
 one(adapter,oldNormalize,'adapter normalize');adapter=adapter.replace(oldNormalize,newNormalize);
 const oldReturn="if(command.operation==='service_change'&&(ack.previous_version!==command.expected_version||ack.version!==command.expected_version+1||(ack.from_service!==null&&typeof ack.from_service!=='string')||ack.to_service!==command.payload.to_service||ack.business_history_id==null||!UUID.test(ack.activity_id)||!UUID.test(ack.audit_event_id)||(command.payload.next_action?!UUID.test(ack.next_action_id):ack.next_action_id!=null)))fail('ACK_CONTRACT_MISMATCH');return ack;}";
 const newReturn="if(command.operation==='service_change'&&(ack.previous_version!==command.expected_version||ack.version!==command.expected_version+1||(ack.from_service!==null&&typeof ack.from_service!=='string')||ack.to_service!==command.payload.to_service||ack.business_history_id==null||!UUID.test(ack.activity_id)||!UUID.test(ack.audit_event_id)||(command.payload.next_action?!UUID.test(ack.next_action_id):ack.next_action_id!=null)))fail('ACK_CONTRACT_MISMATCH');if((command.operation==='favorite_set'||command.operation==='opportunity_touch')&&(typeof ack.favorite!=='boolean'||!Number.isSafeInteger(ack.view_count)||ack.view_count<0||typeof ack.server_at!=='string'))fail('ACK_CONTRACT_MISMATCH');if(command.operation==='favorite_set'&&(ack.favorite!==command.payload.favorite||ack.touch_kind!==null))fail('ACK_CONTRACT_MISMATCH');if(command.operation==='opportunity_touch'&&(ack.touch_kind!==command.payload.touch_kind||(ack.touch_kind==='view'&&typeof ack.last_viewed_at!=='string')||(ack.touch_kind==='work'&&typeof ack.last_worked_at!=='string')))fail('ACK_CONTRACT_MISMATCH');return ack;}";
 one(adapter,oldReturn,'adapter ack');adapter=adapter.replace(oldReturn,newReturn);

 let overlay=fs.readFileSync(path.join(uiDir,'operational-overlay.js'),'utf8');
 one(overlay,"const connected=new Set(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change']);",'overlay connected');
 overlay=overlay.replace("const connected=new Set(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change']);","const connected=new Set(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change','favorite_set','opportunity_touch']);\n const personal=new Set(['favorite_set','opportunity_touch']);");
 const oldSync="function syncQueue(){root.WRITE_Q=root.Phase1.queue.list();for(const q of root.WRITE_Q){if(q.status==='done'&&q.ack&&!seenAcks.has(q.request_id)){seenAcks.add(q.request_id);if(Number.isSafeInteger(q.ack.version))versions.set(q.object_id,q.ack.version);}}if(typeof root.updateSyncBadge==='function')root.updateSyncBadge();if(typeof root.updatePendingBadge==='function')root.updatePendingBadge();}";
 const newSync="function applyPersonalAck(q){const a=q.ack,lists=[root.B&&root.B.deals,root.DEALS];for(const rows of lists)if(Array.isArray(rows))for(const d of rows)if(String(d.id||d.opportunity_id)===String(q.object_id)){d.favorite=a.favorite;d.last_viewed_at=a.last_viewed_at;d.last_worked_at=a.last_worked_at;d.view_count=a.view_count;}}\n  function syncQueue(){root.WRITE_Q=root.Phase1.queue.list();for(const q of root.WRITE_Q){if(q.status==='done'&&q.ack&&!seenAcks.has(q.request_id)){seenAcks.add(q.request_id);if(Number.isSafeInteger(q.ack.version))versions.set(q.object_id,q.ack.version);if(personal.has(q.operation))applyPersonalAck(q);}}if(typeof root.updateSyncBadge==='function')root.updateSyncBadge();if(typeof root.updatePendingBadge==='function')root.updatePendingBadge();}";
 one(overlay,oldSync,'overlay sync');overlay=overlay.replace(oldSync,newSync);
 const oldExpected="const expected=op.startsWith('inquiry_')?0:versionFor(id,payload);";
 const newExpected="const expected=op.startsWith('inquiry_')||personal.has(op)?0:versionFor(id,payload);";
 one(overlay,oldExpected,'overlay expected');overlay=overlay.replace(oldExpected,newExpected);
 const oldMobile="workSummary:d.work_summary||'',version:d.version,tl:[]";
 const newMobile="workSummary:d.work_summary||'',version:d.version,favorite:!!d.favorite,last_viewed_at:d.last_viewed_at||null,last_worked_at:d.last_worked_at||null,view_count:Number(d.view_count||0),tl:[]";
 one(overlay,oldMobile,'overlay mobile read');overlay=overlay.replace(oldMobile,newMobile);
 one(overlay,'승인된 4개 저장 op만 연결됨','overlay status count');overlay=overlay.replace('승인된 4개 저장 op만 연결됨','승인된 6개 저장 op만 연결됨');

 let uiBuild=fs.readFileSync(path.join(uiDir,'build.cjs'),'utf8');
 const oldConnected="connected_operations:['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change']";
 const newConnected="connected_operations:['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change','favorite_set','opportunity_touch']";
 one(uiBuild,oldConnected,'UI build operations');uiBuild=uiBuild.replace(oldConnected,newConnected);
 one(uiBuild,'write.results?.length===4','UI write evidence count');uiBuild=uiBuild.replace('write.results?.length===4','write.results?.length===6');

 let uiTest=fs.readFileSync(path.join(uiDir,'ui.test.cjs'),'utf8');
 one(uiTest,'adapter maps only four approved legacy operations','UI test title');uiTest=uiTest.replace('adapter maps only four approved legacy operations','adapter maps the six approved compatibility operations');
 const oldTestOperations="['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change']";
 const newTestOperations="['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change','favorite_set','opportunity_touch']";
 one(uiTest,oldTestOperations,'UI test operations');uiTest=uiTest.replace(oldTestOperations,newTestOperations);
 one(uiTest,"assert.equal(manifest.browser_transport_write_status,'PASS');",'UI evidence assertion');uiTest=uiTest.replace("assert.equal(manifest.browser_transport_write_status,'PASS');","assert.equal(manifest.browser_transport_write_status,'NOT_RUN');");
 one(uiTest,"assert.equal(manifest.status,'LOCAL_UI_CANDIDATE_BROWSER_TRANSPORT_PASS_NOT_DEPLOYED');",'UI status assertion');uiTest=uiTest.replace("assert.equal(manifest.status,'LOCAL_UI_CANDIDATE_BROWSER_TRANSPORT_PASS_NOT_DEPLOYED');","assert.equal(manifest.status,'LOCAL_UI_CANDIDATE_BROWSER_READ_PASS_NOT_DEPLOYED');");

 let uiReview=fs.readFileSync(path.join(uiDir,'review.md'),'utf8');
 uiReview=uiReview.replace('상태: `LOCAL_UI_CANDIDATE_BROWSER_TRANSPORT_PASS_NOT_DEPLOYED`','상태: `LOCAL_UI_CANDIDATE_BROWSER_READ_PASS_NOT_DEPLOYED / T03 BROWSER WRITE NOT RUN`')
  .replace('승인된 4개 write의 서버 JWT 증거','기존 4개 write의 서버 JWT 증거')
  .replace('4/4 PASS, 최종 표시값 동일','기존 4/4 PASS, 최종 표시값 동일')
  .replace('- `service_change`\n- `crm_read_scoped_v2` inquiry-compatible projection','- `service_change`\n- `favorite_set`\n- `opportunity_touch`\n- `crm_read_scoped_v2` inquiry-compatible + per-actor personal-state projection')
  .replace('네 op payload','여섯 op payload');
 return {adapter,overlay,uiBuild,uiTest,uiReview,uiDir};
}
function unified(oldPath,newPath,repoPath){const oldRel=path.relative(root,oldPath).replaceAll('\\','/'),newRel=path.relative(root,newPath).replaceAll('\\','/');const x=cp.spawnSync('git',['diff','--no-index','--',oldRel,newRel],{cwd:root,encoding:'utf8'});if(x.status!==1)throw Error('expected UI diff: '+(x.stderr||x.status));return x.stdout.replaceAll(oldRel,repoPath).replaceAll(newRel,repoPath);}
async function build(){const db=await setup();try{
 const preflightPath=path.join(dir,'staging-preflight.json'),preflight=fs.existsSync(preflightPath)?JSON.parse(fs.readFileSync(preflightPath,'utf8')):null;
 const livePath=path.join(dir,'staging-live-baseline.json'),live=fs.existsSync(livePath)?JSON.parse(fs.readFileSync(livePath,'utf8')):null;
 const before=await capture(db),candidate=source();
 const previousRead=live?.read_definition_base64?Buffer.from(live.read_definition_base64,'base64').toString('utf8'):(await db.query("SELECT pg_get_functiondef('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure) d")).rows[0].d;
 const oldDispatcher=(await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
 await db.exec(approval+candidate);
 const after=await capture(db);
 const moved=(await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid='crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
 if(oldDispatcher.oid!==moved.oid||oldDispatcher.prosrc!==moved.prosrc||oldDispatcher.proconfig.join('|')!==moved.proconfig.join('|'))throw Error('operational dispatcher delegate drift');
 const apply=approval+candidate.replace('-- LIVE_BASELINE_GUARD',liveGuard(before,live)).replace('-- BEFORE_METADATA_GUARD','-- Target-scoped live guard above replaces cross-engine snapshot MD5.').replace('-- AFTER_METADATA_GUARD',targetPostGuard(after,live));
 const undo=rollback(before,after,previousRead,live);
 const ui=patchUi(),adapterPath=path.join(dir,'operational-adapter.candidate.js'),overlayPath=path.join(dir,'operational-overlay.candidate.js'),buildPath=path.join(dir,'operational-ui-build.candidate.cjs'),testPath=path.join(dir,'operational-ui-test.candidate.cjs'),reviewPath=path.join(dir,'operational-ui-review.candidate.md');
 fs.writeFileSync(adapterPath,ui.adapter);fs.writeFileSync(overlayPath,ui.overlay);fs.writeFileSync(buildPath,ui.uiBuild);fs.writeFileSync(testPath,ui.uiTest);fs.writeFileSync(reviewPath,ui.uiReview);
 const diff=[
  unified(path.join(ui.uiDir,'operational-adapter.js'),adapterPath,'sql/operational-ui/20260906/operational-adapter.js'),
  unified(path.join(ui.uiDir,'operational-overlay.js'),overlayPath,'sql/operational-ui/20260906/operational-overlay.js'),
  unified(path.join(ui.uiDir,'build.cjs'),buildPath,'sql/operational-ui/20260906/build.cjs'),
  unified(path.join(ui.uiDir,'ui.test.cjs'),testPath,'sql/operational-ui/20260906/ui.test.cjs'),
  unified(path.join(ui.uiDir,'review.md'),reviewPath,'sql/operational-ui/20260906/review.md')
 ].join('\n');
 const outputs={'before.json':JSON.stringify(before,null,2)+'\n','after.json':JSON.stringify(after,null,2)+'\n','staging-apply.sql':apply,'rollback.sql':undo,'ui-minimal.diff':diff};for(const [name,value] of Object.entries(outputs))fs.writeFileSync(path.join(dir,name),value);
 const files=['candidate.sql','staging-apply.sql','rollback.sql','adapter-contract.js','operational-adapter.candidate.js','operational-overlay.candidate.js','operational-ui-build.candidate.cjs','operational-ui-test.candidate.cjs','operational-ui-review.candidate.md','ui-minimal.diff','review.md','db.test.cjs','ui.test.cjs'];
 if(preflight)files.push('staging-preflight.json');
 if(live)files.push('staging-live-baseline.json');
 const manifest={
  project_ref:'rprechiaglyjaydkmxsu',status:preflight?.matches_expected&&live?'LOCAL_APPLY_READY_LIVE_CANONICAL_PREFLIGHT_PASS_NOT_APPLIED':'LOCAL_APPLY_READY_PENDING_LIVE_PREFLIGHT_NOT_APPLIED',
  base:'operational-bundle/20260906',operations:['favorite_set','opportunity_touch'],
  all_dispatcher_operations:['opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch'],
  connected_operations:['favorite_set','opportunity_touch'],
  expected_live_oids:{original_frozen_dispatcher:liveFunction(live,'crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)').oid,scoped_read:liveFunction(live,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)').oid,current_operational_dispatcher:liveFunction(live,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)').oid},
  current_operational_definition_md5:md5(functionFromSnapshot(before,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)').definition),
  current_read_definition_md5:md5(functionFromSnapshot(before,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)').definition),
  local_old_dispatcher_oid:oldDispatcher.oid,local_moved_delegate_oid:moved.oid,
  public_dispatcher_changed:true,frozen_four_operation_body_changed:false,
  staging_ddl_dml_performed:false,remote_access_performed:false,
  live_preflight:preflight?{status:preflight.matches_expected?'CANONICAL_PASS':'DRIFT_DETECTED',comparison:'COMPLETE_SQL_TOKEN_SEQUENCE',write_oid:preflight.write?.oid??null,read_oid:preflight.read?.oid??null,actual_write_definition_md5:preflight.write?.definition_md5??null,actual_read_definition_md5:preflight.read?.definition_md5??null,exact_raw_apply_guard:true,cross_engine_full_snapshot_guard:false}: {status:'NOT_RUN'},
  files_sha256:Object.fromEntries(files.map(name=>[name,sha(fs.readFileSync(path.join(dir,name)))])),
  source_sha256:{
   operational_after:sha(fs.readFileSync(path.join(root,'sql','operational-bundle','20260906','after.json'))),
   operational_adapter:sha(fs.readFileSync(path.join(ui.uiDir,'operational-adapter.js'))),
   operational_overlay:sha(fs.readFileSync(path.join(ui.uiDir,'operational-overlay.js')))
  }
 };
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
 }finally{await db.close();}}
if(require.main===module)build().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={dir,root,approval,setup,capture,liveGuard,rollback,patchUi,build};
