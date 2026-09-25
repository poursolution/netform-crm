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

 /* ④ 하루 마감 요약 — 서버 저장 확인(ACK)된 내 처리만, 날짜별로 이 기기에 모은다 */
 const DAY_SKIP=new Set(['opportunity_touch','favorite_set','campaign_create','campaign_update']);
 function daySummary(){
  const today=kstDay(),key='crm:daysum:v1:'+String(root.G&&root.G.user&&(root.G.user.id||root.G.user.nm)||'');
  let led={day:today,ids:{}};
  try{const raw=JSON.parse(root.localStorage.getItem(key)||'null');if(raw&&raw.day===today&&raw.ids)led=raw;}catch(e){}
  let rows=[];try{rows=root.Phase1&&root.Phase1.queue&&root.Phase1.queue.list()||[];}catch(e){}
  let changed=false;
  rows.forEach(r=>{if(!r||r.status!=='done'||!r.ack||led.ids[r.request_id])return;const op=String(r.operation||'');if(!op||DAY_SKIP.has(op)||kstDay(r.ack.server_at||r.ack.occurred_at||r.updated_at)!==today)return;const body=JSON.stringify(r.payload||{});led.ids[r.request_id]=op==='activity'?'contact':op==='next_action'?(/고객\s*약속/.test(body)?'promise':'next'):op==='next_action_complete'?'done':'other';changed=true;});
  if(changed)try{root.localStorage.setItem(key,JSON.stringify(led));}catch(e){}
  const v=Object.values(led.ids),n=k=>v.filter(x=>x===k).length;
  return {total:v.length,contact:n('contact'),next:n('next')+n('promise'),promise:n('promise')};
 }
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
   const done=body.querySelector('.mt-remain.done'),ds=daySummary();
   if(done&&ds.total)done.insertAdjacentHTML('beforeend','<div class="ml-daysum">오늘 처리 <b>'+ds.total+'건</b>'+(ds.contact?' · 고객 접촉 '+ds.contact:'')+(ds.next?' · 다음 할 일 '+ds.next:'')+(ds.promise?' · 고객 약속 '+ds.promise:'')+'</div>');
   else if(!done&&ds.total){const bar=body.querySelector('.mt-remain');if(bar&&!bar.querySelector('.ml-daysum-inline'))bar.insertAdjacentHTML('beforeend',' <span class="ml-daysum-inline">· 오늘 처리 '+ds.total+'건</span>');}
   body.insertAdjacentHTML('beforeend',backlogHTML());
   body.querySelectorAll('.mt-item').forEach(el=>{const t=(root.G._today||[]).find(x=>String(x.ref)===el.dataset.ref&&x.kind===el.dataset.kind);if(t&&t.promise){el.classList.add('ml-promise-item');const n=el.querySelector('.mt-next');if(n)n.textContent='→ 약속 지키고 결과 남기기';}});
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
  ev.sort((a,b)=>ts(a.at)-ts(b.at));
  const kind=x=>{const t=x.type,b=x.body;
   if(/^\[지원 요청\]/.test(b))return ['🆘','지원 요청','sup'];
   if(t==='단계')return ['➜',root.stageLabel?root.stageLabel(b)||b:b,'stage'];
   if(/부재/.test(t)||/부재/.test(b))return ['📵','부재','act'];
   if(/방문/.test(t))return ['🏠','방문','act'];
   if(/문자|카카오|메시지/.test(t))return ['💬','문자','act'];
   if(/전화|통화/.test(t))return ['📞','전화','act'];
   return ['•',t.length>8?t.slice(0,8)+'…':t||'기록','misc'];};
  const short=v=>{v=String(v||'').replace(/^(통화( 시도)?|전화( 부재)?|부재)\s*—\s*/,'').trim();return v.length>14?v.slice(0,14)+'…':v;};
  const md=v=>day(v).slice(5).replace('-','/');
  const chips=[];let prev=null,sig='',n=1;
  ev.forEach(x=>{const k=kind(x),t=ts(x.at),tail=k[2]==='act'?short(x.result||x.body):'',s=k[1]+'|'+tail+'|'+day(x.at);
   if(s===sig&&chips.length){n++;chips[chips.length-1]=chips[chips.length-1].replace(/<u>×\d+<\/u>|(?=<\/span>$)/,'<u>×'+n+'</u>');prev=t;return;}sig=s;n=1;
   if(prev!==null){const g=Math.floor((t-prev)/864e5);if(g>STALL_DAYS)chips.push('<span class="ml-gap'+(g>STALL_DAYS*2?' hot':'')+'">⏸ '+g+'일</span>');}
   chips.push('<span class="ml-ev '+k[2]+'"><i>'+k[0]+'</i><b>'+h(k[1])+'</b>'+(tail?'<em>'+h(tail)+'</em>':'')+'<small>'+md(x.at)+'</small></span>');prev=t;});
  const a=openNext(d),dd=a&&root.execDueM?root.execDueM(d):null;
  const idle=prev!==null?Math.floor((Date.now()-prev)/864e5):null,shown=chips.slice(-8);
  if(idle!==null&&idle>STALL_DAYS&&!(a&&dd!=null&&dd>=0))shown.push('<span class="ml-gap'+(idle>STALL_DAYS*2?' hot':'')+'">⏸ 오늘까지 '+idle+'일</span>');
  const next=a&&a.text?'<span class="ml-next'+(dd!=null&&dd<0?' late':'')+'"><i>'+(isPromise(a)?'🤝':'📅')+'</i><b>다음</b><em>'+h(short(promiseText(a)||a.text))+'</em><small>'+h(md(a.due_at||a.due))+(dd!=null&&dd<0?' · '+(-dd)+'일 지남':'')+'</small></span>':'<span class="ml-next none"><i>⚠</i><b>다음 할 일 없음</b></span>';
  return '<div class="ml-flow" aria-label="영업 흐름"><div class="ml-flow-head"><b>영업 흐름</b><small>'+(ev.length?'마지막 기록 '+md(ev[ev.length-1].at):'아직 기록 없음 — 첫 연락 결과부터 이어집니다')+'</small></div><div class="ml-row">'+shown.join('<i class="ml-arr">›</i>')+(shown.length?'<i class="ml-arr">›</i>':'')+next+'</div></div>';
 }
 function scrollFlow(){try{root.document.querySelectorAll('.ml-row').forEach(r=>{r.scrollLeft=r.scrollWidth;});}catch(e){}}
 const baseRender=root.render;
 if(typeof baseRender==='function')root.render=function(){const r=baseRender.apply(this,arguments);if(root.G&&root.G.deal!=null)root.requestAnimationFrame?root.requestAnimationFrame(scrollFlow):scrollFlow();return r;};

 /* ③ 통화 결과: 결과 하나 → 날짜 하나 */
 const CHIPS=[
  ['ongoing','진행 중이에요','다음 확인일만 고르면 끝'],
  ['recall','다시 연락해야 해요','통화 못 했거나 다시 걸기로 함'],
  ['absent','부재 · 못 받으심','재시도 일정 자동 등록'],
  ['promise','~하기로 약속했어요','🤝 고객 약속으로 등록'],
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
  const actNote=chip==='ongoing'?'통화 — 진행 중, '+due+' 다시 확인':chip==='recall'?'통화 시도 — 다시 연락하기로 함':chip==='absent'?'통화 시도 — 부재':'통화 — 고객 약속: '+noteText;
  const nextText=promise?noteText:chip==='absent'?'재시도 전화':'진행 상황 확인 연락';
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
 root.MobileLoop=Object.freeze({support,resultSheet,flowStrip,daySummary,save});
})(window);
