/* 선택 기준은 PeopleEligibility, 이 파일은 '현재 선택 + 필요할 때 변경'만 담당합니다. */
(function(root){
 'use strict';
 const targets='#nd-rep,#dv-assignee,#dv-na-assignee,#tr-assignee';
 function mount(select){
  if(select.dataset.ownerChoice)return;
  select.dataset.ownerChoice='true';
  const doc=select.ownerDocument,box=doc.createElement('div'),summary=doc.createElement('div');
  const name=doc.createElement('strong'),reason=doc.createElement('span'),button=doc.createElement('button');
  box.className='owner-choice';summary.className='owner-choice-summary';button.type='button';
  button.setAttribute('aria-controls',select.id);name.setAttribute('aria-live','polite');
  summary.append(name,reason,button);select.before(box);box.append(summary,select);
  const label=select.closest('.field')?.querySelector('label');if(label)label.htmlFor=select.id;
  if(!select.getAttribute('aria-label'))select.setAttribute('aria-label','이 업무의 담당자');
  let editing=false;
  function refresh(){
   const option=select.selectedOptions[0],valid=!!select.value&&!!option&&!option.disabled;
   name.textContent=valid?option.textContent:'담당자 확인이 필요합니다';
   const group=option?.parentElement?.label||'';
   reason.textContent=valid?(group.startsWith('추천 담당자')?group.split(' · ').slice(1).join(' · '):'이 업무의 담당자'):'해당 조직의 영업담당자를 선택해 주세요';
   // 추천할 근거가 없으면 첫 번째 사람을 임의로 배정하지 않습니다.
   select.hidden=valid&&!editing;
   button.textContent=select.hidden?'변경':valid?'선택 완료':'담당자 선택';
   button.setAttribute('aria-expanded',String(!select.hidden));button.disabled=select.disabled;
  }
  button.addEventListener('click',()=>{editing=select.hidden;refresh();if(!select.hidden)select.focus()});
  select.addEventListener('change',()=>{editing=false;refresh();button.focus()});
  select.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();editing=false;refresh();button.focus()}});
  select.addEventListener('invalid',()=>{editing=true;refresh()});
  // DOM 재렌더는 새 Select를 생성하므로 전역 상태나 타이머를 남기지 않습니다.
  refresh();
 }
 function scan(){root.document.querySelectorAll(targets).forEach(mount)}
 function start(){scan();new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length))scan()}).observe(root.document.body,{childList:true,subtree:true})}
 root.OwnerChoice={mount,scan};
 if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start()}
})(typeof window==='undefined'?globalThis:window);
