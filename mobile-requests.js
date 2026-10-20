/* 모바일 관리자 요청 (2026-10-10 대표 승인 · design_handoff_mobile_all 1번 '관리자 요청' · 3번 '요청 자동 완료 금지 — 지정한 요청 + 조건')
   PC 와 같은 서버 함수(crm_work_request_list_v1 · crm_work_request_reply_v1)를 모바일 허용 목록(transport.js)에 넣어 쓴다. 서버가 받는 사람 · 권한을 그대로 검사한다.
   · 오늘: 내게 온 열린 요청을 맨 위에(종류 · 현장 · 요청자 · 기한). 누르면 담당 확인(seen) + 그 현장 상세.
   · 결과 남기기(mobile-entry.js): 이 현장의 열린 요청 가운데 '이 기록으로 처리한 것'을 직접 고른 것만 닫는다 — 자동 완료 없음.
     단일 '고객 첫 연락' 요청만 모바일에서 닫는다(완료 조건: 실제 연결 · 결과 기록 · 다음 행동 + 날짜). 부재 · 번호 오류는 요청이 '진행 중'으로 남는다. 복합·후속·그 밖의 요청(견적 · 계약 · 낙찰 · 인계 · 지사 …)은 PC 에서 처리.
   서버에 아직 없으면(함수 없음) 조용히 꺼진다. 끄기: G.mobileReqOff=true */
