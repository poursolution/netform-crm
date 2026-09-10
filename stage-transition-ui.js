/* Shared structured transition form. Loaded after each application's globals. */
(function(root){
 'use strict';
 const S=root.StageTransition, esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 let ctx=null;
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
  return {transition_date:el.querySelector('#sf-date').value,skip_reason:el.querySelector('#sf-skip')?.value.trim()||'',memo:el.querySelector('#sf-memo').value.trim(),fields};
 }
 function defaults(to){
  const d=ctx.deal,p=ctx.patch||{},saved=p.stage_contexts||d.stage_contexts||{},old=saved[to]?.fields||{};
  const v={...old};
  // Completion evidence can be carried to closure; no check is invented from the stage code.
  if(to==='won')Object.assign(v,saved.completion?.fields||{},old);
  if(to==='sent'){v.sent_date=v.sent_date||today();v.recipient=v.recipient||d.site||d.site_name||d.nm||''}
  if(['contract','construction','completion','won'].includes(to)&&!v.contract_amount)v.contract_amount=d.won_amount||p.won_amount||saved.contract?.fields?.contract_amount||'';
  return {transition_date:today(),skip_reason:'',memo:'',fields:v};
 }
 function paint(){
  const draft=ctx.drafts[ctx.to]||defaults(ctx.to),def=S.definitions[ctx.to];
  const html='<form id="stage-transition-form" class="sf-form"><header><span class="sf-eyebrow">단계 전환</span><h3>'+esc(ctx.deal.site||ctx.deal.site_name||ctx.deal.nm||'영업기회')+'</h3><p>'+esc(S.definitions[ctx.from]?.label||ctx.from)+' → '+esc(def.label)+'</p></header><div class="sf-grid"><div class="sf-field"><label for="sf-target">이동할 단계</label><select id="sf-target">'+S.choices(ctx.from).map(k=>'<option value="'+k+'" '+(k===ctx.to?'selected':'')+'>'+esc(S.definitions[k].label)+'</option>').join('')+'</select></div><div class="sf-field"><label for="sf-date">전환일 *</label><input id="sf-date" type="date" max="'+today()+'" value="'+esc(draft.transition_date)+'"></div></div><h4>'+esc(def.label)+' · 확인할 정보</h4><div class="sf-grid">'+def.fields.map(f=>fieldHTML(f,draft.fields[f.key]??'',ctx.quotes)).join('')+'</div>'+(S.isException(ctx.from,ctx.to)?'<div class="sf-exception"><label for="sf-skip">단계 건너뛰기·되돌림 사유 *</label><textarea id="sf-skip" placeholder="실제 진행상태에 맞춰 보정하는 이유를 입력해 주세요.">'+esc(draft.skip_reason)+'</textarea></div>':'')+'<div class="sf-field"><label for="sf-memo">추가 메모 <small>선택</small></label><textarea id="sf-memo">'+esc(draft.memo)+'</textarea></div><p class="sf-hint">'+(ctx.to==='won'?'준공 완료를 확인한 뒤 기존 영업기회를 종료하고 확장관리로 연결합니다.':'단계 전환은 고객 접촉으로 간주하지 않습니다. 후속 확인일·재접촉일을 입력한 경우에만 다음 행동을 등록합니다.')+'</p><div id="sf-error" role="alert"></div><footer><button type="button" id="sf-cancel">취소</button><button type="submit" class="sf-primary">'+esc(def.label)+' · '+(ctx.to==='won'?'종료 확인':'전환 저장')+'</button></footer></form>';
  if(ctx.mobile)openSheet('단계별 정보 입력',html);else{
   let host=document.getElementById('inlineTransition');if(!host){host=document.createElement('div');host.id='inlineTransition';document.getElementById('dv-body').appendChild(host)}host.innerHTML=html;
  }
  document.getElementById('sf-target').onchange=e=>{ctx.drafts[ctx.to]=collect();ctx.to=e.target.value;paint()};
  document.getElementById('sf-cancel').onclick=close;
  document.getElementById('stage-transition-form').onsubmit=e=>{e.preventDefault();save()};
 }
 function close(){if(ctx?.mobile)closeSheet();else document.getElementById('inlineTransition')?.remove();ctx=null}
 function open(deal,mobile,to){
  const from=mobile?deal.code:dealStage(deal),choices=S.choices(from);
  if(!choices.length||S.terminal.includes(deal.outcome)){(mobile?toast:alert)('종료된 영업기회는 다시 열지 않습니다. 추가 니즈는 새 영업기회로 등록해 주세요.');return}
  const target=to||((S.normal[from]||[]).find(k=>choices.includes(k)))||choices[0];
  if(!choices.includes(target)){(mobile?toast:alert)('Closed Won은 준공 완료 확인 후에만 가능합니다.');return}
  ctx={deal,mobile,from,to:target,patch:mobile?null:itemPatch(deal,'deal'),drafts:{},quotes:mobile?quoteVersionsM(deal):execQuoteVersions(deal)};
  paint();document.getElementById('stage-transition-form')?.scrollIntoView({block:'start',behavior:'smooth'});
 }
 function save(){
  if(!ctx||ctx.saving)return;
  const input=collect(),d=ctx.deal,from=ctx.mobile?d.code:dealStage(d),errors=S.validate(from,ctx.to,input,today());
  if(from!==ctx.from)errors.push('현재 단계가 변경되었습니다. 창을 다시 열어 주세요.');
  if(S.terminal.includes(d.outcome))errors.push('이미 종료된 영업기회입니다. 창을 다시 열어 주세요.');
  if(ctx.to==='sent'&&input.fields.materials.includes('견적서')&&!ctx.quotes.some(q=>String(q.id??q.version??q.version_no)===input.fields.quote_version))errors.push('실제 등록된 견적 Version을 선택해 주세요.');
  if(errors.length){document.getElementById('sf-error').textContent=errors.join('\n');return}
  ctx.saving=true;
  const to=ctx.to,at=new Date(input.transition_date+'T00:00:00').toISOString(),actor=ctx.mobile?(G.user?.nm||''):((typeof ME!=='undefined'&&ME?.name)||repN(d.assignee));
  const snapshot={...input,from:ctx.from,to,recorded_at:new Date().toISOString(),actor},text=S.summary(to,input.fields)+(input.skip_reason?'\n전환 사유: '+input.skip_reason:'')+(input.memo?'\n메모: '+input.memo:''),terminal=S.terminal.includes(to),next=S.next(to,input.fields);
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
  if(next&&!terminal){const obj={id:'na-'+Date.now(),type:next.type,text:next.text,due:next.due,due_at:next.due,status:'open',assignee:d.assignee};if(ctx.mobile)d.nextAction=obj;else{d.nextActionObj=ctx.patch.nextActionObj=obj;d.nextAction=ctx.patch.nextAction=next.due;d.nextActionText=ctx.patch.nextActionText=next.text}pushWrite('next_action',{opportunity_id:d.id,type:next.type,text:next.text,due_at:next.due})}
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
  splitForm=function(kind){if(kind!=='stage')return oldSplit.apply(this,arguments);const d=splitDealSel();if(!d)return;oldSplit(null);drwDeal(JSON.stringify(d));return open(CUR_DETAIL.item,false)};
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
