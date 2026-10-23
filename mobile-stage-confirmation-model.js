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
  return {available:A.length>0,dealId:d.id||d.opportunity_id||'',name:d.nm||d.site||d.site_name||'현장 확인 필요',task:a?.text||'다음 업무를 정해 주세요',actionLabel:'연락하고 확인',action:'contact',actionAllowed:true,context:'이 단계 확인 '+done+'/'+A.length,checks:open.slice(0,3).map(p=>({label:String(p.x.text||p.x),detail:'아직 모름',verified:false})),notice:(open.length?'항목을 누르면 연락 결과에서 같은 항목으로 확인합니다. 확인한 것은 응대 기록에 남고, 이 화면의 확인 표시는 서버 근거 연결 뒤 바뀝니다.':'이 단계 확인 항목을 모두 채웠습니다.')+(open.length>3?' 나머지 '+(open.length-3)+'개는 앞의 항목을 확인한 뒤 보입니다.':'')};
  /* 2026-10-23 인계 03: 예전 '확인한 내용은 연락 결과로 남겨 주세요'만으로는 어디서 입력하는지 몰랐다 — 항목 줄 · [연락하고 확인]이 같은 항목을 연락 결과로 넘긴다(mobile-guide-shell).
     '확인됨' 표시는 승인 J-1 규칙대로 근거(응대 기록 id · 시각)가 서버 조회에 실려야 함 — 메모 글자로 만들지 않는다 */
 }
 w.MobileStageConfirmationModel=Object.freeze({read});
})(window);
