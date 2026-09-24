/* Card membership is captured at render time; this module never re-filters it. */
(function(root){
 'use strict';
 const registry=new Map();let state=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const definitions={
  nextMissing:['Next 없음','진행 중인 영업기회인데 예정된 다음 행동이 없습니다.'],
  noNext:['Next 없음','진행 중인 영업기회인데 예정된 다음 행동이 없습니다.'],
  overdue:['기한초과','등록된 다음 행동의 기한이 지났지만 완료되지 않았습니다.'],
  nearIdle:['수주임박 무활동','경쟁·PT / 공사임박 / 입찰 / 계약 단계에서 유효접촉이 7일 이상 없거나 유효접촉 기록이 없는 현장입니다.'],
  noAmount:['금액 미입력','예상금액과 견적금액이 모두 입력되지 않은 현장입니다.'],
  stageSla:['Stage SLA 초과','현재 단계 체류일이 해당 단계의 관리 기준을 초과했습니다.'],
  stale:['장기정체','현재 화면의 장기정체 기준에 포함된 현장입니다.'],
  workMissing:['공종 미분류','선택된 구조화 공종이 없는 현장입니다.'],
  recontact:['오늘 재접촉','다음 행동 또는 재접촉 약속일이 오늘이거나 지났습니다.'],
  unassigned:['미배정 문의','현재 영업담당자가 배정되지 않은 문의입니다.'],
  noResponse:['최초응대 지연','현재 화면의 최초응대 확인 기준에 포함된 문의입니다.']
 };
 function bind(slot,kind,rows,title,description){registry.set(slot,{kind,rows:rows.slice(),title:title||definitions[kind]?.[0]||kind,description:description||definitions[kind]?.[1]||'카드에 집계된 동일한 대상입니다.'});return 'IssueModal.open(\''+slot+'\')'}
 function sorted(rows,sort){return rows.slice().sort((a,b)=>sort==='days'?(b.days??-1)-(a.days??-1)||b.amount-a.amount:sort==='owner'?a.owner.localeCompare(b.owner,'ko')||b.amount-a.amount:b.amount-a.amount||(b.days??-1)-(a.days??-1))}
 function buckets(rows){return {week:rows.filter(x=>x.days>=7&&x.days<14).length,long:rows.filter(x=>x.days>=14).length,unknown:rows.filter(x=>x.days==null).length}}
 function facts(d,kind){
  if(kind==='salesIssues')return facts(d,actionObj(d,itemPatch(d,'deal'))?'overdue':'nextMissing');
  const inquiry=['unassigned','noResponse'].includes(kind),p=inquiry?{}:itemPatch(d,'deal'),m=inquiry?{}:relationshipMeta(d),a=inquiry?null:actionObj(d,p),due=a&&(a.due||a.due_at),days=kind==='overdue'?(due?Math.max(0,-daysTo(String(due).slice(0,10))):null):m.days;
  const activities=(p.activities||d.activities||[]).slice().sort((a,b)=>String(b.at||b.occurred_at||'').localeCompare(String(a.at||a.occurred_at||''))),last=activities[0],lastAt=last&&(last.at||last.occurred_at)||d.lastActivity||d.last_activity_at||'',missing=p.next_missing_since||d.next_missing_since;
  let reason=inquiry?(inquiryRoutedOwner(d)?'배정 후 최초응대 확인 필요':'영업담당자 미배정'):'카드 집계 대상';
  if(kind==='nearIdle')reason=days==null?'유효접촉 기록 없음':days+'일 유효접촉 없음';
  if(kind==='noNext'||kind==='nextMissing')reason='다음 행동 없음 · 미등록 기간 '+(missing?relDaysSince(missing)+'일':'미확인');
  if(kind==='overdue')reason=(a?.text||'예정 행동 미기록')+' · 원래 기한 '+String(due||'미기록').slice(0,10)+' · '+(days==null?'초과일 미확인':days+'일 초과');
  if(kind==='noAmount')reason='예상·견적금액 미입력';
  if(kind==='stageSla'||kind==='stale')reason='현재 단계 '+(stageAge(d)==null?'기간 미확인':stageAge(d)+'일 체류');
  if(kind==='workMissing')reason='공종 미분류';if(kind==='recontact')reason='재접촉일 '+String(due||m.due||'미기록').slice(0,10);
  return {d,kind,inquiry,owner:inquiry?(inquiryRoutedOwner(d)||'미배정'):repN(d.assignee),stage:inquiry?(d.status||'접수'):stageLabel(dealStage(d)),code:inquiry?(d.status||'접수'):dealStage(d),amount:inquiry?0:oppAmt(d),days,reason,a,last:kind==='nearIdle'?(m.meaningfulAt?String(m.meaningfulAt).slice(0,10)+' · 유효접촉':'유효접촉 기록 없음'):(lastAt?String(lastAt).slice(0,10)+' '+(last?.type||'활동'):'활동 기록 없음')};
 }
 function open(slot){const config=registry.get(slot);if(!config)return;if(state)close();state={...config,slot,owner:'',stage:'',sort:'amount',focus:document.activeElement,overflow:document.body.style.overflow,notes:new Map(),editor:null};
  state.original=factsAll();state.originalAmount=state.original.reduce((s,r)=>s+r.amount,0);
  const shade=document.createElement('div');shade.id='issue-modal';shade.className='issue-shade';shade.innerHTML='<section class="issue-dialog" role="dialog" aria-modal="true" aria-labelledby="issue-title"><header><div><span class="issue-kicker">바로 찾기 · 문제함</span><h2 id="issue-title"></h2></div><button type="button" data-close aria-label="확인창 닫기">✕</button></header><div id="issue-content"></div></section>';document.body.appendChild(shade);document.body.style.overflow='hidden';shade.onclick=e=>{if(e.target===shade||e.target.closest('[data-close]'))close()};shade.onkeydown=keyboard;render();shade.querySelector('[data-close]').focus()}
 function factsAll(){return state.rows.map(d=>facts(d,state.kind))}
 function keyboard(e){if(state?.message)return;if(e.key==='Escape'){e.preventDefault();close();return}if(e.key!=='Tab')return;const a=Array.from(document.querySelectorAll('#issue-modal button:not([disabled]),#issue-modal input,#issue-modal select,#issue-modal textarea,#issue-modal a')).filter(x=>!x.hidden),first=a[0],last=a[a.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
 function close(){if(!state||state.message)return;const old=state;document.getElementById('issue-modal')?.remove();state=null;document.body.style.overflow=old.overflow;old.focus?.focus({preventScroll:true})}
 function render(){if(!state)return;const all=factsAll(),list=sorted(all.filter(x=>(!state.owner||x.owner===state.owner)&&(!state.stage||x.code===state.stage)),state.sort),b=buckets(state.original),owners=[...new Set(all.map(x=>x.owner))],stages=[...new Map(all.map(x=>[x.code,x.stage])).entries()];
  document.getElementById('issue-title').textContent=state.title+' · '+state.rows.length+'건';
  const option=(v,t,s)=>'<option value="'+esc(v)+'" '+(v===s?'selected':'')+'>'+esc(t)+'</option>';
  document.getElementById('issue-content').innerHTML='<p class="issue-definition">'+esc(state.description)+'</p><div class="issue-summary"><strong>'+state.rows.length+'건 <span>· '+esc(fmtAmt(state.originalAmount))+'</span></strong><small>카드 조회 당시 대상'+(state.kind==='nearIdle'?' · 7~13일 '+b.week+'건 · 14일+ '+b.long+'건 · 기록 없음 '+b.unknown+'건':'')+'</small></div><div class="issue-filters"><label>담당자<select id="issue-owner">'+option('','전체 담당자',state.owner)+owners.map(x=>option(x,x,state.owner)).join('')+'</select></label><label>Stage<select id="issue-stage">'+option('','전체 Stage',state.stage)+stages.map(x=>option(x[0],x[1],state.stage)).join('')+'</select></label><label>정렬<select id="issue-sort">'+[['amount','금액 높은 순'],['days','장기정체 순'],['owner','담당자순']].map(x=>option(x[0],x[1],state.sort)).join('')+'</select></label><span>'+list.length+' / '+state.rows.length+'건</span></div><div class="issue-table-wrap"><table class="issue-table"><thead><tr><th>현장 / 담당자</th><th>현재 단계 / 금액</th><th>최근 활동 / 구체적인 이유</th><th>조치</th></tr></thead><tbody>'+list.map(rowHTML).join('')+'</tbody></table>'+(!list.length?'<p class="issue-empty">해당 조건의 현장이 없습니다.</p>':'')+'</div><div id="issue-editor"></div><p class="issue-foot">조치는 기존 저장 경로로 요청합니다. 처리 요청한 행은 확인을 위해 목록에 남으며, 원래 화면의 필터·위치는 바뀌지 않습니다.</p>';
  ['owner','stage','sort'].forEach(k=>document.getElementById('issue-'+k).onchange=e=>{state[k]=e.target.value;state.editor=null;render()});
  document.querySelectorAll('#issue-modal [data-action]').forEach(el=>el.onclick=()=>action(Number(el.dataset.index),el.dataset.action));
 }
 function rowHTML(r){const i=state.rows.indexOf(r.d),button=(k,t)=>'<button type="button" data-index="'+i+'" data-action="'+k+'">'+t+'</button>';let buttons='';
  if(!r.inquiry){if(['noNext','nextMissing','recontact'].includes(r.kind))buttons+=button('next','다음 행동 등록');else if(r.kind==='overdue')buttons+=button('complete','완료')+button('due','기한 변경');else if(r.kind==='noAmount')buttons+=button('amount','금액 입력');else buttons+=button('call','전화')+button('sms','문자')+button('next','다음 행동')}
  return '<tr><td><strong>'+esc(r.d.site||'현장명 미입력')+'</strong><small>'+esc(r.owner)+'</small></td><td>'+esc(r.stage)+'<strong class="issue-money">'+esc(fmtAmt(r.amount))+'</strong></td><td><small>'+esc(r.last)+'</small><span>'+esc(r.reason)+'</span>'+(state.notes.has(i)?'<small class="issue-pending">'+esc(state.notes.get(i))+'</small>':'')+'</td><td><div class="issue-actions">'+buttons+button('detail','자세히 보기 →')+'</div></td></tr>';
 }
 function action(i,type){const d=state.rows[i];if(!d)return;
  if(type==='detail'){const inquiry=['unassigned','noResponse'].includes(state.kind);close();G._detailPopup=true;(inquiry?drwInq:drwDeal)(JSON.stringify(d));return}
  const p=itemPatch(d,'deal'),a=actionObj(d,p),c=contactInfo(d,p);
  if(type==='call'){const phone=phoneN(c.mobile||c.officeTel);if(!phone){state.notes.set(i,'등록된 전화번호가 없습니다.');render();return}root.location.href='tel:'+phone;return}
  if(type==='sms'){if(!phoneN(c.mobile)){state.notes.set(i,'휴대폰 번호가 없습니다.');render();return}const previous=CUR_DETAIL;state.message=true;CUR_DETAIL={kind:'deal',key:dealKey(d),item:d};const oldClose=closeKakaoModal;closeKakaoModal=function(){oldClose.apply(this,arguments);CUR_DETAIL=previous;closeKakaoModal=oldClose;if(state){state.message=false;document.getElementById('issue-modal').style.visibility='';render()}};document.getElementById('issue-modal').style.visibility='hidden';try{openRelationshipMessage('sms')}catch(e){closeKakaoModal();state.notes.set(i,'메시지 창을 열지 못했습니다.');render()}return}
  state.editor={i,type,action:a?{...a}:null};const host=document.getElementById('issue-editor');
  const dates=String(a?.due||a?.due_at||'').slice(0,10);
  host.innerHTML='<form class="issue-edit"><h3>'+esc(d.site)+' · '+({complete:'다음 행동 완료',due:'기한 변경',next:'다음 행동 등록',amount:'예상금액 입력'}[type])+'</h3>'+(type==='complete'?'<p>'+esc(a?.text||'완료할 행동 없음')+'</p><label>완료 결과 *<textarea id="issue-result" required placeholder="실제로 처리한 결과를 남겨 주세요."></textarea></label>':type==='amount'?'<label>예상금액(원) *<input id="issue-amount" data-money inputmode="decimal" value="'+esc(oppAmt(d)||'')+'" required></label>':(type==='next'?NextActionPicker.html('issue-type',a?.type,dealStage(d),'issue-text','issue-due'):'')+'<label>예정 행동 *<input id="issue-text" value="'+esc(a?.text||'')+'" required></label><label>기한 *<input type="date" id="issue-due" value="'+esc(dates)+'" required></label>')+'<div id="issue-error" role="alert"></div><div class="issue-actions"><button type="button" id="issue-cancel-edit">취소</button><button class="primary" type="submit">저장 요청</button></div></form>';
  host.querySelector('form').onsubmit=e=>{e.preventDefault();save()};document.getElementById('issue-cancel-edit').onclick=()=>{state.editor=null;host.innerHTML=''};host.scrollIntoView({block:'nearest'});host.querySelector('input,textarea,button')?.focus();
 }
 function save(){if(!state?.editor)return;const {i,type,action:before}=state.editor,d=state.rows[i],p=itemPatch(d,'deal'),at=isoNow(),a=actionObj(d,p),error=t=>{document.getElementById('issue-error').textContent=t},read=id=>document.getElementById(id)?.value.trim()||'';
  if(!towerActive(d))return error('현재 진행 중인 영업기회가 아닙니다. 다시 확인해 주세요.');
  if(['complete','due'].includes(type)&&(!a||a.text!==before?.text||String(a.due||a.due_at||'')!==String(before?.due||before?.due_at||'')))return error('다음 행동이 변경되었습니다. 창을 다시 열어 주세요.');
  if(type==='amount'){const amount=MoneyInput.parse(read('issue-amount'));if(!Number.isFinite(amount)||amount<=0)return error('0보다 큰 유효한 금액을 입력해 주세요.');d.amt=p.amt=amount;pushWrite('amount',{opportunity_id:d.id,amount,quote_amount:quoteAmt(d)||null,won_amount:wonAmt(d)||null})}
  else if(type==='complete'){const result=read('issue-result');if(!result)return error('완료 결과를 입력해 주세요.');p.completedActions=(p.completedActions||[]).concat([{...a,status:'completed',completedAt:at,result}]);d.nextActionObj=p.nextActionObj=null;d.nextAction=p.nextAction='';d.nextActionText=p.nextActionText='';d.nextActionDate=p.nextActionDate='';d.due=p.due='';pushWrite('next_action_complete',{opportunity_id:d.id,action_id:a.id,text:a.text,due_at:a.due||a.due_at,at});pushWrite('activity',{opportunity_id:d.id,type:a.type||'기타',note:a.text,result,occurred_at:at,meaningful_contact:false});p.activities=(p.activities||d.activities||[]).concat([{id:'issue-'+Date.now(),type:a.type||'기타',note:a.text,result,at,meaningful:false}]);d.activities=p.activities}
  else{const text=read('issue-text'),due=read('issue-due');if(!text||!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due)return error('예정 행동과 유효한 기한을 입력해 주세요.');const actionType=type==='due'?(a.type||'후속접촉'):NextActionPicker.read('issue-type'),obj={...a,id:a?.id||'na-'+Date.now(),type:actionType,text,due,assignee:a?.assignee||repN(d.assignee),status:'open',createdAt:a?.createdAt||at};d.nextActionObj=p.nextActionObj=obj;d.nextAction=p.nextAction=due;d.nextActionText=p.nextActionText=text;pushWrite('next_action',{opportunity_id:d.id,action_id:obj.id,type:actionType,text,due_at:due,assignee:obj.assignee})}
  saveLocal();state.notes.set(i,'저장 요청됨 · 서버 반영 상태 확인 필요');state.editor=null;render();
 }
 const api={bind,open,close,action,save,sorted,buckets,definitions};root.IssueModal=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
