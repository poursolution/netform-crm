(function(root){
 'use strict';
 const originalPaint=root.paintInq,originalRows=root.inqCtlRows,originalTab=root.inqCtlSetTab;
 const h=v=>root.esc(String(v==null?'':v));
 function delayed(q){
  const bucket=root.inqCtlBucket(q);if(['영업전환','스토어 이관','보류'].includes(bucket))return false;
  const a=root.actionObj(q,root.itemPatch(q,'inq')),n=a&&a.due?root.daysTo(a.due):null;
  return root.inquiryResponseLate(q)||(Number.isFinite(n)&&n<0);
 }
 root.inqCtlRows=function(){const rows=originalRows.apply(this,arguments);return root.inqCtlRoleView()==='admin'&&root.G.inqCompactMetric==='delayed'&&root.G.inqBucket==='전체'?rows.filter(delayed):rows};
 root.inqCtlSetTab=function(tab){root.G.inqCompactMetric='';return originalTab(tab)};
 function set(key){
  const tabs={all:'전체',unassigned:'미배정',waiting:'배정완료',delayed:'전체'};if(!tabs[key])return;
  root.G.inqCompactMetric=key==='delayed'?'delayed':'';root.G.inqView='console';originalTab(tabs[key]);
 }
 function toolsState(open){root.G.inqToolsOpen=!!open}
 function compactRows(){
  document.querySelectorAll('#sg-panel .inq-ctl-row:not(.mine-row)').forEach(row=>{
   const c=Array.from(row.children);if(c.length!==9)return;
   row.classList.add('inq-work-row');
   if(row.classList.contains('head')){
    const labels=['접수 / 경과','현장 · 문의자','담당 / 상태','최근 응대','다음 할 일','바로 조치'];
    const cells=labels.map(text=>{const cell=document.createElement('span');cell.textContent=text;return cell});cells[0].prepend(c[0]);row.replaceChildren(...cells);
   }else{
    const q=root.INQ_CONSOLE_CACHE.find(q=>root.inqKey(q)===row.dataset.k);if(!q)return;
    const work=document.createElement('small');work.className='inq-work-meta';work.textContent=[q.brand,c[3].textContent].filter(Boolean).join(' · ');
    c[2].innerHTML='<strong>'+h(q.site||'현장명 미입력')+'</strong>'+(root.inqCtlContactLabel(q)?'<small>'+h(root.inqCtlContactLabel(q))+'</small>':'');c[2].append(work);
    c[1].prepend(c[0]);
    const elapsed=document.createElement('small'),at=root.inquiryCreatedAt(q),hours=root.todayHoursFrom(at);elapsed.textContent=hours==null?'접수일 미기록':hours>=24?'D+'+Math.floor(hours/24):Math.max(0,Math.floor(hours))+'시간';
    if(root.inquiryResponseLate(q)||(!root.inquiryRoutedOwner(q)&&hours>=24))elapsed.className='inq-work-late';c[1].append(elapsed);
    const patch=root.itemPatch(q,'inq'),next=root.actionObj(q,patch)||{},owner=root.inquiryRoutedOwner(q);
    c[5].innerHTML='<strong'+(!owner?' class="inq-work-late"':'')+'>'+h(owner?root.repDisplay(owner):'미배정')+'</strong><small>'+root.inqCtlStatusBadge(q)+'</small>';
    const seen=new Set(),activities=[...(q.activities||[]),...(patch.activities||[])].filter(a=>{const key=a.id||[a.at,a.type,a.note,a.result].join('|');if(seen.has(key))return false;seen.add(key);return /전화|통화|문자|SMS|카카오|이메일|메일|방문/i.test(a.type||'')&&Number.isFinite(Date.parse(a.at||a.created_at))}).sort((a,b)=>Date.parse(b.at||b.created_at)-Date.parse(a.at||a.created_at));
    const recent=document.createElement('span'),latest=activities[0];recent.className='inq-work-recent';recent.innerHTML=latest?'<strong>'+h(root.fmtD(latest.at||latest.created_at)+' · '+latest.type)+'</strong><small>'+h([latest.note,latest.result].filter(Boolean).join(' · ')||'내용 미기록')+'</small>':'<small>응대 기록 없음</small>';
    const todo=document.createElement('span');todo.className='inq-work-next';todo.innerHTML='<strong>'+h(next.text||'⚠ 다음 할 일 없음')+'</strong><small>'+h(next.due?root.fmtD(next.due):'일정 없음')+'</small>';
    if(root.inquiryRoutedOwner(q)){
     const open=document.createElement('button');open.className='inq-work-open';open.textContent=root.inqCtlBucket(q)==='배정완료'?'응대 기록':'다음 처리';
     open.textContent=root.inqCtlFirstResponseAt(q)?'기록':'응대 기록';open.addEventListener('click',event=>{event.stopPropagation();root.inqCtlOpenSingle(root.inqKey(q))});c[8].prepend(open);
    }
    // Retain the existing row, assignment and checkbox handlers while grouping secondary fields.
    row.replaceChildren(c[1],c[2],c[5],recent,todo,c[8]);
    row.querySelectorAll(':scope > span').forEach((cell,i)=>cell.dataset.label=['접수 / 경과','현장 · 문의자','담당 / 상태','최근 응대','다음 할 일','바로 조치'][i]);
   }
  });
 }
 function decorate(){
  const admin=root.inqCtlRoleView()==='admin',page=document.getElementById('pg-inq');page.classList.toggle('inq-workbench',admin);if(!admin)return;
  const signals=root.$('#sg-signals'),active=root.inqCtlScopeActive(),counts=root.inqCtlCounts(active,root.inqCtlScopeTrash(),root.inqTechReviewRows());
  const selected=root.G.inqCompactMetric==='delayed'?'delayed':root.G.inqBucket==='미배정'?'unassigned':root.G.inqBucket==='배정완료'?'waiting':root.G.inqBucket==='전체'?'all':'';
  const status=document.createElement('nav');status.className='inq-work-counts';status.setAttribute('aria-label','견적문의 처리 상태');
  status.innerHTML=[['unassigned','미배정',counts.미배정],['waiting','응대대기',counts.배정완료],['delayed','처리지연',active.filter(delayed).length],['all','전체',counts.전체]].map(([key,label,n])=>'<button aria-pressed="'+(selected===key)+'" data-key="'+key+'" onclick="InquiryWorkbench.set(this.dataset.key)">'+label+' <b>'+n+'</b></button>').join('');
  const tools=document.createElement('details');tools.className='inq-work-tools';tools.open=!!root.G.inqToolsOpen;tools.addEventListener('toggle',()=>toolsState(tools.open));
  tools.innerHTML='<summary>관리도구 · 상세보기 / 지역 / 연결·중복 / 보류 / 휴지통</summary>';
  const tabs=signals.querySelector('.inq-ctl-tabs'),toolbar=signals.querySelector('.inq-ctl-toolbar'),roles=signals.querySelector('.inq-role-switch');
  if(tabs){Array.from(tabs.children).forEach(b=>{if(['전체','미배정','배정완료'].includes(b.dataset.t))b.remove()});tools.append(tabs)}
  if(toolbar)tools.append(toolbar);if(roles)tools.append(roles);
  const bulk=root.$('#sg-panel .inq-ctl-bulk');if(bulk){bulk.classList.add('inq-work-bulk');tools.append(bulk)}
  signals.prepend(status,tools);
  const old=root.$('#sg-panel .inq-ctl-summary');if(old)old.remove();
  compactRows();
  const brand=page.querySelector('.brandbar');
  if(brand){
   const filters=document.createElement('form');filters.className='inq-work-filters';
   const owners=Array.from(new Set((root.B.inquiries||[]).map(root.inquiryRoutedOwner).filter(Boolean))).sort();if(root.G.rep&&root.G.rep!=='전체'&&!owners.includes(root.G.rep))owners.push(root.G.rep);
   filters.innerHTML='<label>담당자<select name="owner" aria-label="문의 담당자">'+['전체'].concat(owners).map(n=>'<option '+(root.G.rep===n?'selected':'')+'>'+h(n)+'</option>').join('')+'</select></label><label>상태<select name="status" aria-label="문의 상태">'+['전체','미배정','배정완료','응대중','영업전환','스토어 이관','보류'].map(n=>'<option '+(root.G.inqBucket===n?'selected':'')+'>'+h(n)+'</option>').join('')+'</select></label><label>공종<select name="work" aria-label="문의 공종">'+root.workFilterOptions(root.G.workFilter||'전체')+'</select></label><label class="inq-work-search">검색<input name="query" value="'+root.escAttr(root.G.q||'')+'" placeholder="현장·문의자 검색"></label><button>검색</button>';
   filters.onsubmit=e=>{e.preventDefault();root.G.rep=filters.elements.owner.value;root.G.workFilter=filters.elements.work.value;root.G.q=filters.elements.query.value.trim();root.G.inqPage=1;root.G.inqCompactMetric='';root.G.inqBucket=filters.elements.status.value;root.paint()};
   filters.querySelectorAll('select').forEach(el=>el.onchange=()=>filters.requestSubmit());brand.after(filters);
  }
 }
 root.paintInq=function(){const result=originalPaint.apply(this,arguments);decorate();return result};
 root.InquiryWorkbench={set,delayed};
})(window);
