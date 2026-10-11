/* Source44 mobile phone frames only. Money and differences must arrive from the shared server; no arithmetic or writes here. */
(function(w){
 'use strict';
 const text=v=>String(v==null?'':v),shown=v=>v===undefined||v===null?'확인 필요':text(v);
 const kinds=['simple','standards','method','markup'];
 const BLOCKED='공통 견적 조회·저장 계약과 승인된 입력 흐름 연결 전입니다. 금액·기준·견적 상태를 변경하지 않습니다.';
 function action(el,name,blocked){el.dataset.gs=name;el.setAttribute('role','button');el.tabIndex=0;if(blocked){el.setAttribute('aria-disabled','true');el.title=blocked;}return el;}
 function render(kind,model={}){
  if(!kinds.includes(kind))throw new TypeError('Unsupported approved quote phone');
  const box=document.createElement('div');box.innerHTML=w.MobileApprovedQuoteExtraSource[kind];
  const frame=box.firstElementChild;frame.className='approved-quote-extra approved-quote-'+kind;frame.dataset.approvedScreen='quote-'+kind;
  const [head,context,body,foot]=frame.children;
  action(head.firstElementChild,'back');head.firstElementChild.setAttribute('aria-label','뒤로');
  if(model.title!==undefined)head.lastElementChild.textContent=text(model.title);
  else if(kind==='standards')head.lastElementChild.textContent='견적 기준 확인';
  context.textContent=shown(model.context);
  const blocked=text(model.blockedReason||BLOCKED);
  if(kind==='markup'){
   const [base,label,ways,area,value,additional]=body.children;
   base.lastElementChild.textContent=shown(model.baseAmount);
   const selectedStyle=ways.children[0].getAttribute('style'),idleStyle=ways.children[1].getAttribute('style');
   ['area','multiplier','flat','none'].forEach((type,i)=>{const chip=ways.children[i];chip.setAttribute('style',model.type===type?selectedStyle:idleStyle);action(chip,'quote-extra-action',blocked);chip.dataset.action='markup-type';chip.dataset.markupType=type;chip.setAttribute('aria-pressed',String(model.type===type));});
   // Source44 defines one method at a time. Only its existing row templates are reused.
   // The prototype's arithmetic is deliberately not imported.
   if(model.type==='multiplier'||model.type==='flat'){
    area.remove();value.firstElementChild.textContent=model.type==='multiplier'?'배수':'더할 금액';value.lastElementChild.firstElementChild.textContent=shown(model.value);value.lastElementChild.lastElementChild.textContent=model.type==='multiplier'?'배':'원';
   }else if(model.type==='none'){
    area.remove();value.remove();
   }else{
    area.lastElementChild.firstElementChild.textContent=shown(model.area);value.lastElementChild.firstElementChild.textContent=shown(model.value);
   }
   additional.lastElementChild.textContent=shown(model.additionalAmount);
   foot.firstElementChild.lastElementChild.textContent=shown(model.submitAmount);
   action(foot.lastElementChild,'quote-extra-action',blocked).dataset.action='submit-confirm';
  }else{
   const rows=Array.isArray(model.rows)?model.rows:[],rawRows=[...body.children];
   rawRows.forEach((row,i)=>{
    const item=rows[i]||{},line=row.firstElementChild;
    line.firstElementChild.textContent=shown(item.label);
    line.lastElementChild.textContent=shown(item.value);
    row.lastElementChild.textContent=shown(item.detail);
    if(kind==='simple'&&i===3){action(row,'quote-extra-action',blocked).dataset.action='simple-item-add';}
   });
   foot.firstElementChild.textContent=shown(model.pre);
   const actions=kind==='standards'?['basis-retain','basis-update']:kind==='method'?['method-draft','method-review']:['simple-draft','simple-final'];
   [...foot.lastElementChild.children].forEach((button,i)=>{action(button,'quote-extra-action',blocked).dataset.action=actions[i];});
  }
  return box.innerHTML;
 }
 w.MobileApprovedQuoteExtra=Object.freeze({render,kinds:Object.freeze(kinds.slice())});
})(window);
