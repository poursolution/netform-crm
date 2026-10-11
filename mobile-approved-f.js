/* Bind the existing schedule projection to Claude's original F nodes. */
(function(root){
 'use strict';
 function action(el,k){el.dataset.gs=k;el.setAttribute('role','button');el.tabIndex=0;}
 function render(model,options){
  const m=model||{},opt=options||{},box=root.document.createElement('div');box.innerHTML=root.MobileApprovedFSource;
  const frame=box.firstElementChild;frame.className='approved-f';const [head,week,body]=frame.children;
  action(head,'tab');head.dataset.tab='today';
  [...week.children].forEach((el,i)=>{const d=m.days?.[i];if(!d)return;el.children[0].textContent=d.weekday;el.children[1].textContent=d.day;el.children[1].style.background=d.selected?'#15171c':'transparent';el.children[1].style.color=d.selected?'#fff':'#15171c';el.children[2].style.background=d.count?'#3b6ce4':'transparent';action(el,'schedule-day');el.dataset.date=d.date;el.setAttribute('aria-label',d.date+' '+d.weekday+'요일');el.setAttribute('aria-current',d.selected?'date':'false');});
  const alert=body.firstElementChild,card=body.children[1].cloneNode(true),metrics=body.lastElementChild;
  [...body.children].slice(1,-1).forEach(n=>n.remove());
  if(m.alert){alert.firstElementChild.firstElementChild.textContent=m.alert.label;alert.firstElementChild.lastChild.textContent=' · '+m.alert.text;alert.lastElementChild.textContent='확인';action(alert,'deal');alert.dataset.id=m.alert.target_id;}
  else if(!m.ok){alert.firstElementChild.textContent='일정을 불러오지 못했습니다';alert.lastElementChild.textContent='확인 필요';}
  else if(m.coverage?.missingDateCount||m.coverage?.invalidDateCount||m.coverage?.missingTaskIdCount){alert.firstElementChild.textContent='일정 정보 확인 필요 · '+(m.coverage.missingDateCount+m.coverage.invalidDateCount+m.coverage.missingTaskIdCount)+'건';alert.lastElementChild.textContent='확인 필요';}
  else alert.remove();
  const rows=m.ok?m.rows||[]:[],pg=root.ListPager?.cut?root.ListPager.cut(rows,opt.page||1):{rows:rows.slice(0,20),pages:1};
  for(const r of pg.rows){const row=card.cloneNode(true);row.firstElementChild.textContent=r.time||'미확인';row.children[1].firstElementChild.textContent=r.name;row.children[1].lastElementChild.textContent=[r.type,r.title,r.state==='completed'?'완료 확인':r.state==='unknown'?'상태 확인 필요':''].filter(Boolean).join(' · ');if(r.open?.allowed){action(row,'deal');row.dataset.id=r.target_id;row.dataset.taskId=r.task_id;}body.insertBefore(row,metrics);}
  if(m.ok&&!rows.length){const empty=card.cloneNode(true);empty.firstElementChild.textContent='—';empty.children[1].firstElementChild.textContent='선택한 날짜의 등록 일정 없음';empty.children[1].lastElementChild.textContent='현재 불러온 내 업무 기준';body.insertBefore(empty,metrics);}
  if(pg.pages>1&&root.ListPager?.html){const pager=root.document.createElement('div');pager.innerHTML=root.ListPager.html(pg,{ns:'schedule',unit:'건'});body.insertBefore(pager,metrics);}
  [...metrics.children].slice(1).forEach((row,i)=>{const metric=m.metrics?.[i];row.firstElementChild.firstElementChild.textContent=metric?.label||row.firstElementChild.firstElementChild.textContent;row.firstElementChild.lastElementChild.textContent=metric?.state==='measured'?metric.value:'확인 필요';const bar=row.lastElementChild.firstElementChild;bar.style.width=metric?.state==='measured'&&Number.isFinite(metric.percent)?Math.max(0,Math.min(100,metric.percent))+'%':'0%';bar.style.visibility=metric?.state==='measured'?'visible':'hidden';row.title=metric?.reason||'';});
  metrics.firstElementChild.textContent='내 이번 주 · '+(m.start||'')+' ~ '+(m.end||'');body.style.overflowY='auto';
  return box.innerHTML;
 }
 root.MobileApprovedF=Object.freeze({render});
})(window);
