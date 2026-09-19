import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../supabase/migrations/20260920050000_revoke_client_truncate.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../sql/client-truncate-rollback.sql',import.meta.url),'utf8');
const tables=['activities','audit_logs','contact_assignments','contacts','deals','inquiries','next_actions','organizations','sites','users'];
async function setup(){
  const db=new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
  for(const name of [...tables,'untouched']) await db.exec(`CREATE TABLE public.${name}(id int PRIMARY KEY, data text); INSERT INTO public.${name} VALUES(1,'visible'),(2,'hidden'); ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY; GRANT ALL ON public.${name} TO anon,authenticated,service_role; CREATE POLICY scoped ON public.${name} FOR ALL USING(id=1) WITH CHECK(id=1);`);
  return db;
}
async function snapshot(db){
  return (await db.query(`SELECT c.relname,c.oid,c.relacl::text acl,c.relowner,c.relrowsecurity,c.relforcerowsecurity,
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid) policies
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`)).rows;
}
test('all ten tables deny client TRUNCATE while preserving scoped CRUD, server access and original rows',async()=>{
  const db=await setup();try{
    // RLS does not protect against TRUNCATE; demonstrate only on synthetic data.
    await db.exec('BEGIN; SET LOCAL ROLE anon; TRUNCATE public.activities; ROLLBACK;');
    const before=await snapshot(db);
    await db.exec(migration);
    const after=await snapshot(db);
    assert.deepEqual(after.map(({acl,...rest})=>rest),before.map(({acl,...rest})=>rest));
    assert.deepEqual(after.find(x=>x.relname==='untouched'),before.find(x=>x.relname==='untouched'));
    for(const name of tables){
      for(const role of ['anon','authenticated']){
        await db.exec('SET ROLE '+role);
        await assert.rejects(db.exec(`TRUNCATE public.${name}`),/permission denied/);
        assert.deepEqual((await db.query(`SELECT id FROM public.${name}`)).rows,[{id:1}]);
        await db.exec(`BEGIN; UPDATE public.${name} SET data='updated' WHERE id=1; DELETE FROM public.${name} WHERE id=1; INSERT INTO public.${name} VALUES(1,'reinserted'); ROLLBACK; RESET ROLE;`);
      }
      await db.exec(`BEGIN; SET LOCAL ROLE service_role; TRUNCATE public.${name}; ROLLBACK;`);
      assert.deepEqual((await db.query(`SELECT * FROM public.${name} ORDER BY id`)).rows,[{id:1,data:'visible'},{id:2,data:'hidden'}]);
    }
    await db.exec(migration);assert.deepEqual(await snapshot(db),after);
    await db.exec(rollback);assert.deepEqual(await snapshot(db),before);
  }finally{await db.close();}
});
test('missing tables and late ACL/RLS drift abort the whole change',async()=>{
  for(const change of ['DROP TABLE public.users','REVOKE DELETE ON public.users FROM anon','ALTER TABLE public.users DISABLE ROW LEVEL SECURITY']){
    const db=await setup();try{
      await db.exec(change);const before=await snapshot(db);
      await assert.rejects(db.exec(migration),/Missing target|metadata drift/);
      assert.deepEqual(await snapshot(db),before);
    }finally{await db.close();}
  }
});
test('inherited TRUNCATE fails atomically; rollback refuses subsequent ACL changes',async()=>{
  const db=await setup();try{
    await db.exec('CREATE ROLE inherited_access; GRANT TRUNCATE ON public.users TO inherited_access; GRANT inherited_access TO anon;');
    // Preserve the exact table ACL precondition while exercising role inheritance.
    await db.exec('REVOKE TRUNCATE ON public.users FROM inherited_access; GRANT service_role TO inherited_access;');
    const before=await snapshot(db);
    await assert.rejects(db.exec(migration),/postcondition failed/);
    assert.deepEqual(await snapshot(db),before);
    await db.exec('REVOKE inherited_access FROM anon;');
    await db.exec(migration);
    await db.exec('REVOKE UPDATE ON public.users FROM authenticated;');
    const changed=await snapshot(db);
    await assert.rejects(db.exec(rollback),/rollback drift/);
    assert.deepEqual(await snapshot(db),changed);
  }finally{await db.close();}
});
