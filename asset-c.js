/* 고객 자산 v2 목록 (2026-10-04 design_handoff_asset_v2 · 고객 자산 v2.dc.html) — 목록 화면만. 상세 모달 · 공통 필터줄 · 보드 보기는 그대로.
   목적: "한 아파트에 얼마가 쌓였고 지금 얼마가 진행 중인지" — 줄마다 누적 수주 · 진행 중 금액을 크게, 관계 상태는 꼬리표 한 번만(이유 줄은 금액 · 사유만).
   위: 제목 + 한 줄 설명 + [관계 기준 ▾] · 관계 상태 = 밑줄 탭(재접촉 · 위험 숫자 빨강 · 0은 흐리게) · 담당자별 위험 = 알약(위험 많은 순 6명 + n명 · 누르면 목록 + 위 담당자 칸) · [관계 기준 ▾] · 확인할 단지 n곳 + 정렬 기준 + [필터 · 해제]
   아래: 왼쪽 '단지에 쌓인 금액'(누적 수주 · 지금 진행 중 · 위험한 진행 금액) · '왜 멈춰 있나'(누르면 목록이 좁혀짐) / 오른쪽 목록.
   금액(design_handoff_rules): 누적 수주 = 그 단지에서 확정된 수주의 낙찰금액 합(직접 수주 = 계약실적 원장, 협약시공사 · 기술자문 / 인정된 타사 이관 = 낙찰금액 — DealWin.resultOf 한곳) · 진행 중 = 열려 있는 영업건 예상금액 합.
   단지 자료 · 관계 상태(siteHealth) · 사유 분류는 기존(asset-b / asset-v2) 그대로 쓴다. 끄기: G.assetCOff=true → 이전 목록(B안). */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const AB=()=>R.AssetB,V=()=>R.AssetV2,SB=()=>R.StageBoard;
 const enabled=()=>!R.G.assetCOff&&!!AB()&&AB().enabled()&&!!R.CRMRules;
 const st=()=>R.G.assetC||(R.G.assetC={rule:false,more:false,why:'',page:1});
 const advOpen=()=>{const pg=document.getElementById('pg-sites');return !!(pg&&pg.classList.contains('av-adv-on'));};
 const wait=()=>Number((R.OPS_RULES||{}).waitContactDays)||60;
 const BC={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const TONE={risk:['#b42318','#fdecec'],recontact:['#c0392b','#fdeceb'],active:['#1d3f99','#eef3fe'],customer:['#1f7a4d','#e8f6ee'],dormant:['#6b7280','#f3f4f6']};
 const TABS=['전체','active','recontact','risk','customer','dormant'];
 const won=n=>Number(n)>0?R.fmtAmt(Number(n)):'0원';
 const label=k=>k==='전체'?'전체':(R.SITE_HEALTH[k]||{}).label||k;
 /* ── 금액: 단지에 쌓인 금액(누적 수주) · 지금 진행 중 ── */
 /* 한 번 그리는 동안만 기억한다(수주 유형 · 타사 이관 · 원장 자료가 바뀌면 다음 그릴 때 다시 계산) */
 let memo=new Map();
 function money(s){
  const hit=memo.get(s.key);if(hit)return hit;
  let acc=0,accN=0,prog=0,progN=0,cur=0,curN=0,leg=0,legN=0,noTime=true;
  const PS=R.PipelineScope,isLeg=d=>{try{return !!(PS&&PS.on()&&PS.isLegacy(d));}catch(e){return false;}};
  (s.deals||[]).forEach(d=>{
   let r=null;try{r=R.DealWin&&R.DealWin.enabled()?R.DealWin.resultOf(d):null;}catch(e){}
   if(r&&r.done){accN++;acc+=Number(r.amount)||0;return;}
   if(!r&&R.isWon(d)){accN++;acc+=Number(R.wonAmt(d))||0;return;}
   if(R.isOpen(d)){const a=Number(R.oppAmt(d))||0;progN++;prog+=a;if(isLeg(d)){legN++;leg+=a;}else{curN++;cur+=a;}}/* decision_collab ⑧: 진행 금액 = 현재 영업기회 vs 과거 미정리 · 이관 */
  });
  (s.lost||[]).forEach(d=>{const f=d.stage_contexts&&d.stage_contexts.lost&&d.stage_contexts.lost.fields||{};if(String(f.recontact_possibility||d.recontact_possibility||'').trim())noTime=false;});
  const v={acc,accN,prog,progN,cur,curN,leg,legN,noReproposal:noTime};memo.set(s.key,v);return v;
 }
 /* 왜 멈춰 있나: 기존 사유 분류(asset-b) 그대로 */
 const reasonsOf=s=>{try{return AB().item(s).rs||[];}catch(e){return [];}};
 /* 이유 한 줄 — 꼬리표와 같은 말은 쓰지 않는다(금액 · 사유만) */
 function whyOf(s,m){
  const ld=s.lastDays,lost=s.lost.length,late=ld!==null&&ld>=28?ld+'일 연락 없음':'';
  if(s.health==='risk'||s.health==='recontact'){
   if(m.prog>0)return ['진행 '+won(m.prog),lost?'실주 '+lost+'건':'',late].filter(Boolean).join(' · ');
   if(lost)return '실주 '+lost+'회 · '+(m.noReproposal?'사유 확인 후 재제안 시기 없음':'재제안 시기 등록됨')+(late&&!m.noReproposal?' · '+late:'');
   return late||'최근 기록 없음';
  }
  if(s.health==='customer')return ld!==null&&ld>=wait()?'수주 고객 · '+Math.round(wait()/30)+'개월 관계 연락 시기':'수주 '+m.accN+'건'+(ld!==null?' · 마지막 연락 '+ld+'일 전':'');
  if(s.health==='dormant')return ld===null?'기록 없음 · 장기수선 일정 확인 대상':'1년 넘게 움직임 없음 · 장기수선 일정 확인 대상';
  let work='';try{const d=(s.open||[]).slice().sort((a,b)=>(Number(R.oppAmt(b))||0)-(Number(R.oppAmt(a))||0))[0];if(d){const w=R.dealWorkSummary(d);work=(w&&!/미분류|미기록/.test(w)?w+' ':'')+((R.StageTransition.definitions[R.dealStage(d)]||{}).label||'진행')+' 중';}}catch(e){}
  return [m.accN?'수주 '+m.accN+'건':'',work||(m.progN?'진행 '+m.progN+'건':'')].filter(Boolean).join(' · ')||'최근 연락 '+(ld===null?'기록 없음':ld+'일 전');
 }
 const actOf=(s,m)=>(s.health==='risk'||s.health==='recontact')?(m.prog>0||!s.lost.length?'연락':'재제안'):s.health==='customer'?'안부 연락':'열기';
 /* ── 범위: 공통 필터줄(브랜드 · 담당자 · 검색) + 관계 상태 탭 + 사유 ── */
 function scoped(){
  memo=new Map();
  const G=R.G;G.siteBrand='전체';G.siteOwner='전체';G.siteAddress=G.siteAddress||'전체';G.workFilter='전체';
  const owner=R.SalesScope.state().owner||'전체',sel=R.SalesFilterState.state().brands||[];
  const found=R.siteMasterData().filter(R.siteMatches);
  const brandOk=s=>!sel.length||s.brands.some(b=>sel.includes(b)),ownerOk=s=>owner==='전체'||(owner==='미배정'?!s.owners.length:s.owners.includes(owner));
  const scope=found.filter(s=>brandOk(s)&&ownerOk(s)),status=G.siteStatus&&G.siteStatus!=='전체'?G.siteStatus:'전체',S=st();
  let rows=scope.filter(s=>status==='전체'||s.health===status);
  if(S.why)rows=rows.filter(s=>reasonsOf(s).includes(S.why));
  /* 정렬: 관계위험 = 진행 금액이 걸린 곳 먼저 / 그 밖 = 오래 연락 안 한 순(기록 없는 곳은 뒤) */
  const days=s=>s.lastDays===null?-1:s.lastDays;
  rows=rows.slice().sort(status==='risk'?(a,b)=>money(b).prog-money(a).prog||days(b)-days(a):(a,b)=>days(b)-days(a)||money(b).prog-money(a).prog);
  return {scope,status,owner,rows,ownerFree:found.filter(brandOk)};
 }
 /* ── 그리기 ── */
 function topHtml(x){
  const S=st(),count=k=>k==='전체'?x.scope.length:x.scope.filter(s=>s.health===k).length;
  const tabs='<div class="ac-tabs" role="tablist" aria-label="관계 상태">'+TABS.map(k=>{const n=count(k),on=x.status===k,hot=(k==='recontact'||k==='risk')&&n>0;return '<button type="button" role="tab" data-ac="status" data-v="'+k+'" aria-selected="'+on+'"><span>'+h(label(k))+'</span><b class="'+(hot?'hot':!n?'zero':'')+'">'+n.toLocaleString('ko-KR')+'</b></button>';}).join('')
   +'</div>';
  const title='<div class="ac-title"><b>고객 자산</b><span>단지별로 쌓인 금액 · 진행 중 금액 · 관계 상태</span><i></i><button type="button" class="ac-rulebtn" data-ac="advisory" aria-expanded="'+advOpen()+'">기술자문 원본 자료 '+(advOpen()?'▴':'▾')+'</button><button type="button" class="ac-rulebtn" data-ac="rule" aria-expanded="'+!!S.rule+'">관계 기준 '+(S.rule?'▴':'▾')+'</button></div>';
  const rules=S.rule?'<div class="ac-rules">'+[['진행 중 단지','30일 안에 한 번 연락'],['수주 고객',Math.round(wait()/30)+'개월에 한 번 관계 연락'],['실주 단지','사유 확인 후 재제안 시기 등록']].map(r=>'<div><b>'+r[0]+'</b> <span>'+r[1]+'</span></div>').join('')+'</div>':'';
  const map=new Map();x.ownerFree.forEach(s=>s.owners.forEach(o=>{const v=map.get(o)||{owner:o,n:0,risk:0};v.n++;if(s.health==='risk')v.risk++;map.set(o,v);}));
  const P=[...map.values()].sort((a,b)=>b.risk-a.risk||b.n-a.n||String(a.owner).localeCompare(String(b.owner),'ko')),shown=S.more?P:P.slice(0,6);
  const people=P.length?'<div class="ac-people" role="group" aria-label="담당자별 위험"><span>담당자별 위험</span>'+shown.map(p=>'<button type="button" class="'+(p.risk?'':'none')+'" data-ac="owner" data-v="'+attr(p.owner)+'" aria-pressed="'+(x.owner===p.owner)+'"><b>'+h(p.owner)+'</b><span>'+p.n.toLocaleString('ko-KR')+'곳</span>'+(p.risk?'<em>위험 '+p.risk+'</em>':'')+'</button>').join('')+(P.length>6?'<button type="button" class="ac-moreppl" data-ac="more">'+(S.more?'접기':'+ '+(P.length-6)+'명')+'</button>':'')+'</div>':'';
  const filters=[x.status!=='전체'?label(x.status):'',x.owner!=='전체'?x.owner:'',S.why?(AB().CFG.RS[S.why]||[S.why])[0]:''].filter(Boolean);
  const head='<div class="ac-listhd"><b>확인할 단지 <span>'+x.rows.length.toLocaleString('ko-KR')+'곳</span></b><span>'+(x.status==='risk'?'진행 금액이 걸린 곳 먼저':'오래 연락 안 한 순')+'</span>'+(filters.length?'<button type="button" class="ac-clear" data-ac="clear">'+h(filters.join(' · '))+' · 해제</button>':'')+'<i></i><div class="ac-views"><span class="on">리스트</span><button type="button" data-ac="board">보드</button></div></div>';
  return '<section class="ac-top">'+title+rules+tabs+people+head+'</section>';
 }
 function sideHtml(x){
  const S=st(),M=x.scope.map(s=>[s,money(s)]);
  const accSites=M.filter(m=>m[1].acc>0),acc=accSites.reduce((a,m)=>a+m[1].acc,0),prog=M.reduce((a,m)=>a+m[1].prog,0),progN=M.reduce((a,m)=>a+m[1].progN,0),progSites=M.filter(m=>m[1].progN>0).length;
  const risk=M.filter(m=>m[0].health==='risk'||m[0].health==='recontact').reduce((a,m)=>a+m[1].prog,0);
  /* decision_collab ⑧ 숫자 다시 나누기: 진행 금액 = 현재 영업기회 vs 과거 미정리 · 이관 / 관계위험 = 실주 원인별 / 주소 미입력 = 담당 있음 · 진행 중(→ 담당 오늘 업무) vs 과거 · 휴면(→ 데이터 검토) */
  const cur=M.reduce((a,m)=>a+m[1].cur,0),curN=M.reduce((a,m)=>a+m[1].curN,0),leg=M.reduce((a,m)=>a+m[1].leg,0),legN=M.reduce((a,m)=>a+m[1].legN,0);
  const nums=[['누적 수주 (전 단지)',won(acc),'수주한 단지 '+accSites.length.toLocaleString('ko-KR')+'곳'+(accSites.length?' · 평균 '+won(acc/accSites.length):''),'#15171c'],['지금 진행 중',won(prog),'현재 영업기회 '+curN.toLocaleString('ko-KR')+'건 · '+won(cur)+' / 과거 미정리 · 이관 '+legN.toLocaleString('ko-KR')+'건 · '+won(leg)+' · 단지 '+progSites.toLocaleString('ko-KR')+'곳','#1d3f99'],['위험한 진행 금액',won(risk),'관계위험 · 재접촉 필요 단지에 걸린 금액','#b42318']];
  const riskSites=M.filter(m=>m[0].health==='risk'),cat=d=>{const f=d.stage_contexts&&d.stage_contexts.lost&&d.stage_contexts.lost.fields||{};const r=String(f.close_reason||d.close_reason||d.lost_reason||'').trim();if(!r)return '원인 미입력';const m=/^(관계|공법|가격|사업)\s*·/.exec(r);if(m)return m[1]==='사업'?'공사 취소 · 연기':m[1];if(/가격|예산/.test(r))return '가격';if(/공법|기술/.test(r))return '공법';if(/취소|연기/.test(r))return '공사 취소 · 연기';if(/관계|소장|연락/.test(r))return '관계';return '기타';};
  const byCat=new Map();riskSites.forEach(m=>{const s=m[0],last=(s.lost||[]).slice().sort((a,b)=>String(b.closed_at||b.closed||'').localeCompare(String(a.closed_at||a.closed||'')))[0];const k=last?cat(last):(s.lost&&s.lost.length?'원인 미입력':'실주 없음 · 접촉 끊김');byCat.set(k,(byCat.get(k)||0)+1);});
  const noAddr=M.map(m=>m[0]).filter(s=>!s.canonicalAddress),naWork=noAddr.filter(s=>s.owners.length&&(s.open||[]).some(d=>{try{return R.PipelineScope&&R.PipelineScope.on()?R.PipelineScope.isActive(d):R.isActiveDeal(d);}catch(e){return false;}})).length;
  const splits='<section class="ac-split"><b>숫자 다시 나누기</b>'
   +'<div><span>관계위험 '+riskSites.length.toLocaleString('ko-KR')+'곳 → 실주 원인별</span>'+([...byCat.entries()].sort((a,b)=>b[1]-a[1]).map(e=>'<i><span>'+h(e[0])+'</span><b>'+e[1].toLocaleString('ko-KR')+'</b></i>').join('')||'<i><span>관계위험 단지 없음</span><b>0</b></i>')+'</div>'
   +'<div><span>주소 미입력 '+noAddr.length.toLocaleString('ko-KR')+'곳 → 보완 업무</span><i><span>담당 있음 · 진행 중 → 담당 오늘 업무</span><b>'+naWork.toLocaleString('ko-KR')+'</b></i><i><span>과거 · 휴면 → 데이터 검토</span><b>'+(noAddr.length-naWork).toLocaleString('ko-KR')+'</b></i></div></section>';
  const RS=AB().CFG.RS,sum=(k,f)=>M.filter(m=>reasonsOf(m[0]).includes(k)).reduce((a,m)=>a+f(m),0);
  const note={risk:k=>won(sum(k,m=>m[1].prog))+' 걸림',lost2:()=>'재제안 시기 미등록',recontact:k=>'진행 '+won(sum(k,m=>m[1].prog)),cold60:k=>'누적 수주 '+won(sum(k,m=>m[1].acc)),nokey:()=>'관리소장 · 입대의 회장 연락처 없음',dormant:()=>'장기수선 일정 확인 대상',wonamt:()=>'누적 수주 집계에서 빠짐',noaddr:()=>'근처 현장 · 지도에 안 나옴'};
  const why=Object.keys(RS).map(k=>({k,n:M.filter(m=>reasonsOf(m[0]).includes(k)).length})).filter(w=>w.n>0);
  return '<aside class="ac-side"><section><b>단지에 쌓인 금액</b>'+nums.map(n=>'<div class="ac-num"><span>'+n[0]+'</span><b style="color:'+n[3]+'">'+h(n[1])+'</b><small>'+h(n[2])+'</small></div>').join('')+'</section>'+splits
   +'<section class="ac-why"><b>왜 멈춰 있나 <small>누르면 목록이 좁혀짐</small></b>'+(why.length?why.map(w=>'<button type="button" data-ac="why" data-v="'+w.k+'" aria-pressed="'+(S.why===w.k)+'"><b>'+h(RS[w.k][0])+'</b><b class="n" style="color:'+(RS[w.k][1]==='#374151'?'#374151':w.k==='recontact'?'#c0392b':'#b42318')+'">'+w.n.toLocaleString('ko-KR')+'</b><span>'+h(note[w.k]?note[w.k](w.k):'')+'</span></button>').join(''):'<p>멈춰 있는 단지가 없습니다</p>')+'</section></aside>';
 }
 function rowHtml(s){
  const m=money(s),brand=s.brands[0]||'',bc=BC[brand]||'#9ca3af',t=TONE[s.health]||TONE.dormant,ld=s.lastDays,p=s.primary;
  return '<div class="ac-row" role="row" tabindex="0" data-ac="open" data-key="'+attr(s.key)+'" style="border-left-color:'+bc+'"><div class="ac-site"><b title="'+attr(s.name)+'">'+h(s.name)+'</b><span><b style="color:'+bc+'">'+h(brand||'브랜드 미지정')+'</b> · '+h(s.owners.join(', ')||'미배정')+' · '+h(p?p.name+' '+(p.role||''):'관리소장 미확인')+'</span></div>'
   +'<div class="ac-amt'+(m.acc>0?'':' zero')+'"><b>'+h(won(m.acc))+'</b><span>'+(m.accN?m.accN+'건':'수주 없음')+'</span></div>'
   +'<div class="ac-amt prog'+(m.prog>0?'':' zero')+'"><b>'+h(won(m.prog))+'</b><span>'+(m.progN?m.progN+'건 진행':'진행 없음')+'</span></div>'
   +'<div class="ac-state"><span style="color:'+t[0]+';background:'+t[1]+'">'+h(label(s.health))+'</span><small title="'+attr(whyOf(s,m))+'">'+h(whyOf(s,m))+'</small></div>'
   +'<b class="ac-days'+(ld!==null&&ld>=28?' late':'')+'">'+(ld===null?'기록 없음':ld+'일')+'</b>'
   +'<button type="button" class="ac-act" data-ac="open" data-key="'+attr(s.key)+'">'+actOf(s,m)+'</button></div>';
 }
 function listHtml(x){
  const S=st(),LP=R.ListPager,pg=LP.cut(x.rows,LP.page(S)),shown=pg.rows;
  return '<section class="ac-list" role="table" aria-label="확인할 단지"><div class="ac-head" role="row"><span>단지 · 담당 · 관리소장</span><span class="r">누적 수주</span><span class="r">진행 중</span><span>지금 상태</span><span class="r">마지막 연락</span><span></span></div>'
   +(shown.length?shown.map(rowHtml).join(''):'<p class="ac-empty">조건에 맞는 단지가 없습니다</p>')
   +LP.html(pg,{ns:'ac',unit:'곳'})
   +'<div class="ac-foot">누적 수주 = 이 단지에서 지금까지 수주한 낙찰금액 합 · 진행 중 = 열려 있는 영업건 예상금액 합</div></section>';
 }
 function paint(){
  const host=document.getElementById('site-master'),pg=document.getElementById('pg-sites');if(!host)return;
  const x=scoped();
  host.innerHTML='<div class="ac">'+topHtml(x)+'<div class="ac-body">'+sideHtml(x)+listHtml(x)+'</div></div>';
  if(!host.__ac){host.__ac=true;host.addEventListener('click',onClick);host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.ac-row')){e.preventDefault();V().open(e.target.dataset.key);}});}
  if(R.G.page==='sites'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='고객 자산';if(p)p.textContent='';}
  pg&&pg.classList.add('ac-on');
 }
 function onClick(e){
  if(!enabled()||!e.target.closest('.ac'))return;
  const b=e.target.closest('[data-ac]');if(!b)return;const a=b.dataset.ac,v=b.dataset.v,S=st();
  if(a==='open'){e.stopPropagation();return V().open(b.dataset.key);}
  if(a==='status'){R.G.siteStatus=v;S.page=1;return R.paintSites();}
  if(a==='owner'){const cur=R.SalesScope.state().owner||'전체';S.page=1;R.CommonFilterBar.setOwner(cur===v?'전체':v);return R.paintSites();}
  if(a==='why'){S.why=S.why===v?'':v;S.page=1;return R.paintSites();}
  if(a==='clear'){R.G.siteStatus='전체';S.why='';S.page=1;if((R.SalesScope.state().owner||'전체')!=='전체')R.CommonFilterBar.setOwner('전체');return R.paintSites();}
  if(a==='rule'){S.rule=!S.rule;return R.paintSites();}
  /* 기술자문 원본 자료(프로젝트 기본 정보 · 계약 문서): 화면 아래 칸을 열고 닫는다 — 영업건과 관계없이 권한 안의 원본을 본다(technical-advisory-ui.js) */
  if(a==='advisory'){const pg=document.getElementById('pg-sites'),on=pg.classList.toggle('av-adv-on');b.setAttribute('aria-expanded',String(on));b.textContent='기술자문 원본 자료 '+(on?'▴':'▾');if(on){const lib=pg.querySelector('.advisory-library');if(lib&&lib.scrollIntoView)lib.scrollIntoView({block:'start'});try{R.TechnicalAdvisoryUI&&R.TechnicalAdvisoryUI.projects&&R.TechnicalAdvisoryUI.projects.shown();}catch(err){}}return;}
  if(a==='more'){S.more=!S.more;return R.paintSites();}
  if(a==='page'){S.page=Number(b.dataset.page)||1;return R.paintSites();}
  if(a==='board'){SB().state('asset').view='board';return R.paintSites();}
 }
 function boot(){
  const base=R.paintSites;if(typeof base!=='function'||base.__ac)return;
  const wrapped=function(){
   const out=base.apply(this,arguments);/* 이전 목록(B안)이 먼저 그린다 → 리스트 보기일 때만 v2 목록으로 바꾼다. 보드 보기는 그대로 */
   const pg=document.getElementById('pg-sites');
   if(!enabled()||!document.getElementById('asset-b')||SB().state('asset').view==='board'){pg&&pg.classList.remove('ac-on');return out;}
   try{paint();}catch(e){pg&&pg.classList.remove('ac-on');console.warn('[고객 자산 v2 목록]',e);}
   return out;
  };
  wrapped.__ac=true;R.paintSites=wrapped;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.AssetC={enabled,money,whyOf,actOf,scoped,state:st};
})(window);
