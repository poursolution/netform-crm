/* 판정 하나 (2026-10-06 design_handoff_counting · 집계 · 판정 정리) — 파이프라인 목록(v11 줄) · 오늘 업무 · 상세(지금 할 일) · 관리팀 KPI · 주간 브리핑이 같은 함수로 센다.
   ② 다음 업무 판정 = 근거 기준: 다음 행동일 → 그 단계의 근거 날짜(미팅 완료일 · 견적 요청일 · 발송일 · 입찰 마감 · 계약일 · 마지막 연락) → 없으면 '… 없음'. 목록 줄 아래 회색 한 줄 '판정: …'.
   ③ 최근 연락 두 줄 = ContactState.lines(연락 시도 / 실제 연결) — 부재 · 문자 = 시도.
   ④ 기한 상태 3가지: 'n일 지남'(빨강) / '기한 없음 · 정하기'(회색 · 근거 날짜는 있는데 기한을 안 정함) / '기록 없음 · 기한 계산 안 함'(회색 · 근거 날짜 자체가 없음 → 지연 · 기준 넘김 · 놓침 집계 제외).
   ⑤ 주간 기준 = 월~금(KPI · 주간 브리핑 같음). ⑥ 같은 이름 지표 = 같은 분모: 다음 행동 등록률 = 진행 중 영업건 전체(과거 이관 제외).
   끄기: G.judgeOff=true → 목록 줄의 판정 줄 · 두 줄 연락이 빠지고 예전 한 줄 */
