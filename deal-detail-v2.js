/* 파이프라인 상세창 v2 (2026-10-01 디자인 핸드오프 'design_handoff_pipeline' ③ 3단 틀 · ④ 오른쪽 작업 패널)
   기존 상세(연락처·다음 할 일·단계 전환·금액·공종·자료·관리정보 입력과 저장)는 그대로 두고, 그 위에 틀만 다시 짠다.
   머리: 칩(브랜드·단계·공종) + 현장명 + "담당 · 예상 금액 · 단계 N일째" + 영업 진행 막대 6칸(영업 흐름 줄·영업 진행도를 이 막대로 합침)
   ① 왼쪽 고객·현장: 연락처 카드 · 관리 정보 6줄([공종][금액][수정]) · 자료
   ② 가운데 고객과 주고받은 내용: 말풍선 대화(기존 통합 이력) + 입력칸(통화 기록·내부 메모 → 기존 연락 기록 저장 경로). 문자는 왼쪽 버튼에서 발송하고 기존 통합 이력에 표시
   ③ 오른쪽 지금 할 일: 지금 할 일 카드 · 이 단계에서 챙길 정보 · 단계 바꾸기(기존 단계 전환창)
   작업창(연락 결과·다음 할 일·진행상태 변경·단계 정보·연락처·금액·관리정보·자료)은 모달 위 모달 대신 오른쪽 열 자리에서 열린다.
   끄기: G.dealDetailV2Off=true → 예전 상세. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const STAGES=[['consulting','컨설팅 설계'],['sent','자료 발송완료'],['relationship','관계관리'],['competition','경쟁·입찰'],['construction','계약·시공'],['won','수주'],['lost','실주']];
 const DESC={activity:'고객 접촉 내용과 다음 할 일을 함께 기록합니다',next:'다음에 할 일과 기한을 정합니다',stage:'대상 단계와 필수 항목을 확인합니다',owner:'변경 근거와 함께 이력이 남습니다',amount:'예상 금액을 입력합니다',materials:'사진 · 견적 · 기타 자료',management:'고객 반응 · 의사결정자 · 경쟁사 등',stagefields:'적은 항목만 저장됩니다',contact:'현장 연락처',history:'모든 기록과 변경 내역',support:'관리자에게 지원을 요청합니다',help:'영업 관리 기준'};
 const enabled=()=>!root.G.dealDetailV2Off;
 const el=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n;};
 const btn=(text,cls,run)=>{const b=el('button',cls);b.type='button';b.textContent=text;b.onclick=run;return b;};
 const toast=(m,t)=>{if(typeof root.toast==='function')root.toast(m,t);else root.showDetailErr?.(m,t!=='warn');};
 function groupOf(d){return root.PipelineStages.group(root.dealStage(d),root.outcomeOf?root.outcomeOf(d):null);}
 function cleanup(view){view.classList.remove('ddv','ddv-adv-on');view.querySelectorAll('.ddv-chips,.ddv-steps').forEach(n=>n.remove());$('ddvPanel')?.remove();}
 /* ── 말풍선: 기존 통합 이력(연락·문의·배정·단계)을 시간순으로 ── */
 const NAMES={next_action_set:'다음 할 일 등록',next_action_completed:'다음 할 일 완료',next_action_complete:'다음 할 일 완료',stage_change:'진행상태 변경',stage_changed:'진행상태 변경',owner_changed:'담당자 변경',activity_created:'연락 결과','단계전환':'진행상태 변경','단계 전환':'진행상태 변경'};
 function bubbles(d){
  let rows=[];try{rows=root.unifiedTimeline(root.currentPatch?root.currentPatch():{},d)||[];}catch(e){rows=[];}
  const seen=new Set(),say=t=>root.sayLegacyNote?root.sayLegacyNote(t):t,out=[];
  /* 같은 단계 변경이 화면 기록('계약')과 서버 기록('bidding → contract')으로 두 번 오면 한 번만 보인다 — 같은 날 · 같은 입력 내용이면 같은 변경. 단계 코드는 단계 이름으로 바꿔 적는다 */
  const stageSeen=[],codeName=s=>String(s||'').replace(/[a-z]+(?:_[a-z]+)*/g,c=>c==='unclassified'?'단계 없음(과거 이관)':root.STAGE_MASTER&&root.STAGE_MASTER[c]?root.stageLabel(c):c),/* 'unclassified' = 단계 값이 비어 있던 과거 이관 건의 출발 단계(2026-10-07) */toOf=s=>{s=codeName(s);const i=s.lastIndexOf('→');return (i>=0?s.slice(i+1):s).trim();};
  rows.forEach(x=>{
   const k=x.id?'id:'+x.id:[x.ttl,x.body,x.result,String(x.at||'')].join('|');if(seen.has(k))return;seen.add(k);
   const ttl=String(x.ttl||''),label=NAMES[ttl]||(/^[a-z]+(?:_[a-z]+)+$/.test(ttl)?'업무 기록':ttl||'연락 결과');
   const text=[x.body,x.result].concat((x.fields||[]).map(f=>f.filter(Boolean).join(' · '))).filter(Boolean).map(say).join('\n');
   const system=/^[a-z]+(?:_[a-z]+)+$/.test(ttl)||/단계|배정|변경|등록|완료|이력 수정/.test(label)&&!/전화|문자|방문/.test(label);/* '이력 수정' = 이 단지 영업 이력을 고친 시스템 기록 */
   const kind=ttl==='견적문의 접수'&&x.body?'in':system?'sys':ttl==='메모'||/^\[지원/.test(String(x.body||''))?'memo':x.src==='auto'?'sys':'out';
   if(label==='진행상태 변경'){
    const lines=String(text||'').split('\n'),first=codeName(lines[0]||''),rest=lines.slice(1).join('\n'),day=String(x.at||'').slice(0,10);
    const prev=stageSeen.find(p=>!(p.id&&x.id&&p.id!==x.id)&&p.day===day&&p.rest===rest&&(rest?true:toOf(p.first)===toOf(first)));
    if(prev){if(/→/.test(first)&&!/→/.test(prev.first)){prev.first=first;prev.item.text=[first].concat(rest?[rest]:[]).join('\n');}return;}
    const item={kind,label,who:x.who||'',at:x.at,text:[first].concat(rest?[rest]:[]).join('\n')||label};stageSeen.push({id:x.id,day,rest,first,item});out.push(item);return;
   }
   out.push({kind,label,who:x.who||'',at:x.at,text:text||label});
  });
  /* 연락 한 번 연결(contact-link.js): 같은 현장의 다른 건에 남긴 원본 기록이 이 건을 가리키면 '연결 기록'으로 보인다(복사 아님 · 원본 현장 표시) */
  try{const CL=root.ContactLink;if(CL&&CL.on()){CL.linkedInto('deal:'+d.id).forEach(x=>out.push({kind:'out',label:'연결 기록',who:x.who||'',at:x.at,text:'원본: '+(x.site||'다른 건')+' · '+say(x.text),linked:true}));}}catch(e){}
  return out.sort((a,b)=>String(a.at||'').localeCompare(String(b.at||'')));
 }
 /* 2026-10-03 대표: 기록마다 해당 연도까지 보이게(오래된 견적문의 접수가 올해 것처럼 보이던 문제) */
 const fmt=v=>{try{const x=new Date(v);return v&&!isNaN(x)?x.getFullYear()+'.'+(x.getMonth()+1)+'.'+x.getDate()+' '+String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0'):'미기록';}catch(e){return String(v||'').slice(0,10);}};
 function talk(d,closed){
  const list=bubbles(d),cls={in:'in',out:'out',memo:'memo',sys:'sys'};
  const thread=list.length?list.map(b=>'<div class="idv-msg '+cls[b.kind]+(b.linked?' cl-linked':'')+'"><div class="idv-meta"><em>'+h(b.label)+'</em>'+(b.who?'<span>'+h(b.who)+'</span>':'')+'<span>'+h(fmt(b.at))+'</span></div><div class="idv-bubble">'+h(b.text)+'</div></div>').join(''):'<p class="ddv-nothing">아직 기록이 없습니다 — 첫 연락 결과부터 여기에 쌓입니다</p>';
  const composer=closed?'<div class="idv-composer idv-locked">종료된 영업건입니다 — 기록은 읽기만 할 수 있습니다</div>'
   :'<div class="idv-composer" id="ddvComposer"><div class="idv-ctabs"><div role="tablist" aria-label="기록 종류">'+[['전화','통화 기록'],['메모','내부 메모']].map((t,i)=>'<button type="button" role="tab" data-type="'+t[0]+'" aria-selected="'+(i===0)+'">'+t[1]+'</button>').join('')+'</div><button type="button" class="idv-toggle" data-ddv="full">다음 할 일까지 함께 기록 ▸</button></div><div class="idv-input"><textarea rows="1" aria-label="기록 내용" placeholder="예: 관리소장과 통화 — 예산 확정은 12월 입대의 이후"></textarea><button type="button" class="idv-save" data-ddv="save">저장</button></div><div class="idv-err" role="alert"></div></div>';
  const sec=el('section','ddv-talk','<div class="idv-chead"><b>고객과 주고받은 내용</b><span>'+list.length+'건</span><em>시간순 · 최신이 아래</em></div><div class="idv-thread">'+thread+'</div>'+composer);
  sec.setAttribute('aria-label','고객과 주고받은 내용');
  return sec;
 }
 /* 입력칸 저장 = 기존 연락 기록 경로(queueDetailContactOperation 'activity') — 서버 확인 뒤 대화에 쌓인다 */
 async function saveNote(box){
  const d=root.CUR_DETAIL?.item,ta=box.querySelector('textarea'),err=box.querySelector('.idv-err'),note=ta.value.trim(),type=box.querySelector('[role=tab][aria-selected="true"]')?.dataset.type||'전화';
  if(!d||box.dataset.saving)return;err.textContent='';
  if(!note){err.textContent='기록할 내용을 적어 주세요.';ta.focus();return;}
  if(!root.Phase1?.queue||typeof root.queueDetailContactOperation!=='function'){err.textContent='로그인 상태에서만 저장할 수 있습니다.';return;}
  box.dataset.saving='1';const save=box.querySelector('.idv-save');save.disabled=true;save.textContent='확인 중…';
  const payload={type,note,result:'',occurred_at:new Date().toISOString()},progress=box._progress||(box._progress={});
  try{
   let id=progress.id;if(id&&root.Phase1.queue.list().find(q=>q.request_id===id)?.status==='rejected'){id=null;}
   if(!id){id=root.queueDetailContactOperation('activity',{opportunity_id:d.id,...payload});progress.id=id;}
   await root.Phase1.queue.flush();const row=root.Phase1.queue.list().find(q=>q.request_id===id);
   if(row?.status!=='done'||row.ack?.ok!==true)throw Error(row?.error||'서버 확인 대기 중입니다. 다시 누르면 같은 요청을 확인합니다.');
   d.activities=Array.isArray(d.activities)?d.activities:[];if(!d.activities.some(x=>x.id===row.ack.activity_id))d.activities.unshift({id:row.ack.activity_id,type,note,at:payload.occurred_at,occurred_at:payload.occurred_at,actor:root.repN(root.ME?.name)});
   root.saveLocal?.();root.renderDetail?.();toast((type==='메모'?'내부 메모':type==='문자'?'문자 기록':'통화 기록')+'을 남겼습니다');
  }catch(e){err.textContent=String(e.message||e);save.disabled=false;save.textContent='저장';delete box.dataset.saving;}
 }
 function bindTalk(sec){
  const box=sec.querySelector('#ddvComposer');if(!box)return;
  const ta=box.querySelector('textarea'),save=box.querySelector('.idv-save');
  const grow=()=>{ta.style.height='auto';ta.style.height=Math.min(140,ta.scrollHeight+2)+'px';save.classList.toggle('on',!!ta.value.trim());};
  ta.addEventListener('input',grow);
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveNote(box);}});
  box.addEventListener('click',e=>{
   const tab=e.target.closest('[role=tab]');if(tab){box.querySelectorAll('[role=tab]').forEach(t=>t.setAttribute('aria-selected',String(t===tab)));ta.placeholder=tab.dataset.type==='메모'?'내부 메모 — 고객에게 보이지 않는 팀 기록':tab.dataset.type==='문자'?'보낸 문자 내용을 적어 주세요(기록만 남깁니다)':'예: 관리소장과 통화 — 예산 확정은 12월 입대의 이후';ta.focus();return;}
   const b=e.target.closest('[data-ddv]');if(!b)return;
   if(b.dataset.ddv==='save')saveNote(box);
   if(b.dataset.ddv==='full'){const type=box.querySelector('[role=tab][aria-selected="true"]').dataset.type,text=ta.value;if(root.DetailActions.open('activity')){const n=$('dv-act-note'),t=$('dv-act-type');if(t)t.value=type;if(n&&text&&!n.value){n.value=text;n.dispatchEvent(new Event('input',{bubbles:true}));}n?.focus();}}
  });
  const thread=sec.querySelector('.idv-thread');thread.scrollTop=thread.scrollHeight;
 }
 /* ── 왼쪽: 관리 정보 6줄 ── */
 function manageCard(d){
  const p=root.currentPatch?root.currentPatch():{},contexts=d.stage_contexts||p.stage_contexts||{},code=root.dealStage(d),f=Object.assign({},...Object.values(contexts).map(c=>c?.fields||{}),contexts[code]?.fields||{});
  const work=root.dealWorkSummary(d),amt=Number(d.amount??d.amt??0),plan=f.construction_plan||d.construction_year||d.constructionYear||f.expected_contract||f.start_date||'';
  const rows=[['고객 반응',f.customer_reaction||f.reaction||d.customer_reaction],['의사결정자',f.decision_maker||d.decision_maker],['경쟁사',f.competitor||d.competitor],['공종',work&&!/미분류|미기록/.test(work)?work:''],['예상 금액',amt>0?root.fmtAmt(amt):''],['공사 예정',plan]];
  const card=el('section','dcard ddv-manage','<header><h3>관리 정보</h3><span></span></header><dl>'+rows.map(([k,v])=>'<div><dt>'+h(k)+'</dt><dd'+(v?'':' class="ddv-empty"')+'>'+h(v||'미입력')+'</dd></div>').join('')+'</dl>');
  const links=card.querySelector('header span');
  links.append(btn('공종','ddv-link',()=>root.openWorkEdit?.()),btn('금액','ddv-link',()=>root.DetailActions.open('amount')),btn('수정','ddv-link',()=>{if(!root.DealPanelsV2?.open('info'))root.DetailActions.open('management');}));
  return card;
 }
 /* ── 오른쪽: 연락 결과 패널(고르는 즉시 저장 — 기존 결과 고르기) ── */
 function contactPanel(){
  const view=$('detailView'),right=view?.querySelector('.dw-right'),d=root.CUR_DETAIL?.item;if(!right||!d||!root.NowCard?.inline)return root.NowCard?.sheet?.();
  $('ddvPanel')?.remove();
  const panel=el('div','ddv-side','<header><button type="button" class="ddv-back" aria-label="뒤로">‹</button><div><b>연락 결과</b><small>고르는 즉시 기록과 다음 할 일이 만들어집니다</small></div></header><div class="ddv-side-body"></div>');
  panel.id='ddvPanel';panel.setAttribute('role','region');panel.setAttribute('aria-label','연락 결과');
  const close=()=>{panel.remove();right.classList.remove('ddv-covered');};
  panel.querySelector('.ddv-back').onclick=close;
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  root.NowCard.inline(panel.querySelector('.ddv-side-body'),d,()=>{close();const ta=view.querySelector('#ddvComposer textarea');if(ta){ta.focus();ta.scrollIntoView({block:'nearest'});}});
  right.classList.add('ddv-covered');right.append(panel);panel.querySelector('[data-chip]')?.focus();
 }
 function switchStage(d,key){
  const def=root.PipelineStages.definition(key),T=root.StageTransition,from=root.dealStage(d);
  let choices=null;try{choices=T&&typeof T.choices==='function'?T.choices(from):null;}catch(e){}
  const code=!def?null:!choices?def.codes[0]:def.codes.find(c=>choices.includes(c));
  if(!code){toast('지금 단계에서는 «'+(STAGES.find(s=>s[0]===key)||[])[1]+'»(으)로 바로 옮길 수 없습니다 — 가능한 단계는 진행상태 변경에서 확인해 주세요','warn');root.openTransition?.();return;}
  if(root.StageTransitionUI?.open)root.StageTransitionUI.open(d,false,code);else root.openTransition?.();
 }
 function reskin(){
  const view=$('detailView'),body=$('dv-body'),cur=root.CUR_DETAIL;if(!view||!body)return;
  if(!enabled()||!cur||cur.kind!=='deal'||!view.classList.contains('dw-wide')||!view.classList.contains('da-ready')){cleanup(view);return;}
  const cols=body.querySelector('.dw-columns');if(!cols||cols.classList.contains('ddv-cols'))return;
  const d=cur.item,closed=!!d.outcome||d.lifecycle_status==='closed',group=groupOf(d),groupName=(STAGES.find(s=>s[0]===group)||[])[1]||root.stageLabel(root.dealStage(d));
  const left=cols.querySelector('.dw-left'),center=cols.querySelector('.dw-center'),right=cols.querySelector('.dw-right');if(!left||!center||!right)return;
  cleanup(view);view.classList.add('ddv');cols.classList.add('ddv-cols');
  /* 머리 */
  const top=view.querySelector('.detailtop'),titleBox=$('dv-title')?.parentElement,journey=body.querySelector('.dcc-journey'),age=typeof root.stageAge==='function'?root.stageAge(d):null,amt=Number(d.amount??d.amt??0),work=root.dealWorkSummary(d);
  if(titleBox){
   const badge=$('dv-sub')?.querySelector('.dw-stage-badge')?.textContent||'';
   titleBox.prepend(el('div','ddv-chips',(d.brand?'<span class="idv-brand">'+h(d.brand)+'</span>':'')+(badge&&badge!==groupName?'<span class="ddv-tag">'+h(badge)+'</span>':'')+(work&&!/미분류|미기록/.test(work)?'<span class="idv-type">'+h(work)+'</span>':'')));
   const sub=$('dv-sub');if(sub)sub.textContent=['담당 '+(root.repN(d.assignee)||'미배정'),amt>0?'예상 '+root.fmtAmt(amt):'예상 금액 미입력',groupName+(age!=null&&!closed?' '+age+'일째':'')].join(' · ');
  }
  /* 2026-10-03 대표: ✕ 는 머리줄 맨 끝(즐겨찾기 · 작업 더보기 뒤) */
  if(top){const back=top.querySelector('.backbtn');if(back&&back.parentElement!==top)top.append(back);}
  const stops=[...(journey?.querySelectorAll('.dcc-stop')||[])];
  if(top&&stops.length)top.append(el('div','idv-steps ddv-steps',stops.map(s=>{const now=s.classList.contains('now'),done=s.classList.contains('done');return '<div class="'+(now?'cur':done?'done':'')+'"><i></i><span>'+(now?'지금 · ':'')+h(s.textContent.trim())+'</span></div>';}).join('')));
  const how=journey?.querySelector('.dcc-journey-do b')?.textContent||'',pace=(journey?.querySelector('.dcc-journey-do small')?.textContent||'').split(' · ').slice(0,2).join(' · ');
  const advisory=center.querySelector('.technical-advisory');
  /* ① 왼쪽 */
  left.querySelector(':scope>h2')?.setAttribute('hidden','');
  left.querySelectorAll('.dw-site,.dw-voice').forEach(n=>n.hidden=true);
  const contact=left.querySelector('#contactCard')||left.querySelector('.dcard'),manage=manageCard(d);
  if(contact)contact.after(manage);else left.prepend(manage);
  right.querySelectorAll(':scope>.da-info').forEach(n=>{if(n.id==='da-material-summary'){n.classList.add('ddv-files');manage.after(n);}else if(!n.classList.contains('da-stage-summary'))n.hidden=true;});
  /* ② 가운데 */
  center.querySelectorAll('.da-recent,.dcc-journey').forEach(n=>n.hidden=true);
  view.classList.remove('ddv-adv-on');
  const flow=$('nowFlow');if(flow)flow.hidden=true;
  const sec=talk(d,closed),err=$('dv-err');if(err&&center.contains(err))err.after(sec);else center.prepend(sec);bindTalk(sec);
  /* ③ 오른쪽 */
  right.querySelector(':scope>h2')?.setAttribute('hidden','');
  right.querySelectorAll('.dw-management,.dw-missing').forEach(n=>n.hidden=true);
  const now=$('nowCard'),summary=center.querySelector('.da-stage-summary');
  const sw=el('section','dcard ddv-switch','<h3>단계 바꾸기</h3>'+(how?'<p>'+h(how)+'</p>':'')+'<div class="ddv-stages">'+STAGES.map(([k,n])=>'<button type="button" data-stage="'+k+'"'+(k===group?' class="cur" aria-current="true"':'')+'>'+h(n)+'</button>').join('')+'</div>');
  sw.querySelector('.ddv-stages').onclick=e=>{const b=e.target.closest('[data-stage]');if(!b)return;if(b.dataset.stage===group){root.openTransition?.();return;}switchStage(d,b.dataset.stage);};
  sw.append(btn('담당자 변경','ddv-owner',()=>root.DetailActions.open('owner')));
  if(summary){if(pace){const line=el('p','ddv-pace');line.textContent=groupName+' · '+pace;summary.querySelector('h3')?.after(line);}right.prepend(summary);}
  right.append(sw);
  if(now){
   right.prepend(now);now.classList.toggle('late',!!now.querySelector('.nc-late'));
   const cta=now.querySelector('.nc-cta');
   if(cta&&!closed){const call=cta.querySelector('.nc-call'),done=[...cta.querySelectorAll('button')].find(b=>/완료/.test(b.textContent));cta.replaceChildren();if(call){call.textContent='연락하고 결과 남기기';call.removeAttribute('onclick');call.onclick=contactPanel;cta.append(call);}cta.append(btn('다음 할 일 · 날짜','',()=>{if(!root.DealPanelsV2?.open('next'))root.DetailActions.open('next');}));if(done){done.classList.add('ddv-done');cta.append(done);}}
   else if(cta&&closed)cta.hidden=true;
  }
  view.style.setProperty('--ddv-top',(body.offsetTop||0)+'px');
 }
 /* 작업창이 열리면(#detailAction) 오른쪽 열 자리 패널 모양으로: [‹] 뒤로 + 제목 + 설명 */
 function panelize(panel){
  const view=$('detailView');if(!view?.classList.contains('ddv')||panel.classList.contains('ddv-panel'))return;
  /* 다음 할 일 · 관리정보는 새 패널로 연다(예전 작업창 연결 끊기) */
  {const k=root.DetailActions.active,map={next:'next',management:'info'};if(map[k]&&root.DealPanelsV2?.active()){root.DetailActions.close(false);root.DealPanelsV2.open(map[k]);return;}}
  panel.classList.add('ddv-panel');view.style.setProperty('--ddv-top',($('dv-body')?.offsetTop||0)+'px');
  const head=panel.querySelector('.da-sheet>header'),title=head?.querySelector('h2'),x=head?.querySelector('button'),key=root.DetailActions.active;
  if(x){x.textContent='‹';x.classList.add('ddv-back');head.prepend(x);}
  if(title&&DESC[key]&&!head.querySelector('small')){const wrap=el('div','ddv-ptitle');title.before(wrap);const s=el('small');s.textContent=DESC[key];wrap.append(title,s);}
 }
 function boot(){
  const da=root.DetailActions;if(!da||typeof da.decorate!=='function')return;
  const old=da.decorate;da.decorate=function(){const r=old.apply(da,arguments);try{reskin();}catch(e){console.warn('[상세 v2]',e);}return r;};
  const view=$('detailView');if(view)new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)if(n.id==='detailAction')panelize(n);}).observe(view,{childList:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.DealDetailV2={reskin,bubbles,enabled,contactPanel};
})(window);
