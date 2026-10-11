/* Inquiry continuation only: no inferred version, task completion or layout. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.InquiryScheduleFlow=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),fail=s=>{throw Error(s);},uuid=/^[0-9a-f-]{36}$/i;
 const enabled=()=>root.ScheduleContract?.enabled?.()===true;
 async function read(id){
  const api=root.ScheduleContract,c=await api.list('inquiry',id,1),items=c.items.slice();
  if(!/^[a-f0-9]{32}$/.test(c.inquiry_guard||'')||!c.response_state||
    !['status','first_response_at','responded_at','updated_at'].every(k=>Object.hasOwn(c.response_state,k)))fail('SCHEDULE_CONTRACT_MISMATCH');
  for(let page=2;items.length<c.total;page++){
   const n=await api.list('inquiry',id,page);
   if(n.token!==c.token||n.total!==c.total||!n.items.length)fail('SCHEDULE_STALE');
   items.push(...n.items);
  }
  if(items.length!==c.total||new Set(items.map(x=>x.id)).size!==c.total)fail('SCHEDULE_CONTRACT_MISMATCH');
  return {...c,items};
 }
 function identity(c){root.ScheduleContract.assertContext(c);}
 function scheduleInput(plan,existing,found){
  const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if(plan.change){
   const n=plan.change;
   if(!existing||n.id!==existing.id||n.from!==existing.due||n.text!==existing.text||!day(n.due)||n.due===existing.due||typeof n.reason!=='string'||!n.reason.trim()||n.reason.length>500)fail('SCHEDULE_INVALID_INPUT');
   if(found.date_basis==='customer_agreed'||found.customer_agreed===true||existing.promise||/^\s*고객\s*약속/.test(found.title)||/약속/.test(found.action_type||''))fail('SCHEDULE_CUSTOMER_AGREEMENT_REQUIRED');
   return {operation:'reschedule',action_id:existing.id,due_on:n.due,date_basis:'internal_plan',reason:n.reason};
  }
  if(plan.next){
   const n=plan.next,explicit=Object.hasOwn(plan,'mode'),type=explicit?n.type:n.type||'전화';
   if(!['전화','방문','후속접촉','기타'].includes(type)||typeof n.purpose!=='string'||!n.purpose.trim()||n.purpose.length>500||!day(n.due)||((explicit||n.plan!==undefined)&&!['customer','internal'].includes(n.plan)))fail('SCHEDULE_INVALID_INPUT');
   return {operation:'add',action_type:type,title:n.purpose,due_on:n.due,date_basis:n.plan==='customer'?'customer_agreed':'internal_plan'};
  }
  return null;
 }
 async function begin(id,plan,existing,progress,persist,status){
  if(!enabled())fail('SCHEDULE_RELEASE_DISABLED');
  if(progress.inquirySchedule){const s=progress.inquirySchedule,api=root.ScheduleContract;if(s.context.target_id!==id)fail('SCHEDULE_INVALID_TARGET');if(api.needsResume(s.context)){const r=await api.resume(s.context,s.prepared);s.context=clone(r.context);if(r.prepared)s.prepared=clone(r.prepared);persist();}identity(s.context);persist();return;}
  const c=await read(id);if(!c.ready)fail('SCHEDULE_RELEASE_DISABLED');
  if(status!==undefined&&c.response_state.status!==status)fail('SCHEDULE_STALE');
  const found=existing&&c.items.find(n=>n.id===existing.id);
  if(existing?(!found||found.title!==existing.text||found.due_on!==existing.due):c.items.length)fail('SCHEDULE_STALE');
  const input=scheduleInput(plan,existing,found),request_id=root.crypto.randomUUID();
  if(input)root.ScheduleContract.prepare(c,input,request_id); // Validate the real write contract before recording contact.
  progress.inquirySchedule={context:clone(c),input,request_id};persist();
 }
 async function finish(id,progress,responseAck,persist){
  const api=root.ScheduleContract,s=progress.inquirySchedule;if(!s)fail('SCHEDULE_CONTEXT_REQUIRED');
  if(!enabled())fail('SCHEDULE_RELEASE_DISABLED');
  if(api.needsResume(s.context)){const r=await api.resume(s.context,s.prepared);s.context=clone(r.context);if(r.prepared)s.prepared=clone(r.prepared);persist();}identity(s.context);
  if(s.context.target_id!==id)fail('SCHEDULE_INVALID_TARGET');
  if(!s.prepared&&!s.checked){
   const c=await read(id);if(!c.ready||c.owner_id!==s.context.owner_id||c.inquiry_guard!==s.context.inquiry_guard)fail('SCHEDULE_STALE');
   if(responseAck){
    const confirmed=responseAck.contract==='crm.inquiry-response.v1';
    if(confirmed){const p=progress.responsePrepared?.command;
     if(!p||responseAck.request_id!==p.request_id||responseAck.contact_log_id!==progress.logAck?.log_id||responseAck.contact_log_id!==p.contact_log_id
      ||responseAck.inquiry_id!==id||p.inquiry_id!==id||responseAck.token!==c.token||responseAck.owner_id!==c.owner_id
      ||!uuid.test(responseAck.stage_history_id||'')||responseAck.cancelled_action_ids?.length!==0||responseAck.completed_action_ids?.length!==0)fail('SCHEDULE_STALE');
    }
    if(responseAck.ok!==true||(!confirmed&&(responseAck.operation!=='inquiry_assign'||responseAck.intent!=='response_progress'
     ||responseAck.object_id!==id||responseAck.request_id!==progress.progressRequest||!uuid.test(responseAck.inquiry_audit_event_id||'')
     ))||!uuid.test(responseAck.inquiry_audit_event_id||'')
     ||responseAck.actor_auth_uid!==c.actor_auth_uid||responseAck.actor_user_id!==c.actor_user_id
     ||responseAck.status!=='전화응대 완료'||!responseAck.responded_at||!responseAck.first_response_at||!responseAck.updated_at
     ||['status','first_response_at','responded_at','updated_at'].some(k=>c.response_state[k]!==responseAck[k]))fail('SCHEDULE_STALE');
   }else if(c.token!==s.context.token)fail('SCHEDULE_STALE');
   if(s.input)s.prepared=api.prepare(c,s.input,s.request_id);
   else s.checked=true;
   s.current=clone(c);persist();
  }
  if(s.prepared){
   let ack=await api.receipt(s.prepared);
   persist(); // A logout while reading a receipt must not start a new write.
   if(!ack&&s.ack)fail('SCHEDULE_RECEIPT_MISSING');
   if(!ack)ack=await api.write(s.prepared);
   s.ack=ack;persist();s.current=clone(await read(id));persist();
  }
  return s.current;
 }
 function project(q,c){
  const items=c.items.map(n=>({id:n.id,inquiry_id:c.target_id,type:n.action_type,text:n.title,due:n.due_on,due_at:n.due_at,status:n.status,date_basis:n.date_basis}));
  const n=items[0]||null;q.openNextActions=items;q.nextActionObj=q.nextAction=n;
  q.nextActionText=n?.text||'';q.next_action_date=q.nextActionDate=n?.due||null;
 }
 return Object.freeze({enabled,begin,finish,project});
});
