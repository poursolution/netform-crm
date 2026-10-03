/* 경남지사 — 파이프라인 B안 틀 (2026-10-03 대표: "확장관리 · 경남지사 · 고객자산 · 문자 전부 파이프라인 기준으로")
   본사 확인용 화면 그대로(처리는 지사, 확인은 본사 · 이 화면에서 지사 실담당을 배정하지 않는다). StageBoard 공용 부품으로
   왼쪽 지사 진행 진단(미착수 · 연락 전 · 진행 확인 막대 3칸 · 숫자 3개 · 왜 멈춰 있나 · 본사가 할 일 · 지사 담당 현황) / 오른쪽 확인할 건(리스트 · 보드).
   근거 데이터 · 확인 창 · 확인 요청 · 회수 검토 기록은 gyeongnam-v2(facts · decorate · 내부 메모 저장 경로) 그대로. 기준(7일 무응답 · 16일 회수 검토)은 기존 v2 진단과 같다.
   끄기: G.gyeongnamBOff=true → 경남지사 v2 묶음 표. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const SB=()=>root.StageBoard,V=()=>root.GyeongnamV2;
 const RED='#d93a3a',INK='#374151',REQ='[지사 확인 요청]',RECALL='[본사 회수 검토]';
 const SILENT=7,RECALL_DAYS=16;
 const enabled=()=>!root.G.gyeongnamBOff&&!root.G.gyeongnamV2Off&&!!root.StageBoard&&!!root.GyeongnamV2;
 const handedAt=q=>root.inquiryAssignedAt(q)||root.inquiryDate(q);
 const notes=q=>{const p=root.itemPatch(q,'inq')||{};return [...(q.activities||[]),...(p.activities||[])].map(a=>String(a.note||''));};
 const requested=q=>notes(q).some(n=>n.startsWith(REQ)),recallMarked=q=>notes(q).some(n=>n.startsWith(RECALL));
 const ymd=v=>{const s=String(v||'').slice(0,10),m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);return m?Number(m[2])+'/'+Number(m[3]):'';};
 const CFG={id:'gyeongnam-b',name:'경남지사',unit:'건',stallUnit:'',stallName:'넘긴 후',stallDesc:'본사가 넘긴 뒤 지난 일수',stallRed:RECALL_DAYS,listTitle:'확인할 건',openLabel:'진행 확인',diagTitle:'지사 진행 진단',noAmount:true,
  desc:()=>'본사가 지사에 넘긴 건이 실제로 영업되고 있는지 확인하는 곳 — 처리는 지사가, 확인은 본사가 · 넘김 → 지사 실담당 → 지사 첫 연락 → 영업기회 · '+SILENT+'일 무응답이면 확인 요청, '+RECALL_DAYS+'일 넘으면 회수 검토',
  axis:'지사 진행',
  S:[['none','지사 미착수 · 실담당 없음','#15171c','지사장에게 실담당 지정 확인'],['first','실담당 지정 · 연락 전','#8a909c','지사 첫 연락 확인'],['ok','영업 진행 확인됨','#d5d9e0','월 1회 진척 리뷰']],
  RS:{recall:['넘긴 지 16일 · 움직임 없음',RED,'회수 검토','16일 넘게 지사 실담당 지정 · 연락이 없는 건은 본사 회수 또는 본사 직접 응대 검토','recall'],
      silent:['넘긴 후 7일 · 지사 응대 없음',RED,'확인 요청','7일 넘게 지사 연락 기록이 없으면 확인 창에서 [지사에 확인 요청]으로 기록','request'],
      none:['지사 실담당 미지정',INK,'확인 요청','지사장에게 실담당 지정을 확인 요청(이 화면에서 직접 배정하지 않음)','request'],
      nofirst:['지사 첫 연락 없음',INK,'확인 요청','실담당은 정해졌지만 고객 연락 기록이 없음 — 첫 연락 진행 확인','request'],
      noopp:['영업기회 미등록',INK,'진행 확인','지사 연락은 있으나 영업기회가 없음 — 견적 · 방문 진행 여부 확인','open'],
      asked:['확인 요청함 · 응답 대기',INK,'진행 확인','지사장 응답을 기다리는 건 — 응답 없으면 회수 검토','open']},
  kpi2:(inB)=>{const n=inB.filter(i=>i.bucket==='none').length;return ['지사 미착수',n+'건',n?'실담당 미지정':'모두 실담당 지정됨'];}
 };
 function item(x){
  const q=x.q,f=x.f,d=f.days==null?0:f.days,asked=requested(q),recall=recallMarked(q);
  const stage=f.deal?root.stageLabel(root.dealStage(f.deal)):'문의';
  const sub=(handedAt(q)?'넘김 '+ymd(handedAt(q)):'넘긴 날 미기록')+(f.resp?' · 지사 연락 있음':' · 지사 연락 없음')+' · '+stage+(asked?' · 확인 요청함':'')+(recall?' · 회수 검토':'');
  const rs=[];
  if(f.group!=='ok'){
   if(d>=RECALL_DAYS)rs.push('recall');
   if(d>=SILENT&&!f.resp&&!f.deal)rs.push('silent');
   if(!f.rep)rs.push('none');
   if(f.rep&&!f.resp)rs.push('nofirst');
   if(asked)rs.push('asked');
  }else if(!f.deal)rs.push('noopp');
  return {key:root.inqKey(q),site:q.site||'현장명 미입력',brand:q.brand||'',owner:f.rep||'지사 미지정',amountText:stage,bucket:f.group,sub,rs,stall:d,extra:{q,f}};
 }
 function scoped(){
  const X=root.gnData(),owner=root.G.gnOwner||'전체';
  const base=X.Q.filter(q=>root.SalesFilterState.matchesBrand(q.brand)).map(q=>({q,f:V().facts(q)}));
  return {X,base,rows:base.filter(x=>owner==='전체'||(owner==='지사 미지정'?!x.f.rep:x.f.rep===owner)),owner};
 }
 function topHtml(s){
  const map=new Map();s.base.forEach(x=>{const o=x.f.rep||'지사 미지정',v=map.get(o)||{owner:o,n:0,late:0};v.n++;if(x.f.group!=='ok')v.late++;map.set(o,v);});
  s.X.rows.filter(r=>!r.pool).forEach(r=>{if(!map.has(r.name))map.set(r.name,{owner:r.name,n:0,late:0});});
  const chips=map.size?'<div class="plv-owners" role="group" aria-label="지사 담당별"><span>지사 담당별</span>'+[...map.values()].sort((a,b)=>b.late-a.late||b.n-a.n||a.owner.localeCompare(b.owner,'ko')).map(o=>'<button type="button" class="plv-chip'+(s.owner===o.owner?' on':'')+'" data-gb="owner" data-value="'+attr(o.owner)+'" aria-pressed="'+(s.owner===o.owner)+'">'+h(o.owner)+' <b>'+o.n+'</b>'+(o.late?'<em> · 멈춤 '+o.late+'</em>':'')+'</button>').join('')+'<div class="plv-spacer"></div><button type="button" class="gnv-link" data-gb="sms">지사 고객 문자발송</button></div>':'';
  return chips;
 }
 function sideHtml(s){
  const reps=s.X.rows.filter(r=>!r.pool);
  return '<div class="psb-box gb-team"><header><b>지사 담당은 움직이나</b><span>넘겨받음 · 연락 · 수주</span></header>'+(reps.length?reps.map(r=>'<div class="psb-act"><span>'+h(r.label)+'</span><p>넘겨받음 '+r.assigned+' · 연락 '+r.responded+' · 영업기회 '+(r.opps||0)+' · 수주 '+r.won+'</p></div>').join(''):'<p class="psb-none">등록된 지사 담당이 없습니다</p>')+'</div>';
 }
 function open(key,act){
  root.InquiryWorkbench.openFrom(key,'gyeongnam');/* 확인 창 = 견적문의 상세 모달(v2 가 지사 진행 확인으로 꾸민다) */
  if(act==='request'||act==='recall')setTimeout(()=>{const b=document.querySelector('#inq-inbox-dialog [data-gnc="'+act+'"]');if(b){b.focus();b.classList.add('gb-focus');}},350);
 }
 function paint(){
  const host=document.getElementById('gyeongnam-root'),pg=document.getElementById('pg-gyeongnam');if(!host)return;
  const s=scoped(),S=SB().state('gyeongnam');
  CFG.topHtml=topHtml(s);CFG.sideHtml=sideHtml(s);
  host.innerHTML=SB().html(CFG,s.rows.map(item),S);
  SB().bind(host,{state:()=>SB().state('gyeongnam'),cfg:()=>CFG,paint:()=>root.paintGyeongnam(),open});
  if(!host.__gb){host.__gb=true;host.addEventListener('click',e=>{const b=e.target.closest('[data-gb]');if(!b)return;if(b.dataset.gb==='owner'){root.G.gnOwner=(root.G.gnOwner||'전체')===b.dataset.value?'전체':b.dataset.value;const st=SB().state('gyeongnam');st.limit=30;root.paintGyeongnam();}if(b.dataset.gb==='sms')root.campaignOpenGyeongnam?.();});}
  const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='경남지사';if(p)p.textContent='왼쪽 지사 진행 진단 → 오른쪽 확인할 건 · 빨강 사유부터 — 처리는 지사가, 확인은 본사가';
  pg?.classList.add('gnv-on','gb-on');root.CommonFilterBar?.mount('gyeongnam');const bar=pg?.querySelector(':scope>.cf-bar');if(bar)bar.hidden=false;
 }
 function boot(){
  const base=root.paintGyeongnam;if(typeof base!=='function'||base.__gb)return;
  const wrapped=function(){if(!enabled())return base.apply(this,arguments);try{paint();}catch(e){console.warn('[경남지사 B안]',e);return base.apply(this,arguments);}};
  wrapped.__gb=true;root.paintGyeongnam=wrapped;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.GyeongnamB={enabled,CFG,item};
})(window);
