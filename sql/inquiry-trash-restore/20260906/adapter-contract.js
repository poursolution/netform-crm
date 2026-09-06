'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,REASONS=new Set(['중복 문의','테스트 문의','스팸','잘못된 연락처','관련 없는 문의','기타']);
function fail(code){const e=Error(code);e.code=code;throw e;}function object(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function normalize(operation,objectId,expectedVersion,payload){
 if(!['inquiry_trash','inquiry_restore'].includes(operation)||!UUID.test(objectId)||expectedVersion!==0||!object(payload)||payload.inquiry_id!==objectId)fail('INVALID_INQUIRY_TRASH_COMMAND');
 if(operation==='inquiry_trash'){
  const allowed=['inquiry_id','deleted_at','deleted_by','delete_reason','delete_note','purge_at','archive_protected'];
  if(Object.keys(payload).some(k=>!allowed.includes(k))||!REASONS.has(payload.delete_reason)||!(payload.delete_note==null||typeof payload.delete_note==='string')||String(payload.delete_note||'').length>2000)fail('INQUIRY_TRASH_INTENT_NOT_CONNECTED');
  return Object.freeze({operation,object_id:objectId,expected_version:0,payload:Object.freeze({delete_reason:payload.delete_reason,delete_note:String(payload.delete_note||'').trim()||null})});
 }
 const allowed=['inquiry_id','restored_at','restored_by'];
 if(Object.keys(payload).some(k=>!allowed.includes(k)))fail('INQUIRY_RESTORE_INTENT_NOT_CONNECTED');
 return Object.freeze({operation,object_id:objectId,expected_version:0,payload:Object.freeze({intent:'restore'})});
}
function validateAck(ack,command){
 if(ack?.contract_version!==1||ack.ok!==true||ack.request_id!==command.request_id||ack.operation!==command.operation||ack.object_id!==command.object_id||ack.actor_auth_uid!==command.auth_uid||ack.actor_user_id!==command.user_id||typeof ack.replayed!=='boolean'||!UUID.test(ack.inquiry_audit_event_id))fail('ACK_CONTRACT_MISMATCH');
 if(command.operation==='inquiry_trash'&&(ack.valid_inquiry!==false||ack.delete_reason!==command.payload.delete_reason||ack.delete_note!==command.payload.delete_note||typeof ack.deleted_at!=='string'||typeof ack.deleted_by!=='string'||typeof ack.purge_at!=='string'||typeof ack.archive_protected!=='boolean'))fail('ACK_CONTRACT_MISMATCH');
 if(command.operation==='inquiry_restore'&&(ack.valid_inquiry!==true||typeof ack.restored_at!=='string'||typeof ack.restored_by!=='string'))fail('ACK_CONTRACT_MISMATCH');
 return ack;
}
module.exports=Object.freeze({normalize,validateAck,REASONS});
