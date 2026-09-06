/* Local-only candidate: adds inquiry_unassign and service_change without mutating UI/frozen adapter. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CrmWriteCompatOperationalCandidate=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const REF='rprechiaglyjaydkmxsu',URL_BASE='https://'+REF+'.supabase.co';
 const DISPATCHER='crm_write_command_v2';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const CONNECTED=Object.freeze(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change']);
 const workFields=new Set(['opportunity_id','primaryWork','workItems','workScopeType','workSummary','primary_work','work_items','work_scope_type','work_summary','work_type','reason','reason_source','actor_name','at','expected_version']);
 const inquiryFields=new Set(['inquiry_id','inquiry_row','from','to','status','reason','changed_by','actor_name','at','assignment_group','owner_group','branch_code','reporting_group','consultant_name','response']);
 const unassignFields=new Set(['inquiry_id','from','reason','changed_by','actor_name','at','status']);
 const serviceFields=new Set(['opportunity_id','from_service','to_service','origin_channel','reason','reason_source','next_action','next_due','actor_id','actor_name','changed_by','at','expected_version']);
 function error(code,status){const e=new Error(code);e.code=code;if(status)e.status=status;return e;}
 function copy(x){return JSON.parse(JSON.stringify(x));}
 function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
 function only(p,fields){if(Object.keys(p).some(k=>!fields.has(k)))throw error('UNMAPPED_PAYLOAD_FIELD');}
 function alias(p,snake,camel){if(p[snake]!==undefined&&p[camel]!==undefined&&JSON.stringify(p[snake])!==JSON.stringify(p[camel]))throw error('PAYLOAD_ALIAS_CONFLICT');return p[snake]??p[camel];}
 function optionalText(value,max,code){if(value===undefined||value===null||value==='')return undefined;if(typeof value!=='string'||value.length>max)throw error(code);return value.trim()||undefined;}
 function workPayloadFor(p){
  only(p,workFields);
  const primary=alias(p,'primary_work','primaryWork'),items=alias(p,'work_items','workItems');
  if(typeof primary!=='string'||!primary.trim()||!Array.isArray(items)||items.length<1||items.length>30||items.some(x=>typeof x!=='string'||!x.trim())||new Set(items).size!==items.length||!items.includes(primary)||typeof p.reason!=='string'||!p.reason.trim())throw error('INVALID_WORK_PAYLOAD');
  const summary=alias(p,'work_summary','workSummary'),scope=alias(p,'work_scope_type','workScopeType');
  if(typeof summary!=='string'||!summary.trim()||summary.length>2000||scope!==undefined&&scope!==(items.length===1?'single':'multi'))throw error('WORK_DISPLAY_CONTRACT_MISSING');
  if(p.reason_source!==undefined&&(typeof p.reason_source!=='string'||p.reason_source.length>200))throw error('INVALID_REASON_SOURCE');
  if(p.at!==undefined&&(typeof p.at!=='string'||p.at.length>64))throw error('INVALID_WORK_TIMESTAMP');
  // Frozen work semantics retain the already approved persistence inputs.
  return {primary_work:primary,work_items:copy(items),work_summary:summary,reason:p.reason,...(p.reason_source===undefined?{}:{reason_source:p.reason_source}),...(p.at===undefined?{}:{at:p.at})};
 }
 function inquiryPayloadFor(p){
  only(p,inquiryFields);
  if(p.response!==undefined||p.to==='경남지사'||p.branch_code==='gyeongnam'||p.assignment_group==='gyeongnam'||p.owner_group==='gyeongnam')throw error('INQUIRY_INTENT_NOT_CONNECTED');
  if(typeof p.to!=='string'||!p.to.trim()||p.to.length>100)throw error('INVALID_INQUIRY_TARGET');
  if(p.reason!==undefined&&(typeof p.reason!=='string'||p.reason.trim().length<1||p.reason.length>2000))throw error('INVALID_ASSIGNMENT_REASON');
  return {intent:'direct_assign',to_name:p.to.trim(),...(p.reason===undefined?{}:{reason:p.reason.trim()})};
 }
 function unassignPayloadFor(p){
  only(p,unassignFields);
  if(typeof p.reason!=='string'||p.reason.trim().length<1||p.reason.length>2000)throw error('INVALID_UNASSIGN_REASON');
  // from/status/actor/time are UI display evidence only; the RPC reads them from the row/session.
  return {reason:p.reason.trim()};
 }
 function servicePayloadFor(p){
  only(p,serviceFields);
  if(typeof p.to_service!=='string'||!p.to_service.trim()||p.to_service.length>100)throw error('INVALID_SERVICE_TARGET');
  if(typeof p.reason!=='string'||p.reason.trim().length<5||p.reason.length>2000)throw error('INVALID_SERVICE_REASON');
  const source=optionalText(p.reason_source,200,'INVALID_REASON_SOURCE');
  const next=optionalText(p.next_action,500,'INVALID_NEXT_ACTION');
  let due;
  if(next&&p.next_due!==undefined&&p.next_due!==null&&p.next_due!==''){
   if(typeof p.next_due!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.next_due))throw error('INVALID_NEXT_DUE');
   due=p.next_due;
  }
  // A PC form always carries its default date. Without next_action it is not an intent.
  return {to_service:p.to_service.trim(),reason:p.reason.trim(),...(source?{reason_source:source}:{}),...(next?{next_action:next}:{}),...(due?{next_due:due}:{})};
 }
 function operationOf(q){return q.rpc?.p_operation;}
 function objectOf(q){return q.rpc?.p_object_id;}
 function requestOf(q){return q.rpc?.p_request_id;}
 function expectedOf(q){return q.rpc?.p_expected_version;}
 function payloadOf(q){return q.rpc?.p_payload;}
 function stable(x){if(Array.isArray(x))return x.map(stable);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])]));return x;}
 function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
 function canonicalPreparedPayload(operation,p){
  if(operation==='opportunity_work_set')return workPayloadFor(p);
  if(operation==='inquiry_unassign')return unassignPayloadFor(p);
  if(operation==='service_change')return servicePayloadFor(p);
  if(operation==='inquiry_assign'){
   only(p,new Set(['intent','to_name','reason']));
   if(p.intent!=='direct_assign'||typeof p.to_name!=='string'||!p.to_name.trim()||p.to_name.length>100||p.to_name!==p.to_name.trim())throw error('INVALID_PREPARED_COMMAND');
   if(p.reason!==undefined&&(typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>2000||p.reason!==p.reason.trim()))throw error('INVALID_PREPARED_COMMAND');
   return {intent:'direct_assign',to_name:p.to_name,...(p.reason===undefined?{}:{reason:p.reason})};
  }
  throw error('OP_NOT_CONNECTED');
 }
 function payloadFor(w){const p=w.payload;if(!p||Array.isArray(p)||typeof p!=='object')throw error('INVALID_PAYLOAD');
  if(w.op==='opportunity_work_set')return workPayloadFor(p);
  if(w.op==='inquiry_assign')return inquiryPayloadFor(p);
  if(w.op==='inquiry_unassign')return unassignPayloadFor(p);
  if(w.op==='service_change')return servicePayloadFor(p);
  throw error('OP_NOT_CONNECTED');
 }
 async function requestId(uid,writeId){const bytes=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(['crm-write',REF,1,uid,writeId]))));bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=[...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
 async function prepare(w,identity){
  if(identity?.project_ref!==REF||!UUID.test(identity.auth_uid)||!UUID.test(identity.user_id))throw error('QUEUE_IDENTITY_REQUIRED');
  if(typeof w?.write_id!=='string'||!w.write_id||w.write_id.length>200)throw error('WRITE_ID_REQUIRED');
  const payload=payloadFor(w),inquiryOp=w.op==='inquiry_assign'||w.op==='inquiry_unassign';
  const id=inquiryOp?w.payload.inquiry_id:w.payload.opportunity_id;
  if(!UUID.test(id)||(w.opportunity_id&&w.opportunity_id!==id))throw error('OBJECT_ID_MISMATCH');
  const version=inquiryOp?0:identity.expected_version;
  if(!inquiryOp&&(!Number.isSafeInteger(version)||version<0))throw error('READ_VERSION_REQUIRED');
  if(!inquiryOp&&w.payload.expected_version!==undefined&&w.payload.expected_version!==version)throw error('VERSION_MISMATCH');
  const rid=await requestId(identity.auth_uid,w.write_id);
  return freeze({format:1,project_ref:REF,auth_uid:identity.auth_uid,user_id:identity.user_id,write_id:w.write_id,rpc:{p_request_id:rid,p_operation:w.op,p_object_id:id,p_expected_version:version,p_payload:payload}});
 }
 function validateAck(a,q){const operation=operationOf(q),object=objectOf(q),expected=expectedOf(q),payload=payloadOf(q);
  if(a?.ok!==true||a.contract_version!==1||a.request_id!==requestOf(q)||a.operation!==operation||a.object_id!==object||a.actor_auth_uid!==q.auth_uid||a.actor_user_id!==q.user_id||typeof a.replayed!=='boolean')throw error('ACK_MISMATCH');
  if(operation==='opportunity_work_set'&&(a.previous_version!==expected||a.version!==expected+1||!UUID.test(a.audit_event_id)))throw error('ACK_MISMATCH');
  if(operation==='inquiry_assign'&&(a.intent!=='direct_assign'||!UUID.test(a.assigned_to)||typeof a.status!=='string'||typeof a.changed!=='boolean'||(a.changed&&!UUID.test(a.inquiry_audit_event_id))))throw error('ACK_MISMATCH');
  if(operation==='inquiry_unassign'&&(a.assigned_to!==null||typeof a.status!=='string'||typeof a.changed!=='boolean'||(a.changed&&!UUID.test(a.inquiry_audit_event_id))||(!a.changed&&a.inquiry_audit_event_id!=null)))throw error('ACK_MISMATCH');
  if(operation==='service_change'&&(a.previous_version!==expected||a.version!==expected+1||a.to_service!==payload.to_service||(a.from_service!==null&&typeof a.from_service!=='string')||a.business_history_id==null||!UUID.test(a.activity_id)||!UUID.test(a.audit_event_id)||(payload.next_action?!UUID.test(a.next_action_id):a.next_action_id!=null)))throw error('ACK_MISMATCH');
  return {...a,write_id:q.write_id};
 }
 function validatePrepared(q){const operation=operationOf(q),object=objectOf(q);
  if(q?.format!==1||q.project_ref!==REF||!CONNECTED.includes(operation)||!UUID.test(q.auth_uid)||!UUID.test(q.user_id)||!UUID.test(object)||!UUID.test(requestOf(q))||!payloadOf(q)||Array.isArray(payloadOf(q))||typeof payloadOf(q)!=='object')throw error('INVALID_PREPARED_COMMAND');
  if(Object.keys(q.rpc).sort().join(',')!=='p_expected_version,p_object_id,p_operation,p_payload,p_request_id')throw error('INVALID_PREPARED_COMMAND');
  if((['inquiry_assign','inquiry_unassign'].includes(operation)&&q.rpc.p_expected_version!==0)||(!['inquiry_assign','inquiry_unassign'].includes(operation)&&(!Number.isSafeInteger(q.rpc.p_expected_version)||q.rpc.p_expected_version<0)))throw error('INVALID_PREPARED_COMMAND');
  let canonical;try{canonical=canonicalPreparedPayload(operation,payloadOf(q));}catch{throw error('INVALID_PREPARED_COMMAND');}
  if(!same(canonical,payloadOf(q)))throw error('INVALID_PREPARED_COMMAND');
 }
 function create(options){if(options?.project_ref!==REF||options.url!==URL_BASE||typeof options.publishable_key!=='string'||!options.publishable_key.startsWith('sb_publishable_')||typeof options.auth?.getSession!=='function')throw error('STAGING_CONFIG_REQUIRED');
  const perform=options.fetch||globalThis.fetch;
  async function session(){const r=await options.auth.getSession(),s=r?.data?.session;if(r?.error||!s?.access_token||!UUID.test(s.user?.id))throw error('AUTH_REQUIRED');return s;}
  async function send(prepared){const q=copy(prepared);validatePrepared(q);if(requestOf(q)!==await requestId(q.auth_uid,q.write_id))throw error('REQUEST_ID_MISMATCH');
   const s=await session();if(s.user.id!==q.auth_uid)throw error('QUEUE_IDENTITY_MISMATCH');
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);let response;
   try{response=await perform(URL_BASE+'/rest/v1/rpc/'+DISPATCHER,{method:'POST',cache:'no-store',redirect:'error',signal:controller.signal,headers:{apikey:options.publishable_key,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify(q.rpc)});
    if((await session()).user.id!==q.auth_uid)throw error('IDENTITY_CHANGED');
    if(!response.ok)throw error(response.status===409?'WRITE_CONFLICT':'WRITE_HTTP_'+response.status,response.status);
    let a;try{a=await response.json();}catch{throw error('ACK_UNREADABLE');}
    if((await session()).user.id!==q.auth_uid)throw error('IDENTITY_CHANGED');return validateAck(a,q);
   }finally{clearTimeout(timer);}
  }
  return Object.freeze({prepare,send,response:async q=>new Response(JSON.stringify(await send(q)),{status:200,headers:{'Content-Type':'application/json'}})});
 }
 return Object.freeze({prepare,create,validateAck,project_ref:REF,connected_operations:CONNECTED,endpoints:Object.freeze({dispatcher:DISPATCHER})});
});
