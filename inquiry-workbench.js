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
    c[1].textContent='접수';c[2].textContent='현장 / 문의자';c[5].textContent='영업담당';c[7].textContent='현재 상태';
    const elapsed=document.createElement('span');elapsed.textContent='경과';
    c[1].prepend(c[0]);row.replaceChildren(c[1],c[2],c[5],c[7],elapsed,c[8]);
   }else{
    const q=root.INQ_CONSOLE_CACHE.find(q=>root.inqKey(q)===row.dataset.k);if(!q)return;
    const work=document.createElement('small');work.className='inq-work-meta';work.textContent=[c[3].textContent,root.inquiryConsultant(q)?'상담 '+root.inquiryConsultant(q):''].filter(Boolean).join(' · ');c[2].append(work);
    c[1].prepend(c[0]);c[7].append(c[6]);
    const elapsed=document.createElement('span'),at=root.inquiryCreatedAt(q),hours=root.todayHoursFrom(at);elapsed.textContent=hours==null?'접수일 미기록':hours>=24?Math.floor(hours/24)+'일':Math.floor(hours)+'시간';
    if(root.inquiryResponseLate(q))elapsed.className='inq-work-late';
    if(root.inquiryRoutedOwner(q)){
     const open=document.createElement('button');open.className='inq-work-open';open.textContent=root.inqCtlBucket(q)==='배정완료'?'응대 기록':'다음 처리';
     open.addEventListener('click',event=>{event.stopPropagation();root.inqCtlOpenSingle(root.inqKey(q))});c[8].prepend(open);
    }
    // Retain the existing row, assignment and checkbox handlers while grouping secondary fields.
    row.replaceChildren(c[1],c[2],c[5],c[7],elapsed,c[8]);
    row.querySelectorAll(':scope > span').forEach((cell,i)=>cell.dataset.label=['접수','현장 / 문의자','영업담당','현재 상태','접수 후 경과','처리'][i]);
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
 }
 root.paintInq=function(){const result=originalPaint.apply(this,arguments);decorate();return result};
 root.InquiryWorkbench={set,delayed};
})(window);
