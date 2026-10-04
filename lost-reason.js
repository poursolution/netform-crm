/* 실주 원인 4분류 고르기 (2026-10-04 design_handoff_rules 2차 기능 3 · 영업관리 2차 기능.dc.html '실주 처리 · 원인 고르기')
   단계 바꾸기 → 실주 창의 '실주 원인' 칸을 분류 4개(관계 / 공법 / 가격 / 사업) → 세부 사유 두 걸음으로 바꾼다.
   목록은 운영 기준(CRMRules.lostGroups · 설정 화면의 '실주 원인')에서 오고, 저장 값은 '분류 · 세부 사유' 한 문장 그대로 — 저장 경로(단계 전환)는 건드리지 않는다.
   분류가 없는 사유(설정에서 직접 추가한 것)는 '기타' 묶음으로 보인다. 끄기: G.lostPickOff=true → 예전 한 줄 선택 */
(function(root){
 'use strict';
 const esc=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const enabled=()=>!root.G.lostPickOff&&!!root.CRMRules&&typeof root.CRMRules.lostGroups==='function';
 function draw(box,sel,cat){
  const groups=root.CRMRules.lostGroups(),cur=sel.value,g=groups.find(x=>x[0]===cat)||null;
  box.dataset.cat=cat||'';
  box.innerHTML='<div class="lr-cats">'+groups.map(x=>'<button type="button" data-lr="cat" data-v="'+attr(x[0])+'" aria-pressed="'+(x[0]===cat)+'">'+esc(x[0])+'</button>').join('')+'</div>'
   +(g?'<div class="lr-subs">'+g[1].map(s=>'<button type="button" data-lr="sub" data-v="'+attr(s.v)+'" aria-pressed="'+(s.v===cur)+'">'+esc(s.l)+'</button>').join('')+'</div>':'<p class="lr-hint">분류를 먼저 고르면 세부 사유가 나옵니다</p>');
 }
 function decorate(){
  const form=document.getElementById('stage-transition-form'),sel=form&&form.querySelector('#sf-close_reason');
  if(!sel||sel.tagName!=='SELECT')return;const old=form.querySelector('.lr-pick');
  if(!enabled()){old?.remove();sel.classList.remove('lr-hidden');return;}
  const groups=root.CRMRules.lostGroups(),opts=[...sel.options].map(o=>o.value).filter(Boolean);
  /* 실주 원인 목록일 때만(배드핏 · 연락두절 사유는 그대로) */
  if(!groups.some(g=>g[0]!=='기타')||!groups.every(g=>g[1].every(s=>opts.includes(s.v)))||opts.length!==groups.reduce((n,g)=>n+g[1].length,0)){old?.remove();sel.classList.remove('lr-hidden');return;}
  if(old){const c=sel.value?root.CRMRules.lostCategory(sel.value):old.dataset.cat;draw(old,sel,c);return;}
  const box=document.createElement('div');box.className='lr-pick';sel.classList.add('lr-hidden');sel.after(box);
  draw(box,sel,sel.value?root.CRMRules.lostCategory(sel.value):'');
  box.addEventListener('click',e=>{const b=e.target.closest('[data-lr]');if(!b)return;e.preventDefault();
   if(b.dataset.lr==='cat'){if(box.dataset.cat!==b.dataset.v){sel.value='';sel.dispatchEvent(new Event('change',{bubbles:true}));}return draw(box,sel,b.dataset.v);}
   sel.value=b.dataset.v;sel.dispatchEvent(new Event('change',{bubbles:true}));draw(box,sel,box.dataset.cat);});
 }
 /* 창이 열리거나 옮길 단계를 바꿀 때마다 다시 붙인다 */
 const later=()=>{[0,300].forEach(ms=>setTimeout(()=>{try{decorate();}catch(e){}},ms));};
 function wrap(){const UI=root.StageTransitionUI;if(!UI||typeof UI.open!=='function'||UI.open.__lr)return;const base=UI.open;UI.open=function(){const r=base.apply(this,arguments);later();return r;};UI.open.__lr=true;}
 wrap();document.addEventListener('DOMContentLoaded',wrap);
 document.addEventListener('change',e=>{if(e.target&&e.target.id==='sf-target')later();},true);
 root.LostReasonPick={enabled,decorate};
})(window);
