/* 접근성 기본 + 알림(2026-10-01 컨설턴트 P2-16·P2-17)
   ① PC 화면에는 toast()가 없어서(모바일에만 있음) 이미 여러 곳에서 부르고 있던 toast(...)가 오류로 끝났다 — 가벼운 알림 띠로 정의한다.
   ② 키보드: onclick만 달린 div·span에 tabindex·role=button을 주고 Enter/Space로 누른다. 포커스 테두리는 키보드로 왔을 때만 보인다.
   ③ ESC로 열린 창(문의 처리 창·관리 창·상세)을 닫는다. ④ 알림 내용을 aria-live로도 읽어 준다.
   기존 동작·저장 경로는 바꾸지 않는다. */
(function(root){
 'use strict';
 function style(){if(document.getElementById('a11y-style'))return;const s=document.createElement('style');s.id='a11y-style';
  s.textContent=':focus-visible{outline:2px solid var(--blue,#3366FF)!important;outline-offset:2px}'
  +'.sr-only{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}'
  +'#pc-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:17000;display:flex;flex-direction:column;gap:8px;max-width:min(560px,calc(100vw - 32px));pointer-events:none}'
  +'#pc-toast>div{pointer-events:auto;background:#1f2937;color:#fff;border-radius:10px;padding:10px 14px;font-size:13px;line-height:1.45;box-shadow:0 10px 30px rgba(15,23,42,.25);animation:pc-toast-in .18s ease}'
  +'#pc-toast>div.warn{background:#b45309}#pc-toast>div.ok{background:#15AA72}@keyframes pc-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}';
  document.head.append(s);}
 let live;
 function announce(msg){if(!live){live=document.createElement('div');live.id='a11y-live';live.className='sr-only';live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');document.body.append(live);}live.textContent='';setTimeout(()=>{live.textContent=String(msg||'');},30);}
 function toast(msg,kind){style();let host=document.getElementById('pc-toast');if(!host){host=document.createElement('div');host.id='pc-toast';host.setAttribute('role','status');document.body.append(host);}
  const el=document.createElement('div');el.textContent=String(msg||'');if(kind==='warn'||kind==='ok')el.classList.add(kind);host.append(el);announce(msg);
  while(host.children.length>3)host.firstChild.remove();setTimeout(()=>{el.remove();},Math.min(8000,2600+String(msg||'').length*40));return undefined;}
 const CLICKABLE='[onclick]:not(button):not(a):not(input):not(select):not(textarea):not(summary):not(label):not([tabindex]):not([role=button]):not([role=link]):not([role=tab])';
 function enhance(scope){(scope||document).querySelectorAll(CLICKABLE).forEach(el=>{if(el.closest('button,a'))return;el.setAttribute('tabindex','0');if(!el.getAttribute('role'))el.setAttribute('role','button');el.dataset.a11yClick='1';});}
 let pending=null;
 function observe(){const mo=new MutationObserver(list=>{if(pending)return;pending=setTimeout(()=>{pending=null;enhance(document.body);},200);});mo.observe(document.body,{childList:true,subtree:true});}
 function onKey(e){
  const t=e.target,tag=(t&&t.tagName||'').toLowerCase();
  if((e.key==='Enter'||e.key===' ')&&t&&t.dataset&&t.dataset.a11yClick){e.preventDefault();t.click();return;}
  if(e.key!=='Escape'||e.defaultPrevented)return;
  if(['input','textarea','select'].includes(tag))return;
  if(document.getElementById('inq-inbox-dialog')&&root.InquiryWorkbench?.close){root.InquiryWorkbench.close();return;}
  const m=document.getElementById('inquiryControlModal');if(m&&m.classList.contains('on')&&typeof root.closeInquiryControlModal==='function'){root.closeInquiryControlModal();return;}
  const dv=document.getElementById('detailView');if(dv&&dv.classList.contains('on')&&typeof root.closeDetail==='function'&&!document.getElementById('detailAction')){root.closeDetail();}
 }
 /* alert()는 화면을 멈추는 브라우저 창 — 안내 띠로 바꾼다(2026-10-01 컨설턴트 P2-17, PC 62곳). confirm/prompt는 답을 기다려야 해서 그대로 둔다 */
 const nativeAlert=root.alert;
 function softAlert(msg){try{toast(msg,'warn');}catch(e){if(typeof nativeAlert==='function')nativeAlert.call(root,msg);}}
 function boot(){style();if(typeof root.toast!=='function')root.toast=toast;root.alert=softAlert;enhance(document.body);observe();document.addEventListener('keydown',onKey);root.PCA11y={enhance,announce,toast,nativeAlert};}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
