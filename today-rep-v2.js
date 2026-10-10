/* 오늘 업무 · 영업사원 화면 v2 (2026-10-02 디자인 핸드오프 'design_handoff_today_inquiry' 추가 · 2a)
   영업사원으로 열었을 때만: ① 급한 곳 머리줄 → ② 급한 곳 카드(처음 4장 · 더보기) → ③ 나머지 묶음 표. 관리자 화면은 그대로.
   목록 · 우선순위 · 열기는 기존 TodayWorkQueue(data · open)를 그대로 쓴다. 급한 이유 · 놓치면 · 목표는 기존 기한 · 약속 · 입찰일로 계산한다.
   ※ 통화 첫마디 · 원한 것 요약 · 지난 기록 요약은 Claude API 연결 전이라 실제 기록 값을 그대로 보여 주고, 첫마디는 그 값으로 만든 틀 문장이다.
   ※ 연락 결과 저장은 서버 규칙상 그 건의 상세가 열려 있어야 한다 — 결과를 고르면 상세가 결과 문구가 채워진 채 열리고, [저장]을 누르면 기존 경로로 저장된다.
      저장되면 목록이 다시 그려지면서 카드가 빠지고 다음 급한 곳이 올라온다.
   끄기: G.todayRepV2Off=true → 이전 영업사원 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const T=()=>root.TodayWorkQueue;
 const enabled=()=>!root.G.todayRepV2Off;
 const st=()=>root.G.todayRep||(root.G.todayRep={more:false,open:''});
 const TONE={r:['#e5484d','#f3d3d1','#c93a3f','늦음'],b:['#3b6ce4','#d9e2f7','#2a52b8','오늘 약속'],a:['#f5a524','#f6e3bd','#c0392b','마감 임박']};
 const RESULTS=[['실사 잡음','통화 완료 — 현장 실사 일정 잡음'],['견적 요청','통화 완료 — 견적 요청 받음'],['나중에 다시','통화 완료 — 나중에 다시 연락하기로 함'],['안 받음','전화 — 받지 않음'],['번호 틀림','전화 — 번호가 맞지 않음'],['관심 없음','통화 완료 — 관심 없음']];
 const STEPS=['문의','설계','자료','경쟁','계약'];
 const dayN=hours=>Number.isFinite(hours)&&hours>0?Math.max(1,Math.floor(hours/24)):0;
 const money=n=>{n=Number(n)||0;return n?root.fmtAmt(n):'';};
 const cut=(v,n)=>{v=String(v||'').replace(/\s+/g,' ').trim();return v.length>n?v.slice(0,n-1)+'…':v;};
 function bidDays(x){if(x.type!=='deal')return null;const c=x.item.stage_contexts||{};let d=null;Object.values(c).forEach(v=>{const b=v&&v.fields&&v.fields.bid_deadline;if(b){const n=root.daysTo(String(b).slice(0,10));if(Number.isFinite(n)&&(d===null||n<d))d=n;}});return d;}
 /* 급한 이유(색) — 빨강: 늦음 · 파랑: 오늘 약속 · 주황: 마감 임박. 급하지 않으면 null */
 function timeOf(x){try{const act=x.type==='deal'?root.actionObj(x.item,root.itemPatch(x.item,'deal')):null,v=String(act&&(act.scheduled_at||act.scheduledAt||act.due_at||act.due)||''),m=/T(\d{2}):(\d{2})/.exec(v);if(!m||(m[1]==='00'&&m[2]==='00'))return '';if(/Z|[+-]\d{2}:\d{2}$/.test(v)){const d=new Date(v);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}return m[1]+':'+m[2];}catch(e){return '';}}
 function urgency(x){
  if(x.unassigned)return null;
  const n=dayN(x.lag);
  if(x.responseLate)return {tone:'r',rank:0,why:'첫 연락 '+(n?n+'일 ':'')+'늦음',miss:'첫 연락 기준을 넘긴 채로 '+(n?n+'일째입니다':'있습니다')};
  if(x.dueDays===0){const tm=timeOf(x);return {tone:'b',rank:x.promise||tm?1:5,time:tm,why:'오늘 '+(tm?tm+' ':'')+(x.promise||tm?'약속':'예정'),miss:'오늘 잡은 일정이 내일로 밀립니다'};}
  const bd=bidDays(x);if(bd!==null&&bd>=0&&bd<=7)return {tone:'a',rank:2,why:'입찰 마감 D-'+bd,miss:'입찰 마감까지 '+bd+'일 남았습니다'};
  if(x.overdue||(x.promise&&x.dueDays!==null&&x.dueDays<0)){const d=x.dueDays!==null&&x.dueDays<0?Math.abs(x.dueDays):n,what=/견적/.test(String(x.next||''))?'견적 회신':x.promise?'약속':'후속 기한';return {tone:'r',rank:x.promise?1:3,why:what+' '+(d?d+'일 ':'')+'지남',miss:(x.promise?'고객과 한 약속':'정해 둔 기한')+'을 넘긴 날이 하루 더 늘어납니다'};}
  if(x.processingLate)return {tone:'r',rank:4,why:'후속 연락 '+(n?n+'일 ':'')+'늦음',miss:'다음 연락이 밀린 채로 '+(n?n+'일째입니다':'있습니다')};
  return null;
 }
 const order={r:0,b:1,a:2};
 let UPCOMING=new Map();
 function upcoming(rows,deals){
  const have=new Set(rows.map(x=>x.key)),out=[];UPCOMING=new Map();
  (deals||[]).forEach(d=>{let key,a,n;try{key='deal:'+root.dealKey(d);if(have.has(key)||!root.isOpen(d))return;a=root.actionObj(d,root.itemPatch(d,'deal'));n=a&&a.due?root.daysTo(String(a.due).slice(0,10)):null;}catch(e){return;}
   if(!a||!Number.isFinite(n)||n<1||n>7)return;const x={key,type:'deal',kind:'pipeline',panel:'pipeline',item:d,owner:root.repN(d.assignee),stage:root.stageLabel(root.dealStage(d)),next:a.text||'',recent:(()=>{try{return root.todayRecent(d,'deal');}catch(e){return '';}})(),dueDays:n,lag:0,upcoming:true};UPCOMING.set(key,x);out.push(x);});
  return out.sort((a,b)=>a.dueDays-b.dueDays||String(a.key).localeCompare(String(b.key)));
 }
 const openKey=(key,action)=>{const u=UPCOMING.get(key);if(u){root.G._detailPopup=true;root.drwDeal(JSON.stringify(u.item));if(action==='contact'&&typeof root.dccGoActivity==='function')root.dccGoActivity();return;}return T().open(key,action);};
 function split(rows){
  const urgent=[],rest=[];rows.forEach(x=>{const u=urgency(x);if(u)urgent.push(Object.assign({x},u));else if(!x.unassigned)rest.push(x);});
  urgent.sort((p,q)=>p.rank-q.rank||String(p.time||'99').localeCompare(String(q.time||'99'))||(q.x.lag||0)-(p.x.lag||0)||String(p.x.key).localeCompare(String(q.x.key)));
  return {urgent,rest};
 }
 function info(x){
  const inq=x.type==='inq',it=x.item;let name='',role='',phone='';
  if(inq){name=it.contact_name||it.customer_name||it.contact||'';phone=it.phone||it.contact_phone||it.mobile||'';}
  else{try{const c=root.contactInfo(it,root.itemPatch(it,'deal'))||{};name=c.name||c.managerName||'';role=c.role||'';phone=c.mobile||c.officeTel||it.office_phone||'';}catch(e){}}
  const src=String(it.channel||it.source||it.inflow||it.inflow_channel||'');
  const chip=inq?(/홈페이지|web|site/i.test(src)?'홈페이지 문의':/전화|call|tel/i.test(src)?'전화 문의':/메일|mail/i.test(src)?'메일 문의':'견적문의'):x.kind==='relationship'?'관계관리':x.kind==='expansion'?'확장관리':'파이프라인';
  let code='';try{code=inq?'':root.dealStage(it);}catch(e){}
  const step=inq?0:['first_contact','consulting'].includes(code)?1:['sent','rapport','silent','waiting'].includes(code)?2:['compete','imminent','bidding'].includes(code)?3:['contract','construction','completion'].includes(code)?4:1;
  let want='';try{want=inq?(it.memo||it.content||it.request||it.message||root.inqCtlWorkLabel?.(it)||''):(root.dealWorkSummary(it)||'');}catch(e){}
  if(/미분류|미기록|미입력/.test(want))want='';
  let amt=0;try{amt=inq?0:Number(root.oppAmt(it))||0;}catch(e){}
  const digits=String(phone||'').replace(/\D/g,'');
  const short=inq?'문의':code==='bidding'?'입찰':['compete','imminent'].includes(code)?'경쟁':code==='sent'?'자료':['rapport','silent','waiting'].includes(code)?'관계':['contract','construction','completion'].includes(code)?'계약':'설계';
  return {site:it.site||it.site_name||'현장명 미입력',name,role,phone:digits?root.phoneFmt(digits):'',digits,chip,step,stage:short,want:cut(want,60),recent:cut(x.recent||'',60),goal:cut(x.next||'',60),amt};
 }
 const AIO=new Map(),AIB=new Set();/* key → {opener,goal,summary} */
 function opener(x,i){const a=AIO.get(x.key);if(a&&a.opener)return a.opener;const me=root.ME&&root.ME.name||'';const topic=cut(x.type==='inq'?(i.want||'견적'):(i.goal||i.want||''),26);return '안녕하세요, 넷폼 '+me+'입니다. '+(x.type==='inq'?'문의 주신 '+topic+' 건으로 연락드렸습니다.':(topic?topic+' 건으로 ':'')+'연락드렸습니다.')+' 지금 통화 괜찮으실까요?';}
 function cardHtml(u,n,open){
  const x=u.x,i=info(x),c=TONE[u.tone],k=attr(x.key);
  const bar='<div class="trv-steps" aria-label="단계 '+h(i.stage)+'">'+STEPS.map((s,j)=>'<i style="background:'+(j<i.step?'#9db4ee':j===i.step?c[0]:'#e6e9ee')+'" title="'+s+'"></i>').join('')+'</div>';
  return '<article class="trv-card" data-key="'+k+'" data-tone="'+u.tone+'" style="--c:'+c[0]+';--bd:'+c[1]+';--t:'+c[2]+';animation-delay:'+(Math.min(n,5)*0.12)+'s">'
   +'<header><i class="trv-no">'+(n+1)+'</i><b class="trv-why">'+h(u.why)+'</b><span class="trv-chip">'+h(i.chip)+'</span></header>'
   +'<div class="trv-who"><strong title="'+attr(i.site)+'">'+h(i.site)+'</strong><span>'+h([i.name,i.role,i.phone].filter(Boolean).join(' · ')||'연락처 미입력')+'</span></div>'
   +'<div class="trv-stage">'+bar+'<span>'+h(i.stage)+'</span>'+(i.amt?'<b>'+h(money(i.amt))+'</b>':'')+'</div>'
   +'<dl class="trv-facts"><dt>원한 것</dt><dd>'+h(i.want||'기록 없음')+'</dd><dt>지난 기록</dt><dd>'+h((AIO.get(x.key)||{}).summary||i.recent||(root.ContactState?root.ContactState.NONE:'CRM 연락 기록 없음'))+'</dd><dt>목표</dt><dd class="goal">'+h((AIO.get(x.key)||{}).goal||i.goal||'다음 할 일 정하기')+'</dd></dl>'
   +'<p class="trv-opener">“'+h(opener(x,i))+'”'+(root.OpsStore&&root.OpsStore.aiOn()&&!AIO.has(x.key)?' <button type="button" class="trv-ai" data-trv="ai" data-key="'+k+'"'+(AIB.has(x.key)?' disabled':'')+'>'+(AIB.has(x.key)?'AI…':'✦ AI 첫마디')+'</button>':AIO.has(x.key)?' <em class="trv-aitag">AI</em>':'')+'</p>'
   +'<p class="trv-miss"><b>놓치면</b> '+h(u.miss)+'</p>'
   +'<div class="trv-btns"><button type="button" class="call" data-trv="call" data-key="'+k+'"'+(i.digits?' data-tel="'+attr(i.digits)+'"':'')+'>전화</button><button type="button" data-trv="sms" data-key="'+k+'">문자</button><button type="button" data-trv="result" data-key="'+k+'" aria-expanded="'+open+'">결과</button></div>'
   +(open?'<div class="trv-results" role="group" aria-label="연락 결과">'+RESULTS.map((r,j)=>'<button type="button" data-trv="pick" data-key="'+k+'" data-value="'+j+'">'+r[0]+'</button>').join('')+'<small>고르면 이 건의 상세가 결과가 채워진 채 열립니다 — 확인하고 [저장]</small></div>':'')
   +'</article>';
 }
 function rowHtml(x,tone){
  const i=info(x),tm=tone==='b'?timeOf(x):'',age=tm?tm:x.dueDays!==null&&x.dueDays!==undefined&&x.dueDays>=0?(x.dueDays===0?'오늘':x.dueDays===1?'내일':x.dueDays+'일 뒤'):(dayN(x.lag)?dayN(x.lag)+'일':'–'),k=attr(x.key);
  return '<div class="trv-row" role="button" tabindex="0" data-trv="open" data-key="'+k+'"><div class="c"><b title="'+attr(i.site)+'">'+h(i.site)+'</b><span>'+h([i.name,i.role].filter(Boolean).join(' ')||i.phone||'연락처 미입력')+'</span></div><span class="want">'+h(i.want||i.goal||'–')+'</span><span>'+h(i.stage)+'</span><span class="amt">'+h(i.amt?money(i.amt):'–')+'</span><span class="age '+tone+'">'+h(age)+'</span>'
   +'<button type="button" class="trv-call" data-trv="rowcall" data-key="'+k+'"'+(i.digits?' data-tel="'+attr(i.digits)+'"':'')+'>전화</button></div>';
 }
 function html(rows,deals){
  rows=rows.concat(upcoming(rows,deals));
  const S=st(),sp=split(rows),U=sp.urgent,n=t=>U.filter(u=>u.tone===t).length,shown=U.slice(0,4),hidden=U.slice(shown.length);/* 쪽 번호 지침(2026-10-05): 카드는 4장까지만 — 나머지는 아래 묶음 표(쪽 번호)로 */
  const head='<div class="trv-head"><b>급한 곳 '+U.length+'</b>'+['r','b','a'].map(t=>'<span style="color:'+TONE[t][2]+'"><i style="background:'+TONE[t][0]+'"></i>'+TONE[t][3]+' '+n(t)+'</span>').join('')+'<span class="trv-sp"></span>'+''+'</div>';
  const cards=U.length?'<div class="trv-grid">'+shown.map((u,i)=>cardHtml(u,i,S.open===u.x.key)).join('')+'</div>':'<div class="trv-calm"><b>지금 급한 곳이 없습니다</b><span>'+(sp.rest.length?'아래 예정된 곳을 순서대로 챙기면 됩니다.':'새 문의가 배정되거나 기한이 다가오면 여기에 먼저 나옵니다.')+'</span></div>';
  /* 나머지: 카드에 안 들어간 곳 — 늦음 → 오늘 약속 → 내일 · 이번 주. 빈 묶음은 숨긴다 */
  const first=hidden.filter(u=>u.tone==='r'&&u.rank===0).map(u=>u.x),late=hidden.filter(u=>u.tone==='r'&&u.rank!==0).map(u=>u.x),today=hidden.filter(u=>u.tone==='b').map(u=>u.x),later=hidden.filter(u=>u.tone==='a').map(u=>u.x).concat(sp.rest);
  const groups=[['r','첫 연락 늦음','#fbf3f3','#c93a3f',first,'위 카드 다음 순서'],['r','기한 지남','#fbf3f3','#c93a3f',late,'늦은 순서대로'],['b','오늘 약속','#f3f6fd','#2a52b8',today,'약속한 시간에 다시 연락'],['m','내일 · 이번 주','#f6f7f9','#6b7280',later,'미리 준비']].filter(g=>g[4].length);
  try{if(root.G.page==='today'&&!root.todayIsAdmin()){const p=document.getElementById('psub'),nm=String(root.ME&&root.ME.name||'');root.G.todayRepSub=nm+'님 · 오늘 '+rows.filter(x=>!x.unassigned).length+'곳'+(U.length?' · 급한 '+U.length+'곳부터':'');if(p)p.textContent=root.G.todayRepSub;}}catch(e){}
  const table=groups.length?'<section class="trv-table" aria-label="나머지 할 곳"><div class="trv-thead"><span>현장 · 고객</span><span>고객이 원한 것</span><span>단계</span><span>금액</span><span>경과</span><span></span></div>'+groups.map(g=>'<div class="trv-ghead" style="background:'+g[2]+'"><b style="color:'+g[3]+'">'+g[1]+' '+g[4].length+'</b><span>· '+g[5]+'</span></div>'+g[4].slice(0,S.limit||30).map(x=>rowHtml(x,g[0])).join('')).join('')+'</section>':'';
  return '<div class="trv" data-urgent="'+U.length+'">'+head+cards+table+'</div>';
 }
 function prefill(text){
  let tries=0;const tick=()=>{const ta=document.querySelector('#detailView.on .idv-input textarea, .inq-dialog .idv-input textarea, dialog[open] .idv-input textarea');if(!ta){if(++tries<25)setTimeout(tick,120);return;}
   const callTab=document.querySelector('dialog[open] [data-idv="tab"][data-v="call"][aria-selected="false"], .inq-dialog [data-idv="tab"][data-v="call"][aria-selected="false"]');if(callTab&&!ta.dataset.trvTab){callTab.click();setTimeout(()=>{const t2=document.querySelector('dialog[open] .idv-input textarea, .inq-dialog .idv-input textarea');if(t2){t2.dataset.trvTab='1';fill(t2);}},150);return;}
   fill(ta);};
  const fill=ta=>{ta.value=text;ta.dispatchEvent(new Event('input',{bubbles:true}));ta.focus();if(typeof root.toast==='function')root.toast('결과를 채웠습니다 — 확인하고 [저장]을 눌러 주세요');};
  setTimeout(tick,250);
 }
 function dial(digits){if(!digits){if(typeof root.toast==='function')root.toast('전화번호가 없습니다 — 상세에서 연락처를 등록해 주세요','warn');return false;}const a=document.createElement('a');a.href='tel:'+digits;a.style.display='none';document.body.append(a);a.click();a.remove();return true;}
 function onClick(e){
  const b=e.target.closest('#today-v2 .trv [data-trv]');if(!b)return;e.stopPropagation();const S=st(),a=b.dataset.trv,key=b.dataset.key;
  if(a==='more'){S.more=!S.more;return root.TodayV2.render();}
  if(a==='ai'){if(AIB.has(key))return;const X=T().data(),x=X.rows.find(r=>r.key===key)||UPCOMING.get(key);if(!x)return;const i=info(x);AIB.add(key);root.TodayV2.render();
   root.OpsStore.ai('call_opener',x.type==='inq'?'inquiry':'deal',x.item.id||key,{caller:root.ME&&root.ME.name||'',company:'넷폼',site:i.site,contact:[i.name,i.role].filter(Boolean).join(' '),stage:i.stage,want:i.want,recent:x.recent||'',goal:x.next||''}).then(s=>{AIO.set(key,s.suggestion||{});}).catch(e=>{if(typeof root.toast==='function')root.toast(String(e.message||e),'warn');}).finally(()=>{AIB.delete(key);root.TodayV2.render();});return;}
  /* 2026-10-10 no_inline_expand: 카드 아래 결과 칩 펼침 없음 — [결과] · [전화] = 그 건의 상세 창(연락 입력). 되돌리기 G.rowInlineKeep */
  if(a==='result'){if(!(root.G&&root.G.rowInlineKeep))return openKey(key,'contact');S.open=S.open===key?'':key;return root.TodayV2.render();}
  if(a==='call'){dial(b.dataset.tel);if(!(root.G&&root.G.rowInlineKeep))return openKey(key,'contact');S.open=key;return root.TodayV2.render();}
  if(a==='rowcall'){dial(b.dataset.tel);return openKey(key,'contact');}
  if(a==='pick'){const r=RESULTS[Number(b.dataset.value)];S.open='';openKey(key,'contact');if(r)prefill(r[1]);return;}
  if(a==='sms'){openKey(key);setTimeout(()=>{const tab=document.querySelector('dialog[open] [data-idv="tab"][data-v="sms"], .inq-dialog [data-idv="tab"][data-v="sms"]');if(tab)tab.click();else if(root.InquiryDetailV2&&root.InquiryDetailV2.openSms&&root.InquiryDetailV2.openSms()){/* 문의 = 상세의 문자 작은 창 */}else if(root.CUR_DETAIL&&root.CUR_DETAIL.kind==='deal'&&typeof root.contactSms==='function')root.contactSms();},400);return;}
  if(a==='open'&&!e.target.closest('button'))return openKey(key);
 }
 document.addEventListener('click',onClick,true);
 document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#today-v2 .trv-row')){e.preventDefault();openKey(e.target.dataset.key);}});
 root.TodayRepV2={enabled,html,urgency,split,upcoming};
})(window);
