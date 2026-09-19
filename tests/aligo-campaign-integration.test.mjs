import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
import {CampaignWorker,createQueueClient} from '../server/aligo/campaign-worker.mjs';
import {AligoDispatcher} from '../server/aligo/dispatcher.mjs';
import {createAligoClient} from '../server/aligo/client.mjs';

const migration=readFileSync(new URL('../supabase/migrations/20260919114702_aligo_campaign_worker.sql',import.meta.url),'utf8');
const receiver='01000000000',sender='01011111111';

// Real queue SQL, worker, SQLite dispatcher and provider parser; both HTTP boundaries
// are injected. This suite cannot contact Production or send a real message.
async function setup(t,{outcome='sent',scheduled=false}={}) {
 const db=new PGlite();
 t.after(()=>db.close());
 await db.exec(fixture);
 await db.exec('begin;'+migration+'commit;');
 const user=randomUUID(),auth=randomUUID(),deal=randomUUID(),contact=randomUUID();
 const campaign=randomUUID(),request=randomUUID(),workerId=randomUUID();
 await db.query("insert into public.users values($1,$2,'synthetic','admin',true)",[user,auth]);
 await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day')",[user,auth]);
 await db.query('insert into public.contacts values($1,$2,$3,$3)',[contact,'mobile:'+receiver,receiver]);
 await db.query('insert into public.deals values($1,null,$2,$3)',[deal,contact,'mobile:'+receiver]);
 await db.query("insert into crm_security.contact_compat_state values($1,$2,true,now()-interval '1 hour',false,null)",[contact,deal]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[auth]);
 const payload={campaign_id:campaign,category_key:'test',category_label:'test',category_group:'test',
  template_key:'custom',body:'Synthetic integration test',status:scheduled?'scheduled':'queued',
  scheduled_at:scheduled?new Date(Date.now()+3600000).toISOString():null,recipient_count:1,excluded_count:0,
  recipients:[{opportunity_id:deal,person_key:'mobile:'+receiver,phone:receiver,site_name:'test',
   contact_name:'test',owner:'test',personalized_body:'Synthetic integration test'}]};
 await db.exec('set role authenticated');
 const create=async()=>(await db.query("select public.crm_write_command_v2($1,'campaign_create',$2,0,$3) result",[request,campaign,payload])).rows[0].result;
 await create();
 assert.equal((await create()).replayed,true);
 await db.exec('reset role');
 let sends=0,queries=0,loseAck=false;
 const provider=createAligoClient({key:'synthetic',userId:'synthetic',sender,fetchImpl:async(url,options)=>{
  const fields=new URLSearchParams(options.body);
  if(url==='https://apis.aligo.in/send/') {
   sends++;
   assert.equal(fields.get('receiver'),receiver);
   assert.equal(fields.get('testmode_yn'),'N');
   // Campaign schedules are released by the DB, never submitted early to Aligo.
   assert.equal(fields.has('rdate'),false);
   if(outcome==='unknown')throw Error('Synthetic connection lost after submission');
   return {ok:true,json:async()=>({result_code:1,msg_id:'123',success_cnt:1,error_cnt:0})};
  }
  assert.equal(url,'https://apis.aligo.in/sms_list/');queries++;
  assert.equal(fields.get('mid'),'123');
  return {ok:true,json:async()=>({result_code:1,next_yn:'N',list:[{receiver,sender,mdid:'456',sms_state:outcome==='failed'?'전송실패':'발송완료'}]})};
 }});
 const queue=createQueueClient({url:'https://synthetic.supabase.co',key:'sb_secret_synthetic',fetchImpl:async(url,options)=>{
  const p=JSON.parse(options.body),name=url.split('/').at(-1);
  const calls={
   crm_sms_worker_pending_v1:['$1',[p.p_worker_id]],
   crm_sms_worker_claim_v1:['$1,$2,$3',[p.p_worker_id,p.p_allowed_receivers,p.p_limit]],
   crm_sms_worker_result_v1:['$1,$2,$3,$4,$5,$6',[p.p_worker_id,p.p_recipient_id,p.p_claim_token,p.p_status,p.p_provider_message_id,p.p_error_code]]
  };
  assert.ok(Object.hasOwn(calls,name));
  if(loseAck&&name==='crm_sms_worker_result_v1'){loseAck=false;throw Error('Synthetic database unavailable');}
  await db.exec('set role service_role');
  try {
   const [args,values]=calls[name];
   const data=(await db.query('select public.'+name+'('+args+') result',values)).rows[0].result;
   return {ok:true,json:async()=>data};
  } finally {await db.exec('reset role');}
 }});
 const dispatcher=new AligoDispatcher(':memory:',provider);
 t.after(()=>dispatcher.close());
 const worker=new CampaignWorker({queue,dispatcher,provider,workerId,allowedReceivers:[receiver],liveEnabled:true});
 const read=async()=>{
  await db.exec('set role authenticated');
  try{return (await db.query("select public.crm_operational_source_v1('campaign_core',null,100) result")).rows[0].result.items[0];}
  finally{await db.exec('reset role');}
 };
 const activities=async()=>(await db.query('select count(*)::int n from public.activities')).rows[0].n;
 return {db,worker,read,activities,get sends(){return sends;},get queries(){return queries;},
  failNextAck(){loseAck=true;},
  async releaseSchedule(){await db.query("update crm_security.sms_campaign_recipients set available_at=now()-interval '1 second' where campaign_id=$1",[campaign]);}
 };
}

