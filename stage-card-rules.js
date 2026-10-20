/* 단계별 카드 기준 (2026-10-20 design_handoff_mobile_all v5 보완 '단계별 · 같은 연락하기라도 목적과 끝나는 조건이 다름')
   견적문의 + 7단계마다: 이번에 확인할 것(요청 · 고객 기록이 없을 때 쓰는 기본) / 끝나는 조건 / 이어서 / 하지 않는 것.
   '완료' = 그 업무가 끝났다는 뜻 — 단계는 자동으로 바뀌지 않는다. 화면엔 이 설명이 아니라 카드 한 장에 '확인할 것' · '끝나는 조건'만.
   PC · 모바일 같이 쓴다(단계 판정은 PipelineStages 그대로). */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.StageCardRules=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const R={
  inquiry:{n:'견적문의',check:'견적 요청 범위 · 방문이 필요한지',done:'연결돼서 확인한 내용을 남기면 끝',next:'방문 · 견적 필요는 확인된 것만',no:'이관 기록 미확인이면 먼저 기존 응대 여부 확인 · 담당 없으면 배정이 먼저'},
  consulting:{n:'컨설팅 설계',check:'공사 범위 · 실측 · 사진',done:'방문 결과 · 확인한 것을 남기면 끝 · 견적이 필요하면 이어서 요청',next:'자료 보완 또는 견적 요청(방문 기록에 연결)',no:'견적 요청을 취소해도 방문 완료는 그대로'},
  sent:{n:'자료 발송완료',check:'보낸 견적을 받았는지',done:'수신 확인 · 고객 반응을 남기면 끝',next:'받았다면 합의한 확인일 유지 · 못 받았으면 재발송 · 수정 요청이면 견적 수정',no:'같은 후속 업무를 새로 만들지 않음'},
  relationship:{n:'관계관리',check:'공사 추진 시기 · 고객 반응',done:'이번에 확인한 추진 상황 · 반응을 남기면 끝',next:'고객 약속에 따른 재연락 · 자료 제공',no:'미확인을 무응답 · 보류로 확정하지 않음'},
  compete:{n:'경쟁 · 입찰',check:'제안서 · 입찰 서류 제출',done:'실제 제출 근거를 남기면 끝',next:'개찰 다음 날 결과 확인',no:'제출했다고 낙찰까지 완료하지 않음'},
  contract:{n:'계약 · 시공',check:'계약일 · 금액 · 계약서',done:'계약 체결 · 착공 · 준공을 각각 확인하면 끝',next:'남은 계약 항목 · 현장 조치를 담당 · 일정에 연결',no:'예정일이 지났다고 완료하지 않음'},
  won:{n:'수주',check:'수주 유형 · 낙찰사 · 낙찰금액',done:'확인된 수주 결과를 영업건에 남기면 끝',next:'남은 계약 · 시공 · 사후 연락 유지',no:'수주 표시만으로 남은 업무를 한꺼번에 완료하지 않음'},
  lost:{n:'실주',check:'끝난 이유 · 재접촉 가능 여부',done:'종료 근거 · 실주 사유를 남기면 끝',next:'재영업 가능할 때만 후속 계획',no:'사업 연기 · 예산 미확정만으로 실주 확정하지 않음'}
 };
 /* 단계 코드 → 기준 열쇠(PipelineStages 그룹이 있으면 그것, 없으면 코드로) */
 function keyOf(code,outcome){
  const o=String(outcome||'');if(o==='won')return 'won';if(o==='lost'||o==='badfit'||o==='nocontact')return 'lost';
  let g='';try{g=String(root.PipelineStages&&root.PipelineStages.group?root.PipelineStages.group(code,outcome):'')||'';}catch(e){}
  const c=String(g||code||'');
  if(/inquiry|first_contact/.test(c))return 'inquiry';
  if(/consult/.test(c))return 'consulting';
  if(/sent|quote|material/.test(c))return 'sent';
  if(/rapport|relation|nurture|waiting|hold/.test(c))return 'relationship';
  if(/compete|bidding|imminent|pt/.test(c))return 'compete';
  if(/contract|construct|work|complete/.test(c))return 'contract';
  if(/won/.test(c))return 'won';
  if(/lost/.test(c))return 'lost';
  return 'consulting';
 }
 const of=(code,outcome)=>R[keyOf(code,outcome)];
 return {RULES:R,keyOf,of};
});
