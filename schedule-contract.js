/* Shared PC/mobile schedule transport. Headless candidate; no UI entry enabled here. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else root.ScheduleContract=factory(root);
})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const names=['crm_schedule_list_v1','crm_schedule_write_v1','crm_schedule_receipt_v1'];
 const contract='crm.schedule.v1',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const documentKey='__crmScheduleDocumentV1';
 if(!Object.hasOwn(root,documentKey))Object.defineProperty(root,documentKey,{value:root.crypto?.randomUUID?.()||Date.now().toString(36)+':'+Math.random().toString(36).slice(2)});
 const documentId=root[documentKey];
 let epoch=0;root.addEventListener?.('phase1:identity-cleared',()=>{epoch++;});
 const fail=code=>{throw Error(code);};
 function actor(){const p=root.Phase1?.profile;if(!uuid.test(p?.auth_uid||'')||!uuid.test(p?.user_id||''))fail('AUTH_REQUIRED');return {auth:p.auth_uid,user:p.user_id,epoch,document:documentId};}
 function same(a){const b=actor();if(!a||a.auth!==b.auth||a.user!==b.user||a.epoch!==b.epoch||(a.document&&a.document!==b.document))fail('IDENTITY_CHANGED');}
 function needsResume(c){
  const a=c?.identity,b=actor();if(!a||a.auth!==b.auth||a.user!==b.user)fail('IDENTITY_CHANGED');
  if(!a.document||a.document===b.document){if(a.epoch!==b.epoch)fail('IDENTITY_CHANGED');return false;}
  return true;
 }
 function gate(){return root.CRM_SCHEDULE_V1===true&&names.every(n=>root.CRMRelease?.has?.(n)===true);}
 function target(kind,id){if(!['deal','inquiry'].includes(kind)||!uuid.test(id||''))fail('SCHEDULE_INVALID_TARGET');}
 async function rpc(name,p,a){same(a);try{const r=await root.Phase1.rpc(name,{p});same(a);return r;}catch(e){if(e.code==='PGRST202')root.CRMRelease?.noteMissing?.(name);throw e;}}
 function base(r){if(r?.ok!==true||r.contract!==contract)fail('SCHEDULE_CONTRACT_MISMATCH');}
 async function list(kind,id,page=1){
  target(kind,id);if(!Number.isInteger(page)||page<1||page>100000)fail('SCHEDULE_INVALID_PAGE');
  const a=actor(),r=await rpc(names[0],{target_type:kind,target_id:id,page},a);base(r);
  if(r.target_type!==kind||r.target_id!==id||r.actor_auth_uid!==a.auth||r.actor_user_id!==a.user||r.page!==page||r.per!==20
   ||!Number.isInteger(r.total)||r.total<0||!Array.isArray(r.items)||r.items.length>20||!/^[a-f0-9]{32}$/.test(r.token||'')
   ||typeof r.enabled!=='boolean'||typeof r.writable!=='boolean')fail('SCHEDULE_CONTRACT_MISMATCH');
  if(r.items.some(x=>!uuid.test(x.id||'')||x.status!=='open'||!['internal_plan','customer_agreed','unconfirmed'].includes(x.date_basis)))fail('SCHEDULE_CONTRACT_MISMATCH');
  return Object.freeze({...r,ready:gate()&&r.enabled&&r.writable,identity:Object.freeze(a)});
 }
 function prepare(context,input,requestId){
  same(context.identity);if(!gate()||context.enabled!==true||context.writable!==true)fail('SCHEDULE_RELEASE_DISABLED');
  target(context.target_type,context.target_id);if(!uuid.test(requestId||''))fail('SCHEDULE_REQUEST_ID_REQUIRED');
  const common={request_id:requestId,target_type:context.target_type,target_id:context.target_id,expected_token:context.token};
  if(!['add','reschedule'].includes(input?.operation)||!['internal_plan','customer_agreed'].includes(input.date_basis))fail('SCHEDULE_INVALID_INPUT');
  const fields=input.operation==='add'?['operation','due_on','date_basis','action_type','title','reason']:['operation','due_on','date_basis','action_id','reason'];
  if(Object.keys(input).some(k=>!fields.includes(k)))fail('SCHEDULE_INVALID_INPUT');
  const p={...common,...input};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.due_on||''))fail('SCHEDULE_INVALID_DATE');
  if(p.operation==='reschedule'&&(!uuid.test(p.action_id||'')||typeof p.reason!=='string'||!p.reason.trim()))fail('SCHEDULE_REASON_REQUIRED');
  // Persist this object in the existing account/target journal BEFORE calling write.
  return Object.freeze({identity:Object.freeze({...context.identity}),command:Object.freeze(JSON.parse(JSON.stringify(p)))});
 }
 function ack(r,prepared){
  base(r);const p=prepared.command,a=prepared.identity;
  const ms=Date.parse(r.after?.due_at),actualDay=Number.isFinite(ms)?new Date(ms+9*3600000).toISOString().slice(0,10):null;
  if(r.request_id!==p.request_id||r.target_type!==p.target_type||r.target_id!==p.target_id||r.operation!==p.operation
   ||r.actor_auth_uid!==a.auth||r.actor_user_id!==a.user||r.due_on!==p.due_on||r.date_basis!==p.date_basis
   ||!uuid.test(r.action_id||'')||!uuid.test(r.event_id||'')||r.action_status!=='open'
   ||r.after?.id!==r.action_id||r.after?.status!=='open'||r.after?.completed_at!==null||actualDay!==p.due_on
   ||r.after?.[p.target_type==='deal'?'deal_id':'inquiry_id']!==p.target_id
   ||(p.operation==='reschedule'&&r.action_id!==p.action_id)
   ||!Array.isArray(r.cancelled_action_ids)||r.cancelled_action_ids.length||!Array.isArray(r.completed_action_ids)||r.completed_action_ids.length
   ||!/^[a-f0-9]{32}$/.test(r.token||''))fail('SCHEDULE_ACK_MISMATCH');
  return r;
 }
 async function write(prepared){
  same(prepared.identity);if(!gate())fail('SCHEDULE_RELEASE_DISABLED');
  return ack(await rpc(names[1],prepared.command,prepared.identity),prepared);
 }
 async function receipt(prepared){
  const p=prepared.command;target(p.target_type,p.target_id);same(prepared.identity);
  const r=await rpc(names[2],{target_type:p.target_type,target_id:p.target_id,request_id:p.request_id},prepared.identity);base(r);
  if(r.request_id!==p.request_id||typeof r.found!=='boolean'||(!r.found&&r.ack!==null))fail('SCHEDULE_CONTRACT_MISMATCH');
  return r.found?ack(r.ack,prepared):null; // null means unknown/not committed, NEVER complete or automatic new UUID
 }
 function assertContext(c){same(c.identity);target(c.target_type,c.target_id);}
 async function resume(saved,prepared){
  needsResume(saved);target(saved.target_type,saved.target_id);
  const a=saved.identity;
  if(saved.actor_auth_uid!==a.auth||saved.actor_user_id!==a.user||!uuid.test(saved.owner_id||''))fail('SCHEDULE_RECOVERY_CONTEXT_MISMATCH');
  if(prepared){const p=prepared.command,i=prepared.identity;
   if(!i||i.auth!==a.auth||i.user!==a.user||i.epoch!==a.epoch||i.document!==a.document||!p
    ||p.target_type!==saved.target_type||p.target_id!==saved.target_id||!uuid.test(p.request_id||'')||!/^[a-f0-9]{32}$/.test(p.expected_token||''))fail('SCHEDULE_RECOVERY_CONTEXT_MISMATCH');
  }
  // A document restart may renew only the actor binding. The original CAS token, command and UUID remain immutable.
  const current=await list(saved.target_type,saved.target_id,1);
  if(!current.ready||current.owner_id!==saved.owner_id)fail('SCHEDULE_RECOVERY_SCOPE_CHANGED');
  const identity=Object.freeze({...current.identity}),copy=x=>JSON.parse(JSON.stringify(x));
  return {context:Object.freeze({...copy(saved),identity}),prepared:prepared?Object.freeze({...copy(prepared),command:Object.freeze(copy(prepared.command)),identity}):null,current};
 }
 return Object.freeze({list,prepare,write,receipt,assertContext,needsResume,resume,enabled:gate});
});
