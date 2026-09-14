/* PC only: existing Pipeline cards and existing command protocol, no new inbox. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.PCFollowupPlan=api;api.install(root);}})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const terminal=new Set(['won','lost','badfit','badfit_lead','badfit_pipe','nocontact','completion']);
 const reasons=['입대의/관리사무소 검토중','예산 편성 대기','공사시기 미도래','다른 공사 우선','고객 요청으로 추후 연락'];
 const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
 function code(d){return d.stage_code||d.code;}
 function eligible(d){return !!d&&!terminal.has(code(d))&&code(d)!=='waiting'&&d.lifecycle_status!=='closed';}
 function plan(d,input){
  if(!eligible(d))throw Error('진행 중인 영업건에서만 등록할 수 있습니다.');
  if(!date(input.due))throw Error('다음 연락일을 확인해 주세요.');
  if(!input.reason||!input.reason.trim()||input.reason.trim().length>300)throw Error('다시 연락할 이유를 입력해 주세요.');
  if(input.year&&!/^20\d{2}$/.test(input.year))throw Error('공사예정연도는 2000~2099년으로 입력해 주세요.');
  const long=input.mode==='later'&&input.long===true;
  const purpose=(input.year?'공사예정 '+input.year+'년 · ':'')+input.reason.trim();
  return {long,due:input.due,year:input.year||'',purpose,text:purpose+' · 고객 재접촉',destination:long?'관계관리 · 대기고객으로 연결':'Pipeline 유지'};
 }
 function sentAt(d){
  const messages=(d.message_logs||d.messageLogs||[]).filter(x=>x.status==='sent'&&(x.quote_version_no||x.quote_attachment_id));
  const versions=(d.quote_versions||d.quoteVersions||[]).filter(x=>x.sent_at);
  const sent=(d.stage_contexts||d.stageContexts||{}).sent?.fields;
  const dates=messages.concat(versions).map(x=>x.sent_at||x.occurred_at||'').filter(Boolean);
  if(sent&&Array.isArray(sent.materials)&&sent.materials.includes('견적서')&&date(sent.sent_date))dates.push(sent.sent_date);
  return dates.filter(v=>Number.isFinite(timestamp(v))).sort((a,b)=>timestamp(a)-timestamp(b)).pop()||'';
 }
 function timestamp(value){let v=String(value||'');if(/^\d{4}-\d{2}-\d{2}$/.test(v))v+='T00:00:00+09:00';else if(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(v))v=v.replace(' ','T')+'+09:00';return Date.parse(v);}
 function noResponse(d){const sent=sentAt(d);return !!sent&&!(d.activities||[]).some(a=>timestamp(a.at||a.occurred_at)>timestamp(sent)&&(a.meaningful_contact===true||a.meaningful===true||a.response_kind));}
 function noNext(d){const n=d.nextActionObj||d.nextAction||{};return n.status==='completed'||n.status==='cancelled'||!n.text||!(n.due||n.due_at);}
 function savedConstructionYear(d){return (String(d?.stage_contexts?.waiting?.fields?.reason||d?.stageContexts?.waiting?.fields?.reason||'').match(/^공사예정 (20\d{2})년 · /)||[])[1]||'';}
 function longTerm(d){return code(d)==='waiting'&&String((d.stage_contexts||d.stageContexts)?.waiting?.memo||'').includes('고객의 명시적인 장기 검토 의사');}
 function installYear(cy){if(!cy)return;const prior=cy.yearOf,priorValue=cy.valueOf,priorOptions=cy.options;
  cy.yearOf=d=>savedConstructionYear(d)||prior(d);
  if(priorValue)cy.valueOf=d=>savedConstructionYear(d)?{year:savedConstructionYear(d),source:'waiting'}:priorValue(d);
  cy.matches=(d,v)=>!v||v==='전체'||cy.yearOf(d)===String(v);
  if(priorOptions)cy.options=function(rows,year){const base=priorOptions(rows,year),years=new Set(base.filter(v=>/^20\d{2}$/.test(v)));(rows||[]).forEach(d=>{const y=cy.yearOf(d);if(/^20\d{2}$/.test(y))years.add(y);});return ['전체',...Array.from(years).sort(),...base.filter(v=>v!=='전체'&&!/^20\d{2}$/.test(v))];};
 }
 function install(w){
  let dialog=null,focus=null,filter='all';const pending=new Map(),drafts=new Map();
  const find=id=>(w.B&&w.B.deals||[]).find(d=>String(d.id)===String(id));
  function actions(d){if(!eligible(d))return '';return '<div class="pc-followup-actions">'+[['continue','계속 진행'],['later','추후 다시 연락'],['end','종료']].map(([mode,label])=>'<button type="button" data-followup-id="'+esc(d.id)+'" data-followup-mode="'+mode+'">'+label+'</button>').join('')+'</div>';}
  function close(){if(dialog){const f=dialog.querySelector('form').elements;drafts.set(dialog.dataset.key,{reason:f.reason.value,due:f.due.value,year:f.year.value,long:!!f.namedItem('long')?.checked});dialog.remove();}dialog=null;if(focus&&focus.isConnected)focus.focus();}
  function open(id,mode){const d=find(id);if(!eligible(d))return;if(mode==='end'){w.StageTransitionUI.open(d,false,'lost');const host=w.document.getElementById('inlineTransition');if(host&&!host.getClientRects().length&&!w.document.getElementById('stageTransitionModal')){const modal=w.document.createElement('div');modal.id='stageTransitionModal';modal.className='stage-transition-overlay';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');const section=w.document.createElement('section');section.className='stage-transition-dialog';section.appendChild(host);modal.appendChild(section);w.document.body.appendChild(modal);w.document.body.style.overflow='hidden';host.querySelector('select')?.focus();}return;}close();focus=w.document.activeElement;
   dialog=w.document.createElement('dialog');dialog.className='pc-followup-dialog';dialog.dataset.key=id+':'+mode;dialog.dataset.deal=id;
   dialog.innerHTML='<form><header><div><small>'+esc(d.site||'영업기회')+'</small><h2>'+ (mode==='later'?'추후 다시 연락':'계속 진행')+'</h2></div><button type="button" data-close aria-label="닫기">×</button></header><label>이유<select name="reason">'+(mode==='continue'?'<option>고객 검토결과 확인</option>':'')+reasons.map(r=>'<option>'+r+'</option>').join('')+'</select></label><label>다음 연락일<input name="due" type="date" required></label><div class="pc-followup-presets"><button type="button" data-days="7">7일 후</button><button type="button" data-days="14">14일 후</button><button type="button" data-days="30">30일 후</button></div><label>공사예정연도 <small>미정이면 비워두세요</small><input name="year" type="number" min="2000" max="2099" placeholder="예: 2030"></label>'+(mode==='later'?'<label class="pc-followup-long"><input name="long" type="checkbox">고객이 장기 검토 의사를 밝혔습니다</label>':'')+'<p class="pc-followup-preview" aria-live="polite"></p><p class="pc-followup-error" role="status"></p><footer><button type="button" data-close>취소</button><button type="submit">계획 저장</button></footer></form>';
   w.document.body.appendChild(dialog);const form=dialog.querySelector('form'),el=name=>form.elements.namedItem(name);
   const n=d.nextActionObj||d.nextAction||{};el('due').value=String(n.due||n.due_at||'').slice(0,10);
   const cy=w.ConstructionYear&&w.ConstructionYear.yearOf(d),savedYear=String(n.text||'').match(/^공사예정 (20\d{2})년 · /);if(savedYear)el('year').value=savedYear[1];else if(/^20\d{2}$/.test(cy))el('year').value=cy;
   const draft=drafts.get(dialog.dataset.key);if(draft){['reason','due','year'].forEach(k=>el(k).value=draft[k]);if(el('long'))el('long').checked=draft.long;}
   function input(){return {mode,reason:el('reason').value,due:el('due').value,year:el('year').value,long:!!el('long')?.checked};}
   function preview(){dialog.querySelector('.pc-followup-preview').textContent=el('long')?.checked?'관계관리 · 대기고객으로 연결합니다. 기존 견적·금액·이력은 유지됩니다.':'Pipeline을 유지하고 다음 연락 일정만 등록합니다.';}
   form.oninput=preview;preview();dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
   dialog.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{const dt=new Date(today()+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+Number(b.dataset.days));el('due').value=dt.toISOString().slice(0,10);});
   dialog.oncancel=e=>{e.preventDefault();close();};
   form.onsubmit=async e=>{e.preventDefault();if(pending.has(id))return;const status=form.querySelector('.pc-followup-error');try{
    const p=plan(find(id),input()),queue=w.Phase1.queue,rows=queue.list();
    if(rows.some(q=>q.object_id===id&&q.status!=='done'&&q.status!=='cancelled'))throw Error('이 현장의 저장 요청이 처리 중입니다. 동기화 상태를 먼저 확인해 주세요.');
    let version=find(id).version;rows.filter(q=>q.object_id===id&&q.status==='done'&&Number.isSafeInteger(q.ack?.version)).forEach(q=>{version=Math.max(version??0,q.ack.version);});
    if(!Number.isSafeInteger(version))throw Error('최신 데이터를 다시 불러온 뒤 저장해 주세요.');
    let op='next_action',payload={opportunity_id:id,intent:'standalone',type:'전화',text:p.text,due_at:p.due,assignee:d.assignee};
    if(p.long){op='transition';const at=today(),s={from:code(d),to:'waiting',transition_date:at,skip_reason:'',memo:'고객의 명시적인 장기 검토 의사에 따라 재접촉 계획 등록',fields:{reason:p.purpose,contact_date:p.due}};payload={opportunity_id:id,from:s.from,to:s.to,stage_code:s.from,transition_date:at,note:p.purpose,stage_context:s};}
    const q=queue.enqueue(op,id,version,payload);pending.set(id,{id:q.request_id,deal:id,plan:p,op});
    form.querySelectorAll('button:not([data-close]),input,select').forEach(x=>x.disabled=true);status.textContent='서버 저장 확인 중…';
    await queue.flush();settle();
   }catch(err){status.textContent=err.message;if(pending.has(id)){status.textContent='저장 미완료 · '+err.message+' · 입력 내용은 유지됩니다. 동기화 상태를 확인해 주세요.';settle();}}};
   if(pending.has(id)){form.querySelectorAll('button:not([data-close]),input,select').forEach(x=>x.disabled=true);form.querySelector('.pc-followup-error').textContent='이 고객의 저장 결과를 확인 중입니다. 중복 저장하지 않습니다.';}
   dialog.showModal();el('reason').focus();
  }
  function settle(){for(const request of pending.values()){const q=w.Phase1.queue.list().find(x=>x.request_id===request.id);if(!q)continue;
   if(q.status!=='done'||!q.ack){if(dialog?.dataset.deal===request.deal)dialog.querySelector('.pc-followup-error').textContent='저장 미완료 · '+(q.error||'서버 응답 확인 중')+' — 입력 내용은 유지됩니다. 닫은 뒤 동기화 상태를 확인할 수 있습니다.';if(q.status==='rejected'||q.status==='conflict')pending.delete(request.deal);continue;}
   const {plan:p,deal:id,op}=request;
   for(const list of [w.B&&w.B.deals,w.DEALS].filter(Array.isArray))for(const d of list)if(String(d.id)===String(id)){
    d.version=q.ack.version;d.nextAction=d.nextActionObj={id:q.ack.next_action_id,type:op==='transition'?'후속접촉':'전화',text:op==='transition'?'고객 재접촉':p.text,due:p.due,due_at:p.due,status:'open',assignee:d.assignee};
    if(op==='transition'){d.code=d.stage_code='waiting';d.stageContexts=d.stage_contexts=q.ack.stage_contexts;d.waitingReason=d.waiting_reason=d.relationshipReason=p.purpose;}
    if(typeof w.itemPatch==='function'){const patch=w.itemPatch(d,'deal');patch.nextActionObj=d.nextActionObj;patch.nextAction=d.nextActionObj;if(op==='transition'){patch.code='waiting';patch.stageContexts=q.ack.stage_contexts;patch.waitingReason=patch.relationshipReason=p.purpose;}}
   }
   pending.delete(id);if(dialog?.dataset.deal===id)close();drafts.delete(id+':later');drafts.delete(id+':continue');if(typeof w.paint==='function')w.paint();
  }}
  w.document.addEventListener('click',e=>{const b=e.target.closest('[data-followup-id]');if(!b)return;e.stopPropagation();open(b.dataset.followupId,b.dataset.followupMode);},true);
  w.addEventListener('phase1:queue',()=>w.setTimeout(settle,0));
  w.addEventListener('phase1:identity-cleared',()=>{close();pending.clear();drafts.clear();});
  for(const name of ['kb5Card','denseCard','kbCard']){const original=w[name];if(typeof original!=='function')continue;w[name]=function(d){const html=original.apply(this,arguments);return eligible(d)?html.replace(/<\/div>\s*$/,actions(d)+'</div>'):html;};}
  const quick=w.quickPanelHTML;if(quick)w.quickPanelHTML=function(d){const html=quick.apply(this,arguments);return eligible(d)?html.replace('<div class="quickactions">',actions(d)+'<div class="quickactions">'):html;};
  const originalFiltered=w.pipeFiltered;
  function scope(){const seen=new Set();return (originalFiltered?originalFiltered.call(w):[]).filter(d=>{const key=d.id||d;if(seen.has(key))return false;seen.add(key);return !longTerm(d);});}
  if(originalFiltered)w.pipeFiltered=function(){return scope().filter(d=>filter==='all'||(filter==='response'?noResponse(d):noNext(d)));};
  const originalPaint=w.paintPipe;if(originalPaint)w.paintPipe=function(){const result=originalPaint.apply(this,arguments),host=w.document.getElementById('p-main');if(host){const rows=scope(),counts={all:rows.length,response:rows.filter(noResponse).length,next:rows.filter(noNext).length},bar=w.document.createElement('div');bar.className='pc-followup-filters';bar.innerHTML=[['all','전체'],['response','견적발송 후 반응없음'],['next','다음일정 없음']].map(([v,label])=>'<button type="button" data-value="'+v+'" aria-pressed="'+(v===filter)+'">'+label+' <span>'+counts[v]+'건</span></button>').join('');bar.onclick=e=>{const b=e.target.closest('button[data-value]');if(b){filter=b.dataset.value;w.paintPipe();}};host.prepend(bar);}return result;};
  const render=w.renderDetail;if(render)w.renderDetail=function(){const result=render.apply(this,arguments),d=w.CUR_DETAIL?.kind==='deal'&&w.CUR_DETAIL.item,host=w.document.getElementById('nextActionCard');if(host&&eligible(d)&&!host.querySelector('.pc-followup-actions'))host.insertAdjacentHTML('afterbegin',actions(d));return result;};
  // Persisted waiting purpose carries the explicitly entered year; never derive it from contact date.
  installYear(w.ConstructionYear);
  // Do not change towerActive/isOpen: relationship customers still need today's work and coaching.
  const snapshot=w.dashboardSnapshotDeals;if(snapshot)w.dashboardSnapshotDeals=function(){return snapshot.apply(this,arguments).filter(d=>!longTerm(d));};
  const flow=w.repFlowData;if(flow)w.repFlowData=function(){let rows;const selectedSnapshot=w.dashboardSnapshotDeals;try{if(snapshot)w.dashboardSnapshotDeals=snapshot;rows=flow.apply(this,arguments);}finally{w.dashboardSnapshotDeals=selectedSnapshot;}rows.forEach(r=>{const active=(r.current||[]).filter(d=>!longTerm(d));r.pipeline=w.sumBy(active,w.oppAmt);r.forecast=w.weightedAmount(active);r.near=w.sumBy(active.filter(d=>['compete','imminent','bidding','contract'].includes(code(d))),w.oppAmt);});return rows;};
  return {open,close,actions};
 }
 return {plan,eligible,sentAt,noResponse,noNext,savedConstructionYear,longTerm,installYear,install};
});
