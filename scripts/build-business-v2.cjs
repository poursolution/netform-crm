'use strict';
const fs=require('node:fs'),path=require('node:path');
const s=require('./crm-v2-stage.cjs'),{sections}=require('./crm-baseline-metadata.cjs');
const out=path.resolve(__dirname,'../sql/business-v2'),migrationPath=path.resolve(__dirname,'../supabase/migrations/20260905140050_crm_v2_business_contracts.sql');
const source=fs.readFileSync(path.join(out,'functions.sql'),'utf8');
const original=require('../sql/v2-owned/20260905/staging-final-public.json').functions.find(f=>f.signature.startsWith('crm_work_set_scoped_v2('));
const oldSignature='public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text)';
const newWork=original.definition.replace(', p_actor_name text DEFAULT NULL::text','').replace('Client p_actor_name is deliberately ignored. No user_metadata/name/email authorization.','Actor has no client parameter; server identity only.');
if(newWork.includes('p_actor_name'))throw Error('Work signature removal failed');
const names=[...source.matchAll(/CREATE FUNCTION ([a-z0-9_.]+)\(/g)].map(m=>m[1]).concat('public.crm_work_set_scoped_v2');
const literals=names.map(n=>`'${n}'`).join(',');
const ownerAcl=`DO $acl$ DECLARE f record; matched integer:=0; BEGIN
 FOR f IN SELECT p.oid,p.proname,p.proowner,p.proconfig,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname IN(${literals}) LOOP
 matched:=matched+1;
 IF f.proowner<>'postgres'::regrole OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN RAISE EXCEPTION 'Unexpected owner/config'; END IF;
 EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.oid::regprocedure);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.oid::regprocedure); END IF;
 IF has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE') IS DISTINCT FROM (f.nspname='public') THEN RAISE EXCEPTION 'ACL verification failed'; END IF;
 END LOOP;
 IF matched<>${names.length} THEN RAISE EXCEPTION 'ACL allowlist inventory mismatch'; END IF;
 IF to_regprocedure('${oldSignature}') IS NOT NULL THEN RAISE EXCEPTION 'Old actor signature remains'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='crm_security'::regnamespace AND c.relname IN('business_events','assignment_rules') AND (c.relowner<>'postgres'::regrole OR NOT c.relrowsecurity OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) THEN RAISE EXCEPTION 'Private table exposed'; END IF;
END $acl$;`;
const approval=s.approval;
const core=`BEGIN; SET LOCAL search_path=public,pg_catalog; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='60s';
DO $$ BEGIN IF current_user<>'postgres' OR current_setting('crm.v2_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR current_setting('crm.v2_approved',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Staging business approval required'; END IF;
IF to_regclass('crm_security.business_events') IS NOT NULL OR to_regnamespace('crm_business_archive') IS NOT NULL THEN RAISE EXCEPTION 'Existing business layer'; END IF; END $$;
${source}
DROP FUNCTION ${oldSignature} RESTRICT;
${newWork};
${ownerAcl}
COMMIT;`;
// Explicit synthetic-only assignment approvals. Source roles and existing ownership are not changed.
const approveBusiness=`BEGIN; DO $$ BEGIN IF current_user<>'postgres' OR current_setting('crm.v2_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' THEN RAISE EXCEPTION 'Staging only'; END IF; IF EXISTS(SELECT 1 FROM crm_security.assignment_rules) THEN RAISE EXCEPTION 'Rules already populated'; END IF; END $$;
UPDATE crm_security.object_scope SET can_write=true WHERE scope_id IN('${s.uid(10,4)}','${s.uid(10,6)}') AND inquiry_id='${s.uid(5,5)}' AND user_id IN('${s.uid(1,5)}','${s.uid(1,6)}');
${[5,6].flatMap(a=>['deal','inquiry'].flatMap(k=>[1,2,5,6].map(t=>`INSERT INTO crm_security.assignment_rules VALUES('${s.uid(1,a)}','${k}','${s.uid(k==='deal'?6:5,5)}','${s.uid(1,t)}',now()+interval '7 days');`))).join('\n')}
COMMIT;`;
async function setup(dataDir){const db=await s.setup(dataDir);await db.exec(s.migration);await db.exec(s.approvals());return db;}
async function hashes(db,p){p._guardHashes={};for(const k of sections){const expr=Array.isArray(p[k])?'(SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements($1::jsonb))':'$1::jsonb';p._guardHashes[k]=(await db.query(`SELECT md5((${expr})::text) h`,[JSON.stringify(p[k]??null)])).rows[0].h;}return p;}
function rollback(before,privateBefore,after,privateAfter,newFns){
 return approval+`BEGIN; SET LOCAL search_path=public,pg_catalog; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='60s';
DO $$ BEGIN IF current_user<>'postgres' OR current_setting('crm.v2_staging_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR current_setting('crm.v2_approved',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Staging rollback approval required'; END IF;
IF to_regnamespace('crm_business_archive') IS NOT NULL THEN RAISE EXCEPTION 'Archive already exists'; END IF; END $$;
${s.guard(after)}\n${s.guard(privateAfter,'crm_security')}
LOCK TABLE public.deals,public.inquiries,public.next_actions IN SHARE MODE;
LOCK TABLE crm_security.business_events,crm_security.assignment_rules IN ACCESS EXCLUSIVE MODE;
${newFns.map(f=>`DROP FUNCTION ${f.signature.startsWith('crm_security.')?'':'public.'}${f.signature} RESTRICT;`).join('\n')}
DROP FUNCTION public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer) RESTRICT;
${original.definition};
REVOKE EXECUTE ON FUNCTION ${oldSignature} FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION ${oldSignature} TO authenticated;
DO $archive$ BEGIN IF EXISTS(SELECT 1 FROM crm_security.business_events) OR EXISTS(SELECT 1 FROM crm_security.assignment_rules) THEN
 CREATE SCHEMA crm_business_archive AUTHORIZATION postgres; REVOKE ALL ON SCHEMA crm_business_archive FROM PUBLIC,anon,authenticated,service_role;
 ALTER TABLE crm_security.business_events SET SCHEMA crm_business_archive; ALTER TABLE crm_security.assignment_rules SET SCHEMA crm_business_archive;
 ELSE DROP TABLE crm_security.business_events RESTRICT; DROP TABLE crm_security.assignment_rules RESTRICT; END IF; END $archive$;
UPDATE crm_security.object_scope SET can_write=false WHERE scope_id IN('${s.uid(10,4)}','${s.uid(10,6)}') AND inquiry_id='${s.uid(5,5)}' AND user_id IN('${s.uid(1,5)}','${s.uid(1,6)}');
${s.guard(before)}\n${s.guard(privateBefore,'crm_security')}
COMMIT;`;
}
async function build(){const db=await setup();try{
 const before=await hashes(db,(await db.query(s.catalog())).rows[0].payload),privateBefore=await hashes(db,(await db.query(s.catalog('crm_security'))).rows[0].payload);
 await db.exec(core);
 const after=await hashes(db,(await db.query(s.catalog())).rows[0].payload),privateAfter=await hashes(db,(await db.query(s.catalog('crm_security'))).rows[0].payload);
 const newFns=[...after.functions.filter(f=>!before.functions.some(x=>x.signature===f.signature)&&!f.signature.startsWith('crm_work_set_scoped_v2')),...privateAfter.functions.filter(f=>!privateBefore.functions.some(x=>x.signature===f.signature))];
 const full=approval+core.replace('DO $$',()=>s.guard(before)+'\n'+s.guard(privateBefore,'crm_security')+'\nDO $$').replace('COMMIT;',()=>s.guard(after)+'\n'+s.guard(privateAfter,'crm_security')+'\nCOMMIT;');
 const files={'apply.sql':full,'rollback.sql':rollback(before,privateBefore,after,privateAfter,newFns),'approvals.sql':approval+approveBusiness,'expected-before.json':JSON.stringify(before,null,2),'expected-before-private.json':JSON.stringify(privateBefore,null,2),'expected-after.json':JSON.stringify(after,null,2),'expected-private.json':JSON.stringify(privateAfter,null,2),'allowlist.json':JSON.stringify(after.functions.filter(f=>f.signature.includes('_scoped_v2')).map(f=>({signature:f.signature,owner:f.owner,acl:f.acl,config:f.config})),null,2)};
 for(const [n,c] of Object.entries(files))fs.writeFileSync(path.join(out,n),c);fs.writeFileSync(migrationPath,full);
 console.log(JSON.stringify({newPublic:after.functions.length-before.functions.length,allowlistedV2:JSON.parse(files['allowlist.json']).length,newPrivateFunctions:privateAfter.functions.length-privateBefore.functions.length}));
}finally{await db.close();}}
if(require.main===module)build().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup,core,approval,approveBusiness,out,hashes,build};
