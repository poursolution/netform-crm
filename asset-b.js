/* 고객 자산 — 파이프라인 B안 틀 (2026-10-03 대표: "확장관리 · 경남지사 · 고객자산 · 문자 전부 파이프라인 기준으로")
   StageBoard 공용 부품으로 왼쪽 관계 진단(활성 · 기존고객 · 위험/휴면 막대 3칸 · 숫자 3개 · 왜 멈춰 있나 · 뭘 해야 하나) / 오른쪽 확인할 단지(리스트 · 보드).
   근거 데이터 · 관계 상태(siteHealth) · 상세 모달 · 주소/더보기는 asset-v2 그대로. 기준(진행 중 90일 무접촉 = 관계위험, 1년 = 휴면)은 기존 siteHealth 규칙,
   관계 연락 주기(수주 고객 2개월 1회)는 2026-10-02 회의 지침 — OPS_RULES.waitContactDays.
   끄기: G.assetBOff=true → 고객 자산 v2 묶음 표. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const SB=()=>root.StageBoard,V=()=>root.AssetV2;
 const RED='#d93a3a',INK='#374151';
 const R=()=>root.OPS_RULES||{};const wait=()=>Number(R().waitContactDays)||60;
 const enabled=()=>!root.G.assetBOff&&!root.G.assetV2Off&&!!root.StageBoard&&!!root.AssetV2;
 const amt=v=>v>0?root.fmtAmt(v):'0원';
 const bucketOf=s=>s.health==='active'?'live':(s.health==='risk'||s.health==='dormant')?'cold':'keep';
 const CFG={id:'asset-b',name:'고객 자산',unit:'곳',stallUnit:'',stallName:'최근 기록',stallDesc:'마지막 기록 뒤 지난 일수',stallRed:90,listTitle:'확인할 단지',openLabel:'열기',diagTitle:'관계 진단',
  desc:()=>'한 아파트에 얼마가 쌓였고 지금 얼마가 진행 중인지 · 관계가 식기 전에 연락 — 진행 중 단지는 관계관리 상태별 주기(집중 7일 · 일반 월 1회 · 대기 2개월 · 보류 재검토일), 수주 고객은 '+Math.round(wait()/30)+'개월 1회 관계 연락, 실주 단지는 사유 확인 후 재제안 시기 등록',
  axis:'관계 상태',
  S:[['live','활성 · 진행 중','#15171c','상태별 주기 안 접촉 유지'],['keep','기존고객 · 재접촉','#8a909c','2개월 1회 관계 연락'],['cold','관계위험 · 휴면','#d5d9e0','먼저 연락 · 장기수선 일정 확인']],
  RS:{risk:['관계위험 · 진행 금액 걸림',RED,'연락','진행 금액이 걸린 채 90일 넘게 접촉 없음 — 금액 큰 순으로 이번 주 관리소장 통화','open'],
      lost2:['실주 2회 · 수주 없음',RED,'재제안','같은 단지에서 두 번 실주 — 사유(가격 · 공법 · 관계 · 일정) 확인 후 재제안 시기 등록','open'],
      recontact:['재접촉 필요 · 주기 넘김',RED,'연락','진행 중 영업건의 상태별 연락 주기(집중 7일 · 일반 월 1회 · 대기 2개월)를 넘김, 또는 실주 뒤 60일 넘게 접촉 없음 — 분류가 안 된(미확인) 건은 제외하고 분류부터','open'],
      cold60:['수주 고객 2개월 넘게 연락 없음',INK,'관계 연락','수주 고객은 2개월 1회 관계 연락 · 하자 · 내년 공사 · 관리소장 교체 확인','open'],
      nokey:['핵심 인물 미확인',INK,'연락처','관리소장 · 입대의 회장 연락처 확보(진행 · 수주 단지)','open'],
      dormant:['1년 이상 움직임 없음',INK,'캠페인','장기수선 일정 확인 문자 캠페인 대상','open'],
      wonamt:['수주 금액 미입력',INK,'금액 확인','수주 건의 계약 금액을 기록(누적 수주 집계)','open'],
      noaddr:['주소 미입력',INK,'주소 입력','주소가 있어야 근처 현장 · 지도 · 중복 정리가 됨','open']},
  kpi2:(inB)=>{const won=inB.filter(i=>i.extra.s.wonAmount>0),sum=won.reduce((a,i)=>a+i.extra.s.wonAmount,0);return ['누적 수주',sum?root.fmtAmt(sum):'0원',won.length+'곳'+(won.length?' · 평균 '+root.fmtAmt(sum/won.length):'')];}
 };
 function item(s){
  const bucket=bucketOf(s),p=s.primary,ld=s.lastDays;
  const sub=(root.SITE_HEALTH[s.health]||{}).label+(s.open.length?' · 진행 '+s.open.length+'건 '+amt(s.openAmount):'')+(s.lost.length?' · 실주 '+s.lost.length+'건':'')+(ld===null?' · 기록 없음':'')+(p?' · '+p.name+' '+p.role:'');
  const rs=[];
  if(s.health==='risk'&&s.openAmount>0)rs.push('risk');
  if(s.lost.length>=2&&!s.won.length)rs.push('lost2');
  if(s.health==='recontact')rs.push('recontact');
  if(s.won.length&&!s.open.length&&ld!==null&&ld>=wait()&&s.health!=='dormant')rs.push('cold60');
  if(!p&&(s.open.length||s.won.length))rs.push('nokey');
  if(s.health==='dormant')rs.push('dormant');
  if(s.wonMissingAmountCount>0)rs.push('wonamt');
  if(!s.canonicalAddress)rs.push('noaddr');
  return {key:s.key,site:s.name,brand:s.brands[0]||'',owner:s.owners.join(', ')||'미배정',amount:s.wonAmount,amountText:'누적 '+amt(s.wonAmount),bucket,sub,rs,stall:ld===null?0:ld,extra:{s}};
 }
 function scoped(){
  const G=root.G;G.siteBrand='전체';G.siteOwner='전체';G.siteAddress=G.siteAddress||'전체';G.workFilter='전체';
  const owner=root.SalesScope.state().owner||'전체',sel=root.SalesFilterState.state().brands||[];
  const found=root.siteMasterData().filter(root.siteMatches);
  const brandOk=s=>!sel.length||s.brands.some(b=>sel.includes(b)),ownerOk=s=>owner==='전체'||(owner==='미배정'?!s.owners.length:s.owners.includes(owner));
  const scope=found.filter(s=>brandOk(s)&&ownerOk(s)),status=G.siteStatus&&G.siteStatus!=='전체'?G.siteStatus:'전체';
  return {found,scope,status,rows:scope.filter(s=>status==='전체'||s.health===status),ownerFree:found.filter(brandOk)};
 }
 function topHtml(x){
  const cur=root.SalesScope.state().owner||'전체',count=k=>x.scope.filter(s=>s.health===k).length;
  const pills='<div class="plv-pills" role="group" aria-label="관계 상태">'+[['전체','전체',x.scope.length]].concat(['active','customer','recontact','risk','dormant'].map(k=>[k,root.SITE_HEALTH[k].label,count(k)])).map(([v,t,n])=>'<button type="button" data-ab="status" data-value="'+v+'" aria-pressed="'+(x.status===v)+'">'+h(t)+' <b>'+n.toLocaleString('ko-KR')+'</b></button>').join('')+'</div>';
  const menu='<details class="av-more"><summary>··· 더보기</summary><div class="av-menu"><button type="button" data-ab="advisory">기술자문 원본 자료</button><button type="button" data-ab="review">연결 검토 · 과거자료 연결 → 데이터 정리 · 검토</button><label>주소 상태 <select data-ab-address aria-label="주소 상태">'+['전체','완료','후보','미입력'].map(v=>'<option'+(root.G.siteAddress===v?' selected':'')+'>'+v+'</option>').join('')+'</select></label></div></details>';
  const map=new Map();x.ownerFree.forEach(s=>s.owners.forEach(o=>{const v=map.get(o)||{owner:o,n:0,late:0};v.n++;if(s.health==='risk')v.late++;map.set(o,v);}));
  const chips=root.todayIsAdmin?.()&&map.size?'<div class="plv-owners" role="group" aria-label="담당자별"><span>담당자별</span>'+[...map.values()].sort((a,b)=>b.late-a.late||b.n-a.n).slice(0,12).map(o=>'<button type="button" class="plv-chip'+(cur===o.owner?' on':'')+'" data-ab="owner" data-value="'+attr(o.owner)+'" aria-pressed="'+(cur===o.owner)+'">'+h(o.owner)+' <b>'+o.n+'</b>'+(o.late?'<em> · 위험 '+o.late+'</em>':'')+'</button>').join('')+'</div>':'';
  return '<div class="plv-intro ab-top"><i style="background:#64748b"></i><b>관계 상태</b><span>'+x.rows.length.toLocaleString('ko-KR')+'곳</span><div class="plv-spacer"></div>'+pills+menu+'</div>'+chips;
 }
 function open(key){V().open(key);}
 function onTop(e){
  const b=e.target.closest('[data-ab]');if(!b)return;const a=b.dataset.ab,v=b.dataset.value,st=SB().state('asset');
  if(a==='status'){root.G.siteStatus=v;root.ListPager.reset(st);root.paintSites();}
  if(a==='owner'){const cur=root.SalesScope.state().owner||'전체';root.CommonFilterBar.setOwner(cur===v?'전체':v);root.paintSites();}
  if(a==='advisory'){const pg=document.getElementById('pg-sites'),on=pg.classList.toggle('av-adv-on');if(on){pg.querySelector('.advisory-library')?.scrollIntoView({block:'nearest'});try{root.TechnicalAdvisoryUI?.projects?.shown();}catch(e){}}b.closest('details')?.removeAttribute('open');}
  if(a==='review')root.goPage('dup');
 }
 function paint(){
  const host=document.getElementById('site-master'),pg=document.getElementById('pg-sites');if(!host)return;
  const x=scoped(),S=SB().state('asset');
  CFG.topHtml=topHtml(x);
  host.innerHTML=SB().html(CFG,x.rows.map(item),S);
  SB().bind(host,{state:()=>SB().state('asset'),cfg:()=>CFG,paint:()=>root.paintSites(),open});
  if(!host.__ab){host.__ab=true;host.addEventListener('click',onTop);host.addEventListener('change',e=>{if(e.target.matches('[data-ab-address]')){root.G.siteAddress=e.target.value;root.paintSites();}});}
  if(root.G.page==='sites'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='고객 자산';if(p)p.textContent='왼쪽 관계 진단 → 오른쪽 확인할 단지 · 빨강 사유부터 — 얼마가 쌓였고 얼마가 진행 중인지';}
  pg?.classList.add('av-on','ab-on');root.CommonFilterBar?.mount('sites');const bar=pg?.querySelector(':scope>.cf-bar');if(bar)bar.hidden=false;
 }
 function boot(){
  const base=root.paintSites;if(typeof base!=='function'||base.__ab)return;
  const wrapped=function(){
   const out=base.apply(this,arguments);/* v2 가 먼저(상세 모달 갱신 · 검토 칸 정리) → 목록만 B안으로 바꾼다 */
   if(!enabled()||!document.getElementById('asset-v2'))return out;
   try{paint();}catch(e){console.warn('[고객 자산 B안]',e);}
   return out;
  };
  wrapped.__ab=true;root.paintSites=wrapped;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.AssetB={enabled,CFG,item};
})(window);
