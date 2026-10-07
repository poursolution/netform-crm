/* 공통 고정 필터줄 + 화면 제목 (2026-10-01 디자인 핸드오프 'design_handoff_today_inquiry' ①)
   오늘 업무·견적문의 두 화면 위에만 붙는다(대시보드·파이프라인·다른 메뉴는 적용하지 않는다).
   한 줄: 브랜드 알약(색 점·이름·건수) | 담당자 선택(+해제) | 검색(Ctrl K). 선택값은 화면을 옮겨도 유지된다.
   기존 상태를 그대로 쓴다 — 브랜드=SalesFilterState(data-sf-brand 처리기), 담당자=SalesScope, 검색=G.q.
   오늘 업무는 자체 상태(todayQueueOwner·todayQueueSearch)를 같은 값으로 맞춘다. 저장·권한은 건드리지 않는다. */
(function(root){
 'use strict';
 const PAGES=['today','inq'];
 /* 공통 셸 v2(2026-10-02): 예전 두 줄 필터(#unibar)를 쓰던 화면도 같은 한 줄로. 연도·분기는 기간이 필요한 화면의 줄 오른쪽에 작은 선택으로 둔다 */
 const SHELL=['brief','report','work','mgmt','repmanage'],PERIOD=['brief','work','mgmt']/* 리포트는 화면 안에 월간·분기·연간 전환이 있다 */,NO_OWNER=['repmanage'];
 const shellOn=page=>SHELL.includes(page)&&!!root.ShellV2?.enabled?.();
 const DASH=['dash','control','perf'],shellLike=page=>SHELL.includes(page)||(DASH.includes(page)&&!!root.DashB?.enabled?.());/* 영업 대시보드 v2 */
 const BRANDS=['석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어'];
 const DOT={'전체':'#9ca3af','석민이앤씨':'#f08c2e','POUR솔루션':'#30a46c','POUR공법':'#8b5cf6','아파트스퀘어':'#3b6ce4'};
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const admin=()=>{try{return !!root.todayIsAdmin?.();}catch(e){return false;}};
 const scope=()=>root.SalesScope.state();
 function owner(){const s=scope();return s.owner&&s.owner!=='전체'?s.owner:'전체';}
 function setOwner(v){
  root.SalesScope.change('owner',v||'전체');
  if(!v||v==='전체'||v==='경남지사')scope().assignment='all';/* 전체·지사 풀은 배정 여부로 거르지 않는다 */
  root.G.todayQueueOwner=v||'전체';lastT=root.G.todayQueueOwner;root.G.todayQueuePage=1;root.G.todayInquiryPage=1;root.G.todayPipelinePage=1;root.G.inqPage=1;
 }
 function setSearch(v){v=String(v||'').trim();root.G.q=v;root.G.todayQueueSearch=v;lastQ=v;root.G.inqPage=1;root.G.todayQueuePage=1;}
 function brandOf(x){return x.brand||root.inquiryBrandOf?.(x)||'';}
 /* 건수: 견적문의=새 목록이 읽어 둔 기존 브랜드 건수, 오늘 업무=오늘 목록의 브랜드별 건수 */
 function brandStats(page){
  const sel=root.SalesFilterState.state().brands||[];
  if(page==='inq'){const s=root.InquiryListV2?.brandStats?.();if(s&&s.length)return s;}
  if(page==='pipe'){const s=root.PipelineListV2?.brandStats?.();if(s&&s.length)return s;}
  if(page==='expansion'){const s=root.ExpansionV2?.brandStats?.();if(s&&s.length)return s;}
  if(page==='gyeongnam'){const s=root.GyeongnamV2?.brandStats?.();if(s&&s.length)return s;}
  if(page==='sites'){const s=root.AssetV2?.brandStats?.();if(s&&s.length)return s;}
  if(page==='campaign'){const s=root.SmsV2?.brandStats?.();if(s&&s.length)return s;}
  if(shellLike(page)){let all=[];try{all=(root.B.deals||[]).map(d=>d.brand||'').concat(root.operationalInquiries(root.B.inquiries||[]).map(q=>q.brand||''));}catch(e){}const nm=[...new Set(BRANDS.concat(all.filter(Boolean)))];return [{name:'전체',n:all.length,on:!sel.length}].concat(nm.map(b=>({name:b,n:all.filter(x=>x===b).length,on:sel.includes(b)})));}
  let rows=[];try{rows=page==='today'?(root.TodayWorkQueue?.data?.().rows||[]).map(x=>x.item):root.inqCtlScopeActive();}catch(e){rows=[];}
  const names=[...new Set(BRANDS.concat(rows.map(brandOf).filter(Boolean)))];
  return [{name:'전체',n:rows.length,on:!sel.length}].concat(names.map(b=>({name:b,n:rows.filter(r=>brandOf(r)===b).length,on:sel.includes(b)})));
 }
 /* 담당자 선택 = 실제 업무 담당자 전부(2026-10-07 design_handoff_ops_12 B④): 묶음 = 영업 / 관리 · 경영 / 지사 · 그 밖(지사 · 외부 · 경남지사 미지정 · 퇴사자 담당 남음 · 미배정).
    이름 뒤 (n) = 진행 중 영업건 수(PipelineScope.isActive · 과거 이관 제외). 퇴사 · 명단 밖 담당 · 미배정은 빨강. 예전 '내부직원 · 외부직원' 묶음을 대신한다 */
 function ownerSelectHtml(cur){
  const M=root.SALES_PEOPLE_MASTER||[],PS=root.PipelineScope;let act=[];
  try{act=(root.B&&root.B.deals||[]).filter(d=>{try{return PS&&PS.on()?PS.isActive(d):root.isActiveDeal(d);}catch(e){return false;}});}catch(e){act=[];}
  const cnt=new Map();act.forEach(d=>{let n='';try{n=root.repN(d.assignee);}catch(e){n=String(d.assignee||'').trim();}n=n||'미배정';cnt.set(n,(cnt.get(n)||0)+1);});
  const n_=n=>cnt.get(n)?' ('+cnt.get(n)+')':'';
  const opt=(n,tag,red)=>'<option value="'+attr(n)+'"'+(n===cur?' selected':'')+(red?' style="color:#b42318"':'')+'>'+h(n+(tag?' · '+tag:'')+n_(n))+'</option>';
  const active=M.filter(p=>p.active!==false&&p.role!=='branch_pool'&&p.name);/* 경남지사 미지정(풀)은 아래에 따로 */
  const tag=p=>p.title&&p.title!=='본사영업'?p.title:(p.badge&&!/내부영업/.test(p.badge)?p.badge:'');/* 직함(팀장 · 이사 · 상무 · 대표 · 영업관리) 또는 소속 꼬리표 */
  const sales=active.filter(p=>p.team==='head_office'&&p.role==='sales'),mgmt=active.filter(p=>p.team==='head_office'&&p.role!=='sales'),etc=active.filter(p=>p.team!=='head_office');
  const gone=[...cnt.keys()].filter(n=>n!=='미배정'&&n!=='경남지사'&&!active.some(p=>p.name===n)).sort((a,b)=>a.localeCompare(b,'ko'));/* 명단에 없거나 비활성인 담당이 남은 진행 건 */
  const grp=(label,list)=>list.length?'<optgroup label="'+attr(label)+'">'+list.join('')+'</optgroup>':'';
  return '<option value="전체"'+(cur==='전체'?' selected':'')+'>담당자 전체</option>'
   +grp('영업',sales.map(p=>opt(p.name,tag(p))))+grp('관리 · 경영',mgmt.map(p=>opt(p.name,tag(p))))
   +grp('지사 · 그 밖',etc.map(p=>opt(p.name,tag(p))).concat(['<option value="경남지사"'+(cur==='경남지사'?' selected':'')+'>경남지사 미지정'+h(n_('경남지사'))+'</option>'],gone.map(n=>opt(n,'퇴사 · 재배정 필요',true)),[opt('미배정','',true)]));
 }
 const groupedOwners=ownerSelectHtml;
 function periodHtml(){const G=root.G,years=[...new Set((root.B.deals||[]).map(d=>String(d.created||'').slice(0,4)).filter(y=>/^20/.test(y)))].sort().reverse();if(!years.length)years.push(String(new Date().getFullYear()));const cur=String(G.year)+'|'+(Number(G.quarter)||0),opts=[['전체|0','전체 기간']];years.forEach(y=>{opts.push([y+'|0',y+' · 연간']);[1,2,3,4].forEach(q=>opts.push([y+'|'+q,y+' · '+q+'분기']));});return '<label class="cf-period"><span>기간</span><select aria-label="기간 선택" data-cf="period">'+opts.map(o=>'<option value="'+o[0]+'"'+(o[0]===cur?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></label>';}
 function html(page){
  const cur=owner(),q=root.G.q||'';
  if(shellLike(page)){
   const pills=brandStats(page).map(b=>'<button type="button" class="cf-pill'+(b.on?' on':'')+'" data-sf-brand="'+attr(b.name)+'" aria-pressed="'+b.on+'"><i style="background:'+(DOT[b.name]||'#9ca3af')+'"></i>'+h(b.name)+' <em>'+h(b.n)+'</em></button>').join('');
   const own=NO_OWNER.includes(page)?'':'<i class="cf-div"></i><label class="cf-owner'+(cur!=='전체'?' on':'')+'"><span>담당자</span><select aria-label="담당자 선택" data-cf="owner" data-cf-shell="1">'+groupedOwners(cur)+'</select></label>'+(cur!=='전체'?'<button type="button" class="cf-clear" data-cf="clear" data-cf-shell="1">✕ 해제</button>':'');
   return '<div class="cf-brands" role="group" aria-label="브랜드">'+pills+'</div>'+own+'<input class="cf-search" data-cf="search" aria-label="현장·고객·연락처 검색" placeholder="현장 · 고객 · 연락처" value="'+attr(q)+'">'+(PERIOD.includes(page)?periodHtml():'');
  }
  const pills=brandStats(page).map(b=>'<button type="button" class="cf-pill'+(b.on?' on':'')+'" data-sf-brand="'+attr(b.name)+'" aria-pressed="'+b.on+'"><i style="background:'+(DOT[b.name]||'#9ca3af')+'"></i>'+h(b.name)+' <em>'+h(b.n)+'</em></button>').join('');
  const own=admin()?'<i class="cf-div"></i><label class="cf-owner'+(cur!=='전체'?' on':'')+'"><span>담당자</span><select aria-label="담당자 선택" data-cf="owner">'+ownerSelectHtml(cur)+'</select></label>'+(cur!=='전체'?'<button type="button" class="cf-clear" data-cf="clear">✕ 해제</button>':''):'';
  return '<div class="cf-brands" role="group" aria-label="브랜드">'+pills+'</div>'+own+'<input class="cf-search" data-cf="search" aria-label="현장·고객·연락처 검색" placeholder="'+(root.ShellV2?.enabled?.()?'현장 · 고객 · 연락처':'현장 · 고객 · 연락처 (Ctrl K)')+'" value="'+attr(q)+'">';
 }
 function mount(page){
  const pg=document.getElementById('pg-'+page);if(!pg||!root.B)return;
  let bar=pg.querySelector(':scope>.cf-bar');
  if(!bar){bar=document.createElement('div');bar.className='cf-bar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','공통 필터');pg.prepend(bar);bar.addEventListener('change',onChange);bar.addEventListener('click',onClick);bar.addEventListener('keydown',onKey);}
  const next=html(page);
  if(bar.__html!==next){const focused=document.activeElement===bar.querySelector('.cf-search');bar.__html=next;bar.innerHTML=next;if(focused){const s=bar.querySelector('.cf-search');s.focus();s.setSelectionRange(s.value.length,s.value.length);}}
  title(page);
 }
 /* 화면 제목: 상단 제목줄에 제목 + 설명 한 줄. 본문 안의 큰 제목은 지운다(오늘 업무·견적문의만) */
 function title(page){
  const t=document.getElementById('ptitle'),s=document.getElementById('psub');if(!t||!s)return;
  document.querySelector('.mhead')?.classList.add('cf-title');
  if(page==='today'){const d=new Date();t.textContent='오늘 업무';s.textContent=root.G.todayV3Sub&&root.TodayV3?.enabled?.()&&root.TodayTower?.enabled?.()&&!root.G.todayV2Off?root.G.todayV3Sub:!admin()&&root.G.todayRepSub&&root.TodayRepV2?.enabled?.()&&!root.G.todayV2Off?root.G.todayRepSub:(d.getMonth()+1)+'월 '+d.getDate()+'일 ('+'일월화수목금토'[d.getDay()]+') · '+(admin()?'사원별 현황을 먼저 보고, 행을 눌러 그 담당자 업무로 좁혀 보세요':'신규 문의와 진행 중 영업을 처리 순서대로 확인하세요');}
  if(page==='inq'&&(root.G.inqBucket||'전체')==='전체'&&!root.G.inqLegacyView&&!root.G.inqV2Off){t.textContent='견적문의';/* 목록 v3(시안 inquiry_v2): 제목 옆에 구글시트 연결 상태 · 고정 문구 */const L3=root.InquiryListV3;if(L3&&L3.headHtml&&L3.enabled&&L3.enabled()){const hh=L3.headHtml();if(s.__il!==hh||!s.querySelector('.il-sheet')){s.__il=hh;s.innerHTML=hh;}}else{s.__il='';s.textContent='위에서부터 처리하세요 · 배정 → 첫 연락 → 후속 연락 → 영업건 전환';}}
 }
 function repaint(){root.paint();}
 function shellOwner(v){root.SalesScope.change('type','all');root.SalesScope.change('owner',v||'전체');root.SalesFilterState.sync();}
 function onChange(e){const k=e.target.dataset.cf;if(k==='period'){const [y,q]=e.target.value.split('|');root.G.year=y;root.G.quarter=Number(q)||0;root.G.month=0;if(typeof root.uniSetQuarter==='function'&&Number(q))root.uniSetQuarter(Number(q));else if(typeof root.uniSetYear==='function'){root.G.quarter=0;root.G.repManagerQuarter=0;root.uniSetYear(y);}return;}if(k==='owner'&&e.target.dataset.cfShell){shellOwner(e.target.value);repaint();return;}if(k==='owner'){setOwner(e.target.value);repaint();}else if(k==='search'){setSearch(e.target.value);repaint();}}
 function onClick(e){const c=e.target.closest('[data-cf="clear"]');if(c&&c.dataset.cfShell){shellOwner('전체');repaint();return;}if(c){setOwner('전체');repaint();}}
 function onKey(e){if(e.target.dataset.cf==='search'){if(e.key==='Enter'){e.preventDefault();setSearch(e.target.value);repaint();}else if(e.key==='Escape'&&e.target.value){e.target.value='';setSearch('');repaint();}}}
 /* 화면에 들어올 때 오늘 업무 자체 상태를 공통 값으로 맞춘다. 오늘 업무 표에서 담당자 행을 누른 것도 공통 값으로 되돌려 적는다 */
 /* 오늘 업무는 자체 상태(todayQueueOwner·todayQueueSearch)가 있다. 마지막으로 맞춘 값(last)을 기억해
    오늘 업무 쪽에서 바뀐 것(담당자 행 클릭 등)은 공통 값으로 받아 적고, 아니면 공통 값을 오늘 업무에 넣는다 */
 let lastT=null,lastQ=null;
 function adoptOwner(t){root.SalesScope.change('owner',t);if(t==='전체'||t==='경남지사')scope().assignment='all';}
 function syncToday(){
  if(!admin())return;
  const t=root.G.todayQueueOwner||'전체',q=String(root.G.todayQueueSearch||'');
  if(lastT!==null&&t!==lastT)adoptOwner(t);else if(t!==owner())root.G.todayQueueOwner=owner();
  if(lastQ!==null&&q!==lastQ)root.G.q=q;else if(q!==String(root.G.q||''))root.G.todayQueueSearch=root.G.q||'';
  lastT=root.G.todayQueueOwner||'전체';lastQ=String(root.G.todayQueueSearch||'');
 }
 function adoptToday(){syncToday();}
 function boot(){
  const baseToday=root.paintTodayHome;if(typeof baseToday==='function')root.paintTodayHome=function(){syncToday();const want=admin()?owner():null,wantQ=String(root.G.q||'');let r=baseToday.apply(this,arguments);/* 오늘 업무가 계정 전환 감지로 자체 상태를 초기화했으면 공통 값으로 다시 맞춰 한 번 더 그린다 */if(want!==null&&((root.G.todayQueueOwner||'전체')!==want||String(root.G.todayQueueSearch||'')!==wantQ)){root.G.todayQueueOwner=want;root.G.todayQueueSearch=wantQ;lastT=want;lastQ=wantQ;r=baseToday.apply(this,arguments);}mount('today');return r;};
  const baseInq=root.paintInq;if(typeof baseInq==='function')root.paintInq=function(){const r=baseInq.apply(this,arguments);mount('inq');return r;};
  const th=document.getElementById('today-home-root');
  if(th){let t=null;new MutationObserver(()=>{if(t)return;t=setTimeout(()=>{t=null;if(root.G?.page==='today'){adoptToday();mount('today');}},80);}).observe(th,{childList:true,subtree:true});}
  /* 셸 v2: 예전 두 줄 필터를 쓰던 화면에 한 줄 필터를 붙이고 예전 줄은 감춘다(끄면 예전 그대로) */
  const basePaint=root.paint;if(typeof basePaint==='function')root.paint=function(){const r=basePaint.apply(this,arguments);try{const p=root.G?.page,uni=document.getElementById('unibar');SHELL.forEach(x=>{const b=document.querySelector('#pg-'+x+'>.cf-bar');if(b)b.hidden=!shellOn(x);});if(shellOn(p)){mount(p);const b=document.querySelector('#pg-'+p+'>.cf-bar');if(b)b.hidden=false;if(uni)uni.style.display='none';}}catch(e){console.warn('[공통 필터줄]',e);}return r;};
  const baseSync=root.syncPage;if(typeof baseSync==='function')root.syncPage=function(){const r=baseSync.apply(this,arguments);if(!PAGES.includes(root.G?.page)&&!(root.G?.page==='pipe'&&root.PipelineListV2?.enabled())&&!(root.G?.page==='expansion'&&root.ExpansionV2?.enabled())&&!(root.G?.page==='gyeongnam'&&root.GyeongnamV2?.enabled())&&!(root.G?.page==='sites'&&root.AssetV2?.enabled())&&!(root.G?.page==='campaign'&&root.SmsV2?.enabled()&&(root.G.campaignTab||'home')==='home'))document.querySelector('.mhead')?.classList.remove('cf-title');return r;};
  /* Ctrl/⌘+K: 이 두 화면에서는 필터줄 검색으로 */
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&String(e.key).toLowerCase()==='k'&&(PAGES.includes(root.G?.page)||['pipe','expansion','gyeongnam','sites','campaign'].includes(root.G?.page))){const s=document.querySelector('#pg-'+root.G.page+'>.cf-bar:not([hidden]) .cf-search');if(s){e.preventDefault();e.stopImmediatePropagation();s.focus();s.select();}}},true);
  /* 자료가 DOMContentLoaded보다 먼저 그려진 첫 진입도 현재 필터로 연결한다. */
  if(root.G?.page==='today'&&root.B){try{syncToday();mount('today');}catch(e){console.warn('[공통 필터줄 초기화]',e);}}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.CommonFilterBar={mount,setOwner,setSearch,owner};
})(window);
