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
 /* ── ② 오늘 · 상세 · 결과 시트 (2026-10-02) ──
    오늘: '지금 할 일' 남색 카드(첫 번째 할 곳 · [전화] [자세히]) + 목록은 왼쪽 시간 칸(늦음 · 오늘 · 예정). 통화 → 결과 시트 → 저장은 기존 callFlow · pickToday 그대로.
    상세: 아래에 [전화] [결과 남기기]를 고정(기존 dealCallM · dealCallSheetM). 이모지는 지운다.
    ※ 새 견적문의 알림 카드 · 날짜 줄 · 오늘 동선 · 사진 · AI 통화 정리 · 음성 메모는 새 기능이라 구조 확인 뒤에 붙인다. 결과는 기존 3가지를 그대로 쓴다. */
 const EMOJI=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B50}\u{1F1E6}-\u{1F1FF}]/gu;
 function strip(scope){scope.querySelectorAll('button,.ml-support-link,.ml-next i,.hb-ico').forEach(el=>{el.childNodes.forEach(n=>{if(n.nodeType===3&&EMOJI.test(n.nodeValue)){EMOJI.lastIndex=0;n.nodeValue=n.nodeValue.replace(EMOJI,'').replace(/^\s+/,'');}EMOJI.lastIndex=0;});});}
 function today(){
  const scr=document.getElementById('scr'),list=scr&&scr.querySelector('.body>.mt-list');if(!list||!scr.querySelector('.mt-head'))return;
  const p=scr.querySelector('.mt-head p'),lg=[...scr.querySelectorAll('.ml-legend span')].map(s=>s.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
  if(p&&lg.length&&!p.dataset.lg){p.dataset.lg='1';p.textContent+=' · '+lg.join(' · ');}
  /* 시간 칸: 늦음 / 오늘 / 그 밖의 표시 */
  list.querySelectorAll('.mt-item .ml-dpill').forEach(el=>{if(el.dataset.mv)return;el.dataset.mv='1';el.title=el.textContent;if(el.classList.contains('late'))el.innerHTML='늦음<small>'+root.esc(el.textContent.replace(/\s*지남$/,''))+'</small>';});
  if(scr.querySelector('.mv-now'))return;
  const first=list.querySelector('.mt-item:not(.ml-done-item)');if(!first)return;
  const q=s=>{const n=first.querySelector(s);return n?n.textContent.trim():'';},kind=first.dataset.kind,ref=first.dataset.ref,late=first.querySelector('.ml-dpill.late');
  const card=document.createElement('section');card.className='mv-now';card.setAttribute('aria-label','지금 할 일');
  card.innerHTML='<small>지금 할 일'+(late?' · '+root.esc(late.title||''):'')+'</small><b>'+root.esc(q('strong'))+'</b><span>'+root.esc(q('.mt-reason'))+'</span><em>'+root.esc(q('.mt-meta'))+'</em><div><button type="button" class="call" data-mv="call">전화</button><button type="button" data-mv="open">자세히</button></div>';
  card.addEventListener('click',e=>{const b=e.target.closest('[data-mv]');if(!b)return;
   if(b.dataset.mv==='call'){const TD=root.G._today||[],i=TD.findIndex(x=>String(x.ref)===String(ref)&&(!kind||x.kind===kind));if(i>=0&&TD[i].call&&typeof root.callFlow==='function')return root.callFlow(i);}
   root.openTodayEntryM(kind,ref);});
  first.classList.add('mv-first');(scr.querySelector('.ml-hero')||list).before(card);
 }
 function detail(){
  const scr=document.getElementById('scr'),body=scr&&scr.querySelector('.body');if(!body||!root.G.deal||scr.querySelector('.mv-dock'))return;
  const call=body.querySelector('button[onclick="dealCallM()"]'),res=body.querySelector('button[onclick="dealCallSheetM()"]');if(!call&&!res)return;
  const dock=document.createElement('div');dock.className='mv-dock';dock.innerHTML=(call?'<button type="button" class="call" data-mv="call">전화</button>':'')+(res?'<button type="button" data-mv="result">결과 남기기</button>':'');
  dock.addEventListener('click',e=>{const b=e.target.closest('[data-mv]');if(!b)return;if(b.dataset.mv==='call')root.dealCallM();else root.dealCallSheetM();});
  scr.append(dock);body.classList.add('mv-hasdock');/* 화면 맨 아래 고정 — 기존 단계 버튼 줄은 본문 끝으로 내려 둔다 */
 }
 function apply(){
  const on=enabled();document.body.classList.toggle('mv2',on);tabs();if(!on)return;
  statusPill();title();try{today();detail();strip(document.getElementById('scr'));}catch(e){console.warn('[모바일 v2 ②]',e);}
 }
 function boot(){
  const base=root.render;if(typeof base!=='function')return;
  root.render=function(){const r=base.apply(this,arguments);try{apply();}catch(e){console.warn('[모바일 v2]',e);}return r;};
  const up=root.updatePendingBadge;if(typeof up==='function')root.updatePendingBadge=function(){const r=up.apply(this,arguments);try{if(enabled())statusPill();}catch(e){}return r;};
  const sc=document.getElementById('sheetcard');if(sc)new MutationObserver(()=>{if(enabled())try{strip(sc);}catch(e){}}).observe(sc,{childList:true});
  window.addEventListener('online',()=>{try{statusPill();}catch(e){}});window.addEventListener('offline',()=>{try{statusPill();}catch(e){}});
  try{apply();}catch(e){}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.MobileV2={enabled,apply};
})(window);
