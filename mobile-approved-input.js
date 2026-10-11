/* Exact source43 I1-I3 display/input binding. No microphone/OCR invocation, AI,
 * persistence, contact creation, scheduling or automatic completion.
 * renderI1({title?,context,transcript,statusText,micLabel?,canSpeak?,recording?})
 * renderI2({title?,transcript,dateCandidate:{id,text},candidates:[{id,kind,title,detail}],
 *           selectedIds:[],dateConfirmed:false,preview,canSave:false,pager?,saveMode?,saveLabel?,suggestionLabel?})
 * renderI3({title?,photoLabel,helper,fields:[{id,label,value,uncertain}],siteId,siteLabel,
 *           duplicateNote,validationState:'valid'|'invalid',canSave:false})
 * Contenteditable values retain the original nodes and styles. Controller owns input,
 * selection, capability checks, native speech lifetime, PC validation and save contract.
 * Common targetId and blockedReason are data only. pager is trusted ListPager markup.
 */
(function(w){
 'use strict';
 const text=v=>String(v??''),UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const fieldIds=['name','role','phone','company'];
 function action(node,name,data={},enabled=true,reason){node.dataset.gs=name;Object.assign(node.dataset,data);node.setAttribute('role','button');node.tabIndex=enabled?0:-1;if(!enabled)node.setAttribute('aria-disabled','true');if(reason)node.title=text(reason);return node;}
 function edit(node,key,label,value){node.contentEditable='plaintext-only';node.setAttribute('role','textbox');node.tabIndex=0;node.dataset[key]='';node.setAttribute('aria-label',label);node.textContent=text(value);return node;}
 function source(screen,model){
  if(typeof w.MobileApprovedInputSource?.[screen]!=='string')throw Error('APPROVED_INPUT_SOURCE_MISSING');
  const box=w.document.createElement('div');box.innerHTML=w.MobileApprovedInputSource[screen];const frame=box.firstElementChild;
  frame.className='approved-input approved-'+screen.toLowerCase().replace('-','');frame.dataset.approvedScreen=screen;frame.dataset.targetId=text(model.targetId);
  const head=frame.firstElementChild;action(head.firstElementChild,screen==='I-1'?'input-cancel':'back');head.firstElementChild.setAttribute('aria-label',screen==='I-1'?'말하기 취소하고 돌아가기':'뒤로');
  if(model.title!==undefined)head.lastElementChild.textContent=text(model.title);
  return {box,frame,head};
 }
 function renderI1(model={}){
  const v=source('I-1',model),context=v.frame.children[1],body=v.frame.children[2];body.className='approved-input-body';context.textContent=text(model.context);
  const editor=edit(body.children[1],'inputTranscript','상담 내용',model.transcript);editor.setAttribute('aria-multiline','true');editor.dataset.placeholder='말하거나 직접 쓰기';
  editor.dataset.gs='input-manual';
  const microphone=body.children[2];action(microphone.firstElementChild,'input-mic',{},model.canSpeak===true,model.blockedReason);microphone.firstElementChild.setAttribute('aria-label',text(model.micLabel||'누르고 말하기'));microphone.children[1].textContent=text(model.micLabel||'누르고 말하기');
  if(model.canSpeak!==true)microphone.hidden=true;
  body.children[3].setAttribute('aria-hidden','true');body.children[3].hidden=model.recording!==true;
  body.children[4].textContent=text(model.statusText);body.children[4].setAttribute('role','status');
  return v.box.innerHTML;
 }
 function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const n=Date.parse(v+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v;}
 function selection(model,candidates){const selected=new Set(Array.isArray(model.selectedIds)?model.selectedIds:[]);return candidates.filter(c=>c.kind!=='stage'&&selected.has(c.id));}
 function renderI2(model={}){
  const v=source('I-2',model),body=v.frame.children[1],footer=v.frame.children[2];body.className='approved-input-body';footer.className='approved-input-footer';
  const transcript=body.children[1],highlight=transcript.firstElementChild.cloneNode(true),value=text(model.transcript),date=model.dateCandidate||{},token=text(date.text),index=token?value.indexOf(token):-1;
  edit(transcript,'inputTranscript','상담 내용',value);transcript.setAttribute('aria-multiline','true');
  if(index>=0&&date.id){transcript.replaceChildren(w.document.createTextNode(value.slice(0,index)));highlight.textContent=token;action(highlight,'input-date-candidate',{id:text(date.id)},true);highlight.title='날짜 확인 필요';transcript.append(highlight,w.document.createTextNode(value.slice(index+token.length)));}
  const group=body.children[2],on=group.children[1].cloneNode(true),off=group.children[4].cloneNode(true);[...group.children].slice(1).forEach(node=>node.remove());
  if(model.suggestionLabel!==undefined)group.firstElementChild.lastElementChild.textContent=text(model.suggestionLabel);
  const candidates=Array.isArray(model.candidates)?model.candidates:[];if(candidates.length>20)throw Error('APPROVED_INPUT_PAGE_EXCEEDS_20');
  const ids=new Set();for(const candidate of candidates){if(!candidate.id||ids.has(candidate.id)||!['visit','quote_request','followup','stage'].includes(candidate.kind))throw Error('APPROVED_INPUT_CANDIDATE_INVALID');ids.add(candidate.id);}
  const chosen=selection(model,candidates);
  candidates.forEach(candidate=>{
   const selected=chosen.some(c=>c.id===candidate.id),row=(selected?on:off).cloneNode(true);row.children[1].children[0].textContent=text(candidate.title);row.children[1].children[1].textContent=text(candidate.detail);
   action(row,'input-candidate',{id:text(candidate.id),kind:candidate.kind},candidate.kind!=='stage',candidate.kind==='stage'?'단계 변경은 제안하거나 자동 처리하지 않습니다.':model.blockedReason);row.setAttribute('role','checkbox');row.setAttribute('aria-checked',String(selected));row.firstElementChild.setAttribute('aria-hidden','true');group.append(row);
  });
  if(model.pager)group.insertAdjacentHTML('beforeend',model.pager);
  footer.firstElementChild.textContent=text(model.preview);
  if(model.saveLabel!==undefined)footer.lastElementChild.textContent=text(model.saveLabel);
  const dateReady=model.saveMode==='text-only'||!chosen.some(c=>c.kind==='followup')||(model.dateConfirmed===true&&validDate(model.confirmedDate));
  action(footer.lastElementChild,'input-review-save',{},model.canSave===true&&dateReady,model.blockedReason||(!dateReady?'후속 업무 날짜를 명시적으로 확인해야 합니다.':''));
  return v.box.innerHTML;
 }
 function renderI3(model={}){
  const v=source('I-3',model),body=v.frame.children[1],footer=v.frame.children[2];body.className='approved-input-body';footer.className='approved-input-footer';
  const templates=[...body.children].slice(2,6).map(row=>row.cloneNode(true)),fields=Array.isArray(model.fields)?model.fields:[];
  if(fields.length>4||fields.some(f=>!fieldIds.includes(f.id))||new Set(fields.map(f=>f.id)).size!==fields.length)throw Error('APPROVED_INPUT_CARD_FIELDS_INVALID');
  const normal=templates[0].lastElementChild.getAttribute('style'),uncertain=templates[2].lastElementChild.getAttribute('style');
  body.children[0].textContent=text(model.photoLabel);action(body.children[0],'input-card-photo',{},model.canCapture===true,model.blockedReason);
  body.children[1].textContent=text(model.helper);body.children[1].dataset.inputCardHelper='';
  fieldIds.forEach((id,i)=>{const row=body.children[i+2],field=fields.find(f=>f.id===id)||{},control=row.lastElementChild;row.firstElementChild.textContent=text(field.label||({name:'이름',role:'역할',phone:'휴대폰',company:'회사'}[id]));control.setAttribute('style',field.uncertain===true?uncertain:normal);edit(control,'inputField',row.firstElementChild.textContent,field.value);control.dataset.id=id;control.setAttribute('aria-invalid',String(field.uncertain===true));if(model.busy){control.contentEditable='false';control.setAttribute('aria-readonly','true');}if(id==='phone')control.setAttribute('inputmode','tel');});
  const site=body.children[6];site.children[1].textContent=text(model.siteLabel);site.children[1].dataset.siteId=text(model.siteId);site.children[2].textContent=text(model.duplicateNote);site.children[2].dataset.contactMatchNote='';site.children[2].setAttribute('role','status');
  const verified=fields.length===4&&fields.every(field=>field.uncertain===false)&&UUID.test(text(model.siteId))&&model.validationState==='valid';
  action(footer.firstElementChild,'input-card-save',{},model.canSave===true&&verified,model.blockedReason||(!verified?'읽은 값의 불확실 항목과 현장 연결을 확인해야 합니다.':''));
  return v.box.innerHTML;
 }
 const renderers={'I-1':renderI1,'I-2':renderI2,'I-3':renderI3};
 function render(screen,model={}){if(!Object.hasOwn(renderers,screen))throw Error('APPROVED_INPUT_SCREEN_INVALID');return renderers[screen](model);}
 w.MobileApprovedInput=Object.freeze({render,renderI1,renderI2,renderI3});
})(window);
