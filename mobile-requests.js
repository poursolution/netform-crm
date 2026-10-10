/* 모바일 관리자 요청 (2026-10-10 대표 승인 · design_handoff_mobile_all 1번 '관리자 요청' · 3번 '요청 자동 완료 금지 — 지정한 요청 + 조건')
   PC 와 같은 서버 함수(crm_work_request_list_v1 · crm_work_request_reply_v1)를 모바일 허용 목록(transport.js)에 넣어 쓴다. 서버가 받는 사람 · 권한을 그대로 검사한다.
   · 오늘: 내게 온 열린 요청을 맨 위에(종류 · 현장 · 요청자 · 기한). 누르면 담당 확인(seen) + 그 현장 상세.
   · 결과 남기기(mobile-entry.js): 이 현장의 열린 요청 가운데 '이 기록으로 처리한 것'을 직접 고른 것만 닫는다 — 자동 완료 없음.
     연락 요청(첫 연락 · 후속 연락)만 모바일에서 닫는다(완료 조건: 연락 시도 · 결과 기록 · 다음 행동 + 날짜). 부재 · 번호 오류는 요청이 '진행 중'으로 남는다. 그 밖의 요청(견적 · 계약 · 낙찰 · 인계 · 지사 …)은 PC 에서 처리.
   서버에 아직 없으면(함수 없음) 조용히 꺼진다. 끄기: G.mobileReqOff=true */
