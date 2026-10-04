/* 공통 오류 표시 (2026-10-01 컨설턴트 P0-5 — 서버 500·읽기 실패가 빈 화면처럼 보이고 다시 시도할 길이 없었다)
   ① 핵심 자료(영업·문의) 갱신 실패 → 본문 맨 위 띠 '…불러오지 못했습니다 · 다시 시도'(loadData 재실행)
   ② 서버 함수 5xx → 같은 띠에 어느 기능인지 한글로 적고 '새로고침' 제공. 빈 결과와 실패를 구분한다. */
(function(root){
 'use strict';
 const NAMES={crm_approval_list_v1:'예외 승인함 읽기',crm_approval_request_v1:'승인 요청',crm_approval_decide_v1:'승인 · 반려(예외 승인자)',crm_deal_win_list_v1:'수주 유형 읽기',crm_deal_win_register_v1:'수주 확정',crm_deal_transfer_list_v1:'타사 이관 읽기',crm_deal_transfer_register_v1:'타사 이관 등록',crm_deal_transfer_award_v1:'낙찰결과 등록',crm_deal_transfer_approve_v1:'타사 이관 실적 인정',crm_ops_rules_v1:'운영 기준 설정',crm_inquiry_site_link_v1:'기존 현장 판단 저장',crm_site_link_review_list_v1:'과거자료 연결 검토 목록',crm_site_link_review_resolve_v1:'과거자료 연결 확정',crm_operational_source_v1:'운영 자료 읽기',crm_operational_source_v2:'운영 자료 읽기',crm_operational_changes_v1:'변경분 읽기',crm_profile_scoped_v2:'로그인 권한 확인',crm_contract_sales_read_v1:'계약 실적 읽기',crm_release_manifest_v1:'서버 함수 목록',crm_cleanup_state:'데이터 정리 이력',crm_inquiry_close_v1:'배드핏 종결',crm_gongjong_links_v1:'공종 분석 합치기 이력',crm_gongjong_merge_v1:'공종 분석 같은 공사 합치기',crm_ai_suggestion_list_v1:'AI 추정 다시 읽기',crm_inquiry_director_assign_v1:'영업이사 배정',crm_deal_stage_fields_update_v1:'단계 정보 저장'};
 const errors=[];let readFail=null,busy=false;
 function style(){if(document.getElementById('crm-error-style'))return;const s=document.createElement('style');s.id='crm-error-style';
  s.textContent='#crm-error-banner{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:12px 20px 0;border:1px solid #f6c5c9;border-left:4px solid #F04452;border-radius:12px;background:#fff5f6;padding:10px 14px;font-size:12.5px;color:#33415e}'
  +'#crm-error-banner b{color:#c0262f;font-size:13px}#crm-error-banner ul{flex-basis:100%;margin:0;padding-left:18px;color:#5b6b85;font-size:12px;line-height:1.5}'
  +'#crm-error-banner button{border:1px solid #e2e8f1;border-radius:8px;background:#fff;color:#33415e;padding:5px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}#crm-error-banner button.primary{background:#3B6CE4;border-color:#3B6CE4;color:#fff}#crm-error-banner button:disabled{opacity:.6;cursor:default}';
  document.head.append(s);}
 const esc=v=>root.esc?root.esc(String(v)):String(v);
 function render(){
  let b=document.getElementById('crm-error-banner');
  if(!readFail&&!errors.length){b?.remove();return;}
  style();if(!b){b=document.createElement('div');b.id='crm-error-banner';b.setAttribute('role','alert');const main=document.querySelector('.main');if(main)main.prepend(b);else document.body.append(b);}
  const items=[];if(readFail)items.push('영업·문의 자료: '+esc(readFail));errors.slice(-3).forEach(e=>items.push(esc(NAMES[e.name]||e.name)+' — 서버 오류 '+e.status+(e.message?' · '+esc(e.message.slice(0,80)):'')));
  b.innerHTML='<b>'+(readFail?'자료를 불러오지 못했습니다':'서버 오류가 있었습니다')+'</b><span>'+(readFail?'마지막으로 받은 자료를 보여 주고 있습니다. 빈 값이 아니라 갱신 실패입니다.':'해당 기능의 결과가 비어 보이면 실패한 것입니다.')+'</span>'
   +(readFail?'<button type="button" class="primary" data-act="retry">'+(busy?'다시 불러오는 중…':'다시 시도')+'</button>':'<button type="button" class="primary" data-act="reload">새로고침</button>')+'<button type="button" data-act="close" aria-label="닫기">✕</button><ul><li>'+items.join('</li><li>')+'</li></ul>';
  b.querySelector('[data-act=retry]')?.addEventListener('click',retry);b.querySelector('[data-act=reload]')?.addEventListener('click',()=>location.reload());b.querySelector('[data-act=close]')?.addEventListener('click',()=>{errors.length=0;readFail=null;render();});
  const btn=b.querySelector('[data-act=retry]');if(btn)btn.disabled=busy;
 }
 async function retry(){if(busy||typeof root.loadData!=='function')return;busy=true;render();try{await root.loadData();if(typeof root.paint==='function')root.paint();}catch(e){}finally{busy=false;render();}}
 root.addEventListener('crm:read-state',e=>{const d=e.detail||{};if(d.ready){readFail=null;}else if(/갱신 필요|새로고침 필요/.test(d.label||'')){readFail=d.detail||d.label;}render();});
 root.addEventListener('crm:rpc-error',e=>{const d=e.detail||{};if(!d.name)return;errors.push({name:d.name,status:d.status,message:d.message||'',at:Date.now()});while(errors.length>5)errors.shift();render();});
 root.addEventListener('phase1:identity-cleared',()=>{errors.length=0;readFail=null;render();});
 root.PCErrorState={render,retry,errors:()=>errors.slice(),readFail:()=>readFail};
})(window);
