/* Conservative address evidence grouping for one already-canonical Site. */
(function(root){
 'use strict';
 function clean(value){return String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ')}
 function key(value){return clean(value).toLowerCase().replace(/[\s·.,()\[\]_-]/g,'')}
 function suggest(values){
  const groups=new Map();
  (Array.isArray(values)?values:[]).forEach(function(value){
   const display=clean(value),normalized=key(display);
   if(!normalized||display==='미입력')return;
   const current=groups.get(normalized);
   if(!current||display.length>current.length)groups.set(normalized,display);
  });
  return groups.size===1?groups.values().next().value:'';
 }
 const api=Object.freeze({clean:clean,key:key,suggest:suggest});
 root.SiteAddressEvidence=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