(function(root){
 'use strict';
 const LIST='crm_work_request_list_v1',REPLY='crm_work_request_reply_v1';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const OPEN=['sent','seen','working'],isOpen=r=>!!r&&OPEN.includes(r.status);
 const CONTACT_KINDS=['first','follow'];
 const KIND_LABEL={first:'첫 연락 요청',follow:'후속 연락 요청',quote:'견적 진행 확인',award:'낙찰결과 확인 요청',contract:'계약정보 입력 요청',handover:'재배정 인계',support:'지원처리 확인',deadline:'마감 준비 확인',branch:'지사 확인 요청'};
 const COND=['고객 연락 시도','통화 결과 기록','다음 행동 + 날짜 등록'];
 const WD='일월화수목금토',pad=n=>String(n).padStart(2,'0');
 const S={list:[],at:0,loaded:false,busy:false,off:false,seen:{}};
 const enabled=()=>!(root.G&&(root.G.mobileReqOff||root.G.mobileV2Off))&&!S.off;
 const ready=()=>!!(root.Phase1&&typeof root.Phase1.rpc==='function'&&root.Phase1.profile);
 const rpc=(name,body)=>root.Phase1.rpc(name,{p:body});
 const labelOf=r=>String(r&&(r.label||KIND_LABEL[r.kind])||'관리자 요청');
 const isContact=r=>!!r&&CONTACT_KINDS.includes(r.kind);
 const incoming=()=>S.list.filter(r=>r.to_me&&isOpen(r)).sort((a,b)=>String(a.due_at).localeCompare(String(b.due_at)));
 const forDeal=id=>incoming().filter(r=>r.target_type==='deal'&&String(r.target_id)===String(id));
 /* 기한: 절대 날짜 · 요일 · 시각 + 남은 시간(PC dueTxt 와 같은 문장) */
 function dueTxt(r){const t=new Date(r&&r.due_at||'');if(!Number.isFinite(t.getTime()))return r&&r.due_label||'';const left=t.getTime()-Date.now(),hrs=Math.round(Math.abs(left)/36e5),rel=left>=0?(hrs<1?'1시간 안':hrs<48?hrs+'시간 남음':Math.round(hrs/24)+'일 남음'):(hrs<1?'방금 지남':hrs<48?hrs+'시간 지남':Math.round(hrs/24)+'일 지남');return (t.getMonth()+1)+'.'+t.getDate()+' ('+WD[t.getDay()]+') '+pad(t.getHours())+':'+pad(t.getMinutes())+' · '+rel;}
 const overdue=r=>Date.parse(r&&r.due_at)<Date.now();
 const put=r=>{if(!r||!r.id)return;const i=S.list.findIndex(x=>x.id===r.id);if(i>=0)S.list[i]=r;else S.list.unshift(r);};
 async function load(force){
  if(!enabled()||!ready()||S.busy)return;if(!force&&Date.now()-S.at<60000)return;
  S.busy=true;
  try{
   const r=await rpc(LIST,{days:30});if(!r||r.ok!==true||!Array.isArray(r.requests))throw Error('Invalid request list acknowledgement');
   const before=JSON.stringify(S.list);S.list=r.requests;S.loaded=true;S.at=Date.now();
   if(before!==JSON.stringify(S.list))repaint();
  }catch(e){S.at=Date.now();if(e&&(e.code==='PGRST202'||/CONTRACT_UNAVAILABLE|PHASE1_RPC_DENIED|Could not find the function/i.test(String(e.message||''))))S.off=true;}
  finally{S.busy=false;}
 }
 function repaint(){try{const G=root.G;if(G&&G.user&&!G.deal&&!G.sub&&G.tab==='today'&&G.mode==='rep')root.render();}catch(e){}}
 /* 받은 사람이 눌러 보면 그때 '담당 확인'(seen) — 화면 노출은 확인이 아니다(PC 와 같다) */
 function markSeen(r){if(!r||!r.to_me||r.status!=='sent'||S.seen[r.id])return;S.seen[r.id]=true;rpc(REPLY,{id:r.id,action:'seen'}).then(x=>{if(x&&x.request)put(x.request);}).catch(()=>{});}
 /* 이 기록으로 처리한 요청 닫기(지정한 것만): 연락 기록 저장이 서버에 확인된 뒤에 부른다. result = 연락 결과, absent = 연락 시도(진행 중으로 남김) */
 async function complete(r,o){
  if(!r||!isContact(r))throw Error('이 요청은 PC 에서 처리합니다.');
  const body={id:r.id,action:'done',result:String(o.result||''),next_text:String(o.next_text||''),next_due:String(o.next_due||''),absent:!!o.absent};
  const x=await rpc(REPLY,body);if(!x||!x.request||x.request.id!==r.id)throw Error('서버 확인 응답이 올바르지 않습니다.');put(x.request);return x.request;
 }
 /* ── 오늘 위 '관리자 요청' ── */
 function html(){
  const L=incoming();if(!L.length)return '';
  return '<section class="mq" aria-label="관리자 요청"><div class="sec-h"><h2>관리자 요청 '+L.length+'건</h2><span>처리한 것은 결과 남기기에서 직접 골라 닫습니다</span></div><div class="mq-list">'
   +L.slice(0,6).map(r=>'<button type="button" class="mq-row'+(overdue(r)?' late':'')+'" data-mq="open" data-id="'+attr(r.id)+'"><small>'+h(labelOf(r))+(r.round>=2?' · 재확인 '+r.round+'회차':'')+'</small><b>'+h(r.site||'')+'</b><span>'+h((r.requested_by||'관리자')+' · 기한 '+dueTxt(r))+'</span>'+(r.memo?'<em>'+h(String(r.memo).slice(0,80))+'</em>':'')+'</button>').join('')+'</div></section>';
 }
 function decorate(body){
  if(!enabled()||!body||body.querySelector('.mq'))return;
  load();const h0=html();if(!h0)return;
  const el=root.document.createElement('div');el.innerHTML=h0;const head=body.querySelector(':scope>.mt-head');if(head)head.after(el.firstElementChild);else body.prepend(el.firstElementChild);
 }
 function open(id){
  const r=S.list.find(x=>x.id===id);if(!r)return;markSeen(r);const G=root.G;
  if(r.target_type==='deal'){const d=(root.DEALS||[]).find(x=>String(x.id)===String(r.target_id));if(d){G.deal=d.id;G.sub=null;return root.render();}}
  if(r.target_type==='inquiry'){const q=((root.ADMIN&&root.ADMIN.inquiries)||[]).find(x=>String(x.id||x.key)===String(r.target_id)||String(x.key)===String(r.target_id));if(q){G.sub={t:'inqAssigned',key:q.key};G.deal=null;return root.render();}}
  if(typeof root.toast==='function')root.toast('이 현장을 지금 목록에서 찾지 못했습니다 — 새로 고침 뒤 다시 눌러 주세요');
 }
 root.document.addEventListener('click',e=>{const b=e.target.closest('#scr [data-mq]');if(!b||!enabled())return;if(b.dataset.mq==='open')open(b.dataset.id);});
 root.MobileRequests=Object.freeze({enabled,load,incoming,forDeal,isContact,labelOf,dueTxt,complete,decorate,html,state:()=>S,COND,KIND_LABEL,_put:put});
})(window);
