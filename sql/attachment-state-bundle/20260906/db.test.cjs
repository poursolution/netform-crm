'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const s=require('../../../scripts/crm-phase1.cjs');
const bundle=require('../../operational-bundle/20260906/build.cjs');
const dir=__dirname,approval="SET crm.attachment_state_ref='rprechiaglyjaydkmxsu';\n";
const candidate=fs.readFileSync(path.join(dir,'candidate.sql'),'utf8');
const rollback=fs.readFileSync(path.join(dir,'rollback.sql'),'utf8');
const deal1=s.uid(6,1),deal2=s.uid(6,2),rep=s.uid(1,1),admin=s.uid(1,5);
const request=n=>`f6090500-0024-4000-8000-${String(n).padStart(12,'0')}`;
async function as(db,account,op,id,payload,object=deal1){
 await db.exec(`SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);
 return (await db.query('SELECT crm_security.crm_user_opportunity_state_command_v1($1,$2,$3,$4) a',[id,op,object,JSON.stringify(payload)])).rows[0].a;
}
async function read(db,account){await db.exec(`SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);return (await db.query('SELECT crm_security.crm_user_opportunity_states_v1() a')).rows[0].a;}

test('T03 isolated PostgreSQL candidate',async t=>{const db=await bundle.setup();try{
 await db.exec(bundle.approval+bundle.compose());
 const dispatcher=(await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
 await db.exec(approval+candidate);
 await t.test('public Dispatcher is byte/config/ACL stable and private ACL is closed',async()=>{
  assert.deepEqual((await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0],dispatcher);
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'crm%attachment%' OR n.nspname='public' AND p.proname LIKE 'crm%opportunity%state%'")).rows[0].n,0);
  for(const role of ['anon','authenticated','service_role']){
   assert.equal((await db.query("SELECT has_function_privilege($1,'crm_security.crm_user_opportunity_state_command_v1(uuid,text,uuid,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);
   assert.equal((await db.query("SELECT has_table_privilege($1,'crm_security.user_opportunity_state','SELECT,INSERT,UPDATE,DELETE') allowed",[role])).rows[0].allowed,false);
  }
 });
 let fav,touch;
 await t.test('server actor owns favorite and forged client identity is ignored',async()=>{
  fav=await as(db,0,'favorite_set',request(1),{opportunity_id:deal1,user_key:'crm-admin@example.invalid',favorite:true});
  assert.equal(fav.actor_user_id,rep);assert.equal(fav.favorite,true);
  const row=(await db.query('SELECT * FROM crm_security.user_opportunity_state')).rows[0];
  assert.equal(row.actor_user_id,rep);assert.equal(row.deal_id,deal1);assert.equal(row.favorite,true);
 });
 await t.test('touch uses server time, separates kind and replay increments zero',async()=>{
  touch=await as(db,0,'opportunity_touch',request(2),{opportunity_id:deal1,user_key:'FORGED',touch_kind:'view',touched_at:'1900-01-01T00:00:00Z'});
  assert.equal(touch.view_count,1);assert.notEqual(String(touch.server_at).slice(0,4),'1900');
  const replay=await as(db,0,'opportunity_touch',request(2),{opportunity_id:deal1,user_key:'OTHER',touch_kind:'view',touched_at:'2100-01-01T00:00:00Z'});
  assert.equal(replay.replayed,true);assert.equal(replay.view_count,1);
  await assert.rejects(as(db,0,'opportunity_touch',request(2),{touch_kind:'work'}),e=>e.code==='PT409');
  const worked=await as(db,0,'opportunity_touch',request(3),{touch_kind:'work'});
  assert.ok(worked.last_worked_at);assert.equal(worked.view_count,1);
 });
 await t.test('actors are isolated and revoked scope fails',async()=>{
  await db.query("INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,can_write,reviewed_by,expires_at) VALUES($1,$2,$3,false,'T03 isolation test',now()+interval '1 day')",['f6090500-0010-4000-8000-000000000099',admin,deal1]);
  const other=await as(db,4,'favorite_set',request(4),{favorite:false});assert.equal(other.actor_user_id,admin);
  assert.equal((await db.query('SELECT count(*)::int n FROM crm_security.user_opportunity_state WHERE deal_id=$1',[deal1])).rows[0].n,2);
  const repRead=await read(db,0);assert.equal(repRead.length,1);assert.equal(repRead[0].favorite,true);
  const adminRead=await read(db,4);assert.equal(adminRead.length,1);assert.equal(adminRead[0].favorite,false);
  await assert.rejects(as(db,0,'favorite_set',request(5),{favorite:true},deal2),e=>e.code==='42501');
 });
}finally{await db.close();}});

test('rollback archives T03 evidence and leaves public Dispatcher exact',async()=>{const db=await bundle.setup();try{
 await db.exec(bundle.approval+bundle.compose());
 const dispatcher=(await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
 await db.exec(approval+candidate);await as(db,0,'favorite_set',request(20),{favorite:true});await as(db,0,'opportunity_touch',request(21),{touch_kind:'view'});
 await db.exec(approval+rollback);
 assert.deepEqual((await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0],dispatcher);
 assert.equal((await db.query("SELECT to_regprocedure('crm_security.crm_user_opportunity_state_command_v1(uuid,text,uuid,jsonb)') IS NULL gone")).rows[0].gone,true);
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_attachment_state_archive.user_opportunity_state')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_attachment_state_archive.user_opportunity_state_receipts')).rows[0].n,2);
}finally{await db.close();}});
