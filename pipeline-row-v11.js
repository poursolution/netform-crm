/* 파이프라인 단계별 화면 · '확인할 현장' 목록 줄 v11 (2026-10-06 design_handoff_pipeline_v11 · 시안 '컨설팅 설계 목록 v11.dc.html' · 같은 날 대표 지시 2: 줄 펼침 없이 누르면 바로 영업건 상세)
   목록 줄만 바꾼다 — 위 필터 · 상태 4칸 · 왼쪽 단계 진단 · 왜 멈춰 있나 · 그래서 뭘 해야 하나 · 리스트/보드 전환은 그대로(pipeline-stage-v3.js · 수주 · 실주는 pipeline-stage-b.js).
   줄 = 4칸: 현장 · 담당(현장명 / 브랜드 색 글자 · 공종 · 담당 — 미배정은 빨강) | 현재 상황(한 줄 상태 / 최근 연락 YYYY.M.D · CRM 연락 기록 없음)
            | 다음 업무 · 기한(업무 / n일 지남(빨강) · 오늘까지 · 내일까지 · M/D까지 · 기한 없음 · 정하기) | 흰 버튼 1개(업무 동사). 위에 칸 이름 줄 · 왼쪽 3px 브랜드 띠.
   줄을 누르면 바로 그 영업건 상세 창(펼침 없음). 버튼은 새 상세의 그 자리(연락 기록 · 일정 등록 = 가운데 입력칸 · 담당 배정 = 담당 정하는 칸 · 연락처 찾기 = 연락처 등록 칸).
   정렬 = 기한 급한 순(지난 것 → 오늘 → 가까운 날 → 기한 없음). 강조색은 기한 지남 · 미배정의 빨강 하나. 숫자 · 글은 전부 자료에서(단계 필드 · 다음 할 일 · 접촉 기록 · 연락처).
   전 단계(컨설팅 설계 · 자료 발송완료 · 관계관리 · 경쟁·입찰 · 계약·시공 · 수주 · 실주) 같은 줄 구조 — 칸 내용만 그 단계 자료. 끄기: G.pipeRowV11Off=true → 예전 줄 */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const on=()=>!root.G.pipeRowV11Off;
 const patchOf=d=>{try{return root.itemPatch(d,'deal')||{};}catch(e){return {};}};
 const dayNum=v=>{if(!v)return null;const n=root.daysTo(String(v).slice(0,10));return Number.isFinite(n)?n:null;};
 /* 날짜는 한국 시간 기준(2026-10-07 stage7 공통 · 하루 차이 원인 = 시각 붙은 값을 UTC 로 자르던 것) */
 const KD=v=>{const J=root.PipelineJudge;return J&&J.dayKey?(J.dayKey(v)||String(v||'')):String(v||'');};
 const ymdDot=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(KD(v));return m?+m[1]+'.'+(+m[2])+'.'+(+m[3]):'';};
 const md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(KD(v));return m?(+m[2])+'/'+(+m[3]):'';};
 const workOf=r=>{let w='';try{w=root.dealWorkSummary(r.item)||'';}catch(e){}return !w||/미분류|미기록|미입력/.test(w)?'공종 미분류':w;};
 const telOf=d=>{try{const c=root.contactInfo(d,patchOf(d))||{};return String(c.mobile||c.officeTel||d.office_phone||'').replace(/[^0-9+]/g,'');}catch(e){return '';}};
 /* 최근 연락 = 연락을 시도한 기록까지 포함(부재 · 문자 발송도 연락한 날이다). 기록이 없으면 그 줄의 마지막 접촉일 */
 const TOUCH=['전화','문자','카카오','카톡','방문','이메일','메일','통화'];
 const lastTouch=r=>{let best=String(r.last||'').slice(0,10);try{(Array.isArray(r.item.activities)?r.item.activities:[]).forEach(a=>{const t=String(a&&a.type||''),at=String(a&&(a.at||a.occurred_at)||'').slice(0,10);if(at&&TOUCH.some(k=>t.includes(k))&&at>best)best=at;});}catch(e){}return /^\d{4}-\d{2}-\d{2}/.test(best)?best:'';};
 /* 기록이 없다는 것은 'CRM 에 없다'는 뜻이다(연락을 안 했다고 단정하지 않는다 — 2026-10-05 정합성 ①) */
 const NOLOG='CRM 연락 기록 없음';
 const dueText=(n,due)=>n==null?'기한 없음 · 정하기':n<0?(-n)+'일 지남':n===0?'오늘까지':n===1?'내일까지':md(due)+'까지';
 /* 기한 급한 순: 지난 것(많이 지난 순) → 오늘 → 가까운 날 → 기한 없음. 같은 기한은 넘겨받은 순서 그대로 */
 function sort(list,rowOf){
  return list.map((x,i)=>{const r=rowOf(x),n=r&&r.due?dayNum(r.due):null;return {x,i,n:n==null?1e9:n};}).sort((a,b)=>a.n-b.n||a.i-b.i).map(o=>o.x);
 }
 const head=()=>'<div class="prv-head" role="row"><span>현장 · 담당</span><span>현재 상황</span><span>다음 업무 · 기한</span><span></span></div>';
 /* o = {r(행), now(한 줄 상태), task(다음 업무 — 등록된 다음 할 일이 없을 때), btn[이름, 동작], closed(수주 · 실주), tab}
    ns = 그 화면의 누름 속성 이름(ps3 · psb — 줄 = data-ns="open" · 버튼 = data-ns="act"), cls = 그 화면의 줄 클래스(예전 선택자 유지) */
 function row(o,ns,cls){
  const r=o.r,d=r.item,bc=BRAND[d.brand]||'',owner=String(r.owner||'').trim(),noOwner=!o.closed&&(!owner||owner==='미배정');
  const due=r.due?dayNum(r.due):null,hasNext=!!(r.next&&r.next.text);
  let btn=o.btn||['열기',''];const contactAct=btn[1]==='next'||btn[1]==='activity';
  if(noOwner)btn=['담당 배정','owner'];else if(!o.closed&&contactAct&&!telOf(d))btn=['연락처 찾기','contact'];
  const now=noOwner?'담당자 미지정':(o.now||'');
  /* decision_collab ②③: '현재 상황' 앞 막힌 곳 꼬리표([고객] / [내부 · 견적팀] / [내부 · 자료 부족]) · 뒤에 '연락 n회 · 진척 없음 n일'(주황) */
  let tagHtml='',staleHtml='';try{const DC=root.DecisionCollab,tg=DC&&DC.on()&&!noOwner?DC.tags(d):null;if(tg&&tg.block)tagHtml='<em class="dcb-tag'+(tg.block==='고객'?'':' in')+'">'+h(tg.block)+'</em>';if(tg&&tg.stale)staleHtml='<small class="dcb-stale" title="'+attr(tg.stale)+'">'+h(tg.stale)+'</small>';}catch(e){}
  /* stage7 ⑤: 세부 상태가 정한 업무가 등록된 다음 할 일보다 앞설 때(o.forceTask — 예: 계약 확인이 끝난 건의 '계약 체결 확인' → '주간 현장 방문') · 이전 업무는 o.staleNext 로 '종료 대상' 표시 */
  const task=noOwner?'담당자 배정':hasNext&&!o.forceTask?String(r.next.text).trim():(o.task||''),lt=lastTouch(r),last=lt?'최근 연락 '+ymdDot(lt):NOLOG;
  const key=attr(r.key),A='data-'+ns;
  /* 판정 하나(2026-10-06 집계 · 판정 정리 · pipeline-judge.js): 최근 연락 두 줄(시도 / 실제 연결) · 기한 상태 3가지 · 다음 업무 아래 '판정: 근거' */
  const J=root.PipelineJudge&&root.PipelineJudge.on()?root.PipelineJudge:null,jb=J&&!noOwner?J.basis(d,o.stage):null,tl=J?J.touchLines(d):null;
  /* 2026-10-07 대표 "내용 넘어가는 것 하지 말아": 보완 단추([발송일 입력] 등)가 같이 있는 줄은 근거만 — 추천 행동 문구는 단추 이름과 같은 말이라 줄이 길어지기만 한다 */
  const jl=jb?(jb.fix?'판정: '+jb.why:J.line(jb)):'';
  /* ops_12 A①②: '판정: 근거 → 추천' 한 줄은 오늘 업무 · 상세와 같은 함수(PipelineJudge.line) · 날짜 미입력이면 보완 단추([발송일 입력] 등 → 상세의 이 단계 필수 정보) */
  const dueHtml=o.dueText?'<small class="'+attr(o.dueClass||'')+'">'+h(o.dueText)+'</small>'+(jb?'<small class="why">'+h(jl)+'</small>':'')/* 관계관리 v12: 상태 주기로 정한 기한 글 */:jb?'<small class="'+J.dueClass(jb)+'">'+h(J.dueText(jb))+'</small><small class="why">'+h(jl)+(jb.fix?' <u '+A+'="fix" data-key="'+key+'" role="button" tabindex="0">'+h(jb.fix)+'</u>':'')+'</small>':'<small class="'+(due!=null&&due<0?'r':due==null?'g':'')+'">'+h(dueText(due,r.due))+'</small>';
  const lastHtml=tl?'<small title="'+attr(tl.attempt)+'">'+h(tl.attempt)+'</small><small class="cn'+(tl.hasConnect?'':' none')+'">'+h(tl.connect)+'</small>':'<small>'+h(last)+'</small>';
  return '<div class="prv-row '+(cls||'')+'" role="row" tabindex="0" '+A+'="open" data-key="'+key+'"'+(o.tab!=null?' data-tab="'+attr(o.tab)+'"':'')+' style="border-left-color:'+(bc||'#e3e6ec')+'">'
   +'<div class="prv-a"><b title="'+attr(r.site)+'">'+h(r.site)+(root.advisoryBadge?root.advisoryBadge(d):'')+'</b><span><em style="color:'+(bc||'#9ca3af')+'">'+h(d.brand||'브랜드 미지정')+'</em> · '+h(workOf(r))+' · <i'+(noOwner?' class="r"':'')+'>'+h(owner||'미배정')+'</i></span>'+(o.tag?'<em class="prv-tag '+attr(o.tagClass||'')+'">'+h(o.tag)+'</em>':'')+'</div>'
   +'<div class="prv-b"><span title="'+attr(now)+'">'+tagHtml+h(now)+'</span>'+staleHtml+lastHtml+(o.base?'<small class="base" title="'+attr(o.base)+'">'+h(o.base)+'</small>':'')+'</div>'
   +'<div class="prv-c"><b'+(task?'':' class="none"')+' title="'+attr(task)+'">'+h(task||'다음 업무 없음')+'</b>'+dueHtml+(o.staleNext?'<small class="why stale" title="'+attr(o.staleNext)+'">'+h(o.staleNext)+'</small>':'')+'</div>'
   +'<button type="button" '+A+'="act" data-key="'+key+'" data-v="'+attr(btn[1])+'">'+h(btn[0])+'</button></div>';
 }
 root.PipelineRowV11={on,head,row,sort,dueText};
})(window);
