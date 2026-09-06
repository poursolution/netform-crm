'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const s=require('./crm-phase1.cjs');
const dir=path.resolve(__dirname,'../sql/work-compat/20260906');
const migration=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260905220648_crm_work_compat_dispatcher.sql'),'utf8');
const approval="SET crm.work_compat_ref='rprechiaglyjaydkmxsu';\n";
async function setup(dataDir){const db=await s.setup(dataDir);await db.exec(s.approval+s.migration);return db;}
async function capture(db){await db.exec('SET search_path=pg_catalog');return s.capture(db);}
function guards(snapshot){return s.guard(snapshot.public)+'\n'+s.guard(snapshot.private,'crm_security');}
function rollback(before,after,previous){return `${approval}BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN IF current_user<>'postgres' OR current_setting('crm.work_compat_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' THEN RAISE EXCEPTION 'Staging work compatibility rollback approval required'; END IF; END $$;
${guards(after)}
LOCK TABLE crm_security.command_receipts IN ACCESS EXCLUSIVE MODE;
${previous};
${guards(before)}
COMMIT;`;}
async function build(){const db=await setup();try{
 const before=await capture(db),previous=(await db.query("SELECT pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure) d")).rows[0].d;
 await db.exec(approval+migration);const after=await capture(db);
 const apply=approval+migration.replace('-- BEFORE_METADATA_GUARD',guards(before)).replace('-- AFTER_METADATA_GUARD',guards(after));
 const undo=rollback(before,after,previous);
 fs.mkdirSync(dir,{recursive:true});
 const files={'before.json':JSON.stringify(before,null,2),'after.json':JSON.stringify(after,null,2),'staging-apply.sql':apply,'rollback.sql':undo,'capture-public.sql':s.catalog(),'capture-private.sql':s.catalog('crm_security')};
 for(const [name,value] of Object.entries(files))fs.writeFileSync(path.join(dir,name),value);
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({project_ref:'rprechiaglyjaydkmxsu',migration:'supabase/migrations/20260905220648_crm_work_compat_dispatcher.sql',apply_sha256:crypto.createHash('sha256').update(apply).digest('hex'),rollback_sha256:crypto.createHash('sha256').update(undo).digest('hex'),status:'LOCAL_CANDIDATE_NOT_APPLIED'},null,2));
 }finally{await db.close();}}
if(require.main===module)build().then(()=>console.log('Work compatibility guarded apply and rollback generated locally.')).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={setup,capture,migration,approval,rollback,build,dir};
