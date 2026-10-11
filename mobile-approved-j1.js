/* Approved J-1 nodes only. No inferred checklist state and no write operations. */
(function(w){
 'use strict';
 const text=v=>String(v==null?'':v),UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const DATE=/^\d{4}-\d{2}-\d{2}(?:T.*)?$/;
 function evidenceValid(item){const at=text(item?.confirmedAt),day=at.slice(0,10);return item?.verified===true&&item.evidence?.kind==='activity'&&UUID.test(text(item.evidence.id))&&DATE.test(at)&&Number.isFinite(Date.parse(at))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;}
 function action(el,key){el.dataset.gs=key;el.setAttribute('role','button');el.tabIndex=0;return el;}
 function render(model={}){
  const box=document.createElement('div');box.innerHTML=w.MobileApprovedJ1Source;
  const frame=box.firstElementChild;frame.className='approved-j1';frame.dataset.approvedScreen='J-1';
  const [head,body]=frame.children;action(head.firstElementChild,'stage-confirmation-back');head.firstElementChild.setAttribute('aria-label','뒤로');
  const [name,now,checks,note]=body.children;name.textContent=text(model.name||'현장 확인 필요');
  now.children[1].textContent=text(model.task||'현재 업무 확인 필요');now.children[2].textContent=text(model.actionLabel||'업무 확인');
  action(now.children[2],model.action==='contact'?'contact':'pending-task');now.children[2].setAttribute('aria-disabled',String(model.actionAllowed!==true));
  if(model.actionBlockedReason)now.children[2].title=text(model.actionBlockedReason);
  checks.children[0].lastElementChild.textContent=text(model.context||'공통 기준 확인 필요');
  const complete=checks.children[1].cloneNode(true),pending=checks.children[2].cloneNode(true);
  [...checks.children].slice(1).forEach(row=>row.remove());
  // The approved design calls for at most three situation-specific questions.
  // Callers must use a shared rule/evidence projection; raw memo text is not evidence.
  (Array.isArray(model.checks)?model.checks:[]).slice(0,3).forEach(item=>{
   const confirmed=evidenceValid(item),row=(confirmed?complete:pending).cloneNode(true),content=row.children[1];
   row.dataset.confirmed=String(confirmed);content.children[0].textContent=text(item.label);
   content.children[1].textContent=text(confirmed?item.detail||item.confirmedAt:item.detail||'아직 모름');
   if(confirmed){const link=action(content.children[1],'stage-confirmation-evidence');link.dataset.evidenceId=item.evidence.id;link.dataset.evidenceKind=item.evidence.kind;link.dataset.confirmedAt=item.confirmedAt;if(UUID.test(text(model.dealId)))link.dataset.dealId=model.dealId;link.setAttribute('aria-label',text(item.label)+' 근거 기록 보기');}
   checks.append(row);
  });
  if(model.notice!==undefined)note.textContent=text(model.notice);
  return box.innerHTML;
 }
 w.MobileApprovedJ1=Object.freeze({render,evidenceValid});
})(window);
