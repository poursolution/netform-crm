/* 잔디 사건 알림 (2026-10-22 회의록 '메신저 알림 → 앱 실행'): 문의 배정 · 지원 요청 · 하자 접수 같은 사건을 잔디로 알리고, 누르면 CRM 이 바로 열리는 링크를 붙인다.
   · 서버 함수 crm-jandi(kind 'event')로만 보낸다(웹훅 주소는 서버 비밀값). 로그인 + 설정 jandi_enabled 가 켜져 있을 때만.
   · 알림은 보조 — 실패해도 원래 저장(배정 · 접수)은 그대로 끝난다(조용히 넘어가고 콘솔에만 남김).
   · 링크: 모바일 mobile.html?open=inq:<id> · deal:<id> (앱이 그 문의 · 영업건을 바로 연다), PC crm.html#p=inq.
   끄기 G.jandiEventsOff. 순수 함수(text · links)는 node 로 검사(tests/jandi-events.test.cjs). */
(function(root){
 'use strict';
 const EVENTS=['inquiry_assigned','deal_support_request','defect_reported','deal_handoff'];
 function appBase(){try{const u=root.location;return u.origin+u.pathname.replace(/[^/]*$/,'');}catch(e){return 'https://poursolution.github.io/netform-crm/';}}
 const str=(v,n)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
 function links(kind,id){const b=appBase(),q=encodeURIComponent(kind+':'+id);return [{title:kind==='inq'?'1차 응대 하기(모바일)':'모바일에서 열기',url:b+'mobile.html?open='+q},{title:'PC에서 보기',url:b+'crm.html#p='+(kind==='inq'?'inq':'pipe')}];}
 /* 문의 배정: 현장 · 브랜드 · 공종 · 담당 · 배정자 */
 function inquiryAssignedMessage(q,to,by){
  const site=str(q&&(q.nm||q.site||q.site_name),40)||'현장 미입력',brand=str(q&&(q.brand||q.gj),20),work=str(q&&(q.work_type||q.inflow),30);
  return {event:'inquiry_assigned',title:'[문의 배정] '+site,text:[brand,work,'담당 '+str(to,20),by?'배정 '+str(by,20):''].filter(Boolean).join(' · ')+'\n첫 연락 기준 시간 안에 응대해 주세요.',links:links('inq',String(q&&(q.key||q.id)||''))};
 }
 /* 하자 접수(모바일 간이 접수): 현장 · 부위 · 긴급 · 접수자 */
 function defectReportedMessage(d,info){
  const site=str(d&&(d.nm||d.site||d.site_name),40)||'현장 미입력';
  return {event:'defect_reported',title:'[하자 접수] '+site,text:[str(info&&info.part,20),info&&info.urgent?'긴급':'일반',str(info&&info.memo,80),'접수 '+str(info&&info.by,20)].filter(Boolean).join(' · '),links:links('deal',String(d&&d.id||''))};
 }
 /* PC 는 설정값(jandi_enabled)을 알고 있어 미리 거르고, 모바일(OpsStore 없음)은 서버가 거른다(꺼져 있으면 409) */
 function on(){try{if(root.G&&root.G.jandiEventsOff)return false;if(!root.TOKEN||!root.SUPABASE_URL)return false;if(!(root.OpsStore&&root.OpsStore.flags))return true;return root.OpsStore.flags().jandi_enabled===true;}catch(e){return false;}}
 async function send(msg){
  if(!msg||!EVENTS.includes(msg.event))throw new Error('BAD_EVENT');
  const r=await root.fetch(root.SUPABASE_URL+'/functions/v1/crm-jandi',{method:'POST',headers:{apikey:root.SUPABASE_ANON,Authorization:'Bearer '+root.TOKEN,'Content-Type':'application/json'},body:JSON.stringify({kind:'event',event:msg.event,title:msg.title,text:msg.text,links:msg.links})});
  const j=await r.json().catch(()=>null);if(!r.ok||!j||j.ok!==true)throw new Error(j&&j.error||'FAILED');return j;
 }
 /* 조용히: 켜져 있을 때만 보내고, 실패는 콘솔에만 */
 function quiet(msg){if(!on())return Promise.resolve(null);return send(msg).catch(e=>{try{root.console&&root.console.warn('jandi event skipped: '+(e&&e.message||e));}catch(x){}return null;});}
 const api={EVENTS,appBase,links,inquiryAssignedMessage,defectReportedMessage,on,send,quiet,
  inquiryAssigned:(q,to,by)=>quiet(inquiryAssignedMessage(q,to,by||(root.ME&&root.ME.name)||'')),
  defectReported:(d,info)=>quiet(defectReportedMessage(d,info))};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.JandiEvents=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
