/* 고객 자산 v2 (2026-10-01 디자인 핸드오프 'design_handoff_asset') — 고객 자산 메뉴(목록 + 상세)만.
   목록: 공통 필터줄 → 안내 줄(관계 상태 알약 · 더보기) → 진단(파이프라인 진단 컴포넌트) → 묶음 표(관계위험 · 재접촉 필요 · 활성 · 휴면)
   상세: 오른쪽 드로어 6개 탭 → 3단 모달 하나(핵심 인물·기본 정보 / 관계 타임라인 / 누적 거래·진행 영업·공종 이력·배울 것)
   데이터(siteMasterData)·관계 상태(siteHealth)·타임라인(siteTimeline)·확장 신호(siteExpansion)는 그대로 쓴다. 주소 입력·수정은 기존 창(변경 사유·이전 값 기록)으로 연다.
   '기술자문 계약'은 [··· 더보기]에서, '연결 검토(과거자료 연결)'는 데이터 정리 · 검토 메뉴에서 연다(2026-10-01 대표 결정).
   끄기: G.assetV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const GROUPS=[['risk','관계위험','#e5484d','진행 금액은 있는데 관계가 식고 있음 — 먼저 연락'],['recontact','재접촉 필요','#f5a524','다음 연락일이 지났거나 비어 있음'],['active','활성','#30a46c','진행 · 수주 이력이 살아 있는 단지'],['dormant','휴면','#c4c8d0','1년 이상 움직임 없음']];
 const GRID='minmax(0,1.3fr) 84px 80px 100px 90px 70px minmax(0,1.1fr) 72px',COLS=['관계','누적 수주','진행 기회','실주 이력','최근 기록','핵심 인물'];
 const TAG={risk:['관계위험','r'],active:['활성','g'],customer:['기존고객','o'],recontact:['재접촉 필요','o'],dormant:['휴면','m']};
 const enabled=()=>!root.G.assetV2Off;
 const amt=v=>v>0?root.fmtAmt(v):'';
 const lastLabel=s=>s.lastDays===null?'기록 없음':s.lastDays===0?'오늘':s.lastDays+'일 전';
 const groupOf=s=>s.health==='customer'?'active':s.health;
 const toast=(m,t)=>{if(typeof root.toast==='function')root.toast(m,t);};
 function scoped(){
  const G=root.G;G.siteBrand='전체';G.siteOwner='전체';G.siteAddress=G.siteAddress||'전체';G.workFilter='전체';
  const owner=root.SalesScope.state().owner||'전체',sel=root.SalesFilterState.state().brands||[];
  const all=root.siteMasterData(),found=all.filter(root.siteMatches);
  const brandOk=s=>!sel.length||s.brands.some(b=>sel.includes(b)),ownerOk=s=>owner==='전체'||(owner==='미배정'?!s.owners.length:s.owners.includes(owner));
  const scope=found.filter(s=>brandOk(s)&&ownerOk(s)),status=G.siteStatus&&G.siteStatus!=='전체'?G.siteStatus:'전체';
  return {all,found,scope,status,rows:scope.filter(s=>status==='전체'||s.health===status),ownerFree:found.filter(brandOk)};
 }
 function brandStats(){
  const sel=root.SalesFilterState.state().brands||[],owner=root.SalesScope.state().owner||'전체';let list=[];
  try{list=root.siteMasterData().filter(s=>owner==='전체'||s.owners.includes(owner));}catch(e){list=[];}
  const names=[...new Set(['석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어'].concat(list.flatMap(s=>s.brands)))];
  return [{name:'전체',n:list.length,on:!sel.length}].concat(names.map(b=>({name:b,n:list.filter(s=>s.brands.includes(b)).length,on:sel.includes(b)})));
 }
 function diagnosis(rows){
  const D=root.PipelineDiagnosis;if(!D)return '';
  const sum=(l,f)=>l.reduce((a,x)=>a+(Number(f(x))||0),0),won=rows.filter(s=>s.wonAmount>0),wonSum=sum(rows,s=>s.wonAmount),openCnt=sum(rows,s=>s.open.length),openSum=sum(rows,s=>s.openAmount),risk=rows.filter(s=>s.health==='risk'),riskAmt=sum(risk,s=>s.openAmount);
  const K=(label,value,sub,tone)=>({label,value,sub,tone:tone||''});
  const top=rows.filter(s=>s.wonAmount>0).sort((a,b)=>b.wonAmount-a.wonAmount).slice(0,5).map(s=>[s.name,s.won.length,root.fmtAmt(s.wonAmount)]);
  const leak=Object.keys(root.SITE_HEALTH).map(k=>{const l=rows.filter(s=>s.health===k&&s.open.length);return [root.SITE_HEALTH[k].label,l.length,amt(sum(l,s=>s.openAmount))||'0원'];}).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  const owners=new Map();rows.forEach(s=>(s.owners.length?s.owners:['미배정']).forEach(o=>{const v=owners.get(o)||{n:0,noKey:0};v.n++;if(!s.primary)v.noKey++;owners.set(o,v);}));
  const lostSites=rows.filter(s=>s.lost.length).length,noKey=rows.filter(s=>!s.primary&&(s.open.length||s.won.length)).length,dormant=rows.filter(s=>s.health==='dormant').length;
  const tasks=[[risk.length,'관계위험 '+risk.length+'곳'+(riskAmt?' · '+root.fmtAmt(riskAmt):''),'진행 금액 큰 순으로 이번 주 관리소장 통화','담당자 · 이번 주','관계위험'],[lostSites,'실주 이력 있는 단지 '+lostSites+'곳','실주 사유 확인 후 재제안 시기 등록','영업팀 · 월 1회','실주 이력'],[noKey,'핵심 인물 미확인 '+noKey+'곳','관리소장 · 입대의 회장 연락처 확보','담당자','핵심 인물 미확인'],[dormant,'휴면 '+dormant+'곳','장기수선 일정 확인 문자 캠페인','문자 · 캠페인','휴면']].filter(t=>t[0]>0).map(t=>({basis:t[1],todo:t[2],who:t[3],label:t[4],count:t[0]}));
  return D.render({accent:'blue',
   kpis:[K('고객 자산',rows.length.toLocaleString('ko-KR')+'곳','아파트 · 상가 · 공장'),K('누적 수주',wonSum?root.fmtAmt(wonSum):'0원',won.length+'곳'+(won.length?' · 평균 '+root.fmtAmt(wonSum/won.length):''),'good'),K('진행 기회',openCnt+'건 · '+(openSum?root.fmtAmt(openSum):'0원'),'진행 중 영업 전체'),K('관계위험',risk.length+'곳',riskAmt?'진행 금액 '+root.fmtAmt(riskAmt)+'이 걸려 있음':'걸린 진행 금액 없음',risk.length?'bad':'')],
   cards:[{title:'돈이 어디에 쌓였나',desc:'누적 수주 상위 단지',bars:top,empty:'수주 금액이 기록된 단지가 없습니다'},{title:'어디서 새고 있나',desc:'관계 상태별 진행 금액',bars:leak,empty:'진행 중인 영업이 없습니다'},{title:'누가 관계를 쥐고 있나',desc:'담당 · 핵심 인물 확보',rows:[...owners].sort((a,b)=>b[1].n-a[1].n).slice(0,5).map(([o,v])=>[o,v.n,v.noKey?'핵심 인물 미확인 '+v.noKey:'핵심 인물 확보'])}],
   action:{title:'그래서 뭘 해야 하나',desc:'고객 자산에서 나온 과제',tasks}},{open:true,noToggle:true,scope:'asset'});
 }
 function rowHtml(s){
  const p=s.primary,t=TAG[s.health]||TAG.dormant,owner=s.owners.join(', ')||'미배정';
  return '<div class="plv-row" role="row" tabindex="0" data-av="open" data-value="'+attr(s.key)+'" data-site="'+attr(s.key)+'" style="grid-template-columns:'+GRID+'"><span class="plv-c plv-site"><b title="'+attr(s.name)+'">'+h(s.name)+'</b><small class="'+(owner==='미배정'?'none':'')+'">'+h(owner)+'</small></span>'
   +'<span class="plv-c"><em class="plv-tag '+t[1]+(s.health==='risk'?' risk':'')+'">'+t[0]+'</em></span>'
   +'<span class="plv-c"><span class="'+(s.wonAmount>0?'':'m')+'">'+h(s.wonAmount>0?root.fmtAmt(s.wonAmount):'0원')+'</span></span>'
   +'<span class="plv-c">'+(s.open.length?'<span class="b">'+s.open.length+'건 · '+h(amt(s.openAmount)||'금액 미입력')+'</span>':'<span class="m">–</span>')+'</span>'
   +'<span class="plv-c">'+(s.lost.length?'<span class="r">'+s.lost.length+'건'+(s.lostAmount>0?' · '+h(root.fmtAmt(s.lostAmount)):'')+'</span>':'<span class="m">–</span>')+'</span>'
   +'<span class="plv-c"><span class="'+(s.lastDays===null||s.lastDays>365?'m':'')+'">'+h(lastLabel(s))+'</span></span>'
   +'<span class="plv-c">'+(p?'<span>'+h(p.name)+' '+h(p.role)+'</span><small>'+h(root.phoneFmt(p.mobile||p.officeTel)||'')+'</small>':'<span class="m">기록 없음</span>')+'</span>'
   +'<button type="button" class="plv-cta" data-av="open" data-value="'+attr(s.key)+'">열기</button></div>';
 }
 function listHtml(x){
  const cur=root.SalesScope.state().owner||'전체',more=root.G.avMore||(root.G.avMore={});
  const count=k=>x.scope.filter(s=>s.health===k).length;
  const pills='<div class="plv-pills" role="group" aria-label="관계 상태">'+[['전체','전체',x.scope.length]].concat(['active','customer','recontact','risk','dormant'].map(k=>[k,root.SITE_HEALTH[k].label,count(k)])).map(([v,t,n])=>'<button type="button" data-av="status" data-value="'+v+'" aria-pressed="'+(x.status===v)+'">'+h(t)+' <b>'+n.toLocaleString('ko-KR')+'</b></button>').join('')+'</div>';
  const menu='<details class="av-more"><summary>··· 더보기</summary><div class="av-menu"><button type="button" data-av="advisory">기술자문 원본 자료</button><button type="button" data-av="review">연결 검토 · 과거자료 연결 → 데이터 정리 · 검토</button><label>주소 상태 <select data-av-address aria-label="주소 상태">'+['전체','완료','후보','미입력'].map(v=>'<option'+(root.G.siteAddress===v?' selected':'')+'>'+v+'</option>').join('')+'</select></label></div></details>';
  const intro='<div class="plv-intro"><i style="background:#64748b"></i><b>고객 자산</b><span>'+x.rows.length.toLocaleString('ko-KR')+'곳</span><div class="plv-spacer"></div>'+pills+menu+'</div>';
  const map=new Map();x.ownerFree.forEach(s=>s.owners.forEach(o=>{const v=map.get(o)||{owner:o,n:0,late:0};v.n++;if(s.health==='risk')v.late++;map.set(o,v);}));
  const chips=root.todayIsAdmin?.()&&map.size?'<div class="plv-owners" role="group" aria-label="담당자별"><span>담당자별</span>'+[...map.values()].sort((a,b)=>b.late-a.late||b.n-a.n).slice(0,12).map(o=>'<button type="button" class="plv-chip'+(cur===o.owner?' on':'')+'" data-av="owner" data-value="'+attr(o.owner)+'" aria-pressed="'+(cur===o.owner)+'">'+h(o.owner)+' <b>'+o.n+'</b>'+(o.late?'<em> · 위험 '+o.late+'</em>':'')+'</button>').join('')+'</div>':'';
  const head='<div class="plv-thead" role="row" style="grid-template-columns:'+GRID+'"><span>현장 · 담당</span>'+COLS.map(c=>'<span>'+h(c)+'</span>').join('')+'<span></span></div>';
  const groups=GROUPS.map(([id,title,color,desc])=>{
   const list=x.rows.filter(s=>groupOf(s)===id).sort((a,b)=>b.openAmount-a.openAmount||b.wonAmount-a.wonAmount||String(b.lastAt||'').localeCompare(String(a.lastAt||''))),__pg=root.ListPager.cut(list,(more[id]||0)+1),shown=__pg.rows,rest=list.length-shown.length;
   return '<div class="plv-ghead" data-plv-group="'+id+'"><i style="background:'+color+'"></i><b>'+h(title)+'</b><span>'+list.length.toLocaleString('ko-KR')+'건</span><small>· '+h(desc)+'</small></div>'+(shown.length?shown.map(rowHtml).join(''):'<div class="plv-empty">해당하는 건이 없습니다</div>')+root.ListPager.html(__pg,{ns:'av',attrs:'data-value="'+id+'"',small:true});
  }).join('');
  return '<div id="asset-v2" class="plv" data-workspace="asset">'+intro+chips+diagnosis(x.rows)+'<div class="plv-table" role="table" aria-label="고객 자산 목록">'+head+groups+'</div></div>';
 }
 function onClick(e){
  const pd=e.target.closest('[data-pd="toggle"]');if(pd&&pd.closest('#asset-v2')){root.G.plvDiagShut=root.G.plvDiagShut!==true;root.paintSites();return;}
  const b=e.target.closest('#asset-v2 [data-av]');if(!b)return;const a=b.dataset.av,v=b.dataset.value;
  if(a==='open')open(v);
  if(a==='status'){root.G.siteStatus=v;root.G.avMore={};root.paintSites();}
  if(a==='owner'){const cur=root.SalesScope.state().owner||'전체';root.CommonFilterBar.setOwner(cur===v?'전체':v);root.paintSites();}
  if(a==='page'){const m=root.G.avMore||(root.G.avMore={});m[v]=(Number(b.dataset.page)||1)-1;root.paintSites();}
  if(a==='advisory'){const pg=document.getElementById('pg-sites'),on=pg.classList.toggle('av-adv-on');if(on){pg.querySelector('.advisory-library')?.scrollIntoView({block:'nearest'});try{root.TechnicalAdvisoryUI?.projects?.shown();}catch(e){}}b.closest('details')?.removeAttribute('open');}
  if(a==='review'){root.goPage('dup');}
 }
 function paint(){
  const host=document.getElementById('site-master'),pg=document.getElementById('pg-sites');if(!host)return;
  root.PCOrganizationHistory?.clear?.();root.PCSiteRecordReview?.clear?.();
  host.innerHTML=listHtml(scoped());
  if(!host.__av){host.__av=true;host.addEventListener('click',onClick);host.addEventListener('change',e=>{if(e.target.matches('[data-av-address]')){root.G.siteAddress=e.target.value;root.paintSites();}});host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}});}
  if(root.G.page==='sites'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='고객 자산';if(p)p.textContent='한 아파트에 얼마가 쌓였고, 지금 얼마가 진행 중인지';}
  pg?.classList.add('av-on');root.CommonFilterBar?.mount('sites');const bar=pg?.querySelector(':scope>.cf-bar');if(bar)bar.hidden=false;
  if(openKey)renderDetail();
 }
 /* ── 상세: 3단 모달 ── */
 let openKey=null,returnFocus=null,draft='';
 const find=key=>root.siteMasterData().find(s=>s.key===key);
 function node(){
  let m=document.getElementById('assetV2');if(m)return m;
  m=document.createElement('div');m.id='assetV2';m.className='xdv-layer';m.setAttribute('aria-hidden','true');
  m.innerHTML='<section class="xdv" role="dialog" aria-modal="true" aria-labelledby="avTitle"></section>';
  m.addEventListener('click',e=>{if(e.target===m)close();else onDetailClick(e);});
  m.addEventListener('input',e=>{if(e.target.matches('.idv-input textarea')){draft=e.target.value;m.querySelector('.idv-save')?.classList.toggle('on',!!draft.trim());}});
  m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&e.target.matches('.idv-input textarea')){e.preventDefault();saveNote();}});
  document.body.append(m);return m;
 }
 const year=v=>String(v||'').slice(0,4);
 function detailHtml(s){
  const t=TAG[s.health]||TAG.dormant,p=s.primary,address=s.canonicalAddress||s.addresses[0]||'',opp=s.open.slice().sort((a,b)=>root.oppAmt(b)-root.oppAmt(a));
  const flow=['첫 관계 '+(root.fmtD(s.started)||'미기록'),'영업기회 '+s.deals.length+'건',s.lost.length?'<b class="xdv-red">실주 '+s.lost.length+'건'+(s.lostAmount>0?' · '+h(root.fmtAmt(s.lostAmount)):'')+'</b>':'실주 0건',s.open.length?'<b class="av-blue">진행 '+s.open.length+'건'+(s.openAmount>0?' · '+h(root.fmtAmt(s.openAmount)):'')+'</b>':'진행 0건','<b class="av-green">수주 '+h(root.siteWonAmountLabel(s))+'</b>'].join(' → ');
  const people=s.contacts.filter(c=>c!==p).slice(0,4).map(c=>{const moved=!c.current&&!!c.currentSite;return '<div class="av-person"><b>'+h(c.name)+' · '+h(c.role)+'</b><span>'+h(root.phoneFmt(c.mobile||c.officeTel)||'연락처 없음')+(c.current?'':' · 과거')+'</span>'+(moved?'<em>근무지 이동 → '+h(c.currentSite)+'</em>':'')+'</div>';}).join('');
  const key=p?'<b>'+h(p.name)+' · '+h(p.role)+'</b><span>'+h(root.phoneFmt(p.mobile||p.officeTel)||'연락처 미입력')+'</span><div class="av-tags"><em>'+(p.current?'핵심담당자':'과거 담당')+'</em>'+(!p.current&&p.currentSite?'<em class="amber">근무지 이동</em>':'')+'</div>'+(p.mobile?'<div class="xdv-three"><a class="fill" href="tel:'+attr(root.phoneN(p.mobile))+'">전화</a><a href="sms:'+attr(root.phoneN(p.mobile))+'">문자</a><button type="button" data-ad="kakao">카카오</button></div>':''):'<b class="xdv-warn">핵심 인물 미등록</b><span>영업건 상세에서 연락처를 추가하세요</span>';
  const facts=[['관계 시작',root.fmtD(s.started)],['현재 담당',s.owners.join(', ')],['최초 관계',[s.firstInquiry?'문의 '+root.fmtD(s.firstInquiry):'',s.firstDeal?'영업 '+root.fmtD(s.firstDeal):''].filter(Boolean).join(' · ')],['주소',address],['관리사무소',p&&p.officeTel?root.phoneFmt(p.officeTel):''],['최근 기록',s.lastDays===null?'':lastLabel(s)]];
  const left='<div class="xdv-card"><span class="xdv-label">핵심 인물</span>'+key+'</div>'+(people?'<div class="xdv-card"><b>다른 인물 '+(s.contacts.length-1)+'명</b>'+people+'</div>':'')
   +'<div class="xdv-card"><b>기본 정보</b><dl class="xdv-facts">'+facts.map(([k,v])=>'<div><dt>'+h(k)+'</dt>'+(!v&&k==='주소'?'<dd><button type="button" class="xdv-edit" data-ad="address">미입력 · 입력하기</button></dd>':'<dd'+(v?'':' class="xdv-warn"')+'>'+h(v||'미입력')+'</dd>')+'</div>').join('')+'</dl><button type="button" class="xdv-link" data-ad="address">주소 입력 · 수정 (변경 사유 기록) →</button></div>';
  const events=root.siteTimeline(s).slice().sort((a,b)=>String(a.at||'').localeCompare(String(b.at||'')));
  const kind=e=>/과거 메모|메모/.test(e.title)?'memo':/전화|문자|방문|메일/.test(e.title)?'out':/견적문의 접수/.test(e.title)?'in':'sys';
  const thread=events.length?events.map(e=>'<div class="idv-msg '+kind(e)+'"><div class="idv-meta"><em>'+h(e.title)+'</em>'+(e.tag?'<i class="dvu-tag">'+h(e.tag)+'</i>':'')+'<span>'+h(root.fmtD(e.at)||'날짜 미기록')+'</span></div>'+(e.sub?'<div class="idv-bubble">'+h(e.sub)+'</div>':'')+'</div>').join(''):'<p class="ddv-nothing">관계 이력이 없습니다</p>';
  const target=opp[0],composer=target?'<div class="idv-composer"><div class="idv-ctabs"><div role="tablist"><button type="button" role="tab" aria-selected="true">메모 남기기</button></div><span class="av-target">진행 중 영업건 «'+h(target.work_name||target.work||root.dealWorkSummary(target)||'영업기회')+'»에 기록됩니다</span></div><div class="idv-input"><textarea rows="1" aria-label="메모" placeholder="예: 관리소장 교체 예정 — 11월 재방문">'+h(draft)+'</textarea><button type="button" class="idv-save'+(draft.trim()?' on':'')+'" data-ad="save">저장</button></div><div class="idv-err" role="alert"></div></div>':'<div class="idv-composer idv-locked">진행 중인 영업건이 없습니다 — 새 기록은 영업건을 만든 뒤 남길 수 있습니다</div>';
  const center='<div class="idv-chead"><b>관계 타임라인</b><span>'+events.length+'건</span><em>문의 → 영업 → 활동 → 수주 · 종료</em></div><div class="idv-thread">'+thread+'</div>'+composer;
  const brands={};s.deals.forEach(d=>{const b=d.brand||'미지정';brands[b]=(brands[b]||0)+root.oppAmt(d);});
  const book='<div class="xdv-card"><b>누적 거래</b><div class="av-four"><div><span>전체 영업기회</span><b>'+s.deals.length+'건</b><small>'+h(amt(s.totalAmount)||'–')+'</small></div><div class="g"><span>수주</span><b>'+s.won.length+'건</b><small>'+h(root.siteWonAmountLabel(s))+'</small></div><div class="r"><span>실주 · 종료</span><b>'+s.lost.length+'건</b><small>'+h(amt(s.lostAmount)||'–')+'</small></div><div class="b"><span>진행 중</span><b>'+s.open.length+'건</b><small>'+h(amt(s.openAmount)||'–')+'</small></div></div><div class="av-brands">'+(Object.keys(brands).sort((a,b)=>brands[b]-brands[a]).map(b=>'<span>'+h(b)+' '+h(amt(brands[b])||'0원')+'</span>').join('')||'<span>사업유형 기록 없음</span>')+'</div></div>';
  const live='<div class="xdv-card"><b>지금 진행 중인 영업</b>'+(opp.length?opp.map(d=>{const na=root.briefNext(d);return '<button type="button" class="av-opp'+(na&&na.text?'':' none')+'" data-ad="deal" data-value="'+attr(root.dealKey(d))+'"><b>'+h(d.work_name||d.work||root.dealWorkSummary(d)||'영업기회')+'</b>'+(root.DealUnits?root.DealUnits.assetLine(d):'')+'<span>'+h(root.stageLabel(root.dealStage(d)))+' · '+h(amt(root.oppAmt(d))||'금액 미입력')+' · '+h(root.repN(d.assignee))+' · '+h(root.fmtD(d.created||d.created_at)||'')+'</span><em>'+h(na&&na.text?'다음: '+na.text:'다음 할 일 없음')+'</em><u>파이프라인에서 열기 →</u></button>';}).join(''):'<p>현재 진행 중인 영업기회가 없습니다.</p>')+'</div>';
  const hist=s.deals.slice().sort((a,b)=>String(b.created||'').localeCompare(String(a.created||''))).slice(0,8).map(d=>{const won=root.isWon(d),open=root.isOpen(d);return '<div class="av-hist"><span>'+h(year(won?root.wonDate(d):d.closed||d.created)||'–')+'</span><b>'+h(root.dealWorkSummary(d)||'공종 미분류')+'</b><em class="'+(won?'g':open?'b':'r')+'">'+(won?'수주':open?'진행':'실주')+'</em><span>'+h(won?root.siteWonDealAmountLabel(d):amt(root.oppAmt(d))||'–')+'</span></div>';}).join('');
  const works='<div class="xdv-card"><b>공종 이력</b>'+(hist||'<p>영업 이력이 없습니다.</p>')+'</div>';
  const reasons=[...new Set(s.lost.map(d=>d.lost_reason||d.stage_contexts?.lost?.fields?.close_reason).filter(Boolean))],expand=root.siteExpansion(s);
  const learn=(s.lost.length||expand.length)?'<div class="xdv-card av-learn"><span class="xdv-eyebrow">이 단지에서 배울 것</span>'+(s.lost.length?'<b>'+h(reasons.length?'실주 사유: '+reasons.join(' · '):'실주 '+s.lost.length+'건 — 사유가 기록되지 않았습니다')+'</b><p>다음 제안 전에 실주 사유부터 확인하세요</p>':'')+expand.map(x=>'<div class="av-signal"><b>↗ '+h(x[0])+'</b><span>'+h(x[1])+'</span></div>').join('')+'</div>':'';
  return '<header class="xdv-top"><div class="xdv-top1"><div class="xdv-chips">'+s.brands.slice(0,3).map(b=>'<span class="idv-brand">'+h(b)+'</span>').join('')+'<span class="xdv-tag av-tag-'+t[1]+'">고객 자산 · '+t[0]+'</span></div><button type="button" class="xdv-close" data-ad="close" aria-label="닫기">✕</button></div><h2 id="avTitle">'+h(s.name)+'</h2><p class="av-flow">'+flow+'</p></header>'
   +'<div class="xdv-body"><aside class="xdv-c1">'+left+'</aside><main class="xdv-c2">'+center+'</main><aside class="xdv-c3">'+book+live+works+learn+'</aside></div>';
 }
 function renderDetail(){
  if(!openKey)return;const s=find(openKey);if(!s){close();return;}
  const box=node().querySelector('.xdv');box.innerHTML=detailHtml(s);const th=box.querySelector('.idv-thread');if(th)th.scrollTop=th.scrollHeight;
 }
 function open(key){const s=find(key);if(!s)return;const m=node();if(openKey!==key)draft='';openKey=key;returnFocus=document.activeElement;renderDetail();m.classList.add('on');m.setAttribute('aria-hidden','false');m.querySelector('.xdv-close')?.focus();}
 function close(restore){const m=document.getElementById('assetV2');if(m){m.classList.remove('on');m.setAttribute('aria-hidden','true');}const f=returnFocus;openKey=null;returnFocus=null;draft='';if(restore!==false&&f&&f.isConnected)f.focus?.({preventScroll:true});}
 /* 메모 = 진행 중 영업건의 기존 연락 기록 경로 */
 async function saveNote(){
  const s=find(openKey),m=node(),ta=m.querySelector('.idv-input textarea'),err=m.querySelector('.idv-err'),save=m.querySelector('.idv-save');if(!s||!ta||save.disabled)return;
  const d=s.open.slice().sort((a,b)=>root.oppAmt(b)-root.oppAmt(a))[0],note=ta.value.trim();err.textContent='';
  if(!note){err.textContent='기록할 내용을 적어 주세요.';return;}
  if(!d||!root.Phase1?.queue||typeof root.queueDetailContactOperation!=='function'){err.textContent='로그인 상태에서만 저장할 수 있습니다.';return;}
  save.disabled=true;save.textContent='확인 중…';
  try{
   const at=new Date().toISOString(),id=root.queueDetailContactOperation('activity',{opportunity_id:d.id,type:'메모',note,result:'',occurred_at:at});
   await root.Phase1.queue.flush();const row=root.Phase1.queue.list().find(q=>q.request_id===id);
   if(row?.status!=='done'||row.ack?.ok!==true)throw Error(row?.error||'서버 확인 대기 중입니다. 잠시 뒤 다시 확인해 주세요.');
   d.activities=Array.isArray(d.activities)?d.activities:[];d.activities.unshift({id:row.ack.activity_id,type:'메모',note,at,occurred_at:at});
   root.saveLocal?.();root.invalidateSiteMasterData?.();draft='';toast('메모를 남겼습니다');renderDetail();
  }catch(e){err.textContent=String(e.message||e);save.disabled=false;save.textContent='저장';}
 }
 function onDetailClick(e){
  const b=e.target.closest('[data-ad]');if(!b||!openKey)return;const a=b.dataset.ad,s=find(openKey);if(!s)return;
  if(a==='close')close();
  if(a==='save')saveNote();
  if(a==='deal'){const d=s.deals.find(x=>root.dealKey(x)===b.dataset.value);if(d){close(false);root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));}}
  if(a==='address'){close(false);root.SITE_MASTER_CACHE=[s];root.openSiteMaster(0);}
  if(a==='kakao'){const d=s.open[0]||s.deals[0];if(d){close(false);root.CUR_DETAIL={kind:'deal',key:root.dealKey(d),item:d};root.openRelationshipMessage?.('kakao');}}
 }
 /* 연결 검토 · 과거자료 연결은 데이터 정리 · 검토 화면 아래에 붙인다 */
 function mountReviews(){
  const pg=document.getElementById('pg-dup');if(!pg||root.G.page!=='dup'||!enabled())return;
  let box=document.getElementById('dup-link-reviews');if(!box){box=document.createElement('div');box.id='dup-link-reviews';box.className='av-reviews';pg.append(box);}
  if(box.__mounted)return;box.__mounted=true;
  try{root.PCOrganizationHistory?.mount(box,'');root.PCSiteRecordReview?.mount(box,'');}catch(e){box.__mounted=false;}
 }
 function boot(){
  const base=root.paintSites;
  if(typeof base==='function')root.paintSites=function(){
   const pg=document.getElementById('pg-sites'),bar=pg?.querySelector(':scope>.cf-bar');
   if(!enabled()){pg?.classList.remove('av-on','av-adv-on');if(bar)bar.hidden=true;close(false);return base.apply(this,arguments);}
   const box=document.getElementById('dup-link-reviews');if(box)box.__mounted=false;
   try{paint();}catch(e){console.warn('[고객 자산 v2]',e);pg?.classList.remove('av-on');return base.apply(this,arguments);}
  };
  const U=root.DataCleanupUI;
  if(U&&typeof U.render==='function'){const r=U.render;U.render=function(){const out=r.apply(U,arguments);try{mountReviews();}catch(e){}return out;};}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.AssetV2={enabled,paint,open,close,brandStats};
})(window);
