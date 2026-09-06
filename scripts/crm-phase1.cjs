'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const s=require('./crm-v2-stage.cjs');
const dir=path.resolve(__dirname,'../sql/phase1');
const migration=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260905143119_crm_phase1_transport.sql'),'utf8');
const approval="SET crm.phase1_ref='rprechiaglyjaydkmxsu';\n";
async function setup(dataDir){const db=await s.setup(dataDir);await db.exec(s.migration);await db.exec(s.approvals());return db;}
async function capture(db){const result={public:(await db.query(s.catalog())).rows[0].payload,private:(await db.query(s.catalog('crm_security'))).rows[0].payload};
 for(const p of Object.values(result)){p._guardHashes={};for(const [k,v] of Object.entries(p)){if(k==='_guardHashes')continue;const expr=Array.isArray(v)?'(SELECT jsonb_agg(value ORDER BY value::text COLLATE "C") FROM jsonb_array_elements($1::jsonb))':'$1::jsonb';p._guardHashes[k]=(await db.query(`SELECT md5((${expr})::text) h`,[JSON.stringify(v)])).rows[0].h;}}return result;}
function rollback(before,after,profile){return `${approval}BEGIN; SET LOCAL search_path=public,pg_catalog;
DO $$ BEGIN IF current_user<>'postgres' OR current_setting('crm.phase1_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' OR to_regnamespace('crm_phase1_archive') IS NOT NULL THEN RAISE EXCEPTION 'Phase 1 rollback preflight'; END IF; END $$;
${s.guard(after.public)}\n${s.guard(after.private,'crm_security')}
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
DROP FUNCTION public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) RESTRICT;
${profile.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION')};
-- Retain populated idempotency evidence. Never delete original v2 audit or business rows.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM crm_security.command_receipts) THEN
 CREATE SCHEMA crm_phase1_archive AUTHORIZATION postgres;
 REVOKE ALL ON SCHEMA crm_phase1_archive FROM PUBLIC,anon,authenticated,service_role;
 ALTER TABLE crm_security.command_receipts SET SCHEMA crm_phase1_archive;
ELSE DROP TABLE crm_security.command_receipts RESTRICT; END IF; END $$;
${s.guard(before.public)}\n${s.guard(before.private,'crm_security')}
COMMIT;`;}
async function build(){const db=await setup();try{
 const before=await capture(db),profile=(await db.query("SELECT pg_get_functiondef('public.crm_profile_scoped_v2()'::regprocedure) d")).rows[0].d;
 await db.exec(approval+migration);const after=await capture(db);
 const apply=approval+migration.replace('DO $$ BEGIN',()=>s.guard(before.public)+'\n'+s.guard(before.private,'crm_security')+'\nDO $$ BEGIN').replace('COMMIT;',()=>s.guard(after.public)+'\n'+s.guard(after.private,'crm_security')+'\nCOMMIT;');
 fs.mkdirSync(dir,{recursive:true});
 for(const [name,value] of Object.entries({'before.json':JSON.stringify(before,null,2),'after.json':JSON.stringify(after,null,2),'staging-apply.sql':apply,'rollback.sql':rollback(before,after,profile),'capture-public.sql':s.catalog(),'capture-private.sql':s.catalog('crm_security')}))fs.writeFileSync(path.join(dir,name),value);
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({project_ref:'rprechiaglyjaydkmxsu',apply_sha256:crypto.createHash('sha256').update(apply).digest('hex'),status:'LOCAL_CANDIDATE_NOT_APPLIED'},null,2));
 return {before,after,profile};
 }finally{await db.close();}}
if(require.main===module)build().then(()=>console.log('Phase 1 guarded candidate and evidence-preserving rollback generated.')).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={...s,setup,capture,migration,approval,rollback,build,dir};
