/* 제목 한 번만(2026-11-10 대표 "처음 디자인이 겹친다 · 전에 디자인 싹 날려줘")
   화면 안 제목(.tv6-title · .ps3-head · .ac-title · .plv-intro 의 굵은 제목)이 위 공통 제목줄(#ptitle)과 같은 말이면 그 제목 · 설명 줄에 .ot-dup 을 붙여 숨긴다(one-title.css).
   다른 말(예: 컨트롤타워 안 '주간 브리핑')이면 그대로 둔다. 화면 안 단추는 그대로.
   화면이 늦게 그려져도 맞도록 DOM 이 바뀔 때마다 다시 본다(그리기 전 마이크로태스크라 깜빡임 없음). 끄기: G.oneTitleOff = true */
(function(root){
 'use strict';
 const SEL='.tv6-title>b,.ps3-head>b,.ac-title>b,.plv-intro>b';
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
 function mark(){
  try{
   const off=!!(root.G&&root.G.oneTitleOff),de=document.documentElement;de.classList.toggle('ot-off',off);
   const t=norm(document.getElementById('ptitle')&&document.getElementById('ptitle').textContent);
   document.querySelectorAll(SEL).forEach(b=>{const p=b.parentElement;if(!p)return;const dup=!off&&!!t&&norm(b.textContent)===t;if(p.classList.contains('ot-dup')!==dup)p.classList.toggle('ot-dup',dup);});
  }catch(e){}
 }
 let busy=false;
 const run=()=>{if(busy)return;busy=true;try{mark();}finally{busy=false;}};
 const start=()=>{run();try{new MutationObserver(run).observe(document.body,{childList:true,subtree:true,characterData:true});}catch(e){}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 const base=root.paint;if(typeof base==='function')root.paint=function(){const r=base.apply(this,arguments);run();return r;};
 root.OneTitle={sync:run};
})(window);
