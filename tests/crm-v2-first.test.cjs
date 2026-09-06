'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const labRequire=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'));
const {PGlite}=labRequire('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const add=read('supabase/migrations/20260905111739_crm_observed_uuid_scoped_candidate.sql');
const cut=read('supabase/migrations/20260905111432_crm_observed_p0_staging_candidate.sql');
const defaults=read('supabase/migrations/20260905112543_crm_creator_defaults_review.sql');

test('v2-first isolated SQL model (not full baseline/JWT)',async t=>{
 const db=new PGlite();
 try {
  await db.exec(read('tests/fixtures/observed-identity-subset.sql'));
  await db.exec(`CREATE ROLE supabase_admin;
    GRANT USAGE,CREATE ON SCHEMA public TO supabase_admin;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;
    GRANT EXECUTE ON FUNCTION public.crm_bundle() TO PUBLIC,anon,authenticated;
    GRANT SELECT ON public.users,public.deals TO anon,authenticated;
    CREATE TABLE public.dashboard_state(id text PRIMARY KEY,data jsonb);
    ALTER TABLE public.dashboard_state ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "allow all" ON public.dashboard_state FOR ALL TO public USING(true) WITH CHECK(true);
    CREATE POLICY "own row read" ON public.users FOR SELECT TO authenticated USING(email='synthetic@example.invalid');`);
  await t.test('creator default SQL refuses unapproved execution',async()=>{
   await assert.rejects(db.exec(defaults),/REVIEW ONLY/);await db.exec('ROLLBACK');
  });
  const creators=(await db.query(read('sql/20260905_crm_creator_inventory.sql'))).rows.map(x=>x.rolname);
  await db.exec("SET crm.reviewed_staging_ref='rprechiaglyjaydkmxsu'; SET crm.creator_defaults_approved='yes'; SET crm.managed_creator_impact_reviewed='yes';");
  await db.query("SELECT set_config('crm.approved_function_creators',$1,false)",[JSON.stringify(['postgres'])]);
  await t.test('omitting actual creator causes complete transaction failure',async()=>{
   await assert.rejects(db.exec(defaults),/Creator inventory drift/);await db.exec('ROLLBACK');
  });
  await db.query("SELECT set_config('crm.approved_function_creators',$1,false)",[JSON.stringify(creators)]);
  await t.test('actual creator default/probe SQL executes on local roles',async()=>{
   await db.exec(defaults);
   assert.equal((await db.query("SELECT to_regprocedure('public._crm_default_acl_probe()') AS p")).rows[0].p,null);
   assert.equal((await db.query("SELECT has_function_privilege('anon','public.crm_bundle()','EXECUTE') AS x")).rows[0].x,true);
  });
  await t.test('future postgres and supabase_admin functions are not public',async()=>{
   for(const creator of ['postgres','supabase_admin']){
    await db.exec(`SET ROLE ${creator}; CREATE FUNCTION public.local_probe() RETURNS int LANGUAGE sql AS 'SELECT 1'; RESET ROLE;`);
    const r=(await db.query("SELECT has_function_privilege('anon','public.local_probe()','EXECUTE') AS a,has_function_privilege('authenticated','public.local_probe()','EXECUTE') AS u")).rows[0];
    assert.deepEqual(r,{a:false,u:false});await db.exec('DROP FUNCTION public.local_probe()');
   }
  });
  const snapshot=async()=>JSON.stringify((await db.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='public') AS policies,
    (SELECT proacl::text FROM pg_proc WHERE oid='public.crm_bundle()'::regprocedure) AS acl,
    (SELECT jsonb_agg(jsonb_build_array(relname,relacl::text,relrowsecurity) ORDER BY relname) FROM pg_class c
      WHERE relnamespace='public'::regnamespace AND relkind='r') AS table_state`)).rows);
  const before=await snapshot();
  await db.exec("SET crm.uuid_contract_approved='yes'; SET crm.isolated_synthetic_staging='yes';");
  await t.test('additive v2 preserves legacy function grants, table grants and policies',async()=>{
   await db.exec(add);assert.equal(await snapshot(),before);
  });
  await db.exec(`INSERT INTO public.users(user_id,name,auth_uid) VALUES
    ('00000000-0000-4000-8000-000000000001','SYNTHETIC','00000000-0000-4000-8000-000000000101');
    INSERT INTO crm_security.access_review VALUES
    ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','rep','rep',true,
     '00000000-0000-4000-8000-000000000101',now(),now()+interval '1 day');
    SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000101';`);
  await t.test('UUID profile works before legacy cutover without email lookup',async()=>{
   await db.exec('SET ROLE authenticated');
   const p=(await db.query('SELECT public.crm_profile_scoped_v2() AS p')).rows[0].p;
   assert.equal(p.user_id,'00000000-0000-4000-8000-000000000001');
   assert.equal(p.auth_uid,'00000000-0000-4000-8000-000000000101');
   assert.equal(p.permission_role,'rep');await db.exec('RESET ROLE');
  });
  await t.test('cutover refuses to run before all feature evidence exists',async()=>{
   await db.exec("SET crm.approval_ticket='SEPARATE_STAGING_APPROVAL_REQUIRED'; SET crm.schema_diff_reviewed='yes';");
   await assert.rejects(db.exec(cut),/Cutover blocked/);await db.exec('ROLLBACK');
   assert.equal(await snapshot(),before);
  });
  await t.test('cutover REVOKE component closes legacy but preserves v2 (component only)',async()=>{
   // Execute only the real REVOKE component on this small model. This deliberately
   // does NOT waive/execute full inventory preflight or assert full cutover PASS.
   const block=cut.match(/DO \$contain\$;?[\s\S]*?\$contain\$;/)[0];
   await db.exec(`CREATE TEMP TABLE _crm_expected_function(signature text); INSERT INTO _crm_expected_function VALUES('crm_bundle()');
    CREATE TEMP TABLE _crm_expected_relation(name text,kind "char");
    INSERT INTO _crm_expected_relation SELECT relname,relkind FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r';
    CREATE TEMP TABLE _crm_before_relation AS SELECT * FROM pg_class WHERE false;`);
   await db.exec(block);
   await db.exec('SET ROLE authenticated');
   await assert.rejects(db.query('SELECT public.crm_bundle()'),/permission denied/);
   await db.query('SELECT public.crm_profile_scoped_v2(), public.crm_read_scoped_v2()');
   await db.exec('RESET ROLE');
  });
 }finally{await db.close();}
});
