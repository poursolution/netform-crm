/* Read-only J-1 boundary. No duplicated mobile checklist or keyword completion. */
(function(w){
 'use strict';
 function read(deal){
  const d=deal||{},a=d.nextAction&&typeof d.nextAction==='object'&&d.nextAction.status==='open'?d.nextAction:null;
  // Existing stage_checklist is a checkbox map; it has neither confirmed facts nor
  // supporting record links. stageGuideAutoM additionally uses memo keywords.
  // Neither is the evidence-backed PC/operating-rule projection required by guide43 §20.
  return {available:false,dealId:d.id||d.opportunity_id||'',name:d.nm||d.site||d.site_name||'현장 확인 필요',task:a?.text||'현재 업무 확인 필요',actionLabel:'업무 확인',action:'pending-task',actionAllowed:false,actionBlockedReason:'이 업무의 승인된 처리 화면 연결을 확인해야 합니다.',context:'공통 기준 확인 필요',checks:[],notice:'단계·상황별 확인 기준과 근거 기록 연결을 확인해야 합니다. 메모 문구나 기존 체크만으로 완료 처리하지 않습니다.'};
 }
 w.MobileStageConfirmationModel=Object.freeze({read});
})(window);
