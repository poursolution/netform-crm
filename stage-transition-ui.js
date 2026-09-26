/* Shared structured transition form. Loaded after each application's globals. */
(function(root){
 'use strict';
 const S=root.StageTransition, esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 let ctx=null;
 /* 흐름 유지(2026-09-26 컨설턴트 '행동의 연속성'): 단계만 바꾸고 다음 할 일이 없으면 흐름이 끊긴다.
    진행 단계로 바꿀 때, 앞으로의 다음 할 일이 없으면 '다음 할 일 날짜'를 반드시 고른다(날짜 칩).
    이미 앞으로의 다음 할 일이 있으면 그대로 유지하고, 바꾸고 싶을 때만 고른다. 종료 단계·단계 자체 날짜(자료 발송 다음 확인일·재접촉일)는 기존대로. */
 const NEXT_TEXT={first_contact:'고객 요구 확인',consulting:'견적 요청 내용 확인',compete:'경쟁 상황·일정 확인',imminent:'계약 조건 확인',bidding:'입찰 결과 확인',contract:'계약 체결 확인',construction:'착공 준비 확인',completion:'준공·수금 확인'};
 const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const nextMonday=()=>{const d=new Date();d.setDate(d.getDate()+((8-d.getDay())%7||7));return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 function currentNext(){
  const d=ctx.deal,p=ctx.patch||{},o=p.nextActionObj||d.nextActionObj||(d.nextAction&&typeof d.nextAction==='object'?d.nextAction:null);
  if(!o||!o.text||o.status&&o.status!=='open')return null;
  const due=String(o.due||o.due_at||'').slice(0,10);return due&&due>=today()?{text:o.text,due}:null;
 }
 const ownDate=to=>S.definitions[to].fields.some(f=>f.key==='followup_date'||f.key==='contact_date');
 const needsNext=to=>!S.terminal.includes(to)&&!ownDate(to)&&to!=='won';
 /* 단계 항목에 이미 날짜가 있으면(견적 예정일·PT 협의일·계약 예정일) 다음 할 일이 비어 있을 때 그 날짜로 대신 등록 — 같은 날짜를 두 번 묻지 않는다 */
 const AUTO={consulting:['quote_due','견적서 작성·발송'],compete:['meeting_date','PT·협의 준비 확인'],contract:['contract_date','계약 체결 확인']};
 function genericNext(to,input){
  if(!needsNext(to))return null;
  if(input.next_due)return {type:'후속접촉',text:NEXT_TEXT[to]||'진행 상황 확인',due:input.next_due};
  const a=AUTO[to],v=a&&input.fields&&input.fields[a[0]];
  return !currentNext()&&v&&v>=today()?{type:'후속접촉',text:a[1],due:v}:null;
 }
 function nextHTML(to,draft){
  if(!needsNext(to))return '';
  const cur=currentNext(),v=draft.next_due||'',chips=[['내일',addDays(1)],['3일 후',addDays(3)],['다음 주 월요일',nextMonday()]];
  return '<div class="sf-field sf-next"><label for="sf-next">다음 할 일 날짜'+(cur?' <small>바꿀 때만</small>':' <b aria-label="필수">*</b>')+'</label>'
   +(cur?'<p class="sf-next-now">지금 다음 할 일: '+esc(cur.text)+' ('+esc(cur.due.slice(5).replace('-','/'))+') — 비워 두면 그대로 유지</p>'
    :'<p class="sf-next-now">단계만 바꾸면 흐름이 끊깁니다. 언제 다시 확인할지 골라 주세요 — '+esc(NEXT_TEXT[to]||'진행 상황 확인')+(AUTO[to]?' (비워 두면 위 ‘'+esc((S.definitions[to].fields.find(f=>f.key===AUTO[to][0])||{}).label||'')+'’로 등록)':'')+'</p>')
   +'<div class="sf-next-chips">'+chips.map(c=>'<button type="button" data-next="'+c[1]+'"'+(v===c[1]?' class="on"':'')+'>'+c[0]+' <small>'+c[1].slice(5).replace('-','/')+'</small></button>').join('')+'</div>'
   +'<input id="sf-next" type="date" min="'+today()+'" value="'+esc(v)+'"></div>';
 }
 function queueNextAfterTransition(d,next,mobile){
  const Q=root.Phase1&&root.Phase1.queue,send=mobile?root.queueMobileContactOperation:root.queueDetailContactOperation;
  if(!Q||typeof Q.flush!=='function'||typeof send!=='function')return;
  Promise.resolve().then(async()=>{
   try{await Q.flush();send('next_action',{opportunity_id:d.id,type:next.type,text:next.text,due_at:next.due});await Q.flush();}
   catch(e){if(root.console&&root.console.warn)root.console.warn('Transition next action: '+(e&&e.message||e));}
  });
 }
 function fieldHTML(f,v,quotes){
  const id='sf-'+f.key,label=esc(f.label)+(f.required?' <b aria-label="필수">*</b>':'');
  if(f.type==='multi')return '<fieldset class="sf-field"><legend>'+label+'</legend><div class="sf-checks">'+f.options.map(x=>'<label><input type="checkbox" name="'+id+'" value="'+esc(x)+'" '+(Array.isArray(v)&&v.includes(x)?'checked':'')+'>'+esc(x)+'</label>').join('')+'</div></fieldset>';
  let control;
  if(f.type==='select'||f.type==='quote'){
   const opts=f.type==='quote'?quotes.map(q=>({value:String(q.id??q.version??q.version_no),label:'V'+(q.version??q.version_no??'')+' · '+Number(q.amount??q.quote_amount??0).toLocaleString('ko-KR')+'원'})):f.options.map(x=>({value:x,label:x}));
   control='<select id="'+id+'"><option value="">선택해 주세요</option>'+opts.map(o=>'<option value="'+esc(o.value)+'" '+(String(v??'')===o.value?'selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select>'+(f.type==='quote'&&!quotes.length?'<small>등록된 견적 Version이 없습니다. 견적서 발송은 먼저 견적 Version을 등록해 주세요.</small>':'');
  }else control='<input id="'+id+'" type="'+(f.type==='date'?'date':'text')+'" '+(f.type==='money'?'data-money inputmode="decimal" ':'')+'value="'+esc(f.type==='money'&&v!==''&&v!=null?Number(v).toLocaleString('ko-KR'):v)+'">';
  return '<div class="sf-field"><label for="'+id+'">'+label+'</label>'+control+'</div>';
 }
 function collect(){
  const el=document.getElementById('stage-transition-form');if(!el)return null;
  const fields={};S.definitions[ctx.to].fields.forEach(f=>{if(f.type==='multi')fields[f.key]=Array.from(el.querySelectorAll('[name="sf-'+f.key+'"]:checked')).map(x=>x.value);else{const v=el.querySelector('#sf-'+f.key).value.trim();fields[f.key]=f.type==='money'?(v===''?'':root.MoneyInput.parse(v)):v}});
  return {transition_date:el.querySelector('#sf-date').value,skip_reason:el.querySelector('#sf-skip')?.value.trim()||'',memo:el.querySelector('#sf-memo').value.trim(),next_due:(el.querySelector('#sf-next')?.value||'').trim(),fields};
 }
 function defaults(to){
  const d=ctx.deal,p=ctx.patch||{},saved=p.stage_contexts||d.stage_contexts||{},old=saved[to]?.fields||{};
  const v={...old};
  // Completion evidence can be carried to closure; no check is invented from the stage code.
  if(to==='won')Object.assign(v,saved.completion?.fields||{},old);
  if(to==='sent'){v.sent_date=v.sent_date||today();v.recipient=v.recipient||d.site||d.site_name||d.nm||''}
  /* 금액은 이미 아는 값으로 미리 채운다(2026-09-26 대표 '최종 금액을 왜 한 번 더 입력해?'): 준공 처리금액 → 계약 단계 계약금액 → 계약실적 원장 잔액
     → 최종 견적금액 → 예상금액 순. 어디서 가져왔는지 칸 아래에 적고, 달라졌을 때만 고치면 된다. */
  ctx.amountSource=null;
  if(['contract','construction','completion','won'].includes(to)&&!v.contract_amount){
   const key=String(root.dealKey?root.dealKey(d):d.id),ledger=(root.ContractSalesData?.state?.().items||[]).find(r=>String(r.deal_id)===key);
   const pick=[[d.won_amount||p.won_amount,'준공 처리금액'],[saved.contract?.fields?.contract_amount,'계약 단계에서 입력한 계약금액'],[ledger&&ledger.balance,'계약 기록'],[d.quoteAmt||d.quote_amount||p.quote_amount,'최종 견적금액'],[d.amt||d.amount||p.amount,'예상금액']].find(([x])=>Number(x)>0);
   if(pick){v.contract_amount=Number(pick[0]);ctx.amountSource=pick[1];(ctx.amountPrefill=ctx.amountPrefill||{})[to]={value:v.contract_amount,source:pick[1]};}
  }
  return {transition_date:today(),skip_reason:'',memo:'',next_due:'',fields:v};
 }
 function paint(){
  const draft=ctx.drafts[ctx.to]||defaults(ctx.to),def=S.definitions[ctx.to];
  const color=root.PipelineStages?.definition(root.PipelineStages.group(ctx.to))?.color||'inherit';
  const html='<form id="stage-transition-form" class="sf-form" style="--stage-color:'+color+'"><header><span class="sf-eyebrow">단계 전환</span><h3>'+esc(ctx.deal.site||ctx.deal.site_name||ctx.deal.nm||'영업기회')+'</h3><p>'+esc(S.definitions[ctx.from]?.label||ctx.from)+' → '+esc(def.label)+'</p></header><div class="sf-grid"><div class="sf-field"><label for="sf-target">이동할 단계</label><select id="sf-target">'+(root.PipelineStages?root.PipelineStages.ordered(S.choices(ctx.from)):S.choices(ctx.from)).map(k=>'<option value="'+k+'" '+(k===ctx.to?'selected':'')+'>'+esc((root.PipelineStages?.definition(root.PipelineStages.group(k))?.label||'')+' · '+S.definitions[k].label)+'</option>').join('')+'</select></div><div class="sf-field"><label for="sf-date">전환일 *</label><input id="sf-date" type="date" max="'+today()+'" value="'+esc(draft.transition_date)+'"></div></div><h4>'+esc(def.label)+' · 확인할 정보</h4><div class="sf-grid">'+def.fields.map(f=>{const h=fieldHTML(f,draft.fields[f.key]??'',ctx.quotes);const pf=ctx.amountPrefill?.[ctx.to];return f.key==='contract_amount'&&pf&&String(draft.fields[f.key]??'')===String(pf.value)?h.replace(/<\/div>$/,'<small class="sf-src">'+esc(pf.source)+'에서 불러왔습니다 — 실제 금액이 다를 때만 고쳐 주세요</small></div>'):h;}).join('')+'</div>'+(S.isException(ctx.from,ctx.to)?'<div class="sf-exception"><label for="sf-skip">단계 건너뛰기·되돌림 사유 *</label><textarea id="sf-skip" placeholder="실제 진행상태에 맞춰 보정하는 이유를 입력해 주세요.">'+esc(draft.skip_reason)+'</textarea></div>':'')+nextHTML(ctx.to,draft)+'<div class="sf-field"><label for="sf-memo">추가 메모 <small>선택</small></label><textarea id="sf-memo">'+esc(draft.memo)+'</textarea></div><p class="sf-hint">'+(ctx.to==='won'?'준공 완료를 확인한 뒤 기존 영업기회를 종료하고 확장관리로 연결합니다.':'단계 전환은 고객 접촉으로 간주하지 않습니다. 다음 확인일·재접촉일·다음 할 일 날짜를 고르면 그 날짜로 다음 할 일을 등록합니다.')+'</p><div id="sf-error" role="alert"></div><footer><button type="button" id="sf-cancel">취소</button><button type="submit" class="sf-primary">'+esc(def.label)+' · '+(ctx.to==='won'?'종료 확인':'전환 저장')+'</button></footer></form>';
  if(ctx.mobile)openSheet('단계별 정보 입력',html);else{
   let host=document.getElementById('inlineTransition'),modal=document.getElementById('stageTransitionModal');if(!host&&document.querySelector('#detailView.dw-wide #dw-stage-editor')){host=document.createElement('div');host.id='inlineTransition';document.getElementById('dw-stage-editor').append(host)}if(!host){modal=document.createElement('div');modal.id='stageTransitionModal';modal.className='stage-transition-overlay';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.innerHTML='<section class="stage-transition-dialog"><div id="inlineTransition"></div></section>';document.body.appendChild(modal);host=document.getElementById('inlineTransition')}host.innerHTML=html;if(modal)document.body.style.overflow='hidden';
  }
  if(!ctx.mobile&&root.DetailWorkspace){document.getElementById('stage-transition-form').querySelector('header').insertAdjacentHTML('afterend',DetailWorkspace.transitionContext(ctx.deal,ctx.patch));}
  document.getElementById('sf-target').onchange=e=>{ctx.drafts[ctx.to]=collect();ctx.to=e.target.value;paint()};
  document.getElementById('sf-cancel').onclick=close;
  const form=document.getElementById('stage-transition-form'),nx=document.getElementById('sf-next');
  if(nx&&form&&form.querySelectorAll)form.querySelectorAll('[data-next]').forEach(b=>{b.onclick=()=>{nx.value=b.getAttribute('data-next');form.querySelectorAll('[data-next]').forEach(x=>x.classList.toggle('on',x===b));};});
  document.getElementById('stage-transition-form').onsubmit=e=>{e.preventDefault();save()};
 }
 function close(){const focus=ctx?.returnFocus;if(ctx?.mobile)closeSheet();else{document.getElementById('stageTransitionModal')?.remove();document.getElementById('inlineTransition')?.remove();document.getElementById('detailView')?.classList.remove('dw-transition');if(document.body&&document.body.style)document.body.style.overflow=document.querySelector('#detailView.dw-wide.on')?'hidden':''}ctx=null;if(root.DetailActions?.active==='stage')root.DetailActions.close();if(focus?.isConnected&&focus.getClientRects().length)focus.focus()}
 function open(deal,mobile,to){
  const from=mobile?deal.code:dealStage(deal),choices=S.choices(from);
  if(!choices.length||S.terminal.includes(deal.outcome)){(mobile?toast:alert)('종료된 영업기회는 다시 열지 않습니다. 추가 니즈는 새 영업기회로 등록해 주세요.');return}
  const target=to||((S.normal[from]||[]).find(k=>choices.includes(k)))||choices[0];
  if(!choices.includes(target)){(mobile?toast:alert)('Closed Won은 준공 완료 확인 후에만 가능합니다.');return}
  ctx={deal,mobile,from,to:target,patch:mobile?null:itemPatch(deal,'deal'),drafts:{},quotes:mobile?quoteVersionsM(deal):execQuoteVersions(deal),returnFocus:document.activeElement};
  if(!mobile&&root.DetailActions)root.DetailActions.open('stage');
  paint();document.getElementById('stage-transition-form')?.scrollIntoView({block:'start'});document.getElementById('sf-target')?.focus();
 }
 function save(){
  if(!ctx||ctx.saving)return;
  const input=collect(),d=ctx.deal,from=ctx.mobile?d.code:dealStage(d),errors=S.validate(from,ctx.to,input,today());
  if(from!==ctx.from)errors.push('현재 단계가 변경되었습니다. 창을 다시 열어 주세요.');
  if(S.terminal.includes(d.outcome))errors.push('이미 종료된 영업기회입니다. 창을 다시 열어 주세요.');
  if(ctx.to==='sent'&&input.fields.materials.includes('견적서')&&!ctx.quotes.some(q=>String(q.id??q.version??q.version_no)===input.fields.quote_version))errors.push('실제 등록된 견적 Version을 선택해 주세요.');
  if(needsNext(ctx.to)){
   if(input.next_due&&input.next_due<today())errors.push('다음 할 일 날짜는 오늘 이후로 골라 주세요.');
   else if(!genericNext(ctx.to,input)&&!currentNext())errors.push('다음 할 일 날짜를 골라 주세요 — 단계만 바꾸면 흐름이 끊깁니다.');
  }
  if(errors.length){document.getElementById('sf-error').textContent=errors.join('\n');return}
  ctx.saving=true;
  const to=ctx.to,at=new Date(input.transition_date+'T00:00:00').toISOString(),actor=ctx.mobile?(G.user?.nm||''):((typeof ME!=='undefined'&&ME?.name)||repN(d.assignee));
  const snapshot={...input,from:ctx.from,to,recorded_at:new Date().toISOString(),actor},text=S.summary(to,input.fields)+(input.skip_reason?'\n전환 사유: '+input.skip_reason:'')+(input.memo?'\n메모: '+input.memo:''),terminal=S.terminal.includes(to),next=S.next(to,input.fields)||genericNext(to,input);
  const context={...(ctx.patch?.stage_contexts||d.stage_contexts||{}),[to]:snapshot},history=[...(ctx.patch?.stageHistory||d.stageHistory||[]),{at,from:ctx.from,to,reason:text,actor,structured:snapshot}];
  const update={code:to,stage:stageLabel(to),stageAt:at,stageEnteredAt:at,stage_contexts:context,stageHistory:history};
  if(input.fields.contract_amount!==''&&input.fields.contract_amount!=null)update.contract_amount=input.fields.contract_amount;
  if(['completion','won'].includes(to))update.completion_date=input.fields.completion_date;
  if(terminal){update.outcome=to;update.closed_at=at;update.closed=input.transition_date;update.nextAction=null;update.nextActionObj=null;update.nextActionText=''}
  if(to==='won'){update.won_amount=input.fields.contract_amount;update.wonAmount=input.fields.contract_amount;update.won_at=at}
  if(to==='waiting')Object.assign(update,{waitingReason:input.fields.reason,waiting_reason:input.fields.reason,waitingCustomerSaid:input.fields.statement||'',waitingSpeaker:input.fields.speaker||'',reactivationDueAt:input.fields.contact_date,reactivation_due_at:input.fields.contact_date});
  if(['rapport','silent','waiting'].includes(to)){
   const relationshipReason=to==='waiting'?input.fields.reason:(input.fields.relationship_reason==='기타'?input.fields.relationship_reason_detail:input.fields.relationship_reason);
   Object.assign(update,{relationshipReason,relationship_reason:relationshipReason,relationshipEnteredAt:at,relationship_entered_at:at});
  }
  if(ctx.patch){applyStageTarget(d,ctx.patch,'deal',to);if(to==='badfit_lead')update.grp='기타'}
  Object.assign(d,update);if(ctx.patch)Object.assign(ctx.patch,update);
  const payload={opportunity_id:d.id,from:ctx.from,to,stage_code:ctx.from,at,transition_date:input.transition_date,note:text,reason:input.fields.close_reason||input.skip_reason||text,stage_context:snapshot,stage_contexts:context,contract_amount:update.contract_amount,completion_date:update.completion_date};
  if(terminal)Object.assign(payload,{outcome:to,closed_at:at,won_amount:to==='won'?input.fields.contract_amount:null,completion_date:update.completion_date});
  pushWrite(terminal?'close':'transition',payload);
  if(ctx.mobile){d.activities=d.activities||[];d.activities.push({id:'stage-'+Date.now(),type:'단계전환',note:S.definitions[to].label,result:text,occurred_at:at,actor_id:meId(),meaningful_contact:false});d.lastAt=at;d.tl=d.tl||[];d.tl.unshift([input.transition_date,S.definitions[to].label+' — '+text])}else logActivity('단계전환',S.definitions[to].label,text,at,actor,false);
  pushWrite('activity',{opportunity_id:d.id,type:'단계전환',note:S.definitions[to].label,result:text,occurred_at:at,meaningful_contact:false});
  if(next&&!terminal){const obj={id:'na-'+Date.now(),type:next.type,text:next.text,due:next.due,due_at:next.due,status:'open',assignee:d.assignee};if(ctx.mobile)d.nextAction=obj;else{d.nextActionObj=ctx.patch.nextActionObj=obj;d.nextAction=ctx.patch.nextAction=next.due;d.nextActionText=ctx.patch.nextActionText=next.text}
   /* 서버 단계 변경 명령은 자료 발송(다음 확인일)·관계관리(재접촉일)에서만 다음 할 일을 만든다. 그 밖의 단계에서 고른
      날짜는 단계 변경이 서버에 저장된 뒤, 결과 칩과 같은 경로로 따로 저장한다(같은 순간 보내면 단계 변경에 흡수됨). */
   if(S.next(to,input.fields))pushWrite('next_action',{opportunity_id:d.id,type:next.type,text:next.text,due_at:next.due});
   else queueNextAfterTransition(d,next,ctx.mobile)}
  if(to==='won'){
   if(!ctx.mobile)ensureExpansionRecord(d,update.completion_date,true);
   else pushWrite('expansion_pool_upsert',{opportunity_id:d.id,source_opportunity_id:d.id,site_id:d.site_id||null,site_name:d.nm,source_work_summary:d.workSummary||'공종 미분류',source_won_amount:d.won_amount,completion_date:update.completion_date,owner_name:d.rep,expansion_status:'신규 대상',relationship_state:'기존고객',candidate_work_items:['타공종 확인'],next_contact_at:new Date(new Date(update.completion_date+'T00:00:00Z').getTime()+30*864e5).toISOString().slice(0,10)});
  }
  if(!ctx.mobile)saveLocal();const mobile=ctx.mobile;close();if(mobile){render();toast('전환 기록을 저장 요청했습니다. 서버 반영 상태를 확인해 주세요.')}else{renderDetail();showDetailErr(saveMsg('단계별 정보를 저장 요청했습니다.'),true)}
 }
 function installPC(){
  const oldOpen=openTransition,oldConfirm=confirmTransition;
  openTransition=function(){if(CUR_DETAIL?.kind==='deal')return open(CUR_DETAIL.item,false);return oldOpen.apply(this,arguments)};
  confirmTransition=function(){if(CUR_DETAIL?.kind==='deal'){if(document.getElementById('stage-transition-form'))return save();return open(CUR_DETAIL.item,false)}return oldConfirm.apply(this,arguments)};
  const oldSplit=splitForm;
  // The quick panel may have no visible detail drawer. Open its existing
  // full-detail path before placing the transition form inside that drawer.
  splitForm=function(kind){if(kind!=='stage')return oldSplit.apply(this,arguments);const d=splitDealSel();if(!d)return;oldSplit(null);if(typeof openFullDealFromQuick==='function')openFullDealFromQuick();else drwDeal(JSON.stringify(d));return open(CUR_DETAIL.item,false)};
  spSaveStage=function(){return splitForm('stage')};
 }
 function installMobile(){
  const selected=()=>DEALS.find(d=>String(d.id)===String(G.deal));
  moveTo=function(i){const d=selected(),n=d&&nextOptions(d)[i];if(n)return open(d,true,n[0])};
  moveToLegacy=moveTo;
  exReason=function(to){const d=selected();if(d)return open(d,true,to)};
  commitMove=function(d,to){return open(d,true,to)};
  amtSheet=function(){const d=selected();if(d)return open(d,true,'won')};
  amtOk=amtSheet;
  const oldClose=commitClose;
  commitClose=function(o){if(o==='won')return amtSheet();return oldClose.apply(this,arguments)};
 }
 root.StageTransitionUI={open,close,save,fieldHTML,installPC,installMobile};
 if(document.getElementById('dv-body')||typeof CUR_DETAIL!=='undefined')installPC();else installMobile();
})(window);
