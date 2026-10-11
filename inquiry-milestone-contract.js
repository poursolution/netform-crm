/* Existing PC inquiry visit/quote facts only. No quote-v3 calculation or automatic task completion. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.InquiryMilestoneContract=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const names=['crm_inquiry_milestone_context_v1','crm_inquiry_milestone_save_v1','crm_inquiry_milestone_receipt_v1'],contract='crm.inquiry-milestone.v1';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,token=v=>/^[a-f0-9]{32}$/.test(v||''),clone=v=>JSON.parse(JSON.stringify(v));
 const documentKey='__crmInquiryMilestoneDocumentV1';if(!Object.hasOwn(root,documentKey))Object.defineProperty(root,documentKey,{value:root.crypto.randomUUID()});
 const documentId=root[documentKey];let epoch=0;root.addEventListener?.('phase1:identity-cleared',()=>{epoch++;});
 const fail=s=>{throw Error(s);},enabled=()=>root.CRM_SCHEDULE_V1===true&&names.every(n=>root.CRMRelease?.has?.(n)===true);
 function actor(){const p=root.Phase1?.profile;if(!UUID.test(p?.auth_uid||'')||!UUID.test(p?.user_id||''))fail('AUTH_REQUIRED');return {auth:p.auth_uid,user:p.user_id,epoch,documentId};}
 function same(a){const b=actor();if(!a||a.auth!==b.auth||a.user!==b.user||a.epoch!==b.epoch||a.documentId!==b.documentId)fail('IDENTITY_CHANGED');}
 async function rpc(name,p,a){same(a);try{const r=await root.Phase1.rpc(name,{p});same(a);return r;}catch(e){if(e.code==='PGRST202')root.CRMRelease?.noteMissing?.(name);throw e;}}
 function base(r){if(r?.ok!==true||r.contract!==contract)fail('MILESTONE_CONTRACT_MISMATCH');}
 async function context(id){
  if(!UUID.test(id||''))fail('MILESTONE_INVALID_TARGET');const a=actor(),r=await rpc(names[0],{inquiry_id:id},a);base(r);
  if(r.inquiry_id!==id||r.actor_auth_uid!==a.auth||r.actor_user_id!==a.user||!UUID.test(r.owner_id||'')||!token(r.token)||!token(r.schedule_token)||!token(r.fact_token)||!token(r.parent_guard)
   ||typeof r.enabled!=='boolean'||typeof r.writable!=='boolean'||!Number.isInteger(r.open_action_count)||r.open_action_count<0||!Number.isInteger(r.open_calendar_count)||r.open_calendar_count<0
   ||!r.parent||!['status','first_response_at','responded_at','next_action_date','updated_at'].every(k=>Object.hasOwn(r.parent,k)))fail('MILESTONE_CONTRACT_MISMATCH');
  return Object.freeze({...r,ready:enabled()&&r.enabled&&r.writable,identity:Object.freeze(a)});
 }
 function prepare(c,input,requestId){
  same(c.identity);if(!enabled()||!c.ready)fail('MILESTONE_RELEASE_DISABLED');if(!UUID.test(requestId||''))fail('MILESTONE_REQUEST_ID_REQUIRED');
  if(!['visit_planned','visit_done','quote_draft','quote_sent'].includes(input?.kind)||Object.keys(input).some(k=>!['kind','date','time','amount','method','file_name','change_reason','recipient','schedule_request_id','schedule_action_id'].includes(k)))fail('MILESTONE_INVALID_INPUT');
  return Object.freeze({identity:Object.freeze({...c.identity}),command:Object.freeze(clone({inquiry_id:c.inquiry_id,request_id:requestId,expected_token:c.token,...input})),owner_id:c.owner_id,parent:clone(c.parent),contactState:clone(c.state||{})});
 }
 function ack(r,p){
  base(r);const c=p.command,a=p.identity,f=r.fact;
  if(r.request_id!==c.request_id||r.inquiry_id!==c.inquiry_id||r.kind!==c.kind||r.actor_auth_uid!==a.auth||r.actor_user_id!==a.user||r.owner_id!==p.owner_id||!UUID.test(r.event_id||'')||!UUID.test(r.inquiry_audit_event_id||'')
   ||!token(r.token)||!token(r.schedule_token)||!token(r.fact_token)||!r.parent||r.state?.inquiry_id!==c.inquiry_id||r.promoted!==false||!f
   ||!['cancelled_action_ids','completed_action_ids','changed_calendar_ids'].every(k=>Array.isArray(r[k])&&r[k].length===0)
   ||['kind','date','time','amount','method','file_name','change_reason','schedule_request_id','schedule_action_id'].some(k=>(f[k]??null)!==(c[k]??null))
   ||JSON.stringify(f.recipient??null)!==JSON.stringify(c.recipient??null)
   ||!['status','first_response_at','responded_at','next_action_date','updated_at'].every(k=>Object.hasOwn(r.parent,k))
   ||r.parent.status!==({visit_planned:'현장방문예정',visit_done:'현장방문 완료',quote_draft:'견적서 발송예정',quote_sent:'견적서 발송완료'}[c.kind])
   ||!Number.isFinite(Date.parse(r.parent.updated_at||''))
   ||['first_response_at','responded_at','next_action_date'].some(k=>r.parent[k]!==p.parent[k])
   ||['first_attempt_at','last_attempt_at','first_connected_at','last_connected_at','attempt_count','connected_count','qualified_at','qualified_by'].some(k=>(r.state[k]??null)!==(p.contactState[k]??null)))fail('MILESTONE_ACK_MISMATCH');
  if(c.kind.startsWith('quote')&&c.amount){const q=r.state.quotes?.find(x=>x.id===r.quote_version_id);if(!UUID.test(r.quote_version_id||'')||!q||q.amount!==c.amount||q.version_no!==r.quote_version_no||(c.kind==='quote_sent'?!q.sent_at:q.sent_at!==null))fail('MILESTONE_QUOTE_ACK_MISMATCH');}
  return r;
 }
 async function write(p){same(p.identity);if(!enabled())fail('MILESTONE_RELEASE_DISABLED');return ack(await rpc(names[1],p.command,p.identity),p);}
 async function receipt(p){same(p.identity);const c=p.command,r=await rpc(names[2],{inquiry_id:c.inquiry_id,request_id:c.request_id},p.identity);base(r);if(r.inquiry_id!==c.inquiry_id||r.request_id!==c.request_id||r.actor_auth_uid!==p.identity.auth||r.actor_user_id!==p.identity.user||typeof r.found!=='boolean'||(!r.found&&r.ack!==null))fail('MILESTONE_CONTRACT_MISMATCH');return r.found?ack(r.ack,p):null;}
 function rebind(saved,current){
  same(current.identity);if(!current.ready)fail('MILESTONE_RECOVERY_SCOPE_CHANGED');const id=saved.command?.inquiry_id||saved.inquiry_id;
  if(id!==current.inquiry_id||saved.owner_id!==current.owner_id||saved.identity?.auth!==current.actor_auth_uid||saved.identity?.user!==current.actor_user_id
   ||!UUID.test(saved.identity?.documentId||'')||(saved.identity.documentId===current.identity.documentId&&saved.identity.epoch!==current.identity.epoch))fail('IDENTITY_CHANGED');
  // A document-local epoch is not a durable identity. Fresh authorized context permits only
  // rebinding that epoch; the original command, expected token and request UUID are immutable.
  return {...clone(saved),identity:clone(current.identity)};
 }
 return Object.freeze({enabled,context,prepare,write,receipt,rebind,assertContext:c=>same(c.identity)});
});
