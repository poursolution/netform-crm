(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PersonalStateContract=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function fail(code){const e=Error(code);e.code=code;throw e;}
 function object(x){return x&&typeof x==='object'&&!Array.isArray(x);}
 function normalize(operation,objectId,expectedVersion,payload){
  if(!['favorite_set','opportunity_touch'].includes(operation))fail('OP_NOT_PERSONAL_STATE');
  if(!UUID.test(objectId)||expectedVersion!==0||!object(payload))fail('INVALID_PERSONAL_STATE_COMMAND');
  if(payload.opportunity_id!==undefined&&payload.opportunity_id!==objectId)fail('OBJECT_MISMATCH');
  if(operation==='favorite_set'){
   if(Object.keys(payload).some(k=>!['opportunity_id','user_key','favorite'].includes(k))||typeof payload.favorite!=='boolean')fail('INVALID_FAVORITE_PAYLOAD');
   return Object.freeze({operation,object_id:objectId,expected_version:0,payload:Object.freeze({favorite:payload.favorite})});
  }
  if(Object.keys(payload).some(k=>!['opportunity_id','user_key','touch_kind','touched_at'].includes(k))||!['view','work'].includes(payload.touch_kind))fail('INVALID_TOUCH_PAYLOAD');
  return Object.freeze({operation,object_id:objectId,expected_version:0,payload:Object.freeze({touch_kind:payload.touch_kind})});
 }
 function validateAck(ack,command){
  if(ack?.contract_version!==1||ack.ok!==true||ack.request_id!==command.request_id||ack.operation!==command.operation||ack.object_id!==command.object_id||ack.actor_auth_uid!==command.auth_uid||ack.actor_user_id!==command.user_id||typeof ack.replayed!=='boolean'||typeof ack.favorite!=='boolean'||!Number.isSafeInteger(ack.view_count)||ack.view_count<0||typeof ack.server_at!=='string')fail('ACK_CONTRACT_MISMATCH');
  if(command.operation==='favorite_set'&&(ack.favorite!==command.payload.favorite||ack.touch_kind!==null))fail('ACK_CONTRACT_MISMATCH');
  if(command.operation==='opportunity_touch'&&(ack.touch_kind!==command.payload.touch_kind||(ack.touch_kind==='view'&&typeof ack.last_viewed_at!=='string')||(ack.touch_kind==='work'&&typeof ack.last_worked_at!=='string')))fail('ACK_CONTRACT_MISMATCH');
  return ack;
 }
 return Object.freeze({operations:Object.freeze(['favorite_set','opportunity_touch']),normalize,validateAck});
});
