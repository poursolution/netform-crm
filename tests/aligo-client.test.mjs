import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAligoClient,aligoSchedule} from '../server/aligo/client.mjs';
const options={key:'synthetic-secret',userId:'synthetic-user',sender:'02-1111-2222'};
const ok=x=>({ok:true,json:async()=>x});
test('server sends one recipient, defaults to nonbillable test, never reports delivery at acceptance',async()=>{
 let call;
 const client=createAligoClient({...options,fetchImpl:async(url,init)=>{call={url,init};return ok({result_code:1,msg_id:42,success_cnt:1,error_cnt:0});}});
 const r=await client.send({receiver:'010-1111-2222',message:'CRM TEST'});
 assert.equal(call.url,'https://apis.aligo.in/send/');
 assert.equal(call.init.body.get('testmode_yn'),'Y');
 assert.equal(call.init.body.get('user_id'),'synthetic-user');
 assert.equal(call.init.redirect,'error');
 assert.deepEqual(r,{provider:'aligo',messageId:'42',status:'test_accepted',mode:'test'});
 assert.equal((await client.send({receiver:'01011112222',message:'CRM TEST',mode:'live'})).status,'submitted');
});
test('timeout and invalid acceptance are ambiguous, contain no secret and never retry',async()=>{
 for(const response of [()=>{throw Error(options.key)},()=>ok({result_code:1,msg_id:null,success_cnt:1,error_cnt:0}),()=>ok({result_code:1,msg_id:42,success_cnt:0,error_cnt:1})]) {
  let count=0;const c=createAligoClient({...options,fetchImpl:async()=>{count++;return response();}});
  await assert.rejects(c.send({receiver:'01011112222',message:'TEST'}),e=>e.ambiguous&&e.code==='ALIGO_SEND_OUTCOME_UNKNOWN'&&!e.message.includes(options.key));
  assert.equal(count,1);
 }
});
test('provider rejection does not echo provider response or secret',async()=>{
 const c=createAligoClient({...options,fetchImpl:async()=>ok({result_code:-101,message:options.key})});
 await assert.rejects(c.send({receiver:'01011112222',message:'TEST'}),e=>e.code==='ALIGO_REJECTED_-101'&&!e.ambiguous&&!e.message.includes(options.key));
});
test('validation blocks multiple recipients, invalid mode and oversized SMS before network',async()=>{
 let calls=0;const c=createAligoClient({...options,fetchImpl:async()=>{calls++;throw Error('unexpected')}});
 for(const p of [{receiver:'01011112222,01033334444',message:'test'},{receiver:'01011112222',message:'x',mode:'arbitrary'},{receiver:'01011112222',message:'가'.repeat(31)}])
  await assert.rejects(c.send(p));
 assert.equal(calls,0);
});
test('only matching recipient and sender with explicit delivery become sent',async()=>{
 let row={mdid:'88',receiver:'01011112222',sender:'0211112222',sms_state:'발송완료'};
 const c=createAligoClient({...options,fetchImpl:async()=>ok({result_code:1,list:[row],next_yn:'N'})});
 assert.equal((await c.delivery({messageId:'42',receiver:'01011112222'})).status,'sent');
 row={...row,receiver:'01099998888'};
 assert.equal((await c.delivery({messageId:'42',receiver:'01011112222'})).status,'submitted');
 row={...row,receiver:'01011112222',sms_state:'new undocumented state'};
 assert.equal((await c.delivery({messageId:'42',receiver:'01011112222'})).needsReview,true);
 row={...row,sms_state:'가입자없음'};
 assert.equal((await c.delivery({messageId:'42',receiver:'01011112222'})).status,'failed');
});
test('no result and incomplete pagination remain pending',async()=>{
 const c=createAligoClient({...options,fetchImpl:async()=>ok({result_code:1,list:[],next_yn:'N'})});
 assert.equal((await c.delivery({messageId:'42',receiver:'01011112222'})).status,'submitted');
});
test('schedule requires offset, enforces 10 minutes and converts KST across date boundary',()=>{
 const now=Date.parse('2026-09-19T14:50:00Z');
 assert.deepEqual(aligoSchedule('2026-09-19T15:05:15Z',now),{rdate:'20260920',rtime:'0006'});
 assert.throws(()=>aligoSchedule('2026-09-19T23:59:00',now));
 assert.throws(()=>aligoSchedule('2026-09-19T14:59:00Z',now));
});
test('balance retains no raw provider fields',async()=>{
 const c=createAligoClient({...options,fetchImpl:async()=>ok({result_code:1,SMS_CNT:'10',LMS_CNT:4,MMS_CNT:2,message:options.key})});
 assert.deepEqual(await c.balance(),{sms:10,lms:4,mms:2});
});
