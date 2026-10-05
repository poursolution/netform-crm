/* 공통 움직임 기준 — 동작 쪽 (2026-10-05 대표 "화면에 애니메이션 좀 넣어 줄래, 과하지 않은 선에서" · 디자인 기준 design_handoff_motion). 꾸밈 · 길이 · 표는 motion.css.
   하는 일은 표식을 잠깐 붙였다 떼는 것뿐 — 글자 · 숫자 · 자료는 건드리지 않는다(숫자가 올라가는 효과 · 튕김 · 페이지 전환 · 모달 확대는 쓰지 않는다).
     ② 탭 · 필터 · 브랜드 · 쪽 번호 · 고르기 칸 → html.nf-list (목록 줄 · 카드 nfIn)
     ④ 막대 → 앞 길이에서 새 길이로 0.3초(다시 그려도 이어지게 앞 길이를 기억)
     ⑤ 완료 · 요청 → 방금 처리한 줄이 목록에서 빠지면 그 자리에서 연초록 → 접힘, 다른 목록(답 기다리는 중)으로 옮겨 갔으면 거기서 nfIn
     ⑥ 가운데 칸에서 [‹] → 돌아온 칸이 반대 방향으로
   끄는 경우: 기기의 '동작 줄이기' · G.motionOff=true · 자동 검사(웹드라이버 — 검사는 G.motionTest=true 로 켠다) */
