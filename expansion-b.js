/* 확장관리 — 파이프라인 B안 틀 (2026-10-03 대표: "확장관리 · 경남지사 · 고객자산 · 문자 전부 파이프라인 기준으로")
   왼쪽 진단(사후관리 막대 3칸 · 숫자 3개 · 왜 멈춰 있나 · 뭘 해야 하나) / 오른쪽 확인할 현장(리스트 · 보드) — StageBoard 공용 부품.
   근거는 2026-10-02 회의 지침: 준공은 끝이 아니라 사후관리 → 재영업. 준공 D+30 사후 연락(만족도 · 하자 · 내년 공사 · 추가 공종 · 주변 단지), 관계는 2개월 1회, 니즈는 메모가 아니라 새 영업건(견적 확인 후 전환).
   데이터 · 저장은 전부 기존(expansionRecords · ExpansionV2 상세창 · expansionOpenNew 전환). 기간은 OPS_RULES(afterCompletionDays 30 · waitContactDays 60) 설정값.
   끄기: G.expansionBOff=true → 확장관리 v2 묶음 표. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const F=()=>root.ExpansionFlow,SB=()=>root.StageBoard;
 const RED='#d93a3a',INK='#374151';
 /* 기준일은 회의 지침 기본값(준공 D+30 · 관계 연락 60일) — 화면에서 바꿀 수 있고 이 PC에 저장된다(팀 공통 설정 저장소가 생기면 그쪽으로) */
 const RKEY='nf_expansion_rules';
 (function(){try{const s=JSON.parse(root.Phase1?.storage?.getItem(RKEY)||'null');if(s&&typeof s==='object'){root.OPS_RULES=Object.assign(root.OPS_RULES||{},s);}}catch(e){}})();
 function setRule(k,v){const n=Number(v);if(!n)return;root.OPS_RULES=Object.assign(root.OPS_RULES||{},{[k]:n});try{const s=JSON.parse(root.Phase1?.storage?.getItem(RKEY)||'{}')||{};s[k]=n;root.Phase1.storage.setItem(RKEY,JSON.stringify(s));}catch(e){}}
 const R=()=>root.OPS_RULES||{};const N=(k,d)=>Number(R()[k])||d;const rules=()=>({after:N('afterCompletionDays',30),wait:N('waitContactDays',60)});
 const enabled=()=>!root.G.expansionBOff&&!root.G.expansionV2Off&&!!root.StageBoard&&!!root.ExpansionV2;
 const dealOf=r=>root.expansionSourceDeal(r)||{};
 const days=v=>{if(!v)return null;const n=root.daysTo(String(v).slice(0,10));return Number.isFinite(n)?n:null;};
 const since=v=>{const n=days(v);return n===null?null:-n;};
 const ymd=v=>{const s=String(v||'').slice(0,10),m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);return m?Number(m[2])+'/'+Number(m[3]):'';};
 const workOf=r=>{const s=r.sourceWorkSummary||'';if(s&&!/미분류|미기록/.test(s))return s;try{const w=root.dealWorkSummary(dealOf(r));return w&&!/미분류|미기록/.test(w)?w:'';}catch(e){return '';}};
 const unclassified=r=>!workOf(r);
 const CFG={id:'expansion-b',name:'확장관리',unit:'곳',stallUnit:'D+',stallName:'준공 후',stallDesc:'준공 뒤 지난 일수',listTitle:'확인할 현장',openLabel:'열기',diagTitle:'사후관리 진단',
  desc:()=>'준공 고객의 다음 매출 · 준공은 끝이 아니라 사후관리 → 재영업 — D+'+rules().after+' 사후 연락(만족도 · 하자 · 내년 공사 · 추가 공종 · 주변 단지) → 니즈 확인 → 견적 확인 후 새 영업건 전환 · 관계는 '+Math.round(rules().wait/30)+'개월 1회',
  axis:'사후관리 진행',
  S:[['after','사후 연락 · 관계 유지','#15171c','준공 후 사후 연락 · 주기마다 관계 연락'],['need','니즈 확인','#8a909c','견적 확인 후 새 영업건 전환'],['hold','보류 · 전환 완료','#d5d9e0','새 영업건에서 진행 · 보류는 연도 지정']],
  RS:{defect:['하자 먼저 · 미해결 불만',RED,'하자 확인','미해결 하자 · 불만이 있으면 재영업 연락보다 하자 처리 확인이 먼저 — 해결로 기록되면 자동 해제(decision_collab ④)','source'],
      late:['다음 접촉일 지남',RED,'연락','다음 접촉일이 지난 고객 — 오늘 통화 후 접촉 · 니즈 기록 + 다음 접촉일','note'],
      after30:['준공 후 사후 연락 안 함',RED,'사후 연락','만족도 · 하자 · 내년 공사 · 추가 공종 · 주변 단지 소개를 확인하는 사후 통화','note'],
      wait60:['관계 연락 주기 넘김',RED,'관계 연락','모든 수주 고객은 2개월 1회 관계 연락 · 입대의 · 관리소장 교체 여부 확인','note'],
      needwait:['니즈 확인 → 전환 대기',INK,'전환','확인한 니즈는 메모가 아니라 새 영업건 — 견적 발송 확인 후 전환','convert'],
      nocontact:['접촉 기록 없음',INK,'첫 접촉','하자 점검 통화 체크리스트(누수 · 균열 · 주차장)로 첫 접촉','note'],
      work:['공종 미분류',INK,'공종 기록','준공 공종을 기록해야 추천 타공종이 정확해짐','source'],
      amt:['계약금액 미입력',INK,'금액 확인','수주 금액을 확인해 기록(매출 집계)','source'],
      nonext:['다음 접촉일 미지정',INK,'날짜 지정','모든 고객에 다음 접촉일 등록','next']},
  kpi2:(inB,cnt)=>{const n=inB.filter(i=>i.extra.need).length;return ['니즈 확인',n+'곳',n?'견적 확인 후 전환할 고객':'아직 확인된 추가 공사 없음'];}
 };
 function scoped(){
  const current=new Date().getFullYear(),year=root.G.expansionYear||String(current),q=String(root.G.q||'').trim().toLowerCase(),f=F();
  const source=root.expansionRecords(),brandOk=r=>root.SalesFilterState.matchesBrand(dealOf(r).brand),searchOk=r=>!q||[r.site,r.owner,r.sourceWorkSummary,r.needNote,(r.candidates||[]).join(' ')].join(' ').toLowerCase().includes(q);
  const mine=source.filter(r=>brandOk(r)&&searchOk(r)&&root.SalesScope.matches(r.owner,dealOf(r))),inYear=(r,y)=>f.yearMatch(r,dealOf(r),y,current);
  return {current,year,mine,rows:mine.filter(r=>inYear(r,year)),inYear};
 }
 function item(r){
  const f=F(),q=rules(),d=dealOf(r),st=f.status(r),done=f.converted(r),hold=st==='보류',need=st==='니즈확인';
  const bucket=done||hold?'hold':need?'need':'after';
  const cd=since(r.completionDate),ld=since(r.lastContactAt),nd=days(r.nextContactAt);
  const sub=(r.completionDate?'준공 '+ymd(r.completionDate):'준공일 미기록')+(r.lastContactAt?' · 마지막 접촉 '+ymd(r.lastContactAt):' · 접촉 기록 없음')+(done?' · 전환 완료':hold?' · 보류':need?(r.needNote?' · 니즈 '+r.needNote:''):(r.nextContactAt?' · 다음 '+ymd(r.nextContactAt):''));
  const rs=[];let defect=false;try{const DC=root.DecisionCollab;defect=!!(DC&&DC.on()&&d&&d.id&&DC.openDefect(d));}catch(e){}
  if(bucket!=='hold'&&defect)rs.push('defect');/* 하자 먼저: 재영업 사유(접촉 · 사후 연락 · 관계 연락)는 뒤로 */
  if(bucket!=='hold'){
   if(nd!==null&&nd<0)rs.push('late');
   if(bucket==='after'&&cd!==null&&cd>=q.after&&!r.lastContactAt)rs.push('after30');
   if(ld!==null&&ld>=q.wait)rs.push('wait60');
   if(need)rs.push('needwait');
   if(!r.lastContactAt&&!rs.includes('after30'))rs.push('nocontact');
   if(unclassified(r))rs.push('work');
   /* 계약금액 등 실적 · 계약 정보는 확장관리에서 고치지 않는다(2026-10-06 followup4 ② → 수주 화면) */
   if(!r.nextContactAt)rs.push('nonext');
  }
  const reasonText={after30:'사후 연락 없음 · 기준 D+'+q.after+' 넘김',wait60:'연락 없음 '+(ld===null?'':ld+'일')+' · 기준 '+q.wait+'일',late:nd!==null&&nd<0?'다음 접촉일 '+Math.abs(nd)+'일 지남':''};
  return {key:r.id,site:r.site||'현장명 확인 필요',brand:d.brand||'',owner:r.owner||'미배정',amount:r.wonAmount,amountText:r.wonAmount==null?'계약금액 미입력':undefined,bucket,sub,rs,reasonText,stall:cd===null?0:Math.max(0,cd),extra:{need,r}};
 }
 function topHtml(s){
  const years=['전체',String(s.current),String(s.current-1),String(s.current-2),'이전'];
  const q=rules(),opt=(cur,list)=>list.map(n=>'<option value="'+n+'"'+(n===cur?' selected':'')+'>'+n+'일</option>').join('');
  if(root.G.expansionYearRowOff)return '<div class="plv-intro xb-years"><i style="background:#64748b"></i><b>준공연도</b><span>'+s.rows.length+'곳</span><label class="sb-rule">사후 연락 기준 준공 후 <select data-xb-rule="afterCompletionDays" aria-label="사후 연락 기준">'+opt(q.after,[...new Set([14,30,60,90,q.after])].sort((a,b)=>a-b))+'</select></label><label class="sb-rule">관계 연락 주기 <select data-xb-rule="waitContactDays" aria-label="관계 연락 주기">'+opt(q.wait,[...new Set([30,60,90,180,q.wait])].sort((a,b)=>a-b))+'</select></label><div class="plv-spacer"></div><div class="plv-pills" role="group" aria-label="준공연도">'+years.map(y=>'<button type="button" data-xb="year" data-value="'+attr(y)+'" aria-pressed="'+(String(s.year)===y)+'">'+h(y)+' <b>'+s.mine.filter(r=>s.inYear(r,y)).length+'</b></button>').join('')+'</div></div>';
  return '<div class="xb-yrow"><span class="xb-yl"><i></i><b>준공연도</b></span><div class="xb-ypills" role="group" aria-label="준공연도">'+years.map(y=>{const n=s.mine.filter(r=>s.inYear(r,y)).length,on=String(s.year)===y;return '<button type="button" data-xb="year" data-value="'+attr(y)+'" aria-pressed="'+on+'"'+(n||on?'':' class="zero"')+'>'+h(y)+' <span>'+n+'</span></button>';}).join('')+'</div><i class="xb-ydiv"></i>'
   +'<label class="xb-rule">사후 연락 기준 준공 후 <select data-xb-rule="afterCompletionDays" aria-label="사후 연락 기준">'+opt(q.after,[...new Set([14,30,60,90,q.after])].sort((a,b)=>a-b))+'</select></label><label class="xb-rule">관계 연락 주기 <select data-xb-rule="waitContactDays" aria-label="관계 연락 주기">'+opt(q.wait,[...new Set([30,60,90,180,q.wait])].sort((a,b)=>a-b))+'</select></label></div>';
 }
 function rowHtml(C,it,reason){
  const B=SB(),k=reason||it.first,rs=k?C.RS[k]:null,bc=B.BRAND[it.brand]||'#9ca3af',S=C.S.find(x=>x[0]===it.bucket)||C.S[0],why=rs?(it.reasonText&&it.reasonText[k]||rs[0]):'정상';
  return '<div class="psb-row xb-row" role="row" tabindex="0" data-sb="open" data-key="'+attr(it.key)+'" style="border-left-color:'+bc+'"><div class="xb-l"><div class="xb-a"><b title="'+attr(it.site)+'">'+h(it.site)+'</b><span><em style="color:'+bc+'">'+h(it.brand||'브랜드 미지정')+'</em> · '+h(it.owner||'미배정')+' · '+h(it.amountText||B.money(it.amount))+'</span></div>'
   +'<div class="xb-b"><b>'+h(S[1].split(' · ')[0])+'</b><span title="'+attr(it.sub)+'">'+h(it.sub)+'</span></div></div>'
   +'<div class="xb-r"><span class="xb-why'+(rs&&rs[1]===RED?' red':'')+'" title="'+attr(why)+'">'+h(why)+'</span><b class="xb-d">'+h(B.dayLabel(C,it.stall))+'</b><button type="button" data-sb="act" data-key="'+attr(it.key)+'" data-v="'+attr(k||'')+'">'+h(rs?rs[2]:(C.openLabel||'열기'))+'</button></div></div>';
 }
 /* 같은 단지 계약 여러 건 = 연락은 한 번(contact_link ③): 단지 묶음 열쇠 · 머리 줄 · 대상 나누기 */
 const siteKeyOf=it=>{const r=it.extra&&it.extra.r,d=r?dealOf(r):{};return String((d&&d.site_id)||(r&&r.siteId)||'')||String(it.site||'').replace(/\s+/g,' ').trim();};
 let GRP=new Map();
 function groupHead(C,it,rows,n){
  const k=siteKeyOf(it),g=GRP.get(k);if(!g||g.items.length<2)return '';if(n>0&&siteKeyOf(rows[n-1])===k)return '';
  const B=SB(),last=g.items.map(x=>x.extra.r.lastContactAt||'').filter(Boolean).sort().pop()||'',comp=g.items.map(x=>x.extra.r.completionDate||'').filter(Boolean).sort().pop()||'',owner=g.items.map(x=>x.owner).find(o=>o&&o!=='미배정')||'미배정';
  const st=last?'최근 '+ymd(last):'기록 보완 필요';
  return '<div class="psb-row xb-site" role="row" data-site="'+attr(k)+'"><div class="prv-a"><b title="'+attr(it.site)+'">'+h(it.site)+'</b><span>계약 '+g.items.length+'건'+(comp?' · '+String(comp).slice(0,7).replace('-','.')+' 준공':'')+' · '+h(owner)+'</span></div><div class="prv-b"><span>사후 연락 · <b>'+h(st)+'</b></span></div><div class="prv-c"><span>기록은 단지 단위로 모든 계약에 연결</span></div><button type="button" data-sb="act" data-key="'+attr(it.key)+'" data-v="sitenote">단지 한 번 연락 기록</button></div>';
 }
 function groupItems(items){
  GRP=new Map();const order=new Map();
  items.forEach((it,n)=>{const k=siteKeyOf(it);if(!GRP.has(k)){GRP.set(k,{items:[]});order.set(k,n);}GRP.get(k).items.push(it);});
  return items.slice().sort((a,b)=>order.get(siteKeyOf(a))-order.get(siteKeyOf(b)));/* 같은 단지는 나란히 · 단지 순서는 원래 순서 */
 }
 function open(key,act){
  const r=root.expansionRecords().find(x=>x.id===String(key)||x.sourceOpportunityId===String(key));if(!r)return;
  if(act==='sitenote'){const it=[...GRP.values()].find(g=>g.items.some(x=>x.key===r.id)),ids=it?it.items.map(x=>x.extra.r.id):[r.id];root.G.xbSiteNote={site:r.site,ids};root.ExpansionV2.open(r.id);setTimeout(()=>{document.querySelector('#expansionV2 .idv-input textarea')?.focus();if(typeof root.toast==='function')root.toast('저장하면 같은 단지 계약 '+ids.length+'건에 연결됩니다 · 기록은 한 번');},120);return;}
  if(act==='convert'){if(F().converted(r)){root.ExpansionPool.openPipeline(r.id);return;}root.expansionOpenNew(r.id);return;}
  if(act==='source'){const d=dealOf(r);if(d.id){root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));return;}}
  root.ExpansionV2.open(r.id);
  setTimeout(()=>{const m=document.getElementById('expansionV2');if(!m)return;if(act==='next'){const i=m.querySelector('[data-xd="next"]');if(i){i.focus();try{i.showPicker&&i.showPicker();}catch(e){}}}else if(act==='note'){m.querySelector('.idv-input textarea')?.focus();}},80);
 }
 function paint(host,base,args){
  const pg=document.getElementById('pg-expansion');
  /* 상세창 갱신 · 제목 · 필터줄은 기존 v2 그대로(보이지 않는 칸에 그리게 하고 목록만 바꾼다) */
  const dummy=document.createElement('div');base.apply(root.ExpansionV2,[dummy].concat(args.slice(1)));
  pg?.classList.add('xv-on','xb-on');
  const s=scoped(),S=SB().state('expansion'),items=groupItems(s.rows.map(item));
  CFG.topHtml=topHtml(s);CFG.groupHead=root.G.boardV3Off?null:groupHead;
  /* 대상 수 나누기(contact_link ③): 사후 연락 대상 vs 기록 보완 필요(공종 · 연락 기록 없음 — 미실행으로 세지 않음) */
  {const live=items.filter(i=>i.bucket!=='hold'),fix=live.filter(i=>i.rs.includes('work')||i.rs.includes('nocontact')||i.rs.includes('after30')),tgt=live.length-fix.length;
   CFG.sideHtml='<div class="psb-box xb-split"><header><b>대상 나누기</b><span>'+h(String(s.year)==='전체'?'전체':s.year)+' 대상 '+live.length+'곳</span></header><div class="psb-act"><span>사후 연락 대상 '+tgt+'</span><p>준공 · 연락 기준 확인됨</p></div><div class="psb-act"><span>기록 보완 필요 '+fix.length+'</span><p>공종 · 연락 기록 없음 · 미실행으로 세지 않음</p></div></div>';}
  /* 연도를 고르면 제목 옆에 "2025년 준공만" · 목록 줄은 두 덩어리(끄기: G.expansionYearRowOff=true → 예전 줄) */
  CFG.listNote=root.G.expansionYearRowOff||String(s.year)==='전체'?'':(String(s.year)==='이전'?(s.current-3)+'년 이전':s.year+'년')+' 준공만';
  /* 공용 틀(2026-10-06 "리스트에서 이질감 없이"): 줄은 StageBoard 의 파이프라인 v11 모양 줄. 두 덩어리 줄은 공용 틀을 껐을 때(G.boardV3Off)만 */
  CFG.rowHtml=root.G.expansionYearRowOff||!root.G.boardV3Off?null:rowHtml;
  host.innerHTML=SB().html(CFG,items,S);
  SB().bind(host,{state:()=>SB().state('expansion'),cfg:()=>CFG,paint:()=>root.paintExpansion(),open});
  if(!host.__xbr){host.__xbr=true;host.addEventListener('change',e=>{const k=e.target.dataset&&e.target.dataset.xbRule;if(!k)return;setRule(k,e.target.value);root.paintExpansion();if(typeof root.toast==='function')root.toast((k==='afterCompletionDays'?'사후 연락 기준':'관계 연락 주기')+'을 '+e.target.value+'일로 바꿨습니다 (이 PC에 저장)');});}
  if(!host.__xb){host.__xb=true;host.addEventListener('click',e=>{const b=e.target.closest('[data-xb="year"]');if(!b)return;root.G.expansionYear=b.dataset.value;const st=SB().state('expansion');st.bucket='all';st.reason=null;root.ListPager.reset(st);root.paintExpansion();});}
  const ps=document.getElementById('psub');if(ps&&root.G.page==='expansion')ps.textContent='왼쪽 사후관리 진단 → 오른쪽 확인할 현장 · 빨강 사유부터';
  return true;
 }
 function boot(){
  const V=root.ExpansionV2;if(!V||V.__b)return;V.__b=true;const base=V.paint;
  V.paint=function(host){if(!enabled())return base.apply(this,arguments);return paint(host,base,[].slice.call(arguments));};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.ExpansionB={enabled,CFG,item,rules};
})(window);
