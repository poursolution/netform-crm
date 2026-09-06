'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(code){const e=Error(code);e.code=code;throw e;}
function normalize(objectId,expectedVersion,payload){
 if(!UUID.test(objectId)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0||!payload||typeof payload!=='object'||Array.isArray(payload))fail('INVALID_NEXT_ACTION_COMPLETE');
 if(Object.keys(payload).some(k=>!['opportunity_id','action_id','text','due_at','at'].includes(k))||payload.opportunity_id!==objectId||!UUID.test(payload.action_id))fail('INVALID_NEXT_ACTION_COMPLETE');
 return Object.freeze({operation:'next_action_complete',object_id:objectId,expected_version:expectedVersion,payload:Object.freeze({action_id:payload.action_id})});
}
function validateAck(ack,command){if(ack?.contract_version!==1||ack.ok!==true||ack.request_id!==command.request_id||ack.operation!=='next_action_complete'||ack.object_id!==command.object_id||ack.actor_auth_uid!==command.auth_uid||ack.actor_user_id!==command.user_id||ack.previous_version!==command.expected_version||ack.version!==command.expected_version+1||ack.next_action_id!==command.payload.action_id||!UUID.test(ack.activity_id)||!UUID.test(ack.audit_event_id)||typeof ack.completed_at!=='string'||typeof ack.replayed!=='boolean')fail('ACK_CONTRACT_MISMATCH');return ack;}
module.exports=Object.freeze({normalize,validateAck});
