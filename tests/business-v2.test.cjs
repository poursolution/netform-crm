const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const b=require('../scripts/build-business-v2.cjs'),s=require('../scripts/crm-v2-stage.cjs');
async function model(){const db=await b.setup();await db.exec(fs.readFileSync(path.join(b.out,'apply.sql'),'utf8'));await db.exec(b.approveBusiness);return db;}
async function actor(db,i){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[s.mapping.accounts[i].auth_uid]);await db.exec('SET ROLE authenticated');}
async function rpc(db,name,args=[]){return (await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;}
async function reject(db,fn,code){await db.exec('SAVEPOINT denial');await assert.rejects(fn,e=>e.code===code);await db.exec('ROLLBACK TO denial');}
test('full new layer and rollback retain original v2 metadata and baseline',async()=>{const db=await b.setup();try{
 const before=(await db.query(s.catalog())).rows[0].payload,priv=(await db.query(s.catalog('crm_security'))).rows[0].payload;
 await db.exec(fs.readFileSync(path.join(b.out,'apply.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(b.out,'rollback.sql'),'utf8'));
 assert.deepEqual(s.normalize((await db.query(s.catalog())).rows[0].payload),s.normalize(before));assert.deepEqual(s.normalize((await db.query(s.catalog('crm_security'))).rows[0].payload),s.normalize(priv));
}finally{await db.close();}});
test('five screen read contracts, role separation and old actor signature removed',async()=>{const db=await model();try{
 for(let i=0;i<6;i++){await actor(db,i);const p=await rpc(db,'crm_profile_scoped_v2');assert.equal(p.auth_uid,s.mapping.accounts[i].auth_uid);
 const d=await rpc(db,'crm_deals_scoped_v2'),q=await rpc(db,'crm_inquiries_scoped_v2'),dash=await rpc(db,'crm_dashboard_scoped_v2'),today=await rpc(db,'crm_today_scoped_v2');
 assert.equal(d.coverage,'complete');assert.equal(dash.scope,'authorized_only');assert.equal(dash.company_coverage,'partial');
 assert.deepEqual(d.rows.map(x=>x.id),i===2?[]:i===1?[s.uid(6,2),s.uid(6,3)]:[s.uid(6,i>=4?5:i+1)]);
 assert.deepEqual(q.rows.map(x=>x.id),[s.uid(5,i>=4?5:i+1)]);if(i===2){assert.equal(dash.sales_status,'unavailable');assert.equal(dash.amount,null);}
 assert.ok(today.tasks.every(t=>(t.entity_kind==='deal'?d:q).rows.some(x=>x.id===t.object_id)));
 }
 await db.exec('RESET ROLE');assert.equal((await db.query("SELECT to_regprocedure('public.crm_work_set_scoped_v2(uuid,text,jsonb,text,integer,text)') p")).rows[0].p,null);
}finally{await db.close();}});
test('rep Pipeline amount/stage/work/activity/Next persist with version conflicts',async()=>{const db=await model();try{
 await actor(db,0);await db.exec('BEGIN');const id=s.uid(6,1);
 await reject(db,()=>rpc(db,'crm_deal_amount_scoped_v2',[s.uid(6,2),9,1,'TEST denied']),'42501');
 await rpc(db,'crm_deal_amount_scoped_v2',[id,777000,1,'TEST amount']);await reject(db,()=>rpc(db,'crm_deal_stage_scoped_v2',[id,'consulting',1,'TEST stale']),'PT409');
 await rpc(db,'crm_deal_stage_scoped_v2',[id,'consulting',2,'TEST stage']);
 await rpc(db,'crm_work_set_scoped_v2',[id,'TEST WORK',['TEST WORK'],'TEST work',3]);
 await rpc(db,'crm_activity_add_scoped_v2',['deal',id,'전화','TEST activity','4']);
 const na=await rpc(db,'crm_next_add_scoped_v2',['deal',id,'전화','TEST NEXT','2026-09-05T09:00:00Z','5']);
 await rpc(db,'crm_next_complete_scoped_v2',[na.id,'6']);
 const d=(await rpc(db,'crm_deals_scoped_v2')).rows[0];assert.equal(d.version,7);assert.equal(d.amount,'777000');assert.equal(d.stage_code,'consulting');
 await db.exec('COMMIT');
}finally{await db.close();}});
test('consultation response/status/Next/activity; sales and assignment denied',async()=>{const db=await model();try{
 await actor(db,2);const id=s.uid(5,3);let q=(await rpc(db,'crm_inquiries_scoped_v2')).rows[0];
 await rpc(db,'crm_inquiry_response_scoped_v2',[id,'TEST response',q.updated_at]);q=(await rpc(db,'crm_inquiries_scoped_v2')).rows[0];assert.ok(q.first_response_at);
 await rpc(db,'crm_inquiry_status_scoped_v2',[id,'응대중',q.updated_at,'TEST status']);q=(await rpc(db,'crm_inquiries_scoped_v2')).rows[0];
 await rpc(db,'crm_next_add_scoped_v2',['inquiry',id,'후속확인','TEST INQUIRY NEXT','2026-09-05T09:00:00Z',q.updated_at]);q=(await rpc(db,'crm_inquiries_scoped_v2')).rows[0];
 await rpc(db,'crm_activity_add_scoped_v2',['inquiry',id,'메모','TEST response memo',q.updated_at]);
 await db.exec('BEGIN');await reject(db,()=>rpc(db,'crm_deal_amount_scoped_v2',[s.uid(6,3),100,1,'TEST denied']),'42501');
 q=(await rpc(db,'crm_inquiries_scoped_v2')).rows[0];await reject(db,()=>rpc(db,'crm_assign_scoped_v2',['inquiry',id,s.uid(1,1),q.updated_at,'TEST assign denied']),'42501');await db.exec('ROLLBACK');
}finally{await db.close();}});
test('assignment separate rules and UUID ownership effect; rollback archives history without deleting business rows',async()=>{const db=await model();try{
 await actor(db,4);let q=(await rpc(db,'crm_inquiries_scoped_v2')).rows[0];
 const targets=await rpc(db,'crm_assignment_targets_scoped_v2',['inquiry',q.id]);assert.ok(targets.some(x=>x.user_id===s.uid(1,1)));
 await rpc(db,'crm_assign_scoped_v2',['inquiry',q.id,s.uid(1,1),q.updated_at,'TEST assign A']);
 await actor(db,0);assert.equal((await rpc(db,'crm_inquiries_scoped_v2')).rows.length,2);
 await db.exec('RESET ROLE');const rows=(await db.query('SELECT to_jsonb(i) r FROM public.inquiries i ORDER BY id')).rows;
 const audit=(await db.query('SELECT count(*)::int n FROM crm_security.audit_events')).rows[0].n;
 await db.exec(fs.readFileSync(path.join(b.out,'rollback.sql'),'utf8'));
 assert.deepEqual((await db.query('SELECT to_jsonb(i) r FROM public.inquiries i ORDER BY id')).rows,rows);
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_security.audit_events')).rows[0].n,audit);
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_business_archive.business_events')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,6);
}finally{await db.close();}});
test('new entry ACL allowlist, anon denied; helper remains private',async()=>{const db=await model();try{
 await db.exec('SET ROLE anon');await assert.rejects(rpc(db,'crm_deals_scoped_v2'),e=>e.code==='42501');await db.exec('RESET ROLE');
 const rows=(await db.query("SELECT proname,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated FROM pg_proc WHERE pronamespace='crm_security'::regnamespace")).rows;assert.ok(rows.every(x=>!x.anon&&!x.authenticated));
}finally{await db.close();}});
