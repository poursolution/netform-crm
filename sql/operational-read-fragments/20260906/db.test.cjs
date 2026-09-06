'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bundle=require('../../operational-bundle/20260906/build.cjs'),s=require('../../../scripts/crm-phase1.cjs');
const approval="SET crm.operational_read_ref='rprechiaglyjaydkmxsu';\n";
const candidate=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8'),rollback=fs.readFileSync(path.join(__dirname,'rollback.sql'),'utf8');
const deal=n=>s.uid(6,n),inquiry=n=>s.uid(5,n),action=n=>s.uid(9,n),activity=n=>s.uid(8,n);
async function metadata(db,signature){return (await db.query("SELECT oid,md5(pg_get_functiondef(oid)) body,proconfig,proacl::text acl FROM pg_proc WHERE oid=$1::regprocedure",[signature])).rows[0];}
async function privateRead(db,account,domain,after=null,limit=100){
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);
 return (await db.query('SELECT crm_security.crm_operational_read_fragment_v1($1,$2,$3) value',[domain,after,limit])).rows[0].value;
}

test('private source fragment enforces row and nested-child scope',async t=>{
 const db=await bundle.setup();try{
  await db.exec(bundle.approval+bundle.compose());
  const readBefore=await metadata(db,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)');
  const writeBefore=await metadata(db,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)');
  await db.query("INSERT INTO public.stage_history(id,opportunity_id,from_stage,to_stage,changed_at) VALUES($1,$2,'lead','first_contact',now())",[s.uid(11,1),deal(1)]);
  await db.query("INSERT INTO public.stage_history(id,opportunity_id,from_stage,to_stage,changed_at) VALUES($1,$2,'lead','first_contact',now())",[s.uid(11,2),deal(2)]);
  await db.query("UPDATE public.next_actions SET status='completed',completed_at=now() WHERE id=$1",[action(1)]);
  await db.exec(approval+candidate);
  await t.test('public read/write identity, body, config and ACL are unchanged',async()=>{
   assert.deepEqual(await metadata(db,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'),readBefore);
   assert.deepEqual(await metadata(db,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'),writeBefore);
  });
  await t.test('rep Mine returns only UUID-owned Deal and its children',async()=>{
   const value=await privateRead(db,0,'deal_core');
   assert.equal(value.scope_completeness,'actor_authorized_rows_only');
   assert.deepEqual(value.items.map(x=>x.id),[deal(1)]);
   assert.equal(value.items[0].stage_history.length,1);
   assert.equal(value.items[0].completed_actions.length,1);
   assert.equal(value.items[0].activity_signals.length,1);
   assert.deepEqual(Object.keys(value.items[0].activity_signals[0]).sort(),['id','occurred_at','type']);
   assert.equal(JSON.stringify(value).includes(deal(2)),false);
  });
  await t.test('inquiry fragment uses can_inquiry and omits raw/address',async()=>{
   const value=await privateRead(db,2,'inquiry_core');
   assert.deepEqual(value.items.map(x=>x.id),[inquiry(3)]);
   assert.equal(Object.hasOwn(value.items[0],'raw'),false);
   assert.equal(Object.hasOwn(value.items[0],'address'),false);
   assert.equal(Object.hasOwn(value.items[0],'close_reason'),false);
   assert.equal(value.items[0].assignee_permission_role,'consultation');
  });
  await t.test('admin and branch are explicit-scope only, never company-wide',async()=>{
   assert.deepEqual((await privateRead(db,3,'deal_core')).items.map(x=>x.id),[deal(4)]);
   assert.deepEqual((await privateRead(db,4,'deal_core')).items.map(x=>x.id),[deal(5)]);
   assert.deepEqual((await privateRead(db,5,'deal_core')).items.map(x=>x.id),[deal(5)]);
   for(const account of [3,4,5])assert.equal((await privateRead(db,account,'deal_core')).items.length,1);
  });
  await t.test('cursor pagination is deterministic and restricted to scoped rows',async()=>{
   const page1=await privateRead(db,1,'deal_core',null,1);
   assert.deepEqual(page1.items.map(x=>x.id),[deal(2)]);assert.equal(page1.next_cursor,deal(2));
   const page2=await privateRead(db,1,'deal_core',page1.next_cursor,1);
   assert.deepEqual(page2.items.map(x=>x.id),[deal(3)]);assert.equal(page2.next_cursor,deal(3));
   const end=await privateRead(db,1,'deal_core',page2.next_cursor,1);
   assert.deepEqual(end.items,[]);assert.equal(end.next_cursor,null);
  });
  await t.test('authenticated clients cannot call private helper directly',async()=>{
   await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${s.mapping.accounts[0].auth_uid}';`);
   try{await assert.rejects(db.query("SELECT crm_security.crm_operational_read_fragment_v1('deal_core',NULL,10)"),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}
  });
  await t.test('unknown domains and invalid limits fail closed',async()=>{
   await assert.rejects(privateRead(db,0,'company_report'),e=>e.code==='22023');
   await assert.rejects(privateRead(db,0,'deal_core',null,101),e=>e.code==='22023');
  });
 }finally{await db.close();}
});

test('rollback drops only the private fragment and preserves public metadata/data',async()=>{
 const db=await bundle.setup();try{
  await db.exec(bundle.approval+bundle.compose());
  const before={read:await metadata(db,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'),write:await metadata(db,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'),deals:(await db.query('SELECT count(*)::int n FROM public.deals')).rows[0].n};
  await db.exec(approval+candidate);await db.exec(approval+rollback);
  assert.equal((await db.query("SELECT to_regprocedure('crm_security.crm_operational_read_fragment_v1(text,uuid,integer)') IS NULL gone")).rows[0].gone,true);
  assert.deepEqual(await metadata(db,'public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'),before.read);
  assert.deepEqual(await metadata(db,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'),before.write);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.deals')).rows[0].n,before.deals);
 }finally{await db.close();}
});
