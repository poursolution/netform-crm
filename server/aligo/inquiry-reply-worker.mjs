/* 견적문의 응대 문자 실행기 (2026-10-03): CRM 상세 창에서 [CRM에서 보내기]로 요청한 문자(inquiry_sms_requests)를 알리고로 보낸다.
   캠페인 실행기(CampaignWorker)와 같은 공급자 · 같은 로컬 원장(dispatcher) · 같은 결과 규약을 쓰되, 큐 함수만 *_inquiry_v1 이다.
   받는 번호는 서버가 문의의 휴대폰(010)으로만 채운 값 — 허용 목록 대신 번호 형식과 서버 claim(승인된 요청자 · 24시간 이내)이 지킨다.
   켜기: ALIGO_INQUIRY_REPLIES=true (run-campaign-worker.mjs). 끄면 큐만 쌓이고 보내지 않는다. */
import {QueueError} from './campaign-worker.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const INQUIRY_QUEUE_OPERATIONS=['crm_sms_worker_claim_inquiry_v1','crm_sms_worker_pending_inquiry_v1','crm_sms_worker_result_inquiry_v1'];
export class InquiryReplyWorker {
 constructor({queue,dispatcher,provider,workerId,enabled=false}) {
  if(!enabled)throw new QueueError('INQUIRY_REPLY_WORKER_DISABLED');
  if(!UUID.test(workerId))throw new QueueError('INVALID_WORKER_ID');
  Object.assign(this,{queue,dispatcher,provider,workerId});this.running=false;
 }
 validate(item) {
  if(!item||!UUID.test(item.id)||!UUID.test(item.claim_token)||!/^010\d{8}$/.test(String(item.receiver||''))||
     typeof item.message!=='string'||!item.message.trim()||item.message.length>2000||!['SMS','LMS'].includes(item.type)||
     !['sending','submitted','unknown'].includes(item.status)||
     item.provider_message_id!=null&&!/^[1-9]\d{0,19}$/.test(item.provider_message_id))
   throw new QueueError('INVALID_QUEUE_ITEM');
  return {receiver:item.receiver,message:item.message,type:item.type,mode:'live'};
 }
 async record(item,result) {
  const data=await this.queue.call('crm_sms_worker_result_inquiry_v1',{
   p_worker_id:this.workerId,p_request_id:item.id,p_claim_token:item.claim_token,
   p_status:result.status,p_provider_message_id:result.messageId||null,p_error_code:result.errorCode||null});
  if(data.ok!==true||data.request_id!==item.id||data.status!==result.status)throw new QueueError('QUEUE_ACK_MISMATCH');
  return {id:item.id,status:result.status};
 }
 async process(item,fresh) {
  const job=this.validate(item);
  if(item.status==='unknown')return {id:item.id,status:'unknown'};
  if(item.status==='submitted') {
   if(!item.provider_message_id)throw new QueueError('SUBMITTED_ID_REQUIRED');
   const outcome=await this.provider.delivery({messageId:item.provider_message_id,receiver:item.receiver});
   if(!['submitted','sent','failed'].includes(outcome.status)||outcome.messageId!==item.provider_message_id)throw new QueueError('PROVIDER_RESULT_MISMATCH');
   return this.record(item,{status:outcome.status,messageId:outcome.messageId});
  }
  /* 재시작 뒤 로컬 원장에 없는 서버 claim 은 보내지 않고 unknown 으로 격리(캠페인 실행기와 같은 원칙) */
  if(!fresh&&!this.dispatcher.row(item.id))return this.record(item,{status:'unknown',errorCode:'LOCAL_LEDGER_MISSING'});
  const outcome=await this.dispatcher.dispatch(item.id,job);
  if(!['submitted','sent','failed','unknown'].includes(outcome.status))throw new QueueError('INVALID_DISPATCH_RESULT');
  return this.record(item,outcome);
 }
 async batch(name,params,fresh) {
  const data=await this.queue.call(name,{p_worker_id:this.workerId,...params});
  if(data.contract_version!==1||!Array.isArray(data.items)||data.items.length>500)throw new QueueError('QUEUE_CONTRACT_MISMATCH');
  const seen=new Set(),results=[];
  for(const item of data.items){this.validate(item);if(seen.has(item.id))throw new QueueError('DUPLICATE_QUEUE_ITEM');seen.add(item.id);}
  for(const item of data.items)results.push(await this.process(item,fresh));
  return results;
 }
 async tick() {
  if(this.running)throw new QueueError('WORKER_ALREADY_RUNNING');
  this.running=true;
  try{
   const pending=await this.batch('crm_sms_worker_pending_inquiry_v1',{},false);
   const claimed=await this.batch('crm_sms_worker_claim_inquiry_v1',{p_limit:10},true);
   return {pending,claimed};
  }finally{this.running=false;}
 }
}