(function(root){
 'use strict';
 const LIST='crm_work_request_list_v1',REPLY='crm_work_request_reply_v1';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const OPEN=['sent','seen','working'],isOpen=r=>!!r&&OPEN.includes(r.status);
 const CONTACT_KINDS=['first','follow'];
 const KIND_LABEL={first:'첫 연락 요청',follow:'후속 연락 요청',quote:'견적 진행 확인',award:'낙찰결과 확인 요청',contract:'계약정보 입력 요청',handover:'재배정 인계',support:'지원처리 확인',deadline:'마감 준비 확인',branch:'지사 확인 요청'};
 const COND=['실제 고객 연결','통화 결과 기록','다음 행동 + 날짜 등록'];
 const WD='일월화수목금토',pad=n=>String(n).padStart(2,'0');
 const S={list:[],at:0,loaded:false,busy:false,off:false,seen:{}};
 const identity=()=>{const p=root.Phase1?.profile;return p?.auth_uid&&p?.user_id?p.auth_uid+':'+p.user_id:'';};
 let cacheOwner=identity(),epoch=0,revision=0;
 function reset(owner){cacheOwner=owner;epoch++;revision=0;Object.assign(S,{list:[],at:0,loaded:false,busy:false,off:false,seen:{}});}
 function syncOwner(){const owner=identity();if(owner!==cacheOwner)reset(owner);return owner;}
 function currentSession(owner,generation){return syncOwner()===owner&&!!owner&&epoch===generation;}
 const enabled=()=>{syncOwner();return !(root.G&&(root.G.mobileReqOff||root.G.mobileV2Off))&&!S.off;};
 const ready=()=>!!(root.Phase1&&typeof root.Phase1.rpc==='function'&&identity());
 const rpc=(name,body)=>root.Phase1.rpc(name,{p:body});
 const labelOf=r=>String(r&&(r.label||KIND_LABEL[r.kind])||'관리자 요청');
 // A call cannot resolve visit/quote checks or prove receipt of a document.
 const isContact=r=>!!r&&r.target_type==='deal'&&r.kind==='first'&&r.label==='첫 연락 요청'&&Array.isArray(r.asks)&&r.asks.length===1&&r.asks[0]==='고객 첫 연락';
 const incoming=()=>{syncOwner();return S.list.filter(r=>r.to_me&&isOpen(r)).sort((a,b)=>String(a.due_at).localeCompare(String(b.due_at)));};
 const forDeal=id=>incoming().filter(r=>r.target_type==='deal'&&String(r.target_id)===String(id));
 /* 기한: 절대 날짜 · 요일 · 시각 + 남은 시간(PC dueTxt 와 같은 문장) */
 function dueTxt(r){const t=new Date(r&&r.due_at||'');if(!Number.isFinite(t.getTime()))return r&&r.due_label||'';const left=t.getTime()-Date.now(),hrs=Math.round(Math.abs(left)/36e5),rel=left>=0?(hrs<1?'1시간 안':hrs<48?hrs+'시간 남음':Math.round(hrs/24)+'일 남음'):(hrs<1?'방금 지남':hrs<48?hrs+'시간 지남':Math.round(hrs/24)+'일 지남');return (t.getMonth()+1)+'.'+t.getDate()+' ('+WD[t.getDay()]+') '+pad(t.getHours())+':'+pad(t.getMinutes())+' · '+rel;}
 const overdue=r=>Date.parse(r&&r.due_at)<Date.now();
 const put=r=>{syncOwner();if(!r||!r.id)return;revision++;const i=S.list.findIndex(x=>x.id===r.id);if(i>=0)S.list[i]=r;else S.list.unshift(r);};
 /* six_fixes ③: PC 에서 요청을 처리 · 보내면 서버 신호(work_requests)로 바로 다시 읽는다 */
 if(root.addEventListener)root.addEventListener('crm:realtime-signal',e=>{try{if(e.detail&&e.detail.table==='work_requests')Promise.resolve(load(true)).then(()=>{try{root.render&&root.render();}catch(x){}}).catch(()=>{});}catch(x){}});
 async function load(force){
  if(!enabled()||!ready()||S.busy)return;if(!force&&Date.now()-S.at<60000)return;
  const owner=syncOwner(),generation=epoch,startedRevision=revision;S.busy=true;
  try{
   const r=await rpc(LIST,{days:30});if(!currentSession(owner,generation))return;
   if(startedRevision!==revision){S.at=0;return;}
   if(!r||r.ok!==true||!Array.isArray(r.requests))throw Error('Invalid request list acknowledgement');
   const before=JSON.stringify(S.list);revision++;S.list=r.requests;S.loaded=true;S.at=Date.now();
   if(before!==JSON.stringify(S.list))repaint();
  }catch(e){if(currentSession(owner,generation)){S.at=Date.now();if(e&&(e.code==='PGRST202'||/CONTRACT_UNAVAILABLE|PHASE1_RPC_DENIED|Could not find the function/i.test(String(e.message||''))))S.off=true;}}
  finally{if(currentSession(owner,generation))S.busy=false;}
 }
 function repaint(){try{const G=root.G;if(G&&G.user&&!G.deal&&!G.sub&&G.tab==='today'&&G.mode==='rep')root.render();}catch(e){}}
 /* 받은 사람이 눌러 보면 그때 '담당 확인'(seen) — 화면 노출은 확인이 아니다(PC 와 같다) */
 function markSeen(r){
  const owner=syncOwner(),generation=epoch,startedRevision=revision;
  if(!owner||!r||!r.to_me||r.status!=='sent'||S.seen[r.id])return;S.seen[r.id]=true;
  return rpc(REPLY,{id:r.id,action:'seen'}).then(x=>{
   if(!currentSession(owner,generation))return;
   if(startedRevision!==revision){delete S.seen[r.id];S.at=0;return;}
   const next=x?.request;
   if(x?.ok!==true||!next||next.id!==r.id||next.target_type!==r.target_type||next.target_id!==r.target_id||next.to_me!==true||
     next.kind!==r.kind||Number(next.round||1)!==Number(r.round||1)||String(next.due_at||'')!==String(r.due_at||'')||
     !['seen','working','done','cancelled'].includes(next.status))throw Error('Invalid seen acknowledgement');
   put(next);return true;
  }).catch(()=>{if(currentSession(owner,generation))delete S.seen[r.id];return false;});
 }
 // Only the request explicitly identified on the approved task card is acknowledged.
 async function acknowledge(id,targetType,targetId){
  if(!enabled()||!ready())return false;
  const r=incoming().find(x=>String(x.id)===String(id)&&x.target_type===targetType&&String(x.target_id)===String(targetId));
  if(!r)return false;
  if(r.status!=='sent')return true;
  return await markSeen(r)===true;
 }
 /* 이 기록으로 처리한 요청 닫기(지정한 것만): 연락 기록 저장이 서버에 확인된 뒤에 부른다. result = 연락 결과, absent = 연락 시도(진행 중으로 남김) */
 /* 영업건 요청 항목별 처리(2026-10-20 · crm_work_request_deal_contact_v1): 첫 연락 · 후속 연락 요청을 이번 응대 기록 근거로 처리.
    부재 = 진행 중 · '연락 시도 n회 · 미연결', 일부 확인 = 진행 중 · '일부 처리 k/m', 전부 + 다음 행동 · 날짜 = 완료 — 판정은 서버가 한다. 서버에 아직 없으면 꺼지고 예전 complete 로 */
 const ITEM_RPC='crm_work_request_deal_contact_v1';
 const itemReady=()=>enabled()&&ready()&&!S.itemOff&&root.CRMRelease?.listed?.(ITEM_RPC)!==false;
 const itemized=r=>!!r&&r.target_type==='deal'&&['first','follow'].includes(r.kind)&&Array.isArray(r.asks)&&r.to_me===true&&isOpen(r);
 async function completeItems(r,o){
  if(!itemized(r)||!itemReady())throw Error('이 요청은 PC 에서 처리합니다.');
  const owner=syncOwner(),generation=epoch,proof=o.activity,profile=root.Phase1.profile;
  if(!proof||proof.ok!==true||proof.operation!=='activity'||proof.object_id!==r.target_id||!proof.activity_id||proof.actor_auth_uid!==profile.auth_uid||proof.actor_user_id!==profile.user_id)throw Error('이 영업건의 서버 응대 기록을 먼저 확인해 주세요.');
  const body={id:r.id,operation_id:o.operation_id,activity_id:proof.activity_id,result:String(o.result||''),confirmed:Array.isArray(o.confirmed)?o.confirmed.map(String):[]};
  if(o.next_text&&/^\d{4}-\d{2}-\d{2}$/.test(String(o.next_due||''))){body.next_text=String(o.next_text).slice(0,200);body.next_due=String(o.next_due);}
  let x;try{x=await rpc(ITEM_RPC,body);}catch(e){if(e&&(e.code==='PGRST202'||/Could not find the function|CONTRACT_UNAVAILABLE|PHASE1_RPC_DENIED/i.test(String(e.message||''))))S.itemOff=true;throw e;}
  if(!currentSession(owner,generation))throw Error('계정이 바뀌었습니다. 저장된 응대는 유지하고 요청 처리를 다시 확인해 주세요.');
  if(!x||x.ok!==true||x.request_id!==r.id||!x.request||x.request.id!==r.id)throw Error('요청 처리 결과를 확인하지 못했습니다. 응대 기록은 유지됩니다.');
  put(x.request);return x;
 }
 /* 모바일 v5 오늘 · 팀: 보낸 요청 다시 요청(PC WorkRequest.reask 와 같은 서버 함수 · 관리자만 · 기한 지난 열린 요청만 — 서버가 다시 확인) */
 async function reask(id,due){
  if(!enabled()||!ready())throw Error('요청 연결을 확인해 주세요.');const owner=syncOwner(),generation=epoch;
  const r=S.list.find(x=>x.id===id);if(!r||!r.by_me||!isOpen(r)||!(Date.parse(r.due_at)<Date.now()))throw Error('기한이 지난 열린 요청만 다시 요청할 수 있습니다.');
  if(r.status==='working')throw Error('고객 답을 기다리는 요청은 다시 요청하지 않습니다.');
  const x=await rpc('crm_work_request_reask_v1',{id,due_at:due.due_at,due_label:due.due_label});
  if(!currentSession(owner,generation))throw Error('계정이 바뀌었습니다.');
  if(!x||x.ok!==true||!x.request||x.request.id!==id)throw Error('다시 요청 결과를 확인하지 못했습니다.');
  put(x.request);return x.request;
 }
 async function complete(r,o){
  if(!r||!isContact(r)||r.to_me!==true||!ready())throw Error('이 요청은 PC 에서 처리합니다.');
  const owner=syncOwner(),generation=epoch,checkOwner=()=>{if(!currentSession(owner,generation))throw Error('계정이 바뀌었습니다. 저장된 응대는 유지하고 요청 처리를 다시 확인해 주세요.');};
  checkOwner();
  const proof=o.activity,profile=root.Phase1.profile;
  if(!proof||proof.ok!==true||proof.operation!=='activity'||proof.object_id!==r.target_id||!proof.activity_id||proof.actor_auth_uid!==profile.auth_uid||proof.actor_user_id!==profile.user_id)throw Error('이 영업건의 서버 응대 기록을 먼저 확인해 주세요.');
  const absent=['부재','번호 오류'].includes(o.result);
  if(absent!==!!o.absent||(!absent&&!['연결됨','회신 받음'].includes(o.result)))throw Error('연락 결과와 요청 처리 조건을 확인해 주세요.');
  if(proof.meaningful_contact!==!absent)throw Error('서버 연락 기록의 실제 연결 판정을 확인해 주세요.');
  const body=absent?{id:r.id,action:'working'}:{id:r.id,action:'done',result:String(o.result||''),next_text:String(o.next_text||'').trim(),next_due:String(o.next_due||'')};
  if(!absent&&(!body.next_text||!/^\d{4}-\d{2}-\d{2}$/.test(body.next_due)))throw Error('완료할 요청의 다음 행동과 날짜를 확인해 주세요.');
  function same(x){return x&&x.id===r.id&&x.target_type==='deal'&&x.target_id===r.target_id&&x.to_me===true&&isContact(x)&&Number(x.round||1)===Number(r.round||1)&&String(x.due_at||'')===String(r.due_at||'');}
  function confirmed(x){return same(x)&&(absent?x.status==='working'&&x.open===true&&!x.closed_at:x.status==='done'&&x.open===false&&!!x.closed_at&&x.result===body.result&&x.next_text===body.next_text&&x.next_due===body.next_due);}
  // Reconcile first: the prior response may have been lost after the request changed.
  const listed=await rpc(LIST,{target_type:'deal',target_id:r.target_id,days:30});checkOwner();
  if(listed?.ok!==true||!Array.isArray(listed.requests))throw Error('현재 요청 상태를 확인하지 못했습니다.');
  const matches=listed.requests.filter(x=>x.id===r.id),current=matches[0];
  if(matches.length!==1||!same(current))throw Error('요청 담당자·영업건·확인 항목 또는 기한이 바뀌었습니다. PC에서 확인해 주세요.');
  if(confirmed(current)){put(current);return current;}
  if(!isOpen(current))throw Error('요청이 다른 결과로 종료됐습니다. 응대 기록은 유지하고 요청을 확인해 주세요.');
  const x=await rpc(REPLY,body);checkOwner();
  if(x?.ok!==true||!confirmed(x.request))throw Error('요청 처리 결과를 확인하지 못했습니다. 응대 기록은 유지됩니다.');
  put(x.request);return x.request;
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
  syncOwner();
  const r=S.list.find(x=>x.id===id);if(!r)return;markSeen(r);const G=root.G;
  if(r.target_type==='deal'){const d=(root.DEALS||[]).find(x=>String(x.id)===String(r.target_id));if(d){G.deal=d.id;G.sub=null;return root.render();}}
  if(r.target_type==='inquiry'){const q=((root.ADMIN&&root.ADMIN.inquiries)||[]).find(x=>String(x.id||x.key)===String(r.target_id)||String(x.key)===String(r.target_id));if(q){G.sub={t:'inqAssigned',key:q.key};G.deal=null;return root.render();}}
  if(typeof root.toast==='function')root.toast('이 현장을 지금 목록에서 찾지 못했습니다 — 새로 고침 뒤 다시 눌러 주세요');
 }
 root.document.addEventListener('click',e=>{const b=e.target.closest('#scr [data-mq]');if(!b||!enabled())return;if(b.dataset.mq==='open')open(b.dataset.id);});
 root.addEventListener?.('phase1:identity-cleared',()=>reset(''));
 root.addEventListener?.('phase1:profile',syncOwner);
 root.MobileRequests=Object.freeze({enabled,load,incoming,forDeal,isContact,labelOf,dueTxt,complete,acknowledge,decorate,html,state:()=>{syncOwner();return S;},COND,KIND_LABEL,_put:put,itemReady,itemized,completeItems,reask});
})(window);
