/* 모바일 v5 오늘 · 팀 (2026-10-20 design_handoff_mobile_all '모바일 v4' B 오늘 · 관리자 + v4 보완 · 대표 "기획대로 진행해")
   관리자(allowed_modes 에 admin)에게만 오늘 화면 위 [내 오늘 | 팀] 전환. 팀 = 팀 전체 · 병목 · 보낸 요청 결과가 먼저.
   · 맨 위: 팀 기한 초과 n · 미배정 n / 보낸 요청 n · 처리 n · 담당 미처리 n · 고객 답 대기 n
   · 담당별 · 기한 초과: 이름을 누르면 그 사람 업무 목록(한 쪽 20건 · 보기만)
   · 보낸 요청 · 기한 지남: 담당 미처리일 때만 [다시 요청](PC 와 같은 crm_work_request_reask_v1) — 고객 답 대기면 다시 요청 없음
   · 사원별 이번 달: [성과 보기] = PC 성과 분석(같은 숫자)
   판정은 PC 와 같은 함수(DayZoneRules) · 요청 상태는 서버 값 그대로. 끄기 = G.mobileV5Off(오늘 v5 와 같이). */
(function(w){
 'use strict';
 const h=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const canManage=()=>{try{return !!(w.Phase1&&w.Phase1.profile&&Array.isArray(w.Phase1.profile.allowed_modes)&&w.Phase1.profile.allowed_modes.includes('admin'));}catch(e){return false;}};
 const on=()=>!!(w.MobileV5Today&&w.MobileV5Today.on()&&canManage());
 const repOf=d=>{const r=String((w.canonicalRep?w.canonicalRep(d.rep):d.rep)||'').trim();return !r||r==='미배정'||r==='-'?'':r;};
 const DONE=['done','replied','absent'],WAIT=['sent','seen'];
 /* 보낸 요청 분류: 처리(done · 회신 · 부재 처리) / 담당 미처리(보냄 · 확인함) / 고객 답 대기(진행 중 — 담당이 연락했고 고객 답이나 남은 항목 대기) */
 const kindOf=r=>DONE.includes(r.status)?'done':WAIT.includes(r.status)?'idle':r.status==='working'?'wait':'';
 /* zonesOf(deal) = mobile-guide-shell 이 넘기는 판정(DayZoneRules · 같은 prim) */
 function model(ctx){
  const RU=w.DayZoneRules,day=RU.kst(),deals=(w.DEALS||[]).filter(d=>typeof w.isOpen==='function'?w.isOpen(d):!d.outcome);
  const late=[],byRep={};let unassigned=0;
  deals.forEach(d=>{const rep=repOf(d);if(!rep){unassigned++;return;}const p=ctx.prim(d),z=RU.zone(p,day);if(z==='late'){const x={d,p,rep,n:RU.diff(RU.dayOf(p.due),day)};late.push(x);(byRep[rep]=byRep[rep]||[]).push(x);}});
  const inq=(w.ADMIN&&Array.isArray(w.ADMIN.inquiries)?w.ADMIN.inquiries:[]).filter(q=>{const r=String(q.rep||'').trim();return (!r||r==='미배정')&&!/종결|영업전환|배드핏|실주|수주/.test(String(q.status||''));}).length;
  const L=(w.MobileRequests&&w.MobileRequests.state?w.MobileRequests.state().list:[])||[],mine=L.filter(r=>r&&r.by_me&&r.status!=='cancelled');
  const cnt=k=>mine.filter(r=>kindOf(r)===k).length;
  const overdue=mine.filter(r=>r.open&&Date.parse(r.due_at)<Date.now()).sort((a,b)=>String(a.due_at).localeCompare(String(b.due_at)));
  const reps=Object.keys(byRep).map(k=>({rep:k,n:byRep[k].length})).sort((a,b)=>b.n-a.n||a.rep.localeCompare(b.rep,'ko'));
  Object.values(byRep).forEach(a=>a.sort((x,y)=>(x.n==null?0:x.n)-(y.n==null?0:y.n)));
  return {late:late.length,unassigned:unassigned+inq,sent:mine.length,done:cnt('done'),idle:cnt('idle'),wait:cnt('wait'),reps,byRep,overdue};
 }
 const ago=t=>{const m=Math.max(0,Date.now()-Date.parse(t)),hr=Math.round(m/36e5);return hr<48?hr+'시간 지남':Math.round(hr/24)+'일 지남';};
 function render(M,S){
  const tabs=[['today','오늘'],['mine','내 현장'],['record','기록 · 등록'],['schedule','일정']].map(([k,l],n)=>'<span data-gs="tab" data-tab="'+k+'" role="button" tabindex="0"'+(n===0?' aria-current="page" class="on"':'')+'>'+l+'</span>').join('');
  const P=w.ListPager,cut=(list,page)=>P?P.cut(list,page||1):{rows:list.slice(0,20),pages:1},pager=(pg,key)=>P&&pg.pages>1?P.html(pg,{ns:'gs',unit:'건',small:true}).replace(/data-gs="page"/g,'data-gs="v5teampage" data-key="'+key+'"'):'';
  let body='<div class="mv5-seg" role="tablist"><span data-gs="v5team" data-value="0" role="tab" tabindex="0" aria-selected="false">내 오늘</span><span data-gs="v5team" data-value="1" role="tab" tabindex="0" aria-selected="true">팀</span></div>';
  if(S.v5rep){
   const rows=M.byRep[S.v5rep]||[],pg=cut(rows,S.v5teamPage&&S.v5teamPage.rep);
   body+='<div class="mv5-sub"><span data-gs="v5rep" data-value="" role="button" tabindex="0">‹ 팀</span><b>'+h(S.v5rep)+' · 기한 초과 '+rows.length+'</b></div>'
    +(pg.rows.map(x=>'<div class="mv5-row"><div class="mv5-row-t"><span class="mv5-k red">'+h(x.n==null?'기한 지남':(-x.n)+'일 지남')+'</span><b>'+h(x.d.nm)+'</b><span class="mv5-row-c">'+h(x.p.text||'다음 업무 확인')+'</span></div></div>').join('')||'<p class="mv5-empty">기한이 지난 업무가 없습니다.</p>')+pager(pg,'rep');
  }else{
   body+='<div class="mv5-top"><b>팀 기한 초과 '+M.late+' · 미배정 '+M.unassigned+'</b><span class="mv5-top-sub">보낸 요청 '+M.sent+' · 처리 '+M.done+' · 담당 미처리 '+M.idle+' · 고객 답 대기 '+M.wait+'</span></div>';
   body+='<div class="mv5-next"><span>담당별 · 기한 초과</span>'+(M.reps.length?'<div class="mv5-chips">'+M.reps.map(r=>'<span class="mv5-chip" data-gs="v5rep" data-value="'+h(r.rep)+'" role="button" tabindex="0">'+h(r.rep)+' <b>'+r.n+'</b></span>').join('')+'</div><span class="mv5-more-note">이름을 누르면 그 사람 업무 목록</span>':'<b>기한이 지난 업무가 없습니다</b>')+'</div>';
   const pg=cut(M.overdue,S.v5teamPage&&S.v5teamPage.req);
   body+='<div class="mv5-sub"><b>보낸 요청 · 기한 지남 '+M.overdue.length+'</b></div>'
    +(pg.rows.map(r=>{const k=kindOf(r),label=w.MobileRequests?w.MobileRequests.labelOf(r):r.label;return '<div class="mv5-card mv5-req" style="border-left-color:#e8590c"><span class="mv5-k red">'+h(ago(r.due_at))+'</span><b class="mv5-site">'+h((r.site||'현장')+' · '+label)+'</b><span class="mv5-row-c">'+h([r.to_name,r.status==='sent'?'안 봄':'확인함',k==='idle'?'담당 미처리':'고객 답 대기'+(r.reply_note?' · '+r.reply_note:'')].filter(Boolean).join(' · '))+'</span>'+(k==='idle'?'<span class="mv5-btn" data-gs="v5reask" data-id="'+h(r.id)+'" role="button" tabindex="0">다시 요청</span>':'<span class="mv5-row-c">고객 답 대기면 다시 요청 없음</span>')+'</div>';}).join('')||'<p class="mv5-empty">기한이 지난 보낸 요청이 없습니다.</p>')+pager(pg,'req');
   body+='<div class="mv5-next"><span>사원별 이번 달</span><b>연락 · 방문 · 견적 · 진전 · 실적</b><span class="mv5-more-note">영업담당도 같은 표를 봄(보기만)</span><span class="mv5-btn" data-gs="v5perf" role="button" tabindex="0">성과 보기</span></div>';
  }
  return '<div class="approved-a mv5 mv5-team"><div class="mv5-head"><b>오늘 · 팀</b><div style="flex:1"></div><span data-gs="v5perf" role="button" tabindex="0">성과 ›</span></div><div class="mv5-body">'+body+'</div><div class="mv5-nav">'+tabs+'</div></div>';
 }
 /* PC 와 같은 다시 요청 기한(WorkRequest.reask): 지사 = 내일 12시, 그 밖 = 17시 전이면 오늘 17:00 · 뒤면 오늘 중 */
 function reaskDue(r){const now=new Date(),d=new Date(now);let label;if(r.kind==='branch'){label='내일 12시';d.setDate(d.getDate()+1);d.setHours(12,0,0,0);}else if(now.getHours()>=17){label='오늘 중';d.setHours(23,59,0,0);}else{label='오늘 17:00';d.setHours(17,0,0,0);}return {due_at:d.toISOString(),due_label:label};}
 w.MobileV5Team=Object.freeze({on,canManage,model,render,kindOf,reaskDue});
})(window);
