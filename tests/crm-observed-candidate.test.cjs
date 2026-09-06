'use strict';
// Local SQL contract tests only. Not the eleven real JWT/Storage staging tests.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const labRequire=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'));
const {PGlite}=labRequire('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const containment=fs.readFileSync(path.join(root,'supabase/migrations/20260905111432_crm_observed_p0_staging_candidate.sql'),'utf8');
const scoped=fs.readFileSync(path.join(root,'supabase/migrations/20260905111739_crm_observed_uuid_scoped_candidate.sql'),'utf8');
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

test('local observed-schema candidate contracts (NOT staging integration)',async t=>{
 const db=new PGlite();
 try {
  await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/observed-identity-subset.sql'),'utf8'));
  await t.test('schema-only extraction SELECT parses locally without reading CRM rows',async()=>{
   const q=fs.readFileSync(path.join(root,'sql/20260905_observed_schema_extract.sql'),'utf8');
   const kit=(await db.query(q)).rows[0].schema_only_kit;
   assert.equal(kit.format,'crm-observed-schema-kit-v1');
   assert.ok(kit.ddl_fragments.some(x=>x.name==='users'));
  });
  await t.test('containment refuses execution without explicit review settings',async()=>{
   await assert.rejects(db.exec(containment),/REVIEW ONLY/); await db.exec('ROLLBACK');
  });
  await t.test('UUID candidate refuses execution without approval',async()=>{
   await assert.rejects(db.exec(scoped),/REVIEW ONLY/); await db.exec('ROLLBACK');
  });
  await db.exec("SET crm.reviewed_staging_ref='rprechiaglyjaydkmxsu'; SET crm.uuid_contract_approved='yes'; SET crm.isolated_synthetic_staging='yes';");
  await t.test('UUID candidate compiles on observed typed subset',async()=>{await db.exec(scoped);});
  await t.test('UUID candidate rerun on unchanged local model succeeds',async()=>{await db.exec(scoped);});
  await db.exec(`INSERT INTO public.organizations VALUES ('${uid(901)}','SYNTHETIC organization');
   INSERT INTO public.contacts VALUES ('${uid(902)}','${uid(901)}','SYNTHETIC contact','test',NULL,NULL);`);
  const roles=['rep','rep','consultation','branch','manager','admin'];
  for(let i=1;i<=6;i++){
   const source=i<3?'rep':i<5?'dual':'admin';
   await db.exec(`INSERT INTO public.users VALUES ('${uid(i)}','SYNTHETIC-${i}',NULL,'${source}',true,'${uid(100+i)}');
    INSERT INTO crm_security.access_review VALUES ('${uid(i)}','${uid(100+i)}','${source}','${roles[i-1]}',true,'${uid(106)}',now(),now()+interval '1 day');
    INSERT INTO public.deals(id,owner_id,organization_id,contact_id) VALUES ('${uid(200+i)}','${uid(i)}','${uid(901)}','${uid(902)}');
    INSERT INTO public.inquiries(id,assigned_to,site_name) VALUES ('${uid(300+i)}','${uid(i)}','SYNTHETIC inquiry');`);
  }
  for(const i of [4,5,6]) await db.exec(`INSERT INTO crm_security.object_scope(user_id,deal_id,can_write,reviewed_by,expires_at)
    VALUES('${uid(i)}','${uid(200+i)}',true,'${uid(106)}',now()+interval '1 day');`);
  const login=async(i,role='authenticated')=>{
   await db.exec('RESET ROLE');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[i?uid(100+i):'']);
   await db.exec(`SET ROLE ${role}`);
  };
  const read=async()=> (await db.query('SELECT public.crm_read_scoped_v2() AS data')).rows[0].data;
  const write=id=>db.query('SELECT public.crm_work_set_scoped_v2($1,$2,$3,$4,$5)',[uid(200+id),'synthetic-work',JSON.stringify(['synthetic-work']),'synthetic reason',1]);
  await t.test('anon cannot execute any new scoped RPC or direct CRM read',async()=>{
   await login(null,'anon');
   await assert.rejects(read(),/permission denied/);
   await assert.rejects(db.query('SELECT public.crm_contacts_scoped_v2($1)',[uid(201)]),/permission denied/);
   await assert.rejects(write(1),/permission denied/);
   await assert.rejects(db.query('SELECT * FROM public.deals'),/permission denied/);
  });
  await t.test('rep A reads only its own UUID-owned Deal/inquiry',async()=>{
   await login(1);const d=await read();
   assert.deepEqual(d.deals.map(x=>x.id),[uid(201)]);assert.deepEqual(d.inquiries.map(x=>x.id),[uid(301)]);
  });
  await t.test('rep cannot write or retrieve contacts of another rep',async()=>{
   await assert.rejects(write(2),/forbidden/);
   await assert.rejects(db.query('SELECT public.crm_contacts_scoped_v2($1)',[uid(202)]),/forbidden/);
  });
  await t.test('allowed own contact can be read',async()=>{
   const d=(await db.query('SELECT public.crm_contacts_scoped_v2($1) AS data',[uid(201)])).rows[0].data;
   assert.equal(d.length,1);assert.equal(d[0].id,uid(902));
  });
  await t.test('allowed write records Auth UUID and distinct existing CRM UUID',async()=>{
   await write(1);await db.exec('RESET ROLE');
   const a=(await db.query('SELECT * FROM public.audit_logs')).rows[0];
   assert.equal(a.actor_auth_uid,uid(101));assert.equal(a.actor_id,uid(1));assert.equal(a.actor_name,'SYNTHETIC-1');
   assert.equal(a.after.version,2);await login(1);
  });
  await t.test('stale write version does not append audit or overwrite data',async()=>{
   await assert.rejects(write(1),/version conflict/);await db.exec('RESET ROLE');
   assert.equal((await db.query('SELECT count(*)::int AS n FROM public.audit_logs')).rows[0].n,1);
  });
  await t.test('client actor fields have no accepted SQL signature',async()=>{
   await login(1);
   await assert.rejects(db.query("SELECT public.crm_work_set_scoped_v2(p_opportunity_id=>$1,p_primary_work=>'x',p_work_items=>'[\"x\"]',p_reason=>'reason',p_expected_version=>2,actor_name=>'spoof')",[uid(201)]),/does not exist/);
  });
  await t.test('consultation reads assigned inquiries, never sales Deal/write',async()=>{
   await login(3);const d=await read();assert.equal(d.deals.length,0);assert.deepEqual(d.inquiries.map(x=>x.id),[uid(303)]);
   await assert.rejects(write(3),/forbidden/);
  });
  await t.test('branch is limited by explicit object grant',async()=>{
   await login(4);assert.deepEqual((await read()).deals.map(x=>x.id),[uid(204)]);await assert.rejects(write(1),/forbidden/);
  });
  await t.test('manager and admin have only designated scope, not implicit global access',async()=>{
   for(const i of [5,6]){await login(i);assert.deepEqual((await read()).deals.map(x=>x.id),[uid(200+i)]);await assert.rejects(write(1),/forbidden/);}
  });
  await t.test('name change does not change authorization',async()=>{
   await db.exec(`RESET ROLE; UPDATE public.users SET name='SYNTHETIC renamed' WHERE user_id='${uid(1)}';`);
   await login(1);assert.deepEqual((await read()).deals.map(x=>x.id),[uid(201)]);
  });
  await t.test('duplicate Auth UUID fails closed, including an inactive duplicate',async()=>{
   await db.exec(`RESET ROLE; INSERT INTO public.users VALUES('${uid(99)}','SYNTHETIC duplicate',NULL,'rep',false,'${uid(101)}');`);
   await login(1);await assert.rejects(read(),/forbidden/);
   await db.exec(`RESET ROLE; DELETE FROM public.users WHERE user_id='${uid(99)}';`);
  });
  await t.test('inactive user and changed source role invalidate approval',async()=>{
   await db.exec(`UPDATE public.users SET active=false WHERE user_id='${uid(1)}';`);
   await login(1);await assert.rejects(read(),/forbidden/);
   await db.exec(`RESET ROLE; UPDATE public.users SET active=true,role='viewer' WHERE user_id='${uid(1)}';`);
   await login(1);await assert.rejects(read(),/forbidden/);
  });
  await t.test('client cannot edit the approval ledger or call private actor helper',async()=>{
   await login(2);
   await assert.rejects(db.query('SELECT * FROM crm_security.access_review'),/permission denied/);
   await assert.rejects(db.query('SELECT * FROM crm_security.actor()'),/permission denied/);
  });
  await t.test('unapproved review and Auth UID remapping fail closed',async()=>{
   await db.exec(`RESET ROLE; UPDATE crm_security.access_review SET approved=false WHERE user_id='${uid(2)}';`);
   await login(2);await assert.rejects(read(),/forbidden/);
   await db.exec(`RESET ROLE; UPDATE crm_security.access_review SET approved=true WHERE user_id='${uid(2)}';
    UPDATE public.users SET auth_uid='${uid(777)}' WHERE user_id='${uid(2)}';`);
   await login(2);await assert.rejects(read(),/forbidden/);
   await db.exec(`RESET ROLE; UPDATE public.users SET auth_uid='${uid(102)}' WHERE user_id='${uid(2)}';`);
  });
  await t.test('expired branch scope returns no Deal and refuses write',async()=>{
   await db.exec(`UPDATE crm_security.object_scope SET expires_at=now()-interval '1 second' WHERE user_id='${uid(4)}';`);
   await login(4);assert.equal((await read()).deals.length,0);await assert.rejects(write(4),/forbidden/);
  });
  await t.test('read-only admin scope cannot authorize write',async()=>{
   await db.exec(`RESET ROLE; UPDATE crm_security.object_scope SET can_write=false WHERE user_id='${uid(6)}';`);
   await login(6);assert.equal((await read()).deals.length,1);await assert.rejects(write(6),/forbidden/);
  });
  await t.test('legacy service-only function retains server EXECUTE',async()=>{
   await login(null,'service_role');await db.query('SELECT public.crm_bundle()');
  });
 }finally{await db.close();}
});
