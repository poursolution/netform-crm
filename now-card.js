/* 지금 할 일 카드 + 통화 결과 칩 플로우 (2026-09-25 영업사원 CX 개편 1차).
   원칙: 상세를 열면 "지금 할 일"이 가장 먼저, 가장 크게. 결과는 칩 하나로 —
   시스템이 연락 결과과 다음 할 일을 기존 검증된 큐 경로로 대신 만든다.
   단계가 바뀌는 결과(견적·입찰·종료 등)는 기존 기록/전환 창으로 보낸다(자동 전이 금지). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v??'')),attr=v=>root.escAttr(String(v??''));
 const DEFAULT_TODO={first_contact:'고객에게 연락하고 니즈를 확인해 주세요',consulting:'견적 요청 내용을 확인하고 회신해 주세요',sent:'보낸 자료의 검토 여부를 확인해 주세요',rapport:'유대 유지 연락을 해주세요',silent:'재접촉 연락을 해주세요',waiting:'재개 시점을 확인해 주세요',compete:'경쟁 상황과 다음 일정을 확인해 주세요',imminent:'계약 조건을 확인해 주세요',bidding:'입찰 일정을 확인해 주세요',contract:'계약 체결 상태를 확인해 주세요',construction:'착공 준비 상황을 확인해 주세요',completion:'준공·수금 상태를 확인해 주세요'};
 function money(n){n=Number(n)||0;if(!n)return '';return n>=1e8?(Math.round(n/1e7)/10)+'억':Math.round(n/1e4).toLocaleString('ko-KR')+'만'}
 function dueDays(v){if(!v||!Number.isFinite(Date.parse(v)))return null;const n=root.daysTo(v);return Number.isFinite(n)?n:null}
 function lastTalk(d,p){
  const rows=[...(d.activities||[]),...((p&&p.activities)||[])].filter(x=>x&&(x.note||x.result));
  rows.sort((a,b)=>String(b.at||b.occurred_at||'').localeCompare(String(a.at||a.occurred_at||'')));
  const x=rows[0];if(!x)return null;
  return {text:String(x.note||x.result).slice(0,80),at:(x.at||x.occurred_at||'').slice(0,10)};
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
  if(a&&a.text)return {text:a.text,due:a.due||'',days:due,suggested:false,promise:/약속/.test(String(a.type||''))};
  return {text:DEFAULT_TODO[root.dealStage(d)]||'고객에게 연락하고 진행 상황을 확인해 주세요',due:'',days:null,suggested:true,promise:false};
 }
 function card(){
  const cur=root.CUR_DETAIL;if(!cur||cur.kind!=='deal')return '';
  const d=cur.item,p=root.currentPatch?root.currentPatch():{};
  const todo=todoOf(d,p),meta=root.relationshipMeta?root.relationshipMeta(d):{},talk=lastTalk(d,p),needs=needsOf(d),quote=lastQuote(d);
  const dueTag=todo.days===null?(todo.suggested?'<span class="nc-sug">추천 할 일</span>':'<span class="nc-warn">기한 미입력</span>'):todo.days<0?'<span class="nc-late">예정일 '+h(String(todo.due).slice(5,10))+' · '+Math.abs(todo.days)+'일 지남</span>':todo.days===0?'<span class="nc-today">오늘</span>':'<span class="nc-ok">D-'+todo.days+'</span>';
  const brief=[
   talk?['마지막 대화','“'+h(talk.text)+'” <small>'+h(talk.at)+'</small>',1]:null,
   needs?['고객 요구',h(needs),0]:null,
   quote?['마지막 견적',h(quote),0]:null,
   ['오늘 확인',h(todo.text),0]
  ].filter(Boolean).map(r=>'<div class="row"><span>'+r[0]+'</span><b class="'+(r[2]?'say':'')+'">'+r[1]+'</b></div>').join('');
  return '<section class="now-card" id="nowCard"><div class="nc-stage">'+h(root.stageLabel(root.dealStage(d)))+(root.oppAmt(d)>0?' · 예상 '+money(root.oppAmt(d)):'')+' · '+h(d.brand||root.bizOf?.(d)||'')+'</div>'
   +'<div class="nc-todo">'+(todo.promise?'<span class="nc-promise">🔴 고객 약속</span> ':'')+h(todo.text)+' '+dueTag+'</div>'
   +'<div class="nc-meta">'+h(root.repN(d.assignee)||'담당 미지정')+(meta.meaningfulAt?' · 마지막 연락 '+h(String(meta.meaningfulAt).slice(0,10)):' · 연락 기록 없음')+'</div>'
   +'<div class="nc-cta"><button type="button" class="nc-call" onclick="NowCard.sheet()">📞 연락하고 결과 남기기</button><button type="button" onclick="dccGoActivity()">결과 남기기</button><button type="button" onclick="dccGoNext()">다른 날짜로</button></div>'
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
  ['ongoing','진행 중이에요','다음 확인일만 고르면 끝'],
  ['recall','다시 연락해야 해요','통화 못 했거나 다시 걸기로 함'],
  ['absent','부재 · 못 받으심','재시도 일정 자동 등록'],
  ['promise','~하기로 약속했어요','🔴 고객 약속으로 등록'],
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
  const noteText=chip==='ongoing'?'통화 — 진행 중, '+due+' 다시 확인':chip==='recall'?'통화 시도 — 다시 연락하기로 함':chip==='absent'?'통화 시도 — 부재':'통화 — 고객 약속: '+note;
  const nextText=promise?note:chip==='absent'?'재시도 전화':'진행 상황 확인 연락';
  const assignee=root.repN(d.assignee)||root.repN(root.ME?.name)||'';
  const activity={type:'전화',note:noteText,result:'',occurred_at:new Date().toISOString()};
  const next={type:promise?'고객 약속':'전화',text:nextText,due_at:due,assignee};
  busy=true;el.querySelectorAll('button,input').forEach(n=>n.disabled=true);
  const progress=el._progress||(el._progress={});
  async function confirm(operation,payload){
   let id=progress[operation];
   if(id&&root.Phase1.queue.list().find(q=>q.request_id===id)?.status==='rejected'){delete progress[operation];id=null;}
   if(!id){id=root.queueDetailContactOperation(operation,{opportunity_id:d.id,...payload});progress[operation]=id;}
   await root.Phase1.queue.flush();const row=root.Phase1.queue.list().find(q=>q.request_id===id);
   if(row?.status!=='done'||row.ack?.ok!==true)throw Error(row?.error||'서버 확인 대기 중 — 다시 누르면 같은 요청을 확인합니다.');
   return row;
  }
  try{
   status.textContent='기록 확인 중…';
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
 function inject(){
  try{
   if(root.CUR_DETAIL?.kind!=='deal')return;
   const body=document.getElementById('dv-body');if(!body)return;
   if(document.getElementById('nowCard'))return;
   const bar=document.getElementById('detailView')?.querySelector('.da-toolbar');
   const html=card();
   if(bar)bar.insertAdjacentHTML('beforebegin',html);else body.insertAdjacentHTML('afterbegin',html);
  }catch(e){}
 }
 const oldDetail=root.dccDecorateDetail;
 if(typeof oldDetail==='function')root.dccDecorateDetail=function(){const r=oldDetail.apply(this,arguments);inject();return r;};
 /* 와이드 상세는 DetailActions.decorate가 마지막 변환 — 그 직후에 카드가 최상단(빠른 작업 바 위)으로 들어간다. */
 if(root.DetailActions&&typeof root.DetailActions.decorate==='function'){
  const da=root.DetailActions,oldDec=da.decorate;
  root.DetailActions=Object.assign({},da,{decorate:function(){const r=oldDec.apply(da,arguments);inject();return r;}});
 }
 root.addEventListener('phase1:identity-cleared',closeSheet);
 root.NowCard={sheet,card};
})(window);
