/* 새 영업 등록 v2 (2026-10-05 디자인 핸드오프 'design_handoff_new_deal' · 새 영업 등록 v2.dc.html) — 상단 [+ 새 영업] 창만.
   문의 없이 우리가 먼저 시작한 영업(아웃바운드 · 소개 · 기존 고객 재영업 · 현장 발굴/기타). 등록하면 견적문의를 거치지 않고 파이프라인 · 컨설팅 설계로 바로 들어간다.
   칸(위 → 아래 한 화면): 어떻게 시작했나요 *(카드 4 → source_type) · 현장명 · 현장 주소(지도 확인) + 중복 감지 · 공종 *(그룹별 칩 · 여러 개 = 복합공종) ·
     브랜드 * · 담당 *(기본 = 나) · 예상 금액 · 처음 만난 사람(역할 · 이름 · 휴대폰 · 대표전화 — 이름 + 연락처 하나 이상) · 시작 근거 한 줄 *(직접 입력 | 음성 기록) · 첫 다음 행동 * + 날짜 *.
   저장은 기존 영업 생성 명령 하나(opportunity_create)에 유입 구분 · 소개한 사람 · 첫 다음 행동을 실어 보낸다 — 서버(sql/new-deal-outbound-v1-20261005.sql)가 설치돼 있을 때만 이 창을 쓴다.
   서버에 아직 없으면 · 확장관리에서 여는 '다음 영업'이면 · 끄면(G.newDealV2Off=true) 예전 창 그대로.
   유입 구분은 영업건의 source_type 으로 남아 견적문의(인바운드) 통계와 따로 센다: NewDealV2.sourceOf(deal). */
