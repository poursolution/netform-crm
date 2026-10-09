/* 모바일 관리자 요청(2026-10-09) — PC(work-request.js)의 받는 사람 흐름을 모바일 '오늘'에 같은 규칙으로.
   새 요청 도착 → 화면 가운데 팝업(요청자 · 현장 · 해야 할 일 · 처리 기한만) → [응대 시작] / [확인 · 나중에 처리]
   → 확인 뒤에는 '오늘' 맨 위에 작은 '관리자 요청 · 미완료 n건' 카드(현장 · 할 일 · 기한 · 상태 · [처리하기]).
   [응대 시작] · [처리하기] = 처리 중(working) + 그 건의 결과 입력 화면(문의 = 첫 연락 화면 · 영업건 = 상세의 전화 · 결과 남기기)으로 이동.
   닫기(×) = 기록 없음 / 확인 = seen 만 / 응대 시작 = working / 완료 = 실제 결과 · 다음 할 일이 저장된 것을 보고 자동(done · 부재는 absent).
   서버 = PC 와 같은 crm_work_request_list_v1 · reply_v1(transport.js 허용 목록). 접속 중이면 2분마다 · 화면 복귀 때 다시 읽는다.
   '과거 자료 재개' 묶음(예전 시스템 이관 자료)은 PC 에서만 — 모바일 팝업 · 카드에 넣지 않는다. 끄기: G.mobileRequestOff=true */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const RPC={list:'crm_work_request_list_v1',reply:'crm_work_request_reply_v1'},LEGACY='과거 자료 재개';
 const S=()=>{const G=root.G||(root.G={});return G.mreq||(G.mreq={list:[],at:0,loaded:false,busy:false,pop:null,popSeen:{},closing:{},use:null});};
 /* 검사용: use({rpc}) 로 서버를 바꿔 끼운다. 실서비스는 Phase1.rpc(함수 인자는 PC OpsStore 와 같이 {p:…}) */
 const rpc=(name,p)=>{const u=S().use;if(u&&typeof u.rpc==='function')return Promise.resolve(u.rpc(name,p||{}));return root.Phase1.rpc(name,{p:p||{}});};
 const on=()=>{try{const G=root.G||{};if(G.mobileRequestOff||!G.user)return false;if(S().use)return true;return !!(root.LIVE&&!root.DEMO&&root.Phase1&&typeof root.Phase1.rpc==='function');}catch(e){return false;}};
 const toast=m=>{try{if(typeof root.toast==='function')root.toast(m);}catch(e){}};
 const pad=n=>String(n).padStart(2,'0'),day=v=>String(v||'').slice(0,10);
 function whenTxt(v){const t=new Date(v);if(!Number.isFinite(t.getTime()))return '';const n=new Date(),d0=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),diff=Math.round((d0(n)-d0(t))/864e5);return (diff===0?'오늘 ':diff===1?'어제 ':(t.getMonth()+1)+'/'+t.getDate()+' ')+pad(t.getHours())+':'+pad(t.getMinutes());}
 const isOpen=r=>r.status==='sent'||r.status==='seen'||r.status==='working';
 const overdue=r=>isOpen(r)&&Date.parse(r.due_at)<Date.now();
 const put=r=>{if(!r||!r.id)return;const st=S(),i=st.list.findIndex(x=>x.id===r.id);if(i>=0)st.list[i]=r;else st.list.unshift(r);};
 /* 내게 온 열린 요청(묶음 제외) · 기한 빠른 순 */
 const incoming=()=>S().list.filter(r=>r.to_me&&isOpen(r)&&r.label!==LEGACY).sort((a,b)=>String(a.due_at).localeCompare(String(b.due_at)));
 const popable=r=>r.status==='sent';
 /* ── 문구(PC 와 같은 말) ── */
 const LABEL={branch:'지사 확인 요청',first:'첫 연락 요청',quote:'견적 진행 확인',follow:'후속 연락 요청',award:'낙찰결과 확인 요청',contract:'계약정보 입력 요청',handover:'재배정 인계',support:'지원처리 확인',deadline:'마감 준비 확인'};
 const SHORT={first:'고객 연락',follow:'후속 연락',quote:'견적 등록',award:'낙찰결과 등록',contract:'계약정보 입력',handover:'인수 확인',support:'지원처리 확인',deadline:'마감 준비',branch:'본사 회신'};
 const TODO={first:'고객에게 연락한 뒤 통화 결과와 다음 일정을 등록해주세요.',follow:'고객에게 후속 연락한 뒤 고객 반응과 다음 일정을 등록해주세요.',quote:'견적 요청과 견적 예정일을 등록해주세요.',award:'낙찰사 · 낙찰금액 · 증빙을 등록해주세요.',contract:'계약일 · 계약금액 · 계약서를 등록해주세요.',handover:'인계 메모와 남은 할 일을 확인하고 [인수 확인]을 눌러주세요.',support:'처리 담당과 처리 예정일을 등록해주세요.',deadline:'제안 · 입찰 준비 상태와 제출일을 등록해주세요.',branch:'담당자를 지정하고 고객 첫 연락 진행 여부를 본사에 회신해주세요.'};
 const isHandover=r=>!!r&&(r.kind==='handover'||(r.kind==='support'&&r.label==='재배정 인계'));
 const eul=w=>{const c=String(w).charCodeAt(String(w).length-1);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28?'을':'를';};
 const askOf=r=>r.kind==='first'||r.kind==='follow'?'고객 응대':isHandover(r)?'재배정 인계':String(LABEL[r.kind]||r.label||'처리').replace(/\s*요청$/,'');
 const startLabel=r=>r.kind==='branch'?'회신하기':isHandover(r)?'인수 확인하기':r.kind==='first'||r.kind==='follow'?'응대 시작':'처리 시작';
 const shortOf=r=>isHandover(r)?SHORT.handover:SHORT[r.kind]||r.label||'처리';
 const dueTxt=r=>{const l=r.due_label||whenTxt(r.due_at);return r.kind==='branch'?'기한 '+l:l==='오늘 중'?'오늘까지':/안$/.test(l)?l:l+'까지';};
 function popText(r){const a=askOf(r);return {who:(r.requested_by||'관리자')+'님이 '+a+eul(a)+' 요청했습니다.',site:r.site||'',task:TODO[isHandover(r)?'handover':r.kind]||((r.asks||[]).join(' · ')||r.label||''),due:'처리 기한: '+(r.due_label||whenTxt(r.due_at))+(overdue(r)?' · 지남':''),start:startLabel(r)};}
 /* ── 읽기 ── */
 function load(force){
  if(!on())return;const st=S();if(st.busy||(!force&&Date.now()-st.at<60000))return;st.busy=true;
  rpc(RPC.list,{days:30}).then(r=>{st.list=r&&Array.isArray(r.requests)?r.requests:[];st.loaded=true;st.at=Date.now();try{popCheck();}catch(e){}paintTop();}).catch(()=>{st.at=Date.now();}).finally(()=>{st.busy=false;});
 }
 /* ── 팝업: 새로 온(아직 안 보여 준) 확인 전 요청 ── */
 function popModel(){const st=S();if(!st.pop)return null;const L=st.pop.ids.map(id=>st.list.find(r=>r.id===id)).filter(r=>r&&r.to_me&&popable(r)&&r.label!==LEGACY);return L.length?L:null;}
 function popCheck(){const st=S(),fresh=incoming().filter(r=>popable(r)&&!st.popSeen[r.id]);if(!fresh.length){drawPop();return;}fresh.forEach(r=>{st.popSeen[r.id]=true;});st.pop={ids:(st.pop?st.pop.ids:[]).concat(fresh.map(r=>r.id))};drawPop();}
 function drawPop(){
  if(typeof document==='undefined'||typeof document.createElement!=='function')return;const st=S(),L=popModel();let ov=document.getElementById('mrq-pop');
  if(!L){if(st.pop)st.pop=null;if(ov)ov.remove();return;}
  if(!ov){ov=document.createElement('div');ov.id='mrq-pop';ov.className='mrq-shade';document.body.append(ov);ov.addEventListener('click',e=>{if(e.target===ov)popClose();});}
  const one=L.length===1,ft='<span>확인 = 받았다는 표시만 · 결과와 다음 할 일을 저장해야 완료</span>';
  const item=r=>{const t=popText(r);return '<article class="mrq-item" data-id="'+attr(r.id)+'"><p class="who">'+h(t.who)+'</p><b class="site">'+h(t.site)+'</b><p class="task">'+h(t.task)+'</p><p class="due'+(overdue(r)?' od':'')+'">'+h(t.due)+'</p>'+(one?'':'<div class="bt"><button type="button" class="go" data-mrq="start" data-id="'+attr(r.id)+'">'+h(t.start)+'</button><button type="button" data-mrq="ack" data-id="'+attr(r.id)+'">확인 · 나중에 처리</button></div>')+'</article>';};
  ov.innerHTML='<section class="mrq-pop" role="dialog" aria-modal="true" aria-label="새 요청"><header><b>'+(one?'새 요청':'새 요청 '+L.length+'건')+'</b><button type="button" class="x" data-mrq="close" aria-label="닫기">×</button></header><div class="mrq-body">'+L.map(item).join('')+'</div>'
   +'<footer>'+ft+(one?'<div class="bt"><button type="button" class="go" data-mrq="start" data-id="'+attr(L[0].id)+'">'+h(popText(L[0]).start)+'</button><button type="button" data-mrq="ack" data-id="'+attr(L[0].id)+'">확인 · 나중에 처리</button></div>':'<div class="bt"><button type="button" data-mrq="ackall">모두 확인 · 나중에 처리</button></div>')+'</footer></section>';
 }
 /* [확인 · 나중에 처리] = 수신 확인(seen)만 · 요청은 미완료로 남는다 */
 function ack(ids){const st=S();(ids||[]).forEach(id=>{const r=st.list.find(x=>x.id===id);if(st.pop)st.pop.ids=st.pop.ids.filter(x=>x!==id);if(!r||r.status!=='sent'||st.closing['seen:'+id])return;st.closing['seen:'+id]=true;
   rpc(RPC.reply,{id,action:'seen'}).then(x=>put(x&&x.request)).catch(()=>{}).finally(()=>{delete st.closing['seen:'+id];drawPop();paintTop();});});drawPop();paintTop();}
 const ackAll=()=>ack((popModel()||[]).map(r=>r.id));
 /* 닫기(×) = 아무것도 기록하지 않는다 · 카드에 '확인 전' + [새 요청 보기] */
 function popClose(){const st=S();st.pop=null;drawPop();paintTop();}
 function popShow(){const st=S(),ids=incoming().filter(popable).map(r=>r.id);if(!ids.length)return;ids.forEach(id=>{st.popSeen[id]=true;});st.pop={ids};drawPop();}
 /* ── 대상 찾기(이 폰에 내려온 자료) ── */
 const norm=v=>String(v||'').replace(/[^0-9a-z]/gi,'').toLowerCase();
 const findDeal=id=>(root.DEALS||[]).find(d=>String(d.id)===String(id))||null;
 const findInq=id=>((root.ADMIN&&root.ADMIN.inquiries)||[]).find(q=>norm(q.key)===norm(id)||norm(q.raw&&(q.raw.id||q.raw.inquiry_id))===norm(id))||null;
 function openTarget(r){
  const G=root.G;
  if(r.target_type==='inquiry'){const q=findInq(r.target_id);if(!q){toast('이 문의를 지금 자료에서 찾지 못했습니다 — 새로고침 뒤 다시 눌러 주세요');return false;}G.deal=null;G.tab='today';G.sub={t:'inqAssigned',key:q.key};root.render();return true;}
  const d=findDeal(r.target_id);if(!d){toast('이 현장을 지금 자료에서 찾지 못했습니다 — 새로고침 뒤 다시 눌러 주세요');return false;}
  G.sub=null;G.tab='mine';G.deal=d.id;root.render();return true;
 }
 /* [응대 시작] · [처리하기] = 처리 중(working) + 결과 입력 화면으로 */
 function start(id){const st=S(),r=st.list.find(x=>x.id===id);if(!r)return;st.pop=null;drawPop();
  if((r.status==='sent'||r.status==='seen')&&!st.closing['work:'+id]){st.closing['work:'+id]=true;rpc(RPC.reply,{id,action:'working'}).then(x=>put(x&&x.request)).catch(()=>{}).finally(()=>{delete st.closing['work:'+id];paintTop();});}
  openTarget(r);}
 /* ── 실제 기록으로 자동 완료(PC autoClose 와 같은 뜻): 요청 뒤 저장된 연락 결과 · 다음 할 일이 보이면 done(부재 = absent) ── */
 const absentLike=s=>/부재|안 받|못 받/.test(String(s||''));/* 모바일 문구: '전화 안 받음' · '못 받음' · '부재중' */
 function evidence(r){
  if(r.kind!=='first'&&r.kind!=='follow')return null;const since=Date.parse(r.created_at)||0,G=root.G||{};
  if(r.target_type==='deal'){const d=findDeal(r.target_id);if(!d)return null;
   const acts=(d.activities||[]).filter(a=>{const t=Date.parse(a.occurred_at||a.at||a.created_at||'');return Number.isFinite(t)&&t>=since&&/전화|통화|부재|방문|문자/.test(String(a.type||'')+String(a.note||''));});
   const nx=d.nextAction&&d.nextAction.status!=='done'?d.nextAction:null,next={next_text:nx?String(nx.text||''):'',next_due:nx?day(nx.due_at||nx.due):''};
   const real=acts.find(a=>!absentLike(String(a.type||'')+String(a.note||''))),abs=acts.find(a=>absentLike(String(a.type||'')+String(a.note||'')));
   if(real)return Object.assign({result:'응대 기록 확인',absent:false},next);
   if(abs)return Object.assign({result:'부재',absent:true},next);
   const ct=Date.parse(d.contactAt||d.last_customer_contact_at||'');if(Number.isFinite(ct)&&ct>=since)return Object.assign({result:'응대 기록 확인',absent:false},next);
   return null;}
  const q=findInq(r.target_id);if(!q)return null;const raw=q.raw||{},at=Date.parse(raw.responded_at||raw.respondedAt||raw.first_response_at||'');
  const dk='k:'+q.key+'|'+new Date().toISOString().slice(0,10),label=G.done&&G.done[dk];
  if(typeof label==='string'&&label)return {result:absentLike(label)?'부재':'연락 기록 확인',absent:absentLike(label)};
  if(Number.isFinite(at)&&at>=since)return {result:/배정완료/.test(String(q.status||''))?'부재':'연락 기록 확인',absent:/배정완료/.test(String(q.status||''))};
  return null;
 }
 function autoClose(){
  const st=S();if(!st.loaded)return;
  incoming().filter(r=>!st.closing[r.id]).forEach(r=>{const ev=evidence(r);if(!ev)return;st.closing[r.id]=true;
   rpc(RPC.reply,Object.assign({id:r.id,action:'done',auto:true},ev)).then(x=>{put(x&&x.request);toast(ev.absent?'연락 시도로 기록했습니다 · 관리자 요청 처리(부재)':'관리자 요청이 자동 완료됐습니다');}).catch(()=>{}).finally(()=>{delete st.closing[r.id];paintTop();});});
 }
 /* ── '오늘' 맨 위 작은 카드 ── */
 function topHtml(){
  const L=incoming();if(!L.length)return '';const unseen=L.filter(popable).length,allBr=L.every(r=>r.kind==='branch');
  const row=r=>{const od=overdue(r),stt=r.status==='working'?['응대 중','wk']:r.status==='sent'?['확인 전','nw']:['확인함',''];
   return '<div class="mrq-row'+(od?' od':'')+'" data-id="'+attr(r.id)+'"><div class="l"><b>'+h(r.site)+'</b><span>'+h(shortOf(r)+' · '+dueTxt(r))+(od?'<em>기한 지남</em>':'')+'</span></div><span class="st '+stt[1]+'">'+h(stt[0])+'</span><button type="button" class="go" data-mrq="start" data-id="'+attr(r.id)+'">처리하기</button></div>';};
  return '<div class="hd"><em>'+(allBr?'본사 확인 요청':'관리자 요청')+'</em><b>미완료 '+L.length+'건</b>'+(unseen?'<span class="new">확인 전 '+unseen+'건</span><button type="button" data-mrq="show">새 요청 보기</button>':'')+'</div>'+L.map(row).join('')+'<p class="ft">확인 = 받았다는 표시만 · 결과와 다음 할 일을 저장해야 완료</p>';
 }
 function paintTop(){
  if(typeof document==='undefined'||typeof document.getElementById!=='function')return;const G=root.G||{},scr=document.getElementById('scr'),body=scr&&scr.querySelector?scr.querySelector('.body'):null;
  let el=body?body.querySelector('.mrq-top'):null;
  const show=on()&&body&&G.user&&G.tab==='today'&&G.deal==null&&!G.sub;
  if(!show){if(el)el.remove();try{autoClose();}catch(e){}return;}
  const html=topHtml();if(!html){if(el)el.remove();try{autoClose();}catch(e){}return;}
  if(!el){el=document.createElement('section');el.className='mrq-top';el.setAttribute('aria-label','받은 요청');const head=body.querySelector('.mt-head');if(head)head.after(el);else body.prepend(el);}
  if(el.innerHTML!==html)el.innerHTML=html;
  try{autoClose();}catch(e){}
 }
 /* ── 누르기 ── */
 function onClick(e){
  const b=e.target&&e.target.closest?e.target.closest('[data-mrq]'):null;if(!b||b.disabled)return;e.preventDefault();e.stopPropagation();
  const a=b.dataset.mrq,id=b.dataset.id;
  if(a==='close')return popClose();if(a==='ackall')return ackAll();if(a==='ack')return ack([id]);if(a==='show')return popShow();if(a==='start')return start(id);
 }
 const poll=()=>{try{if(on()&&S().loaded&&(typeof document==='undefined'||typeof document.visibilityState!=='string'||document.visibilityState==='visible'))load();}catch(e){}};
 function boot(){
  if(typeof document!=='undefined'&&document.addEventListener){document.addEventListener('click',onClick,true);document.addEventListener('visibilitychange',poll);}
  if(typeof setInterval==='function')setInterval(poll,120000);
  const base=root.render;if(typeof base==='function')root.render=function(){const r=base.apply(this,arguments);try{paintTop();load();}catch(e){}return r;};
 }
 boot();
 root.MobileRequest={on,load,incoming,popCheck,popModel,popText,ack,ackAll,popClose,popShow,start,evidence,autoClose,topHtml,paintTop,use:u=>{S().use=u||null;},RPC,state:S};
})(window);
