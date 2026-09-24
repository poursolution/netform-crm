(function(root){
 'use strict';
 const TYPES={inquiry:'견적문의',pipeline:'파이프라인',relationship:'관계관리',expansion:'확장관리',manager:'관리자 요청'};
 const FILTERS={inquiry:[['all','전체'],['unassigned','미배정'],['response','응대지연'],['processing','처리지연']],pipeline:[['all','전체'],['overdue','기한초과'],['missing','Next 없음'],['stale','장기정체']]};
 const SIZE=20;
 const h=value=>root.esc(String(value==null?'':value));
 const attr=value=>root.escAttr(String(value==null?'':value));
 const relationship=d=>['rapport','silent','waiting'].includes(root.dealStage(d));
 let currentActor='',managerRequests=[];

 function dueDays(date){if(!date||!Number.isFinite(Date.parse(date)))return null;const n=root.daysTo(date);return Number.isFinite(n)?n:null}
 function contactEntry(d){
  const meta=root.relationshipMeta(d),a=root.actionObj(d,root.itemPatch(d,'deal')),due=dueDays(meta.due),days=meta.days;
  let reason='',next=a&&a.text||'고객에게 연락하고 상담 내용과 다음 연락일 기록';
  if(due!==null&&due<0)reason='다음 연락일 '+Math.abs(due)+'일 초과';
  else if(due===0)reason='오늘 연락 예정';
  else if(due===null){reason='다음 연락일 미입력';next='다음 연락일과 연락 목적 등록'}
  else if(days!==null&&days>=90)reason=days+'일 미접촉';
  else return null;
  return {key:'deal:'+root.dealKey(d),type:'deal',kind:'relationship',item:d,owner:root.repN(d.assignee)||'미배정',stage:root.stageLabel(root.dealStage(d)),reason,next,recent:root.todayRecent(d,'deal'),delay:due<0?-due:0,due:meta.due||'',dueDays:due,missingNext:due===null,overdue:due!==null&&due<0};
 }

 function expansionEntries(admin,me){
  if(typeof root.expansionRecords!=='function'||!root.ExpansionFlow)return [];
  // The pool owns its records; do not create another Deal or use another page's year/owner filters.
  const raw=(root.expServerRows()||[]).concat(root.LOCAL.expansionPool||[]);
  return root.expansionRecords().filter(r=>!root.ExpansionFlow.converted(r)&&root.ExpansionFlow.status(r)!=='보류'&&(admin||root.repN(r.owner)===me)).map(r=>{
   const sources=raw.filter(x=>root.expSourceId(x)===r.sourceOpportunityId);
   const explicit=sources.some(x=>x.nextContactAt||x.next_contact_at);
   const hasBasis=!!r.completionDate;
   const due=explicit||hasBasis?r.nextContactAt:'',n=dueDays(due);
   if(n!==null&&n>0)return null;
   const inferred=!explicit&&hasBasis;
   const reason=n===null?'다음 연락일 미입력':inferred?'준공 후 접촉기준 도래 · 계산 일정':n<0?'다음 연락일 '+Math.abs(n)+'일 초과':'오늘 기존 고객 접촉';
   return {key:'expansion:'+r.sourceOpportunityId,type:'expansion',kind:'expansion',item:r,owner:root.repN(r.owner)||'미배정',stage:root.ExpansionFlow.status(r)==='관계관리'?'유지접촉':root.ExpansionFlow.status(r),reason,next:n===null?'확장관리에서 다음 연락일 등록':r.needNote||'기존 고객에게 연락하고 추가 공사 니즈 확인',recent:r.lastContactAt?'최근 연락 '+root.fmtD(r.lastContactAt):'최근 연락 기록 없음',due,dueDays:n,inferred,overdue:!inferred&&n!==null&&n<0,missingNext:n===null,delay:n!==null&&n<0?-n:0};
  }).filter(Boolean);
 }

 function managerEntries(){
  return managerRequests.filter(r=>r&&r.state!=='completed').map(r=>{
   const inquiry=(root.B?.inquiries||[]).find(q=>String(q.id)===String(r.target_id));
   const due=dueDays(r.due_at),owner=inquiry?root.repN(root.inquiryRoutedOwner(inquiry)):(r.assignee_name||'담당자');
   return {key:'manager:'+r.id,type:'manager',kind:'manager',item:inquiry||{id:r.target_id,site:r.site_name||'문의 현장'},request:r,owner,stage:'관리자 요청',reason:(r.requested_by||'관리자')+' 요청',next:r.instruction,recent:'요청 '+root.fmtD(r.requested_at),due:r.due_at,dueDays:due,missingNext:false,overdue:due!==null&&due<0,delay:due!==null&&due<0?-due:0};
  });
 }

 function decorate(x){
  if(x.kind==='manager'){
   x.unassigned=false;x.band=x.overdue?1:x.dueDays===0?3:5;x.urgent=x.band<=2;x.lag=x.overdue?x.delay*24:0;return x;
  }
  const a=x.type==='expansion'?null:root.actionObj(x.item,root.itemPatch(x.item,x.type));
  if(x.kind!=='relationship'&&x.kind!=='expansion'){
   x.kind=x.type==='inq'?'inquiry':'pipeline';x.due=a&&a.due||'';x.dueDays=dueDays(x.due);
   x.missingNext=!a||!a.text||x.dueDays===null;
   x.overdue=(x.dueDays!==null&&x.dueDays<0)||(x.type==='inq'&&root.inquiryResponseLate(x.item));
  }
  x.unassigned=x.type==='inq'&&!root.inquiryRoutedOwner(x.item);
  x.stale=x.type==='deal'&&root.issueSet(x.item).indexOf('stale')>=0;
  if(x.unassigned)x.owner='미배정';
  const reply=x.type==='deal'&&root.todayReplyNeedsFollowup(x.item);
  x.band=x.unassigned?0:x.overdue?1:reply?2:x.dueDays===0?3:x.missingNext?4:5;
  x.urgent=x.band<=2;
  // Compare elapsed time in one unit. Existing inquiry scoring uses minutes, Deal scoring uses days.
  x.lag=x.unassigned?Math.max(0,root.todayHoursFrom(root.inquiryCreatedAt(x.item))||0):x.dueDays!==null&&x.dueDays<0?-x.dueDays*24:x.type==='inq'&&x.overdue?Math.max(0,root.todayHoursFrom(root.inqCtlAssignedAt(x.item))||0):0;
  return x;
 }
 function panelOf(x){return x.type==='inq'||x.kind==='manager'?'inquiry':'pipeline'}
 function prioritize(x){
  x.panel=panelOf(x);
  if(x.panel==='inquiry'){
   x.responseLate=x.kind!=='manager'&&!x.unassigned&&!root.inqCtlFirstResponseAt(x.item)&&root.inquiryResponseLate(x.item);
   x.processingLate=x.kind==='manager'?x.overdue:!x.unassigned&&!x.responseLate&&!!root.inqCtlFirstResponseAt(x.item)&&(x.overdue||/지연|정체/.test(x.reason));
   x.band=x.unassigned?0:x.responseLate?1:x.processingLate?2:3;
   x.status=x.unassigned?'미배정':x.responseLate?'응대지연':x.processingLate?'처리지연':x.kind==='manager'?'관리자 요청':root.inqCtlFirstResponseAt(x.item)?'처리대기':'응대대기';
   x.lag=Math.max(0,root.todayHoursFrom(root.inquiryCreatedAt(x.item))||0);
  }else{
   const meta=x.type==='deal'?root.relationshipMeta(x.item):null;
   x.longContact=!!(meta&&meta.days!==null&&meta.days>=90);
   const age=x.type==='deal'?root.stageAge(x.item):null;
   x.stale=!!x.stale||(age!==null&&age>root.stageSla(root.dealStage(x.item)));
   x.band=x.overdue?0:x.missingNext?1:x.longContact?2:x.stale?3:x.dueDays===0?4:5;
   x.lag=x.overdue?x.delay*24:x.longContact?meta.days*24:x.stale?(age||0)*24:0;
  }
  return x;
 }
 function compare(a,b){return a.band-b.band||b.lag-a.lag||String(a.key).localeCompare(String(b.key))}
 function data(){
  const base=root.todayHomeData(),me=root.todayOwner();
  // Include overdue first responses even when the original recent-inquiry window has elapsed.
  const inquiry=base.Q.map(q=>base.inquiry.find(x=>x.key==='inq:'+root.inqKey(q))||
   (root.inquiryResponseLate(q)?{key:'inq:'+root.inqKey(q),type:'inq',item:q,owner:root.repN(root.inquiryRoutedOwner(q)),stage:'배정완료',reason:'최초 응대 지연',next:'고객에게 연락하고 최초 응대 결과 기록',recent:root.todayRecent(q,'inq'),delay:0}:null)).filter(Boolean);
  const pipeline=base.D.filter(d=>!relationship(d)).map(d=>{
   const entry=base.pipeline.find(x=>x.key==='deal:'+root.dealKey(d));if(entry)return entry;
   const a=root.actionObj(d,root.itemPatch(d,'deal')),meta=root.relationshipMeta(d),missing=!a||!a.text||dueDays(a.due)===null;
   if(!missing&&!(meta.days!==null&&meta.days>=90))return null;
   return {key:'deal:'+root.dealKey(d),type:'deal',item:d,owner:root.repN(d.assignee),stage:root.stageLabel(root.dealStage(d)),reason:missing?'다음 행동·기한 미등록':meta.days+'일 미접촉',next:missing?'다음 행동과 기한 지정':'고객에게 연락하고 진행 상황 확인',recent:root.todayRecent(d,'deal'),delay:0};
  }).filter(Boolean);
  const requests=managerEntries().filter(x=>base.Q.some(q=>String(q.id)===String(x.request.target_id)));
  const rows=inquiry.concat(pipeline,base.D.filter(relationship).map(contactEntry).filter(Boolean),expansionEntries(base.admin,me),requests).map(decorate).map(prioritize);
  const unique=new Map();rows.forEach(x=>{if(!unique.has(x.key))unique.set(x.key,x)});
  const all=Array.from(unique.values());
  return {admin:base.admin,rows:all,inquiry:all.filter(x=>x.panel==='inquiry').sort(compare),pipeline:all.filter(x=>x.panel==='pipeline').sort(compare)};
 }
 function matches(x,filter){return filter==='response'?x.responseLate:filter==='processing'?x.processingLate:filter==='overdue'?x.overdue:filter==='unassigned'?x.unassigned:filter==='missing'?x.missingNext:filter==='stale'?x.stale:true}
 function resetForActor(admin){
  const actor=String(root.ME&&root.ME.id||root.todayOwner())+':'+admin;
  if(actor!==currentActor){currentActor=actor;root.G.todayInquiryStatus='all';root.G.todayPipelineStatus='all';root.G.todayQueueOwner='전체';root.G.todayQueueSearch='';root.G.todayQueuePage=1;root.G.todayInquiryPage=1;root.G.todayPipelinePage=1}
 }
 function set(field,value){
  const allowed={owner:'todayQueueOwner',search:'todayQueueSearch'};
  if(!allowed[field])return;
  root.G[allowed[field]]=value;root.G.todayQueuePage=1;root.G.todayRoutinePage=1;root.G.todayInquiryPage=1;root.G.todayPipelinePage=1;render();
 }
 function filter(panel,value){
  if(!FILTERS[panel]||!FILTERS[panel].some(f=>f[0]===value))return;
  root.G[panel==='inquiry'?'todayInquiryStatus':'todayPipelineStatus']=value;
  root.G[panel==='inquiry'?'todayInquiryPage':'todayPipelinePage']=1;render();
 }
 function route(filter,type){
  const X=data();resetForActor(X.admin);
  const panel=type==='pipeline'?'pipeline':'inquiry';
  root.G[panel==='pipeline'?'todayPipelineStatus':'todayInquiryStatus']=FILTERS[panel].some(f=>f[0]===filter)?filter:'all';
  root.G.todayQueueOwner='전체';root.G.todayQueueSearch='';root.G.todayQueuePage=1;root.G.todayPipelinePage=1;
  root.goPage('today');
 }
 function page(n,key){const allowed={priority:'todayQueuePage',routine:'todayRoutinePage',inquiry:'todayInquiryPage',pipeline:'todayPipelinePage'},name=allowed[key]||allowed.priority;root.G[name]=Math.max(1,Number(n)||1);render()}
 function open(key,action){
  // Resolve against the current role-scoped source again, not a stale row index or global filters.
  const x=data().rows.find(row=>row.key===key);if(!x){render();const note=root.$('.twq-count-note');if(note){note.textContent='처리 상태 또는 접근 범위가 변경되어 목록을 갱신했습니다.';note.setAttribute('role','status')}return}
  if(action==='assign'&&x.unassigned&&root.todayIsAdmin())return root.todayAssignInquiry(root.inqKey(x.item));
  if(x.kind==='manager'){
   const q=(root.B?.inquiries||[]).find(row=>String(row.id)===String(x.request.target_id));
   if(!q){render();return root.toast('요청 대상 문의를 현재 접근 범위에서 찾지 못했습니다.');}
   root.G._detailPopup=true;return root.drwInq(JSON.stringify(q));
  }
  if(x.type==='expansion')return root.ExpansionPool.open(x.item.id);
  root.G._detailPopup=true;
  if(x.type==='inq')root.drwInq(JSON.stringify(x.item));else root.drwDeal(JSON.stringify(x.item));
  if(action==='contact'&&typeof root.dccGoActivity==='function')root.dccGoActivity();
  if(action==='next'&&typeof root.briefNextAction==='function')root.briefNextAction();
 }
 function elapsed(x){
  if(x.unassigned)return root.inquiryUnassignedMeta(x.item).elapsed.label;
  if(x.inferred)return '계산 일정';
  if(x.dueDays!==null)return x.dueDays<0?Math.abs(x.dueDays)+'일 초과':x.dueDays===0?'오늘':'D-'+x.dueDays;
  if(x.type==='inq'&&x.overdue)return root.inqCtlElapsed(root.inqCtlAssignedAt(x.item));
  return '기한 미입력';
 }
 function row(x,rank,admin){
  const site=x.item.site||x.item.site_name||'현장명 미입력',inquiry=x.panel==='inquiry';
  const action=x.unassigned&&admin?'assign':x.kind==='relationship'&&!x.missingNext?'contact':x.missingNext&&x.type==='deal'?'next':'open',label=action==='assign'?'배정':'처리';
  const repeatedDue=!x.inferred&&((x.dueDays!==null&&x.dueDays<0&&/^다음 (연락|행동)일 \d+일 초과$/.test(x.reason))||(x.dueDays===0&&/^(오늘 연락 예정|오늘 기존 고객 접촉|오늘 실행 예정)$/.test(x.reason)));
  const reason=x.reason&&!repeatedDue?'<small class="twq-reason">'+h(x.reason)+'</small>':'';
  const hours=inquiry?root.todayHoursFrom(root.inquiryCreatedAt(x.item)):null;
  const dueLabel=inquiry?(hours===null?'접수일 미확인':hours<24?Math.floor(Math.max(0,hours))+'시간':'D+'+Math.floor(hours/24)):elapsed(x);
  const tone=x.inferred?'inferred':x.overdue?'overdue':x.dueDays===0?'today':x.missingNext?'missing':'planned';
  const dueDescription=(inquiry?'접수경과 · ':x.due?root.fmtD(x.due)+' · ':'')+dueLabel;
  const siteSub=inquiry?(root.inqCtlContactLabel(x.item)||x.owner):TYPES[x.kind]+' · '+x.stage;
  return '<tr class="twq-row '+(x.urgent?'urgent':'')+'" data-key="'+attr(x.key)+'"><td data-label="우선"><span class="twq-rank">'+rank+'</span></td><td data-label="'+(inquiry?'현장·문의자':'현장')+'"><button class="twq-site" data-key="'+attr(x.key)+'" onclick="TodayWorkQueue.open(this.dataset.key)">'+h(site)+'</button><small>'+h(siteSub)+'</small></td><td data-label="'+(inquiry?'상태':'담당자')+'">'+h(inquiry?x.status:x.owner)+'</td><td data-label="지금 할 일"><strong>'+h(x.next)+'</strong>'+reason+'<small>'+h(x.recent)+'</small></td><td data-label="'+(inquiry?'접수경과':'관리상태')+'"><span class="twq-due '+tone+'" title="'+attr(dueDescription)+'" aria-label="'+attr(dueDescription)+'">'+h(dueLabel)+'</span></td><td data-label="처리"><button class="twq-action '+(action==='assign'?'assign':'')+'" data-key="'+attr(x.key)+'" data-action="'+action+'" aria-label="'+attr(site+' '+label)+'" onclick="TodayWorkQueue.open(this.dataset.key,this.dataset.action)">'+label+'</button></td></tr>';
 }
 function table(source,admin,key,title,description){
  const statusKey=key==='inquiry'?'todayInquiryStatus':'todayPipelineStatus',active=root.G[statusKey]||'all';
  const rows=source.filter(x=>matches(x,active)),name=key==='inquiry'?'todayInquiryPage':'todayPipelinePage',pages=Math.max(1,Math.ceil(rows.length/SIZE)),n=Math.min(Math.max(1,Number(root.G[name])||1),pages);root.G[name]=n;
  const start=(n-1)*SIZE,shown=rows.slice(start,start+SIZE);
  const pagesHtml=Array.from({length:pages},(_,i)=>i+1).filter(i=>i===1||i===pages||Math.abs(i-n)<=2).map((i,j,all)=>(j&&i>all[j-1]+1?'<span>…</span>':'')+'<button '+(i===n?'aria-current="page"':'')+' onclick="TodayWorkQueue.page('+i+',\''+key+'\')">'+i+'</button>').join('');
  const counters='<nav class="twq-counts" aria-label="'+title+' 상태">'+FILTERS[key].map(([value,label])=>'<button data-filter="'+value+'" aria-pressed="'+(active===value)+'" onclick="TodayWorkQueue.filter(\''+key+'\',this.dataset.filter)">'+label+' <b>'+source.filter(x=>matches(x,value)).length+'</b></button>').join('')+'</nav>';
  const headers=key==='inquiry'?['우선','현장·문의자','상태','지금 할 일','접수경과','처리']:['우선','현장','담당자','지금 할 일','관리상태','처리'];
  return '<section class="twq-list today-admin-'+key+'" aria-label="'+title+'"><header class="twq-board-head"><div><h3>'+title+' <b>'+source.length+'</b></h3><p>'+description+'</p></div></header>'+counters+'<div class="twq-table-scroll" role="region" aria-label="'+title+' 목록" tabindex="0"><table><colgroup>'+['rank','site','owner','task','due','action'].map(c=>'<col class="twq-col-'+c+'">').join('')+'</colgroup><thead><tr>'+headers.map(x=>'<th scope="col">'+x+'</th>').join('')+'</tr></thead><tbody>'+shown.map((x,i)=>row(x,start+i+1,admin)).join('')+'</tbody></table></div>'+(!rows.length?'<p class="twq-empty">현재 조건에서 처리할 업무가 없습니다.</p>':'')+'<footer><span>선택 '+rows.length+'건 · 페이지당 '+SIZE+'건</span><nav aria-label="'+title+' 페이지"><button '+(n===1?'disabled':'')+' onclick="TodayWorkQueue.page('+(n-1)+',\''+key+'\')">이전</button>'+pagesHtml+'<button '+(n===pages?'disabled':'')+' onclick="TodayWorkQueue.page('+(n+1)+',\''+key+'\')">다음</button></nav></footer></section>';
 }
 function render(){
  const host=root.$('#today-home-root');if(!host)return;
  const X=data();resetForActor(X.admin);const G=root.G;
  const owners=Array.from(new Set(X.rows.map(x=>x.owner))).sort(root.repCompare);
  const scoped=x=>(!X.admin||!G.todayQueueOwner||G.todayQueueOwner==='전체'||x.owner===G.todayQueueOwner)&&(!G.todayQueueSearch||[x.item.site,x.item.site_name,x.owner,x.reason,x.next].join(' ').toLowerCase().includes(String(G.todayQueueSearch).trim().toLowerCase()));
  const inquiry=X.inquiry.filter(scoped),pipeline=X.pipeline.filter(scoped);
  const toolbar='<form class="twq-toolbar" onsubmit="event.preventDefault();TodayWorkQueue.set(\'search\',this.elements.search.value)">'+(X.admin?'<label>담당자 <select aria-label="오늘 업무 담당자" onchange="TodayWorkQueue.set(\'owner\',this.value)"><option>전체</option>'+owners.map(o=>'<option '+(G.todayQueueOwner===o?'selected':'')+'>'+h(o)+'</option>').join('')+'</select></label>':'<span>내 담당 업무</span>')+'<label class="twq-search"><input name="search" aria-label="오늘 업무 검색" placeholder="현장·담당자·할 일 검색" value="'+attr(G.todayQueueSearch||'')+'"><button>검색</button></label></form>';
  host.innerHTML='<div class="today-work-queue '+(X.admin?'manager':'rep')+'"><header><div><h2>오늘 업무</h2><span>신규 문의와 진행 중 영업을 각각의 처리 순서로 확인합니다.</span></div><b>전체 '+(inquiry.length+pipeline.length)+'건</b></header>'+toolbar+'<p class="twq-count-note">각 업무함의 순위와 상태 필터는 독립적으로 적용됩니다. 파이프라인 상태는 중복될 수 있습니다.</p><div class="twq-admin-boards">'+table(inquiry,X.admin,'inquiry','견적문의 관리','신규 문의의 배정·첫 응대·후속처리')+table(pipeline,X.admin,'pipeline','파이프라인 관리','진행 중 영업의 다음 행동·관계관리·확장관리')+'</div></div>';
  const badge=root.$('#todayBadge');if(badge){badge.textContent=X.rows.length||'';badge.style.display=X.rows.length?'':'none'}
 }
 function setManagerRequests(rows){managerRequests=Array.isArray(rows)?rows.slice():[];if(root.G?.page==='today')render()}
 root.TodayWorkQueue={render,data,set,filter,page,open,route,setManagerRequests};
})(window);
