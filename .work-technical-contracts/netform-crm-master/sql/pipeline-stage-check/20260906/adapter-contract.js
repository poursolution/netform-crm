'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MANUAL=Object.freeze({
 first_contact:Object.freeze({1:'공사 예정시기 확인',3:'예산·견적 필요 여부 확인'}),
 consulting:Object.freeze({3:'견적 작성 요청'}),sent:Object.freeze({1:'자료 수신 확인',2:'검토 일정 확인'}),
 rapport:Object.freeze({2:'예산·회의 시점 확인'}),silent:Object.freeze({1:'진행·보류 여부 확인'}),
 waiting:Object.freeze({0:'대기 사유 기록',1:'재개 조건 확인'}),compete:Object.freeze({0:'경쟁업체 여부 확인',1:'PT·현설 일정 확인'}),
 imminent:Object.freeze({0:'공사 예정일 확인',1:'현설·회의 일정 확인'}),bidding:Object.freeze({0:'입찰조건 확인',1:'제출서류 확인',2:'예상 낙찰가 확인'}),
 contract:Object.freeze({0:'계약조건 확인',3:'착수 일정 확인'}),construction:Object.freeze({1:'현장 이슈 확인'}),
 completion:Object.freeze({0:'준공검사 확인',2:'미해결 사항 확인'})
});
function fail(code){const e=Error(code);e.code=code;throw e;}
function normalize(objectId,expectedVersion,payload){
 if(!UUID.test(objectId)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0||!payload||typeof payload!=='object'||Array.isArray(payload))fail('INVALID_STAGE_CHECK');
 if(Object.keys(payload).some(k=>!['opportunity_id','stage_code','item_index','item_text','checked'].includes(k))||payload.opportunity_id!==objectId||typeof payload.stage_code!=='string'||!Number.isSafeInteger(payload.item_index)||typeof payload.checked!=='boolean')fail('INVALID_STAGE_CHECK');
 const label=MANUAL[payload.stage_code]?.[payload.item_index];if(!label||payload.item_text!==label)fail('STAGE_CHECK_ITEM_NOT_MANUAL');
 return Object.freeze({operation:'stage_check',object_id:objectId,expected_version:expectedVersion,payload:Object.freeze({stage_code:payload.stage_code,item_index:payload.item_index,checked:payload.checked})});
}
function validateAck(ack,command){if(ack?.contract_version!==1||ack.ok!==true||ack.request_id!==command.request_id||ack.operation!=='stage_check'||ack.object_id!==command.object_id||ack.actor_auth_uid!==command.auth_uid||ack.actor_user_id!==command.user_id||ack.previous_version!==command.expected_version||ack.version!==command.expected_version+1||ack.stage_code!==command.payload.stage_code||ack.item_index!==command.payload.item_index||ack.checked!==command.payload.checked||typeof ack.item_text!=='string'||!ack.stage_checklist||typeof ack.stage_checklist!=='object'||!UUID.test(ack.audit_event_id)||typeof ack.server_at!=='string'||typeof ack.replayed!=='boolean')fail('ACK_CONTRACT_MISMATCH');return ack;}
module.exports=Object.freeze({MANUAL,normalize,validateAck});
