/* CRM에게 묻기 v2 (2026-10-02 디자인 핸드오프 'design_handoff_shell' 5) — 읽기 전용. 데이터는 고치지 않는다.
   질문 → 검색 조건(칩)으로 바꿔 실제 CRM 영업건만 보여 준다. 조건 칩의 ✕를 누르면 그 조건을 빼고 바로 다시 찾는다.
   조건 판정은 기존 '읽기 전용 질의'와 같은 함수(relationshipMeta · actionObj · quoteAmt · siteContacts · dealStage)를 쓴다.
   ※ 질문을 조건으로 바꾸는 부분은 지금은 규칙(문장 패턴)이다. Claude API(서버 함수) 연결 뒤에는 parse()만 바꿔 끼운다 — 조건 구조는 그대로.
   결과 아래: [모두 보기] · [이 묶음에 문자](문자 보내기 창, 대상 = 이 결과 · 기존 검수·발송 경로) · [과제로 등록](과제 등록 창)
   끄기: G.askV2Off=true → 예전 창. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const enabled=()=>!root.G.askV2Off;
 const TOP=8;
 const FAQ=['이필선 담당 중 30일 넘게 연락 안 한 곳','오늘 전화해야 하는 곳','1억 넘는데 다음 할 일 없는 곳','견적 보내고 2주 넘게 멈춘 곳','소장 번호 없는 아파트'];
 const next=d=>{const a=root.actionObj(d,root.itemPatch(d,'deal'));return a&&a.status!=='completed'?a:null;};
 const days=d=>{const m=root.relationshipMeta(d);return m.days==null?null:m.days;};
 const money=d=>Math.max(Number(root.oppAmt(d))||0,Number(root.quoteAmt(d))||0);
 /* 조건 종류: 이름표와 판정. 값(v)이 있는 조건은 이름표에 함께 적는다 */
 const KIND={
  open:{label:()=>'진행 중',test:d=>root.isOpen(d)},
  owner:{label:c=>'담당 '+c.v,test:(d,c)=>root.repN(d.assignee)===c.v},
  noContact:{label:c=>'마지막 연락 '+c.v+'일 이상',test:(d,c)=>{const n=days(d);return n!=null&&n>=c.v;}},
  callToday:{label:()=>'오늘까지 전화 · 연락할 일',test:d=>{const a=next(d),dd=a&&root.daysTo(String(a.due||a.due_at||'').slice(0,10));return !!a&&dd!=null&&dd<=0&&/전화|연락|확인/.test([a.type,a.text].join(' '));}},
  amount:{label:c=>'금액 '+c.v+'억 이상',test:(d,c)=>money(d)>=c.v*1e8},
  noNext:{label:()=>'다음 할 일 없음',test:d=>!next(d)},
  stage:{label:c=>'단계 '+root.stageLabel(c.v),test:(d,c)=>root.dealStage(d)===c.v},
  noPhone:{label:()=>'소장 휴대폰 없음',test:d=>!root.siteContacts(d,root.itemPatch(d,'deal')).some(c=>String(c.mobile||'').replace(/\D/g,'').length>=10)},
  text:{label:c=>'검색어 '+c.v,test:(d,c)=>{const cs=root.siteContacts(d,root.itemPatch(d,'deal'));return [d.site,root.repN(d.assignee),root.stageLabel(root.dealStage(d)),root.bizOf(d)].concat(cs.map(x=>x.name+' '+x.role+' '+x.mobile)).join(' ').toLowerCase().includes(String(c.v).toLowerCase());}}
 };
 function span(q,def){let m=/(\d+)\s*일/.exec(q);if(m)return Number(m[1]);m=/(\d+)\s*주/.exec(q);if(m)return Number(m[1])*7;m=/(\d+)\s*(?:개월|달)/.exec(q);if(m)return Number(m[1])*30;if(/한\s*달/.test(q))return 30;return def;}
 /* 질문 → 조건. 못 바꾸면 null */
 function parse(q){
  q=String(q||'').trim();if(!q)return null;
  const C=[],names=[...new Set((root.PERFORMANCE_TARGET_NAMES||[]).concat((root.SalesScope?.people?.()||[]).map(p=>p.name)))];
  const rep=names.find(n=>n&&q.includes(n))||(/(^|\s)(내가|내|나의|제가)(\s|$)/.test(q)&&root.ME&&names.includes(root.ME.name)?root.ME.name:'');
  if(rep)C.push({k:'owner',v:rep});
  let hit=false;
  if(/소장.*(번호|휴대폰|전화).*(없|미입력)|연락처.*없/.test(q)){C.push({k:'noPhone'});hit=true;}
  if(/(견적|자료).*(보내|보낸|발송)/.test(q)&&/멈춘|멈춰|정체|넘게|안\s*움직/.test(q)){C.push({k:'stage',v:'sent'},{k:'noContact',v:span(q,14)});hit=true;}
  else if(/연락.*(안|없)|미접촉|넘게.*연락/.test(q)){C.push({k:'noContact',v:span(q,30)});hit=true;}
  if(/오늘.*(전화|연락)|(전화|연락).*오늘/.test(q)){C.push({k:'callToday'});hit=true;}
  const am=/(\d+(?:\.\d+)?)\s*억/.exec(q);if(am){C.push({k:'amount',v:Number(am[1])});hit=true;}
  if(/다음\s*(할\s*일|행동|일정).*없/.test(q)){C.push({k:'noNext'});hit=true;}
  if(!hit&&!rep){if(q.length<2)return null;C.push({k:'text',v:q});}
  C.push({k:'open'});
  return C;
 }
 function run(C){
  const list=(root.B.deals||[]).filter(d=>C.every(c=>KIND[c.k].test(d,c)));
  const stale=C.some(c=>c.k==='noContact');
  list.sort((a,b)=>stale?(days(b)||0)-(days(a)||0)||money(b)-money(a):money(b)-money(a));
  return list;
 }
 /* ── 창 ── */
 let S=null;/* {q,conds,list,all} */
 function node(){
  let m=document.getElementById('askDialog');if(m)return m;
  m=document.createElement('div');m.id='askDialog';m.className='ak-layer';m.innerHTML='<section class="ak-box" role="dialog" aria-modal="true" aria-label="CRM에게 묻기"><div class="ak-top"><span aria-hidden="true">✦</span><input id="akInput" aria-label="질문" placeholder="예: 이필선 담당 중 30일 넘게 연락 안 한 곳" autocomplete="off"><button type="button" class="ak-go" data-ak="go">찾기</button><kbd>Esc</kbd></div><div class="ak-body" id="akBody"></div></section>';
  m.addEventListener('mousedown',e=>{if(e.target===m)close();});
  m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(e.key==='Enter'&&e.target.id==='akInput'){e.preventDefault();ask(e.target.value);}});
  m.addEventListener('click',onClick);
  document.body.append(m);return m;
 }
 function faqHtml(lead){
  return (lead||'')+'<div class="ak-sec">자주 묻는 것</div><div class="ak-faq">'+FAQ.map(q=>{const C=parse(q);let n=0;try{n=C?run(C).length:0;}catch(e){}return '<button type="button" data-ak="faq" data-value="'+attr(q)+'"><span>'+h(q)+'</span><em>'+n+'곳</em></button>';}).join('')+'</div><p class="ak-note">읽기 전용 · 질문을 검색 조건으로 바꿔 실제 데이터만 보여줘요</p>';
 }
 function rowHtml(d,i){
  const n=days(d),a=next(d),stale=S.conds.some(c=>c.k==='noContact'),amt=money(d);
  const basis=stale?(n==null?'CRM 연락 기록 없음':'마지막 연락 '+n+'일 전'):S.conds.some(c=>c.k==='callToday')&&a?(a.text||a.type||'연락')+' · '+String(a.due||a.due_at||'').slice(5,10).replace('-','/'):S.conds.some(c=>c.k==='noPhone')?'소장 휴대폰 없음':a?'다음 할 일 '+String(a.due||a.due_at||'').slice(5,10).replace('-','/'):'다음 할 일 없음';
  const key=stale?'<b class="r">'+(n==null?'–':n+'일')+'</b>':'<b class="'+(amt?'b':'m')+'">'+h(amt?root.fmtAmt(amt):'금액 미입력')+'</b>';
  return '<button type="button" class="ak-row" data-ak="open" data-value="'+i+'"><span class="ak-site"><strong>'+h(d.site||'현장명 미입력')+'</strong><small>'+h(root.repN(d.assignee)||'미배정')+'</small></span><span>'+h(root.stageLabel(root.dealStage(d)))+' · '+h(root.dealWorkSummary(d)||'공종 미분류')+'</span><span>'+h(basis)+'</span>'+key+'</button>';
 }
 function render(){
  const body=document.getElementById('akBody');if(!body)return;
  if(!S){body.innerHTML=faqHtml();return;}
  if(!S.conds&&S.ai==='busy'){body.innerHTML='<p class="ak-miss">✦ AI가 질문을 검색 조건으로 바꾸는 중…</p>';return;}
  if(!S.conds){body.innerHTML=faqHtml('<p class="ak-miss">이 질문은 아직 조건으로 못 바꿨어요 · 이렇게 물어보세요'+(S.aiErr?' <small>('+h(S.aiErr)+')</small>':'')+'</p>');return;}
  const list=S.list,total=list.reduce((a,d)=>a+money(d),0),stale=S.conds.some(c=>c.k==='noContact'),shown=S.all?list:list.slice(0,TOP);
  const chips='<div class="ak-sec">이렇게 찾았어요'+(S.ai==='done'?' · ✦ AI 해석 — 틀리면 ✕로 빼 주세요':'')+'</div><div class="ak-chips">'+S.conds.map((c,i)=>'<span class="ak-chip">'+h(KIND[c.k].label(c))+'<button type="button" data-ak="drop" data-value="'+i+'" aria-label="'+attr(KIND[c.k].label(c))+' 조건 빼기">✕</button></span>').join('')+(S.conds.length?'':'<span class="ak-none">조건 없음 — 전체 영업건</span>')+'</div>';
  const sum='<p class="ak-sum"><b>'+list.length.toLocaleString('ko-KR')+'곳</b>'+(list.length?' · '+(stale?'진행 금액 '+h(root.fmtAmt(total))+'이 멈춰 있어요':'금액 합계 '+h(root.fmtAmt(total))):' · 조건에 맞는 영업건이 없어요')+'</p>';
  let admin=false;try{admin=!!root.todayIsAdmin();}catch(e){}
  const canSms=!!(root.SmsV2&&root.SmsV2.enabled()&&root.SmsV2.openCustom)&&admin,canTask=!!(root.ImprovementTasks&&root.ImprovementTasks.enabled()&&admin);
  const foot=list.length?'<div class="ak-foot"><span>'+(S.all||list.length<=TOP?'전체 '+list.length+'곳':'상위 '+TOP+'곳 · 나머지 '+(list.length-TOP)+'곳')+'</span><div>'+(!S.all&&list.length>TOP?'<button type="button" data-ak="all">모두 보기</button>':'')+(canSms?'<button type="button" data-ak="sms">이 묶음에 문자</button>':'')+(canTask?'<button type="button" data-ak="task">과제로 등록</button>':'')+'</div></div>':'';
  body.innerHTML=chips+sum+'<div class="ak-list">'+shown.map(rowHtml).join('')+'</div>'+foot+'<p class="ak-note">읽기 전용 · 화면에 없는 사실은 만들지 않아요</p>';
 }
 function ask(q){q=String(q||'').trim();if(!q){S=null;return render();}const conds=parse(q);S={q,conds,list:conds?run(conds):[],all:false};if(conds&&conds.length===2&&conds[0].k==='text'&&!S.list.length)S.conds=null;render();
  /* 규칙으로 조건을 못 만들었으면 AI에게 해석을 맡긴다(켜져 있을 때만). 결과도 같은 조건 칩으로 보여 준다 */
  if(!S.conds&&root.OpsStore&&root.OpsStore.aiOn()){const mine=S;S.ai='busy';render();
   const names=[...new Set((root.PERFORMANCE_TARGET_NAMES||[]).concat((root.SalesScope?.people?.()||[]).map(p=>p.name)))],stages=Object.keys(root.STAGE_MASTER||{});
   root.OpsStore.ai('ask_parse','question',q,{question:q,owners:names,stages:stages.map(c=>({code:c,label:root.stageLabel(c)}))}).then(s=>{if(S!==mine)return;const C=((s.suggestion||{}).conditions||[]).map(c=>{if(!KIND[c.k])return null;if(c.k==='owner'&&!names.includes(c.v))return null;if(c.k==='stage'){const code=stages.includes(c.v)?c.v:stages.find(x=>root.stageLabel(x)===c.v);if(!code)return null;return {k:'stage',v:code};}if(c.k==='noContact'||c.k==='amount'){const n=Number(c.v);if(!Number.isFinite(n)||n<=0)return null;return {k:c.k,v:n};}if(c.k==='text'&&!String(c.v||'').trim())return null;return c.v==null?{k:c.k}:{k:c.k,v:c.v};}).filter(Boolean);
    if(!C.length){S.ai='';return render();}if(!C.some(c=>c.k==='open'))C.push({k:'open'});S.conds=C;S.list=run(C);S.ai='done';S.aiId=s.id||'';render();}).catch(e=>{if(S!==mine)return;S.ai='';S.aiErr=String(e.message||e);render();});}
 }
 function open(){
  const m=node();S=null;m.classList.add('on');const i=document.getElementById('akInput');i.value='';render();setTimeout(()=>i.focus(),30);
 }
 function close(){const m=document.getElementById('askDialog');if(m)m.classList.remove('on');S=null;}
 function onClick(e){
  const b=e.target.closest('[data-ak]');if(!b)return;const a=b.dataset.ak,v=b.dataset.value;
  if(a==='go')return ask(document.getElementById('akInput').value);
  if(a==='faq'){document.getElementById('akInput').value=v;return ask(v);}
  if(!S)return;
  if(a==='drop'){S.conds.splice(Number(v),1);S.list=run(S.conds);S.all=false;return render();}
  if(a==='all'){S.all=true;return render();}
  if(a==='open'){const d=S.list[Number(v)];if(!d)return;close();root.drwDeal(JSON.stringify(d));return;}
  if(a==='sms'){const keys=new Set(S.list.map(d=>root.dealKey(d))),title='CRM에게 묻기 · '+S.q;close();root.SmsV2.openCustom(title,keys);return;}
  if(a==='task'){const label=S.conds.map(c=>KIND[c.k].label(c)).join(' · ')||S.q,n=S.list.length,owner=(S.conds.find(c=>c.k==='owner')||{}).v;close();root.ImprovementTasks.open({scope:'ask',key:label,basis:label+' '+n+'곳',todo:label+' '+n+'곳 정리',who:(owner||'영업팀')+' · 이번 주',count:n});return;}
 }
 function boot(){
  const base=root.openExecAsk;if(typeof base==='function')root.openExecAsk=function(){if(!enabled())return base.apply(this,arguments);open();};
  const b=document.getElementById('execAskBtn');if(b)b.onclick=()=>root.openExecAsk();
  /* Ctrl/⌘+K = CRM에게 묻기 (새 틀에서만) */
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&String(e.key).toLowerCase()==='k'&&enabled()&&root.ShellV2?.enabled?.()&&root.B&&!document.getElementById('authGate')?.classList.contains('on')){e.preventDefault();e.stopImmediatePropagation();if(document.getElementById('askDialog')?.classList.contains('on'))document.getElementById('akInput').focus();else open();}},true);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.AskV2={enabled,open,close,parse,run,ask};
})(window);
