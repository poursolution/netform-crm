/* 상담 연결 · 표시 위치 (2026-10-06 design_handoff_consultation_link · 시안 '상담 연결 위치 시안.dc.html' — 대표 "상담 연결 묶음은 디자인만 진행")
   새 화면은 없다. 기존 두 곳에 버튼 · 줄 · 칸만 더한다.
   ① 데이터 정리 › 중복 의심 검토 › 문의 비교 창(dup-v2.js): 예전 [연결만](inquiry_activity) 자리 → [같은 상담으로 연결](관리자만).
      누르면 footer 위에 근거 체크 3개(같은 주소 · 같은 공사 요청 · 고객 · 담당자 확인) + 메모 → [저장](3개 모두 체크해야).
      이미 연결된 쌍이면 [연결 해제] → 사유 한 줄(필수) + [해제 저장]. 판단 박스 · 비교 표 · [그대로 두기] · [합치기]는 그대로.
   ② 견적문의 상세(v4 오른쪽 상세 · 전체 상세 창): 머리 바로 아래 한 줄 "같은 상담으로 연결됨 · 상대 문의 · [열기] … 날짜 · 연결자 [해제]"(연결 있을 때만 · 해제는 관리자만),
      전체 상세의 응대 이력 토글 [이 문의 | 연결된 상담 | 단지 전체] — 두 문의 기록을 원본 사건 키로 한 번만 · 시간순 · 줄마다 브랜드 꼬리표 · 20건/쪽.
   저장 = 서버 미리보기 → save(link | unlink, 사유) → ACK → 재조회: 전부 inquiry-consultation-client.js(InquiryConsultationClient). 완료 표시는 재조회 결과로만, 실패는 창 안 한 줄.
   연결 · 해제만으로 담당 · 상태 · 배드핏 · 원문 · 알림 · 다음 할 일 · 실적은 바뀌지 않고 어느 문의도 목록에서 숨기지 않는다. 예전 '연결만' 경로는 다시 켜지 않는다.
   연결 상태 출처: 이 세션에서 미리보기 · 저장으로 알게 된 것 + 서버 목록이 생기면 root.InquiryConsultationIndex.of(id) → {partner_id, at, by}(Codex 가 붙이는 자리).
   서버 함수(crm_inquiry_consultation_preview_v1 · write_v1)가 허용 목록 · 운영에 없으면 버튼은 잠긴 채 보인다. 끄기: G.inqConsultOff=true */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v)),low=v=>String(v||'').toLowerCase();
 const PREVIEW='crm_inquiry_consultation_preview_v1',WRITE='crm_inquiry_consultation_write_v1';
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const CK=['같은 주소(표기만 다름)','같은 공사 요청','고객 · 담당자 확인'];
 const on=()=>!root.G.inqConsultOff&&!!root.InquiryConsultationClient;
 const admin=()=>{try{return !!root.inqCtlIsAdmin();}catch(e){return false;}};
 const allow=n=>(root.CRM_RPC_ALLOW||[]).includes(n)&&!!(root.CRMRelease&&root.CRMRelease.has&&root.CRMRelease.has(n)===true);
 const ready=()=>!!(root.Phase1&&typeof root.Phase1.rpc==='function')&&allow(PREVIEW)&&allow(WRITE);
 let CL=null;
 function client(){if(CL)return CL;const P=root.Phase1;CL=root.InquiryConsultationClient.create({profile:()=>P.profile,storage:P.storage||root.localStorage,rpc:(n,a)=>P.rpc(n,a),uuid:()=>crypto.randomUUID()});return CL;}
 const ERR={STALE_PREVIEW:'다른 곳에서 먼저 바뀐 자료입니다 — 창을 닫고 다시 열어 확인해 주세요',RELATIONSHIP_UNCHANGED:'이미 그렇게 되어 있습니다 — 다시 열어 확인해 주세요',forbidden:'관리자만 할 수 있습니다',INVALID_REQUEST:'요청 내용을 확인해 주세요',AUTH_REQUIRED:'로그인 뒤에 할 수 있습니다',IDENTITY_CHANGED:'로그인 계정이 바뀌었습니다 — 다시 열어 주세요',PENDING_REQUEST_EXISTS:'먼저 보낸 처리가 아직 확인 중입니다',INVALID_PREVIEW:'서버 미리보기를 읽지 못했습니다',INVALID_ACK:'서버 응답을 확인하지 못했습니다 — 새로 고쳐 확인해 주세요',READBACK_MISMATCH:'저장 뒤 다시 읽은 결과가 다릅니다 — 새로 고쳐 확인해 주세요',CONTRACT_UNAVAILABLE:'서버 적용 뒤에 열립니다',PHASE1_RPC_DENIED:'서버 적용 뒤에 열립니다',INVALID_PAIR:'두 문의를 확인하지 못했습니다'};
 const errText=e=>{const m=String(e&&e.message||e||'');return ERR[m]||('저장하지 못했습니다: '+m);};
 const p2=n=>String(n).padStart(2,'0');
 const fmtAt=t=>{if(!t)return '';const d=new Date(t);if(!Number.isFinite(d.getTime()))return '';return (d.getMonth()+1)+'/'+d.getDate()+' '+p2(d.getHours())+':'+p2(d.getMinutes());};
 const fmt=t=>{const d=new Date(t);if(!Number.isFinite(d.getTime()))return '';return d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate()+' '+p2(d.getHours())+':'+p2(d.getMinutes());};
 /* ── 연결 상태(세션 기억 + 서버 목록 자리) ── */
 const LINKS=new Map(),GONE=new Set();
 const rowOf=(v,id)=>(Array.isArray(v.inquiries)?v.inquiries:[]).find(x=>low(x&&x.id)===id)||{id};
 const whoWhen=v=>[fmtAt(v.linked_at||(v.relationship&&v.relationship.linked_at)||v.saved_at||''),String(v.linked_by_name||v.linked_by||(v.relationship&&v.relationship.linked_by)||'')].filter(Boolean).join(' · ');
 function noteView(v){
  if(!v||!v.left_id||!v.right_id)return;const l=low(v.left_id),r=low(v.right_id);
  const X=root.InquiryConsultationIndex;if(X){X.invalidate([l,r]);X.load(l,true);X.load(r,true);}
  if(v.active){const at=v.linked_at||(v.relationship&&v.relationship.linked_at)||v.saved_at||'',by=String(v.linked_by_name||v.linked_by||(v.relationship&&v.relationship.linked_by)||'');LINKS.set(l,{partner:rowOf(v,r),at,by});LINKS.set(r,{partner:rowOf(v,l),at,by});GONE.delete(l);GONE.delete(r);}
  else{LINKS.delete(l);LINKS.delete(r);GONE.add(l);GONE.add(r);}
 }
 function linkOf(id){
  id=low(id);if(!id)return null;
  const I=root.InquiryConsultationIndex;if(I&&I.loaded(id)){const r=I.of(id);return r?{partner:{id:low(r.partner_id)},at:r.at,by:r.by,fromIndex:true}:null;}
  if(LINKS.has(id))return LINKS.get(id);if(GONE.has(id))return null;
  try{const X=root.InquiryConsultationIndex,r=X&&typeof X.of==='function'?X.of(id):null;if(r&&r.partner_id)return {partner:{id:low(r.partner_id)},at:r.at||'',by:r.by||'',fromIndex:true};}catch(e){}
  return null;
 }
 const findQ=id=>{id=low(id);return ((root.B&&root.B.inquiries)||[]).find(q=>low(q.id)===id)||null;};
 const brandOf=q=>{try{return String(root.inquiryBrandOf(q)||q.brand||'');}catch(e){return String(q&&q.brand||'');}};
 const ownerOf=q=>{try{return root.inquiryAssigned(q)?root.repDisplay(root.inquiryRoutedOwner(q)):'미배정';}catch(e){return String(q.assignee||'미배정');}};
 /* 상대 문의: 이 PC 자료에 있으면 브랜드 · 현장 · 담당 · 상태, 없으면(다른 브랜드 · 열람 권한 없음) 한 줄만 */
 function partnerOf(L){
  const id=low(L.partner&&L.partner.id),q=findQ(id),row=L.partner||{},brand=q?brandOf(q):String(row.brand||row.biz||'');
  return {id,q,key:q?root.inqKey(q):'',visible:!!q,brand,bc:BRAND[brand]||'#6b7280',site:q?String(q.site||'현장명 미입력'):String(row.site||row.site_name||''),owner:q?ownerOf(q):'',status:q?String(q.status||'접수'):''};
 }
 /* ── ① 문의 비교 창 ── */
 const CS=new Map();let CUR=null;
 const cst=c=>{const k=String(c.key);if(!CS.has(k))CS.set(k,{view:null,loading:false,open:false,ck:[false,false,false],memo:'',reason:'',busy:false,err:'',pending:false});return CS.get(k);};
 const idsOf=c=>[low(c.a&&c.a.ref&&c.a.ref.id),low(c.b&&c.b.ref&&c.b.ref.id)];
 const isLinked=(c,s)=>s.view?!!s.view.active:(()=>{const [a,b]=idsOf(c),L=linkOf(a);return !!(L&&low(L.partner&&L.partner.id)===b);})();
 /* footer 의 버튼 하나: 예전 [연결만] 자리. 모양은 기존 dv-ghost · dv-primary */
 function footBtn(c){
  if(!on()||!c||c.type!=='inquiry'||!admin())return '';
  const s=cst(c),rd=ready(),linked=isLinked(c,s),dis=!rd||s.loading||s.busy,t=rd?'':' title="서버 적용 뒤에 열립니다"';
  /* 시안 색: 연결 · 저장 = 검정, 해제 = 회색, 아직 못 누르는 저장 = 흐린 회색 */
  if(linked)return s.open?'<button type="button" class="dv-primary icl-main" data-icl="save-unlink"'+(s.reason.trim()&&!dis?'':' disabled')+'>'+(s.busy?'저장 중…':'해제 저장')+'</button>':'<button type="button" class="dv-primary icl-main icl-grey" data-icl="unlink"'+(dis?' disabled':'')+t+'>연결 해제</button>';
  return s.open?'<button type="button" class="dv-primary icl-main" data-icl="save-link"'+(s.ck.every(Boolean)&&!dis?'':' disabled')+'>'+(s.busy?'저장 중…':'저장')+'</button>':'<button type="button" class="dv-primary icl-main" data-icl="link"'+(dis?' disabled':'')+t+'>같은 상담으로 연결</button>';
 }
 /* footer 왼쪽 안내 한 줄(시안의 hint) */
 function hintOf(c,s){
  if(!admin())return '';if(!ready())return '서버 적용 뒤에 열립니다';const linked=isLinked(c,s);
  if(s.loading)return '서버에서 연결 상태를 읽는 중…';
  if(linked)return s.open?'사유를 적으면 해제 저장이 열립니다 · 해제해도 이력은 남습니다':'해제하면 사유를 받고 이력은 남습니다';
  return s.open?(s.ck.every(Boolean)?'저장 → 서버 확인 → 다시 읽은 결과로 표시':'근거 3개를 확인해야 저장됩니다'):'관리자만 · 두 접수는 그대로 두고 같은 상담으로만 묶습니다';
 }
 function paneHtml(c,s){
  const linked=isLinked(c,s);let x='';
  if(s.pending)x+='<div class="icl-done warn"><b>저장은 됐지만 다시 읽지 못했습니다</b><span>새로 고친 뒤 확인하거나</span><button type="button" class="dv-ghost" data-icl="retry"'+(s.busy?' disabled':'')+'>'+(s.busy?'확인 중…':'다시 확인')+'</button></div>';
  else if(linked)x+='<div class="icl-done"><b>✓ 같은 상담으로 연결됨</b><span>'+h([s.view?whoWhen(s.view):'','서버 재조회 확인'].filter(Boolean).join(' · '))+'</span></div>';
  if(s.open&&!linked)x+='<div class="icl-hd"><b>같은 상담으로 연결 · 근거 확인</b><button type="button" data-icl="close">접기</button></div>'
   +CK.map((l,i)=>'<button type="button" class="icl-ck" data-icl="ck" data-v="'+i+'" aria-pressed="'+!!s.ck[i]+'"><span class="bx">'+(s.ck[i]?'✓':'')+'</span>'+h(l)+'</button>').join('')
   +'<input type="text" data-icl="memo" maxlength="300" aria-label="메모" placeholder="메모 (선택) · 예) 고객이 같은 누수 건이라고 설명" value="'+attr(s.memo)+'"><small>두 접수는 그대로 남습니다 · 담당 · 상태 · 배드핏 · 원문 · 알림 · 실적은 바뀌지 않습니다</small>';
  if(s.open&&linked)x+='<div class="icl-hd"><b>연결 해제 · 사유</b><button type="button" data-icl="close">접기</button></div><input type="text" data-icl="reason" maxlength="300" aria-label="해제 사유" placeholder="해제 사유 (필수)" value="'+attr(s.reason)+'"><small>해제해도 두 문의와 기록은 그대로 남습니다 · 해제 이력이 남습니다</small>';
  if(s.err)x+='<div class="icl-err">'+h(s.err)+'</div>';
  return x?'<div class="icl-pane">'+x+'</div>':'';
 }
 function paint(m,c){
  const foot=m.querySelector('.dv-foot');if(!foot)return;const s=cst(c);
  const act=document.activeElement,keep=act&&m.contains(act)&&act.dataset&&(act.dataset.icl==='memo'||act.dataset.icl==='reason');
  const old=foot.querySelector('[data-icl]'),nb=footBtn(c);if(old&&nb){const t=document.createElement('template');t.innerHTML=nb;old.replaceWith(t.content.firstElementChild);}
  let hint=foot.querySelector('.icl-hint');const ht=hintOf(c,s);if(ht&&!hint){hint=document.createElement('span');hint.className='icl-hint';foot.prepend(hint);}if(hint){if(ht)hint.textContent=ht;else hint.remove();}
  if(keep)return;/* 입력 중에는 칸을 다시 그리지 않는다(버튼만) */
  m.querySelectorAll('.icl-pane').forEach(n=>n.remove());const ph=paneHtml(c,s);if(ph){const t=document.createElement('template');t.innerHTML=ph;foot.before(t.content.firstElementChild);}
 }
 function mount(m,c){
  if(!on()||!c||c.type!=='inquiry')return;CUR={m,c};
  if(!m.__icl){m.__icl=true;m.addEventListener('click',onDlgClick);m.addEventListener('input',onDlgInput);}
  const s=cst(c);if(!admin())return;
  s.view=null;s.open=false;s.err='';s.busy=false;s.ck=[false,false,false];s.memo='';s.reason='';/* 창을 새로 열면 적다 만 것은 버린다(확인 안 된 저장은 pending 으로 남긴다) */
  if(ready()&&!s.loading){s.loading=true;paint(m,c);
   client().preview(idsOf(c)[0],idsOf(c)[1]).then(v=>{s.view=v;noteView(v);}).catch(e=>{s.err=errText(e);}).finally(()=>{s.loading=false;if(CUR&&CUR.c.key===c.key&&m.classList.contains('on'))paint(m,c);kick();});}
  else paint(m,c);
 }
 function onDlgClick(e){
  const b=e.target.closest('[data-icl]');if(!b||b.disabled||!CUR)return;const {m,c}=CUR,s=cst(c),a=b.dataset.icl;
  if(a==='link'||a==='unlink'){s.open=true;s.err='';return paint(m,c);}
  if(a==='close'){s.open=false;s.err='';return paint(m,c);}
  if(a==='ck'){const i=Number(b.dataset.v);s.ck[i]=!s.ck[i];return paint(m,c);}
  if(a==='save-link')return save(m,c,'link');
  if(a==='save-unlink')return save(m,c,'unlink');
  if(a==='retry')return retry(m,c);
 }
 function onDlgInput(e){
  const t=e.target,k=t&&t.dataset&&t.dataset.icl;if(!k||!CUR)return;const {m,c}=CUR,s=cst(c);
  if(k==='memo')s.memo=t.value;if(k==='reason'){s.reason=t.value;const b=m.querySelector('.dv-foot [data-icl="save-unlink"]');if(b)b.disabled=!s.reason.trim()||s.busy;}
 }
 function settle(s,r){if(r&&r.verified){s.view=r.current;noteView(r.current);s.open=false;s.ck=[false,false,false];s.memo='';s.reason='';s.pending=false;}else s.pending=true;}
 async function save(m,c,op){
  const s=cst(c);if(s.busy||!s.view)return;const reason=op==='link'?CK.join(' · ')+(s.memo.trim()?' · '+s.memo.trim():''):s.reason.trim();if(!reason)return;
  s.busy=true;s.err='';paint(m,c);
  try{settle(s,await client().save(s.view,op,reason));}catch(e){s.err=errText(e);}
  s.busy=false;if(m.classList.contains('on'))paint(m,c);kick();
 }
 async function retry(m,c){
  const s=cst(c);if(s.busy)return;s.busy=true;s.err='';paint(m,c);
  try{settle(s,await client().retry());}catch(e){s.err=errText(e);}
  s.busy=false;if(m.classList.contains('on'))paint(m,c);kick();
 }
 /* ── ② 견적문의 상세 ── */
 const DS=new Map();
 const dst=id=>{id=low(id);if(!DS.has(id))DS.set(id,{unlinkOpen:false,reason:'',busy:false,err:'',scope:'',page:1,pages:{}});return DS.get(id);};
 const curV3=()=>{const ov=document.getElementById('inq-inbox-dialog');if(!ov||!ov.classList.contains('idv3'))return null;try{return root.inqCtlFind(root.G.inqSelKey,false);}catch(e){return null;}};
 const curV4=()=>{try{const k=root.InquiryV4&&root.InquiryV4.selected();return k?root.inqCtlFind(k,false):null;}catch(e){return null;}};
 function lineHtml(q,L,s){
  const P=partnerOf(L),who=[fmtAt(L.at),L.by].filter(Boolean).join(' · ');
  let x='<div class="icl-line"><b>같은 상담으로 연결됨</b>'+(P.visible?'<i class="bar" style="background:'+P.bc+'"></i><b class="br" style="color:'+P.bc+'">'+h(P.brand||'브랜드 미지정')+'</b><span>'+h([P.site,P.owner,P.status].filter(Boolean).join(' · '))+'</span><button type="button" class="lnk" data-icl="open" data-key="'+attr(P.key)+'">열기</button>':'<span>다른 브랜드 문의 1건 (열람 권한 없음)</span>')
   +'<em></em>'+(who?'<span class="when">'+h(who)+'</span>':'')+(admin()&&!s.unlinkOpen?'<button type="button" class="icl-btn" data-icl="unlink-d"'+(ready()?'':' disabled title="서버 적용 뒤에 열립니다"')+'>해제</button>':'')+'</div>';
  if(s.unlinkOpen)x+='<div class="icl-line icl-unlink"><input type="text" data-icl="reason-d" maxlength="300" aria-label="해제 사유" placeholder="해제 사유 (필수)" value="'+attr(s.reason)+'"'+(s.busy?' disabled':'')+'><button type="button" class="icl-btn" data-icl="cancel-d"'+(s.busy?' disabled':'')+'>취소</button><button type="button" class="icl-btn pri" data-icl="save-unlink-d"'+(s.reason.trim()&&!s.busy?'':' disabled')+'>'+(s.busy?'저장 중…':'해제 저장')+'</button>'+(s.err?'<span class="icl-err">'+h(s.err)+'</span>':'')+'</div>';
  else if(s.err)x+='<div class="icl-err">'+h(s.err)+'</div>';
  return x;
 }
 function place(host,anchor,q,mode){
  const id=low(q.id);if(id&&root.InquiryConsultationIndex)root.InquiryConsultationIndex.load(id);const L=id?linkOf(id):null;let box=host.querySelector('.icl-box');
  if(!L){if(box)box.remove();if(mode==='v3')scopeSync(host,q,null,null);return;}
  const s=dst(id),html=lineHtml(q,L,s),act=document.activeElement;
  if(!box){box=document.createElement('div');box.className='icl-box';anchor.after(box);}else if(box.previousElementSibling!==anchor)anchor.after(box);
  if(box.__h!==html&&!(act&&box.contains(act)&&act.dataset.icl==='reason-d')){box.__h=html;box.innerHTML=html;}
  if(mode==='v3')scopeSync(host,q,L,s);
 }
 const evKey=e=>{const id=e.id||e.event_id||e.activity_id||e.key;return id?'id:'+id:[String(e.at||'').slice(0,16),e.kind||'',e.ch||'',e.res||'',String(e.text||'').trim()].join('|');};
 /* 연결된 상담 = 두 문의의 기록을 원본 사건 키로 한 번만, 이 문의 이력과 같은 방향으로 */
 function mergedHtml(q,L,s){
  const P=partnerOf(L),DV=root.InquiryDetailV2,tl=x=>{try{return DV.timeline(x)||[];}catch(e){return [];}};
  const mine=tl(q).map(e=>Object.assign({},e,{_b:brandOf(q)})),theirs=P.q?tl(P.q).map(e=>Object.assign({},e,{_b:P.brand})):[];
  const seen=new Set(),all=mine.concat(theirs).filter(e=>{const k=evKey(e);if(seen.has(k))return false;seen.add(k);return true;});
  const T=e=>Date.parse(e.at)||0,desc=mine.length>1&&T(mine[0])>T(mine[mine.length-1]);all.sort((a,b)=>desc?T(b)-T(a):T(a)-T(b));
  const LP=root.ListPager,pg=LP.cut(all,LP.page(s,'link'));
  const line=e=>{const con=e.kind==='contact'||e.kind==='work',tag=e.kind==='memo'?'내부 메모':[e.ch,e.res].filter(Boolean).join(' · '),by=e.kind==='system'?(e.src&&e.src!=='CRM'?e.src:e.who):e.who,bc=BRAND[e._b]||'#9ca3af';
   return '<div class="idv3-ev'+(con?' ct':e.kind==='memo'?' mm':'')+'"><i></i><div><span class="m">'+h(fmt(e.at))+(by?' · '+h(by):'')+(tag?' · <b>'+h(tag)+'</b>':'')+'<em class="icl-tag" style="color:'+bc+';border-color:'+bc+'">'+h(e._b||'브랜드 미지정')+'</em></span>'+(e.text?'<span class="t'+(e.kind==='system'?'':' box')+'">'+h(e.text)+'</span>':'')+(e.next?'<span class="n">→ 다음 행동: '+h(String(e.next))+'</span>':'')+'</div></div>';};
  return (pg.rows.length?pg.rows.map(line).join(''):'<div class="icl-none">기록이 없습니다</div>')+(P.visible?'':'<small class="icl-note">다른 브랜드 문의 1건은 열람 권한이 없어 이 문의 기록만 보입니다</small>')+LP.html(pg,{ns:'icl',unit:'건'})+'<small class="icl-note">두 문의의 기록을 원본 사건 기준으로 합침 · 같은 사건은 한 번만 · 20건씩 쪽 이동</small>';
 }
 /* 전체 상세의 응대 이력 토글: 기존 [이 문의 | 단지 전체] 사이에 [연결된 상담](연결 있을 때만) — 단지 이력이 없어 토글이 없던 문의는 [이 문의 | 연결된 상담] 을 만든다 */
 function scopeSync(host,q,L,s){
  const head=host.querySelector('.idv3-chead');if(!head)return;let grp=head.querySelector('.isd-scope');
  if(!L){const mine=grp&&grp.classList.contains('icl-scope');if(mine)grp.remove();else if(grp)grp.querySelectorAll('[data-icl="scope"]').forEach(n=>n.remove());return;}
  if(!grp){grp=document.createElement('div');grp.className='isd-scope icl-scope';grp.setAttribute('role','tablist');grp.setAttribute('aria-label','응대 이력 범위');grp.innerHTML='<button type="button" role="tab" data-icl="scope" data-v="now" aria-selected="true">이 문의</button>';head.append(grp);}
  let b=grp.querySelector('[data-icl="scope"][data-v="link"]');
  if(!b){b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.dataset.icl='scope';b.dataset.v='link';b.textContent='연결된 상담';const first=grp.querySelector('[role=tab]');if(first)first.after(b);else grp.append(b);}
  const link=s.scope==='link';
  grp.querySelectorAll('[role=tab]').forEach(t=>{if(t===b)t.setAttribute('aria-selected',String(link));else if(link)t.setAttribute('aria-selected','false');else if(t.dataset.icl==='scope')t.setAttribute('aria-selected','true');});
  const th=host.querySelector('.idv3-thread');if(!th)return;
  if(link){const html=mergedHtml(q,L,s);if(th.dataset.icl!=='link'||th.__h!==html){th.dataset.icl='link';th.__h=html;th.innerHTML=html;}}
 }
 function decorate(){
  if(!on())return;
  const ov=document.getElementById('inq-inbox-dialog');
  if(ov&&ov.classList.contains('idv3')){const dlg=ov.querySelector('.inq-dialog'),top=dlg&&dlg.querySelector(':scope>.idv3-top'),q=curV3();if(top&&q)place(dlg,top,q,'v3');}
  const det=document.querySelector('#inq-v4 .i4-detail');
  if(det){const hd=det.querySelector(':scope>header.i4-dh'),q=curV4();if(hd&&q)place(det,hd,q,'v4');else{const box=det.querySelector('.icl-box');if(box)box.remove();}}
 }
 let raf=0;const kick=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;try{decorate();}catch(e){if(root.console)root.console.warn('상담 연결: '+(e&&e.message||e));}});};
 const reskin=()=>{try{root.InquiryDetailV2&&root.InquiryDetailV2.reskin();}catch(e){}kick();};
 async function unlinkFromDetail(q,L,s){
  if(s.busy||!s.reason.trim())return;s.busy=true;s.err='';decorate();
  try{const v=await client().preview(low(q.id),low(L.partner.id));noteView(v);
   if(v.active){const r=await client().save(v,'unlink',s.reason.trim());if(r.verified){noteView(r.current);s.unlinkOpen=false;s.reason='';}else s.err='저장은 됐지만 다시 읽지 못했습니다 — 새로 고쳐 확인해 주세요';}
   else{s.unlinkOpen=false;s.reason='';}}
  catch(e){s.err=errText(e);}
  s.busy=false;decorate();
 }
 function onDocClick(e){
  if(!on())return;
  if(e.target.closest&&e.target.closest('#inq-inbox-dialog [data-idv="scope"]')){const q=curV3();if(q)dst(q.id).scope='';return;}
  const b=e.target.closest&&e.target.closest('[data-icl]');if(!b||b.disabled||b.closest('#dupDialog'))return;
  const inV3=!!b.closest('#inq-inbox-dialog'),q=inV3?curV3():curV4();if(!q)return;const id=low(q.id),L=linkOf(id),s=dst(id),a=b.dataset.icl,v=b.dataset.v;
  e.stopPropagation();
  if(a==='open'){const key=b.dataset.key;if(!key)return;if(inV3){try{root.InquiryWorkbench.open(key);}catch(err){}}else{try{root.InquiryV4.select(key);}catch(err){}}return;}
  if(a==='unlink-d'){s.unlinkOpen=true;s.err='';return decorate();}
  if(a==='cancel-d'){s.unlinkOpen=false;s.err='';s.reason='';return decorate();}
  if(a==='save-unlink-d'){if(L)unlinkFromDetail(q,L,s);return;}
  if(a==='scope'){const to=v==='link'?'link':'';if(s.scope===to)return;s.scope=to;root.ListPager.reset(s);if(to)decorate();else reskin();return;}
  if(a==='page'){root.ListPager.set(s,'link',b.dataset.page);return decorate();}
 }
 function onDocInput(e){
  const t=e.target;if(!t||!t.dataset||t.dataset.icl!=='reason-d')return;const q=t.closest('#inq-inbox-dialog')?curV3():curV4();if(!q)return;const s=dst(q.id);s.reason=t.value;
  const b=t.parentElement&&t.parentElement.querySelector('[data-icl="save-unlink-d"]');if(b)b.disabled=!s.reason.trim()||s.busy;
 }
 function boot(){
  if(!root.document||root.document.__icl)return;root.document.__icl=true;
  root.addEventListener('inquiry-consultation:changed',kick);
  root.addEventListener('phase1:profile',()=>{LINKS.clear();GONE.clear();CS.clear();CL=null;kick();});
  root.addEventListener('phase1:identity-cleared',()=>{LINKS.clear();GONE.clear();CS.clear();CL=null;kick();});
  document.addEventListener('click',onDocClick,true);document.addEventListener('input',onDocInput);
  const mo=new MutationObserver(rs=>{for(const r of rs){for(const n of r.addedNodes){if(n.nodeType!==1)continue;if((n.matches&&n.matches('.i4-detail,.i4-panes,.inq-dialog,#inq-inbox-dialog,#inq-v4,.idv3-top,.i4-dh'))||(n.querySelector&&n.querySelector('.i4-dh,.idv3-top'))){kick();return;}}}});
  mo.observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.InquiryConsultationLink={on,ready,admin,footBtn,mount,linkOf,noteView,decorate,client,CK,PREVIEW,WRITE,state:()=>({links:[...LINKS.keys()],gone:[...GONE]})};
})(window);
