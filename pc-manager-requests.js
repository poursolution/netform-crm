/* PC request UI. Explicit server adapter required; never writes local completion or sends messages. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PCManagerRequests=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const labels={requested:'요청함',overdue:'미조치 · 기한초과',completed:'처리 완료'};
 function mount(w,host,api,options){
  if(!api||typeof api.list!=='function'||typeof api.create!=='function')throw Error('관리자 요청 서버 연결이 필요합니다.');
  let rows=[],dialog=null,disposed=false,generation=0;const retries=options.retryStore||new Map();
  const el=(tag,text,cls)=>{const n=w.document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const date=value=>new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(value));
  function render(){
   host.replaceChildren();host.classList.add('pc-manager-requests');
   const title=el('h3','관리자 요청');host.append(title);
   if(!rows.length){host.append(el('p','등록된 요청이 없습니다.'));return;}
   const summary=el('p',`요청 ${rows.length} · 완료 ${rows.filter(x=>x.state==='completed').length} · 미조치 ${rows.filter(x=>x.state==='overdue').length}`);host.append(summary);
   for(const r of rows){const line=el('article',undefined,'manager-request-row');
    line.append(el('strong',r.instruction),el('span',labels[r.state]||'상태 확인 필요','manager-request-state '+r.state));
    line.append(el('small',`${r.requested_by} 요청 · 기한 ${date(r.due_at)}`));
    line.append(el('small',r.state==='completed'&&r.completion?`처리 기록 ${date(r.completion.completed_at)}`:'담당자 처리 기록 대기'));
    line.append(el('small','카카오 미발송 · POUR공법 채널 연동 대기'));
    const view=el('button','문의 확인');view.type='button';view.onclick=()=>options.openInquiry(r.target_id);line.append(view);host.append(line);
   }
  }
  async function refresh(){const ticket=++generation;try{const data=await api.list();if(disposed||ticket!==generation)return;if(!Array.isArray(data))throw Error('서버 응답을 확인하지 못했습니다.');rows=data;render();}catch(e){if(disposed||ticket!==generation)return;host.replaceChildren(el('p','요청을 불러오지 못했습니다. 다시 시도해 주세요.'));}}
  function open(inquiry){
   if(!options.isAdmin()||disposed)return;
   if(dialog)dialog.close();const prior=w.document.activeElement;
   dialog=el('dialog',undefined,'pc-manager-request-dialog');const current=dialog;
   const form=el('form'),heading=el('h2','담당자에게 요청');heading.id='manager-request-title';current.setAttribute('aria-labelledby',heading.id);
   form.append(heading,el('p',`${inquiry.site} · ${inquiry.owner}`));
   const kind=el('select');kind.name='kind';[['call','고객 전화 요청']].forEach(([v,t])=>{const o=el('option',t);o.value=v;kind.append(o);});
   const due=el('input');due.type='datetime-local';due.name='due';due.required=true;due.step='any';
   const defaults={call:'고객에게 전화 후 응대 결과를 CRM에 남겨주세요.',next:'다음 행동과 확인일을 CRM에 등록해주세요.'};
   const note=el('textarea');note.name='instruction';note.required=true;note.maxLength=2000;note.rows=3;note.value=defaults.call;
   kind.onchange=()=>{if(Object.values(defaults).includes(note.value))note.value=defaults[kind.value];};
   for(const [text,field] of [['요청 종류',kind],['처리기한',due],['요청 내용',note]]){const label=el('label',text);label.append(field);form.append(label);}
   form.append(el('p','CRM에 요청을 저장합니다. 카카오 메시지는 아직 발송되지 않습니다.'));
   const status=el('p');status.setAttribute('role','status');const save=el('button','요청 저장');save.type='submit';const close=el('button','닫기');close.type='button';close.onclick=()=>current.close();form.append(status,save,close);current.append(form);w.document.body.append(current);
   let pending=false,retry=null,journalBlocked=false;
   try{retry=retries.get(inquiry.id)||null;}catch(e){journalBlocked=true;status.textContent='이전 요청 확인이 필요합니다. 저장을 중지했습니다.';save.disabled=true;}
   if(retry){kind.value=retry.payload.p_kind;note.value=retry.payload.p_instruction;const d=new Date(retry.payload.p_due);due.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,-1);}
   form.onsubmit=async event=>{event.preventDefault();if(pending||journalBlocked||disposed)return;
    const deadline=new Date(due.value).getTime(),instruction=note.value.trim();
    if(!instruction||!Number.isFinite(deadline)||(!retry&&deadline<=Date.now())){status.textContent='요청 내용과 미래 처리기한을 입력해 주세요.';return;}
    const payload={p_target:inquiry.id,p_kind:kind.value,p_due:new Date(deadline).toISOString(),p_instruction:instruction};
    const signature=JSON.stringify(payload);
    if(retry&&retry.signature!==signature){status.textContent='이전 저장 결과가 불확실합니다. 입력값을 복원해 다시 시도한 뒤 새 요청을 작성해 주세요.';return;}
    if(!retry){const draft={signature,payload:{...payload,p_id:w.crypto.randomUUID()}};try{retries.set(inquiry.id,draft);retry=draft;}catch(e){status.textContent='재시도 정보를 보관하지 못해 저장을 중지했습니다.';return;}}
    pending=true;save.disabled=true;kind.disabled=due.disabled=note.disabled=true;status.textContent='서버 저장 확인 중…';
    try{const ack=await api.create(retry.payload);if(!ack||ack.ok!==true||!ack.id)throw Error('확인되지 않은 응답');retries.delete(inquiry.id);retry=null;status.textContent='요청 저장 완료 · 카카오 미발송';save.hidden=true;await refresh();}
    catch(e){status.textContent='저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.';}
    finally{pending=false;save.disabled=false;if(retry){kind.disabled=due.disabled=note.disabled=false;}}
   };
   current.addEventListener('close',()=>{current.remove();if(dialog===current)dialog=null;if(prior?.isConnected)prior.focus();});current.showModal();kind.focus();
  }
  function dispose(){disposed=true;generation++;if(dialog){dialog.close();dialog.remove();dialog=null;}host.replaceChildren();}
  return {refresh,open,dispose};
 }
 // Attach to the existing PC inquiry renderer only after its server adapter is admitted.
 function install(w,api){
  if(typeof w.paintInq!=='function')throw Error('PC 견적문의 화면을 찾을 수 없습니다.');
  const original=w.paintInq,originalToday=w.paintTodayHome;let controller=null,todayController=null;const retryStore=api.retryStore||new Map();
  const isAdmin=()=>w.inqCtlRoleView()==='admin';
  const openInquiry=id=>{const q=(w.INQ_CONSOLE_CACHE||[]).find(x=>String(x.id)===String(id));if(q)w.inqCtlOpenSingle(w.inqKey(q));else w.toast('문의 데이터를 확인할 수 없습니다. 견적문의에서 다시 확인해 주세요.');};
  function paintToday(){const result=originalToday.apply(this,arguments);
   if(todayController)todayController.dispose();todayController=null;
   const panel=w.document.querySelector('#pg-today');if(!panel)return result;
   panel.querySelector('[data-manager-today]')?.remove();
   const host=w.document.createElement('section');host.dataset.managerToday='true';panel.prepend(host);
   todayController=mount(w,host,{...api,list:async()=>{const rows=await api.list();return rows.filter(r=>r.state!=='completed');}},{isAdmin,retryStore,openInquiry});
   todayController.refresh();return result;
  }
  function paint(){const result=original.apply(this,arguments);
   if(controller)controller.dispose();controller=null;
   const panel=w.document.querySelector('#sg-panel');if(!panel)return result;
   const host=w.document.createElement('section');panel.append(host);
   controller=mount(w,host,api,{isAdmin,retryStore,openInquiry:id=>{const q=(w.INQ_CONSOLE_CACHE||[]).find(x=>String(x.id)===String(id));if(q)w.inqCtlOpenSingle(w.inqKey(q));else w.toast('현재 목록에서 문의를 찾을 수 없습니다. 필터를 확인해 주세요.');}});
   const current=controller;current.refresh();
   if(isAdmin())panel.querySelectorAll('.inq-work-row[data-k]').forEach(row=>{
    const q=(w.INQ_CONSOLE_CACHE||[]).find(x=>w.inqKey(x)===row.dataset.k);if(!q||!w.inquiryRoutedOwner(q))return;
    const button=w.document.createElement('button');button.type='button';button.textContent='담당자에게 요청';
    button.addEventListener('click',event=>{event.stopPropagation();current.open({id:q.id,site:q.site||'문의',owner:w.repDisplay(w.inquiryRoutedOwner(q))});});
    row.lastElementChild.append(button);
   });return result;
  }
  w.paintInq=paint;
  if(typeof originalToday==='function')w.paintTodayHome=paintToday;
  const clear=()=>{if(controller)controller.dispose();controller=null;if(todayController)todayController.dispose();todayController=null;w.document.querySelector('[data-manager-today]')?.remove();};w.addEventListener('phase1:identity-cleared',clear);
  return ()=>{clear();if(w.paintInq===paint)w.paintInq=original;if(w.paintTodayHome===paintToday)w.paintTodayHome=originalToday;w.removeEventListener('phase1:identity-cleared',clear);};
 }
 return {mount,install};
});
