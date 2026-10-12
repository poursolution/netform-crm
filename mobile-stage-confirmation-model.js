/* Read-only J-1 boundary. No duplicated mobile checklist or keyword completion. */
(function(w){
 'use strict';
 function read(deal){
  const d=deal||{},a=d.nextAction&&typeof d.nextAction==='object'&&d.nextAction.status==='open'?d.nextAction:null;
  // Existing stage_checklist is a checkbox map; it has neither confirmed facts nor
  // supporting record links. stageGuideAutoM additionally uses memo keywords.
  // Neither is the evidence-backed PC/operating-rule projection required by guide43 §20.
  const A=typeof w.stageGuideItemsM==='function'?w.stageGuideItemsM(d):[],on=(x,k)=>x.auto?!!w.stageGuideAutoM?.(d,x.auto):!!((d.stage_checklist||{})[d.code]||{})[k];
  const open=A.map((x,k)=>({x,k})).filter(p=>!on(p.x,p.k)),done=A.length-open.length;
  return {available:A.length>0,dealId:d.id||d.opportunity_id||'',name:d.nm||d.site||d.site_name||'현장 확인 필요',task:a?.text||'다음 업무를 정해 주세요',actionLabel:'연락하고 확인',action:'contact',actionAllowed:true,context:'이 단계 확인 '+done+'/'+A.length,checks:open.slice(0,3).map(p=>({label:String(p.x.text||p.x),detail:'아직 모름',verified:false})),notice:open.length>3?'나머지 '+(open.length-3)+'개는 확인한 뒤 차례로 보입니다. 확인한 내용은 연락 결과로 남겨 주세요.':'확인한 내용은 연락 결과로 남겨 주세요.'};
 }
 w.MobileStageConfirmationModel=Object.freeze({read});
})(window);
