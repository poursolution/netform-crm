'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const verdicts=Object.freeze({amount:'NEEDS_VERIFICATION',next_action:'DERIVED_SAFE_LOCAL_HELPER',next_action_complete:'NEEDS_VERIFICATION',activity:'DERIVED_SAFE_LOCAL_HELPER',contact:'NEEDS_VERIFICATION'});
function fail(code){const e=new Error(code);e.code=code;throw e;}
function only(p,keys){if(!p||Array.isArray(p)||typeof p!=='object'||Object.keys(p).some(k=>!keys.includes(k)))fail('UNMAPPED_PAYLOAD_FIELD');}
function id(p){if(!UUID.test(p.opportunity_id||''))fail('INVALID_OBJECT_ID');return p.opportunity_id;}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('INVALID_DUE_DATE');return v;}
function text(v,min,max,code){if(typeof v!=='string'||v.trim().length<min||v.length>max)fail(code);return v.trim();}
function next(p){only(p,['opportunity_id','type','text','due_at','assignee']);id(p);const out={type:text(p.type,1,100,'INVALID_NEXT_TYPE'),text:text(p.text,1,500,'INVALID_NEXT_TEXT'),due_at:date(p.due_at)};if(p.assignee!=null&&p.assignee!=='')out.assignee=text(p.assignee,1,100,'INVALID_ASSIGNEE');return out;}
function activity(p){only(p,['opportunity_id','type','note','result','occurred_at','meaningful_contact']);id(p);const out={type:text(p.type,1,100,'INVALID_ACTIVITY_TYPE'),note:text(p.note,1,4000,'INVALID_ACTIVITY_NOTE'),result:p.result==null?'':text(String(p.result),0,8000,'INVALID_ACTIVITY_RESULT'),occurred_at:p.occurred_at};if(typeof out.occurred_at!=='string'||!Number.isFinite(Date.parse(out.occurred_at)))fail('INVALID_OCCURRED_AT');if(p.meaningful_contact!==undefined){if(typeof p.meaningful_contact!=='boolean')fail('INVALID_MEANINGFUL_CONTACT');out.meaningful_contact=p.meaningful_contact;}return out;}
function classify(op,payload){if(op==='next_action')return Object.freeze({operation:op,object_id:id(payload),payload:Object.freeze(next(payload)),verdict:verdicts[op],requires_parent_correlation:true});if(op==='activity')return Object.freeze({operation:op,object_id:id(payload),payload:Object.freeze(activity(payload)),verdict:verdicts[op],requires_parent_correlation:true});if(Object.hasOwn(verdicts,op))fail('OP_NEEDS_VERIFICATION');fail('OP_NOT_IN_BUNDLE');}
module.exports=Object.freeze({classify,verdicts,connected_operations:Object.freeze([])});

