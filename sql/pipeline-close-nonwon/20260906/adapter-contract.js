'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUTCOMES=new Set(['lost','badfit','nocontact']),STRUCTURED_OUTCOMES=new Set(['lost','badfit_lead','nocontact']);
function fail(code){const e=Error(code);e.code=code;throw e;}function object(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function text(x,max,required=true){return typeof x==='string'&&x.length<=max&&(!required||x.trim().length>0);}
function normalize(objectId,expectedVersion,payload){
 if(!UUID.test(objectId)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0||!object(payload))fail('INVALID_CLOSE');
 let from,outcome,closedDate,category,detail,reasonSource,note;
 if(object(payload.stage_context)){
  const allowed=['opportunity_id','from','to','stage_code','at','transition_date','note','reason','stage_context','stage_contexts','contract_amount','completion_date','outcome','closed_at','won_amount'];
  const s=payload.stage_context,f=s.fields;
  if(Object.keys(payload).some(k=>!allowed.includes(k))||payload.opportunity_id!==objectId||!object(f)||Object.keys(f).some(k=>!['close_reason','close_detail'].includes(k))||!STRUCTURED_OUTCOMES.has(payload.to)||payload.outcome!==payload.to||payload.to==='won'||payload.stage_code!==payload.from||s.from!==payload.from||s.to!==payload.to||s.transition_date!==payload.transition_date||s.terminal!==true||payload.won_amount!==null||payload.contract_amount!==undefined||payload.completion_date!==undefined)fail('CLOSE_INTENT_NOT_CONNECTED');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(payload.transition_date)||!text(f.close_reason,500)||!text(f.close_detail,8000)||!text(payload.note,16000))fail('INVALID_CLOSE');
  from=payload.from;outcome=payload.to==='badfit_lead'?'badfit':payload.to;closedDate=payload.transition_date;category=f.close_reason.trim();detail=f.close_detail.trim();reasonSource='structured';note=payload.note.trim();
 }else{
  const allowed=['opportunity_id','outcome','reason','reason_source','stage_code','closed_at'];
  if(Object.keys(payload).some(k=>!allowed.includes(k))||payload.opportunity_id!==objectId||!OUTCOMES.has(payload.outcome)||!text(payload.stage_code,100)||!text(payload.reason,8500)||!text(payload.reason_source,50)||!text(payload.closed_at,100))fail('CLOSE_INTENT_NOT_CONNECTED');
  const split=payload.reason.indexOf(' · ');if(split<1)fail('INVALID_CLOSE');
  from=payload.stage_code;outcome=payload.outcome;closedDate=null;category=payload.reason.slice(0,split).trim();detail=payload.reason.slice(split+3).trim();reasonSource=payload.reason_source.trim();note=payload.reason.trim();
  if(!text(category,500)||!text(detail,8000)||detail.length<5)fail('INVALID_CLOSE');
 }
 return Object.freeze({operation:'close',object_id:objectId,expected_version:expectedVersion,payload:Object.freeze({from,outcome,closed_date:closedDate,category,detail,reason_source:reasonSource,note})});
}
function validateAck(ack,command){if(ack?.contract_version!==1||ack.ok!==true||ack.request_id!==command.request_id||ack.operation!=='close'||ack.object_id!==command.object_id||ack.actor_auth_uid!==command.auth_uid||ack.actor_user_id!==command.user_id||ack.previous_version!==command.expected_version||ack.version!==command.expected_version+1||ack.from_stage!==command.payload.from||ack.outcome!==command.payload.outcome||ack.lifecycle_status!=='closed'||!UUID.test(ack.close_event_id)||!UUID.test(ack.stage_history_id)||!UUID.test(ack.activity_id)||!UUID.test(ack.audit_event_id)||!Array.isArray(ack.completed_action_ids)||!ack.stage_contexts||typeof ack.stage_contexts!=='object'||typeof ack.closed_at!=='string'||typeof ack.server_at!=='string'||typeof ack.replayed!=='boolean')fail('ACK_CONTRACT_MISMATCH');return ack;}
module.exports=Object.freeze({normalize,validateAck,OUTCOMES,STRUCTURED_OUTCOMES});
