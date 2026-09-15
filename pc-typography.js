/* PC-only visual minimums. Never changes CRM state or mobile assets. */
(function(){
 'use strict';
 var queued=false;
 function refresh(){
  queued=false;
  document.querySelectorAll('body *').forEach(function(el){
   // Today owns its two-level typography; never compete with its local rules.
   if(el.closest('#pg-today')){el.removeAttribute('data-pc-text');return;}
   if(el.closest('svg,script,style,#load,#auth')||!el.getClientRects().length)return;
   if(!Array.from(el.childNodes).some(function(n){return n.nodeType===3&&n.textContent.trim()})&&!el.matches('input,select,textarea'))return;
   el.removeAttribute('data-pc-text');
   var style=getComputedStyle(el),size=parseFloat(style.fontSize),min=15;
   if(el.matches('small,label,time,caption')||/small|muted|subtext|subtitle|badge|hint|caption|evidence|warning|status|context-line/.test(el.className||''))min=13;
   if(el.closest('button,select,textarea,input,[role=tab]')||el.matches('a'))min=14;
   // Bold is emphasis, not a typography level. Use an explicit role for key values.
   if(el.dataset.pcType==='key')min=16;
   if(el.matches('h3,h4'))min=18;
   if(el.matches('h2'))min=20;
   if(el.matches('h1')||el.id==='ptitle')min=24;
   if(size<min)el.setAttribute('data-pc-text',String(min));
  });
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(refresh)}}
 new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style']});
 document.addEventListener('DOMContentLoaded',schedule);window.addEventListener('resize',schedule);schedule();
})();
