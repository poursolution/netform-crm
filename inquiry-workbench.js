(function(root){
 'use strict';
 const originalPaint=root.paintInq,originalRows=root.inqCtlRows,originalTab=root.inqCtlSetTab,originalScope=root.inqCtlScope,originalBase=root.inqBase;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 let modalKey=null,returnFocus=null,ignoreBrand=false;
 function brands(){return root.SalesFilterState.state().brands}
 function scoped(fn,args){
  const brand=root.G.brand,rep=root.G.rep,query=root.G.q,selected=brands();root.G.brand='전체';root.G.rep='전체';root.G.q='';
  let rows;try{rows=fn.apply(root,args)}finally{root.G.brand=brand;root.G.rep=rep;root.G.q=query}
  const term=String(query||'').toLowerCase(),digits=term.replace(/\D/g,'');
  return rows.filter(q=>(ignoreBrand||root.SalesScope.matches(root.inquiryRoutedOwner(q),q))&&(ignoreBrand||!selected.length||selected.includes(root.inquiryBrandOf(q)))&&(!term||[q.site,q.contact,q.contact_name,q.phone,q.mobile,root.inqCtlContactLabel(q),root.inquirySalesOwner(q),root.inquiryConsultant(q),root.dealWorkSummary(q),q.delete_reason,q.deleteReason].join(' ').toLowerCase().includes(term)||(digits.length>=4&&[q.phone,q.mobile,root.inqCtlContactLabel(q)].join('').replace(/\D/g,'').includes(digits))));
 }
 root.inqCtlScope=function(){return scoped(originalScope,arguments)};
 root.inqBase=function(){return scoped(originalBase,arguments)};
 function delayed(q){const bucket=root.inqCtlBucket(q);if(['영업전환','스토어 이관','보류'].includes(bucket))return false;const a=root.actionObj(q,root.itemPatch(q,'inq')),n=a&&a.due?root.daysTo(a.due):null;return root.inquiryResponseLate(q)||(Number.isFinite(n)&&n<0)}
 root.inqCtlRows=function(){const rows=originalRows.apply(this,arguments);return root.G.inqCompactMetric==='delayed'&&root.G.inqBucket==='전체'?rows.filter(delayed):rows};
 root.inqCtlSetTab=function(tab){root.G.inqCompactMetric='';return originalTab(tab)};
 function set(key){const tabs={all:'전체',unassigned:'미배정',waiting:'배정완료',delayed:'전체'};if(!tabs[key])return;root.G.inqCompactMetric=key==='delayed'?'delayed':'';root.G.inqLegacyView=false;root.G.inqView='console';originalTab(tabs[key])}
 function selectBrand(value){root.SalesFilterState.selectBrand(value);root.G.inqPage=1;root.paint()}
 root.inqBrandChips=function(){let base;ignoreBrand=true;try{base=root.inqCtlScopeActive()}finally{ignoreBrand=false}return root.SalesFilters.controls(base.map(q=>({brand:root.inquiryBrandOf(q),owner:root.inquiryRoutedOwner(q),item:q})))};
 /* 스토어 이관 건은 조회 전용 — 진행은 POUR스토어에서 관리하므로 CRM에서는 확인만 지원한다. */
 function storeOnly(q){return (root.INQ_STORE_STATUSES||[]).includes(String(q&&q.status||''))}
 function primaryAction(q){const key=attr(root.inqKey(q));
  if(storeOnly(q))return '<button class="inq-now inq-view" data-k="'+key+'" onclick="inqCtlOpenSingle(this.dataset.k)">확인</button>';
  const assign=!root.inquiryAssigned(q)&&root.inqCtlRoleView()==='admin';return '<button class="inq-now" data-k="'+key+'" onclick="'+(assign?'inqCtlOpenAssign(\'assign\',this.dataset.k)':'inqCtlOpenSingle(this.dataset.k)')+'">'+(assign?'배정':'처리')+'</button><button class="inq-more" data-k="'+key+'" onclick="inqCtlOpenMenu(this.dataset.k)" aria-label="'+attr((q.site||'문의')+' 기타 처리')+'">⋯</button>'}
 function compactRows(){
  document.querySelectorAll('#sg-panel .inq-ctl-row').forEach(row=>{
   const c=Array.from(row.children),admin=!row.classList.contains('mine-row');if(c.length!==(admin?9:7))return;row.classList.add('inq-work-row');
   const labels=['접수경과','문의','담당자','응대 상태','다음 행동','처리'];
   if(row.classList.contains('head')){const cells=labels.map(text=>{const n=document.createElement('span');n.textContent=text;return n});if(admin)cells[0].prepend(c[0]);row.replaceChildren(...cells);return}
   const q=root.INQ_CONSOLE_CACHE.find(q=>root.inqKey(q)===row.dataset.k);if(!q)return;
   const patch=root.itemPatch(q,'inq'),next=root.actionObj(q,patch)||{},owner=root.inquiryRoutedOwner(q),hours=root.todayHoursFrom(root.inquiryCreatedAt(q)),late=delayed(q),key=attr(root.inqKey(q));
   row.classList.toggle('priority',late||(!owner&&hours>=24));row.title=root.inqCtlProblem(q).label;
   const make=(cls,html)=>{const n=document.createElement('span');n.className=cls;n.innerHTML=html;return n};
   const elapsed=make('inq-received','<strong class="'+(late?'inq-work-late':'')+'">'+h(hours==null?'—':hours>=24?'D+'+Math.floor(hours/24):Math.max(0,Math.floor(hours))+'시간')+'</strong><small>'+h(String(root.inquiryCreatedAt(q)||'').slice(5,10).replace('-','/'))+'</small>');if(admin)elapsed.prepend(c[0]);
   const meta=[q.contact_name||q.contact||root.inqCtlContactLabel(q),q.brand,root.inqCtlWorkLabel(q)].filter(v=>v&&v!=='연락처 미입력').join(' · ');
   const site=make('inq-ctl-site','<button class="inq-site-link" data-k="'+key+'" onclick="event.stopPropagation();inqCtlOpenSingle(this.dataset.k)">'+h(q.site||'현장명 미입력')+'</button><small title="'+attr(meta)+'">'+h(meta)+'</small>');
   const assigned=make('inq-ctl-assignee','<strong>'+h(owner?root.repDisplay(owner):'미배정')+'</strong>'+(owner?'<small>'+root.inqCtlStatusBadge(q)+'</small>':''));
   if(!owner){const evidence=root.inquiryUnassignedMeta(q);assigned.title=[evidence.label,evidence.detail,evidence.attemptLabel].filter(Boolean).join(' · ')}
   const seen=new Set(),activities=[...(q.activities||[]),...(patch.activities||[])].filter(a=>{const k=a.id||[a.at,a.type,a.note,a.result].join('|');if(seen.has(k))return false;seen.add(k);return /전화|통화|문자|SMS|카카오|이메일|메일|방문/i.test(a.type||'')&&Number.isFinite(Date.parse(a.at||a.occurred_at||a.created_at))}).sort((a,b)=>Date.parse(b.at||b.occurred_at||b.created_at)-Date.parse(a.at||a.occurred_at||a.created_at)),latest=activities[0],response=root.inqCtlFirstResponseAt(q);
   /* 응대 여부를 배지로 명시한다: 응대완료(기록 요약) / 미응대(지연 시 강조). */
   const responded=!!(latest||response),respondedNote=latest?root.fmtD(latest.at||latest.occurred_at||latest.created_at).slice(5)+' '+(latest.type||'')+([latest.note,latest.result].filter(Boolean).length?' · '+[latest.note,latest.result].filter(Boolean).join(' · '):''):response?root.fmtD(response).slice(5)+' 응대':'';
   const recent=make('inq-work-recent',responded?'<span class="inq-resp-badge done">응대완료</span><small title="'+attr(respondedNote)+'">'+h(respondedNote)+'</small>':'<span class="inq-resp-badge '+(late?'miss-late':'miss')+'">미응대</span>');
   /* 다음 행동은 기한 배지로 추적한다: n일 지남 / 오늘 / D-n. 미등록은 버튼 문구 그대로 둔다. */
   const dueDays=next.due?root.daysTo(next.due):null;
   const dueChip=next.due?(Number.isFinite(dueDays)?'<small><span class="inq-due-chip '+(dueDays<0?'hot':dueDays===0?'warn':'ok')+'">'+(dueDays<0?Math.abs(dueDays)+'일 지남':dueDays===0?'오늘':'D-'+dueDays)+'</span> '+h(root.fmtD(next.due))+'</small>':'<small>'+h(root.fmtD(next.due))+'</small>'):'';
   const todo=make('inq-work-next','<button class="inq-next-link" data-k="'+key+'" onclick="event.stopPropagation();inqCtlQuickNext(this.dataset.k)">'+h(next.text||'다음 행동 없음')+'</button>'+dueChip);
   const actions=make('inq-action',primaryAction(q));actions.onclick=e=>e.stopPropagation();row.replaceChildren(elapsed,site,assigned,recent,todo,actions);Array.from(row.children).forEach((cell,i)=>cell.dataset.label=labels[i]);
  });
 }
 function view(value){root.G.inqLegacyView=value!=='console';root.inqCtlSetView(value)}
 function decorate(){
  const admin=root.inqCtlRoleView()==='admin',page=document.getElementById('pg-inq');page.classList.add('inq-workbench');
  const signals=root.$('#sg-signals'),active=root.inqCtlScopeActive(),counts=root.inqCtlCounts(active,root.inqCtlScopeTrash(),root.inqTechReviewRows()),selected=root.G.inqCompactMetric==='delayed'?'delayed':root.G.inqBucket==='미배정'?'unassigned':root.G.inqBucket==='배정완료'?'waiting':root.G.inqBucket==='전체'?'all':'';
  const tabs=signals.querySelector('.inq-ctl-tabs'),toolbar=signals.querySelector('.inq-ctl-toolbar'),roles=signals.querySelector('.inq-role-switch'),brand=signals.querySelector('.sales-filterbar');
  if(roles){roles.setAttribute('aria-label','문의 조회 범위');roles.children[0].textContent='전체 문의';Array.from(roles.children).forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('on')))}
  const status=document.createElement('nav');status.className='inq-work-counts';status.setAttribute('aria-label','견적문의 처리 상태');status.innerHTML=[['all','전체',counts.전체],['unassigned','미배정',counts.미배정],['waiting','응대대기',counts.배정완료],['delayed','처리지연',active.filter(delayed).length]].map(([key,label,n])=>'<button aria-pressed="'+(selected===key)+'" data-key="'+key+'" onclick="InquiryWorkbench.set(this.dataset.key)"><span>'+label+'</span><b>'+n+'</b></button>').join('');
  const heading=document.createElement('div');heading.className='inq-inbox-heading';
  if(root.G.page==='inq'){root.$('#ptitle').textContent='견적문의';root.$('#psub').textContent='새 문의를 배정하고 첫 응대 및 후속 업무를 관리합니다.'}
  const tools=document.createElement('details');tools.className='inq-work-tools';tools.open=!!root.G.inqToolsOpen;tools.addEventListener('toggle',()=>{root.G.inqToolsOpen=tools.open});tools.innerHTML='<summary>⋯ 기타 관리</summary><div class="inq-tools-body"></div>';const menu=tools.lastChild;
  if(tabs){Array.from(tabs.children).forEach(b=>{if(['전체','미배정','배정완료'].includes(b.dataset.t))b.remove()});menu.append(tabs)}
  if(toolbar){toolbar.querySelector(':scope > span')?.remove();toolbar.querySelectorAll('button[data-v]').forEach(b=>{b.onclick=()=>view(b.dataset.v);if(b.dataset.v==='console')b.textContent='문의 목록'});menu.append(toolbar)}
  heading.append(tools);signals.prepend(heading);if(roles)heading.prepend(roles);
  root.$('#sg-panel .inq-ctl-summary')?.remove();compactRows();
  const bulk=root.$('#sg-panel .inq-ctl-bulk');if(bulk){bulk.classList.add('inq-work-bulk');menu.append(bulk)}
  const sticky=document.createElement('div');sticky.className='inq-inbox-sticky';
  if(brand)sticky.append(brand);else {sticky.innerHTML=root.inqBrandChips()}
  const filters=document.createElement('form');filters.className='inq-work-filters';
  const owners=Array.from(new Set(root.operationalInquiries(root.B.inquiries||[]).filter(root.inqCtlRoleMatch).map(root.inquiryRoutedOwner).filter(Boolean))).sort();if(root.G.rep&&root.G.rep!=='전체'&&!owners.includes(root.G.rep))owners.push(root.G.rep);
  filters.innerHTML='<label>상태<select name="status" aria-label="문의 상태">'+['전체','미배정','배정완료','응대중','영업전환','스토어 이관','보류'].map(n=>'<option '+(root.G.inqBucket===n?'selected':'')+'>'+h(n)+'</option>').join('')+'</select></label><label>공종<select name="work" aria-label="문의 공종">'+root.workFilterOptions(root.G.workFilter||'전체')+'</select></label><label class="inq-work-search">검색<input name="query" aria-label="문의 검색" value="'+attr(root.G.q||'')+'" placeholder="현장명·문의자·연락처 검색"></label><button>검색</button>';
  filters.onsubmit=e=>{e.preventDefault();root.G.workFilter=filters.elements.work.value;root.G.q=filters.elements.query.value.trim();root.G.inqPage=1;root.G.inqCompactMetric='';root.G.inqBucket=filters.elements.status.value;root.INQ_SEL={};root.paint()};filters.querySelectorAll('select').forEach(el=>el.onchange=()=>filters.requestSubmit());sticky.prepend(status);sticky.append(filters);signals.after(sticky);
 }
 function allowed(q){return q&&root.inqCtlRoleMatch(q)}
 function open(key,action){const q=root.inqCtlFind(key,false);if(!allowed(q))return;returnFocus=document.activeElement;modalKey=root.inqKey(q);root.G.inqSelKey=modalKey;root.G.inqAct=action||null;root.paint();document.querySelector('#inq-inbox-dialog .inq-dialog-close')?.focus()}
 function close(){modalKey=null;root.G.inqAct=null;document.getElementById('inq-inbox-dialog')?.remove();document.body.classList.remove('inq-dialog-open');if(returnFocus?.isConnected)returnFocus.focus();else document.querySelector('.inq-work-counts button')?.focus()}
 function dialog(){
  const q=root.inqCtlFind(modalKey,false);if(root.G.page!=='inq'||!allowed(q)){close();return}
  const previous=document.getElementById('inq-inbox-dialog'),draft={},focused=document.activeElement?.id;const sameAction=previous?.dataset.action===String(root.G.inqAct||'');if(sameAction)previous.querySelectorAll('input[id],select[id],textarea[id]').forEach(e=>draft[e.id]=e.value);
  previous?.remove();const panel=root.$('#sg-panel'),nodes=Array.from(panel.childNodes),phase=root.G.inqPhase;root.G.inqPhase='전체';root.G.inqSelKey=modalKey;try{root.inqSplit([q])}finally{root.G.inqPhase=phase}
  const detail=panel.querySelector('.sp-detail');panel.replaceChildren(...nodes);if(!detail){close();return}
  const overlay=document.createElement('div');overlay.id='inq-inbox-dialog';overlay.dataset.action=String(root.G.inqAct||'');overlay.className='inq-dialog-overlay';overlay.innerHTML='<section class="inq-dialog" role="dialog" aria-modal="true" aria-labelledby="inq-dialog-title"><header><div><h2 id="inq-dialog-title">'+h(q.site||'견적문의')+'</h2><span>'+h(q.brand||'유입 미지정')+'</span></div><button class="inq-dialog-close" onclick="InquiryWorkbench.close()">✕ 닫기</button></header><div class="inq-dialog-columns"><aside aria-label="문의자와 현장"><h3>문의자 · 현장</h3></aside><main aria-label="문의와 응대"><h3>문의내용 · 응대</h3></main><aside aria-label="문의 업무 관리"><h3>업무 관리</h3></aside></div></section>';
  const left=overlay.querySelector('aside'),center=overlay.querySelector('main'),right=overlay.querySelectorAll('aside')[1];
  left.insertAdjacentHTML('beforeend','<dl><dt>문의자</dt><dd>'+h(q.contact_name||q.contact||'미입력')+'</dd><dt>연락처</dt><dd>'+h(q.phone||q.mobile||root.inqCtlContactLabel(q))+'</dd><dt>현장</dt><dd>'+h(q.site||'미입력')+'</dd><dt>주소</dt><dd>'+h(root.detailAddress(q))+'</dd><dt>공종</dt><dd>'+h(root.inqCtlWorkLabel(q))+'</dd></dl>');
  if(!root.inquiryAssigned(q)){const evidence=root.inquiryUnassignedMeta(q);left.insertAdjacentHTML('beforeend','<details><summary>배정 이력 확인</summary><p>'+h(evidence.label)+'</p><p>'+h(evidence.detail)+'</p><small>'+h(evidence.attemptLabel)+'</small></details>')}
  const move=(selector,target)=>{const n=detail.querySelector(selector);if(n)target.append(n);return n};
  move('.sp-inquiry-original',center);move('.sp-why',center);const acts=move('.sp-acts',right);const log=acts?.querySelector('[onclick="inqAct(\'log\')"]');if(log)center.append(log);move('.sp-form',root.G.inqAct==='log'?center:right);move('.sp-grid',right);move('.pl-box',right);
  detail.querySelector('.sp-dh')?.remove();detail.querySelector('.sp-foot')?.remove();detail.querySelector('.sp-jour')?.remove();detail.querySelector('.sp-jl')?.remove();detail.querySelector('.sp-lb')?.remove();
  // Move original nodes and handlers, including conversion and ACK-aware saves.
  Array.from(detail.children).forEach(n=>center.append(n));
  if(storeOnly(q)){overlay.classList.add('inq-store-view');const manage=overlay.querySelectorAll('aside')[1];if(manage)manage.innerHTML='<h3>업무 관리</h3><p class="inq-store-note">POUR스토어로 이관된 문의입니다. CRM에서는 조회만 지원하며, 견적·구매 진행은 스토어에서 관리합니다.</p>';center.querySelectorAll('button').forEach(el=>el.remove());}
  document.body.append(overlay);document.body.classList.add('inq-dialog-open');Object.entries(draft).forEach(([id,value])=>{const el=document.getElementById(id);if(el&&overlay.contains(el))el.value=value});
  if(sameAction&&focused&&overlay.contains(document.getElementById(focused)))document.getElementById(focused).focus();else if(previous)(overlay.querySelector('.sp-form input,.sp-form select')||overlay.querySelector('.inq-dialog-close')).focus();
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){const list=Array.from(overlay.querySelectorAll('button,input,select,textarea,a[href]')).filter(n=>!n.disabled&&n.getClientRects().length);if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0]?.focus()}}});
 }
 root.inqCtlOpenSingle=key=>open(key);root.inqCtlQuickRecord=key=>open(key,'log');root.inqCtlQuickNext=key=>open(key,'next');
 const originalPromoted=root.openPromotedDeal;root.openPromotedDeal=function(){if(modalKey)close();return originalPromoted.apply(this,arguments)};
 root.paintInq=function(){
  const role=root.inqCtlRoleView();if(root.G._inqRoleApplied!==role){close();root.G._inqRoleApplied=role;root.G.inqBucket='전체';root.G.inqLegacyView=false;root.G.inqSelKey=null;root.G.inqPage=1;root.INQ_SEL={}}
  if(!root.G.inqLegacyView)root.G.inqView='console';document.querySelector('#pg-inq .inq-inbox-sticky')?.remove();const result=originalPaint.apply(this,arguments);decorate();if(modalKey)dialog();return result;
 };
 const oldRole=root.inqCtlSetRoleView;root.inqCtlSetRoleView=function(v){close();root.G.inqLegacyView=false;root.G.inqCompactMetric='';return oldRole(v)};
 root.InquiryWorkbench={set,delayed,primaryAction,selectBrand,view,open,close};
})(window);
