'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const s=require('../../../scripts/crm-phase1.cjs');
const bundle=require('./build.cjs');
const dir=__dirname,candidate=fs.readFileSync(path.join(dir,'candidate.sql'),'utf8');
const deal1=s.uid(6,1),deal2=s.uid(6,2),rep=s.uid(1,1),admin=s.uid(1,5);
const request=n=>`f6090600-0031-4000-8000-${String(n).padStart(12,'0')}`;
async function as(db,account,op,id,payload,object=deal1){await db.exec(`SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);return (await db.query("SELECT public.crm_write_command_v2($1,$2,$3,0,$4) a",[id,op,object,JSON.stringify(payload)])).rows[0].a;}
async function read(db,account,object=deal1){await db.exec(`SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);return (await db.query("SELECT public.crm_read_scoped_v2(NULL,100,$1,NULL) a",[object])).rows[0].a.deals[0];}
async function fn(db,sig){return (await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid=$1::regprocedure",[sig])).rows[0];}

test('personal state composes over the exact operational Dispatcher',async t=>{const db=await bundle.setup();try{
 const old=await fn(db,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)');
 const frozen=await fn(db,'crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)');
 const readOid=(await fn(db,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)')).oid;
 await db.exec(bundle.approval+candidate);
 await t.test('four-op body/OID/config is preserved as a closed private delegate',async()=>{
  const moved=await fn(db,'crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)');
  assert.equal(moved.oid,old.oid);assert.equal(moved.prosrc,old.prosrc);assert.deepEqual(moved.proconfig,old.proconfig);
  assert.equal(await fn(db,'crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)').then(x=>x.oid),frozen.oid);
  assert.equal((await fn(db,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)')).oid,readOid);
  for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("SELECT has_function_privilege($1,'crm_security.crm_write_command_v2_operational_20260906(uuid,text,uuid,integer,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);
 });
 await t.test('forged user/time are ignored and common receipt replay is exact',async()=>{
  const fav=await as(db,0,'favorite_set',request(1),{opportunity_id:deal1,user_key:'FORGED',favorite:true});
  assert.equal(fav.actor_user_id,rep);assert.equal(fav.favorite,true);assert.equal(fav.touch_kind,null);
  const view=await as(db,0,'opportunity_touch',request(2),{opportunity_id:deal1,user_key:'FORGED',touch_kind:'view',touched_at:'1900-01-01T00:00:00Z'});
  assert.equal(view.view_count,1);assert.equal(view.touch_kind,'view');assert.notEqual(String(view.last_viewed_at).slice(0,4),'1900');
  const replay=await as(db,0,'opportunity_touch',request(2),{opportunity_id:deal1,user_key:'OTHER',touch_kind:'view',touched_at:'2100-01-01T00:00:00Z'});
  assert.equal(replay.replayed,true);assert.equal(replay.view_count,1);
  await assert.rejects(as(db,0,'opportunity_touch',request(2),{touch_kind:'work'}),e=>e.code==='PT409');
  assert.equal((await db.query("SELECT count(*)::int n FROM crm_security.command_receipts WHERE operation IN ('favorite_set','opportunity_touch')")).rows[0].n,2);
 });
 await t.test('view/work are separate, read-back is actor scoped, inaccessible Deal is denied',async()=>{
  const work=await as(db,0,'opportunity_touch',request(3),{touch_kind:'work'});assert.ok(work.last_worked_at);assert.equal(work.view_count,1);
  const repRead=await read(db,0);assert.equal(repRead.favorite,true);assert.equal(repRead.view_count,1);assert.ok(repRead.last_viewed_at);assert.ok(repRead.last_worked_at);
  await db.query("INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,can_write,reviewed_by,expires_at) VALUES($1,$2,$3,false,'personal state test',now()+interval '1 day')",['f6090600-0010-4000-8000-000000000099',admin,deal1]);
  const other=await as(db,4,'favorite_set',request(4),{favorite:false});assert.equal(other.actor_user_id,admin);
  const adminRead=await read(db,4);assert.equal(adminRead.favorite,false);assert.equal(adminRead.view_count,0);assert.equal(adminRead.last_viewed_at,null);
  assert.equal((await db.query('SELECT count(*)::int n FROM crm_security.user_opportunity_state WHERE deal_id=$1',[deal1])).rows[0].n,2);
  await assert.rejects(as(db,0,'favorite_set',request(5),{favorite:true},deal2),e=>e.code==='42501');
 });
 await t.test('private helper/table remain closed and receipt allow-list is six exact ops',async()=>{
  for(const role of ['anon','authenticated','service_role']){
   assert.equal((await db.query("SELECT has_function_privilege($1,'crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);
   assert.equal((await db.query("SELECT has_table_privilege($1,'crm_security.user_opportunity_state','SELECT,INSERT,UPDATE,DELETE') allowed",[role])).rows[0].allowed,false);
  }
  const check=(await db.query("SELECT pg_get_constraintdef(oid,true) d FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check'")).rows[0].d;
  for(const op of ['opportunity_work_set','inquiry_assign','service_change','inquiry_unassign','favorite_set','opportunity_touch'])assert.match(check,new RegExp(op));
 });
}finally{await db.close();}});

test('rollback restores operational function identity and archives evidence',async()=>{const db=await bundle.setup();try{
 const before=await bundle.capture(db),old=await fn(db,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'),oldRead=await fn(db,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'),digest=x=>crypto.createHash('md5').update(x).digest('hex');
 const oldReadDefinition=(await db.query("SELECT pg_get_functiondef('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure) d")).rows[0].d;
 const signatures=['public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','public.crm_read_scoped_v2(uuid,integer,uuid,uuid)','crm_security.crm_write_command_v2_frozen_20260906(uuid,text,uuid,integer,jsonb)','crm_security.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)'];
 const functions=[];for(const signature of signatures){const row=(await db.query("SELECT oid,pg_get_functiondef(oid) d FROM pg_proc WHERE oid=$1::regprocedure",[signature])).rows[0];functions.push({signature,oid:row.oid,definition_md5:digest(row.d)});}
 const localLive={functions};
 await db.exec(bundle.approval+candidate);await as(db,0,'favorite_set',request(20),{favorite:true});await as(db,0,'opportunity_touch',request(21),{touch_kind:'view'});
 const after=await bundle.capture(db);
 await db.exec(bundle.rollback(before,after,oldReadDefinition,localLive));
 const restored=await fn(db,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'),restoredRead=await fn(db,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)');
 assert.equal(restored.oid,old.oid);assert.equal(restored.prosrc,old.prosrc);assert.deepEqual(restored.proconfig,old.proconfig);assert.equal(restored.acl,old.acl);
 assert.equal(restoredRead.oid,oldRead.oid);assert.equal(restoredRead.prosrc,oldRead.prosrc);
 assert.equal((await db.query("SELECT to_regprocedure('crm_security.crm_user_opportunity_state_command_v2(uuid,text,uuid,integer,jsonb)') IS NULL gone")).rows[0].gone,true);
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_personal_state_archive.user_opportunity_state')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_personal_state_archive.command_receipts')).rows[0].n,2);
}finally{await db.close();}});
