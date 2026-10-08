/* 첫 진입 '연결 중' 멈춤 안내(2026-10-08 inquiry_memo ⑦).
   원인: Phase1(서버 연결 모듈)은 phase1-config.js → pc-manager-transport.js 두 파일이 모두 실행돼야 생긴다.
   둘 중 하나라도 못 불러오거나(네트워크 · 배포 직후 캐시 불일치) 실행 중 오류가 나면 Phase1 이 없고,
   뒤 스크립트 40여 개가 'Phase1 is not defined' → 'OPERATIONAL_LOAD_ORDER' 로 줄줄이 멈춘다 — 불러오는 순서(crm.html)는 맞고, 앞 두 파일이 실패한 결과다.
   이 파일은 의존 없이 먼저 떠서 ① 못 불러온 스크립트 이름을 모으고 ② Phase1 이 없으면 바로, ③ 10초가 지나도 연결이 안 되면 '불러오기 실패 · [다시 시도]' 한 줄을 띄운다(계속 도는 표시 대신). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.BootGuard=api;api.install(root);}})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const WAIT=10000;
 function reason(root,failed){
  if(!root.PHASE1_CONFIG&&failed.some(f=>/phase1-config/.test(f)))return 'phase1-config.js 를 불러오지 못했습니다';
  if(!root.PHASE1_CONFIG)return '접속 설정(phase1-config.js)이 실행되지 않았습니다';
  if(!root.Phase1&&failed.some(f=>/pc-manager-transport/.test(f)))return 'pc-manager-transport.js 를 불러오지 못했습니다';
  if(!root.Phase1)return '서버 연결 모듈(pc-manager-transport.js)이 실행되지 않았습니다 · 접속 주소를 확인하세요';
  return failed.length?failed[0]+' 를 불러오지 못했습니다':'운영 데이터 연결이 '+WAIT/1000+'초 넘게 끝나지 않았습니다';
 }
 /* 다시 시도 = 주소에 시각만 덧붙여 새로 받는다(?view=pc 같은 기존 주소 값은 그대로) */
 function retryUrl(loc,now){const u=new URL(loc.href);u.searchParams.set('_r',String(now));return u.toString();}
 function ready(root){const live=root.document&&root.document.getElementById('live');return !!(live&&live.classList&&live.classList.contains('on'));}
 /* 로그인 화면이 떠 있으면 연결 대기가 아니다 */
 function waitingLogin(root){const gate=root.document&&root.document.getElementById('authGate');return !!(gate&&gate.classList&&gate.classList.contains('on'));}
 function install(root){
  const doc=root.document,failed=[];if(!doc)return;
  root.addEventListener('error',e=>{const t=e&&e.target;if(t&&t.tagName==='SCRIPT'&&t.src)failed.push(String(t.src).split('?')[0].split('/').pop());},true);
  function show(msg){
   if(!doc.body)return;let bar=doc.getElementById('boot-fail');
   if(!bar){bar=doc.createElement('div');bar.id='boot-fail';bar.setAttribute('role','alert');
    bar.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483000;display:flex;gap:12px;align-items:center;justify-content:center;padding:10px 16px;background:#fdecea;border-bottom:1px solid #f3b4ad;color:#8c1d14;font:600 13px/1.4 Pretendard,system-ui,sans-serif';
    bar.innerHTML='<b>불러오기 실패</b><span data-bf="why"></span><button type="button" data-bf="retry" style="border:1px solid #c9453a;background:#fff;color:#8c1d14;border-radius:7px;padding:5px 12px;font:700 12.5px Pretendard,system-ui,sans-serif;cursor:pointer">다시 시도</button>';
    bar.querySelector('[data-bf="retry"]').addEventListener('click',()=>root.location.replace(retryUrl(root.location,Date.now())));
    doc.body.appendChild(bar);}
   bar.querySelector('[data-bf="why"]').textContent='· '+msg;
   /* 멈춘 불러오는 중 표시는 숨긴다 — 실패 한 줄만 남긴다 */
   const spin=doc.getElementById('load');if(spin&&!ready(root))spin.style.display='none';
  }
  function hide(){const bar=doc.getElementById('boot-fail');if(bar)bar.remove();}
  function check(){if(root.Phase1){if(ready(root))hide();return;}show(reason(root,failed));}
  doc.addEventListener('DOMContentLoaded',check);
  /* 이 PC 의 검사 · 개발 서버(127.0.0.1 · localhost)는 서버가 없어 늘 '연결 중'이다 — 10초 안내는 운영 주소에서만(검사가 강제로 켤 때만 예외) */
  const dev=/^(127\.0\.0\.1|localhost)$/.test(String(root.location&&root.location.hostname||''))&&!root.__bootGuardTimer;
  if(!dev)root.setTimeout(()=>{if(waitingLogin(root)&&root.Phase1)return;if(!ready(root))show(reason(root,failed));},WAIT);
  /* 늦게라도 연결되면 한 줄을 걷는다 */
  const t=root.setInterval(()=>{if(ready(root)){hide();root.clearInterval(t);}},1000);
 }
 return {install,reason,retryUrl,WAIT};
});
