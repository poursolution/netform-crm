'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bundle=require('../../operational-bundle/20260906/build.cjs');
const s=require('../../../scripts/crm-phase1.cjs');
const approval="SET crm.pipeline_action_ref='rprechiaglyjaydkmxsu';\n";
const candidate=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8');
const rollback=fs.readFileSync(path.join(__dirname,'rollback.sql'),'utf8');
const deal=s.uid(6,1),rep=s.uid(1,1),repAuth=s.mapping.accounts[0].auth_uid;
const request=n=>`f6090500-0022-4000-8000-${String(n).padStart(12,'0')}`;
async function helper(db,{id,op,version,payload},account=0){
 await db.exec(`SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);
 return (await db.query('SELECT crm_security.crm_pipeline_action_command_v1($1,$2,$3,$4,$5) a',[id,op,deal,version,JSON.stringify(payload)])).rows[0].a;
}
const nextPayload=(patch={})=>({type:'전화',text:'견적 회신 확인',due_at:'2026-09-12',...patch});
const activityPayload=(patch={})=>({type:'전화',note:'고객 통화 완료',result:'견적 검토 중',occurred_at:'2026-09-06T01:00:00.000Z',...patch});

test('private action helpers preserve the public Dispatcher and durable evidence',async t=>{
 const db=await bundle.setup(); try{
  await db.exec(bundle.approval+bundle.compose());
  const dispatcher=(await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
  await db.exec(approval+candidate);
  await t.test('no public endpoint was added or changed',async()=>{
   const after=(await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
   assert.deepEqual(after,dispatcher);
   assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='crm_write_command_v2'")).rows[0].n,1);
   for(const role of ['anon','authenticated','service_role'])
    assert.equal((await db.query("SELECT has_function_privilege($1,'crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);
  });
  let nextAck,activityAck;
  await t.test('base next action replaces the current open row atomically',async()=>{
   nextAck=await helper(db,{id:request(1),op:'next_action',version:1,payload:nextPayload()});
   assert.equal(nextAck.operation,'next_action'); assert.equal(nextAck.version,2);
   assert.equal(nextAck.actor_auth_uid,repAuth); assert.equal(nextAck.actor_user_id,rep);
   const created=(await db.query('SELECT action_type,title,due_at::date::text,assignee_name,status FROM public.next_actions WHERE id=$1',[nextAck.next_action_id])).rows[0];
   assert.deepEqual(created,{action_type:'전화',title:'견적 회신 확인',due_at:'2026-09-12',assignee_name:'TEST INTERNAL_REP',status:'open'});
   assert.equal((await db.query("SELECT count(*)::int n FROM public.next_actions WHERE deal_id=$1 AND status='open'",[deal])).rows[0].n,1);
   const d=(await db.query('SELECT next_action,next_action_date::text,version FROM public.deals WHERE id=$1',[deal])).rows[0];
   assert.deepEqual(d,{next_action:'견적 회신 확인',next_action_date:'2026-09-12',version:2});
  });
  await t.test('replay and collision create no duplicate next action',async()=>{
   const replay=await helper(db,{id:request(1),op:'next_action',version:1,payload:nextPayload()}); assert.equal(replay.replayed,true);
   await assert.rejects(helper(db,{id:request(1),op:'next_action',version:1,payload:nextPayload({text:'다른 payload'})}),e=>e.code==='PT409');
   assert.equal((await db.query('SELECT count(*)::int n FROM public.next_actions WHERE id=$1',[nextAck.next_action_id])).rows[0].n,1);
  });
  await t.test('standalone activity records server actor and meaningful contact',async()=>{
   activityAck=await helper(db,{id:request(2),op:'activity',version:2,payload:activityPayload()});
   assert.equal(activityAck.meaningful_contact,true); assert.equal(activityAck.version,3);
   const a=(await db.query('SELECT actor_name,type,detail FROM public.activities WHERE id=$1',[activityAck.activity_id])).rows[0];
   assert.equal(a.actor_name,'TEST INTERNAL_REP'); assert.equal(a.type,'전화');
   assert.deepEqual(a.detail,{note:'고객 통화 완료',result:'견적 검토 중',meaningful_contact:true});
   const audit=(await db.query('SELECT actor_auth_uid,actor_user_id,action FROM crm_security.audit_events WHERE event_id=$1',[activityAck.audit_event_id])).rows[0];
   assert.deepEqual(audit,{actor_auth_uid:repAuth,actor_user_id:rep,action:'activity'});
   const replay=await helper(db,{id:request(2),op:'activity',version:2,payload:activityPayload()}); assert.equal(replay.replayed,true);
   assert.equal((await db.query('SELECT count(*)::int n FROM public.activities WHERE id=$1',[activityAck.activity_id])).rows[0].n,1);
  });
  await t.test('negative contact inference, stale version and scope fail closed',async()=>{
   const a=await helper(db,{id:request(3),op:'activity',version:3,payload:activityPayload({note:'전화 시도 - 부재',result:''})});
   assert.equal(a.meaningful_contact,false);
   await assert.rejects(helper(db,{id:request(4),op:'activity',version:3,payload:activityPayload()}),e=>e.code==='PT409');
   await assert.rejects(helper(db,{id:request(5),op:'activity',version:4,payload:activityPayload()},1),e=>e.code==='42501');
  });
 } finally {await db.close();}
});

test('rollback removes helper/receipts but retains business and audit evidence',async()=>{
 const db=await bundle.setup(); try{
  await db.exec(bundle.approval+bundle.compose()); await db.exec(approval+candidate);
  const dispatcher=(await db.query("SELECT oid,prosrc FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
  const n=await helper(db,{id:request(20),op:'next_action',version:1,payload:nextPayload()});
  const a=await helper(db,{id:request(21),op:'activity',version:2,payload:activityPayload()});
  await db.exec(approval+rollback);
  assert.equal((await db.query("SELECT to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL gone")).rows[0].gone,true);
  assert.deepEqual((await db.query("SELECT oid,prosrc FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0],dispatcher);
  assert.equal((await db.query("SELECT count(*)::int n FROM crm_pipeline_action_archive.command_receipts")).rows[0].n,2);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.next_actions WHERE id=$1',[n.next_action_id])).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.activities WHERE id=$1',[a.activity_id])).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int n FROM crm_security.audit_events WHERE action IN ('next_action','activity')")).rows[0].n,2);
 } finally {await db.close();}
});
