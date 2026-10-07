/* 데이터 정리 · 검토 v2 (2026-10-02 디자인 핸드오프 'design_handoff_dup') — 데이터 정리 · 검토 메뉴(#p=dup)만.
   목록: 안내 줄(확실 · 애매 · 다른 건 · 처리 완료) → 진단(숫자 4 · 카드 3 · '다시 안 생기게' 과제) → 판단 띠 → 묶음 표(확실 → 애매 → 다른 건)
   비교 창(760px): 판단 박스 + A | B 비교 표(다른 값은 노란 칸) + [그대로 두기] [연결만] [합치기]
   후보 계산 · "왜 잡혔나요" 근거 · [후보 다시 계산] · 처리 이력은 기존 그대로(CleanupCore · DataCleanupUI).
   ※ 판단은 지금은 규칙(근거 조합)이다 — 확률(%)을 지어내지 않고 확실 / 애매 / 다른 건으로만 나눈다. Claude API 판단은 서버 함수 설치 뒤에 바꿔 끼운다(결과는 저장만).
   ※ 실제 합치기 · 연결은 기존 서버 경로(미리보기 → 확인 → 처리)가 운영에서 켜졌을 때만, 한 건씩, 사유를 적고 한다. 한 번에 승인 · 30일 되돌리기는 구조 확인 뒤에 연다(지금은 잠김).
   끄기: G.dupV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const enabled=()=>!root.G.dupV2Off&&!!root.DataCleanupUI&&typeof root.DataCleanupUI.active==='function';
 const KIND={site:'현장',inquiry:'문의',contact:'연락처',deal:'영업기회'};
 /* 묶음(2026-10-06 design_handoff_followup4 ④): '확실한 같은 건' → 같은 공사 · 합치기 검토(같은 현장 + 같은 공종 · 같은 시기) / 같은 현장 · 다른 공사(공종 · 시기가 다름 → 그대로 두기 · 같은 현장으로만 묶음) */
 const BAND={work:['같은 공사 · 합치기 검토','g','#30a46c','같은 현장 + 같은 공종 · 같은 시기 요청 — 같은 상담 연결 또는 합치기'],site:['같은 현장 · 다른 공사','s','#3b6ce4','현장은 같지만 공종 · 시기가 다름 — 그대로 두기 · 같은 현장으로만 묶음'],maybe:['애매 · 확인 필요','a','#f5a524','사람이 비교해서 정해야 하는 쌍 — 같은 현장까지 맞아도 공종 · 범위 · 시기를 모르면 같은 공사로 보지 않음'],unk:['확인 불가','u','#9ca3af','현장명 · 주소가 비어 있거나 식별 근거가 없음 — 자료를 보완한 뒤 판단'],diff:['다른 건','m','#9ca3af','겹쳐 보이지만 따로 두는 것이 맞는 쌍']};
 const ORDER=['work','site','maybe','unk','diff']; const SUGGEST={site_merge:'합치기',inquiry_merge:'합치기',deal_review:'비교 후 판단',site_link:'연결만',inquiry_activity:'연결만',contact_move:'사람 · 근무지 확인',separate:'그대로 두기',different_person:'그대로 두기',defer:'정보 보완 뒤 판단'};
 const GRID='minmax(0,1.7fr) 110px minmax(0,1.5fr) 110px 84px';
 const st=()=>root.G.dupV2||(root.G.dupV2={f:'all',more:{}});
 const ICL=()=>root.InquiryConsultationLink&&root.InquiryConsultationLink.on()?root.InquiryConsultationLink:null;
 /* 규칙 판단: 근거가 몇 개 겹치는지로 묶음만 정한다.
    2026-10-07 data_review_rules: 주소 · 현장명이 맞으면 '같은 현장'까지다 — '같은 공사'는 공종 · 범위 · 추진 시기까지 맞아야 한다.
    공종을 모르면 '같은 현장 · 공사 확인 필요'(애매) · 공종이 다르면 '같은 현장 · 다른 공사'(현장만 묶기) · 빈 값 · '미입력'은 일치 근거로 안 쓴다(식별 근거가 없으면 '확인 불가') */
 const CC=()=>root.CleanupCore||{};
 const valid=v=>{const c=CC();return c.blank?!c.blank(v):!!String(v||'').trim();};
 const worksOf=r=>(r.works||[]).filter(valid).map(w=>CC().norm(w)).sort().join('|');
 function workState(c){const ok=r=>r&&r.ref&&(r.ref.type==='inquiry'||r.ref.type==='deal');if(!ok(c.a)||!ok(c.b))return 'n/a';const a=worksOf(c.a),b=worksOf(c.b);return !a||!b?'unknown':a===b?'same':'diff';}
 const siteEvidence=c=>(c.reasons||[]).some(x=>/주소 동일|현장 ID 동일|현장명 표기 일치|주소 표기 정규화 일치/.test(x));
 function judge(c){
  if(c.unknown)return 'unk';
  const R=c.reasons||[],has=t=>R.some(x=>x.indexOf(t)>=0),strong=[has('주소 동일'),has('관리사무소 전화 동일'),has('현장명 표기 일치'),has('1일 이내 문의 접수'),has('관리소장 휴대전화 동일')].filter(Boolean).length;
  if(c.action==='separate')return 'diff';
  let band='maybe';
  if(c.action==='inquiry_merge')band=strong>=2?'work':'maybe';
  else if(c.action==='site_merge')band=has('주소 동일')&&(has('관리사무소 전화 동일')||has('현장명 표기 일치'))?'work':'maybe';
  else if(c.action==='deal_review')band=has('동일 공종')&&(has('주소 동일')||has('현장 ID 동일')||has('현장명 표기 일치'))?'work':'maybe';
  /* 같은 현장이지만 공종 · 사업유형 · 시기가 다른 복수 영업 = 같은 현장 · 다른 공사 */
  else if(c.action==='site_link')band=has('주소 동일')||has('현장 ID 동일')||has('현장명 표기 일치')?'site':'maybe';
  if(band==='work'&&(c.type==='inquiry'||c.type==='deal')){const ws=workState(c);if(ws==='diff')return 'site';if(ws==='unknown')return 'maybe';}
  return band;
 }
 /* 줄 · 비교 창 문구: 판정 이름 · 근거 · 버튼 · 상태 */
 const TAG={unk:['확인 불가','u'],siteunk:['같은 현장 · 공사 확인 필요','k'],site:['같은 현장 · 다른 공사','s'],work:['같은 공사','g'],maybe:['애매','a'],diff:['다른 건','m']};
 function tagOf(x){return x.band==='maybe'&&siteEvidence(x.c)&&workState(x.c)==='unknown'?TAG.siteunk:TAG[x.band];}
 function whyOf(x){const c=x.c,ws=workState(c),R=(c.reasons||[]).slice();if(x.band==='maybe'&&siteEvidence(c)&&ws==='unknown')R.push('공종 · 범위 · 시기 미확인');if(ws==='diff'&&!R.some(r=>/공종 서로 다름/.test(r)))R.push('공종 다름');return R.join(' · ');}
 const CTA={work:['승인','판단 확정 전'],site:['현장만 묶기','판단 확정'],maybe:['비교하기','판단 확정 전'],unk:['자료 보완','판단 보류'],diff:['확인','판단 확정']};
 /* 줄마다 A · B: 현장명 · 문의번호 · 브랜드 · 접수 시각 · 연락처 끝자리 · 공종 — 다른 값은 노랑 */
 const tailOf=r=>{const d=String(r.mobile||r.office||'').replace(/\D/g,'');return d?'…'+d.slice(-4):'연락처 없음';};
 const timeOf=at=>{const t=Date.parse(at);if(!Number.isFinite(t))return '접수 시각 없음';const k=new Date(t+9*36e5),p=n=>String(n).padStart(2,'0');return (k.getUTCMonth()+1)+'.'+k.getUTCDate()+' '+p(k.getUTCHours())+':'+p(k.getUTCMinutes());};
 const noOf=r=>{const raw=r.raw||{},n=raw.inquiry_no||raw.no||raw.seq;return (r.ref.type==='inquiry'?'문의 ':r.ref.type==='deal'?'영업 ':'현장 ')+'#'+(n||String(r.ref.id).slice(-6));};
 const metaOf=r=>[noOf(r),r.brand||'브랜드 없음',timeOf(r.at),tailOf(r),(r.works||[]).filter(valid).join(' · ')||'공종 미입력'];
 function abHtml(c){
  const MA=metaOf(c.a),MB=metaOf(c.b),side=(k,r,M,O)=>'<span class="dv-s"><i>'+k+'</i><b'+(valid(r.name)?'':' class="blank"')+'>'+h(valid(r.name)?r.name:'현장명 미입력')+'</b>'+M.map((v,n)=>'<em'+(v!==O[n]?' class="dv-d"':'')+'>'+h(v)+'</em>').join('')+'</span>';
  return '<span class="dv-ab">'+side('A',c.a,MA,MB)+side('B',c.b,MB,MA)+'</span>';
 }
 function model(){
  const U=root.DataCleanupUI,cases=U.active().map(c=>({c,i:U.cases().indexOf(c),band:judge(c)})),reviews=((U.state()||{}).reviews||[]).filter(r=>r.action!=='defer');
  return {cases,reviews,readOnly:U.readOnly(),loading:U.loading()};
 }
 const pairKind=c=>{const t=x=>x.ref.type==='inquiry'?'문의':x.ref.type==='deal'?'영업기회':'현장',a=[t(c.a),t(c.b)].sort();return a[0]===a[1]?a[0]+'끼리':a.join(' ↔ ');};
 function diagnosis(m){
  const D=root.PipelineDiagnosis;if(!D)return '';
  const n=k=>m.cases.filter(x=>x.band===k).length,by=(f)=>{const map=new Map();m.cases.forEach(x=>{const k=f(x.c);if(k)map.set(k,(map.get(k)||0)+1);});return [...map].sort((a,b)=>b[1]-a[1]);};
  const why=[['1일 내 재접수',m.cases.filter(x=>x.c.reasons.some(r=>r.includes('1일 이내'))).length],['표기 차이(이름만 비슷)',m.cases.filter(x=>x.c.reasons.some(r=>r.includes('현장명 유사'))).length],['같은 주소로 따로 등록',m.cases.filter(x=>x.c.reasons.some(r=>r.includes('주소 동일'))).length],['같은 전화로 따로 등록',m.cases.filter(x=>x.c.reasons.some(r=>r.includes('전화 동일'))).length]].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  const K=(label,value,sub,tone)=>({label,value,sub,tone:tone||''}),inq=m.cases.filter(x=>x.c.type==='inquiry'&&x.c.action==='inquiry_merge').length,site=m.cases.filter(x=>x.c.type==='site').length;
  const tasks=[[inq,'같은 전화 · 1일 내 재접수 '+inq+'건','7일 내 같은 전화는 후보로 띄우고, 현장 · 공종 확인 후 연결하게 접수 규칙 정하기','관리팀 · 이번 주','문의 재접수'],[site,'현장 겹침 '+site+'건','현장을 등록할 때 주소로 기존 현장을 먼저 찾아보기','영업팀 · 등록할 때','현장 중복 등록'],[n('maybe'),'애매한 건 '+n('maybe')+'건','애매한 건은 주 1회 10분 검토','관리팀 · 매주','애매한 건 검토']].filter(t=>t[0]>0).map(t=>({basis:t[1],todo:t[2],who:t[3],label:t[4],count:t[0]}));
  return D.render({accent:'blue',
   kpis:[K('검토 후보',m.cases.length+'건','쌍 기준 · 지금 불러온 자료'),K('같은 공사',n('work')+'건','합치기 검토','good'),K('같은 현장 · 다른 공사',n('site')+'건','같은 현장으로만 묶음'),K('애매',n('maybe')+'건','사람이 비교 · 다른 건 '+n('diff'),n('maybe')?'warn':'')],
   cards:[{title:'무엇이 겹치나',desc:'종류별 쌍',bars:by(c=>KIND[c.type]),empty:'겹치는 후보가 없습니다'},{title:'왜 생기나',desc:'잡힌 근거',bars:why,empty:'근거가 없습니다'},{title:'생기는 곳',desc:'어느 자료끼리',bars:by(pairKind),empty:'후보가 없습니다'}],
   action:{title:'다시 안 생기게',desc:'데이터 정리에서 나온 과제',tasks}},{open:true,noToggle:true,scope:'dup'});
 }
 function rowHtml(x){
  const c=x.c,tg=tagOf(x),cta=CTA[x.band]||CTA.diff;
  return '<div class="plv-row dv-r" role="row" tabindex="0" data-dv="open" data-value="'+x.i+'" style="grid-template-columns:'+GRID+'"><span class="plv-c plv-site"><b title="'+attr(c.a.name+' ↔ '+c.b.name)+'">'+h(c.a.name)+' <i class="dv-arrow">↔</i> '+h(c.b.name)+'</b><small>'+h(KIND[c.type]||c.type)+' · '+h(pairKind(c))+'</small>'+abHtml(c)+'</span>'
   +'<span class="plv-c"><em class="plv-tag '+tg[1]+'">'+h(tg[0])+'</em></span><span class="plv-c"><span title="'+attr(whyOf(x))+'">'+h(whyOf(x))+'</span></span><span class="plv-c"><em class="plv-tag m">'+h(c.action==='site_link'?'현장만 묶기':SUGGEST[c.action]||c.action)+'</em></span>'
   +'<span class="plv-c dv-ctac"><button type="button" class="plv-cta" data-dv="open" data-value="'+x.i+'">'+cta[0]+'</button><small>'+cta[1]+'</small></span></div>';
 } function listHtml(m){
  const S=st(),n=k=>m.cases.filter(x=>x.band===k).length;
  const pills='<div class="plv-pills" role="group" aria-label="판단">'+[['all','전체',m.cases.length]].concat(ORDER.map(k=>[k,BAND[k][0],n(k)]),[['done','처리 완료',m.reviews.length]]).map(([v,t,c])=>'<button type="button" data-dv="filter" data-value="'+v+'" aria-pressed="'+(S.f===v)+'">'+h(t)+' <b>'+c+'</b></button>').join('')+'</div>';
  const intro='<div class="plv-intro"><i style="background:#64748b"></i><b>데이터 정리 · 검토</b><span>먼저 판단해 둡니다 — 같은 공사는 빨리 승인, 같은 현장 · 다른 공사는 그대로 두고, 애매한 건만 사람이 봅니다</span><div class="plv-spacer"></div>'+pills+'<button type="button" class="sv-ghost" data-dv="refresh">'+(m.loading?'확인 중…':'후보 다시 계산')+'</button></div>';
  const band='<section class="dv-band"><div><b>'+m.cases.length+'건 중 '+n('work')+'건은 같은 공사로 보여요 · 같은 현장 · 다른 공사 '+n('site')+'건 · 사람이 볼 건 '+n('maybe')+'건입니다</b><span>규칙 판단(근거 조합)입니다 · 승인하기 전에는 데이터가 바뀌지 않습니다'+(m.readOnly?' · 지금은 검토 전용 — 합치기 · 연결은 운영 확인 뒤 관리자만 켭니다':'')+'</span></div><button type="button" disabled title="한 번에 승인과 30일 되돌리기는 구조 확인 뒤에 열립니다">같은 공사 '+n('work')+'건 한 번에 승인</button></section>';
  let table;
  if(S.f==='done')table='<div class="plv-table" role="table" aria-label="처리 이력"><div class="plv-ghead"><i style="background:#30a46c"></i><b>처리 완료</b><span>'+m.reviews.length+'건</span><small>· 서버에 남은 처리 이력</small></div>'+(m.reviews.length?m.reviews.map(r=>'<div class="dv-hist"><b>'+h(r.source_name)+' → '+h(r.target_name)+'</b><span>'+h(SUGGEST[r.action]||r.action)+' · '+h(r.actor||'')+' · '+h(String(r.created_at||'').slice(0,10))+'</span><small>'+h(r.note||'')+'</small></div>').join(''):'<div class="plv-empty">서버에 확인된 처리 이력이 없습니다</div>')+'</div>';
  else{
   const head='<div class="plv-thead" role="row" style="grid-template-columns:'+GRID+'"><span>대상 (A ↔ B) · 종류</span><span>판단</span><span>근거</span><span>제안</span><span></span></div>';
   const groups=ORDER.filter(k=>S.f==='all'||S.f===k).map(k=>{const b=BAND[k],list=m.cases.filter(x=>x.band===k),__pg=root.ListPager.cut(list,(S.more[k]||0)+1),shown=__pg.rows,rest=list.length-shown.length;return '<div class="plv-ghead" data-plv-group="'+k+'"><i style="background:'+b[2]+'"></i><b>'+h(b[0])+'</b><span>'+list.length+'건</span><small>· '+h(b[3])+'</small></div>'+(shown.length?shown.map(rowHtml).join(''):'<div class="plv-empty">해당하는 건이 없습니다</div>')+root.ListPager.html(__pg,{ns:'dv',attrs:'data-value="'+k+'"',small:true});}).join('');
   table='<div class="plv-table" role="table" aria-label="중복 후보">'+head+groups+'<p class="dv-legend"><b>[판단 확정]</b> = 이 쌍의 관계만 기록 · 데이터 안 바뀜 &nbsp;/&nbsp; <b>[합치기 실행]</b> = 관리자 · 영향 미리보기 확인 후에만 · 같은 전화는 후보를 찾는 조건일 뿐 같은 현장의 근거가 아닙니다</p></div>';
  }
  return intro+diagnosis(m)+band+table;
 }
 /* ── 비교 창 ── */
 function fields(c){
  const typ=r=>r.ref.type==='inquiry'?'문의':r.ref.type==='deal'?'영업기회':'현장',amt=r=>r.raw&&r.raw.amt!=null&&typeof root.fmtAmt==='function'&&Number(r.raw.amt)?root.fmtAmt(r.raw.amt):'',hh=r=>r.raw&&(r.raw.household_count||r.raw.households||r.raw.unit_count)||'';
  const F=[['종류',typ],['이름',r=>r.name],['주소',r=>r.address],['관리사무소 전화',r=>r.office?root.phoneFmt(r.office):''],['관리소장 · 휴대전화',r=>[r.customer,r.mobile?root.phoneFmt(r.mobile):''].filter(Boolean).join(' · ')],['세대수',hh],['담당',r=>r.owner||r.consultant],['사업유형',r=>r.brand],['공종',r=>(r.works||[]).join(' · ')],['단계',r=>{try{return r.ref.type==='deal'?root.stageLabel(root.dealStage(r.raw)):(r.raw&&(r.raw.status||r.raw.stage_name)||'');}catch(e){return '';}}],['금액',amt],['등록',r=>String(r.at||'').slice(0,10)],['문의번호',r=>r.ref.type==='inquiry'?noOf(r):''],['접수 시각',r=>r.at?timeOf(r.at):''],['연락처 끝자리',r=>tailOf(r)==='연락처 없음'?'':tailOf(r)]];
  return F.map(([label,f])=>{let a=String(f(c.a)||''),b=String(f(c.b)||'');if(label==='이름'||label==='주소'||label==='공종'){if(!valid(a))a='';if(!valid(b))b='';}return {label,a,b,diff:root.CleanupCore.norm(a)!==root.CleanupCore.norm(b)};}).filter(x=>x.a||x.b);
 }
 function node(){
  let m=document.getElementById('dupDialog');if(m)return m;
  m=document.createElement('div');m.id='dupDialog';m.className='dv-layer';m.innerHTML='<section class="dv-box" role="dialog" aria-modal="true" aria-labelledby="dvTitle"></section>';
  m.addEventListener('mousedown',e=>{if(e.target===m)close();});m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  m.addEventListener('click',e=>{const k=e.target.closest('[data-dk]');if(k){const i=Number(m.dataset.i),c=root.DataCleanupUI.cases()[i];if(c){const K=KEEP();K[c.key]=Object.assign({},K[c.key],{[k.dataset.dk]:k.dataset.v});open(i);}return;}const b=e.target.closest('[data-dd]');if(!b||b.disabled)return;const a=b.dataset.dd,i=Number(m.dataset.i);if(a==='close')return close();close();root.DataCleanupUI.open(i,a);});
  document.body.append(m);return m;
 }
 let focusBack=null;
 function close(){const m=document.getElementById('dupDialog');if(m)m.classList.remove('on');const f=focusBack;focusBack=null;if(f&&f.isConnected)f.focus?.({preventScroll:true});}
 /* 합치기 전 영향 미리보기(2026-10-07 data_review_rules ④⑤): 대표 기록을 '먼저 등록'으로 자동 정하지 않는다 — 항목마다 고르고, 고른 뒤에만 [합치기 실행]이 열린다.
    공종이 다르면 합치기 실행 잠금 + 현장만 묶기 권장 · 공종을 모르면 같은 공사 확인 전까지 잠금 · 검토 전용이면 항상 잠금. 선택값은 이 화면에만 두고 서버 합치기 경로(상담 연결 API 규칙)는 그대로 쓴다 */
 const KEEP=()=>{const S=st();return S.keep||(S.keep={});};
 const ddm=v=>{const s=String(v||'').slice(5,10).replace('-','.');return /^\d{2}\.\d{2}$/.test(s)?s.replace(/^0/,'').replace(/\.0/,'.'):'';};
 const nxOf=r=>{try{if(r.ref.type==='deal'){const a=root.briefNext(r.raw);return a&&a.text?a.text+(a.due?' '+ddm(a.due):''):'';}if(r.ref.type==='inquiry'){const v=root.ContactState.of(r.raw,'inq');return v&&v.next?(v.next.text||'다음 행동')+(v.next.due?' '+ddm(v.next.due):''):'';}}catch(e){}return '';};
 const stOf=r=>{try{return r.ref.type==='deal'?root.stageLabel(root.dealStage(r.raw)):String((r.raw&&(r.raw.status||r.raw.stage_name))||'');}catch(e){return '';}};
 const ownOf=r=>String(r.owner||r.consultant||'');
 const actsOf=r=>{const raw=r.raw||{};let p={};try{p=(root.itemPatch&&root.itemPatch(raw,r.ref.type==='inquiry'?'inq':'deal'))||{};}catch(e){}return (raw.activities||[]).length+(raw.responses||[]).length+((p.activities||[]).length);};
 function preview(c){
  const ws=workState(c),K=KEEP()[c.key]||{},rows=[];
  const row=(k,label,a,b)=>{const r={k,label,a:a||'없음',b:b||'없음',pick:false,keep:''};if(a===b)r.keep=a?'같음 · 유지':'없음';else if(!a)r.keep='B 값';else if(!b)r.keep='A 값';else{r.pick=true;r.sel=K[k]||'';r.keep=r.sel?r.sel+' 값':'';}return r;};
  rows.push(row('own','담당',ownOf(c.a),ownOf(c.b)),row('st','상태',stOf(c.a),stOf(c.b)),row('nx','다음 업무',nxOf(c.a),nxOf(c.b)));
  const wa=(c.a.works||[]).filter(valid).join(' · '),wb=(c.b.works||[]).filter(valid).join(' · ');
  rows.push({k:'work',label:'공종',a:wa||'미입력',b:wb||'미입력',pick:false,keep:ws==='diff'?'두 공종 모두 · 공사 기회 2개':ws==='unknown'?'확인 필요 · 같은 공사 근거 부족':wa?'같음 · 유지':'없음'});
  rows.push({k:'brand',label:'브랜드 · 접수',a:[c.a.brand||'브랜드 없음',timeOf(c.a.at)].join(' · '),b:[c.b.brand||'브랜드 없음',timeOf(c.b.at)].join(' · '),pick:false,keep:'둘 다 원본 보존'});
  const ready=rows.filter(r=>r.pick).every(r=>r.sel);
  const sides=[c.a,c.b],insp=sides.filter(r=>r.ref.type==='inquiry').length,acts=sides.reduce((a,r)=>a+actsOf(r),0),att=sides.reduce((a,r)=>a+(((r.raw||{}).attachments||(r.raw||{}).files||[]).length),0);
  const closed=sides.some(r=>/종결|종료|배드핏|연락두절/.test(stOf(r))),won=sides.some(r=>{try{return r.ref.type==='deal'&&root.isWon(r.raw);}catch(e){return false;}});
  const noun=c.type==='inquiry'?'견적문의':c.type==='deal'?'영업기회':'현장';
  return {rows,ready,ws,box:[['보존','문의 원본 '+insp+'건 · 응대 '+acts+'건 · 첨부 '+att],['집계 변화',noun+' 2 → 1'+(c.type==='inquiry'&&closed?' · 종결 −1':'')+(won?' · 수주 건 포함 — 실적 확인 필요':' · 실적 변화 없음')],['되돌리기','처리 완료 탭 · 30일 안 [연결 해제] · 원본 그대로 복구']]};
 }
 function previewHtml(c,P,band){
  const cell=(r)=>r.pick?'<span class="dv-pk"><button type="button" data-dk="'+r.k+'" data-v="A" aria-pressed="'+(r.sel==='A')+'">A 유지</button><button type="button" data-dk="'+r.k+'" data-v="B" aria-pressed="'+(r.sel==='B')+'">B 유지</button></span>':'<b>'+h(r.keep)+'</b>';
  return '<section class="dv-pv" aria-label="합치기 전 영향 미리보기"><header><b>합치기 전 영향 미리보기</b><span>먼저 등록한 A를 그대로 남기지 않음 · 항목마다 고름</span></header>'
   +'<div class="dv-pvt"><span class="h">항목</span><span class="h">A · 먼저 등록</span><span class="h">B</span><span class="h">유지할 값</span>'+P.rows.map(r=>'<b>'+h(r.label)+'</b><span class="'+(r.a==='없음'||r.a==='미입력'?'g':'')+'">'+h(r.a)+'</span><span class="'+(r.b==='없음'||r.b==='미입력'?'g':'')+'">'+h(r.b)+'</span>'+cell(r)).join('')+'</div>'
   +'<div class="dv-pvb">'+P.box.map(x=>'<div><b>'+h(x[0])+'</b><span>'+h(x[1])+'</span></div>').join('')+'</div></section>';
 }
 function open(i){
  const U=root.DataCleanupUI,c=U.cases()[i];if(!c)return;const band=judge(c),b=BAND[band],ro=U.readOnly(),F=fields(c),ws=workState(c);
  const act=c.type==='contact'?{keep:'different_person',link:'',merge:'contact_move'}:c.type==='inquiry'?{keep:'separate',link:'inquiry_activity',merge:'inquiry_merge'}:c.type==='deal'?{keep:'separate',link:'site_link',merge:'deal_review'}:{keep:'separate',link:'site_link',merge:'site_merge'};
  const siteunk=band==='maybe'&&siteEvidence(c)&&ws==='unknown',title=siteunk?TAG.siteunk[0]:band==='unk'?'확인 불가':b[0];
  const showPv=c.type!=='contact'&&band!=='unk'&&band!=='diff',P=showPv?preview(c):null;
  const mergeable=!ro&&band!=='unk'&&(c.type==='contact'||(band!=='diff'&&(c.type==='site'||ws==='same')))&&(!P||P.ready);
  const lockWhy=band==='unk'?'확인 불가 — 현장명 · 주소 · 공종을 채운 뒤 판단':ws==='diff'?'공종이 달라 같은 공사로 합칠 근거 부족 — 현장만 묶기를 권장':ws==='unknown'?'공종을 몰라 같은 공사인지 확인 필요':P&&!P.ready?'미리보기에서 항목마다 유지할 값을 고른 뒤 열립니다':'';
  const m=node();focusBack=document.activeElement;m.dataset.i=String(i);
  const wa=(c.a.works||[]).filter(valid).join(' · '),wb=(c.b.works||[]).filter(valid).join(' · ');
  const warn=ws==='diff'?'<div class="dv-warn"><b>공종이 다름('+h(wa)+' ↔ '+h(wb)+')</b><span>같은 공사로 합칠 근거 부족 · \'같은 현장 · 다른 공사\'로 현장만 묶기를 권장</span></div>':ws==='unknown'&&band!=='unk'?'<div class="dv-warn"><b>공종을 알 수 없음</b><span>주소 · 현장명이 맞아도 같은 공사는 공종 · 범위 · 추진 시기까지 맞아야 합니다 — 공종을 확인하거나 현장만 묶으세요</span></div>':band==='unk'?'<div class="dv-warn"><b>확인 불가</b><span>현장명 · 주소가 비어 있고 다른 식별 근거가 없습니다 — 같은 전화는 후보를 찾는 조건일 뿐입니다. 자료를 보완한 뒤 판단하세요</span></div>':'';
  const linkBtn=act.link?(ICL()&&c.type==='inquiry'?ICL().footBtn(c):'<button type="button" class="dv-ghost" data-dd="'+act.link+'"'+(ro?' disabled':'')+'>'+(c.type==='inquiry'?'연결만':'현장만 묶기')+'</button>'):'';
  const siteBtn=c.type==='inquiry'&&band!=='unk'&&band!=='diff'&&(ws==='diff'||ws==='unknown')&&siteEvidence(c)?'<button type="button" class="dv-ghost" data-dd="site_link"'+(ro?' disabled':'')+'>현장만 묶기</button>':'';
  m.querySelector('.dv-box').innerHTML='<header class="dv-head"><div><small>'+h(KIND[c.type]||c.type)+' 비교</small><h2 id="dvTitle">'+h(c.a.name)+' ↔ '+h(c.b.name)+'</h2></div><button type="button" class="xdv-close" data-dd="close" aria-label="닫기">✕</button></header>'
   +'<div class="dv-body"><section class="dv-judge '+b[1]+'"><b>판단 · '+h(title)+'</b><span>근거: '+h(c.reasons.join(' · '))+'</span><span>제안: '+h(SUGGEST[c.action]||c.action)+' — '+h(c.text)+'</span><small>규칙 판단입니다(근거 조합). 확률은 표시하지 않습니다. 빈 값 · \'미입력\'은 일치 근거로 쓰지 않습니다.</small>'+(root.OpsStore&&root.OpsStore.aiOn()?'<button type="button" class="dv-ai" data-dd-ai="1">✦ AI 판단 받기</button><span class="dv-aiout" id="dvAiOut"></span>':'')+'</section>'
   +warn+'<div class="dv-cmp" role="table" aria-label="A B 비교"><div class="dv-ch" role="row"><span></span><b>A</b><b>B</b></div>'+F.map(f=>'<div role="row" class="'+(f.diff?'diff':'')+'"><span>'+h(f.label)+'</span><em>'+h(f.a||'–')+'</em><em>'+h(f.b||'–')+'</em></div>').join('')+'</div>'
   +(P?previewHtml(c,P,band):'')
   +'<p class="dv-note">대표 기록은 \'먼저 등록\'으로 자동 정하지 않습니다 — 위 미리보기에서 항목마다 고릅니다. 어떤 원본도 지우지 않습니다.'+(ro?' <b>지금은 검토 전용이라 아래 버튼이 잠겨 있습니다 — 합치기 · 연결이 필요하면 관리자에게 알려 주세요.</b>'+(lockWhy?' <b>'+h(lockWhy)+'</b>':''):lockWhy?' <b>'+h(lockWhy)+'</b>':' 버튼을 누르면 서버의 최신 원본으로 결과를 미리 본 뒤, 사유를 적고 처리합니다.')+'</p></div>'
   +'<footer class="dv-foot"><button type="button" class="dv-ghost" data-dd="'+act.keep+'"'+(ro?' disabled':'')+'>다른 건 · 그대로 두기</button>'+(band==='unk'?'<button type="button" class="dv-ghost" data-dd="defer"'+(ro?' disabled':'')+'>판단 보류 · 자료 보완</button>':linkBtn+siteBtn)+'<button type="button" class="dv-primary" data-dd="'+act.merge+'"'+(mergeable?'':' disabled')+(ro||lockWhy?' title="'+attr(lockWhy||'검토 전용 — 서버 처리 경로가 켜진 뒤 관리자만 실행합니다')+'"':'')+'>'+(c.type==='contact'?'같은 사람 · 이동 연결':'합치기 실행')+'</button></footer>';
  const aiB=m.querySelector('[data-dd-ai]');if(aiB)aiB.onclick=()=>{const out=m.querySelector('#dvAiOut');aiB.disabled=true;aiB.textContent='AI가 비교하는 중…';const row=k=>Object.fromEntries(F.map(f=>[f.label,f[k]]));
   root.OpsStore.ai('dup_judge','pair',c.key,{a:row('a'),b:row('b'),rule_reasons:c.reasons}).then(s=>{const r=s.suggestion||{};out.textContent='AI 판단 · 같은 건일 가능성 '+r.probability+'% · '+(r.basis||'')+' · 제안: '+({merge:'합치기',link:'연결만',keep:'그대로 두기'}[r.action]||'그대로 두기')+' (참고용 — 처리는 아래 버튼으로 직접)';aiB.textContent='✦ AI 판단 다시 받기';}).catch(e=>{out.textContent=String(e.message||e);aiB.textContent='✦ AI 판단 받기';}).finally(()=>{aiB.disabled=false;});};
  m.classList.add('on');(m.querySelector('[data-dk][aria-pressed="true"]')||m.querySelector('.xdv-close')).focus();
  /* 상담 연결(2026-10-06 design_handoff_consultation_link): 문의끼리면 footer 의 그 버튼 · 근거 칸을 inquiry-consultation-link.js 가 맡는다 — 예전 '연결만'(inquiry_activity) 경로는 다시 켜지 않는다 */
  if(ICL()&&c.type==='inquiry')ICL().mount(m,c);
 } function host(){
  const base=document.getElementById('dups');if(!base)return null;let el=document.getElementById('dup-v2');
  if(!el){el=document.createElement('div');el.id='dup-v2';el.className='plv';el.dataset.workspace='dup';base.before(el);el.addEventListener('click',onClick);el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}});}
  return el;
 }
 function onClick(e){
  const b=e.target.closest('#dup-v2 [data-dv]');if(!b)return;const S=st(),a=b.dataset.dv,v=b.dataset.value;
  if(a==='filter'){S.f=v;S.more={};return root.DataCleanupUI.render();}
  if(a==='page'){S.more[v]=(Number(b.dataset.page)||1)-1;return root.DataCleanupUI.render();}
  if(a==='refresh')return root.DataCleanupUI.refresh();
  if(a==='open')return open(Number(v));
 }
 function boot(){
  const U=root.DataCleanupUI;if(!U||typeof U.render!=='function'||typeof U.active!=='function')return;
  /* 기존 목록이 그려질 때마다(안에서 다시 그릴 때 포함) 그 위에 새 화면을 그린다 */
  U.afterRender=function(){
   const old=document.getElementById('dups'),el=document.getElementById('dup-v2');
   if(!enabled()||!root.B||!old){if(el)el.hidden=true;old?.classList.remove('dv-on');return;}
   try{const hst=host();hst.hidden=false;hst.innerHTML=listHtml(model());old.classList.add('dv-on');
    if(root.G.page==='dup'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='데이터 정리 · 검토';if(p)p.textContent='겹쳐 보이는 현장 · 문의 · 연락처를 먼저 판단하고, 애매한 건만 비교합니다';}
   }catch(e){console.warn('[데이터 정리 v2]',e);if(el)el.hidden=true;old.classList.remove('dv-on');}
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.DupV2={enabled,judge,open,close};
})(window);
