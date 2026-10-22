import test from 'node:test';
import assert from 'node:assert/strict';
import {senderLanes,normalizeSenders,KNOWN_BRANDS} from '../server/aligo/sender-lanes.mjs';
import {CampaignWorker} from '../server/aligo/campaign-worker.mjs';
import {InquiryReplyWorker} from '../server/aligo/inquiry-reply-worker.mjs';
import {AligoDispatcher} from '../server/aligo/dispatcher.mjs';
/* 브랜드별 발신번호(2026-10-22): 큐 항목의 sender_brand 로 발신번호(클라이언트 · 원장)를 고른다 · 없으면 기본 · 번호 모양 검사 */
const id='11111111-1111-4111-8111-111111111111',id2='11111111-1111-4111-8111-111111111112',workerId='22222222-2222-4222-8222-222222222222',token='33333333-3333-4333-8333-333333333333';
function fakeClient(cfg){const sent=[];return {identity:'aligo:'+cfg.userId+':'+cfg.sender,sender:cfg.sender,sent,async send(job){sent.push(job);return {status:'submitted',messageId:String(100+sent.length)};},async delivery({messageId}){return {status:'sent',messageId};}};}
function lanesOf(senders){const clients=[];const lanes=senderLanes({config:{key:'k',userId:'u',sender:'0200000000',receiver:'01000000000',senders},createClient:c=>{const x=fakeClient(c);clients.push(x);return x;},createDispatcher:p=>new AligoDispatcher(':memory:',p)});return {lanes,clients};}

test('normalizeSenders: 숫자만 남기고 모양 검사 · 빈 값은 뺀다',()=>{
 assert.deepEqual(normalizeSenders({'POUR공법':'02-1234-5678','아파트스퀘어':'','석민이앤씨':' 031 111 2222 '}),{'POUR공법':'0212345678','석민이앤씨':'0311112222'});
 assert.throws(()=>normalizeSenders({'POUR공법':'1234'}),/INVALID_SENDER_NUMBER/);
 assert.deepEqual(normalizeSenders(null),{});assert.deepEqual(KNOWN_BRANDS,['POUR공법','아파트스퀘어','석민이앤씨','POUR솔루션']);
});
test('senderLanes: 브랜드 → 번호, 같은 번호는 한 묶음, 모르는 브랜드 · 빈 브랜드는 기본',()=>{
 const {lanes,clients}=lanesOf({'POUR공법':'0212345678','아파트스퀘어':'0212345678','석민이앤씨':'0311112222'});
 try{
  assert.equal(lanes.default.sender,'0200000000');assert.equal(lanes.lanes().length,3,'기본 + 번호 2개');
  assert.equal(lanes.for('POUR공법').sender,'0212345678');assert.equal(lanes.for('아파트스퀘어'),lanes.for('POUR공법'),'같은 번호 = 같은 묶음');
  assert.equal(lanes.for('석민이앤씨').sender,'0311112222');assert.equal(lanes.for('POUR솔루션'),lanes.default);assert.equal(lanes.for(null),lanes.default);assert.equal(lanes.for(''),lanes.default);
  assert.equal(clients.length,3);
 }finally{lanes.close();}
});
test('캠페인 실행기: 항목의 sender_brand 에 맞는 번호로 보내고 결과는 같은 큐 함수로 기록',async()=>{
 const {lanes}=lanesOf({'POUR공법':'0212345678'});
 try{
  const records=[];let claimed=false;
  const items=[{id,claim_token:token,receiver:'01000000000',message:'a',type:'SMS',status:'sending',provider_message_id:null,sender_brand:'POUR공법'},
   {id:id2,claim_token:token,receiver:'01000000000',message:'b',type:'SMS',status:'sending',provider_message_id:null,sender_brand:'모르는 브랜드'}];
  const queue={async call(name,p){if(name==='crm_sms_worker_pending_v1')return {contract_version:1,items:[]};if(name==='crm_sms_worker_claim_v1'){const r=claimed?[]:items;claimed=true;return {contract_version:1,items:r};}records.push(p);return {ok:true,recipient_id:p.p_recipient_id,status:p.p_status};}};
  const w=new CampaignWorker({queue,provider:lanes.default.provider,dispatcher:lanes.default.dispatcher,workerId,allowedReceivers:['01000000000'],liveEnabled:true,lanes});
  await w.tick();
  assert.deepEqual(lanes.for('POUR공법').provider.sent.map(j=>j.message),['a'],'POUR공법 번호로 a');
  assert.deepEqual(lanes.default.provider.sent.map(j=>j.message),['b'],'모르는 브랜드는 기본 번호');
  assert.deepEqual(records.map(r=>r.p_status),['submitted','submitted']);
  assert.throws(()=>w.validate({...items[0],sender_brand:'x'.repeat(101)}),/INVALID_QUEUE_ITEM/);
 }finally{lanes.close();}
});
test('문의 문자 실행기: 문의 브랜드로 번호를 고른다 · lanes 없으면 예전처럼 하나',async()=>{
 const {lanes}=lanesOf({'아파트스퀘어':'0311112222'});
 try{
  let claimed=false;const records=[];
  const queue={async call(name,p){if(name==='crm_sms_worker_pending_inquiry_v1')return {contract_version:1,items:[]};if(name==='crm_sms_worker_claim_inquiry_v1'){const r=claimed?[]:[{id,claim_token:token,receiver:'01012345678',message:'안녕하세요',type:'SMS',status:'sending',provider_message_id:null,sender_brand:'아파트스퀘어'}];claimed=true;return {contract_version:1,items:r};}records.push(p);return {ok:true,request_id:p.p_request_id,status:p.p_status};}};
  const w=new InquiryReplyWorker({queue,provider:lanes.default.provider,dispatcher:lanes.default.dispatcher,workerId,enabled:true,lanes});
  await w.tick();
  assert.equal(lanes.for('아파트스퀘어').provider.sent.length,1);assert.equal(lanes.default.provider.sent.length,0);
  const plain=new InquiryReplyWorker({queue,provider:lanes.default.provider,dispatcher:lanes.default.dispatcher,workerId,enabled:true});
  assert.equal(plain.lane({sender_brand:'아파트스퀘어'}).provider,lanes.default.provider,'lanes 없으면 기본 하나');
 }finally{lanes.close();}
});
