'use strict';
const fs=require('node:fs'),path=require('node:path');
function sql(row,approved){const expected={...row,approved:!approved},target={...row,approved};return `BEGIN;
DO $guard$ BEGIN IF current_user<>'postgres' OR current_setting('crm.phase11_ref',true) IS DISTINCT FROM 'rprechiaglyjaydkmxsu' THEN RAISE EXCEPTION 'Staging only'; END IF;
IF NOT EXISTS(SELECT 1 FROM crm_security.access_review r WHERE to_jsonb(r)=$expected$${JSON.stringify(expected)}$expected$::jsonb)
THEN RAISE EXCEPTION 'Approval fixture drift'; END IF; END $guard$;
UPDATE crm_security.access_review SET approved=${approved} WHERE user_id='${row.user_id}' AND reviewed_auth_uid='${row.reviewed_auth_uid}';
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM crm_security.access_review r WHERE to_jsonb(r)=$expected$${JSON.stringify(target)}$expected$::jsonb) THEN RAISE EXCEPTION 'Fixture postcondition'; END IF; END $guard$;
COMMIT;`;} 
const prefix="SET crm.phase11_ref='rprechiaglyjaydkmxsu';\n";
async function main(){const s=require('./crm-phase1.cjs'),db=await s.setup();try{const row=(await db.query("SELECT to_jsonb(r) r FROM crm_security.access_review r WHERE user_id='f6090500-0001-4000-8000-000000000003'")).rows[0].r;await db.exec(prefix+sql(row,false));await db.exec(prefix+sql(row,true));const restored=(await db.query('SELECT to_jsonb(r) r FROM crm_security.access_review r WHERE user_id=$1',[row.user_id])).rows[0].r;require('node:assert/strict').deepEqual(row,restored);}finally{await db.close();}
 const dir=path.resolve(__dirname,'../sql/phase11'),row=JSON.parse(fs.readFileSync(path.join(dir,'consult-before.json'))).row;
 if(row.user_id!=='f6090500-0001-4000-8000-000000000003'||row.approved!==true)throw Error('Wrong synthetic fixture');
 fs.writeFileSync(path.join(dir,'consult-temporary-deny.sql'),prefix+sql(row,false));fs.writeFileSync(path.join(dir,'consult-restore.sql'),prefix+sql(row,true));console.log('Temporary denial + exact row restoration local PASS');}
if(require.main===module)main().catch(()=>{console.error('FIXTURE_LOCAL_FAIL');process.exitCode=1;});module.exports={sql};
