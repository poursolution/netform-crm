/* Original Claude D nodes. Shared ContactEntry / MobileEntry own all decisions and writes. */
(function(w){
 'use strict';
 const esc=v=>w.esc(String(v??'')),attr=v=>w.escAttr(String(v??''));
 function native(old,tag,cls){const n=document.createElement(tag);n.setAttribute('style',old.getAttribute('style')||'');n.className=cls;n.innerHTML=old.innerHTML;old.replaceWith(n);return n;}
 function action(old,key,value,cls){const n=native(old,'button','cd-native '+(cls||''));n.type='button';n.dataset.ce=key;if(value!=null)n.dataset.v=value;return n;}
 function render(m){
  const {s,d,ex,plan,ce,contact,requests,busy}=m;
  const box=document.createElement('div');box.innerHTML=w.MobileApprovedDSource;
  const frame=box.firstElementChild;frame.className='approved-d';
  const [head,context,request,body,footer]=frame.children;
  head.className='cd-head';const back=action(head.firstElementChild,'close',null,'cd-back');back.setAttribute('aria-label','뒤로');if(s.ch==='방문')head.lastElementChild.textContent='방문 결과';
  const work=w.dealWorkSummaryM?w.dealWorkSummaryM(d):d.work_type||'';
  context.className='cd-context';context.textContent=[work,d.construction_year||d.planned_year,d.nm,contact.name&&[contact.name,contact.role].filter(Boolean).join(' '),d.contactAt?'최근 '+ce.md(String(d.contactAt).slice(0,10))+' 통화':''].filter(Boolean).join(' · ');
  request.className='cd-request';
  if(requests.length)request.innerHTML=requests.map(r=>{const allowed=m.requestApi.isContact(r),picked=!!s.reqOn?.[r.id];return '<label><input type="checkbox" data-ce-in="req" data-id="'+attr(r.id)+'"'+(picked?' checked':'')+(allowed?'':' disabled')+'><span>'+esc((r.requested_by||'관리자')+' 요청: '+m.requestApi.labelOf(r))+(allowed?'':'<small>항목별 처리는 PC에서 확인</small>')+'</span></label>';}).join('');else request.hidden=true;
  body.className='ce cd-body';
  const [results,note,next,info]=[...body.children];
  results.className='cd-results';note.className='cd-note';next.className='cd-next-section';
  const resultChips=results.children[1],active=resultChips.children[0].cloneNode(true),inactive=resultChips.children[1].cloneNode(true);
  resultChips.className='ce-chips';resultChips.replaceChildren();
  ce.VALUES.forEach(v=>{const node=(s.res===v?active:inactive).cloneNode(true);resultChips.append(node);const b=action(node,'res',v,'ce-chip');b.textContent=v;b.setAttribute('aria-pressed',String(s.res===v));});
  note.firstElementChild.id='cd-memo-label';
  const textarea=native(note.children[1],'textarea','cd-native cd-memo');textarea.id='cd-memo';textarea.dataset.ceIn='memo';textarea.maxLength=300;textarea.textContent=s.memo||'';textarea.placeholder='이번에 확인한 내용을 적어 주세요';textarea.setAttribute('aria-labelledby','cd-memo-label');
  // Guide §14 explicitly places this supplied microphone component inside D's memo section.
  if(w.MobileInputReviewModel?.capabilities().speech.supported&&w.MobileApprovedMicSource?.html&&w.MobileInputFlow){note.insertAdjacentHTML('beforeend',w.MobileApprovedMicSource.html);note.lastElementChild.type='button';}
  note.hidden=!!s.res&&!ce.showNote(s.res);
  const nextBox=next.children[1];nextBox.className='cd-next';
  const existing=nextBox.children[0];existing.className='cd-existing';existing.innerHTML=ex?'<b>'+esc(ex.text)+'</b>'+(ex.due?' · '+esc(ce.md(ex.due)):''):'등록된 다음 업무 없음';
  const modeBox=nextBox.children[1],modeOn=modeBox.children[0].cloneNode(true),modeOff=modeBox.children[1].cloneNode(true);
  modeBox.className='ce-chips ce-modes';modeBox.replaceChildren();
  const modes=ce.isBadfit(s.res)?[['none','다음 일정 없음']]:ex?[['keep','유지'],['change','날짜 변경'],['new','새로 추가']]:[['new','새 업무'],['none','다음 일정 없음']];
  if(ex&&s.mode==='none'&&!ce.isBadfit(s.res))modes.push(['none','다음 일정 없음']);
  modes.forEach(([value,label])=>{const node=(s.mode===value?modeOn:modeOff).cloneNode(true);modeBox.append(node);const b=action(node,'mode',value,'ce-chip sm');b.textContent=label;b.setAttribute('aria-pressed',String(s.mode===value));});
  if(s.mode==='new')nextBox.insertAdjacentHTML('beforeend','<input class="ce-in" data-ce-in="purpose" maxlength="60" value="'+attr(s.purpose)+'" placeholder="다음에 할 일" aria-label="다음 업무 할 일">');
  if(s.mode==='new'||s.mode==='change')nextBox.insertAdjacentHTML('beforeend','<button type="button" class="cd-date-open" data-ce="date-open">'+esc(s.date?ce.md(s.date)+' · 날짜 선택':'날짜 선택')+'</button>');
  if(s.mode==='change'&&ex&&s.date&&(s.date>ex.due||w.ScheduleFlow?.enabled()))nextBox.insertAdjacentHTML('beforeend','<input class="ce-in" data-ce-in="reason" maxlength="80" value="'+attr(s.reason)+'" placeholder="날짜 변경 사유" aria-label="미루는 사유">');
  if(s.mode==='new')nextBox.insertAdjacentHTML('beforeend','<label class="ce-agree"><input type="checkbox" data-ce-in="plan"'+(s.plan==='customer'?' checked':'')+'>고객과 합의한 날짜</label>');
  if(s.mode==='none')nextBox.insertAdjacentHTML('beforeend','<input class="ce-in" data-ce-in="reason" maxlength="80" value="'+attr(s.reason)+'" placeholder="'+(ce.isBadfit(s.res)?'배드핏 사유':'다음 일정이 없는 이유')+'" aria-label="사유">');
  info.className='ce-infobtn';info.dataset.ce='info';
  if(s.err)body.insertAdjacentHTML('beforeend','<p class="ce-err" role="alert">'+esc(s.err)+'</p>');
  footer.className='ce-foot';footer.firstElementChild.className='ce-prev';footer.firstElementChild.setAttribute('aria-live','polite');footer.firstElementChild.textContent=plan?.ok?plan.preview:plan?.error||'연락 결과를 골라 주세요';
  const save=action(footer.lastElementChild,'save',null,'ce-save');save.textContent=busy?'저장 중':s.err?'다시 시도':'저장';save.disabled=busy||!plan?.ok;
  // A submitted payload is immutable. A partial failure only retries remaining operations.
  if(m.frozen||busy)frame.querySelectorAll('input,textarea,button:not(.cd-back):not(.ce-save)').forEach(n=>n.disabled=true);
  if(s.datePanel&&!m.frozen){const btn=(key,label,val)=>'<button type="button" data-ce="'+key+'"'+(val?' data-v="'+attr(val)+'"':'')+'>'+esc(label)+'</button>';frame.insertAdjacentHTML('beforeend','<div class="cd-date-layer"><button class="cd-date-backdrop" data-ce="date-close" aria-label="날짜 선택 닫기"></button><div class="cd-date-sheet" role="dialog" aria-label="날짜 선택"><div class="cd-grip"></div><b>날짜 선택</b><div class="ce-dates">'+m.dateOptions.map(([label,v])=>'<button type="button" class="ce-date" data-ce="date" data-v="'+attr(v)+'" aria-pressed="'+(s.date===v)+'">'+esc(label+' · '+ce.md(v))+'</button>').join('')+'</div><label class="cd-direct">직접 입력<input type="date" data-ce-in="date" min="'+m.today+'" value="'+attr(s.date)+'"></label><button type="button" class="cd-confirm" data-ce="date-close">확인</button></div></div>');}
  return box.innerHTML;
 }
 w.MobileContactView=Object.freeze({render});
})(window);
