/* Read-only view of already-submitted mobile saves. Never retries or mutates storage. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.MobilePendingModel=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const prefix='crm:mobile-save:v1:',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),valid=v=>typeof v==='string'&&uuid.test(v);
 const kinds=['contact','inquiry','pc_inquiry','reschedule'],allowedStates=['pending','sending','uncertain','rejected','conflict','done'];
 const problem=code=>{throw Error(code);};
 function actor(){const p=root.Phase1?.profile;return valid(p?.auth_uid)&&valid(p?.user_id)?{auth:p.auth_uid,user:p.user_id,key:p.auth_uid+':'+p.user_id}:null;}
 const inquiryKind=kind=>kind==='inquiry'||kind==='pc_inquiry';
 function targetExists(kind,id){const sets=inquiryKind(kind)?[root.INQUIRIES,root.B?.inquiries,root.ADMIN?.inquiries]:[root.DEALS];return sets.some(rows=>Array.isArray(rows)&&rows.some(d=>String(d?.id||d?.inquiry_id||d?.key||'')===id));}
 function read(){
  const a=actor();if(!a)return {ok:false,status:'login-required',count:null,groups:[],unlinked_operations:null,errors:['LOGIN_REQUIRED']};
  const errors=[],groups=[],used=new Set();let unlinked=null;
  try{
   const journal=root.MobileSaveJournal;if(!journal||typeof journal.read!=='function'||journal.owner()!==a.key)problem('JOURNAL_UNAVAILABLE');
   const session=typeof journal.session==='function'?journal.session():null;
   const queue=root.Phase1?.queue;if(!queue||typeof queue.list!=='function')problem('QUEUE_UNAVAILABLE');
   const all=queue.list();if(!Array.isArray(all))problem('QUEUE_INVALID');
   const rows=all.filter(q=>q?.auth_uid===a.auth&&q?.user_id===a.user),byId=new Map();
   for(const q of rows){if(!valid(q.request_id)||!valid(q.object_id)||!allowedStates.includes(q.status)||byId.has(q.request_id))problem('QUEUE_INVALID');byId.set(q.request_id,q);}
   const store=root.sessionStorage;if(!store||!Number.isInteger(store.length))problem('JOURNAL_UNAVAILABLE');
   const currentPrefix=prefix+a.key+':',keys=[];
   // Enumerate key names only. Read values through the existing validating journal API.
   for(let i=0;i<store.length;i++){const key=store.key(i);if(typeof key==='string'&&key.startsWith(currentPrefix))keys.push(key);}
   for(const key of keys){
    const suffix=key.slice(currentPrefix.length),split=suffix.indexOf(':'),kind=suffix.slice(0,split),id=suffix.slice(split+1);
    if(!kinds.includes(kind))continue; // Quote and unrelated drafts are outside this view.
    if(split<0||!valid(id))problem('JOURNAL_TARGET_INVALID');
    const value=journal.read(kind,id);if(!object(value)||!object(value.progress))problem('JOURNAL_INVALID');
    if(kind==='pc_inquiry'&&value.surface!=='mobile-d')continue;
    const p=value.progress,submitted=kind==='pc_inquiry'?p.contactSent===true:kind==='inquiry'?typeof p.inputKey==='string'&&!!p.inputKey:typeof p.signature==='string'&&!!p.signature;
    if(!submitted)continue;
    const input=object(p.input)?p.input:object(value.input)?value.input:{},plan=object(p.pl)?p.pl:object(p.plan)?p.plan:{};
    const parts=[],requestIds=new Set(),adminIds=new Set();
    function part(name,state,rid,detail){if(rid){if(!valid(rid))problem('JOURNAL_REQUEST_INVALID');requestIds.add(rid);}parts.push({kind:name,state,request_id:rid||null,...(detail?{detail}: {})});}
    function queued(name,rid){
     if(!rid){part(name,'pending');return;}
     if(!valid(rid))problem('JOURNAL_REQUEST_INVALID');
     const q=byId.get(rid);if(!q){part(name,'pending',rid,'receipt-unavailable');return;}
     if(q.object_id!==id)problem('QUEUE_TARGET_MISMATCH');used.add(rid);
     let state=q.status==='conflict'?'conflict':q.status==='rejected'?'failed':q.status==='done'?'done':'pending';
     if(state==='done'){
      const ack=q.ack;if(!object(ack)||ack.ok!==true||ack.request_id!==rid||ack.object_id!==id||ack.actor_auth_uid!==a.auth||ack.actor_user_id!==a.user)problem('QUEUE_ACK_INVALID');
      const validator=queue.validateAck||root.OperationalAdapter?.validateAck;if(typeof validator==='function')validator(ack,q);
      if(name==='activity'&&!valid(ack.activity_id))problem('QUEUE_ACK_INVALID');
     }
     part(name,state,rid,state==='pending'&&q.status==='uncertain'?'server-confirmation-pending':undefined);
    }
    function schedule(s){
     if(!object(s)||!valid(s.request_id))problem('JOURNAL_SCHEDULE_INVALID');
     if(s.ack){const ack=s.ack;if(ack.ok!==true||ack.request_id!==s.request_id||ack.target_id!==id||ack.actor_auth_uid!==a.auth||ack.actor_user_id!==a.user)problem('JOURNAL_SCHEDULE_ACK_INVALID');part('schedule','done',s.request_id);if(!s.current)part('refresh','pending');}
     else if(s.checked&&!s.input)part('schedule','done',s.request_id);
     else part('schedule','pending',s.request_id);
    }
    if(kind==='pc_inquiry'){
     const contact=p.contact;
     if(!object(contact)||contact.inquiry_id!==id||!valid(contact.request_id))problem('JOURNAL_CONTACT_INVALID');
     if(p.logAck){
      if(!valid(p.logAck.log_id)||p.logAck.request_id!==contact.request_id||p.logAck.inquiry_id!==id)problem('JOURNAL_CONTACT_ACK_INVALID');
      part('activity','done',contact.request_id);
     }else part('activity','pending',contact.request_id,'server-confirmation-pending');
     if(p.needsResponse){
      const command=p.responsePrepared?.command,ack=p.responseAck;
      if(command&&(command.inquiry_id!==id||!valid(command.request_id)))problem('JOURNAL_RESPONSE_INVALID');
      if(ack&&(!command||ack.ok!==true||ack.contract!=='crm.inquiry-response.v1'||ack.inquiry_id!==id||ack.request_id!==command.request_id
       ||ack.contact_log_id!==p.logAck?.log_id||ack.actor_auth_uid!==a.auth||ack.actor_user_id!==a.user||ack.status!=='전화응대 완료'
       ||ack.completed_action_ids?.length!==0||ack.cancelled_action_ids?.length!==0))problem('JOURNAL_RESPONSE_ACK_INVALID');
      part('inquiry-progress',ack?'done':'pending',command?.request_id);
     }
     if(p.inquirySchedule)schedule(p.inquirySchedule);else part('schedule','pending');
     // A surviving journal still needs the controller's final current-state projection/drop.
     if(parts.every(x=>x.state==='done'))part('refresh','pending');
    }else if(kind==='inquiry'){
     if(input.res==='배드핏')part('close',p.closed?.ok===true?'done':'pending',null,p.closePending&&!p.closed?'server-confirmation-pending':undefined);
     else{
      if(p.logged){if(!valid(p.logAck?.log_id)||p.logAck?.request_id!==p.rid||p.logAck?.inquiry_id!==id)problem('JOURNAL_CONTACT_ACK_INVALID');part('activity','done',p.rid);}
      else part('activity','pending',p.rid||null);
      if(p.progressRequest)queued('inquiry-progress',p.progressRequest);
      else if(['연결됨','회신 받음'].includes(input.res)&&!p.progressed){
       const known=[root.INQUIRIES,root.B?.inquiries].filter(Array.isArray).flat().find(q=>String(q?.id||q?.inquiry_id||'')===id);
       // A crash between the contact receipt and the next command must not hide the unfinished transition.
       if(!known||['접수','신규','담당자 배정','배정완료',''].includes(String(known.status||'')))part('inquiry-progress','pending');
      }
      if(p.inquirySchedule)schedule(p.inquirySchedule);
      else if(plan.next||p.nextRequest)queued('schedule',p.nextRequest);
     }
    }else if(kind==='reschedule'){
     if(p.schedule)schedule(p.schedule);else{queued('schedule-note',p.rsmemo);queued('schedule',p.rsnext);}
    }else{
     queued('activity',p.activity);
     if(p.schedule)schedule(p.schedule);else if(plan.next||plan.change||p.next_action)queued('schedule',p.next_action);
     if(p.infoError)part('customer-info','failed');else if(plan.info)part('customer-info',p.infoHandled?'done':'pending');
     if(plan.requests!==undefined&&!Array.isArray(plan.requests))problem('JOURNAL_REQUESTS_INVALID');
     for(const r of plan.requests||[]){
      if(!['done','working'].includes(r?.state))continue;
      if(!valid(r.id))problem('JOURNAL_ADMIN_REQUEST_INVALID');
      if(adminIds.has(r.id))continue;adminIds.add(r.id);
      const saved=p.requestResults?.[r.id];
      if(saved&&(saved.id!==r.id||saved.status!==r.state))problem('JOURNAL_ADMIN_REQUEST_ACK_INVALID');
      // 'working' confirms the saved reply, not that the business request is completed.
      parts.push({kind:'admin-request',state:saved?'done':'pending',request_id:r.id,result_state:saved?.status||r.state});
     }
    }
    if(!parts.length)part('save','pending');
    const has=state=>parts.some(x=>x.state===state),pending=parts.some(x=>x.state!=='done');
    const state=has('conflict')?'conflict':has('done')&&pending?'partial':has('failed')?'failed':pending?'pending':'done';
    const exists=targetExists(kind,id),canResume=exists&&state!=='conflict'&&pending&&kind!=='reschedule';
    groups.push({id:kind+':'+id,kind,target_type:inquiryKind(kind)?'inquiry':'deal',target_id:id,state,pending,
     recorded_at:typeof p.at==='string'?p.at:typeof p.contact?.occurred_at==='string'?p.contact.occurred_at:Number.isFinite(value.at)?new Date(value.at).toISOString():null,
     result:typeof input.res==='string'?input.res:typeof input.result==='string'?input.result:'',activity_type:kind==='reschedule'?'일정 변경':input.ch==='방문'?'방문 결과':'응대 기록',
     parts,request_ids:[...requestIds],admin_request_ids:[...adminIds],
     resume:{kind,target_id:id,allowed:canResume,reason:!pending?'already-confirmed':!exists?'target-not-loaded':state==='conflict'?'conflict-review-required':kind==='reschedule'?'approved-screen-unavailable':null}});
   }
   if(actor()?.key!==a.key||journal.owner()!==a.key||(session!==null&&journal.session()!==session))problem('IDENTITY_CHANGED');
   unlinked=rows.filter(q=>q.status!=='done'&&!used.has(q.request_id)).length;
  }catch(e){errors.push(String(e?.message||'PENDING_READ_FAILED'));}
  const ok=errors.length===0;
  return {ok,status:ok?'ready':'read-error',count:ok?groups.filter(g=>g.pending).length:null,groups:ok?groups:[],unlinked_operations:ok?unlinked:null,errors};
 }
 return Object.freeze({read});
});
