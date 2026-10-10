/* 요청 업무 — '독촉' 대신 요청 (2026-10-05 디자인 핸드오프 'design_handoff_request' · 요청 업무 · 지사 확인.dc.html)
   오늘 업무(영업관리 · 팀장 · 대표)의 [독촉]을 상황별 요청 이름으로 바꾸고, 누르면 상세가 아니라 작은 요청 창 → 보내면 목록에서 빠지고 오른쪽 '답 기다리는 중'으로.
   받는 사람 오늘 업무 맨 위에 빨간 '관리자 요청'(영업사원 — [전화] → 통화 결과 → 다음 행동 → [저장] = 요청 자동 완료 · 따로 완료 버튼 없음) /
   '본사 확인 요청'(지사 — 결과 하나 고르고 [본사에 회신])이 뜬다. 요청 · 회신은 그 현장 응대 이력에 '시스템 · 내부 요청'으로 남는다.
   규칙: 답을 기다리는 동안 같은 건 · 같은 요청 잠금(서버 유일 색인) · 기한 초과 = '요청 미이행' + [재확인 요청] · 2회 미이행 = '재배정 검토 권장' + [재배정 검토] · 지사 건 = [본사 회수 검토].
   부재는 연락 시도로만 남는다(기록은 기존 저장 길 — 문의 InquiryListV3.record · 영업건 DealDetailV3.record 가 시도 / 접촉을 가른다). 이 모듈은 최초 응대 시각을 찍지 않는다.
   저장소 = crm_security.work_requests(함수 crm_work_request_create/list/reply/reask_v1 · sql/work-request-v1-20261005.sql). 서버에 아직 없으면 예전 [독촉] 그대로.
   받는 사람에게 잔디 메시지를 같이 보낼지는 아직 정해지지 않아 보내지 않는다(CRM 안에서만). 끄기: G.workRequestOff=true */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const LEGACY_LABEL='과거 자료 재개';/* 과거 이관 · 분류 전 화면이 보내는 묶음 요청(pipeline-legacy.js) — 받는 쪽에서는 한 카드로 */
 const RPC={contact:'crm_work_request_inquiry_contact_v1',handover:'crm_work_request_handover_v1',create:'crm_work_request_create_v1',list:'crm_work_request_list_v1',reply:'crm_work_request_reply_v1',reask:'crm_work_request_reask_v1'};
 const O=()=>R.OpsStore,T=()=>R.TodayWorkQueue;
 const ready=()=>{try{return !R.G.workRequestOff&&!!O()&&O().has(RPC.list)&&O().has(RPC.create)&&O().has(RPC.reply);}catch(e){return false;}};
 /* 저장소가 실제로 한 번 응답한 뒤에만 켠다 — 서버에 아직 없으면(SQL 적용 전) 예전 [독촉] 화면 그대로 */
 const enabled=()=>{if(!ready())return false;const S=st();if(!S.loaded){load();return false;}return true;};
 const st=()=>R.G.workReq||(R.G.workReq={list:[],at:0,busy:false,loaded:false,modal:null,card:{},closing:{},seen:{}});
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const rep=v=>{try{return R.repN(v)||'';}catch(e){return String(v||'').trim();}};
 const meName=()=>rep(R.ME&&R.ME.name);
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const pad=n=>String(n).padStart(2,'0');
 /* 상황별 버튼 이름 · 요청 내용(README 표). deadline(입찰 · 결정 마감 준비)은 표에 없던 기존 [독촉] 상황이라 같은 틀로 이름만 붙였다 */
 const KIND={
  branch:{label:'지사 확인 요청',asks:['실담당 지정 확인','고객 첫 연락 진행 확인','영업 진행 여부 확인','본사 회수 검토'],def:[1,1,0,0],done:'지사 회신(담당 지정 · 첫 연락 · 부재 · 보류 · 회수 요청)'},
  first:{label:'첫 연락 요청',asks:['고객 첫 연락','연락 후 견적 필요 여부 확인','현장방문 필요 여부 확인'],def:[1,0,0],done:'연락 기록 + 결과 + 다음 행동 · 날짜',contact:true},
  quote:{label:'견적 진행 확인',asks:['견적 요청 등록','견적 예정일 입력'],def:[1,1],done:'견적 요청 등록 + 예정일'},
  follow:{label:'후속 연락 요청',asks:['수신 확인','고객 반응 기록'],def:[1,1],done:'응대 기록 + 고객 반응',contact:true},
  award:{label:'낙찰결과 확인 요청',asks:['낙찰사 확인','낙찰금액 확인','증빙 등록'],def:[1,1,1],done:'낙찰사 · 금액 · 증빙'},
  contract:{label:'계약정보 입력 요청',asks:['계약일 입력','계약금액 입력','계약서 등록'],def:[1,1,0],done:'계약일 · 금액 · 계약서'},
  handover:{label:'재배정 인계',asks:['인계 메모 확인','남은 할 일 확인','인수 확인'],def:[1,1,1],done:'인수 확인'},
  support:{label:'지원처리 확인',asks:['처리 담당 확인','처리 예정일 확인'],def:[1,1],done:'처리 기록'},
  deadline:{label:'마감 준비 확인',asks:['제안 · 입찰 준비 상태 확인','제출일 확정'],def:[1,1],done:'준비 상태 + 제출일 기록'}};
 const RK={first:'first',quote:'quote',silent:'follow',stallbig:'follow',after:'follow',transfer:'award',contract:'contract',deadline:'deadline'};
 const BRANCH_TO='경남지사장',BRANCH_RES=['담당 지정 완료','고객 첫 연락 완료','연락 시도 · 부재','진행 보류','본사 회수 요청'];
 const DUE_IN=['오늘 17:00','오늘 중','직접 지정'],DUE_BR=['오늘 중','내일 12시','3일 안'];
 /* after_deploy ①: 밤(20시 이후) 요청의 기본 기한 = 다음 날 18:00 — 시안이 정한 값(운영 기준 확정 전 · 대표 확인 필요). 저장은 항상 절대 시각(due_at) */
 const NIGHT_FROM=20,NIGHT_HOUR=18,DUE_NIGHT=['내일 '+NIGHT_HOUR+':00','오늘 중','직접 지정'];
 const WD='일월화수목금토';
 /* 기한 표시 = 절대 날짜 · 요일 · 시각 + 남은 시간(다음 날 열어도 '오늘'로 옮겨가지 않는다) */
 function dueTxt(r){const t=new Date(r&&r.due_at||'');if(!Number.isFinite(t.getTime()))return r&&r.due_label||'';const left=t.getTime()-Date.now(),hrs=Math.round(Math.abs(left)/36e5),rel=left>=0?(hrs<1?'1시간 안':hrs<48?hrs+'시간 남음':Math.round(hrs/24)+'일 남음'):(hrs<1?'방금 지남':hrs<48?hrs+'시간 지남':Math.round(hrs/24)+'일 지남');return t.getFullYear()+'.'+(t.getMonth()+1)+'.'+t.getDate()+' ('+WD[t.getDay()]+') '+pad(t.getHours())+':'+pad(t.getMinutes())+' · '+rel;}
 /* 지사 건 기준(README): 7일 무응답 = 자동 확인 요청 · 14일 = 회수 검토 제안. 자동 요청은 한꺼번에 여러 건이 지사로 가므로 설정(OPS_RULES.workRequestBranchAuto=true)으로 켠다 — 기본은 꺼짐 */
 const RECALL_DAYS=()=>Number((R.OPS_RULES||{}).branchRecallDays)||14,SILENT_DAYS=()=>Number((R.OPS_RULES||{}).branchSilentDays)||7,BRANCH_AUTO=()=>(R.OPS_RULES||{}).workRequestBranchAuto===true;
 /* 통화 결과 → 다음 행동(규칙 · 기존 값): 문의는 견적문의 결과 마스터, 영업건은 상세의 다음 행동 표 */
 const NX_INQ={'연결됨':['다시 연락',3],'견적요청':['견적 준비',3],'검토중':['결과 확인',7],'부재':['다시 전화',1]};
 const nxOf=(type,res)=>{if(type==='inquiry')return NX_INQ[res]||null;const N=(R.DealDetailV3&&R.DealDetailV3.NXT)||{};return N[res]||NX_INQ[res]||null;};
 const resOf=type=>type==='inquiry'?['연결됨','견적요청','검토중','부재']:['연결됨','자료요청','검토중','부재'];
 const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return d;};
 const mdK=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?m[2]+'/'+m[3]:'';};
 function whenTxt(v){const t=new Date(v);if(!Number.isFinite(t.getTime()))return '';const n=new Date(),day=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),diff=Math.round((day(n)-day(t))/864e5),hm=pad(t.getHours())+':'+pad(t.getMinutes());return (diff===0?'오늘 ':diff===1?'어제 ':(t.getMonth()+1)+'/'+t.getDate()+' ')+hm;}
 function dueAt(label,custom){
  const d=new Date();
  if(label==='오늘 17:00'){d.setHours(17,0,0,0);return d;}
  if(label==='오늘 중'){d.setHours(23,59,0,0);return d;}
  if(label==='내일 12시'){d.setDate(d.getDate()+1);d.setHours(12,0,0,0);return d;}
  if(label==='3일 안'){d.setDate(d.getDate()+3);d.setHours(23,59,0,0);return d;}
  if(label==='내일 '+NIGHT_HOUR+':00'){d.setDate(d.getDate()+1);d.setHours(NIGHT_HOUR,0,0,0);return d;}
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(custom||''));if(!m)return null;return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),23,59,0,0);
 }
 /* ── 저장소 읽기 ── */
 function load(force){
  const S=st();if(!ready())return;if(S.busy){if(force)S.again=true;return;}if(!force&&Date.now()-S.at<60000)return;
  const gen=S.gen||0;S.again=false;
  S.busy=true;O().rpc(RPC.list,{days:30}).then(r=>{if((S.gen||0)!==gen){/* 조회 중에 저장이 있었다 — 이 응답은 그 전 상태라 버리고 다시 읽는다(코덱스 검수 F3) */S.at=Date.now();S.loaded=true;S.again=true;return;}const before=JSON.stringify(S.list),first=!S.loaded;S.list=Array.isArray(r.requests)?r.requests:[];S.loaded=true;S.at=Date.now();
   if(first||before!==JSON.stringify(S.list))repaint();setTimeout(autoClose,0);}).catch(()=>{S.at=Date.now();}).finally(()=>{S.busy=false;if(S.again){S.again=false;setTimeout(()=>load(true),0);}});
 }
 function repaint(){try{if(R.G.page==='today'||R.G.page==='mgmt'||document.getElementById('kpi-b'))R.paint();else if(document.getElementById('inq-inbox-dialog')&&R.InquiryDetailV2)R.InquiryDetailV2.reskin();}catch(e){}}
 const put=r=>{if(!r||!r.id)return;const S=st(),i=S.list.findIndex(x=>x.id===r.id);if(i>=0)S.list[i]=r;else S.list.unshift(r);S.gen=(S.gen||0)+1;/* 저장 세대(F3) */};
 const isOpen=r=>r.status==='sent'||r.status==='seen'||r.status==='working';
 const overdue=r=>isOpen(r)&&Date.parse(r.due_at)<Date.now();
 /* ── 오늘 업무 항목 → 요청 ── */
 const typeOf=i=>i.x.type==='inq'?'inquiry':i.x.type==='deal'?'deal':'';
 const isBranch=i=>{try{return i.x.type==='inq'&&R.itemOwnerTeam(i.x.item)==='gyeongnam';}catch(e){return false;}};
 // 지사 경과는 실제 배정일 기준. 접수일이나 마지막 연락일로 대신 추정하지 않는다.
 function branchDays(i){
  try{
   const at=R.inquiryAssignedAt(i.x.item);if(!at)return null;
   const days=R.gnDaysSince(at);return Number.isFinite(days)&&days>=0?days:null;
  }catch(e){return null;}
 }
 function reqFor(i,me){
  if(!enabled()||!i||!i.x||!i.x.item)return null;const type=typeOf(i);if(!type)return null;
  const br=isBranch(i),kind=br&&(i.rk==='first'||i.rk==='assign'||i.rk==='promise'||i.rk==='stall')?'branch':RK[i.rk];if(!kind)return null;
  const own=rep(i.x.owner)===(me||meName());
  if(own&&kind!=='branch')return {self:true,label:'직접 전화',why:'내 담당 · 요청 대상 없음 → 바로 전화'};
  const to=kind==='branch'?BRANCH_TO:rep(i.x.owner);if(!to||to==='미배정')return null;
  const K=KIND[kind],days=kind==='branch'?branchDays(i):null;
  return {kind,label:K.label,to,scope:kind==='branch'?'branch':'user',type,id:String(i.x.item.id||''),K,branchDays:days,recall:kind==='branch'&&days!==null&&days>=RECALL_DAYS(),why:kind==='branch'?(days!==null&&days>=RECALL_DAYS()?'넘긴 지 '+days+'일 · 본사 회수 검토 권장':'이관 후 담당 지정 · 첫 연락 여부를 회신받아야 합니다'):(i.loss?'놓치면 '+i.loss:K.done)};
 }
 const openFor=(type,id,kind)=>st().list.find(r=>r.target_type===type&&String(r.target_id)===String(id)&&r.kind===kind&&isOpen(r))||null;
 /* 답을 기다리는 건은 보낸 쪽 목록에서 뺀다(= 같은 요청 잠금) */
 function locked(i,me){const q=reqFor(i,me);return !!(q&&!q.self&&q.id&&openFor(q.type,q.id,q.kind));}
 /* 표 줄 · 카드가 쓰는 칸: AI 추천 요청 · 이유 / 버튼 */
 function cell(i,me){
  const q=reqFor(i,me);if(!q)return null;const k=attr(i.key);
  if(q.self)return {rc:'<b>'+h((rep(i.x.owner)||'나')+' · '+q.label)+'</b><small>'+h(q.why)+'</small>',btn:'<button type="button" class="go" data-t3="act" data-act="전화" data-key="'+k+'"'+(i.i&&i.i.digits?' data-tel="'+attr(i.i.digits)+'"':'')+'>'+q.label+'</button>',label:q.label,self:true};
  return {rc:'<b>'+h(q.to+' · '+q.label)+'</b><small>'+h(q.why)+'</small>',btn:'<button type="button" class="go" data-wr="ask" data-key="'+k+'">'+h(q.label)+'</button>',label:q.label,self:false};
 }
 /* ── 대상 찾기 ── */
 function target(r){
  if(r.target_type==='inquiry'){let q=null;try{q=R.inqCtlFind(String(r.target_id),false);}catch(e){}
   const dg=q?String(q.phone||q.contact_phone||(q.raw&&(q.raw['문의자 연락처']||q.raw['고객연락처']))||'').replace(/\D/g,''):'';return {item:q,key:'inq:'+r.target_id,digits:dg};}
  const d=((R.B&&R.B.deals)||[]).find(x=>String(x.id)===String(r.target_id))||null;let dg='';
  if(d){try{const c=R.contactInfo(d,R.itemPatch(d,'deal'))||{};dg=String(c.mobile||c.officeTel||d.office_phone||'').replace(/\D/g,'');}catch(e){}}
  return {item:d,key:d?'deal:'+R.dealKey(d):'',digits:dg};
 }
 function openTarget(r,action){const t=target(r);if(!t.item||!t.key){toast('이 현장을 지금 화면 자료에서 찾지 못했습니다','warn');return;}try{T().open(t.key,action);}catch(e){}}
 /* ── 요청 창 ── */
 function findItem(key){try{const V=R.TodayV3&&R.TodayV3.current?R.TodayV3.current():null;if(!V)return null;return V.mine.concat(V.teamAll||[]).find(i=>i.key===key)||null;}catch(e){return null;}}
 function openModal(key){
  const i=findItem(key),me=meName(),q=i?reqFor(i,me):null;if(!q||q.self)return;
  if(openFor(q.type,q.id,q.kind)){toast('이미 답을 기다리는 같은 요청이 있습니다');return;}
  const hr=new Date().getHours(),night=q.scope!=='branch'&&hr>=NIGHT_FROM,dues=q.scope==='branch'?DUE_BR:night?DUE_NIGHT:DUE_IN,late=hr>=17;
  st().modal={key,q,i,asks:q.K.def.map((v,n)=>!!v||(q.recall&&q.K.asks[n]==='본사 회수 검토')),due:night?0:q.scope!=='branch'&&late?1:0,dues,custom:ymd(addDays(1)),busy:false,err:'',
   memo:q.kind==='branch'?'담당자 지정 후 고객 첫 연락 진행 여부를 CRM에 남겨 주세요.':q.kind==='first'?(i.short||'')+' 미응대 건입니다. 오늘 고객 연락 후 결과와 다음 일정을 CRM에 남겨주세요.':i.missTxt+(i.short&&!/^(0일|오늘|-)$/.test(i.short)&&i.rk!=='contract'?' · '+i.short:'')+' 건입니다. '+q.K.done+'까지 CRM에 남겨 주세요.'};
  drawModal();
 }
 function closeModal(){st().modal=null;document.getElementById('wrq-modal')?.remove();}
 function drawModal(){
  const M=st().modal;let ov=document.getElementById('wrq-modal');if(!M){ov?.remove();return;}
  if(!ov){ov=document.createElement('div');ov.id='wrq-modal';ov.className='wrq-shade';document.body.append(ov);ov.addEventListener('mousedown',e=>{if(e.target===ov)closeModal();});ov.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeModal();}});
   ov.addEventListener('change',e=>{const M2=st().modal;if(M2&&e.target.matches&&e.target.matches('[data-wr-in="custom"]'))M2.custom=e.target.value;});}
  const i=M.i,q=M.q,inner=q.scope!=='branch',brand=i.brand||(i.i&&i.i.brand)||'',st0=q.kind==='branch'?[(()=>{try{return R.gnAssignedRep&&R.gnAssignedRep(i.x.item)?'지사 실담당 지정됨':'지사 실담당 미지정';}catch(e){return '지사 실담당 미지정';}})(),i.rk==='first'?'CRM 연락 기록 없음':i.missTxt]:q.kind==='first'?['첫 연락 전 · '+(i.short||'')+' 지연']:[i.missTxt+(i.short&&!/^(0일|오늘|-)$/.test(i.short)&&i.rk!=='contract'?' · '+i.short:'')];
  const cond=q.K.contact?['고객 연락 시도','통화 결과 기록','다음 행동 + 날짜 등록']:q.K.done.split(/\s*\+\s*|\s*·\s*/).filter(Boolean);
  ov.innerHTML='<section class="wrq-dlg" role="dialog" aria-modal="true" aria-label="'+attr(q.label)+'"><header><b>'+h(q.label)+'</b><i></i><button type="button" class="wrq-x" data-wr="close" aria-label="닫기">×</button></header>'
   +'<div class="wrq-form"><span class="k">현장</span><b>'+h(i.i.site+(brand?' · '+brand:'')+(inner?' · 담당 '+q.to:''))+'</b>'
   +'<span class="k">현재 상태</span><div class="wrq-tags">'+st0.filter(Boolean).map(s=>'<span>'+h(s)+'</span>').join('')+'</div>'
   +(inner?'<span class="k">고객</span><b>'+h(i.i.phone||'연락처 미입력')+'</b><span class="k">문의</span><span>'+h(i.i.want||(i.x.type==='inq'?'문의 내용 미입력':i.sName||''))+'</span>':'')
   +'<span class="k">요청 대상</span><span>'+h(q.to)+'</span>'
   +'<span class="k">요청 내용</span><div class="wrq-asks">'+q.K.asks.map((l,n)=>'<button type="button" data-wr="askpick" data-v="'+n+'" aria-pressed="'+!!M.asks[n]+'"><i>'+(M.asks[n]?'✓':'')+'</i>'+h(l)+'</button>').join('')+'</div>'
   +'<span class="k">처리 기한</span><div class="wrq-duebox"><div class="wrq-dues">'+M.dues.map((l,n)=>'<button type="button" data-wr="due" data-v="'+n+'" aria-pressed="'+(M.due===n)+'"'+(l==='오늘 17:00'&&new Date().getHours()>=17?' disabled title="17시가 지났습니다"':'')+'>'+l+'</button>').join('')+'</div>'+(M.dues[M.due]==='직접 지정'?'<input type="date" data-wr-in="custom" min="'+ymd(new Date())+'" value="'+attr(M.custom)+'" aria-label="처리 기한 날짜">':'')+'</div>'
   +(inner?'<span class="k">완료 조건</span><div class="wrq-cond">'+cond.map(c=>'<span>✓ '+h(c)+'</span>').join('')+'<small>이 기록이 저장되면 자동 완료 · 따로 [완료] 없음</small></div>':'')
   +'<span class="k">메모</span><span class="wrq-memo"><em>AI</em>'+h(M.memo)+'</span></div>'
   +(M.err?'<p class="wrq-err">'+h(M.err)+'</p>':'')
   +'<footer><span>직접 안 써도 됩니다 · 체크만</span><button type="button" data-wr="close">취소</button><button type="button" class="go" data-wr="send"'+(M.busy?' disabled':'')+'>'+(M.busy?'보내는 중…':'요청 보내기')+'</button></footer></section>';
  if(!M.busy){const b=ov.querySelector('[data-wr="send"]');try{b&&b.focus();}catch(e){}}
 }
 function send(){
  const M=st().modal;if(!M||M.busy)return;const q=M.q,i=M.i,label=M.dues[M.due],at=dueAt(label,M.custom);
  if(!at||at.getTime()<Date.now()){M.err='처리 기한을 다시 골라 주세요.';return drawModal();}
  const asks=q.K.asks.filter((_,n)=>M.asks[n]),dueLabel=label==='직접 지정'?mdK(M.custom):label;
  M.busy=true;M.err='';drawModal();
  O().rpc(RPC.create,{target_type:q.type,target_id:q.id,site:i.i.site,brand:i.brand||'',kind:q.kind,label:q.label,to_scope:q.scope,to_name:q.to,asks:asks.length?asks:[q.label],due_at:at.toISOString(),due_label:dueLabel,memo:M.memo})
   .then(r=>{put(r.request);closeModal();toast(r.request.to_reach===false?q.to+'은(는) CRM에서 요청을 받을 수 없습니다 — 요청은 기록했으니 전화로 전달해 주세요':q.to+'에게 '+q.label+'을 보냈습니다 · 오른쪽 \'답 기다리는 중\'에서 확인',r.request.to_reach===false?'warn':undefined);noteDeal(r.request,'[내부 요청] '+lineReq(r.request));repaint();})
   .catch(e=>{const M2=st().modal;if(!M2)return;M2.busy=false;M2.err=e&&e.unavailable?'요청 저장소가 아직 서버에 적용되지 않았습니다.':/받는 사람을 찾을 수 없습니다/.test(String(e&&e.message))?q.to+'은(는) CRM 계정 · 영업이사 명단에 없어 요청을 남길 수 없습니다 — 전화로 전달해 주세요.':String(e&&e.message||e);drawModal();if(/이미 답을 기다리는/.test(M2.err))load(true);});
 }
 /* ── 응대 이력 줄 ── */
 const lineReq=r=>(r.requested_by||'관리자')+' → '+r.to_name+' · '+((r.asks||[]).join(' · ')||r.label)+' · 기한 '+dueTxt(r);
 function lineEnd(r){
  const who=r.replied_by||r.to_name;
  if(r.status==='replied')return who+' 회신 · '+(r.result||'')+(r.result_owner?' · '+r.result_owner:'')+(r.reply_note?' — '+r.reply_note:'');
  if(r.status==='done')return who+' · 처리 완료'+(r.result?' · '+r.result:'')+(r.next_text?' → 다음 행동: '+r.next_text+(r.next_due?' · '+mdK(r.next_due):''):'');
  if(r.status==='absent')return who+' · 전화 시도 · 부재'+(r.next_due?' → 다음 연락 '+mdK(r.next_due):'')+' (실제 연결 아님 · 최초 응대 미완료)';
  if(r.status==='cancelled'){const n=String(r.reply_note||'');const m=/^\[(통합|대상 오류|취소)\]\s*(.*)$/.exec(n);return m?(m[1]==='통합'?'다른 요청에 통합':m[1]==='대상 오류'?'대상 오류':'요청 취소')+(m[2]?' · '+m[2]:''):'요청 취소'+(n?' · '+n:'');}
  return '';
 }
 /* 그 현장의 '시스템 · 내부 요청' 줄(요청 → 재확인 → 회신 · 완료). 목록에 없는 현장은 한 번 읽어 온다 */
 const TG={};
 function history(type,id){
  if(!enabled()||!id)return [];const key=type+':'+id,S=st();
  let rows=S.list.filter(r=>r.target_type===type&&String(r.target_id)===String(id));
  if(TG[key]&&TG[key].rows)rows=TG[key].rows;
  else if(!TG[key]){TG[key]={at:Date.now()};O().rpc(RPC.list,{target_type:type,target_id:String(id)}).then(r=>{TG[key].rows=Array.isArray(r.requests)?r.requests:[];if(JSON.stringify(TG[key].rows.map(x=>x.id+x.status))!==JSON.stringify(rows.map(x=>x.id+x.status)))repaint();}).catch(()=>{});}
  const out=[];rows.forEach(r=>{out.push({at:r.created_at,tag:'내부 요청',who:'시스템 · 내부 요청',text:lineReq(r)});
   if(r.reasked_at)out.push({at:r.reasked_at,tag:'내부 요청',who:'시스템 · 내부 요청',text:'재확인 요청 ('+r.round+'회차) · 기한 바뀜 → '+dueTxt(r)});
   const e=lineEnd(r);if(e&&r.closed_at)out.push({at:r.closed_at,tag:'내부 요청',who:'시스템 · 내부 요청',text:e});});
  return out;
 }
 const touch=r=>{const k=r.target_type+':'+r.target_id;if(TG[k])delete TG[k];};
 /* 영업건은 기존 내부 메모 길(DealDetailV3.memo)로 한 줄 — 응대 이력에 '[내부 요청] …'으로 남는다. 문의는 위 history 가 이력에 끼워 넣는다 */
 function noteDeal(r,text){if(!r||r.target_type!=='deal')return;const t=target(r),D=R.DealDetailV3;if(!t.item||!D||typeof D.memo!=='function')return;try{Promise.resolve(D.memo(t.item,text,{})).catch(()=>{});}catch(e){}}
 function decorate(){
  const v=document.getElementById('detailView');if(!v)return;
  v.querySelectorAll('.idv-thread>.idv-msg').forEach(m=>{const b=m.querySelector('.idv-bubble');if(!b||m.dataset.wrq)return;const t=String(b.textContent||'').trim();if(!/^\[내부 요청\]/.test(t))return;m.dataset.wrq='1';
   const em=m.querySelector('.idv-meta em'),k=m.querySelector('.idv-meta .dv3-kind');if(k){k.textContent='시스템 · 내부 요청';if(em)em.remove();}else if(em)em.textContent='시스템 · 내부 요청';b.textContent=t.replace(/^\[내부 요청\]\s*/,'');});
 }
 /* ── ops_12 C⑦ 요청 5단계: 요청 → 담당 확인 → 실행 → 증빙 → 완료 — 실제 기록으로 판정(담당 확인 = 받은 사람이 화면을 염 · 실행 = 요청 뒤 응대 기록 · 증빙 = 완료 조건 충족 · 완료 = 자동 판정 / 회신) ── */
 const HANDOVER_LABEL='재배정 인계',RECEIPT_LABEL='시공 인계 수령 확인';/* design_handoff_units ③ 수주 → 시공 인계: 시공 담당이 [수령 확인]해야 영업 단계 종료 */
 const isHandover=r=>!!r&&(r.kind==='handover'||(r.kind==='support'&&r.label===HANDOVER_LABEL));
 const isReceipt=r=>!!r&&r.kind==='support'&&r.label===RECEIPT_LABEL;
 function steps(r){
  const t=target(r),it=t.item,since=Date.parse(r.created_at)||0,K=KIND[r.kind]||{};
  const seen=r.status!=='sent',done=r.status==='done'||r.status==='replied';let ev=null,exec=false;
  if(!done&&it){try{ev=evidence(r);}catch(e){ev=null;}
   try{if(r.target_type==='deal'){const at=R.salesActivityAt(it)||'';exec=!!at&&Date.parse(at)>=since;}else{const F=R.InquiryFlow;exec=!!(F&&F.on&&F.on()&&(F.state(it).logs||[]).some(l=>Date.parse(l.at)>=since));}}catch(e){}}
  const evid=r.kind==='contract'?'계약일 · 금액 · 계약서':r.kind==='award'?'낙찰사 · 금액 · 결과 기록':r.kind==='quote'?'견적 요청 · 예정일':isHandover(r)?'인수 확인':K.contact?'통화 결과 + 다음 일정':'처리 기록';
  const idx=done?4:ev?3:exec?2:seen?1:0;
  const rows=[['요청',whenTxt(r.created_at)+(r.requested_by?' '+r.requested_by:'')],['담당 확인',seen?(r.to_name||'')+' 열어 봄':'열기 전'],['실행',idx>=2?(r.to_name||'')+' 기록 중':'기록 전'],['결과 기록',idx>=3?evid+' 기록됨':evid+' 전'],['완료',done?whenTxt(r.closed_at||r.updated_at)+(r.auto?' · 기록으로 완료':' · 확인'):'완료 조건: '+(K.contact?'통화 결과 + 다음 일정 등록':K.done||evid)]];
  return rows.map((s,i)=>({l:s[0],t:s[1],s:done?1:i<idx?1:i===idx?2:0}));
 }
 const stepsHtml=r=>'<div class="wrq-steps" aria-label="요청 단계">'+steps(r).map(s=>'<div class="'+(s.s===1?'done':s.s===2?'cur':'')+'"><span></span><b>'+h(s.l)+'</b><small>'+h(s.t)+'</small></div>').join('')+'</div>';
 /* 인계 메모(deal-owner-v2 가 보낸 memo 글)를 줄로 나눈다 */
 const handoverRows=r=>String(r.memo||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.indexOf(':');return i>0?[l.slice(0,i).trim(),l.slice(i+1).trim()]:['',l];});
 /* ── 보낸 사람: 답 기다리는 중 ── */
 function waiting(){const S=st(),dayAgo=Date.now()-864e5;return S.list.filter(r=>r.by_me&&(isOpen(r)||(r.closed_at&&Date.parse(r.closed_at)>=dayAgo&&r.status!=='cancelled'&&!S.seen[r.id]))).sort((a,b)=>(overdue(b)?1:0)-(overdue(a)?1:0)||String(b.updated_at).localeCompare(String(a.updated_at)));}
 function sideHtml(){
  if(!enabled())return '';load();try{autoBranch();}catch(e){}const L=waiting(),S=st();if(!L.length)return '';
  const item=r=>{const od=overdue(r),br=r.kind==='branch',ok=r.status==='replied'||r.status==='done',ab=r.status==='absent';
   const wa=r.status==='working'&&/부재/.test(String(r.result||''));/* 코덱스 검수 F5: 부재 + 재연락 일정 = 고객 회신 대기(담당 미착수와 구분) */
   const pill=od?['요청 미이행'+(r.round>=2?' · '+r.round+'회':''),'bad']:ok?[r.status==='replied'?'회신 완료':'✓ 처리 완료','ok']:ab?['요청 처리 · 부재','amb']:isHandover(r)?['인계 대기','amb']:wa?['고객 회신 대기','amb']:[r.status==='seen'?'담당 확인':r.status==='working'?'처리 중':'답변 대기','amb'];/* 인계 대기 = 새 담당이 [인수 확인] 전(ops_12 C⑧) */
   const btns=od?['<button type="button" data-wr="reask" data-id="'+r.id+'">재확인 요청</button>'].concat(br?['<button type="button" data-wr="recall" data-id="'+r.id+'">본사 회수 검토</button>']:r.round>=2?['<button type="button" data-wr="reassign" data-id="'+r.id+'">재배정 검토</button>']:[]):(ok||ab)?['<button type="button" data-wr="check" data-id="'+r.id+'">진행 확인</button>']:[];
   /* day_zones §4: 열린 요청은 보낸 사람이 종료할 수 있다 — 완료 · 취소(사유) · 다른 요청에 통합 · 대상 오류 */
   if(isOpen(r))btns.push('<button type="button" data-wr="end" data-id="'+r.id+'" aria-expanded="'+(S.endOpen===r.id)+'">종료 ▾</button>');
   const E=S.endOpen===r.id?(S.end||(S.end={kind:'done',note:''})):null;
   const endHtml=E?'<div class="wrq-end"><div class="k">'+[['done','완료'],['cancel','취소 (사유)'],['merge','다른 요청에 통합'],['wrong','대상 오류']].map(x=>'<button type="button" data-wr="endkind" data-id="'+r.id+'" data-v="'+x[0]+'" aria-pressed="'+(E.kind===x[0])+'">'+x[1]+'</button>').join('')+'</div>'+(E.kind==='done'?'<span>요청자가 직접 완료로 닫습니다 · 결과 기록은 담당 몫</span>':'<input data-wr-in="endnote" maxlength="200" placeholder="'+(E.kind==='cancel'?'취소 사유 (필수)':E.kind==='merge'?'어느 요청에 합치나요 (필수)':'왜 대상이 아닌가요 (필수)')+'" value="'+attr(E.note||'')+'">')+'<div class="ft">'+(E.err?'<em>'+h(E.err)+'</em>':'')+'<button type="button" data-wr="endclose">닫기</button><button type="button" class="go" data-wr="endsave" data-id="'+r.id+'"'+(E.busy?' disabled':'')+'>'+(E.busy?'저장 중…':'종료')+'</button></div></div>':'';
   if(isOpen(r)&&r.to_reach===false)btns.push('<button type="button" data-wr="ack" data-id="'+r.id+'">처리 확인</button>');
   const reply=ok||ab?lineEnd(r):wa?(r.to_name||'')+' · 전화 시도 · 부재'+(r.next_due?' → 재연락 '+mdK(r.next_due):' · 재연락 일정 없음')+' · 고객 회신 대기(담당 미착수 아님 · 최초 응대 미완료)':'',note=od&&r.round>=2?(br?'지사 확인 요청 '+r.round+'회 미이행 → 본사 회수 검토 권장':r.label+' '+r.round+'회 미이행 → 재배정 검토 권장'):'',unreach=isOpen(r)&&r.to_reach===false?r.to_name+'은(는) CRM에서 이 요청을 볼 수 없습니다 · 전화로 전달하고, 처리되면 [처리 확인]':'';
   return '<div class="wrq-w"><div class="l1"><i style="background:'+(BRAND[r.brand]||'#9aa0ab')+'"></i><b title="'+attr(r.site)+'">'+h(r.site)+'</b><span class="wrq-pill '+pill[1]+'">'+h(pill[0])+'</span></div>'
    +'<span class="l2">'+h(r.to_name+'에게 · '+((r.asks||[]).join(' · ')||r.label))+'</span>'
    +'<div class="l3"><span>'+h(whenTxt(r.reasked_at||r.created_at)+' · 기한 '+dueTxt(r)+(r.round>=2?' · 기한 바뀜 '+whenTxt(r.reasked_at)+' (재확인 '+r.round+'회차)':''))+'</span><i></i>'+btns.join('')+'</div>'
    +stepsHtml(r)
    +(reply?'<span class="rp '+(ab||wa?'amb':'ok')+'">'+h(reply)+'</span>':'')+(note?'<span class="nt">'+h(note)+'</span>':'')+(unreach?'<span class="ur">'+h(unreach)+'</span>':'')+endHtml+'</div>';};
  return '<section class="wrq-wait"><header><b>답 기다리는 중</b><span>내가 요청한 일 '+L.length+'건</span></header>'+L.map(item).join('')+'<p class="ft">답변 대기 중엔 같은 요청 잠금 · 기한이 지나야 [재확인 요청] · 지사 건은 [본사 회수 검토]</p></section>';
 }
 function autoBranch(){
  const S=st();if(!BRANCH_AUTO()||!S.loaded||S.autoDay===ymd(new Date()))return;let V=null;try{V=R.TodayV3&&R.TodayV3.current?R.TodayV3.current():null;}catch(e){}
  if(!V||!V.team)return;S.autoDay=ymd(new Date());const me=meName(),weekAgo=Date.now()-7*864e5;
  V.mine.filter(i=>{const q=reqFor(i,me);return q&&q.kind==='branch'&&q.branchDays!==null&&q.branchDays>=SILENT_DAYS()&&!S.list.some(r=>r.target_type===q.type&&String(r.target_id)===q.id&&r.kind==='branch'&&(isOpen(r)||Date.parse(r.created_at)>=weekAgo));}).forEach(i=>{const q=reqFor(i,me),at=dueAt('내일 12시');
   O().rpc(RPC.create,{target_type:q.type,target_id:q.id,site:i.i.site,brand:i.brand||'',kind:'branch',label:q.label,to_scope:'branch',to_name:q.to,asks:q.K.asks.filter((_,n)=>q.K.def[n]),due_at:at.toISOString(),due_label:'내일 12시',memo:'넘긴 지 '+q.branchDays+'일 · 지사 응대 기록이 없어 자동으로 확인을 요청합니다.'}).then(r=>{put(r.request);repaint();}).catch(()=>{});});
 }
 function reask(id){
  const r=st().list.find(x=>x.id===id);if(!r||!overdue(r))return;const br=r.kind==='branch',label=br?'내일 12시':(new Date().getHours()>=17?'오늘 중':'오늘 17:00'),at=dueAt(label);
  O().rpc(RPC.reask,{id,due_at:at.toISOString(),due_label:label}).then(x=>{put(x.request);touch(x.request);toast(r.to_name+'에게 재확인 요청을 보냈습니다 · 기한 '+label);noteDeal(x.request,'[내부 요청] 재확인 요청 ('+x.request.round+'회차) · '+r.to_name+' · 기한 '+label);repaint();}).catch(e=>toast('재확인 요청을 보내지 못했습니다: '+String(e&&e.message||e),'warn'));
 }
 /* 요청 종료(day_zones §4): 완료 = done(결과 '요청자 확인 · 완료'), 취소 · 통합 · 대상 오류 = cancel + 앞머리 있는 사유(서버 reply_note). 응대 이력에도 한 줄 */
 async function endRequest(id){
  const S=st(),r=S.list.find(x=>x.id===id),E=S.end;if(!r||!E||E.busy)return;const note=String(E.note||'').trim();
  if(E.kind!=='done'&&!note){E.err='사유를 적어 주세요';return repaint();}
  E.busy=true;E.err='';repaint();
  try{const body=E.kind==='done'?{id,action:'done',result:'요청자 확인 · 완료'}:{id,action:'cancel',note:(E.kind==='merge'?'[통합] ':E.kind==='wrong'?'[대상 오류] ':'[취소] ')+note};
   const x=await O().rpc(RPC.reply,body);put(x.request);touch(x.request);S.endOpen='';S.end=null;noteDeal(x.request,'[내부 요청] '+(lineEnd(x.request)||'요청 종료'));toast(E.kind==='done'?'요청을 완료로 닫았습니다':E.kind==='merge'?'다른 요청에 통합하고 닫았습니다':E.kind==='wrong'?'대상 오류로 닫았습니다':'요청을 취소했습니다');}
  catch(e){E.busy=false;E.err='닫지 못했습니다: '+String(e&&e.message||e);}
  repaint();
 }
 /* ── 받는 사람: 오늘 업무 맨 위 ── */
 const incoming=()=>st().list.filter(r=>r.to_me&&isOpen(r)).sort((a,b)=>String(a.due_at).localeCompare(String(b.due_at)));
 function lateTxt(r){const i=(()=>{try{const V=R.TodayV3&&R.TodayV3.current?R.TodayV3.current():null,t=target(r);return V&&t.key?V.mine.find(x=>x.key===t.key):null;}catch(e){return null;}})();if(!i)return '';return r.kind==='first'?'첫 연락 '+(i.short||'')+' 지연':i.missTxt+(i.short&&!/^(0일|오늘|-)$/.test(i.short)&&i.rk!=='contract'?' · '+i.short:'');}
 function topHtml(){
  if(!enabled())return '';load();const L=incoming();if(!L.length)return '';const S=st();
  const card=r=>{const C=S.card[r.id]||(S.card[r.id]={res:'',owner:'',busy:false,err:''}),br=r.kind==='branch',K=KIND[r.kind]||{},t=target(r),od=overdue(r);
   const rc=isReceipt(r),ho=isHandover(r)||rc;
   const head='<div class="hd"><em>'+(br?'본사 확인 요청':rc?'시공 인계':ho?'재배정 인계':'관리자 요청')+'</em><b>'+h(r.site)+'</b>'+(lateTxt(r)?'<span class="late">'+h(lateTxt(r))+'</span>':'')+(r.round>=2?'<span class="late">재확인 '+r.round+'회차</span>':'')+'<i></i><span class="by'+(od?' od':'')+'">'+h((r.requested_by||'관리자')+' · '+whenTxt(r.reasked_at||r.created_at)+' · 기한 '+dueTxt(r)+(r.round>=2?' · 기한 바뀜 '+whenTxt(r.reasked_at):''))+'</span></div>'+stepsHtml(r);
   /* ops_12 C⑧ 재배정 인계 카드: 이전 담당 → 새 담당 · 재배정자 · 사유 / 인계 메모 · 남은 할 일 · 마지막 연락 / [이전 담당에게 질문] [인수 확인] — 확인 전까지 관리자 화면 '인계 대기' */
   if(ho){const rows=handoverRows(r),first=rows.find(x=>x[0]==='')||rows[0]||['',''],rest=rows.filter(x=>x[0]);
    return '<article class="wrq-in wrq-ho" data-id="'+r.id+'">'+head+'<span class="memo"><b>'+h(first[1]||first[0])+'</b></span>'
     +'<div class="wrq-hrows">'+rest.map(x=>'<span>'+h(x[0])+'</span><b>'+h(x[1])+'</b>').join('')+'</div>'
     +(C.err?'<p class="wrq-err">'+h(C.err)+'</p>':'')
     +'<div class="ft"><span>'+(rc?'수령 확인 전까지 영업 단계가 끝나지 않습니다':'확인 전까지 관리자 화면에 \'인계 대기\'')+'</span>'+(rc?'':'<button type="button" data-wr="hoask" data-id="'+r.id+'">이전 담당에게 질문</button>')+'<button type="button" class="go" data-wr="hodone" data-id="'+r.id+'"'+(C.busy?' disabled':'')+'>'+(C.busy?'저장 중…':rc?'수령 확인':'인수 확인')+'</button></div></article>';}
   if(br){let reps=[];try{reps=(R.branchAssignableReps&&R.branchAssignableReps())||[];}catch(e){}
    return '<article class="wrq-in" data-id="'+r.id+'">'+head+'<span class="memo"><b>요청</b> '+h((r.asks||[]).join(' · ')||r.label)+(r.memo?'<br><span>"'+h(r.memo)+'"</span>':'')+'</span>'
     +'<b class="lb">처리 결과 · 하나 고르기</b><div class="chips">'+BRANCH_RES.map(l=>'<button type="button" data-wr="res" data-id="'+r.id+'" data-v="'+attr(l)+'" aria-pressed="'+(C.res===l)+'">'+l+'</button>').join('')+'</div>'
     +(C.res==='담당 지정 완료'?'<div class="own"><b>실담당</b><select data-wr-in="owner" data-id="'+r.id+'" aria-label="실담당"><option value="">실담당 고르기</option>'+reps.map(n=>'<option value="'+attr(n)+'"'+(C.owner===n?' selected':'')+'>'+h(n)+'</option>').join('')+'</select></div>':'')
     +(C.err?'<p class="wrq-err">'+h(C.err)+'</p>':'')
     +'<div class="ft"><span>회신하면 본사 \'답 기다리는 중\'이 자동으로 바뀝니다</span><button type="button" class="go" data-wr="reply" data-id="'+r.id+'"'+(C.res&&!C.busy&&(C.res!=='담당 지정 완료'||C.owner)?'':' disabled')+'>'+(C.busy?'보내는 중…':'본사에 회신')+'</button></div></article>';}
   if(K.contact){const nx=C.res?nxOf(r.target_type,C.res):null,nxTxt=nx&&nx[0]?nx[0]+' · '+mdK(ymd(addDays(nx[1]))):'결과를 고르면 제안';
    return '<article class="wrq-in" data-id="'+r.id+'">'+head+(r.memo?'<span class="memo">"'+h(r.memo)+'"</span>':'')
     +'<button type="button" class="call" data-wr="dial" data-id="'+r.id+'"'+(t.digits?'':' disabled title="전화번호가 없습니다 — 상세에서 연락처를 등록해 주세요"')+'>전화 '+h(t.digits?R.phoneFmt(t.digits):'번호 없음')+'</button>'
     +'<div class="res"><span>통화 결과</span>'+resOf(r.target_type).map(l=>'<button type="button" data-wr="res" data-id="'+r.id+'" data-v="'+attr(l)+'" aria-pressed="'+(C.res===l)+'">'+l+'</button>').join('')+'</div>'
     +'<div class="nx"><span>다음 행동</span><span class="box"><em>AI</em>'+h(nxTxt)+'</span></div>'
     +(C.err?'<p class="wrq-err">'+h(C.err)+'</p>':'')
     +'<div class="ft"><span>'+(C.res==='부재'?'부재 = 연락 시도로만 기록 · 최초 응대는 아직 미완료':C.res?'저장하면 관리자 요청 자동 완료':'결과를 골라야 저장')+'</span><button type="button" class="go" data-wr="save" data-id="'+r.id+'"'+(C.res&&!C.busy?'':' disabled')+'>'+(C.busy?'저장 중…':'저장')+'</button></div></article>';}
   return '<article class="wrq-in" data-id="'+r.id+'">'+head+'<span class="memo"><b>요청</b> '+h((r.asks||[]).join(' · ')||r.label)+(r.memo?'<br><span>"'+h(r.memo)+'"</span>':'')+'</span>'
    +'<div class="ft"><span>완료 조건 · '+h(K.done||'')+' — 입력되면 자동 완료 · 따로 [완료] 없음</span><button type="button" class="go" data-wr="go" data-id="'+r.id+'">열어서 입력</button></div></article>';};
  /* 담당 확인(seen)은 받은 사람이 카드에서 무엇이든 눌렀을 때만(onClick) — 화면에 보였다고 확인으로 적지 않는다(2026-10-10 코덱스 인계: 노출 ≠ 열람 ≠ 확인) */
  const LG=L.filter(r=>r.label===LEGACY_LABEL),rest0=L.filter(r=>r.label!==LEGACY_LABEL);
  const DZ=R.DayZones&&R.DayZones.on(R.G._towerRole)?R.DayZones:null,IMP=(()=>{try{return R.CRMRules.get('important_request_kinds')||[];}catch(e){return [];}})();
  const isImp=r=>r.kind==='branch'||isHandover(r)||isReceipt(r)||IMP.includes(r.label);
  const rest=DZ?rest0.filter(isImp):rest0,soft=DZ?rest0.filter(r=>!isImp(r)):[];
  const byLabel=new Map();soft.forEach(r=>byLabel.set(r.label,(byLabel.get(r.label)||0)+1));
  const softHtml=soft.length?'<article class="wrq-in wrq-soft"><div class="hd"><em class="soft">알림</em><b>'+h([...byLabel].map(x=>x[0]+' '+x[1]+'건').join(' · '))+'</b><i></i><span class="by">기존 업무 줄에 \''+h((soft[0].requested_by||'관리자'))+' 요청\' 꼬리표로 붙어 있습니다</span><button type="button" data-wr="softtoggle">'+(S.softOpen?'접기':'보기')+'</button></div>'+(S.softOpen?soft.map(card).join(''):'')+'</article>':'';
  const bundle=LG.length?'<article class="wrq-in wrq-legacy"><div class="hd"><em>관리자 요청</em><b>'+h(LEGACY_LABEL+' '+LG.length+'건')+'</b><i></i><span class="by'+(LG.some(overdue)?' od':'')+'">'+h((LG[0].requested_by||'관리자')+' · '+whenTxt(LG[0].reasked_at||LG[0].created_at)+' · 기한 '+dueTxt(LG[0]))+'</span></div>'
   +'<span class="memo">예전 시스템에서 옮겨 온 자료입니다 · 한 건씩 [영업 재개]에서 지금 단계 · 다음 행동 · 날짜를 정하면 그 건은 자동으로 완료됩니다</span>'
   +'<div class="wrq-lg">'+LG.map(r=>'<div><b title="'+attr(r.site)+'">'+h(r.site)+'</b><button type="button" data-wr="resume" data-id="'+r.id+'">영업 재개</button></div>').join('')+'</div></article>':'';
  if(!bundle&&!rest.length&&!softHtml)return '';
  return '<section class="wrq-top" aria-label="받은 요청">'+bundle+rest.map(card).join('')+softHtml+'</section>';
 }
 // Phase 1 is limited to the existing single-purpose first-contact template.
 const basicContact=r=>!!r&&r.target_type==='inquiry'&&r.kind==='first'&&r.label==='첫 연락 요청'&&JSON.stringify(r.asks)==='["고객 첫 연락"]';
 const actorId=()=>String(R.ME&&(R.ME.user_id||R.ME.id)||'');
 const UUID_CONTACT=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 async function saveInquiryContact(r,C,q,next,due){
  const actor=actorId(),key='crm.work-contact.v1:'+actor+':'+r.id;
  try{
   if(!UUID_CONTACT.test(actor)||!O().has(RPC.contact)||!R.CRMRelease||R.CRMRelease.has(RPC.contact)!==true)throw Error('문의 요청 저장 기능이 아직 연결되지 않았습니다.');
   let p;try{const old=R.localStorage.getItem(key);p=old?JSON.parse(old):null;}catch(e){throw Error('재시도 정보를 읽지 못했습니다. 저장을 시작하지 않았습니다.');}
   if(p&&(p.id!==r.id||!UUID_CONTACT.test(p.operation_id)))throw Error('이전 저장 정보를 확인해 주세요.');
   if(p&&p.result!==C.res)throw Error('앞선 저장 결과를 먼저 확인해야 합니다. 같은 결과를 선택해 재시도해 주세요.');
   if(!p){p={id:r.id,operation_id:R.crypto.randomUUID(),result:C.res,next_text:next,next_due:due};try{R.localStorage.setItem(key,JSON.stringify(p));if(R.localStorage.getItem(key)!==JSON.stringify(p))throw Error();}catch(e){throw Error('재시도 정보를 보관하지 못해 저장을 시작하지 않았습니다.');}}
   const x=await O().rpc(RPC.contact,p),rq=x&&x.request,expected=p.result==='부재'?'working':'done';
   const log=x&&x.state&&Array.isArray(x.state.logs)&&x.state.logs.find(l=>l.id===x.log_id);
   if(!x||x.ok!==true||x.contract_version!==1||x.operation_id!==p.operation_id||x.inquiry_id!==r.target_id||
    !UUID_CONTACT.test(x.log_id||'')||!UUID_CONTACT.test(x.next_action_id||'')||!rq||rq.id!==r.id||rq.target_type!=='inquiry'||rq.target_id!==r.target_id||rq.to_user_id!==actor||
    rq.status!==expected||rq.result!==p.result||rq.next_text!==p.next_text||rq.next_due!==p.next_due||
    !x.state||x.state.inquiry_id!==r.target_id||!log||log.request_id!==p.operation_id||log.result!==p.result||log.kind!==(p.result==='부재'?'attempt':'connected')||
    log.next_action!==p.next_text||log.next_check_date!==p.next_due||!x.inquiry_update||x.inquiry_update.next_action_date!==p.next_due)throw Error('서버 저장 확인이 불완전합니다. 같은 결과로 재시도해 주세요.');
   if(actorId()!==actor)throw Error('로그인이 변경되었습니다. 원래 담당자로 저장 결과를 확인해 주세요.');
   // Replayed receipts describe the original commit; never overwrite newer assignment/plans.
   const current=target(r).item;
   if(!x.replayed&&current===q&&String(q.assigned_to||'')===actor&&(!q.updated_at||Date.parse(q.updated_at)<=Date.parse(x.server_at))){
    if(R.InquiryFlow&&R.InquiryFlow.take)R.InquiryFlow.take(x.state);
    Object.assign(q,x.inquiry_update);put(rq);touch(rq);
   }
   R.localStorage.removeItem(key);delete st().card[r.id];load(true);
   if(R.InquiryFlow&&R.InquiryFlow.load)R.InquiryFlow.load(true);
   toast(p.result==='부재'?'부재와 재연락 일정을 저장했습니다 · 연결 요청은 진행 중':'응대와 다음 일정을 저장했습니다 · 첫 연락 요청 완료');
  }catch(e){if(e&&e.databaseRejected===true&&['22023','42501'].includes(e.code)){try{R.localStorage.removeItem(key);}catch(ignore){}}C.busy=false;C.err=String(e&&e.message||e);}
  repaint();
 }
 /* [저장] = 실제 기록 저장(기존 저장 길) → 성공하면 요청 자동 완료. 부재는 연락 시도로만 남는다 */
 async function saveCard(id){
  const S=st(),r=S.list.find(x=>x.id===id),C=S.card[id];if(!r||!C||!C.res||C.busy)return;const t=target(r),nx=nxOf(r.target_type,C.res);
  if(!t.item){C.err='이 현장을 지금 화면 자료에서 찾지 못했습니다 — 새로고침 뒤 다시 시도해 주세요.';return repaint();}
  if(!nx||!nx[0]){C.err='이 결과는 상세 창에서 기록해 주세요.';return repaint();}
  const due=ymd(addDays(nx[1]));C.busy=true;C.err='';repaint();
  try{
   if(basicContact(r)){await saveInquiryContact(r,C,t.item,nx[0],due);return;}
   if(r.target_type==='inquiry'){if(!R.InquiryListV3||typeof R.InquiryListV3.record!=='function')throw Error('상세 창에서 기록해 주세요.');
    const ok=R.InquiryListV3.record(t.item,{res:'[전화 · '+C.res+'] 관리자 요청 처리',next:nx[0],due})===true;if(!ok)throw Error((document.getElementById('iq-msg')||{}).textContent||'기록을 저장하지 못했습니다.');}
   else{const D=R.DealDetailV3;if(!D||typeof D.record!=='function')throw Error('상세 저장 기능을 불러오지 못했습니다.');await D.record(t.item,{ch:'전화',res:C.res,memo:'관리자 요청 처리',P:{}});}
   const x=await O().rpc(RPC.reply,{id,action:'done',result:C.res,next_text:nx[0],next_due:due,absent:C.res==='부재'});
   put(x.request);touch(x.request);delete S.card[id];toast(C.res==='부재'?'연락 시도로 기록했습니다 · 요청 처리(부재)':'기록을 저장했습니다 · 관리자 요청 자동 완료');
  }catch(e){C.busy=false;C.err='저장하지 못했습니다: '+String(e&&e.message||e);}
  repaint();
 }
 function replyCard(id){
  const S=st(),r=S.list.find(x=>x.id===id),C=S.card[id];if(!r||!C||!C.res||C.busy)return;if(C.res==='담당 지정 완료'&&!C.owner)return;
  C.busy=true;C.err='';repaint();
  O().rpc(RPC.reply,{id,action:'reply',result:C.res,result_owner:C.res==='담당 지정 완료'?C.owner:''}).then(x=>{put(x.request);touch(x.request);delete S.card[id];toast('본사에 회신했습니다 · '+C.res);repaint();}).catch(e=>{C.busy=false;C.err='회신하지 못했습니다: '+String(e&&e.message||e);repaint();});
 }
 /* ── 실제 기록으로 자동 완료: 받은 사람(또는 관리자) 화면에서 완료 조건이 채워진 열린 요청을 닫는다 ── */
 function evidence(r){
  if(basicContact(r))return null; // Only persisted atomic contact proof may complete this request.
  const t=target(r),it=t.item;if(!it)return null;const since=Date.parse(r.created_at);
  if(r.label===LEGACY_LABEL){try{return R.PipelineScope&&R.PipelineScope.on()&&!R.PipelineScope.isLegacy(it)?{result:'영업 재개 확인',absent:false}:null;}catch(e){return null;}}
  try{
   if(isHandover(r)||r.kind==='branch'||r.kind==='deadline'||r.kind==='support')return null;
   if(r.target_type==='inquiry'){const F=R.InquiryFlow&&R.InquiryFlow.on&&R.InquiryFlow.on()?R.InquiryFlow:null;if(!F)return null;const L=(F.state(it).logs||[]).filter(l=>Date.parse(l.at)>=since);
    if(L.some(l=>l.kind==='connected'))return {result:'연락 기록 확인',absent:false};if(L.some(l=>l.kind==='attempt'))return {result:'부재',absent:true};return null;}
   const f=(k,n)=>{const c=it.stage_contexts&&it.stage_contexts[k];return c&&c.fields?c.fields[n]:'';};
   if(r.kind==='quote'){/* 코덱스 검수 F4: 화면의 완료 조건(견적 요청 등록 + 예정일)과 같은 판정 — 요청에서 고른 목적마다 근거가 있어야 한다(OR 아님) */const asks=r.asks||[],needReq=!asks.length||asks.some(a=>/견적 요청 등록/.test(a)),needDue=!asks.length||asks.some(a=>/예정일/.test(a)),both=!needReq&&!needDue;const okReq=!(needReq||both)||!!f('consulting','quote_request'),okDue=!(needDue||both)||!!f('consulting','quote_due');return okReq&&okDue?{result:[needReq||both?'견적 요청 등록':'',needDue||both?'예정일 입력':''].filter(Boolean).join(' · ')+' 확인',absent:false}:null;}
   if(r.kind==='contract')return (f('contract','contract_date')||it.contract_date)&&(Number(f('contract','contract_amount')||it.contract_amount||it.won_amount)>0)?{result:'계약일 · 금액 입력 확인',absent:false}:null;
   if(r.kind==='award')return R.DealTransfer&&R.DealTransfer.enabled()&&!R.DealTransfer.checkDue(it)&&!R.DealTransfer.awaiting(it)?{result:'낙찰결과 등록 확인',absent:false}:null;
   if(r.kind==='first'||r.kind==='follow'){let at='';try{at=R.salesActivityAt(it)||'';}catch(e){}return at&&Date.parse(at)>=since?{result:'응대 기록 확인',absent:false}:null;}
  }catch(e){}
  return null;
 }
 function autoClose(){
  if(!enabled())return;const S=st(),admin=(()=>{try{return !!R.todayIsAdmin();}catch(e){return false;}})();
  S.list.filter(r=>isOpen(r)&&(r.to_me||admin)&&!S.closing[r.id]).forEach(r=>{const ev=evidence(r);if(!ev)return;S.closing[r.id]=true;
   O().rpc(RPC.reply,{id:r.id,action:'done',auto:true,result:ev.result,absent:ev.absent}).then(x=>{put(x.request);touch(x.request);noteDeal(x.request,'[내부 요청] '+lineEnd(x.request));repaint();}).catch(()=>{}).finally(()=>{delete S.closing[r.id];});});
 }
 /* ── 누르기 ── */
 function dial(d){if(!d)return;const a=document.createElement('a');a.href='tel:'+d;a.style.display='none';document.body.append(a);a.click();a.remove();}
 function onClick(e){
  const b=e.target.closest('[data-wr]');if(!b||b.disabled)return;const a=b.dataset.wr,S=st(),id=b.dataset.id,M=S.modal;
  if(a==='resume'){const r=S.list.find(x=>x.id===id);if(r&&R.PipelineLegacy&&typeof R.PipelineLegacy.open==='function')R.PipelineLegacy.open(String(r.target_id),true);return;}
  if(!b.closest('#pg-today')&&!b.closest('#wrq-modal'))return;e.preventDefault();e.stopPropagation();
  if(a==='ask')return openModal(b.dataset.key);
  if(a==='close')return closeModal();
  if(a==='askpick'&&M){const n=Number(b.dataset.v);M.asks[n]=!M.asks[n];return drawModal();}
  if(a==='due'&&M){M.due=Number(b.dataset.v)||0;M.err='';return drawModal();}
  if(a==='send')return send();
  if(a==='reask')return reask(id);
  if(a==='softtoggle'){S.softOpen=!S.softOpen;return repaint();}
  if(a==='end'){S.endOpen=S.endOpen===id?'':id;S.end={kind:'done',note:'',err:''};return repaint();}
  if(a==='endclose'){S.endOpen='';S.end=null;return repaint();}
  if(a==='endkind'){if(S.end){S.end.kind=b.dataset.v;S.end.err='';}return repaint();}
  if(a==='endsave')return endRequest(id);
  const r=S.list.find(x=>x.id===id);if(!r)return;
  /* 받은 사람이 카드에서 무엇이든 누르면 그때 '담당 확인'(seen) — 닫기 · 노출은 확인이 아니다 */
  if(r.to_me&&r.status==='sent'&&!S.closing['seen:'+r.id]&&['res','dial','go','hoask','resume'].includes(a)){/* 저장 · 회신 · 인수/수령 확인은 그 자체가 상태를 바꾸므로 따로 seen 을 보내지 않는다(원자 저장 순서 보존) */S.closing['seen:'+r.id]=true;O().rpc(RPC.reply,{id:r.id,action:'seen'}).then(x=>put(x.request)).catch(()=>{});}
  if(a==='check'){S.seen[id]=true;openTarget(r);return repaint();}
  if(a==='ack'){if(S.closing[id])return;S.closing[id]=true;return O().rpc(RPC.reply,{id,action:'done',result:'관리자 확인 · 전화로 전달'}).then(x=>{put(x.request);touch(x.request);toast('처리 확인으로 닫았습니다');noteDeal(x.request,'[내부 요청] '+lineEnd(x.request));repaint();}).catch(e=>toast('닫지 못했습니다: '+String(e&&e.message||e),'warn')).finally(()=>{delete S.closing[id];});}
  if(a==='reassign'||a==='recall')return openTarget(r);
  if(a==='go')return openTarget(r,r.kind==='quote'||r.kind==='contract'||r.kind==='award'?undefined:'contact');
  if(a==='dial')return dial(target(r).digits);
  if(a==='res'){const C=S.card[id]||(S.card[id]={res:'',owner:'',busy:false,err:''});C.res=C.res===b.dataset.v?'':b.dataset.v;C.err='';return repaint();}
  if(a==='hoask'){const rows=handoverRows(r),prev=(rows.find(x=>x[0]==='이전 담당')||[])[1]||'이전 담당',txt=prev+'님, 인계받은 '+r.site+' 건 질문드립니다 — ';try{navigator.clipboard&&navigator.clipboard.writeText(txt);}catch(e){}toast('질문 문구를 복사했습니다 — 잔디 · 문자로 '+prev+'님께 보내 주세요');return;}
  if(a==='hodone'){const C=S.card[id]||(S.card[id]={res:'',owner:'',busy:false,err:''});if(C.busy)return;C.busy=true;repaint();return O().rpc(RPC.reply,{id,action:'done',result:isReceipt(r)?'수령 확인':'인수 확인'}).then(x=>{put(x.request);touch(x.request);delete S.card[id];toast('인수를 확인했습니다 · 인계 대기가 풀립니다');noteDeal(x.request,'[내부 요청] '+lineEnd(x.request));repaint();}).catch(e=>{C.busy=false;C.err='저장하지 못했습니다: '+String(e&&e.message||e);repaint();});}
  if(a==='save')return saveCard(id);
  if(a==='reply')return replyCard(id);
 }
 document.addEventListener('click',onClick,true);
 document.addEventListener('change',e=>{const t=e.target;if(t&&t.matches&&t.matches('#pg-today [data-wr-in="owner"]')){const C=st().card[t.dataset.id];if(C){C.owner=t.value;repaint();}}},true);
 document.addEventListener('input',e=>{const t=e.target;if(t&&t.matches&&t.matches('#pg-today [data-wr-in="endnote"]')){const E=st().end;if(E)E.note=t.value;}},true);
 root.WorkRequest={enabled,load,reqFor,locked,cell,sideHtml,topHtml,history,autoClose,evidence,decorate,steps,dueTxt,NIGHT_FROM,NIGHT_HOUR,HANDOVER_LABEL,RECEIPT_LABEL,isHandover,isReceipt,KIND,RPC,state:st,_dueAt:dueAt,_lineReq:lineReq,_lineEnd:lineEnd};
})(window);
