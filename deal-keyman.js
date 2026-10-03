/* 파이프라인 상세 · 담당자 관계 이력 + AI 판단 (2026-10-03 대표)
   ① 담당자 관계 이력: '관리소장 근무 이력'(인사정보 느낌 표)은 상세 왼쪽에서 뺀다. 관리소장 변경은 연락처 수정이 아니라 **영업 리스크 이벤트** —
      변경이 있을 때만 연락처 칸에 「⚠ 10/03 담당자 변경 · 이전: 박영호 소장」이 뜨고, [변경 내용 확인]을 열면 확인 항목(기존 견적 조건 유지 · 공법 선호 · 경쟁업체 · 공사 추진일정)과
      [변경 후 첫 응대 기록](입력칸에 문구를 채워 사람이 저장)이 나온다. 가운데 타임라인에서는 그 기록을 「담당자 변경」 중요 이벤트로 띄운다.
      오른쪽 지금 할 일에는 변경 뒤 첫 응대가 없으면 「관리소장 변경 후 기존 견적 · 공법조건 재확인」을 제안한다.
      연락처 등록 패널에서 휴대폰을 적으면, 같은 번호가 다른 현장의 담당자였을 때 「기존 고객 관계가 있습니다 — 이전 근무 · 과거 진행」을 보여 준다(같은 번호 = 같은 사람, person_key 로 이어진다).
      데이터는 전부 기존 것: item.contacts(status previous · ended_at, 연락처 패널의 '소장 바뀜'이 남김) · 활동 '관리소장 변경 — 이전 소장 기록' / '근무지 이동' · contactExistingDeals(휴대폰) · 견적서 · 활동. 확인 항목 체크는 이 PC(itemPatch)에만 — 서버 기록은 첫 응대 기록으로 남는다.
   ② AI 판단(제안만 · 저장은 사람이): 다음 행동 추천(next_action) · 통화 첫마디(call_opener) — 배포된 crm-ai 종류 재사용, AI 가 켜져 있을 때만 보인다. 담당자 변경 사실을 입력에 같이 준다.
   끄기: G.dealKeymanOff=true */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const el=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n;};
 const toast=(m,t)=>{if(typeof root.toast==='function')root.toast(m,t);};
 const enabled=()=>!root.G.dealKeymanOff;
 const CHECKS=['기존 견적 조건 유지 여부','공법 선호 변경 여부','경쟁업체 변경 여부','공사 추진일정 변경 여부'];
 const CONTACT_TYPES=['전화','문자','방문','카카오','이메일','메일·메시지'];
 const ymd=v=>String(v||'').slice(0,10),md=v=>{const s=ymd(v),m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);return m?Number(m[2])+'/'+Number(m[3]):'';};
 const since=v=>{const s=ymd(v);if(!s)return null;const n=root.daysTo(s);return Number.isFinite(n)?-n:null;};
 const acts=d=>{const p=root.itemPatch(d,'deal')||{};return [].concat(d.activities||[],p.activities||[]).filter(Boolean);};
 const isChangeNote=a=>/관리소장 변경|근무지 이동|담당자 변경/.test(String(a.note||''));
 /* 담당자 변경 사실: 이전 소장 연락처(status previous) 또는 변경 기록 활동 */
 function changeOf(d){
  if(!d)return null;
  const prevs=(Array.isArray(d.contacts)?d.contacts:[]).filter(c=>c&&(c.status==='previous'||c.role==='이전 소장')).sort((a,b)=>String(b.ended_at||'').localeCompare(String(a.ended_at||'')));
  const changes=acts(d).filter(isChangeNote).sort((a,b)=>String(b.at||b.occurred_at||'').localeCompare(String(a.at||a.occurred_at||'')));
  const prev=prevs[0],act=changes[0];if(!prev&&!act)return null;
  const date=ymd(prev&&prev.ended_at)||ymd(act&&(act.at||act.occurred_at))||'';
  let prevName=prev&&prev.name||'';if(!prevName&&act){const m=/^(.+?) · /.exec(String(act.result||''));prevName=m?m[1].trim():'';}
  const cur=root.contactInfo(d,root.itemPatch(d,'deal'))||{};
  const after=acts(d).filter(a=>!isChangeNote(a)&&CONTACT_TYPES.includes(String(a.type||''))&&ymd(a.at||a.occurred_at)>date).length;
  return {date,days:since(date),prevName,curName:cur.name||'',curRole:cur.role||'관리소장',after,hasPrevContact:!!prev};
 }
 const checksOf=(d,c)=>{const p=root.itemPatch(d,'deal')||{};const k=p.keymanChecks;return k&&k.date===c.date&&Array.isArray(k.items)?k.items:[false,false,false,false];};
 function toggleCheck(d,c,i){const p=root.itemPatch(d,'deal');const cur=checksOf(d,c).slice();cur[i]=!cur[i];p.keymanChecks={date:c.date,items:cur};root.saveLocal?.();}
 /* 입력칸에 문구를 채우고 포커스 — 저장은 사람이(기존 연락 기록 경로) */
 function prefill(text){
  const view=$('detailView'),ta=view?.querySelector('#ddvComposer textarea');if(!ta){toast('기록 입력칸을 찾지 못했습니다(종료된 영업건은 기록할 수 없습니다)','warn');return;}
  const tab=view.querySelector('#ddvComposer [role=tab][data-type="전화"]');if(tab)tab.click();
  ta.value=text;ta.dispatchEvent(new Event('input',{bubbles:true}));ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);ta.scrollIntoView({block:'nearest'});
 }
 function firstResponseText(d,c){const done=checksOf(d,c),items=CHECKS.map((t,i)=>done[i]?t.replace(' 여부','')+' 확인':'').filter(Boolean);return '관리소장 변경 후 첫 응대('+(c.prevName||'이전 소장')+' → '+(c.curName||'새 소장')+'): '+(items.length?items.join(' · ')+' — ':'')+'';}
 /* ① 왼쪽 연락처 칸: 근무 이력 표 · 근무지 이동 버튼은 숨기고, 변경이 있을 때만 경고 블록 */
 function left(view,d){
  const card=view.querySelector('#contactCard');if(!card)return;
  card.querySelectorAll('.malb').forEach(n=>{if(/근무 이력/.test(n.textContent)){n.hidden=true;const t=n.nextElementSibling;if(t&&(t.classList.contains('contacthist')||t.classList.contains('detailnotice')))t.hidden=true;}});
  card.querySelectorAll('button[onclick*="openManagerMove"]').forEach(b=>b.hidden=true);
  /* 인사정보 느낌('현재 근무지 · 현재 연락처') 대신 사람 중심 한 줄: 역할 · 핵심 담당자. 평상시엔 조용하게 */
  {const who=card.querySelector('.contactwho small'),st=card.querySelector('.contactstate');const ci=root.contactInfo(d,root.itemPatch(d,'deal'))||{};if(who&&ci.name)who.textContent=(ci.role||'관리소장')+' · 이 현장의 핵심 담당자';if(st&&!st.classList.contains('moved'))st.hidden=true;}
  card.querySelector('.dk-change')?.remove();
  const c=changeOf(d);if(!c)return;
  const open=!!(root.G.dkOpen&&root.G.dkOpen[d.id]),done=checksOf(d,c),n=done.filter(Boolean).length;
  const box=el('div','dk-change'+(c.after?' ok':''),
   '<div class="dk-head"><b>⚠ '+h(md(c.date)||'날짜 미기록')+' 담당자 변경</b><span>이전: '+h(c.prevName||'이름 미기록')+' 소장'+(c.after?' · 변경 후 응대 '+c.after+'건':' · 변경 후 첫 응대 전')+'</span><button type="button" data-dk="toggle">'+(open?'접기':'변경 내용 확인')+'</button></div>'
   +(open?'<div class="dk-body"><dl><div><dt>기존 관리소장</dt><dd>'+h(c.prevName||'미기록')+'</dd></div><div><dt>현재 관리소장</dt><dd>'+h(c.curName||'미등록')+'</dd></div><div><dt>현재 영업단계</dt><dd>'+h(root.stageLabel(root.dealStage(d)))+'</dd></div><div><dt>기존 견적</dt><dd>'+h(Number(d.amount??d.amt??0)>0?root.fmtAmt(Number(d.amount??d.amt)):'금액 미입력')+'</dd></div></dl>'
    +'<b class="dk-sub">확인 필요 <small>'+n+'/'+CHECKS.length+' · 표시는 이 PC에만 · 서버에는 첫 응대 기록으로</small></b><div class="dk-checks">'+CHECKS.map((t,i)=>'<button type="button" data-dk="check" data-i="'+i+'" aria-pressed="'+!!done[i]+'">'+(done[i]?'☑':'☐')+' '+h(t)+'</button>').join('')+'</div>'
    +'<button type="button" class="dk-primary" data-dk="first">변경 후 첫 응대 기록</button><p class="dk-note">관리소장이 바뀌면 견적 금액 · 공법 선호 · 제안 자체가 다시 검토될 수 있고 실주로 가는 경우가 있어, 변경을 영업 이벤트로 남깁니다.</p></div>':''));
  card.querySelector('.contactactions')?.after(box)||card.append(box);
 }
 /* ② 가운데: 변경 기록 말풍선을 중요 이벤트로 */
 function center(view){
  view.querySelectorAll('.idv-thread .idv-msg').forEach(m=>{const t=m.querySelector('.idv-bubble')?.textContent||'';if(/관리소장 변경|근무지 이동/.test(t)&&!m.classList.contains('dk-key')){m.classList.add('dk-key');const em=m.querySelector('.idv-meta em');if(em)em.textContent='담당자 변경';}});
 }
 /* ③ 오른쪽: 지금 할 일 제안 + AI 판단 */
 const AIR=new Map(),AIB=new Set();
 function right(view,d,closed){
  const r=view.querySelector('.dw-right');if(!r)return;
  r.querySelector('.dk-now')?.remove();r.querySelector('.dk-ai')?.remove();
  const c=changeOf(d);
  if(c&&!c.after&&!closed){
   const now=el('section','dcard dk-now','<span class="dk-eyebrow">담당자 변경 감지 · '+h(md(c.date))+'</span><b>관리소장 변경 후 기존 견적 · 공법조건 재확인</b><p>'+h(c.prevName||'이전 소장')+' → '+h(c.curName||'새 소장')+' · 변경 뒤 첫 응대가 아직 없습니다. 기존 견적 조건 · 공법 선호 · 경쟁업체 · 공사 일정을 다시 확인하세요.</p><button type="button" data-dk="first">변경 후 첫 응대 기록</button>');
   const anchor=r.querySelector('#nowCard');if(anchor)anchor.before(now);else r.prepend(now);
  }
  if(root.OpsStore&&root.OpsStore.aiOn()&&!closed){
   const key=String(d.id),res=AIR.get(key)||{},busy=AIB.has(key+':next')||AIB.has(key+':call');
   const nx=res.next,co=res.call;
   const box=el('section','dcard dk-ai','<header><h3>✦ AI 판단</h3><small>제안만 · 저장은 사람이</small></header>'
    +'<div class="dk-aibtns"><button type="button" data-dk="ai-next"'+(busy?' disabled':'')+'>'+(AIB.has(key+':next')?'읽는 중…':nx?'다음 행동 다시':'다음 행동 추천')+'</button><button type="button" data-dk="ai-call"'+(busy?' disabled':'')+'>'+(AIB.has(key+':call')?'읽는 중…':co?'첫마디 다시':'통화 첫마디')+'</button></div>'
    +(nx?'<div class="dk-airow"><span>다음 행동</span><b>'+h(nx.how)+' · '+h(nx.what)+' · '+(nx.days===0?'오늘':nx.days+'일 뒤')+'</b><p>'+h(nx.why)+'</p><button type="button" class="lnk" data-dk="ai-next-use">기록 입력칸에 넣기</button></div>':'')
    +(co?'<div class="dk-airow"><span>통화 첫마디</span><b>“'+h(co.opener)+'”</b><p>목표: '+h(co.goal)+(co.summary?' · '+h(co.summary):'')+'</p><button type="button" class="lnk" data-dk="ai-call-copy">첫마디 복사</button></div>':'')
    +(res.err?'<p class="dk-aierr">'+h(res.err)+'</p>':''));
   const anchor=r.querySelector('#nowCard')||r.querySelector('.dk-now');if(anchor)anchor.after(box);else r.prepend(box);
  }
 }
 function aiInput(d,kind){
  const c=changeOf(d),p=root.itemPatch(d,'deal')||{},f=Object.assign({},...Object.values(d.stage_contexts||p.stage_contexts||{}).map(x=>x?.fields||{})),ct=root.contactInfo(d,p)||{};
  const recent=acts(d).slice().sort((a,b)=>String(b.at||b.occurred_at||'').localeCompare(String(a.at||a.occurred_at||''))).slice(0,3).map(a=>ymd(a.at||a.occurred_at)+' '+(a.type||'')+' '+String(a.note||'').slice(0,80)+(a.result?' / '+String(a.result).slice(0,60):''));
  const base={today:new Date().toISOString().slice(0,10),site:d.site||'',stage:root.stageLabel(root.dealStage(d)),owner:root.repN(d.assignee)||'',amount:Number(d.amount??d.amt??0)||0,contact:[ct.name,ct.role].filter(Boolean).join(' '),last_contact_days:(()=>{try{return root.activityAge(d);}catch(e){return null;}})(),next:d.next_action&&d.next_action.text?{text:d.next_action.text,due:ymd(d.next_action.due)}:null,fields:{customer_reaction:f.customer_reaction||f.reaction||'',decision_maker:f.decision_maker||'',competitor:f.competitor||''},recent,keyman_change:c?{date:c.date,prev:c.prevName,now:c.curName,responded_after:c.after>0,risk:'관리소장이 바뀌면 기존 견적 조건 · 공법 선호 · 경쟁업체 · 일정이 달라질 수 있음'}:null};
  if(kind==='call_opener')return Object.assign({caller:root.ME&&root.ME.name||'',company:'넷폼',goal:base.next?base.next.text:'',recent:recent.join(' / ')},base);
  return base;
 }
 function askAi(d,kind){
  const key=String(d.id),slot=kind==='next_action'?'next':'call',bk=key+':'+slot;if(AIB.has(bk))return;AIB.add(bk);rerender();
  root.OpsStore.ai(kind,'deal',d.id,aiInput(d,kind)).then(s=>{const cur=AIR.get(key)||{};cur[slot]=s.suggestion||{};cur.err='';AIR.set(key,cur);}).catch(err=>{const cur=AIR.get(key)||{};cur.err=String(err.message||err);AIR.set(key,cur);}).finally(()=>{AIB.delete(bk);rerender();});
 }
 function rerender(){try{apply();}catch(e){}}
 function onClick(e){
  const b=e.target.closest('#detailView [data-dk]');if(!b)return;const d=root.CUR_DETAIL?.item;if(!d)return;const a=b.dataset.dk,c=changeOf(d);
  if(a==='toggle'){root.G.dkOpen=root.G.dkOpen||{};root.G.dkOpen[d.id]=!root.G.dkOpen[d.id];return rerender();}
  if(a==='check'&&c){toggleCheck(d,c,Number(b.dataset.i));return rerender();}
  if(a==='first'&&c){prefill(firstResponseText(d,c));return;}
  if(a==='ai-next')return askAi(d,'next_action');
  if(a==='ai-call')return askAi(d,'call_opener');
  if(a==='ai-next-use'){const nx=(AIR.get(String(d.id))||{}).next;if(nx)prefill('다음 행동: '+nx.what+' ('+nx.how+', '+(nx.days===0?'오늘':nx.days+'일 뒤')+') — '+nx.why);return;}
  if(a==='ai-call-copy'){const co=(AIR.get(String(d.id))||{}).call;if(!co)return;const done=()=>toast('첫마디를 복사했습니다');try{const p=navigator.clipboard&&navigator.clipboard.writeText(co.opener);if(p&&p.then)p.then(done).catch(done);else done();}catch(err){done();}return;}
 }
 /* ④ 연락처 등록 패널: 휴대폰을 적으면 다른 현장의 같은 사람(같은 번호) 안내 */
 function knownPerson(digits,d){
  if(!digits||digits.length<10||typeof root.contactExistingDeals!=='function')return null;
  const others=root.contactExistingDeals(digits).filter(x=>String(x.id)!==String(d.id));if(!others.length)return null;
  const o=others.sort((a,b)=>String(b.updated||b.created||'').localeCompare(String(a.updated||a.created||'')))[0],ci=root.contactInfo(o,root.itemPatch(o,'deal'))||{};
  let quotes=0;try{quotes=(root.execQuoteVersions?root.execQuoteVersions(o):[]).length;}catch(e){}
  const visits=acts(o).filter(a=>String(a.type||'')==='방문').length,calls=acts(o).filter(a=>String(a.type||'')==='전화').length;
  return {name:ci.name||'',role:ci.role||'관리소장',site:o.site||'',stage:root.stageLabel(root.dealStage(o)),quotes,visits,calls,work:root.dealWorkSummary?root.dealWorkSummary(o):'',n:others.length};
 }
 function onInput(e){
  if(e.target.id!=='qc-mobile')return;const panel=e.target.closest('#ddvPanel.dp-contact');if(!panel)return;const d=root.CUR_DETAIL?.item;if(!d)return;
  const digits=e.target.value.replace(/\D/g,'');panel.querySelector('.dk-known')?.remove();
  const k=knownPerson(digits,d);if(!k)return;
  const box=el('div','dk-known','<b>기존 고객 관계가 있습니다</b><div><strong>'+h(k.name||'이름 미기록')+' '+h(k.role)+'</strong><span>이전 근무: '+h(k.site)+(k.n>1?' 외 '+(k.n-1)+'곳':'')+'</span></div><p>과거 진행 · '+h(k.work&&!/미분류|미기록/.test(k.work)?k.work+' · ':'')+'견적 '+k.quotes+'회 · 방문 '+k.visits+'회 · 통화 '+k.calls+'회 · '+h(k.stage)+' 단계까지</p><small>같은 휴대폰 번호는 같은 사람으로 이어집니다 — 저장하면 이 현장의 담당자로 등록되고 과거 관계는 그 사람 기록에 남습니다.</small><button type="button" data-dk-fill="1">이 사람으로 채우기</button>');
  box.querySelector('[data-dk-fill]').onclick=()=>{const nm=panel.querySelector('#qc-name');if(nm&&!nm.value)nm.value=k.name;const role=panel.querySelector('#qc-role');if(role&&k.role){role.value=k.role;panel.querySelectorAll('[data-chips="role"] button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===k.role)));}toast('이름 · 역할을 채웠습니다 — 저장 전에 확인해 주세요');};
  e.target.closest('.dp-two,section,label')?.after(box);
 }
 function apply(){
  const view=$('detailView'),d=root.CUR_DETAIL?.item;if(!enabled()||!view||!view.classList.contains('ddv')||!d||root.CUR_DETAIL.kind!=='deal')return;
  const closed=!!d.outcome||d.lifecycle_status==='closed';
  left(view,d);center(view);right(view,d,closed);
 }
 function boot(){
  const da=root.DetailActions;if(!da||typeof da.decorate!=='function'||da.decorate.__dk)return;
  const old=da.decorate;const wrapped=function(){const r=old.apply(da,arguments);try{apply();}catch(e){console.warn('[담당자 관계 이력]',e);}return r;};wrapped.__dk=true;da.decorate=wrapped;
  document.addEventListener('click',onClick,true);document.addEventListener('input',onInput);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.DealKeyman={enabled,changeOf,apply,knownPerson,CHECKS};
})(window);
