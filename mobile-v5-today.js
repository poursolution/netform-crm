/* 모바일 v5 오늘 (2026-10-20 design_handoff_mobile_all '모바일 v5 · 세 작업 바로 하기' + 'v5 보완' · 대표 "Claude가 모바일 v5 구현")
   맨 위 = "지금 먼저 할 일 n건 · 마감" 한 줄(숫자 4개 나열 안 함). 카드 한 장 = 기한 · 요청자 / 현장 · 연락처 / 이번에 확인할 것 / 버튼 1개 + 아래 '끝나는 조건'.
   그 아래 "다음 · …" 한 건 미리보기 + "그다음 n건 ›". 회신 대기 · 기록 보완은 맨 아래 숫자만(지연 아님 · v4).
   · 어느 건이 오늘 화면에 나오나 = PC 와 같은 판정(DayZoneRules · mobile-guide-shell zones()) 그대로. 이 파일은 순서와 카드 문장만 정한다.
   · 순서: 기한 지남 → 지금 시각 기준 가까운 고객 약속 · 마감 → 같은 순위면 들어온 순서. 재연락을 뒤로 잡아도 요청 마감은 그대로(마감 = 요청의 due_at).
   · '이번에 확인할 것' · '끝나는 조건' = 관리자 요청(확인 항목 · 메모) → 고객 기록(다음 할 일 · 문의 원문) → 단계별 카드 기준(StageCardRules). AI 가 만들지 않는다.
   · 버튼은 실행 하나: 전화하기(전화 앱 → 돌아오면 결과 화면) · 방문 결과 남기기 · 기록하기. 누르는 곳은 mobile-guide-shell 의 data-gs="v5task".
   끄기: G.mobileV5Off=true → 예전 A 화면(4구역 탭). */
