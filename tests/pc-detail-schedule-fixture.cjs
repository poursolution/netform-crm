'use strict';
// Synthetic RPC boundary for the real PC ContactEntry -> ScheduleFlow path.
// Activity queue ACKs remain owned by the browser test; this fixture only models
// server schedule versions/tokens, receipt recovery and unchanged open actions.
module.exports=function installPCDetailSchedule(){
 const auth='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const prior=window.Phase1,servers=new Map(),applied=new Set();
 window.__scheduleWrites=[];window.__scheduleCalls=[];window.__scheduleLoss=false;
 window.CRM_SCHEDULE_V1=true;window.CRMRelease={has:()=>true,noteMissing(){}};
 const clone=x=>JSON.parse(JSON.stringify(x));
 function server(id){
  if(!servers.has(id)){
   const d=B.deals.find(x=>x.id===id);if(!d)throw Error('UNKNOWN_SYNTHETIC_DEAL');
   d.version=Number.isInteger(d.version)?d.version:0;
   const n=d.nextActionObj||d.next_action;
   servers.set(id,{version:d.version,serial:1,receipts:new Map(),items:n?[{id:n.id,action_type:n.type||'전화',title:n.text,due_on:n.due,due_at:n.due_at||n.due+'T00:00:00+09:00',status:'open',date_basis:n.date_basis||'unconfirmed'}]:[]});
  }
  return servers.get(id);
 }
 const token=s=>s.serial.toString(16).padStart(32,'0');
 const flush=prior.queue.flush;
 prior.queue.flush=async()=>{
  await flush();
  for(const row of __ops){
   if(row.operation!=='activity'||applied.has(row.request_id))continue;
   const s=server(row.object_id);if(row.ack.previous_version!==s.version)throw Error('ACTIVITY_VERSION_CONFLICT');
   s.version=row.ack.version;s.serial++;applied.add(row.request_id);
  }
 };
 window.Phase1={...prior,profile:{auth_uid:auth,user_id:user},queue:prior.queue,rpc:async(name,{p})=>{
  __scheduleCalls.push({name,p:clone(p)});const s=server(p.target_id);
  if(name==='crm_schedule_list_v1')return {ok:true,contract:'crm.schedule.v1',target_type:'deal',target_id:p.target_id,actor_auth_uid:auth,actor_user_id:user,owner_id:user,version:s.version,enabled:true,writable:true,token:token(s),page:p.page,per:20,total:s.items.length,items:clone(s.items.slice((p.page-1)*20,p.page*20))};
  if(name==='crm_schedule_receipt_v1')return {ok:true,contract:'crm.schedule.v1',request_id:p.request_id,found:s.receipts.has(p.request_id),ack:s.receipts.get(p.request_id)||null};
  if(name!=='crm_schedule_write_v1')throw Error('UNEXPECTED_SYNTHETIC_RPC '+name);
  if(s.receipts.has(p.request_id))return s.receipts.get(p.request_id);
  if(p.expected_token!==token(s))throw Error('SCHEDULE_STALE');
  __scheduleWrites.push(clone(p));let row,before=null;
  if(p.operation==='reschedule'){
   row=s.items.find(n=>n.id===p.action_id);if(!row)throw Error('SCHEDULE_ACTION_CONFLICT');
   if(row.date_basis==='customer_agreed')throw Error('SCHEDULE_CUSTOMER_AGREEMENT_REQUIRED');
   before=clone(row);
  }else if(p.operation==='add'){row={id:crypto.randomUUID(),deal_id:p.target_id,action_type:p.action_type,title:p.title,status:'open'};s.items.push(row);}
  else throw Error('UNEXPECTED_SCHEDULE_OPERATION');
  Object.assign(row,{due_on:p.due_on,due_at:p.due_on+'T00:00:00+09:00',date_basis:p.date_basis,completed_at:null});
  s.items.sort((a,b)=>a.due_on.localeCompare(b.due_on)||a.id.localeCompare(b.id));s.version++;s.serial++;
  const ack={ok:true,contract:'crm.schedule.v1',request_id:p.request_id,target_type:'deal',target_id:p.target_id,operation:p.operation,actor_auth_uid:auth,actor_user_id:user,due_on:p.due_on,date_basis:p.date_basis,action_id:row.id,event_id:crypto.randomUUID(),action_status:'open',before,after:clone(row),token:token(s),cancelled_action_ids:[],completed_action_ids:[]};
  s.receipts.set(p.request_id,ack);if(__scheduleLoss){__scheduleLoss=false;throw Error('합성 일정 응답 유실');}return ack;
 }};
 window.__scheduleServer=id=>server(id);
};
