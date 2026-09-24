/* Staging-only bridge for the existing pushWrite envelope. No UI or business mutations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CrmWriteCompat=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const REF='rprechiaglyjaydkmxsu',URL_BASE='https://'+REF+'.supabase.co';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const workFields=new Set(['opportunity_id','primaryWork','workItems','workScopeType','workSummary','primary_work','work_items','work_scope_type','work_summary','work_type','reason','reason_source','actor_name','at','expected_version']);
 const inquiryFields=new Set(['inquiry_id','inquiry_row','from','to','status','reason','changed_by','actor_name','at','assignment_group','owner_group','branch_code','reporting_group','consultant_name','response']);
 function error(code,status){const e=new Error(code);e.code=code;if(status)e.status=status;return e;}
 function copy(x){return JSON.parse(JSON.stringify(x));}
 function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
 function alias(p,snake,camel){if(p[snake]!==undefined&&p[camel]!==undefined&&JSON.stringify(p[snake])!==JSON.stringify(p[camel]))throw error('PAYLOAD_ALIAS_CONFLICT');return p[snake]??p[camel];}
 function workPayloadFor(p){
  if(Object.keys(p).some(k=>!workFields.has(k)))throw error('UNMAPPED_PAYLOAD_FIELD');
  const primary=alias(p,'primary_work','primaryWork'),items=alias(p,'work_items','workItems');
  if(typeof primary!=='string'||!primary.trim()||!Array.isArray(items)||items.length<1||items.length>30||items.some(x=>typeof x!=='string'||!x.trim())||new Set(items).size!==items.length||!items.includes(primary)||typeof p.reason!=='string'||!p.reason.trim())throw error('INVALID_WORK_PAYLOAD');
  const summary=alias(p,'work_summary','workSummary'),scope=alias(p,'work_scope_type','workScopeType');
  if(typeof summary!=='string'||!summary.trim()||summary.length>2000||scope!==undefined&&scope!==(items.length===1?'single':'multi'))throw error('WORK_DISPLAY_CONTRACT_MISSING');
  if(p.reason_source!==undefined&&(typeof p.reason_source!=='string'||p.reason_source.length>200))throw error('INVALID_REASON_SOURCE');
  if(p.at!==undefined&&(typeof p.at!=='string'||p.at.length>64))throw error('INVALID_WORK_TIMESTAMP');
  // Preserve the legacy persistence inputs. Actor/scope/work_type remain server-owned or derived.
  return {primary_work:primary,work_items:copy(items),work_summary:summary,reason:p.reason,...(p.reason_source===undefined?{}:{reason_source:p.reason_source}),...(p.at===undefined?{}:{at:p.at})};
 }
 function inquiryPayloadFor(p){
  if(Object.keys(p).some(k=>!inquiryFields.has(k)))throw error('UNMAPPED_PAYLOAD_FIELD');
  // The three deferred meanings must never fall through to direct assignment.
  if(p.response!==undefined||p.to==='경남지사'||p.branch_code==='gyeongnam'||p.assignment_group==='gyeongnam'||p.owner_group==='gyeongnam')throw error('INQUIRY_INTENT_NOT_CONNECTED');
  if(typeof p.to!=='string'||!p.to.trim()||p.to.length>100)throw error('INVALID_INQUIRY_TARGET');
  if(p.reason!==undefined&&(typeof p.reason!=='string'||p.reason.trim().length<1||p.reason.length>2000))throw error('INVALID_ASSIGNMENT_REASON');
  // The database resolves this unique display name to an approved CRM user UUID.
  return {intent:'direct_assign',to_name:p.to.trim(),...(p.reason===undefined?{}:{reason:p.reason.trim()})};
 }
 function payloadFor(w){const p=w.payload;if(!p||Array.isArray(p)||typeof p!=='object')throw error('INVALID_PAYLOAD');
  if(w.op==='opportunity_work_set')return workPayloadFor(p);
  if(w.op==='inquiry_assign')return inquiryPayloadFor(p);
  throw error('OP_NOT_CONNECTED');
 }
 async function requestId(uid,writeId){const bytes=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(['crm-write',REF,1,uid,writeId]))));bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=[...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
 async function prepare(w,identity){
  if(identity?.project_ref!==REF||!UUID.test(identity.auth_uid)||!UUID.test(identity.user_id))throw error('QUEUE_IDENTITY_REQUIRED');
  if(typeof w?.write_id!=='string'||!w.write_id||w.write_id.length>200)throw error('WRITE_ID_REQUIRED');
  const payload=payloadFor(w),id=w.op==='opportunity_work_set'?w.payload.opportunity_id:w.payload.inquiry_id;
  if(!UUID.test(id)||(w.opportunity_id&&w.opportunity_id!==id))throw error('OBJECT_ID_MISMATCH');
  // Inquiry assignment has no row version today; zero is a receipt-contract sentinel only.
  const version=w.op==='inquiry_assign'?0:identity.expected_version;
  if(w.op==='opportunity_work_set'&&(!Number.isSafeInteger(version)||version<0))throw error('READ_VERSION_REQUIRED');
  if(w.op==='opportunity_work_set'&&w.payload.expected_version!==undefined&&w.payload.expected_version!==version)throw error('VERSION_MISMATCH');
  return freeze({format:1,project_ref:REF,auth_uid:identity.auth_uid,user_id:identity.user_id,write_id:w.write_id,
   rpc:{p_request_id:await requestId(identity.auth_uid,w.write_id),p_operation:w.op,p_object_id:id,p_expected_version:version,p_payload:payload}});
 }
 function validateAck(a,q){const r=q.rpc;
  if(a?.ok!==true||a.contract_version!==1||a.request_id!==r.p_request_id||a.operation!==r.p_operation||a.object_id!==r.p_object_id||a.actor_auth_uid!==q.auth_uid||a.actor_user_id!==q.user_id||typeof a.replayed!=='boolean')throw error('ACK_MISMATCH');
  if(r.p_operation==='opportunity_work_set'&&(a.previous_version!==r.p_expected_version||a.version!==r.p_expected_version+1||!UUID.test(a.audit_event_id)))throw error('ACK_MISMATCH');
  if(r.p_operation==='inquiry_assign'&&(a.intent!=='direct_assign'||!UUID.test(a.assigned_to)||typeof a.status!=='string'||typeof a.changed!=='boolean'||(a.changed&&!UUID.test(a.inquiry_audit_event_id))))throw error('ACK_MISMATCH');
  return {...a,write_id:q.write_id}; // Preserve the legacy ACK consumer; never invent ok/server IDs.
 }
 function create(options){if(options?.project_ref!==REF||options.url!==URL_BASE||typeof options.publishable_key!=='string'||!options.publishable_key.startsWith('sb_publishable_')||typeof options.auth?.getSession!=='function')throw error('STAGING_CONFIG_REQUIRED');
  const perform=options.fetch||globalThis.fetch;
  async function session(){const r=await options.auth.getSession(),s=r?.data?.session;if(r?.error||!s?.access_token||!UUID.test(s.user?.id))throw error('AUTH_REQUIRED');return s;}
  async function send(prepared){const q=copy(prepared);if(q.format!==1||q.project_ref!==REF||!['opportunity_work_set','inquiry_assign'].includes(q.rpc?.p_operation)||!UUID.test(q.user_id))throw error('INVALID_PREPARED_COMMAND');
   if(q.rpc.p_request_id!==await requestId(q.auth_uid,q.write_id))throw error('REQUEST_ID_MISMATCH');
   const s=await session();if(s.user.id!==q.auth_uid)throw error('QUEUE_IDENTITY_MISMATCH');
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);let response;
   try{response=await perform(URL_BASE+'/rest/v1/rpc/crm_write_command_v2',{method:'POST',cache:'no-store',redirect:'error',signal:controller.signal,headers:{apikey:options.publishable_key,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify(q.rpc)});
    if((await session()).user.id!==q.auth_uid)throw error('IDENTITY_CHANGED');
    if(!response.ok)throw error(response.status===409?'WRITE_CONFLICT':'WRITE_HTTP_'+response.status,response.status);
    let a;try{a=await response.json();}catch{throw error('ACK_UNREADABLE');}
    if((await session()).user.id!==q.auth_uid)throw error('IDENTITY_CHANGED');return validateAck(a,q);
   }finally{clearTimeout(timer);}
  }
  return Object.freeze({prepare,send,response:async q=>new Response(JSON.stringify(await send(q)),{status:200,headers:{'Content-Type':'application/json'}})});
 }
 return Object.freeze({prepare,create,validateAck,project_ref:REF,connected_operations:Object.freeze(['opportunity_work_set','inquiry_assign'])});
});