(function(root){
 'use strict';
 const on=()=>!(root.G&&root.G.judgeOff);
 const KST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 const dayKey=v=>{const s=String(v||'');if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const t=Date.parse(s);return Number.isFinite(t)?KST.format(new Date(t)):'';};
 const md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey(v));return m?(+m[2])+'.'+(+m[3]):'';};
 const addDays=(k,n)=>{const d=new Date(k+'T00:00:00');d.setDate(d.getDate()+n);return KST.format(d);};
 const daysTo=v=>{const k=dayKey(v);if(!k)return null;const n=root.daysTo?root.daysTo(k):Math.round((Date.parse(k+'T00:00:00')-Date.parse(KST.format(new Date())+'T00:00:00'))/864e5);return Number.isFinite(n)?n:null;};
 const R=()=>root.OPS_RULES||{},N=(k,d)=>Number(R()[k])||d;
 const rules=()=>({quote:N('quoteDays',3),follow:N('sentFollowDays',7),month:N('monthContactDays',30),wait:N('waitContactDays',60),site:N('siteVisitDays',7)});
 const patch=d=>{try{return (root.itemPatch&&root.itemPatch(d,'deal'))||{};}catch(e){return {};}};
 const ctxAll=d=>{const p=patch(d);return d.stage_contexts||p.stage_contexts||{};};
 const fld=(d,stage,k)=>{const c=ctxAll(d)[stage];return c&&c.fields?c.fields[k]:undefined;};
 const anyFld=(d,k)=>{const c=ctxAll(d);return Object.keys(c).map(s=>c[s]&&c[s].fields&&c[s].fields[k]).find(v=>v!=null&&v!=='');};
 const nextOf=d=>{let a=null;try{a=root.actionObj?root.actionObj(d,patch(d)):null;}catch(e){}return a&&(a.text||a.due)?{text:String(a.text||'').trim(),due:dayKey(a.due||a.due_at||'')}:null;};
 const groupOf=d=>{try{return root.PipelineStages.group(root.dealStage(d))||'';}catch(e){return '';}};
 const acts=d=>{const p=patch(d);return [].concat(d.activities||[],p.activities||[]);};
 const lastActAt=(d,re)=>acts(d).filter(a=>a&&re.test(String(a.type||'')+' '+String(a.note||''))).map(a=>dayKey(a.at||a.occurred_at||a.created_at)).filter(Boolean).sort().pop()||'';
 const lastContactAt=d=>{try{const v=root.ContactState.of(d,'deal');return dayKey(v.lastConnectedAt||v.lastAttemptAt||'');}catch(e){return '';}};
 /* ── ② 다음 업무 판정(근거) ── */
 function basis(d,key){
  if(!d||typeof d!=='object')return {kind:'norecord',why:'자료 없음',due:'',n:null};
  const Q=rules(),nx=nextOf(d);
  if(nx&&nx.due)return {kind:'date',why:'다음 행동일 '+md(nx.due),due:nx.due,n:daysTo(nx.due),src:'next'};
  const g=key||groupOf(d),D=(label,k,plus)=>{const due=plus?addDays(k,plus):k;return {kind:'date',why:label+' '+md(k)+(plus?' + '+plus+'일':''),due,n:daysTo(due),src:'stage'};};
  /* 2026-10-07 design_handoff_ops_12 A①②: 세 화면 같은 문장 — none = 날짜 미입력(지연 아님 · fix = 보완 단추 · rec = 추천 행동) / norecord = 판정 불가(이관 전 기록 등 · 지연 · 평가 제외 → 데이터 검토) / na = 기한을 세지 않는 단계(수주 · 실주) */
  const none=(why,fix,rec)=>({kind:'none',why,fix,rec,due:'',n:null,src:'stage'});
  const nr=(why)=>({kind:'norecord',why,rec:'데이터 검토에서 이관 전 기록 확인',due:'',n:null,src:'stage'});
  const na=(why)=>({kind:'na',why,due:'',n:null,src:'stage'});
  const lc=lastContactAt(d);
  if(g==='consulting'){const qd=dayKey(fld(d,'consulting','quote_due')||'');if(qd)return D('견적 기한',qd,0);
   const mt=dayKey(fld(d,'consulting','meeting_date')||fld(d,'first_contact','meeting_date')||'')||lastActAt(d,/방문|미팅|실측|실사/);if(mt)return D('미팅 완료',mt,Q.quote);
   return lc?none('미팅 일정 미등록 · 견적 기한 계산 안 함','미팅 일정 입력','미팅 여부 확인 → 일정 등록 또는 보류 사유 등록'):nr('판정 불가 · 미팅 · 연락 기록 없음(이관 전 기록 확인)');}
  if(g==='sent'){const sd=dayKey(fld(d,'sent','sent_date')||'');if(sd)return D('발송',sd,Q.follow);const fu=dayKey(fld(d,'sent','followup_date')||'');if(fu)return D('후속 확인일',fu,0);return lc?none('발송일 미등록 · 후속 기한 계산 안 함','발송일 입력','발송 여부 확인 → 발송일 등록 또는 보류 사유 등록'):nr('판정 불가 · 발송일 · 연락 기록 없음(이관 전 기록 확인)');}
  if(g==='relationship'){const rs=dayKey(fld(d,'waiting','resume_date')||'');if(rs)return D('재개일',rs,0);if(lc)return D('마지막 연락',lc,Q.month);return nr('판정 불가 · 연락 기록 없음(이관 전 기록 확인)');}
  if(g==='competition'){const bd=dayKey(anyFld(d,'bid_deadline')||anyFld(d,'decision_date')||anyFld(d,'briefing_date')||anyFld(d,'meeting_date')||'');if(bd)return D('마감 · 결정 일정',bd,0);return lc?none('결정 일정 미등록 · 마감 기한 계산 안 함','결정 일정 입력','결정 일정 확인 → 일정 등록 또는 보류 사유 등록'):nr('판정 불가 · 결정 일정 · 연락 기록 없음(이관 전 기록 확인)');}
  if(g==='construction'){const st=dayKey(fld(d,'construction','start_date')||'');if(st)return D('착공',st,Q.site);const cd=dayKey(fld(d,'contract','contract_date')||d.contract_date||'');if(cd)return D('계약',cd,0);return lc?none('계약일 미등록 · 기한 계산 안 함','계약일 입력','계약 여부 확인 → 계약일 등록'):nr('판정 불가 · 계약일 · 연락 기록 없음(이관 전 기록 확인)');}
  /* 수주 · 실주: 기한을 세지 않는다(준공 · 실주일은 근거로만) */
  if(g==='won'){const cp=dayKey(d.completion_date||fld(d,'completion','completion_date')||'');return na(cp?'준공 '+md(cp)+' · 기한 없음':'준공일 미등록 · 기한 없음');}
  if(g==='lost'){const cl=dayKey(d.closed_at||d.closed||'');return na(cl?'실주 '+md(cl)+' · 기한 없음':'실주일 미등록 · 기한 없음');}
  const ag=dayKey(root.inquiryAssignedAt&&d.assigned_at?d.assigned_at:'');if(ag)return D('배정',ag,0);
  return lc?none('기한 미등록 · 기한 계산 안 함','기한 정하기','다음 행동 · 날짜 등록'):nr('판정 불가 · 배정일 · 연락 기록 없음(이관 전 기록 확인)');
 }
 /* ── ④ 기한 상태 3가지(ops_12 A②: 기한 초과 / 날짜 미입력 / 판정 불가 · 수주 · 실주는 기한 없음) ── */
 function dueText(b){
  if(!b||b.kind==='norecord')return '판정 불가 · 기한 계산 안 함';
  if(b.kind==='na')return '기한 없음';
  if(b.kind!=='date'||b.n==null)return '날짜 미입력 · 기한 계산 안 함';
  const n=b.n,m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey(b.due));return n<0?(-n)+'일 지남':n===0?'오늘까지':n===1?'내일까지':(m?(+m[2])+'/'+(+m[3]):md(b.due))+'까지';
 }
 const dueClass=b=>!b||b.kind!=='date'||b.n==null?'g':b.n<0?'r':'';
 const isLate=b=>!!(b&&b.kind==='date'&&b.n!=null&&b.n<0);
 const STATE={late:'기한 초과',ok:'기한 내',nodate:'날짜 미입력',norecord:'판정 불가',na:'기한 없음'};
 const state=b=>{const k=!b||b.kind==='norecord'?'norecord':b.kind==='na'?'na':b.kind!=='date'||b.n==null?'nodate':b.n<0?'late':'ok';return {key:k,label:STATE[k]};};
 /* 한 묶음의 분해(단계 진단 '기준 넘김' 아래 · 리포트): 기한 초과 n · 날짜 미입력 n · 판정 불가 n — 합 = 전체 */
 function tally(list,key){const t={late:0,ok:0,nodate:0,norecord:0,na:0,total:0};(list||[]).forEach(d=>{if(!d)return;t[state(basis(d,key)).key]++;t.total++;});return t;}
 const tallyText=t=>t?'기한 초과 '+t.late+' · 날짜 미입력 '+t.nodate+' · 판정 불가 '+t.norecord:'';
 /* 세 화면(목록 줄 · 오늘 업무 · 상세 · 지금 할 일 카드)이 같은 한 줄: '판정: 근거 → 추천 행동' */
 const line=b=>{if(b&&typeof b==='object'&&!('kind' in b))return '';const x=b&&b.kind?b:null;return x?'판정: '+x.why+(x.rec?' → '+x.rec:''):'';};
 /* ── ③ 최근 연락 두 줄 ── */
 function touchLines(d){
  const CS=root.ContactState;if(!CS)return {attempt:'CRM 연락 기록 없음',connect:'실제 연결 없음',hasAttempt:false,hasConnect:false};
  const L=CS.lines(d,'deal'),a=L[0],c=L[1];
  return {attempt:a.empty?a.text:'최근 연락 시도 '+a.text,connect:c.empty?'실제 연결 없음':'최근 실제 연결 '+c.text,hasAttempt:!a.empty,hasConnect:!c.empty};
 }
 /* ── ⑤ 주간 범위(월~금) ── */
 function week(offset){
  const n=new Date(),d=new Date(n.getFullYear(),n.getMonth(),n.getDate()),dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow+7*(Number(offset)||0));
  const mon=KST.format(d);return {mon,fri:addDays(mon,4),label:md(mon)+'(월) – '+md(addDays(mon,4))+'(금)'};
 }
 const inWeek=(v,w)=>{const k=dayKey(v);w=w||week(0);return !!k&&k>=w.mon&&k<=w.fri;};
 /* ── ⑥ 같은 분모: 다음 행동 등록률 = 진행 중 영업건 전체(과거 이관 제외) ── */
 const TARGET={nextRate:'진행 중 영업건 전체(과거 이관 제외) · 오늘 업무 · KPI 같은 값',sameDay:'이번 주 접수 견적문의 · 휴지통 제외',firstContact:'이번 주 배정된 견적문의',activity:'진행 중 영업건(과거 이관 제외) · 최근 7일 기록',stale:'컨설팅 설계 · 관계관리 진행 건',quote3:'1차 미팅을 마친 컨설팅 설계 건',lostReason:'실주 처리된 영업건',action:'최근 28일 관리팀 요청'};
 function nextRate(deals){
  const PS=root.PipelineScope,open=d=>{try{return root.isOpen(d);}catch(e){return false;}},legacy=d=>{try{return !!(PS&&PS.on()&&PS.isLegacy(d));}catch(e){return false;}};
  const den=(deals||[]).filter(d=>d&&open(d)&&!legacy(d)),num=den.filter(d=>{const x=nextOf(d);return !!(x&&x.text&&x.due);});
  return {num:num.length,den:den.length,pct:den.length?Math.round(num.length*100/den.length):null,target:TARGET.nextRate,list:den.filter(d=>!num.includes(d))};
 }
 root.PipelineJudge={on,basis,dueText,dueClass,isLate,state,STATE,tally,tallyText,line,touchLines,week,inWeek,dayKey,md,nextRate,TARGET,rules};
})(window);
