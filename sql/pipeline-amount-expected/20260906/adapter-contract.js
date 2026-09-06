'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(code){const e=Error(code);e.code=code;throw e;}function object(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function money(value,nullable=false){if(nullable&&value==null)return null;if(!Number.isSafeInteger(value)||value<0||(nullable&&value===0))fail('INVALID_AMOUNT');return value;}
function normalize(objectId,expectedVersion,payload){
 if(!UUID.test(objectId)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0||!object(payload))fail('INVALID_AMOUNT');
 const allowed=['opportunity_id','amount','quote_amount','won_amount'];
 if(Object.keys(payload).some(k=>!allowed.includes(k))||payload.opportunity_id!==objectId||payload.won_amount!=null)fail('AMOUNT_INTENT_NOT_CONNECTED');
 return Object.freeze({operation:'amount',object_id:objectId,expected_version:expectedVersion,payload:Object.freeze({amount:money(payload.amount),quote_amount:money(payload.quote_amount,true),won_amount:null})});
}
function validateAck(ack,command){if(ack?.contract_version!==1||ack.ok!==true||ack.request_id!==command.request_id||ack.operation!=='amount'||ack.object_id!==command.object_id||ack.actor_auth_uid!==command.auth_uid||ack.actor_user_id!==command.user_id||ack.previous_version!==command.expected_version||ack.version!==command.expected_version+1||ack.amount!==command.payload.amount||ack.quote_amount!==command.payload.quote_amount||ack.won_amount!==null||!UUID.test(ack.audit_event_id)||typeof ack.server_at!=='string'||typeof ack.replayed!=='boolean')fail('ACK_CONTRACT_MISMATCH');return ack;}
module.exports=Object.freeze({normalize,validateAck});
