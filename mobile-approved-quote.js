/* Approved source44 K1-K5 display binding only. No calculation, lookup, save or send.
 * APIs: render('K-1'..'K-5', model), renderK1..renderK5(model).
 * Common: title?, context, preview, blockedReason?, primaryEnabled?, secondaryEnabled?,
 *         targetId?, versionId?, pager? (trusted common ListPager markup).
 * K1: inherited{title,detail,tag}, works[{id,label,selected}], quantities[{id,label,value,editable}],
 *     dates[{id,label,selected}], canEdit?; quantity inputs are the original non-price cells only.
 *     datePanel?, calendarOptions?, calendarValue? reuse the original source43 date component.
 * K2: steps[{title,detail,state:0|1|2}], conflict, adjustment{title,detail,tag}, question{title,detail,tag}.
 * K3: quote{title,detail,tag}, amountRows[{label,value,tone?}], pdf{title,detail,tag,id,enabled?}, note.
 *     Row0 is always 적산 기준금액. Numbers/formulas are server-owned strings, never computed here.
 * K4: quote{title,detail,tag}, options[{id,label,value,selected}], optionsEnabled?, note.
 * K5: dispatch{title,detail,tag}, next{title,detail,tag}, versions[{id,label,value,replaced?,enabled?}], note.
 * Every collection is caller-paginated to20. Missing data never falls back to example customer values.
 * Selection/adjustment are UI intents only, never customer agreement, approval or saved completion.
 */