(function(root){
 'use strict';
 const R=root,doc=R.document;
 const h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const SRC=[['outbound','아웃바운드','직접 연락 · 방문 발굴'],['referral','소개','소장님 · 고객 · 협력사 소개'],['re_sales','기존 고객 재영업','수주 현장의 다른 공사'],['other','현장 발굴 · 기타','입찰 공고 · 전시회 등']];
 const SRC_SHORT={outbound:'아웃바운드',referral:'소개',re_sales:'기존 고객 재영업',other:'현장 발굴 · 기타'};
 const BRANDS=['POUR솔루션','석민이앤씨','POUR공법','아파트스퀘어'];
 const ROLES=['관리소장','입대의 회장','관리과장','기타'];
 /* 첫 다음 행동: [키, 이름, 다음 할 일 종류] — 1차 현장미팅만 '미팅 예정'으로 잡힌다 */
 const ACTS=[['meet','1차 현장미팅','현장방문'],['call','전화 · 니즈 확인','전화'],['send','자료 발송','자료발송'],['quote','견적 요청','견적']];
 const RPC='crm_new_deal_contract_v1';
 let ready=null,S=null,box=null;
 const digits=v=>String(v||'').replace(/\D/g,'');
 const fmtPhone=v=>{const n=digits(v);if(/^01\d{8,9}$/.test(n))return n.replace(/^(01\d)(\d{3,4})(\d{4})$/,'$1-$2-$3');if(/^02\d{7,8}$/.test(n))return n.replace(/^(02)(\d{3,4})(\d{4})$/,'$1-$2-$3');if(/^0\d{9,10}$/.test(n))return n.replace(/^(0\d{2})(\d{3,4})(\d{4})$/,'$1-$2-$3');return String(v||'').trim();};
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 const dayName=k=>{const d=new Date(k+'T00:00:00');return isNaN(d)?'':'('+'일월화수목금토'[d.getDay()]+')';};
 /* 날짜 칸은 시안 모양으로 보여 준다: 2026.10.8 (수) */
 const fmtDue=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k||''));return m?m[1]+'.'+Number(m[2])+'.'+Number(m[3])+' '+dayName(k):'';};
 /* 첫 다음 행동 날짜의 기본값 = 사흘 뒤(주말이면 다음 월요일) — 시안처럼 채워 두고 누르면 바꾼다 */
 const defaultDue=()=>{const d=new Date();d.setDate(d.getDate()+3);if(d.getDay()===6)d.setDate(d.getDate()+2);else if(d.getDay()===0)d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 /* 예상 금액: 1.5억 · 3,000만 · 150,000,000 → 원 */
 function parseAmount(v){
  const s=String(v||'').replace(/[\s,원]/g,'');if(!s)return null;
  let m=/^(\d+(?:\.\d+)?)억(?:(\d+(?:\.\d+)?)만)?$/.exec(s);if(m)return Math.round(Number(m[1])*1e8+Number(m[2]||0)*1e4);
  m=/^(\d+(?:\.\d+)?)만$/.exec(s);if(m)return Math.round(Number(m[1])*1e4);
  if(/^\d+$/.test(s))return Number(s);
  return NaN;
 }
 /* 유입 구분 읽기(통계용): 새 영업 창으로 만든 건만 값이 있다 — 없으면 인바운드(견적문의에서 온 건 · 옮겨 온 자료) */
 function sourceOf(d){
  if(!d)return 'inbound';const lf=d.list_fields&&typeof d.list_fields==='object'?d.list_fields:{};
  const v=String(d.source_type||d.sourceType||lf.source_type||'');if(SRC_SHORT[v])return v;
  const s=String(d.source||'');return SRC_SHORT[s]?s:'inbound';
 }
 const isOutbound=d=>sourceOf(d)!=='inbound';
 const enabled=()=>!R.G.newDealV2Off&&!R.EXPANSION_NEW_SOURCE;
 /* 서버가 새 약속(유입 구분 · 연락처 하나 · 첫 다음 행동)을 받는지 한 번 확인한다 */
 async function check(){
  if(ready!==null)return ready;
  try{const r=await R.Phase1.rpc(RPC);ready=!!(r&&r.ok===true&&r.policy==='new-deal-outbound-v1');}catch(e){ready=e&&(e.code==='PGRST202'||e.message==='CONTRACT_UNAVAILABLE')?false:null;if(ready===null)return false;}
  return ready;
 }
 const st0=()=>({src:'outbound',refName:'',refPhone:'',site:'',address:'',siteId:null,linked:null,dupSkip:'',finding:false,findQ:'',works:[],brand:BRANDS[0],owner:'',amount:'',role:ROLES[0],cname:'',mobile:'',office:'',act:'meet',due:defaultDue(),err:'',busy:false});
 /* ── 중복 감지: 현장명(지역 · '아파트' 뺀 이름) · 주소 · 관리사무소 전화가 같은 기존 영업건 ── */
 const siteIdOf=d=>String(d.cleanup_site_id||d.site_id||d.siteId||'');
 const statusOf=d=>{try{if(R.isWon(d)){let y='';try{y=String(R.wonDate(d)||'').slice(0,4);}catch(e){}return '수주'+(y?' '+y:'');}if(!R.isOpen(d))return '종결';}catch(e){}return '진행 중';};
 const workOf=d=>{let w='';try{w=R.dealWorkSummary(d)||'';}catch(e){}return /미분류|미기록/.test(w)?'':w;};
 function dupOf(){
  const name=R.normSite(S.site),addr=String(S.address||'').replace(/\s+/g,''),tel=digits(S.office);
  if(name.length<2&&addr.length<6&&tel.length<8)return null;
  const hit=(R.B&&R.B.deals||[]).filter(d=>{if(!siteIdOf(d))return false;const n=R.normSite(d.site||'');
   return (name.length>=2&&(n===name||(name.length>=4&&(n.includes(name)||name.includes(n))&&n.length>=4)))||(addr.length>=6&&String(d.address||'').replace(/\s+/g,'')===addr)||(tel.length>=8&&digits(d.office_phone||(d.contact&&d.contact.officeTel))===tel);});
  if(!hit.length)return null;
  /* 같은 현장의 건 가운데 수주 → 최근 순으로 대표 하나 */
  hit.sort((a,b)=>(R.isWon(b)?1:0)-(R.isWon(a)?1:0)||String(b.updated||b.created||'').localeCompare(String(a.updated||a.created||'')));
  return hit[0];
 }
 const dupKey=d=>siteIdOf(d)||R.normSite(d.site||'');
 function linkSite(d){
  S.linked={id:siteIdOf(d),site:d.site||'',owner:R.repN(d.assignee)||'',status:statusOf(d),work:workOf(d)};S.siteId=S.linked.id;S.site=d.site||S.site;if(!S.address&&d.address)S.address=d.address;
  /* 관리소장 승계: 비어 있는 칸만 지난 기록으로 채운다 */
  const c=d.contact||{},nm=d.manager_name||c.managerName||'',mb=d.manager_mobile||c.managerMobile||'',of=d.office_phone||c.officeTel||'';
  if(!S.cname&&nm){S.cname=nm;S.role=ROLES.includes(d.manager_role)?d.manager_role:ROLES[0];}if(!S.mobile&&mb)S.mobile=fmtPhone(mb);if(!S.office&&of)S.office=fmtPhone(of);
  S.finding=false;S.findQ='';
 }
 /* ── 그리기 ── */
 function ownerOptions(){
  let html='';try{html=R.newDealOwnerOptions();}catch(e){}
  const tmp=doc.createElement('select');tmp.innerHTML=html;const me=R.ME&&R.repN(R.ME.name);
  const opts=[...tmp.options].filter(o=>o.value&&o.value!=='미배정');
  if(!S.owner&&me&&opts.some(o=>o.value===me))S.owner=me;/* 기본 = 나(영업을 맡을 수 있는 사람일 때) */
  return '<option value=""'+(S.owner?'':' selected')+'>담당 선택</option>'+opts.map(o=>'<option value="'+attr(o.value)+'"'+(o.value===S.owner?' selected':'')+'>'+h(o.value)+(o.value===me?' (나)':'')+'</option>').join('');
 }
 function dupHtml(){
  if(S.linked)return '<div class="nd2-dup on" data-nd2-dup><span class="k">이 현장의 다른 공사로 등록</span><b>'+h(S.linked.site)+'</b><span class="m">'+h([S.linked.owner,S.linked.status,S.linked.work].filter(Boolean).join(' · '))+'</span><i></i><button type="button" class="nd2-b" data-nd2="unlink">연결 풀기</button></div>';
  const d=dupOf();if(!d||S.dupSkip===dupKey(d))return '';
  return '<div class="nd2-dup" data-nd2-dup><span class="k">같은 현장일 수 있어요</span><b>'+h(d.site||'')+'</b><span class="m">'+h([R.repN(d.assignee)||'미배정',statusOf(d),workOf(d)].filter(Boolean).join(' · '))+'</span><i></i><button type="button" class="nd2-b dark" data-nd2="link" data-id="'+attr(d.id)+'">이 현장에 다른 공사로 추가</button><button type="button" class="nd2-b" data-nd2="skip" data-k="'+attr(dupKey(d))+'">다른 현장</button></div>';
 }
 function findHtml(){
  const q=R.normSite(S.findQ),list=!q?[]:(R.B&&R.B.deals||[]).filter(d=>siteIdOf(d)&&R.normSite(d.site||'').includes(q)).sort((a,b)=>(R.isWon(b)?1:0)-(R.isWon(a)?1:0)).filter((d,i,a)=>a.findIndex(x=>siteIdOf(x)===siteIdOf(d))===i).slice(0,6);
  return '<div class="nd2-find"><input data-nd2-f="findQ" value="'+attr(S.findQ)+'" placeholder="기존 현장 이름으로 찾기" aria-label="기존 현장 찾기">'+(q?(list.length?list.map(d=>'<button type="button" data-nd2="link" data-id="'+attr(d.id)+'"><b>'+h(d.site||'')+'</b><span>'+h([R.repN(d.assignee)||'미배정',statusOf(d),workOf(d)].filter(Boolean).join(' · '))+'</span></button>').join(''):'<p>찾는 현장이 없습니다 — 아래에 새 현장으로 적어 주세요</p>'):'')+'</div>';
 }
 function srcExtra(){
  if(S.src==='referral')return '<div class="nd2-ref"><input data-nd2-f="refName" value="'+attr(S.refName)+'" placeholder="소개한 사람 (예: 김OO 소장 · 동탄푸른마을)" aria-label="소개한 사람" maxlength="200"><input data-nd2-f="refPhone" value="'+attr(S.refPhone)+'" placeholder="소개한 사람 연락처 · 선택" aria-label="소개한 사람 연락처" inputmode="tel" maxlength="40"></div>';
  if(S.src==='re_sales')return '<div class="nd2-re"><span>기존 고객 현장을 고르면 지난 공사 · 관리소장 · 이력이 자동으로 이어집니다 · <button type="button" class="nd2-lnk" data-nd2="find">'+(S.finding?'찾기 닫기':'[기존 현장 찾기]')+'</button></span>'+(S.finding?findHtml():'')+'</div>';
  return '';
 }
 function worksHtml(){
  const n=S.works.length;
  return '<div class="nd2-sec" data-nd2-works><div class="nd2-lab"><b>공종 <em>*</em></b><span>여러 개 고르면 복합공종</span><i></i><span class="nd2-wk'+(n?'':' none')+'">'+(n?n+'개 · '+(n>1?'복합공종':'단일'):'아직 선택 안 함')+'</span></div><div class="nd2-wgroups">'
   +(R.WORK_MASTER||[]).map(g=>'<div class="nd2-wg"><span>'+h(g.group)+'</span>'+g.items.map(i=>{const k=R.workKey(g.group,i),on=S.works.includes(k);return '<button type="button" class="nd2-chip'+(on?' on':'')+'" data-nd2="work" data-k="'+attr(k)+'" aria-pressed="'+on+'">'+h(i)+'</button>';}).join('')+'</div>').join('')+'</div></div>';
 }
 function footText(){return '등록하면 <b>파이프라인 · 컨설팅 설계 (미팅 전)</b>로 바로 들어갑니다 · 유입 = <b>'+h(SRC_SHORT[S.src])+'</b> (견적문의 · 인바운드 통계와 따로 집계)';}
 function html(){
  return '<div class="nd2-box" role="dialog" aria-modal="true" aria-labelledby="nd2-title"><header class="nd2-head"><b id="nd2-title">새 영업 등록</b><span>문의 없이 우리가 먼저 시작한 영업 · 아웃바운드 · 소개 · 재영업</span><i></i><button type="button" class="nd2-x" data-nd2="close" aria-label="닫기">×</button></header>'
   +'<div class="nd2-body">'
   +'<div class="nd2-sec"><b class="nd2-t">어떻게 시작했나요 <em>*</em></b><div class="nd2-srcs" role="group" aria-label="유입 방식">'+SRC.map(s=>'<button type="button" class="nd2-src'+(S.src===s[0]?' on':'')+'" data-nd2="src" data-v="'+s[0]+'" aria-pressed="'+(S.src===s[0])+'"><b>'+h(s[1])+'</b><span>'+h(s[2])+'</span></button>').join('')+'</div><div data-nd2-srcx>'+srcExtra()+'</div></div>'
   +'<div class="nd2-g2"><label class="nd2-f">현장명 <small>[광역 지역] 현장명 · 주소 넣으면 지역 자동</small><input data-nd2-f="site" value="'+attr(S.site)+'" placeholder="예: [서울 마포] 현진에버빌아파트" maxlength="300"'+(S.linked?' readonly':'')+'></label>'
   +'<label class="nd2-f">현장 주소 <small>지도 확인하면 근처 현장도 보여요</small><span class="nd2-addr"><input data-nd2-f="address" value="'+attr(S.address)+'" placeholder="예: 경기 수원시 영통구 …" maxlength="1000"><button type="button" class="nd2-b" data-nd2="map">지도 확인</button></span></label><div class="nd2-dupslot" data-nd2-dupslot>'+dupHtml()+'</div></div>'
   +worksHtml()
   +'<div class="nd2-g3"><label class="nd2-f"><span>브랜드 <em>*</em></span><select data-nd2-f="brand">'+BRANDS.map(b=>'<option'+(S.brand===b?' selected':'')+'>'+h(b)+'</option>').join('')+'</select></label>'
   +'<label class="nd2-f"><span>담당 <em>*</em></span><select data-nd2-f="owner">'+ownerOptions()+'</select></label>'
   +'<label class="nd2-f"><span>예상 금액 <small>모르면 비워 두기</small></span><input data-nd2-f="amount" value="'+attr(S.amount)+'" placeholder="예: 1.5억" inputmode="decimal"></label></div>'
   +'<div class="nd2-sec"><div class="nd2-lab"><b>처음 만난 사람</b><span>이름 + 연락처 하나 이상</span></div><div class="nd2-person"><select data-nd2-f="role" aria-label="역할">'+ROLES.map(r=>'<option'+(S.role===r?' selected':'')+'>'+h(r)+'</option>').join('')+'</select><input data-nd2-f="cname" value="'+attr(S.cname)+'" placeholder="이름 *" aria-label="이름" maxlength="200"><input data-nd2-f="mobile" value="'+attr(S.mobile)+'" placeholder="휴대폰 010-0000-0000" aria-label="휴대폰" inputmode="tel"><input data-nd2-f="office" value="'+attr(S.office)+'" placeholder="관리사무소 대표전화" aria-label="관리사무소 대표전화" inputmode="tel"></div></div>'
   /* 시작 근거: 기존 근거 입력(직접 입력 · 음성 기록)의 동작을 그대로 쓴다 */
   +'<div class="nd2-sec nd2-why" id="nd2-why" data-src="text"><div class="nd2-lab"><b>어떻게 시작됐는지 한 줄 <em>*</em></b><i></i><div class="rmode nd2-mode"><button type="button" class="on" data-m="text" onclick="reasonMode(\'nd2-why\',\'text\')">직접 입력</button><button type="button" data-m="voice" onclick="reasonMode(\'nd2-why\',\'voice\')">음성 기록</button></div></div>'
   +'<textarea id="nd2-why-text" placeholder="예: 동탄 현장 소장님 소개 · 내년 재도장 입찰 예정 · 기술자문으로 접근" maxlength="2000"></textarea><div class="rvoice" style="display:none"><button type="button" class="recbtn" id="nd2-why-rec" onclick="reasonRec(\'nd2-why\')">녹음 시작</button><span class="rhint" id="nd2-why-hint">말하면 자동으로 텍스트가 됩니다. 저장 전에 고칠 수 있습니다.</span></div></div>'
   +'<div class="nd2-g2"><label class="nd2-f"><span>첫 다음 행동 <em>*</em></span><select data-nd2-f="act">'+ACTS.map(a=>'<option value="'+a[0]+'"'+(S.act===a[0]?' selected':'')+'>'+h(a[1])+'</option>').join('')+'</select></label>'
   +'<label class="nd2-f"><span>날짜 <em>*</em></span><span class="nd2-date"><input type="text" readonly data-nd2="pickdue" data-nd2-due value="'+attr(fmtDue(S.due))+'" placeholder="날짜 고르기" aria-label="날짜"><input type="date" class="nd2-date-n" data-nd2-f="due" value="'+attr(S.due)+'" min="'+today()+'" tabindex="-1" aria-label="날짜 고르기"></span></label></div>'
   +'<p class="nd2-err" data-nd2-err role="alert"'+(S.err?'':' hidden')+'>'+h(S.err)+'</p></div>'
   +'<footer class="nd2-foot"><span data-nd2-foot>'+footText()+'</span><button type="button" class="nd2-b big" data-nd2="close">취소</button><button type="button" class="nd2-b big pri" data-nd2="save">영업 등록</button></footer></div>';
 }
 const $=q=>box&&box.querySelector(q);
 const paintDup=()=>{const el=$('[data-nd2-dupslot]');if(el)el.innerHTML=dupHtml();};
 const fail=m=>{S.err=m;const e=$('[data-nd2-err]');if(e){e.textContent=m;e.hidden=!m;}};
 function redraw(focus){
  const why=$('#nd2-why-text'),txt=why?why.value:'',mode=$('#nd2-why')?$('#nd2-why').dataset.src:'text',top=$('.nd2-body')?$('.nd2-body').scrollTop:0;
  box.innerHTML=html();const w2=$('#nd2-why-text');if(w2)w2.value=txt;if(mode==='voice'&&typeof R.reasonMode==='function')try{R.reasonMode('nd2-why','voice');}catch(e){}
  if($('.nd2-body'))$('.nd2-body').scrollTop=top;if(focus){const f=$(focus);if(f){f.focus();try{const n=f.value.length;f.setSelectionRange(n,n);}catch(e){}}}
 }
 function close(){if(!box)return;doc.removeEventListener('keydown',onKey,true);box.remove();box=null;S=null;}
 function onKey(e){if(e.key==='Escape'&&box&&!(S&&S.busy)){e.stopPropagation();close();}}
 function onInput(e){
  const f=e.target&&e.target.dataset?e.target.dataset.nd2F:'';if(!f||!S)return;
  /* 값이 그대로면 다시 그리지 않는다 — 칸에서 빠져나올 때(change) 다시 그리면 누르려던 버튼이 바뀌어 눌리지 않는다 */
  if(S[f]===e.target.value)return;S[f]=e.target.value;
  if(f==='site'||f==='address'||f==='office')paintDup();
  if(f==='findQ'){redraw('[data-nd2-f="findQ"]');return;}
  if(f==='due'){const d=$('[data-nd2-due]');if(d)d.value=fmtDue(S.due);}
  if(f==='act'){const ft=$('[data-nd2-foot]');if(ft)ft.innerHTML=footText();}
  if(S.err)fail('');
 }
 function onBlur(e){const f=e.target&&e.target.dataset?e.target.dataset.nd2F:'';if(!S||!['mobile','office','refPhone'].includes(f))return;const v=fmtPhone(e.target.value);if(v!==e.target.value){e.target.value=v;S[f]=v;}}
 function onClick(e){
  if(e.target===box&&S&&!S.busy)return close();
  const b=e.target.closest('[data-nd2]');if(!b||!S||b.disabled)return;const a=b.dataset.nd2;
  if(a==='close'){if(!S.busy)close();return;}
  if(a==='src'){S.src=b.dataset.v;if(S.src!=='re_sales')S.finding=false;return redraw();}
  if(a==='work'){const k=b.dataset.k,i=S.works.indexOf(k);if(i>=0)S.works.splice(i,1);else S.works.push(k);const el=$('[data-nd2-works]');if(el)el.outerHTML=worksHtml();if(S.err)fail('');return;}
  if(a==='map'){const ad=String(S.address||'').trim();if(!ad){fail('현장 주소를 먼저 입력해 주세요.');$('[data-nd2-f="address"]')?.focus();return;}R.open('https://map.kakao.com/link/search/'+encodeURIComponent(ad),'_blank','noopener');return;}
  if(a==='link'){const d=(R.B.deals||[]).find(x=>String(x.id)===b.dataset.id);if(d){linkSite(d);redraw();}return;}
  if(a==='unlink'){S.linked=null;S.siteId=null;return redraw('[data-nd2-f="site"]');}
  if(a==='skip'){S.dupSkip=b.dataset.k;return paintDup();}
  if(a==='find'){S.finding=!S.finding;return redraw(S.finding?'[data-nd2-f="findQ"]':null);}
  if(a==='pickdue'){e.preventDefault();const n=$('[data-nd2-f="due"]');if(n){try{n.showPicker();}catch(err){try{n.focus();n.click();}catch(e2){}}}return;}
  if(a==='save')return R.saveNewDeal();
 }
 /* ── 저장: 기존 영업 생성 명령 하나 ── */
 function save(){
  if(S.busy)return;
  const site=R.standardSiteTitle(String(S.site||'').trim(),String(S.address||'').trim()),address=String(S.address||'').trim();
  const works=S.works.map(k=>R.workParts(k)).filter(Boolean),primary=works[0]||null,multi=works.length>1;
  const amount=parseAmount(S.amount),mobile=digits(S.mobile),office=digits(S.office),cname=String(S.cname||'').trim(),why=typeof R.reasonValue==='function'?R.reasonValue('nd2-why'):'';
  const act=ACTS.find(x=>x[0]===S.act),owner=String(S.owner||'');
  if(!SRC_SHORT[S.src])return fail('어떻게 시작했는지 골라 주세요.');
  if(!site)return fail('현장명을 입력해 주세요.');
  if(!works.length)return fail('공종을 하나 이상 골라 주세요.');
  if(!BRANDS.includes(S.brand))return fail('브랜드를 골라 주세요.');
  if(!owner||owner==='미배정')return fail('담당을 골라 주세요.');
  try{if(!R.PeopleEligibility.allowed(R.SALES_PEOPLE_MASTER,'new_sales',{},owner))return fail('영업을 맡을 수 있는 사람을 담당으로 골라 주세요.');}catch(e){}
  if(Number.isNaN(amount)||(amount!==null&&(!Number.isSafeInteger(amount)||amount<0)))return fail('예상 금액은 1.5억 · 3,000만 · 150,000,000 처럼 적어 주세요.');
  if(!cname)return fail('처음 만난 사람의 이름을 입력해 주세요.');
  if(!mobile&&!office)return fail('휴대폰이나 관리사무소 대표전화 가운데 하나는 입력해 주세요.');
  if(mobile&&(mobile.length<10||mobile.length>20))return fail('휴대폰 번호를 확인해 주세요.');
  if(office&&(office.length<8||office.length>20))return fail('관리사무소 대표전화를 확인해 주세요.');
  if(why.length<5)return fail('어떻게 시작됐는지 한 줄(5자 이상)을 남겨 주세요.');
  if(!act)return fail('첫 다음 행동을 골라 주세요.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(S.due))return fail('첫 다음 행동의 날짜를 정해 주세요.');
  if(S.due<today())return fail('첫 다음 행동 날짜는 오늘부터 고를 수 있습니다.');
  const at=R.isoNow(),personKey=mobile?'mobile:'+mobile:'office:'+office+':'+cname,keys=works.map(w=>w.key),summary=R.workSummaryFrom(works),scope=multi?'multi':'single',src=typeof R.reasonSource==='function'?R.reasonSource('nd2-why'):'text';
  const refName=S.src==='referral'?String(S.refName||'').trim():'',refPhone=S.src==='referral'?digits(S.refPhone):'';
  const contact={officeTel:office,officeEmail:'',managerName:cname,managerMobile:mobile,managerRole:S.role,personKey,currentSite:site,status:'current',startedAt:at};
  const id='new-'+Date.now(),naId='local-na-'+Date.now();
  const nd={id,brand:S.brand,list:S.brand,site,address,stage:'견적문의 접수',code:'first_contact',grp:'영업·관리',assignee:owner,amt:amount||null,created:at,updated:at,lastActivity:at,
   work:summary,work_name:summary,primaryWork:primary.key,workItems:keys,workScopeType:scope,workSummary:summary,work_type:primary.item,originBusiness:S.brand,currentBusiness:S.brand,businessHistory:[],contact,
   sourceOpportunityId:null,source_opportunity_id:null,originSource:'direct',origin_source:'direct',source_type:S.src,source:S.src,list_fields:Object.assign({source_type:S.src},refName?{referrer_name:refName}:{},refPhone?{referrer_phone:refPhone}:{}),
   office_phone:office||null,manager_name:cname,manager_mobile:mobile||null,manager_role:S.role,person_key:personKey,
   next_action:{id:naId,type:act[2],text:act[1],due:S.due,status:'open'},
   activities:[{id:'local-'+Date.now(),type:'영업등록',note:summary+' · '+SRC_SHORT[S.src],result:why,at,actor:owner}]};
  if(S.siteId){nd.site_id=S.siteId;nd.cleanup_site_id=S.siteId;}
  const payload={name:site,work_name:summary,work_type:primary.item,primaryWork:primary.key,workItems:keys,workScopeType:scope,workSummary:summary,primary_work:primary.key,work_items:keys,work_scope_type:scope,work_summary:summary,
   brand:S.brand,owner,address:address||null,amount:amount||null,reason:why,reason_source:src,origin:S.brand,at,manager_name:cname,manager_role:S.role,person_key:personKey,contact_started_at:at,
   source_opportunity_id:null,origin_source:'direct',client_ref:id,source_type:S.src,first_action_type:act[2],first_action_title:act[1],first_action_due:S.due};
  if(office)payload.office_phone=office;if(mobile)payload.manager_mobile=mobile;if(refName)payload.referrer_name=refName;if(refPhone)payload.referrer_phone=refPhone;if(S.siteId)payload.site_id=S.siteId;
  S.busy=true;
  try{
   try{R.upsertPerson(contact,site,office,at,S.siteId||undefined);}catch(e){}
   R.B.deals.push(nd);
   R.pushWrite('opportunity_create',payload);
   R.saveLocal();
  }catch(e){S.busy=false;const i=R.B.deals.indexOf(nd);if(i>=0)R.B.deals.splice(i,1);return fail('등록하지 못했습니다 — '+String((e&&e.message)||e));}
  const label=SRC_SHORT[S.src];close();
  try{R.paint();}catch(e){}
  const msg=site+' · '+summary+' 영업을 등록했습니다 — 파이프라인 · 컨설팅 설계 · 유입 '+label;
  if(typeof R.toast==='function')R.toast(typeof R.saveMsg==='function'?R.saveMsg(msg):msg);else R.alert(msg);
 }
 function openV2(){
  if(box)return;S=st0();
  box=doc.createElement('div');box.className='nd2-shade';box.id='newDealV2';box.innerHTML=html();
  box.addEventListener('click',onClick);box.addEventListener('input',onInput);box.addEventListener('change',onInput);box.addEventListener('focusout',onBlur);
  doc.addEventListener('keydown',onKey,true);doc.body.appendChild(box);
  R.setTimeout(()=>{const x=$('[data-nd2-f="site"]');if(x)x.focus();},30);
 }
 /* 저장 함수는 스크립트가 읽히는 즉시 끼워 둔다 — 전송 계층(operational-overlay)이 saveNewDeal 을 'PC 직접 등록'으로 감싸기 전에 들어가야 이 창의 저장도 같은 길로 나간다 */
 if(typeof R.saveNewDeal==='function'&&!R.saveNewDeal.__nd2){const baseSave=R.saveNewDeal,wrappedSave=function(){return S&&box?save():baseSave.apply(this,arguments);};wrappedSave.__nd2=true;R.saveNewDeal=wrappedSave;}
 /* 서버가 만든 첫 다음 행동의 번호를 화면의 영업건에 맞춘다 */
 function adoptNext(){
  try{(R.Phase1.queue.list()||[]).forEach(q=>{const a=q.ack;if(q.operation!=='opportunity_create'||!a||!a.next_action_id||!q.payload||!q.payload.first_action_title)return;const d=(R.B&&R.B.deals||[]).find(x=>String(x.id)===String(a.new_opportunity_id));if(d&&d.next_action&&String(d.next_action.id).indexOf('local-na-')===0)d.next_action.id=a.next_action_id;});}catch(e){}
 }
 function boot(){
  R.addEventListener('phase1:queue',adoptNext);
  const base=R.openNewDeal;if(typeof base!=='function'||base.__nd2)return;
  const wrapped=function(){
   if(!enabled())return base.apply(this,arguments);
   const args=arguments,self=this;
   if(ready===true)return openV2();
   if(ready===false)return base.apply(self,args);
   check().then(ok=>{if(ok&&enabled())openV2();else base.apply(self,args);});
  };
  wrapped.__nd2=true;R.openNewDeal=wrapped;
  R.addEventListener('phase1:identity-cleared',()=>{ready=null;close();});
 }
 R.NewDealV2={open:openV2,close,enabled,check,sourceOf,isOutbound,parseAmount,SRC:SRC_SHORT,_reset:()=>{ready=null;}};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
