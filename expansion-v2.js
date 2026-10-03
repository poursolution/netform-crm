/* 확장관리 v2 (2026-10-01 디자인 핸드오프 'design_handoff_expansion') — 확장관리 메뉴(목록 + 상세창)만.
   목록: 공통 필터줄 → 안내 줄(준공연도 알약) → 담당자별 칩 → 진단 영역(파이프라인 진단 컴포넌트) → 묶음 표(이번 주 연락 · 유지접촉 · 니즈 확인 · 보류·전환)
   상세: 파이프라인 상세와 같은 3단 틀 — 머리(진행 막대 4칸) / 고객·관리 정보·자료 / 주고받은 내용 + 입력칸 / 지금 할 일 · 다음 영업 신호 · 관리 상태 · 전환
   데이터(expansionRecords)·상태·다음 접촉 저장(expansionSetStatus/SetNext)·접촉 기록(crm_expansion_note)·전환(기존 견적 발송 확인 → 전환창)은 그대로 쓴다.
   끄기: G.expansionV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const F=root.ExpansionFlow;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const GROUPS=[['week','이번 주 연락','#3b6ce4','준공 고객 하자 점검 · 타공종 확인'],['keep','유지접촉','#c4c8d0','다음 접촉일이 잡힌 고객'],['need','니즈 확인','#30a46c','추가 공사 니즈가 확인된 고객 — 견적문의로 넘기기'],['hold','보류 · 전환','#94a3b8','보류했거나 파이프라인으로 넘어간 고객']];
 const GRID='minmax(0,1.3fr) 64px minmax(0,1fr) minmax(0,1.2fr) 100px 90px 72px',COLS=['준공','공종 · 금액','다음 매출 추천','마지막 접촉','다음 접촉'];
 const PER=20,STEP=40;
 const enabled=()=>!root.G.expansionV2Off;
 const dealOf=r=>root.expansionSourceDeal(r)||{};
 const days=v=>{if(!v)return null;const n=root.daysTo(v);return Number.isFinite(n)?n:null;};
 const money=v=>v==null?'':v===0?'0원':root.fmtAmt(v);
 const ymd=v=>v?String(v).slice(0,10):'';
 const md=v=>{const s=ymd(v);return s?Number(s.slice(5,7))+'월 '+Number(s.slice(8,10))+'일':'';};
 const toast=(m,t)=>{if(typeof root.toast==='function')root.toast(m,t);};
 /* 기존 보드의 4칸 규칙 그대로(expansion-pool.js laneOf) */
 function lane(r){if(F.converted(r)||F.status(r)==='보류')return 'hold';const d=days(r.nextContactAt);if(F.status(r)==='니즈확인')return d!=null&&d<=0?'week':'need';if(d==null||d<=7)return 'week';return 'keep';}
 /* 공종: 확장 기록에 없으면 원 수주 건의 분류를 본다(상세에서 공종을 넣으면 바로 반영) */
 const workOf=r=>{const s=r.sourceWorkSummary||'';if(s&&!/미분류|미기록/.test(s))return s;try{const w=root.dealWorkSummary(dealOf(r));return w&&!/미분류|미기록/.test(w)?w:'';}catch(e){return '';}};
 const unclassified=r=>!workOf(r);
 const recommend=r=>r.needNote?'니즈 · '+r.needNote:(r.candidates||[]).join(' · ');
 function scoped(){
  const current=new Date().getFullYear(),year=root.G.expansionYear||String(current),q=String(root.G.q||'').trim().toLowerCase();
  const source=root.expansionRecords(),brandOk=r=>root.SalesFilterState.matchesBrand(dealOf(r).brand),searchOk=r=>!q||[r.site,r.owner,r.sourceWorkSummary,r.needNote,(r.candidates||[]).join(' ')].join(' ').toLowerCase().includes(q);
  const base=source.filter(r=>brandOk(r)&&searchOk(r)),mine=base.filter(r=>root.SalesScope.matches(r.owner,dealOf(r)));
  const inYear=(r,y)=>F.yearMatch(r,dealOf(r),y,current);
  /* 담당자 선택만 뺀 같은 조건 — 담당자별 칩 숫자용 */
  const s=root.SalesScope.state(),o=s.owner,a=s.assignment;let free=[];try{s.owner='전체';s.assignment='all';free=base.filter(r=>root.SalesScope.matches(r.owner,dealOf(r))&&inYear(r,year));}finally{s.owner=o;s.assignment=a;}
  return {source,current,year,mine,rows:mine.filter(r=>inYear(r,year)),free,inYear};
 }
 function brandStats(){
  const sel=root.SalesFilterState.state().brands||[],current=new Date().getFullYear(),year=root.G.expansionYear||String(current);let list=[];
  try{list=root.expansionRecords().filter(r=>root.SalesScope.matches(r.owner,dealOf(r))&&F.yearMatch(r,dealOf(r),year,current));}catch(e){list=[];}
  const names=[...new Set(['석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어'].concat(list.map(r=>dealOf(r).brand).filter(Boolean)))];
  return [{name:'전체',n:list.length,on:!sel.length}].concat(names.map(b=>({name:b,n:list.filter(r=>dealOf(r).brand===b).length,on:sel.includes(b)})));
 }
 /* ── 진단 모델(파이프라인 진단 컴포넌트가 그린다) ── */
 function diagnosis(rows,year){
  const D=root.PipelineDiagnosis;if(!D)return '';
  const act=rows.filter(r=>lane(r)!=='hold'),week=rows.filter(r=>lane(r)==='week'),need=rows.filter(r=>!F.converted(r)&&F.status(r)==='니즈확인'),made=rows.filter(F.converted),first=week.filter(r=>!r.lastContactAt).length;
  const K=(label,value,sub,tone)=>({label,value,sub,tone:tone||''});
  const since=r=>{const n=days(r.completionDate);if(n==null)return '준공일 미기록';const m=-n/30.4;return m<=6?'6개월 이내':m<=12?'6개월~1년':m<=24?'1~2년':'2년 이상';},order=['6개월 이내','6개월~1년','1~2년','2년 이상','준공일 미기록'];
  const wrap=list=>list.map(r=>({row:{owner:r.owner,amount:r.wonAmount},r}));
  const types=D.tally(wrap(act),x=>x.r.needNote?['확인된 니즈']:(x.r.candidates||[]),'추천 없음');
  const owners=new Map();act.forEach(r=>{const o=r.owner||'미배정',v=owners.get(o)||{n:0,c:new Map()};v.n++;(r.candidates||[]).forEach(c=>v.c.set(c,(v.c.get(c)||0)+1));owners.set(o,v);});
  const noWork=act.filter(unclassified).length,noTouch=act.filter(r=>!r.lastContactAt).length,noAmt=act.filter(r=>r.wonAmount==null).length;
  const tasks=[[noWork,'공종 미분류 '+noWork+'곳','준공 공종부터 기록 — 추천 타공종이 정확해져요','담당자 · 이번 주'],[noTouch,'접촉 기록 없음 '+noTouch+'곳','하자 점검 통화 체크리스트(누수 · 균열 · 주차장)로 첫 접촉','영업팀 · 이번 주'],[need.length?0:act.length,'니즈 확인 0곳','통화에서 추가 공사 니즈를 확인하면 상태를 «니즈 확인»으로','영업팀'],[made.length?0:need.length,'전환 0건 · 니즈 확인 '+need.length+'곳','니즈가 확인된 고객은 견적 확인 후 바로 전환','담당자'],[noAmt,'계약금액 미입력 '+noAmt+'곳','수주 금액을 확인해 기록','담당자']].filter(t=>t[0]>0).slice(0,4).map(t=>({basis:t[1],todo:t[2],who:t[3]}));
  return D.render({accent:'blue',
   kpis:[K('관리 고객',rows.length+'곳',(year==='전체'?'전체 준공연도':year==='이전'?'이전 준공':year+' 준공')+' 기준'),K('이번 주 연락',week.length+'곳',first?first+'곳은 첫 접촉 전':'기한 지남 · 7일 안 · 미지정'),K('니즈 확인',need.length+'곳',need.length?'추가 공사 니즈가 확인된 고객':'아직 확인된 추가 공사 없음',need.length?'':'warn'),K('파이프라인 전환',made.length+'건','확장 → 새 영업으로 넘긴 건',made.length?'':'warn')],
   cards:[{title:'어디서 다음 매출이 나오나',desc:'추천 유형',bars:types},{title:'언제 연락하나',desc:'준공 후 경과',bars:D.tally(wrap(act),x=>since(x.r),'',6).sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0]))},{title:'누가 챙기나',desc:'담당자 · 주된 추천',rows:[...owners].sort((a,b)=>b[1].n-a[1].n).slice(0,5).map(([o,v])=>[o,v.n,[...v.c].sort((a,b)=>b[1]-a[1])[0]?.[0]||'추천 없음'])}],
   action:{title:'그래서 뭘 해야 하나',desc:'확장 패턴에서 나온 과제',tasks}},{open:true,noToggle:true,scope:'expansion'});
 }
 /* ── 목록 ── */
 function rowHtml(r){
  const d=dealOf(r),y=F.recordYear(r,d),n=days(r.nextContactAt),owner=r.owner||'미배정',done=F.converted(r),hold=F.status(r)==='보류';
  const next=done?'<span class="g">전환 완료</span>':!r.nextContactAt?'<span class="a">미지정</span>':n<0?'<span class="r">'+Math.abs(n)+'일 지남</span><small>'+h(md(r.nextContactAt))+'</small>':n===0?'<span class="b">오늘</span><small>'+h(md(r.nextContactAt))+'</small>':'<span class="'+(hold?'m':'b')+'">'+n+'일 뒤</span><small>'+h(md(r.nextContactAt))+'</small>';
  const amt=money(r.wonAmount);
  return '<div class="plv-row" role="row" tabindex="0" data-xv="open" data-value="'+attr(r.id)+'" data-exp="'+attr(r.id)+'" style="grid-template-columns:'+GRID+'"><span class="plv-c plv-site"><b title="'+attr(r.site)+'">'+h(r.site||'현장명 확인 필요')+'</b><small class="'+(owner==='미배정'?'none':'')+'">'+h(owner)+'</small></span>'
   +'<span class="plv-c"><em class="plv-tag m">'+h(y||'미기록')+'</em></span>'
   +'<span class="plv-c"><span class="'+(unclassified(r)?'a':'')+'">'+h(unclassified(r)?'공종 미분류':workOf(r))+'</span><small class="'+(amt?'':'a')+'">'+h(amt||'계약금액 미입력')+'</small></span>'
   +'<span class="plv-c"><span title="'+attr(recommend(r))+'">'+h(recommend(r)||'확장 후보 미확인')+'</span></span>'
   +'<span class="plv-c">'+(r.lastContactAt?'<span>'+h(ymd(r.lastContactAt))+'</span>':'<span class="m">기록 없음</span>')+'</span>'
   +'<span class="plv-c">'+next+'</span><button type="button" class="plv-cta" data-xv="open" data-value="'+attr(r.id)+'">처리</button></div>';
 }
 function listHtml(s){
  const cur=root.SalesScope.state().owner||'전체',rows=s.rows,more=root.G.xvMore||(root.G.xvMore={});
  const years=['전체',String(s.current),String(s.current-1),String(s.current-2),'이전'];
  const pills='<div class="plv-pills" role="group" aria-label="준공연도">'+years.map(y=>'<button type="button" data-xv="year" data-value="'+attr(y)+'" aria-pressed="'+(String(s.year)===y)+'">'+h(y)+' <b>'+s.mine.filter(r=>s.inYear(r,y)).length+'</b></button>').join('')+'</div>';
  const intro='<div class="plv-intro"><i style="background:#64748b"></i><b>확장관리</b><span>'+rows.length+'곳</span><div class="plv-spacer"></div>'+pills+'</div>';
  const map=new Map();s.free.forEach(r=>{const o=r.owner||'미배정',v=map.get(o)||{owner:o,n:0,late:0};v.n++;const n=days(r.nextContactAt);if(lane(r)!=='hold'&&n!=null&&n<0)v.late++;map.set(o,v);});
  const chips=root.todayIsAdmin?.()&&map.size?'<div class="plv-owners" role="group" aria-label="담당자별"><span>담당자별</span>'+[...map.values()].sort((a,b)=>b.late-a.late||b.n-a.n||a.owner.localeCompare(b.owner,'ko')).map(o=>'<button type="button" class="plv-chip'+(cur===o.owner?' on':'')+'" data-xv="owner" data-value="'+attr(o.owner)+'" aria-pressed="'+(cur===o.owner)+'">'+h(o.owner)+' <b>'+o.n+'</b>'+(o.late?'<em> · 늦음 '+o.late+'</em>':'')+'</button>').join('')+'</div>':'';
  const head='<div class="plv-thead" role="row" style="grid-template-columns:'+GRID+'"><span>현장 · 담당</span>'+COLS.map(c=>'<span>'+h(c)+'</span>').join('')+'<span></span></div>';
  const groups=GROUPS.map(([id,title,color,desc])=>{
   const list=rows.filter(r=>lane(r)===id).sort((a,b)=>String(a.nextContactAt||'9999').localeCompare(String(b.nextContactAt||'9999'))||String(a.site||'').localeCompare(String(b.site||''),'ko')),shown=list.slice(0,PER+(more[id]||0)),rest=list.length-shown.length;
   return '<div class="plv-ghead" data-plv-group="'+id+'"><i style="background:'+color+'"></i><b>'+h(title)+'</b><span>'+list.length+'건</span><small>· '+h(desc)+'</small></div>'+(shown.length?shown.map(rowHtml).join(''):'<div class="plv-empty">해당하는 건이 없습니다</div>')+(rest>0?'<button type="button" class="plv-more" data-xv="more" data-value="'+id+'">+ '+rest+'건 더보기</button>':'');
  }).join('');
  return '<div id="expansion-v2" class="plv" data-workspace="expansion">'+intro+chips+diagnosis(rows,String(s.year))+'<div class="plv-table" role="table" aria-label="확장관리 목록">'+head+groups+'</div></div>';
 }
 function onListClick(e){
  const pd=e.target.closest('[data-pd="toggle"]');if(pd){root.G.plvDiagShut=root.G.plvDiagShut!==true;root.paintExpansion();return;}
  const b=e.target.closest('[data-xv]');if(!b)return;const a=b.dataset.xv,v=b.dataset.value;
  if(a==='open')open(v);
  if(a==='year'){root.G.expansionYear=v;root.paintExpansion();}
  if(a==='owner'){const cur=root.SalesScope.state().owner||'전체';root.CommonFilterBar.setOwner(cur===v?'전체':v);root.paintExpansion();}
  if(a==='more'){const m=root.G.xvMore||(root.G.xvMore={});m[v]=(m[v]||0)+STEP;root.paintExpansion();}
 }
 /* ExpansionPool.render 가 부른다: 새 목록을 그렸으면 true */
 function paint(host){
  const pg=document.getElementById('pg-expansion'),bar=pg?.querySelector(':scope>.cf-bar');
  if(!enabled()){pg?.classList.remove('xv-on');if(bar)bar.hidden=true;close(false);return false;}
  pg?.classList.add('xv-on');
  /* 예전 화면의 담당자·검색·기한 조건은 공통 필터줄로 대신한다 — 숨은 조건이 남지 않게 비운다 */
  if(root.G.expansionOwner&&root.G.expansionOwner!=='전체'){root.CommonFilterBar?.setOwner(root.G.expansionOwner);}root.G.expansionOwner='전체';root.G.expansionQuery='';root.G.expansionDueFilter='전체';
  host.innerHTML=listHtml(scoped());
  if(!host.__xv){host.__xv=true;host.addEventListener('click',onListClick);host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}});}
  if(root.G.page==='expansion'){const t=document.getElementById('ptitle'),s=document.getElementById('psub');if(t)t.textContent='확장관리';if(s)s.textContent='수주 고객의 다음 매출을 찾는 곳 — 파이프라인과 분리해서 관리합니다';}
  root.CommonFilterBar?.mount('expansion');const b2=pg?.querySelector(':scope>.cf-bar');if(b2)b2.hidden=false;
  if(openId)renderDetail();
  return true;
 }
 /* ── 상세창 ── */
 let openId=null,returnFocus=null,draft='';
 const INFO_RPC='crm_expansion_info_update_v1';
 const infoEditable=()=>!!(root.SB&&root.SB.rpc&&root.TOKEN&&!(root.CRMRelease&&root.CRMRelease.has(INFO_RPC)===false));
 const EDITS={};const editSt=r=>EDITS[r.sourceOpportunityId]||(EDITS[r.sourceOpportunityId]={field:'',draft:'',busy:false});
 async function saveInfo(r,field,value){
  const ES=editSt(r);if(!value||ES.busy){ES.field='';renderDetail();return;}
  ES.busy=true;renderDetail();
  try{
   const res=await root.SB.rpc(INFO_RPC,{p:{source_opportunity_id:r.sourceOpportunityId,field,value}});
   if(res.error){if(res.error.code==='PGRST202')root.CRMRelease?.noteMissing?.(INFO_RPC);throw Error(res.error.message||'저장 실패');}
   if(!res.data||res.data.ok!==true)throw Error('서버 확인 응답이 올바르지 않습니다.');
   /* 화면 반영: 서버 행 · 이 PC 행 같은 키로 */
   const key=field==='completion_date'?'completion_date':'owner_name',rows=(root.expServerRows?.()||[]).concat((root.LOCAL&&root.LOCAL.expansionPool)||[]);
   rows.filter(x=>String(root.expSourceId?root.expSourceId(x):(x.source_opportunity_id||x.sourceOpportunityId))===r.sourceOpportunityId).forEach(x=>{x[key]=value;if(key==='completion_date')x.completionDate=value;if(key==='owner_name')x.owner=value;});
   if(!rows.length&&root.B){root.B.expansion_pool=(root.B.expansion_pool||[]).concat({id:res.data.expansion_record_id,source_opportunity_id:r.sourceOpportunityId,site_name:r.site,[key]:value,expansion_status:'신규 대상'});}
   ES.field='';ES.draft='';toast((field==='completion_date'?'준공일':'현재 담당')+' 저장됨');root.paintExpansion();if(root.G.page!=='expansion')renderDetail();
  }catch(err){toast(String(err.message||err),'warn');}
  finally{ES.busy=false;renderDetail();}
 }
 /* 저장하면 서버 행과 이 PC 행이 합쳐지며 id가 바뀔 수 있다 — 열린 창은 원 수주 건(sourceOpportunityId)으로 다시 찾는다 */
 const find=id=>{const list=root.expansionRecords();return list.find(r=>r.id===String(id))||list.find(r=>r.sourceOpportunityId===String(id));};
 const eventsOf=r=>(root.B.expansion_events||[]).filter(e=>String(e.source_opportunity_id)===r.sourceOpportunityId);
 function node(){
  let m=document.getElementById('expansionV2');if(m)return m;
  m=document.createElement('div');m.id='expansionV2';m.className='xdv-layer';m.setAttribute('aria-hidden','true');
  m.innerHTML='<section class="xdv" role="dialog" aria-modal="true" aria-labelledby="xdvTitle"></section>';
  m.addEventListener('click',e=>{if(e.target===m)close();else onDetailClick(e);});
  m.addEventListener('change',e=>{if(e.target.dataset.xd==='next'&&e.target.value&&find(openId)){root.expansionSetNext(find(openId).id,e.target.value);toast('다음 접촉일을 '+e.target.value+'로 정했습니다');}
   const r0=find(openId);if(!r0)return;if(e.target.dataset.xd==='editinput'&&e.target.value)saveInfo(r0,'completion_date',e.target.value);if(e.target.dataset.xd==='editsel'&&e.target.value)saveInfo(r0,'owner_name',e.target.value);});
  m.addEventListener('keydown',e=>{if(e.key==='Escape'&&(e.target.dataset.xd==='editinput'||e.target.dataset.xd==='editsel')){e.preventDefault();e.stopImmediatePropagation();const r0=find(openId);if(r0){editSt(r0).field='';renderDetail();}}},true);
  m.addEventListener('input',e=>{if(e.target.matches('.idv-input textarea')){draft=e.target.value;m.querySelector('.idv-save')?.classList.toggle('on',!!draft.trim());}});
  m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&e.target.matches('.idv-input textarea')){e.preventDefault();saveNote();}});
  document.body.append(m);return m;
 }
 function detailHtml(r){
  const d=dealOf(r),done=F.converted(r),st=F.status(r),ln=lane(r),n=days(r.nextContactAt),age=days(r.completionDate),since=age==null?null:Math.max(0,-age),owner=r.owner||root.repN(d.assignee)||'미배정';
  const step=done?4:st==='보류'?-1:ln==='week'?0:ln==='keep'?1:2;
  const steps=['이번 주 연락','유지접촉','니즈 확인','견적문의 전환'].map((t,i)=>'<div class="'+(i<step?'done':i===step?'cur':'')+'"><i></i><span>'+(i===step?'지금 · ':'')+t+'</span></div>').join('');
  const c=(()=>{try{return root.contactInfo(d,root.itemPatch(d,'deal'))||{};}catch(e){return {};}})(),phone=root.phoneFmt?root.phoneFmt(c.mobile||c.officeTel||''):(c.mobile||c.officeTel||'');
  const contract=d.contract_date||d.contractDate||d.advisory&&d.advisory.contract_date||'';
  /* 관리 정보 빈 칸 바로 입력(2026-10-03 대표 "견적문의처럼"): 준공일 · 현재 담당 = crm_expansion_info_update_v1(관리자 또는 담당 범위, 현재 담당은 관리자만) · 공종 = 기존 공종 편집기 · 계약일 · 수주 금액 = 계약실적 원장(여기서 안 바꿈) */
  const can=infoEditable(),admin=!!root.todayIsAdmin?.(),ES=editSt(r);
  const facts=[['현재 담당',owner==='미배정'?'':owner,can&&admin?'owner_name':''],['당시 영업',root.repN(d.assignee)==='미배정'?'':root.repN(d.assignee)||'',''],['계약일',ymd(contract),'ledger'],['준공일',ymd(r.completionDate),can?'completion_date':''],['공종',workOf(r),d.id?'work':''],['수주 금액',money(r.wonAmount),'ledger']];
  let files=[],quotes=[];try{files=d.id?root.execAttachments(d):[];quotes=d.id?root.execQuoteVersions(d):[];}catch(e){}
  const photos=files.filter(x=>/^image\//.test(x.mime_type||'')).length;
  const left='<div class="xdv-card"><span class="xdv-label">연락할 고객</span><b>'+h(c.name?c.name+(c.role?' · '+c.role:''):'고객 이름 미등록')+'</b><span class="'+(phone?'':'xdv-warn')+'">'+h(phone||'연락처 미입력')+'</span>'+(done?'':'<div class="xdv-three"><button type="button" class="fill" data-xd="call">전화</button><button type="button" data-xd="sms">문자</button><button type="button" data-xd="kakao">카카오</button></div>')+'</div>'
   +'<div class="xdv-card"><b>관리 정보</b><dl class="xdv-facts">'+facts.map(([k,v,ed])=>{
     if(ed&&ES.field===ed){if(ed==='owner_name'){const reps=(root.REP_INTERNAL||[]).slice();return '<div><dt>'+h(k)+'</dt><dd><select class="xdv-editin" data-xd="editsel" aria-label="현재 담당"><option value="">담당 선택</option>'+reps.map(n=>'<option'+(n===(ES.draft||v)?' selected':'')+'>'+h(n)+'</option>').join('')+'</select></dd></div>';}
      return '<div><dt>'+h(k)+'</dt><dd><input class="xdv-editin" type="date" data-xd="editinput" value="'+attr(ES.draft||v||'')+'" aria-label="'+attr(k)+'"'+(ES.busy?' disabled':'')+'></dd></div>';}
     if(ed==='ledger')return '<div><dt>'+h(k)+'</dt><dd'+(v?'':' class="xdv-warn"')+'>'+h(v||'미입력')+(v?'':' <small class="xdv-ledger">· 계약실적(성과 분석)에서 기록</small>')+'</dd></div>';
     if(ed==='work')return '<div><dt>'+h(k)+'</dt><dd>'+(v?h(v)+' ':'')+'<button type="button" class="xdv-edit" data-xd="editwork">'+(v?'수정':'미입력 · 눌러서 입력')+'</button></dd></div>';
     if(ed&&!v)return '<div><dt>'+h(k)+'</dt><dd><button type="button" class="xdv-edit" data-xd="edit" data-value="'+ed+'">미입력 · 눌러서 입력</button></dd></div>';
     if(ed)return '<div><dt>'+h(k)+'</dt><dd>'+h(v)+' <button type="button" class="xdv-edit xdv-editsm" data-xd="edit" data-value="'+ed+'">수정</button></dd></div>';
     return '<div><dt>'+h(k)+'</dt><dd'+(v?'':' class="xdv-warn"')+'>'+h(v||'미입력')+'</dd></div>';}).join('')+'</dl></div>'
   +'<div class="xdv-card"><b>자료</b><div class="xdv-tiles">'+[['사진',photos],['견적서',quotes.length],['기타',files.length-photos]].map(t=>'<div><span>'+t[0]+'</span><b>'+t[1]+'건</b></div>').join('')+'</div>'+(d.id?'<button type="button" class="xdv-link" data-xd="source">수주 영업건 열기 →</button>':'')+'</div>';
  const list=eventsOf(r).slice().sort((a,b)=>String(a.occurred_at||a.created_at||'').localeCompare(String(b.occurred_at||b.created_at||'')));
  const sys='<div class="idv-msg sys"><div class="idv-meta"><em>시스템</em><span>'+h(ymd(r.completionDate)||'준공일 미기록')+'</span></div><div class="idv-bubble">준공 완료 → 확장관리 대상으로 등록'+((r.candidates||[]).length?' / 추천: '+h((r.candidates||[]).join(' · ')):'')+'</div></div>';
  const thread=sys+list.map(e=>'<div class="idv-msg '+(/니즈/.test(String(e.kind||''))?'memo':'out')+'"><div class="idv-meta"><em>'+h(e.kind||'확장관리')+'</em>'+(e.actor?'<span>'+h(e.actor)+'</span>':'')+'<span>'+h(root.fmtD?root.fmtD(e.occurred_at||e.created_at):ymd(e.occurred_at||e.created_at))+'</span></div><div class="idv-bubble">'+h(e.note||'내용 미기록')+'</div></div>').join('');
  const composer=done?'<div class="idv-composer idv-locked">전환 완료 · 이후 진행은 새 영업건에서 관리합니다</div>':'<div class="idv-composer"><div class="idv-ctabs"><div role="tablist"><button type="button" role="tab" aria-selected="true">접촉 · 니즈 기록</button></div></div><div class="idv-input"><textarea rows="1" aria-label="접촉 · 니즈 기록" placeholder="예: 하자 점검 통화 — 지하주차장 누수 문의, 11월 견적 요청">'+h(draft)+'</textarea><button type="button" class="idv-save'+(draft.trim()?' on':'')+'" data-xd="save">저장</button></div><div class="idv-err" role="alert"></div></div>';
  const center='<div class="idv-chead"><b>고객과 주고받은 내용</b><span>'+list.length+'건</span><em>시간순 · 최신이 아래</em></div><div class="idv-thread">'+thread+'</div>'+composer;
  const dueLine=!r.nextContactAt?'다음 접촉일 미지정':'다음 접촉 '+md(r.nextContactAt)+' · '+(n<0?Math.abs(n)+'일 지남':n===0?'오늘':n+'일 뒤');
  const todo=st==='니즈확인'?'확인한 니즈로 견적 준비 · 전환':'하자 점검 · 타공종 확인 통화';
  const now=done?'<div class="xdv-card xdv-done"><b>견적 확인 후 새 영업으로 전환됨</b><p>이후 진행은 파이프라인의 새 영업건에서 이어집니다.</p><button type="button" class="xdv-primary" data-xd="pipeline">새 영업건 열기 →</button></div>'
   :'<div class="xdv-card xdv-now'+(n!=null&&n<0?' late':'')+'"><span class="xdv-eyebrow">지금 할 일</span><b>'+h(todo)+'</b><span class="'+(n!=null&&n<0?'xdv-red':'')+'">'+h(dueLine)+'</span><div class="xdv-three"><button type="button" class="fill" data-xd="call">전화</button><button type="button" data-xd="sms">문자</button><button type="button" data-xd="kakao">카카오</button></div><button type="button" class="xdv-wide" data-xd="note">접촉 · 니즈 기록</button></div>';
  const signal='<div class="xdv-card xdv-signal"><span class="xdv-eyebrow">다음 영업 신호</span><b>'+h(recommend(r)||'확장 후보를 확인해 주세요')+'</b><p>'+(since==null?'준공일을 확인해 주세요':'준공 후 '+since+'일 · '+(r.lastContactAt?'마지막 접촉 '+ymd(r.lastContactAt):'하자 점검 통화로 시작하세요'))+'</p></div>';
  const states=[['관리대상','관리대상'],['관계관리','유지접촉'],['니즈확인','니즈 확인'],['보류','보류']],curState=st==='접촉예정'?'관리대상':st;
  const manage=done?'':'<div class="xdv-card"><b>관리 상태</b><div class="ddv-stages">'+states.map(([v,t])=>'<button type="button" data-xd="status" data-value="'+v+'"'+(curState===v?' class="cur" aria-pressed="true"':' aria-pressed="false"')+'>'+t+'</button>').join('')+'</div><label class="xdv-date">다음 접촉일 <input type="date" data-xd="next" value="'+attr(ymd(r.nextContactAt))+'"></label></div><button type="button" class="xdv-convert" data-xd="convert">니즈 확인 → 견적 확인 · 전환</button><p class="xdv-hint">실제 발송된 견적을 확인한 뒤 새 영업으로 넘깁니다. 원 수주 건은 그대로 보존됩니다.</p>';
  return '<header class="xdv-top"><div class="xdv-top1"><div class="xdv-chips">'+(d.brand?'<span class="idv-brand">'+h(d.brand)+'</span>':'')+'<span class="xdv-tag">확장관리 · '+h(done?'전환 완료':st==='관계관리'?'유지접촉':st)+'</span></div><button type="button" class="xdv-close" data-xd="close" aria-label="닫기">✕</button></div><h2 id="xdvTitle">'+h(r.site||'현장명 확인 필요')+'</h2><p>담당 '+h(owner)+' · 수주 '+h(money(r.wonAmount)||'금액 미입력')+(since==null?'':' · 확장관리 '+since+'일째')+'</p><div class="idv-steps xdv-steps">'+steps+'</div></header>'
   +'<div class="xdv-body"><aside class="xdv-c1">'+left+'</aside><main class="xdv-c2">'+center+'</main><aside class="xdv-c3">'+now+signal+manage+'</aside></div>';
 }
 function renderDetail(){
  if(!openId)return;const r=find(openId);if(!r){close();return;}
  const m=node(),box=m.querySelector('.xdv'),focusTa=document.activeElement?.matches?.('#expansionV2 .idv-input textarea');
  box.innerHTML=detailHtml(r);const th=box.querySelector('.idv-thread');if(th)th.scrollTop=th.scrollHeight;
  if(focusTa){const ta=box.querySelector('.idv-input textarea');if(ta){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);}}
 }
 function open(id){
  const r=find(id);if(!r)return;if(!enabled())return legacyOpen&&legacyOpen(id);
  const m=node(),key=r.sourceOpportunityId||r.id;if(openId!==key)draft='';openId=key;returnFocus=document.activeElement;renderDetail();m.classList.add('on');m.setAttribute('aria-hidden','false');m.querySelector('.xdv-close')?.focus();
 }
 function close(restore){
  const m=document.getElementById('expansionV2');if(m){m.classList.remove('on');m.setAttribute('aria-hidden','true');}
  const f=returnFocus;openId=null;returnFocus=null;draft='';if(restore!==false&&f&&f.isConnected)f.focus?.({preventScroll:true});
 }
 /* 접촉·니즈 기록 = 기존 서버 함수(crm_expansion_note) — 서버 확인 뒤에만 대화에 쌓인다 */
 async function saveNote(){
  const r=find(openId),m=node(),err=m.querySelector('.idv-err'),save=m.querySelector('.idv-save'),ta=m.querySelector('.idv-input textarea');if(!r||!ta||save.disabled)return;
  const note=ta.value.trim();err.textContent='';if(!note){err.textContent='기록할 내용을 적어 주세요.';ta.focus();return;}
  save.disabled=true;save.textContent='확인 중…';
  try{
   if(!root.SB||!root.TOKEN)throw Error('로그인 후 서버 연결이 필요합니다.');
   const res=await root.SB.rpc('crm_expansion_note',{p:{source_opportunity_id:r.sourceOpportunityId,note,request_id:crypto.randomUUID()}});
   if(res.error)throw res.error;if(!res.data||res.data.ok!==true||!res.data.event)throw Error('서버 저장을 확인하지 못했습니다.');
   root.B.expansion_events=(root.B.expansion_events||[]).concat(res.data.event);draft='';toast('접촉 · 니즈 기록을 남겼습니다');root.paintExpansion();if(root.G.page!=='expansion')renderDetail();
  }catch(e){err.textContent='기록을 저장하지 못했습니다. '+String(e.message||e);save.disabled=false;save.textContent='저장';}
 }
 function onDetailClick(e){
  const b=e.target.closest('[data-xd]');if(!b||!openId)return;const a=b.dataset.xd,r=find(openId);if(!r)return;const id=r.id;
  if(a==='close')close();
  if(a==='save')saveNote();
  if(a==='note'){const ta=node().querySelector('.idv-input textarea');ta?.focus();}
  if(a==='call')root.expansionCall(id);
  if(a==='sms'||a==='kakao'){close(false);root.expansionMessage(id,a);}
  if(a==='status'){if(b.dataset.value!==F.status(r)){root.expansionSetStatus(id,b.dataset.value);toast('관리 상태를 «'+b.textContent.trim()+'»(으)로 바꿨습니다');}}
  if(a==='convert'){close(false);root.expansionOpenNew(id);}
  if(a==='pipeline'){close(false);root.ExpansionPool.openPipeline(id);}
  if(a==='source'){const d=dealOf(r);if(d.id){close(false);root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));}}
  if(a==='edit'){const ES=editSt(r);ES.field=b.dataset.value;ES.draft='';renderDetail();setTimeout(()=>{const el=node().querySelector('[data-xd="editinput"],[data-xd="editsel"]');if(el)el.focus();},30);}
  if(a==='editwork'){const d=dealOf(r);if(!d.id)return;/* 새 공종 창(공종 분석과 같은 부품)을 이 상세 위에 — 저장되면 상세 · 목록 갱신 */
   if(root.WorkV2&&root.WorkV2.classify){root.WorkV2.classify(root.dealKey(d),{single:true,done:()=>{try{root.paintExpansion();renderDetail();}catch(err){}}});}else{root.CUR_DETAIL={kind:'deal',key:root.dealKey(d),item:d};root.openWorkEdit?.();}}
 }
 let legacyOpen=null;
 function boot(){
  const P=root.ExpansionPool;if(!P)return;
  legacyOpen=P.open;const legacyClose=P.close;
  P.open=id=>enabled()?open(id):legacyOpen(id);
  P.close=function(){close(false);return legacyClose.apply(P,arguments);};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.ExpansionV2={enabled,paint,open,close,brandStats,lane};
})(window);
