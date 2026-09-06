'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(code){const e=Error(code);e.code=code;throw e;}function object(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function normalize(objectId,expectedVersion,payload){
 if(!UUID.test(objectId)||expectedVersion!==0||!object(payload))fail('INVALID_INQUIRY_HOLD');
 const allowed=['inquiry_id','from_status','to_status','reason','changed_by','at'];
 if(Object.keys(payload).some(k=>!allowed.includes(k))||payload.inquiry_id!==objectId||payload.to_status!=='보류'||typeof payload.reason!=='string'||!payload.reason.trim()||payload.reason.length>2000)fail('INQUIRY_STATUS_INTENT_NOT_CONNECTED');
 return Object.freeze({operation:'inquiry_status',object_id:objectId,expected_version:0,payload:Object.freeze({intent:'hold',reason:payload.reason.trim()})});
}
function validateAck(ack,command){
 if(ack?.contract_version!==1||ack.ok!==true||ack.request_id!==command.request_id||ack.operation!=='inquiry_status'||ack.object_id!==command.object_id||ack.intent!=='hold'||ack.to_status!=='보류'||ack.hold_reason!==command.payload.reason||typeof ack.from_status!=='string'||typeof ack.held_at!=='string'||typeof ack.held_by!=='string'||ack.actor_auth_uid!==command.auth_uid||ack.actor_user_id!==command.user_id||!UUID.test(ack.inquiry_audit_event_id)||typeof ack.replayed!=='boolean')fail('ACK_CONTRACT_MISMATCH');
 return ack;
}
module.exports=Object.freeze({normalize,validateAck});
