/* 영업건 휴지통으로 보내기 (2026-10-06 대표 "이런 현장은 좀 삭제할 수 있게 해줘" → 2026-10-07 "파이프라인 단계로 이관됐을 때도 · 휴지통에 보관 · 30일 뒤 삭제")
   보낼 수 있는 것 = 예전 시스템에서 옮겨 온 열린 영업건(과거 이관 · 분류 전, 또는 운영 시작일 2026-10-01 전에 등록된 건 — 영업 재개로 파이프라인 단계에 들어간 건 포함) · 관리자만.
   서버 함수 crm_deal_discard_v1(sql/deal-trash-v1-20261007.sql): 영업건 행과 그 영업건을 가리키는 모든 하위 행을 휴지통(crm_security.manual_delete_backup · batch 'deal-trash-YYYYMMDD')에 JSON 으로 넣은 뒤 삭제 ·
   감사 기록(action 'discard'). 30일 보관 뒤 자동 삭제 · 그 전에는 휴지통(deal-trash.js)에서 복원. 계약실적 · 수주 · 종료 기록 · 견적문의 연결 · 첨부 · 확장관리 · 공종 합치기 기록이 붙어 있으면 서버가 거절한다.
   서버 확인 뒤에만 화면 자료에서 뺀다. 서버에 아직 없으면(CRMRelease · 허용 목록) 버튼이 나오지 않는다. */
(function(root){
 'use strict';
 const RPC='crm_deal_discard_v1',LIVE='2026-10-01',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const admin=()=>{try{return !!root.inqCtlIsAdmin();}catch(e){return false;}};
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 const ready=()=>!!(root.SB&&typeof root.SB.rpc==='function'&&root.TOKEN)&&(root.CRM_RPC_ALLOW||[]).includes(RPC)&&!(root.CRMRelease&&root.CRMRelease.has&&root.CRMRelease.has(RPC)===false)&&admin();
 const open=d=>{try{return typeof root.outcomeOf==='function'?root.outcomeOf(d)==='open':true;}catch(e){return true;}};
 /* 예전 시스템에서 옮겨 온 자료인가: 과거 이관 · 분류 전이거나, 운영 시작일 전에 등록된 건(오늘 업무의 과거 이관분 분리와 같은 날짜) */
 const migrated=d=>{try{const P=root.PipelineScope;if(P&&P.on()&&P.isLegacy(d))return true;const c=String(d.created||d.created_at||'').slice(0,10);return !!c&&c<LIVE;}catch(e){return false;}};
 const can=d=>{try{return !!d&&ready()&&open(d)&&migrated(d)&&UUID.test(String(d.id||''));}catch(e){return false;}};
 async function run(d,reason){
  if(!can(d))throw Error('예전 시스템에서 옮겨 온 열린 영업건만 휴지통으로 보낼 수 있습니다');
  const r=await root.SB.rpc(RPC,{p:{deal_id:String(d.id),expected_version:Number.isSafeInteger(Number(d.version))?Number(d.version):null,reason:String(reason||'').trim().slice(0,300)}});
  if(r&&r.error){if(r.error.code==='PGRST202'||/Could not find the function/i.test(String(r.error.message||''))){try{root.CRMRelease.noteMissing(RPC);}catch(e){}throw Error('휴지통 기능이 아직 서버에 적용되지 않았습니다');}throw Error(r.error.message||'휴지통으로 보내지 못했습니다');}
  if(!r||!r.data||r.data.ok!==true||String(r.data.deal_id)!==String(d.id))throw Error('서버 확인 응답이 올바르지 않습니다');
  /* 서버가 지웠다고 확인한 뒤에만 화면 자료에서 뺀다 */
  const id=String(d.id);
  if(root.B&&Array.isArray(root.B.deals)){const i=root.B.deals.findIndex(x=>String(x.id)===id);if(i>=0)root.B.deals.splice(i,1);}
  try{if(root.LOCAL&&root.LOCAL.deals){Object.keys(root.LOCAL.deals).forEach(k=>{const v=root.LOCAL.deals[k];if(k===id||(v&&String(v.id)===id))delete root.LOCAL.deals[k];});}}catch(e){}
  try{if(root.CUR_DETAIL&&root.CUR_DETAIL.kind==='deal'&&root.CUR_DETAIL.item&&String(root.CUR_DETAIL.item.id)===id)root.closeDetail();}catch(e){}
  try{root.saveLocal&&root.saveLocal();}catch(e){}
  return r.data;
 }
 /* 상세 창 [···] 메뉴에서: 확인 창 한 번 → 휴지통으로 */
 function ask(d){
  if(!can(d))return false;const n=Array.isArray(d.activities)?d.activities.length:0;
  const ok=root.confirm('이 자료를 휴지통으로 보낼까요?\n\n'+String(d.site||'현장명 미입력')+'\n응대 기록 '+n+'건과 함께 휴지통에 30일 보관한 뒤 자동 삭제됩니다. 그 전에는 과거 이관 화면의 [휴지통]에서 복원할 수 있습니다.\n계약실적 · 견적문의 · 수주 기록이 연결된 자료는 서버가 거절합니다.');
  if(!ok)return true;
  run(d,'상세 창에서 삭제').then(()=>{toast('휴지통으로 보냈습니다 · 30일 안에 복원할 수 있습니다');try{root.paint();}catch(e){}}).catch(e=>toast(String(e&&e.message||e),'warn'));
  return true;
 }
 root.DealDiscard={RPC,LIVE,ready,can,migrated,run,ask};
})(window);
