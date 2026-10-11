/* Source-only G / J-2 renderers. No lookup, persistence, stage rules or follow-up calculation.
 * renderG({candidates:[{id,meta,text,documents:[string],recipient,sentAt,canSelect?}],
 *          selectedId?,canContinue?,note?,pager?})
 *   candidates are a caller-paginated page (maximum20); sentAt is the actual ISO date/time,
 *   independently of display meta. Missing document/recipient/date is reference-only.
 *   data-gs: back, g-evidence + data-id, g-reference (disabled), g-next.
 * renderJ2({title,subtitle?,fields:[{id,label,value,state:'present'|'missing'|'derived',
 *            actionLabel?}],reason?,pager?})
 *   PC validation owns field order, state, values and reason. No guessed stage criteria.
 *   data-gs: back, j2-field + data-field/data-state, j2-transition (always disabled).
 *   Original disabled transition is intentional: no save/transition contract is wired here.
 * pager is trusted markup emitted by the existing ListPager helper, never user text.
 */
(function(w){
 'use strict';
 const clean=value=>typeof value==='string'?value.trim():'';
 function dateValue(value){
  const text=clean(value),match=/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(text);if(!match)return false;
  const calendar=new Date(Date.UTC(+match[1],+match[2]-1,+match[3]));
  return calendar.getUTCFullYear()===+match[1]&&calendar.getUTCMonth()===+match[2]-1&&calendar.getUTCDate()===+match[3]&&Number.isFinite(Date.parse(text));
 }
 function action(node,name,data,disabled=false){
  node.dataset.gs=name;Object.assign(node.dataset,data||{});node.setAttribute('role','button');node.tabIndex=disabled?-1:0;
  if(disabled)node.setAttribute('aria-disabled','true');return node;
 }
 function source(key){
  if(typeof w.MobileApprovedGJSource?.[key]!=='string')throw Error('APPROVED_GJ_SOURCE_MISSING');
  const box=w.document.createElement('div');box.innerHTML=w.MobileApprovedGJSource[key];
  const frame=box.firstElementChild;frame.className='approved-gj approved-'+key.toLowerCase().replace('-','');frame.dataset.approvedScreen=key;
  return {box,frame};
 }
 function evidenceState(candidate={}){
  const missing=[];
  if(!Array.isArray(candidate.documents)||!candidate.documents.length||!candidate.documents.every(item=>!!clean(item)))missing.push('documents');
  if(!clean(candidate.recipient))missing.push('recipient');
  if(!dateValue(candidate.sentAt))missing.push('sentAt');
  return {complete:missing.length===0,selectable:missing.length===0&&!!clean(candidate.id)&&(candidate.canSelect==null||candidate.canSelect===true),missing};
 }
 function rowsPage(rows,code){if(rows.length>20)throw Error(code);return rows;}
 function renderG(model={}){
  const candidates=rowsPage(Array.isArray(model.candidates)?model.candidates:[],'APPROVED_EVIDENCE_PAGE_EXCEEDS_20');
  const {box,frame}=source('G'),[head,steps,body,footer]=frame.children;
  action(head.firstElementChild,'back');head.firstElementChild.setAttribute('aria-label','뒤로');
  body.className='approved-gj-body';
  const template=body.children[1].cloneNode(true),note=body.lastElementChild;
  [...body.children].slice(1,-1).forEach(node=>node.remove());
  candidates.forEach(candidate=>{
   const row=template.cloneNode(true),state=evidenceState(candidate),button=row.children[2];row.className='approved-g-evidence';row.dataset.evidenceId=String(candidate.id||'');
   row.children[0].textContent=candidate.meta??'';row.children[1].textContent=candidate.text??'';
   button.textContent=state.selectable?'이걸로':'참고';
   action(button,state.selectable?'g-evidence':'g-reference',{id:String(candidate.id||'')},!state.selectable);
   button.setAttribute('aria-pressed',String(state.selectable&&String(candidate.id)===String(model.selectedId)));
   if(!state.selectable)button.title=state.missing.length?state.missing.map(key=>({documents:'문서',recipient:'수신자',sentAt:'발송일'}[key])).join(' · ')+' 확인 필요':'선택할 수 없는 발송 근거입니다.';
   body.insertBefore(row,note);
  });
  if(model.pager)note.insertAdjacentHTML('beforebegin',model.pager);
  if(model.note!=null)note.textContent=model.note;
  const selected=candidates.find(candidate=>String(candidate.id)===String(model.selectedId)),ready=!!selected&&evidenceState(selected).selectable&&model.canContinue===true;
  action(footer.firstElementChild,'g-next',{id:ready?String(selected.id):''},!ready);
  return box.innerHTML;
 }
 function renderJ2(model={}){
  const fields=rowsPage(Array.isArray(model.fields)?model.fields:[],'APPROVED_STAGE_FIELD_PAGE_EXCEEDS_20');
  const {box,frame}=source('J-2'),[overlay,sheet]=frame.children;
  action(overlay,'back');overlay.setAttribute('aria-label','단계 변경 닫기');sheet.className='approved-gj-body';
  sheet.children[1].textContent=model.title??'';if(model.subtitle!=null)sheet.children[2].textContent=model.subtitle;
  const templates={present:sheet.children[3].cloneNode(true),missing:sheet.children[5].cloneNode(true),derived:sheet.children[6].cloneNode(true)},reason=sheet.children[7],button=sheet.children[8];
  [...sheet.children].slice(3,7).forEach(node=>node.remove());
  fields.forEach(field=>{
   if(!Object.hasOwn(templates,field.state))throw Error('APPROVED_STAGE_FIELD_STATE_REQUIRED');
   const row=templates[field.state].cloneNode(true);row.className='approved-j2-field';row.dataset.fieldId=String(field.id||'');
   row.children[0].textContent=field.label??'';row.children[1].textContent=field.value??'';
   const control=row.children[2];if(field.actionLabel!=null)control.textContent=field.actionLabel;
   if(field.state!=='derived')action(control,'j2-field',{field:String(field.id||''),state:field.state},!clean(field.id));
   sheet.insertBefore(row,reason);
  });
  if(model.pager)reason.insertAdjacentHTML('beforebegin',model.pager);
  reason.textContent=model.reason??'';action(button,'j2-transition',null,true);
  return box.innerHTML;
 }
 w.MobileApprovedGJ=Object.freeze({renderG,renderJ2,evidenceState});
})(window);
