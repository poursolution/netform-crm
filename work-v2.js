/* 공종 분석 v2 (2026-10-01 디자인 핸드오프 'design_handoff_work') — 공종 분석 메뉴만.
   지금은 미분류가 대부분이라 "분류를 빨리 끝내게 하는 화면"이 먼저다. 분류가 쌓이면 같은 자리가 실제 분석으로 채워진다.
   목록: 안내 줄(분류 필요 · 단일 · 복합 알약) → 진단(숫자 4 · 카드 3 · 과제) → 묶음 표(분류 필요 금액 큰 순 → 단일 → 복합)
   분류 = 기존 공종 분류·수정 창(openWorkEdit → Phase11.save, 서버 최신 버전 확인). 저장되면 다음 미분류 건(금액 큰 순)을 이어서 연다.
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
 function guess(d){
  const texts=[d.site,d.work,d.work_name,d.list_name].concat((d.legacy_notes||[]).slice(0,3).map(n=>n.body),(d.activities||[]).slice(0,5).map(a=>a.note)).filter(Boolean).map(String).join(' ');
  const hits=[];HINTS.forEach(([g,re])=>{const m=re.exec(texts);if(m)hits.push([g,m[0]]);});
  return hits.length?{label:hits.map(x=>x[0]).join(' + '),groups:hits.map(x=>x[0]),basis:hits.map(x=>'«'+x[1]+'»').join(' · ')}:null;
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
  else{basis='키워드 추정 기준 · 분류 전';m.rows.filter(r=>root.isOpen(r.d)).forEach(r=>{const k=r.scope==='unclassified'?(r.guess?r.guess.groups[0]:'근거 부족'):root.workAnalysisGroup(root.workAnalysisPrimary(r.d));byGroup.set(k,(byGroup.get(k)||0)+amt(r.d));});}
  const money=[...byGroup].filter(x=>x[1]>0).sort((a,b)=>(a[0]==='근거 부족')-(b[0]==='근거 부족')||b[1]-a[1]).slice(0,5).map(([k,v])=>[k,Math.round(v/1e7)/10,'']);
  const wonAmtList=won.filter(d=>root.hasWonAmt(d)&&root.wonAmt(d)>0),avg=l=>l.length?Math.round(l.reduce((a,d)=>a+root.wonAmt(d),0)/l.length/1e4).toLocaleString('ko-KR')+'만':'–';
  const per=new Map();wonAmtList.forEach(d=>{const k=root.workAnalysisGroup(root.workAnalysisPrimary(d));(per.get(k)||per.set(k,[]).get(k)).push(d);});
  const avgRows=[['전체 평균',avg(wonAmtList),wonAmtList.length+'건 · 금액 입력 건만']].concat([...per].filter(x=>x[0]!=='확인 필요').sort((a,b)=>b[1].length-a[1].length).slice(0,3).map(([k,l])=>[k,avg(l),l.length+'건']));
  const tasks=[[un.length,'미분류 '+un.length+'건'+(unAmt?' · '+root.fmtAmt(unAmt):''),'금액 큰 20건부터 이번 주 분류 (추정 확인만)','관리팀 · 이번 주','공종 미분류'],[un.length,'신규 건 공종 누락','영업기회 저장 시 대표 공종을 함께 고르기','영업팀','신규 공종 누락'],[m.rows.some(r=>r.scope==='multi')?0:classified,'복합 공종 0건','공종이 2개 이상이면 함께 하는 공종까지 선택','영업팀','복합 공종'],[wonNoWork,'수주 '+wonNoWork+'건 공종 연결 안 됨','계약 체결 시 공종 · 금액 함께 확정','계약 · 시공 단계','매출 공종 연결']].filter(t=>t[0]>0).map(t=>({basis:t[1],todo:t[2],who:t[3],label:t[4],count:t[0]}));
  return D.render({accent:'blue',
   kpis:[K('영업기회',n+'건','선택 기간 신규 등록'),K('진행 중 금액',pipe?root.fmtAmt(pipe):'0원',data.open.length+'건 진행 중'),K('매출',wonNoWork||!won.length?(won.length?'확인 필요':'–'):root.fmtAmt(wonSum),won.length?(wonNoWork?'계약 체결일 기준 · '+wonNoWork+'건 공종 연결 안 됨':'계약 체결일 기준 · '+won.length+'건'):'선택 기간 수주 없음',wonNoWork?'warn':''),K('공종 미분류',un.length+'건',n?(100-rate)+'%'+(rate<70?' · 분석 불가':''):'대상 없음',un.length?'bad':'')],
   cards:[{title:'무엇이 비었나',desc:'분석을 막는 것',bars:[['공종 미분류',un.length,eok(unAmt)],['계약금액 미입력',wonNoAmt,''],['수주 공종 미연결',wonNoWork,'']].filter(x=>x[1]>0),empty:'비어 있는 항목이 없습니다'},{title:'어디에 돈이 쌓였나',desc:'공종별 Pipeline · 단위 억 · '+basis,bars:money,empty:'진행 금액이 없습니다'},{title:'얼마짜리인가',desc:'수주 1건당 평균',rows:avgRows.map(r=>[r[0],r[1],r[2]])}],
   action:{title:'그래서 뭘 해야 하나',desc:'공종 분석에서 나온 과제',tasks}},{open:root.G.plvDiagShut!==true,scope:'work'});
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
  const groups=GROUPS.filter(g=>m.f==='all'||g[0]===m.f).map(([id,title,color,desc])=>{const list=m.rows.filter(r=>r.scope===id).sort((a,b)=>amt(b.d)-amt(a.d)),shown=list.slice(0,20+(more[id]||0)),rest=list.length-shown.length;return '<div class="plv-ghead" data-plv-group="'+id+'"><i style="background:'+color+'"></i><b>'+h(title)+'</b><span>'+list.length+'건</span><small>· '+h(desc)+'</small></div>'+(shown.length?shown.map(rowHtml).join(''):'<div class="plv-empty">해당하는 건이 없습니다</div>')+(rest>0?'<button type="button" class="plv-more" data-wv="more" data-value="'+id+'">+ '+rest+'건 더보기</button>':'');}).join('');
  return '<div id="work-v2" class="plv" data-workspace="work">'+intro+diagnosis(m)+'<div class="plv-table" role="table" aria-label="공종 분류 목록">'+head+groups+'</div></div>';
 }
 /* ── 분류: 기존 공종 분류·수정 창 + 추정 안내 + 저장되면 다음 건 ── */
 let chain=null;
 function hint(d){
  let tries=0;const g=guess(d),tick=()=>{const picker=document.getElementById('nd-work-picker');if(!picker){if(++tries<40)setTimeout(tick,80);return;}if(document.getElementById('wv-hint'))return;
   const box=document.createElement('div');box.id='wv-hint';box.className='wv-hint';box.innerHTML=g?'<b>추정 공종 · '+h(g.label)+'</b><span>근거: 현장명 · 공사명 · 메모에서 찾은 단어 '+h(g.basis)+'</span><small>키워드로 찾은 추정입니다. 맞으면 아래에서 고르고 [공종 저장]을 누르세요 — 저장하면 다음 미분류 건이 이어서 열립니다.</small>':'<b>추정 공종 · 근거 부족</b><small>현장명 · 공사명 · 메모에서 공종을 가리키는 단어를 찾지 못했습니다. 아래에서 직접 골라 주세요.</small>';
   picker.before(box);};
  tick();
 }
 function classify(key){
  const d=(root.B.deals||[]).find(x=>root.dealKey(x)===key);if(!d)return;
  chain=root.workScopeOf(d)==='unclassified'?key:null;
  root.CUR_DETAIL={kind:'deal',key,item:d};root.openWorkEdit();hint(d);
 }
 function next(){
  if(!chain)return;const prev=(root.B.deals||[]).find(x=>root.dealKey(x)===chain);
  if(!prev||root.workScopeOf(prev)==='unclassified')return;/* 아직 저장 전 */
  chain=null;if(document.getElementById('newDealModal')?.classList.contains('on'))return;
  const rest=root.workAnalysisData().flow.filter(d=>root.workScopeOf(d)==='unclassified').sort((a,b)=>amt(b)-amt(a));
  if(!rest.length){toast('분류할 건이 더 없습니다 — 모두 분류했습니다');return;}
  toast('저장했습니다 · 다음 미분류 건을 엽니다 (남은 '+rest.length+'건)');setTimeout(()=>classify(root.dealKey(rest[0])),150);
 }
 function onClick(e){
  const pd=e.target.closest('[data-pd="toggle"]');if(pd&&pd.closest('#work-v2')){root.G.plvDiagShut=root.G.plvDiagShut!==true;root.paintWorkAnalysis();return;}
  const b=e.target.closest('#work-v2 [data-wv]');if(!b)return;const a=b.dataset.wv,v=b.dataset.value;
  if(a==='scope'){root.G.workScope=v;root.G.wvMore={};root.paintWorkAnalysis();}
  if(a==='more'){const m=root.G.wvMore||(root.G.wvMore={});m[v]=(m[v]||0)+40;root.paintWorkAnalysis();}
  if(a==='classify')classify(v);
 }
 function boot(){
  const base=root.paintWorkAnalysis;if(typeof base!=='function')return;
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
