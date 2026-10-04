/* Functional API for the Claude-owned B2B view. No DOM, layout or automatic writes. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.InquiryB2B=api;})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const results=Object.freeze(['협약완료','해결완료','종결']),pending=new Map();
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function isAgreement(q){if(!q)return false;const d=q.detail||{},r=q.raw||{};if([q.work_type,q.workType,q.work,d.work_type,d.workType,r['공사유형']].some(v=>/협약/.test(String(v||''))))return true;const text=String(q.inquiry_content||q.inquiry||r['문의내용']||'');return !/협약(?:서)?\s*(?:관련\s*)?(?:문의|상담|요청)?\s*(?:아님|아니|없음)/.test(text)&&/협약(?:서)?\s*(?:관련\s*)?(?:문의|상담|요청|진행|체결)/.test(text);}
 function state(q){if(!isAgreement(q))return null;if(results.includes(q.status))return 'done';if(['수주','실주','배드핏','연락두절','종료','영업전환'].includes(q.status)||q.deal_id||q.opportunity_id||q.qualified_at)return 'review';return 'pending';}
 function request(q,result,note=''){
  if(state(q)!=='pending')throw Error('B2B_STATE_CONFLICT');
  if(!uuid.test(String(q.id||''))||!results.includes(result)||typeof note!=='string'||note.length>4000)throw Error('INVALID_B2B_COMPLETION');
  if(typeof q.updated_at!=='string'||!Number.isFinite(Date.parse(q.updated_at)))throw Error('B2B_READ_VERSION_REQUIRED');
  return {inquiry_id:q.id,intent:'b2b_complete',result,note:note.trim(),expected_updated_at:q.updated_at};
 }
 function complete(q,result,note=''){
  const p=request(q,result,note),key=q.id;if(pending.has(key)){const active=pending.get(key);if(JSON.stringify(active.payload)!==JSON.stringify(p))throw Error('B2B_PENDING_RESULT_EXISTS');return active.promise;}
  const job=(async()=>{
   const queue=root.Phase1&&root.Phase1.queue;if(!queue)throw Error('B2B_SERVER_CONNECTION_REQUIRED');
   const old=queue.list().find(x=>x.operation==='inquiry_status'&&x.object_id===q.id&&x.payload&&x.payload.intent==='b2b_complete'&&!['done','rejected','conflict'].includes(x.status));
   if(old&&(old.payload.result!==p.result||old.payload.note!==p.note||old.payload.expected_updated_at!==p.expected_updated_at))throw Error('B2B_PENDING_RESULT_EXISTS');
   const command=old||queue.enqueue('inquiry_status',q.id,0,p);
   await queue.flush();const saved=queue.list().find(x=>x.request_id===command.request_id);
   if(!saved||saved.status!=='done'||!saved.ack)return {saved:false,request_id:command.request_id,queue_status:saved&&saved.status||'uncertain',error:saved&&saved.error||null};
   const a=saved.ack;if(a.intent!=='b2b_complete'||a.status!==result||a.note!==p.note||a.object_id!==q.id||a.request_id!==command.request_id||a.ok!==true)throw Error('ACK_CONTRACT_MISMATCH');
   return {saved:true,result:a.status,note:a.note,completed_at:a.completed_at,sync_status:a.sync_status,request_id:a.request_id};
  })();pending.set(key,{payload:p,promise:job});job.finally(()=>pending.delete(key)).catch(()=>{});return job;
 }
 return Object.freeze({results,isAgreement,state,request,complete});
});
