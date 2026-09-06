'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const s=require('../scripts/crm-phase1.cjs');
const request='f6090500-0011-4000-8000-000000000001';
async function as(db,n,sql,args=[]){await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${s.mapping.accounts[n-1].auth_uid}';`);try{return await db.query(sql,args);}finally{await db.exec('RESET ROLE;');}}
const payload={primary_work:'TEST PHASE1 WORK',work_items:['TEST PHASE1 WORK'],reason:'TEST PHASE1 idempotency verification'};
test('exact generated guarded apply and rollback scripts execute',async()=>{await s.build();const fs=require('node:fs'),path=require('node:path'),db=await s.setup();try{await db.exec(fs.readFileSync(path.join(s.dir,'staging-apply.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(s.dir,'rollback.sql'),'utf8'));}finally{await db.close();}});
test('post-COMMIT rollback works after closing and reopening the database',async()=>{const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'crm-phase1-rollback-'));let db=await s.setup(temp);try{await db.exec(fs.readFileSync(path.join(s.dir,'staging-apply.sql'),'utf8'));await db.close();db=new s.PGlite(temp);await db.exec(fs.readFileSync(path.join(s.dir,'rollback.sql'),'utf8'));assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,6);}finally{await db.close();/* Evidence directory intentionally retained; no recursive deletion. */}});
async function command(db,n=1,id=request,body=payload,version=1,target=s.uid(6,1)){return (await as(db,n,'SELECT public.crm_write_command_v2($1,$2,$3,$4,$5) a',[id,'opportunity_work_set',target,version,JSON.stringify(body)])).rows[0].a;}
test('Phase 1 database authorization, ACK and rollback',async t=>{
 const db=await s.setup();try{
 const before=await s.capture(db),profile=(await db.query("SELECT pg_get_functiondef('public.crm_profile_scoped_v2()'::regprocedure) d")).rows[0].d;
 await db.exec(s.approval+s.migration);const after=await s.capture(db);
 await t.test('six profile UUID/source/permission/mode mappings',async()=>{for(let n=1;n<=6;n++){const p=(await as(db,n,'SELECT public.crm_profile_scoped_v2() p')).rows[0].p;assert.equal(p.auth_uid,s.mapping.accounts[n-1].auth_uid);assert.equal(p.user_id,s.uid(1,n));assert.equal(p.source_role,['rep','rep','viewer','rep','admin','admin'][n-1]);assert.deepEqual(p.allowed_modes,n>=5?['rep','admin']:['rep']);}});
 await t.test('anon cannot call wrapper',async()=>{await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT public.crm_write_command_v2(NULL,NULL,NULL,NULL,NULL)'),{code:'42501'});await db.exec('RESET ROLE');});
 await t.test('wrong owner and consultation writes rejected',async()=>{await assert.rejects(command(db,2),{code:'42501'});await assert.rejects(command(db,3),{code:'42501'});});
 await t.test('client actor rejected',async()=>{await assert.rejects(command(db,1,request,{...payload,actor_name:'forged'}),{code:'22023'});});
 let ack;
 await t.test('server ACK version and audit UUID',async()=>{ack=await command(db);assert.equal(ack.ok,true);assert.equal(ack.actor_auth_uid,s.mapping.accounts[0].auth_uid);assert.equal(ack.actor_user_id,s.uid(1,1));assert.equal(ack.version,2);assert.ok(ack.audit_event_id);});
 await t.test('same request replays without another write/audit',async()=>{const replay=await command(db);assert.equal(replay.replayed,true);assert.equal(replay.audit_event_id,ack.audit_event_id);assert.equal((await db.query('SELECT count(*)::int n FROM crm_security.audit_events')).rows[0].n,1);});
 await t.test('same key different payload conflicts',async()=>{await assert.rejects(command(db,1,request,{...payload,reason:'TEST different request'}),{code:'PT409'});});
 await t.test('new request stale version conflicts',async()=>{await assert.rejects(command(db,1,'f6090500-0011-4000-8000-000000000002'),{code:'PT409'});});
 await t.test('replay after approval revocation fails closed',async()=>{await db.query('UPDATE crm_security.access_review SET approved=false WHERE user_id=$1',[s.uid(1,1)]);await assert.rejects(command(db),{code:'42501'});await db.query('UPDATE crm_security.access_review SET approved=true WHERE user_id=$1',[s.uid(1,1)]);});
 await t.test('post-commit rollback restores catalogs and retains CRM/Auth/audit/receipts',async()=>{
 const rows={};for(const table of Object.keys(s.fixture.rows))rows[table]=(await db.query(`SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text COLLATE "C") d FROM public.${table} t`)).rows[0].d;
 await db.exec(s.rollback(before,after,profile));assert.deepEqual(s.normalize((await s.capture(db)).public),s.normalize(before.public));
 for(const table of Object.keys(rows))assert.deepEqual((await db.query(`SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text COLLATE "C") d FROM public.${table} t`)).rows[0].d,rows[table]);
 assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,6);
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_security.audit_events')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_phase1_archive.command_receipts')).rows[0].n,1);
 });
 }finally{await db.close();}
});
