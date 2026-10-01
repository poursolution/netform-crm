/* 경남지사 v2 (2026-10-01 디자인 핸드오프 'design_handoff_gyeongnam') — 본사 확인용 화면.
   실담당 지정·연락·영업은 지사가 한다. 본사는 여기서 지사 진행을 보고 '확인 요청'·'회수 검토'만 남긴다(이 화면에서 지사 실담당을 직접 배정하지 않는다).
   목록: 공통 필터줄(브랜드·검색) → 안내 줄 → 지사 담당별 칩 → 진단(파이프라인 진단 컴포넌트) → 묶음 표(지사 미착수 · 지사 응대 없음 · 영업 진행 확인됨)
   확인 창: 견적문의 상세 모달을 그대로 쓰고, 머리의 진행 막대(5칸)와 오른쪽 칸만 '지사 진행 확인'으로 바꾼다.
   데이터는 기존 gnData()/gnAssignedRep()/inquiryResponded() 그대로. 확인 요청·회수 검토는 기존 내부 메모 저장 경로로 기록만 남긴다.
   끄기: G.gyeongnamV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const GROUPS=[['none','지사 미착수','#e5484d','지사에서 아직 실담당을 정하지 않음 — 지사장에게 확인 요청'],['first','지사 응대 없음','#f5a524','실담당은 정했지만 고객 연락 기록이 없음'],['ok','영업 진행 확인됨','#30a46c','지사 연락 · 영업기회 기록이 있음']];
 const GRID='minmax(0,1.4fr) 100px 90px 90px 80px 90px 100px',COLS=['넘긴 날','지사 담당','지사 첫 연락','현재 단계','넘긴 후'];
 const REQ='[지사 확인 요청]',RECALL='[본사 회수 검토]';
 const enabled=()=>!root.G.gyeongnamV2Off;
 const admin=()=>{try{return !!root.todayIsAdmin?.();}catch(e){return false;}};
 const handedAt=q=>root.inquiryAssignedAt(q)||root.inquiryDate(q);
 const since=q=>root.gnDaysSince(handedAt(q));
 /* 한 건의 지사 진행: 본사가 한 연락은 지사 첫 연락으로 세지 않는다 — 지사 실담당이 정해진 뒤의 응대만 센다 */
 function facts(q){
  const rep=root.gnAssignedRep(q),deal=root.gnDealForInquiry(q),resp=!!rep&&root.inquiryResponded(q),won=!!deal&&root.isWon(deal);
  return {rep,deal,resp,won,days:since(q),group:!rep?'none':(resp||deal)?'ok':'first'};
 }
 const notes=q=>{const p=root.itemPatch(q,'inq')||{};return [...(q.activities||[]),...(p.activities||[])].map(a=>String(a.note||''));};
 const requested=q=>notes(q).some(n=>n.startsWith(REQ)),recallMarked=q=>notes(q).some(n=>n.startsWith(RECALL));
 function scoped(){
  const X=root.gnData(),owner=root.G.gnOwner||'전체';
  const base=X.Q.filter(q=>root.SalesFilterState.matchesBrand(q.brand)).map(q=>({q,f:facts(q)}));
  const rows=base.filter(x=>owner==='전체'||(owner==='지사 미지정'?!x.f.rep:x.f.rep===owner));
  return {X,base,rows,owner};
 }
 function brandStats(){
  const sel=root.SalesFilterState.state().brands||[];let list=[];try{list=root.gnData().Q;}catch(e){list=[];}
  const names=[...new Set(['석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어'].concat(list.map(q=>q.brand).filter(Boolean)))];
  return [{name:'전체',n:list.length,on:!sel.length}].concat(names.map(b=>({name:b,n:list.filter(q=>q.brand===b).length,on:sel.includes(b)})));
 }
 function diagnosis(s){
  const D=root.PipelineDiagnosis;if(!D)return '';
  const rows=s.rows,n=rows.length,none=rows.filter(x=>x.f.group==='none'),named=rows.filter(x=>x.f.rep),first=rows.filter(x=>x.f.resp),opp=rows.filter(x=>x.f.deal),won=rows.filter(x=>x.f.won);
  const avg=none.length?Math.round(none.reduce((a,x)=>a+(x.f.days||0),0)/none.length):0,wonAmt=won.reduce((a,x)=>a+(Number(root.wonAmt(x.f.deal))||0),0);
  const K=(label,value,sub,tone)=>({label,value,sub,tone:tone||''});
  const months=[-5,-4,-3,-2,-1,0].map(o=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+o);const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');return [(d.getMonth()+1)+'월',root.gnInquiries(false).filter(q=>root.SalesFilterState.matchesBrand(q.brand)&&String(handedAt(q)||'').slice(0,7)===key).length];});
  const silent=rows.filter(x=>!x.f.resp&&!x.f.deal&&(x.f.days||0)>=7),old=rows.filter(x=>x.f.group!=='ok'&&(x.f.days||0)>=16);
  const reps=s.X.rows.filter(r=>!r.pool).map(r=>[r.label,r.assigned,r.won?'수주 '+r.won:r.opps?'영업기회 '+r.opps:r.responded?'연락 '+r.responded:'진전 없음']);
  const tasks=[[none.length,'지사 미착수 '+none.length+'건','지사장에게 실담당 지정 확인 요청','본사 영업관리 · 오늘'],[silent.length,'넘긴 후 7일 무응답 '+silent.length+'건','확인 창에서 [지사에 확인 요청]으로 기록 남기기','본사 영업관리'],[old.length,'16일 넘은 건 '+old.length+'건','본사 회수 또는 본사 직접 응대 검토','본사 영업관리'],[n,'지사 진척 '+first.length+'건 · 수주 '+won.length+'건','월 1회 지사 진척 리뷰 (넘긴 건 · 연락 · 수주)','관리팀 KPI']].filter(t=>t[0]>0).map(t=>({basis:t[1],todo:t[2],who:t[3]}));
  return D.render({accent:'blue',
   kpis:[K('넘긴 건',n+'건',(root.perfPeriodLabel?root.perfPeriodLabel():'')+' · 본사 → 경남지사'),K('지사 미착수',none.length+'건',none.length?'실담당 미지정 · 평균 '+avg+'일':'모두 실담당 지정됨',none.length?'bad':''),K('지사 첫 연락',first.length+'건',first.length?'지사 실담당의 응대 기록':'지사 기록 없음(본사 연락은 세지 않음)',n&&!first.length?'bad':''),K('영업기회 · 수주',opp.length+'건 · '+won.length+'건',won.length?root.fmtAmt(wonAmt):'수주 0원')],
   cards:[{title:'어디서 멈췄나',desc:'넘긴 건의 흐름',bars:[['넘김',n],['지사 실담당 지정',named.length],['지사 첫 연락',first.length],['영업기회',opp.length],['수주',won.length]]},{title:'언제 넘겼나',desc:'월별 넘긴 건',bars:months},{title:'지사 담당은 움직이나',desc:'지사 담당 · 진전',rows:reps,empty:'등록된 지사 담당이 없습니다'}],
   action:{title:'본사가 할 일',desc:'확인 · 조치',tasks}},{open:root.G.plvDiagShut!==true,scope:'gyeongnam'});
 }
 function rowHtml(x){
  const q=x.q,f=x.f,key=root.inqKey(q),stage=f.deal?root.stageLabel(root.dealStage(f.deal)):'문의',firstAt=f.resp?(q.firstActivity||q.first_activity||q.respondedAt||q.responded_at||''):'';
  return '<div class="plv-row" role="row" tabindex="0" data-gn="open" data-value="'+attr(key)+'" data-inq="'+attr(q.id||key)+'" style="grid-template-columns:'+GRID+'"><span class="plv-c plv-site"><b title="'+attr(q.site)+'">'+h(q.site||'현장명 미입력')+'</b><small class="'+(f.rep?'':'none')+'">'+h(f.rep||'지사 미지정')+(requested(q)?' · 확인 요청함':'')+(recallMarked(q)?' · 회수 검토':'')+'</small></span>'
   +'<span class="plv-c"><span>'+h(String(handedAt(q)||'').slice(0,10)||'미기록')+'</span></span>'
   +'<span class="plv-c"><span class="'+(f.rep?'':'r')+'">'+h(f.rep||'미지정')+'</span></span>'
   +'<span class="plv-c">'+(f.resp?'<span class="g">'+h(String(firstAt).slice(0,10)||'있음')+'</span>':'<span class="m">없음</span>')+'</span>'
   +'<span class="plv-c"><em class="plv-tag '+(f.won?'g':f.deal?'o':'m')+'">'+h(stage)+'</em></span>'
   +'<span class="plv-c"><span class="'+(f.group==='ok'?'':'r')+'">'+(f.days==null?'–':f.days+'일')+'</span></span>'
   +'<button type="button" class="plv-cta" data-gn="open" data-value="'+attr(key)+'">진행 확인</button></div>';
 }
 function listHtml(s){
  const map=new Map();s.base.forEach(x=>{const o=x.f.rep||'지사 미지정',v=map.get(o)||{owner:o,n:0,late:0};v.n++;if(x.f.group!=='ok')v.late++;map.set(o,v);});
  s.X.rows.filter(r=>!r.pool).forEach(r=>{if(!map.has(r.name))map.set(r.name,{owner:r.name,n:0,late:0});});
  const chips=map.size?'<div class="plv-owners" role="group" aria-label="지사 담당별"><span>지사 담당별</span>'+[...map.values()].sort((a,b)=>b.late-a.late||b.n-a.n||a.owner.localeCompare(b.owner,'ko')).map(o=>'<button type="button" class="plv-chip'+(s.owner===o.owner?' on':'')+'" data-gn="owner" data-value="'+attr(o.owner)+'" aria-pressed="'+(s.owner===o.owner)+'">'+h(o.owner)+' <b>'+o.n+'</b>'+(o.late?'<em> · 멈춤 '+o.late+'</em>':'')+'</button>').join('')+'</div>':'';
  const intro='<div class="plv-intro"><i style="background:#64748b"></i><b>경남지사</b><span>넘긴 건 '+s.rows.length+'건 · 본사 확인용 — 처리는 지사가, 확인은 본사가</span><div class="plv-spacer"></div><button type="button" class="gnv-link" data-gn="sms">지사 고객 문자발송</button></div>';
  const head='<div class="plv-thead" role="row" style="grid-template-columns:'+GRID+'"><span>현장 · 지사 담당</span>'+COLS.map(c=>'<span>'+h(c)+'</span>').join('')+'<span></span></div>';
  const more=root.G.gnMore||(root.G.gnMore={});
  const groups=GROUPS.map(([id,title,color,desc])=>{
   const list=s.rows.filter(x=>x.f.group===id).sort((a,b)=>(b.f.days||0)-(a.f.days||0)),shown=list.slice(0,20+(more[id]||0)),rest=list.length-shown.length;
   return '<div class="plv-ghead" data-plv-group="'+id+'"><i style="background:'+color+'"></i><b>'+h(title)+'</b><span>'+list.length+'건</span><small>· '+h(desc)+'</small></div>'+(shown.length?shown.map(rowHtml).join(''):'<div class="plv-empty">해당하는 건이 없습니다</div>')+(rest>0?'<button type="button" class="plv-more" data-gn="more" data-value="'+id+'">+ '+rest+'건 더보기</button>':'');
  }).join('');
  return '<div id="gyeongnam-v2" class="plv" data-workspace="gyeongnam">'+intro+chips+diagnosis(s)+'<div class="plv-table" role="table" aria-label="경남지사 넘긴 건">'+head+groups+'</div></div>';
 }
 function onClick(e){
  const pd=e.target.closest('[data-pd="toggle"]');if(pd&&pd.closest('#gyeongnam-v2')){root.G.plvDiagShut=root.G.plvDiagShut!==true;root.paintGyeongnam();return;}
  const b=e.target.closest('#gyeongnam-v2 [data-gn]');if(!b)return;const a=b.dataset.gn,v=b.dataset.value;
  if(a==='open')root.InquiryWorkbench.openFrom(v,'gyeongnam');/* 견적문의 상세 모달을 그대로 연다 — 닫으면 이 화면으로 돌아온다 */
  if(a==='owner'){root.G.gnOwner=(root.G.gnOwner||'전체')===v?'전체':v;root.paintGyeongnam();}
  if(a==='more'){const m=root.G.gnMore||(root.G.gnMore={});m[v]=(m[v]||0)+40;root.paintGyeongnam();}
  if(a==='sms')root.campaignOpenGyeongnam?.();
 }
 function paint(){
  const host=document.getElementById('gyeongnam-root'),pg=document.getElementById('pg-gyeongnam');if(!host)return;
  host.innerHTML=listHtml(scoped());
  if(!host.__gnv){host.__gnv=true;host.addEventListener('click',onClick);host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}});}
  const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='경남지사';if(p)p.textContent='본사가 지사에 넘긴 건이 실제로 영업되고 있는지 확인하는 곳 — 처리는 지사가, 확인은 본사가';
  pg?.classList.add('gnv-on');root.CommonFilterBar?.mount('gyeongnam');const bar=pg?.querySelector(':scope>.cf-bar');if(bar)bar.hidden=false;
 }
 /* ── 확인 창: 견적문의 상세 모달의 머리 막대와 오른쪽 칸만 바꾼다 ── */
 function confirming(q){return enabled()&&admin()&&root.itemOwnerTeam?.(q)==='gyeongnam'&&!root.inqCtlConverted?.(q);}
 function decorate(dlg,q){
  if(!confirming(q))return false;
  const f=facts(q),key=root.inqKey(q),done=[true,!!f.rep,f.resp,!!f.deal,f.won],names=['본사 → 지사','지사 실담당','지사 첫 연락','영업기회','수주'],cur=done.indexOf(false);
  const steps=dlg.querySelector('.idv-steps');if(steps)steps.innerHTML=names.map((n,i)=>'<div class="'+(done[i]?'done':i===cur?'cur':'')+'"><i></i><span>'+(i===cur?'지금 · ':'')+n+'</span></div>').join('');
  const pill=dlg.querySelector('.idv-top1 .idv-pill');if(pill){const label=f.group==='none'?'지사 미착수':f.group==='first'?'지사 응대 없음':'영업 진행 확인됨';pill.className='idv-pill '+(f.group==='ok'?'ok':'red');pill.textContent=label+(f.days!=null?' · '+f.days+'일':'');}
  /* 가운데: 접수 다음에 '본사 → 경남지사 인계' 기록 */
  const firstMsg=dlg.querySelector('.idv-thread .idv-msg');if(firstMsg&&!dlg.querySelector('.gnv-handoff')){firstMsg.insertAdjacentHTML('afterend','<div class="idv-msg sys gnv-handoff"><div class="idv-meta"><em>인계</em><span>'+h(String(handedAt(q)||'').slice(0,10))+'</span></div><div class="idv-bubble">본사 → 경남지사 인계</div></div>');}
  const logs=notes(q).filter(n=>n&&!n.startsWith(REQ)&&!n.startsWith(RECALL)).length,stage=f.deal?root.stageLabel(root.dealStage(f.deal)):'문의',stalled=f.group!=='ok',asked=requested(q),recall=recallMarked(q);
  const team=root.gnData().rows.filter(r=>!r.pool).map(r=>'<div><span>'+h(r.label)+'</span><em>넘겨받음 '+r.assigned+' · 연락 '+r.responded+' · 수주 '+r.won+'</em></div>').join('')||'<p class="idv-hint">등록된 지사 담당이 없습니다.</p>';
  const c3=dlg.querySelector('.idv-c3');if(!c3)return false;
  c3.setAttribute('aria-label','지사 진행 확인');
  c3.innerHTML='<div class="idv-now '+(stalled?'red':'ok')+'">지사 진행 확인</div><h3>'+h(f.rep?f.rep+' 담당':'지사 실담당 미지정')+'</h3><p class="idv-hint">본사 확인용 · 처리는 지사에서</p>'
   +'<div class="gnv-state'+(stalled?' stalled':'')+'"><dl><div><dt>넘긴 후</dt><dd class="'+(stalled?'r':'')+'">'+(f.days==null?'–':f.days+'일')+'</dd></div><div><dt>지사 실담당</dt><dd class="'+(f.rep?'':'r')+'">'+h(f.rep||'미지정')+'</dd></div><div><dt>지사 연락 기록</dt><dd>'+(f.resp?logs+'건':'없음')+'</dd></div><div><dt>현재 단계</dt><dd>'+h(stage)+'</dd></div></dl>'+(stalled&&f.days!=null?'<p>넘긴 지 '+f.days+'일 동안 지사에서 움직임이 없어요</p>':'')+'</div>'
   +(asked?'<div class="gnv-done">지사에 확인 요청함 · 지사장 응답 대기</div>':'<button type="button" class="idv-primary on" data-gnc="request" data-key="'+attr(key)+'">지사에 확인 요청</button>')
   +(recall?'<div class="gnv-done amber">본사 회수 검토 대상으로 표시함</div>':'<button type="button" class="gnv-ghost" data-gnc="recall" data-key="'+attr(key)+'">본사 회수 검토</button>')
   +'<p class="gnv-note">확인 요청·회수 검토는 이 문의에 메모로 기록됩니다. 실제 회수는 기존 담당 변경 절차를 따릅니다.</p><div class="idv-err" id="gnv-err" role="alert"></div>'
   +'<div class="gnv-team"><b>경남지사 담당 현황</b>'+team+'</div>'
   +'<button type="button" class="idv-link idv-change" data-idv="reassign">담당 변경(회수 · 재배정)</button>';
  return true;
 }
 /* 기록 = 견적문의 상세의 기존 '내부 메모' 저장 경로 그대로(입력칸에 넣고 저장 버튼을 누른 것과 같다) */
 function record(key,text){
  const V=root.InquiryDetailV2,dlg=document.querySelector('#inq-inbox-dialog .inq-dialog'),err=document.getElementById('gnv-err');if(!V||!dlg)return;
  const s=V.state(key);s.tab='memo';s.text=text;s.open=false;V.reskin();
  const save=document.querySelector('#inq-inbox-dialog [data-idv="save"]');
  if(!save){s.text='';const e2=document.getElementById('gnv-err');if(e2)e2.textContent='이 문의에는 지금 메모를 남길 수 없습니다(배정 상태 확인).';return;}
  save.click();
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('#inq-inbox-dialog [data-gnc]');if(!b)return;const key=b.dataset.key,q=root.inqCtlFind?.(key,false);if(!q)return;
  const who=root.repN(root.ME?.name)||'';
  if(b.dataset.gnc==='request')record(key,REQ+' 넘긴 지 '+(since(q)??'?')+'일 — 지사 실담당 지정과 첫 연락 진행을 확인해 주세요. (요청 '+who+')');
  if(b.dataset.gnc==='recall')record(key,RECALL+' 넘긴 지 '+(since(q)??'?')+'일 — 지사 진행이 없어 본사 회수 후보로 표시합니다. (표시 '+who+')');
  setTimeout(()=>{if(root.G.page==='gyeongnam')root.paintGyeongnam();},300);
 });
 function boot(){
  const base=root.paintGyeongnam;if(typeof base!=='function')return;
  root.paintGyeongnam=function(){
   const pg=document.getElementById('pg-gyeongnam'),bar=pg?.querySelector(':scope>.cf-bar');
   if(!enabled()){pg?.classList.remove('gnv-on');if(bar)bar.hidden=true;return base.apply(this,arguments);}
   try{paint();}catch(e){console.warn('[경남지사 v2]',e);pg?.classList.remove('gnv-on');return base.apply(this,arguments);}
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.GyeongnamV2={enabled,paint,decorate,confirming,brandStats,facts};
})(window);
