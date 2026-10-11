// Synthetic RPC boundary only. Real forms, shared plan, flow, contract and ACK checks run in browser.
module.exports=function installSchedule(d){
 const id=d.id,uid=Phase1.profile.user_id,auid=Phase1.profile.auth_uid;
 d.version=0;window.CRM_SCHEDULE_V1=true;window.CRMRelease={has:()=>true};
 const n=d.next_action||d.nextActionObj||d.nextAction;
 window.__scheduleWrites=[];window.__failSchedule=false;
 window.__server={version:0,serial:1,events:{},items:n?[{id:n.id,action_type:n.type,title:n.text,due_on:n.due,due_at:n.due_at,status:'open',date_basis:'unconfirmed'}]:[]};
 const token=()=>__server.serial.toString(16).padStart(32,'0');
 const flush=Phase1.queue.flush;
 Phase1.queue.flush=async()=>{const before=new Set(__ops.filter(o=>o.q.status==='done').map(o=>o.q.request_id));await flush();for(const o of __ops)if(o.q.status==='done'&&!before.has(o.q.request_id)){__server.version=o.q.ack.version;__server.serial++;}};
 Phase1.rpc=async(name,{p})=>{
  const s=__server;
  if(name==='crm_schedule_list_v1')return {ok:true,contract:'crm.schedule.v1',target_type:'deal',target_id:id,actor_auth_uid:auid,actor_user_id:uid,owner_id:uid,version:s.version,enabled:true,writable:true,token:token(),page:p.page,per:20,total:s.items.length,items:structuredClone(s.items.slice((p.page-1)*20,p.page*20))};
  if(name==='crm_schedule_receipt_v1')return {ok:true,contract:'crm.schedule.v1',request_id:p.request_id,found:!!s.events[p.request_id],ack:s.events[p.request_id]||null};
  if(name!=='crm_schedule_write_v1')throw Error('Unexpected RPC '+name);
  if(p.expected_token!==token())throw Error('SCHEDULE_STALE');
  __scheduleWrites.push(structuredClone(p));let r;
  if(p.operation==='reschedule'){r=s.items.find(n=>n.id===p.action_id);if(!r)throw Error('Wrong action');}
  else{r={id:crypto.randomUUID(),action_type:p.action_type,title:p.title,status:'open'};s.items.push(r);}
  r.due_on=p.due_on;r.due_at=p.due_on+'T00:00:00+09:00';r.date_basis=p.date_basis;
  s.items.sort((a,b)=>a.due_on.localeCompare(b.due_on)||a.id.localeCompare(b.id));s.version++;s.serial++;
  const ack={ok:true,contract:'crm.schedule.v1',request_id:p.request_id,target_type:'deal',target_id:id,operation:p.operation,actor_auth_uid:auid,actor_user_id:uid,due_on:p.due_on,date_basis:p.date_basis,action_id:r.id,event_id:crypto.randomUUID(),action_status:'open',after:{id:r.id,deal_id:id,status:'open',completed_at:null,due_at:r.due_at},token:token(),cancelled_action_ids:[],completed_action_ids:[]};s.events[p.request_id]=ack;
  if(__failSchedule){__failSchedule=false;throw Error('합성: 서버 저장 뒤 응답 유실');}return ack;
 };
};
