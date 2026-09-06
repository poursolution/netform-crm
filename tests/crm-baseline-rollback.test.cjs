'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {createRequire}=require('node:module');
const {PGlite}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('@electric-sql/pglite');
const {build}=require('../scripts/build-crm-baseline.cjs');
const {buildRollback}=require('../scripts/build-crm-baseline-rollback.cjs');
const {dir,query,normalize,diff,sha,canonicalComparison,canonicalDefinition,canonicalDefinitionSql,md5}=require('../scripts/crm-baseline-metadata.cjs');
const source=JSON.parse(fs.readFileSync(path.join(dir,'source-metadata.json'),'utf8'));
const beforeExport=JSON.parse(fs.readFileSync(path.join(dir,'staging-before.json'),'utf8'));
const baseline=build(source).sql;
const stagingAfter=JSON.parse(fs.readFileSync(path.join(dir,'staging-after-apply-observed.json'),'utf8'));
// Local SQL fixture uses the EXACT captured after definitions, never alters hosted functions.
const stagingFixtureSql=build(stagingAfter).sql;
const reverse=buildRollback(beforeExport,source).sql;
const offline=sql=>sql.replace(/-- BEGIN_APPROVAL_GUARD[\s\S]*?-- END_APPROVAL_GUARD/,'')
 .replace(/-- BEGIN_ENVIRONMENT_GUARD[\s\S]*?-- END_ENVIRONMENT_GUARD/,'');
