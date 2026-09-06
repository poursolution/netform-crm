'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const {PGlite}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('@electric-sql/pglite');
const {build:baseline}=require('./build-crm-baseline.cjs');
const {query,sections,normalize,canonicalDefinitionSql}=require('./crm-baseline-metadata.cjs');
const {build:seed,REF,uid,dataGuard}=require('./build-observed-synthetic-seed.cjs');
const mapping=require('../sql/baseline/20260905/synthetic/auth-mapping.json');
const fixture=seed(mapping),out=path.resolve(__dirname,'../sql/v2-owned/20260905');
const baseMigration=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260905132335_crm_owned_v2_staging.sql'),'utf8');
const conflictPatch=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260905134532_crm_v2_version_conflict_http.sql'),'utf8');
const migration=baseMigration.replace('COMMIT;',()=>conflictPatch.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')+'\nCOMMIT;');
const approval=`SET crm.v2_staging_ref='${REF}'; SET crm.v2_approved='yes';`;
function catalog(schema='public'){
 return query().replaceAll("n.nspname='public'",`n.nspname='${schema}'`).replaceAll("nspname='public'",`nspname='${schema}'`).replaceAll("schemaname='public'",`schemaname='${schema}'`)
 .replaceAll("'public'::regnamespace",`'${schema}'::regnamespace`).replace('pg_get_functiondef(p.oid)',canonicalDefinitionSql('pg_get_functiondef(p.oid)'));
}
function guard(payload,schema='public'){
 // EXCEPT ALL ignores catalog array order only; every object attribute remains strict.
 const checks=sections.map(k=>{
  if(payload._guardHashes){const expr=Array.isArray(payload[k])?`(SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements(actual->'${k}'))`:`actual->'${k}'`;
   return `IF md5((${expr})::text) IS DISTINCT FROM '${payload._guardHashes[k]}' THEN RAISE EXCEPTION '${schema}.${k} metadata drift'; END IF;`;}
  const v=payload[k];const expression=`actual->'${k}'`;
  if(!Array.isArray(v))return `IF ${expression} IS DISTINCT FROM $expected$${JSON.stringify(v??null)}$expected$::jsonb THEN RAISE EXCEPTION '${schema}.${k} metadata drift'; END IF;`;
  return `IF EXISTS((SELECT value FROM jsonb_array_elements(${expression}) EXCEPT ALL SELECT value FROM jsonb_array_elements($expected$${JSON.stringify(v)}$expected$::jsonb)) UNION ALL (SELECT value FROM jsonb_array_elements($expected$${JSON.stringify(v)}$expected$::jsonb) EXCEPT ALL SELECT value FROM jsonb_array_elements(${expression}))) THEN RAISE EXCEPTION '${schema}.${k} metadata drift'; END IF;`;
 }).join('\n');
 return `DO $metadata_guard$ DECLARE actual jsonb; BEGIN\n${catalog(schema).replace('SELECT payload,md5(payload::text) AS metadata_md5 FROM snap;','SELECT payload INTO actual FROM snap;')}\n${checks}\nEND $metadata_guard$;`;
}
async function setup(dataDir){
 const db=new PGlite(dataDir);
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE supabase_admin SUPERUSER;
 CREATE SCHEMA auth; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT NULL::jsonb';
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
 CREATE SCHEMA storage;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text NOT NULL REFERENCES storage.buckets(id),name text NOT NULL,owner_id text,metadata jsonb,UNIQUE(bucket_id,name));
 GRANT USAGE ON SCHEMA storage TO authenticated; GRANT INSERT ON storage.objects TO authenticated;
 ALTER SCHEMA public OWNER TO pg_database_owner;`);
 await db.exec(baseline(require('../sql/baseline/20260905/source-metadata.json')).sql.replace(/-- BEGIN_APPROVAL_GUARD[\s\S]*?-- END_APPROVAL_GUARD/,'').replace(/-- BEGIN_ENVIRONMENT_GUARD[\s\S]*?-- END_ENVIRONMENT_GUARD/,''));
 for(const a of mapping.accounts)await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[a.auth_uid,a.email]);
 await db.exec(`SET crm.synthetic_staging_ref='${REF}'; SET crm.synthetic_seed_approved='yes';`+fixture.apply+approval);
 return db;
}
const scopeSpecs=[[4,4],[5,5],[6,5]];
function approvals(){
 const roles=['rep','rep','consultation','branch','admin','admin'];
 return `BEGIN; DO $$ BEGIN IF current_user<>'postgres' OR current_setting('crm.v2_staging_ref',true) IS DISTINCT FROM '${REF}' THEN RAISE EXCEPTION 'Staging only'; END IF;
 IF EXISTS(SELECT 1 FROM crm_security.access_review) OR EXISTS(SELECT 1 FROM crm_security.object_scope) THEN RAISE EXCEPTION 'Existing approval ledger'; END IF; END $$;\n`+
 fixture.mapped.map((a,i)=>`INSERT INTO crm_security.access_review(user_id,reviewed_auth_uid,source_role,permission_role,approved,reviewed_by,expires_at) VALUES('${a.user_id}','${a.auth_uid}','${a.source_role}','${roles[i]}',true,'synthetic-v2-stage-20260905',now()+interval '7 days');`).join('\n')+'\n'+
 scopeSpecs.flatMap(([u,n],j)=>['deal','inquiry'].map((t,k)=>`INSERT INTO crm_security.object_scope(scope_id,user_id,${t}_id,can_write,reviewed_by,expires_at) VALUES('${uid(10,j*2+k+1)}','${uid(1,u)}','${uid(t==='deal'?6:5,n)}',${t==='deal'},'synthetic-v2-stage-20260905',now()+interval '7 days');`)).join('\n')+'\nCOMMIT;';
}
function rollback(before,after,privateAfter){
 const capture=Object.keys(fixture.rows).map(t=>`INSERT INTO crm_v2_rollback_rows VALUES('${t}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text COLLATE "C"),'[]'::jsonb) FROM public.${t} t));`).join('\n');
 const rowChecks=Object.entries(fixture.rows).map(([t,rows])=>`IF (SELECT count(*) FROM public.${t})<>${rows.length} THEN RAISE EXCEPTION 'Unexpected ${t} row count'; END IF;`).join('\n');
 const rowVerify=Object.keys(fixture.rows).map(t=>`IF (SELECT rows FROM crm_v2_rollback_rows WHERE table_name='${t}') IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text COLLATE "C"),'[]'::jsonb) FROM public.${t} t) THEN RAISE EXCEPTION '${t} changed during rollback'; END IF;`).join('\n');
 return `-- STAGING v2-only post-COMMIT rollback. Preserve current business rows, including legitimate v2 writes.
BEGIN;
SET LOCAL search_path=public,pg_catalog; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='60s';
DO $$ BEGIN IF current_user<>'postgres' OR current_setting('crm.v2_staging_ref',true) IS DISTINCT FROM '${REF}' OR current_setting('crm.v2_approved',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Staging rollback approval required'; END IF;
IF to_regnamespace('crm_v2_archive') IS NOT NULL THEN RAISE EXCEPTION 'Existing audit archive'; END IF; END $$;
${guard(after)}
${guard(privateAfter,'crm_security')}
-- Prevent an audit insert racing the empty-ledger branch and preserve rows consistently.
LOCK TABLE ${Object.keys(fixture.rows).map(t=>'public.'+t).join(',')} IN SHARE MODE;
LOCK TABLE crm_security.audit_events IN ACCESS EXCLUSIVE MODE;
DO $data$ BEGIN ${rowChecks} IF (SELECT count(*) FROM auth.users)<>6 OR EXISTS(SELECT 1 FROM public.users u LEFT JOIN auth.users a ON a.id=u.auth_uid WHERE a.id IS NULL) THEN RAISE EXCEPTION 'Auth fixture drift'; END IF; END $data$;
CREATE TEMP TABLE crm_v2_rollback_rows(table_name text PRIMARY KEY,rows jsonb NOT NULL) ON COMMIT DROP;
${capture}
DROP FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text) RESTRICT;
DROP FUNCTION public.crm_contacts_scoped_v2(uuid) RESTRICT;
DROP FUNCTION public.crm_read_scoped_v2(uuid,integer,uuid,uuid) RESTRICT;
DROP FUNCTION public.crm_profile_scoped_v2() RESTRICT;
DROP FUNCTION crm_security.can_deal(uuid,boolean) RESTRICT;
DROP FUNCTION crm_security.can_inquiry(uuid) RESTRICT;
DROP FUNCTION crm_security.actor() RESTRICT;
-- A populated audit ledger survives rollback, including actor Auth and CRM UUIDs.
DO $audit$ BEGIN
 IF EXISTS(SELECT 1 FROM crm_security.audit_events) THEN
  CREATE SCHEMA crm_v2_archive AUTHORIZATION postgres;
  REVOKE ALL ON SCHEMA crm_v2_archive FROM PUBLIC,anon,authenticated,service_role;
  ALTER TABLE crm_security.audit_events SET SCHEMA crm_v2_archive;
 ELSE DROP TABLE crm_security.audit_events RESTRICT; END IF;
END $audit$;
DROP TABLE crm_security.object_scope RESTRICT;
DROP TABLE crm_security.access_review RESTRICT;
DROP SCHEMA crm_security RESTRICT;
-- Exact before state: no postgres global function ACL row; schema public explicit grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;
${guard(before)}
DO $data$ BEGIN ${rowVerify} END $data$;
COMMIT;`;
}
async function generate(){fs.mkdirSync(out,{recursive:true});const db=await setup();try{
 const before=(await db.query(catalog())).rows[0].payload;
 await db.exec(migration);
 const after=(await db.query(catalog())).rows[0].payload,privateAfter=(await db.query(catalog('crm_security'))).rows[0].payload;
 for(const p of [before,after,privateAfter]){p._guardHashes={};for(const k of sections){const expr=Array.isArray(p[k])?'(SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements($1::jsonb))':'$1::jsonb';p._guardHashes[k]=(await db.query(`SELECT md5((${expr})::text) h`,[JSON.stringify(p[k]??null)])).rows[0].h;}}
 const apply=migration.replace('DO $guard$',()=>`${guard(before)}\nDO $data$ BEGIN ${dataGuard(fixture.rows)} END $data$;\nDO $guard$`).replace('COMMIT;',()=>`${guard(after)}\n${guard(privateAfter,'crm_security')}\nCOMMIT;`);
 const rb=rollback(before,after,privateAfter);
 const diag=catalog().replace('SELECT payload,md5(payload::text) AS metadata_md5 FROM snap;',`SELECT jsonb_object_agg(k,jsonb_build_object('default_order_hash',CASE WHEN jsonb_typeof(v)='array' THEN (SELECT md5(jsonb_agg(value ORDER BY value::text)::text) FROM jsonb_array_elements(v)) ELSE md5(v::text) END,'c_order_hash',CASE WHEN jsonb_typeof(v)='array' THEN (SELECT md5(jsonb_agg(value ORDER BY value::text COLLATE "C")::text) FROM jsonb_array_elements(v)) ELSE md5(v::text) END)) hashes FROM snap,LATERAL jsonb_each(payload) e(k,v) WHERE k=ANY(ARRAY[${sections.map(k=>`'${k}'`).join(',')}]);`);
 const patchApply=conflictPatch.replace('DO $patch$',()=>guard(require('../sql/v2-owned/20260905/staging-after-public.json'))+'\nDO $patch$').replace('COMMIT;',()=>guard(after)+'\n'+guard(privateAfter,'crm_security')+'\nCOMMIT;');
 for(const [name,data] of Object.entries({'staging-v2-apply.sql':approval+apply,'conflict-patch-apply.sql':approval+patchApply,'v2-only-rollback.sql':approval+rb,'permission-approvals.sql':approval+approvals(),'capture-public.sql':catalog(),'capture-private.sql':catalog('crm_security'),'hash-diagnostic.sql':'BEGIN READ ONLY; SET LOCAL search_path=public,pg_catalog; '+diag+' COMMIT;','read-only-corrected-preflight.sql':'BEGIN READ ONLY; SET LOCAL search_path=public,pg_catalog; '+guard(before)+' SELECT \'CORRECTED_PREFLIGHT_PASS\' result; COMMIT;','expected-before.json':JSON.stringify(before,null,2),'expected-after.json':JSON.stringify(after,null,2),'expected-private.json':JSON.stringify(privateAfter,null,2)}))fs.writeFileSync(path.join(out,name),data);
 console.log('Generated v2 apply/rollback/approval and strict expected catalog guards.');
 }finally{await db.close();}}
if(require.main===module)generate().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={PGlite,setup,catalog,guard,migration,approval,approvals,rollback,mapping,fixture,out,normalize,uid};
