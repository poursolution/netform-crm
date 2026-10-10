/* 공종 분석 v2 (2026-10-01 디자인 핸드오프 'design_handoff_work') — 공종 분석 메뉴만.
   지금은 미분류가 대부분이라 "분류를 빨리 끝내게 하는 화면"이 먼저다. 분류가 쌓이면 같은 자리가 실제 분석으로 채워진다.
   목록: 안내 줄(분류 필요 · 단일 · 복합 알약) → 진단(숫자 4 · 카드 3 · 과제) → 묶음 표(분류 필요 금액 큰 순 → 단일 → 복합)
   분류 = 파이프라인 공종 분류 패널과 같은 공종 선택 부품을 넣은 560px 창(저장은 saveWorkEdit → Phase11.save, 서버 최신 버전 확인). 저장되면 다음 미분류 건(금액 큰 순)을 이어서 연다.
   집계는 기존 workAnalysisData/workScopeOf/dealPrimaryWork 그대로. DB·권한 변경 없음.
   ※ 추정 공종은 지금은 현장명·공사명·메모의 단어로 찾는 '키워드 추정'이다(보여 주기만 하고 저장하지 않는다). Claude API 추정은 서버 함수 구조 확인 뒤에 바꿔 끼운다.
   끄기: G.workV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const GROUPS=[['unclassified','분류 필요 · 금액 큰 순','#e5484d','대표 공종이 없어 분석에서 빠지는 건 — 분류하면 바로 아래 묶음으로 이동'],['single','단일 공종','#3b6ce4','대표 공종 1개'],['multi','복합 공종','#8b5cf6','공종 2개 이상 · 조합은 따로 분석']];
 const GRID='minmax(0,1.4fr) 90px 80px 80px 90px minmax(0,1fr) 84px',COLS=['단계','담당','금액','등록','추정 공종'];
 const enabled=()=>!root.G.workV2Off;
 const amt=d=>root.oppAmt(d);
 const eok=v=>v?root.fmtAmt(v):'';
 const toast=(m,t)=>{if(typeof root.toast==='function')root.toast(m,t);};
 /* 키워드 추정: [대표 공종 묶음, 단어] — 근거로 찾은 단어를 함께 보여 준다 */
 const HINTS=[['옥상',/옥상|방수|슁글|싱글|기와|우레탄|PVC|슬라브/i],['재도장',/재도장|도장|외벽|균열|페인트/i],['지하주차장',/주차장|에폭시|배면|차수|바닥/i]];
 /* 세부 공종까지 가리키는 단어 — 실제 분류표(WORK_MASTER)의 항목으로만 잇는다. 단어가 없으면 묶음 이름까지만 추정한다 */
 const ITEM_HINTS=[['옥상>싱글',/슁글|싱글/],['옥상>금속기와',/기와/],['옥상>듀얼',/듀얼/],['옥상>우레탄',/우레탄/],['옥상>PVC',/PVC/i],['재도장>외+내부',/외\s*\+\s*내부|내외부/],['재도장>외부',/외벽|외부/],['재도장>내부',/내부/],['지하주차장>에폭시',/에폭시/],['지하주차장>배면차수',/배면|차수/]];
 function guess(d){
  const texts=[d.site,d.work,d.work_name,d.list_name].concat((d.legacy_notes||[]).slice(0,3).map(n=>n.body),(d.activities||[]).slice(0,5).map(a=>a.note)).filter(Boolean).map(String).join(' ');
  const hits=[];HINTS.forEach(([g,re])=>{const m=re.exec(texts);if(m){const it=ITEM_HINTS.find(([k,r])=>k.indexOf(g+'>')===0&&r.test(texts));hits.push([g,m[0],it?it[0]:'']);}});
  return hits.length?{label:hits.map(x=>x[2]?x[2].replace('>',' '):x[0]).join(' + '),groups:hits.map(x=>x[0]),keys:hits.map(x=>x[2]).filter(Boolean),basis:hits.map(x=>'«'+x[1]+'»').join(' · ')}:null;
 }
 function model(){
  const data=root.workAnalysisData(),f=root.G.workScope||'all';
  const rows=data.flow.map(d=>({d,scope:root.workScopeOf(d),guess:null}));rows.forEach(r=>{if(r.scope==='unclassified')r.guess=guess(r.d);});
  return {data,rows,f};
 }
 function diagnosis(m){
  const D=root.PipelineDiagnosis;if(!D)return '';
  const data=m.data,n=data.flow.length,un=m.rows.filter(r=>r.scope==='unclassified'),unAmt=un.reduce((a,r)=>a+amt(r.d),0),pipe=data.open.reduce((a,d)=>a+amt(d),0),classified=n-un.length,rate=n?Math.round(classified*100/n):0;
  const won=data.won,wonSum=won.reduce((a,d)=>a+(Number(root.wonAmt(d))||0),0),wonNoWork=won.filter(d=>root.workScopeOf(d)==='unclassified').length,wonNoAmt=won.filter(d=>!root.hasWonAmt(d)).length;
  const K=(label,value,sub,tone)=>({label,value,sub,tone:tone||''});
  /* 어디에 돈이 쌓였나: 분류 70% 이상이면 확정 공종, 아니면 키워드 추정 기준 */
  const byGroup=new Map();let basis='확정 공종 기준';
  if(rate>=70){data.open.forEach(d=>{const k=root.workAnalysisGroup(root.workAnalysisPrimary(d));byGroup.set(k,(byGroup.get(k)||0)+amt(d));});}
  else{basis='키워드 추정 기준 · 분류 전';m.rows.filter(r=>data.open.includes(r.d)).forEach(r=>{const k=r.scope==='unclassified'?(r.guess?r.guess.groups[0]:'근거 부족'):root.workAnalysisGroup(root.workAnalysisPrimary(r.d));byGroup.set(k,(byGroup.get(k)||0)+amt(r.d));});}
  const money=[...byGroup].filter(x=>x[1]>0).sort((a,b)=>(a[0]==='근거 부족')-(b[0]==='근거 부족')||b[1]-a[1]).slice(0,5).map(([k,v])=>[k,Math.round(v/1e7)/10,'']);
  const wonAmtList=won.filter(d=>root.hasWonAmt(d)&&root.wonAmt(d)>0),avg=l=>l.length?Math.round(l.reduce((a,d)=>a+root.wonAmt(d),0)/l.length/1e4).toLocaleString('ko-KR')+'만':'–';
  const per=new Map();wonAmtList.forEach(d=>{const k=root.workAnalysisGroup(root.workAnalysisPrimary(d));(per.get(k)||per.set(k,[]).get(k)).push(d);});
  const avgRows=[['전체 평균',avg(wonAmtList),wonAmtList.length+'건 · 금액 입력 건만']].concat([...per].filter(x=>x[0]!=='확인 필요').sort((a,b)=>b[1].length-a[1].length).slice(0,3).map(([k,l])=>[k,avg(l),l.length+'건']));
  const tasks=[[un.length,'미분류 '+un.length+'건'+(unAmt?' · '+root.fmtAmt(unAmt):''),'금액 큰 20건부터 이번 주 분류 (추정 확인만)','관리팀 · 이번 주','공종 미분류'],[un.length,'신규 건 공종 누락','영업기회 저장 시 대표 공종을 함께 고르기','영업팀','신규 공종 누락'],[m.rows.some(r=>r.scope==='multi')?0:classified,'복합 공종 0건','공종이 2개 이상이면 함께 하는 공종까지 선택','영업팀','복합 공종'],[wonNoWork,'수주 '+wonNoWork+'건 공종 연결 안 됨','계약 체결 시 공종 · 금액 함께 확정','계약 · 시공 단계','매출 공종 연결']].filter(t=>t[0]>0).map(t=>({basis:t[1],todo:t[2],who:t[3],label:t[4],count:t[0]}));
  return D.render({accent:'blue',
   kpis:[K('영업기회',n+'건','선택 기간 신규 등록'),K('진행 중 금액',pipe?root.fmtAmt(pipe):'0원',data.open.length+'건 진행 중'),K('매출',wonNoWork||!won.length?(won.length?'확인 필요':'–'):root.fmtAmt(wonSum),won.length?(wonNoWork?'계약 체결일 기준 · '+wonNoWork+'건 공종 연결 안 됨':'계약 체결일 기준 · '+won.length+'건'):'선택 기간 수주 없음',wonNoWork?'warn':''),K('공종 미분류',un.length+'건',n?(100-rate)+'%'+(rate<70?' · 분석 불가':''):'대상 없음',un.length?'bad':'')],
   cards:[{title:'무엇이 비었나',desc:'분석을 막는 것',bars:[['공종 미분류',un.length,eok(unAmt)],['계약금액 미입력',wonNoAmt,''],['수주 공종 미연결',wonNoWork,'']].filter(x=>x[1]>0),empty:'비어 있는 항목이 없습니다'},{title:'어디에 돈이 쌓였나',desc:'공종별 Pipeline · 단위 억 · '+basis,bars:money,empty:'진행 금액이 없습니다'},{title:'얼마짜리인가',desc:'수주 1건당 평균',rows:avgRows.map(r=>[r[0],r[1],r[2]])}],
   action:{title:'그래서 뭘 해야 하나',desc:'공종 분석에서 나온 과제',tasks}},{open:true,noToggle:true,scope:'work'});
 }
 function rowHtml(r){
  const d=r.d,owner=root.repN(d.assignee)||'미배정',done=r.scope!=='unclassified',g=r.guess;
  const work=done?'<span class="g">'+h(root.dealWorkSummary(d))+'</span><small>확정</small>':g?'<span class="a" title="'+attr('근거: '+g.basis)+'">'+h(g.label)+'</span><small>키워드 추정</small>':'<span class="m">–</span><small>근거 부족</small>';
  return '<div class="plv-row" role="row" tabindex="0" data-wv="classify" data-value="'+attr(root.dealKey(d))+'" data-deal="'+attr(d.id)+'" style="grid-template-columns:'+GRID+'"><span class="plv-c plv-site"><b title="'+attr(d.site)+'">'+h(d.site||'현장명 미입력')+'</b><small class="'+(owner==='미배정'?'none':'')+'">'+h(owner)+'</small></span>'
   +'<span class="plv-c"><em class="plv-tag m">'+h(root.stageLabel(root.dealStage(d)))+'</em></span>'
   +'<span class="plv-c"><span>'+h(owner)+'</span></span>'
   +'<span class="plv-c"><span class="'+(amt(d)?'b':'m')+'">'+h(amt(d)?root.fmtAmt(amt(d)):'미입력')+'</span></span>'
   +'<span class="plv-c"><span>'+h(String(d.created||d.created_at||'').slice(0,7)||'–')+'</span></span>'
   +'<span class="plv-c">'+work+'</span>'
   +'<button type="button" class="plv-cta" data-wv="classify" data-value="'+attr(root.dealKey(d))+'">'+(done?'수정':'분류하기')+'</button></div>';
 }
 function listHtml(m){
  const more=root.G.wvMore||(root.G.wvMore={}),count=k=>m.rows.filter(r=>r.scope===k).length;
  const pills='<div class="plv-pills" role="group" aria-label="분류 상태">'+[['all','전체',m.rows.length],['unclassified','분류 필요',count('unclassified')],['single','단일 공종',count('single')],['multi','복합 공종',count('multi')]].map(([v,t,n])=>'<button type="button" data-wv="scope" data-value="'+v+'" aria-pressed="'+(m.f===v)+'">'+h(t)+' <b>'+n+'</b></button>').join('')+'</div>';
  const intro='<div class="plv-intro"><i style="background:#64748b"></i><b>공종 분석</b><span>어떤 공종에 기회와 매출이 쌓이는지 · '+h(root.perfPeriodLabel?root.perfPeriodLabel():'')+'</span><div class="plv-spacer"></div>'+pills+'</div>';
  const head='<div class="plv-thead" role="row" style="grid-template-columns:'+GRID+'"><span>현장 · 담당</span>'+COLS.map(c=>'<span>'+h(c)+'</span>').join('')+'<span></span></div>';
  const groups=GROUPS.filter(g=>m.f==='all'||g[0]===m.f).map(([id,title,color,desc])=>{const list=m.rows.filter(r=>r.scope===id).sort((a,b)=>amt(b.d)-amt(a.d)),__pg=root.ListPager.cut(list,(more[id]||0)+1),shown=__pg.rows,rest=list.length-shown.length;return '<div class="plv-ghead" data-plv-group="'+id+'"><i style="background:'+color+'"></i><b>'+h(title)+'</b><span>'+list.length+'건</span><small>· '+h(desc)+'</small></div>'+(shown.length?shown.map(rowHtml).join(''):'<div class="plv-empty">해당하는 건이 없습니다</div>')+root.ListPager.html(__pg,{ns:'wv',attrs:'data-value="'+id+'"',small:true});}).join('');
  return '<div id="work-v2" class="plv" data-workspace="work">'+intro+diagnosis(m)+'<div class="plv-table" role="table" aria-label="공종 분류 목록">'+head+groups+'</div></div>';
 }
 /* ── 분류 창: 파이프라인 '공종 분류' 패널과 같은 공종 선택 부품(DealPanelsV2.workMount)을 560px 창에 넣는다.
    저장은 기존 saveWorkEdit → Phase11.save(서버 최신 버전 확인). [확정 · 다음 건]은 다음 미분류 건(금액 큰 순)을 이어 열고, [나중에]는 건너뛴다 ── */
 let chain=null,ctx=null;const skipped=new Set();
 const unclassified=()=>root.workAnalysisData().flow.filter(d=>root.workScopeOf(d)==='unclassified').sort((a,b)=>amt(b)-amt(a));
 function node(){
  let m=document.getElementById('workDialog');if(m)return m;
  m=document.createElement('div');m.id='workDialog';m.className='wd-layer';m.innerHTML='<section class="wd-box dp" role="dialog" aria-modal="true" aria-labelledby="wdTitle"></section>';
  m.addEventListener('mousedown',e=>{if(e.target===m)hide();});
  m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();hide();}});
  document.body.append(m);return m;
 }
 const isOpen=()=>!!document.getElementById('workDialog')?.classList.contains('on');
 function hide(){const m=document.getElementById('workDialog');if(m){m.classList.remove('on');m.querySelector('.wd-box').innerHTML='';}const done=ctx&&ctx.done;ctx=null;try{baseClose&&baseClose();}catch(e){}if(done)try{done();}catch(e){}}
 function frame(d,body,foot){
  const all=root.workAnalysisData().flow,left=unclassified().length,done=all.length-left,fresh=ctx&&ctx.chain;
  const m=node(),box=m.querySelector('.wd-box');
  box.innerHTML='<header class="wd-head"><div><h2 id="wdTitle">'+(fresh?'공종 분류 · 남은 '+left+'건':'공종 수정')+'</h2><small>'+h(d.site||'현장명 미입력')+(amt(d)?' · '+h(root.fmtAmt(amt(d))):'')+'</small></div><button type="button" class="xdv-close" data-wd="close" aria-label="닫기">✕</button></header>'
   +(fresh?'<div class="wd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="'+all.length+'" aria-valuenow="'+done+'" aria-label="분류 진행"><i style="width:'+(all.length?Math.round(done*100/all.length):0)+'%"></i></div>':'')
   +'<div class="wd-body dp-body">'+body+'</div><footer class="dp-foot">'+foot+'</footer>';
  m.classList.add('on');return box;
 }
 function show(d){
  if(!root.DealPanelsV2||!root.DealPanelsV2.workMount)return false;
  const legacy=document.getElementById('newDealBody'),lm=document.getElementById('newDealModal');if(legacy)legacy.innerHTML='';if(lm){lm.classList.remove('on');lm.setAttribute('aria-hidden','true');}
  const fresh=ctx&&ctx.chain;
  const box=frame(d,'<div id="dp-work"></div><label class="dp-line">메모 <input id="rs-work-text" placeholder="남겨 둘 내용이 있을 때만 (선택)"></label><div class="modalerr" id="nd-err"></div>',
   fresh?'<button type="button" class="dp-ghost" data-wd="later">나중에</button><button type="button" class="dp-primary" data-wd="save" disabled>확정 · 다음 건</button>':'<button type="button" class="dp-ghost" data-wd="close">취소</button><button type="button" class="dp-primary" data-wd="save">저장</button>');
  /* 창 틀(box)은 다시 쓰이므로, 매번 새로 만들어지는 본문에 붙인다 — 클릭이 겹쳐 처리되지 않게 */
  const W=root.DealPanelsV2.workMount(box.querySelector('.wd-body'),d,w=>{const b=box.querySelector('[data-wd="save"]');if(b&&fresh)b.disabled=!w.items.length;});
  box.onclick=e=>{
   const b=e.target.closest('[data-wd]');if(!b)return;const a=b.dataset.wd;
   if(a==='close'){chain=null;hide();}
   if(a==='later'){const key=ctx.key;skipped.add(key);chain=null;hide();const rest=unclassified().filter(x=>!skipped.has(root.dealKey(x)));if(rest.length)setTimeout(()=>classify(root.dealKey(rest[0])),100);else toast('건너뛴 건을 빼면 분류할 건이 더 없습니다');}
   if(a==='save'){if(fresh&&!W.items.length)return;const o=box.querySelector('#nd-work-other');if(o)W.other=o.value;root.saveWorkEdit();}
  };
  box.querySelector('[data-work],[data-guess]')?.focus();return true;
 }
 function classify(key,opt){
  const d=(root.B.deals||[]).find(x=>root.dealKey(x)===key);if(!d)return;
  /* single: 다른 화면(확장관리 상세 등)에서 한 건만 — 다음 건으로 잇지 않는다 */
  const single=!!(opt&&opt.single),fresh=!single&&root.workScopeOf(d)==='unclassified';chain=fresh?key:null;ctx={key,id:String(d.id),chain:fresh,any:single,done:opt&&opt.done};
  root.CUR_DETAIL={kind:'deal',key,item:d};
  const P=root.Phase11;
  if(P&&P.current!==d){/* 서버의 최신 공종·버전을 먼저 읽는다 → 읽히면 openWorkEdit 가 다시 불려 창을 그린다 */
   frame(d,'<p class="dp-empty">서버의 최신 공종과 버전을 불러오고 있습니다…</p><div class="modalerr" id="nd-err"></div>','<button type="button" class="dp-ghost" data-wd="close">닫기</button>').onclick=e=>{if(e.target.closest('[data-wd="close"]')){chain=null;hide();}};
   P.openWork(d.id,d).catch(()=>{const e=document.getElementById('nd-err');if(e){e.style.display='block';e.textContent='공종 정보를 불러오지 못했습니다. 닫고 다시 시도해 주세요.';}});return;
  }
  if(!show(d))root.openWorkEdit();
 }
 function next(){
  if(!chain)return;const prev=(root.B.deals||[]).find(x=>root.dealKey(x)===chain);
  if(!prev||root.workScopeOf(prev)==='unclassified')return;/* 아직 저장 전 */
  chain=null;if(isOpen())hide();
  const rest=unclassified().filter(x=>!skipped.has(root.dealKey(x)));
  if(!rest.length){toast('분류할 건이 더 없습니다 — 모두 분류했습니다');return;}
  toast('저장했습니다 · 다음 미분류 건을 엽니다 (남은 '+rest.length+'건)');setTimeout(()=>classify(root.dealKey(rest[0])),150);
 }
 let baseClose=null;
 function onClick(e){
  const pd=e.target.closest('[data-pd="toggle"]');if(pd&&pd.closest('#work-v2')){root.G.plvDiagShut=root.G.plvDiagShut!==true;root.paintWorkAnalysis();return;}
  const b=e.target.closest('#work-v2 [data-wv]');if(!b)return;const a=b.dataset.wv,v=b.dataset.value;
  if(a==='scope'){root.G.workScope=v;root.G.wvMore={};root.paintWorkAnalysis();}
  if(a==='page'){const m=root.G.wvMore||(root.G.wvMore={});m[v]=(Number(b.dataset.page)||1)-1;root.paintWorkAnalysis();}
  if(a==='classify')classify(v);
 }
 function boot(){
  const base=root.paintWorkAnalysis;if(typeof base!=='function')return;
   /* 이 화면에서 연 분류는 예전 '공종 분류·수정' 창 대신 새 창으로 */
   const ow=root.openWorkEdit;if(typeof ow==='function')root.openWorkEdit=function(){const it=root.CUR_DETAIL&&root.CUR_DETAIL.item;if(ctx&&enabled()&&(root.G.page==='work'||ctx.any)&&it&&String(it.id)===ctx.id&&show(it))return;return ow.apply(this,arguments);};
   baseClose=root.closeNewDeal;if(typeof baseClose==='function')root.closeNewDeal=function(){const r=baseClose.apply(this,arguments);const m=document.getElementById('workDialog');if(m&&m.classList.contains('on')){m.classList.remove('on');m.querySelector('.wd-box').innerHTML='';const done=ctx&&ctx.done;ctx=null;if(done)try{done();}catch(e){}}return r;};
  root.paintWorkAnalysis=function(){
   const host=document.getElementById('work-analysis');
   if(!enabled()||!host)return base.apply(this,arguments);
   try{host.innerHTML=listHtml(model());if(!host.__wv){host.__wv=true;host.addEventListener('click',onClick);host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}});}
    if(root.G.page==='work'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='공종 분석';if(p)p.textContent='어떤 공종에 기회와 매출이 쌓이는지';}
    setTimeout(next,0);
   }catch(e){console.warn('[공종 분석 v2]',e);return base.apply(this,arguments);}
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.WorkV2={enabled,guess,classify};
})(window);

