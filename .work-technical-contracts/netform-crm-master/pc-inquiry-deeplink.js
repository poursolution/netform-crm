/* PC only. Resolve exclusively from the already authorized inquiry read. */
(function(w){
 'use strict';
 const original=w.openRequestedDetail;let opened=false;
 function open(){
  const params=new URL(w.location.href).searchParams,id=params.get('inquiry');
  if(!id)return original?.apply(this,arguments);
  if(opened||!w.Phase1?.profile||!w.B||!Array.isArray(w.B.inquiries))return;
  if(params.getAll('inquiry').length!==1||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return;
  const q=w.B.inquiries.find(x=>String(x.id).toLowerCase()===id.toLowerCase());
  if(!q)return;
  opened=true;
  try{w.goPage('inq');w.inqCtlOpenSingle(w.inqKey(q));}catch(e){opened=false;throw e;}
 }
 w.openRequestedDetail=open;
 w.addEventListener('phase1:identity-cleared',()=>{opened=false;});
})(window);
