(function(root){
'use strict';
let state=null,tip=null,timer=null;
const $=id=>document.getElementById(id);
const descriptions={activity:'전화·방문·문자 등 고객 접촉 내용과 다음 할 일을 기록합니다.',next:'다음에 해야 할 업무와 기한을 설정합니다.',stage:'현재 영업단계를 변경하고 후속 일정을 설정합니다.',owner:'담당자 변경',amount:'예상금액 입력·수정',materials:'견적서·사진·관련 자료를 등록합니다.',support:'가격 협의·PT 동행·견적 검토 등 관리자의 지원이 필요할 때 요청합니다.',history:'단계·담당자·정보 변경 내역 확인',work:'공종 선택·수정',help:'영업 관리 기준 확인'};
function button(text,key,fn){const b=document.createElement('button');b.type='button';b.className='dact da-action';b.textContent=text;b.dataset.help=descriptions[key]||text;b.onclick=fn||(()=>open(key));return b;}
function hideTip(){clearTimeout(timer);tip?.remove();tip=null;document.querySelectorAll('[aria-describedby="da-tooltip"]').forEach(n=>n.removeAttribute('aria-describedby'));}
function tooltip(target,delay){hideTip();timer=setTimeout(()=>{if(!target.isConnected)return;tip=document.createElement('div');tip.id='da-tooltip';tip.role='tooltip';tip.textContent=target.dataset.help;document.body.append(tip);target.setAttribute('aria-describedby',tip.id);const r=target.getBoundingClientRect(),t=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-t.width-8,r.left))+'px';tip.style.top=(r.bottom+t.height+16<innerHeight?r.bottom+8:Math.max(8,r.top-t.height-8))+'px';},delay);}
document.addEventListener('pointerover',e=>{const n=e.target.closest('[data-help]');if(n&&!n.contains(e.relatedTarget))tooltip(n,350)});
document.addEventListener('pointerout',e=>{const n=e.target.closest('[data-help]');if(n&&!n.contains(e.relatedTarget))hideTip()});
document.addEventListener('focusin',e=>{const n=e.target.closest('[data-help]');if(n)tooltip(n,0)});
document.addEventListener('focusout',hideTip);window.addEventListener('resize',hideTip);document.addEventListener('scroll',hideTip,true);
function close(restore=true){hideTip();if(!state)return;const old=state;state=null;old.panel.querySelectorAll('[data-material-hidden]').forEach(n=>{n.hidden=false;delete n.dataset.materialHidden});old.moves.forEach(([n,mark])=>{if(mark.isConnected)mark.replaceWith(n)});old.panel.remove();old.background.forEach(n=>n.inert=false);if(restore&&old.focus?.isConnected)old.focus.focus({preventScroll:true});}
function take(n,host){if(!n||!state)return;const mark=document.createComment('detail-action-position');n.before(mark);state.moves.push([n,mark]);host.append(n);}
function open(key){
 const view=$('detailView');if(!view?.classList.contains('dw-wide'))return false;
 close(false);hideTip();
 const titles={activity:'연락 결과 · 다음 할 일',next:'다음 할 일 설정',stage:'진행상태 변경',owner:'담당자 변경',amount:'예상금액 수정',materials:'자료 보기 · 추가',management:'관리정보 수정',contact:'연락처 수정',history:'전체 이력',support:'관리자 지원 요청',help:'관리 기준'};
 const panel=document.createElement('div');panel.id='detailAction';/* 2026-09-24 지시: 상세 안 작업창은 전부 같은 중앙 창 — 우측 드로어·중앙 혼용 금지 */
 panel.className='da-layer da-compact';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','da-title');
 const sheet=document.createElement('section');sheet.className='da-sheet';const head=document.createElement('header');const title=document.createElement('h2');title.id='da-title';title.textContent=titles[key];const x=button('닫기',key,()=>{if(key==='stage')root.StageTransitionUI?.close();else close()});x.removeAttribute('data-help');x.setAttribute('aria-label','작업창 닫기');head.append(title,x);const content=document.createElement('div');content.className='da-content';sheet.append(head,content);panel.append(sheet);
 state={key,panel,moves:[],focus:document.activeElement,background:Array.from(view.children)};view.append(panel);state.background.forEach(n=>n.inert=true);
 const next=$('nextActionCard'),activity=$('activityFormCard'),atomic=$('rel-contact-save');
 if(key==='activity'){take(activity,content);take(next,content);if(atomic){const actions=atomic.closest('.dactions');actions.before(next);const save=next?.querySelector('.dactions .pri');if(save)save.style.display='none';}else{const save=activity?.querySelector('.dactions .pri');if(save){save.classList.add('da-submit');save.textContent='연락 결과·다음 할 일 저장';save.onclick=saveCombined;take(save.closest('.dactions'),content);}const nextSave=next?.querySelector('.dactions .pri');if(nextSave)nextSave.style.display='none';}
  /* 2026-09-24 지시: 처음엔 연락 결과만 — 결과 칩·내용이 생기면 다음 할 일이 맞는 기본값으로 열린다 */
  if(next){const noteEl=activity?.querySelector('#dv-act-note');
   if(noteEl&&noteEl.value.trim())next.classList.remove('da-next-wait');else next.classList.add('da-next-wait');
   const reveal=chip=>{if(!next.classList.contains('da-next-wait'))return;next.classList.remove('da-next-wait');
    /* 고객 약속(2026-09-25 컨설턴트 Loop ⑩): '고객 약속: 내용' + 날짜는 약속한 날을 직접 고른다(기본값 없음). 오늘 할 일 최우선·초과 시 관리자에게 미이행 표시 */
    const map={'통화 완료':['후속 확인 전화',3],'전화 안 받음':['다시 전화',1],'다시 연락 요청받음':['요청 시점에 다시 연락',2],'고객 약속':['고객 약속: ',null]};/* 2026-09-26 문구 정리: 칩 이름이 곧 키 — detail-workspace.js 결과 칩과 같이 바꾼다 */
    const pre=map[chip];const txt=next.querySelector('#dv-na-text'),dt=next.querySelector('#dv-na-date');
    if(pre&&txt&&!txt.value.trim()){txt.value=pre[0];
     if(pre[1]!==null&&dt&&!dt.value){const d=new Date();d.setDate(d.getDate()+pre[1]);dt.value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(d);}
     if(pre[1]===null){txt.placeholder='약속한 내용 — 예: 금요일까지 수정 견적 전달';setTimeout(()=>{txt.focus();txt.setSelectionRange(txt.value.length,txt.value.length);},60);}}
    next.scrollIntoView({block:'nearest',behavior:'smooth'});};
   content.addEventListener('click',e=>{const b=e.target.closest('.dw-outcomes button');if(b)reveal(b.textContent.trim());},true);
   content.addEventListener('input',e=>{if(e.target.id==='dv-act-note'&&e.target.value.trim())reveal('');},true);
  }}
 if(key==='next'){take(next,content);const save=next?.querySelector('.dactions .pri');if(save)save.style.display='';}
 if(key==='amount')take($('dw-amount'),content);
 if(key==='owner')take($('dv-assignee')?.closest('.dcard'),content);
 if(key==='materials'){take($('execFiles'),content);take($('execQuotePanel'),content);const nav=document.createElement('nav');nav.className='da-material-tabs';nav.setAttribute('aria-label','자료 분류');['전체','사진','견적','기타'].forEach(label=>{const b=button(label,'materials',()=>{nav.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));content.querySelectorAll('#execFiles,#execQuotePanel,.exec-file').forEach(n=>{n.dataset.materialHidden='';n.hidden=n.id==='execFiles'?label==='견적':n.id==='execQuotePanel'?!['전체','견적'].includes(label):label==='사진'?n.classList.contains('doc'):label==='기타'?!n.classList.contains('doc'):false})});b.setAttribute('aria-pressed',String(label==='전체'));nav.append(b)});content.prepend(nav);}
 if(key==='history'){const history=document.createElement('div');history.className='da-history';history.innerHTML=flatTimeline(true);content.append(history);take($('dw-history'),content);}
 if(key==='management')take($('da-management-fields'),content);
 if(key==='contact')take($('da-contact-fields'),content);
 if(key==='stage')take($('dw-stage-editor'),content);
 if(key==='support'&&isAdminNow()&&openSupportRequest(root.CUR_DETAIL?.item)){
  /* 관리자 개입 흐름(2026-09-26 컨설턴트 '관리자 개입의 흐름'): 요청 → 관리자 결정 → 담당자 고객 재접촉까지 기록으로 잇는다 */
  const req=openSupportRequest(root.CUR_DETAIL.item),box=document.createElement('div');box.className='da-support da-support-resolve';
  box.innerHTML='<p class="da-support-req"><b>지원 요청</b> '+root.esc(req.text)+' <small>'+root.esc(String(req.at).slice(5,10).replace('-','/'))+'</small></p>'
   +'<label for="da-support-note">관리자 결정·조치 <small>한 줄</small></label><textarea id="da-support-note" maxlength="300" placeholder="예: 가격 5% 조정 승인 — 10/2 입대의 동행"></textarea>'
   +'<label class="da-support-follow"><input type="checkbox" id="da-support-follow" checked> 담당자 내일 할 일로 ‘관리자 결정 반영 — 고객 재접촉’ 등록</label>';
  const tt=document.getElementById('da-title');if(tt)tt.textContent='관리자 지원 처리';
  const send=button('처리 완료로 기록','support',()=>saveSupport(box,true));send.classList.add('da-submit');
  box.append(send);content.append(box);
 }else if(key==='support'){
  const box=document.createElement('div');box.className='da-support';
  box.innerHTML='<p>어떤 지원이 필요한지 한 줄로 적어주세요. 컨트롤타워의 <b>지원 요청 대기</b>에 바로 표시됩니다.</p><textarea id="da-support-note" maxlength="300" placeholder="예: 광교OO 가격 협의 동행 요청 — 10/2 입대의 전"></textarea>';
  const send=button('지원 요청 보내기','support',()=>saveSupport(box));send.classList.add('da-submit');
  box.append(send);content.append(box);
 }
 if(key==='help')content.textContent='연락 결과는 고객과의 접촉 내용입니다. 진행상태 변경은 별도 전환창에서 확인합니다. 담당자·최근 활동·다음 할 일 날짜를 함께 관리하고, 저장 후 서버 반영 결과를 확인해 주세요.';
 take($('dv-err'),content);
 const cancel=button('취소',key,()=>{if(key==='stage')root.StageTransitionUI?.close();else close()});cancel.removeAttribute('data-help');content.append(cancel);
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(key==='stage')root.StageTransitionUI?.close();else close();return}if(e.key==='Tab'){const nodes=[...panel.querySelectorAll('button,input,textarea,select,a[href],[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}},true);
 (content.querySelector('input:not([type="hidden"]),textarea,select')||x).focus({preventScroll:true});return true;
}

function isAdminNow(){try{if(typeof root.todayIsAdmin==='function')return !!root.todayIsAdmin();}catch(e){}return /admin/.test(String(root.ME?.role||root.Phase1?.profile?.source_role||''));}
/* 이 영업의 처리 안 된 지원 요청: 가장 최근 [지원 요청] 메모 뒤에 [지원 처리] 메모가 없으면 열린 요청 */
function openSupportRequest(d){
 if(!d)return null;const p=root.currentPatch?root.currentPatch():{};
 const rows=[...(d.activities||[]),...((p&&p.activities)||[])].map(x=>({note:String(x.note||''),at:String(x.at||x.occurred_at||'')})).filter(x=>x.at);
 const reqs=rows.filter(x=>x.note.startsWith('[지원 요청]')).sort((a,b)=>b.at.localeCompare(a.at));const req=reqs[0];if(!req)return null;
 if(rows.some(x=>x.note.startsWith('[지원 처리]')&&x.at>req.at))return null;
 return {text:req.note.replace(/^\[지원 요청\]\s*/,''),at:req.at};
}
async function saveSupport(box,resolve){
 const d=root.CUR_DETAIL?.item;if(!d||box.dataset.saving)return;
 const note=box.querySelector('#da-support-note').value.trim();
 if(!note){root.showDetailErr(resolve?'관리자 결정·조치를 한 줄 적어주세요.':'지원이 필요한 내용을 적어주세요.');return;}
 if(!root.Phase1?.queue||typeof root.queueDetailContactOperation!=='function'){root.showDetailErr('로그인 상태에서만 보낼 수 있습니다.');return;}
 box.dataset.saving='1';box.querySelectorAll('button,textarea,input').forEach(n=>n.disabled=true);
 /* 다음 할 일을 덮지 않도록 추가 전용 활동(메모)으로 기록 — 컨트롤타워가 [지원 요청]/[지원 처리] 접두어로 집계·해소 */
 const who=root.repN(root.ME?.name)||'';
 const payload={type:'메모',note:resolve?'[지원 처리] '+note+' — 처리자 '+who:'[지원 요청] '+note+' — 요청자 '+who,result:'',occurred_at:new Date().toISOString()};
 const follow=resolve&&box.querySelector('#da-support-follow')?.checked;
 const progress=box._progress||(box._progress={});
 try{
  let id=progress.activity;
  if(id&&root.Phase1.queue.list().find(q=>q.request_id===id)?.status==='rejected'){delete progress.activity;id=null;}
  if(!id){id=root.queueDetailContactOperation('activity',{opportunity_id:d.id,...payload});progress.activity=id;}
  await root.Phase1.queue.flush();
  const row=root.Phase1.queue.list().find(q=>q.request_id===id);
  if(row?.status!=='done'||row.ack?.ok!==true)throw Error(row?.error||'서버 확인 대기 중입니다. 다시 눌러 확인해 주세요.');
  d.activities=Array.isArray(d.activities)?d.activities:[];
  d.activities.unshift({id:row.ack.activity_id,type:payload.type,note:payload.note,at:payload.occurred_at,occurred_at:payload.occurred_at});
  if(follow&&!progress.next){
   const t=new Date();t.setDate(t.getDate()+1);const due=[t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(t.getDate()).padStart(2,'0')].join('-');
   const nid=root.queueDetailContactOperation('next_action',{opportunity_id:d.id,type:'전화',text:'관리자 결정 반영 — 고객 재접촉',due_at:due});progress.next=nid;
   await root.Phase1.queue.flush();const nrow=root.Phase1.queue.list().find(q=>q.request_id===nid);
   if(nrow?.status!=='done'||nrow.ack?.ok!==true)throw Error('처리 기록은 저장됐습니다. 담당자 다음 할 일은 아직 확인되지 않았습니다 — 다시 누르면 같은 요청을 확인합니다.');
   const p=root.currentPatch?root.currentPatch():{},obj={id:nrow.ack.next_action_id,type:'전화',text:'관리자 결정 반영 — 고객 재접촉',due,due_at:due,status:'open'};
   d.nextActionObj=obj;d.nextAction=due;d.nextActionText=obj.text;if(p){p.nextActionObj=obj;p.nextAction=due;p.nextActionText=obj.text;}
  }
  root.saveLocal?.();root.showDetailErr(resolve?'지원 처리를 기록했습니다 — 컨트롤타워 지원 요청 대기에서 빠집니다.':'지원 요청을 보냈습니다 — 컨트롤타워에 표시됩니다.',true);close();
 }catch(e){root.showDetailErr(String(e.message||e));}
 finally{delete box.dataset.saving;box.querySelectorAll('button,textarea,input').forEach(n=>n.disabled=false);}
}
async function saveCombined(){
 const form=$('activityFormCard'),d=root.CUR_DETAIL?.item;if(!form||!d||form.dataset.saving)return;
 const get=id=>$(id)?.value?.trim()||'';
 const activity={type:get('dv-act-type'),note:get('dv-act-note'),result:get('dv-act-result'),occurred_at:get('dv-act-at')};
 const next={type:root.NextActionPicker.read('dv-na-type'),text:get('dv-na-text'),due_at:get('dv-na-date'),assignee:get('dv-na-assignee')};
 if(!activity.type||!activity.note||!activity.occurred_at||!next.type||!next.text||!next.due_at||!next.assignee){root.showDetailErr('연락 결과 내용·일시와 다음 할 일·기한·담당자를 모두 입력해 주세요.');return;}
 if(!root.PeopleEligibility.allowed(root.SALES_PEOPLE_MASTER,'sales_action',d,next.assignee)){root.showDetailErr('이 업무를 맡을 수 있는 영업담당자를 선택해 주세요.');return;}
 const date=new Date(activity.occurred_at);if(!Number.isFinite(date.getTime())){root.showDetailErr('연락 일시를 확인해 주세요.');return;}
 activity.occurred_at=date.toISOString();form.dataset.saving='true';
 const submit=$('detailAction')?.querySelector('button.da-submit');if(submit)submit.disabled=true;
 const progress=form._contactProgress||(form._contactProgress={});
 async function confirm(operation,payload){
  let id=progress[operation];
  if(id&&root.Phase1.queue.list().find(q=>q.request_id===id)?.status==='rejected'){delete progress[operation];id=null;}
  if(!id){id=root.queueDetailContactOperation(operation,{opportunity_id:d.id,...payload});progress[operation]=id;}
  await root.Phase1.queue.flush();const row=root.Phase1.queue.list().find(q=>q.request_id===id);
  if(row?.status!=='done'||row.ack?.ok!==true||row.ack.operation!==operation||String(row.object_id)!==String(d.id))throw Error(row?.error||'서버 확인 대기 중입니다. 다시 누르면 같은 요청의 결과를 확인합니다.');
  return row;
 }
 try{
  root.showDetailErr('연락 결과 저장 확인 중…',true);const recorded=await confirm('activity',activity);
  const a=recorded.payload||activity;d.activities=Array.isArray(d.activities)?d.activities:[];if(!d.activities.some(x=>x.id===recorded.ack.activity_id))d.activities.unshift({id:recorded.ack.activity_id,type:a.type,note:a.note,result:a.result,at:a.occurred_at,occurred_at:a.occurred_at});
  if(root.CUR_DETAIL?.item!==d)return;
  root.showDetailErr('연락 결과 저장 확인 완료 · 다음 할 일 저장 확인 중…',true);const scheduled=await confirm('next_action',next);
  if(root.CUR_DETAIL?.item!==d)return;
  const n=scheduled.payload||next,p=root.currentPatch(),obj={id:scheduled.ack.next_action_id,type:n.type,text:n.text,due:n.due_at,due_at:n.due_at,assignee:n.assignee,status:'open'};d.nextActionObj=p.nextActionObj=obj;d.nextAction=p.nextAction=n.due_at;d.nextActionText=p.nextActionText=n.text;root.saveLocal();
  close(false);root.renderDetail();root.showDetailErr('연락 결과와 다음 할 일의 서버 저장을 확인했습니다.',true);
 }catch(e){root.showDetailErr((progress.activity&&root.Phase1.queue.list().find(q=>q.request_id===progress.activity)?.status==='done'?'연락 결과는 저장되었습니다. 다음 할 일은 아직 확인되지 않았습니다. ':'저장 완료를 확인하지 못했습니다. ')+String(e.message||e));}
 finally{delete form.dataset.saving;if(submit?.isConnected)submit.disabled=false;}
}
function flatTimeline(all=false){
 const d=root.CUR_DETAIL?.item;if(!d)return '';
 const rows=root.unifiedTimeline(root.currentPatch(),d),shown=all?rows:rows.slice(0,6);
 const names={next_action_set:'다음 할 일 등록',next_action_completed:'다음 할 일 완료',next_action_complete:'다음 할 일 완료',stage_change:'진행상태 변경',stage_changed:'진행상태 변경',owner_changed:'담당자 변경',activity_created:'연락 결과','단계전환':'진행상태 변경','단계 전환':'진행상태 변경'};
 return shown.length?'<ol class="da-events">'+shown.map(x=>'<li><div class="da-event-meta"><time>'+root.esc(root.dateTimeLabel(x.at))+'</time><span>'+root.esc(x.who||'담당자 미기록')+'</span></div><strong>'+root.esc(names[x.ttl]||(/^[a-z]+(?:_[a-z]+)+$/.test(x.ttl)?'업무 기록':x.ttl||'연락 결과'))+'</strong>'+[x.body,x.result,...(x.fields||[]).map(f=>f.join(' · '))].filter(Boolean).map(t=>'<p>'+root.esc(root.sayLegacyNote?root.sayLegacyNote(t):t)+'</p>').join('')+(!x.body&&!x.result&&!x.fields?.length?'<p>상세 내용은 확인되지 않았습니다.</p>':'')+'</li>').join('')+'</ol>':'<p class="da-hint">아직 연락 결과가 없습니다.</p>';
}
function refreshRecent(){const host=$('activityTimelineHost');if(host&&$('detailView')?.classList.contains('da-ready')){host.innerHTML=flatTimeline();const intro=host.closest('.dcard')?.querySelector('.detailsecthead p');if(intro)intro.textContent='최근 활동 6건을 바로 확인합니다. 이전 기록은 전체 이력에서 확인하세요.';}}
function flatten(scope){
 // Replace disclosure containers, retaining every original child and handler.
 scope.querySelectorAll('details').forEach(n=>{const card=document.createElement('section');for(const a of n.attributes)if(a.name!=='open')card.setAttribute(a.name,a.value);const summary=n.querySelector(':scope > summary');if(summary){const h=document.createElement('h3');h.textContent=summary.textContent.replace(/[▶▼]/g,'').trim();summary.replaceWith(h)}card.append(...n.childNodes);n.replaceWith(card)});
}
function viewingCards(body,stash){
 const d=root.CUR_DETAIL.item,p=root.currentPatch(),contexts=d.stage_contexts||p.stage_contexts||{},right=body.querySelector('.dw-right');if(!right)return;
 const code=root.dealStage(d),fields=Object.assign({},...Object.values(contexts).map(c=>c?.fields||{}),contexts[code]?.fields||{});
 function card(title,pairs){const n=document.createElement('section');n.className='dcard da-info';const h=document.createElement('h3');h.textContent=title;n.append(h);const dl=document.createElement('dl');pairs.forEach(([label,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;const empty=value==null||value==='';dd.textContent=empty?'미입력':String(value);if(empty)dd.className='da-empty';dl.append(dt,dd)});n.append(dl);right.append(n);return n;}
 const files=root.execAttachments(d),quotes=root.execQuoteVersions(d),photos=files.filter(x=>/^image\//.test(x.mime_type||''));
 const original=$('dw-materials');if(original)stash.append(original);
 const material=card('자료',[['사진',photos.length+'건'],['견적서',quotes.length+'건'],['기타자료',(files.length-photos.length)+'건']]);material.id='da-material-summary';material.append(button('자료 보기','materials'),button('+ 자료 추가','materials'));
 const extra=document.createElement('div');extra.id='da-management-fields';
 right.querySelectorAll(':scope > .dw-fold').forEach(n=>extra.append(n));stash.append(extra);
 const management=card('추가 관리정보',[['고객 반응',fields.customer_reaction||fields.reaction||d.customer_reaction],['의사결정자',fields.decision_maker||d.decision_maker],['경쟁사',fields.competitor||d.competitor],['입찰 예정일',fields.bid_deadline||fields.bid_date||d.bid_date]]);management.append(button('관리정보 수정','management'));
 const ledger=root.ContractSalesData?.state(),contract=ledger?.status==='ready'?ledger.items.find(x=>String(x.deal_id)===String(d.id)):null,f=contexts.contract?.fields||{};
 const money=v=>v==null||v===''?'—':root.fmtAmt(v);
 const work=card('공종 · 금액',[['공종',root.dealWorkSummary(d)||'미분류'],['예상금액',money(d.amount??d.amt)],['계약금액',money(contract?.balance??f.contract_amount)],['계약일',contract?.contract_date||f.contract_date||'—'],['실적귀속 담당자',contract?.sales_owner_name||'—']]);
 if(contract){const status=document.createElement('p');status.className='da-contract-state';status.textContent=contract.cancelled?'계약 취소 · 조정 이력 보존':'✓ 영업실적 확정';work.append(status)}
 work.append(button('공종 수정','work',()=>root.openWorkEdit()),button('금액 수정','amount'));
 if(root.ContractSalesUI)work.append(button('계약실적 · 변경·취소 이력','amount',()=>root.ContractSalesUI.editor(d)));
 const oldHistory=$('dw-history');if(oldHistory)stash.append(oldHistory);
 const schema=root.StageTransition?.definitions?.[code];if(schema){const current=contexts[code]?.fields||{},summary=card('현재 단계 · '+root.stageLabel(code),schema.fields.map(f=>[f.label,Array.isArray(current[f.key])?current[f.key].join(' · '):f.type==='money'?money(current[f.key]):current[f.key]]));summary.classList.add('da-stage-summary');$('dw-now')?.after(summary);}
 body.querySelectorAll('.dw-left .contactedit').forEach(n=>{if(n.querySelector('input,select,textarea')){const edit=button('연락처 수정','contact',()=>open('contact'));n.before(edit);n.id='da-contact-fields';stash.append(n)}});
 flatten(body);
}
function focus(id){if(!$('detailView')?.classList.contains('da-ready'))return false;const map={activityFormCard:'activity',nextActionCard:'next','dv-amt':'amount','dw-amount':'amount','dv-assignee':'owner',execFiles:'materials','dw-history':'history'};const key=map[id];if(!key)return false;if(state?.key!==key)open(key);return true;}
function decorate(){
 const view=$('detailView'),body=$('dv-body');if(!view?.classList.contains('dw-wide')){close(false);view?.querySelector('.da-toolbar')?.remove();view?.classList.remove('da-ready');return;}
 // A server-confirmed render replaces the form nodes; retire the old presentation.
 let nextDraft=null;
 if(state&&!body.contains(state.moves[0]?.[1])){if(state.key==='activity'&&!state.panel.querySelector('#rel-contact-save'))nextDraft=[...state.panel.querySelectorAll('#nextActionCard input[id],#nextActionCard select[id],#nextActionCard textarea[id]')].map(n=>[n.id,n.value]);close(false);}
 if(body.querySelector('.da-stash'))return;
 view.querySelector('.da-toolbar')?.remove();view.classList.add('da-ready');
 /* 2026-09-24 CX 지시(G): 첫 화면 CTA는 '지금 할 일' 카드 하나 — 빠른 작업 6버튼은 더보기 뒤로 수납 */
 const toolbar=document.createElement('nav');toolbar.className='da-toolbar';toolbar.setAttribute('aria-label','빠른 작업');
 const tools=document.createElement('span');tools.className='da-tools';tools.hidden=true;
 [['연락 결과','activity'],['다음 할 일','next'],['진행상태 변경','stage'],['담당자 변경','owner'],['자료 추가','materials'],['지원 요청','support'],['ⓘ 관리 기준','help']].forEach(([text,key])=>tools.append(button(text,key,key==='stage'?()=>root.openTransition():null)));
 const more=document.createElement('button');more.type='button';more.className='da-more';more.textContent='···  작업 더보기';
 more.onclick=()=>{tools.hidden=!tools.hidden;more.classList.toggle('on',!tools.hidden);more.textContent=tools.hidden?'···  작업 더보기':'작업 접기 ↑';};
 toolbar.append(more,tools);
 /* 2026-09-24 지시: 빠른 작업 바(더보기·단계 primary)는 상세 헤더 오른쪽에 */
 const top=view.querySelector('.detailtop');
 if(top){toolbar.classList.add('da-top');top.append(toolbar)}else body.before(toolbar);
 // Keep one set of original inputs and their handlers, outside the viewing surface.
 const stash=document.createElement('div');stash.className='da-stash';stash.hidden=true;const selectors=['#activityFormCard','#nextActionCard','#dw-amount'];const atomic=$('rel-contact-save')?.closest('.dactions');selectors.forEach(s=>{const n=body.querySelector(s);if(n)stash.append(n)});if(atomic&&!stash.contains(atomic))stash.append(atomic);const owner=$('dv-assignee')?.closest('.dcard');if(owner)stash.append(owner);body.append(stash);
 body.querySelectorAll('.dw-fold').forEach(n=>{if(!n.querySelector('.dcard,.dsec,#execFiles,#execQuotePanel'))n.remove()});
 const management=body.querySelector('.dw-management');if(management){const keys=['amount','owner','next'];management.querySelectorAll('dd').forEach((dd,i)=>{const b=button(dd.textContent,keys[i]);b.classList.add('da-edit');if(keys[i]==='next')b.dataset.help='다음 확인일 변경';dd.replaceChildren(b)});const h=management.querySelector('h3');if(h){const b=button(h.textContent,'stage',()=>root.openTransition());b.classList.add('da-edit');h.replaceChildren(b)}}
 const work=body.querySelector('.dw-site dd:last-of-type');if(work){const b=button(work.textContent,'work',()=>root.openWorkEdit());b.classList.add('da-edit');work.replaceChildren(b)}
 body.querySelectorAll('.dcard h3').forEach(h=>{if(h.textContent.trim()==='관리 원칙')h.closest('.dcard').hidden=true});
 const timeline=$('activityTimelineHost')?.closest('.dcard');if(timeline){timeline.classList.add('da-recent');timeline.querySelectorAll('.activity-filter').forEach(n=>n.hidden=true);refreshRecent();timeline.append(button('전체 이력 보기','history'));}
 viewingCards(body,stash);
 if(nextDraft){open('next');nextDraft.forEach(([id,value])=>{if($(id))$(id).value=value})}
 const favorite=view.querySelector('.exec-favorite');if(favorite){favorite.dataset.help=favorite.classList.contains('on')?'즐겨찾기에서 해제':'중요 현장으로 즐겨찾기';favorite.removeAttribute('title')}
 body.querySelectorAll('button').forEach(b=>{if(/연락처 등록/.test(b.textContent))b.dataset.help='고객 연락처를 등록합니다.'});
}
const oldRefresh=root.refreshActivityTimeline;if(oldRefresh)root.refreshActivityTimeline=function(){const result=oldRefresh.apply(this,arguments);refreshRecent();return result};
root.DetailActions={decorate,open,close,focus,refreshRecent,get active(){return state?.key||null}};
})(window);

