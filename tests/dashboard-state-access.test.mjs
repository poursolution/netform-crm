import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration=read('../supabase/migrations/20260920030000_contain_dashboard_state_access.sql');
const rollback=read('../sql/dashboard-state-access-rollback.sql');
async function setup(){
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    CREATE TABLE public.dashboard_state(id text PRIMARY KEY, data jsonb NOT NULL);
    INSERT INTO public.dashboard_state VALUES ('synthetic','{"preserve":"original"}');
    ALTER TABLE public.dashboard_state ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON public.dashboard_state TO anon,authenticated,service_role;
    CREATE POLICY "allow all" ON public.dashboard_state FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
    CREATE TABLE public.unrelated(id int);
    GRANT SELECT ON public.unrelated TO authenticated;`);
  return db;
}
async function snapshot(db){return (await db.query(`SELECT
  (SELECT jsonb_agg(to_jsonb(d)) FROM public.dashboard_state d) data,
  (SELECT jsonb_build_object('oid',oid,'acl',relacl::text,'rls',relrowsecurity,'owner',relowner) FROM pg_class WHERE oid='public.dashboard_state'::regclass) relation,
  (SELECT jsonb_agg(jsonb_build_object('name',polname,'roles',polroles,'command',polcmd,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid))) FROM pg_policy WHERE polrelid='public.dashboard_state'::regclass) policies,
  (SELECT relacl::text FROM pg_class WHERE oid='public.unrelated'::regclass) unrelated_acl`)).rows[0];}
test('dashboard containment denies both client roles, preserves rows/service access, repeats and rolls back',async()=>{
 const db=await setup();
 try{
  const before=await snapshot(db);
  await db.exec('SET ROLE anon');
  assert.equal((await db.query('SELECT count(*)::int n FROM public.dashboard_state')).rows[0].n,1);
  await db.exec('RESET ROLE');
  await db.exec(migration);
  const after=await snapshot(db);
  assert.deepEqual(after.data,before.data);
  assert.equal(after.relation.oid,before.relation.oid);
  assert.equal(after.unrelated_acl,before.unrelated_acl);
  assert.equal(after.policies,null);
  for(const role of ['anon','authenticated']){
   await db.exec('SET ROLE '+role);
   for(const sql of ['SELECT * FROM public.dashboard_state',"INSERT INTO public.dashboard_state VALUES('x','{}')","UPDATE public.dashboard_state SET data='{}'","DELETE FROM public.dashboard_state",'TRUNCATE public.dashboard_state'])
    await assert.rejects(db.exec(sql),/permission denied/);
   await db.exec('RESET ROLE');
  }
  await db.exec("SET ROLE service_role; INSERT INTO public.dashboard_state VALUES('service-test','{}'); UPDATE public.dashboard_state SET data='{\"ok\":true}' WHERE id='service-test';");
  assert.equal((await db.query("SELECT data FROM public.dashboard_state WHERE id='service-test'")).rows[0].data.ok,true);
  await db.exec("DELETE FROM public.dashboard_state WHERE id='service-test'; RESET ROLE;");
  assert.deepEqual((await snapshot(db)).data,before.data);
  await db.exec(migration);assert.deepEqual(await snapshot(db),after);
  await db.exec(rollback);assert.deepEqual(await snapshot(db),before);
 }finally{await db.close();}
});
test('dashboard containment refuses ACL, policy, column or RLS drift without partial changes',async()=>{
 for(const change of [
  'REVOKE DELETE ON public.dashboard_state FROM anon',
  'CREATE POLICY extra ON public.dashboard_state FOR SELECT USING(true)',
  'GRANT SELECT(id) ON public.dashboard_state TO anon',
  'ALTER TABLE public.dashboard_state DISABLE ROW LEVEL SECURITY'
 ]){
  const db=await setup();try{
   await db.exec(change);const before=await snapshot(db);
   await assert.rejects(db.exec(migration),/metadata drift|ACL or policy drift/);
   assert.deepEqual(await snapshot(db),before);
  }finally{await db.close();}
 }
});
test('inherited client privileges abort containment atomically; rollback rejects later policy drift',async()=>{
 const db=await setup();try{
  await db.exec('GRANT service_role TO anon;');
  const before=await snapshot(db);
  await assert.rejects(db.exec(migration),/client privilege remains/);
  assert.deepEqual(await snapshot(db),before);
  await db.exec('REVOKE service_role FROM anon;');
  await db.exec(migration);
  await db.exec('CREATE POLICY later_policy ON public.dashboard_state FOR SELECT USING(false)');
  const changed=await snapshot(db);
  await assert.rejects(db.exec(rollback),/rollback metadata drift/);
  assert.deepEqual(await snapshot(db),changed);
 }finally{await db.close();}
});
