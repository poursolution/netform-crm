/* 과거 이관 · 분류 전 자료 삭제 (2026-10-06 대표 "이런 현장은 좀 삭제할 수 있게 해줘")
   지울 수 있는 것 = PipelineScope.isLegacy 인 영업건(열린 건인데 현재 CRM 단계 값이 아닌 것)만 · 관리자만.
   서버 함수 crm_deal_discard_v1(sql/deal-discard-v1-20261006.sql): 영업건 행과 그 영업건을 가리키는 모든 하위 행을 백업 보관함(crm_security.manual_delete_backup · batch 'deal-discard-YYYYMMDD')에 JSON 으로 넣은 뒤 삭제 ·
   감사 기록(crm_security.audit_events · action 'discard'). 계약실적 · 수주 · 종료 기록 · 견적문의 연결 · 첨부 · 확장관리 · 공종 합치기 기록이 붙어 있으면 서버가 거절한다.
   서버 확인 뒤에만 화면 자료에서 뺀다. 서버에 아직 없으면(CRMRelease · 허용 목록) 버튼이 나오지 않는다. */
(function(root){
 'use strict';
 const RPC='crm_deal_discard_v1';
 const admin=()=>{try{return !!root.inqCtlIsAdmin();}catch(e){return false;}};
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 const ready=()=>!!(root.SB&&typeof root.SB.rpc==='function'&&root.TOKEN)&&(root.CRM_RPC_ALLOW||[]).includes(RPC)&&!(root.CRMRelease&&root.CRMRelease.has&&root.CRMRelease.has(RPC)===false)&&admin();
 const can=d=>{try{return !!d&&ready()&&!!root.PipelineScope&&root.PipelineScope.on()&&root.PipelineScope.isLegacy(d)&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(d.id||''));}catch(e){return false;}};
 async function run(d,reason){
  if(!can(d))throw Error('과거 이관 · 분류 전 자료만 지울 수 있습니다');
  const r=await root.SB.rpc(RPC,{p:{deal_id:String(d.id),expected_version:Number.isSafeInteger(Number(d.version))?Number(d.version):null,reason:String(reason||'').trim().slice(0,300)}});
  if(r&&r.error){if(r.error.code==='PGRST202'||/Could not find the function/i.test(String(r.error.message||''))){try{root.CRMRelease.noteMissing(RPC);}catch(e){}throw Error('삭제 기능이 아직 서버에 적용되지 않았습니다');}throw Error(r.error.message||'삭제하지 못했습니다');}
  if(!r||!r.data||r.data.ok!==true||String(r.data.deal_id)!==String(d.id))throw Error('서버 확인 응답이 올바르지 않습니다');
  /* 서버가 지웠다고 확인한 뒤에만 화면 자료에서 뺀다 */
  const id=String(d.id);
  if(root.B&&Array.isArray(root.B.deals)){const i=root.B.deals.findIndex(x=>String(x.id)===id);if(i>=0)root.B.deals.splice(i,1);}
  try{if(root.LOCAL&&root.LOCAL.deals){Object.keys(root.LOCAL.deals).forEach(k=>{const v=root.LOCAL.deals[k];if(k===id||(v&&String(v.id)===id))delete root.LOCAL.deals[k];});}}catch(e){}
  try{if(root.CUR_DETAIL&&root.CUR_DETAIL.kind==='deal'&&root.CUR_DETAIL.item&&String(root.CUR_DETAIL.item.id)===id)root.closeDetail();}catch(e){}
  try{root.saveLocal&&root.saveLocal();}catch(e){}
  return r.data;
 }
 /* 상세 창 [···] 메뉴에서: 확인 창 한 번 → 백업 뒤 삭제 */
 function ask(d){
  if(!can(d))return false;const n=Array.isArray(d.activities)?d.activities.length:0;
  const ok=root.confirm('이 자료를 지울까요?\n\n'+String(d.site||'현장명 미입력')+'\n응대 기록 '+n+'건까지 백업 보관함에 저장한 뒤 삭제됩니다.\n계약실적 · 견적문의 · 수주 기록이 연결된 자료는 서버가 거절합니다.');
  if(!ok)return true;
  run(d,'상세 창에서 삭제').then(()=>{toast('백업 뒤 삭제했습니다');try{root.paint();}catch(e){}}).catch(e=>toast(String(e&&e.message||e),'warn'));
  return true;
 }
 root.DealDiscard={RPC,ready,can,run,ask};
})(window);
