/* Bind the approved H summary only. No writes, automatic dates or inferred completion. */
(function(w){
 'use strict';
 const text=v=>String(v==null?'':v);
 const count=v=>Number.isSafeInteger(v)&&v>=0?String(v):'확인 필요';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function action(el,key){el.dataset.gs=key;el.setAttribute('role','button');el.tabIndex=0;return el;}
 function render(model={}){
  const box=document.createElement('div');box.innerHTML=w.MobileApprovedHSource;
  const frame=box.firstElementChild;frame.className='approved-h';frame.dataset.approvedScreen='H';
  const [head,body,foot]=frame.children;body.className='approved-h-body';action(head.firstElementChild,'tab');head.firstElementChild.dataset.tab='today';head.firstElementChild.setAttribute('aria-label','뒤로');
  head.lastElementChild.textContent='오늘 마감'+(model.dateLabel?' · '+text(model.dateLabel):'');
  const groups=[model.done,model.open,model.tomorrow];
  [...body.children].forEach((card,i)=>{
   const group=groups[i]||{},template=card.children[1].cloneNode(true);
   card.firstElementChild.lastElementChild.textContent=count(group.count);
   [...card.children].slice(1).forEach(n=>n.remove());
   const rows=Array.isArray(group.rows)?group.rows:[],pg=w.ListPager?w.ListPager.cut(rows,group.page||1,20):{rows:rows.slice(0,20),pages:1};
   pg.rows.forEach(item=>{const row=template.cloneNode(true);row.textContent=text(typeof item==='string'?item:item.text);if(item?.key)row.dataset.taskKey=text(item.key);if(UUID.test(text(item?.dealId))){action(row,'deal');row.dataset.id=item.dealId;}card.append(row);});
   if(pg.pages>1){card.insertAdjacentHTML('beforeend',w.ListPager.html(pg,{ns:'gs',v:'h-'+['done','open','tomorrow'][i],small:true,info:false}));card.querySelectorAll('[data-gs="page"]').forEach(button=>{button.dataset.gs='day-close-page';button.dataset.group=['done','open','tomorrow'][i];});}
  });
  const save=action(foot.firstElementChild,'day-close'),disabled=model.canClose!==true||!!model.busy;
  save.setAttribute('aria-disabled',String(disabled));save.tabIndex=disabled?-1:0;
  if(model.blockedReason)save.setAttribute('title',text(model.blockedReason));
  if(model.busy)save.textContent='확인 중…';
  // A completed clipboard/share action is not a server-side closing event.
  frame.dataset.shareState=['copied','shared','failed'].includes(model.shareState)?model.shareState:'idle';
  return box.innerHTML;
 }
 /* No confirmed common day-close projection/write contract is loaded on mobile.
    MobileLoop.daySummary counts contacted sites. PC DayExtra.closeModel also counts
    TOUCH records as done; neither proves that a task was completed. Never substitute
    those values for H's completed-task count. Keep unresolved values explicit.
    DayExtra.closeSave additionally requires reason/date fields absent from approved H.
    Its closeCopy is clipboard copying, not a persisted closing event or delivered share. */
 function read(){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
  return {dateLabel:today.replace(/^\d{4}-0?/,'').replace('-','.'),done:{rows:[]},open:{rows:[]},tomorrow:{rows:[]},canClose:false,busy:false,shareState:'idle',blockedReason:'확인된 완료 업무 집계와 마감 저장 연결이 필요합니다. 현재 화면은 일정 변경·마감 저장·공유를 실행하지 않습니다.'};
 }
 w.MobileApprovedH=Object.freeze({render});
 w.MobileDayCloseModel=Object.freeze({read});
})(window);
