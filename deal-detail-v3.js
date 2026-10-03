/* 영업건 상세보기 정리 (2026-10-03 디자인 핸드오프 'design_handoff_detail_panel') — 상세 창만. 목록 · 공통 틀은 건드리지 않는다.
   원칙: 같은 사람 · 같은 항목 · 같은 버튼은 한 번만 / 오른쪽은 항상 '지금 할 일'(다른 화면으로 바뀌지 않음) / 카드 하나에 주 버튼 하나.
   왼쪽(카드 없이 한 면 · 가는 선): ① 관리소장(전화는 여기 하나) ② 같은 현장 다른 영업(항상 펼침) ③ 현장 정보(칸 클릭 = 그 자리 수정) ④ 자료(한 줄 + 그 자리 펼침) ⑤ 다른 연락처(전화 버튼 없음)
   오른쪽: ① 지금 할 일(검은 테두리 · 관리소장 변경 확인 · 추천 다음 행동 · AI는 이 카드 안) ② 이 단계 필수 정보(왼쪽과 겹치는 항목 제외) ③ 단계 바꾸기. 'AI 판단' 카드는 없앤다.
   수정 창은 새로 만들지 않는다 — 기존 패널(연락처 · 공종 · 관리정보 · 금액 · 자료 = DealPanelsV2 / DetailActions)이 오른쪽을 덮던 것을 **누른 자리 아래로 옮겨 펼친다**. 저장 경로는 전부 기존 그대로.
   끄기: G.dealDetailV3Off=true → 상세 v2 모양. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const el=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n;};
 const enabled=()=>!root.G.dealDetailV3Off&&!root.G.dealDetailV2Off;
 const view=()=>$('detailView');
 const ymd=v=>String(v||'').slice(0,10),md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(ymd(v));return m?Number(m[2])+'/'+Number(m[3]):'';};
 let pending=null;/* {slot, at} — 방금 누른 자리 */
 const want=slot=>{pending={slot,at:Date.now()};};
 const patchOf=d=>root.itemPatch(d,'deal')||{};
 /* ── 값 읽기 ── */
 function contacts(d){
  const p=patchOf(d),ci=root.contactInfo(d,p)||{};let list=[];try{list=root.siteContacts(d,p)||[];}catch(e){}
  const kOf=c=>String(c.personKey||(root.phoneN(c.mobile)?'mobile:'+root.phoneN(c.mobile):''));
  const key=kOf(ci),full=list.find(x=>kOf(x)===key)||ci;
  const prev=x=>x.status==='previous'||/이전 소장/.test(String(x.role||''));
  return {ci,key,full,others:list.filter(x=>kOf(x)!==key&&!prev(x)),has:!!(ci.name||ci.mobile)};
 }
 function related(d){
  const sid=String(d.cleanup_site_id||d.site_id||d.siteId||''),ns=root.normSite(d.site||'');
  return (root.B.deals||[]).filter(x=>String(x.id)!==String(d.id)&&(sid?String(x.cleanup_site_id||x.site_id||x.siteId||'')===sid:!!ns&&root.normSite(x.site||'')===ns))
   .sort((a,b)=>String(b.closed_at||b.created||'').localeCompare(String(a.closed_at||a.created||''))).slice(0,8);
 }
 function siteFields(d){
  const p=root.currentPatch?root.currentPatch():{},contexts=d.stage_contexts||p.stage_contexts||{},code=root.dealStage(d),f=Object.assign({},...Object.values(contexts).map(c=>c?.fields||{}),contexts[code]?.fields||{});
  const work=root.dealWorkSummary(d),amt=Number(d.amount??d.amt??0),plan=f.construction_plan||d.construction_year||d.constructionYear||f.expected_contract||f.start_date||'';
  return [['공종',work&&!/미분류|미기록/.test(work)?work:'','work'],['고객 반응',f.customer_reaction||f.reaction||d.customer_reaction||'','info'],['의사결정자',f.decision_maker||d.decision_maker||'','info'],['경쟁사',f.competitor||d.competitor||'','info'],['예상 금액',amt>0?root.fmtAmt(amt):'','amount'],['공사 예정',plan||'','info']];
 }
 const LEFT_LABELS=['공종','고객 반응','의사결정자','경쟁사','예상 금액','예상금액','공사 예정'];
 function fileCounts(d){let files=[],quotes=[];try{files=d.id?root.execAttachments(d):[];quotes=d.id?root.execQuoteVersions(d):[];}catch(e){}const photos=files.filter(x=>/^image\//.test(x.mime_type||'')).length;return {photos,quotes:quotes.length,etc:Math.max(0,files.length-photos)};}
 /* 단계별 B안의 첫 사유 = 추천 다음 행동(규칙 — AI 표식 없음) */
 function ruleHint(d){try{const P=root.PipelineStageB,key=String(d.id||root.dealKey(d)),row=root.PipelineWorkspace.rows({unscoped:true}).find(r=>r.key===key);if(!P||!row||!P.CFG[row.group])return null;const it=P.model(row.group,[row]).items[0];if(!it||!it.first)return null;const rs=P.CFG[row.group].RS[it.first];return {why:rs[0],todo:rs[3],red:rs[1]==='#d93a3a'};}catch(e){return null;}}
 /* ── 왼쪽 ── */
 function leftHtml(d,closed){
  const C=contacts(d),ci=C.ci,chg=root.DealKeyman&&root.DealKeyman.enabled()?root.DealKeyman.changeOf(d):null,rel=related(d),F=siteFields(d),fc=fileCounts(d);
  const consent=C.full.sendBlocked?['문자 수신 거부','bad']:C.full.smsConsent?['문자 수신 동의','ok']:['문자 동의 미확인','warn'];
  const mgr=C.has
   ?'<div class="dv3-who"><span class="dv3-av">'+h((ci.name||'관').slice(0,1))+'</span><div><small>'+h(ci.role||'관리소장')+'</small><b>'+h(ci.name||'이름 미입력')+'</b></div></div>'
    +'<b class="dv3-tel'+(ci.mobile?'':' none')+'">'+h(ci.mobile?root.phoneFmt(ci.mobile):'휴대폰 미입력')+'</b>'
    +(chg?'<div class="dv3-chgnote"><b>⚠ '+h(md(chg.date)||'날짜 미기록')+' 관리소장 변경</b><span>이전: '+h(chg.prevName||'이름 미기록')+(chg.after?' · 변경 후 응대 '+chg.after+'건':' · 변경 후 첫 응대 전')+'</span></div>':'')
    +'<div class="dv3-acts"><button type="button" class="fill" data-dv3="call"'+(ci.mobile?'':' disabled')+'>전화</button><button type="button" data-dv3="sms"'+(ci.mobile?'':' disabled')+'>문자</button><button type="button" data-dv3="editc" data-key="'+attr(C.key)+'"'+(closed?' disabled':'')+'>수정</button></div>'
    +'<div class="dv3-chips"><button type="button" class="'+consent[1]+'" data-dv3="editc" data-key="'+attr(C.key)+'">'+h(consent[0])+'</button>'+(closed?'':'<button type="button" class="plain" data-dv3="replace">소장이 바뀌었어요</button>')+'</div>'
   :'<div class="dv3-who"><span class="dv3-av none">?</span><div><small>관리소장</small><b class="none">아직 등록된 담당자가 없습니다</b></div></div><div class="dv3-acts"><button type="button" class="fill" data-dv3="addc" data-slot="mgr"'+(closed?' disabled':'')+'>연락처 등록</button></div>';
  const tag=x=>root.isWon(x)?['수주','won']:root.isOpen(x)?['진행','open']:['실주','lost'];
  const relHtml=rel.length?rel.map(x=>{const t=tag(x),w=root.dealWorkSummary(x),what=w&&!/미분류|미기록/.test(w)?w:root.stageLabel(root.dealStage(x)),yr=ymd(x.closed_at||x.contract_date||x.created).slice(0,4),amt=root.isWon(x)?(root.hasWonAmt(x)?root.fmtAmt(root.wonAmt(x)):''):(Number(x.amount??x.amt??0)>0?root.fmtAmt(Number(x.amount??x.amt)):'');
    return '<button type="button" class="dv3-rel" data-dv3="rel" data-id="'+attr(x.id)+'"><em class="'+t[1]+'">'+t[0]+'</em><span><b>'+h(what)+'</b><small>'+h([yr,root.repN(x.assignee)||'미배정',amt].filter(Boolean).join(' · '))+'</small></span><i>›</i></button>';}).join(''):'<p class="dv3-none">이 현장의 다른 영업건이 없습니다</p>';
  const fields=F.map(([k,v,kind])=>'<div class="dv3-row"><span>'+h(k)+'</span>'+(closed?'<b class="'+(v?'':'empty plain')+'">'+h(v||'미입력')+'</b>':'<button type="button" class="dv3-val'+(v?'':' empty')+'" data-dv3="'+kind+'">'+h(v||'미입력')+'</button>')+'</div>').join('');
  const others=C.others.length?C.others.map(c=>{const k=String(c.personKey||(root.phoneN(c.mobile)?'mobile:'+root.phoneN(c.mobile):'')),tel=root.phoneN(c.mobile);return '<div class="dv3-other"><button type="button" class="nm" data-dv3="editc" data-slot="others" data-key="'+attr(k)+'"'+(closed?' disabled':'')+'>'+h(c.name||'이름 미입력')+'</button><span>'+h(c.role||'담당자')+'</span><i></i>'+(tel?'<a href="tel:'+attr(tel)+'">'+h(root.phoneFmt(c.mobile))+'</a>':'<span class="empty">번호 없음</span>')+'</div>';}).join(''):'<p class="dv3-none">다른 연락처가 없습니다</p>';
  const slot=n=>'<div class="dv3-slot" data-slot="'+n+'"></div>';
  return '<section class="dv3-sec dv3-mgr">'+mgr+slot('mgr')+'</section>'
   +'<section class="dv3-sec"><header><b>같은 현장 다른 영업</b><span>'+rel.length+'건'+(rel.length?' · 누르면 그 건이 열림':'')+'</span></header>'+relHtml+'</section>'
   +'<section class="dv3-sec"><header><b>현장 정보</b><i></i>'+(closed?'':'<small>누르면 바로 수정</small>')+'</header>'+fields+slot('site')+'</section>'
   +'<section class="dv3-sec"><header><b>자료</b><span>사진 '+fc.photos+' · 견적서 '+fc.quotes+' · 기타 '+fc.etc+'</span><i></i><button type="button" class="lnk" data-dv3="files">자료 보기</button></header>'+slot('files')+'</section>'
   +'<section class="dv3-sec"><header><b>다른 연락처</b><span>'+C.others.length+'명</span><i></i>'+(closed?'':'<button type="button" class="lnk" data-dv3="addc" data-slot="others">+ 추가</button>')+'</header>'+others+slot('others')+'</section>';
 }
 function buildLeft(v,d,closed){
  const left=v.querySelector('.dw-left');if(!left)return;
  const old=left.querySelector(':scope>.dv3-left'),keep=old?[...old.querySelectorAll('.dv3-slot')].map(s=>[s.dataset.slot,[...s.children]]).filter(x=>x[1].length):[];
  const box=el('div','dv3-left',leftHtml(d,closed));
  keep.forEach(([name,nodes])=>{const s=box.querySelector('.dv3-slot[data-slot="'+name+'"]');if(s)nodes.forEach(n=>s.append(n));});
  if(old)old.remove();left.prepend(box);
  const keepTop=[...left.querySelectorAll(':scope>.dw-asset-back')];keepTop.forEach(n=>left.prepend(n));
  [...left.children].forEach(n=>{if(n!==box&&!keepTop.includes(n))n.classList.add('dv3-old');});
  syncFilesLabel(v);
 }
 const syncFilesLabel=v=>{const b=v.querySelector('.dv3-left [data-dv3="files"]'),t=v.querySelector('.dv3-slot[data-slot="files"]>*')?'접기':'자료 보기';if(b&&b.textContent!==t)b.textContent=t;};
 /* ── 오른쪽 ── */
 function ensureSlot(after,name){if(!after)return;const nx=after.nextElementSibling;if(nx&&nx.classList.contains('dv3-slot')&&nx.dataset.slot===name)return;after.parentElement.querySelectorAll(':scope>.dv3-slot[data-slot="'+name+'"]').forEach(n=>{if(!n.children.length)n.remove();});const s=el('div','dv3-slot');s.dataset.slot=name;after.after(s);}
 function buildRight(v,d,closed){
  const r=v.querySelector('.dw-right');if(!r)return;
  const now=r.querySelector('#nowCard'),chg=root.DealKeyman&&root.DealKeyman.enabled()?root.DealKeyman.changeOf(d):null;
  r.querySelectorAll(':scope>.dk-now').forEach(n=>n.classList.add('dv3-old'));
  if(now){
   now.classList.add('dv3-now');
   now.querySelector('.dv3-chg')?.remove();now.querySelector('.dv3-hint')?.remove();
   const anchor=now.querySelector('.nc-cta')||null;
   /* 관리소장 변경 뒤 첫 응대 전: 이 카드가 재확인 카드가 된다(확인 4가지 = 이 PC 표시, 서버에는 첫 응대 기록으로) */
   if(chg&&!chg.after&&!closed){
    const done=((patchOf(d).keymanChecks||{}).date===chg.date&&(patchOf(d).keymanChecks||{}).items)||[],CH=root.DealKeyman.CHECKS;
    const box=el('div','dv3-chg','<b>관리소장 변경 후 기존 견적 · 공법 조건 재확인</b><span>새 소장('+h(chg.curName||'미등록')+')과 첫 응대 → 아래 4가지 확인</span>'+CH.map((t,i)=>'<button type="button" data-dk="check" data-i="'+i+'" aria-pressed="'+!!done[i]+'"><i>'+(done[i]?'✓':'')+'</i>'+h(t)+'</button>').join('')+'<button type="button" class="lnk" data-dk="first">변경 후 첫 응대 문구를 기록칸에 넣기</button>');
    now.insertBefore(box,now.querySelector('.nc-todo')||anchor);now.classList.add('dv3-haschg');
   }else now.classList.remove('dv3-haschg');
   /* AI: 따로 있던 'AI 판단' 카드를 이 카드 안으로 */
   const ai=r.querySelector('.dk-ai');
   if(ai&&ai.parentElement!==now){ai.classList.add('dv3-ai');const h3=ai.querySelector('header h3');if(h3)h3.textContent='AI 추천 다음 행동';now.insertBefore(ai,anchor);}
   if(!ai&&!closed){const hint=ruleHint(d);if(hint){now.insertBefore(el('div','dv3-hint','<span>추천 다음 행동'+(hint.red?' · <em>'+h(hint.why)+'</em>':' · '+h(hint.why))+'</span><b>'+h(hint.todo)+'</b>'),anchor);}}
   const cta=now.querySelector('.nc-cta');
   if(cta){[...cta.querySelectorAll('button')].forEach(b=>{if(/^다음 할 일 · 날짜$/.test(b.textContent.trim())){b.textContent='연락 없이 다음 할 일만 정하기';b.classList.add('dv3-sub');}});}
   ensureSlot(now,'now');
  }
  /* 이 단계 필수 정보: 왼쪽 '현장 정보'와 겹치는 항목은 뺀다 */
  const sum=r.querySelector('.da-stage-summary');
  if(sum){
   const h3=sum.querySelector('h3');let miss=0,shown=0;
   sum.querySelectorAll('dl>dt').forEach(dt=>{const dd=dt.nextElementSibling,dup=LEFT_LABELS.includes(dt.textContent.trim());dt.classList.toggle('dv3-old',dup);if(dd&&dd.tagName==='DD')dd.classList.toggle('dv3-old',dup);if(!dup){shown++;if(dd&&(dd.querySelector('.da-fill')||dd.classList.contains('da-empty')||/미입력/.test(dd.textContent)))miss++;}});
   if(h3){h3.innerHTML='이 단계 필수 정보'+(miss?' <span class="dv3-miss">미입력 '+miss+'</span>':'');}
   sum.classList.toggle('dv3-old',!shown);
   ensureSlot(sum,'stage');
  }
  const sw=r.querySelector('.ddv-switch');if(sw)ensureSlot(sw,'move');
 }
 /* ── 패널을 누른 자리로 ── */
 const MAP={contact:'mgr',work:'site',info:'site',management:'site',amount:'site',materials:'files',stagefields:'stage',stage:'move',owner:'move'};
 function relocate(n){
  const v=view();if(!v||!v.classList.contains('dv3')||!n.isConnected)return;
  if(n.classList.contains('dv3-inline')&&n.parentElement&&n.parentElement.classList.contains('dv3-slot'))return;
  const key=n.id==='detailAction'?String(root.DetailActions.active||''):((n.className.match(/\bdp-(\w+)/)||[])[1]||'result');
  let slot=null;
  if(pending&&Date.now()-pending.at<8000){slot=v.querySelector('.dv3-slot[data-slot="'+pending.slot+'"]');}
  pending=null;
  if(!slot)slot=v.querySelector('.dv3-slot[data-slot="'+(MAP[key]||'now')+'"]')||v.querySelector('.dv3-slot[data-slot="now"]');
  if(!slot)return;
  const act=document.activeElement,had=act&&n.contains(act);
  n.classList.add('dv3-inline');slot.append(n);
  v.querySelector('.dw-right')?.classList.remove('ddv-covered');
  if(n.id==='detailAction')[...v.children].forEach(c=>{c.inert=false;});
  if(had)try{act.focus({preventScroll:true});}catch(e){}
  try{n.scrollIntoView({block:'nearest'});}catch(e){}
  syncFilesLabel(v);
 }
 function closeIn(slotName){
  const v=view(),s=v&&v.querySelector('.dv3-slot[data-slot="'+slotName+'"]'),p=s&&s.firstElementChild;if(!p)return false;
  if(p.id==='detailAction')root.DetailActions.close();else if(root.DealPanelsV2)root.DealPanelsV2.close();else p.remove();
  syncFilesLabel(v);return true;
 }
 function onClick(e){
  const b=e.target.closest('#detailView.dv3 [data-dv3]');if(!b||b.disabled)return;const d=root.CUR_DETAIL?.item;if(!d)return;const a=b.dataset.dv3;
  if(a==='call'){try{root.contactDial('mobile');}catch(err){}return;}
  if(a==='sms'){try{root.contactSms();}catch(err){}return;}
  if(a==='rel'){const x=(root.B.deals||[]).find(z=>String(z.id)===String(b.dataset.id));if(x){root.G._detailPopup=true;root.drwDeal(JSON.stringify(x));}return;}
  if(a==='editc'||a==='addc'||a==='replace'){
   const slot=b.dataset.slot||'mgr';if(closeIn(slot)&&a!=='replace')return;want(slot);
   try{if(a==='editc'&&b.dataset.key)root.openQuickContact('edit',b.dataset.key);else root.openQuickContact('new');}catch(err){}
   if(a==='replace')setTimeout(()=>{const r=document.querySelector('#ddvPanel.dp-contact [data-dp="replace"]');if(r&&r.getAttribute('aria-pressed')!=='true')r.click();},150);
   return;
  }
  if(a==='work'||a==='info'||a==='amount'){
   if(closeIn('site'))return;want('site');
   if(a==='work')root.openWorkEdit?.();
   else if(a==='amount')root.DetailActions.open('amount');
   else if(!root.DealPanelsV2?.open('info'))root.DetailActions.open('management');
   return;
  }
  if(a==='files'){if(closeIn('files'))return;want('files');root.DetailActions.open('materials');return;}
 }
 function cleanup(v){v.classList.remove('dv3');v.querySelectorAll('.dv3-left').forEach(n=>n.remove());v.querySelectorAll('.dv3-old').forEach(n=>n.classList.remove('dv3-old'));v.querySelectorAll('.dv3-chg,.dv3-hint').forEach(n=>n.remove());v.querySelectorAll('.dv3-slot').forEach(n=>{if(!n.children.length)n.remove();});}
 function apply(){
  const v=view(),cur=root.CUR_DETAIL;if(!v)return;
  if(!enabled()||!v.classList.contains('ddv')||!cur||cur.kind!=='deal'){if(v.classList.contains('dv3'))cleanup(v);return;}
  const d=cur.item,closed=!!d.outcome||d.lifecycle_status==='closed';
  v.classList.add('dv3');
  if(!v.__dv3){v.__dv3=true;new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)if(n.nodeType===1&&(n.id==='ddvPanel'||n.id==='detailAction'))relocate(n);syncFilesLabel(v);}).observe(v,{childList:true,subtree:true});}
  buildLeft(v,d,closed);buildRight(v,d,closed);
 }
 document.addEventListener('click',onClick);
 root.DealDetailV3={enabled,apply,related,siteFields};
})(window);
