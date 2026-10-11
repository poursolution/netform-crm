/* Synthetic RPC boundary only. Shared client modules run unchanged; never calls a remote service. */
module.exports=function install(root,id,existing){
 const f=existing||require('./pc-inquiry-fixture.cjs')(root,id),base=root.Phase1.rpc,uuid=()=>root.crypto.randomUUID(),copy=x=>JSON.parse(JSON.stringify(x));
 const hex=n=>Number(n).toString(16).padStart(32,'0'),hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return hex(n);};
 Object.assign(f,{milestones:new Map(),quotes:[],calendars:[],milestoneEnabled:true,milestoneWritable:true,factSerial:1});
 const parent=()=>({...f.state,next_action_date:f.rows[0]?.due_on||null});
 const state=()=>({inquiry_id:id,...f.flowState,quotes:copy(f.quotes),schedules:copy(f.calendars),logs:copy([...f.logs.values()])});
 const context=()=>({ok:true,contract:'crm.inquiry-milestone.v1',inquiry_id:id,actor_auth_uid:f.auth,actor_user_id:f.uid,owner_id:f.owner||f.uid,enabled:f.milestoneEnabled,writable:f.milestoneWritable,
  token:hex(f.serial*1000+f.factSerial),schedule_token:hex(f.serial),fact_token:hex(f.factSerial),parent_guard:hash(JSON.stringify([f.owner||f.uid,f.state.status,f.state.first_response_at,f.state.responded_at,f.extraParent||''])),
  open_action_count:f.rows.length,open_calendar_count:f.calendars.filter(x=>x.status==='open').length,parent:parent(),state:state()});
 root.Phase1.rpc=async(name,arg)=>{
  if(!name.startsWith('crm_inquiry_milestone_'))return base(name,arg);const p=arg.p;f.calls.push({name,p:copy(p)});
  if(f.milestoneHold===name)await new Promise(r=>f.milestoneRelease=r);
  if(name==='crm_inquiry_milestone_context_v1')return context();
  if(name==='crm_inquiry_milestone_receipt_v1')return {ok:true,contract:'crm.inquiry-milestone.v1',inquiry_id:id,request_id:p.request_id,actor_auth_uid:f.auth,actor_user_id:f.uid,found:f.milestones.has(p.request_id),ack:f.milestones.get(p.request_id)?.ack||null};
  if(name!=='crm_inquiry_milestone_save_v1')throw Error('Unexpected RPC '+name);
  const prior=f.milestones.get(p.request_id);if(prior){if(JSON.stringify(p)!==JSON.stringify(prior.command))throw Error('REQUEST_ID_REUSE');return {...prior.ack,replayed:true};}
  if(!f.milestoneEnabled)throw Error('MILESTONE_RELEASE_DISABLED');if(!f.milestoneWritable)throw Error('MILESTONE_STATE_CONFLICT');if(p.expected_token!==context().token)throw Error('MILESTONE_STALE');
  let qv=null;const sent=p.kind==='quote_sent';
  if(p.amount){qv=f.quotes.at(-1);if(qv?.sent_at)qv=null;if(qv)Object.assign(qv,{amount:p.amount,sent_at:sent?p.date+'T00:00:00+09:00':null});else{qv={id:uuid(),version_no:f.quotes.length+1,amount:p.amount,sent_at:sent?p.date+'T00:00:00+09:00':null};f.quotes.push(qv);}}
  if(p.kind==='visit_done')f.flowState.visit_done_at=p.date+'T'+(p.time||'00:00')+':00+09:00';if(sent)f.flowState.quote_sent_at=qv.sent_at;
  Object.assign(f.state,{status:{visit_planned:'현장방문예정',visit_done:'현장방문 완료',quote_draft:'견적서 발송예정',quote_sent:'견적서 발송완료'}[p.kind],updated_at:new Date().toISOString()});f.serial++;f.factSerial++;
  const fact=copy(p);delete fact.inquiry_id;delete fact.request_id;delete fact.expected_token;
  const ack={...context(),kind:p.kind,request_id:p.request_id,fact,event_id:uuid(),inquiry_audit_event_id:uuid(),quote_version_id:qv?.id||null,quote_version_no:qv?.version_no||null,cancelled_action_ids:[],completed_action_ids:[],changed_calendar_ids:[],promoted:false,replayed:false};
  f.milestones.set(p.request_id,{command:copy(p),ack:copy(ack)});
  if(f.milestoneLoss===name){f.milestoneLoss='';throw Error('response lost');}if(f.milestoneBadAck)return {ok:true};return ack;
 };
 f.milestoneContext=context;return f;
};
