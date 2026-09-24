'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(code){const e=Error(code);e.code=code;throw e;}
function normalize(operation,objectId,expectedVersion,payload){
 if(operation!=='inquiry_purge'||!UUID.test(objectId)||expectedVersion!==0||!payload||typeof payload!=='object'||Array.isArray(payload)||payload.inquiry_id!==objectId)fail('INVALID_INQUIRY_PURGE_COMMAND');
 const allowed=['inquiry_id','purged_at','purged_by'];
 if(Object.keys(payload).some(k=>!allowed.includes(k)))fail('INQUIRY_PURGE_INTENT_NOT_CONNECTED');
 return Object.freeze({operation,object_id:objectId,expected_version:0,payload:Object.freeze({intent:'purge'})});
}
function validateAck(ack,command){
 if(ack?.contract_version!==1||ack.ok!==true||ack.request_id!==command.request_id||ack.operation!=='inquiry_purge'||ack.object_id!==command.object_id||ack.actor_auth_uid!==command.auth_uid||ack.actor_user_id!==command.user_id||ack.purged!==true||typeof ack.purged_at!=='string'||typeof ack.purged_by!=='string'||typeof ack.replayed!=='boolean'||!UUID.test(ack.inquiry_audit_event_id))fail('ACK_CONTRACT_MISMATCH');
 for(const k of ['removed_scope_count','cascaded_assignment_history_count','cascaded_next_action_count','cascaded_stage_history_count'])if(!Number.isInteger(ack[k])||ack[k]<0)fail('ACK_CONTRACT_MISMATCH');
 return ack;
}
module.exports=Object.freeze({normalize,validateAck});
