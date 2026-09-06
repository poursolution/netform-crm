'use strict';
// OFFLINE generator only. Reads the reviewed metadata export; no DB client or network.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const base=path.resolve(__dirname,'../sql/baseline/20260905');
const q=s=>'"'+String(s).replaceAll('"','""')+'"';
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const aclMap={a:'INSERT',r:'SELECT',w:'UPDATE',d:'DELETE',D:'TRUNCATE',x:'REFERENCES',t:'TRIGGER',m:'MAINTAIN',X:'EXECUTE',U:'USAGE',C:'CREATE'};
function parseAcl(s){
 const m=/^([^=]*)=([A-Za-z*]*)\/([^/]+)$/.exec(s);if(!m)throw Error('Unreviewed ACL encoding');
 const grants=[];for(let i=0;i<m[2].length;i++){
  if(!aclMap[m[2][i]])throw Error('Unknown ACL privilege');
  grants.push({privilege:aclMap[m[2][i]],grantable:m[2][i+1]==='*'});if(m[2][i+1]==='*')i++;
 }
 return {grantee:m[1],grantor:m[3],grants};
}
function grants(target,acl){
 if(!acl)throw Error('Null ACL needs explicit acldefault handling, not guessing');
 const result=[];
 for(const a of acl.map(parseAcl)){
  result.push(`SET LOCAL ROLE ${q(a.grantor)};`);
  for(const p of a.grants)result.push(`GRANT ${p.privilege} ON ${target} TO ${a.grantee?q(a.grantee):'PUBLIC'}${p.grantable?' WITH GRANT OPTION':''};`);
 }
 result.push('SET LOCAL ROLE postgres;');return result.join('\n');
}
function resetGrants(target,acl){
 // New objects inherit creator defaults; remove those even if absent in source object ACL.
 const names=[...new Set(['','postgres','anon','authenticated','service_role',...acl.map(parseAcl).map(x=>x.grantee)])];
 return `REVOKE ALL ON ${target} FROM ${names.map(n=>n?q(n):'PUBLIC').join(',')};\n`+grants(target,acl);
}
const functionOrder=['set_updated_at()','require_reason(text,text)','stage_sla_days(text)','parse_responses(text)',
 '_done_today(text)','crm_site_contacts(uuid)','crm_contact_upsert(jsonb)','crm_contact_move(jsonb)',
 'crm_opportunity_work_set(jsonb)','apply_business_change(uuid,text,text,text,text,text,date)',
 'metrics_channel_flow()','metrics_lost_breakdown(text)','metrics_operations(text)','work_items_today(text)',
 'today_tasks(text)','today_counts()','crm_bundle()'];
