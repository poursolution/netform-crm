/* 파이프라인 단계별 목록 v2 (2026-10-01 디자인 핸드오프 'design_handoff_pipeline' ①)
   단계 7개(컨설팅 설계·자료 발송완료·관계관리·경쟁·입찰·계약·시공·수주·실주)의 목록만 바꾼다. 전체 칸반·확장관리·대시보드는 그대로.
   공통 고정 필터줄(브랜드·담당자·검색) → 단계 안내 줄(하위 필터·보드/리스트) → 담당자별 칩 → 묶음 표.
   행·건수는 PipelineWorkspace.rows 와 StageWorkspaces.prepare 가 계산한 값을 그대로 쓴다. 저장·단계 전환·권한은 건드리지 않는다.
   끄기: G.pipeListV2Off=true → 예전 단계 화면. */
(function(root){
 'use strict';
 const KEYS=['consulting','sent','relationship','competition','construction','won','lost'];
 const NAME={consulting:'컨설팅 설계',sent:'자료 발송완료',relationship:'관계관리',competition:'경쟁·입찰',construction:'계약·시공',won:'수주',lost:'실주'};
 const COLOR={consulting:'#94a3b8',sent:'#7c9cf0',relationship:'#3b6ce4',competition:'#8b5cf6',construction:'#f08c2e',won:'#30a46c',lost:'#c4c8d0'};
 const RED='#e5484d',AMBER='#f5a524',GREY='#c4c8d0',GREEN='#30a46c',BLUE='#3b6ce4';
 /* 열·격자·묶음 — 핸드오프 pipeline-data.js 의 cols/grid/groups 명세. 묶음의 4번째 값이 true 면 '늦음'으로 센다 */
 const SPEC={
  consulting:{cols:['고객 요구','견적 예정','예상 금액','다음 업무'],grid:'minmax(0,1.5fr) minmax(0,1fr) 90px 90px minmax(0,1.2fr) 72px',groups:[['over','다음 업무 기한 초과',RED,true,'기한이 지난 다음 업무부터'],['none','다음 할 일 없음',AMBER,false,'고객 요구 확인 후 다음 할 일 등록'],['ok','진행 중',GREY,false,'일정대로 진행']]},
  sent:{cols:['발송일 · 자료','고객 반응','후속 확인','예상 금액','다음 업무'],grid:'minmax(0,1.4fr) 100px 80px 110px 80px minmax(0,1.1fr) 72px',groups:[['over','후속 기한 초과',RED,true,'후속 확인일이 지난 건'],['nodate','후속일 미지정',AMBER,false,'후속 확인 날짜부터 정하세요'],['ok','후속 예정',GREY,false,'후속 확인일이 잡힌 건']]},
  relationship:{cols:['구분','마지막 접촉','다음 연락','예상 금액','다음 할 일'],grid:'minmax(0,1.5fr) 90px 90px 110px 90px minmax(0,1fr) 72px',seg:['relSeg',[['rapport','유대강화'],['silent','침묵관리'],['waiting','대기고객']]],groups:[['over','연락 초과',RED,true,'다음 연락일이 지난 건'],['nodate','다음 연락 미지정',AMBER,false,'다음 연락 날짜부터 정하세요'],['ok','진행 중',GREY,false,'다음 연락이 잡힌 건']]},
  competition:{cols:['구분','결정 예정','경쟁사','예상 금액','준비 현황 · 다음'],grid:'minmax(0,1.5fr) 110px 90px 90px 90px minmax(0,1fr) 72px',seg:['compSeg',[['compete','경쟁'],['imminent','계약 임박'],['bidding','입찰']]],groups:[['nodate','결정일 미등록',RED,true,'결정 예정일부터 등록하세요'],['ok','결정일 등록',GREY,false,'결정 예정일이 가까운 순']]},
  construction:{cols:['진행','계약 상태','계약일','계약 금액','착공'],grid:'minmax(0,1.5fr) 80px minmax(0,1fr) 90px 100px 90px 72px',seg:['consSeg',[['contract','계약'],['construction','시공'],['completion','준공']]],groups:[['wait','계약 체결 대기',RED,true,'계약일 · 금액부터 확인하세요'],['ok','계약 확정 · 시공 진행',GREEN,false,'착공 · 준공 일정 관리']]},
  won:{cols:['계약일','계약 금액','이긴 이유','다음 기회','준공일'],grid:'minmax(0,1.3fr) 96px 96px minmax(0,1.3fr) minmax(0,1.2fr) 96px 72px',groups:[['need','계약 정보 미기록',RED,true,'계약일 · 금액 · 이긴 이유를 남겨야 반복할 수 있어요'],['exp','확장 기회',GREEN,false,'준공 후 하자 점검 · 소개 · 추가 공종'],['done','완료',GREY,false,'기록 완료']]},
  lost:{cols:['실주일','어디서','사유 · 경쟁사','배운 점','재접촉'],grid:'minmax(0,1.3fr) 84px 96px minmax(0,1fr) minmax(0,1.4fr) 90px 72px',groups:[['none','사유 미기록',AMBER,true,'사유가 없으면 배울 수 없어요 — 담당자에게 기록 요청'],['re','재접촉 가능',BLUE,false,'다음 공사 시기에 다시 제안'],['done','종결',GREY,false,'기록 완료']]}
 };
 const PER=20,STEP=40;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const ymd=v=>v?String(v).slice(0,10):'';
 const days=v=>{if(!v)return null;const n=root.daysTo(v);return Number.isFinite(n)?n:null;};
 const money=v=>{const n=Number(v)||0;if(!n)return '';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const admin=()=>{try{return !!root.todayIsAdmin?.();}catch(e){return false;}};
 function enabled(key){return !root.G.pipeListV2Off&&KEYS.includes(key||root.G.pipelineStage);}
 function more(){return root.G.plvMore||(root.G.plvMore={});}
 /* 예전 화면의 브랜드 선택(G.brand)·공종 선택은 이 화면에 조작부가 없다 — 숨은 조건이 남지 않게 공통 브랜드 선택으로 옮기고 비운다 */
 function adoptLegacyFilters(){
  const b=root.G.brand;if(b&&b!=='전체'){try{if(!(root.SalesFilterState.state().brands||[]).includes(b))root.SalesFilterState.selectBrand(b);}catch(e){}root.G.brand='전체';}
  if(root.G.workFilter&&root.G.workFilter!=='전체')root.G.workFilter='전체';
 }
 /* 담당자 선택만 뺀 같은 조건의 행(브랜드·검색 유지) — 담당자별 칩 숫자용 */
 function ownerFreeRows(key){
  const s=root.SalesScope.state(),o=s.owner,a=s.assignment;let list=[];
  try{s.owner='전체';s.assignment='all';list=root.PipelineWorkspace.rows().filter(r=>r.group===key);}finally{s.owner=o;s.assignment=a;}
  return list;
 }
 const cell=(t,c,sub,sc)=>({t,c:c||'',sub:sub||'',sc:sc||''});
 const lateText=n=>Math.abs(n)+'일 지남';
 function dueCell(date,emptyText,emptyCls){const n=days(date);if(n==null)return cell(emptyText,emptyCls||'a');if(n<0)return cell(lateText(n),'r',ymd(date));if(n===0)return cell('오늘','b',ymd(date));return cell(ymd(date),'',n+'일 남음');}
 function nextCell(r,emptyText){const t=r.next?.text;if(!t)return cell(emptyText||'다음 할 일 등록','a');const n=r.days;return cell(t,n!=null&&n<0?'r':'',r.due?ymd(r.due)+(n!=null&&n<0?' · '+lateText(n):''):'',n!=null&&n<0?'r':'');}
 function expansionOf(r){try{return (root.expansionRecords?.()||[]).find(e=>String(e.sourceOpportunityId)===String(r.item.id)&&!['종료','보류'].includes(e.status)&&!root.ExpansionFlow?.converted?.(e));}catch(e){return null;}}
 function prevStage(d){const hist=d.stageHistory||d.stage_history||[];for(let i=hist.length-1;i>=0;i--){const from=hist[i]&&hist[i].from;if(!from)continue;const g=root.PipelineStages.group(from);if(g&&g!=='lost'&&g!=='won')return NAME[g]||g;}return '';}
 const REL_TAG={rapport:['유대강화','g'],silent:['침묵관리','p'],waiting:['대기고객','m']},COMP_TAG={compete:['경쟁','m'],imminent:['계약 임박','g'],bidding:['입찰','o']},CONS_TAG={contract:['계약','m'],construction:['시공','o'],completion:['준공','g']};
 const tag=(pair,sub)=>({tag:pair[0],tc:pair[1],sub:sub||''});
 /* 한 행 = {group, sort, cells[]} */
 function shape(key,x){
  const r=x.row,v=x.values,f=r.fields||{},d=r.item,amount=cell(money(r.amount));
  if(key==='consulting'){
   const g=r.flags.includes('overdue')?'over':r.flags.includes('missing')?'none':'ok';
   return {group:g,sort:g==='over'?r.days:g==='ok'?(r.days==null?9999:r.days):0,cells:[v.needs?cell(v.needs):cell('고객 요구 미확인','a'),v.quoteDue?dueCell(v.quoteDue):cell('미지정','m'),amount,nextCell(r)]};
  }
  if(key==='sent'){
   const n=days(v.followup),g=n==null?'nodate':n<0?'over':'ok';
   return {group:g,sort:n==null?0:n,cells:[f.sent_date?cell(ymd(f.sent_date),'',v.materials||''):cell('미기록','a',v.materials||''),v.reaction?cell(v.reaction):cell('확인 전','m'),dueCell(v.followup,'미지정','a'),amount,nextCell(r,'후속 연락 등록')]};
  }
  if(key==='relationship'){
   const n=r.days,g=n==null?'nodate':n<0?'over':'ok',age=r.last?Math.max(0,-root.daysTo(r.last)):null;
   return {group:g,sort:n==null?-(age||0):n,cells:[tag(REL_TAG[r.code]||REL_TAG.silent),age==null?cell('미확인','a'):cell(age===0?'오늘':age+'일 전','',ymd(r.last)),dueCell(r.due,'미지정','a'),amount,r.next?.text?cell(r.next.text):cell('다음 할 일 등록','a')]};
  }
  if(key==='competition'){
   const n=days(v.decisionDate),g=n==null?'nodate':'ok',kind=COMP_TAG[r.code]||COMP_TAG.compete,type=f.competition_type&&f.competition_type!==kind[0]?f.competition_type:'';
   return {group:g,sort:n==null?-(Number(r.amount)||0):n,cells:[tag(kind,type),n==null?cell('미등록','a'):dueCell(v.decisionDate),v.competitor?cell(v.competitor):cell('미기록','m'),amount,v.preparation?cell(v.preparation,'',r.next?.text||''):r.next?.text?cell(r.next.text):cell('준비 현황 미기록','a')]};
  }
  if(key==='construction'){
   const g=x.priority===0?'wait':'ok',sd=v.startDate;
   return {group:g,sort:g==='wait'?String(v.contractDate||'9999'):String(sd||'9999'),cells:[tag(CONS_TAG[r.code]||CONS_TAG.contract),cell(v.contractState,/필요|취소/.test(String(v.contractState))?(g==='wait'?'r':'a'):''),v.contractDate?cell(ymd(v.contractDate)):cell('미입력','a'),v.contractAmount!=null&&v.contractAmount!==''&&Number(v.contractAmount)?cell(money(v.contractAmount)):cell('금액 미입력','a'),sd?cell(ymd(sd)):cell('–','m')]};
  }
  if(key==='won'){
   const amt=Number(v.contractAmount)||Number(r.amount)||0,why=d.stage_contexts?.won?.fields?.win_reason||f.win_reason||'',exp=expansionOf(r),g=!v.contractDate||!amt?'need':exp?'exp':'done';
   return {group:g,sort:String(v.contractDate||d.closed_at||''),desc:true,cells:[v.contractDate?cell(ymd(v.contractDate)):cell('미기록','a'),amt?cell(money(amt)):cell('금액 미입력','a'),why?cell(why):cell('미기록','m'),exp?cell(exp.needNote||(exp.candidates||[]).join(' · ')||'확장 기회 등록됨','g'):cell('–','m'),v.completionDate?cell(ymd(v.completionDate)):cell('–','m')]};
  }
  const reason=v.lossReason&&v.lossReason!=='미기록'?v.lossReason:'',rc=String(v.recontact||''),re=!!rc&&!/불가|없음/.test(rc),lesson=d.stage_contexts?.lost?.fields?.lesson||f.lesson||'',where=prevStage(d),g=!reason?'none':re?'re':'done';
  return {group:g,sort:String(v.lossDate||''),desc:true,cells:[v.lossDate?cell(ymd(v.lossDate)):cell('미기록','a'),where?{tag:where,tc:'m',sub:''}:cell('미기록','m'),reason?cell(reason,'',v.competitor||''):cell('미기록','a'),lesson?cell(lesson):cell('미기록','m'),re?cell(rc,'b'):cell('–','m')]};
 }
 function compare(p,q){const a=p.shape.sort,b=q.shape.sort,d=typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b));return (p.shape.desc?-d:d)||String(p.row.key).localeCompare(String(q.row.key));}
 function build(key,list){return root.StageWorkspaces.prepare(key,list).map(x=>({row:x.row,shape:shape(key,x)}));}
 function cellHtml(c){
  if(c.tag)return '<span class="plv-c"><em class="plv-tag '+c.tc+'">'+h(c.tag)+'</em>'+(c.sub?'<small>'+h(c.sub)+'</small>':'')+'</span>';
  return '<span class="plv-c"><span class="'+c.c+'" title="'+attr(c.t)+'">'+h(c.t)+'</span>'+(c.sub?'<small class="'+c.sc+'">'+h(c.sub)+'</small>':'')+'</span>';
 }
 function rowHtml(key,x){
  const r=x.row,owner=r.owner||'미배정';
  return '<div class="plv-row" role="row" tabindex="0" data-ps-action="record" data-value="'+attr(r.key)+'" data-deal="'+attr(r.key)+'" style="grid-template-columns:'+SPEC[key].grid+'"><span class="plv-c plv-site"><b title="'+attr(r.site)+'">'+h(r.site)+(root.advisoryBadge?root.advisoryBadge(r.item):'')+'</b><small class="'+(owner==='미배정'?'none':'')+'">'+h(owner)+'</small></span>'+x.shape.cells.map(cellHtml).join('')+'<button type="button" class="plv-cta" data-ps-action="process" data-value="'+attr(r.key)+'">처리</button></div>';
 }
 function ownerChips(key,cur){
  if(!admin())return '';
  const spec=SPEC[key],late=new Set(spec.groups.filter(g=>g[3]).map(g=>g[0])),map=new Map();
  build(key,ownerFreeRows(key)).forEach(x=>{const o=x.row.owner||'미배정',v=map.get(o)||{owner:o,n:0,late:0};v.n++;if(late.has(x.shape.group))v.late++;map.set(o,v);});
  const list=[...map.values()].sort((p,q)=>q.late-p.late||q.n-p.n||p.owner.localeCompare(q.owner,'ko'));
  if(!list.length)return '';
  return '<div class="plv-owners" role="group" aria-label="담당자별"><span>담당자별</span>'+list.map(o=>'<button type="button" class="plv-chip'+(cur===o.owner?' on':'')+'" data-plv="owner" data-value="'+attr(o.owner)+'" aria-pressed="'+(cur===o.owner)+'">'+h(o.owner)+' <b>'+o.n+'</b>'+(o.late?'<em> · 늦음 '+o.late+'</em>':'')+'</button>').join('')+'</div>';
 }
 function html(key,list){
  const spec=SPEC[key],cur=root.SalesScope.state().owner||'전체',segKey=spec.seg&&spec.seg[0],segVal=segKey&&spec.seg[1].some(s=>s[0]===root.G[segKey])?root.G[segKey]:'all';
  const all=build(key,list),items=all.filter(x=>segVal==='all'||x.row.code===segVal||(key==='relationship'&&segVal==='silent'&&!['rapport','waiting'].includes(x.row.code)));
  const amount=list.reduce((s,r)=>s+(Number(r.amount)||0),0);
  const seg=spec.seg?'<div class="plv-pills" role="group" aria-label="'+attr(NAME[key])+' 구분">'+[['all','전체']].concat(spec.seg[1]).map(([v,t])=>{const n=v==='all'?all.length:all.filter(x=>x.row.code===v||(key==='relationship'&&v==='silent'&&!['rapport','waiting'].includes(x.row.code))).length;return '<button type="button" data-plv="seg" data-value="'+v+'" aria-pressed="'+(segVal===v)+'">'+h(t)+' <b>'+n+'</b></button>';}).join('')+'</div>':'';
  const intro='<div class="plv-intro"><i style="background:'+COLOR[key]+'"></i><b>'+h(NAME[key])+'</b><span>'+list.length+'건'+(amount?' · '+money(amount):'')+'</span><div class="plv-spacer"></div>'+seg+'<div class="plv-view" role="group" aria-label="보기 전환"><button type="button" data-ps-action="stage" data-value="all" aria-pressed="false">보드</button><button type="button" aria-pressed="true">리스트</button></div></div>';
  const head='<div class="plv-thead" role="row" style="grid-template-columns:'+spec.grid+'"><span>현장 · 담당</span>'+spec.cols.map(c=>'<span>'+h(c)+'</span>').join('')+'<span></span></div>';
  const shownMore=more()[key]||(more()[key]={});
  const groups=spec.groups.map(([id,title,color,,desc])=>{
   const rows=items.filter(x=>x.shape.group===id).sort(compare),limit=PER+(shownMore[id]||0),shown=rows.slice(0,limit),rest=rows.length-shown.length;
   return '<div class="plv-ghead" data-plv-group="'+id+'"><i style="background:'+color+'"></i><b>'+h(title)+'</b><span>'+rows.length+'건</span><small>· '+h(desc)+'</small></div>'+(shown.length?shown.map(x=>rowHtml(key,x)).join(''):'<div class="plv-empty">해당하는 건이 없습니다</div>')+(rest>0?'<button type="button" class="plv-more" data-plv="more" data-value="'+id+'">+ '+rest+'건 더보기</button>':'');
  }).join('');
  return '<div id="pipeline-list-v2" class="plv" data-workspace="'+key+'">'+intro+ownerChips(key,cur)+'<div class="plv-table" role="table" aria-label="'+attr(NAME[key])+' 목록">'+head+groups+'</div></div>';
 }
 function brandStats(){
  const key=root.G.pipelineStage,sel=root.SalesFilterState.state().brands||[];let list=[];
  try{list=root.PipelineWorkspace.rows({unscoped:true,search:root.G.q}).filter(r=>r.group===key&&root.SalesScope.matches(r.owner,r.item));}catch(e){list=[];}
  const names=[...new Set(['석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어'].concat(list.map(r=>r.item.brand).filter(Boolean)))];
  return [{name:'전체',n:list.length,on:!sel.length}].concat(names.map(b=>({name:b,n:list.filter(r=>r.item.brand===b).length,on:sel.includes(b)})));
 }
 function onClick(e){
  const b=e.target.closest('[data-plv]');if(!b||!b.closest('#pipeline-list-v2'))return;
  const a=b.dataset.plv,v=b.dataset.value,key=root.G.pipelineStage;
  if(a==='owner'){const cur=root.SalesScope.state().owner||'전체';root.CommonFilterBar.setOwner(cur===v?'전체':v);root.paint();}
  if(a==='seg'){root.G[SPEC[key].seg[0]]=v;root.paint();}
  if(a==='more'){const m=more()[key]||(more()[key]={});m[v]=(m[v]||0)+STEP;root.paint();}
 }
 function onKey(e){if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}}
 /* PipelineWorkspace.render 가 부른다: 단계 화면이면 새 목록을 그리고 true, 아니면(칸반·끔) 정리만 하고 false */
 function paint(el,key,list){
  const pg=document.getElementById('pg-pipe'),on=enabled(key);
  pg?.classList.toggle('plv-on',on);
  const bar=pg?.querySelector(':scope>.cf-bar');
  if(!on){if(bar)bar.hidden=true;return false;}
  el.classList.remove('pk-mode');el.innerHTML=html(key,list);
  if(!el.__plv){el.__plv=true;el.addEventListener('click',onClick);el.addEventListener('keydown',onKey);}
  document.getElementById('ptitle').textContent=NAME[key];
  root.CommonFilterBar?.mount('pipe');const b2=pg?.querySelector(':scope>.cf-bar');if(b2)b2.hidden=false;
  return true;
 }
 root.PipelineListV2={enabled,paint,html,brandStats,adoptLegacyFilters,build,SPEC,NAME,COLOR};
})(window);
