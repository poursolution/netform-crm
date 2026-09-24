'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,DATE=/^\d{4}-\d{2}-\d{2}$/;
function fail(code){const e=Error(code);e.code=code;throw e;}
function normalize(operation,objectId,expectedVersion,payload){
 if(operation!=='inquiry_followup'||!UUID.test(objectId)||expectedVersion!==0||!payload||typeof payload!=='object'||Array.isArray(payload)||payload.inquiry_id!==objectId)fail('INVALID_INQUIRY_FOLLOWUP_COMMAND');
 const allowed=['inquiry_id','due_at','reason'];
 if(Object.keys(payload).some(k=>!allowed.includes(k))||!DATE.test(payload.due_at)||payload.reason!=='담당자 연기')fail('INQUIRY_FOLLOWUP_INTENT_NOT_CONNECTED');
 return Object.freeze({operation,object_id:objectId,expected_version:0,payload:Object.freeze({due_at:payload.due_at,reason:'담당자 연기'})});
}
function validateAck(ack,command){
 if(ack?.contract_version!==1||ack.ok!==true||ack.request_id!==command.request_id||ack.operation!=='inquiry_followup'||ack.object_id!==command.object_id||ack.actor_auth_uid!==command.auth_uid||ack.actor_user_id!==command.user_id||ack.next_action_date!==command.payload.due_at||typeof ack.status!=='string'||typeof ack.updated_at!=='string'||typeof ack.replayed!=='boolean'||!UUID.test(ack.inquiry_audit_event_id))fail('ACK_CONTRACT_MISMATCH');
 if(!(ack.previous_next_action_date===null||DATE.test(ack.previous_next_action_date)))fail('ACK_CONTRACT_MISMATCH');
 return ack;
}
module.exports=Object.freeze({normalize,validateAck});
