/* 공통 셸 v2 (2026-10-02 디자인 핸드오프 'design_handoff_shell') — 모든 메뉴가 같이 쓰는 바깥 틀만. 화면 본문은 건드리지 않는다.
   ① 사이드바: 넷폼 로고 · 아이콘 없음 · 숫자는 글자(처리할 수만 빨강) · 선택은 연파랑
   ② 상단 툴바(60px): 제목 + 한 줄 설명 / [CRM에게 묻기] [+ 새 영업] | 상태 알약 하나 · 알림 · 사용자 메뉴
      상태 알약 = 기존 조회 상태(#live) + 저장 동기화 배지(#syncBadge) + 새로고침(loadData)을 합쳐 보여 준다 — 기존 요소는 그대로 두고(감춤) 값만 읽는다.
      사용자 메뉴 = 비밀번호 변경(CRMPassword.open) · 데이터 내보내기(exportFullDataJSON) · 연결 점검(runDiag) · 로그아웃(authSignOut)
   ④ 새 화면 본문 위 파란 안내 띠 감춤(영업 대시보드 묶음은 그대로)
   저장 · 권한 · 조회 로직은 바꾸지 않는다. 끄기: G.shellV2Off=true → 예전 틀. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const h=v=>root.esc(String(v==null?'':v));
 const enabled=()=>!root.G.shellV2Off;
 const SEC={'고객관리':'고객','조직운영':'조직','데이터 관리':'데이터'};
 let lastOk=0;
 function sidebar(){
  const logo=document.querySelector('aside.side .brandlogo');
  if(logo&&!logo.querySelector('.sh-logo'))logo.insertAdjacentHTML('afterbegin','<div class="sh-logo"><img src="netform-logo.png" alt="넷폼" height="24"><small>영업관리 CRM</small></div>');
  document.querySelectorAll('aside.side .menu .sec').forEach(s=>{const t=SEC[s.textContent.trim()];if(t)s.dataset.sh=t;});
 }
 /* ── 상태 알약 ── */
 function ago(){if(!lastOk)return '';const m=Math.floor((Date.now()-lastOk)/6e4);return m<1?'방금':m<60?m+'분 전':Math.floor(m/60)+'시간 전';}
 function status(){
  const el=$('shStatus'),sync=$('syncBadge'),live=$('live');if(!el)return;
  const cls=sync?sync.className:'',text=sync?sync.textContent.replace(/^[^\w가-힣]+/,'').trim():'';
  let tone='ok',label,title;
  if(/\bbad\b/.test(cls)){tone='bad';label=text.replace(/\s*[·—].*$/,'');title=text+' — 누르면 내역을 확인하고 다시 저장할 수 있습니다';}
  else if(/\bwait\b/.test(cls)){tone='wait';label=text;title='저장한 내용을 서버에 반영하는 중입니다';}
  else if(/확인한 실패/.test(text)){tone='ok';label=(text.match(/확인한 실패 \d+건/)||[text])[0];title='확인을 마친 저장 실패 내역 — 누르면 다시 볼 수 있습니다';}
  else{const ready=!!live&&live.classList.contains('on');if(ready&&!lastOk)lastOk=Date.now();label=ready?'최신 · '+ago():(live?live.textContent.trim():'연결 중…');tone=ready?'ok':'idle';title=(live&&live.title||label)+' — 누르면 새로고침';}
  el.className='sh-status '+tone;el.title=title;el.innerHTML='<i></i>'+h(label);
 }
 function statusClick(){
  const sync=$('syncBadge');
  if(sync&&typeof sync.onclick==='function'){sync.onclick();return;}/* 저장 실패 · 결과 미확인 · 확인한 실패 내역 = 기존 동작 그대로 */
  lastOk=0;if(typeof root.loadData==='function')root.loadData();
 }
 /* ── 사용자 메뉴 ── */
 function user(){
  const b=$('shUser');if(!b)return;const me=root.ME;
  if(!me||!me.name){b.hidden=true;return;}
  let admin=false;try{admin=!!root.todayIsAdmin();}catch(e){}
  b.hidden=false;b.querySelector('.sh-av').textContent=String(me.name).slice(-2);b.querySelector('.sh-name').innerHTML=h(me.name)+'<small>'+(admin?'관리자':'영업사원')+'</small>';
 }
 function menu(open){const m=$('shMenu'),b=$('shUser');if(!m)return;m.hidden=!open;b.setAttribute('aria-expanded',String(!!open));if(open)m.querySelector('button')?.focus();}
 const ACT={password:()=>root.CRMPassword&&root.CRMPassword.open(),export:()=>root.exportFullDataJSON(),diag:()=>root.runDiag(),logout:()=>root.authSignOut()};
 function toolbar(){
  const head=document.querySelector('.mhead');if(!head||$('shTools'))return;
  const t=document.createElement('div');t.id='shTools';t.className='sh-tools';
  t.innerHTML='<button type="button" class="sh-new" id="shNew">+ 새 영업</button><i class="sh-div"></i><button type="button" class="sh-status idle" id="shStatus"><i></i>연결 중…</button>'
   +'<div class="sh-userwrap"><button type="button" class="sh-user" id="shUser" aria-haspopup="menu" aria-expanded="false" hidden><span class="sh-av"></span><span class="sh-name"></span><em aria-hidden="true">▾</em></button>'
   +'<div class="sh-menu" id="shMenu" role="menu" hidden><button type="button" role="menuitem" data-sh="password">비밀번호 변경</button><button type="button" role="menuitem" data-sh="export">데이터 내보내기 (JSON)</button><button type="button" role="menuitem" data-sh="diag">연결 점검</button><button type="button" role="menuitem" class="danger" data-sh="logout">로그아웃</button></div></div>';
  head.append(t);
  /* 기존 [CRM에게 묻기] · 알림은 자리만 옮긴다(동작 그대로) */
  const place=()=>{const ask=$('execAskBtn'),bell=head.querySelector(':scope>.ib');if(ask&&ask.parentElement!==t){t.prepend(ask);}if(bell)t.querySelector('.sh-userwrap').before(bell);};
  place();new MutationObserver(place).observe(head,{childList:true});
  $('shNew').onclick=()=>{if(typeof root.openNewDeal==='function')root.openNewDeal();};
  $('shStatus').onclick=statusClick;
  $('shUser').onclick=e=>{e.stopPropagation();menu($('shMenu').hidden);};
  $('shMenu').addEventListener('click',e=>{const b=e.target.closest('[data-sh]');if(!b)return;menu(false);const f=ACT[b.dataset.sh];if(f)f();});
  document.addEventListener('click',e=>{if(!e.target.closest('.sh-userwrap'))menu(false);});
  t.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('shMenu').hidden){e.stopPropagation();menu(false);$('shUser').focus();}});
  ['syncBadge','live'].forEach(id=>{const n=$(id);if(n)new MutationObserver(status).observe(n,{attributes:true,childList:true,characterData:true,subtree:true});});
  /* 조회가 새로 끝나면 '방금'으로 */
  const live=$('live');if(live)new MutationObserver(()=>{if(live.classList.contains('on'))lastOk=Date.now();}).observe(live,{childList:true,characterData:true,subtree:true});
  setInterval(status,60000);
 }
 function apply(){
  const on=enabled();document.body.classList.toggle('shell-v2',on);if(!on)return;
  sidebar();toolbar();status();user();
  const ask=$('execAskBtn');if(ask&&!ask.dataset.sh){ask.dataset.sh='1';ask.innerHTML='✦ CRM에게 묻기';}
  /* 공통 필터줄(검색 포함)이 있는 화면에서는 상단 검색칸을 뺀다 */
  const pg=document.querySelector('.apage.on');document.body.classList.toggle('sh-cf',!!(pg&&pg.querySelector(':scope>.cf-bar:not([hidden])')));
 }
 function boot(){
  apply();
  const sp=root.syncPage;if(typeof sp==='function')root.syncPage=function(){const r=sp.apply(this,arguments);try{apply();}catch(e){console.warn('[셸 v2]',e);}return r;};
  const ab=root.authBadge;if(typeof ab==='function')root.authBadge=function(){const r=ab.apply(this,arguments);try{user();}catch(e){}return r;};
  const pt=root.paint;if(typeof pt==='function')root.paint=function(){const r=pt.apply(this,arguments);try{apply();}catch(e){}return r;};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.ShellV2={enabled,apply,status};
})(window);
