/* 지금 할 일 카드 + 통화 결과 칩 플로우 (2026-09-25 영업사원 CX 개편 1차).
   원칙: 상세를 열면 "지금 할 일"이 가장 먼저, 가장 크게. 결과는 칩 하나로 —
   시스템이 연락 결과와 다음 할 일을 기존 검증된 큐 경로로 대신 만든다.
   단계가 바뀌는 결과(견적·입찰·종료 등)는 기존 기록/전환 창으로 보낸다(자동 전이 금지). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v??'')),attr=v=>root.escAttr(String(v??''));
 const DEFAULT_TODO={first_contact:'고객에게 연락하고 니즈를 확인해 주세요',consulting:'견적 요청 내용을 확인하고 회신해 주세요',sent:'보낸 자료의 검토 여부를 확인해 주세요',rapport:'관계 유지 연락을 해주세요',silent:'다시 연락해 주세요',waiting:'재개 시점을 확인해 주세요',compete:'경쟁 상황과 다음 일정을 확인해 주세요',imminent:'계약 조건을 확인해 주세요',bidding:'입찰 일정을 확인해 주세요',contract:'계약 체결 상태를 확인해 주세요',construction:'착공 준비 상황을 확인해 주세요',completion:'준공·수금 상태를 확인해 주세요'};
 /* 표시 전용(2026-09-26 문구 정리): 예전 기록 문구를 새 용어로 보여 준다 — 저장된 값은 바꾸지 않는다. crm.html sayLegacyNote와 같은 규칙 */
 const SAY=[[/전화 부재 — 못 받으심|통화 시도 — 부재/g,'부재중 (전화 안 받음)'],[/통화 — 진행됨/g,'통화 완료 · 진행 중'],[/^통화 — 진행 중, \d{4}-(\d{2})-(\d{2}) 다시 확인/,'통화 완료 · 진행 중 ($1/$2 다시 확인)'],[/^통화 시도 — 다시 연락하기로 함/,'통화 시도 · 다시 연락하기로 함'],[/^통화 — 고객 약속: /,'통화 완료 · 고객 약속: '],[/재통화 시도/g,'다시 전화하기'],[/고객 요청 재연락/g,'요청 시점에 다시 연락'],[/통화 후속 확인/g,'통화 후 진행 확인'],[/고객 요청으로 후속 연기/g,'고객 요청으로 다음 주 재연락']];
 function say(v){if(typeof root.sayLegacyNote==='function')return root.sayLegacyNote(v);v=String(v??'');SAY.forEach(r=>{v=v.replace(r[0],r[1])});return v}
 function money(n){n=Number(n)||0;if(!n)return '';return n>=1e8?(Math.round(n/1e7)/10)+'억':Math.round(n/1e4).toLocaleString('ko-KR')+'만'}
 function dueDays(v){if(!v||!Number.isFinite(Date.parse(v)))return null;const n=root.daysTo(v);return Number.isFinite(n)?n:null}
 function lastTalk(d,p){
  const rows=[...(d.activities||[]),...((p&&p.activities)||[])].filter(x=>x&&(x.note||x.result));
  rows.sort((a,b)=>String(b.at||b.occurred_at||'').localeCompare(String(a.at||a.occurred_at||'')));
  const x=rows[0];if(!x)return null;
  return {text:say(x.note||x.result).slice(0,80),at:(x.at||x.occurred_at||'').slice(0,10)};
 }
 function needsOf(d){
  const c=d.stage_contexts||{};
  return String(c.first_contact?.fields?.needs||c.consulting?.fields?.quote_request||d.customer_need||'').slice(0,60);
 }
 function lastQuote(d){
  const q=(typeof root.execQuoteVersions==='function'?root.execQuoteVersions(d):[]).slice(-1)[0];
  if(!q)return '';
  return 'V'+(q.version_no||1)+(q.amount?' · '+money(q.amount):'')+(q.created_at?' · '+String(q.created_at).slice(0,10):'');
 }
 function todoOf(d,p){
  const a=root.actionObj(d,p),due=a?dueDays(a.due):null;
  if(a&&a.text)return {text:say(a.text),due:a.due||'',days:due,suggested:false,promise:/약속/.test(String(a.type||''))};
  return {text:DEFAULT_TODO[root.dealStage(d)]||'고객에게 연락하고 진행 상황을 확인해 주세요',due:'',days:null,suggested:true,promise:false};
 }
 function card(){
  const cur=root.CUR_DETAIL;if(!cur||cur.kind!=='deal')return '';
  const d=cur.item,p=root.currentPatch?root.currentPatch():{};
  const todo=todoOf(d,p),meta=root.relationshipMeta?root.relationshipMeta(d):{},talk=lastTalk(d,p),needs=needsOf(d),quote=lastQuote(d);
  const dueTag=todo.days===null?(todo.suggested?'<span class="nc-sug">추천 할 일</span>':'<span class="nc-warn">기한 미입력</span>'):todo.days<0?'<span class="nc-late">예정일 '+h(String(todo.due).slice(5,10))+' · '+Math.abs(todo.days)+'일 지남</span>':todo.days===0?'<span class="nc-today">오늘</span>':'<span class="nc-ok">'+todo.days+'일 남음</span>';
  const brief=[
   talk?['마지막 대화','“'+h(talk.text)+'” <small>'+h(talk.at)+'</small>',1]:null,
   needs?['고객 요구',h(needs),0]:null,
   quote?['마지막 견적',h(quote),0]:null,
  ].filter(Boolean).map(r=>'<div class="row"><span>'+r[0]+'</span><b class="'+(r[2]?'say':'')+'">'+r[1]+'</b></div>').join('');
  /* 단계·금액·브랜드·담당은 상세 헤더 한 줄에만(2026-09-26 중복 정리) — 이 카드는 '지금 할 일'만 */
  return '<section class="now-card" id="nowCard"><div class="nc-stage">지금 할 일</div>'
   +'<div class="nc-todo">'+(todo.promise?'<span class="nc-promise">🤝 고객 약속</span> ':'')+h(todo.text)+' '+dueTag+'</div>'
   +'<div class="nc-meta">'+(meta.meaningfulAt?'마지막 연락 '+h(String(meta.meaningfulAt).slice(0,10)):'연락 기록 없음')+'</div>'
   +'<div class="nc-cta"><button type="button" class="nc-call" onclick="NowCard.sheet()">📞 연락하고 결과 남기기</button><button type="button" onclick="dccGoActivity()">결과 남기기</button><button type="button" onclick="dccGoNext()">다른 날짜로</button>'+(todo&&!todo.suggested&&todo.due?'<button type="button" onclick="completeNextAction()">다음 할 일 완료</button>':'')+'</div>'
   +'<div class="nc-brief">'+brief+'</div></section>';
 }
 /* ── 결과 칩 시트 ── */
 let busy=false;
 function closeSheet(){if(!busy)document.getElementById('nc-sheet')?.remove();}
 function dateOptions(){
  const out=[],base=new Date();
  const fmt=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(x);
  const t=new Date(base);t.setDate(t.getDate()+1);out.push(['내일',fmt(t)]);
  const d3=new Date(base);d3.setDate(d3.getDate()+3);out.push(['3일 후',fmt(d3)]);
  const mon=new Date(base);mon.setDate(mon.getDate()+((8-mon.getDay())%7||7));out.push(['다음 주 월요일',fmt(mon)]);
  return out;
 }
 const CHIPS=[
  ['ongoing','통화함 · 진행 중','다음 확인일만 고르면 끝'],
  ['recall','다시 연락하기로 함','통화가 짧았거나 나중에 다시 걸기로 함'],
  ['absent','전화 안 받음','다시 걸 날짜만 고르면 끝'],
  ['promise','고객과 약속함','🤝 고객 약속으로 등록'],
  ['detail','자세히 기록 (견적·일정·종료 등)','기록 창이 열립니다']
 ];
 function sheet(){
  const cur=root.CUR_DETAIL;if(!cur||cur.kind!=='deal')return;
  closeSheet();const d=cur.item;
  const el=document.createElement('dialog');el.id='nc-sheet';el.className='nc-sheet';
  const phone=String(d.phone||d.contact_phone||d.contactPhone||'').trim();
  el.innerHTML='<form method="dialog"><h4>어떻게 됐나요? — '+h(d.site||'')+'</h4><p>'+(phone?'연락처 '+h(phone)+' · ':'')+'하나만 고르면 기록과 다음 할 일까지 자동으로 만듭니다</p>'
   +'<div class="nc-chips">'+CHIPS.map(c=>'<button type="button" data-chip="'+c[0]+'"><b>'+c[1]+'</b><small>'+c[2]+'</small></button>').join('')+'</div>'
   +'<div class="nc-step2" hidden><label class="nc-note-label" hidden>어떤 약속인가요? <input class="nc-note" placeholder="예: 금요일까지 견적 전달"></label>'
   +'<h5>언제 다시 확인할까요?</h5><div class="nc-dates">'+dateOptions().map(x=>'<button type="button" data-date="'+x[1]+'">'+x[0]+' <small>'+x[1].slice(5)+'</small></button>').join('')+'<label class="nc-pick">날짜 선택 <input type="date"></label></div></div>'
   +'<p class="nc-status" role="status" aria-live="polite"></p><footer><button type="button" data-close>닫기</button></footer></form>';
  document.body.append(el);
  const step2=el.querySelector('.nc-step2'),status=el.querySelector('.nc-status'),noteLabel=el.querySelector('.nc-note-label');
  let chip='';
  el.querySelector('[data-close]').onclick=()=>{if(!busy)el.close();};
  el.addEventListener('close',()=>el.remove(),{once:true});
  el.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  el.querySelectorAll('[data-chip]').forEach(b=>{b.onclick=()=>{
   chip=b.dataset.chip;
   if(chip==='detail'){el.close();root.dccGoActivity?.();return;}
   el.querySelectorAll('[data-chip]').forEach(x=>x.classList.toggle('on',x===b));
   noteLabel.hidden=chip!=='promise';step2.hidden=false;
   (chip==='promise'?noteLabel.querySelector('input'):step2.querySelector('[data-date]')).focus();
  };});
  const submit=due=>save(d,chip,due,el.querySelector('.nc-note').value.trim(),status,el);
  el.querySelectorAll('[data-date]').forEach(b=>{b.onclick=()=>submit(b.dataset.date);});
  el.querySelector('.nc-pick input').onchange=e=>{if(e.target.value)submit(e.target.value);};
  el.showModal();
 }
 async function save(d,chip,due,note,status,el){
  if(busy||!chip||!due)return;
  if(!root.Phase1?.queue||typeof root.queueDetailContactOperation!=='function'){status.textContent='로그인 상태에서만 저장할 수 있습니다.';return;}
  const promise=chip==='promise';
  if(promise&&!note){status.textContent='어떤 약속인지 한 줄만 적어주세요.';return;}
  /* 기록 문구(2026-09-26 문구 정리): 첫머리 '통화 완료 ·'=유효 접촉, '통화 시도 ·'·'부재중'=유효 접촉 아님 — isMeaningfulContact 분류와 맞춘다 */
  const noteText=chip==='ongoing'?'통화 완료 · 진행 중 ('+String(due).slice(5,10).replace('-','/')+' 다시 확인)':chip==='recall'?'통화 시도 · 다시 연락하기로 함':chip==='absent'?'부재중 (전화 안 받음)':'통화 완료 · 고객 약속: '+note;
  const nextText=promise?note:chip==='absent'?'다시 전화하기':'진행 상황 확인 전화';
  const assignee=root.repN(d.assignee)||root.repN(root.ME?.name)||'';
  const activity={type:'전화',note:noteText,result:'',occurred_at:new Date().toISOString()};
  const next={type:promise?'고객 약속':'전화',text:nextText,due_at:due,assignee};
  busy=true;el.querySelectorAll('button,input').forEach(n=>n.disabled=true);
  const progress=el._progress||(el._progress={});
  async function confirm(operation,payload,actionId){
   let id=progress[operation];
   if(id&&root.Phase1.queue.list().find(q=>q.request_id===id)?.status==='rejected'){delete progress[operation];id=null;}
   if(!id){id=root.queueDetailContactOperation(operation,{opportunity_id:d.id,...payload},actionId);progress[operation]=id;}
   await root.Phase1.queue.flush();const row=root.Phase1.queue.list().find(q=>q.request_id===id);
   if(row?.status!=='done'||row.ack?.ok!==true)throw Error(row?.error||'서버 확인 대기 중 — 다시 누르면 같은 요청을 확인합니다.');
   return row;
  }
  try{
   status.textContent='기록 확인 중…';
   /* 지금 할 일(서버 UUID)이 있으면 먼저 '완료'로 닫는다 — 기한 내 처리·약속 이행 집계의 근거(2026-09-26) */
   const cur=root.actionObj?root.actionObj(d,root.currentPatch?root.currentPatch():{}):null;
   if(cur&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(cur.id||''))&&!progress.completedAction){await confirm('next_action_complete',{},cur.id);progress.completedAction=cur.id;d.completed_actions=(Array.isArray(d.completed_actions)?d.completed_actions:[]).concat([{id:cur.id,type:cur.type,text:cur.text,due_at:cur.due_at||cur.due,status:'completed',completed_at:new Date().toISOString()}]);}
   const recorded=await confirm('activity',activity);
   d.activities=Array.isArray(d.activities)?d.activities:[];
   if(!d.activities.some(x=>x.id===recorded.ack.activity_id))d.activities.unshift({id:recorded.ack.activity_id,type:activity.type,note:activity.note,at:activity.occurred_at,occurred_at:activity.occurred_at});
   const scheduled=await confirm('next_action',next);
   const p=root.currentPatch(),obj={id:scheduled.ack.next_action_id,type:next.type,text:next.text,due:due,due_at:due,assignee:next.assignee,status:'open'};
   d.nextActionObj=p.nextActionObj=obj;d.nextAction=p.nextAction=due;d.nextActionText=p.nextActionText=next.text;
   root.saveLocal?.();
   status.textContent='✓ 기록 완료 · ✓ 다음 할 일 '+due+' 등록';
   busy=false;setTimeout(()=>{el.close();root.renderDetail?.();root.TodayWorkQueue?.render?.();},700);
  }catch(e){busy=false;el.querySelectorAll('button,input').forEach(n=>{n.disabled=false});status.textContent=String(e.message||e);}
 }
 /* 영업 흐름 한 줄(2026-09-25 컨설턴트 '행동의 연속성'): 단계가 아니라 '어떻게 여기까지 왔고 지금 움직이고 있는가'.
    유입→배정→첫 응대→연락 결과→단계 변경→지원 요청을 날짜순 칩으로, 7일 넘게 빈 구간은 '⏸ N일 공백'으로 끼워 넣는다.
    끝에는 흐름이 살아 있다는 증거 = 마지막 행동 + 결과 + 다음 할 일 + 날짜. 데이터는 기존 unifiedTimeline(연락·문의·배정·단계·사업 변경) 재사용. */
 function flowStrip(d,p){
  if(typeof root.unifiedTimeline!=='function')return '';
  let rows=[];try{rows=root.unifiedTimeline(p||{},d)||[];}catch(e){return '';}
  const gapN=Number(root.OPS_RULES?.stallDays??7),day=v=>String(v||'').slice(0,10),ts=v=>Date.parse(v||'');
  const ev=rows.filter(x=>x&&x.at&&Number.isFinite(ts(x.at))&&!/^[a-z0-9_]+$/.test(String(x.ttl||''))).slice().reverse();
  const kind=x=>{const t=String(x.ttl||''),b=String(x.body||'');
   if(/^\[지원 요청\]/.test(b))return ['🆘','지원 요청','sup'];
   if(/^\[지원 처리\]/.test(b))return ['✅','지원 처리','sup'];
   if(t==='견적문의 접수')return ['📥','문의 접수','in'];
   if(t==='담당자 배정')return ['👤','배정'+(x.who?' · '+x.who:''),'in'];
   if(t==='단계 전환'||t==='단계전환')return ['➜',b.replace(/^.*→\s*/,'')||'단계 변경','stage'];
   if(t==='사업유형 변경')return ['🔀','사업 전환','stage'];
   if(/부재/.test(t)||/^(부재|전화 부재|통화 시도 — 부재)/.test(b)||/^(부재|전화 안 받음)$/.test(String(x.result||'').trim()))return ['📵','안 받음','act'];
   if(/방문/.test(t))return ['🏠','방문','act'];
   if(/문자|메시지/.test(t))return ['💬','문자','act'];
   if(/메일/.test(t))return ['✉️','메일','act'];
   if(/전화|통화|call/i.test(t)||/^통화/.test(b))return ['📞','전화','act'];
   return ['•',t.length>10?t.slice(0,10)+'…':t||'기록','misc'];};
  /* 예전 기록 문구는 표시할 때만 새 용어로(저장값은 그대로). 첫머리 '통화 —'·'통화 시도 —'·'전화 부재 —'(예전)과 '통화 완료 ·'·'통화 시도 ·'·'부재중'(새) 모두 뗀다 */
  const short=v=>{v=say(v).replace(/^(통화( 시도)?|전화( 부재)?|부재)\s*—\s*/,'').replace(/^통화 (완료|시도)\s*·\s*/,'').replace(/^부재중\s*(\(전화 안 받음\))?\s*/,'').replace(/^(전화 안 받음|부재)$/,'').trim();return v.length>18?v.slice(0,18)+'…':v;};
  const chips=[];let prev=null,firstAct=null,start=null,lastSig='',rep=1;
  ev.forEach(x=>{
   const k=kind(x),t=ts(x.at);
   const sig=k[1]+'|'+(k[2]==='act'?short(x.result||x.body):'')+'|'+day(x.at);
   if(sig===lastSig&&chips.length){rep++;chips[chips.length-1]=chips[chips.length-1].replace(/<u class="nf-x">×\d+<\/u>|(?=<\/span>$)/,'<u class="nf-x">×'+rep+'</u>');prev=t;return;}
   lastSig=sig;rep=1;
   if(k[2]==='in'&&start===null)start=t;
   if(k[2]==='act'&&firstAct===null)firstAct=t;
   if(prev!==null){const g=Math.floor((t-prev)/864e5);if(g>gapN)chips.push('<span class="nf-gap'+(g>gapN*2?' hot':'')+'">⏸ '+g+'일 공백</span>');}
   const tail=k[2]==='act'?short(x.result||x.body):'';
   chips.push('<span class="nf-ev '+k[2]+'" title="'+attr((x.ttl||'')+' · '+say(x.body||'')+(x.result?' · '+say(x.result):''))+'"><i>'+k[0]+'</i><b>'+h(k[1])+'</b>'+(tail?'<em>'+h(tail)+'</em>':'')+'<small>'+h(day(x.at).slice(5).replace('-','/'))+'</small></span>');
   prev=t;
  });
  const hidden=Math.max(0,chips.length-12),shown=chips.slice(-12);
  const a=root.actionObj?root.actionObj(d,p):null,due=a&&a.due?dueDays(a.due):null;
  /* 다음 할 일 내용은 위 '지금 할 일' 카드에 — 흐름 끝에는 날짜만 작게 */
  const nextChip=a&&a.text&&due!==null?'<span class="nf-next'+(due<0?' late':'')+'" title="'+attr(say(a.text))+'"><i>📅</i><b>다음</b><small>'+h(String(a.due).slice(5,10).replace('-','/'))+(due<0?' · '+(-due)+'일 지남':'')+'</small></span>':'<span class="nf-next none"><i>⚠</i><b>다음 할 일 없음</b></span>';
  const idle=prev!==null?Math.floor((Date.now()-prev)/864e5):null;
  if(idle!==null&&idle>gapN&&!(a&&a.text&&due!==null&&due>=0))shown.push('<span class="nf-gap'+(idle>gapN*2?' hot':'')+'">⏸ 오늘까지 '+idle+'일</span>');
  const lastAct=ev.filter(x=>kind(x)[2]==='act').slice(-1)[0];
  const firstResp=start!==null&&firstAct!==null&&firstAct>=start?Math.round((firstAct-start)/36e5):null;
  /* 마지막 행동·다음 날짜는 아래 칩이 그대로 보여 준다 — 머리글은 칩에 없는 '첫 연락까지 걸린 시간'만 */
  const summary=lastAct?(firstResp!==null?'첫 연락까지 '+(firstResp<24?firstResp+'시간':Math.round(firstResp/24)+'일'):''):'<b class="warn">연락 기록 없음</b>';
  if(!ev.length)return '<section class="now-flow" id="nowFlow"><header><b>영업 흐름</b><span>아직 기록된 흐름이 없습니다 — 첫 연락 결과부터 이어집니다</span></header><div class="nf-row">'+nextChip+'</div></section>';
  return '<section class="now-flow" id="nowFlow"><header><b>영업 흐름</b><span>'+summary+'</span></header><div class="nf-row">'+(hidden?'<span class="nf-more">이전 '+hidden+'건</span>':'')+shown.join('<i class="nf-arr">›</i>')+'<i class="nf-arr">›</i>'+nextChip+'</div></section>';
 }
 let jIO=null;
 function journeyWatch(){
  try{
   if(!('IntersectionObserver' in window))return void document.querySelectorAll('.dcc-journey').forEach(x=>x.classList.add('dcc-animate'));
   if(!jIO)jIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('dcc-animate');jIO.unobserve(e.target)}}),{threshold:.35});
   document.querySelectorAll('.dcc-journey:not(.dcc-animate)').forEach(x=>jIO.observe(x));
  }catch(e){}
 }
 function inject(){
  try{
   if(root.CUR_DETAIL?.kind!=='deal')return;
   const body=document.getElementById('dv-body');if(!body)return;
   if(document.getElementById('nowCard'))return;
   const html=card();
   /* 작업 바가 헤더로 올라갔으므로(2026-09-24) 카드는 항상 본문 맨 앞 */
   body.insertAdjacentHTML('afterbegin',html);
   try{const cur=root.CUR_DETAIL,f=flowStrip(cur.item,root.currentPatch?root.currentPatch():{});if(f&&!document.getElementById('nowFlow'))document.getElementById('nowCard')?.insertAdjacentHTML('afterend',f);const nfRow=document.querySelector('#nowFlow .nf-row');if(nfRow)nfRow.scrollLeft=nfRow.scrollWidth;}catch(e){}
   /* 상단 지금 할 일 카드와 중앙 «지금 해야 할 일» 카드가 같은 내용 이중 표기 — 중앙 카드는 접는다 (2026-09-24 캡처 지적) */
   const dup=document.getElementById('dw-now');if(dup)dup.hidden=true;
   journeyWatch();
  }catch(e){}
 }
 const oldDetail=root.dccDecorateDetail;
 if(typeof oldDetail==='function')root.dccDecorateDetail=function(){const r=oldDetail.apply(this,arguments);inject();return r;};
 /* 와이드 상세는 DetailActions.decorate가 마지막 변환 — 그 직후에 카드가 최상단(빠른 작업 바 위)으로 들어간다. */
 if(root.DetailActions&&typeof root.DetailActions.decorate==='function'){
  /* 원래 객체를 그대로 쓴다(2026-09-26): 복사(Object.assign)하면 '지금 열린 작업'(active 게터)이 복사 순간 값 null로 굳어,
     진행상태 변경의 취소·닫기가 작업 창을 닫지 못하고 빈 창이 남았다. */
  const da=root.DetailActions,oldDec=da.decorate;
  da.decorate=function(){const r=oldDec.apply(da,arguments);inject();return r;};
 }
 root.addEventListener('phase1:identity-cleared',closeSheet);
 root.NowCard={sheet,card,flowStrip};
})(window);
