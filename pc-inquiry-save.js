/* Existing PC forms only. No rendering, layout, implicit completion or legacy fallback after a new write. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.PCInquirySave=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const locks=new Set(),kind='pc_inquiry',rpc='crm_inquiry_command_v1',clone=x=>JSON.parse(JSON.stringify(x));
 const fail=s=>{throw Error(s);},idOf=q=>String(q?.id||q?.key||''),journal=()=>root.MobileSaveJournal;
 const selected=()=>root.CRM_SCHEDULE_V1===true;
 function pending(id){const j=journal();return j?.owner()?j.read(kind,String(id))||null:null;}
 function route(q){return selected()||!!pending(idOf(q));}
 function restore(id,s,surface){
  const d=pending(id);if(!d||d.surface!==surface||s._pcRestored===d.progress.contact.request_id)return;
  Object.assign(s,clone(d.form),{_pcRestored:d.progress.contact.request_id,_pcDue:d.input.due});
  if(surface==='detail')Object.assign(s,{due:d.input.due,next:d.input.next,ch:d.input.ch,res:d.input.result,text:d.input.text});
 }
 function input(o){
  const line=o.line||o.res?root.InquiryFlow.readLine(o.line||o.res)||{}:{};
  const p={ch:String(o.ch||line.ch||'전화'),result:String(o.result||line.res||''),text:String(o.text??line.text??'').trim(),next:String(o.next||'').trim(),due:String(o.due||''),contact_result:String(o.contact_result||''),customer_reaction:String(o.customer_reaction||'')};
  if(!root.InquiryFlow.kindOf(p.result))fail('연락 결과를 확인해 주세요.');
  if(Object.hasOwn(o,'plan')){
   const pl=o.plan,kind=root.InquiryFlow.kindOf(p.result);
   if(!Object.hasOwn(o,'existing')||!pl||pl.ok!==true||pl.badfit||pl.completeCurrent!==false||!['keep','none','new','change'].includes(pl.mode)
    ||!['전화','카카오','문자','이메일','방문','기타'].includes(p.ch)||!['연결됨','고객 회신','부재','번호오류'].includes(p.contact_result)||root.InquiryFlow.kindOf(p.contact_result)!==kind
    ||pl.attempt!==(kind==='attempt')||pl.meaningful!==(kind==='connected')||pl.info||!Array.isArray(pl.requests)||pl.requests.length)fail('문의에서 지원하지 않는 저장 계획입니다. 입력을 유지한 채 확인해 주세요.');
   const ex=snapshot(o.existing);
   if((pl.mode==='keep'||pl.mode==='change')&&!ex)fail('이어받을 기존 일정을 확인해 주세요.');
   if(pl.mode==='none'&&kind!=='attempt'&&!String(pl.reason||'').trim())fail('다음 일정이 없는 이유를 확인해 주세요.');
   if((pl.mode==='new')!==!!pl.next||(pl.mode==='change')!==!!pl.change||typeof pl.note!=='string'||!pl.note.trim()||pl.note.length>4000)fail('문의 저장 계획의 기록과 일정을 확인해 주세요.');
   const nx=pl.next||pl.change||(pl.mode==='keep'?ex:null);
   Object.assign(p,{sourceText:p.text,text:pl.note,next:String(nx?.purpose||nx?.text||''),due:String(nx?.due||''),plan:clone(pl),existing:ex});
  }else if(!p.next||!/^\d{4}-\d{2}-\d{2}$/.test(p.due))fail('연락 결과와 다음 행동·날짜를 확인해 주세요.');
  return p;
 }
 function snapshot(n){
  if(!n)return null;
  const due=String(n.due||n.due_on||'');
  return {id:String(n.id||''),text:String(n.text||n.title||''),due,type:String(n.type||n.action_type||'전화'),date_basis:String(n.date_basis||''),promise:n.promise===true};
 }
 function existing(q){
  const patch=root.itemPatch?.(q,'inq')||{},n=patch.nextActionObj||q.nextActionObj||(typeof q.nextAction==='object'?q.nextAction:null);
  if(n&&['done','completed','cancelled'].includes(n.status))return null;
  const text=String(n?.text||n?.title||patch.nextActionText||q.nextActionText||'');
  const raw=String(n?.due_on||n?.due||n?.due_at||patch.next_action_date||q.next_action_date||q.nextActionDate||(typeof q.nextAction==='string'?q.nextAction:'')||'');
  const due=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)&&Number.isFinite(Date.parse(raw))?new Date(Date.parse(raw)+9*3600000).toISOString().slice(0,10):'';
  return text||due?snapshot({...n,text,due}):null;
 }
 function contactAck(r,p){
  const st=r?.state,l=st?.logs?.find(x=>x.id===r.log_id&&x.request_id===p.request_id);
  if(r?.ok!==true||r.type!=='contact_log'||st?.inquiry_id!==p.inquiry_id||!l||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.log_id||'')||
   ['channel','result','content','next_action','next_check_date',...('contact_result' in p?['contact_result','customer_reaction']:[])].some(k=>String(l[k]??'')!==String(p[k]??'')))fail('응대 기록의 서버 저장 근거를 확인하지 못했습니다. 같은 입력으로 다시 확인해 주세요.');
  return {log_id:r.log_id,request_id:p.request_id,inquiry_id:p.inquiry_id};
 }
 async function save(q,o,form={},surface='detail'){
  const id=idOf(q),j=journal(),owner=j?.owner(),session=j?.session?.(),lock=owner+':'+id;
  if(locks.has(lock))fail('저장 확인 중입니다.');
  locks.add(lock);let d,sent=false;
  try{
   if(!root.InquiryResponseContract?.enabled?.()||!root.CRMRelease?.has?.(rpc))fail('서버 저장 연결을 확인할 수 없습니다. 입력을 유지한 채 다시 시도해 주세요.');
   const assert=()=>{j.assertOwner(owner);if(session!==undefined)j.assertSession(session);};assert();
   if(root.PCInquiryMilestoneSave?.pending?.(id))fail('확인 중인 방문·견적 기록을 먼저 같은 입력으로 저장해 주세요.');
   if(root.PCInquiryReminderSave?.pending?.(id))fail('확인 중인 문자·카카오 예약을 먼저 같은 입력으로 저장해 주세요.');
   const p=input(o);d=pending(id);
   if(d&&JSON.stringify(d.input)!==JSON.stringify(p))fail('저장 확인 중인 입력이 바뀌었습니다. 문의를 다시 열어 보관된 입력으로 재시도해 주세요.');
   if(!d){
    const ex=existing(q);
    if(p.plan){if(JSON.stringify(ex)!==JSON.stringify(p.existing))fail('기존 일정이 바뀌었습니다. 현재 일정을 다시 확인해 주세요.');}
    else if(ex&&(p.next!==ex.text||p.due!==ex.due))fail('기존 일정과 다음 행동이 다릅니다. 기존 업무를 유지하거나 일정 변경 경로에서 처리해 주세요.');
    const contact={type:'contact_log',inquiry_id:id,request_id:root.crypto.randomUUID(),channel:p.ch,result:p.result,content:p.text.slice(0,4000),next_action:p.next.slice(0,500),next_check_date:p.due||null,occurred_at:new Date().toISOString()};
    if(p.contact_result)Object.assign(contact,{contact_result:p.contact_result,customer_reaction:p.customer_reaction});
    d={input:p,form:clone(form),surface,progress:{contact,existing:ex,plan:p.plan?clone(p.plan):ex?{}:{next:{purpose:p.next,due:p.due}},needsResponse:root.InquiryFlow.kindOf(p.result)==='connected'&&root.InquiryCommand.needsProgress(q)}};
   }
   const g=d.progress,persist=()=>{assert();j.write(kind,id,d,owner);};persist();
   await root.InquiryScheduleFlow.begin(id,g.plan,g.existing,g,persist,g.inquirySchedule?undefined:q.status);
   assert();
   if(!g.logAck){g.contactSent=true;persist();sent=true;const r=await root.Phase1.rpc(rpc,{p:g.contact});assert();g.logAck=contactAck(r,g.contact);g.logState=r.state;persist();}
   if(g.needsResponse&&!g.responseAck){
    if(!g.responsePrepared){g.responsePrepared=root.InquiryResponseContract.prepare(g.inquirySchedule.context,g.logAck,root.crypto.randomUUID());persist();}
    else if(root.ScheduleContract.needsResume(g.responsePrepared.context)){g.responsePrepared=await root.InquiryResponseContract.resume(g.responsePrepared);persist();}
    g.responseAck=await root.InquiryResponseContract.confirm(g.responsePrepared);persist();
   }
   const current=await root.InquiryScheduleFlow.finish(id,g,g.responseAck||null,persist);assert();
   const patch=root.itemPatch?.(q,'inq');for(const target of [q,q.raw,patch].filter(Boolean)){Object.assign(target,current.response_state);root.InquiryScheduleFlow.project(target,current);}
   root.InquiryFlow.take?.(g.logState);q.lastActivity=g.contact.occurred_at;if(patch)patch.lastActivity=q.lastActivity;
   root.saveLocal?.();j.drop(kind,id,owner);return true;
  }catch(e){
   // A read-only preflight may be corrected. Once sent, never mint a replacement UUID.
   if(d&&!sent&&!d.progress.contactSent)try{if(session!==undefined)j.assertSession(session);j.drop(kind,id,owner);}catch(ignore){}
   if(d?.progress.logAck)e.message+=' — 응대 기록은 저장됐습니다. 같은 입력으로 남은 저장만 확인해 주세요.';
   throw e;
  }finally{locks.delete(lock);}
 }
 return Object.freeze({selected,route,restore,pending,existing,save});
});