/* 공종 분석 핸드오프: 이 메뉴의 목록/Inspector만 교체한다.
 * WorkV2.classify(single)는 다른 메뉴가 사용하므로 기존 편집기를 유지한다.
 * 공종 확정은 Phase11, AI는 OpsStore, 병합은 전용 원자 RPC의 ACK 후에만 반영한다. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v??'')),a=v=>root.escAttr(String(v??''));
 const id=d=>String(d.id),key=d=>root.dealKey(d),money=d=>Math.max(0,Number(root.oppAmt(d))||0);
 const fmt=n=>root.fmtAmt(n),works=d=>root.workItemsOf(d).map(w=>w.key),classified=d=>works(d).length>0;
 const month=d=>String(d.created||d.created_at||'').slice(0,7)||'등록일 미기록';
 const stage=d=>root.stageLabel(root.dealStage(d)),owner=d=>root.repN(d.assignee)||'미배정';
 const S={tab:'need',edit:null,detail:null,draft:[],primary:'',other:'',version:null,overlap:false,busy:false,error:'',ai:new Map(),links:[],loaded:false,loading:false,linkError:'',request:null,writePending:null,actor:''};
 const tabs=[['need','분류 필요'],['guess','AI 추정 있음'],['missing','근거 부족'],['siblings','같은 현장 여러 건'],['done','분류됨']];
 /* 기록 원문에 섞인 태그(<p> · <li> …)는 보여 줄 때만 정리한다(2026-10-04 대표) — AI 추천에 넘기는 기록과 저장된 원문은 그대로 */
 const tidy=t=>typeof root.tidyNoteHtml==='function'?root.tidyNoteHtml(t):String(t==null?'':t);
 function records(d){
  // No site-wide notes, sibling inquiries, contacts or another opportunity's activities.
  const own=x=>!x.opportunity_id||String(x.opportunity_id)===id(d);
  return [d.work,d.work_name,d.inquiry_content,d.inquiry_original,d.original_text]
   .concat((d.legacy_notes||[]).filter(own).map(x=>x.body),(d.activities||[]).filter(own).map(x=>x.note||x.body))
   .filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()).filter((x,i,all)=>all.indexOf(x)===i).slice(0,12);
 }
 function signature(d){return JSON.stringify([id(d),records(d)]);}
 function prediction(d){
  const saved=S.ai.get(id(d));
  if(saved&&saved.signature===signature(d))return saved;
  return null; // Only a real, current Claude response belongs in the AI tab.
 }
 function siteKey(d){
  const sid=d.cleanup_site_id||d.site_id||d.siteId;
  if(sid)return 'id:'+sid;
  // A name alone never proves that two apartments are the same site.
  const address=String(d.address||'').replace(/\s/g,'').toLowerCase();
  const name=String(d.site||'').replace(/\s/g,'').toLowerCase();
  return name&&address?'address:'+address+'|'+name:'deal:'+id(d);
 }
 const all=()=>root.B?.deals||[];
 const lookup=k=>all().find(d=>key(d)===k);
 function active(){const merged=new Set(S.links.map(l=>String(l.source_id)));return all().filter(d=>!merged.has(id(d)));}
 const siblings=d=>active().filter(x=>siteKey(x)===siteKey(d)).sort((x,y)=>String(y.created||y.created_at||'').localeCompare(String(x.created||x.created_at||''))||id(x).localeCompare(id(y)));
 function groups(rows){const map=new Map();rows.forEach(d=>{const k=siteKey(d);if(!map.has(k))map.set(k,[]);map.get(k).push(d);});return [...map.values()].map(g=>g.sort((x,y)=>String(y.created||y.created_at||'').localeCompare(String(x.created||x.created_at||''))||id(x).localeCompare(id(y)))).sort((x,y)=>Math.max(...y.map(money))-Math.max(...x.map(money))||siteKey(x[0]).localeCompare(siteKey(y[0])));}
 function model(){
  const merged=new Set(S.links.map(l=>String(l.source_id))),data=root.workAnalysisData();
  const rows=data.flow.filter(d=>!merged.has(id(d))),sets=groups(rows);
  return {rows,groups:sets,open:data.open.filter(d=>!merged.has(id(d))),confirmed:rows.filter(classified),guessed:rows.filter(d=>!classified(d)&&prediction(d)),missing:rows.filter(d=>!classified(d)&&!prediction(d)),multi:sets.filter(g=>g.length>1)};
 }
 function brand(d){const b=d.brand||d.currentBusiness||'브랜드 미기록';return '<span class="gj-brand">'+h(b)+'</span>';}
 function tone(d){return /아파트/.test(d.brand||'')?'#3b6ce4':/석민/.test(d.brand||'')?'#e8590c':/공법/.test(d.brand||'')?'#7048e8':'#1f9d55';}
 const btn=(action,text,value='',cls='')=>'<button type="button" class="gj-btn '+cls+'" data-gj="'+action+'" data-value="'+a(value)+'">'+h(text)+'</button>';
 function matching(d,keys){return siblings(d).filter(x=>id(x)!==id(d)&&works(x).some(k=>keys.includes(k)));}
 function inferredOverlap(d,g){return g&&siblings(d).some(x=>id(x)!==id(d)&&works(x).some(k=>g.groups.includes(k.split('>')[0])));}
 function intro(m){
  const n=m.rows.length,p=x=>n?x*100/n:0;
  return '<section class="gj-intro"><div class="gj-introbody"><small>분석 전에 할 일</small><h2>영업기회 '+n+'건 중 공종 확정 <strong class="'+(!m.confirmed.length?'gj-red':'')+'">'+m.confirmed.length+'건</strong> — 분류해야 아래 분석이 맞아집니다</h2><div class="gj-stack" aria-label="확정 '+m.confirmed.length+'건, 추정 '+m.guessed.length+'건, 근거 부족 '+m.missing.length+'건"><i style="width:'+p(m.confirmed.length)+'%"></i><i style="width:'+p(m.guessed.length)+'%"></i><i style="width:'+p(m.missing.length)+'%"></i></div><div class="gj-legend"><span>■ 확정 '+m.confirmed.length+'</span><span>■ AI 추정 있음 '+m.guessed.length+' — [맞음]만 누르면 끝</span><span>□ 근거 부족 '+m.missing.length+' — 직접 고르기</span><b>□ 같은 현장 여러 건 '+m.multi.length+'곳</b></div></div>'+btn('tab','AI 추정 확인 시작 ('+m.guessed.length+'건)','guess','gj-primary')+'</section>';
 }
 function diagnosis(m){
  const sums=new Map(),averages=new Map();
  m.open.forEach(d=>{const confirmed=classified(d),g=prediction(d),group=confirmed?(root.dealPrimaryWork(d)||works(d)[0]).split('>')[0]:g?.groups[0]||'근거 부족';const v=sums.get(group)||[0,0];v[confirmed?0:1]+=money(d);sums.set(group,v);});
  m.confirmed.filter(d=>money(d)>0).forEach(d=>{const group=(root.dealPrimaryWork(d)||works(d)[0]).split('>')[0];const v=averages.get(group)||[];v.push(money(d));averages.set(group,v);});
  const sorted=[...sums].sort((x,y)=>(x[0]==='근거 부족')-(y[0]==='근거 부족')||(y[1][0]+y[1][1])-(x[1][0]+x[1][1])),max=Math.max(1,...sorted.map(x=>x[1][0]+x[1][1]));
  const tasks=[{label:'공종 분류',basis:'미분류 '+(m.rows.length-m.confirmed.length)+'건',todo:'금액이 큰 미분류 건부터 공종 확정',who:'관리팀 · 이번 주',count:m.rows.length-m.confirmed.length},{label:'공종 근거 보완',basis:'근거 부족 '+m.missing.length+'건',todo:'상담 기록과 견적서에서 공사 범위 확인',who:'영업팀',count:m.missing.length},{label:'같은 현장 확인',basis:'같은 현장 여러 건 '+m.multi.length+'곳',todo:'같은 공사인지 확인하고 견적 버전으로 정리',who:'담당자',count:m.multi.length}];
  return '<aside class="gj-diagnosis"><section><h3>어디에 돈이 쌓였나</h3><p>공종별 진행 금액 · 진한 = 확정, 연한 = AI 추정</p>'+ (sorted.length?sorted.map(([g,v])=>'<div class="gj-money"><div><b>'+h(g)+'</b><span>'+h(fmt(v[0]+v[1]))+'</span></div><div class="gj-moneybar '+(g==='근거 부족'?'unknown':'')+'"><i style="width:'+v[0]*100/max+'%"></i><i style="width:'+v[1]*100/max+'%"></i></div></div>').join(''):'<p>진행 중인 금액이 없습니다.</p>')+'</section><section><h3>얼마짜리인가</h3><p>확정된 건만 · 공종별 평균 금액</p>'+([...averages].length?[...averages].map(([g,v])=>'<div class="gj-average"><span>'+h(g)+' <small>'+v.length+'건</small></span><b>'+h(fmt(v.reduce((x,y)=>x+y,0)/v.length))+'</b></div>').join(''):'<div class="gj-empty">공종을 확정하면 평균 금액을 볼 수 있습니다.</div>')+'</section><section><h3>그래서 뭘 해야 하나</h3>'+tasks.map((t,i)=>'<article class="gj-task"><small>0'+(i+1)+' · '+h(t.basis)+'</small><b>'+h(t.todo)+'</b><span>'+h(t.who)+'</span>'+(root.ImprovementTasks?.buttonHtml('work',t)||'')+'</article>').join('')+'</section></aside>';
 }
 function row(d,grouped){
  const done=classified(d),g=prediction(d),same=inferredOverlap(d,g),selected=S.edit===key(d),merged=S.links.filter(l=>String(l.target_id)===id(d));
  return '<article class="gj-item" data-deal="'+a(id(d))+'" style="--gj-brand:'+tone(d)+'"><div class="gj-row '+(grouped?'gj-child':'')+'"><div class="gj-site">'+btn('detail',grouped?month(d)+' 등록 건 · '+stage(d):d.site||'현장명 미기록',key(d),'gj-link')+'<small>'+brand(d)+' · '+h(owner(d))+' · '+h(stage(d))+' · '+h(month(d))+'</small>'+(merged.length?'<span class="gj-blue">견적 버전 '+(merged.length+1)+'개 · 분석은 1건</span>':'')+'</div><b class="gj-amount '+(!money(d)?'gj-warn':'')+'">'+h(money(d)?fmt(money(d)):'금액 없음')+'</b><div class="gj-inference">'+(done?'<b>'+h(root.dealWorkSummary(d))+'</b><small>확정</small>':g?'<b class="gj-blue">'+h(g.source==='Claude AI'?'AI: ':'추정: ')+h(g.label)+'?</b><small>'+h(g.source)+' · '+h(g.basis)+'</small>':'<b>미분류</b><small>근거 부족 · 기록을 확인해주세요</small>')+(same?'<small class="gj-warn">다른 건과 같은 공종 — 같은 공사인지 확인</small>':'')+'</div><div class="gj-accept">'+(!done&&g?.keys.length&&g.keys.length===g.groups.length?btn('accept','맞음',key(d)):'')+'</div>'+btn('edit',selected?'닫기':done?'수정':g?'바꾸기':'분류하기',key(d))+'</div>'+(selected?editor(d,false):'')+'</article>';
 }
 function list(m){
  const count={need:m.rows.length-m.confirmed.length,guess:m.guessed.length,missing:m.missing.length,siblings:m.multi.reduce((n,g)=>n+g.length,0),done:m.confirmed.length};
  const fits=d=>S.tab==='need'?!classified(d):S.tab==='guess'?!classified(d)&&prediction(d):S.tab==='missing'?!classified(d)&&!prediction(d):S.tab==='done'?classified(d):true;
  const shown=m.groups.filter(g=>S.tab!=='siblings'||g.length>1).map(g=>({all:g,rows:g.filter(fits)})).filter(g=>g.rows.length);
  return '<section class="gj-list"><nav class="gj-tabs" aria-label="공종 분류 상태">'+tabs.map(([k,t])=>'<button type="button" data-gj="tab" data-value="'+k+'" aria-pressed="'+(S.tab===k)+'">'+h(t)+' <b>'+count[k]+'</b></button>').join('')+'<span class="gj-listnote">금액 큰 순 · 같은 현장은 묶어서 · 현장명을 누르면 상세</span></nav>'+ (shown.length?shown.map(({all:g,rows})=>(g.length>1?'<header class="gj-group"><b>'+h(g[0].site)+'</b><em>영업건 '+g.length+'</em><span>'+(g.every(d=>!classified(d))?'모두 공종 미분류 — 건마다 기록을 보고 따로 정하세요':'미분류 '+g.filter(d=>!classified(d)).length+'건 · 같은 현장의 서로 다른 영업건입니다')+'</span></header>':'')+rows.map(d=>row(d,g.length>1)).join('')).join(''):'<div class="gj-empty">이 조건에서 확인할 영업건이 없습니다.</div>')+'</section>';
 }
 function draftKeys(){return S.draft.map(k=>k==='기타>기타'&&S.other.trim()?'기타>'+S.other.trim():k);}
 function editor(d,detail){
  const g=prediction(d),others=siblings(d).filter(x=>id(x)!==id(d)),conflicts=matching(d,draftKeys());
  return '<div class="gj-editor" aria-busy="'+S.busy+'">'+(detail?'<h3>지금 할 일</h3><b class="gj-todo">이 건의 공종을 확정해주세요</b><p>이 건 기록만 보고 판단하세요. 여러 개면 복합 공종입니다.</p>':'')+(others.length?'<div class="gj-notice">같은 현장 다른 건: '+others.map(x=>h(month(x)+' '+root.dealWorkSummary(x))).join(' / ')+'<br><b>이 건 기록으로만 판단하세요.</b></div>':'')+(detail?'<div class="gj-ai-tools">'+btn('ai',S.busy?'확인 중…':'✦ AI 추천',key(d),'gj-link')+'</div>'+(g?'<p class="gj-ai-basis">'+h(g.basis)+'</p>'+btn('confirm-ai','AI 추정 맞음 · '+g.label,key(d),'gj-primary gj-ai-confirm'):''):'')+'<div class="gj-choices">'+root.WORK_MASTER.map(group=>'<fieldset><legend>'+h(group.group)+'</legend><div>'+group.items.map(item=>{const k=group.group+'>'+item;return '<button type="button" data-gj="choice" data-value="'+a(k)+'" aria-pressed="'+S.draft.includes(k)+'">'+h(item)+'</button>';}).join('')+'</div></fieldset>').join('')+'</div>'+(S.draft.includes('기타>기타')?'<label>기타 공종명<input data-gj-field="other" value="'+a(S.other)+'" maxlength="80" placeholder="공종명을 입력해주세요"></label>':'')+(S.draft.length>1?'<label>복합 공종 · 대표 공종<select data-gj-field="primary">'+S.draft.map(k=>'<option value="'+a(k)+'" '+(k===S.primary?'selected':'')+'>'+h(k.replace('>',' · '))+'</option>').join('')+'</select></label>':'')+(S.overlap&&conflicts.length?'<section class="gj-conflict" role="alert"><b>같은 세부 공종이 있습니다.</b>'+conflicts.map(x=>'<p>'+h(month(x)+' '+stage(x)+' 건이 이미 '+works(x).filter(k=>draftKeys().includes(k)).map(k=>k.replace('>',' · ')).join(', '))+'</p>'+btn('merge','같은 공사 · 합치기',key(x))).join('')+'<small>선택한 기존 건에 견적 버전으로 보존하며 분석 금액·평균은 한 번만 셉니다.</small>'+btn('keep','다른 공사 · 그대로 확정',key(d))+'</section>':'')+'<p class="gj-error" role="alert">'+h(S.error)+'</p><div class="gj-editorfoot">'+(!detail?'<small>여러 개 고르면 복합 공종</small>'+btn('cancel','취소'):'')+btn('save',S.busy?'서버 확인 중…':detail?'공종 확정':'확정',key(d),'gj-primary')+'</div></div>';
 }
 function start(d,detail=false,accept=false){
  if(S.busy||S.writePending)return;S.error='';S.overlap=false;S.request=null;S.version=d.version;S.edit=detail?null:key(d);S.detail=detail?key(d):null;
  S.draft=works(d).map(k=>k.startsWith('기타>')?'기타>기타':k);S.other=works(d).find(k=>k.startsWith('기타>'))?.slice(3)||'';S.primary=root.dealPrimaryWork(d)||S.draft[0]||'';
  if(accept)useGuess(d);repaint();if(detail)dialog();
 }
 function useGuess(d){const g=prediction(d);if(!g)return;S.draft=g.keys.slice();S.primary=g.primary||S.draft[0]||'';S.overlap=false;S.error='';}
 function refreshEditor(){if(S.detail)dialog();else repaint();}
 let previousFocus=null;
 function close(){if(S.busy||S.writePending)return;document.getElementById('gongjongDialog')?.remove();S.detail=null;S.edit=null;S.error='';previousFocus?.focus();}
 function dialog(){
  const d=lookup(S.detail);if(!d)return;let modal=document.getElementById('gongjongDialog');
  if(!modal){previousFocus=document.activeElement;modal=document.createElement('div');modal.id='gongjongDialog';modal.className='gj-layer';modal.addEventListener('click',e=>{if(e.target===modal)close();else click(e);});modal.addEventListener('change',change);modal.addEventListener('input',input);modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const f=[...modal.querySelectorAll('button:not(:disabled),a[href],input,select')].filter(x=>x.offsetParent);if(!f.length)return;const first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});document.body.append(modal);}
  const c=root.contactInfo(d),phone=String(c.mobile||c.officeTel||'').replace(/[^0-9+]/g,''),g=prediction(d),sib=siblings(d);
  modal.innerHTML='<section class="gj-dialog" role="dialog" aria-modal="true" aria-labelledby="gj-title" style="--gj-brand:'+tone(d)+'"><header><div class="gj-dialogtop">'+brand(d)+btn('pipeline','파이프라인에서 열기 →',key(d),'gj-link')+'<button type="button" class="gj-btn" data-gj="close" aria-label="닫기">✕</button></div><h2 id="gj-title">'+h(d.site)+'</h2><nav class="gj-dealtabs" aria-label="이 현장 영업건"><span>이 현장 영업건 '+sib.length+'</span>'+sib.map(x=>'<button type="button" data-gj="detail" data-value="'+a(key(x))+'" aria-pressed="'+(id(d)===id(x))+'">'+h(month(x)+' · '+stage(x)+' · '+root.dealWorkSummary(x))+'</button>').join('')+'</nav><p><b>'+h(stage(d))+'</b> · 담당 '+h(owner(d))+' · '+h(money(d)?fmt(money(d)):'금액 없음')+' · '+h(month(d))+' 등록</p></header>'+'<div class="gj-columns"><aside><div class="gj-person"><i>'+h(c.name?.slice(0,1)||'—')+'</i><div><small>'+h(c.role||'관리소장')+'</small><b>'+h(c.name||'연락처 이름 미기록')+'</b></div></div><b class="gj-phone">'+h(phone||'연락처 미기록')+'</b>'+(phone?'<div class="gj-contact"><a href="tel:'+a(phone)+'">전화</a><a href="sms:'+a(phone)+'">문자</a></div>':'')+'<p>'+h(d.address||'주소 미기록')+'</p><h3>이 현장 공종 현황</h3>'+sib.map(x=>'<article class="gj-sitework"><small>'+h(month(x)+' · '+stage(x))+'</small><b>'+h(root.dealWorkSummary(x))+'</b></article>').join('')+'</aside><main><h3>이 건의 기록 <small>· 공종 단서를 찾는 곳</small></h3><article class="gj-record"><small>'+h(month(d))+'</small><b>영업기회 등록</b><p>'+h(tidy(d.work||d.work_name||'공사명 미기록'))+'</p></article>'+records(d).map(t=>'<article class="gj-record"><small>상담 · 문의 원문 / 활동 기록</small><p>'+h(tidy(t))+'</p></article>').join('')+(!records(d).length?'<p class="gj-empty">이 건의 공종 판단 근거가 없습니다. 상담·견적 기록을 확인해주세요.</p>':'')+(g?'<article class="gj-record gj-ai"><small>'+h(g.source)+' 판단 근거</small><b>'+h(g.label)+'</b><p>'+h(g.basis)+'</p></article>':'')+'</main><aside class="gj-action">'+editor(d,true)+'</aside></div></section>';
  if(S.busy)modal.querySelectorAll('button,input,select').forEach(x=>x.disabled=true);
 }
 let opening=null;
 async function fresh(d){
  // Phase11 owns authorization and concurrency. Its callback is intercepted only
  // for this menu's explicitly requested editor, leaving every other menu intact.
  opening=id(d);try{await root.Phase11.openWork(d.id,d);return root.Phase11.current;}finally{opening=null;}
 }
 async function save(d,keep=false){
  if(S.busy)return;const keys=draftKeys();if(!keys.length||S.draft.includes('기타>기타')&&!S.other.trim()){S.error='공종과 기타 공종명을 확인해주세요.';refreshEditor();return;}
  if(matching(d,keys).length&&!keep){S.overlap=true;refreshEditor();return;}
  const primary=S.primary==='기타>기타'?'기타>'+S.other.trim():S.primary||keys[0];
  S.busy=true;S.error='';refreshEditor();
  try{if(S.writePending){await root.Phase11.retry();}else{const current=await fresh(d);
   if(current.version!==S.version){S.version=current.version;Object.assign(d,current);throw Error('다른 변경이 있습니다. 최신 기록을 확인한 뒤 다시 확정해주세요.');}
   S.writePending=true;await root.Phase11.save(current,{primary_work:primary,work_items:keys,reason:keep?'공종 분석: 같은 세부 공종이나 다른 공사로 확인':'공종 분석: 이 건 기록 확인 후 공종 확정'});}
   if(root.Phase11.last&&root.Phase11.last.state!=='saved')throw Error('저장 완료를 확인하지 못했습니다. 다시 확인해주세요.');
   S.writePending=null;const suggestion=S.ai.get(id(d));if(suggestion?.suggestionId)root.OpsStore?.decide(suggestion.suggestionId,'accepted');S.busy=false;close();repaint();
  }catch(e){if(root.Phase11.last?.state!=='uncertain')S.writePending=null;S.error=e.status===409?'다른 사용자가 수정했습니다. 창을 다시 열어 최신 공종을 확인해주세요.':e.message||'저장에 실패했습니다.';if(S.writePending)S.error+=' 공종 확정을 다시 누르면 동일 요청의 결과를 확인합니다.';}
  finally{S.busy=false;refreshEditor();}
 }
 async function ai(d){
  if(S.busy)return;S.busy=true;S.error='';refreshEditor();const sig=signature(d);
  try{if(!records(d).length)throw Error('이 건의 상담·견적 기록이 없어 추정할 수 없습니다.');await root.OpsStore?.settings();if(!root.OpsStore?.aiOn())throw Error('AI 추천이 연결되어 있지 않습니다. 공종은 직접 선택할 수 있습니다.');
   const out=await root.OpsStore.ai('work_guess','deal',id(d),aiInput(d));
   const r=out.suggestion||{},keys=(r.keys||[]).filter(k=>root.knownWorkKey(k)&&k!=='기타>기타');
   if(signature(d)!==sig)throw Error('기록이 바뀌었습니다. 최신 기록으로 다시 추천받아주세요.');
   if(!keys.length)throw Error('AI가 공종을 판단할 근거가 부족합니다. 직접 확인해주세요.');
   S.ai.set(id(d),{signature:sig,suggestionId:out.id,keys,primary:keys.includes(r.primary)?r.primary:keys[0],groups:[...new Set(keys.map(k=>k.split('>')[0]))],label:keys.map(k=>k.replace('>',' · ')).join(' + '),basis:String(r.basis||''),source:'Claude AI'});
  }catch(e){S.error=e.message||'AI 추천을 받지 못했습니다.';}finally{S.busy=false;repaint();refreshEditor();}
 }
 function aiInput(d){return {records:records(d).map(t=>t.slice(0,700)),instruction:'이 영업건의 기록만 사용. 다른 영업건의 공종을 추정 근거로 사용하지 말 것.'};}
 let aiLoadKey='';
 async function loadSuggestions(rows){
  if(!root.SB?.rpc||!root.ME)return;const actor=S.actor,loadKey=actor+JSON.stringify(rows.map(signature));if(aiLoadKey===loadKey)return;aiLoadKey=loadKey;
  try{const r=await root.SB.rpc('crm_ai_suggestion_list_v1',{p:{kind:'work_guess',subject_type:'deal',subject_ids:rows.map(id),limit:1000}});if(r.error||!r.data?.ok||actor!==S.actor)return;
   const byId=new Map(rows.map(d=>[id(d),d]));
   for(const saved of r.data.suggestions||[]){const d=byId.get(String(saved.subject_id));if(!d||S.ai.has(id(d))||saved.status==='rejected')continue;
    const bytes=new TextEncoder().encode('work_guess\n'+JSON.stringify(aiInput(d)));const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(saved.input_hash!==hash||actor!==S.actor)continue;const r=saved.suggestion||{},keys=(r.keys||[]).filter(k=>root.knownWorkKey(k)&&k!=='기타>기타');if(!keys.length)continue;
    S.ai.set(id(d),{signature:signature(d),suggestionId:saved.id,keys,primary:keys.includes(r.primary)?r.primary:keys[0],groups:[...new Set(keys.map(k=>k.split('>')[0]))],label:keys.map(k=>k.replace('>',' · ')).join(' + '),basis:String(r.basis||''),source:'Claude AI'});
   }if(root.G.page==='work'&&!S.edit)repaint();
  }catch(_){/* A failed suggestion read leaves the record unclassified, never fabricated. */}
 }
 async function merge(d,target){
  if(S.busy)return;S.busy=true;S.error='';refreshEditor();
  try{if(!root.SB?.rpc)throw Error('합치기 저장소에 연결되지 않았습니다. 원본은 유지됩니다.');
   if(!S.request){const source=await fresh(d),targetFresh=await fresh(target);
    if(source.version!==S.version){S.version=source.version;throw Error('이 건의 기록이 바뀌었습니다. 확인 후 다시 합쳐주세요.');}
    S.request={id:crypto.randomUUID(),payload:{source_id:id(d),target_id:id(target),source_version:source.version,target_version:targetFresh.version,work_items:draftKeys(),primary_work:S.primary==='기타>기타'?'기타>'+S.other.trim():S.primary||draftKeys()[0]}};}
   if(S.request.payload.target_id!==id(target))throw Error('이전 합치기 결과를 먼저 확인해주세요.');const payload=S.request.payload;
   const r=await root.SB.rpc('crm_gongjong_merge_v1',{p:{...payload,request_id:S.request.id}});if(r.error)throw Error(/PGRST202|function.*not.*exist/i.test(r.error.code+' '+r.error.message)?'견적 버전 합치기 저장 기능이 아직 설치되지 않았습니다. 원본은 유지됩니다.':r.error.message);
   if(!r.data?.ok||r.data.source_id!==id(d)||r.data.target_id!==id(target)||r.data.request_id!==S.request.id||!r.data.quote_version_id)throw Error('합치기 완료를 확인하지 못했습니다. 원본을 숨기지 않았습니다.');
   S.links=S.links.filter(l=>l.source_id!==id(d)).concat(r.data);S.busy=false;close();repaint();
  }catch(e){S.error=e.message||'합치기에 실패했습니다.';}finally{S.busy=false;refreshEditor();}
 }
 function input(e){if(e.target.dataset.gjField==='other'){S.other=e.target.value;S.overlap=false;S.request=null;}}
 function change(e){if(e.target.dataset.gjField==='primary'){S.primary=e.target.value;S.overlap=false;S.request=null;}}
 function click(e){
  const b=e.target.closest('[data-gj]');if(!b||S.busy)return;const action=b.dataset.gj,k=b.dataset.value,d=lookup(k),editing=lookup(S.detail||S.edit);if(S.writePending&&action!=='save')return;
  if(action==='tab'){S.tab=k;S.edit=null;S.error='';repaint();}
  if(action==='detail'&&d){start(d,true);document.querySelector('#gongjongDialog [data-gj="close"]')?.focus();}
  if(action==='edit'&&d){if(S.edit===key(d)){S.edit=null;repaint();}else start(d);}
  if(action==='accept'&&d){start(d,false,true);save(d);}
  if(action==='use'&&d){useGuess(d);refreshEditor();}
  if(action==='confirm-ai'&&d){useGuess(d);save(d);}
  if(action==='choice'){const i=S.draft.indexOf(k);if(i<0)S.draft.push(k);else S.draft.splice(i,1);if(!S.draft.includes(S.primary))S.primary=S.draft[0]||'';S.overlap=false;S.request=null;refreshEditor();}
  if(action==='save'&&d)save(d);
  if(action==='keep'&&d)save(d,true);
  if(action==='merge'&&editing&&d)merge(editing,d);
  if(action==='ai'&&d)ai(d);
  if(action==='cancel'){S.edit=null;repaint();}
  if(action==='close')close();
  if(action==='pipeline'&&d){close();root.openDealAt(all().indexOf(d));}
 }
 async function loadLinks(){
  if(S.loading||S.loaded||!root.SB?.rpc||!root.ME)return;S.loading=true;
  try{const r=await root.SB.rpc('crm_gongjong_links_v1',{p:{}});if(r.error){if(r.error.code==='PGRST202'){S.loaded=true;return;}throw Error('합치기 이력을 확인하지 못했습니다. 금액 집계는 잠시 보류합니다.');}if(!r.data?.ok||!Array.isArray(r.data.links))throw Error('합치기 이력 응답을 확인하지 못했습니다.');S.links=r.data.links;S.loaded=true;S.linkError='';}
  catch(e){S.loaded=true;S.linkError=e.message;}finally{S.loading=false;if(root.G.page==='work')repaint();}
 }
 function repaint(){if(root.G.page==='work')root.paintWorkAnalysis();}
 function boot(){
  const previous=root.paintWorkAnalysis,open=root.openWorkEdit,closeNew=root.closeNewDeal;
  root.openWorkEdit=function(){if(opening&&String(root.Phase11?.current?.id)===opening||S.busy&&String(root.Phase11?.current?.id)===String(lookup(S.edit||S.detail)?.id))return;return open.apply(this,arguments);};
  root.closeNewDeal=function(){if(S.busy&&(S.edit||S.detail))return;return closeNew.apply(this,arguments);};
  root.paintWorkAnalysis=function(){
   if(!root.WorkV2.enabled())return previous.apply(this,arguments);const host=document.getElementById('work-analysis');if(!host)return;
   const actor=String(root.ME?.id||'');if(S.actor!==actor){S.actor=actor;S.ai.clear();S.links=[];S.loaded=false;S.linkError='';}
   // Preserve in-progress input when background data refreshes; save checks latest server version.
   if(S.edit&&host.querySelector('.gj-editor'))return;
   const m=model();host.innerHTML='<div id="work-v2" class="gj-workspace">'+intro(m)+(S.linkError?'<p class="gj-error" role="alert">'+h(S.linkError)+'</p>':'')+'<div class="gj-layout">'+(!S.linkError?diagnosis(m):'')+list(m)+'</div></div>';
   if(S.busy)host.querySelectorAll('[data-gj],.gj-editor input,.gj-editor select').forEach(x=>x.disabled=true);
   if(!host.__gj){host.__gj=true;host.addEventListener('click',click);host.addEventListener('input',input);host.addEventListener('change',change);}
   loadLinks();loadSuggestions(m.rows.filter(d=>!classified(d)));
  };
  // Internal redraw is allowed to replace our own editor, background paint isn't.
  const paint=repaint;repaint=function(){const host=document.getElementById('work-analysis');host?.querySelector('.gj-editor')?.remove();paint();};
  root.addEventListener('phase1:identity-cleared',()=>{S.busy=false;S.writePending=null;close();S.ai.clear();S.links=[];S.loaded=false;});
 }
 root.Gongjong={model,groups,siteKey,records,prediction,matching};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
