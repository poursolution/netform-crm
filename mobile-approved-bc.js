/* Bind models to the supplied B/C nodes; preserve the approved layout declarations. */
(function(w){
 'use strict';
 function action(el,key,values){el.dataset.gs=key;Object.assign(el.dataset,values||{});el.setAttribute('role','button');el.tabIndex=0;return el;}
 function source(key){const box=document.createElement('div');box.innerHTML=w.MobileApprovedBCSource[key];const frame=box.firstElementChild;frame.className='approved-bc approved-'+key.toLowerCase();frame.dataset.approvedScreen=key;return {box,frame};}
 function nav(el){[...el.children].forEach((n,i)=>action(n,'tab',{tab:['today','mine','record','schedule'][i]}));}
 function listing(model){
  const {box,frame}=source('B'),[head,search,stages,list,tabs]=frame.children;
  const original=search.firstElementChild,input=document.createElement('input');
  input.setAttribute('style',original.getAttribute('style'));input.className='approved-search';input.setAttribute('value',model.query||'');input.placeholder=original.textContent;input.setAttribute('aria-label','현장 검색');input.dataset.gsQuery='';original.replaceWith(input);
  search.lastElementChild.textContent=model.filterLabel||'필터';action(search.lastElementChild,'filter');
  const active=stages.children[0].cloneNode(true),inactive=stages.children[1].cloneNode(true);stages.replaceChildren();stages.className='approved-stages';
  model.stages.forEach(item=>{const selected=item.key===model.stage,n=(selected?active:inactive).cloneNode(true);n.textContent=item.label;action(n,'stage',{value:item.key});n.setAttribute('aria-pressed',String(selected));stages.append(n);});
  const template=list.firstElementChild.cloneNode(true);list.replaceChildren();list.className='gs-list approved-list';
  model.rows.forEach(item=>{const n=template.cloneNode(true);n.className='gs-row approved-row';n.style.borderLeftColor=item.color;const [left,right]=n.children;left.children[0].textContent=item.name;left.children[1].textContent=item.subtitle;right.children[0].textContent=item.task;right.children[1].textContent=item.due;right.children[1].style.color=item.dueColor;action(n,'deal',{id:item.id});list.append(n);});
  if(model.pager)list.insertAdjacentHTML('beforeend',model.pager);
  if(!model.rows.length){const empty=document.createElement('span');empty.className='approved-empty';empty.textContent='해당하는 영업건이 없습니다.';list.append(empty);}
  nav(tabs);return box.innerHTML;
 }
 function detail(model){
  const {box,frame}=source('C'),[head,body]=frame.children;
  body.className='approved-detail-body';action(head.firstElementChild,'back');head.firstElementChild.setAttribute('aria-label','뒤로');action(head.lastElementChild,'stage-change');
  const [identity,now,contact,history,more]=body.children;
  identity.children[0].textContent=model.brand;identity.children[0].style.color=model.color;identity.children[1].textContent=model.name;
  identity.children[2].children[0].textContent=model.stage;identity.children[2].children[1].textContent=model.owner;
  identity.children[3].textContent=model.siblings||'';identity.children[3].hidden=!model.siblings;
  now.className='gs-now';now.children[1].textContent=model.task;now.children[2].textContent=model.context;
  now.children[3].textContent=model.actionLabel;action(now.children[3],model.action||'pending-task');
  now.children[4].textContent=model.followup||'';now.children[4].hidden=!model.followup;
  contact.children[0].children[0].textContent=model.contactName;contact.children[0].children[1].textContent=model.phone||'전화번호 미입력';
  action(contact.children[0],'contact-card');contact.children[0].setAttribute('aria-label','현장 연락처 · 명함 확인');
  action(contact.children[1],'phone');action(contact.children[2],'sms');[contact.children[1],contact.children[2]].forEach(n=>n.setAttribute('aria-disabled',String(!model.phone)));
  action(history.children[0].lastElementChild,'history');
  const row=history.children[1].cloneNode(true);[...history.children].slice(1).forEach(n=>n.remove());
  const entries=model.history.length?model.history:[{meta:'저장된 응대 기록 확인 필요',note:''}];
  entries.forEach(x=>{const n=row.cloneNode(true);n.children[0].textContent=x.meta;n.children[1].textContent=x.note;history.append(n);});
  [...more.children].forEach((n,i)=>{n.children[1].textContent=model.more[i]||'확인 필요 ›';action(n,'more',{value:n.children[0].textContent});});
  return box.innerHTML;
 }
 w.MobileApprovedBC={listing,detail};
})(window);
