'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {compare,validate}=require('../scripts/compare-security-snapshot.cjs');
function clean(){
 return {
  functions:[{signature:'crm_reader()',schema_name:'public',function_name:'crm_reader',owner_name:'postgres',acl_md5:'acl',prokind:'f',definition_md5:'body',security_definer:true,public_execute:false,anon_execute:false,authenticated_execute:true,service_role_execute:true}],
  authenticated_function_allowlist:[{signature:'crm_reader()',definition_md5:'body'}],
  relations:[{schema_name:'public',relation_name:'deals',relkind:'r',rls_enabled:true,anon_select:false,anon_insert:false,anon_update:false,anon_delete:false,anon_truncate:false,anon_column_select:false,anon_column_insert:false,anon_column_update:false,authenticated_truncate:false}],
  policies:[],storage_buckets:[{id:'crm-files',public:false}],default_function_privileges:[],
  manifest_meta:[{policy_md5:'policies',defaults_md5:'defaults'}],
  effective_function_defaults:[{owner_name:'postgres',public_execute:false,anon_execute:false,authenticated_execute:false}],
  role_security:['anon','authenticated','service_role'].map(role_name=>({role_name,superuser:false,bypass_rls:role_name==='service_role',inherits:true,inherited_roles:[]})),
  schema_access:['public','storage'].flatMap(schema_name=>['anon','authenticated','service_role'].map(role_name=>({schema_name,role_name,usage:true,can_create:false})))
 };
}
test('identical clean catalog is not production approval',()=>{
 const result=compare(clean(),clean());assert.equal(result.catalog_status,'PASS');assert.equal(result.production_decision,'NO-GO');
});
test('identical unsafe snapshots fail independently of diff',()=>{
 const changes=[
  x=>x.functions[0].public_execute=true,
  x=>x.functions[0].anon_execute=true,
  x=>x.relations[0].rls_enabled=false,
  x=>x.relations[0].anon_column_select=true,
  x=>x.relations[0].authenticated_truncate=true,
  x=>x.storage_buckets[0].public=true,
  x=>x.effective_function_defaults[0].public_execute=true,
  x=>x.effective_function_defaults[0].anon_execute=true,
  x=>x.effective_function_defaults[0].authenticated_execute=true,
  x=>x.role_security[0].bypass_rls=true,
  x=>x.role_security[1].inherited_roles=['service_role'],
  x=>x.schema_access[0].can_create=true,
 ];
 for(const change of changes){const x=clean();change(x);const r=compare(x,x);assert.equal(r.catalog_status,'FAIL');assert.ok(r.findings.length);assert.ok(r.diff.every(d=>!d.addedOrChanged&&!d.removedOrChanged));}
});
test('authenticated definer review binds exact signature and definition',()=>{
 for(const change of [x=>delete x.authenticated_function_allowlist,x=>x.functions[0].signature='crm_reader(text)',x=>x.functions[0].definition_md5='changed']){
  const x=clean();change(x);assert.ok(compare(x,x).findings.some(f=>f.finding==='UNREVIEWED_AUTHENTICATED_DEFINER'));
 }
});
test('incomplete or malformed snapshots fail closed',()=>{
 for(const change of [x=>delete x.role_security,x=>x.effective_function_defaults=[],x=>delete x.relations[0].anon_column_select,x=>x.functions[0].anon_execute='false',x=>x.schema_access.pop(),x=>x.functions.push({...x.functions[0]})]){
  const x=clean();change(x);assert.throws(()=>validate(x));
 }
});
test('policy and view drift fails even with unchanged ACL',()=>{
 const x=clean();x.policies.push({policyname:'unsafe',qual:'true'});assert.equal(compare(clean(),x).catalog_status,'FAIL');
 const y=clean();y.relations[0].view_definition_md5='new';assert.equal(compare(clean(),y).catalog_status,'FAIL');
});
test('snapshot executes SELECT-only against isolated PostgreSQL and observes implicit PUBLIC default',async()=>{
 const {PGlite}=require('../../crm-security-lab/node_modules/@electric-sql/pglite');
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema storage;create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table public.deals(id integer);alter table public.deals enable row level security;
   grant select(id) on public.deals to anon;
   create function public.crm_probe() returns integer language sql security definer as 'select 1';`);
  const sql=fs.readFileSync(path.join(__dirname,'../sql/20260905_crm_security_snapshot.sql'),'utf8');
  const stripped=sql.replace(/^\s*--.*$/gm,'');
  for(const statement of stripped.split(';').filter(s=>s.trim()))assert.match(statement.trim(),/^select\b/i);
  const results=await db.exec(sql);
  const rows=results.flatMap(r=>r.rows);
  assert.ok(rows.some(r=>r.section==='effective_function_defaults'&&r.public_execute===true));
  const relation=rows.find(r=>r.section==='relations'&&r.relation_name==='deals');
  assert.equal(relation.anon_select,false);assert.equal(relation.anon_column_select,true);
  assert.ok(rows.some(r=>r.section==='role_security'&&r.role_name==='anon'));
  assert.ok(rows.some(r=>r.section==='schema_access'&&r.role_name==='authenticated'));
  await db.exec('alter default privileges revoke execute on functions from public;alter default privileges in schema public grant execute on functions to anon;');
  const rerun=(await db.exec(sql)).flatMap(r=>r.rows);
  assert.ok(rerun.some(r=>r.section==='effective_function_defaults'&&!r.public_execute&&r.anon_execute));
  assert.equal((await db.query('select count(*)::integer n from public.deals')).rows[0].n,0);
 }finally{await db.close();}
});
