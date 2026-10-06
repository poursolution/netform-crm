/* 파이프라인 단계 화면 v3 — 전 단계 공통 틀 (2026-10-05 디자인 핸드오프 'design_handoff_pipeline_v3' · 파이프라인 단계 v3.dc.html)
   컨설팅 설계 · 자료 발송완료 · 관계관리 · 경쟁·입찰 · 계약·시공 5개 단계를 화면 하나로 그린다 — 단계마다 다른 것은 아래 설정값(cfg)뿐.
   위 → 아래: (공통 필터줄 = 기존 그대로) → 단계 제목 + 설명 → 상태 탭 4칸([전체] + 상태 3개 · 첫 상태 = 빨강) →
              왼쪽 단계 진단(기준 넘김 · 평균 체류 / 왜 멈춰 있나 4개 / 그래서 뭘 해야 하나) · 오른쪽 확인할 현장(리스트 | 보드).
   숫자는 전부 자료에서: 줄 = 기존 행(PipelineStageB.model → PipelineListV2.build), 상태 = 단계 필드 · 다음 할 일 · 발송일 · 입찰 일정 · 계약 원장.
     · 탭 3개는 서로 겹치지 않고 빠지는 줄이 없다 → 탭 합 = 전체 = 이 단계 건수(사이드바 · 브랜드 칩 '전체').
     · '왜 멈춰 있나' 첫 사유 = 빨강 상태 탭과 같은 건수. 기준 넘김 = 빨강 상태 건수.
   목록은 한 쪽 20건 + 쪽 번호(ListPager · 전체 지침). 열기 · 버튼은 기존 경로(PipelineStageB.open → 상세 + 액션).
   수주 · 실주 · 상세 창 · 공통 틀은 그대로. 끄기: G.pipeStageV3Off=true → 이전 단계 화면(B안 · 관계관리 세분화). */
