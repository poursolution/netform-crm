/* Expansion is a relationship pool, never a second sales pipeline. */
(function(root){
 'use strict';
 const labels={'신규 대상':'관리대상','접촉 예정':'접촉예정','관계 관리중':'관계관리','추가 니즈 확인':'니즈확인','신규 영업기회 생성':'Pipeline 전환','보류/휴면':'보류'};
 const statuses=Object.values(labels);
 function status(r){return r.createdOpportunityId||r.created_opportunity_id?'Pipeline 전환':labels[r.status||r.expansion_status]||r.status||r.expansion_status||'관리대상'}
 function converted(r){return status(r)==='Pipeline 전환'}
 function legacy(s){return Object.keys(labels).find(k=>labels[k]===s)||s}
 function request(source,deal,proof){
  if(converted(source))throw Error('이미 Pipeline으로 전환된 이력입니다.');
  if(!source.sourceOpportunityId)throw Error('기존 수주 영업기회 연결이 없습니다.');
  if(!proof||!String(proof.dispatch_id||'').trim())throw Error('실제 견적 발송이력 ID를 선택해 주세요. 초안·예약·실패는 전환할 수 없습니다.');
  if(!Number.isFinite(Number(deal.amount))||Number(deal.amount)<=0)throw Error('발송한 견적의 금액을 입력해 주세요.');
  if(!deal.work_items||!deal.work_items.length||!deal.primary_work||!deal.work_items.includes(deal.primary_work))throw Error('새 공종과 대표 공종을 확인해 주세요.');
  return {source_opportunity_id:source.sourceOpportunityId,site_id:source.siteId||null,quote_dispatch_id:String(proof.dispatch_id).trim(),
   idempotency_key:'expansion:'+source.sourceOpportunityId,
   opportunity:Object.assign({},deal,{origin:'expansion',origin_source:'expansion',source_opportunity_id:source.sourceOpportunityId,stage_code:'sent',code:'sent',stage:'컨설팅 자료 발송완료'})};
 }
 function acknowledged(res,req){
  if(!res||res.ok!==true||res.operation!=='expansion_quote_convert'||!res.new_opportunity_id||res.new_opportunity_id===req.source_opportunity_id||res.source_opportunity_id!==req.source_opportunity_id||res.quote_dispatch_id!==req.quote_dispatch_id||res.stage_code!=='sent'||res.origin!=='expansion'||res.expansion_status!=='Pipeline 전환')throw Error('전환 완료를 확인하지 못했습니다. 서버 연결을 확인한 뒤 같은 건을 재시도하세요.');
  return res;
 }
 const api={statuses,status,converted,legacy,request,acknowledged};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.ExpansionFlow=api;
})(typeof window==='undefined'?globalThis:window);
