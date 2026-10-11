/* GENERATED from tests/pc-inquiry-fixture.cjs. Local memory-only review; no production transport. */
window.__installReviewInquiryRPC=(function install(root,id){
 const uuid=()=>root.crypto.randomUUID(),uid=uuid(),auth=uuid(),hex=n=>n.toString(16).padStart(32,'0');
 const f={rows:[],logs:new Map(),responses:new Map(),schedules:new Map(),calls:[],serial:1,guard:1,hold:'',loss:'',badAck:false,quota:false,
  state:{status:'배정완료',first_response_at:null,responded_at:null,updated_at:'2026-10-11T00:00:00.000Z'}};
 root.CRM_SCHEDULE_V1=true;root.CRMRelease={has:()=>true,noteMissing:()=>{}};
 root.Phase1={profile:{auth_uid:auth,user_id:uid},rpc:async(name,{p})=>{
  f.calls.push({name,p:structuredClone(p)});if(f.hold===name)await new Promise(r=>f.release=r);
  const lose=()=>{if(f.loss===name){f.loss='';throw Error('response lost');}};
  if(name==='crm_schedule_list_v1')return {ok:true,contract:'crm.schedule.v1',target_type:'inquiry',target_id:id,enabled:true,writable:true,version:null,token:hex(f.serial),inquiry_guard:hex(f.guard),response_state:{...f.state},owner_id:uid,actor_auth_uid:auth,actor_user_id:uid,page:p.page,per:20,total:f.rows.length,items:structuredClone(f.rows.slice((p.page-1)*20,p.page*20))};
  if(name==='crm_inquiry_command_v1'){
   if(!f.logs.has(p.request_id))f.logs.set(p.request_id,{id:uuid(),...p,actor_auth_uid:auth,actor_user_id:uid});
   const l=f.logs.get(p.request_id);lose();if(f.badAck)return {ok:true};
   return {ok:true,type:'contact_log',log_id:l.id,state:{inquiry_id:id,logs:[...f.logs.values()]}};
  }
  if(name==='crm_inquiry_response_confirm_v1'){
   if(f.responses.has(p.request_id))return {...f.responses.get(p.request_id),replayed:true};
   if(p.expected_token!==hex(f.serial))throw Error('SCHEDULE_STALE');
   f.serial++;Object.assign(f.state,{status:'전화응대 완료',first_response_at:'2026-10-11T01:00:00.000Z',responded_at:'2026-10-11T01:00:00.000Z',updated_at:'2026-10-11T01:00:00.000Z'});
   const a={ok:true,contract:'crm.inquiry-response.v1',...p,actor_auth_uid:auth,actor_user_id:uid,owner_id:uid,...f.state,stage_history_id:uuid(),inquiry_audit_event_id:uuid(),token:hex(f.serial),cancelled_action_ids:[],completed_action_ids:[]};f.responses.set(p.request_id,a);lose();return a;
  }
  if(name==='crm_schedule_receipt_v1')return {ok:true,contract:'crm.schedule.v1',request_id:p.request_id,found:f.schedules.has(p.request_id),ack:f.schedules.get(p.request_id)||null};
  if(name==='crm_schedule_write_v1'){
   if(p.expected_token!==hex(f.serial))throw Error('SCHEDULE_STALE');
   let row,before=null;
   if(p.operation==='reschedule'){
    row=f.rows.find(x=>x.id===p.action_id);if(!row||row.status!=='open')throw Error('SCHEDULE_ACTION_CONFLICT');
    if(row.date_basis==='customer_agreed'||/^\s*고객\s*약속/.test(row.title))throw Error('SCHEDULE_CUSTOMER_AGREEMENT_REQUIRED');
    before=structuredClone(row);Object.assign(row,{due_on:p.due_on,due_at:p.due_on+'T00:00:00+09:00',date_basis:p.date_basis,completed_at:null});
   }else if(p.operation==='add'){
    row={id:uuid(),inquiry_id:id,action_type:p.action_type,title:p.title,status:'open',due_on:p.due_on,due_at:p.due_on+'T00:00:00+09:00',date_basis:p.date_basis,completed_at:null};f.rows.push(row);
   }else throw Error('SCHEDULE_INVALID_INPUT');
   f.serial++;f.guard++;
   const a={ok:true,contract:'crm.schedule.v1',target_type:'inquiry',target_id:id,request_id:p.request_id,operation:p.operation,actor_auth_uid:auth,actor_user_id:uid,due_on:p.due_on,date_basis:p.date_basis,action_id:row.id,event_id:uuid(),action_status:'open',before,after:structuredClone(row),token:hex(f.serial),cancelled_action_ids:[],completed_action_ids:[]};f.schedules.set(p.request_id,a);lose();return a;
  }
  throw Error('Unexpected RPC '+name);
 }};
 f.id=id;f.uid=uid;f.auth=auth;f.mutate=()=>{f.serial++;f.guard++;};return f;
});
