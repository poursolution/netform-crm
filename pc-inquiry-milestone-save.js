/* Headless save for existing PC inquiry visit/quote fields. Server receipt is the only success source. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.PCInquiryMilestoneSave=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const kind='pc_milestone',locks=new Set(),clone=x=>JSON.parse(JSON.stringify(x)),fail=s=>{throw Error(s);},idOf=q=>String(q?.id||q?.key||'');
 const pending=id=>root.MobileSaveJournal?.owner()?root.MobileSaveJournal.read(kind,String(id)):null;
 const route=q=>root.CRM_SCHEDULE_V1===true||!!pending(idOf(q));
 function restore(id,s){const d=pending(id);if(!d||s._milestoneRestored===d.request_id)return;
  const p=d.input;Object.assign(s,{step:p.kind.startsWith('visit')?'visit':'quote',visitDate:p.kind.startsWith('visit')?p.date:'',visitTime:p.time||'',visitMode:p.kind==='visit_done'?'완료':'예정',quoteAmt:p.amount?String(p.amount/10000):'',quoteDate:p.kind.startsWith('quote')?p.date||'':'',quoteMode:p.kind==='quote_sent'?'완료':'예정',_milestoneRestored:d.request_id});
 }
 const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10),day=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 function input(type,o,old){
  const visit=type==='visit';if(!visit&&type!=='quote_send')fail('MILESTONE_INVALID_INPUT');
  const p={kind:visit?(o.done?'visit_done':'visit_planned'):(o.sent?'quote_sent':'quote_draft')};
  const date=String(o.date||(!visit&&o.sent?(old?.date||today()):'')),time=String(o.time||'');
  if(date){if(!day(date)||date<'2000-01-01')fail('날짜를 확인해 주세요.');p.date=date;}
  if(visit&&!date||!visit&&o.sent&&date>today()||visit&&o.done&&date>today())fail('실제 처리 날짜를 확인해 주세요.');
  if(time){if(!visit||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail('방문 시간을 확인해 주세요.');p.time=time;}
  if(visit&&o.done&&time&&Date.parse(date+'T'+time+':00+09:00')>Date.now())fail('완료 시각은 미래일 수 없습니다.');
  if(!visit){const amount=Number(o.amount||0);if(!Number.isSafeInteger(amount)||amount<0||amount>9000000000000000||o.sent&&amount<=0||!o.sent&&!amount&&!date)fail('견적 금액과 날짜를 확인해 주세요.');
   if(amount)p.amount=amount;for(const [src,dst,max] of [['method','method',100],['file','file_name',500],['reason','change_reason',1000]])if(o[src]){if(typeof o[src]!=='string'||o[src].length>max)fail('견적 기록 내용을 확인해 주세요.');p[dst]=o[src];}
   if(o.recipient!=null){if(typeof o.recipient!=='object'||Array.isArray(o.recipient)||JSON.stringify(o.recipient).length>4000)fail('수신자 기록을 확인해 주세요.');p.recipient=clone(o.recipient);}
  }
  // A persisted command may have committed before midnight. Recover its receipt and original date;
  // do not apply today's new-entry rule to an immutable pending operation.
  if(!old&&(p.kind==='visit_planned'||p.kind==='quote_draft'&&p.date)&&p.date<today())fail('예정일은 오늘 이후로 선택해 주세요.');
  return p;
 }
 async function save(q,type,o={}){
  const id=idOf(q),j=root.MobileSaveJournal,owner=j?.owner(),session=j?.session?.(),lock=owner+':'+id;if(locks.has(lock))fail('저장 확인 중입니다.');locks.add(lock);
  let d;try{
   const api=root.InquiryMilestoneContract,sc=root.ScheduleContract;
   if(!api?.enabled?.()||!sc?.enabled?.())fail('방문·견적 사실 저장 서버가 아직 연결되지 않았습니다. 입력을 유지했습니다.');
   const assert=()=>{j.assertOwner(owner);j.assertSession(session);};assert();
   if(root.PCInquirySave?.pending?.(id))fail('확인 중인 응대 기록을 먼저 같은 입력으로 저장해 주세요.');
   if(root.PCInquiryReminderSave?.pending?.(id))fail('확인 중인 문자 알림 일정을 먼저 같은 입력으로 저장해 주세요.');
   d=pending(id);const p=input(type,o,d?.input);
   if(d&&JSON.stringify(d.input)!==JSON.stringify(p))fail('저장 확인 중인 입력이 바뀌었습니다. 보관된 원문으로 다시 확인해 주세요.');
   if(!d)d={input:p,request_id:root.crypto.randomUUID(),progress:{}};
   const g=d.progress,persist=()=>{assert();j.write(kind,id,d,owner);};persist();
   if(g.context){
    const current=await api.context(id);assert();g.context=api.rebind(g.context,current);
    if(g.prepared)g.prepared=api.rebind(g.prepared,current);
    if(g.schedulePrepared){
     if(!g.scheduleContext||typeof sc.resume!=='function')fail('SCHEDULE_RECOVERY_CONTEXT_REQUIRED');
     const resumed=await sc.resume(g.scheduleContext,g.schedulePrepared);assert();
     if(resumed.current.owner_id!==current.owner_id)fail('IDENTITY_CHANGED');
     g.scheduleContext=resumed.context;g.schedulePrepared=resumed.prepared;
    }
    persist();
   }
   if(!g.context){const c=await api.context(id);assert();if(!c.ready)fail('방문·견적 사실 저장 서버가 아직 활성화되지 않았습니다.');if(c.parent.status!==q.status)fail('MILESTONE_STALE');
    const last=c.state?.quotes?.slice().sort((a,b)=>a.version_no-b.version_no).at(-1);
    if(p.amount&&last&&(last.sent_at||last.amount!==p.amount)&&!p.change_reason?.trim())fail('이전 견적의 수정·재발송 사유를 저장하는 연결이 필요합니다. 기존 견적과 일정을 변경하지 않았습니다.');
    g.context=clone(c);persist();}
   api.assertContext(g.context);
   const planned=p.kind==='visit_planned'||p.kind==='quote_draft'&&!!p.date;
   if(planned&&!g.schedulePrepared){
    if(g.context.open_action_count||g.context.open_calendar_count||g.context.parent.next_action_date)fail('기존 일정이 있습니다. 현재 입력으로 기존 업무를 바꾸거나 새 일정을 중복 생성하지 않았습니다.');
    const c=await sc.list('inquiry',id,1);assert();if(!c.ready||c.total!==0||c.token!==g.context.schedule_token)fail('SCHEDULE_STALE');
    g.scheduleContext=clone(c);g.schedulePrepared=sc.prepare(c,{operation:'add',action_type:p.kind==='visit_planned'?'방문':'기타',title:p.kind==='visit_planned'?'현장방문'+(p.time?' '+p.time:''):'견적서 발송',due_on:p.date,date_basis:'internal_plan'},root.crypto.randomUUID());persist();
   }
   if(g.schedulePrepared&&!g.scheduleAck){
    let r=await sc.receipt(g.schedulePrepared);persist();if(!r){g.scheduleSent=true;persist();r=await sc.write(g.schedulePrepared);}g.scheduleAck=r;persist();
   }
   if(!g.prepared){
    const c=await api.context(id);assert();if(!c.ready||c.owner_id!==g.context.owner_id||c.fact_token!==g.context.fact_token||c.parent_guard!==g.context.parent_guard)fail('MILESTONE_STALE');
    if(g.scheduleAck?(c.schedule_token!==g.scheduleAck.token):(c.token!==g.context.token))fail('MILESTONE_STALE');
    const command={...p};if(g.scheduleAck)Object.assign(command,{schedule_request_id:g.schedulePrepared.command.request_id,schedule_action_id:g.scheduleAck.action_id});
    g.prepared=api.prepare(c,command,d.request_id);persist();
   }
   if(!g.ack){let r=await api.receipt(g.prepared);persist();if(!r){g.sent=true;persist();r=await api.write(g.prepared);}g.ack=r;persist();}
   const c=await api.context(id);assert();if(c.token!==g.ack.token||c.owner_id!==g.context.owner_id)fail('저장 이후 문의가 변경됐습니다. 기록은 보관했으니 현재 상태를 확인해 주세요.');
   const s=await sc.list('inquiry',id,1);assert();if(s.token!==c.schedule_token)fail('SCHEDULE_STALE');
   const items=s.items.slice();for(let page=2;items.length<s.total;page++){const n=await sc.list('inquiry',id,page);assert();if(n.token!==s.token||n.total!==s.total||!n.items.length)fail('SCHEDULE_STALE');items.push(...n.items);}
   if(items.length!==s.total||new Set(items.map(n=>n.id)).size!==s.total)fail('SCHEDULE_CONTRACT_MISMATCH');
   // Projection is read-only. A completed visit is not permission to finish an existing appointment.
   const patch=root.itemPatch?.(q,'inq');for(const target of [q,q.raw,patch].filter(Boolean))Object.assign(target,c.parent);
   for(const target of [q,q.raw,patch].filter(Boolean))root.InquiryScheduleFlow?.project?.(target,{...s,items});
   root.InquiryFlow.take(g.ack.state);root.saveLocal?.();j.drop(kind,id,owner);
   return {ok:true,promoted:false,label:{visit_planned:'방문 예정',visit_done:'방문 완료 기록',quote_draft:p.amount?'견적 초안':'견적 발송 예정',quote_sent:'견적 발송 기록'}[p.kind],msg:planned?'새 내부 일정 저장 · 기존 업무 자동 완료 없음':'기존 업무 유지 · 후속 일정·파이프라인 전환은 별도 확인',receipt:g.ack};
  }catch(e){
   if(d&&!d.progress.scheduleSent&&!d.progress.scheduleAck&&!d.progress.sent&&!d.progress.ack)try{j.assertSession(session);j.drop(kind,id,owner);}catch(ignore){}
   if(d?.progress.scheduleAck&&!d.progress.ack)e.message+=' — 일정은 저장됐습니다. 같은 입력으로 남은 사실 저장만 확인해 주세요.';
   if(d?.progress.ack)e.message+=' — 사실 기록은 저장됐습니다. 같은 요청 번호로 확인합니다.';
   throw e;
  }finally{locks.delete(lock);}
 }
 return Object.freeze({route,pending,restore,save});
});
