import test from 'node:test';
import assert from 'node:assert/strict';
import {InquiryReplyWorker} from '../server/aligo/inquiry-reply-worker.mjs';
import {createQueueClient} from '../server/aligo/campaign-worker.mjs';
import {AligoDispatcher} from '../server/aligo/dispatcher.mjs';
const id='11111111-1111-4111-8111-111111111111',workerId='22222222-2222-4222-8222-222222222222',token='33333333-3333-4333-8333-333333333333';
const item=()=>({id,claim_token:token,receiver:'01012345678',message:'안녕하세요 넷폼입니다.',type:'SMS',status:'sending',provider_message_id:null});
function fixture({pending=[]}={}) {
 let sends=0,deliveries=0,claimed=false;const records=[],calls=[];
 const provider={identity:'synthetic-provider',async send(job){sends++;return {status:'submitted',messageId:'456'};},async delivery(){deliveries++;return {status:'sent',messageId:'456'};}};
 const dispatcher=new AligoDispatcher(':memory:',provider);
 const queue={async call(name,p){calls.push(name);
  if(name==='crm_sms_worker_pending_inquiry_v1')return {contract_version:1,items:pending};
  if(name==='crm_sms_worker_claim_inquiry_v1'){assert.equal(p.p_allowed_receivers,undefined,'허용 목록 없음 — 서버가 문의 번호로 채움');const items=claimed?[]:[item()];claimed=true;return {contract_version:1,items};}
  records.push(p);return {ok:true,request_id:p.p_request_id,status:p.p_status};}};
 const worker=new InquiryReplyWorker({queue,dispatcher,provider,workerId,enabled:true});
 return {worker,dispatcher,records,pending,calls,get sends(){return sends;},get deliveries(){return deliveries;}};
}
test('꺼져 있으면 만들 수 없다',()=>{assert.throws(()=>new InquiryReplyWorker({queue:{},dispatcher:{},provider:{},workerId}),/INQUIRY_REPLY_WORKER_DISABLED/);});
test('claim → 한 번만 발송 → 결과 submitted → 다음 주기 sent',async()=>{
 const f=fixture();try{
  await f.worker.tick();assert.equal(f.sends,1);assert.equal(f.records[0].p_status,'submitted');assert.equal(f.records[0].p_request_id,id);
  assert.deepEqual(f.calls.slice(0,2),['crm_sms_worker_pending_inquiry_v1','crm_sms_worker_claim_inquiry_v1']);
  f.pending.push({...item(),status:'submitted',provider_message_id:'456'});
  await f.worker.tick();assert.equal(f.sends,1);assert.equal(f.deliveries,1);assert.equal(f.records[1].p_status,'sent');
 }finally{f.dispatcher.close();}
});
test('010 아닌 번호 · 2000자 넘는 문구 · 모르는 상태는 거부',async()=>{
 const f=fixture();try{
  assert.throws(()=>f.worker.validate({...item(),receiver:'0212345678'}),/INVALID_QUEUE_ITEM/);
  assert.throws(()=>f.worker.validate({...item(),message:'x'.repeat(2001)}),/INVALID_QUEUE_ITEM/);
  assert.throws(()=>f.worker.validate({...item(),status:'queued'}),/INVALID_QUEUE_ITEM/);
 }finally{f.dispatcher.close();}
});
test('로컬 원장에 없는 서버 claim 은 보내지 않고 unknown',async()=>{
 const f=fixture();try{const r=await f.worker.process(item(),false);assert.equal(r.status,'unknown');assert.equal(f.sends,0);assert.equal(f.records[0].p_error_code,'LOCAL_LEDGER_MISSING');}finally{f.dispatcher.close();}
});
test('큐 클라이언트는 문의 응대 함수 3개를 허용하고 다른 이름은 거부',async()=>{
 const q=createQueueClient({url:'https://abc.supabase.co/',key:'sb_secret_x',fetchImpl:async()=>({ok:true,json:async()=>({contract_version:1,items:[]})})});
 assert.deepEqual(await q.call('crm_sms_worker_claim_inquiry_v1',{}),{contract_version:1,items:[]});
 await assert.rejects(q.call('crm_inquiry_sms_request_v1',{}),/INVALID_QUEUE_OPERATION/);
});
