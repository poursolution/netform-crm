/* Headless first-response contract. Caller must persist prepared command before confirm. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.InquiryResponseContract=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const name='crm_inquiry_response_confirm_v1',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const fail=x=>{throw Error(x);},enabled=()=>root.ScheduleContract?.enabled?.()===true&&root.CRMRelease?.has?.(name)===true;
 function prepare(c,log,id){
  root.ScheduleContract.assertContext(c);
  if(!enabled()||!c.ready)fail('SCHEDULE_RELEASE_DISABLED');
  if(c.target_type!=='inquiry'||log?.inquiry_id!==c.target_id||!uuid.test(log.log_id||'')||!uuid.test(id||''))fail('INQUIRY_RESPONSE_INVALID_INPUT');
  return Object.freeze({context:JSON.parse(JSON.stringify(c)),command:Object.freeze({inquiry_id:c.target_id,request_id:id,contact_log_id:log.log_id,expected_token:c.token})});
 }
 async function confirm(prepared){
  const c=prepared.context,p=prepared.command;root.ScheduleContract.assertContext(c);
  if(!enabled())fail('SCHEDULE_RELEASE_DISABLED');
  let r;try{r=await root.Phase1.rpc(name,{p});}catch(e){if(e.code==='PGRST202')root.CRMRelease?.noteMissing?.(name);throw e;}
  root.ScheduleContract.assertContext(c);
  if(r?.ok!==true||r.contract!=='crm.inquiry-response.v1'||r.inquiry_id!==p.inquiry_id||r.request_id!==p.request_id||r.contact_log_id!==p.contact_log_id
   ||r.actor_auth_uid!==c.actor_auth_uid||r.actor_user_id!==c.actor_user_id||r.owner_id!==c.owner_id||r.status!=='전화응대 완료'
   ||!uuid.test(r.stage_history_id||'')||!uuid.test(r.inquiry_audit_event_id||'')||!/^[a-f0-9]{32}$/.test(r.token||'')
   ||!['first_response_at','responded_at','updated_at'].every(k=>typeof r[k]==='string'&&Number.isFinite(Date.parse(r[k])))
   ||!Array.isArray(r.cancelled_action_ids)||r.cancelled_action_ids.length||!Array.isArray(r.completed_action_ids)||r.completed_action_ids.length)
   fail('INQUIRY_RESPONSE_ACK_MISMATCH');
  return r;
 }
 async function resume(prepared){
  const p=prepared?.command,c=prepared?.context;
  if(!c||!p||c.target_type!=='inquiry'||p.inquiry_id!==c.target_id||p.expected_token!==c.token||!uuid.test(p.request_id||'')||!uuid.test(p.contact_log_id||''))fail('INQUIRY_RESPONSE_INVALID_INPUT');
  const rebound=await root.ScheduleContract.resume(c);
  return Object.freeze({context:rebound.context,command:Object.freeze(JSON.parse(JSON.stringify(p)))});
 }
 return Object.freeze({enabled,prepare,confirm,resume});
});
