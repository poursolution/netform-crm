'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../sql/baseline/20260905');
const sections=['schema','relations','columns','constraints','indexes','sequences','functions','views','triggers','policies','default_privileges','custom_types','custom_collations','dependencies'];
// Catalog inventory/ACL ordering is not semantic; config ordering remains exact.
const normalize=(x,key)=>Array.isArray(x)?(key==='config'?x.map(v=>normalize(v)):x.map(v=>normalize(v)).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v,k)])):x;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const md5=x=>crypto.createHash('md5').update(x).digest('hex');
// The ONLY permitted definition transformation. Never trim, reindent or normalize SQL tokens.
const canonicalDefinition=x=>x.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
const canonicalDefinitionSql=expression=>`replace(replace(${expression},chr(13)||chr(10),chr(10)),chr(13),chr(10))`;
function canonicalComparison(source,actual){
 const canonicalPayload=p=>({...p,functions:(p.functions||[]).map(f=>({...f,definition:canonicalDefinition(f.definition)}))});
 const expected=canonicalPayload(source),observed=canonicalPayload(actual);
 const keys=[...new Set([...Object.keys(source),...Object.keys(actual)])];
 const canonicalDiff=keys.filter(k=>JSON.stringify(normalize(expected[k]))!==JSON.stringify(normalize(observed[k])));
 const functions=[...new Set([...(source.functions||[]).map(f=>f.signature),...(actual.functions||[]).map(f=>f.signature)])].sort().map(signature=>{
  const s=source.functions?.find(f=>f.signature===signature),a=actual.functions?.find(f=>f.signature===signature);
  if(!s||!a)return {signature,status:'FAIL',reason:'missing_or_extra_function'};
  const rawSame=s.definition===a.definition,canonicalSame=canonicalDefinition(s.definition)===canonicalDefinition(a.definition);
  const otherFields=[...new Set([...Object.keys(s),...Object.keys(a)])].filter(k=>k!=='definition'&&JSON.stringify(normalize(s[k],k))!==JSON.stringify(normalize(a[k],k)));
  return {signature,source:{raw_md5:md5(s.definition),canonical_md5:md5(canonicalDefinition(s.definition))},actual:{raw_md5:md5(a.definition),canonical_md5:md5(canonicalDefinition(a.definition))},
   definition_diff:rawSame?'identical':canonicalSame?'newline_only_diff':'canonical_definition_diff',other_field_diff:otherFields,
   status:canonicalSame&&otherFields.length===0?'PASS':'FAIL'};
 });
 return {rule:'CRLF->LF, CR->LF; function definition only',rawDiff:diff(source,actual),canonicalDiff,functions,
  status:canonicalDiff.length===0&&functions.every(f=>f.status==='PASS')?'Canonical baseline reproduction PASS':'FAIL',byteIdenticalReproduction:'NOT CLAIMED'};
}
function query(){return fs.readFileSync(path.join(dir,'capture-metadata.sql'),'utf8');}
function preflight(){return query().replace('SELECT payload,md5(payload::text) AS metadata_md5 FROM snap;',`SELECT jsonb_build_object('payload',payload,'metadata_md5',md5(payload::text),
 'environment',jsonb_build_object('executor',current_user,'database',current_database(),
 'project_ref_setting',current_setting('supabase.project_ref',true),
 'collation_version',(SELECT datcollversion FROM pg_database WHERE datname=current_database()),
 'auth_jwt_exists',to_regprocedure('auth.jwt()') IS NOT NULL,
 'namespaces',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl) ORDER BY nspname) FROM pg_namespace WHERE nspname IN('public','auth','storage','realtime','graphql','graphql_public','extensions','vault')),
 'event_triggers',(SELECT jsonb_agg(jsonb_build_object('name',evtname,'owner',pg_get_userbyid(evtowner),'event',evtevent,'tags',evttags,'enabled',evtenabled,'function',evtfoid::regprocedure::text) ORDER BY evtname) FROM pg_event_trigger),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'super',rolsuper,'inherit',rolinherit,'bypass',rolbypassrls,'postgres_member',pg_has_role('postgres',oid,'MEMBER')) ORDER BY rolname) FROM pg_roles WHERE rolname IN('postgres','supabase_admin','pg_database_owner','anon','authenticated','service_role'))
 )) AS snapshot FROM snap;`);}
function diff(source,actual){return sections.filter(k=>JSON.stringify(normalize(source[k]))!==JSON.stringify(normalize(actual[k])));}
if(require.main===module){fs.writeFileSync(path.join(dir,'staging-preflight.sql'),preflight());console.log('Generated metadata-only staging-preflight.sql');}
module.exports={dir,sections,normalize,query,preflight,diff,sha,md5,canonicalDefinition,canonicalDefinitionSql,canonicalComparison};
