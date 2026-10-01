/* 화면 떠날 때 DOM 해제 (2026-10-01 컨설턴트 P1-12 — 메뉴를 돌수록 노드가 2.5천→1.2만 개로 늘고 줄지 않음)
   각 화면(.apage)은 처음 HTML에 있던 틀(skeleton)만 남기고, 떠날 때 그 틀로 되돌린다.
   다시 들어오면 paint()가 틀 위에 새로 그리므로 보이는 내용은 같고, 보이지 않는 화면의 목록·표는 메모리에 남지 않는다.
   현재 화면·전역 창(detailView 등)은 건드리지 않는다. */
(function(root){
 'use strict';
 const skeleton=new Map();let last='';
 function capture(){document.querySelectorAll('.apage').forEach(pg=>{if(!skeleton.has(pg.id))skeleton.set(pg.id,pg.innerHTML);});}
 function release(id){const pg=id&&document.getElementById('pg-'+id);if(!pg||!skeleton.has(pg.id)||pg.classList.contains('on'))return false;pg.innerHTML=skeleton.get(pg.id);return true;}
 function boot(){
  capture();
  const orig=root.syncPage;if(typeof orig!=='function')return;
  root.syncPage=function(){const prev=last;const r=orig.apply(this,arguments);last=String(root.G?.page||'');if(prev&&prev!==last)release(prev);return r;};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.PCPageRelease={release,captured:()=>[...skeleton.keys()]};
})(window);
