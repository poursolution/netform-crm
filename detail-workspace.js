(function(root){
'use strict';
// Layout only: move existing nodes so IDs, drafts and server commands keep one owner.
var asset=null,returnAsset=null,listPosition=null;
function rememberList(){
 if(document.getElementById('detailView')?.classList.contains('on'))return;
 listPosition={focus:document.activeElement,x:window.scrollX,y:window.scrollY,rows:Array.from(document.querySelectorAll('[id]')).filter(n=>n.scrollTop||n.scrollLeft).map(n=>({id:n.id,top:n.scrollTop,left:n.scrollLeft}))};
}
function restoreList(){
 var old=listPosition;listPosition=null;if(!old)return;
 old.rows.forEach(x=>{var n=document.getElementById(x.id);if(n){n.scrollTop=x.top;n.scrollLeft=x.left}});
 window.scrollTo(old.x,old.y);if(old.focus?.isConnected)old.focus.focus({preventScroll:true});
}
function focusWide(id){
 if(root.DetailActions?.focus(id))return;
 var n=document.getElementById(id);if(!n)return;
 for(var p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
 n.scrollIntoView({block:'nearest'});(n.matches('input,select,textarea,button')?n:n.querySelector('input,textarea,select,button'))?.focus({preventScroll:true});
}
function selectWide(t){
 var view=document.getElementById('detailView');if(!view?.classList.contains('dw-wide')||!view.querySelector('.dw-columns'))return false;
 var id=({'영업활동':'activityFormCard','연락·활동':'activityFormCard','일정':'nextActionCard','일정·Next':'nextActionCard','현장·견적':'dw-amount','공종·금액':'dw-amount','이력':'dw-history','변경이력':'dw-history','개요':'dw-now'})[t]||'dw-now';
 G.detailTab=t;focusWide(id);return true;
}
function wide(){
 var view=document.getElementById('detailView'),body=document.getElementById('dv-body');
 if(!view||!body)return;
 view.classList.remove('dw-wide');
 if(!CUR_DETAIL||CUR_DETAIL.kind!=='deal'||view.classList.contains('docked'))return;
 if(body.querySelector('.dw-columns')){view.classList.add('dw-wide');return}
 view.classList.remove('dw-quick','dw-transition');view.classList.add('dw-wide');
 view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');view.setAttribute('aria-labelledby','dv-title');
 var d=CUR_DETAIL.item,p=currentPatch(),next=actionObj(d,p),closed=!!d.outcome||d.lifecycle_status==='closed',original=Array.from(body.children);
 var columns=document.createElement('div');columns.className='dw-columns';
 columns.innerHTML='<aside class="dw-left" aria-label="고객과 현장"><h2>고객 / 현장</h2></aside><main class="dw-center" aria-label="영업 업무"><section class="dw-now dcard" id="dw-now"><span class="dw-eyebrow">지금 해야 할 일</span></section></main><aside class="dw-right" aria-label="영업 관리"><h2>영업 관리</h2></aside>';
 var left=columns.querySelector('.dw-left'),center=columns.querySelector('.dw-center'),right=columns.querySelector('.dw-right'),now=columns.querySelector('.dw-now');
 function move(selector,to){var node=body.querySelector(selector);if(node)to.append(node);return node}
 function button(label,run){var b=document.createElement('button');b.type='button';b.className='dact';b.textContent=label;b.onclick=run;return b}
 function box(parent,label){var n=document.createElement('details');n.className='dw-fold';var s=document.createElement('summary');s.textContent=label;n.append(s);parent.append(n);return n}
 var contact=move('#contactCard',left);
 move('.dw-asset-back',left);
 if(!contact){var empty=document.createElement('div');empty.className='dcard';empty.textContent='등록된 연락처가 없습니다.';empty.append(button('연락처 등록',()=>openQuickContact('new')));left.append(empty)}
 var site=document.createElement('div');site.className='dcard dw-site';site.innerHTML='<h3>현장 정보</h3><dl><dt>현장명</dt><dd>'+esc(d.site||'미입력')+'</dd><dt>주소</dt><dd>'+esc(detailAddress(d))+'</dd><dt>공사명</dt><dd>'+esc(d.work||d.work_name||'미입력')+'</dd><dt>공종</dt><dd>'+esc(dealWorkSummary(d))+'</dd></dl>';site.append(button('공종 수정',()=>openWorkEdit()));left.append(site);
 move('.nearby',left);
 /* Single Customer View 1조각(2026-09-25 장기원칙 ①): 같은 현장의 다른 영업건 — 과거 수주·실주·진행을 현장 상세 한 곳에서 */
 (function(){
  try{
   var key=normSite(d.site);if(!key)return;
   var others=(B.deals||[]).filter(function(x){return normSite(x.site)===key&&dealKey(x)!==dealKey(d)});
   if(!others.length)return;
   others.sort(function(a2,b2){return String(b2.created||'').localeCompare(String(a2.created||''))});
   var badge=function(x){var o=outcomeOf(x);return o==='won'?'<i class="sh-b g">수주</i>':o==='lost'?'<i class="sh-b r">실주</i>':o==='open'?'<i class="sh-b b">진행</i>':'<i class="sh-b n">종료</i>'};
   /* 중복 의심(2026-09-26): 같은 현장·같은 담당·같은 금액으로 둘 다 진행 중 — 이관하면서 두 번 들어온 기록일 가능성 */
   var amtOf=function(x){return Number(x.amount||x.amt||0)},dup=function(x){return outcomeOf(x)==='open'&&outcomeOf(d)==='open'&&repN(x.assignee)===repN(d.assignee)&&amtOf(x)>0&&amtOf(x)===amtOf(d)};
   var card2=document.createElement('div');card2.className='dcard dw-sitehistory';
   card2.innerHTML='<h3>같은 현장의 다른 영업건 <span>'+others.length+'건</span></h3><p class="sh-help">이 현장에 따로 등록된 영업입니다 — 누르면 그 건이 열립니다.</p>'
    +others.slice(0,6).map(function(x){
      var amt=Number(x.amount||x.amt||0);
      return '<button type="button" class="sh-row'+(dup(x)?' sh-dup':'')+'" data-k="'+escAttr(dealKey(x))+'"><span>'+badge(x)+' '+esc(stageLabel(dealStage(x)))+' · '+esc(dealWorkSummary(x)||x.work||'공종 미기록')+'</span><small>'+esc(String(x.created||'').slice(0,7)||'')+(amt?' · '+fmtAmt(amt):'')+' · '+esc(repN(x.assignee)||'미배정')+(dup(x)?' · <b>중복 의심 — 지금 보는 건과 담당·금액이 같음</b>':'')+'</small></button>'
     }).join('')
    +(others.length>6?'<p class="sh-more">외 '+(others.length-6)+'건</p>':'');
   card2.addEventListener('click',function(e){
    var b2=e.target.closest('.sh-row');if(!b2)return;
    var x=(B.deals||[]).filter(function(y){return dealKey(y)===b2.dataset.k})[0];
    if(x)drwDeal(JSON.stringify(x));
   });
   left.append(card2);
  }catch(e){}
 })(); // 같은 지역 담당 현장 추천 — 3컬럼 재배치에서 유실되던 카드 복원 (외근 동선 묶기)
 now.insertAdjacentHTML('beforeend','<h3>'+esc(next&&next.status!=='completed'?next.text||next.type||'다음 할 일':closed?'종료된 영업기회입니다.':'다음 할 일이 없습니다.')+'</h3><p>'+esc(next?[next.due||next.due_at,next.assignee||repN(d.assignee)].filter(Boolean).join(' · '):closed?'추가 영업은 새 영업기회에서 관리합니다.':'다음 연락 일정과 해야 할 일을 지정해 주세요.')+'</p>');
 var actions=document.createElement('div');actions.className='dactions';actions.append(button('다음 할 일 지정',()=>focusWide('nextActionCard')),button('연락 결과',()=>focusWide('activityFormCard')));now.append(actions);
 if(next&&next.status!=='completed'&&!closed)actions.append(button('다음 할 일 완료',()=>completeNextAction()));
 var activity,nextCard;
 if(body.querySelector('#rel-contact-save')){
  // The existing atomic command requires both groups. Keep them together,
  // retaining the original nodes, values and single submit handler.
  var contactFlow=box(center,'연락 기록 · 다음 할 일');contactFlow.open=true;
  activity=move('#activityFormCard',contactFlow);
  nextCard=move('#nextActionCard',contactFlow);
  var contactActions=activity?.querySelector('.dactions');
 }else{
  nextCard=move('#nextActionCard',box(center,'다음 할 일 · 일정 입력'));
  activity=move('#activityFormCard',box(center,'연락 결과 · 연락 결과'));
 }
 if(activity){var types=document.createElement('div');types.className='dw-outcomes';['통화 완료','전화 안 받음','다시 연락 요청받음','고객 약속','기타'].forEach(label=>types.append(button(label,()=>{document.getElementById('dv-act-type').value='전화';document.getElementById('dv-act-result').value=label;focusWide('dv-act-note')})));activity.querySelector('.formgrid')?.before(types)}
 var timeline=body.querySelector('#activityTimelineHost')?.closest('.dcard');if(timeline){center.append(timeline);var title=timeline.querySelector('h3');if(title)title.textContent='최근 활동'}
 // 재배치 유실 복원: 단계 여정 바는 «지금 해야 할 일» 바로 아래, 응대 체크리스트는 중앙 작업 흐름 끝에.
 var journey=body.querySelector('.dcc-journey');if(journey)now.after(journey);
 var checks=Array.from(body.querySelectorAll('details.dw-fold,.dcard')).find(function(n){return /오늘 먼저 확인할 응대 기록/.test(n.textContent||'')});if(checks)center.append(checks);
 // 재배치 유실 복원: 고객 핵심 발언 — 실제 기록에서 뽑아 다음 할 일으로 잇는다.
 if(typeof briefVoiceOfCustomer==='function'){var voice=briefVoiceOfCustomer(d,'deal'),voiceCard=document.createElement('div');voiceCard.className='dcard dw-voice';voiceCard.innerHTML='<h3>고객 핵심 발언</h3>'+(voice.length?'<p class="dw-voice-quote">“'+esc(String(voice[0][1]).slice(0,140))+'”</p><small>'+esc(voice[0][0])+' · 실제 기록에서 추출</small>':'<p class="dw-voice-quote">연결된 고객 발언이 없습니다.</p><small>통화·응대 기록에서 핵심 발언을 연결하세요.</small>');voiceCard.append(button('이 발언으로 다음 할 일 만들기',()=>dccVoiceToNext()));left.append(voiceCard)}
 var stage=document.createElement('section');stage.className='dcard dw-management';stage.innerHTML='<span>현재 단계</span><h3>'+esc(stageLabel(dealStage(d)))+'</h3><div id="dw-stage-editor"></div><dl><dt>예상금액</dt><dd>'+esc(fmtAmt(d.amount??d.amt??0))+'</dd><dt>담당자</dt><dd>'+esc(repN(d.assignee))+'</dd><dt>다음 확인일</dt><dd>'+esc(next?.due||String(next?.due_at||'').slice(0,10)||'미등록')+'</dd></dl>';
 stage.querySelector('h3').after(button('진행상태 변경',()=>openTransition()));right.append(stage);
 var amount=body.querySelector('#dv-amt')?.closest('.dcard');if(amount){amount.id='dw-amount';box(right,'금액 · 공종 관리').append(amount)}
 var owner=body.querySelector('#dv-assignee')?.closest('.dcard');if(owner)box(right,'담당자 변경').append(owner);
 var missing=document.createElement('div');missing.className='dcard dw-missing';missing.innerHTML='<h3>확인할 항목</h3>';
 if(!(d.amount??d.amt))missing.append(button('예상금액 확인',()=>focusWide('dv-amt')));
 if(!next&&!closed)missing.append(button('다음 할 일 지정',()=>focusWide('nextActionCard')));
 if(!contact)missing.append(button('연락처 등록',()=>openQuickContact('new')));
 if(missing.children.length>1)right.append(missing);
 var materials=box(right,'자료 · 사진 '+execAttachments(d).filter(x=>/^image\//.test(x.mime_type||'')).length+' · 견적 '+execQuoteVersions(d).length);materials.id='dw-materials';move('#execFiles',materials);move('#execQuotePanel',materials);
 left.append(button('자료 보기 · 추가',()=>focusWide('execFiles')));
 // Keep every remaining business control available, while dropping only duplicate summaries.
 body.querySelectorAll('.dcc-recent-card,.detaillead,.dcc-health,.dcc-hero').forEach(n=>n.remove());
 original.filter(n=>n.classList.contains('dsec')).forEach(n=>{
  var name=n.dataset.sec;if(name==='개요'){
   if(n.textContent.trim()){n.style.display='block';box(right,'추가 관리정보').append(n)}
  }else if(n.textContent.trim()){
   var extra=box(name==='변경이력'?center:right,name==='변경이력'?'변경 이력':name+' · 추가 정보');
   if(name==='변경이력')extra.id='dw-history';n.style.display='block';extra.append(n);
  }
 });
 var error=body.querySelector('#dv-err');body.replaceChildren(columns);if(error){error.setAttribute('role','status');center.prepend(error)}
 var subtitle=document.getElementById('dv-sub');if(subtitle)subtitle.textContent=stageLabel(dealStage(d))+' · 담당 '+repN(d.assignee);
 var back=view.querySelector('.backbtn');if(back)back.textContent='✕ 닫기';
 view.querySelectorAll('[onclick^="contactDial("]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{focusWide('activityFormCard');var type=document.getElementById('dv-act-type');if(type)type.value='전화'},0)));
}
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
 if(CUR_DETAIL.kind!=='deal'||view.classList.contains('docked')){view.classList.remove('dw-wide');view.removeAttribute('aria-modal');view.removeAttribute('role')}
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
 asset={key:s.key,index:i,tab:'summary'};
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
 // A normalized name is not an identity: two real sites may share it.
 var i=SITE_MASTER_CACHE.findIndex(function(s){return s.key===old.key});if(i<0)return;
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
  var blocks=Array.from(shell.children),intervention=blocks.find(function(n){return /오늘 관리자 (개입|확인)/.test(n.querySelector('h3')?.textContent||'')});
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
 // Branch management is an operational control surface. Keep status, risk,
 // handoff, owner flow, funnel and trend visible instead of folding analysis.
 if(branch)branch.classList.add('dw-branch-visible');
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
 return '<aside class="dw-transition-context"><b>기존 기록 참고</b><p>최근 활동: '+esc(last?[fmtD(last.at),last.ttl,last.body||last.result||''].filter(Boolean).join(' · '):'기록 없음')+'</p><p>현재 다음 할 일: '+esc(next?[next.due,next.text].filter(Boolean).join(' · '):'미등록')+'</p><small>실제 전환 근거와 일치하는지 확인하세요. 기존 기록을 새 활동으로 자동 복제하지 않습니다.</small></aside>';
}
root.DetailWorkspace={decorate:decorate,wide:wide,selectWide:selectWide,focusWide:focusWide,rememberList:rememberList,restoreList:restoreList,fullDetail:fullDetail,assetTabs:assetTabs,rememberAsset:rememberAsset,restoreAsset:restoreAsset,repTabs:repTabs,operationPage:operationPage,dashboardSummary:dashboardSummary,performanceSummary:performanceSummary,transitionContext:transitionContext};
})(window);
