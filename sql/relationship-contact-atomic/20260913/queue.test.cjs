'use strict';
// Current Production transport code, synthetic SDK/fetch and isolated in-memory Postgres only.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..');
const {JSDOM}=createRequire(path.resolve(root,'../crm-security-lab/package.json'))('jsdom');
const bundle=require('../../operational-bundle/20260906/build.cjs'),s=require('../../../scripts/crm-phase1.cjs');
const base=require('../../../operational-adapter.js'),candidate=require('./client.candidate.js');
const id=n=>`f6091300-0044-4000-8000-${String(n).padStart(12,'0')}`;
test('current persisted queue and local database support atomic contact without transport changes',async t=>{
 const db=await bundle.setup(),dom=new JSDOM('',{url:'http://127.0.0.1:4179',runScripts:'outside-only'}),w=dom.window;
 try{
  await db.exec(bundle.approval+bundle.compose());
  await db.exec("SET crm.pipeline_action_ref='rprechiaglyjaydkmxsu';"+fs.readFileSync(path.resolve(__dirname,'../../pipeline-action-bundle/20260906/candidate.sql'),'utf8'));
  await db.exec("SET crm.relationship_contact_lab='local-only';"+fs.readFileSync(path.join(__dirname,'helper.local.sql'),'utf8'));
  const beforeDispatcher=(await db.query("SELECT oid,prosrc,proacl::text acl,md5(pg_get_functiondef(oid)) hash FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0];
  await db.query("SELECT set_config('crm.relationship_contact_dispatcher_md5',$1,false)",[beforeDispatcher.hash]);
  await db.exec(fs.readFileSync(path.join(__dirname,'dispatcher.local.sql'),'utf8'));
  const auth=s.mapping.accounts[0].auth_uid,user=s.uid(1,1),deal=s.uid(6,1);
  await db.query("UPDATE public.deals SET stage_code='rapport' WHERE id=$1",[deal]);
  await db.exec(`SET request.jwt.claim.sub='${auth}';`);
  const session={user:{id:auth},access_token:'SYNTHETIC_NOT_A_CREDENTIAL'},sent=[];
  let drop=false,forge=false;
  w.PHASE1_CONFIG={project_ref:'ymfbmpnizxvqsamnczow',url:'https://ymfbmpnizxvqsamnczow.supabase.co',publishable_key:'TEST_PUBLIC',accounts:[]};
  w.AbortController=AbortController;w.BroadcastChannel=undefined;
  w.OperationalAdapter=candidate.extendAdapter(base);
  w.supabase={createClient(){return {auth:{getSession:async()=>({data:{session}}),onAuthStateChange(){},signOut:async()=>{}},channel(){return {on(){return this},subscribe(){return this},unsubscribe:async()=>{}}},rpc(){}}}};
  w.fetch=async(url,init)=>{
   const name=new URL(url).pathname.split('/').at(-1),args=JSON.parse(init.body);
   if(name==='crm_profile_scoped_v2')return {ok:true,status:200,json:async()=>({contract_version:2,auth_uid:auth,user_id:user,source_role:'rep',permission_role:'rep',allowed_modes:['rep']})};
   assert.equal(name,'crm_write_command_v2');assert.equal(args.p_operation,'relationship_contact');sent.push(args);
   let result;
   try{await db.exec('SET ROLE authenticated');result=(await db.query('SELECT public.crm_write_command_v2($1,$2,$3,$4,$5) a',[args.p_request_id,args.p_operation,args.p_object_id,args.p_expected_version,JSON.stringify(args.p_payload)])).rows[0].a;}
   catch(e){return {ok:false,status:e.code==='PT409'?409:e.code==='42501'?403:400,json:async()=>({code:e.code,message:e.message})};}
   finally{await db.exec('RESET ROLE');}
   if(drop){drop=false;throw Error('TEST_ACK_LOST_AFTER_COMMIT');}
   if(forge)result={...result,actor_auth_uid:id(900)};
   return {ok:true,status:200,json:async()=>result};
  };
  w.eval(fs.readFileSync(path.join(root,'transport.js'),'utf8'));
  const p=w.Phase1;p.createClient(w.PHASE1_CONFIG.url,w.PHASE1_CONFIG.publishable_key);await p.admit(session);
  const payload={activity:{type:'전화',note:'통화 완료',result:'다음 주 확인',occurred_at:'2026-09-13T01:00:00Z',meaningful_contact:true},next_action:{type:'전화',text:'일정 확인',due_at:'2026-09-20'}};
  await t.test('lost ACK keeps queue uncertain; retry returns same IDs without duplicate rows',async()=>{
   const q=p.queue.enqueue('relationship_contact',deal,1,payload,id(1));drop=true;
   await assert.rejects(p.queue.flush(),/ACK_LOST/);assert.equal(p.queue.list()[0].status,'uncertain');
   const before=(await db.query('SELECT (SELECT count(*) FROM public.activities)::int activities,(SELECT count(*) FROM public.next_actions)::int actions')).rows[0];
   await p.queue.flush();const row=p.queue.list()[0];assert.equal(row.status,'done');assert.equal(row.ack.replayed,true);assert.equal(row.ack.version,3);assert.equal(row.request_id,q.request_id);
   assert.equal(sent[0].p_request_id,sent[1].p_request_id);assert.deepEqual(sent[0].p_payload,sent[1].p_payload);
   assert.deepEqual((await db.query('SELECT (SELECT count(*) FROM public.activities)::int activities,(SELECT count(*) FROM public.next_actions)::int actions')).rows[0],before);
  });
  await t.test('wrong-actor ACK stays uncertain and valid replay recovers',async()=>{
   p.queue.enqueue('relationship_contact',deal,3,payload,id(2));forge=true;
   await assert.rejects(p.queue.flush(),/ACK_CONTRACT/);assert.equal(p.queue.list()[1].status,'uncertain');
   forge=false;await p.queue.flush();assert.equal(p.queue.list()[1].status,'done');assert.equal(p.queue.list()[1].ack.version,5);
  });
  await t.test('stale second edit becomes conflict, not success or automatic retry',async()=>{
   p.queue.enqueue('relationship_contact',deal,3,payload,id(3));await assert.rejects(p.queue.flush(),/version conflict/);
   assert.equal(p.queue.list()[2].status,'conflict');const n=sent.length;await p.queue.flush();assert.equal(sent.length,n);
  });
  await t.test('pending transmission restored as uncertain; new auth clears account queue',async()=>{
   const rows=p.queue.list();rows[0].status='sending';p.storage.setItem('command-queue',JSON.stringify(rows));
   w.dispatchEvent(new w.Event('phase1:profile'));assert.equal(p.queue.list()[0].status,'uncertain');
   await p.signOut();assert.equal(p.queue.list().length,0);
  });
  assert.equal(base.operations.includes('relationship_contact'),false);
  await t.test('public access stays authenticated-only; private helpers cannot be called directly',async()=>{
   for(const role of ['anon','service_role'])assert.equal((await db.query("SELECT has_function_privilege($1,'public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);
   assert.equal((await db.query("SELECT has_function_privilege('authenticated','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','EXECUTE') allowed")).rows[0].allowed,true);
   for(const fn of ['crm_relationship_contact_candidate(uuid,uuid,integer,jsonb)','crm_write_command_v2_before_relationship_contact_candidate(uuid,text,uuid,integer,jsonb)'])assert.equal((await db.query("SELECT has_function_privilege('authenticated',$1,'EXECUTE') allowed",['crm_security.'+fn])).rows[0].allowed,false);
  });
  await t.test('rollback restores original dispatcher OID/definition/ACL and preserves saved evidence',async()=>{
   const evidence=async()=> (await db.query('SELECT (SELECT count(*) FROM public.activities)::int activities,(SELECT count(*) FROM public.next_actions)::int actions,(SELECT count(*) FROM crm_security.audit_events)::int audit,(SELECT count(*) FROM crm_security.command_receipts)::int receipts')).rows[0];
   const before=await evidence();
   const hash=(await db.query("SELECT md5(pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure)) hash")).rows[0].hash;
   await db.query("SELECT set_config('crm.relationship_contact_rollback_md5',$1,false)",[hash]);
   await db.exec(fs.readFileSync(path.join(__dirname,'rollback.local.sql'),'utf8'));
   assert.deepEqual((await db.query("SELECT oid,prosrc,proacl::text acl,md5(pg_get_functiondef(oid)) hash FROM pg_proc WHERE oid='public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure")).rows[0],beforeDispatcher);
   assert.deepEqual(await evidence(),before);
  });
 }finally{dom.window.close();await db.close();}
});
