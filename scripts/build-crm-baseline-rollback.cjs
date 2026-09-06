'use strict';
// Baseline-only reverse SQL. No connections, credentials, CASCADE, DROP OWNED or managed DDL.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {build,parseAcl}=require('./build-crm-baseline.cjs');
const {dir,sections,normalize,query,sha,canonicalDefinition,canonicalDefinitionSql}=require('./crm-baseline-metadata.cjs');
const q=s=>'"'+String(s).replaceAll('"','""')+'"';
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const same=(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
const md5=s=>crypto.createHash('md5').update(s).digest('hex');
function buildRollback(beforeExport,source){
 if(beforeExport.project_ref!=='rprechiaglyjaydkmxsu')throw Error('Wrong project: staging-only');
 const b=beforeExport.snapshot,s=source.payload,baseline=build(source);
 if(b.relations!==null||b.function_count!==0||b.type_count!==0||b.policy_count!==0)throw Error('Before snapshot must prove empty public');
 if(b.schema.owner!=='pg_database_owner'||!Array.isArray(b.schema.acl))throw Error('Unsupported before schema owner/ACL');
 const defaults=b.default_privileges||[];
 if(defaults.some(d=>d.schema!=='public'||!['postgres','supabase_admin'].includes(d.creator)||!['r','S','f'].includes(d.type)))throw Error('Unreviewed before defaults');
 if(defaults.some(d=>d.acl.some(a=>parseAcl(a).grantor!==d.creator)))throw Error('Unreviewed before default grantor');
 const tables=s.relations.filter(r=>r.kind==='r');
 const checks=sections.filter(k=>k!=='dependencies');
 const expected=Object.fromEntries(checks.map(k=>[k,s[k]]));
 expected.functions=s.functions.map(f=>({...f,definition:md5(canonicalDefinition(f.definition))}));
 const canonicalSql=canonicalDefinitionSql('pg_get_functiondef(p.oid)');
 const cap=query().replace('pg_get_functiondef(p.oid)',`md5(${canonicalSql})`)
  .replace('SELECT payload,md5(payload::text) AS metadata_md5 FROM snap;','SELECT payload INTO actual FROM snap;');
 const out=[`-- BASELINE ONLY POST-COMMIT ROLLBACK / STAGING ONLY
-- Before snapshot SHA256: ${sha(JSON.stringify(normalize(beforeExport)))}
-- Baseline SQL SHA256: ${baseline.manifest.sql_sha256}
-- Requires no previous session, temporary tables, Auth rows or external secrets.
-- Stops if any application data exists or captured baseline structure has drifted.
-- Function definition only: CRLF -> LF, CR -> LF. All other text/config/ACL guards remain.
-- Source raw/canonical MD5 evidence (raw bytes remain in source-metadata.json):
${s.functions.map(f=>`-- ${f.signature} raw_md5=${md5(f.definition)} canonical_md5=${md5(canonicalDefinition(f.definition))}`).join('\n')}
BEGIN;
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,pg_catalog;
-- BEGIN_ROLLBACK_APPROVAL_GUARD
DO $approval$ BEGIN
 IF current_setting('crm.baseline_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu'
 OR current_setting('crm.baseline_rollback_approved',true) IS DISTINCT FROM 'yes'
 OR current_user<>'postgres' THEN RAISE EXCEPTION 'Staging rollback approval/target required'; END IF;
END $approval$;
-- END_ROLLBACK_APPROVAL_GUARD
LOCK TABLE ${tables.map(t=>'public.'+q(t.name)).join(',')} IN ACCESS EXCLUSIVE MODE;
DO $baseline_check$ DECLARE actual jsonb; expected jsonb:=${lit(JSON.stringify(expected))}::jsonb; k text; f jsonb; original_hashes jsonb;
BEGIN
${cap}
SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'raw_md5',md5(pg_get_functiondef(p.oid)),'canonical_md5',md5(${canonicalSql})) ORDER BY p.oid::regprocedure::text)
 INTO original_hashes FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind IN ('f','p');
RAISE NOTICE 'baseline rollback raw/canonical function hashes: %',original_hashes;
FOREACH k IN ARRAY ARRAY[${checks.map(lit).join(',')}] LOOP
 IF NOT ((actual->k) @> (expected->k) AND (expected->k) @> (actual->k)) THEN
  RAISE EXCEPTION 'Baseline drift in %, refuse rollback',k;
 END IF;
END LOOP;
-- jsonb containment treats arrays as sets; explicitly preserve exact config order too.
FOR f IN SELECT value FROM jsonb_array_elements(actual->'functions') LOOP
 IF (f->'config') IS DISTINCT FROM (SELECT e->'config' FROM jsonb_array_elements(expected->'functions') e WHERE e->>'signature'=f->>'signature') THEN
  RAISE EXCEPTION 'Baseline drift in function config, refuse rollback';
 END IF;
END LOOP;
${tables.map(t=>`IF EXISTS(SELECT 1 FROM public.${q(t.name)} LIMIT 1) THEN RAISE EXCEPTION ${lit('Nonempty '+t.name+': refuse data deletion')}; END IF;`).join('\n')}
END $baseline_check$;
`];
 for(const t of s.triggers)out.push(`DROP TRIGGER ${q(t.name)} ON public.${q(t.table)} RESTRICT;`);
 for(const sig of [...baseline.manifest.functionOrder].reverse())out.push(`DROP FUNCTION public.${sig} RESTRICT;`);
 out.push(`DROP VIEW ${s.views.map(v=>'public.'+q(v.name)).join(',')} RESTRICT;`);
 // One explicit DROP group resolves intra-baseline FK cycles. External dependencies still block.
 // Owned sequences, indexes, constraints, policies and composite types are table-owned children.
 out.push(`DROP TABLE ${tables.map(t=>'public.'+q(t.name)).join(',')} RESTRICT;`);
 const ownSeq=new Set(s.sequences.filter(x=>x.owned_by).map(x=>x.name));
 for(const seq of s.sequences)if(!ownSeq.has(seq.name))out.push(`DROP SEQUENCE public.${q(seq.name)} RESTRICT;`);
 if(!same(b.schema,s.schema)){
  out.push('SET LOCAL ROLE pg_database_owner;');
  const roles=[...new Set([...b.schema.acl,...s.schema.acl].map(parseAcl).map(a=>a.grantee))];
  out.push(`REVOKE ALL ON SCHEMA public FROM ${roles.map(r=>r?q(r):'PUBLIC').join(',')} RESTRICT;`);
  for(const a of b.schema.acl.map(parseAcl)){
   if(a.grantor!=='pg_database_owner')throw Error('Unsupported schema ACL grantor');
   for(const g of a.grants)out.push(`GRANT ${g.privilege} ON SCHEMA public TO ${a.grantee?q(a.grantee):'PUBLIC'}${g.grantable?' WITH GRANT OPTION':''};`);
  }
  out.push('SET LOCAL ROLE postgres;');
 }
 for(const d of s.default_privileges){
  const previous=defaults.find(x=>x.creator===d.creator&&x.type===d.type);
  if(same(previous,d))continue;
  // Never require inaccessible managed-role authority in a hosted rollback.
  if(d.creator==='supabase_admin'&&!b.roles?.find(r=>r.name==='supabase_admin')?.postgres_member)throw Error('Managed default drift cannot be safely restored by postgres');
  const object={r:'TABLES',S:'SEQUENCES',f:'FUNCTIONS'}[d.type];
  const roles=[...new Set([...(previous?.acl||[]),...d.acl].map(parseAcl).map(a=>a.grantee))];
  out.push(`SET LOCAL ROLE ${q(d.creator)};`,`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ${object} FROM ${roles.map(r=>r?q(r):'PUBLIC').join(',')} RESTRICT;`);
  for(const a of (previous?.acl||[]).map(parseAcl))for(const g of a.grants)out.push(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ${g.privilege} ON ${object} TO ${a.grantee?q(a.grantee):'PUBLIC'}${g.grantable?' WITH GRANT OPTION':''};`);
  out.push('SET LOCAL ROLE postgres;');
 }
 const beforeExpected={schema:b.schema,default_privileges:defaults.length?defaults:null};
 out.push(`DO $restored$ DECLARE actual jsonb; k text; expected jsonb:=${lit(JSON.stringify(beforeExpected))}::jsonb; BEGIN
${cap}
IF EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace)
 OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace)
 OR EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace)
 OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public') THEN RAISE EXCEPTION 'Public is not restored empty'; END IF;
FOREACH k IN ARRAY ARRAY['schema','default_privileges'] LOOP
 IF NOT ((actual->k) @> (expected->k) AND (expected->k) @> (actual->k)) THEN RAISE EXCEPTION 'Before metadata mismatch: %',k; END IF;
END LOOP;
END $restored$;
COMMIT;
`);
 return {sql:out.join('\n'),before_sha256:sha(JSON.stringify(normalize(beforeExport))),baseline_sha256:baseline.manifest.sql_sha256};
}
if(require.main===module){
 const before=JSON.parse(fs.readFileSync(path.join(dir,'staging-before.json'),'utf8'));
 const source=JSON.parse(fs.readFileSync(path.join(dir,'source-metadata.json'),'utf8'));
 const result=buildRollback(before,source);
 fs.writeFileSync(path.join(dir,'baseline-only-rollback.sql'),result.sql);
 console.log(JSON.stringify({...result,sql:undefined,rollback_sha256:sha(result.sql)}));
}
module.exports={buildRollback};
