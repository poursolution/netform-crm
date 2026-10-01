/* 모바일 v2 — ① 디자인 규칙 (2026-10-02 디자인 핸드오프 'design_handoff_mobile' 1)
   모바일 보기만. 화면을 그리는 기존 함수(render · rToday…)와 저장 · 배정 · 등록 로직은 그대로 두고, 그려진 뒤에 틀만 정리한다.
   · 배경 #f5f6f8 · 흰 카드(둥근 20) · 줄 사이 얇은 선 · 테두리/왼쪽 색띠/이모지 없음
   · 화면 제목: 작은 회색 맥락 한 줄 + 25px 문장(숫자 포함)
   · 아래 탭바: 글자만(아이콘 없음), 선택 = 검정 굵게 + 파란 점. 영업: 오늘 / 내 현장 / 등록 / 이번 주
   · 헤더: N 로고 + 영업관리 · 연결 상태 알약 · 영업/관리 전환 · 알림
   ②~④ 단계(오늘·상세·결과 시트 / 내 현장·등록·이번 주 / 관리 4화면)는 이 위에 차례로 얹는다. 관리 탭은 ④에서 4칸으로 줄인다.
   끄기: G.mobileV2Off=true → 예전 모양. */
(function(root){
 'use strict';
 const enabled=()=>!(root.G&&root.G.mobileV2Off);
 const TAB={mine:'내 현장',find:'등록',my:'이번 주',perf:'사람',rpt:'보고'};
 const given=nm=>{nm=String(nm||'').trim();return /^[가-힣]{3}$/.test(nm)?nm.slice(1):nm;};
 function statusPill(){
  const bar=document.querySelector('#scr .home-bar');if(!bar)return;
  let pill=bar.querySelector('.mv-status');if(!pill){pill=document.createElement('span');pill.className='mv-status';const rgt=bar.querySelector('.rgt');if(rgt)rgt.prepend(pill);else return;}
  const pend=document.getElementById('pendBadge'),pendOn=!!pend&&pend.style.display!=='none'&&pend.textContent.trim();
  let cls='ok',text='연결됨';
  if(typeof navigator!=='undefined'&&navigator.onLine===false){cls='bad';text='연결 안 됨';}
  else if(root.LOAD_ERR){cls='bad';text='연결 안 됨';}
  else if(pendOn){cls='wait';text=pend.textContent.trim();}
  else if(root.DEMO&&!root.LIVE){cls='idle';text='예시 데이터';}
  else if(!root.LIVE){cls='idle';text='불러오는 중';}
  pill.className='mv-status '+cls;pill.innerHTML='<i></i>'+root.esc(text);
 }
 function tabs(){
  document.querySelectorAll('#tabbar button').forEach(b=>{const m=/G\.tab='(\w+)'/.exec(b.getAttribute('onclick')||''),t=b.querySelector('.tl2');if(!m||!t)return;if(!t.dataset.old)t.dataset.old=t.textContent;t.textContent=enabled()?(TAB[m[1]]||t.dataset.old):t.dataset.old;});
 }
 function title(){
  const G=root.G,head=document.querySelector('#scr .mt-head');if(!head||!G.user||head.dataset.mv)return;
  const h1=head.querySelector('h1'),p=head.querySelector('p'),b=document.querySelector('#scr .mt-remain b');if(!h1)return;
  const n=b?Number(b.textContent.replace(/\D/g,''))||0:0,d=new Date(),name=given(G.user.nm);
  head.dataset.mv='1';
  if(p)p.textContent=(d.getMonth()+1)+'월 '+d.getDate()+'일 '+'일월화수목금토'[d.getDay()]+'요일';
  h1.textContent=n?name+'님, 오늘 '+n+'곳에 연락하면 됩니다':name+'님, 오늘 할 일을 모두 끝냈습니다';
 }
 function apply(){
  const on=enabled();document.body.classList.toggle('mv2',on);tabs();if(!on)return;
  statusPill();title();
 }
 function boot(){
  const base=root.render;if(typeof base!=='function')return;
  root.render=function(){const r=base.apply(this,arguments);try{apply();}catch(e){console.warn('[모바일 v2]',e);}return r;};
  const up=root.updatePendingBadge;if(typeof up==='function')root.updatePendingBadge=function(){const r=up.apply(this,arguments);try{if(enabled())statusPill();}catch(e){}return r;};
  window.addEventListener('online',()=>{try{statusPill();}catch(e){}});window.addEventListener('offline',()=>{try{statusPill();}catch(e){}});
  try{apply();}catch(e){}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.MobileV2={enabled,apply};
})(window);
