import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignWorker,createQueueClient} from '../server/aligo/campaign-worker.mjs';
import {AligoDispatcher} from '../server/aligo/dispatcher.mjs';
import {AligoError} from '../server/aligo/client.mjs';
const id='11111111-1111-4111-8111-111111111111',workerId='22222222-2222-4222-8222-222222222222',token='33333333-3333-4333-8333-333333333333';
const item=()=>({id,claim_token:token,receiver:'01000000000',message:'synthetic test',type:'SMS',status:'sending',provider_message_id:null});
function fixture({sendFailure=false,writeFailure=false,pending=[]}={}) {
 let sends=0,deliveries=0,claimed=false;
 const records=[];
 const provider={identity:'synthetic-provider',async send(){sends++;if(sendFailure)throw new AligoError('ALIGO_SEND_OUTCOME_UNKNOWN',true);return {status:'submitted',messageId:'123'};},
 async delivery(){deliveries++;return {status:'sent',messageId:'123'};}};
 const dispatcher=new AligoDispatcher(':memory:',provider);
 const queue={async call(name,p){
 if(name==='crm_sms_worker_pending_v1')return {contract_version:1,items:pending};
 if(name==='crm_sms_worker_claim_v1'){const items=claimed?[]:[item()];claimed=true;return {contract_version:1,items};}
 if(writeFailure){writeFailure=false;throw Error('database offline');}
 records.push(p);return {ok:true,recipient_id:p.p_recipient_id,status:p.p_status};
 }};
 const worker=new CampaignWorker({queue,dispatcher,provider,workerId,allowedReceivers:['01000000000'],liveEnabled:true});
 return {worker,dispatcher,records,pending,get sends(){return sends;},get deliveries(){return deliveries;}};
}
test('fresh claim submits once and subsequent polling records confirmed delivery',async()=>{
 const f=fixture();try{
 await f.worker.tick();assert.equal(f.sends,1);assert.equal(f.records[0].p_status,'submitted');
 f.pending.push({...item(),status:'submitted',provider_message_id:'123'});
 await f.worker.tick();assert.equal(f.sends,1);assert.equal(f.deliveries,1);assert.equal(f.records[1].p_status,'sent');
 }finally{f.dispatcher.close();}
});
test('database ACK failure after provider acceptance retries only the result write',async()=>{
 const f=fixture({writeFailure:true});try{
 await assert.rejects(f.worker.tick(),/database offline/);assert.equal(f.sends,1);
 f.pending.push(item());await f.worker.tick();assert.equal(f.sends,1);assert.equal(f.records[0].p_provider_message_id,'123');
 }finally{f.dispatcher.close();}
});
test('lost ledger for an existing server claim is quarantined without sending',async()=>{
 const f=fixture();try{
 const result=await f.worker.process(item(),false);
 assert.equal(result.status,'unknown');assert.equal(f.sends,0);assert.equal(f.records[0].p_error_code,'LOCAL_LEDGER_MISSING');
 }finally{f.dispatcher.close();}
});
test('ambiguous provider timeout never becomes a fresh retry',async()=>{
 const f=fixture({sendFailure:true});try{
 await f.worker.tick();assert.equal(f.records[0].p_status,'unknown');
 f.pending.push(item());await f.worker.tick();assert.equal(f.sends,1);assert.equal(f.records[1].p_status,'unknown');
 }finally{f.dispatcher.close();}
});
test('unapproved recipients, mismatched provider ID and disabled live mode fail closed',async()=>{
 const f=fixture();try{
 await assert.rejects(f.worker.process({...item(),receiver:'01011111111'},true),/INVALID_QUEUE_ITEM/);
 f.worker.provider={async delivery(){return {status:'sent',messageId:'999'};}};
 await assert.rejects(f.worker.process({...item(),status:'submitted',provider_message_id:'123'},false),/PROVIDER_RESULT_MISMATCH/);
 assert.equal(f.sends,0);assert.equal(f.records.length,0);
 assert.throws(()=>new CampaignWorker({workerId,allowedReceivers:['01000000000']}),/LIVE_WORKER_DISABLED/);
 }finally{f.dispatcher.close();}
});
test('empty allowlist and overlapping tick are blocked',async()=>{
 assert.throws(()=>new CampaignWorker({workerId,allowedReceivers:[],liveEnabled:true}),/ALLOWLIST/);
 const f=fixture();try{f.worker.running=true;await assert.rejects(f.worker.tick(),/ALREADY_RUNNING/);}finally{f.dispatcher.close();}
});
test('queue client pins HTTPS host, hides credential errors and supports secret API keys',async()=>{
 assert.throws(()=>createQueueClient({url:'http://example.com',key:'secret'}),/INVALID_QUEUE_URL/);
 let headers;
 const q=createQueueClient({url:'https://synthetic.supabase.co',key:'sb_secret_synthetic',fetchImpl:async(url,opt)=>{
 headers=opt.headers;return {ok:false,json:async()=>({error:'secret echoed'})};}});
 await assert.rejects(q.call('crm_sms_worker_pending_v1',{p_worker_id:workerId}),/^Error: QUEUE_REQUEST_FAILED$/);
 assert.equal(headers.apikey,'sb_secret_synthetic');assert.equal(headers.Authorization,undefined);
 await assert.rejects(q.call('unlisted_operation',{}),/INVALID_QUEUE_OPERATION/);
});
