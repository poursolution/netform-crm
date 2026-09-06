'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const catalog=require('../sql/operational-full-local-candidate/20260906/fixture-catalog.cjs');

const root=path.resolve(__dirname,'..');
const dir=path.join(root,'sql','operational-full-local-candidate','20260906');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'sql','baseline','20260905','synthetic','fixture.json'),'utf8'));
const sql=fs.readFileSync(path.join(dir,'staging-fixture-catalog.sql'),'utf8');

test('fixture catalog is one strict read-only post-apply transaction',()=>{
 assert.equal((sql.match(/^BEGIN READ ONLY;$/gm)||[]).length,1);
 assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);
 assert.doesNotMatch(sql,/^(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|LOCK)\b/gm);
 assert.match(sql,/crm_write_command_v2_frozen_20260906/);
 assert.match(sql,/post-apply receipt operation drift/);
 assert.match(sql,/READ_ONLY_POST_APPLY_CATALOG/);
});

test('catalog covers FK, trigger, RLS, ACL, public entrypoint and canonical UUID inputs',()=>{
 for(const relation of manifest.candidate_inventory.relation_names)assert.ok(sql.includes(`'${relation}'`),relation);
 for(const key of ['columns','constraints','indexes','triggers','policies','table_security','public_entrypoints','canonical_presence'])assert.ok(sql.includes(`'${key}'`),key);
 for(const signature of catalog.publicFunctions)assert.ok(sql.includes(signature),signature);
 for(const group of ['users','sites','organizations','contacts','inquiries','deals','contact_assignments','activities','next_actions'])for(const row of fixture.rows[group]){
  const id=row.user_id||row.site_id||row.id;assert.ok(sql.includes(id),`${group}:${id}`);
 }
});

test('validator accepts a structurally complete safe capture and rejects target/private ACL/canonical drift',()=>{
 const target=[...catalog.publicRelations,...catalog.corePrivateRelations,...manifest.candidate_inventory.relation_names,...catalog.storageRelations];
 const base={project_ref:'rprechiaglyjaydkmxsu',project_name:'netform-crm-staging',mode:'READ_ONLY_POST_APPLY_CATALOG',status:'PASS',transaction_read_only:true,current_user:'postgres',target_relations:target,candidate_relations:manifest.candidate_inventory.relation_names,candidate_columns:catalog.candidateColumns,columns:target.map(relation=>({relation,name:'id'})),constraints:[],indexes:[],triggers:[],policies:[],table_security:target.map(relation=>({relation,rls:relation.startsWith('crm_security.'),anon_select:false,anon_write:false,authenticated_select:false,authenticated_write:false})),public_entrypoints:catalog.publicFunctions.map(signature=>({signature,security_definer:true,anon_execute:false,authenticated_execute:true})),canonical_presence:Object.fromEntries(['users','sites','organizations','contacts','inquiries','deals','contact_assignments','activities','next_actions'].map(group=>[`public.${group}`,{present:fixture.rows[group].length,expected:fixture.rows[group].length}])),staging_ddl_dml_performed:false,production_accessed:false,n8n_accessed:false};
 assert.equal(catalog.validate(base,{candidateRelations:manifest.candidate_inventory.relation_names,fixture}).status,'PASS');
 assert.equal(catalog.validate({...base,project_ref:'ymfbmpnizxvqsamnczow'},{candidateRelations:manifest.candidate_inventory.relation_names,fixture}).status,'FAIL');
 const insecure=structuredClone(base);insecure.table_security.find(item=>item.relation===manifest.candidate_inventory.relation_names[0]).authenticated_select=true;
 assert.equal(catalog.validate(insecure,{candidateRelations:manifest.candidate_inventory.relation_names,fixture}).status,'FAIL');
 const absent=structuredClone(base);absent.canonical_presence['public.deals'].present--;
 assert.equal(catalog.validate(absent,{candidateRelations:manifest.candidate_inventory.relation_names,fixture}).status,'FAIL');
});

test('CLI validator fails closed on a wrong captured project',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'crm-fixture-catalog-'));
 const file=path.join(temp,'wrong.json');
 fs.writeFileSync(file,JSON.stringify({project_ref:'ymfbmpnizxvqsamnczow'}));
 const run=spawnSync(process.execPath,[path.join(dir,'validate-staging-fixture-catalog.cjs'),file],{cwd:root,encoding:'utf8'});
 assert.notEqual(run.status,0);
 assert.match(run.stdout,/"status": "FAIL"/);
});