// Manually reviewed dependencies inside string bodies are NOT reliably in pg_depend.
const bodyDependencies={
 '_done_today(text)':['activities'],
 'apply_business_change(uuid,text,text,text,text,text,date)':['deals','business_history','next_actions'],
 'crm_bundle()':['deals','stage_catalog','organizations','next_actions','inquiries','v_dup_org','notes','users','crm_site_contacts(uuid)','parse_responses(text)'],
 'crm_contact_move(jsonb)':['contact_assignments','deals','organizations','contacts'],
 'crm_contact_upsert(jsonb)':['deals','contacts','contact_assignments'],
 'crm_opportunity_work_set(jsonb)':['deals','activities','audit_logs'],
 'crm_site_contacts(uuid)':['deals','contacts','contact_assignments'],
 'metrics_channel_flow()':['deals'],'metrics_lost_breakdown(text)':['deals'],
 'metrics_operations(text)':['deals','inquiries','next_actions','stage_sla_days(text)'],
 'parse_responses(text)':[],'require_reason(text,text)':[],'set_updated_at()':[], 'stage_sla_days(text)':[],
 'today_counts()':['today_tasks(text)'],'today_tasks(text)':['_done_today(text)','deals','organizations','contacts','inquiries'],
 'work_items_today(text)':['inquiries','next_actions','deals','organizations']
};
function build(exported){
 const s=exported.payload;
 const tables=s.relations.filter(x=>x.kind==='r'),views=s.views;
 if(tables.length!==18||views.length!==5||s.functions.length!==17||s.columns.filter(c=>tables.some(t=>t.name===c.table)).length!==241||s.indexes.length!==67||s.constraints.length!==63||s.triggers.length!==8||s.sequences.length!==2)throw Error('Observed inventory mismatch');
 if(s.custom_types||s.custom_collations||s.columns.some(c=>c.identity||c.generated||c.compression||c.acl||c.collation&&c.collation!=='"default"')||s.relations.some(r=>!['r','v','S'].includes(r.kind)||r.options||String(r.tablespace)!=='0'||r.persistence!=='p'))throw Error('Unreviewed structure: refuse generation');
 if(s.indexes.some(i=>!i.valid||!i.ready||i.clustered||i.replica_identity)||s.constraints.some(c=>!c.validated)||s.triggers.some(t=>t.enabled!=='O'))throw Error('Unreviewed index/constraint/trigger state');
 if(s.sequences[0].max!=='9223372036854775807')throw Error('Sequence precision lost');
 const secrets=s.functions.flatMap(f=>[/sb_secret_[\w-]+/,/eyJ[\w-]+\.[\w-]+\.[\w-]+/,/https?:\/\/[^\s'"<>]+/,
  /(?:api_key|apikey|password|secret|token)\s*[:=]/i].filter(p=>p.test(f.definition)).map(p=>({signature:f.signature,pattern:String(p)})));
 if(secrets.length)throw Error('Potential hardcoded secret/URL: manual review required');
 const out=[`-- ORIGINAL INSECURE BASELINE / REVIEW ONLY / NEVER PRODUCTION
-- Source metadata MD5: ${exported.metadata_md5}
-- Exact public structure reconstruction, NOT security hardening and NOT a migration to apply now.
-- No customer/Auth rows, seed, sequence current values, role creation or managed extension installation.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
SET LOCAL standard_conforming_strings=on;
SET LOCAL search_path=public,pg_catalog;
SET LOCAL check_function_bodies=on;
-- BEGIN_APPROVAL_GUARD
DO $approval$
BEGIN
 IF current_setting('crm.baseline_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 OR current_setting('crm.baseline_only_approved',true) IS DISTINCT FROM 'yes'
 OR current_setting('crm.synthetic_isolation_confirmed',true) IS DISTINCT FROM 'yes' THEN
   RAISE EXCEPTION 'REVIEW ONLY: independent staging approval required';
 END IF;
 -- These attestations do not prove the connection target; the reviewed runner must.
END $approval$;
-- END_APPROVAL_GUARD
-- BEGIN_ENVIRONMENT_GUARD
DO $environment$
BEGIN
 IF current_user<>'postgres' OR current_setting('server_version')<>'17.6' THEN RAISE EXCEPTION 'Expected reviewed postgres / PG17.6 environment'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','v','m','S','f'))
 OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace) THEN RAISE EXCEPTION 'Baseline requires empty public application namespace'; END IF;
 IF to_regprocedure('auth.jwt()') IS NULL THEN RAISE EXCEPTION 'Supabase auth.jwt prerequisite missing'; END IF;
 IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='public')<>'pg_database_owner' THEN RAISE EXCEPTION 'Public schema owner differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datlocprovider='i' AND datlocale='en-US'
 AND datcollate='en_US.UTF-8' AND datctype='en_US.UTF-8' AND datcollversion='153.121') THEN RAISE EXCEPTION 'Database collation/ICU drift'; END IF;
 ${s.extensions.map(e=>`IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname=${lit(e.name)} AND e.extversion=${lit(e.version)} AND n.nspname=${lit(e.schema)} AND pg_get_userbyid(e.extowner)=${lit(e.owner)}) THEN RAISE EXCEPTION 'Extension prerequisite differs: ${e.name}'; END IF;`).join('\n ')}
 ${s.creators.map(r=>`IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${lit(r.role)} AND rolcanlogin=${r.can_login} AND rolsuper=${r.superuser} AND rolbypassrls=${r.bypass_rls} AND rolinherit=${r.inherit}) THEN RAISE EXCEPTION 'Creator role prerequisite differs: ${r.role}'; END IF;`).join('\n ')}
END $environment$;
-- END_ENVIRONMENT_GUARD
-- BEGIN_BASELINE_OBJECTS
-- 01: baseline default privileges (existing source defaults, not hardening).
-- Skip already identical defaults. Changes for supabase_admin require its supported
-- authority; if denied the transaction aborts. Never grant yourself membership.
`];
 // Source has no global default rows. Do not silently replace different target globals.
 out.push(`DO $global_defaults$ BEGIN IF EXISTS(SELECT 1 FROM pg_default_acl WHERE defaclnamespace=0) THEN RAISE EXCEPTION 'Global default privilege drift'; END IF; END $global_defaults$;`);
 for(const d of s.default_privileges){
  if(d.schema!=='public'||!['postgres','supabase_admin'].includes(d.creator))throw Error('Unreviewed default creator');
  const object={r:'TABLES',f:'FUNCTIONS',S:'SEQUENCES'}[d.type];
  const acl=d.acl.map(parseAcl);if(acl.some(a=>a.grantor!==d.creator))throw Error('Default grantor differs');
  const statements=[`SET LOCAL ROLE ${q(d.creator)};`,`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ${object} FROM PUBLIC,postgres,anon,authenticated,service_role;`];
  for(const a of acl)for(const g of a.grants)statements.push(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ${g.privilege} ON ${object} TO ${a.grantee?q(a.grantee):'PUBLIC'}${g.grantable?' WITH GRANT OPTION':''};`);
  statements.push('SET LOCAL ROLE postgres;');
  out.push(`DO $defaults$ BEGIN
 IF (SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole=${lit(d.creator)}::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype=${lit(d.type)})
 IS DISTINCT FROM ARRAY[${[...d.acl].sort().map(lit).join(',')}]::text[] THEN
 ${statements.map(x=>'EXECUTE '+lit(x)+';').join('\n ')}
 END IF;
END $defaults$;`);
 }
 out.push('-- 02: schema owner/ACL, preserved original grants (including PUBLIC USAGE).',
 'SET LOCAL ROLE pg_database_owner;',resetGrants('SCHEMA public',s.schema.acl));
 out.push('-- 03: sequence configuration only; no setval/current sequence data.');
 for(const x of s.sequences)out.push(`CREATE SEQUENCE public.${q(x.name)} AS ${x.type} INCREMENT BY ${x.increment} MINVALUE ${x.min} MAXVALUE ${x.max} START WITH ${x.start} CACHE ${x.cache} ${x.cycle?'CYCLE':'NO CYCLE'};`);
 out.push('-- 04: all 18 original tables / 241 original columns.');
 for(const t of tables){
  const cols=s.columns.filter(c=>c.table===t.name).sort((a,b)=>a.ordinal-b.ordinal);
  out.push(`CREATE TABLE public.${q(t.name)} (\n${cols.map(c=>'  '+q(c.name)+' '+c.type+(c.default?' DEFAULT '+c.default:'')+(c.not_null?' NOT NULL':'')).join(',\n')}\n);`);
 }
 out.push('-- 05: PK/UNIQUE/CHECK, then standalone indexes, then FK (including cycles).');
 for(const c of s.constraints.filter(c=>c.type!=='f'))out.push(`ALTER TABLE public.${q(c.table)} ADD CONSTRAINT ${q(c.name)} ${c.definition};`);
 for(const i of s.indexes.filter(i=>!i.constraint_owned))out.push(i.definition+';');
 for(const c of s.constraints.filter(c=>c.type==='f'))out.push(`ALTER TABLE public.${q(c.table)} ADD CONSTRAINT ${q(c.name)} ${c.definition};`);
 for(const x of s.sequences)if(x.owned_by)out.push(`ALTER SEQUENCE public.${q(x.name)} OWNED BY ${x.owned_by};`);
 out.push('-- 06: original views (original options, NOT security_invoker hardening).');
 for(const v of views)out.push(`CREATE VIEW public.${q(v.name)} AS\n${v.definition.trim()}`);
 out.push('-- 07: original functions, dependency ordered, bodies unchanged.');
 const completed=new Set([...tables.map(t=>t.name),...views.map(v=>v.name)]);
 for(const signature of functionOrder){
  const f=s.functions.find(x=>x.signature===signature);if(!f)throw Error('Missing function');
  for(const dep of bodyDependencies[signature])if(!completed.has(dep))throw Error('Dependency order missing '+dep);
  out.push(f.definition+';');completed.add(signature);
 }
 out.push('-- 08: table triggers and original RLS/policies.');
 for(const t of s.triggers)out.push(t.definition+';');
 for(const t of tables)out.push(`ALTER TABLE public.${q(t.name)} ${t.rls?'ENABLE':'DISABLE'} ROW LEVEL SECURITY;`,
  `ALTER TABLE public.${q(t.name)} ${t.force_rls?'FORCE':'NO FORCE'} ROW LEVEL SECURITY;`);
 for(const p of s.policies)out.push(`CREATE POLICY ${q(p.policyname)} ON public.${q(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(r=>r==='public'?'PUBLIC':q(r)).join(',')}${p.qual?' USING ('+p.qual+')':''}${p.with_check?' WITH CHECK ('+p.with_check+')':''};`);
 out.push('-- 09: owner and EXACT original ACLs. These reopen the known insecure paths.');
 for(const r of s.relations){
  const kind=r.kind==='S'?'SEQUENCE':r.kind==='v'?'VIEW':'TABLE';
  out.push(`ALTER ${kind} public.${q(r.name)} OWNER TO ${q(r.owner)};`,resetGrants((r.kind==='S'?'SEQUENCE':'TABLE')+' public.'+q(r.name),r.acl));
 }
 for(const f of s.functions)out.push(`ALTER FUNCTION public.${f.signature} OWNER TO ${q(f.owner)};`,resetGrants('FUNCTION public.'+f.signature,f.acl));
 out.push('-- END_BASELINE_OBJECTS');
 const aclCheck=(query,expected,label)=>`IF (${query}) IS DISTINCT FROM ARRAY[${[...expected].sort().map(lit).join(',')}]::text[] THEN RAISE EXCEPTION ${lit('Restored ACL mismatch: '+label)}; END IF;`;
 out.push('-- Fail before COMMIT if inherited grants or default privilege drift remains.',
  'DO $postcheck$ BEGIN',
  aclCheck("SELECT array_agg(v ORDER BY v) FROM pg_namespace n,LATERAL unnest(n.nspacl::text[]) v WHERE n.nspname='public'",s.schema.acl,'public schema'));
 for(const r of s.relations)out.push(aclCheck(`SELECT array_agg(v ORDER BY v) FROM pg_class c,LATERAL unnest(c.relacl::text[]) v WHERE c.oid=${lit('public.'+q(r.name))}::regclass`,r.acl,r.name));
 for(const f of s.functions)out.push(aclCheck(`SELECT array_agg(v ORDER BY v) FROM pg_proc p,LATERAL unnest(p.proacl::text[]) v WHERE p.oid=${lit('public.'+f.signature)}::regprocedure`,f.acl,f.signature));
 for(const d of s.default_privileges)out.push(aclCheck(`SELECT array_agg(v ORDER BY v) FROM pg_default_acl d,LATERAL unnest(d.defaclacl::text[]) v WHERE d.defaclrole=${lit(d.creator)}::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype=${lit(d.type)}`,d.acl,d.creator+'/'+d.type));
 out.push("IF (SELECT count(*) FROM pg_default_acl WHERE defaclnamespace=0 OR defaclnamespace='public'::regnamespace)<>6 THEN RAISE EXCEPTION 'Unexpected default privilege rows'; END IF;",
  'END $postcheck$;', '-- Full structural comparison using capture-metadata.sql is additionally required.', 'COMMIT;');
 const sql=out.join('\n\n')+'\n';
 const functionEdges=Object.entries(bodyDependencies).flatMap(([source,targets])=>targets.map(target=>({source,target,evidence:'manual review of captured function body (not pg_depend guarantee)'})));
 const before={source_metadata_md5:exported.metadata_md5,schema:s.schema,relations:s.relations,
  column_acl:s.columns.map(c=>({table:c.table,column:c.name,acl:c.acl})),
  functions:s.functions.map(({definition,...x})=>({...x,definition_sha256:hash(definition)})),policies:s.policies,
  default_privileges:s.default_privileges,creators:s.creators};
 return {sql,before,dependencies:{catalog:s.dependencies,body_review:functionEdges,
  constraints:s.constraints.map(c=>({table:c.table,name:c.name,type:c.type,definition:c.definition})),
  indexes:s.indexes.map(i=>({table:i.table,name:i.name,definition:i.definition,constraint_owned:i.constraint_owned})),
  triggers:s.triggers.map(t=>({table:t.table,name:t.name,definition:t.definition})),
  sequence_ownership:s.sequences.map(s=>({sequence:s.name,owned_by:s.owned_by})),
  external:[{source:'users / own row read policy',target:'auth.jwt()',kind:'managed Auth function'},
 {source:'all string columns',target:'database default ICU en-US / 153.121',kind:'environment'}]},
 manifest:{source_metadata_md5:exported.metadata_md5,sql_sha256:hash(sql),counts:{tables:18,tableColumns:241,viewColumns:40,functions:17,views:5,indexes:67,constraints:63,triggers:8,sequences:2,policies:2},
 functionOrder,secretPatternFindings:secrets,containsOriginalInsecureAcl:true,stagingApplied:false,productionApplied:false}};
}
if(require.main===module){
 const exported=JSON.parse(fs.readFileSync(path.join(base,'source-metadata.json'),'utf8'));
 const built=build(exported);
 // Reproducible generated artifacts, not manual source edits or remote execution.
 for(const [name,value] of [['public-baseline.sql',built.sql],['before-security.json',built.before],['dependencies.json',built.dependencies],['manifest.json',built.manifest]]){
  fs.writeFileSync(path.join(base,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
 }
 console.log(JSON.stringify({generated:true,...built.manifest}));
}
module.exports={build,parseAcl};
