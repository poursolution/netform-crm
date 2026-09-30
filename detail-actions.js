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
function close(restore=true){hideTip();if(!state)return;const old=state;state=null;old.panel.querySelectorAll('[data-material-hidden]').forEach(n=>{n.hidden=false;delete n.dataset.materialHidden});old.moves.forEach(([n,mark])=>{if(mark.isConnected)mark.replaceWith(n)});old.panel.remove();old.background.forEach(n=>n.inert=false);{const ns=$('detailDock')?.querySelector('#nextActionCard .dactions .pri');if(ns)ns.style.display='none';}if(restore&&old.focus?.isConnected)old.focus.focus({preventScroll:true});}
function take(n,host){if(!n||!state)return;const mark=document.createComment('detail-action-position');n.before(mark);state.moves.push([n,mark]);host.append(n);}
function open(key){
 const view=$('detailView');if(!view?.classList.contains('dw-wide'))return false;
 close(false);hideTip();
 /* 연락 결과는 오른쪽 '지금 처리'에 항상 열려 있다(2026-09-29) — 작업창을 띄우지 않고 그 칸으로 */
 if(key==='activity'&&$('detailDock')){const dockEl=$('detailDock');unfoldDock();const note=dockEl.querySelector('#dv-act-note');if(note){note.scrollIntoView({block:'center'});note.focus({preventScroll:true})}else dockEl.scrollIntoView({block:'nearest'});return true;}
 const need={activity:'activityFormCard',next:'nextActionCard',amount:'dw-amount'}[key];
 if(need&&!$(need)){if(open.retrying||typeof root.renderDetail!=='function'){root.showDetailErr?.('입력 칸을 불러오지 못했습니다. 상세를 닫았다가 다시 열어 주세요.');return false;}open.retrying=true;try{root.renderDetail();}finally{open.retrying=false;}return $(need)?open(key):(root.showDetailErr?.('입력 칸을 불러오지 못했습니다. 상세를 닫았다가 다시 열어 주세요.'),false);}
 const titles={activity:'연락 결과 · 다음 할 일',next:'다음 할 일 설정',stage:'진행상태 변경',owner:'담당자 변경',amount:'예상금액 수정',materials:'자료 보기 · 추가',management:'관리정보 수정',contact:'연락처 수정',history:'전체 이력',support:'관리자 지원 요청',help:'관리 기준'};
 const panel=document.createElement('div');panel.id='detailAction';/* 2026-09-24 지시: 상세 안 작업창은 전부 같은 중앙 창 — 우측 드로어·중앙 혼용 금지 */
 panel.className='da-layer da-compact';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','da-title');
 const sheet=document.createElement('section');sheet.className='da-sheet';const head=document.createElement('header');const title=document.createElement('h2');title.id='da-title';title.textContent=titles[key];const x=button('닫기',key,()=>{if(key==='stage')root.StageTransitionUI?.close();else close()});x.removeAttribute('data-help');x.setAttribute('aria-label','작업창 닫기');head.append(title,x);const content=document.createElement('div');content.className='da-content';sheet.append(head,content);panel.append(sheet);
 state={key,panel,moves:[],focus:document.activeElement,background:Array.from(view.children)};view.append(panel);state.background.forEach(n=>n.inert=true);
 const next=$('nextActionCard'),activity=$('activityFormCard'),atomic=$('rel-contact-save');
 if(key==='activity'){take(activity,content);const checks=$('dw-checks');take(checks,content);if(checks)state.checksBefore=[...checks.querySelectorAll('.exec-guide-item')].map(b=>b.classList.contains('on'));take(next,content);if(atomic){const actions=atomic.closest('.dactions');actions.before(next);const save=next?.querySelector('.dactions .pri');if(save)save.style.display='none';}else{const save=activity?.querySelector('.dactions .pri');if(save){save.classList.add('da-submit');save.textContent='연락 결과·다음 할 일 저장';save.onclick=saveCombined;take(save.closest('.dactions'),content);}const nextSave=next?.querySelector('.dactions .pri');if(nextSave)nextSave.style.display='none';}
  wire(content,activity,next);}
 if(key==='next'){next?.classList.remove('da-next-wait');take(next,content);const save=next?.querySelector('.dactions .pri');if(save)save.style.display='';}
 if(key==='amount')take($('dw-amount'),content);
 if(key==='owner')take($('dv-assignee')?.closest('.dcard'),content);
 return finish(key,panel,content,x);
}
/* 2026-09-24 지시: 처음엔 연락 결과만 — 결과 칩·내용이 생기면 다음 할 일이 맞는 기본값으로 열린다 (작업창·오른쪽 '지금 처리' 공통) */
function wire(content,activity,next){
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
  }
}
function finish(key,panel,content,x){
 if(key==='materials'){take($('execFiles'),content);take($('execQuotePanel'),content);const nav=document.createElement('nav');nav.className='da-material-tabs';nav.setAttribute('aria-label','자료 분류');['전체','사진','견적','기타'].forEach(label=>{const b=button(label,'materials',()=>{nav.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));content.querySelectorAll('#execFiles,#execQuotePanel,.exec-file').forEach(n=>{n.dataset.materialHidden='';n.hidden=n.id==='execFiles'?label==='견적':n.id==='execQuotePanel'?!['전체','견적'].includes(label):label==='사진'?n.classList.contains('doc'):label==='기타'?!n.classList.contains('doc'):false})});b.setAttribute('aria-pressed',String(label==='전체'));nav.append(b)});content.prepend(nav);}
 if(key==='history'){const history=document.createElement('div');history.className='da-history';history.innerHTML=flatTimeline(true)+changeRecords();content.append(history);}
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
 if(!['history','help'].includes(key)){const cancel=button('취소',key,()=>{if(key==='stage')root.StageTransitionUI?.close();else close()});cancel.removeAttribute('data-help');content.append(cancel);}
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
function progress_hasActivity(form){return !!form?._contactProgress?.activity}
async function saveCombined(){
 const form=$('activityFormCard'),d=root.CUR_DETAIL?.item;if(!form||!d||form.dataset.saving)return;
 const get=id=>$(id)?.value?.trim()||'';
 const activity={type:get('dv-act-type'),note:get('dv-act-note'),result:get('dv-act-result'),occurred_at:get('dv-act-at')};
 /* 이번 창에서 새로 표시한 체크 항목은 연락 결과 문구에 함께 남긴다(체크 자체는 이 브라우저에만 저장되므로) */
 const ticked=[...($('dw-checks')?.querySelectorAll('.exec-guide-item')||[])].map((b,i)=>b.classList.contains('on')&&!(state?.checksBefore||dockChecks||[])[i]?b.textContent.replace('✓','').trim():'').filter(Boolean);
 if(ticked.length&&activity.note&&!progress_hasActivity(form))activity.note+=' · 확인: '+ticked.join(', ');
 const next={type:root.NextActionPicker.read('dv-na-type'),text:get('dv-na-text'),due_at:get('dv-na-date'),assignee:get('dv-na-assignee')};
 if(!activity.type||!activity.note||!activity.occurred_at||!next.type||!next.text||!next.due_at||!next.assignee){root.showDetailErr('연락 결과 내용·일시와 다음 할 일·기한·담당자를 모두 입력해 주세요.');return;}
 if(!root.PeopleEligibility.allowed(root.SALES_PEOPLE_MASTER,'sales_action',d,next.assignee)){root.showDetailErr('이 업무를 맡을 수 있는 영업담당자를 선택해 주세요.');return;}
 const date=new Date(activity.occurred_at);if(!Number.isFinite(date.getTime())){root.showDetailErr('연락 일시를 확인해 주세요.');return;}
 activity.occurred_at=date.toISOString();form.dataset.saving='true';
 const submit=document.querySelector('#detailAction button.da-submit,#detailDock button.da-submit');if(submit)submit.disabled=true;
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
 const seen=new Set(),rows=root.unifiedTimeline(root.currentPatch(),d).filter(x=>{const k=[x.ttl,x.body,x.result,String(x.at||'').slice(0,16)].join('|');if(seen.has(k))return false;seen.add(k);return true;}),shown=all?rows:rows.slice(0,5);
 const names={next_action_set:'다음 할 일 등록',next_action_completed:'다음 할 일 완료',next_action_complete:'다음 할 일 완료',stage_change:'진행상태 변경',stage_changed:'진행상태 변경',owner_changed:'담당자 변경',activity_created:'연락 결과','단계전환':'진행상태 변경','단계 전환':'진행상태 변경'};
 return shown.length?'<ol class="da-events">'+shown.map(x=>'<li><div class="da-event-meta"><time>'+root.esc(root.dateTimeLabel(x.at))+'</time><span>'+root.esc(x.who||'담당자 미기록')+'</span></div><strong>'+root.esc(names[x.ttl]||(/^[a-z]+(?:_[a-z]+)+$/.test(x.ttl)?'업무 기록':x.ttl||'연락 결과'))+'</strong>'+[x.body,x.result,...(x.fields||[]).map(f=>f.join(' · '))].filter(Boolean).map(t=>'<p>'+root.esc(root.sayLegacyNote?root.sayLegacyNote(t):t)+'</p>').join('')+'</li>').join('')+'</ol>':'<p class="da-hint">아직 연락 결과가 없습니다.</p>';
}
function changeRecords(){
 const d=root.CUR_DETAIL?.item;if(!d)return '';const p=root.currentPatch?root.currentPatch():{},rows=[];
 try{(typeof root.changeLogRows==='function'?root.changeLogRows(p,d):[]).forEach(r=>rows.push({at:r.at,who:r.who,title:r.k||'변경',body:[r.chg,r.why]}));}catch(e){}
 (p.stageHistory||d.stageHistory||[]).forEach(h=>{if(rows.some(r=>/단계|진행/.test(r.title)&&String(r.at).slice(0,16)===String(h.at).slice(0,16)))return;rows.push({at:h.at,who:h.actor,title:'진행상태 변경',body:[(h.from&&h.from!=='—'?h.from+' → ':'')+(h.to||'')]});});
 if(!rows.length)return '';
 rows.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
 return '<h4 class="da-history-sub">단계·담당자 변경</h4><ol class="da-events">'+rows.slice(0,30).map(x=>'<li><div class="da-event-meta"><time>'+root.esc(root.dateTimeLabel(x.at))+'</time><span>'+root.esc(x.who||'담당자 미기록')+'</span></div><strong>'+root.esc(x.title)+'</strong>'+x.body.filter(Boolean).map(t=>'<p>'+root.esc(t)+'</p>').join('')+'</li>').join('')+'</ol>';
}
function refreshRecent(){const host=$('activityTimelineHost');if(host&&$('detailView')?.classList.contains('da-ready')){host.innerHTML=flatTimeline();const intro=host.closest('.dcard')?.querySelector('.detailsecthead p');if(intro)intro.textContent='최근 5건 · 이전 기록은 전체 이력에서';}}
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
 /* '이 단계에서 챙길 정보'에 이미 있는 칸은 추가 관리정보에서 뺀다(2026-09-27 컨설턴트 ② — 고객 반응·경쟁사·입찰일이 두 곳에 나오던 것) */
 const stageKeys=new Set((root.StageTransition?.definitions?.[code]?.fields||[]).map(f=>f.key));
 const management=card('추가 관리정보',[['고객 반응',fields.customer_reaction||fields.reaction||d.customer_reaction,['customer_reaction','reaction']],['의사결정자',fields.decision_maker||d.decision_maker,['decision_maker']],['경쟁사',fields.competitor||d.competitor,['competitor']],['입찰 예정일',fields.bid_deadline||fields.bid_date||d.bid_date,['bid_deadline','bid_date']]].filter(r=>!r[2].some(k=>stageKeys.has(k))).map(r=>[r[0],r[1]]));management.append(button('관리정보 수정','management'));
 const ledger=root.ContractSalesData?.state(),contract=ledger?.status==='ready'?ledger.items.find(x=>String(x.deal_id)===String(d.id)):null,f=contexts.contract?.fields||{};
 const money=v=>v==null||v===''?'—':root.fmtAmt(v),exact=v=>v==null||v===''||!Number(v)?'—':Number(v).toLocaleString('ko-KR')+'원';/* 상세 정보 칸은 정확값, 요약은 헤더에서 억 단위 */
 const work=card('공종 · 금액',[['공종',root.dealWorkSummary(d)||'미분류'],['예상금액',exact(d.amount??d.amt)],['계약금액',exact(contract?.balance??f.contract_amount)],['계약일',contract?.contract_date||f.contract_date||'—']]);
 work.append(button('공종 수정','work',()=>root.openWorkEdit()),button('금액 수정','amount'));
 /* 계약실적(체결·변경·취소)은 운영 화면에 두지 않는다(2026-09-26 대표) — 체결은 진행상태 '계약 체결 완료'가 서버에서 자동 기록, 변경·취소는 성과 분석(관리자) */
 const oldHistory=$('dw-history');if(oldHistory)stash.append(oldHistory);
 /* '미입력'만 보여주면 할 수 있는 게 없다(2026-09-30 대표 지적) — 이미 아는 값(관계관리 사유·최근 연락·다음 할 일 날짜·연락 기록에 적은 값)으로 먼저 채우고,
    그래도 빈 칸에는 오른쪽 '지금 처리'로 가는 단추를 붙인다. 저장 경로는 기존 연락 결과·다음 할 일 그대로 */
 const schema=root.StageTransition?.definitions?.[code];if(schema){const current=contexts[code]?.fields||{},m=typeof root.relationshipMeta==='function'?(root.relationshipMeta(d)||{}):{},na=typeof root.actionObj==='function'?root.actionObj(d,p):null;
  let lines=null;const noted=label=>{if(!lines)try{lines=root.unifiedTimeline(p,d).map(x=>[x.body,x.result].filter(Boolean).join('\n'))}catch(e){lines=[]}const re=new RegExp('(?:^|\\n)\\s*'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[:：]\\s*([^\\n]+)');for(const t of lines){const hit=re.exec(t);if(hit&&hit[1].trim())return hit[1].trim()}return ''};
  const known={relationship_reason:p.relationshipReason||p.relationship_reason||d.relationshipReason||d.relationship_reason,reason:p.waitingReason||p.waiting_reason||d.waitingReason||d.waiting_reason,last_contact:String(m.meaningfulAt||'').slice(0,10),contact_date:String((na&&na.due)||m.due||'').slice(0,10)};
  const rows=schema.fields.filter(f=>!/followup|next_/.test(f.key)).filter(f=>f.key!=='relationship_reason_detail'||current.relationship_reason==='기타').map(f=>{const raw=current[f.key],own=Array.isArray(raw)?raw.join(' · '):f.type==='money'?(raw==null||raw===''||!Number(raw)?'':exact(raw)):raw;return {f,value:own==null||own===''?(known[f.key]||noted(f.label)||''):own}});
  const summary=card('이 단계에서 챙길 정보',rows.map(r=>[r.f.label,r.value]));summary.classList.add('da-stage-summary');
  if(!d.outcome&&d.lifecycle_status!=='closed'&&rows.some(r=>!r.value)){const dds=summary.querySelectorAll('dd');rows.forEach((r,i)=>{if(r.value||!dds[i])return;const kind=r.f.key==='contact_date'?'date':r.f.key==='last_contact'?'contact':'note',b=document.createElement('button');b.type='button';b.className='da-fill';b.textContent=kind==='date'?'날짜 잡기':kind==='contact'?'연락 결과 남기기':'입력하기';b.onclick=()=>fill(kind,r.f.label);dds[i].append(' ',b)});
   const hint=document.createElement('p');hint.className='da-fill-hint';hint.textContent="빈 칸은 오른쪽 '지금 처리'에 적어 저장하면 여기에 표시됩니다.";summary.append(hint)}
  $('dw-now')?.after(summary);}
 body.querySelectorAll('.dw-left .contactedit').forEach(n=>{if(n.querySelector('input,select,textarea')){const edit=button('연락처 수정','contact',()=>open('contact'));n.before(edit);n.id='da-contact-fields';stash.append(n)}});
 flatten(body);
}
/* 오른쪽 '지금 처리'(2026-09-29 컨설턴트 4차 · 대표 '진행해줘'): 견적문의 상세와 같은 흐름 — 열자마자 연락 결과·다음 할 일·날짜·저장.
   9/24 '작업창은 가운데 하나' 규칙 중 연락 결과 입력만 이쪽으로 옮긴다(나머지 수정은 그대로 가운데 창). 종료된 영업건은 입력 없음. */
function fill(kind,label){
 const note=$('dv-act-note'),date=$('dv-na-date'),el=kind==='date'?date:note;
 if(el&&!el.getClientRects().length)unfoldDock();
 const put=n=>{if(kind!=='note'||!n)return;const line=label+': ';if(!n.value.includes(line)){n.value=(n.value?n.value.replace(/\s*$/,'\n'):'')+line;n.dispatchEvent(new Event('input',{bubbles:true}))}if(n.setSelectionRange)n.setSelectionRange(n.value.length,n.value.length)};
 if(!el||!el.getClientRects().length){open(kind==='date'?'next':'activity');const n2=kind==='date'?$('dv-na-date'):$('dv-act-note');if(n2){put(n2);n2.focus()}return}
 put(el);el.scrollIntoView({block:'center'});el.focus();
}
let dockChecks=null;
function dock(body){
 /* 2026-09-30 대표: 입력은 위 '연락하고 결과 남기기' 창 하나로 — 오른쪽 칸에는 입력을 두지 않는다('오른쪽 칸 너무 복잡해'). 아래 구성은 보류 */
 if(!root.DETAIL_DOCK_ENABLED)return;
 const right=body.querySelector('.dw-right'),d=root.CUR_DETAIL?.item;dockChecks=null;
 if(!right||$('detailDock')||!d||d.outcome||d.lifecycle_status==='closed')return;
 const activity=$('activityFormCard'),next=$('nextActionCard');if(!activity||!next)return;
 const box=document.createElement('section');box.id='detailDock';box.className='dcard da-dock';box.setAttribute('aria-label','지금 처리');
 const title=document.createElement('h3');title.textContent='지금 처리 · 연락 결과';
 const content=document.createElement('div');content.className='da-content da-dock-content';box.append(title,content);
 const atomic=$('rel-contact-save'),checks=$('dw-checks');
 /* 2026-09-30 대표: '연락하고 결과 남기기' 창과 이 칸이 같은 일 — 위는 결과 고르기(한 번에 끝), 아래 상세 입력은 접어 둔다 */
 const quick=document.createElement('div');quick.className='da-quick';
 const toggle=document.createElement('button');toggle.type='button';toggle.className='da-dock-toggle';
 const more=document.createElement('div');more.className='da-dock-more';more.hidden=true;
 const label=()=>{toggle.textContent=more.hidden?'자세히 기록 · 활동 유형·일시·결과를 직접 입력 ▾':'간단히 고르기로 ▴'};
 toggle.onclick=()=>{more.hidden=!more.hidden;label();if(!more.hidden)$('dv-act-note')?.focus({preventScroll:true})};label();
 if(root.NowCard&&typeof root.NowCard.inline==='function')root.NowCard.inline(quick,d,()=>{more.hidden=false;label();$('dv-act-note')?.focus({preventScroll:true})});
 else{more.hidden=false;toggle.hidden=true;}
 content.append(quick,toggle,more);
 more.append(activity);
 if(checks){more.append(checks);dockChecks=[...checks.querySelectorAll('.exec-guide-item')].map(b=>b.classList.contains('on'));}
 more.append(next);
 if(atomic){const actions=atomic.closest('.dactions');if(!more.contains(actions))more.append(actions);actions.before(next);const save=next.querySelector('.dactions .pri');if(save)save.style.display='none';}
 else{const save=activity.querySelector('.dactions .pri');if(save){save.classList.add('da-submit');save.textContent='연락 결과·다음 할 일 저장';save.onclick=saveCombined;more.append(save.closest('.dactions'));}const nextSave=next.querySelector('.dactions .pri');if(nextSave)nextSave.style.display='none';}
 wire(more,activity,next);
 right.prepend(box);
}
function unfoldDock(){const more=$('detailDock')?.querySelector('.da-dock-more');if(!more)return false;if(more.hidden){more.hidden=false;const t=$('detailDock').querySelector('.da-dock-toggle');if(t)t.textContent='간단히 고르기로 ▴';}return true}
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
 body.querySelectorAll('.dcard h3').forEach(h=>{if(h.textContent.trim()==='관리 원칙')h.closest('.dcard').hidden=true});
 const timeline=$('activityTimelineHost')?.closest('.dcard');if(timeline){timeline.classList.add('da-recent');timeline.querySelectorAll('.activity-filter').forEach(n=>n.hidden=true);refreshRecent();timeline.append(button('전체 이력 보기','history'));}
 viewingCards(body,stash);
 dock(body);
 if(nextDraft){open('next');nextDraft.forEach(([id,value])=>{if($(id))$(id).value=value})}
 const favorite=view.querySelector('.exec-favorite');if(favorite){favorite.dataset.help=favorite.classList.contains('on')?'즐겨찾기에서 해제':'중요 현장으로 즐겨찾기';favorite.removeAttribute('title')}
 body.querySelectorAll('button').forEach(b=>{if(/연락처 등록/.test(b.textContent))b.dataset.help='고객 연락처를 등록합니다.'});
}
const oldRefresh=root.refreshActivityTimeline;if(oldRefresh)root.refreshActivityTimeline=function(){const result=oldRefresh.apply(this,arguments);refreshRecent();return result};
root.DetailActions={decorate,open,close,focus,refreshRecent,get active(){return state?.key||null}};
})(window);

