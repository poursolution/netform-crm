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
  if(typeof navigator!=='undefined'&&navigator.onLine===false){cls='bad';text='오프라인'+(pendOn?' · '+pend.textContent.trim():' · 기록은 폰에 쌓입니다');}
  else if(root.LOAD_ERR){cls='bad';text='연결 안 됨';}
  else if(pendOn){cls='wait';text=pend.textContent.trim();}
  else if(root.DEMO&&!root.LIVE){cls='idle';text='예시 데이터';}
  else if(!root.LIVE){cls='idle';text='불러오는 중';}
  pill.className='mv-status '+cls;pill.innerHTML='<i></i>'+root.esc(text);
 }
 function tabs(){
  const on=enabled(),admin=root.G&&root.G.mode==='admin';
  document.querySelectorAll('#tabbar button').forEach(b=>{const m=/G\.tab='(\w+)'/.exec(b.getAttribute('onclick')||''),t=b.querySelector('.tl2');if(!m||!t)return;if(!t.dataset.old)t.dataset.old=t.textContent;t.textContent=on?(TAB[m[1]]||t.dataset.old):t.dataset.old;
   /* 관리: 4칸(오늘 / 파이프라인 / 사람 / 보고). 문의 관리는 '오늘' 안에서 연다 */
   if(m[1]==='ctrl')b.hidden=on&&admin;
   if(on&&admin&&m[1]==='today'&&root.G.tab==='ctrl')b.classList.add('on');});
 }
 /* ③④ 내 현장 · 이번 주 · 관리 오늘: 제목 문장과 빠진 것 표시 */
 function screens(){
  const G=root.G,scr=document.getElementById('scr'),body=scr&&scr.querySelector('.body');if(!body||!G.user||G.deal||G.sub)return;
  const h2=body.querySelector(':scope>.sec-h h2');
  if(G.mode==='rep'&&G.tab==='mine'&&h2){const m=/^내 영업 · (\d+)건$/.exec(h2.textContent.trim());if(m)h2.textContent='내 현장 '+m[1]+'곳';
   body.querySelectorAll('.lrow .s').forEach(s=>{if(/금액 미정|다음 할 일 없음|할 일 없음/.test(s.textContent))s.classList.add('mv-miss');});}
  if(G.mode==='rep'&&G.tab==='my'&&!body.querySelector('.mv-title')){
   const st=[...body.querySelectorAll('.mystat button')].map(b=>[(b.querySelector('.n')||{}).textContent||'',(b.querySelector('.l')||{}).textContent||'']),today=st.find(x=>/오늘 처리/.test(x[1])),won=st.find(x=>/수주/.test(x[1])),tm=today&&/^(\d+)\/(\d+)$/.exec(today[0].trim());
   const el=document.createElement('div');el.className='mt-head mv-title';el.innerHTML='<h1>'+root.esc(given(G.user.nm)+'님, '+(tm?'오늘 '+tm[2]+'곳 중 '+tm[1]+'곳을 처리했습니다':'이번 주 현황입니다'))+'</h1><p>이번 주'+(won?' · '+root.esc(won[1].trim()+' '+won[0].trim()):'')+'</p>';body.prepend(el);}
  /* ④ 관리 오늘: 숫자가 든 문장 제목 */
  if(G.mode==='admin'&&G.tab==='today'){const h1=body.querySelector('.mt-head h1'),n=body.querySelector('.mt-counts b');if(h1&&n&&!h1.dataset.mv){h1.dataset.mv='1';const k=Number(n.textContent.replace(/\D/g,''))||0,p=body.querySelector('.mt-head p'),d=new Date();h1.textContent=k?given(G.user.nm)+'님, 지금 챙길 곳이 '+k+'건입니다':given(G.user.nm)+'님, 지금 챙길 곳이 없습니다';if(p)p.textContent=(d.getMonth()+1)+'월 '+d.getDate()+'일 '+'일월화수목금토'[d.getDay()]+'요일 · 누구의 어떤 업무가 멈췄는지';}}
  /* ④ 사람: 만든 돈 / 놓친 돈 / 성공률 — PC 리포트 담당자별 장과 같은 계산(이번 달 · 계약 체결일 / 종료일이 있는 건만) */
  if(G.mode==='admin'&&G.tab==='perf'&&!body.querySelector('.mv-people')){
   const d=new Date(),ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),inMonth=v=>String(v||'').slice(0,7)===ym,money=n=>n?root.fmtEok(n):'0원';
   const rows=(root.REPS||[]).filter(r=>r.role!=='admin').map(r=>{const mine=(root.DEALS||[]).filter(x=>x.rep===r.nm),won=mine.filter(x=>x.outcome==='won'&&inMonth(x.won_at||x.closed_at)),lost=mine.filter(x=>x.outcome==='lost'&&inMonth(x.closed_at||x.lost_at)),open=mine.filter(x=>!x.outcome),dec=won.length+lost.length;
    return {n:r.nm,did:won.length+lost.length+open.length,made:won.reduce((a,x)=>a+(Number(x.won_amount)||Number(x.amt)||0),0),missed:lost.reduce((a,x)=>a+(Number(x.amt)||0),0),rate:dec?Math.round(won.length*100/dec):null,w:won.length,dec};}).filter(r=>r.did>0).sort((a,b)=>b.made-a.made||b.did-a.did);
   const el=document.createElement('section');el.className='mv-people';
   el.innerHTML='<div class="mt-head mv-title"><h1>'+root.esc(rows.some(r=>r.made)?'이번 달 '+rows.filter(r=>r.made).length+'명이 돈을 만들었습니다':'이번 달 체결된 계약이 아직 없습니다')+'</h1><p>사람 · '+(d.getMonth()+1)+'월 · 만든 돈 / 놓친 돈 / 성공률</p></div>'
    +'<div class="mv-ptable"><div class="mv-ph"><span>담당</span><span>만든 돈</span><span>놓친 돈</span><span>성공률</span></div>'+(rows.length?rows.map(r=>'<div class="mv-pr"><b>'+root.esc(r.n)+'<small>'+r.did+'곳</small></b><span class="'+(r.made?'g':'m')+'">'+money(r.made)+'</span><span class="'+(r.missed?'r':'m')+'">'+money(r.missed)+'</span><span>'+(r.rate==null?'<i>산정 전</i>':r.rate+'% <small>'+r.w+'/'+r.dec+'</small>')+'</span></div>').join(''):'<div class="mv-pr"><b>이번 달 다룬 현장이 없습니다</b></div>')+'</div><p class="mv-pnote">성공률 = 수주 ÷ 결정 완료(수주 + 실주). 날짜가 없는 건은 세지 않습니다.</p>';
   body.prepend(el);}
  /* ④ 보고: PC에서 여는 것 안내 */
  if(G.mode==='admin'&&G.tab==='rpt'&&!body.querySelector('.mv-pcnote')){const el=document.createElement('div');el.className='mv-pcnote';el.innerHTML='<b>대표님 보고 · 주간 브리핑</b><span>슬라이드 8장과 한 페이지 보고, 주간 브리핑 저장본은 PC 화면의 리포트 · 주간 브리핑 메뉴에서 엽니다. KPI · 공종 분석 · 데이터 정리도 PC에서 봅니다.</span>';const sec=body.querySelector('.sec-h');(sec||body.firstElementChild).after(el);}
  /* ③ 등록: 제목 문장 · 버튼 이름 */
  if(G.mode==='rep'&&G.tab==='find'&&!body.querySelector('.mv-title')){const intro=body.querySelector(':scope>.intro');if(intro){const el=document.createElement('div');el.className='mt-head mv-title';el.innerHTML='<h1>새 현장을 등록합니다</h1><p>등록 · 연락처까지 함께 저장</p>';intro.replaceWith(el);}
   const scan=body.querySelector('button[onclick="scanCard()"]');if(scan){[...scan.childNodes].forEach(n=>{if(n.nodeType===3)n.nodeValue=' 명함 · 현수막 찍기';});}}
  if(G.mode==='admin'&&G.tab==='today'&&!body.querySelector('.mv-ctrl')){
   const b=document.createElement('button');b.type='button';b.className='mv-ctrl';b.innerHTML='<b>문의 관리</b><span>미배정 · 배정완료 · 응대중 문의를 보고 바로 배정합니다</span><em>열기</em>';
   b.onclick=()=>{G.tab='ctrl';G.deal=null;G.sub=null;root.render();};(body.querySelector('.mt-head')||body.firstElementChild).after(b);}
 }
 function title(){
  const G=root.G,head=document.querySelector('#scr .mt-head:not(.mv-title)');if(!head||!G.user||head.dataset.mv||G.mode!=='rep')return;
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
 /* ── 새 기능(2026-10-02 대표 승인 순서: 캘린더 → 오프라인 → 팀 연락 기록) ──
    캘린더: 다음 할 일(날짜 · 시각)을 휴대폰 캘린더에 넣는 .ics 파일을 만든다. 저장소 · 서버는 쓰지 않는다. */
 const pad=n=>String(n).padStart(2,'0');
 function icsText(d,a){
  const due=String(a.due_at||a.due||''),m=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(due);if(!m)return '';
  const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/([,;])/g,'\\$1'),now=new Date(),stamp=now.getUTCFullYear()+pad(now.getUTCMonth()+1)+pad(now.getUTCDate())+'T'+pad(now.getUTCHours())+pad(now.getUTCMinutes())+pad(now.getUTCSeconds())+'Z';
  let start,end;
  if(m[4]&&!(m[4]==='00'&&m[5]==='00')){const s=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5])),e=new Date(s.getTime()+3600e3),f=x=>x.getFullYear()+pad(x.getMonth()+1)+pad(x.getDate())+'T'+pad(x.getHours())+pad(x.getMinutes())+'00';start='DTSTART:'+f(s);end='DTEND:'+f(e);}
  else{const s=new Date(Number(m[1]),Number(m[2])-1,Number(m[3])),e=new Date(s.getTime()+864e5),f=x=>x.getFullYear()+pad(x.getMonth()+1)+pad(x.getDate());start='DTSTART;VALUE=DATE:'+f(s);end='DTEND;VALUE=DATE:'+f(e);}
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NETFORM//CRM//KO','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+esc(d.id)+'-'+m[1]+m[2]+m[3]+'@netform-crm','DTSTAMP:'+stamp,start,end,'SUMMARY:'+esc((a.type?'['+a.type+'] ':'')+(a.text||'다음 할 일')+' — '+(d.nm||'')),'DESCRIPTION:'+esc('넷폼 영업관리 · 담당 '+(d.rep||'')+(d.manager_name?' · '+d.manager_name+(d.manager_mobile?' '+d.manager_mobile:''):'')),'END:VEVENT','END:VCALENDAR'].join('\r\n');
 }
 function calendar(){
  const G=root.G,scr=document.getElementById('scr');if(!scr||!G.deal||scr.querySelector('.mv-ics'))return;
  const d=(root.DEALS||[]).find(x=>String(x.id)===String(G.deal)),a=d&&d.nextAction,row=scr.querySelector('.ml-sumrow');if(!d||!a||!row||!icsText(d,a))return;
  const b=document.createElement('button');b.type='button';b.className='mv-ics';b.textContent='휴대폰 캘린더에 넣기';
  b.onclick=()=>{const text=icsText(d,a);root.__mvIcs=text;try{const url=URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'})),l=document.createElement('a');l.href=url;l.download='netform-'+String(a.due_at||a.due).slice(0,10)+'.ics';document.body.append(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);if(typeof root.toast==='function')root.toast('캘린더 파일을 만들었습니다 — 열면 일정이 추가됩니다');}catch(e){if(typeof root.toast==='function')root.toast('캘린더 파일을 만들지 못했습니다');}};
  row.after(b);
 }
 /* 팀 연락 기록: 오늘 저장된 연락 결과 수를 사람별로(실시간 '통화 중'은 알 수 없다 — 저장된 기록만 센다) */
 function team(){
  const G=root.G,scr=document.getElementById('scr'),body=scr&&scr.querySelector('.body');if(!body||G.mode!=='admin'||G.tab!=='today'||G.deal||G.sub||body.querySelector('.mv-team'))return;
  const today=new Date(),key=today.getFullYear()+'-'+pad(today.getMonth()+1)+'-'+pad(today.getDate()),isToday=v=>{if(!v)return false;const x=new Date(v);return !isNaN(x)&&x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate())===key;};
  const rows=(root.REPS||[]).filter(r=>r.role!=='admin').map(r=>{/* 서버 목록에는 현장별 기록 전체가 오지 않는다 — 서버의 마지막 활동일(또는 이 폰에서 방금 저장한 기록)이 오늘인 현장 수만 센다 */
   let sites=0;(root.DEALS||[]).filter(x=>x.rep===r.nm).forEach(x=>{if([x.last_activity_at,x.lastActivity,x.last_customer_contact_at,x.last_meaningful_contact_at,x.lastMeaningfulContactAt,x.last_worked_at].some(isToday)||(x.activities||[]).some(a=>isToday(a.occurred_at||a.at||a.created_at)))sites++;});return {n:r.nm,c:sites,sites};}).sort((a,b)=>a.c-b.c||a.n.localeCompare(b.n));
  if(!rows.length)return;
  const zero=rows.filter(r=>!r.c).length,el=document.createElement('section');el.className='mv-team';
  el.innerHTML='<div class="mv-teamhead"><b>오늘 팀 연락 기록</b><span>오늘 기록이 저장된 현장 수'+(zero?' · 0곳 '+zero+'명':'')+'</span></div><div class="mv-ptable">'+rows.map(r=>'<div class="mv-tr"><b>'+root.esc(r.n)+'</b><span class="'+(r.c?'':'r')+'">'+(r.c?'오늘 '+r.c+'곳':'오늘 기록 0곳')+'</span></div>').join('')+'</div>';
  (body.querySelector('.mv-ctrl')||body.querySelector('.mt-head')||body.firstElementChild).after(el);
 }
 function apply(){
  const on=enabled();document.body.classList.toggle('mv2',on);tabs();if(!on)return;
  statusPill();title();try{today();detail();screens();calendar();team();strip(document.getElementById('scr'));}catch(e){console.warn('[모바일 v2 ②]',e);}
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