(function(root){
 'use strict';
 const d=root.document;if(!d)return;const H=d.documentElement,timers={};
 const reduced=()=>{try{return !!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){return false;}};
 const enabled=()=>{const G=root.G||{};if(G.motionOff||reduced())return false;return !(root.navigator&&root.navigator.webdriver)||!!G.motionTest;};
 const on=()=>H.classList.contains('nf-motion');
 function sync(){H.classList.toggle('nf-motion',enabled());return on();}
 const ms=name=>{const v=parseFloat(root.getComputedStyle(H).getPropertyValue(name));return Number.isFinite(v)&&v>0?v*1000:180;};
 function pulse(name,dur){if(!sync())return false;const c='nf-'+name;H.classList.remove(c);void H.offsetWidth;H.classList.add(c);clearTimeout(timers[name]);timers[name]=setTimeout(()=>H.classList.remove(c),dur||ms('--nf-base')+90);return true;}
 function flash(el,cls,dur){if(!el||!on())return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);setTimeout(()=>{try{el.classList.remove(cls);}catch(e){}},dur||ms('--nf-base')+90);}

 /* ② 목록이 바뀌는 조작만(창 · 입력 칸 안의 버튼은 대상이 아니다) */
 const INSIDE='#detailView,[role="dialog"],[aria-modal="true"],form';
 const LIST='[role="tab"],nav.lpg button,button[aria-pressed],button[aria-selected],[data-nf="list"]';
 d.addEventListener('click',e=>{const t=e.target&&e.target.closest&&e.target.closest(LIST);if(t&&!t.disabled&&!t.closest(INSIDE)){armed=null;/* 탭 · 필터로 줄이 빠지는 것은 '처리'가 아니다 */pulse('list');}},true);
 d.addEventListener('change',e=>{const t=e.target;if(t&&t.tagName==='SELECT'&&!t.closest(INSIDE))pulse('list');},true);

 /* ④ 막대 */
 const BAR='[class*="bar"]>[style*="width"],[class*="bar"] .track>[style*="width"],[class*="bar"]>span>[style*="width"],i>u[style*="width"]',widths=new Map();
 function bars(){
  const pg=d.querySelector('.apage.on');if(!pg)return;const G=root.G||{},scope=[G.page,G.pipelineStage||''].join('|'),seen=new Set();
  pg.querySelectorAll(BAR).forEach((el,i)=>{const key=scope+'|'+i,cur=el.style.width||'';seen.add(key);const prev=widths.get(key);widths.set(key,cur);
   if(on()&&prev&&cur&&prev!==cur&&typeof el.animate==='function'){try{el.animate([{width:prev},{width:cur}],{duration:ms('--nf-bar'),easing:'ease-out'});}catch(e){}}});
  [...widths.keys()].forEach(k=>{if(k.startsWith(scope+'|')&&!seen.has(k))widths.delete(k);});
 }

 /* ⑤ 완료 · 요청 */
 const COMMIT=/저장|완료|기록|보내기|요청|배정|등록/,REQ=/요청|보내기/;let lastKey='',armed=null;
 const esc=s=>root.CSS&&root.CSS.escape?root.CSS.escape(s):String(s).replace(/"/g,'\\"');
 const rowByKey=k=>k?d.querySelector('.apage.on [data-key="'+esc(k)+'"]'):null;
 d.addEventListener('click',e=>{
  if(!on())return;const b=e.target&&e.target.closest&&e.target.closest('button');if(!b)return;/* 줄 자체(role=button)를 누른 것은 처리가 아니다 — 진짜 버튼만 */
  const row=b.closest('.apage [data-key]');if(row&&row.dataset.key)lastKey=row.dataset.key;
  if(!lastKey||!COMMIT.test(String(b.textContent||'')))return;const el=rowByKey(lastKey);if(!el)return;
  const r=el.getBoundingClientRect();if(!r.width||!r.height)return;
  armed={key:lastKey,kind:REQ.test(b.textContent)?'request':'done',at:Date.now(),rect:r,node:el.cloneNode(true),parent:el.parentElement,page:(root.G||{}).page};
 },true);
 function leave(){
  if(!armed)return;if(Date.now()-armed.at>4000){armed=null;return;}
  const now=rowByKey(armed.key);if(now&&now.parentElement===armed.parent&&d.contains(armed.parent))return;/* 아직 그 자리에 있다 */
  const a=armed;armed=null;if(!on()||(root.G||{}).page!==a.page)return;/* 다른 화면으로 넘어간 것은 처리가 아니다 */
  const g=a.node;g.removeAttribute('id');g.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));g.classList.add('nf-ghost');
  g.style.left=a.rect.left+'px';g.style.top=a.rect.top+'px';g.style.width=a.rect.width+'px';g.style.height=a.rect.height+'px';d.body.appendChild(g);
  const hold=ms('--nf-base'),fold=ms('--nf-slow'),total=hold+fold;let done=false;const end=()=>{if(done)return;done=true;try{g.remove();}catch(e){}};
  try{const an=g.animate([{opacity:1,height:a.rect.height+'px'},{opacity:1,height:a.rect.height+'px',offset:hold/total},{opacity:0,height:'0px'}],{duration:total,easing:'ease-out'});an.onfinish=end;an.oncancel=end;}catch(e){end();}
  setTimeout(end,total+120);
  if(now)flash(now,'nf-in');/* 다른 목록(답 기다리는 중)으로 옮겨 갔다 */
 }

 /* ⑥ [‹] 로 돌아가기 */
 d.addEventListener('click',e=>{const t=e.target&&e.target.closest&&e.target.closest('#detailView .ddv-back,#detailView .ds2-back,#detailView [data-dp="close"]');if(!t||!on())return;
  const v=d.getElementById('detailView'),col=t.closest('.dw-center,.dw-right')||(v&&v.querySelector('.dw-right'));if(col)setTimeout(()=>flash(col,'nf-back'),0);},true);

 /* 화면이 다시 그려질 때마다 ④ ⑤ 를 본다(한 프레임에 한 번) */
 let queued=false;const tick=()=>{queued=false;try{bars();leave();}catch(e){}};
 function watch(){
  if(typeof root.MutationObserver!=='function'||d.__nfWatch)return;const pages=d.querySelectorAll('.apage');if(!pages.length)return;d.__nfWatch=true;
  const mo=new root.MutationObserver(()=>{if(queued)return;queued=true;(root.requestAnimationFrame||setTimeout)(tick);});
  pages.forEach(p=>mo.observe(p,{childList:true,subtree:true}));
 }
 function boot(){sync();watch();try{bars();}catch(e){}}
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
 root.addEventListener&&root.addEventListener('load',boot);
 try{root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',sync);}catch(e){}
 root.Motion={enabled,sync,pulse,flash,bars,_boot:boot};
})(typeof window!=='undefined'?window:globalThis);
