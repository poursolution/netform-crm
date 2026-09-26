(function(root){
 'use strict';
 const originalPaint=root.paintInq,originalRows=root.inqCtlRows,originalTab=root.inqCtlSetTab,originalScope=root.inqCtlScope,originalBase=root.inqBase;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 let modalKey=null,returnFocus=null,ignoreBrand=false;
 // Only use the inquiry's own source text; response notes are not customer originals.
 function originalText(q){const detail=q.detail&&typeof q.detail==='object'?q.detail:{},raw=q.raw&&typeof q.raw==='object'?q.raw:{};return [q.message,typeof q.detail==='string'?q.detail:detail.inquiry,q.content,raw['문의내용']].find(v=>typeof v==='string'&&v.trim())?.trim()||''}
 function sourceFields(q){const d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{};const value=(...a)=>a.find(v=>typeof v==='string'&&v.trim()&&v.trim()!=='-')||'미입력';return [['현장',value(d.sourceSite,r['현장명'])],['업체·고객정보',value(d.customerType,r['고객유형'])],['건물유형',value(d.buildingType,r['건물유형'])],['건물주소',value(d.address,q.address,r['건물주소'])],['단지개요',value(d.complex,r['단지개요'])],['관리사무소 연락처',value(d.office,r['관리사무소'])],['문의자',value(q.contact_name,q.contact,r['고객성함'])],['문의자 연락처',value(q.phone,q.mobile,r['고객연락처'])],['상담채널',value(d.channel,q.channel,r['상담채널'])],['공사유형',value(d.workType,q.work,q.work_type,r['공사유형'])],['유입경로',value(d.inflow,q.source_channel,r['유입경로'])],['전화 응대자',value(d.responder,r['전화응대자'])]]}
 root.inquiryOriginalSummary=function(q){const text=originalText(q),d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{};return '<section class="sp-inquiry-original"><h4>고객 문의 원문</h4><p class="inq-original-text">'+h(text||'저장된 문의 원문이 없습니다.')+'</p><h4 class="inq-source-title">접수 원본 정보</h4><dl class="inq-source-fields">'+sourceFields(q).map(([label,value])=>'<div><dt>'+h(label)+'</dt><dd>'+h(value)+'</dd></div>').join('')+'</dl>'+[['특이사항',d.note||r['특이사항']],['배정 코멘트',d.assignComment||r['배정 코멘트']],['응대내용',d.response||r['응대내용']]].map(([label,value])=>'<div class="inq-original-note"><b>'+h(label)+'</b><p>'+h(typeof value==='string'&&value.trim()?value:'미입력')+'</p></div>').join('')+'</section>'};

 function brands(){return root.SalesFilterState.state().brands}
 function scoped(fn,args){
  const brand=root.G.brand,rep=root.G.rep,query=root.G.q,selected=brands();root.G.brand='전체';root.G.rep='전체';root.G.q='';
  let rows;try{rows=fn.apply(root,args)}finally{root.G.brand=brand;root.G.rep=rep;root.G.q=query}
  const term=String(query||'').toLowerCase(),digits=term.replace(/\D/g,'');
  return rows.filter(q=>(ignoreBrand||root.SalesScope.matches(root.inquiryRoutedOwner(q),q))&&(ignoreBrand||!selected.length||selected.includes(root.inquiryBrandOf(q)))&&(!term||[q.site,q.contact,q.contact_name,q.phone,q.mobile,root.inqCtlContactLabel(q),root.inquirySalesOwner(q),root.inquiryConsultant(q),root.dealWorkSummary(q),q.delete_reason,q.deleteReason].join(' ').toLowerCase().includes(term)||(digits.length>=4&&[q.phone,q.mobile,root.inqCtlContactLabel(q)].join('').replace(/\D/g,'').includes(digits))));
 }
 root.inqCtlScope=function(){return scoped(originalScope,arguments)};
 root.inqBase=function(){return scoped(originalBase,arguments)};
 // One decision powers counts, filtering, ordering and the row's primary action.
 function task(q){
  const bucket=root.inqCtlBucket(q),next=root.actionObj(q,root.itemPatch(q,'inq'))||{},days=next.due?root.daysTo(next.due):null,dated=Number.isFinite(days),overdue=dated&&days<0;
  const age=at=>{const hrs=root.todayHoursFrom(at);return hrs==null?'시각 미기록':hrs>=24?Math.floor(hrs/24)+'일 경과':Math.max(0,Math.floor(hrs))+'시간 경과'};
  const due=dated?(overdue?Math.abs(days)+'일 지남':days===0?'오늘':days+'일 남음'):'기한 미등록';
  let t={kind:'followup',rank:2,needed:!next.text||!dated||days<=0,text:next.text||'다음 할 일 등록',reason:!next.text?'응대 후 다음 할 일이 없습니다':!dated?'다음 할 일의 날짜가 없습니다':overdue?'다음 할 일 날짜가 지났습니다':days===0?'오늘 후속 확인 예정입니다':'예정일까지 대기합니다',due,overdue,action:next.text&&dated?'process':'next',label:next.text&&dated?'후속 연락 결과':'다음 할 일',date:next.due||root.inquiryCreatedAt(q)||''};
  if(['영업전환','스토어 이관','보류','휴지통'].includes(bucket)||(root.CLOSED_INPUT_ST||[]).includes(q.status))t={...t,kind:'closed',rank:4,needed:false,text:bucket==='영업전환'?'전환된 영업건에서 진행합니다':'이력 확인',reason:bucket==='응대중'?q.status:bucket,due:'—',overdue:false,action:'view',label:'확인'};
  else if(!root.inquiryAssigned(q))t={...t,kind:'unassigned',rank:0,needed:true,text:'담당자 배정',reason:'담당자 없음 · 접수 '+age(root.inquiryCreatedAt(q)),due:'배정 필요',overdue:false,action:'assign',label:root.inqCtlRoleView()==='admin'?'배정하기':'확인'};
  else if(!root.inqCtlFirstResponseAt(q))t={...t,kind:'waiting',rank:1,needed:true,text:'첫 연락하기',reason:'첫 연락 기록 없음 · '+(q.assigned_at?'배정 '+age(q.assigned_at):'배정 시각 미기록'),due:root.inquiryResponseLate(q)?'첫 연락 늦음':'첫 연락',overdue:root.inquiryResponseLate(q),action:'process',label:'연락 결과 남기기'};
  else if(root.isAwaitingPromotion&&root.isAwaitingPromotion(q))t={...t,kind:'decision',rank:3,text:'영업건 전환 결정',reason:'견적 진행 기록 있음 · 영업전환 미완료',action:'decision',label:'영업건 전환 결정'};
  // Optimistic local changes must not produce a false daily zero before server ACK.
  const pending=root.Phase1?.queue?.list?.().find(x=>String(x.object_id)===String(q.id||root.inqKey(q))&&['inquiry_assign','inquiry_status','next_action','next_action_complete','opportunity_create','transition'].includes(x.operation)&&['pending','sending','uncertain','conflict','rejected'].includes(x.status));
  if(pending)t={...t,kind:t.kind==='closed'?'decision':t.kind,needed:true,reason:['conflict','rejected'].includes(pending.status)?'저장 실패 · 동기화 상태를 확인하세요':'서버 저장 결과를 확인하고 있습니다',action:'view',label:'확인',due:'저장 확인'};
  return t;
 }
 function matches(q,key){const t=task(q);return key==='needs'?t.needed:!key||key==='all'?true:t.needed&&t.kind===key}
 function delayed(q){return task(q).overdue}
 function compare(a,b){const x=task(a),y=task(b);return x.rank-y.rank||Number(y.overdue)-Number(x.overdue)||String(x.date).localeCompare(String(y.date))||String(root.inqKey(a)).localeCompare(String(root.inqKey(b)))}
 root.inqCtlRows=function(){const rows=originalRows.apply(this,arguments),key=root.G.inqCompactMetric;if(root.G.inqBucket!=='전체'||root.G.inqLegacyView)return rows;return rows.filter(q=>matches(q,key)).sort(compare)};
 root.inqCtlSetTab=function(tab){root.G.inqCompactMetric='all';return originalTab(tab)};
 function set(key){if(!['needs','all','unassigned','waiting','followup','decision'].includes(key))return;root.G.inqCompactMetric=key;root.G.inqLegacyView=false;root.G.inqView='console';originalTab('전체')}
 function run(key){const q=root.inqCtlFind(key,false);if(!allowed(q))return;const t=task(q);if(t.action==='assign'&&root.inqCtlRoleView()==='admin')return root.inqCtlOpenAssign('assign',key);return open(key,['process','next','decision'].includes(t.action)?t.action:null)}
 function selectBrand(value){root.SalesFilterState.selectBrand(value);root.G.inqPage=1;root.paint()}
 root.inqBrandChips=function(){let base;ignoreBrand=true;try{base=root.inqCtlScopeActive()}finally{ignoreBrand=false}return root.SalesFilters.controls(base.map(q=>({brand:root.inquiryBrandOf(q),owner:root.inquiryRoutedOwner(q),item:q})))};
 /* 스토어 이관 건은 조회 전용 — 진행은 POUR스토어에서 관리하므로 CRM에서는 확인만 지원한다. */
 function storeOnly(q){return (root.INQ_STORE_STATUSES||[]).includes(String(q&&q.status||''))}
 function primaryAction(q){const key=attr(root.inqKey(q));
  if(storeOnly(q))return '<button class="inq-now inq-view" data-k="'+key+'" onclick="inqCtlOpenSingle(this.dataset.k)">확인</button>';
  return '<button class="inq-now" data-k="'+key+'" onclick="InquiryWorkbench.run(this.dataset.k)">'+h(task(q).label)+'</button><details class="inq-action-menu"><summary aria-label="'+attr((q.site||'문의')+' 더보기')+'">더보기</summary><span class="inq-action-options"><button type="button" data-k="'+key+'" onclick="this.closest(' + "\'details\'" + ').open=false;inqCtlOpenMenu(this.dataset.k)">기타</button></span></details>'}

 function compactRows(){
  document.querySelectorAll('#sg-panel .inq-ctl-row').forEach(row=>{
   const c=Array.from(row.children),admin=!row.classList.contains('mine-row');if(c.length!==(admin?9:7))return;row.classList.add('inq-work-row');
   const labels=['우선순위','문의','지금 확인하는 이유','지금 할 일','담당자','기한','실행'];
   if(row.classList.contains('head')){const cells=labels.map(text=>{const n=document.createElement('span');n.textContent=text;return n});if(admin)cells[0].prepend(c[0]);row.replaceChildren(...cells);return}
   const q=root.INQ_CONSOLE_CACHE.find(q=>root.inqKey(q)===row.dataset.k);if(!q)return;
   const patch=root.itemPatch(q,'inq'),next=root.actionObj(q,patch)||{},owner=root.inquiryRoutedOwner(q),hours=root.todayHoursFrom(root.inquiryCreatedAt(q)),late=delayed(q),decision=task(q),key=attr(root.inqKey(q));
   row.classList.toggle('priority',late||(!owner&&hours>=24));row.title=decision.text;row.dataset.task=decision.kind;
   const make=(cls,html)=>{const n=document.createElement('span');n.className=cls;n.innerHTML=html;return n};
   const elapsed=make('inq-received','<strong class="'+(late?'inq-work-late':'')+'">'+h(({unassigned:'배정 필요',waiting:'첫 연락',followup:'후속조치',decision:'영업건 전환 결정',closed:'이력'})[decision.kind])+'</strong><small>'+h(hours==null?'접수일 미기록':hours>=24?'접수 후 '+Math.floor(hours/24)+'일':Math.max(0,Math.floor(hours))+'시간 경과')+'</small>');if(admin)elapsed.prepend(c[0]);
   const meta=[q.detail?.customerType||q.raw?.['고객유형'],q.contact_name||q.contact||root.inqCtlContactLabel(q),q.brand,root.inqCtlWorkLabel(q)].filter(v=>v&&v!=='연락처 미입력').join(' · ');
   const site=make('inq-ctl-site','<button class="inq-site-link" data-k="'+key+'" onclick="event.stopPropagation();inqCtlOpenSingle(this.dataset.k)">'+h(q.site||'현장명 미입력')+'</button><p class="inq-question-preview">'+h(originalText(q).replace(/\s+/g,' ')||'문의 내용 확인 필요')+'</p><small title="'+attr(meta)+'">'+h(meta)+'</small>');
   const assigned=make('inq-ctl-assignee','<strong>'+h(owner?root.repDisplay(owner):'미배정')+'</strong>');
   if(!owner){const evidence=root.inquiryUnassignedMeta(q);assigned.title=[evidence.label,evidence.detail,evidence.attemptLabel].filter(Boolean).join(' · ')}
   const seen=new Set(),activities=[...(q.activities||[]),...(patch.activities||[])].filter(a=>{const k=a.id||[a.at,a.type,a.note,a.result].join('|');if(seen.has(k))return false;seen.add(k);return /전화|통화|문자|SMS|카카오|이메일|메일|방문/i.test(a.type||'')&&Number.isFinite(Date.parse(a.at||a.occurred_at||a.created_at))}).sort((a,b)=>Date.parse(b.at||b.occurred_at||b.created_at)-Date.parse(a.at||a.occurred_at||a.created_at)),latest=activities[0],response=root.inqCtlFirstResponseAt(q);
   const latestNote=latest?[latest.note,latest.result].filter(Boolean).join(' · '):response?'첫 연락 기록 있음':'';
   const recent=make('inq-work-recent','<strong class="inq-task-title">'+h(decision.text)+'</strong>'+(latestNote?'<small title="'+attr(latestNote)+'">최근 · '+h(latestNote)+'</small>':'')+(decision.kind==='followup'&&decision.needed&&next.text?'<button class="inq-next-link" data-k="'+key+'" onclick="event.stopPropagation();inqCtlQuickNext(this.dataset.k)">일정 변경</button>':''));
   const todo=make('inq-work-next','<span class="inq-due-chip '+(late||decision.due==='첫 연락 늦음'?'hot':decision.needed?'warn':'ok')+'">'+h(decision.due)+'</span>');
   const actions=make('inq-action',primaryAction(q));actions.onclick=e=>e.stopPropagation();actions.onkeydown=e=>{if(e.key==='Escape'){const menu=actions.querySelector('details');if(menu){menu.open=false;menu.querySelector('summary').focus()}}};actions.onfocusout=e=>{if(!actions.contains(e.relatedTarget)){const menu=actions.querySelector('details');if(menu)menu.open=false}};row.replaceChildren(elapsed,site,make('inq-task-reason',h(decision.reason)),recent,assigned,todo,actions);Array.from(row.children).forEach((cell,i)=>cell.dataset.label=labels[i]);
  });
 }
 function view(value){root.G.inqLegacyView=value!=='console';root.inqCtlSetView(value)}
 function decorate(){
  const admin=root.inqCtlRoleView()==='admin',page=document.getElementById('pg-inq');page.classList.add('inq-workbench');
  const signals=root.$('#sg-signals'),active=root.inqCtlScopeActive(),counts=root.inqCtlCounts(active,root.inqCtlScopeTrash(),root.inqTechReviewRows()),selected=root.G.inqCompactMetric||'all';
  const tabs=signals.querySelector('.inq-ctl-tabs'),toolbar=signals.querySelector('.inq-ctl-toolbar'),roles=signals.querySelector('.inq-role-switch'),brand=signals.querySelector('.sales-filterbar');
  if(roles){roles.setAttribute('aria-label','문의 조회 범위');roles.children[0].textContent='팀 문의';Array.from(roles.children).forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('on')))}
  const status=document.createElement('nav');status.className='inq-work-counts';status.setAttribute('aria-label','할 일별 문의');status.innerHTML='<span class="inq-layer">할 일</span>'+[['unassigned','배정'],['waiting','첫 연락'],['followup','후속 연락'],['decision','영업건 전환 판단']].map(([key,label])=>[key,label,active.filter(q=>matches(q,key)).length]).map(([key,label,n])=>'<button aria-pressed="'+(selected===key)+'" data-key="'+key+'" onclick="InquiryWorkbench.set(this.dataset.key)"><span>'+label+'</span><b>'+n+'</b></button>').join('');
  const heading=document.createElement('div');heading.className='inq-inbox-heading';
  if(root.G.page==='inq'){root.$('#ptitle').textContent='견적문의';root.$('#psub').textContent='배정 → 첫 연락 → 후속 연락 → 영업건 전환 판단 순으로 처리합니다.'}
  const tools=document.createElement('details');tools.className='inq-work-tools';tools.open=!!root.G.inqToolsOpen;tools.addEventListener('toggle',()=>{root.G.inqToolsOpen=tools.open});tools.innerHTML='<summary>더보기</summary><div class="inq-tools-body"></div>';const menu=tools.lastChild;
  if(tabs){Array.from(tabs.children).forEach(b=>{if(['전체','미배정','배정완료'].includes(b.dataset.t))b.remove()});menu.append(tabs)}
  if(toolbar){toolbar.querySelector(':scope > span')?.remove();toolbar.querySelectorAll('button[data-v]').forEach(b=>{b.onclick=()=>view(b.dataset.v);if(b.dataset.v==='console')b.textContent='문의 목록'});menu.append(toolbar)}
  heading.append(tools);signals.prepend(heading);if(roles)heading.prepend(roles);
  root.$('#sg-panel .inq-ctl-summary')?.remove();compactRows();
  const bulk=root.$('#sg-panel .inq-ctl-bulk');if(bulk){bulk.classList.add('inq-work-bulk');menu.append(bulk)}
  const sticky=document.createElement('div');sticky.className='inq-inbox-sticky';
  if(brand)sticky.append(brand);else {sticky.innerHTML=root.inqBrandChips()}
  const modes=document.createElement('nav');modes.className='inq-task-modes';modes.setAttribute('aria-label','문의 업무 범위');modes.innerHTML='<span class="inq-layer">보기</span><button data-key="needs" aria-pressed="'+(selected==='needs')+'" onclick="InquiryWorkbench.set(\'needs\')">오늘 할 문의 <b>'+active.filter(q=>task(q).needed).length+'</b></button><button data-key="all" aria-pressed="'+(selected==='all')+'" onclick="InquiryWorkbench.set(\'all\')">전체 '+active.length+'건</button>';
  const filters=document.createElement('form');filters.className='inq-work-filters';
  const owners=Array.from(new Set(root.operationalInquiries(root.B.inquiries||[]).filter(root.inqCtlRoleMatch).map(root.inquiryRoutedOwner).filter(Boolean))).sort();if(root.G.rep&&root.G.rep!=='전체'&&!owners.includes(root.G.rep))owners.push(root.G.rep);
  filters.innerHTML='<label>진행 상태<select name="status" aria-label="문의 진행 상태">'+[['전체','전체'],['미배정','접수 · 미배정'],['배정완료','배정됨'],['응대중','응대 중'],['영업전환','영업건으로 전환'],['스토어 이관','스토어로 넘김'],['보류','보류']].map(([n,label])=>'<option value="'+attr(n)+'" '+(root.G.inqBucket===n?'selected':'')+'>'+h(label)+'</option>').join('')+'</select></label><label>공종<select name="work" aria-label="문의 공종">'+root.workFilterOptions(root.G.workFilter||'전체')+'</select></label><label class="inq-work-search">검색<input name="query" aria-label="문의 검색" value="'+attr(root.G.q||'')+'" placeholder="현장명·문의자·연락처 검색"></label><button>검색</button>';
  filters.onsubmit=e=>{e.preventDefault();root.G.workFilter=filters.elements.work.value;root.G.q=filters.elements.query.value.trim();root.G.inqPage=1;root.G.inqCompactMetric=filters.elements.status.value===root.G.inqBucket?root.G.inqCompactMetric:'all';root.G.inqBucket=filters.elements.status.value;root.INQ_SEL={};root.paint()};filters.querySelectorAll('select').forEach(el=>el.onchange=()=>filters.requestSubmit());const daily=document.createElement('h2');daily.className='inq-daily-title';const remaining=active.filter(q=>task(q).needed).length;daily.textContent=remaining?(admin?'오늘 처리해야 할 문의 ':'내가 오늘 처리할 문의 ')+remaining+'건':'오늘 처리할 견적문의가 없습니다.';sticky.prepend(daily,status);sticky.append(filters,modes);signals.after(sticky);
 }
 function related(q){
  const owner=root.inquiryRoutedOwner(q);if(!owner)return {region:'',list:[],unassigned:true};
  const item={...q,assignee:owner,site:root.standardSiteTitle(q.site,root.detailAddress(q))};
  const n=root.nearbySites(item),work=root.inqCtlWorkLabel(q);
  return {...n,list:n.list.map(x=>({...x,sameWork:!!work&&work!=='공종 미분류'&&root.dealWorkSummary(x.d)===work})).sort((a,b)=>Number(b.sameWork)-Number(a.sameWork))};
 }
 function nearby(q){const n=related(q);return '<section class="inq-related"><h3>같은 지역 · 공종 현장</h3><p>'+h(n.unassigned?'담당자를 배정하면 해당 담당자의 현장을 확인할 수 있습니다.':!n.region?'지역 정보가 없어 비교할 수 없습니다.':n.region+' · 같은 담당자의 진행 현장 · 공종 일치 우선')+'</p>'+n.list.slice(0,4).map(x=>'<button type="button" data-k="'+attr(root.dealKey(x.d))+'" onclick="InquiryWorkbench.openRelated(this.dataset.k)"><b>'+h(x.d.site)+'</b><small>'+h(root.stageNoLabel(root.dealStage(x.d)))+' · '+h(root.dealWorkSummary(x.d)||'공종 미입력')+(x.sameWork?' · 같은 공종':'')+'</small></button>').join('')+(n.region&&!n.list.length?'<p>같은 지역에 진행 중인 담당 현장이 없습니다.</p>':'')+'<small>지역 표기 기준이며 실제 거리나 단지 규모의 유사도를 뜻하지 않습니다.</small></section>'}
 function openRelated(key){const q=root.inqCtlFind(modalKey,false);if(!allowed(q)||!related(q).list.some(x=>root.dealKey(x.d)===key))return;dismiss();root.nearbyOpen(key)}
 function allowed(q){return q&&root.inqCtlRoleMatch(q)}
 let returnPage=null,returnScroll=0;
 /* 다른 화면(오늘 업무 등)에서 연 문의 상세 — 견적문의의 같은 전체 상세로 열고, 닫으면 원래 화면으로 돌아간다 */
 function openFrom(key,from){const q=root.inqCtlFind(key,false);if(!allowed(q))return false;const back=from&&from!=='inq'?from:null,y=window.scrollY||0;if(root.G.page!=='inq')root.goPage('inq');returnPage=back;returnScroll=y;open(key);return !!modalKey;}
 /* 메뉴 이동·역할 전환 등 화면이 바뀔 때: 되돌아가지 않고 조용히 닫는다 */
 function dismiss(){returnPage=null;if(!modalKey&&!document.getElementById('inq-inbox-dialog'))return;modalKey=null;root.G.inqAct=null;root.G.iqForm=null;document.getElementById('inq-inbox-dialog')?.remove();document.body.classList.remove('inq-dialog-open');}
 function open(key,action){action=action==='log'?'process':action;const q=root.inqCtlFind(key,false);if(!allowed(q))return;if(root.DetailWindow&&typeof root.DetailWindow.openInquiry==='function'&&root.DetailWindow.openInquiry(String(q.id||''),action))return;/* 2026-09-26 대표: 견적문의 상세도 새 창 */returnFocus=document.activeElement;modalKey=root.inqKey(q);root.G.inqSelKey=modalKey;root.G.inqAct=action||null;root.G.iqForm=action==='process'?'next':null;root.paint();document.querySelector('#inq-inbox-dialog .inq-dialog-close')?.focus()}
 function close(){const back=returnPage,y=returnScroll;returnPage=null;modalKey=null;root.G.inqAct=null;root.G.iqForm=null;document.getElementById('inq-inbox-dialog')?.remove();document.body.classList.remove('inq-dialog-open');if(back){root.goPage(back);requestAnimationFrame(()=>window.scrollTo(0,y));return}if(returnFocus?.isConnected)returnFocus.focus();else document.querySelector('.inq-work-counts button')?.focus()}
 function dialog(){
  const q=root.inqCtlFind(modalKey,false);if(root.G.page!=='inq'||!allowed(q)){dismiss();return}
  const previous=document.getElementById('inq-inbox-dialog'),draft={},focused=document.activeElement?.id;const sameAction=previous?.dataset.action===String(root.G.inqAct||'');if(sameAction)previous.querySelectorAll('input[id],select[id],textarea[id]').forEach(e=>draft[e.id]=e.value);
  previous?.remove();const panel=root.$('#sg-panel'),nodes=Array.from(panel.childNodes),phase=root.G.inqPhase;root.G.inqPhase='전체';root.G.inqSelKey=modalKey;try{root.inqSplit([q])}finally{root.G.inqPhase=phase}
  const detail=panel.querySelector('.sp-detail');panel.replaceChildren(...nodes);if(!detail){dismiss();return}
  const overlay=document.createElement('div');overlay.id='inq-inbox-dialog';overlay.dataset.action=String(root.G.inqAct||'');overlay.className='inq-dialog-overlay';overlay.innerHTML='<section class="inq-dialog" role="dialog" aria-modal="true" aria-labelledby="inq-dialog-title"><header><div><h2 id="inq-dialog-title">'+h(q.site||'견적문의')+'</h2><span>'+h(q.brand||'유입 미지정')+'</span></div><button class="inq-dialog-close" onclick="InquiryWorkbench.close()">✕ 닫기</button></header><div class="inq-dialog-columns"><aside aria-label="문의자와 현장"><h3>문의자 · 현장</h3></aside><main aria-label="문의와 응대"><h3>문의 원문 · 이력</h3></main><aside aria-label="문의 업무 관리"><h3>업무 관리</h3></aside></div></section>';
  /* E 공통 골격(2026-09-24): 어떤 상세든 맨 위는 '지금 할 일' — 영업건 상세의 NowCard와 같은 자리·같은 문법 */
  if(!storeOnly(q)){const nowT=task(q);overlay.querySelector('.inq-dialog-columns').insertAdjacentHTML('beforebegin','<div class="inq-now-card'+(nowT.overdue?' hot':'')+'"><span class="inq-now-eyebrow">지금 할 일</span><p>'+h(nowT.reason)+' — <b>'+h(nowT.text)+'</b> · '+h(nowT.due)+'</p><button class="inq-now" data-k="'+attr(root.inqKey(q))+'" onclick="InquiryWorkbench.run(this.dataset.k)">'+h(nowT.label)+'</button></div>')}
  const left=overlay.querySelector('aside'),center=overlay.querySelector('main'),right=overlay.querySelectorAll('aside')[1];
  left.insertAdjacentHTML('beforeend','<dl><dt>문의자</dt><dd>'+h(q.contact_name||q.contact||'미입력')+'</dd><dt>연락처</dt><dd>'+h(q.phone||q.mobile||root.inqCtlContactLabel(q))+'</dd><dt>현장</dt><dd>'+h(q.site||'미입력')+'</dd><dt>주소</dt><dd>'+h(root.detailAddress(q))+'</dd><dt>공종</dt><dd>'+h(root.inqCtlWorkLabel(q))+'</dd></dl>');
  left.insertAdjacentHTML('beforeend',nearby(q));
  if(!root.inquiryAssigned(q)){const evidence=root.inquiryUnassignedMeta(q);left.insertAdjacentHTML('beforeend','<div class="inq-assign-evidence"><strong>배정 이력</strong><p>'+h(evidence.label)+'</p><p>'+h(evidence.detail)+'</p><small>'+h(evidence.attemptLabel)+'</small></div>')}
  const move=(selector,target)=>{const n=detail.querySelector(selector);if(n)target.append(n);return n};
  move('.sp-inquiry-original',center);move('.sp-why',right);move('.sp-acts',right);move('.sp-form',right);move('.sp-grid',right);move('.pl-box',right);detail.querySelector('.sp-abar')?.remove();move('.spform',right);move('.ck-box',right);
  detail.querySelector('.sp-dh')?.remove();detail.querySelector('.sp-foot')?.remove();detail.querySelector('.sp-jour')?.remove();detail.querySelector('.sp-jl')?.remove();detail.querySelector('.sp-lb')?.remove();
  // Move original nodes and handlers, including conversion and ACK-aware saves.
  Array.from(detail.children).forEach(n=>center.append(n));
  if(root.G.inqAct==='process'){
   const form=overlay.querySelector('.spform');
   if(form){right.querySelector('.sp-acts')?.after(form);overlay.querySelector('.sp-form')?.remove();const did=form.querySelector('#iq-did');if(did){did.value='고객 응대 기록';did.closest('.og').hidden=true;}const result=form.querySelector('#iq-res');if(result){const field=document.createElement('textarea');field.id='iq-res';field.rows=4;field.placeholder='고객과 나눈 내용과 결과를 적어주세요';result.replaceWith(field);field.previousElementSibling.textContent='연락 결과 *';}form.querySelector('#iq-next').previousElementSibling.textContent='다음 할 일 *';form.querySelector('#iq-due').previousElementSibling.textContent='다음 할 일 날짜 *';const save=form.querySelector('.spbtns button');save.textContent='연락 결과 저장';save.setAttribute('onclick',"InquiryWorkbench.saveProcess()");form.querySelector('.spbtns button:last-child').onclick=()=>open(root.inqKey(q));}
  }
  if(root.G.inqAct==='decision'){
   right.insertAdjacentHTML('afterbegin','<p>영업 진행을 결정하거나 사유를 남겨 보류하세요. 추가 확인이 필요하면 다음 할 일을 등록하세요.</p>');
   const hold=document.createElement('button');hold.className='dact';hold.textContent='사유를 남기고 보류';hold.onclick=()=>root.inqCtlOpenReason('hold',root.inqKey(q));right.append(hold);
  }
  if(storeOnly(q)){overlay.classList.add('inq-store-view');const manage=overlay.querySelectorAll('aside')[1];if(manage)manage.innerHTML='<h3>업무 관리</h3><p class="inq-store-note">POUR스토어로 이관된 문의입니다. CRM에서는 조회만 지원하며, 견적·구매 진행은 스토어에서 관리합니다.</p>';center.querySelectorAll('button').forEach(el=>el.remove());}
  document.body.append(overlay);document.body.classList.add('inq-dialog-open');Object.entries(draft).forEach(([id,value])=>{const el=document.getElementById(id);if(el&&overlay.contains(el))el.value=value});
  if(sameAction&&focused&&overlay.contains(document.getElementById(focused)))document.getElementById(focused).focus();else if(previous)(overlay.querySelector('.sp-form input,.sp-form select')||overlay.querySelector('.inq-dialog-close')).focus();
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){const list=Array.from(overlay.querySelectorAll('button,input,select,textarea,a[href]')).filter(n=>!n.disabled&&n.getClientRects().length);if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0]?.focus()}}});
 }
 const oldAction=root.inqAct;root.inqAct=function(action){if(modalKey)return open(modalKey,action);return oldAction.apply(this,arguments)};
 root.inqCtlOpenSingle=key=>open(key);root.inqCtlQuickRecord=key=>open(key,'log');root.inqCtlQuickNext=key=>open(key,'next');
 const originalPromoted=root.openPromotedDeal;root.openPromotedDeal=function(){if(modalKey)dismiss();return originalPromoted.apply(this,arguments)};
 root.paintInq=function(){
  const role=root.inqCtlRoleView();if(root.G._inqRoleApplied!==role){dismiss();root.G._inqRoleApplied=role;root.G.inqBucket='전체';root.G.inqCompactMetric='needs';root.G.inqLegacyView=false;root.G.inqSelKey=null;root.G.inqPage=1;root.INQ_SEL={}}
  if(!root.G.inqLegacyView)root.G.inqView='console';document.querySelector('#pg-inq .inq-inbox-sticky')?.remove();const result=originalPaint.apply(this,arguments);decorate();if(modalKey)dialog();return result;
 };
 const oldRole=root.inqCtlSetRoleView;root.inqCtlSetRoleView=function(v){dismiss();root.G.inqLegacyView=false;root.G.inqCompactMetric='';return oldRole(v)};
 function saveProcess(){
  const q=root.inqCtlFind(modalKey,false);if(!allowed(q))return;
  const idx=root.inqCtlFirstResponseAt(q)?root.flowIndex(q,'inq'):1;
  if(!Number.isInteger(idx)||idx<0||idx>5){root.iqMsg('현재 단계는 상세의 단계 전환에서 확인해 주세요.');return false}
  const patch=root.itemPatch(q,'inq'),before=JSON.parse(JSON.stringify(q)),beforePatch=JSON.parse(JSON.stringify(patch));
  try{const result=root.iqApply(q,'step:'+idx);if(result===true){root.G.inqAct=null;root.paint();}return result}
  catch(e){Object.keys(q).forEach(k=>delete q[k]);Object.assign(q,before);Object.keys(patch).forEach(k=>delete patch[k]);Object.assign(patch,beforePatch);root.iqMsg(e.message||'저장 연결을 확인해 주세요.');return false}
 }

 // Refresh only after a write event; preserve the existing filters and draft fields.
 let queuePaint=false;root.addEventListener('phase1:queue',()=>{if(queuePaint)return;queuePaint=true;root.setTimeout(()=>{queuePaint=false;if(root.G?.page==='inq'&&root.B)root.paintInq()},0)});
 root.InquiryWorkbench={saveProcess,related,openRelated,originalText,sourceFields,task,matches,compare,run,set,delayed,primaryAction,selectBrand,view,open,close,openFrom,dismiss};
})(window);