test('campaign integration: immediate delivery returns confirmed totals and one activity without duplicate sending',async t=>{
 const f=await setup(t);
 await f.worker.tick();assert.equal((await f.read()).status,'submitted');assert.equal(await f.activities(),0);
 await f.worker.tick();await f.worker.tick();
 const result=await f.read();assert.equal(result.status,'sent');assert.equal(result.sent_count,1);
 assert.equal(f.sends,1);assert.equal(f.queries,1);assert.equal(await f.activities(),1);
});

test('campaign integration: future schedule remains untouched until eligible, then delivers once',async t=>{
 const f=await setup(t,{scheduled:true});
 await f.worker.tick();assert.equal(f.sends,0);assert.equal((await f.read()).status,'scheduled');
 await f.releaseSchedule();await f.worker.tick();await f.worker.tick();
 assert.equal(f.sends,1);assert.equal((await f.read()).sent_count,1);assert.equal(await f.activities(),1);
});

test('campaign integration: provider failure reaches CRM without a successful-contact activity',async t=>{
 const f=await setup(t,{outcome:'failed'});
 await f.worker.tick();await f.worker.tick();await f.worker.tick();
 const result=await f.read();assert.equal(result.status,'failed');assert.equal(result.failed_count,1);
 assert.equal(result.sent_count,0);assert.equal(f.sends,1);assert.equal(await f.activities(),0);
});

test('campaign integration: uncertain provider outcome is quarantined and never resent',async t=>{
 const f=await setup(t,{outcome:'unknown'});
 await f.worker.tick();await f.worker.tick();await f.worker.tick();
 assert.equal((await f.read()).status,'unknown');assert.equal(f.sends,1);assert.equal(f.queries,0);
 assert.equal(await f.activities(),0);
});

test('campaign integration: DB failure after provider acceptance recovers the saved message ID without resending',async t=>{
 const f=await setup(t);f.failNextAck();
 await assert.rejects(f.worker.tick(),/QUEUE_REQUEST_FAILED/);
 assert.equal(f.sends,1);
 await f.worker.tick();await f.worker.tick();
 assert.equal((await f.read()).status,'sent');assert.equal(f.sends,1);assert.equal(await f.activities(),1);
});

test('campaign integration: consent withdrawn after scheduling prevents the provider call',async t=>{
 const f=await setup(t,{scheduled:true});
 await f.db.exec('update crm_security.contact_compat_state set send_blocked=true');
 await f.releaseSchedule();await f.worker.tick();
 assert.equal(f.sends,0);assert.equal(await f.activities(),0);
 assert.equal((await f.db.query('select attempt_count from crm_security.sms_campaign_recipients')).rows[0].attempt_count,0);
});
