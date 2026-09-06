'use strict';
// Offline metadata only. Exit 0 is NOT production approval or live Auth proof.
const fs=require('node:fs');
const sections=['functions','relations','policies','storage_buckets','default_function_privileges','manifest_meta','effective_function_defaults','role_security','schema_access'];
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const bool=(row,key)=>{if(typeof row[key]!=='boolean')throw Error('Missing/invalid boolean: '+key);};
const str=(row,key)=>{if(typeof row[key]!=='string'||!row[key])throw Error('Missing/invalid field: '+key);};
function validate(data){
 for(const k of sections){
  if(!Array.isArray(data[k]))throw Error('Missing snapshot section: '+k);
  if(data[k].some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw Error('Invalid row: '+k);
  if(new Set(data[k].map(r=>JSON.stringify(stable(r)))).size!==data[k].length)throw Error('Duplicate snapshot rows: '+k);
 }
 if(!data.functions.length||!data.relations.length||!data.effective_function_defaults.length||data.manifest_meta.length!==1)throw Error('Incomplete inventory/metadata');
 for(const r of data.functions){
  for(const k of ['signature','schema_name','function_name','owner_name','acl_md5','prokind'])str(r,k);
  for(const k of ['security_definer','public_execute','anon_execute','authenticated_execute','service_role_execute'])bool(r,k);
  if(['f','p'].includes(r.prokind))str(r,'definition_md5');
 }
 for(const r of data.relations){
  for(const k of ['schema_name','relation_name','relkind'])str(r,k);
  for(const k of ['rls_enabled','anon_select','anon_insert','anon_update','anon_delete','anon_truncate','anon_column_select','anon_column_insert','anon_column_update','authenticated_truncate'])bool(r,k);
 }
 for(const r of data.storage_buckets){str(r,'id');bool(r,'public');}
 for(const r of data.effective_function_defaults){str(r,'owner_name');for(const k of ['public_execute','anon_execute','authenticated_execute'])bool(r,k);}
 for(const k of ['policy_md5','defaults_md5'])str(data.manifest_meta[0],k);
 for(const name of ['anon','authenticated','service_role']){
  const rows=data.role_security.filter(r=>r.role_name===name);
  if(rows.length!==1)throw Error('Missing/duplicate role: '+name);
  for(const k of ['superuser','bypass_rls','inherits'])bool(rows[0],k);
  if(!Array.isArray(rows[0].inherited_roles))throw Error('Missing inherited roles: '+name);
  for(const schema of ['public','storage']){
   const access=data.schema_access.filter(r=>r.role_name===name&&r.schema_name===schema);
   if(access.length!==1)throw Error('Missing/duplicate schema access: '+name+'/'+schema);
   bool(access[0],'usage');bool(access[0],'can_create');
  }
 }
 // An observed authenticated grant is not an independent allowlist decision.
 if(data.authenticated_function_allowlist!==undefined&&!Array.isArray(data.authenticated_function_allowlist))throw Error('Invalid authenticated_function_allowlist');
 for(const r of data.authenticated_function_allowlist||[]){str(r,'signature');str(r,'definition_md5');}
 return data;
}
function findings(actual,reviewed){
 const out=[];const add=(finding,object)=>out.push({finding,object});
 const allow=reviewed.authenticated_function_allowlist||[];
 for(const f of actual.functions){
  if(f.security_definer&&(f.public_execute||f.anon_execute))add('PUBLIC_OR_ANON_SECURITY_DEFINER',f.signature);
  if(f.function_name.startsWith('crm_')&&f.anon_execute)add('ANON_CRM_FUNCTION',f.signature);
  if(f.security_definer&&f.authenticated_execute&&!allow.some(a=>a.signature===f.signature&&a.definition_md5===f.definition_md5))add('UNREVIEWED_AUTHENTICATED_DEFINER',f.signature);
 }
 for(const r of actual.relations){
  const name=r.schema_name+'.'+r.relation_name;
  if(r.schema_name==='public'&&['r','p'].includes(r.relkind)&&!r.rls_enabled)add('PUBLIC_TABLE_WITHOUT_RLS',name);
  // ACL privileges require review, but are not proof that RLS allows any rows.
  if(r.schema_name==='public'&&['anon_select','anon_insert','anon_update','anon_delete','anon_truncate','anon_column_select','anon_column_insert','anon_column_update'].some(k=>r[k]))add('ANON_RELATION_PRIVILEGE_REQUIRES_REVIEW',name);
  if(r.authenticated_truncate)add('AUTHENTICATED_TRUNCATE_BYPASSES_RLS',name);
 }
 for(const b of actual.storage_buckets)if(b.public)add('PUBLIC_STORAGE_BUCKET',b.id);
 for(const d of actual.effective_function_defaults){
  if(d.public_execute)add('DEFAULT_PUBLIC_EXECUTE',d.owner_name);
  if(d.anon_execute||d.authenticated_execute)add('DEFAULT_BROWSER_EXECUTE',d.owner_name);
 }
 for(const r of actual.role_security)if(['anon','authenticated'].includes(r.role_name)){
  if(r.superuser||r.bypass_rls)add('BROWSER_ROLE_BYPASSES_RLS',r.role_name);
  if(r.inherited_roles.length)add('BROWSER_ROLE_INHERITANCE_REQUIRES_REVIEW',r.role_name);
 }
 for(const r of actual.schema_access)if(['anon','authenticated'].includes(r.role_name)&&r.can_create)add('BROWSER_SCHEMA_CREATE',r.role_name+'/'+r.schema_name);
 return out;
}
function compare(expected,actual){
 validate(expected);validate(actual);
 const diff=sections.map(section=>{
  const left=new Set(expected[section].map(x=>JSON.stringify(stable(x)))),right=new Set(actual[section].map(x=>JSON.stringify(stable(x))));
  return {section,removedOrChanged:[...left].filter(x=>!right.has(x)).length,addedOrChanged:[...right].filter(x=>!left.has(x)).length};
 });
 const risks=findings(actual,expected);
 const failed=risks.length>0||diff.some(r=>r.removedOrChanged||r.addedOrChanged);
 return {diff,findings:risks,catalog_status:failed?'FAIL':'PASS',production_decision:'NO-GO',reason:failed?'Catalog drift or unresolved security findings':'Catalog check only; real JWT/Storage/XSS/rollback and human approval remain required'};
}
if(require.main===module){
 try{
  const [expected,actual]=process.argv.slice(2);
  if(!expected||!actual)throw Error('Usage: node scripts/compare-security-snapshot.cjs reviewed.json actual.json');
  const result=compare(JSON.parse(fs.readFileSync(expected,'utf8')),JSON.parse(fs.readFileSync(actual,'utf8')));
  console.log(JSON.stringify(result,null,2));process.exitCode=result.catalog_status==='PASS'?0:1;
 }catch(e){console.error('NO-GO: '+e.message);process.exitCode=2;}
}
module.exports={sections,validate,findings,compare};