const approve="SET crm.baseline_staging_ref='rprechiaglyjaydkmxsu'; SET crm.baseline_rollback_approved='yes';";
const capture=async db=>(await db.query(query())).rows[0].payload;
const setup=async db=>{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE ROLE supabase_admin SUPERUSER; CREATE SCHEMA auth;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT NULL::jsonb';
 CREATE SCHEMA storage; CREATE SCHEMA realtime; CREATE SCHEMA graphql;
 CREATE TABLE storage.baseline_test_sentinel(id int);
 CREATE TABLE realtime.baseline_test_sentinel(id int);
 CREATE TABLE graphql.baseline_test_sentinel(id int);
 CREATE FUNCTION auth.baseline_test_event() RETURNS event_trigger LANGUAGE plpgsql AS 'BEGIN RETURN; END';
 CREATE EVENT TRIGGER baseline_test_event ON ddl_command_end EXECUTE FUNCTION auth.baseline_test_event();
 ALTER SCHEMA public OWNER TO pg_database_owner;`);
 // Reproduce actual empty Staging ACL/defaults, not its managed platform implementation.
 await db.exec(offline(baseline.slice(0,baseline.indexOf('-- 03: sequence')))+'COMMIT;');
};
const managed=async db=>(await db.query(`SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','storage','realtime','graphql')),
 'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth'),
 'events',(SELECT jsonb_agg(jsonb_build_object('name',evtname,'event',evtevent,'enabled',evtenabled,'function',evtfoid::regprocedure::text) ORDER BY evtname) FROM pg_event_trigger),
 'extensions',(SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion,'owner',pg_get_userbyid(extowner)) ORDER BY extname) FROM pg_extension)
 ) AS result`)).rows[0].result;
test('rollback rejects wrong project and nonempty-before metadata',()=>{
 assert.throws(()=>buildRollback({...beforeExport,project_ref:'ymfbmpnizxvqsamnczow'},source),/Wrong project/);
 assert.throws(()=>buildRollback({...beforeExport,snapshot:{...beforeExport.snapshot,function_count:1}},source),/empty public/);
 assert.equal(fs.readFileSync(path.join(dir,'baseline-only-rollback.sql'),'utf8'),reverse);
 assert.doesNotMatch(reverse,/DROP\s+(OWNED|SCHEMA|EXTENSION|EVENT\s+TRIGGER)|\sCASCADE\s*;/i);
});
test('baseline COMMIT → close DB → reopen persisted DB → rollback COMMIT → before diff zero',async t=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'crm-baseline-reconnect-'));
 let db=new PGlite(dataDir);let before,managedBefore;
 try{
  await setup(db);before=await capture(db);managedBefore=await managed(db);
  assert.equal(before.relations,null);
  assert.deepEqual(normalize(before.schema),normalize(beforeExport.snapshot.schema));
  assert.deepEqual(normalize(before.default_privileges),normalize(beforeExport.snapshot.default_privileges));
  await db.exec(offline(baseline));assert.deepEqual(diff(source.payload,await capture(db)),[]);
  await db.close();db=new PGlite(dataDir);
  assert.equal((await db.query("SELECT current_setting('crm.baseline_rollback_approved',true) v")).rows[0].v,null);
  assert.equal((await capture(db)).relations.filter(r=>r.kind==='r').length,18);
  await t.test('fresh connection has no approval and refuses rollback',async()=>{
   await assert.rejects(db.exec(reverse),/approval\/target required/);await db.exec('ROLLBACK');
  });
  await db.exec(approve);await db.exec(reverse);
  const after=await capture(db);assert.deepEqual(normalize(after),normalize(before));
  assert.deepEqual(normalize(await managed(db)),normalize(managedBefore));
  await db.close();db=new PGlite(dataDir);
  assert.deepEqual(normalize(await capture(db)),normalize(before));
  const result={localOnly:true,engine:'PGlite 0.3.14 / PG17.5',actualSupabaseTest:false,
   closeReopenPersistentDatabase:true,baselineCommitted:true,rollbackCommitted:true,
   metadataDiff:[],managedMetadataDiff:[],beforeTables:0,afterBaselineTables:18,afterRollbackTables:0,
   baseline_sha256:sha(baseline),rollback_sha256:sha(reverse)};
  fs.writeFileSync(path.join(dir,'rollback-local-result.json'),JSON.stringify(result,null,2)+'\n');
 }finally{await db.close();}
});
test('schema drift stops rollback without dropping baseline or managed objects',async()=>{
 const db=new PGlite();try{
  await setup(db);await db.exec(offline(baseline));await db.exec('ALTER TABLE public.users ADD COLUMN local_guard_test boolean');
  const before=await capture(db);await db.exec(approve);
  await assert.rejects(db.exec(reverse),/Baseline drift/);await db.exec('ROLLBACK');
  assert.deepEqual(normalize(await capture(db)),normalize(before));
 }finally{await db.close();}
});
test('changed public schema ACL and postgres defaults restore to before values',async()=>{
 const db=new PGlite();try{
  await setup(db);
  await db.exec('SET ROLE pg_database_owner; REVOKE USAGE ON SCHEMA public FROM anon; RESET ROLE; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;');
  const before=await capture(db);
  const fixture={...beforeExport,snapshot:{...beforeExport.snapshot,schema:before.schema,default_privileges:before.default_privileges}};
  const alteredReverse=buildRollback(fixture,source).sql;
  await db.exec(offline(baseline));await db.exec(approve);await db.exec(alteredReverse);
  assert.deepEqual(normalize(await capture(db)),normalize(before));
 }finally{await db.close();}
});
test('prepared single-transaction apply wrapper passes captured-before guards locally',async()=>{
 const db=new PGlite();try{
  await setup(db);
  const apply=fs.readFileSync(path.join(dir,'staging-apply.sql'),'utf8');
  // Only hosted environment prerequisites excluded; original approval and before-ACL guards run.
  await db.exec(apply.replace(/-- BEGIN_ENVIRONMENT_GUARD[\s\S]*?-- END_ENVIRONMENT_GUARD/,''));
  assert.deepEqual(diff(source.payload,await capture(db)),[]);
 }finally{await db.close();}
});
test('stored Staging canonical baseline: 17 equal, 13 newline-only, 4 raw-identical',()=>{
 const result=canonicalComparison(source.payload,stagingAfter.payload);
 assert.equal(result.status,'Canonical baseline reproduction PASS');
 assert.deepEqual(result.canonicalDiff,[]);
 assert.equal(result.functions.filter(f=>f.definition_diff==='newline_only_diff').length,13);
 assert.equal(result.functions.filter(f=>f.definition_diff==='identical').length,4);
 assert.equal(result.functions.length,17);
 assert.equal(result.byteIdenticalReproduction,'NOT CLAIMED');
 fs.writeFileSync(path.join(dir,'canonical-baseline-comparison.json'),JSON.stringify({source_metadata_md5:source.metadata_md5,actual_metadata_md5:stagingAfter.metadata_md5,...result},null,2)+'\n');
});
test('canonicalization changes only CRLF and standalone CR; PostgreSQL agrees',async()=>{
 const db=new PGlite();try{
  const text=' A\tB\r\nC\rD\nE  \u2028Z';
  assert.equal(canonicalDefinition(text),' A\tB\nC\nD\nE  \u2028Z');
  const row=(await db.query(`SELECT md5($1::text) raw_md5, md5(${canonicalDefinitionSql('$1::text')}) canonical_md5`,[text])).rows[0];
  assert.equal(row.raw_md5,md5(text));assert.equal(row.canonical_md5,md5(canonicalDefinition(text)));
 }finally{await db.close();}
});
test('canonical comparator rejects character, space, ACL, config, signature, security, owner and policy drift',async t=>{
 const cases={
  character:f=>{f.definition=f.definition.replace('now()','NOW()');},
  space:f=>{f.definition=f.definition.replace('begin new','begin  new');},
  acl:f=>{f.acl=f.acl.filter(a=>!a.startsWith('anon='));},
  config:f=>{f.config=['search_path=public, pg_temp'];},
  signature:f=>{f.signature='set_updated_at(text)';},
  security:f=>{f.security_definer=!f.security_definer;},
  owner:f=>{f.owner='anon';}
 };
 for(const [name,mutate] of Object.entries(cases))await t.test(name,()=>{
  const changed=structuredClone(stagingAfter.payload);mutate(changed.functions.find(f=>f.signature==='set_updated_at()'));
  assert.equal(canonicalComparison(source.payload,changed).status,'FAIL');
 });
 await t.test('config order stays strict',()=>{
  const a=structuredClone(stagingAfter.payload),b=structuredClone(a);
  a.functions[0].config=['search_path=public','statement_timeout=1s'];b.functions[0].config=[...a.functions[0].config].reverse();
  assert.equal(canonicalComparison(a,b).status,'FAIL');
 });
 await t.test('policy unchanged requirement',()=>{
  const b=structuredClone(stagingAfter.payload);b.policies[0].qual='false';
  assert.equal(canonicalComparison(source.payload,b).status,'FAIL');
 });
});
test('captured Staging-after fixture → COMMIT/reconnect → canonical rollback → exact before diff zero',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'crm-canonical-reconnect-'));
 let db=new PGlite(dataDir);
 try{
  await setup(db);const before=await capture(db),managedBefore=await managed(db);
  await db.exec(offline(stagingFixtureSql));assert.deepEqual(diff(stagingAfter.payload,await capture(db)),[]);
  await db.close();db=new PGlite(dataDir);
  await db.exec(approve);await db.exec(reverse);
  assert.deepEqual(normalize(await capture(db)),normalize(before));
  assert.deepEqual(normalize(await managed(db)),normalize(managedBefore));
  await db.close();db=new PGlite(dataDir);assert.deepEqual(normalize(await capture(db)),normalize(before));
  fs.writeFileSync(path.join(dir,'canonical-rollback-local-result.json'),JSON.stringify({localOnly:true,actualRemoteDDL:false,
   fixture:'staging-after-apply-observed.json',persistedReconnect:true,preflightPassed:true,beforeDiff:[],managedDiff:[],
   rollback_sha256:sha(reverse),engine:'PGlite 0.3.14 / PostgreSQL 17.5'},null,2)+'\n');
 }finally{await db.close();}
});
for(const kind of ['character','space','acl','config','security','owner'])test(`SQL rollback guard rejects actual ${kind} drift`,async()=>{
 const db=new PGlite();try{
  await setup(db);await db.exec(offline(stagingFixtureSql));
  const original=stagingAfter.payload.functions.find(f=>f.signature==='set_updated_at()').definition;
  if(kind==='character')await db.exec(original.replace('now()','NOW()'));
  if(kind==='space')await db.exec(original.replace('begin new','begin  new'));
  if(kind==='acl')await db.exec('REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon');
  if(kind==='config')await db.exec('ALTER FUNCTION public.set_updated_at() SET search_path TO public,pg_temp');
  if(kind==='security')await db.exec('ALTER FUNCTION public.set_updated_at() SECURITY DEFINER');
  if(kind==='owner')await db.exec('ALTER FUNCTION public.set_updated_at() OWNER TO anon');
  const changed=await capture(db);await db.exec(approve);
  await assert.rejects(db.exec(reverse),/Baseline drift/);await db.exec('ROLLBACK');
  assert.deepEqual(normalize(await capture(db)),normalize(changed));
 }finally{await db.close();}
});
