/* B9 server contract for Claude's existing approval entry. No form/layout. */
(function(root){
 'use strict';
 const PREVIEW='crm_contract_correction_preview_v1',REQUEST='crm_contract_correction_request_v1';
 const ids=new Map();let epoch=0,identity='';
 const who=()=>JSON.stringify(root.Phase1?.profile||root.ME||null);
 const reset=()=>{identity=who();epoch++;ids.clear();};
 const sync=()=>{if(identity!==who())reset();};
 const enabled=()=>!root.FIELD_DEMO&&[PREVIEW,REQUEST].every(n=>root.CRMRelease?.has?.(n)===true&&root.OpsStore?.has?.(n)===true);
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
 const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 async function call(name,p){sync();if(!enabled())throw Error('계약금액 정정 기능이 아직 준비되지 않았습니다.');const gen=epoch,owner=identity;
  const r=await root.OpsStore.rpc(name,p);sync();if(gen!==epoch||owner!==identity)throw Error('계정이 변경되었습니다. 다시 조회해 주세요.');return r;
 }
 async function preview(dealId){if(!uuid(dealId))throw Error('영업건 ID가 필요합니다.');const r=await call(PREVIEW,{deal_id:dealId});
  if(r?.ok!==true||r.deal_id!==dealId||!uuid(r.source_event_id)||!Number.isSafeInteger(r.expected_version)||r.expected_version<1||!Number.isSafeInteger(r.balance)||typeof r.cancelled!=='boolean'||!date(r.last_effective_date))throw Error('계약 원장 조회 결과를 확인하지 못했습니다.');return r;
 }
 async function request(input){sync();
  const p={deal_id:input?.deal_id,source_event_id:input?.source_event_id,expected_version:input?.expected_version,target_balance:input?.target_balance,effective_date:input?.effective_date,reason:input?.reason?.trim?.()};
  if(!uuid(p.deal_id)||!uuid(p.source_event_id)||!Number.isSafeInteger(p.expected_version)||p.expected_version<1||!Number.isSafeInteger(p.target_balance)||p.target_balance<=0||!date(p.effective_date)||!p.reason||p.reason.length>300)throw Error('원장 기록·금액·실제 적용일·사유를 확인해 주세요.');
  const key=JSON.stringify(p);if(!ids.has(key))ids.set(key,crypto.randomUUID());p.request_id=ids.get(key);
  const r=await call(REQUEST,p),q=r?.request;
  if(r?.ok!==true||r.operation!==REQUEST||r.request_id!==p.request_id||!q?.id||q.type!=='contract_amount'||q.deal_id!==p.deal_id||!['pending','approved','rejected','cancelled'].includes(q.status)||!Object.entries(p).filter(([k])=>k!=='request_id').every(([k,v])=>q.payload?.[k]===v))throw Error('정정 요청 저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인해 주세요.');
  // Keep the exact request key until account reset: a repeated click is the same request.
  root.ApprovalInbox?.take?.(q);return r;
 }
 root.addEventListener('phase1:profile',reset);root.addEventListener('phase1:identity-cleared',reset);
 root.ContractCorrection={enabled,preview,request};
})(window);
