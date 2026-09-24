/* Display grouping is separate from persisted numeric values. */
(function(root){
 'use strict';
 function raw(value){return String(value==null?'':value).replace(/,/g,'').trim()}
 function parse(value){const s=raw(value);if(!s)return 0;if(!/^\d+(?:\.\d*)?$/.test(s))return NaN;const n=Number(s);return Number.isFinite(n)&&n<=Number.MAX_SAFE_INTEGER?n:NaN}
 function format(value){
  const s=raw(value);if(!s)return '';if(!Number.isFinite(parse(s)))return String(value);
  const parts=s.split('.');parts[0]=parts[0].replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,',');return parts.join('.');
 }
 function caret(formatted,count){if(!count)return 0;let n=0;for(let i=0;i<formatted.length;i++){if(formatted[i]!==',')n++;if(n===count)return i+1}return formatted.length}
 function update(el){
  const before=el.value,start=el.selectionStart,end=el.selectionEnd;
  const next=format(before);if(next!==before){el.value=next;if(start!=null){const a=before.slice(0,start).replace(/,/g,'').length,b=before.slice(0,end).replace(/,/g,'').length;el.setSelectionRange(caret(next,a),caret(next,b))}}
  el.setCustomValidity(Number.isFinite(parse(el.value))?'':'금액은 0 이상의 숫자로 입력해 주세요.');
 }
 function enhance(el){if(!el.matches||!el.matches('input[data-money]'))return;el.type='text';el.inputMode='decimal';update(el)}
 function scan(node){if(node.nodeType!==1)return;enhance(node);node.querySelectorAll('input[data-money]').forEach(enhance)}
 function install(doc){
  // Capture before inline oninput handlers so state receives the displayed value.
  doc.addEventListener('input',e=>{if(e.target.matches('input[data-money]')&&!e.isComposing)update(e.target)},true);
  doc.addEventListener('compositionend',e=>{if(e.target.matches('input[data-money]'))update(e.target)},true);
  doc.addEventListener('focusin',e=>{if(e.target.matches('input[data-money]'))enhance(e.target)});
  // Backspacing a grouping separator deletes the adjacent digit, not a comma
  // that would immediately reappear and trap the cursor.
  doc.addEventListener('keydown',e=>{const el=e.target;if(!el.matches('input[data-money]')||e.isComposing||el.selectionStart!==el.selectionEnd)return;
   const p=el.selectionStart,v=el.value;let a,b;
   if(e.key==='Backspace'&&p>1&&v[p-1]===','){a=p-2;b=p}
   else if(e.key==='Delete'&&v[p]===','){a=p;b=p+2}else return;
   e.preventDefault();el.setRangeText('',a,b,'start');el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const start=()=>{scan(doc.documentElement);new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(scan))).observe(doc.documentElement,{childList:true,subtree:true})};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
 }
 const api={parse,format,caret,update};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.MoneyInput=api;
 if(root.document)install(root.document);
})(typeof window==='undefined'?globalThis:window);
