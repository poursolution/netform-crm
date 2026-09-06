(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AttachmentStateContract=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const blocked=Object.freeze({attachment_prepare:'BLOCKED_STORAGE_CONTRACT',attachment_complete:'BLOCKED_STORAGE_CONTRACT',attachment_list:'BLOCKED_METADATA_RELATION'});
 function fail(code){const e=Error(code);e.code=code;throw e;}
 function normalize(operation,objectId,payload){
  if(blocked[operation])fail(blocked[operation]);
  if(!UUID.test(objectId)||!payload||typeof payload!=='object'||Array.isArray(payload))fail('INVALID_STATE_COMMAND');
  if(operation==='favorite_set'){
   if(typeof payload.favorite!=='boolean')fail('INVALID_FAVORITE_PAYLOAD');
   return Object.freeze({operation,object_id:objectId,payload:Object.freeze({favorite:payload.favorite})});
  }
  if(operation==='opportunity_touch'){
   if(!['view','work'].includes(payload.touch_kind))fail('INVALID_TOUCH_PAYLOAD');
   return Object.freeze({operation,object_id:objectId,payload:Object.freeze({touch_kind:payload.touch_kind})});
  }
  fail('OP_NOT_CONNECTED');
 }
 return Object.freeze({blocked,normalize});
});
