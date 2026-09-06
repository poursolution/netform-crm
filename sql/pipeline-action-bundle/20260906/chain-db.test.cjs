'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const personal=require('../../personal-state-compat/20260906/build.cjs');
const action=require('./build.cjs');
const s=require('../../../scripts/crm-phase1.cjs');
const personalCandidate=fs.readFileSync(path.join(__dirname,'../../personal-state-compat/20260906/candidate.sql'),'utf8');
const deal=s.uid(6,1),rep=s.uid(1,1),auth=s.mapping.accounts[0].auth_uid;
const request=n=>`f6090600-0042-4000-8000-${String(n).padStart(12,'0')}`;
async function call(db,op,id,version,payload){await db.exec(`SET request.jwt.claim.sub='${auth}';`);return (await db.query('SELECT public.crm_write_command_v2($1,$2,$3,$4,$5) a',[id,op,deal,version,JSON.stringify(payload)])).rows[0].a;}

test('action wrapper composes after personal state and rollback leaves the six-op layer intact',async()=>{
 const db=await personal.setup();try{
  await db.exec(personal.approval+personalCandidate);
  const personalOid=(await db.query("SELECT oid FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0].oid;
  await db.exec(action.applySql());
  const moved=(await db.query("SELECT oid FROM pg_proc WHERE oid='crm_security.crm_write_command_v2_personal_20260906(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0].oid;
  assert.equal(moved,personalOid);
  const fav=await call(db,'favorite_set',request(1),0,{favorite:true});assert.equal(fav.favorite,true);assert.equal(fav.actor_user_id,rep);
  const next=await call(db,'next_action',request(2),1,{type:'\uC804\uD654',text:'\uACAC\uC801 \uD655\uC778',due_at:'2026-09-12'});assert.equal(next.version,2);assert.match(next.next_action_id,/^[0-9a-f-]{36}$/i);
  const activity=await call(db,'activity',request(3),2,{type:'\uC804\uD654',note:'\uACE0\uAC1D \uD1B5\uD654 \uC644\uB8CC',result:'\uACAC\uC801 \uAC80\uD1A0',occurred_at:'2026-09-06T01:00:00Z',meaningful_contact:true});assert.equal(activity.version,3);assert.equal(activity.meaningful_contact,true);
  const replay=await call(db,'activity',request(3),2,{type:'\uC804\uD654',note:'\uACE0\uAC1D \uD1B5\uD654 \uC644\uB8CC',result:'\uACAC\uC801 \uAC80\uD1A0',occurred_at:'2026-09-06T01:00:00Z',meaningful_contact:true});assert.equal(replay.replayed,true);
  assert.equal((await db.query("SELECT count(*)::int n FROM public.activities WHERE id=$1",[activity.activity_id])).rows[0].n,1);
  for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("SELECT has_function_privilege($1,'crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);
  await db.exec(action.rollbackSql());
  assert.equal((await db.query("SELECT to_regprocedure('crm_security.crm_pipeline_action_command_v1(uuid,text,uuid,integer,jsonb)') IS NULL gone")).rows[0].gone,true);
  assert.equal((await db.query("SELECT oid FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0].oid,personalOid);
  assert.equal((await db.query('SELECT count(*)::int n FROM crm_pipeline_action_archive.command_receipts')).rows[0].n,2);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.activities WHERE id=$1',[activity.activity_id])).rows[0].n,1);
  const touch=await call(db,'opportunity_touch',request(4),0,{touch_kind:'view'});assert.equal(touch.touch_kind,'view');
 }finally{await db.close();}
});
