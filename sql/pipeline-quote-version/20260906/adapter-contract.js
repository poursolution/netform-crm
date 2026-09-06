'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(code){const e=Error(code);e.code=code;throw e;}
function normalize(objectId,expectedVersion,payload){
 if(!UUID.test(objectId)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0||!payload||typeof payload!=='object'||Array.isArray(payload))fail('INVALID_QUOTE_VERSION');
 if(Object.keys(payload).some(k=>!['opportunity_id','version_no','amount','reason','created_at','created_by'].includes(k))||payload.opportunity_id!==objectId||!Number.isSafeInteger(payload.amount)||payload.amount<=0||typeof payload.reason!=='string'||payload.reason.trim().length<2||payload.reason.length>2000)fail('INVALID_QUOTE_VERSION');
 return Object.freeze({operation:'quote_version',object_id:objectId,expected_version:expectedVersion,payload:Object.freeze({amount:payload.amount,reason:payload.reason.trim()})});
}
function validateAck(ack,command){if(ack?.contract_version!==1||ack.ok!==true||ack.request_id!==command.request_id||ack.operation!=='quote_version'||ack.object_id!==command.object_id||ack.actor_auth_uid!==command.auth_uid||ack.actor_user_id!==command.user_id||ack.previous_version!==command.expected_version||ack.version!==command.expected_version+1||!UUID.test(ack.quote_version_id)||!Number.isSafeInteger(ack.version_no)||ack.version_no<1||ack.amount!==command.payload.amount||!UUID.test(ack.audit_event_id)||typeof ack.replayed!=='boolean')fail('ACK_CONTRACT_MISMATCH');return ack;}
module.exports=Object.freeze({normalize,validateAck});
