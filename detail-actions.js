(function(root){
'use strict';
let state=null,tip=null,timer=null;
const $=id=>document.getElementById(id);
const descriptions={activity:'전화·방문·문자 등 고객 접촉 내용과 다음 행동을 기록합니다.',next:'다음에 해야 할 업무와 기한을 설정합니다.',stage:'현재 영업단계를 변경하고 후속 일정을 설정합니다.',owner:'담당자 변경',amount:'예상금액 입력·수정',materials:'견적서·사진·관련 자료를 등록합니다.',history:'단계·담당자·정보 변경 내역 확인',work:'공종 선택·수정',help:'영업 관리 기준 확인'};
function button(text,key,fn){const b=document.createElement('button');b.type='button';b.className='dact da-action';b.textContent=text;b.dataset.help=descriptions[key]||text;b.onclick=fn||(()=>open(key));return b;}
function hideTip(){clearTimeout(timer);tip?.remove();tip=null;document.querySelectorAll('[aria-describedby="da-tooltip"]').forEach(n=>n.removeAttribute('aria-describedby'));}
function tooltip(target,delay){hideTip();timer=setTimeout(()=>{if(!target.isConnected)return;tip=document.createElement('div');tip.id='da-tooltip';tip.role='tooltip';tip.textContent=target.dataset.help;document.body.append(tip);target.setAttribute('aria-describedby',tip.id);const r=target.getBoundingClientRect(),t=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-t.width-8,r.left))+'px';tip.style.top=(r.bottom+t.height+16<innerHeight?r.bottom+8:Math.max(8,r.top-t.height-8))+'px';},delay);}
document.addEventListener('pointerover',e=>{const n=e.target.closest('[data-help]');if(n&&!n.contains(e.relatedTarget))tooltip(n,350)});
document.addEventListener('pointerout',e=>{const n=e.target.closest('[data-help]');if(n&&!n.contains(e.relatedTarget))hideTip()});
document.addEventListener('focusin',e=>{const n=e.target.closest('[data-help]');if(n)tooltip(n,0)});
document.addEventListener('focusout',hideTip);window.addEventListener('resize',hideTip);document.addEventListener('scroll',hideTip,true);
function close(restore=true){hideTip();if(!state)return;const old=state;state=null;old.moves.forEach(([n,mark])=>{if(mark.isConnected)mark.replaceWith(n)});old.panel.remove();old.background.forEach(n=>n.inert=false);if(restore&&old.focus?.isConnected)old.focus.focus({preventScroll:true});}
function take(n,host){if(!n||!state)return;const mark=document.createComment('detail-action-position');n.before(mark);state.moves.push([n,mark]);host.append(n);}
function open(key){
 const view=$('detailView');if(!view?.classList.contains('dw-wide'))return false;
 close(false);hideTip();
 const titles={activity:'활동 기록 · 다음 행동',next:'다음 행동 설정',stage:'단계 변경',owner:'담당자 변경',amount:'예상금액 수정',materials:'자료 보기 · 추가',history:'전체 이력',help:'관리 기준'};
 const panel=document.createElement('div');panel.id='detailAction';panel.className='da-layer '+(['activity','stage','materials','history'].includes(key)?'da-drawer':'da-compact');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','da-title');
 const sheet=document.createElement('section');sheet.className='da-sheet';const head=document.createElement('header');const title=document.createElement('h2');title.id='da-title';title.textContent=titles[key];const x=button('닫기',key,()=>{if(key==='stage')root.StageTransitionUI?.close();else close()});x.removeAttribute('data-help');x.setAttribute('aria-label','작업창 닫기');head.append(title,x);const content=document.createElement('div');content.className='da-content';sheet.append(head,content);panel.append(sheet);
 state={key,panel,moves:[],focus:document.activeElement,background:Array.from(view.children)};view.append(panel);state.background.forEach(n=>n.inert=true);
 const next=$('nextActionCard'),activity=$('activityFormCard'),atomic=$('rel-contact-save');
 if(key==='activity'){take(activity,content);take(next,content);if(atomic){const actions=atomic.closest('.dactions');actions.before(next);const save=next?.querySelector('.dactions .pri');if(save)save.style.display='none';}else{const save=activity?.querySelector('.dactions .pri');if(save){save.classList.add('da-submit');save.textContent='활동·다음 행동 저장';save.onclick=saveCombined;take(save.closest('.dactions'),content);}const nextSave=next?.querySelector('.dactions .pri');if(nextSave)nextSave.style.display='none';}}
 if(key==='next'){take(next,content);const save=next?.querySelector('.dactions .pri');if(save)save.style.display='';}
 if(key==='amount')take($('dw-amount'),content);
 if(key==='owner')take($('dv-assignee')?.closest('.dcard'),content);
 if(key==='materials'){take($('execFiles'),content);take($('execQuotePanel'),content);}
 if(key==='history'){take($('activityTimelineHost')?.closest('.dcard'),content);take($('dw-history'),content);const h=$('dw-history');if(h)h.open=true;}
 if(key==='stage')take($('dw-stage-editor'),content);
 if(key==='help')content.textContent='활동 기록은 고객과의 접촉 내용입니다. 단계 변경은 별도 전환창에서 확인합니다. 담당자·최근 활동·다음 행동일을 함께 관리하고, 저장 후 서버 반영 결과를 확인해 주세요.';
 take($('dv-err'),content);
 const cancel=button('취소',key,()=>{if(key==='stage')root.StageTransitionUI?.close();else close()});cancel.removeAttribute('data-help');content.append(cancel);
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(key==='stage')root.StageTransitionUI?.close();else close();return}if(e.key==='Tab'){const nodes=[...panel.querySelectorAll('button,input,textarea,select,a[href],[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}},true);
 (content.querySelector('input:not([type="hidden"]),textarea,select')||x).focus({preventScroll:true});return true;
}

async function saveCombined(){
 const form=$('activityFormCard'),d=root.CUR_DETAIL?.item;if(!form||!d||form.dataset.saving)return;
 const get=id=>$(id)?.value?.trim()||'';
 const activity={type:get('dv-act-type'),note:get('dv-act-note'),result:get('dv-act-result'),occurred_at:get('dv-act-at')};
 const next={type:root.NextActionPicker.read('dv-na-type'),text:get('dv-na-text'),due_at:get('dv-na-date'),assignee:get('dv-na-assignee')};
 if(!activity.type||!activity.note||!activity.occurred_at||!next.type||!next.text||!next.due_at||!next.assignee){root.showDetailErr('활동 내용·일시와 다음 행동·기한·담당자를 모두 입력해 주세요.');return;}
 if(!root.PeopleEligibility.allowed(root.SALES_PEOPLE_MASTER,'sales_action',d,next.assignee)){root.showDetailErr('이 업무를 맡을 수 있는 영업담당자를 선택해 주세요.');return;}
 const date=new Date(activity.occurred_at);if(!Number.isFinite(date.getTime())){root.showDetailErr('활동 일시를 확인해 주세요.');return;}
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
  root.showDetailErr('활동 기록 저장 확인 중…',true);const recorded=await confirm('activity',activity);
  const a=recorded.payload||activity;d.activities=Array.isArray(d.activities)?d.activities:[];if(!d.activities.some(x=>x.id===recorded.ack.activity_id))d.activities.unshift({id:recorded.ack.activity_id,type:a.type,note:a.note,result:a.result,at:a.occurred_at,occurred_at:a.occurred_at});
  if(root.CUR_DETAIL?.item!==d)return;
  root.showDetailErr('활동 저장 확인 완료 · 다음 행동 저장 확인 중…',true);const scheduled=await confirm('next_action',next);
  if(root.CUR_DETAIL?.item!==d)return;
  const n=scheduled.payload||next,p=root.currentPatch(),obj={id:scheduled.ack.next_action_id,type:n.type,text:n.text,due:n.due_at,due_at:n.due_at,assignee:n.assignee,status:'open'};d.nextActionObj=p.nextActionObj=obj;d.nextAction=p.nextAction=n.due_at;d.nextActionText=p.nextActionText=n.text;root.saveLocal();
  close(false);root.renderDetail();root.showDetailErr('활동과 다음 행동의 서버 저장을 확인했습니다.',true);
 }catch(e){root.showDetailErr((progress.activity&&root.Phase1.queue.list().find(q=>q.request_id===progress.activity)?.status==='done'?'활동은 저장되었습니다. 다음 행동은 아직 확인되지 않았습니다. ':'저장 완료를 확인하지 못했습니다. ')+String(e.message||e));}
 finally{delete form.dataset.saving;if(submit?.isConnected)submit.disabled=false;}
}
function focus(id){if(!$('detailView')?.classList.contains('da-ready'))return false;const map={activityFormCard:'activity',nextActionCard:'next','dv-amt':'amount','dw-amount':'amount','dv-assignee':'owner',execFiles:'materials','dw-history':'history'};const key=map[id];if(!key)return false;if(state?.key!==key)open(key);return true;}
function decorate(){
 const view=$('detailView'),body=$('dv-body');if(!view?.classList.contains('dw-wide')){close(false);view?.querySelector('.da-toolbar')?.remove();view?.classList.remove('da-ready');return;}
 // A server-confirmed render replaces the form nodes; retire the old presentation.
 let nextDraft=null;
 if(state&&!body.contains(state.moves[0]?.[1])){if(state.key==='activity'&&!state.panel.querySelector('#rel-contact-save'))nextDraft=[...state.panel.querySelectorAll('#nextActionCard input[id],#nextActionCard select[id],#nextActionCard textarea[id]')].map(n=>[n.id,n.value]);close(false);}
 if(body.querySelector('.da-stash'))return;
 view.querySelector('.da-toolbar')?.remove();view.classList.add('da-ready');
 const toolbar=document.createElement('nav');toolbar.className='da-toolbar';toolbar.setAttribute('aria-label','빠른 작업');[['활동 기록','activity'],['다음 행동','next'],['단계 변경','stage'],['담당자 변경','owner'],['자료 추가','materials'],['ⓘ 관리 기준','help']].forEach(([text,key])=>toolbar.append(button(text,key,key==='stage'?()=>root.openTransition():null)));body.before(toolbar);
 // Keep one set of original inputs and their handlers, outside the viewing surface.
 const stash=document.createElement('div');stash.className='da-stash';stash.hidden=true;const selectors=['#activityFormCard','#nextActionCard','#dw-amount'];const atomic=$('rel-contact-save')?.closest('.dactions');selectors.forEach(s=>{const n=body.querySelector(s);if(n)stash.append(n)});if(atomic&&!stash.contains(atomic))stash.append(atomic);const owner=$('dv-assignee')?.closest('.dcard');if(owner)stash.append(owner);body.append(stash);
 body.querySelectorAll('.dw-fold').forEach(n=>{if(!n.querySelector('.dcard,.dsec,#execFiles,#execQuotePanel'))n.remove()});
 const management=body.querySelector('.dw-management');if(management){const keys=['amount','owner','next'];management.querySelectorAll('dd').forEach((dd,i)=>{const b=button(dd.textContent,keys[i]);b.classList.add('da-edit');if(keys[i]==='next')b.dataset.help='다음 확인일 변경';dd.replaceChildren(b)});const h=management.querySelector('h3');if(h){const b=button(h.textContent,'stage',()=>root.openTransition());b.classList.add('da-edit');h.replaceChildren(b)}}
 const work=body.querySelector('.dw-site dd:last-of-type');if(work){const b=button(work.textContent,'work',()=>root.openWorkEdit());b.classList.add('da-edit');work.replaceChildren(b)}
 body.querySelectorAll('.dcard h3').forEach(h=>{if(h.textContent.trim()==='관리 원칙')h.closest('.dcard').hidden=true});
 const timeline=$('activityTimelineHost')?.closest('.dcard');if(timeline){timeline.classList.add('da-recent');timeline.append(button('전체 이력 보기','history'));}
 if(nextDraft){open('next');nextDraft.forEach(([id,value])=>{if($(id))$(id).value=value})}
 const favorite=view.querySelector('.exec-favorite');if(favorite){favorite.dataset.help=favorite.classList.contains('on')?'즐겨찾기에서 해제':'중요 현장으로 즐겨찾기';favorite.removeAttribute('title')}
 body.querySelectorAll('button').forEach(b=>{if(/연락처 등록/.test(b.textContent))b.dataset.help='고객 연락처를 등록합니다.'});
}
root.DetailActions={decorate,open,close,focus,get active(){return state?.key||null}};
})(window);

