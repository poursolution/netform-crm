'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const {PGlite}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('@electric-sql/pglite');
const {build:baseline}=require('../scripts/build-crm-baseline.cjs');
const {query,normalize}=require('../scripts/crm-baseline-metadata.cjs');
const {build,REF,accounts,uid}=require('../scripts/build-observed-synthetic-seed.cjs');
const map={project_ref:REF,accounts:accounts.map((a,i)=>({...a,auth_uid:uid(99,i+1)}))};
const fixture=build(map);
const approve=`SET crm.synthetic_staging_ref='${REF}'; SET crm.synthetic_seed_approved='yes';`;
async function setup(){const db=new PGlite();await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE supabase_admin SUPERUSER; CREATE SCHEMA auth; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT NULL::jsonb'; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz); ALTER SCHEMA public OWNER TO pg_database_owner;`);
 const sql=baseline(require('../sql/baseline/20260905/source-metadata.json')).sql.replace(/-- BEGIN_APPROVAL_GUARD[\s\S]*?-- END_APPROVAL_GUARD/,'').replace(/-- BEGIN_ENVIRONMENT_GUARD[\s\S]*?-- END_ENVIRONMENT_GUARD/,'');await db.exec(sql);
 for(const a of map.accounts)await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[a.auth_uid,a.email]);return db;}
test('observed fixture uses six unique identities, supported roles and only fake contacts',()=>{
 assert.equal(fixture.mapped.length,6);assert.equal(new Set(fixture.mapped.map(x=>x.name)).size,6);
 assert.deepEqual(fixture.mapped.map(a=>a.source_role),['rep','rep','viewer','rep','admin','admin']);
 assert.equal(fixture.rows.deals.filter(x=>x.site_id===uid(2,1)).length,2);
 assert.equal(new Set(fixture.rows.deals.filter(x=>x.site_id===uid(2,1)).map(x=>x.owner_id)).size,2);
 const strings=JSON.stringify(fixture.rows);
 for(const email of strings.match(/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+/g)||[])assert.ok(email.endsWith('@example.invalid'));
 for(const phone of strings.match(/010-\d{4}-\d{4}/g)||[])assert.match(phone,/^010-0000-000[1-5]$/);
 assert.doesNotMatch(fixture.apply,/^(CREATE|ALTER|GRANT|REVOKE)\s|INSERT INTO auth\./im);
 assert.doesNotMatch(fixture.rollback,/^(TRUNCATE|DROP)\s|DELETE FROM auth\./im);
});
test('wrong project, duplicate UUID and missing identity fail locally',()=>{
 assert.throws(()=>build({...map,project_ref:'ymfbmpnizxvqsamnczow'}));
 assert.throws(()=>build({...map,accounts:map.accounts.slice(1)}));
 const bad=structuredClone(map);bad.accounts[1].auth_uid=bad.accounts[0].auth_uid;assert.throws(()=>build(bad));
});
test('apply and post-commit CRM rollback preserve canonical baseline exactly',async()=>{const db=await setup();try{
 const before=(await db.query(query())).rows[0].payload;
 await assert.rejects(db.exec(fixture.apply),/approval\/target/);await db.exec('ROLLBACK');
 await db.exec(approve);await db.exec(fixture.apply);
 assert.deepEqual(normalize((await db.query(query())).rows[0].payload),normalize(before));
 const ids=(await db.query('SELECT count(*) n FROM public.users u JOIN auth.users a ON a.id=u.auth_uid')).rows[0];assert.equal(Number(ids.n),6);
 await db.exec(fixture.rollback);
 assert.deepEqual(normalize((await db.query(query())).rows[0].payload),normalize(before));
 assert.equal(Number((await db.query('SELECT count(*) n FROM public.users')).rows[0].n),0);
 assert.equal(Number((await db.query('SELECT count(*) n FROM auth.users')).rows[0].n),6);
 }finally{await db.close();}});
for(const drift of ['preexisting','reapply','schema','auth','modified-row'])test(`seed guard rejects ${drift}`,async()=>{const db=await setup();try{
 await db.exec(approve);
 if(drift==='preexisting')await db.exec("INSERT INTO public.sites(site_name,norm_name) VALUES('TEST preexisting','test-existing')");
 if(drift==='schema')await db.exec('ALTER TABLE public.users ADD COLUMN local_test boolean');
 if(drift==='auth')await db.exec("UPDATE auth.users SET email='wrong@example.invalid'");
 if(drift==='reapply'||drift==='modified-row')await db.exec(fixture.apply);
 if(drift==='modified-row')await db.exec("UPDATE public.deals SET amount=999");
 await assert.rejects(db.exec(drift==='modified-row'?fixture.rollback:fixture.apply));await db.exec('ROLLBACK');
 if(drift==='modified-row')assert.equal(Number((await db.query('SELECT count(*) n FROM public.deals')).rows[0].n),5);
 }finally{await db.close();}});
