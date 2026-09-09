(function(){
 'use strict';
 const F=window.ExpansionFlow, pending=new Set();
 const h=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const find=id=>expansionRecords().find(r=>r.id===String(id));
 const events=r=>(B.expansion_events||[]).filter(e=>String(e.source_opportunity_id)===r.sourceOpportunityId);
 const receipts=r=>(B.expansion_quote_dispatches||[]).filter(x=>String(x.source_opportunity_id)===r.sourceOpportunityId&&x.status==='sent'&&x.sent_at&&x.quote_version_id);
 function button(r,text,action,primary){return '<button data-id="'+h(r.id)+'" onclick="'+action+'(this.dataset.id)"'+(primary?' class="primary"':'')+'>'+text+'</button>'}
 function ownerSummary(rows){const statuses=['관리대상','접촉예정','관계관리','니즈확인','Pipeline 전환','보류'],owners=[...new Set(rows.map(r=>r.owner||'미배정'))].sort();return '<div class="exp-owner-summary"><div class="exp-owner-row head"><span>담당자</span>'+statuses.map(s=>'<span>'+h(s)+'</span>').join('')+'<span>전체</span></div>'+owners.map(owner=>{const mine=rows.filter(r=>(r.owner||'미배정')===owner);return '<button class="exp-owner-row '+(G.expansionOwner===owner?'on':'')+'" data-owner="'+h(owner)+'" onclick="G.expansionOwner=this.dataset.owner;G.expansionPage=1;paintExpansion()"><strong>'+h(owner)+'</strong>'+statuses.map(s=>'<span>'+mine.filter(r=>F.status(r)===s).length+'</span>').join('')+'<b>'+mine.length+'</b></button>'}).join('')+'</div>'}
 const boardHelp={'관리대상':'첫 접촉 대상을 정리합니다.','접촉예정':'약속한 날짜에 연락합니다.','관계관리':'기존 관계를 이어갑니다.','니즈확인':'새 공사 가능성을 확인합니다.','Pipeline 전환':'새 영업기회로 연결됐습니다.','보류':'재개 조건을 기다립니다.'};
 function dueMeta(r){const n=daysTo(r.nextContactAt);if(!r.nextContactAt)return {cls:'none',text:'다음 접촉 미지정'};if(n<0)return {cls:'late',text:'기한 '+Math.abs(n)+'일 초과'};if(n===0)return {cls:'today',text:'오늘 접촉'};return {cls:'future',text:n+'일 뒤 접촉'}}
 function cardActions(r,done){return done?'<div class="exp-readonly">전환 완료 · 이후 진행은 Pipeline에서 관리합니다.</div><footer>'+button(r,'새 Pipeline 열기 →','ExpansionPool.openPipeline',true)+'</footer>':'<footer><label>다음 접촉 <input aria-label="'+h(r.site)+' 다음 접촉일" type="date" data-id="'+h(r.id)+'" value="'+h(r.nextContactAt)+'" onchange="expansionSetNext(this.dataset.id,this.value)"></label><select aria-label="'+h(r.site)+' 확장관리 상태" data-id="'+h(r.id)+'" onchange="expansionSetStatus(this.dataset.id,this.value)">'+F.statuses.filter(s=>s!=='Pipeline 전환').map(s=>'<option '+(F.status(r)===s?'selected':'')+'>'+s+'</option>').join('')+'</select>'+button(r,'전화','expansionCall')+button(r,'문자','ExpansionPool.sms')+button(r,'카카오','ExpansionPool.kakao')+button(r,'접촉·니즈 기록','ExpansionPool.note')+button(r,'견적 확인·전환','ExpansionPool.startNew',true)+'</footer>'}
 function boardCard(r){
  const d=expansionSourceDeal(r)||{},done=F.converted(r),due=dueMeta(r),history=events(r),work=r.needNote?'확인 니즈 · '+r.needNote:'추천 · '+(r.candidates||[]).join(' · ');
  return '<article class="exp-board-card '+due.cls+'"><button class="exp-board-launch" data-id="'+h(r.id)+'" onclick="ExpansionPool.open(this.dataset.id)" aria-label="'+h(r.site||'현장명 확인 필요')+' 확장관리창 열기"><span class="exp-board-status">'+h(F.status(r))+'</span><h3>'+h(r.site||'현장명 확인 필요')+'</h3><p>'+h(r.sourceWorkSummary||'기존 수주 공종 미기록')+' · '+h(fmtAmt(r.wonAmount))+'</p><div class="exp-board-owner"><strong>'+h(r.owner||repN(d.assignee)||'미배정')+'</strong><em>'+h(due.text)+'</em></div><small>'+h(work||'확장 후보를 확인해 주세요.')+'</small><b class="exp-board-open">관리창 열기 <i aria-hidden="true">↗</i></b><span class="exp-board-history">이력 '+history.length+'건'+(done?' · Pipeline 전환 완료':'')+'</span></button></article>';
 }
 let openId=null,returnFocus=null,previousOverflow='';
 function managerNode(){
  let modal=document.getElementById('expansionManager');if(modal)return modal;
  modal=document.createElement('div');modal.id='expansionManager';modal.className='exp-manage-modal';modal.setAttribute('aria-hidden','true');
  modal.innerHTML='<section class="exp-manage-window" role="dialog" aria-modal="true" aria-labelledby="expansionManagerTitle"><header class="exp-manage-head"><div><span>EXPANSION RELATIONSHIP DESK</span><h2 id="expansionManagerTitle">확장관리</h2><p id="expansionManagerSub">기존 수주 관계에서 다음 영업기회를 관리합니다.</p></div><button class="exp-manage-close" onclick="ExpansionPool.close()" aria-label="확장관리창 닫기">✕</button></header><div class="exp-manage-body" id="expansionManagerBody"></div></section>';
  modal.addEventListener('click',event=>{if(event.target===modal)closeManager()});
  modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeManager()}});
  document.body.appendChild(modal);return modal;
 }
 function managerHTML(r){
  const d=expansionSourceDeal(r)||{},done=F.converted(r),due=dueMeta(r),history=events(r),contract=d.contract_date||d.contractDate||d.advisory&&d.advisory.contract_date||'미기록',work=r.needNote?'확인한 니즈 · '+r.needNote:'추천 확장 · '+(r.candidates||[]).join(' · ');
  const timeline=history.length?history.slice().sort((a,b)=>String(b.occurred_at||b.created_at||'').localeCompare(String(a.occurred_at||a.created_at||''))).map(e=>'<li><time>'+h(fmtD(e.occurred_at||e.created_at))+'</time><span><strong>'+h(e.kind||'확장관리')+'</strong><small>'+h(e.note||'내용 미기록')+(e.actor?' · '+h(e.actor):'')+'</small></span></li>').join(''):'<li class="empty">아직 저장된 접촉·니즈 이력이 없습니다.</li>';
  return '<section class="exp-manage-hero '+due.cls+'"><div><span class="exp-board-status">'+h(F.status(r))+'</span><h3>'+h(r.site||'현장명 확인 필요')+'</h3><p>'+h(r.sourceWorkSummary||'기존 수주 공종 미기록')+' · 수주 '+h(fmtAmt(r.wonAmount))+'</p></div><em>'+h(due.text)+'</em></section><dl class="exp-manage-facts">'+[['현재 담당',r.owner||repN(d.assignee)||'미배정'],['당시 영업담당',repN(d.assignee)||r.owner||'미배정'],['계약일',String(contract).slice(0,10)],['준공일',r.completionDate||'미기록']].map(x=>'<div><dt>'+h(x[0])+'</dt><dd>'+h(x[1])+'</dd></div>').join('')+'</dl><section class="exp-manage-signal"><span>다음 영업 신호</span><strong>'+h(work||'확장 후보를 확인해 주세요.')+'</strong></section><section class="exp-manage-history"><header><h3>접촉·니즈 이력</h3><span>'+history.length+'건</span></header><ol>'+timeline+'</ol></section><section class="exp-manage-actions"><header><h3>이 현장 관리</h3><span>변경 내용은 서버 저장 후 보드에 반영됩니다.</span></header>'+cardActions(r,done)+'</section>';
 }
 function renderManager(){if(!openId)return;const r=find(openId);if(!r){closeManager();return}const modal=managerNode(),title=modal.querySelector('#expansionManagerTitle'),sub=modal.querySelector('#expansionManagerSub'),body=modal.querySelector('#expansionManagerBody');title.textContent=r.site||'현장명 확인 필요';sub.textContent=(r.owner||'미배정')+' 담당 · '+F.status(r);body.innerHTML=managerHTML(r)}
 function openManager(id){const r=find(id);if(!r)return;const modal=managerNode();openId=r.id;returnFocus=document.activeElement;previousOverflow=document.body.style.overflow;renderManager();modal.classList.add('on');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';requestAnimationFrame(()=>modal.querySelector('.exp-manage-close').focus())}
 function closeManager(restoreFocus){const modal=document.getElementById('expansionManager'),focus=returnFocus;if(modal){modal.classList.remove('on');modal.setAttribute('aria-hidden','true')}openId=null;returnFocus=null;document.body.style.overflow=previousOverflow;previousOverflow='';if(restoreFocus!==false&&focus&&focus.isConnected)requestAnimationFrame(()=>focus.focus())}
 function board(rows,statusFilter){
  const statuses=statusFilter==='전체'?F.statuses:[statusFilter],limit=30;
  return '<section class="exp-board" aria-label="확장관리 상태별 업무 보드">'+statuses.map(status=>{const mine=rows.filter(r=>F.status(r)===status),shown=mine.slice(0,limit);return '<div class="exp-board-column" data-status="'+h(status)+'"><header><div><span>'+h(boardHelp[status]||'')+'</span><h3>'+h(status)+'</h3></div><b>'+mine.length+'</b></header><div class="exp-board-stack">'+(shown.map(boardCard).join('')||'<p class="exp-board-empty">현재 조건의 현장이 없습니다.</p>')+'</div>'+(mine.length>limit?'<p class="exp-board-limit">상위 '+limit+'건 표시 · 담당자나 검색으로 좁혀 주세요.</p>':'')+'</div>'}).join('')+'</section>';
 }
 function render(){
  const root=document.getElementById('expansion-root');if(!root)return;
  if(openId)queueMicrotask(renderManager);
  const all=expansionRecords(),current=new Date().getFullYear(),year=G.expansionYear||String(current),yearRows=all.filter(r=>F.yearMatch(r,expansionSourceDeal(r)||{},year,current)),globalActive=all.filter(r=>!F.converted(r)&&F.status(r)!=='보류'),globalDue=globalActive.filter(r=>daysTo(r.nextContactAt)!=null&&daysTo(r.nextContactAt)<=0),active=yearRows.filter(r=>!F.converted(r)&&F.status(r)!=='보류'),made=yearRows.filter(F.converted),owners=['전체',...new Set(yearRows.map(r=>r.owner||'미배정'))],statusFilter=G.expansionStatusFilter||'전체',dueFilter=G.expansionDueFilter||'전체',query=String(G.expansionQuery||'').trim().toLowerCase(),view=G.expansionView||'board';
  const rows=yearRows.filter(r=>(!G.expansionOwner||G.expansionOwner==='전체'||G.expansionOwner===(r.owner||'미배정'))&&(!query||[r.site,r.owner,r.sourceWorkSummary,r.needNote].join(' ').toLowerCase().includes(query))&&(statusFilter==='전체'||F.status(r)===statusFilter)&&(dueFilter==='전체'||!F.converted(r)&&daysTo(r.nextContactAt)!=null&&daysTo(r.nextContactAt)<=0)),pageSize=20,pageCount=Math.max(1,Math.ceil(rows.length/pageSize)),page=Math.min(pageCount,Math.max(1,Number(G.expansionPage)||1)),start=(page-1)*pageSize,visible=rows.slice(start,start+pageSize);
  const badge=document.getElementById('expansionBadge');if(badge){badge.textContent=globalDue.length||'';badge.style.display=globalDue.length?'':'none'}
  const yearTabs=['전체',String(current),String(current-1),String(current-2),'이전'];
  const content=view==='list'?'<div class="exp-pool-list">'+(visible.map(card).join('')||'<p class="exp-empty">선택한 조건의 고객이 없습니다.</p>')+'</div>'+(rows.length>pageSize?'<div class="exp-more"><button '+(page<=1?'disabled':'')+' onclick="G.expansionPage='+(page-1)+';paintExpansion()">← 이전 20건</button><strong>'+page+' / '+pageCount+'</strong><button '+(page>=pageCount?'disabled':'')+' onclick="G.expansionPage='+(page+1)+';paintExpansion()">다음 20건 →</button></div>':''):board(rows,statusFilter);
  root.innerHTML='<section class="exp-command"><div class="eyebrow">기존 수주고객 · 재영업 시점 관리</div><h2>과거 거래는 보존하고, 다음 기회를 찾습니다</h2><p>연도 선택 → 담당자 선택 → 상태별 업무 확인. 전환 이후 영업은 Pipeline에서만 관리합니다.</p><div class="exp-kpis">'+[['선택기간 거래',yearRows.length],['전체연도 기한도래',globalDue.length],['선택기간 니즈확인',active.filter(r=>F.status(r)==='니즈확인').length],['선택기간 전환',made.length]].map(x=>'<div class="exp-kpi"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div></section><nav class="exp-year-tabs" aria-label="확장관리 연도">'+yearTabs.map(y=>'<button data-v="'+h(y)+'" class="'+(String(year)===y?'on':'')+'" title="'+h(y==='이전'?(current-3)+'년 이전 거래':y+'년 거래')+'" onclick="G.expansionYear=this.dataset.v;G.expansionOwner=\'전체\';G.expansionPage=1;paintExpansion()">'+h(y)+'</button>').join('')+'</nav>'+ownerSummary(yearRows)+'<div class="exp-toolbar"><label>담당자 <select title="선택한 담당자의 확장관리 현장만 표시합니다." onchange="G.expansionOwner=this.value;G.expansionPage=1;paintExpansion()">'+owners.map(o=>'<option '+((G.expansionOwner||'전체')===o?'selected':'')+'>'+h(o)+'</option>').join('')+'</select></label><label>상태 <select title="확장관리 상태로 화면을 좁힙니다." onchange="G.expansionStatusFilter=this.value;G.expansionPage=1;paintExpansion()">'+['전체',...F.statuses].map(s=>'<option '+(s===statusFilter?'selected':'')+'>'+h(s)+'</option>').join('')+'</select></label><label>다음 접촉일 <select title="상태 조건을 유지한 채 접촉 기한으로 한 번 더 좁힙니다." onchange="G.expansionDueFilter=this.value;G.expansionPage=1;paintExpansion()"><option value="전체" '+(dueFilter==='전체'?'selected':'')+'>전체</option><option value="도래" '+(dueFilter==='도래'?'selected':'')+'>오늘·기한초과</option></select></label><label class="exp-search">검색 <span><input value="'+h(G.expansionQuery||'')+'" placeholder="현장·담당자·공종" onkeydown="if(event.key===\'Enter\'){G.expansionQuery=this.value;G.expansionPage=1;paintExpansion()}"><button onclick="G.expansionQuery=this.previousElementSibling.value;G.expansionPage=1;paintExpansion()">검색</button></span></label><div class="exp-view-switch" role="group" aria-label="확장관리 보기 방식"><button class="'+(view==='board'?'on':'')+'" aria-pressed="'+(view==='board')+'" onclick="G.expansionView=\'board\';paintExpansion()">▦ 상태 보드</button><button class="'+(view==='list'?'on':'')+'" aria-pressed="'+(view==='list')+'" onclick="G.expansionView=\'list\';paintExpansion()">☷ 상세 목록</button></div><span class="hint">선택 결과 '+rows.length+'건'+(view==='list'?' · '+page+' / '+pageCount+'페이지':' · 상태별 분류')+'</span></div>'+content;
 }
 function card(r){
  const d=expansionSourceDeal(r)||{},done=F.converted(r),history=events(r),contract=d.contract_date||d.contractDate||d.advisory&&d.advisory.contract_date||'미기록';
 return '<article class="exp-pool-card"><header><div><h3>'+h(r.site)+'</h3><small>'+h(F.status(r))+(done?' · Pipeline 전환 완료':'')+'</small></div>'+button(r,'관리창 열기 ↗','ExpansionPool.open',true)+'</header><dl>'+[['기존 수주 공종',r.sourceWorkSummary],['수주금액',fmtAmt(r.wonAmount)],['계약일',String(contract).slice(0,10)],['준공일',r.completionDate||'미기록'],['당시 영업담당',repN(d.assignee)||r.owner]].map(x=>'<div><dt>'+x[0]+'</dt><dd>'+h(x[1])+'</dd></div>').join('')+'</dl><p class="exp-note">'+(r.needNote?'확인한 니즈: '+h(r.needNote):'확장 후보(추천): '+r.candidates.map(h).join(' · '))+'</p><div class="exp-list-history">확장관리 이력 '+history.length+'건 · 현장 관리와 전체 이력은 관리창에서 확인합니다.</div></article>';
 }
 function openPipeline(id){const r=find(id),d=r&&(B.deals||[]).find(d=>String(d.id)===String(r.createdOpportunityId));if(d){closeManager(false);drwDeal(JSON.stringify(d))}else alert('연결된 새 Pipeline을 현재 데이터에서 찾지 못했습니다. 서버 동기화 후 다시 확인해 주세요. 원 Deal은 다시 열지 않습니다.')}
 async function note(id){const r=find(id);if(!r||F.converted(r))return;const note=prompt('확인한 접촉 결과·니즈·견적 요청 내용을 기록하세요.');if(!note||!note.trim())return;try{if(!SB||!TOKEN)throw Error('로그인 후 서버 연결이 필요합니다.');const result=await SB.rpc('crm_expansion_note',{p:{source_opportunity_id:r.sourceOpportunityId,note:note.trim(),request_id:crypto.randomUUID()}});if(result.error)throw result.error;if(!result.data||result.data.ok!==true||!result.data.event)throw Error('서버 저장을 확인하지 못했습니다.');B.expansion_events=(B.expansion_events||[]).concat(result.data.event);render()}catch(e){alert('기록을 저장하지 못했습니다. '+(e.message||e))}}
 async function refresh(id,repaint){
  const r=find(id);if(!r)return;
  if(!SB||!TOKEN)throw Error('로그인 후 서버 연결이 필요합니다.');
  const result=await SB.rpc('crm_expansion_context',{p:{source_opportunity_id:r.sourceOpportunityId}});
  if(result.error)throw result.error;if(!result.data||result.data.ok!==true)throw Error('서버 이력을 확인하지 못했습니다.');
  B.expansion_events=(B.expansion_events||[]).filter(x=>String(x.source_opportunity_id)!==r.sourceOpportunityId).concat(result.data.events||[]);
  B.expansion_quote_dispatches=(B.expansion_quote_dispatches||[]).filter(x=>String(x.source_opportunity_id)!==r.sourceOpportunityId).concat(result.data.dispatches||[]);
  if(repaint)render();
 }
 async function prepare(r){
  let failure='';try{await refresh(r.id,false)}catch(e){failure=String(e.message||e)}
  if(!EXPANSION_NEW_SOURCE||EXPANSION_NEW_SOURCE.sourceOpportunityId!==r.sourceOpportunityId)return;
  const form=document.getElementById('newDealBody'),list=receipts(r),section=document.createElement('section');section.className='exp-proof';
  section.innerHTML='<label for="exp-dispatch">실제 발송된 새 견적</label><select id="exp-dispatch"><option value="">발송이력 선택</option>'+list.map(x=>'<option value="'+h(x.id)+'">'+h(x.quote_title||'견적')+' · '+h(x.sent_at)+' · '+h(x.recipient||'')+'</option>').join('')+'</select><p>'+(list.length?'선택한 견적의 발송상태·공종·금액·받는 사람을 서버에서 다시 검증합니다.':'확인 가능한 발송이력이 없습니다. 새 견적의 실제 발송 성공 기록이 연결된 후 전환할 수 있습니다. 기존 수주 견적이나 문자 발송 버튼 클릭만으로는 전환하지 않습니다.')+'</p><p>유입경로: 기존고객 확장 · 시작 단계: 컨설팅 자료 발송완료<br>이전 거래와 확장 이력은 유지됩니다. 이 화면은 견적서를 직접 보내지 않습니다.</p>';
  form.insertBefore(section,form.querySelector('.dactions'));
  if(failure){const warning=document.createElement('p');warning.textContent='서버 이력 조회 미완료: '+failure;section.appendChild(warning)}
  const save=form.querySelector('button[onclick="saveNewDeal()"]');if(save){save.textContent='Pipeline으로 전환';save.disabled=!list.length}
 }
 async function convert(source,deal,error){
  if(pending.has(source.sourceOpportunityId))return;
  if(!PeopleEligibility.allowed(SALES_PEOPLE_MASTER,'expansion',expansionOwnerContext(source),deal.owner)){error.style.display='block';error.textContent='기존 고객의 조직에 속한 활성 영업담당자를 선택해 주세요.';return}
  const controls=Array.from(document.querySelectorAll('#newDealBody input,#newDealBody select,#newDealBody textarea,#newDealBody button'));
  const disabled=controls.map(x=>x.disabled);
  try{
   const current=find(source.id);if(!current||F.converted(current))throw Error('전환 완료 또는 변경된 고객입니다. 목록을 다시 확인해 주세요.');
   const id=(document.getElementById('exp-dispatch')||{}).value,proof=receipts(current).find(x=>String(x.id)===id);
   const req=F.request(current,deal,{dispatch_id:proof&&proof.id});
   if(!TOKEN)throw Error('로그인 후 서버 연결이 필요합니다.');
   if(!confirm(current.site+' · '+deal.work_summary+' · '+fmtAmt(deal.amount)+' · '+deal.owner+'\n실제 발송된 견적을 기준으로 새 Pipeline을 생성할까요?'))return;
   pending.add(source.sourceOpportunityId);controls.forEach(x=>x.disabled=true);
   if(!Number.isSafeInteger(current.version)||current.version<0)throw Error('확장관리 최신 버전을 불러온 뒤 다시 시도해 주세요.');
   const queued=Phase1.queue.enqueue('expansion_quote_convert',current.sourceOpportunityId,current.version,req);
   await Phase1.queue.flush();
   const saved=Phase1.queue.list().find(x=>x.request_id===queued.request_id);
   if(!saved||saved.status!=='done'||!saved.ack)throw Error(saved&&saved.error||'서버 처리 결과를 확인하지 못했습니다.');
   const res=F.acknowledged(saved.ack,req);
   // Only an explicit transaction ACK may close the pool or add a Deal locally.
   const local=expansionLocalRow(source.id);if(local&&local.local){local.local.createdOpportunityId=res.new_opportunity_id;local.local.status='Pipeline 전환'}
   B.expansion_pool=(B.expansion_pool||[]).filter(r=>expSourceId(r)!==source.sourceOpportunityId).concat(Object.assign({},source,{createdOpportunityId:res.new_opportunity_id,status:'Pipeline 전환'}));
   saveLocal();closeNewDeal();paintExpansion();
   try{await loadData(true)}catch(syncError){alert('Pipeline 전환은 서버에 저장됐습니다. 목록 동기화가 지연되어 새로고침이 필요합니다.');return}
   alert('새 Pipeline으로 전환했습니다. 이후 진행은 새 영업기회에서 관리합니다.');
  }catch(e){if(error){error.style.display='block';error.textContent='전환 미확인 · '+(e.message||e)+' 기존 수주 건은 변경하지 않았습니다.'}}
  finally{pending.delete(source.sourceOpportunityId);controls.forEach((x,i)=>x.disabled=disabled[i])}
 }
 function historyFor(s){const ids=new Set(s.deals.map(d=>String(d.id)));return expansionRecords().filter(r=>ids.has(r.sourceOpportunityId)).flatMap(r=>events(r).map(e=>({at:e.occurred_at||e.created_at,title:'확장관리 · '+e.kind,sub:e.note||''})))}
 window.ExpansionPool={render,prepare,convert,note,open:openManager,close:closeManager,refreshManager:renderManager,startNew:id=>{closeManager(false);expansionOpenNew(id)},openPipeline,historyFor,refresh:id=>refresh(id,true).catch(e=>alert('이력 조회 실패 · '+(e.message||e))),sms:id=>{const r=find(id);if(r&&!F.converted(r)){closeManager(false);expansionMessage(id,'sms')}},kakao:id=>{const r=find(id);if(r&&!F.converted(r)){closeManager(false);expansionMessage(id,'kakao')}}};
})();
