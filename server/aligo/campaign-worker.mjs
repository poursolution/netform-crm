import {AligoError} from './client.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class QueueError extends Error {constructor(code){super(code);this.code=code;}}

export function createQueueClient({url,key,fetchImpl=fetch}) {
 const target=new URL(url);
 if(target.protocol!=='https:'||!/^[a-z0-9]+\.supabase\.co$/.test(target.hostname)||target.port||target.pathname!=='/'||target.search||target.hash)
  throw new QueueError('INVALID_QUEUE_URL');
 if(typeof key!=='string'||!key)throw new QueueError('QUEUE_CREDENTIAL_REQUIRED');
 // sb_secret keys belong only in apikey, while legacy service-role JWTs also use Authorization.
 const headers={'Content-Type':'application/json',apikey:key};
 if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 return Object.freeze({async call(name,payload){
  if(!['crm_sms_worker_claim_v1','crm_sms_worker_pending_v1','crm_sms_worker_result_v1'].includes(name))
   throw new QueueError('INVALID_QUEUE_OPERATION');
  try {
   const r=await fetchImpl(target.origin+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error('request failed');
   const data=await r.json();
   if(!data||typeof data!=='object')throw new Error('invalid result');
   return data;
  }catch{throw new QueueError('QUEUE_REQUEST_FAILED');}
 }});
}

export class CampaignWorker {
 constructor({queue,dispatcher,provider,workerId,allowedReceivers,liveEnabled=false}) {
  if(!liveEnabled)throw new QueueError('LIVE_WORKER_DISABLED');
  if(!UUID.test(workerId))throw new QueueError('INVALID_WORKER_ID');
  if(!Array.isArray(allowedReceivers)||!allowedReceivers.length||allowedReceivers.length>500||
     allowedReceivers.some(x=>!/^010\d{8}$/.test(x)))throw new QueueError('EXPLICIT_RECEIVER_ALLOWLIST_REQUIRED');
  Object.assign(this,{queue,dispatcher,provider,workerId,allowedReceivers:[...new Set(allowedReceivers)]});
  this.running=false;
 }
 validate(item) {
  if(!item||!UUID.test(item.id)||!UUID.test(item.claim_token)||!this.allowedReceivers.includes(item.receiver)||
     typeof item.message!=='string'||!item.message.trim()||!['SMS','LMS'].includes(item.type)||
     !['sending','submitted','unknown'].includes(item.status)||
     item.provider_message_id!=null&&!/^[1-9]\d{0,19}$/.test(item.provider_message_id))
    throw new QueueError('INVALID_QUEUE_ITEM');
  return {receiver:item.receiver,message:item.message,type:item.type,mode:'live'};
 }
 async record(item,result) {
  const data=await this.queue.call('crm_sms_worker_result_v1',{
   p_worker_id:this.workerId,p_recipient_id:item.id,p_claim_token:item.claim_token,
   p_status:result.status,p_provider_message_id:result.messageId||null,p_error_code:result.errorCode||null
  });
  if(data.ok!==true||data.recipient_id!==item.id||data.status!==result.status)throw new QueueError('QUEUE_ACK_MISMATCH');
  return {id:item.id,status:result.status};
 }
 async process(item,fresh) {
  const job=this.validate(item);
  if(item.status==='unknown')return {id:item.id,status:'unknown'};
  if(item.status==='submitted') {
   if(!item.provider_message_id)throw new QueueError('SUBMITTED_ID_REQUIRED');
   const outcome=await this.provider.delivery({messageId:item.provider_message_id,receiver:item.receiver});
   if(!['submitted','sent','failed'].includes(outcome.status)||outcome.messageId!==item.provider_message_id)
    throw new QueueError('PROVIDER_RESULT_MISMATCH');
   return this.record(item,{status:outcome.status,messageId:outcome.messageId});
  }
  // A server claim without our local ledger may have been sent by a lost process.
  // Never manufacture a new dispatch after restart to "recover" an uncertain request.
  if(!fresh&&!this.dispatcher.row(item.id))return this.record(item,{status:'unknown',errorCode:'LOCAL_LEDGER_MISSING'});
  const outcome=await this.dispatcher.dispatch(item.id,job);
  if(!['submitted','sent','failed','unknown'].includes(outcome.status))throw new QueueError('INVALID_DISPATCH_RESULT');
  return this.record(item,outcome);
 }
 async batch(name,params,fresh) {
  const data=await this.queue.call(name,{p_worker_id:this.workerId,...params});
  if(data.contract_version!==1||!Array.isArray(data.items)||data.items.length>500)throw new QueueError('QUEUE_CONTRACT_MISMATCH');
  const seen=new Set(),results=[];
  for(const item of data.items){
   this.validate(item);
   if(seen.has(item.id))throw new QueueError('DUPLICATE_QUEUE_ITEM');seen.add(item.id);
  }
  for(const item of data.items)results.push(await this.process(item,fresh));
  return results;
 }
 async tick() {
  if(this.running)throw new QueueError('WORKER_ALREADY_RUNNING');
  this.running=true;
  try {
   const pending=await this.batch('crm_sms_worker_pending_v1',{},false);
   const claimed=await this.batch('crm_sms_worker_claim_v1',{p_allowed_receivers:this.allowedReceivers,p_limit:10},true);
   return {pending,claimed};
  }finally{this.running=false;}
 }
}