(function(w){
 'use strict';
 const h=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const WD='일월화수목금토',pad=n=>String(n).padStart(2,'0'),DAY=/^\d{4}-\d{2}-\d{2}$/;
 const on=()=>!(w.G&&w.G.mobileV5Off);
 function parts(ms){const t=new Date(ms+9*36e5);return {day:t.toISOString().slice(0,10),hm:pad(t.getUTCHours())+':'+pad(t.getUTCMinutes()),m:t.getUTCMonth()+1,d:t.getUTCDate(),wd:WD[t.getUTCDay()]};}
 function dayWord(day,now){const b=parts(now).day,n=Math.round((Date.parse(day+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/864e5),m=Number(day.slice(5,7)),d=Number(day.slice(8,10)),wd=WD[new Date(day+'T00:00:00Z').getUTCDay()];return n===0?'오늘':n===1?'내일':n===-1?'어제':m+'.'+d+' ('+wd+')';}
 /* '오늘 18:00' · '내일 10:00' · '10.23 (목) 11:00' */
 const when=(ms,now)=>{const a=parts(ms);return dayWord(a.day,now)+' '+a.hm;};
 const stamp=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d/.test(v))return null;const n=Date.parse(v);return Number.isFinite(n)?n:null;};
 /* 할 일의 시각: scheduled_at, 아니면 시각이 실린 due_at. 날짜만인 값(자정 · 23:59 로 저장된 하루 기한)은 시각이 아니다(MobileScheduleModel 과 같은 규칙) */
 function taskAt(x){
  if(!x)return null;const s=stamp(x.scheduled_at);if(s!=null)return s;
  return dayOnlyTime(String(x.due_at||x.due||''));
 }
 function dayOnlyTime(raw){const n=stamp(raw);if(n==null)return null;const u=new Date(n).toISOString().slice(11,16),k=parts(n).hm;return u==='00:00'||k==='00:00'||k==='23:59'?null:n;}
 const fmtPhone=v=>{const s=String(v||'').replace(/\D/g,'');if(/^01\d{8,9}$/.test(s))return s.length===10?s.replace(/(\d{3})(\d{3})(\d{4})/,'$1-$2-$3'):s.replace(/(\d{3})(\d{4})(\d{4})/,'$1-$2-$3');if(/^02\d{7,8}$/.test(s))return s.replace(/^(02)(\d{3,4})(\d{4})$/,'$1-$2-$3');if(/^0\d{9,10}$/.test(s))return s.replace(/^(0\d{2})(\d{3,4})(\d{4})$/,'$1-$2-$3');return String(v||'');};
 const rule=(code,outcome)=>(w.StageCardRules&&w.StageCardRules.of(code,outcome))||{check:'',done:'결과를 남기면 끝'};
 const GENERIC=/^(고객\s*)?첫\s*연락$/;
 const VISIT=/방문|실측|미팅/;
 const short=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
 /* 2026-10-22 대표 "문의 요약해서": 문의 원문을 항목 · 문장 단위로 잘라 인사말을 빼고 앞 세 토막만 ' · ' 로 잇는다(AI 아님 · 원문 글자 그대로). 카드에서는 두 줄까지 */
 const BOILER=/^(안녕하세요|안녕하십니까|감사합니다|수고하세요|수고하십시오|잘 부탁드립니다|부탁드립니다|문의\s*드립니다|문의드려요|문의합니다)[.!~]*$/;
 function summarize(body,n){
  const parts=String(body||'').replace(/\r/g,'').replace(/([.!?。])\s+/g,'$1\n').split(/\n+|\s+[-•·▪■]\s+/).map(s=>s.replace(/^[-•·▪■\s]+/,'').replace(/[.。]\s*$/,'').replace(/\s+/g,' ').trim()).filter(s=>s.length>1&&!BOILER.test(s));
  const seen=[];for(const p of parts){if(!seen.includes(p))seen.push(p);if(seen.length>=3)break;}
  return short(seen.join(' · '),n||90);
 }
 /* 들어온 시각(같은 순위 안 순서) */
 const arrived=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:Infinity;};

 /* ── 카드 한 장 모양 만들기 ── ctx = mobile-guide-shell 이 넘기는 조회 함수(next · label · brand · color · inquiry) */
 function inqItem(x,ctx,now){
  const t=x.inq,v=ctx.inquiry(t.ref)||{},raw=v.raw||{},hrs=Number(w.OPS_RULES&&w.OPS_RULES.responseSlaHours)||2;
  const base=arrived(raw.sales_assigned_at||raw.assigned_at||raw.assignedAt||raw.at||raw.created_at),deadline=Number.isFinite(base)?base+hrs*36e5:null,R=rule('inquiry');
  const phone=fmtPhone(v.phone||''),who=raw.contact_name||raw.customer_name||'';
  /* 2026-10-22 대표 "배정 안 된 건 회색": 담당 미배정 문의는 회색 띠 · 회색 머리 글(붉게 재촉하지 않음). 배정된 문의 머리 글은 '견적문의 첫 연락' */
  const unassigned=v.done===false;
  return {kind:'inquiry',id:t.ref,late:!!x.late,deadline,at:deadline,arrived:base,gray:unassigned,
   head:unassigned?'담당 미배정 · 견적문의':(deadline?(x.late?'첫 연락 기준 '+when(deadline,now)+' 지남':when(deadline,now)+'까지'):x.late?'첫 연락 기준 넘김':'오늘')+' · 견적문의 첫 연락',
   site:t.nm||v.nm||'견적문의',contact:[who||'고객',phone].filter(Boolean).join(' · '),
   check:R.check,source:v.body?'문의 요약: '+summarize(v.body,90):'',done:R.done,
   button:phone?'전화하기':'응대 기록',mode:phone?'call':'open',color:unassigned?'#9ca3af':'#15171c',phone};
 }
 function dealItem(z,x,ctx,now){
  const d=x.d,p=x.p,r=x.r,n=ctx.next(d),R=rule(d.code,d.outcome),RU=w.DayZoneRules,MR=w.MobileRequests;
  const c=typeof w.contactInfoM==='function'?w.contactInfoM(d):{},phone=fmtPhone(c.mobile||c.officeTel||''),role=c.name?c.name+(c.role&&c.role!==c.name?' '+c.role:''):(c.role||'');
  const at=taskAt(n),visit=!!(n&&n.id&&VISIT.test(String(n.type||n.action_type||''))),promise=RU.isPromise(p);
  let head,check='',done=R.done,deadline=null;const dueDay=RU.dayOf(p.due);
  if(r){
   deadline=stamp(r.due_at);const asks=(Array.isArray(r.asks)?r.asks:[]).map(String).filter(a=>a&&!GENERIC.test(a.trim()));
   head=(deadline?when(deadline,now)+(deadline<now?' 지남':'까지'):'요청 기한 확인')+' · '+(r.requested_by||'관리자')+' 요청';
   check=asks.length?asks.join(' · '):r.memo?short(r.memo,60):'';
   if((MR&&MR.isContact&&MR.isContact(r))||r.kind==='first'||r.kind==='follow')done='연결돼서 확인한 내용을 남기면 끝';else if(asks.length>1)done='요청 항목 '+asks.length+'개를 확인해 남기면 끝';
  }else{
   const day=dueDay,gap=RU.diff(day);
   head=z==='late'?(gap==null?'기한 지남':(-gap)+'일 지남'+(/^\d/.test(dayWord(day,now))?' · '+dayWord(day,now)+' 기한':'')):at?when(at,now)+' · '+(promise?'고객 약속':visit?'방문 약속':'할 일'):(promise?'오늘 · 고객 약속':'오늘까지');
  }
  if(!check)check=p.text&&!/^\s*고객\s*약속\s*[:：]?\s*$/.test(p.text)?short(String(p.text).replace(/^\s*고객\s*약속\s*[:：]\s*/,''),60):R.check;
  if(visit&&!r)done='방문 결과를 남기면 끝 · 견적이 필요하면 이어서 요청';
  /* 연락으로 끝나는 단계(견적문의 · 컨설팅 · 관계관리)의 전화 업무는 '연결돼서 확인' — 컨설팅 기준 문장(방문 결과)은 방문 업무에만 */
  else if(!r&&!visit&&phone&&w.StageCardRules&&['inquiry','consulting','relationship'].includes(w.StageCardRules.keyOf(d.code,d.outcome)))done='연결돼서 확인한 내용을 남기면 끝';
  /* 재연락을 뒤로 잡았어도 요청 마감은 그대로 — 카드에 같이 적는다 */
  const retry=r&&deadline&&at&&Math.abs(at-deadline)>6e4?when(at,now)+' 다시 · '+parts(deadline).hm+' 마감 그대로':'';
  return {kind:'deal',id:d.id,requestId:r?r.id:'',late:z==='late',deadline,at:at!=null?at:deadline!=null?deadline:z==='late'&&dueDay?Date.parse(dueDay+'T00:00:00+09:00'):null,arrived:arrived(r&&r.created_at||d.assigned_at||d.created_at),
   head,site:d.nm,contact:[role,phone].filter(Boolean).join(' · ')||'연락처 미입력',check,source:'',done,retry,
   button:visit?'방문 결과 남기기':phone?'전화하기':'기록하기',mode:visit?'visit':phone?'call':'open',color:ctx.color(d),phone,taskId:n&&n.id||''};
 }
 /* 순서: 기한 지남(오래 지난 것 먼저) → 가까운 시각(약속 · 마감 · 재연락) → 시각 없는 것 → 들어온 순서 */
 function order(list){
  const key=i=>i.at!=null?i.at:Infinity;
  return list.slice().sort((a,b)=>(a.late===b.late?0:a.late?-1:1)||(key(a)-key(b))||(a.arrived-b.arrived)||String(a.site).localeCompare(String(b.site),'ko'));
 }
 function model(Z,ctx,opt){
  const now=(opt&&opt.now)||Date.now();
  const items=order([...Z.late.map(x=>x.inq?inqItem(x,ctx,now):dealItem('late',x,ctx,now)),...Z.now.map(x=>x.inq?inqItem(x,ctx,now):dealItem('now',x,ctx,now))]);
  const first=items[0];
  let line='';if(first){const t=first.late?'기한 지남 '+items.filter(i=>i.late).length+'건':first.mode==='visit'&&first.at?when(first.at,now)+' 방문':first.deadline?when(first.deadline,now)+' 마감':first.at?when(first.at,now):'오늘';line=items.length+'건 · '+t;}
  return {items,line,wait:Z.wait.length,fix:Z.fix.length,late:Z.late.length};
 }

 /* ── 그리기 ── 승인 틀(approved-a)의 머리 · 본문 · 탭 세 칸 구조를 그대로 써서 MobileApprovedBoot · 동선 보기 · 쪽 번호가 같이 붙는다 */
 const btn=(i,cls)=>'<span class="'+cls+'" data-gs="v5task" data-mode="'+i.mode+'" data-kind="'+i.kind+'" data-id="'+h(i.id)+'"'+(i.requestId?' data-request-id="'+h(i.requestId)+'"':'')+(i.taskId?' data-task-id="'+h(i.taskId)+'"':'')+' role="button" tabindex="0">'+h(i.button)+'</span>';
 function card(i){
  return '<div class="mv5-card'+(i.gray?' gray':'')+'" style="border-left-color:'+h(i.color||'#1f9d55')+'" data-v5-item="'+h(i.kind+':'+i.id)+'">'
   +'<span class="mv5-k'+(i.gray?' gray':i.late||/지남/.test(i.head)?' red':'')+'">'+h(i.head)+'</span>'
   +'<b class="mv5-site">'+h(i.site)+'</b><span class="mv5-contact">'+h(i.contact)+'</span>'
   +'<div class="mv5-check"><span>이번에 확인할 것</span><b>'+h(i.check||'—')+'</b>'+(i.source?'<em>'+h(i.source)+'</em>':'')+'</div>'
   +(i.retry?'<span class="mv5-retry">'+h(i.retry)+'</span>':'')
   +btn(i,'mv5-btn')+'</div>';
 }
 function row(i){
  return '<div class="mv5-row" data-v5-item="'+h(i.kind+':'+i.id)+'"><div class="mv5-row-t"><span class="mv5-k'+(i.gray?' gray':i.late?' red':'')+'">'+h(i.head)+'</span><b>'+h(i.site)+'</b><span class="mv5-row-c">'+h(i.check||'')+'</span></div>'+btn(i,'mv5-btn sm')+'</div>';
 }
 /* 회신 대기 · 기록 보완 목록 줄(mobile-guide-shell zoneRow 결과) — 누르면 예전과 같은 업무 열기(data-gs="task") */
 function zoneRow(t){
  return '<div class="mv5-row"><div class="mv5-row-t"><span class="mv5-k">'+h(t.due)+'</span><b>'+h(t.name)+'</b><span class="mv5-row-c">'+h([t.task,t.why].filter(Boolean).join(' · '))+'</span></div><span class="mv5-btn sm" data-gs="task" data-kind="'+h(t.kind)+'" data-id="'+h(t.id)+'"'+(t.requestId?' data-request-id="'+h(t.requestId)+'"':'')+' role="button" tabindex="0">'+h(t.button)+'</span></div>';
 }
 function render(M,S,extra){
  S=S||{};extra=extra||{};
  const it=M.items,first=it[0],second=it[1],rest=it.slice(1);
  let body='';
  body+='<div class="mv5-top"><span>지금 먼저 할 일</span><b>'+h(first?M.line:'지금 처리할 건이 없습니다')+'</b></div>';
  if(S.area==='wait'||S.area==='fix'){
   body+='<div class="mv5-sub"><span data-gs="area" data-value="now" role="button" tabindex="0">‹ 오늘</span><b>'+(S.area==='wait'?'고객 회신 대기 '+M.wait:'기록 보완 '+M.fix)+'</b></div>'+(extra.zoneRows||'');
  }else if(first){
   body+=card(first);
   body+='<div class="mv5-done"><span>끝나는 조건</span><b>'+h(first.done)+'</b></div>';
   /* 2026-10-22 대표 "그다음 n건이 숨겨져 있으면 안 본다": 나머지는 접지 않고 항상 줄로 보인다(한 쪽 20건 + 쪽 번호 — 목록 공통 규칙). '다음 · …' 미리보기 · [그다음 n건 ›] 펼침 없음 */
   if(rest.length){
    const P=w.ListPager,pg=P?P.cut(rest,S.v5page||1):{rows:rest.slice(0,20),pages:1};
    body+='<div class="mv5-sub"><b>그다음 '+rest.length+'건</b></div>'+pg.rows.map(row).join('');
    if(P&&pg.pages>1)body+=P.html(pg,{ns:'gs',unit:'건',small:true}).replace(/data-gs="page"/g,'data-gs="v5page"');
   }
  }
  if(M.wait||M.fix)body+='<div class="mv5-quiet"><span data-gs="area" data-value="wait" role="button" tabindex="0">고객 회신 대기 '+M.wait+'</span><span data-gs="area" data-value="fix" role="button" tabindex="0">기록 보완 '+M.fix+'</span></div>';
  const tabs=[['today','오늘'],['mine','내 현장'],['record','기록 · 등록'],['schedule','일정']].map(([k,l],n)=>'<span data-gs="tab" data-tab="'+k+'" role="button" tabindex="0"'+(n===0?' aria-current="page" class="on"':'')+'>'+l+'</span>').join('');
  return '<div class="approved-a mv5"><div class="mv5-head"><b>오늘</b><div style="flex:1"></div><span data-gs="v5perf" role="button" tabindex="0">성과 ›</span></div><div class="mv5-body">'+body+'</div><div class="mv5-nav">'+tabs+'</div></div>';
 }
 w.MobileV5Today=Object.freeze({on,model,render,zoneRow,order,taskAt,when,fmtPhone,summarize,_item:{inqItem,dealItem}});
})(window);
