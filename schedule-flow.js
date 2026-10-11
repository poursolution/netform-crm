/* Shared save sequencing; no UI, automatic completion or inferred customer agreement. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.ScheduleFlow=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x)),fail=s=>{throw Error(s);};
 const enabled=()=>root.ScheduleContract?.enabled?.()===true;
 const actions=c=>JSON.stringify(c.items.slice().sort((a,b)=>a.id.localeCompare(b.id)));
 async function read(id){
  const api=root.ScheduleContract,first=await api.list('deal',id,1),items=first.items.slice();
  for(let page=2;items.length<first.total;page++){
   const c=await api.list('deal',id,page);
   if(c.token!==first.token||c.total!==first.total||!c.items.length)fail('SCHEDULE_STALE');
   items.push(...c.items);
  }
  if(items.length!==first.total||new Set(items.map(x=>x.id)).size!==items.length)fail('SCHEDULE_CONTRACT_MISMATCH');
  return {...first,items};
 }
 function existingMatches(row,ex){return row&&ex&&row.id===ex.id&&row.due_on===ex.due
  &&row.title.replace(/^\s*고객\s*약속\s*:?\s*/,'').trim()===String(ex.text).replace(/^\s*고객\s*약속\s*:?\s*/,'').trim();}
 async function begin(d,plan,existing,progress,persist){
  if(progress.schedule){const s=progress.schedule;root.ScheduleContract.prepare(s.context,s.input,s.request_id);persist();return s;}
  if(!enabled())fail('SCHEDULE_RELEASE_DISABLED');
  const context=await read(d.id);
  if(!context.ready)fail('SCHEDULE_RELEASE_DISABLED');
  if(!Number.isInteger(context.version)||!Number.isInteger(d.version)||context.version!==d.version)fail('SCHEDULE_STALE');
  if(existing&&!existingMatches(context.items.find(x=>x.id===existing.id),existing))fail('SCHEDULE_STALE');
  if(!existing&&context.items.length)fail('SCHEDULE_STALE'); // UI did not know an existing task: review first
  const current=plan.change&&context.items.find(x=>x.id===plan.change.id);
  if(current&&(existing?.promise||current.date_basis==='customer_agreed'||/^\s*고객\s*약속/.test(current.title)))fail('고객과 합의한 일정입니다. 재합의 근거를 연결하는 경로에서 변경해 주세요. 기존 일정은 유지됩니다.');
  const input=plan.change?{operation:'reschedule',action_id:plan.change.id,due_on:plan.change.due,date_basis:'internal_plan',reason:plan.change.reason}
   :{operation:'add',action_type:plan.next.type,title:plan.next.text,due_on:plan.next.due,date_basis:plan.next.plan==='customer'?'customer_agreed':'internal_plan'};
  // Request ID and original context are durable before the activity write begins.
  progress.schedule={context:copy(context),input,request_id:root.crypto.randomUUID()};persist();return progress.schedule;
 }
 async function finish(d,progress,activityAck,persist){
  const s=progress.schedule,api=root.ScheduleContract;if(!s)fail('SCHEDULE_CONTEXT_REQUIRED');
  if(!enabled())fail('SCHEDULE_RELEASE_DISABLED');
  if(!s.prepared){
   const c=await read(d.id),v=s.context.version;
   if(!c.ready||c.owner_id!==s.context.owner_id||actions(c)!==actions(s.context))fail('SCHEDULE_STALE');
   if(activityAck){
    if(activityAck.ok!==true||activityAck.operation!=='activity'||activityAck.object_id!==d.id
     ||activityAck.actor_auth_uid!==c.actor_auth_uid||activityAck.actor_user_id!==c.actor_user_id
     ||activityAck.previous_version!==v||activityAck.version!==v+1||c.version!==activityAck.version)fail('SCHEDULE_STALE');
   }else if(c.token!==s.context.token)fail('SCHEDULE_STALE');
   s.prepared=api.prepare(c,s.input,s.request_id);persist();
  }
  // Reconcile before retry; never replace an uncertain command with a new request ID.
  let saved=await api.receipt(s.prepared);
  persist(); // Recheck the caller's session and durable state after the awaited read.
  if(!saved&&s.ack)fail('SCHEDULE_RECEIPT_MISSING');
  if(!saved)saved=await api.write(s.prepared);
  s.ack=saved;persist();
  // A successful write can be followed by a failed refresh: keep receipt and retry refresh only.
  const c=await read(d.id);s.current=copy(c);persist();return {ack:saved,current:c};
 }
 function project(d,result,patch){
  const c=result.current,rows=c.items.map(n=>({id:n.id,opportunity_id:d.id,type:n.action_type,text:n.title,due:n.due_on,due_at:n.due_at,status:n.status,date_basis:n.date_basis}));
  d.openNextActions=rows;d.version=c.version;
  const n=rows[0]||null;d.nextActionObj=n;
  if(patch){patch.version=c.version;patch.nextActionObj=n;d.nextAction=patch.nextAction=n?.due||'';d.nextActionText=patch.nextActionText=n?.text||'';}
  else d.nextAction=n;
  root.dispatchEvent?.(new root.CustomEvent('schedule:confirmed',{detail:{target_id:d.id,version:c.version}}));
  return n;
 }
 return Object.freeze({enabled,begin,finish,project});
});
