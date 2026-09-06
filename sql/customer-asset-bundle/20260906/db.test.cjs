'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bundle=require('../../operational-bundle/20260906/build.cjs'),s=require('../../../scripts/crm-phase1.cjs');
const approval="SET crm.customer_asset_ref='rprechiaglyjaydkmxsu';\n";
const candidate=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8'),rollback=fs.readFileSync(path.join(__dirname,'rollback.sql'),'utf8');
const deal=n=>s.uid(6,n),contact=n=>s.uid(4,n),org=n=>s.uid(3,n),assignment=n=>s.uid(7,n);
async function read(db,account,id){await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);try{return (await db.query('SELECT public.crm_contacts_scoped_v2($1) a',[id])).rows[0].a;}finally{await db.exec('RESET ROLE');}}

test('Deal-scoped contact timeline stays inside child permissions',async t=>{
 const db=await bundle.setup(); try{
  await db.exec(bundle.approval+bundle.compose());
  const dispatcher=(await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
  const readOid=(await db.query("SELECT oid FROM pg_proc WHERE oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure")).rows[0].oid;
  const beforeCounts=(await db.query("SELECT (SELECT count(*)::int FROM public.deals) deals,(SELECT count(*)::int FROM public.contacts) contacts,(SELECT count(*)::int FROM public.contact_assignments) assignments")).rows[0];
  await db.query("INSERT INTO public.contacts(id,organization_id,name,phone,mobile,role,person_key,current_site) VALUES($1,$2,'TEST 연락처 A2','010-0000-0091','010-0000-0091','시설과장','TEST-PERSON-A2','TEST 아파트 A')",[contact(91),org(1)]);
  await db.query("INSERT INTO public.contact_assignments(id,person_key,opportunity_id,site_name,office_phone,started_at,status) VALUES($1,'TEST-PERSON-A2',$2,'TEST 아파트 A','02-000-0091','2026-09-01','current')",[assignment(91),deal(1)]);
  await db.query("INSERT INTO public.contacts(id,organization_id,name,phone,mobile,role,person_key,current_site) VALUES($1,$2,'HIDDEN SAME ORG','010-0000-0092','010-0000-0092','담당자','TEST-HIDDEN-A3','TEST 아파트 A')",[contact(92),org(1)]);
  await db.query("INSERT INTO public.contact_assignments(id,person_key,opportunity_id,site_name,office_phone,started_at,status) VALUES($1,'TEST-HIDDEN-A3',$2,'TEST 아파트 A','02-000-0092','2026-09-01','current')",[assignment(92),deal(3)]);
  await db.query("INSERT INTO public.contact_assignments(id,person_key,opportunity_id,site_name,office_phone,started_at,ended_at,status) VALUES($1,'crm-synthetic-20260905-person-A',$2,'HIDDEN HISTORY','02-000-0093','2025-01-01','2025-02-01','ended')",[assignment(93),deal(3)]);
  const fixtureCounts=(await db.query("SELECT (SELECT count(*)::int FROM public.deals) deals,(SELECT count(*)::int FROM public.contacts) contacts,(SELECT count(*)::int FROM public.contact_assignments) assignments")).rows[0];
  assert.equal(fixtureCounts.deals,beforeCounts.deals); assert.equal(fixtureCounts.contacts,beforeCounts.contacts+2); assert.equal(fixtureCounts.assignments,beforeCounts.assignments+3);
  await db.exec(approval+candidate);
  await t.test('public write Dispatcher and read function identity stay stable',async()=>{
   assert.deepEqual((await db.query("SELECT oid,prosrc,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0],dispatcher);
   assert.equal((await db.query("SELECT oid FROM pg_proc WHERE oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure")).rows[0].oid,readOid);
   assert.deepEqual((await db.query("SELECT (SELECT count(*)::int FROM public.deals) deals,(SELECT count(*)::int FROM public.contacts) contacts,(SELECT count(*)::int FROM public.contact_assignments) assignments")).rows[0],fixtureCounts);
  });
  await t.test('owner sees all directly-linked contacts but no same-org foreign contact',async()=>{
   const rows=await read(db,0,deal(1));
   assert.deepEqual(rows.map(x=>x.id),[contact(1),contact(91)]);
   assert.equal(rows.some(x=>x.name==='HIDDEN SAME ORG'),false);
   assert.equal(rows[0].is_primary,true); assert.equal(rows[1].is_primary,false);
   assert.equal(rows[0].assignment_history.some(x=>x.site_name==='HIDDEN HISTORY'),false);
   assert.deepEqual(Object.keys(rows[0]).sort(),['assignment_history','ended_at','id','is_primary','mobile','name','office_phone','person_key','phone','role','site_id','site_name','started_at','status','current_site'].sort());
  });
  await t.test('foreign/shared-site Deal and unauthenticated reads remain denied',async()=>{
   for(const n of [2,3])await assert.rejects(read(db,0,deal(n)),e=>e.code==='42501');
   await db.exec("SET ROLE authenticated; RESET request.jwt.claim.sub;");
   try{await assert.rejects(db.query('SELECT public.crm_contacts_scoped_v2($1)',[deal(1)]),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}
  });
  await t.test('an assignment appears only after can_deal scope is granted',async()=>{
   await db.query("INSERT INTO crm_security.object_scope(scope_id,user_id,deal_id,can_write,reviewed_by,expires_at) VALUES($1,$2,$3,false,'TEST customer asset scope',now()+interval '1 day'),($4,$2,$5,false,'TEST customer asset scope',now()+interval '1 day')",[s.uid(10,91),s.uid(1,5),deal(1),s.uid(10,92),deal(3)]);
   const rows=await read(db,4,deal(1)),primary=rows.find(x=>x.id===contact(1));
   assert.equal(primary.assignment_history.some(x=>x.site_name==='HIDDEN HISTORY'),true);
  });
 } finally {await db.close();}
});

test('rollback restores exact prior projection without data changes',async()=>{
 const db=await bundle.setup(); try{
  await db.exec(bundle.approval+bundle.compose());
  const before=(await db.query("SELECT oid,md5(pg_get_functiondef(oid)) body,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure")).rows[0];
  await db.exec(approval+candidate); await db.exec(approval+rollback);
  const after=(await db.query("SELECT oid,md5(pg_get_functiondef(oid)) body,proconfig,proacl::text acl FROM pg_proc WHERE oid='public.crm_contacts_scoped_v2(uuid)'::regprocedure")).rows[0];
  assert.deepEqual(after,before);
  assert.deepEqual((await read(db,0,deal(1))).map(x=>x.id),[contact(1)]);
 } finally {await db.close();}
});

test('baseline and candidate metadata drift fail closed',async()=>{
 const db=await bundle.setup(); try{
  await db.exec(bundle.approval+bundle.compose());
  await db.exec("REVOKE EXECUTE ON FUNCTION public.crm_contacts_scoped_v2(uuid) FROM authenticated");
  await assert.rejects(db.exec(approval+candidate),/customer asset read baseline drift/);
  await db.exec('ROLLBACK');
  await db.exec("GRANT EXECUTE ON FUNCTION public.crm_contacts_scoped_v2(uuid) TO authenticated");
  await db.exec(approval+candidate);
  await db.exec("ALTER FUNCTION public.crm_contacts_scoped_v2(uuid) VOLATILE");
  await assert.rejects(db.exec(approval+rollback),/customer asset read rollback drift/);
  await db.exec('ROLLBACK');
 } finally {await db.close();}
});
