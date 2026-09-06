'use strict';
// OFFLINE structure rehearsal only. No Supabase client, network, credentials or CRM RPC calls.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {build}=require('../scripts/build-crm-baseline.cjs');
const labRequire=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'));
const {PGlite}=labRequire('@electric-sql/pglite');
const dir=path.resolve(__dirname,'../sql/baseline/20260905');
const exported=JSON.parse(fs.readFileSync(path.join(dir,'source-metadata.json'),'utf8'));
const built=build(exported);
const capture=fs.readFileSync(path.join(dir,'capture-metadata.sql'),'utf8');
const platformModel=`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE ROLE supabase_admin SUPERUSER; CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT NULL::jsonb';
    ALTER SCHEMA public OWNER TO pg_database_owner;`;
const offlineOnly=sql=>sql.replace(/-- BEGIN_APPROVAL_GUARD[\s\S]*?-- END_APPROVAL_GUARD/,'-- Offline harness removes connection attestations only in memory.')
 .replace(/-- BEGIN_ENVIRONMENT_GUARD[\s\S]*?-- END_ENVIRONMENT_GUARD/,'-- Offline platform prerequisites intentionally not claimed.');
const normalize=value=>{
 if(Array.isArray(value))return value.map(normalize).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v)]));
 return value;
};
test('baseline is reproducible and refuses unreviewed metadata',()=>{
 assert.equal(fs.readFileSync(path.join(dir,'public-baseline.sql'),'utf8'),built.sql);
 const changed=structuredClone(exported);changed.payload.columns[0].identity='a';
 assert.throws(()=>build(changed),/Unreviewed/);
 assert.equal(exported.payload.sequences[0].max,'9223372036854775807');
});
test('full public schema offline restoration (NOT hosted Supabase certification)',async t=>{
 const db=new PGlite();
 try{
  await t.test('unapproved SQL aborts before object creation',async()=>{
   await assert.rejects(db.exec(built.sql),/independent staging approval required/);
   await db.exec('ROLLBACK');
   assert.equal((await db.query("SELECT count(*)::int n FROM pg_class WHERE relnamespace='public'::regnamespace")).rows[0].n,0);
  });
  // LOCAL ONLY platform model. Production managed roles/ICU/extensions are not reproduced here.
  await db.exec(platformModel);
  t.diagnostic('Offline PostgreSQL version: '+(await db.query("SELECT current_setting('server_version') v")).rows[0].v);
  const offlineSql=offlineOnly(built.sql);
  await t.test('complete dependency-ordered SQL restores',async()=>{await db.exec(offlineSql);});
  const actual=(await db.query(capture)).rows[0].payload;
  const sections=['schema','relations','columns','constraints','indexes','sequences','functions','views','triggers','policies','default_privileges','custom_types','custom_collations','dependencies'];
  for(const section of sections)await t.test(`source metadata agrees: ${section}`,()=>{
   assert.deepEqual(normalize(actual[section]),normalize(exported.payload[section]));
  });
  await t.test('all 18 local customer tables remain empty',async()=>{
   for(const r of exported.payload.relations.filter(r=>r.kind==='r'))assert.equal((await db.query(`SELECT count(*)::int n FROM public."${r.name}"`)).rows[0].n,0);
  });
  await t.test('re-running fails rather than overwriting an existing baseline',async()=>{
   await assert.rejects(db.exec(offlineSql),/already exists/);await db.exec('ROLLBACK');
   assert.deepEqual(normalize((await db.query(capture)).rows[0].payload.relations),normalize(actual.relations));
  });
 }finally{await db.close();}
});
test('injected postcheck failure rolls back local DDL and ACLs, not a Legacy rollback rehearsal',async()=>{
 const db=new PGlite();
 try{
  await db.exec(platformModel);
  const before=(await db.query(capture)).rows[0].payload;
  // Test fault injection only, never writes the modified SQL artifact.
  const broken=offlineOnly(built.sql).replace('END $postcheck$;',"RAISE EXCEPTION 'injected verification failure'; END $postcheck$;");
  await assert.rejects(db.exec(broken),/injected verification failure/);await db.exec('ROLLBACK');
  const after=(await db.query(capture)).rows[0].payload;
  for(const key of ['schema','relations','functions','policies','default_privileges'])assert.deepEqual(normalize(after[key]),normalize(before[key]));
 }finally{await db.close();}
});
