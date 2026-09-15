(function(root){
'use strict';
// Layout only: move existing nodes so IDs, drafts and server commands keep one owner.
var asset=null,returnAsset=null;
function timelinePatch(deal,patch){
 // Some reads hydrate activities on the Deal, others on the local projection.
 // Build a read-only union; unifiedTimeline performs its existing duplicate check.
 var acts=[].concat(deal.activities||[],patch.activities||[]).map(function(a){return Object.assign({},a,{at:a.at||a.occurred_at||a.created_at||''})});
 return Object.assign({},patch,{activities:acts});
}
function fold(node,label){
 if(!node||node.parentElement.classList.contains('dw-fold'))return;
 var box=document.createElement('details'),summary=document.createElement('summary');
 box.className='dw-fold';summary.textContent=label;node.before(box);box.append(summary,node);
}
function decorate(){
 var body=document.getElementById('dv-body'),view=document.getElementById('detailView');
 if(!body||!view||!CUR_DETAIL)return;
 if(!document.getElementById('inlineTransition'))view.classList.remove('dw-transition');
 var quick=CUR_DETAIL.kind==='deal'&&G.relationshipQuickKey===CUR_DETAIL.key;
 view.classList.toggle('dw-quick',quick);
 if(CUR_DETAIL.kind!=='deal'){
  body.classList.add('dw-inquiry');
  var work=body.querySelector('[onclick="openInquiryWork()"]');
  if(work){var bar=document.createElement('div');bar.className='dw-inquiry-action';bar.append(work);body.prepend(bar)}
  return;
 }
 body.classList.remove('dw-inquiry');
 var section=function(name){return body.querySelector('.dsec[data-sec="'+name+'"]')},overview=section('개요'),activity=section('영업활동'),history=section('이력'),schedule=section('일정');
 var contact=body.querySelector('#contactCard');
 if(contact&&activity){activity.append(contact);fold(contact.querySelector('.contactedit'),'연락처 수정')}
 if(overview){
  var lead=overview.querySelector('.detaillead');if(lead&&schedule){schedule.append(lead);fold(lead,'현재 단계·원본 정보')}
  var handover=overview.querySelector('.exec-handover');if(handover&&history)history.append(handover);
  var relation=overview.querySelector('.rel-engine-card');if(relation&&schedule)schedule.append(relation);
  fold(overview.querySelector('#execStageGuide'),'단계별 필수 확인');
  Array.from(overview.children).forEach(function(n){if(/오늘 먼저 확인할 응대 기록/.test(n.querySelector('h3')?.textContent||''))fold(n,'응대 체크리스트')});
  if(!overview.querySelector('.dcc-recent-card'))overview.insertAdjacentHTML('afterbegin',dccRecentHTML(CUR_DETAIL.item,timelinePatch(CUR_DETAIL.item,currentPatch())));
 }
 if(quick){
  var context=body.querySelector('.relm-detail-context');
  if(context&&!context.querySelector('.dw-full')){
   var full=document.createElement('button');full.className='dw-full';full.textContent='전체 영업정보 보기 →';full.onclick=fullDetail;context.append(full);
  }
  var grid=body.querySelector('.activitygrid');if(grid)grid.classList.add('dw-quick-grid');
  detailTabFocus('영업활동',true);
 }
 if(returnAsset&&!body.querySelector('.dw-asset-back')){
  var back=document.createElement('button');back.className='dact dw-asset-back';back.textContent='← 고객자산으로 돌아가기';back.onclick=function(){closeDetail()};body.prepend(back);
 }
}
function fullDetail(){
 // Do not rerender: preserve unsaved activity/Next drafts when leaving the compact view.
 G.relationshipQuickKey=null;document.getElementById('detailView').classList.remove('dw-quick');
 document.querySelector('#dv-body .dw-full')?.remove();
 detailTabFocus('영업활동',true);
}
function tabbed(body,groups,choose,initial,onChange){
 if(!body||body.querySelector(':scope > .dw-tabs'))return;
 var nodes=Array.from(body.children),nav=document.createElement('nav');nav.className='dw-tabs';nav.setAttribute('aria-label','상세 정보 분류');
 nodes.forEach(function(n){n.dataset.workspaceGroup=choose(n)});
 function select(key){
  nodes.forEach(function(n){n.hidden=n.dataset.workspaceGroup!==key&&n.dataset.workspaceGroup!=='always'});
  Array.from(nav.children).forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.key===key))});
  if(onChange)onChange(key);
 }
 groups.forEach(function(g){var b=document.createElement('button');b.type='button';b.dataset.key=g[0];b.textContent=g[1];b.onclick=function(){select(g[0])};nav.append(b)});
 body.prepend(nav);select(initial||groups[0][0]);
}
function assetTabs(i){
 var s=SITE_MASTER_CACHE[i],body=document.getElementById('siteDrawerBody');if(!s||!body)return;
 asset={norm:s.norm,index:i,tab:'summary'};
 tabbed(body,[['summary','요약'],['deals','진행영업'],['trade','거래·공종'],['people','인물'],['activity','활동'],['expansion','확장']],function(n){
  var h=n.querySelector('h4'),t=h?.textContent||'';
  if(n.classList.contains('site-hero'))return 'summary';
  if(/현재 영업기회/.test(t))return 'deals';
  if(/포트폴리오|공종|수행/.test(t)||n.classList.contains('site-asq-section'))return 'trade';
  if(/사람 관계/.test(t))return 'people';
  if(/타임라인/.test(t))return 'activity';
  if(/재영업·확장/.test(t)&&h.firstChild){h.firstChild.nodeValue='확장 추천 신호 ';var small=h.querySelector('span');if(small)small.textContent='자동 추천 · 실제 관리 건과 구분'}
  if(/확장/.test(t)||n.classList.contains('site-expansion-pool'))return 'expansion';
  return 'summary';
 },'summary',function(key){asset.tab=key});
}
function rememberAsset(){
 var body=document.getElementById('siteDrawerBody'),modal=document.querySelector('#siteDrawer .modalbox');
 if(asset&&body)returnAsset=Object.assign({},asset,{scroll:modal?.scrollTop||0});
}
function restoreAsset(){
 G.relationshipQuickKey=null;document.getElementById('detailView')?.classList.remove('dw-quick','dw-transition');
 var old=returnAsset;returnAsset=null;if(!old)return;
 var i=SITE_MASTER_CACHE.findIndex(function(s){return s.norm===old.norm});if(i<0)return;
 openSiteMaster(i);
 var tab=document.querySelector('#siteDrawerBody .dw-tabs [data-key="'+old.tab+'"]');if(tab)tab.click();
 var modal=document.querySelector('#siteDrawer .modalbox');if(modal)modal.scrollTop=old.scroll;
}
function repTabs(){
 var body=document.getElementById('perfDrawerBody');
 tabbed(body,[['summary','현황'],['risk','문제현장'],['activity','활동'],['won','실적근거']],function(n){
  var t=n.querySelector('h4')?.textContent||'';
  if(/계약완료 근거/.test(t))return 'won';
  if(/최근 활동/.test(t))return 'activity';
  if(/관리자가 볼 것|우선 확인 현장|조치 필요/.test(t))return 'risk';
  return 'summary';
 });
}
function operationPage(){
 var shell=document.querySelector('#rep-management-root .rm-shell');
 if(shell&&!shell.querySelector('.dw-manager-table')){
  var blocks=Array.from(shell.children),intervention=blocks.find(function(n){return /오늘 관리자 개입/.test(n.querySelector('h3')?.textContent||'')});
  if(intervention){
   var rows=REP_MANAGER_ROWS.map(function(r,i){return {r:r,i:i}}).sort(function(a,b){return b.r.risk-a.r.risk||b.r.overdue-a.r.overdue});
   var list=intervention.querySelector('.rm-interventions');
   if(list){list.className='dw-manager-table';list.innerHTML='<table><thead><tr><th>담당자</th><th>주요 확인사항</th><th>문제현장</th><th>이번 주 진전</th><th>업무량</th><th>확인</th></tr></thead><tbody>'+rows.map(function(x){var r=x.r;return '<tr><th>'+esc(r.nm)+'</th><td>'+esc(r.diagnosis.title)+'<small>'+esc(r.diagnosis.text)+'</small></td><td>'+r.risk+'건</td><td>'+(r.weekTracked?r.weekAdvanced+'건':'수집 중')+'</td><td>'+r.load.open+'건 진행</td><td><button class="dact" onclick="repManagerOpenDrawer('+x.i+')">상세</button></td></tr>'}).join('')+'</tbody></table>'}
   var command=shell.querySelector('.rm-command');if(command)command.after(intervention);else shell.prepend(intervention);
  }
  // Keep representative summaries visible; only detailed field lists belong in drawers.
 }
 var branch=document.querySelector('#gyeongnam-root')||document.querySelector('#gyeongnam-master');
 if(!branch)branch=document.querySelector('.gn-command')?.parentElement;
 if(branch&&!branch.querySelector(':scope > .dw-fold')){
  var frames=Array.from(branch.querySelectorAll(':scope > .gn-frame')),handoff=frames.find(function(n){return n.querySelector('h3')?.textContent==='본사 인계 현황'}),urgent=frames.find(function(n){return n.querySelector('h3')?.textContent==='즉시 확인'}),cmd=branch.querySelector('.gn-command');
  if(cmd&&handoff)cmd.after(handoff);if(cmd&&urgent)cmd.after(urgent);
  frames.forEach(function(n){if(n!==handoff&&n!==urgent)fold(n,n.querySelector('h3')?.textContent||'지사 분석')});
 }
}
function dashboardSummary(){
 var host=document.getElementById('d-today');if(!host)return;
 var header=host.querySelector('h3');if(header)header.textContent='관리위험 참고';
 var sub=host.querySelector('.sub');if(sub)sub.textContent='위험금액 순 요약 · 실제 처리는 오늘 업무에서 확인';
 if(!host.querySelector('.dw-today-link')){var b=document.createElement('button');b.className='dact dw-today-link';b.textContent='오늘 업무 열기 →';b.onclick=function(){goPage('today')};host.querySelector('.ch')?.append(b)}
 fold(host.querySelector('.neck'),'위험현장 펼쳐보기');
}
function performanceSummary(){
 var body=document.getElementById('perfDrawerBody');if(!body)return;
 Array.from(body.querySelectorAll(':scope > .perf-drawer-section')).forEach(function(n){var title=n.querySelector('h4')?.textContent||'';if(/관리 상태|조치 필요/.test(title))fold(n,title)});
}
function transitionContext(deal,patch){
 var rows=unifiedTimeline(timelinePatch(deal,patch||{}),deal),last=rows.find(function(x){return x.src!=='auto'&&!/단계|배정|수정/.test(x.ttl||'')}),next=actionObj(deal,patch||{});
 return '<aside class="dw-transition-context"><b>기존 기록 참고</b><p>최근 활동: '+esc(last?[fmtD(last.at),last.ttl,last.body||last.result||''].filter(Boolean).join(' · '):'기록 없음')+'</p><p>현재 다음 행동: '+esc(next?[next.due,next.text].filter(Boolean).join(' · '):'미등록')+'</p><small>실제 전환 근거와 일치하는지 확인하세요. 기존 기록을 새 활동으로 자동 복제하지 않습니다.</small></aside>';
}
root.DetailWorkspace={decorate:decorate,fullDetail:fullDetail,assetTabs:assetTabs,rememberAsset:rememberAsset,restoreAsset:restoreAsset,repTabs:repTabs,operationPage:operationPage,dashboardSummary:dashboardSummary,performanceSummary:performanceSummary,transitionContext:transitionContext};
})(window);
