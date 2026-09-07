(function(){
 'use strict';
 const F=window.ExpansionFlow, pending=new Set();
 const h=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const find=id=>expansionRecords().find(r=>r.id===String(id));
 const events=r=>(B.expansion_events||[]).filter(e=>String(e.source_opportunity_id)===r.sourceOpportunityId);
 const receipts=r=>(B.expansion_quote_dispatches||[]).filter(x=>String(x.source_opportunity_id)===r.sourceOpportunityId&&x.status==='sent'&&x.sent_at&&x.quote_version_id);
 function button(r,text,action,primary){return '<button data-id="'+h(r.id)+'" onclick="'+action+'(this.dataset.id)"'+(primary?' class="primary"':'')+'>'+text+'</button>'}
 function recordYear(r){const d=expansionSourceDeal(r)||{},v=r.completionDate||d.completionDate||d.completion_date||d.closed||d.closed_at||d.updated||'';return Number(String(v).slice(0,4))||0}
 function yearMatch(r,value,current){const y=recordYear(r);return value==='전체'||(!value&&y===current)||value==='이전'&&y&&y<2024||Number(value)===y}
 function ownerSummary(rows){const statuses=['관리대상','접촉예정','관계관리','니즈확인','Pipeline 전환'],owners=[...new Set(rows.map(r=>r.owner||'미배정'))].sort();return '<div class="exp-owner-summary"><div class="exp-owner-row head"><span>담당자</span>'+statuses.map(s=>'<span>'+h(s)+'</span>').join('')+'<span>전체</span></div>'+owners.map(owner=>{const mine=rows.filter(r=>(r.owner||'미배정')===owner);return '<button class="exp-owner-row '+(G.expansionOwner===owner?'on':'')+'" data-owner="'+h(owner)+'" onclick="G.expansionOwner=this.dataset.owner;G.expansionPage=1;paintExpansion()"><strong>'+h(owner)+'</strong>'+statuses.map(s=>'<span>'+mine.filter(r=>F.status(r)===s).length+'</span>').join('')+'<b>'+mine.length+'</b></button>'}).join('')+'</div>'}
 function render(){
  const root=document.getElementById('expansion-root');if(!root)return;
  const all=expansionRecords(),current=new Date().getFullYear(),year=G.expansionYear||String(current),yearRows=all.filter(r=>yearMatch(r,year,current)),active=yearRows.filter(r=>!F.converted(r)&&F.status(r)!=='보류'),due=active.filter(r=>daysTo(r.nextContactAt)!=null&&daysTo(r.nextContactAt)<=0),made=yearRows.filter(F.converted),owners=['전체',...new Set(yearRows.map(r=>r.owner||'미배정'))],filter=G.expansionPoolFilter||'전체',query=String(G.expansionQuery||'').trim().toLowerCase();
  const rows=yearRows.filter(r=>(!G.expansionOwner||G.expansionOwner==='전체'||G.expansionOwner===(r.owner||'미배정'))&&(!query||[r.site,r.owner,r.sourceWorkSummary,r.needNote].join(' ').toLowerCase().includes(query))&&(filter==='전체'||(filter==='__due__'?!F.converted(r)&&daysTo(r.nextContactAt)!=null&&daysTo(r.nextContactAt)<=0:F.status(r)===filter))),page=Math.max(1,Number(G.expansionPage)||1),visible=rows.slice(0,page*20);
  const badge=document.getElementById('expansionBadge');if(badge){badge.textContent=due.length||'';badge.style.display=due.length?'':'none'}
  const yearTabs=['전체',String(current),String(current-1),String(current-2),'이전'];
  root.innerHTML='<section class="exp-command"><div class="eyebrow">기존 수주고객 · 재영업 시점 관리</div><h2>과거 거래는 보존하고, 다음 기회를 찾습니다</h2><p>연도 선택 → 담당자 선택 → 해당 현장 확인. 전환 이후 영업은 Pipeline에서만 관리합니다.</p><div class="exp-kpis">'+[['선택기간 거래',yearRows.length],['접촉기한 도래',due.length],['니즈확인',active.filter(r=>F.status(r)==='니즈확인').length],['Pipeline 전환',made.length]].map(x=>'<div class="exp-kpi"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div></section><nav class="exp-year-tabs" aria-label="확장관리 연도">'+yearTabs.map(y=>'<button data-v="'+h(y)+'" class="'+(String(year)===y?'on':'')+'" title="'+h(y==='이전'?'2023년 이전 거래':y+'년 거래')+'" onclick="G.expansionYear=this.dataset.v;G.expansionOwner=\'전체\';G.expansionPage=1;paintExpansion()">'+h(y)+'</button>').join('')+'</nav>'+ownerSummary(yearRows)+'<div class="exp-toolbar"><label>담당자 <select title="선택한 담당자의 확장관리 현장만 표시합니다." onchange="G.expansionOwner=this.value;G.expansionPage=1;paintExpansion()">'+owners.map(o=>'<option '+((G.expansionOwner||'전체')===o?'selected':'')+'>'+h(o)+'</option>').join('')+'</select></label><label>상태 <select title="확장관리 상태로 목록을 좁힙니다." onchange="G.expansionPoolFilter=this.value;G.expansionPage=1;paintExpansion()">'+['전체',...F.statuses].map(s=>'<option '+(s===(filter==='__due__'?'전체':filter)?'selected':'')+'>'+h(s)+'</option>').join('')+'</select></label><label>다음 접촉일 <select title="접촉 기한 도래 현장만 빠르게 확인합니다." onchange="G.expansionPoolFilter=this.value===\'도래\'?\'__due__\':\'전체\';G.expansionPage=1;paintExpansion()"><option '+(filter==='__due__'?'':'selected')+'>전체</option><option value="도래" '+(filter==='__due__'?'selected':'')+'>오늘·기한초과</option></select></label><label class="exp-search">검색 <span><input value="'+h(G.expansionQuery||'')+'" placeholder="현장·담당자·공종" onkeydown="if(event.key===\'Enter\'){G.expansionQuery=this.value;G.expansionPage=1;paintExpansion()}"><button onclick="G.expansionQuery=this.previousElementSibling.value;G.expansionPage=1;paintExpansion()">검색</button></span></label><span class="hint">선택 결과 '+rows.length+'건 · 20건씩 표시</span></div><div class="exp-pool-list">'+(visible.map(card).join('')||'<p class="exp-empty">선택한 조건의 고객이 없습니다.</p>')+'</div>'+(visible.length<rows.length?'<div class="exp-more"><button onclick="G.expansionPage='+(page+1)+';paintExpansion()">다음 20건 더보기 · '+visible.length+' / '+rows.length+'</button></div>':'');
 }
 function card(r){
  const d=expansionSourceDeal(r)||{},done=F.converted(r),history=events(r),contract=d.contract_date||d.contractDate||d.advisory&&d.advisory.contract_date||'미기록';
return '<article class="exp-pool-card"><header><h3>'+h(r.site)+'</h3><strong>'+F.status(r)+(done?' 완료':'')+'</strong></header><dl>'+[['기존 수주 공종',r.sourceWorkSummary],['수주금액',fmtAmt(r.wonAmount)],['계약일',String(contract).slice(0,10)],['준공일',r.completionDate||'미기록'],['당시 영업담당',repN(d.assignee)||r.owner]].map(x=>'<div><dt>'+x[0]+'</dt><dd>'+h(x[1])+'</dd></div>').join('')+'</dl><p class="exp-note">'+(r.needNote?'확인한 니즈: '+h(r.needNote):'확장 후보(추천): '+r.candidates.map(h).join(' · '))+'</p><details><summary>확장관리 이력 · '+history.length+'건</summary><ol>'+history.map(e=>'<li>'+h(fmtD(e.occurred_at||e.created_at))+' · '+h(e.kind)+' · '+h(e.note)+' <small>'+h(e.actor)+'</small></li>').join('')+'</ol>'+(!history.length?'<p>불러온 확장관리 이력이 없습니다. 서버 이력을 확인해 주세요.</p>':'')+button(r,'서버 이력 확인','ExpansionPool.refresh')+'</details>'+(done?'<div class="exp-readonly">이 확장관리 건은 종료되었습니다. 과거 거래·접촉 이력은 읽기 전용으로 보존합니다.</div><footer>'+button(r,'새 Pipeline 열기 →','ExpansionPool.openPipeline',true)+'</footer>':'<footer><label>다음 접촉 <input aria-label="'+h(r.site)+' 다음 접촉일" type="date" data-id="'+h(r.id)+'" value="'+h(r.nextContactAt)+'" onchange="expansionSetNext(this.dataset.id,this.value)"></label><select aria-label="'+h(r.site)+' 확장관리 상태" data-id="'+h(r.id)+'" onchange="expansionSetStatus(this.dataset.id,this.value)">'+F.statuses.filter(s=>s!=='Pipeline 전환').map(s=>'<option '+(F.status(r)===s?'selected':'')+'>'+s+'</option>').join('')+'</select>'+button(r,'전화','expansionCall')+button(r,'문자','ExpansionPool.sms')+button(r,'카카오','ExpansionPool.kakao')+button(r,'접촉·니즈 기록','ExpansionPool.note')+button(r,'견적 발송 확인·전환','expansionOpenNew',true)+'</footer>')+'</article>';
 }
 function openPipeline(id){const r=find(id),d=r&&(B.deals||[]).find(d=>String(d.id)===String(r.createdOpportunityId));if(d)drwDeal(JSON.stringify(d));else alert('연결된 새 Pipeline을 현재 데이터에서 찾지 못했습니다. 서버 동기화 후 다시 확인해 주세요. 원 Deal은 다시 열지 않습니다.')}
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
   const response=await fetch(WRITE_API,{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({op:'expansion_quote_convert',write_id:req.idempotency_key,payload:req})});
   const raw=await response.json();if(!response.ok)throw Error(raw.message||'서버 처리 실패');
   const res=F.acknowledged(unwrapExecWrite(raw),req);
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
 window.ExpansionPool={render,prepare,convert,note,openPipeline,historyFor,refresh:id=>refresh(id,true).catch(e=>alert('이력 조회 실패 · '+(e.message||e))),sms:id=>{const r=find(id);if(r&&!F.converted(r))expansionMessage(id,'sms')},kakao:id=>{const r=find(id);if(r&&!F.converted(r))expansionMessage(id,'kakao')}};
})();