(function(w){
 'use strict';
 const text=v=>String(v??'');
 function action(node,key,data,enabled=true,reason){node.dataset.gs=key;Object.assign(node.dataset,data||{});node.setAttribute('role','button');node.tabIndex=enabled?0:-1;if(!enabled)node.setAttribute('aria-disabled','true');if(reason)node.title=text(reason);return node;}
 function list(value){const rows=Array.isArray(value)?value:[];if(rows.length>20)throw Error('APPROVED_QUOTE_PAGE_EXCEEDS_20');return rows;}
 function source(screen){
  if(typeof w.MobileApprovedQuoteSource?.[screen]!=='string')throw Error('APPROVED_QUOTE_SOURCE_MISSING');
  const box=w.document.createElement('div');box.innerHTML=w.MobileApprovedQuoteSource[screen];const frame=box.firstElementChild;
  frame.className='approved-quote approved-'+screen.toLowerCase().replace('-','');frame.dataset.approvedScreen=screen;
  const [head,context,body,footer]=frame.children;body.className='approved-quote-body';footer.className='approved-quote-footer';
  return {box,frame,head,context,body,footer};
 }
 function card(node,model={}){node.children[0].children[0].textContent=text(model.title);node.children[0].children[1].textContent=text(model.tag);node.children[1].textContent=text(model.detail);}
 function rows(node,data,{quantity=false,canEdit=false,history=false}={}){
  const templates=[...node.children].map(n=>n.cloneNode(true));node.replaceChildren();
  list(data).forEach((item,i)=>{
   const slot=history?(item.replaced?1:0):quantity?Math.min(i,templates.length-1):item.tone==='emphasis'?0:item.tone==='change'?templates.length-1:item.tone==='muted'?Math.min(1,templates.length-1):Math.min(i,templates.length-1);
   const row=templates[slot].cloneNode(true);row.children[0].textContent=text(item.label);row.children[1].textContent=text(item.value);row.className='approved-quote-row';
   if(quantity&&canEdit&&item.editable===true){const old=row.children[1],input=w.document.createElement('input');input.type='text';input.className='approved-quote-quantity';input.setAttribute('style',old.getAttribute('style')||'');input.value=text(item.value);input.setAttribute('value',text(item.value));input.dataset.quoteQuantity='';input.dataset.id=text(item.id);input.maxLength=120;input.autocomplete='off';input.setAttribute('aria-label',text(item.label)+' 대략 수량');if(!item.id)input.disabled=true;old.replaceWith(input);}
   if(history)action(row,'quote-version',{id:text(item.id)},!!item.id&&item.enabled===true);
   node.append(row);
  });
 }
 function chips(node,data,key,enabled){
  const base=source('K-1').body.children[3],on=base.children[0],off=base.children[1];node.replaceChildren();
  list(data).forEach(item=>{const chip=(item.selected===true?on:off).cloneNode(true);chip.textContent=text(item.label);action(chip,key,{id:text(item.id)},enabled===true&&!!item.id);chip.setAttribute('aria-pressed',String(item.selected===true));node.append(chip);});
 }
 function common(view,model,primary,secondary){
  action(view.head.firstElementChild,'back');view.head.firstElementChild.setAttribute('aria-label','뒤로');view.head.lastElementChild.textContent=text(model.title??({'K-1':'견적 요청','K-2':'견적 진행','K-3':'견적 확인','K-4':'견적 확인','K-5':'견적 이력'}[view.frame.dataset.approvedScreen]));
  view.context.textContent=text(model.context);view.frame.dataset.targetId=text(model.targetId);view.frame.dataset.versionId=text(model.versionId);
  view.footer.children[0].textContent=text(model.preview);const buttons=view.footer.children[1];
  action(buttons.children[1],primary,{},model.primaryEnabled===true,model.blockedReason);
  if(secondary)action(buttons.children[0],secondary,{},model.secondaryEnabled===true,model.blockedReason);
  if(model.pager)view.body.insertAdjacentHTML('beforeend',model.pager);
 }
 function renderK1(model={}){
  const v=source('K-1'),b=v.body;card(b.children[1],model.inherited);chips(b.children[3],model.works,'k1-work',model.canEdit);
  rows(b.children[5],model.quantities,{quantity:true,canEdit:model.canEdit===true});chips(b.children[7],model.dates,'k1-date',model.canEdit);
  // The visit timestamp is data, not a fixed part of the approved label.
  b.children[0].lastElementChild.textContent=text(model.inheritedHint);
  common(v,model,'quote-request');
  if(model.datePanel){
   if(typeof w.MobileApprovedDate?.render!=='function')throw Error('APPROVED_QUOTE_DATE_COMPONENT_MISSING');
   [...v.frame.children].forEach(node=>node.setAttribute('inert',''));
   v.frame.style.position='relative';
   v.frame.insertAdjacentHTML('beforeend',w.MobileApprovedDate.render({title:b.children[6].firstChild.textContent.trim(),value:model.calendarValue,dateOptions:model.calendarOptions}));
  }
  return v.box.innerHTML;
 }
 function renderK2(model={}){
  const v=source('K-2'),b=v.body,steps=b.children[0],templates=[...steps.children].map(n=>n.cloneNode(true));steps.replaceChildren();
  list(model.steps).forEach((item,i,all)=>{if(![0,1,2].includes(item.state))throw Error('APPROVED_QUOTE_STEP_STATE_REQUIRED');const row=templates[item.state===2?0:item.state===1?2:3].cloneNode(true);row.children[1].children[0].textContent=text(item.title);row.children[1].children[1].textContent=text(item.detail);row.children[0].children[1].setAttribute('style',templates[i===all.length-1?3:0].children[0].children[1].getAttribute('style'));steps.append(row);});
  b.children[1].textContent=text(model.conflict);card(b.children[2],model.adjustment);card(b.children[4],model.question);
  common(v,model,'quote-answer','quote-team-call');return v.box.innerHTML;
 }
 function renderK3(model={}){
  const v=source('K-3'),b=v.body;card(b.children[0],model.quote);
  const amountRows=list(model.amountRows).map((item,i)=>({...item,label:i===0?'적산 기준금액':item.label}));rows(b.children[1],amountRows);
  card(b.children[2],model.pdf);action(b.children[2],'quote-pdf',{id:text(model.pdf?.id)},model.pdf?.enabled===true&&!!model.pdf?.id,model.blockedReason);b.children[3].textContent=text(model.note);
  common(v,model,'quote-send-prepare','quote-confirmation-request');return v.box.innerHTML;
 }
 function renderK4(model={}){
  const v=source('K-4'),b=v.body;card(b.children[0],model.quote);chips(b.children[2],model.options,'quote-option',model.optionsEnabled);
  rows(b.children[3],list(model.options).map(item=>({label:item.label,value:item.value})));b.children[4].textContent=text(model.note);
  // Both options remain one version; no sum, implicit selection or customer-choice inference.
  common(v,model,'quote-send-options');return v.box.innerHTML;
 }
 function renderK5(model={}){
  const v=source('K-5'),b=v.body;card(b.children[0],model.dispatch);card(b.children[1],model.next);rows(b.children[3],model.versions,{history:true});b.children[4].textContent=text(model.note);
  common(v,model,'quote-response','quote-resend');return v.box.innerHTML;
 }
 const renderers={'K-1':renderK1,'K-2':renderK2,'K-3':renderK3,'K-4':renderK4,'K-5':renderK5};
 function render(screen,model){if(!Object.hasOwn(renderers,screen))throw Error('APPROVED_QUOTE_SCREEN_UNKNOWN');return renderers[screen](model);}
 w.MobileApprovedQuote=Object.freeze({render,renderK1,renderK2,renderK3,renderK4,renderK5});
})(window);
