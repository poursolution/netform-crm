(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ManagerRequestClient=factory();})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
// Uses an authenticated, actor-scoped transport supplied by the PC integration.
// This module never fetches directly or handles provider credentials.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
function validPending(x,id){
 const p=x?.payload;
 if(!p||!UUID.test(p.p_id)||!UUID.test(id)||p.p_target!==id||!['call','next','report'].includes(p.p_kind)||!timestamp(p.p_due)||typeof p.p_instruction!=='string'||!p.p_instruction.trim())return false;
 return x.signature===JSON.stringify({p_target:p.p_target,p_kind:p.p_kind,p_due:p.p_due,p_instruction:p.p_instruction});
}
function validRow(x){
 if(!x||!UUID.test(x.id)||!UUID.test(x.target_id)||x.target_type!=='inq'||!UUID.test(x.assignee_id)||
  !['call','next','report'].includes(x.kind)||!['requested','overdue','completed'].includes(x.state)||
  typeof x.instruction!=='string'||!x.instruction.trim()||typeof x.requested_by!=='string'||
  !timestamp(x.requested_at)||!timestamp(x.due_at)||x.delivery!=='not_sent')return false;
 if(x.state!=='completed')return x.completion==null;
 const c=x.completion;return !!c&&UUID.test(c.event_id)&&c.actor_id===x.assignee_id&&timestamp(c.completed_at)&&Date.parse(c.completed_at)>Date.parse(x.requested_at)&&Date.parse(c.completed_at)<=Date.now()+60000;
}
function createClient(transport){
 const actor=transport.profile?.auth_uid;if(!actor)throw Error('AUTH_REQUIRED');
 function admitted(){if(transport.profile?.auth_uid!==actor)throw Error('IDENTITY_CHANGED');}
 const key=id=>'manager-request-pending:'+id;
 const retryStore={
  get(id){admitted();const raw=transport.storage.getItem(key(id));if(raw===null)return undefined;const x=JSON.parse(raw);
   if(!validPending(x,id))throw Error('INVALID_PENDING_REQUEST');return x;},
  set(id,value){admitted();if(!validPending(value,id))throw Error('INVALID_PENDING_REQUEST');transport.storage.setItem(key(id),JSON.stringify(value));},
  delete(id){admitted();transport.storage.removeItem(key(id));}
 };
 return {retryStore,
  async list(){admitted();const rows=await transport.rpc('crm_manager_request_list_v1',{});admitted();if(!Array.isArray(rows)||!rows.every(validRow)||new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('INVALID_REQUEST_LIST');return rows;},
  async create(payload){admitted();if(!UUID.test(payload.p_id)||!UUID.test(payload.p_target))throw Error('INVALID_REQUEST_ID');
   const submitted={...payload},expectedId=submitted.p_id;
   const ack=await transport.rpc('crm_manager_request_create_v1',submitted);admitted();if(ack?.ok!==true||!UUID.test(ack.id)||!UUID.test(ack.request_id)||ack.request_id.toLowerCase()!==expectedId.toLowerCase()||ack.delivery!=='not_sent')throw Error('INVALID_REQUEST_ACK');return ack;}
 };
}
return {createClient};
});
