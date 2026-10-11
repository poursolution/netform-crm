/* Explicit internal inquiry reminder only. No message delivery, contact or automatic completion. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.PCInquiryReminderSave=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const kind='pc_reminder',locks=new Set(),clone=x=>JSON.parse(JSON.stringify(x)),fail=s=>{throw Error(s);},idOf=q=>String(q?.id||q?.key||'');
 const fields=['smsText','smsTpl','smsCh','smsWhen','smsDays'];
 const pending=id=>root.MobileSaveJournal?.owner()?root.MobileSaveJournal.read(kind,String(id)):null;
 const route=q=>root.CRM_SCHEDULE_V1===true||!!pending(idOf(q));
 function restore(id,s){const d=pending(id);if(!d||s._reminderRestored===d.request_id)return;for(const k of fields)if(Object.hasOwn(d.form||{},k))s[k]=clone(d.form[k]);s.smsOpen=true;s.smsSent=null;s._reminderDue=d.input.due;s._reminderRestored=d.request_id;}
 function input(o){
  if(!o||!['sms','kakao'].includes(o.channel)||typeof o.title!=='string'||!o.title.trim()||o.title.length>500)fail('알림 업무 내용을 확인해 주세요.');
  const due=String(o.due||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due+'T00:00:00Z'))||new Date(due+'T00:00:00Z').toISOString().slice(0,10)!==due)fail('알림 업무 날짜를 확인해 주세요.');
  return {channel:o.channel,title:o.title.trim(),due};
 }
 async function read(id){
  const api=root.ScheduleContract,c=await api.list('inquiry',id,1),items=c.items.slice();
  if(!c.ready)fail('알림 업무 저장 서버가 아직 활성화되지 않았습니다. 입력을 유지했습니다.');
  for(let page=2;items.length<c.total;page++){const n=await api.list('inquiry',id,page);if(!n.ready||n.token!==c.token||n.total!==c.total||n.owner_id!==c.owner_id||!n.items.length)fail('SCHEDULE_STALE');items.push(...n.items);}
  if(items.length!==c.total||new Set(items.map(n=>n.id)).size!==c.total)fail('SCHEDULE_CONTRACT_MISMATCH');return {...c,items};
 }
 async function save(q,o,form={}){
  const id=idOf(q),j=root.MobileSaveJournal,owner=j?.owner(),session=j?.session?.(),lock=owner+':'+id;
  if(locks.has(lock))fail('저장 확인 중입니다.');locks.add(lock);let d;
  try{
   const api=root.ScheduleContract;if(!api?.enabled?.()||!root.InquiryScheduleFlow?.project)fail('알림 업무 저장 연결을 확인할 수 없습니다. 입력을 유지했습니다.');
   const assert=()=>{j.assertOwner(owner);if(session!==undefined)j.assertSession(session);};assert();
   if(root.PCInquirySave?.pending?.(id)||root.PCInquiryMilestoneSave?.pending?.(id))fail('확인 중인 응대·방문·견적 기록을 먼저 같은 입력으로 저장해 주세요.');
   const p=input(o),savedForm=Object.fromEntries(fields.filter(k=>Object.hasOwn(form,k)).map(k=>[k,clone(form[k])]));
   d=pending(id);if(d&&(JSON.stringify(d.input)!==JSON.stringify(p)||JSON.stringify(d.form)!==JSON.stringify(savedForm)))fail('저장 확인 중인 알림 입력이 바뀌었습니다. 문의를 다시 열어 보관된 입력으로 재시도해 주세요.');
   if(!d)d={input:p,form:savedForm,request_id:root.crypto.randomUUID(),progress:{}};
   const g=d.progress,persist=()=>{assert();j.write(kind,id,d,owner);};persist();
   if(g.context&&api.needsResume?.(g.context)){const resumed=await api.resume(g.context,g.prepared);assert();g.context=clone(resumed.context);if(g.prepared)g.prepared=clone(resumed.prepared);persist();}
   if(!g.context){const c=await read(id);assert();if(c.response_state?.status!==q.status)fail('SCHEDULE_STALE');g.context=clone(c);persist();}
   api.assertContext(g.context);
   if(!g.prepared){g.prepared=api.prepare(g.context,{operation:'add',action_type:'기타',title:p.title,due_on:p.due,date_basis:'internal_plan'},d.request_id);persist();}
   let ack=await api.receipt(g.prepared);persist();if(!ack&&g.ack)fail('SCHEDULE_RECEIPT_MISSING');
   if(!ack){g.sent=true;persist();ack=await api.write(g.prepared);}
   if(ack.after?.title!==p.title||ack.after?.action_type!=='기타')fail('SCHEDULE_ACK_MISMATCH');g.ack=clone(ack);persist();
   const current=await read(id);assert();if(current.token!==ack.token||current.owner_id!==g.context.owner_id||!current.items.some(n=>n.id===ack.action_id&&n.title===p.title&&n.due_on===p.due&&n.status==='open'))fail('SCHEDULE_STALE');
   const patch=root.itemPatch?.(q,'inq');for(const target of [q,q.raw,patch].filter(Boolean))root.InquiryScheduleFlow.project(target,current);
   root.saveLocal?.();j.drop(kind,id,owner);
   return {ok:true,label:'보내기 업무 저장',msg:'날짜 기준 내부 업무입니다. 제목의 09:00은 자동 발송·정시 알림을 보장하지 않습니다.',receipt:ack};
  }catch(e){if(d&&!d.progress.sent&&!d.progress.ack)try{if(session!==undefined)j.assertSession(session);j.drop(kind,id,owner);}catch(ignore){}throw e;}
  finally{locks.delete(lock);}
 }
 return Object.freeze({route,pending,restore,save});
});
