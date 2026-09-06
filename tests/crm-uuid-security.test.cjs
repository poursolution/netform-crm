const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('../../crm-security-lab/node_modules/@electric-sql/pglite');
const seed=require('./fixtures/staging-crm-seed.json');
const sql=f=>fs.readFileSync(path.join(__dirname,'../sql',f),'utf8');
const identity=sql('20260905_crm_uuid_identity.sql'),backfill=sql('20260905_crm_uuid_backfill.sql'),reader=sql('20260905_crm_direct_read.sql');
async function setup(){
 const db=new PGlite();
 await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/uuid-contract-schema.sql'),'utf8'));
 for(const u of seed.users)await db.query('insert into auth.users values($1)',[u.localAuthId]);
 for(const d of seed.deals)await db.query('insert into public.deals values($1,$2,$3,$4,$5,$6)',[d.id,d.site,d.assignee,d.brand,d.stage,d.created]);
 for(const i of seed.inquiries)await db.query('insert into public.inquiries values($1,$2,$3,$4,$5,$6)',[i.id,i.site,i.assigned_to,i.status,i.created,i.amount]);
 await db.exec(identity);
 for(const t of seed.teams)await db.query('insert into public.crm_teams values($1,$2)',[t.team_id,t.display_name]);
 for(const u of seed.users){
  if(u.sales_person_id)await db.query('insert into public.crm_sales_people values($1,$2)',[u.sales_person_id,u.display_name]);
  await db.query('insert into public.crm_users values($1,$2,$3,$4,$5,true)',[u.localAuthId,u.display_name,u.role,u.team_id,u.sales_person_id]);
 }
 await db.exec('create temp table crm_uuid_reviewed_mapping(target_table text,target_id uuid,user_id uuid,evidence text)');
 for(const [table,rows] of [['deals',seed.deals],['inquiries',seed.inquiries]])for(const r of rows){
  if(r.owner_fixture_role)await db.query('insert into crm_uuid_reviewed_mapping values($1,$2,$3,$4)',[table,r.id,seed.users.find(u=>u.fixture_role===r.owner_fixture_role).localAuthId,'Synthetic fixture mapping by independently assigned UUID']);
 }
 await db.exec(backfill);await db.exec(reader);
 return db;
}
async function asUser(db,role,fn){
 const u=seed.users.find(x=>x.fixture_role===role);
 await db.exec('begin; set local role '+(u?'authenticated':'anon'));
 await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[u?.localAuthId||'',JSON.stringify({aal:role==='ADMIN_MFA'?'aal2':'aal1'})]);
 try{const v=await fn();await db.exec('commit');return v;}catch(e){await db.exec('rollback');throw e;}
}
const read=db=>db.query('select public.crm_read_bundle() data').then(r=>r.rows[0].data);
test('UUID seed generator is offline, rejects production and mismatched synthetic Auth accounts',async()=>{
 const {generate}=require('../scripts/build-staging-seed.cjs');
 const cfg={projectRef:'abcdefghijklmnopqrst',authUserIds:Object.fromEntries(seed.users.map(u=>[u.fixture_role,u.localAuthId]))};
 assert.throws(()=>generate({...cfg,projectRef:'ymfbmpnizxvqsamnczow'}),/Production/);
 const db=new PGlite();try{
  await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/uuid-contract-schema.sql'),'utf8'));
  await db.exec('alter table auth.users add column email text');
  for(const u of seed.users)await db.query('insert into auth.users values($1,$2)',[u.localAuthId,u.email]);
  await db.exec(identity);
  await assert.rejects(db.exec(generate(cfg)),/Confirm staging ref/);await db.exec('rollback');
  await db.query("select set_config('crm.seed_project_ref',$1,false)",[cfg.projectRef]);
  await db.exec(generate(cfg));await db.exec(backfill);await db.exec(reader);
  assert.equal((await asUser(db,'INTERNAL_REP',()=>read(db))).deals[0].id,seed.deals[0].id);
  assert.equal((await db.query("select count(*)::int n from crm_private.identity_review where status='manual_review'")).rows[0].n,2);
  await assert.rejects(db.exec(generate(cfg)),/Empty disposable staging CRM/);await db.exec('rollback');
 }finally{await db.close();}
});
test('UUID SQL: duplicate/renamed display names cannot grant another sales rep access',async()=>{
 const db=await setup();try{
  const a=await asUser(db,'INTERNAL_REP',()=>read(db));assert.deepEqual(a.deals.map(d=>d.id),[seed.deals[0].id]);assert.equal(a.globalSecret,undefined);
  await db.query("update public.crm_users set display_name='Renamed' where user_id=$1",[seed.users[0].localAuthId]);
  await db.query("update public.deals set assignee='Someone else'");
  assert.deepEqual((await asUser(db,'INTERNAL_REP',()=>read(db))).deals.map(d=>d.id),[seed.deals[0].id]);
  assert.deepEqual((await asUser(db,'OTHER_REP',()=>read(db))).deals.map(d=>d.id),[seed.deals[1].id]);
  const direct=await asUser(db,'INTERNAL_REP',()=>db.query('select id from public.deals'));assert.deepEqual(direct.rows.map(x=>x.id),[seed.deals[0].id]);
 }finally{await db.close();}
});
test('UUID SQL: consultation has no sales/finance, branch own scope, admin reviewed scope, anon zero',async()=>{
 const db=await setup();try{
  const consult=await asUser(db,'CONSULT',()=>read(db));assert.equal(consult.deals.length,0);
  assert.deepEqual(consult.inquiries.map(x=>x.id),[seed.inquiries[2].id]);assert.equal(consult.inquiries[0].amount,undefined);
  assert.equal((await asUser(db,'CONSULT',()=>db.query('select * from public.deals'))).rows.length,0);
  assert.deepEqual((await asUser(db,'GYEONGNAM',()=>read(db))).deals.map(x=>x.id),[seed.deals[2].id]);
  assert.equal((await asUser(db,'ADMIN',()=>read(db))).deals.length,3);
  await assert.rejects(asUser(db,'ANON',()=>read(db)),e=>e.code==='42501');
  await assert.rejects(asUser(db,'ANON',()=>db.query('select * from public.deals')),e=>e.code==='42501');
  await assert.rejects(asUser(db,'CONSULT',()=>db.query('select * from public.inquiries')),e=>e.code==='42501');
  await db.exec('grant select(amount) on public.inquiries to authenticated');
  assert.equal((await asUser(db,'CONSULT',()=>db.query('select amount from public.inquiries'))).rows.length,0);
  await db.query('update public.crm_users set active=false where user_id=$1',[seed.users[0].localAuthId]);
  await assert.rejects(asUser(db,'INTERNAL_REP',()=>read(db)),e=>e.code==='42501');
 }finally{await db.close();}
});
test('UUID SQL: direct owner edits/deletes and identity reassignment are refused',async()=>{
 const db=await setup();try{
  for(const role of ['INTERNAL_REP','CONSULT','GYEONGNAM'])await assert.rejects(asUser(db,role,()=>db.query('update public.deals set assignee_user_id=$1',[seed.users[0].localAuthId])),e=>e.code==='42501');
  await db.exec('grant update,delete on public.deals to authenticated');
  await assert.rejects(asUser(db,'INTERNAL_REP',()=>db.query("update public.deals set site='forged' where id=$1",[seed.deals[0].id])),e=>e.code==='42501');
  assert.equal((await asUser(db,'INTERNAL_REP',()=>db.query('delete from public.deals returning id'))).rows.length,0);
  await assert.rejects(db.query('update public.crm_users set sales_person_id=null where user_id=$1',[seed.users[0].localAuthId]),e=>e.code==='42501');
 }finally{await db.close();}
});
test('UUID SQL: manual review stays unassigned; backfill is explicit, transactional and repeatable',async()=>{
 const db=await setup();try{
  await db.exec(identity);await db.exec(backfill);await db.exec(reader);
  assert.equal((await db.query("select count(*)::int n from crm_private.identity_review where status='manual_review'")).rows[0].n,2);
  assert.equal((await db.query('select assignee_user_id from public.deals where id=$1',[seed.deals[3].id])).rows[0].assignee_user_id,null);
  await db.exec('truncate crm_uuid_reviewed_mapping');
  await db.query('insert into crm_uuid_reviewed_mapping values($1,$2,$3,$4)',['deals',seed.deals[3].id,seed.users[2].localAuthId,'Reviewed synthetic invalid consultation assignment']);
  await assert.rejects(db.exec(backfill),/Consultation cannot own/);await db.exec('rollback');
  assert.equal((await db.query('select assignee_user_id from public.deals where id=$1',[seed.deals[3].id])).rows[0].assignee_user_id,null);
 }finally{await db.close();}
});
test('UUID SQL: export uses only canonical UUID membership, not legacy users role/name',async()=>{
 const db=await setup();try{
  await db.exec(sql('20260905_crm_export.sql'));
  const p={from:'2026-09-01',to:'2026-09-05',brand:'TEST',reason:'Synthetic UUID export',columns:['site','brand','stage','created'],limit:1};
  const call=()=>db.query('select public.crm_export_create($1) data',[JSON.stringify(p)]);
  for(const r of ['INTERNAL_REP','ADMIN'])await assert.rejects(asUser(db,r,call),e=>e.code==='42501');
  const v=(await asUser(db,'ADMIN_MFA',call)).rows[0].data;
  assert.equal(v.actor_id,seed.users[5].localAuthId);assert.ok(v.audit_id);assert.equal(v.rows.length,1);
 }finally{await db.close();}
});
