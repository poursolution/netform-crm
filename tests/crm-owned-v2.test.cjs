'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {setup,catalog,guard,migration,approval,approvals,rollback,mapping,fixture,out,normalize,uid}=require('../scripts/crm-v2-stage.cjs');
async function model(){const db=await setup();const before=(await db.query(catalog())).rows[0].payload;await db.exec(migration);const after=(await db.query(catalog())).rows[0].payload,priv=(await db.query(catalog('crm_security'))).rows[0].payload;return {db,before,after,priv,rb:rollback(before,after,priv)};}
async function as(db,i,sql,args=[]){await db.exec('BEGIN');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[mapping.accounts[i].auth_uid]);await db.exec('SET LOCAL ROLE authenticated');return await db.query(sql,args);}finally{await db.exec('ROLLBACK');}}
const read='SELECT public.crm_read_scoped_v2() result';
test('new functions explicitly revoke before commit; managed creator untouched',()=>{
 assert.doesNotMatch(migration,/ALTER DEFAULT PRIVILEGES FOR ROLE (supabase_admin|pg_database_owner)|SET ROLE|GRANT .* TO postgres/);
 assert.equal((migration.match(/^REVOKE EXECUTE ON FUNCTION /gm)||[]).length,8);
 assert.match(migration,/POSTGRES_FUTURE_DEFAULT_PROBE_PASS/);
 assert.doesNotMatch(migration,/ALTER TABLE public|UPDATE public\.users|DROP COLUMN|CREATE POLICY/);
});
test('post-commit reconnect-equivalent rollback restores before metadata, CRM46, Auth6',async()=>{const {db,before,rb}=await model();try{
 await db.exec(approvals());await db.exec('RESET ALL');await db.exec(approval+rb);await db.exec('SET search_path=public,pg_catalog');
 assert.deepEqual(normalize((await db.query(catalog())).rows[0].payload),normalize(before));
 assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,6);
 assert.equal((await db.query("SELECT to_regnamespace('crm_security') n")).rows[0].n,null);
}finally{await db.close();}});
test('rollback preserves populated audit ledger in private archive',async()=>{const {db,rb}=await model();try{
 await db.exec(`INSERT INTO crm_security.audit_events(actor_auth_uid,actor_user_id,actor_name,deal_id,action,before_data,after_data,reason) VALUES('${mapping.accounts[0].auth_uid}','${uid(1,1)}','TEST AUDIT','${uid(6,1)}','local archive test','{}','{}','synthetic audit');`);
 await db.exec(rb);const r=(await db.query('SELECT actor_auth_uid,actor_user_id FROM crm_v2_archive.audit_events')).rows;
 assert.equal(r.length,1);assert.equal(r[0].actor_auth_uid,mapping.accounts[0].auth_uid);
 assert.equal((await db.query("SELECT has_schema_privilege('authenticated','crm_v2_archive','USAGE') access")).rows[0].access,false);
}finally{await db.close();}});
for(const [kind,sql] of Object.entries({acl:'GRANT EXECUTE ON FUNCTION public.crm_profile_scoped_v2() TO anon',config:"ALTER FUNCTION public.crm_profile_scoped_v2() SET search_path=public",extra:'CREATE TABLE crm_security.unexpected(id int)',owner:'ALTER TABLE crm_security.audit_events OWNER TO supabase_admin'}))test(`rollback fail-closed on ${kind} drift`,async()=>{const {db,rb}=await model();try{await db.exec(sql);await assert.rejects(db.exec(rb));await db.exec('ROLLBACK');assert.equal((await db.query('SELECT count(*)::int n FROM public.deals')).rows[0].n,5);}finally{await db.close();}});
test('anonymous and unapproved Auth identities denied',async()=>{const {db}=await model();try{
 await assert.rejects(as(db,0,'SELECT public.crm_profile_scoped_v2()'),e=>e.code==='42501');
 await db.exec('BEGIN; SET LOCAL ROLE anon');await assert.rejects(db.query('SELECT public.crm_profile_scoped_v2()'),e=>e.code==='42501');await db.exec('ROLLBACK');
}finally{await db.close();}});
test('six roles scoped: rep separation, consultation no deals, explicit branch/admin scopes',async()=>{const {db}=await model();try{await db.exec(approvals());
 for(let i=0;i<6;i++){const r=(await as(db,i,read)).rows[0].result;assert.deepEqual(r.deals.map(x=>x.id),i===2?[]:i===1?[uid(6,2),uid(6,3)]:[uid(6,i>=4?5:i+1)]);assert.deepEqual(r.inquiries.map(x=>x.id),[uid(5,i>=4?5:i+1)]);}
 await assert.rejects(as(db,0,'SELECT public.crm_read_scoped_v2(NULL,100,$1)',[uid(6,3)]),e=>e.code==='42501');
 await assert.rejects(as(db,1,'SELECT public.crm_contacts_scoped_v2($1)',[uid(6,1)]),e=>e.code==='42501');
}finally{await db.close();}});
for(const [kind,sql] of Object.entries({inactive:`UPDATE public.users SET active=false WHERE user_id='${uid(1,1)}'`,role:`UPDATE public.users SET role='viewer' WHERE user_id='${uid(1,1)}'`,expired:`UPDATE crm_security.access_review SET expires_at=now()-interval '1 day' WHERE user_id='${uid(1,1)}'`,missing:`UPDATE public.users SET auth_uid=NULL WHERE user_id='${uid(1,1)}'`,duplicate:`UPDATE public.users SET auth_uid='${mapping.accounts[0].auth_uid}' WHERE user_id='${uid(1,2)}'`}))test(`identity ${kind} denies authorization`,async()=>{const {db}=await model();try{await db.exec(approvals());await db.exec(sql);await assert.rejects(as(db,0,read),e=>e.code==='42501');}finally{await db.close();}});
test('write: owner allowed, actor spoof ignored, version conflict and foreign work denied',async()=>{const {db}=await model();try{await db.exec(approvals());
 const sql="SELECT public.crm_work_set_scoped_v2($1,'TEST WORK','[\"TEST WORK\"]','TEST synthetic write',1,'FORGED ADMIN') result";
 await assert.rejects(as(db,0,sql,[uid(6,2)]),e=>e.code==='42501');
 await assert.rejects(as(db,2,sql,[uid(6,3)]),e=>e.code==='42501');
 await db.exec('BEGIN');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[mapping.accounts[0].auth_uid]);await db.exec('SET LOCAL ROLE authenticated');
 const result=(await db.query(sql,[uid(6,1)])).rows[0].result;assert.equal(result.version,2);await db.exec('RESET ROLE');
 const actor=(await db.query('SELECT * FROM crm_security.audit_events WHERE event_id=$1',[result.audit_event_id])).rows[0];assert.equal(actor.actor_auth_uid,mapping.accounts[0].auth_uid);assert.equal(actor.actor_user_id,uid(1,1));assert.notEqual(actor.actor_name,'FORGED ADMIN');
 await db.exec('SAVEPOINT conflict; SET LOCAL ROLE authenticated');await assert.rejects(db.query(sql,[uid(6,1)]),e=>e.code==='PT409');await db.exec('ROLLBACK');
}finally{await db.close();}});
test('display-name change does not alter UUID authorization',async()=>{const {db}=await model();try{await db.exec(approvals());const before=(await as(db,0,read)).rows[0].result;await db.exec(`UPDATE public.users SET name='TEST RENAMED DISPLAY' WHERE user_id='${uid(1,1)}'`);assert.deepEqual((await as(db,0,read)).rows[0].result,before);}finally{await db.close();}});
test('generated full apply and rollback guards pass locally',async()=>{const db=await setup();try{await db.exec(fs.readFileSync(path.join(out,'staging-v2-apply.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(out,'v2-only-rollback.sql'),'utf8'));}finally{await db.close();}});
test('hash guards use explicit bytewise C collation, not host locale',()=>{const sql=fs.readFileSync(path.join(out,'staging-v2-apply.sql'),'utf8');assert.match(sql,/ORDER BY value::text COLLATE "C"/);assert.doesNotMatch(sql,/jsonb_agg\(value ORDER BY value::text\)/);});
for(const mutation of ['character','space'])test(`rollback rejects function body ${mutation} change`,async()=>{const {db,rb}=await model();try{
 const def=(await db.query("SELECT pg_get_functiondef('public.crm_profile_scoped_v2()'::regprocedure) d")).rows[0].d;
 await db.exec(def.replace("'forbidden'",mutation==='character'?"'Forbidden'":"'forbidden '"));
 await assert.rejects(db.exec(rb),/functions metadata drift/);await db.exec('ROLLBACK');
}finally{await db.close();}});
test('rollback preserves committed v2 business writes and audit without deleting seed rows',async()=>{const {db,rb}=await model();try{await db.exec(approvals());
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[mapping.accounts[0].auth_uid]);
 await db.query("SELECT public.crm_work_set_scoped_v2($1,'TEST WORK','[\"TEST WORK\"]','TEST rollback preservation',1,'FORGED')",[uid(6,1)]);
 const before=(await db.query('SELECT to_jsonb(d) row FROM public.deals d ORDER BY id')).rows;
 await db.exec(rb);assert.deepEqual((await db.query('SELECT to_jsonb(d) row FROM public.deals d ORDER BY id')).rows,before);
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_v2_archive.audit_events')).rows[0].n,1);
}finally{await db.close();}});
test('single-RPC conflict patch matches deployed before guard and preserves ACL',async()=>{const db=await setup();try{
 await db.exec(fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260905132335_crm_owned_v2_staging.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(out,'conflict-patch-apply.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(out,'v2-only-rollback.sql'),'utf8'));
}finally{await db.close();}});
test('v2 committed write → close persisted DB → reopen → rollback preserves data and audit',async()=>{
 const {PGlite}=require('../scripts/crm-v2-stage.cjs');
 const dataDir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'crm-v2-reconnect-'));
 let db=await setup(dataDir);try{
 const before=(await db.query(catalog())).rows[0].payload;
 await db.exec(fs.readFileSync(path.join(out,'staging-v2-apply.sql'),'utf8'));await db.exec(approvals());
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[mapping.accounts[0].auth_uid]);
 await db.query("SELECT public.crm_work_set_scoped_v2($1,'TEST PERSIST','[\"TEST PERSIST\"]','TEST durable audit',1,'FORGED')",[uid(6,1)]);
 const deal=(await db.query('SELECT to_jsonb(d) row FROM public.deals d ORDER BY id')).rows;
 await db.close();db=new PGlite(dataDir);
 const rb=fs.readFileSync(path.join(out,'v2-only-rollback.sql'),'utf8');
 await assert.rejects(db.exec(rb.replace(approval,'')),/approval required/);await db.exec('ROLLBACK');
 await db.exec(rb);await db.exec('SET search_path=public,pg_catalog');
 assert.deepEqual(normalize((await db.query(catalog())).rows[0].payload),normalize(before));
 assert.deepEqual((await db.query('SELECT to_jsonb(d) row FROM public.deals d ORDER BY id')).rows,deal);
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_v2_archive.audit_events')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,6);
 fs.writeFileSync(path.join(out,'rollback-local-result.json'),JSON.stringify({engine:'PGlite / PostgreSQL 17.5',realCloseReopen:true,postCommitRollback:true,publicMetadataDiff:[],CRM46Preserved:true,Auth6Preserved:true,committedBusinessWritePreserved:true,auditPreservedInPrivateArchive:true,hostedRollbackExecuted:false},null,2));
 }finally{await db.close();}
});