(function(root){
 'use strict';
 const B=root.PipelineStageB,L2=root.PipelineListV2;if(!B||!L2)return;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const KEYS=['consulting','sent','relationship','competition','construction'];
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const RED='#b42318';
 const enabled=key=>!root.G.pipeStageV3Off&&KEYS.includes(key||root.G.pipelineStage)&&B.enabled(key||root.G.pipelineStage);
 const st=()=>root.G.ps3||(root.G.ps3={key:'',tab:-1,reason:null,view:'list'});
 const days=v=>{if(!v)return null;const n=root.daysTo(String(v).slice(0,10));return Number.isFinite(n)?n:null;};
 const ymd=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||'').slice(0,10));return m?Number(m[2])+'/'+Number(m[3]):'';};
 const money=v=>{const n=Number(v)||0;if(!n)return '금액 미정';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const ctxOf=d=>{let p={};try{p=root.itemPatch(d,'deal')||{};}catch(e){}return d.stage_contexts||p.stage_contexts||{};};
 const ctxVals=(cx,k)=>Object.keys(cx).map(c=>cx[c]&&cx[c].fields&&cx[c].fields[k]).filter(v=>v!=null&&v!=='');
 const lastDays=r=>{let a=null;try{a=root.activityAge(r.item);}catch(e){}const c=r.contactDays;if(a===null||a===undefined)return c==null?null:c;return c==null?a:Math.min(a,c);};
 /* 결정권자를 아는가: 상세의 '누가 결정하나'(decision_maker) — '모름'은 모르는 것 */
 const deciderKnown=it=>{const d=it.row.item;return ctxVals(ctxOf(d),'decision_maker').concat([d.decision_maker]).map(x=>String(x||'').trim()).some(x=>x&&x!=='모름');};
 /* 공사 예정 연도: 공사 연도 칸 → 상세의 공사 예정 → 옮겨 온 값 */
 const yearOf=it=>{const d=it.row.item;let y='';try{y=root.ConstructionYear.valueOf(d).year||'';}catch(e){}if(y)return String(y);const m=/(20\d{2})/.exec(ctxVals(ctxOf(d),'construction_plan').concat([d.planned_construction_date,d.construction_planned_at,d.construction_year,d.constructionYear]).map(x=>String(x||'')).join(' '));return m?m[1]:'';};
 const finOk=it=>{const c=(ctxOf(it.row.item).completion||{}).fields||{},k=Array.isArray(c.completion_checks)?c.completion_checks:[];return ['공사 완료','준공검사 완료'].every(x=>k.includes(x));};
 const goalOf=(key,d)=>{const g=(root.OPS_RULES||{}).pipeStageGoalDays;return Number(g&&g[key])||d;};
 /* ── 단계 설정값(README 표 + 시안의 ST): tabs [이름, 기준 한 줄] 첫 칸 = 빨강 · reasons [키, 이름] 첫 사유 = 빨강 상태 · act [버튼, 상세 액션] · tab(it) = 0 · 1 · 2 ── */
 function cfg(key){
  const Q=B.rules(),mo=Math.max(1,Math.round(Q.wait/30)),D7=Number((root.OPS_RULES||{}).bidPrepDays)||7;
  const nonext=it=>!(it.row.next&&it.row.next.text&&it.row.due),long=it=>it.stall>Q.stay;
  if(key==='consulting')return {name:'컨설팅 설계',goal:goalOf(key,14),desc:'1차 현장미팅으로 고객 요구를 확인하고 견적을 준비하는 단계 · 견적 처리 목표 '+Q.quote+'일 / 최대 5일',
   tabs:[['미팅 전 · 일정 없음','첫 통화에서 미팅 날짜 잡기'],['미팅 예정','미팅 전날 확인 연락'],['미팅 완료 · 견적 준비',Q.quote+'일 안 견적 요청']],
   reasons:[['nodate','미팅 일정 없음'],['req','필수 확인 미입력'],['nonext','다음 행동 · 날짜 없음'],['long',Q.stay+'일 넘게 머묾']],
   act:[['미팅 잡기','next'],['확인 연락','activity'],['견적 요청','stagefields']],
   todo:'미팅 전 현장은 첫 통화에서 1차 미팅 날짜까지 잡고, 미팅 후 '+Q.quote+'일 안에 견적 요청을 등록하세요.',
   tab:it=>it.bucket==='plan'?1:it.bucket==='done'?2:0,
   has:{nodate:(it,t)=>t===0,req:it=>it.rs.includes('req'),nonext,long},sub:it=>it.sub};
  if(key==='sent')return {name:'자료 발송완료',goal:goalOf(key,14),desc:'견적 · 제안 자료를 보낸 뒤 고객 반응을 확인하는 단계 · 발송 후 '+Q.follow+'일 안 후속',
   tabs:[[Q.follow+'일 넘음 · 후속 없음','오늘 후속 연락'],['발송 후 '+Q.follow+'일 안','D+3 수신 확인'],['고객 반응 있음','다음 단계 판단']],
   reasons:[['nofollow','발송 후 '+Q.follow+'일 · 후속 없음'],['nodecider','결정권자 미확인'],['nonext','다음 행동 · 날짜 없음'],['long',Q.stay+'일 넘게 머묾']],
   act:[['후속 연락','activity'],['수신 확인','activity'],['단계 판단','stage']],
   todo:'보낸 지 '+Q.follow+'일 넘은 건은 오늘 반응을 확인하고, 결정권자 일정을 함께 물어보세요.',
   tab:it=>it.bucket==='late'?0:it.bucket==='done'?2:1,
   has:{nofollow:(it,t)=>t===0,nodecider:it=>!deciderKnown(it),nonext,long},sub:it=>it.sub};
  if(key==='relationship')return {name:'관계관리',goal:goalOf(key,60),desc:'공사 시기가 남은 고객과 관계를 이어가는 단계 · '+mo+'개월 1회 연락',
   tabs:[['다음 연락일 지남','오늘 연락'],['이번 주 연락','약속일 지키기'],['장기 대기',mo+'개월마다 안부']],
   reasons:[['over','다음 연락일 지남'],['nonext','다음 행동 없음'],['noyear','공사 예정 연도 없음'],['quiet',Q.wait+'일 무접촉']],
   act:[['연락','activity'],['연락','activity'],['안부 연락','activity']],
   todo:'다음 연락일이 지난 고객부터 오늘 연락하고, 공사 예정 연도를 꼭 받아 두세요.',
   /* 다음 연락일 = 다음 할 일 날짜: 지났으면 빨강 · 오늘부터 7일 안이면 이번 주 · 그 뒤거나 없으면 장기 대기 */
   tab:it=>{const d=it.row.due?days(it.row.due):null;return d!==null&&d<0?0:d!==null&&d<=6?1:2;},
   has:{over:(it,t)=>t===0,nonext,noyear:it=>!yearOf(it),quiet:it=>{const ld=lastDays(it.row);return ld===null?it.stall>Q.wait:ld>Q.wait;}},
   sub:(it,t)=>{const r=it.row,d=r.due?days(r.due):null,y=yearOf(it);
    if(t===0)return '다음 연락 '+ymd(r.due)+' → '+(-d)+'일 지남';
    if(t===1)return '약속 '+ymd(r.due)+(r.next&&r.next.text?' · '+r.next.text:'');
    return (y?y+' 공사 예정':'공사 예정 연도 없음')+(r.due?' · 다음 연락 '+ymd(r.due):' · 다음 연락일 없음');}};
  if(key==='competition')return {name:'경쟁 · 입찰',goal:goalOf(key,30),desc:'현설 · PT · 입찰을 준비하는 단계 · 마감 D-'+D7+'부터 준비',
   tabs:[['마감 D-'+D7+' 이내','제안서 · 가격 확정'],['진행 중','일정 확인'],['결과 대기','개찰 다음날 결과 등록']],
   reasons:[['noprop','제안서 미공유'],['nocomp','경쟁 공법 미확인'],['nodecider','결정권자 미확인'],['nores','결과 미등록']],
   act:[['제안 준비','stagefields'],['일정 확인','stagefields'],['결과 등록','stage']],
   todo:'마감 D-'+D7+' 이내 건은 제안서를 팀장과 공유하고, 개찰 다음날 결과를 등록하세요.',
   /* 결과 대기 = 제출했거나 마감 · 결정 일정이 지난 건 / 마감 D-7 이내 = 아직 내지 않았고 일정이 7일 안 / 나머지 = 진행 중(일정 미등록 포함) */
   tab:it=>{const f=it.row.fields||{},dd=days(it.row.date),sub=/제출|완료/.test(String(f.bid_plan||f.position||''));return (sub||(dd!==null&&dd<0))?2:(dd!==null&&dd<=D7)?0:1;},
   has:{noprop:(it,t)=>t===0,nocomp:it=>!it.values.competitor,nodecider:it=>!deciderKnown(it),nores:it=>it.rs.includes('nores')},sub:it=>it.sub};
  return {name:'계약 · 시공',goal:goalOf(key,14),desc:'계약 후 시공까지 · 계약일 · 금액 입력 필수',
   tabs:[['계약정보 누락','계약일 · 금액 입력'],['시공 중','정해진 주기로 확인'],['준공 확인','준공 · 하자 인계']],
   reasons:[['cinfo','계약일 · 금액 없음'],['handoff','인계서 미확인'],['site7','시공 중 연락 없음'],['nofin','준공 확인 없음']],
   act:[['정보 입력','stagefields'],['현장 확인','activity'],['준공 확인','stage']],
   todo:'계약정보가 빠진 건은 오늘 입력하세요. 실적 · 인센티브 계산에 바로 쓰입니다.',
   tab:it=>(!it.values.contractDate||!it.values.contractAmount)?0:(it.row.code==='completion'||it.values.completionDate)?2:1,
   has:{cinfo:(it,t)=>t===0,handoff:it=>it.rs.includes('handoff'),site7:it=>it.rs.includes('site7'),nofin:(it,t)=>t===2&&!finOk(it)},
   sub:(it,t)=>t===0?(!it.values.contractDate&&!it.values.contractAmount?'계약일 · 금액 미입력':!it.values.contractDate?'계약일 미입력':'계약금액 미입력'):it.sub};
 }
 /* 줄마다 상태(탭) · 걸린 사유를 붙인다. 정렬: 빨강 상태 → 다음 상태 → 체류 긴 순 */
 function model(key,list){
  const C=cfg(key),M=B.model(key,list);
  const items=M.items.map(it=>{let t=0;try{t=C.tab(it);}catch(e){t=2;}t=t===0||t===1||t===2?t:2;const rs=C.reasons.map(r=>r[0]).filter(k=>{try{return !!C.has[k](it,t);}catch(e){return false;}});let sub='';try{sub=C.sub(it,t)||'';}catch(e){}return {it,row:it.row,tab:t,rs,sub,stall:it.stall};});
  items.sort((a,b)=>a.tab-b.tab||b.stall-a.stall||String(a.row.key).localeCompare(String(b.row.key)));
  return {C,items};
 }
 const issueOf=(C,x)=>x.tab===0?C.reasons[0][1]:C.tabs[x.tab][1];
 const bcOf=r=>BRAND[r.item.brand]||'';
 /* 줄 · 카드에 항상 보이는 것(2026-10-05 정합성 ③ ④ — 마우스를 올려야 보이는 정보를 두지 않는다):
    다음 행동 · 기한 / 공종 · 사업연도 · 영업건 번호(같은 단지의 여러 건을 구분) / 같은 단지에 진행 건이 여럿이면 '같은 공사인지 확인' */
 const noOf=r=>'#'+String(r.item.id||r.key||'').replace(/[^0-9a-z]/gi,'').slice(-6);
 const workOf=r=>{let w='';try{w=root.dealWorkSummary(r.item)||'';}catch(e){}return !w||/미분류|미기록|미입력/.test(w)?'공종 미분류':w;};
 const bizYearOf=r=>{try{const y=String(root.constructionYearOf?root.constructionYearOf(r.item):'');return /^\d{4}$/.test(y)?y:'';}catch(e){return '';}};
 const mdOf=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const nextOf=r=>{const t=r.next&&r.next.text?String(r.next.text).trim():'',due=mdOf(r.due);return t?t+' · '+(due||'날짜 없음'):'없음';};
 const metaOf=r=>[workOf(r),bizYearOf(r),noOf(r)].filter(Boolean).join(' · ');
 /* 같은 단지의 진행 건 수(모든 단계 · 진행 범위 안에서) */
 let DUP=new Map();
 const siteKeyOf=r=>{const d=r.item,id=d.cleanup_site_id||d.site_id||d.siteId;if(id)return 'id:'+id;let k='';try{k=root.normSite?root.normSite(r.site):String(r.site||'');}catch(e){}return k&&k.length>=2?'n:'+k:'';};
 function dupMap(){const m=new Map();try{root.PipelineWorkspace.rows({unscoped:true}).forEach(r=>{if(['won','lost','expansion','legacy'].includes(r.group))return;const k=siteKeyOf(r);if(k)m.set(k,(m.get(k)||0)+1);});}catch(e){}return m;}
 const dupOf=r=>{const k=siteKeyOf(r),n=k?DUP.get(k)||0:0;return n>1?'같은 단지 진행 '+n+'건 · 같은 공사인지 확인':'';};
 function rowHtml(C,x){
  const r=x.row,bc=bcOf(r),a=C.act[x.tab];
  return '<div class="ps3-row" role="row" tabindex="0" data-ps3="open" data-key="'+attr(r.key)+'" data-tab="'+x.tab+'" style="border-left-color:'+(bc||'#e3e6ec')+'"><div class="ps3-l"><div class="ps3-a"><b title="'+attr(r.site)+'">'+h(r.site)+(root.advisoryBadge?root.advisoryBadge(r.item):'')+'</b><span><em style="color:'+(bc||'#9ca3af')+'">'+h(r.item.brand||'브랜드 미지정')+'</em> · '+h(r.owner||'미배정')+' · '+h(money(r.amount))+'</span><small class="ps3-meta">'+h(metaOf(r))+'</small>'+(dupOf(r)?'<small class="ps3-dup">'+h(dupOf(r))+'</small>':'')+'</div>'
   +'<div class="ps3-b"><b'+(x.tab===0?' class="r"':'')+'>'+h(issueOf(C,x))+'</b><span>'+h(x.sub)+'</span><small class="ps3-nx'+(r.next&&r.next.text?'':' none')+'"><i>다음 행동</i> '+h(nextOf(r))+'</small></div></div>'
   +'<div class="ps3-r"><div class="ps3-d"><b'+(x.stall>C.goal?' class="r"':'')+'>'+x.stall+'일</b><span>체류</span></div><button type="button" data-ps3="act" data-key="'+attr(r.key)+'" data-v="'+attr(a[1])+'">'+h(a[0])+'</button></div></div>';
 }
 /* 목록 줄 v11(2026-10-06 design_handoff_pipeline_v11): 4칸 줄 + 펼침 — 그리기는 pipeline-row-v11.js 한곳, 여기서는 그 단계의 상태 · 업무 · 버튼만 정한다 */
 const V11=()=>root.PipelineRowV11&&root.PipelineRowV11.on()?root.PipelineRowV11:null;
 function v11(key,C,x){
  const r=x.row,a=C.act[x.tab],st0=x.tab===0?C.reasons[0][1]:C.tabs[x.tab][0],sub=x.sub&&!String(st0).includes(x.sub)&&!String(x.sub).includes(st0)?x.sub:'';
  /* 버튼 = 업무 동사: 연락할 일이면 '연락 기록'(미팅 날짜만 남은 컨설팅 건은 '일정 등록'), 나머지는 그 단계의 일(견적 요청 · 정보 입력 · 단계 판단 …) */
  const contact=a[1]==='next'||a[1]==='activity',btn=contact?[key==='consulting'&&x.tab===0&&r.last?'일정 등록':'연락 기록',a[1]]:[a[0],a[1]];
  return {r,now:[st0,sub].filter(Boolean).join(' · '),task:C.tabs[x.tab][1],btn,stall:x.stall,goal:C.goal,reasons:x.rs.map(k=>(C.reasons.find(q=>q[0]===k)||[])[1]).filter(Boolean),dup:dupOf(r),tab:x.tab};
 }
 function cardHtml(C,x){
  const r=x.row,bc=bcOf(r),a=C.act[x.tab];
  return '<div class="ps3-card" role="button" tabindex="0" data-ps3="open" data-key="'+attr(r.key)+'" style="border-left-color:'+(bc||'#e3e6ec')+'"><div class="t"><b style="color:'+(bc||'#9ca3af')+'">'+h(r.item.brand||'브랜드 미지정')+'</b><i></i><span class="no">'+h(noOf(r))+'</span><b class="d'+(x.stall>C.goal?' r':'')+'">'+x.stall+'일</b></div><strong>'+h(r.site)+'</strong><span>'+h([workOf(r)+(bizYearOf(r)?' · '+bizYearOf(r):''),r.owner||'미배정',money(r.amount)].filter(Boolean).join(' · '))+'</span><span class="iss'+(x.tab===0?' r':'')+'">'+h((x.tab===0?'확인 필요 · ':'')+[issueOf(C,x),x.sub&&!String(issueOf(C,x)).includes(x.sub)?x.sub:''].filter(Boolean).join(' · '))+'</span><span class="nx'+(r.next&&r.next.text?'':' none')+'"><i>다음 행동</i> '+h(nextOf(r))+'</span>'+(dupOf(r)?'<span class="dup">'+h(dupOf(r))+'</span>':'')+'<button type="button" data-ps3="act" data-key="'+attr(r.key)+'" data-v="'+attr(a[1])+'">'+h(a[0])+'</button></div>';
 }
 function html(key,list){
  DUP=dupMap();
  const S=st(),{C,items}=model(key,list),LP=root.ListPager,total=items.length;
  const cnt=t=>items.filter(x=>x.tab===t).length,n=[cnt(0),cnt(1),cnt(2)];
  const rsN=k=>items.filter(x=>x.rs.includes(k)).length;
  if(S.reason&&!C.reasons.some(r=>r[0]===S.reason))S.reason=null;
  const listed=items.filter(x=>(S.tab===-1||x.tab===S.tab)&&(!S.reason||x.rs.includes(S.reason)));
  const sumAmt=items.reduce((s,x)=>s+(Number(x.row.amount)||0),0),avg=total?Math.round(items.reduce((s,x)=>s+x.stall,0)/total):0;
  /* 상태 탭 4칸: [전체] + 상태 3개 */
  const tab=(t,l,rule,num,hot)=>'<button type="button" class="ps3-tab'+(S.tab===t?' on':'')+'" data-ps3="tab" data-v="'+t+'" aria-pressed="'+(S.tab===t)+'"><b class="n'+(hot&&num?' r':'')+'">'+num.toLocaleString('ko-KR')+'</b><b class="l">'+h(l)+'</b><span>'+h(rule)+'</span></button>';
  const tabs='<div class="ps3-tabs" role="group" aria-label="상태">'+tab(-1,'전체','이 단계 모든 현장',total,false)+C.tabs.map((t,i)=>tab(i,t[0],t[1],n[i],i===0)).join('')+'</div>';
  /* 왼쪽: 단계 진단 */
  const diag='<aside class="ps3-diag"><section class="ps3-box"><header><b>단계 진단</b><span>'+total.toLocaleString('ko-KR')+'건 · '+h(money(sumAmt))+'</span></header>'
   +'<div class="ps3-kpis"><div class="over"><span>기준 넘김</span><b>'+n[0].toLocaleString('ko-KR')+'건</b><small>오늘 처리할 것</small></div><div><span>평균 체류</span><b>'+avg+'일</b><small>기준 '+C.goal+'일</small></div></div></section>'
   +'<section class="ps3-box ps3-why"><header><b>왜 멈춰 있나</b><span>누르면 목록이 걸러짐</span></header>'
   +C.reasons.map((r,i)=>{const c=rsN(r[0]),on=S.reason===r[0];return '<button type="button" class="ps3-reason'+(on?' on':'')+(i===0?' first':'')+'" data-ps3="reason" data-v="'+r[0]+'" aria-pressed="'+on+'"><span><b>'+h(r[1])+'</b><b class="c">'+c.toLocaleString('ko-KR')+'</b></span><i><u style="width:'+(total?Math.min(100,Math.round(c/total*100)):0)+'%"></u></i></button>';}).join('')+'</section>'
   +'<section class="ps3-box"><header><b>그래서 뭘 해야 하나</b></header><p class="ps3-todo">'+h(C.todo)+'</p></section></aside>';
  /* 오른쪽: 확인할 현장 */
  const fl=S.reason?(C.reasons.find(r=>r[0]===S.reason)||[])[1]:'';
  const head='<div class="ps3-lhead"><b>확인할 현장 <span>'+listed.length.toLocaleString('ko-KR')+'곳</span></b>'+(fl?'<button type="button" class="ps3-chip" data-ps3="clear" aria-label="'+attr(fl)+' 필터 해제">'+h(fl)+' ×</button>':'')+'<i></i><div class="ps3-views" role="group" aria-label="보기"><button type="button" data-ps3="view" data-v="list" aria-pressed="'+(S.view!=='board')+'">리스트</button><button type="button" data-ps3="view" data-v="board" aria-pressed="'+(S.view==='board')+'">보드</button></div></div>';
  let body;
  if(S.view==='board')body='<div class="ps3-board">'+C.tabs.map((t,i)=>{const all=items.filter(x=>x.tab===i&&(!S.reason||x.rs.includes(S.reason))),cp=LP.cut(all,LP.page(S,'col:'+i)),cards=cp.rows;
    return '<div class="ps3-col"><div class="ch"><b title="'+attr(t[0])+'">'+h(t[0])+'</b><b class="c'+(i===0?' r':'')+'">'+n[i].toLocaleString('ko-KR')+'</b></div>'+(cards.length?cards.map(x=>cardHtml(C,x)).join(''):'<p class="ps3-none">없음</p>')+LP.html(cp,{ns:'ps3',v:'col:'+i,small:true,info:false})+'</div>';}).join('')+'</div>';
  else{const V=V11(),pg=LP.cut(V?V.sort(listed,x=>x.row):listed,LP.page(S));
   body='<div class="ps3-list'+(V?' prv-list':'')+'" role="table" aria-label="확인할 현장">'+(V?V.head():'')+(pg.rows.length?pg.rows.map(x=>V?V.row(v11(key,C,x),'ps3','ps3-row'):rowHtml(C,x)).join(''):'<div class="ps3-empty">해당하는 현장이 없습니다</div>')+LP.html(pg,{ns:'ps3',unit:'곳'})+'</div>';}
  return '<div id="pipeline-stage-v3" class="ps3" data-stage="'+key+'"><div class="ps3-top"><div class="ps3-head"><b>'+h(C.name)+'</b><span>'+h(C.desc)+'</span></div>'+tabs+'</div><div class="ps3-body">'+diag+'<section class="ps3-main">'+head+body+'</section></div></div>';
 }
 function onClick(e){
  const b=e.target.closest('#pipeline-stage-v3 [data-ps3]');if(!b||b.disabled)return;const S=st(),a=b.dataset.ps3,v=b.dataset.v,LP=root.ListPager;
  if(a==='tab'){S.tab=Number(v);S.reason=null;LP.reset(S);return root.paint();}
  if(a==='reason'){S.reason=S.reason===v?null:v;LP.reset(S);return root.paint();}
  if(a==='clear'){S.reason=null;LP.reset(S);return root.paint();}
  if(a==='view'){S.view=v;return root.paint();}
  if(a==='page'){LP.set(S,v,b.dataset.page);return root.paint();}
  e.stopPropagation();
  if(a==='act')return B.open(b.dataset.key,v);
  if(a==='open'&&!e.target.closest('button'))return B.open(b.dataset.key);
 }
 /* 단계 목록 그리기를 감싼다(B안 · 관계관리 세분화보다 뒤): v3 가 켜진 단계면 v3 를 그리고 true */
 const prevPaint=L2.paint;
 L2.paint=function(el,key,list){
  if(!enabled(key)||!L2.enabled(key))return prevPaint.apply(this,arguments);
  const pg=document.getElementById('pg-pipe');pg?.classList.add('plv-on');pg?.classList.add('psb-on');
  const S=st();if(S.key!==key){S.key=key;S.tab=-1;S.reason=null;root.ListPager.reset(S);}
  el.classList.remove('pk-mode');el.innerHTML=html(key,list);
  if(!el.__ps3){el.__ps3=true;el.addEventListener('click',onClick,true);el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#pipeline-stage-v3 [data-ps3="open"]')){e.preventDefault();e.target.click();}});}
  const C=cfg(key);document.getElementById('ptitle').textContent=C.name.replace(' · ','·');const ps=document.getElementById('psub');if(ps)ps.textContent='위 상태 탭 → 왼쪽 단계 진단 · 오른쪽 확인할 현장';
  root.CommonFilterBar?.mount('pipe');const bar=pg?.querySelector(':scope>.cf-bar');if(bar)bar.hidden=false;
  return true;
 };
 root.PipelineStageV3={enabled,cfg,model,html,KEYS};
})(window);
