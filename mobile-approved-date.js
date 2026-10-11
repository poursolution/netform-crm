/* Source43 §⑦ only. Dates are supplied by the caller; no date arithmetic or saving. */
(function(w){
 'use strict';
 function render(model={}){
  const src=w.MobileApprovedDateSource;
  if(!src||typeof src.backdropHtml!=='string'||typeof src.sheetHtml!=='string'||typeof src.chipHtml!=='string')throw Error('APPROVED_DATE_SOURCE_MISSING');
  const options=Array.isArray(model.dateOptions)?model.dateOptions:[];
  if(options.length>4||options.some(row=>!Array.isArray(row)||row.length!==2||row.some(value=>typeof value!=='string')))throw Error('APPROVED_DATE_OPTIONS_INVALID');
  const value=String(model.value??''),box=w.document.createElement('div'),layer=w.document.createElement('div');
  layer.className='approved-date-layer';layer.setAttribute('style','position:absolute;inset:0;z-index:2');
  layer.innerHTML=src.backdropHtml+src.sheetHtml;box.append(layer);
  const [backdrop,sheet]=layer.children;
  backdrop.dataset.gs='k1-calendar-cancel';backdrop.setAttribute('role','button');backdrop.tabIndex=0;backdrop.setAttribute('aria-label','날짜 선택 닫기');
  if(model.title!==undefined)sheet.children[1].textContent=String(model.title??'');
  sheet.className='approved-date-sheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label',sheet.children[1].textContent);
  const grid=sheet.children[2],direct=sheet.children[3];grid.className='approved-date-options';grid.replaceChildren();
  options.forEach(([label,date])=>{
   const selected=value===date,colors=src.provenance.selection[selected?'on':'off'],slot=w.document.createElement('div');slot.innerHTML=src.chipHtml;
   const chip=slot.firstElementChild;chip.setAttribute('style',chip.getAttribute('style').replace('{{ d.bg }}',colors.bg).replace('{{ d.fg }}',colors.fg));
   chip.textContent=label;chip.dataset.gs='k1-calendar-option';chip.dataset.value=date;chip.setAttribute('role','button');chip.setAttribute('aria-pressed',String(selected));chip.tabIndex=0;grid.append(chip);
  });
  // Preserve the visible source link. A transparent native control opens the device picker.
  direct.className='approved-date-direct';direct.style.position='relative';
  const input=w.document.createElement('input');input.type='date';input.dataset.quoteDate='';input.value=value;input.setAttribute('value',input.value);input.setAttribute('aria-label','날짜 직접 입력');
  if(model.min!=null)input.min=String(model.min);
  input.setAttribute('style','position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer');direct.append(input);
  return box.innerHTML;
 }
 w.MobileApprovedDate=Object.freeze({render});
})(window);
