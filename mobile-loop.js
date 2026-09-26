/* 모바일 영업 루프 (2026-09-26 대표 결정: 휴대폰 앱에 PC 새 기능 이식 — 모바일 모양은 유지).
   ① 오늘 우선순위: 🤝 고객 약속이 맨 위, 과거 이관 영업(다음 할 일 없음·오래 미접촉)은 '과거 영업 정리'로 분리
   ② 상세 '지금 할 일' 카드: 고객 약속 표시 · 관리자 지원 요청 · 영업 흐름 한 줄
   ③ 통화 결과: 결과 하나 → 날짜 하나(약속이면 한 줄). 서버 확인까지 기다린다 —
      지금 할 일 완료 → 연락 결과 → 다음 할 일 (PC 지금 할 일 카드와 같은 명령·같은 문구)
   ④ 하루 마감 요약 + 과거 영업 정리 · 오늘 10건
   mobile.html 인라인 앱의 전역 함수(buildToday·rToday·mNowCardM·dealCallSheetM)를 감싼다. */
(function(root){
 'use strict';
 const LIVE='2026-10-01',STALL_DAYS=7,LONG_CONTACT_DAYS=90;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const day=v=>String(v||'').slice(0,10);
 const kstDay=v=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(v?new Date(v):new Date());}catch(e){return day(new Date().toISOString());}};
 const openNext=d=>{const a=d&&d.nextAction;return a&&a.status==='open'?a:null;};
 const isPromise=a=>!!a&&(/약속/.test(String(a.type||''))||/^\s*고객\s*약속/.test(String(a.text||'')));
 const promiseText=a=>String(a&&a.text||'').replace(/^\s*고객\s*약속\s*:?\s*/,'');
 const dealById=id=>(root.DEALS||[]).find(x=>String(x.id)===String(id));
 const current=()=>dealById(root.G&&root.G.deal);
 const lastContact=d=>d&&(d.last_meaningful_contact_at||d.lastMeaningfulContactAt||d.contactAt||d.last_customer_contact_at)||'';
 const isLegacy=d=>!(day(d.created_at||d.created)>=LIVE||day(lastContact(d))>=LIVE);
 const sinceDays=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?Math.floor((Date.now()-t)/864e5):null;};
 /* 2026-09-26 문구 정리(대표 승인): 서버가 예전 문구로 남긴 기록도 화면에서는 새 말로 읽힌다 — 저장값은 바꾸지 않는다 */
 const OLD_PHRASES=[[/전화 부재 — 못 받으심|통화 시도 — 부재/g,'부재중 (전화 안 받음)'],[/통화 — 진행됨/g,'통화 완료 · 진행 중'],[/재통화 시도/g,'다시 전화하기'],[/고객 요청 재연락/g,'요청 시점에 다시 연락'],[/통화 후속 확인/g,'통화 후 진행 확인'],[/고객 요청으로 후속 연기/g,'고객 요청으로 다음 주 재연락']];
 const plainWords=v=>OLD_PHRASES.reduce((s,r)=>s.replace(r[0],r[1]),String(v==null?'':v));

 /* ① 오늘 우선순위 */
 const baseBuild=root.buildToday;
 /* 과거 이관 영업 = Live(10/1) 전에 만들어졌고 그 뒤 고객 접촉도 없는 진행 영업 중, 기한이 오늘·지남이 아니고
    다음 할 일이 없거나 오래(90일) 연락이 없는 건 — PC 오늘 업무의 '과거 영업 정리'와 같은 기준 */
 function legacyDeals(){
  const mine=(typeof root.myDeals==='function'?root.myDeals():[]).filter(d=>typeof root.isOpen!=='function'||root.isOpen(d));
  return mine.filter(d=>{const a=openNext(d),dd=root.execDueM?root.execDueM(d):null,c=sinceDays(lastContact(d));if(dd!=null&&dd<=0)return false;return isLegacy(d)&&(!a||c==null||c>=LONG_CONTACT_DAYS);});
 }
 /* 동기화 계층이 오늘 목록을 12건으로 자르므로, 자르기 전에 과거 영업을 빼고(내 영업 목록을 잠시 좁힘)
    잘려 나간 고객 약속은 다시 넣어 맨 위로 올린다. */
 if(typeof baseBuild==='function')root.buildToday=function(){
  const legacy=legacyDeals(),skip=new Set(legacy.map(d=>String(d.id))),origMine=root.myDeals;let out;
  if(typeof origMine==='function')root.myDeals=function(){return origMine.apply(this,arguments).filter(d=>!skip.has(String(d.id)));};
  try{out=baseBuild.apply(this,arguments);}finally{if(typeof origMine==='function')root.myDeals=origMine;}
  out=out.filter(t=>t.kind!=='deal'||!skip.has(String(t.ref)));
  const mine=(typeof origMine==='function'?origMine():[]).filter(d=>typeof root.isOpen!=='function'||root.isOpen(d));
  mine.forEach(d=>{
   const a=openNext(d),dd=root.execDueM?root.execDueM(d):null;if(!isPromise(a)||dd==null||dd>0)return;
   let t=out.find(x=>x.kind==='deal'&&String(x.ref)===String(d.id));
   if(!t){t={kind:'deal',bucket:dd<0?'overdue':'today',ref:d.id,action_id:a.id||'',nm:d.nm,sub:(root.amtTxt?root.amtTxt(d.amt):'')+' · '+(root.stageLabel?root.stageLabel(d.code):''),call:root.execCallM?root.execCallM(d):false,urgent:true};out.push(t);}
   t.p=dd<0?-2:-1;t.promise=true;t.why='🤝 고객 약속 · '+(dd<0?Math.abs(dd)+'일 지남':'오늘')+' — '+promiseText(a);
  });
  root.G._legacyM=legacy;
  return out.sort((x,y)=>x.p-y.p||String(x.nm).localeCompare(String(y.nm),'ko')).slice(0,12);
 };

 /* ④ 하루 마감 요약 — 서버 기록 기준(2026-09-26 대표 "모바일·PC 완벽 동기화"): PC에서 처리한 것도 같은 숫자로 보인다.
    예전엔 이 기기에서 보낸 요청만 셌고, 결과 한 번 저장(완료·연락·다음 할 일)이 3건으로 부풀었다.
    이제 '오늘 처리' = 오늘(한국 시간) 내가 기록을 남긴 현장 수. 한 현장은 한 번만 센다.
    현장 분류(합계가 맞도록 하나만): 고객 약속을 잡음 > 고객과 연락함 > 다음 할 일만 정리.
    근거: 서버가 영업마다 돌려주는 활동 기록(종류·시각·작성자 이름) + 문의 첫 연락 시각(담당자 기준).
    방금 저장해 아직 서버 목록에 안 들어온 기록은 이 기기의 서버 확인(ACK) 목록으로 메운다. */
 const ATTEMPT=/(?:^|\s)전화 시도(?:\s|$)/,CONTACT=/전화|통화|부재|방문|문자|메일|카톡|카카오|미팅|연락/,SYS=/^[a-z0-9_]+$/;
 const DONE_TYPES=new Set(['next_action_complete','다음 행동 완료']);
 const nameKey=v=>String(v||'').replace(/\s+/g,'');
 function activityKind(type,note,extra){
  type=String(type||'');note=String(note||'');
  if(type==='next_action_set')return /약속/.test(note+' '+String(extra||''))?'promise':'next';
  if(DONE_TYPES.has(type))return 'next';
  if(!SYS.test(type)&&CONTACT.test(type)&&!ATTEMPT.test(note))return 'contact';
  return '';
 }
 function dayWork(){
  const me=nameKey(root.G&&root.G.user&&root.G.user.nm),byDay={},put=(dk,site,kind)=>{if(!dk||!kind)return;const m=byDay[dk]=byDay[dk]||new Map();const k=m.get(site)||new Set();k.add(kind);m.set(site,k);};
  let rows=[];try{rows=root.Phase1&&root.Phase1.queue&&root.Phase1.queue.list()||[];}catch(e){}
  const acked=new Set();rows.forEach(r=>{if(r&&r.status==='done'&&r.ack&&r.ack.activity_id)acked.add(String(r.ack.activity_id));});
  /* 1) 영업 활동 기록 — 작성자가 나인 것만(이름이 아직 없으면 이 기기가 확인받은 기록인지로 판단) */
  (root.DEALS||[]).forEach(d=>{
   const seen=new Set();
   [].concat(d.activities||[],d.activity_signals||[]).forEach(x=>{
    if(!x)return;const id=x.id!=null?String(x.id):'';if(id){if(seen.has(id))return;seen.add(id);}
    const who=x.actor_name||x.actor||'';if(who?nameKey(who)!==me:!acked.has(id))return;
    const at=x.at||x.occurred_at;if(!at)return;put(kstDay(at),'d:'+d.id,activityKind(x.type,x.note,x.result));
   });
  });
  /* 2) 문의 첫 연락 — 내가 담당인 문의 */
  const B=root.BUNDLE||root.B||{};(B.inquiries||[]).forEach(q=>{
   const at=q&&(q.first_response_at||q.firstResponseAt||q.responded_at||q.respondedAt);if(!at)return;
   if(nameKey(q.assignee||q.assignee_name)!==me)return;put(kstDay(at),'i:'+String(q.id||q.inquiry_id||q.key),'contact');
  });
  /* 3) 이 기기에서 방금 서버 확인을 받은 저장 — 서버 목록이 따라오기 전의 빈틈만 메운다(같은 현장은 한 번만 센다) */
  rows.forEach(r=>{
   if(!r||r.status!=='done'||!r.ack)return;const dk=kstDay(r.ack.server_at||r.ack.occurred_at||r.updated_at),op=String(r.operation||''),p=r.payload||{};
   const intent=String(p.intent||'');if(intent==='inquiry_check')return;
   const inq=r.object_type==='inquiry'||/^inquiry/.test(op)||/^inquiry/.test(intent),oid=r.object_id||p.opportunity_id||p.inquiry_id;if(!oid)return;
   const site=(inq?'i:':'d:')+String(oid);
   if(inq){put(dk,site,'contact');return;}
   if(op==='activity')put(dk,site,activityKind(p.type,p.note,p.result));
   else if(op==='next_action')put(dk,site,/고객\s*약속/.test(JSON.stringify(p))?'promise':'next');
   else if(op==='next_action_complete')put(dk,site,'next');
   else if(p.activity)put(dk,site,activityKind(p.activity.type,p.activity.note,p.activity.result)||'next');
  });
  return byDay;
 }
 function summarize(m){
  const out={total:0,contact:0,next:0,promise:0,sites:new Set()};
  if(m)m.forEach((kinds,site)=>{out.total++;out.sites.add(site);if(kinds.has('promise')){out.promise++;out.next++;}else if(kinds.has('contact'))out.contact++;else out.next++;});
  return out;
 }
 function daySummary(){
  const byDay=dayWork(),today=kstDay(),out=summarize(byDay[today]),hist={};
  /* 최근 5일 처리(하루 마감 막대) — 같은 서버 기록이라 PC·휴대폰 어디서 봐도 같다 */
  for(let i=4;i>=0;i--){const t=new Date();t.setDate(t.getDate()-i);const k=kstDay(t);hist[k]=byDay[k]?byDay[k].size:0;}
  out.hist=hist;return out;
 }
 /* ── 인포그래픽(2026-09-26 대표 요청 '모바일 인포그래픽으로 세련되게') ── */
 const SEG=[['promise','약속'],['late','기한 지남'],['new','새 문의'],['today','오늘 예정'],['etc','확인']];
 const KIND_ICON={promise:'🤝',late:'⏰',new:'📥',today:'📅',etc:'📋'};
 const catOf=t=>t.promise?'promise':t.bucket==='overdue'?'late':(t.kind==='inquiry'||t.bucket==='new')?'new':(t.bucket==='today'||t.bucket==='visit')?'today':'etc';
 const doneOf=t=>typeof root.isDone==='function'&&root.isDone(t);
 function ringSVG(done,total){
  const r=24,c=2*Math.PI*r,p=total?done/total:1,o=c*(1-p);
  return '<svg class="ml-ring" width="62" height="62" viewBox="0 0 62 62" aria-hidden="true"><circle cx="31" cy="31" r="'+r+'" class="trk"/><circle cx="31" cy="31" r="'+r+'" class="val'+(total&&done>=total?' full':'')+(done?'':' zero')+'" style="stroke-dasharray:'+c.toFixed(1)+';stroke-dashoffset:'+o.toFixed(1)+';--c:'+c.toFixed(1)+'" transform="rotate(-90 31 31)"/><text x="31" y="32" text-anchor="middle" class="n">'+done+'/'+total+'</text><text x="31" y="44" text-anchor="middle" class="l">처리</text></svg>';
 }
 const siteOf=t=>(t.kind==='inquiry'?'i:':'d:')+String(t.ref);
 /* 진행 링 = 오늘 처리한 현장(PC에서 처리한 것 포함) / (처리한 현장 + 아직 남은 일) */
 const workedOf=(t,ds)=>doneOf(t)||!!(ds&&ds.sites&&ds.sites.has(siteOf(t)));
 function heroHTML(items,ds){
  const left=items.filter(t=>!workedOf(t,ds)),doneN=ds&&ds.sites?Math.max(ds.total,items.length-left.length):items.length-left.length,done=doneN,total=doneN+left.length,counts={};
  left.forEach(t=>{const k=catOf(t);counts[k]=(counts[k]||0)+1;});
  const segs=SEG.filter(([k])=>counts[k]);
  return '<div class="ml-hero-row">'+ringSVG(done,total)+'<div class="ml-hero-txt"></div></div>'
   +(segs.length?'<div class="ml-seg">'+segs.map(([k])=>'<span class="'+k+'" style="flex:'+counts[k]+'"></span>').join('')+'</div><div class="ml-legend">'+segs.map(([k,l])=>'<span><i class="'+k+'"></i>'+l+' <b>'+counts[k]+'</b></span>').join('')+'</div>':'');
 }
 function closeHTML(ds){
  const parts=[['고객 연락',ds.contact,'#3366FF'],['다음 할 일',ds.next-ds.promise,'#15AA72'],['고객 약속',ds.promise,'#F04452']].filter(x=>x[1]>0);
  const tot=parts.reduce((s,x)=>s+x[1],0),r=34,c=2*Math.PI*r;let off=0;
  const arcs=tot?parts.map(x=>{const len=c*x[1]/tot,gap=parts.length>1?2:0,s='<circle cx="45" cy="45" r="'+r+'" class="arc" style="stroke:'+x[2]+';stroke-dasharray:'+Math.max(0,len-gap).toFixed(1)+' '+(c-len+gap).toFixed(1)+';stroke-dashoffset:'+(-off).toFixed(1)+'" transform="rotate(-90 45 45)"/>';off+=len;return s;}).join(''):'';
  const days=[];for(let i=4;i>=0;i--){const t=new Date();t.setDate(t.getDate()-i);days.push(kstDay(t));}
  const vals=days.map(k=>Number((ds.hist||{})[k]||0)),mx=Math.max(1,...vals);
  return '<div class="ml-close-row"><svg class="ml-donut" width="90" height="90" viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="'+r+'" class="trk"/>'+arcs+'<text x="45" y="47" text-anchor="middle" class="n">'+(ds.total||0)+'</text><text x="45" y="61" text-anchor="middle" class="l">오늘 처리</text></svg>'
   +'<div class="ml-close-legend">'+(parts.length?parts.map(x=>'<span><i style="background:'+x[2]+'"></i>'+x[0]+' <b>'+x[1]+'</b></span>').join(''):'<span>오늘 저장한 처리 기록이 아직 없습니다</span>')+'</div></div>'
   +'<div class="ml-hist"><small>최근 5일 처리</small><div class="ml-bars">'+vals.map((v,i)=>'<span class="'+(i===4?'now':'')+'" style="height:'+Math.max(6,Math.round(v/mx*100))+'%"><em>'+(v||'')+'</em></span>').join('')+'</div><div class="ml-bars-x">'+days.map((k,i)=>'<i>'+(i===4?'오늘':Number(k.slice(8))+'일')+'</i>').join('')+'</div></div>';
 }
 function pillOf(t){
  if(t.kind==='inquiry'){
   if(t.bucket==='overdue'){const n=t.due_at?Math.floor((Date.parse(kstDay()+'T00:00:00Z')-Date.parse(day(t.due_at)+'T00:00:00Z'))/864e5):NaN;return [n>0?n+'일 지남':'기한 지남','late'];}
   const q=((root.ADMIN&&root.ADMIN.inquiries)||[]).find(x=>String(x.key)===String(t.ref)),hh=q&&typeof root.todayHoursM==='function'?root.todayHoursM(q.at):null;
   /* 오래된 문의가 '449시간 경과'처럼 길게 보이지 않게 — 하루가 넘으면 일 단위로 */
   return hh==null?['새 문의','new']:[hh<1?'방금 접수':hh<24?hh+'시간 경과':Math.floor(hh/24)+'일 경과',hh>=2?'late':'new'];
  }
  const d=dealById(t.ref),dd=d&&root.execDueM?root.execDueM(d):null;
  if(dd==null)return ['할 일 없음','etc'];
  return dd<0?[(-dd)+'일 지남','late']:dd===0?['오늘','today']:[dd+'일 남음','etc'];
 }
 /* 결과를 안 남긴 통화(2026-09-26 '고객 접촉 후 결과 기록'): 최근 24시간 '전화 시도' 뒤에 다른 기록이 없는 내 영업 — 누르면 결과 창.
    '전화 시도'는 문장 어디에 있어도 시도다 — 상세 화면 버튼은 '관리소장 전화 시도'로 남긴다(예전엔 이걸 못 잡았다). */
 function pendingCalls(){
  const mine=typeof root.myDeals==='function'?root.myDeals():[],now=Date.now(),out=[];
  mine.forEach(d=>{const acts=d.activities||[];let last=null;
   acts.forEach(x=>{const at=Date.parse(x.at||x.occurred_at||'');if(!Number.isFinite(at)||now-at>864e5||!ATTEMPT.test(String(x.note||'')))return;
    const done=acts.some(y=>y!==x&&!ATTEMPT.test(String(y.note||''))&&!/^[a-z0-9_]+$/.test(String(y.type||''))&&Date.parse(y.at||y.occurred_at||'')>at);
    if(!done&&(!last||at>last))last=at;});
   if(last)out.push({d,at:last});});
  return out.sort((a,b)=>b.at-a.at);
 }
 function pendingCallsHTML(){
  const list=pendingCalls();if(!list.length)return '';
  const hm=t=>{const x=new Date(t);return String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0');};
  return '<section class="ml-pending" aria-label="결과를 안 남긴 통화"><div class="ml-pending-head"><b>📞 결과를 안 남긴 통화 '+list.length+'건</b><small>결과 하나만 고르면 다음 할 일까지 이어집니다</small></div>'
   +list.slice(0,5).map(x=>'<button type="button" class="ml-pitem" data-ref="'+attr(x.d.id)+'" onclick="MobileLoop.resume(this.dataset.ref)"><span>'+h(x.d.nm)+'</span><em>'+hm(x.at)+' 전화</em></button>').join('')+'</section>';
 }
 function resume(id){const d=dealById(id);if(!d)return;root.G.deal=d.id;root.G.sub=null;root.render();root.setTimeout?root.setTimeout(()=>root.dealCallSheetM(),350):root.dealCallSheetM();}
 function backlogHTML(){
  const list=(root.G._legacyM||[]).slice();if(!list.length)return '';
  const pick=list.sort((a,b)=>(Number(b.amt)||0)-(Number(a.amt)||0)).slice(0,10);
  return '<section class="ml-backlog" aria-label="과거 영업 정리"><div class="ml-backlog-head"><b>과거 영업 정리 · 오늘 '+pick.length+'건</b><small>예전에 옮겨 온 영업 '+list.length+'건 중 — 열어서 다음 할 일을 잡거나 진행상태를 보류·종료로 바꾸면 빠집니다.</small></div><div class="ml-backlog-list">'
   +pick.map(d=>'<button type="button" class="ml-bitem" data-ref="'+attr(d.id)+'" onclick="openTodayEntryM(\'deal\',this.dataset.ref)"><span>'+h(d.nm)+'</span><em>'+h(root.stageLabel(d.code))+(Number(d.amt)>0?' · '+h(root.amtTxt(d.amt)):'')+'</em></button>').join('')+'</div></section>';
 }
 const baseToday=root.rToday;
 if(typeof baseToday==='function')root.rToday=function(){
  const r=baseToday.apply(this,arguments);
  try{
   if(root.G.mode==='admin')return r;
   const body=root.document.querySelector('#scr .body');if(!body)return r;
   const items=root.G._today||[],ds=daySummary(),remain=body.querySelector('.mt-remain');
   /* 오늘 머리: 진행 링 + 남은 일 우선순위 막대 / 다 끝낸 날: 도넛 + 최근 5일 막대 */
   if(remain){
    const hero=root.document.createElement('div'),finished=remain.classList.contains('done');
    hero.className='ml-hero'+(finished?' done':'');
    hero.innerHTML=finished?closeHTML(ds):heroHTML(items,ds);
    remain.replaceWith(hero);
    if(finished)hero.prepend(remain);
    else{hero.querySelector('.ml-hero-txt').append(remain);if(ds.total&&!remain.querySelector('.ml-daysum-inline'))remain.insertAdjacentHTML('beforeend',' <span class="ml-daysum-inline">· 오늘 처리 '+ds.total+'건</span>');}
   }
   const heroEl=body.querySelector('.ml-hero'),pend=pendingCallsHTML();
   if(pend){if(heroEl)heroEl.insertAdjacentHTML('afterend',pend);else body.insertAdjacentHTML('afterbegin',pend);}
   body.insertAdjacentHTML('beforeend',backlogHTML());
   /* 카드: 종류 아이콘 + 기한 배지(내 화면에서는 담당자 이름 대신) */
   body.querySelectorAll('.mt-item').forEach(el=>{
    const t=items.find(x=>String(x.ref)===el.dataset.ref&&x.kind===el.dataset.kind);if(!t)return;
    const k=catOf(t),top=el.querySelector('.mt-item-top'),strong=top&&top.querySelector('strong');
    if(strong&&!top.querySelector('.ml-kind'))strong.insertAdjacentHTML('beforebegin','<i class="ml-kind '+k+'" aria-hidden="true">'+KIND_ICON[k]+'</i>');
    const own=top&&top.querySelector('.mt-owner'),p=pillOf(t);
    if(own)own.outerHTML='<i class="ml-dpill '+p[1]+'">'+h(p[0])+'</i>';
    if(workedOf(t,ds))el.classList.add('ml-done-item');
    /* 기한은 오른쪽 배지가 말한다 — 문장 끝 '3일 지남'·'2일 남음'·'오늘' 꼬리(예전 'D+24'·'D-3' 포함)는 뺀다 */
    const why=el.querySelector('.mt-reason');if(why&&p[0])why.textContent=why.textContent.replace(/\s*·\s*(D[+-]\d+|\d+일 (?:지남|남음)|오늘|내일)$/,'');
    if(t.promise){el.classList.add('ml-promise-item');const n=el.querySelector('.mt-next');if(n)n.textContent='→ 약속 지키고 결과 남기기';}
   });
  }catch(e){}
  return r;
 };

 /* ② 상세 '지금 할 일' 카드 */
 const baseCard=root.mNowCardM;
 if(typeof baseCard==='function')root.mNowCardM=function(d){
  let html=baseCard.apply(this,arguments);
  try{
   const a=openNext(d);
   if(isPromise(a))html=html.replace('<div style="font-size:14px;font-weight:800;','<div class="ml-promise">🤝 고객 약속</div><div style="font-size:14px;font-weight:800;');
   /* [결과 남기기]도 같은 결과 창 — 전화 앱에서 돌아왔는데 창이 안 뜬 경우의 대비. 긴 메모는 창 안 '자세히 기록' */
   html=html.replace('onclick="callMemoSheetM()">결과 남기기','onclick="dealCallSheetM()">결과 남기기');
   const i=html.lastIndexOf('</div>');
   if(i>0)html=html.slice(0,i)+'<button type="button" class="ml-support-link" onclick="MobileLoop.support()">🆘 관리자에게 지원 요청</button>'+html.slice(i);
   html+=flowStrip(d);
  }catch(e){}
  return html;
 };

 /* 영업 흐름 한 줄 — 연락 결과·단계 변경을 날짜순 칩으로, 7일 넘는 공백은 ⏸, 끝에 다음 할 일 */
 function flowStrip(d){
  const ts=v=>Date.parse(v||''),ev=[];
  (d.activities||[]).forEach(x=>{const at=x.at||x.occurred_at,type=String(x.type||'');if(!Number.isFinite(ts(at))||/^[a-z0-9_]+$/.test(type))return;ev.push({at,type,body:String(x.note||''),result:String(x.result||'')});});
  (d.stageHistory||d.stage_history||[]).forEach(x=>{const at=x.at||x.changed_at;if(Number.isFinite(ts(at)))ev.push({at,type:'단계',body:String(x.to||x.to_stage||''),result:''});});
  /* 흐름 완성(2026-09-26 컨설턴트 '유입→배정→첫 응대→…→결과'): 이 영업을 만든 견적문의의 접수·배정·첫 연락, 영업 결과(수주·실주) */
  const oid=d.origin_inquiry_id||d.originInquiryId,q=oid&&(((root.BUNDLE&&root.BUNDLE.inquiries)||[]).find(x=>String(x.id)===String(oid)));
  if(q)[[q.received_at||q.at,'문의 접수'],[q.assigned_at,'담당 배정'],[q.first_response_at,'첫 연락']].forEach(([at,label])=>{if(Number.isFinite(ts(at)))ev.push({at,type:label,body:'',result:'',src:'inq'});});
  if((d.outcome==='won'||d.outcome==='lost')&&Number.isFinite(ts(d.closed_at||d.closed)))ev.push({at:d.closed_at||d.closed,type:d.outcome==='won'?'수주':'실주',body:'',result:'',src:'end'});
  ev.sort((a,b)=>ts(a.at)-ts(b.at));
  const kind=x=>{const t=x.type,b=x.body;
   if(x.src==='inq')return [t==='문의 접수'?'📥':t==='담당 배정'?'👤':'📞',t,'in'];
   if(x.src==='end')return [t==='수주'?'🏆':'✖',t,t==='수주'?'won':'lost'];
   if(/^\[지원 처리\]/.test(b))return ['✅','관리자 지원 처리','sup'];
   if(/^\[지원 요청\]/.test(b))return ['🆘','지원 요청','sup'];
   if(t==='단계')return ['➜',root.stageLabel?root.stageLabel(b)||b:b,'stage'];
   if(/부재/.test(t)||/부재/.test(b))return ['📵','부재','abs'];
   if(/방문/.test(t))return ['🏠','방문','act'];
   if(/문자|카카오|메시지/.test(t))return ['💬','문자','act'];
   if(/전화|통화/.test(t))return ['📞','전화','act'];
   return ['•',t.length>8?t.slice(0,8)+'…':t||'기록','misc'];};
  /* 예전 기록('통화 — …'·'통화 시도 — …'·'전화 부재 — 못 받으심')과 새 기록('통화 완료 · …'·'통화 시도 · …'·'부재중 (전화 안 받음)') 모두 앞머리를 떼고 읽는다 */
  const tidy=v=>{v=plainWords(v).replace(/^(통화( 완료| 시도)?|전화( 부재)?|부재)\s*[—·]\s*/,'').trim();return /^부재중\s*\(전화 안 받음\)$/.test(v)?'전화 안 받음':v;};
  const short=v=>{v=tidy(v);return v.length>14?v.slice(0,14)+'…':v;};
  const md=v=>day(v).slice(5).replace('-','/');
  const a=openNext(d),dd=a&&root.execDueM?root.execDueM(d):null;
  const next=a&&a.text?'<span class="ml-next'+(dd!=null&&dd<0?' late':'')+'"><i>'+(isPromise(a)?'🤝':'📅')+'</i><b>다음</b><em>'+h(short(promiseText(a)||a.text))+'</em><small>'+h(md(a.due_at||a.due))+(dd!=null&&dd<0?' · '+(-dd)+'일 지남':'')+'</small></span>':'<span class="ml-next none"><i>⚠</i><b>다음 할 일 없음</b></span>';
  const last=ev[ev.length-1],lk=last?kind(last):null,lastDetail=last?short(last.result||last.body):'';
  const lastTxt=last?md(last.at)+' '+lk[1]+(lk[2]==='act'||lk[2]==='abs'?(lastDetail?' · '+lastDetail:''):''):'아직 기록 없음 — 첫 연락 결과부터 이어집니다';
  return '<div class="ml-flow" aria-label="영업 흐름">'+stepper(d)
   +'<div class="ml-sub"><b>영업 흐름</b><small>날짜 간격 그대로</small></div>'+timeline(ev,a,dd,d,kind)
   +'<div class="ml-key">'+(q?'<span><i class="in"></i>문의·배정</span>':'')+'<span><i class="act"></i>연락</span><span><i class="abs"></i>부재</span><span><i class="stage"></i>단계</span><span><i class="sup"></i>지원</span><span><i class="gap"></i>'+STALL_DAYS+'일 넘게 연락 없음</span></div>'
   +'<div class="ml-sumrow"><span class="ml-last">마지막 · '+h(lastTxt)+'</span>'+next+'</div></div>';
 }
 /* 진행도: 접촉 → 설계 → 발송 → 경쟁·입찰 → 계약·시공 (관계관리는 단계 밖 트랙) */
 const STEP=[['first_contact','접촉'],['consulting','설계'],['sent','발송'],['compete','경쟁·입찰'],['contract','계약·시공']];
 const STEP_IDX={first_contact:0,consulting:1,sent:2,compete:3,imminent:3,bidding:3,contract:4,construction:4,completion:4,won:5};
 function stepper(d){
  const code=String(d.code||''),rel=['rapport','silent','waiting'].indexOf(code)>=0,idx=STEP_IDX[code];
  const x0=20,x1=280,gap=(x1-x0)/4,xs=STEP.map((_,i)=>x0+i*gap),all=idx===5,cur=idx==null?-1:Math.min(idx,4);
  let s='<svg class="ml-steps" viewBox="0 0 300 40" width="100%" aria-hidden="true"><line x1="'+x0+'" y1="12" x2="'+x1+'" y2="12" class="base"/>';
  if(all||cur>0)s+='<line x1="'+x0+'" y1="12" x2="'+(all?x1:xs[cur])+'" y2="12" class="prog"/>';
  STEP.forEach((st,i)=>{const now=!all&&i===cur,on=all||i<cur;s+='<circle cx="'+xs[i]+'" cy="12" r="'+(now?7:5)+'" class="'+(now?'now':on?'on':'off')+'"/><text x="'+xs[i]+'" y="33" text-anchor="middle" class="'+(now?'tn':'t')+'">'+st[1]+'</text>';});
  const cap=rel?'관계관리 중 — 진행 단계 밖에서 관리':all?'수주':cur>=0?(root.stageLabel?root.stageLabel(code):code):'';
  return '<div class="ml-sub"><b>진행도</b><small>'+h(cap)+'</small></div>'+s+'</svg>';
 }
 /* 흐름 타임라인: 첫 기록~오늘을 날짜 비율대로 — 점=기록, 점선=7일 넘는 공백, 끝 점=오늘(다음 할 일 지남·없음이면 빨강) */
 function timeline(ev,a,dd,d,kind){
  const ts=v=>Date.parse(v||''),now=Date.now(),pts=ev.map(x=>({t:ts(x.at),k:kind(x)[2]})).filter(p=>Number.isFinite(p.t)&&p.t<=now);
  let t0=pts.length?pts[0].t:ts(d.created_at||d.created);if(!Number.isFinite(t0)||t0>now)t0=now-7*864e5;
  const span=Math.max(now-t0,3*864e5),X=t=>12+(t-t0)/span*272;
  let s='<svg class="ml-tl" viewBox="0 0 300 44" width="100%" aria-hidden="true">',px=12,pt=t0,big={g:0,x:0};
  pts.concat([{t:now,k:'today'}]).forEach(p=>{const x=X(p.t),g=(p.t-pt)/864e5;if(x-px>0.5)s+='<line x1="'+px.toFixed(1)+'" y1="20" x2="'+x.toFixed(1)+'" y2="20" class="'+(g>STALL_DAYS?'gap':'seg')+'"/>';if(g>big.g)big={g,x:(px+x)/2};px=x;pt=p.t;});
  pts.forEach(p=>{s+='<circle cx="'+X(p.t).toFixed(1)+'" cy="20" r="4.5" class="d '+p.k+'"/>';});
  const late=!a||(dd!=null&&dd<0);
  s+='<circle cx="284" cy="20" r="6.5" class="today'+(late?' late':'')+'"/>';
  const md0=t=>{const x=new Date(t);return (x.getMonth()+1)+'/'+x.getDate();};
  s+='<text x="12" y="40" class="t">'+md0(t0)+'</text><text x="284" y="40" text-anchor="end" class="t">오늘</text>';
  if(big.g>STALL_DAYS)s+='<text x="'+Math.min(250,Math.max(50,big.x)).toFixed(1)+'" y="10" text-anchor="middle" class="tg">'+Math.floor(big.g)+'일 연락 없음</text>';
  return s+'</svg>';
 }
 /* 준비 중 기능은 정직하게(2026-09-26): 운영 화면에 예시 숫자·가짜 '발송/저장 완료'를 보이지 않는다. ?demo=1 에서만 예시 그대로.
    - 영업사원 상세 [사진]·[템플릿]: 실제로 저장·발송하지 않으므로 숨김. [음성]: 실제 저장되는 통화 메모 창(음성 입력 포함)으로.
    - 관리자 코칭·주간 브리핑·월간 보고·중복현장·3축 진단: '준비 중' 안내(실제 현황 위치 안내). 리포트의 예시 숫자 카드 제거.
    - 확인 요청: 잔디 자동 발송 전까지 '문구 복사'로 — 보낸 척하지 않는다. */
 if(!root.DEMO){
  const scrEl=()=>root.document.getElementById('scr');
  const soon=(title,where)=>{const s=scrEl();if(!s)return;s.innerHTML=(typeof root.appbarS==='function'?root.appbarS(title):'')+'<div class="body fadein"><div class="card ml-soon"><b>준비 중인 화면입니다</b><p>아직 실제 데이터와 연결되지 않아 예시 숫자는 보여 드리지 않습니다.'+(where?' 실제 현황은 '+h(where)+'에서 확인하세요.':'')+'</p></div></div>';};
  root.rCoach=()=>soon('코칭 신호','PC 컨트롤타워 ‘담당자별 문제’');
  root.rBrief=()=>soon('주간 브리핑','PC 컨트롤타워');
  root.rMonthly=()=>soon('월간 보고','PC 성과 분석');
  root.rDups=()=>soon('중복현장','PC 데이터 관리');
  root.rAxis=(head,s)=>soon((s&&s.nm?s.nm+' · ':'')+'진단','PC 성과 분석');
  root.coachSheet=()=>root.toast('면담 안건은 준비 중입니다.');
  root.photoSheet=root.addPhoto=()=>root.toast('사진 첨부는 준비 중입니다 — 아직 저장되지 않습니다.');
  root.tmplSheet=root.sendTmpl=()=>root.toast('템플릿 발송은 준비 중입니다 — 문자는 [문자] 버튼으로 보내 주세요.');
  if(typeof root.callMemoSheetM==='function')root.voiceMemo=()=>root.callMemoSheetM();
  root.nudgeSheet=function(nm,ctx){
   ctx=ctx||'응대 기준일 초과 건';const msg=String(nm||'')+'님, '+ctx+' 처리 부탁드립니다. 오늘 할 일에 올라가 있어요.';
   root.openSheet(root.intro('var(--warn-bg)','#a36312',root.IC.bell,'확인 요청 문구 — '+h(ctx),'잔디 자동 발송은 준비 중입니다 — 문구를 복사해 직접 보내 주세요'),
    '<div class="card" style="margin-bottom:10px"><div class="hint" style="color:var(--ink-2);user-select:text">📣 '+h(msg)+'</div></div><button class="btn btn-primary" id="ml-nudge-copy">문구 복사</button>');
   const b=root.document.getElementById('ml-nudge-copy');
   if(b)b.onclick=()=>{const fail=()=>root.toast('복사하지 못했습니다 — 문구를 길게 눌러 복사해 주세요');try{root.navigator.clipboard.writeText(msg).then(()=>{root.closeSheet();root.toast('문구를 복사했습니다 — 잔디에 붙여 넣어 보내 주세요');},fail);}catch(e){fail();}};
  };
  const baseRpt=root.rRpt;
  if(typeof baseRpt==='function')root.rRpt=function(){const r=baseRpt.apply(this,arguments);try{const body=root.document.querySelector('#scr .body');body.querySelectorAll('.card.gauge').forEach(c=>c.remove());const sp=body.querySelector('.sec-h span');if(sp)sp.textContent='준비 중 — 실제 리포트는 PC 성과 분석';body.querySelectorAll('.prow .ps').forEach(p=>{p.textContent='준비 중';});}catch(e){}return r;};
  const basePerf=root.rPerf;
  if(typeof basePerf==='function')root.rPerf=function(){const r=basePerf.apply(this,arguments);try{root.document.querySelectorAll('#scr .body .card').forEach(c=>{if(/코칭 신호|활동·규율/.test(c.textContent))c.remove();});root.document.querySelectorAll('#scr .body .prow').forEach(p=>{p.removeAttribute('onclick');p.style.cursor='default';const ps=p.querySelector('.ps');if(ps&&/진단/.test(ps.textContent))ps.textContent='분기 수주 누적';});}catch(e){}return r;};
 }
 function hideMockButtons(){if(root.DEMO)return;try{root.document.querySelectorAll('#scr button[onclick="photoSheet()"],#scr button[onclick="tmplSheet()"]').forEach(b=>b.remove());}catch(e){}}
 function scrollFlow(){try{root.document.querySelectorAll('.ml-row').forEach(r=>{r.scrollLeft=r.scrollWidth;});}catch(e){}hideMockButtons();}
 const baseRender=root.render;
 if(typeof baseRender==='function')root.render=function(){const r=baseRender.apply(this,arguments);if(root.G&&root.G.deal!=null)root.requestAnimationFrame?root.requestAnimationFrame(scrollFlow):scrollFlow();return r;};

 /* ③ 통화 결과: 결과 하나 → 날짜 하나 */
 const CHIPS=[
  ['ongoing','통화함 · 진행 중','다음 확인일만 고르면 끝'],
  ['recall','다시 연락하기로 함','통화가 짧았거나 나중에 다시 걸기로 함'],
  ['absent','전화 안 받음','다시 걸 날짜만 고르면 끝'],
  ['promise','고객과 약속함','🤝 고객 약속으로 등록'],
  ['detail','자세히 기록 (견적·일정·종료 등)','기록 창이 열립니다']];
 function dateOptions(){
  const fmt=x=>kstDay(x),now=new Date(),add=n=>{const t=new Date(now);t.setDate(t.getDate()+n);return t;};
  const mon=new Date(now);mon.setDate(mon.getDate()+((8-mon.getDay())%7||7));
  return [['내일',fmt(add(1))],['3일 후',fmt(add(3))],['다음 주 월요일',fmt(mon)]];
 }
 let busy=false;
 function resultSheet(){
  const d=current();if(!d)return;const c=root.contactInfoM?root.contactInfoM(d):{};
  root.openSheet(root.intro('var(--blue-50)','var(--blue-dark)',root.IC.phone,'어떻게 됐나요?',h(d.nm)+(c.name?' · '+h(c.name):'')),
   '<p class="ml-lead">하나만 고르면 기록과 다음 할 일까지 자동으로 만듭니다</p><div class="ml-chips">'+CHIPS.map(x=>'<button type="button" class="ml-chip" data-chip="'+x[0]+'"><b>'+x[1]+'</b><small>'+x[2]+'</small></button>').join('')+'</div>'
   +'<div class="ml-step2" hidden><label class="ml-note" hidden>어떤 약속인가요?<input type="text" maxlength="80" placeholder="예: 금요일까지 수정 견적 전달"></label><b class="ml-q">언제 다시 확인할까요?</b><div class="ml-dates">'+dateOptions().map(x=>'<button type="button" class="ml-date" data-date="'+x[1]+'">'+x[0]+'<small>'+x[1].slice(5).replace('-','/')+'</small></button>').join('')+'<label class="ml-date ml-pick">날짜 선택<input type="date"></label></div></div>'
   +'<p class="ml-status" role="status" aria-live="polite"></p>');
  const card=root.document.getElementById('sheetcard');if(!card)return;
  const step2=card.querySelector('.ml-step2'),note=card.querySelector('.ml-note'),status=card.querySelector('.ml-status');let chip='';
  card.querySelectorAll('.ml-chip').forEach(b=>b.onclick=()=>{if(busy)return;chip=b.dataset.chip;
   if(chip==='detail'){root.closeSheet();if(typeof root.callMemoSheetM==='function')root.callMemoSheetM();return;}
   card.querySelectorAll('.ml-chip').forEach(x=>x.classList.toggle('on',x===b));note.hidden=chip!=='promise';step2.hidden=false;
   (chip==='promise'?note.querySelector('input'):step2).scrollIntoView({block:'nearest',behavior:'smooth'});if(chip==='promise')note.querySelector('input').focus();});
  const submit=due=>save(d,chip,due,note.querySelector('input').value.trim(),status,card);
  card.querySelectorAll('.ml-date[data-date]').forEach(b=>b.onclick=()=>submit(b.dataset.date));
  card.querySelector('.ml-pick input').onchange=e=>{if(e.target.value)submit(e.target.value);};
 }
 async function confirmOp(progress,op,payload,actionId){
  const Q=root.Phase1.queue;let id=progress[op];
  if(id&&(Q.list().find(q=>q.request_id===id)||{}).status==='rejected'){delete progress[op];id=null;}
  if(!id){id=root.queueMobileContactOperation(op,payload,actionId);progress[op]=id;}
  await Q.flush();const row=Q.list().find(q=>q.request_id===id);
  if(!row||row.status!=='done'||!row.ack||row.ack.ok!==true)throw Error(row&&row.error||'서버 확인 대기 중 — 다시 누르면 같은 요청을 확인합니다.');
  return row;
 }
 async function save(d,chip,due,noteText,status,card){
  if(busy||!chip||!due)return;
  if(!root.Phase1||!root.Phase1.queue||typeof root.queueMobileContactOperation!=='function'){status.textContent='로그인 상태에서만 저장할 수 있습니다.';return;}
  const promise=chip==='promise';
  if(promise&&!noteText){status.textContent='어떤 약속인지 한 줄만 적어주세요.';return;}
  const actNote=chip==='ongoing'?'통화 완료 · 진행 중 ('+due.slice(5).replace('-','/')+' 다시 확인)':chip==='recall'?'통화 시도 · 다시 연락하기로 함':chip==='absent'?'부재중 (전화 안 받음)':'통화 완료 · 고객 약속: '+noteText;
  const nextText=promise?noteText:chip==='absent'?'다시 전화하기':'진행 상황 확인 전화';
  const activity={type:'전화',note:actNote,result:'',occurred_at:new Date().toISOString()};
  const next={type:promise?'고객 약속':'전화',text:nextText,due_at:due};
  busy=true;card.querySelectorAll('button,input').forEach(x=>x.disabled=true);
  const progress=card._mlProgress||(card._mlProgress={});
  try{
   status.textContent='기록 확인 중…';
   const cur=openNext(d);
   if(cur&&UUID.test(String(cur.id||''))&&!progress.completed){await confirmOp(progress,'next_action_complete',{opportunity_id:d.id},cur.id);progress.completed=true;cur.status='done';cur.completed_at=new Date().toISOString();}
   const rec=await confirmOp(progress,'activity',{opportunity_id:d.id,...activity});
   d.activities=Array.isArray(d.activities)?d.activities:[];
   if(!d.activities.some(x=>x.id===rec.ack.activity_id))d.activities.push({id:rec.ack.activity_id,type:activity.type,note:activity.note,result:'',at:activity.occurred_at,occurred_at:activity.occurred_at});
   const sch=await confirmOp(progress,'next_action',{opportunity_id:d.id,...next});
   d.nextAction=d.nextActionObj={id:sch.ack.next_action_id,opportunity_id:d.id,type:next.type,text:next.text,due:due,due_at:due,status:'open'};
   if(chip!=='absent')d.contactAt=activity.occurred_at;d.lastAt=activity.occurred_at;
   try{root.G.done[root.doneKey({ref:d.id})]=1;}catch(e){}
   status.textContent='✓ 기록 완료 · ✓ 다음 할 일 '+due.slice(5).replace('-','/')+' 등록';status.classList.add('ok');
   busy=false;setTimeout(()=>{root.closeSheet();root.render();},700);
  }catch(e){busy=false;card.querySelectorAll('button,input').forEach(x=>x.disabled=false);status.textContent=String(e&&e.message||e);}
 }
 root.dealCallSheetM=resultSheet;

 /* 통화가 길어 휴대폰이 브라우저를 정리하면, 돌아왔을 때 페이지가 새로 열려 '방금 통화한 현장'을 잃는다.
    통화 버튼을 누를 때 현장을 이 탭에 적어 두고(30분), 다시 열리면 그 현장과 결과 창을 띄운다. */
 const PENDING='crm:call-pending:v1';
 const pendingStore=()=>{try{return root.sessionStorage||null;}catch(e){return null;}};
 function clearPending(){try{const s=pendingStore();if(s)s.removeItem(PENDING);}catch(e){}}
 const baseCall=root.dealCallM;
 if(typeof baseCall==='function')root.dealCallM=function(){const r=baseCall.apply(this,arguments);try{const s=pendingStore();if(s&&root.G&&root.G.dealCallPending!=null)s.setItem(PENDING,JSON.stringify({id:String(root.G.dealCallPending),at:Date.now()}));}catch(e){}return r;};
 const openResult=resultSheet;
 root.dealCallSheetM=function(){clearPending();return openResult.apply(this,arguments);};
 function resumeAfterReload(){
  let p=null;try{const s=pendingStore();p=s&&JSON.parse(s.getItem(PENDING)||'null');}catch(e){}
  if(!p||!p.id)return;if(Date.now()-Number(p.at||0)>30*60000){clearPending();return;}
  let tries=0,iv=null;iv=root.setInterval(()=>{tries++;
   if(root.G&&root.G.dealCallPending!=null){root.clearInterval(iv);return;}/* 같은 페이지로 돌아온 경우는 기존 경로가 띄운다 */
   const d=dealById(p.id);
   if(d&&root.G&&root.G.user){root.clearInterval(iv);root.G.deal=d.id;root.G.sub=null;root.render();root.setTimeout(()=>root.dealCallSheetM(),350);}
   else if(tries>120){root.clearInterval(iv);}},500);
 }
 resumeAfterReload();

 /* 관리자 지원 요청 — 다음 할 일을 덮지 않는 추가 전용 메모(PC와 같은 '[지원 요청]' 접두어 → 컨트롤타워 집계) */
 function support(){
  const d=current();if(!d)return;
  root.openSheet(root.intro('var(--warn-bg)','#a15c07','🆘','관리자 지원 요청',h(d.nm)),
   '<p class="ml-lead">어떤 지원이 필요한지 한 줄로 적어주세요. 관리자 화면에 바로 표시됩니다.</p><textarea class="ml-support-text" maxlength="300" rows="3" placeholder="예: 가격 협의 동행 요청 — 10/2 입대의 전"></textarea><button type="button" class="btn btn-primary ml-support-send">지원 요청 보내기</button><p class="ml-status" role="status" aria-live="polite"></p>');
  const card=root.document.getElementById('sheetcard');if(!card)return;
  const text=card.querySelector('.ml-support-text'),status=card.querySelector('.ml-status'),send=card.querySelector('.ml-support-send');
  text.focus();
  send.onclick=async()=>{
   const note=text.value.trim();if(!note){status.textContent='한 줄만 적어주세요.';return;}
   if(busy)return;busy=true;send.disabled=true;status.textContent='보내는 중…';
   const progress=card._mlProgress||(card._mlProgress={});
   try{
    const who=root.G&&root.G.user&&root.G.user.nm||'';
    const payload={opportunity_id:d.id,type:'메모',note:'[지원 요청] '+note+' — 요청자 '+who,result:'',occurred_at:new Date().toISOString()};
    const rec=await confirmOp(progress,'activity',payload);
    d.activities=Array.isArray(d.activities)?d.activities:[];d.activities.push({id:rec.ack.activity_id,type:'메모',note:payload.note,at:payload.occurred_at,occurred_at:payload.occurred_at});
    busy=false;status.textContent='✓ 지원 요청을 보냈습니다 — 관리자 화면에 표시됩니다.';status.classList.add('ok');setTimeout(()=>{root.closeSheet();root.render();},900);
   }catch(e){busy=false;send.disabled=false;status.textContent=String(e&&e.message||e);}
  };
 }
 root.MobileLoop=Object.freeze({support,resultSheet,flowStrip,daySummary,save,pill:pillOf,plainWords,resume,pendingCalls});
})(window);
