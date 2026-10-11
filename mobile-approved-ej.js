/* Read-only rendering from the approved E / J-4 nodes. No create, merge or write API.
 * renderE({query, similarCount?, similarReason?, similarLabel?})
 *   data-gs: e-activity; e-newsite (data-entry start/similar/next);
 *            e-card (data-entry materials/schedule); tab (data-tab).
 *   input[data-gs-e-query]: native required text input, max 300 characters.
 * renderJ4({query, rows:[{id,name,subtitle,owner?}], selectedId?, similarLabel?, note?, pager?})
 *   Caller supplies at most 20 scoped rows per page; IDs must be real site IDs.
 *   data-gs: back; j4-existing + data-id; j4-new. No name-based merge.
 *   input[data-gs-j4-query]: native required name/address search, max 1000 characters.
 * A clicked row expresses user selection only; the caller must verify permission
 * and collect the remaining PC-required fields before submitting any creation.
 */
(function(w){
 'use strict';
 function action(el,key,values,disabled=false){
  el.dataset.gs=key;Object.assign(el.dataset,values||{});
  el.setAttribute('role','button');el.tabIndex=disabled?-1:0;
  if(disabled)el.setAttribute('aria-disabled','true');
  return el;
 }
 function source(key){
  if(typeof w.MobileApprovedEJSource?.[key]!=='string')throw Error('APPROVED_REGISTRATION_SOURCE_MISSING');
  const box=document.createElement('div');box.innerHTML=w.MobileApprovedEJSource[key];
  const frame=box.firstElementChild;frame.className='approved-ej approved-'+key.toLowerCase();frame.dataset.approvedScreen=key;
  return {box,frame};
 }
 function textInput(old,value,key,label,max){
  const input=document.createElement('input');input.type='text';input.setAttribute('style',old.getAttribute('style')||'');
  input.className='approved-ej-input';input.setAttribute('value',String(value??''));input.dataset[key]='';input.required=true;
  input.maxLength=max;input.autocomplete='off';input.setAttribute('aria-label',label);input.placeholder=label;
  old.replaceWith(input);return input;
 }
 function nav(el){[...el.children].forEach((n,i)=>action(n,'tab',{tab:['today','mine','record','schedule'][i]}));}
 function renderE(model={}){
  const {box,frame}=source('E'),[head,body,tabs]=frame.children;
  body.className='approved-ej-body';
  const entries=body.children[1];entries.className='approved-e-entries';
  action(entries.children[0],'e-activity');action(entries.children[1],'e-newsite',{entry:'start'});
  action(entries.children[2],'e-card',{entry:'materials'});action(entries.children[3],'e-card',{entry:'schedule'});
  const form=body.children[3];form.className='approved-e-form';
  textInput(form.children[1],model.query,'gsEQuery','현장 이름',300);
  const hint=form.children[2],link=hint.querySelector('a');
  const text=model.similarLabel??(Number.isInteger(model.similarCount)?(model.similarReason||'비슷한 현장')+' '+model.similarCount+'곳':'비슷한 현장 확인 필요');
  hint.replaceChildren(document.createTextNode(text+' · '),link);action(link,'e-newsite',{entry:'similar'});
  action(form.children[3],'e-newsite',{entry:'next'},!String(model.query||'').trim());
  nav(tabs);return box.innerHTML;
 }
 function renderJ4(model={}){
  const rows=Array.isArray(model.rows)?model.rows:[];
  if(rows.length>20)throw Error('APPROVED_REGISTRATION_PAGE_EXCEEDS_20');
  const {box,frame}=source('J-4'),[head,body]=frame.children;
  action(head.firstElementChild,'back');head.firstElementChild.setAttribute('aria-label','뒤로');body.className='approved-ej-body';
  textInput(body.children[1],model.query,'gsJ4Query','현장 이름 · 주소',1000);
  const candidates=body.children[2],title=candidates.children[0],template=candidates.children[1].cloneNode(true);
  title.textContent=model.similarLabel??'비슷한 현장 '+rows.length+'곳';
  [...candidates.children].slice(1).forEach(n=>n.remove());candidates.className='approved-j4-candidates';
  rows.forEach(item=>{const row=template.cloneNode(true);row.className='approved-j4-row';row.children[0].textContent=item.name||'';row.children[1].textContent=item.subtitle||'';action(row,'j4-existing',{id:String(item.id||'')},!item.id);candidates.append(row);});
  if(model.pager)candidates.insertAdjacentHTML('beforeend',model.pager);
  const selected=rows.find(x=>String(x.id)===String(model.selectedId));
  action(body.children[3],'j4-existing',{id:selected?.id?String(selected.id):''},!selected?.id);
  action(body.children[4],'j4-new',null,!String(model.query||'').trim());
  body.children[5].textContent=model.note??'같은 현장 ≠ 같은 공사 · 자동 합치기 없음'+(selected?.owner?' · 기존 담당('+selected.owner+')에게 알림':'');
  return box.innerHTML;
 }
 w.MobileApprovedEJ=Object.freeze({renderE,renderJ4});
})(window);
