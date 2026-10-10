/* 운영 기준 설정 화면 (2026-10-04 디자인 핸드오프 'design_handoff_rules' · 운영 기준 설정.dc.html) — 사이드바 '설정 → 운영 기준 설정' · 관리자 전용
   왼쪽 목차 7묶음 + 꼬리표 설명 + 마지막 변경 · 변경 이력, 오른쪽 항목 줄(확정 = 잠금 "정책 항목 · 설정 변경 불가" / 조건부 = − + 숫자 · 토글 · 칩 추가 / 보류 = 꺼짐 고정).
   값을 바꾸면 '변경됨' + 영향 한 줄 + 아래 남색 띠 [되돌리기] [저장]. 저장 = 서버(crm_ops_rules_v1)가 확인한 값만 모든 화면에 적용 + 변경 이력.
   값과 항목표는 CRMRules(ops-rules.js) 한곳에서 온다.
   2026-10-10 admin_request E · promise_gap ③: 한 줄 = 값 · 확정 상태(회의 확정 / 잠정 / 근거 확인 필요 / 해석 미확정) · 적용 상태(적용 중 / 임시 적용 / 값만 저장) · 계산 시작점 · 예외.
   상단 "적용 중 n · 값만 저장 n · 확정 전 n · 기준 vN". [저장]을 누르면 적용 범위 확인(바꾸는 것 전 → 후 · 적용일 · 대상 · 기존 업무 처리 3택)을 거쳐 보내고, 이력에 누가 · 언제 · 무엇 · 적용일 · 대상 · 선택이 남는다.
   기준을 바꿔도 지난 요청의 기한 · 판정은 다시 계산하지 않는다(기준 버전 보존). */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v)),CR=()=>R.CRMRules;
 const TAG={fix:['확정','#374151','#eef0f3'],cond:['조건부','#1d3f99','#eef3fe'],hold:['보류','#c0392b','#fdeceb']};
 /* 지금 화면 계산에 실제로 쓰이는 항목(ops_12 B⑤ '적용 중' 알약 · 코드 대조: CRMRules.get · OPS_RULES sync 로 읽히는 열쇠) — 나머지는 '값만 저장' */
 const WIRED=new Set(['approvers','stage_gates','assign_minutes','first_contact_hours','inactive_days','quote_followup_days','long_wait_contact_days','care_focus_months','care_general_months','unreachable_attempts','unreachable_interval_days','transfer_result_check_days','reasons_bad_fit','reasons_lost','reasons_transfer','contact_channels','owner_keep_on_reassign','auto_owner_attribution','record_deadline_hour','important_request_kinds']);
 /* 확정 상태 4가지(시안 E): 회의 확정 / 잠정 / 근거 확인 필요 / 해석 미확정 — 항목마다 [상태, 계산 시작점 · 예외 · 출처]. 모르는 항목에는 만들어 넣지 않는다. 키 = 항목 열쇠, 열쇠가 없는 안내 줄은 이름 */
 const CSTATE={'회의 확정':['#1f7a4d','#e8f6ee'],'잠정':['#8a5a00','#fff4d6'],'근거 확인 필요':['#b42318','#fdecec'],'해석 미확정':['#8a5a00','#fff4d6']};
 const META={
  assign_minutes:['회의 확정','접수 시각부터 · 2026-10-02 회의 지침'],
  first_contact_hours:['회의 확정','배정 시각부터 · 최초 응대 시각은 1회만 저장 · 2026-10-02 회의 지침'],
  quote_followup_days:['회의 확정','실제 발송일부터 · 발송일 없으면 판정 제외(지연으로 세지 않음) · 2026-10-02 회의'],
  inactive_days:['회의 확정','마지막 기록부터 · 내부 메모는 고객 접촉으로 세지 않음'],
  '고객관리 기간':['해석 미확정','2026-10-02 회의 지침 · 연락 주기와 관리 기간을 구분'],
  care_focus_months:['잠정','견적 발송일부터 · 1개월=30일 환산 · 평가 제외 · 10/16 후속 논의 예정(확정일 아님)'],
  care_general_months:['해석 미확정','발송일부터 총 3개월 / 집중 후 3개월 중 결정 필요 · 지금은 총 기간으로 계산 · 자동 상태 전환 없음'],
  long_wait_contact_days:['회의 확정','회의: 달력 2개월 1회(60일 아님) · 고객 약속일 우선 · 현재 계산은 설정 일수 → 달력 환산 확인 필요'],
  unreachable_attempts:['근거 확인 필요','회의는 "며칠 간격 약 3회" · 최초 문의만 · 자동 종결 없음'],
  unreachable_interval_days:['근거 확인 필요','기본 1일은 회의에서 확정한 간격이 아님 · 최초 실제 연결 전 문의만'],
  ongoing_unreachable_attempts:['회의 확정','2026-10-02 회의 "월 간격 약 3회" · 견적 후 연락두절은 별도 기준 · 화면 연결 필요'],
  record_deadline_hour:['회의 확정','영업일 기준 · 기록 점검 시각 · 응대를 미뤄도 된다는 뜻 아님'],
  quote_request_days:['잠정','운영 제안 · 회의 확정 전'],
  reasons_lost:['회의 확정','\'사업 · 연기\' · \'사업 · 예산 미확정\'은 실주 대신 보류 검토 안내(기회 상실이 확인된 건만 실주)'],
  auto_owner_attribution:['근거 확인 필요','승인 근거 확인 필요 · 현재 후보 기준은 최초 실제 연결'],
  '귀속 기준':['해석 미확정','주담당 = 문의 수신 · 배정 · 실제 연결 중 어느 시점인지 확정 필요'],
  important_request_kinds:['잠정','기본값 = 관리자 첫 연락 요청(2026-10-10 대표 지정) · 입찰 · 계약 기한 변경 팝업은 기한 변경 사건이 저장된 뒤 · 확인 전까지 미확인 목록에 남음']};
 const CONF=r=>META[r.k||r.l]||null;
 /* counting 15(2026-10-10): '켜짐' 하나로 보이던 것을 3칸으로 — 정책(확정 / 확정 전) · 누락 진단(판정 · 진단 함수가 이 값을 읽는가) · 입력 강제(입력 화면이 이 값으로 막는가).
    코드 대조로만 적는다: DIAG = 오늘 업무 · 파이프라인 · KPI 판정이 읽는 값 / FORCE = 단계 이동 · 사유 · 승인 · 연락 수단 입력이 읽는 값 / PART = 일부 화면만. 나머지는 미연결 */
 const DIAG=new Set(['assign_minutes','first_contact_hours','unreachable_attempts','unreachable_interval_days','inactive_days','quote_followup_days','record_deadline_hour','care_focus_months','care_general_months','long_wait_contact_days','transfer_result_check_days','next_action_required']);
 const FORCE=new Set(['stage_gates','reasons_bad_fit','reasons_lost','reasons_transfer','contact_channels','approvers']),PART={next_action_required:'응대 기록 저장만 · 단계 이동 창은 미연결'};
 const NEXT_WIRE=['next_action_required','year_future_skip_focus','ongoing_unreachable_attempts'];
 function three(r){if(!r.k||r.st==='hold')return null;const c=CONF(r),pol=(c?c[0]==='회의 확정':r.st==='fix')?'확정':'확정 전',d=DIAG.has(r.k)?'적용':'미연결',f=FORCE.has(r.k)?'적용':PART[r.k]?'일부':'미연결';return {pol,d,f,ft:PART[r.k]||''};}
 const threeHtml=r=>{const t=three(r);if(!t)return '';const cell=(l,v,ti)=>'<i class="'+(v==='적용'||v==='확정'?'on':v==='일부'?'part':'off')+'"'+(ti?' title="'+attr(ti)+'"':'')+'><u>'+l+'</u>'+v+'</i>';return '<span class="ra-3" aria-label="연결 상태">'+cell('정책',t.pol)+cell('누락 진단',t.d)+cell('입력 강제',t.f,t.ft)+'</span>';};
 /* 적용 예정: 값은 저장되지만 아직 어느 화면 계산에도 안 쓰이는 규칙 + 앞으로 들어갈 화면 */
 const TARGET={next_action_required:'단계 이동 창',year_required_on_convert:'관계관리 재분류',owner_change_log:'상세 담당 변경',ongoing_unreachable_attempts:'관계관리 · 진행 중 연락두절 판정'};
 /* 적용 상태 3가지(시안 E): 적용 중 / 임시 적용 / 값만 저장 */
 const ASTATE={'적용 중':['#1f7a4d','#e8f6ee'],'임시 적용':['#8a5a00','#fff4d6'],'값만 저장':['#6b7280','#f3f4f6']};
 const applyOf=r=>!r.k||r.st==='hold'?'':!WIRED.has(r.k)?'값만 저장':['care_focus_months','care_general_months','long_wait_contact_days'].includes(r.k)?'임시 적용':'적용 중';
 const PILL=(a,key)=>a?'<span class="ra-pill" style="color:'+ASTATE[a][0]+';background:'+ASTATE[a][1]+'">'+h(a)+(key==='unreachable_interval_days'&&a==='적용 중'?' · 설정값':'')+'</span>':'';
 function st(){const g=R.G;if(!g.rulesAdmin)g.rulesAdmin={draft:{},adding:'',busy:false,err:'',confirm:null};return g.rulesAdmin;}
 const admin=()=>{try{return !!R.todayIsAdmin();}catch(e){return false;}};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const cur=k=>{const S=st();return Object.prototype.hasOwnProperty.call(S.draft,k)?S.draft[k]:CR().get(k);};
 function setDraft(k,v){const S=st();if(same(v,CR().get(k)))delete S.draft[k];else S.draft[k]=v;S.err='';S.confirm=null;}
 const show=v=>Array.isArray(v)?(v.length?v.join(' · '):'(비어 있음)'):typeof v==='boolean'?(v?'켜짐':'꺼짐'):String(v);
 const KST=d=>{const t=new Date((d||new Date()).getTime()+9*36e5);return t.toISOString().slice(0,10);};
 /* 영향 한 줄: 계산할 수 있는 것은 실제 자료로, 아니면 바뀌는 동작을 그대로 적는다 */
 function unassignedOver(minutes){
  let n=0;try{const now=Date.now();(R.operationalInquiries(R.B.inquiries||[])||[]).forEach(q=>{if(R.inquiryAssigned(q))return;if(R.inqCtlConverted(q))return;if(typeof R.isClosedInq==='function'&&R.isClosedInq(q))return;const t=Date.parse(R.inquiryCreatedAt(q)||'');if(Number.isFinite(t)&&(now-t)/6e4>minutes)n++;});}catch(e){return null;}
  return n;
 }
 function impact(r,v){
  const base=CR().get(r.k);if(same(v,base))return '';
  if(r.k==='assign_minutes'){const a=unassignedOver(base),b=unassignedOver(v);return a===null||b===null?'접수 후 '+v+'분이 지나면 배정 필요로 표시됩니다':'바꾸면 지금 배정 기준을 넘긴 문의 '+a+'건 → '+b+'건';}
  if(r.k==='unreachable_attempts')return '최초 연결 전 '+v+'회 시도 이력으로 검토 제안합니다 · 자동 종결 없음';
  if(r.k==='unreachable_interval_days')return '시도와 시도 사이를 '+v+'일로 봅니다';
  if(r.k==='long_wait_contact_days')return '장기 대기 고객 후속 확인 간격이 '+v+'일로 바뀝니다';
  if(r.k==='transfer_result_check_days')return '이관 후 '+v+'일에 담당자 오늘 업무에 결과 확인 생성';
  if(r.k==='nearby_radius_km')return '반경 '+v+'km 안의 현장이 지도에 표시됩니다';
  if(r.k==='record_deadline_hour')return '견적문의 머리 줄의 기록 점검 시각이 '+v+'시로 바뀝니다';
  if(r.k==='ongoing_unreachable_attempts')return '값만 저장됩니다 · 관계관리 판정 연결 전';
  return '';
 }
 /* 적용 대상(promise_gap ③): 단계 · 조건 · 건수 — 지금 자료에서 셀 수 있는 것만 숫자로, 아니면 '건수 계산 없음' */
 function countDeals(f){try{return (R.B.deals||[]).filter(d=>{try{return R.isOpen(d)&&f(d);}catch(e){return false;}}).length;}catch(e){return null;}}
 function scopeOf(k,v){
  const n=x=>x==null?'건수 계산 없음':x+'건';
  if(k==='assign_minutes')return '견적문의 · 미배정 · 접수 후 '+v+'분 넘김 '+n(unassignedOver(v))+' (지금 기준 '+n(unassignedOver(CR().get(k)))+')';
  if(['care_focus_months','care_general_months','long_wait_contact_days'].includes(k))return '관계관리 진행 건 · '+n(countDeals(d=>['rapport','silent','waiting'].includes(String(R.dealStage(d)))));
  if(k==='unreachable_attempts'||k==='unreachable_interval_days'){let c=null;try{c=(R.operationalInquiries(R.B.inquiries||[])||[]).filter(q=>{try{return !R.inqCtlFirstResponseAt(q)&&!R.inqCtlConverted(q)&&!(typeof R.isClosedInq==='function'&&R.isClosedInq(q));}catch(e){return false;}}).length;}catch(e){}return '견적문의 · 첫 연락 전 '+n(c);}
  if(k==='transfer_result_check_days')return '타사 이관 등록 건 · 건수 계산 없음';
  if(k==='nearby_radius_km'||k==='nearby_map')return '영업건 상세 지도 · 건수 해당 없음';
  if(k==='record_deadline_hour')return '견적문의 머리 줄 표시 · 건수 해당 없음';
  if(k==='ongoing_unreachable_attempts')return '화면 연결 전 · 대상 없음';
  if(k==='important_request_kinds')return '받는 사람의 요청 알림 방식 · 새 요청부터';
  const r=CR().SPEC[k];return r&&r.type==='chips'?'선택 목록 · 건수 해당 없음':'새 저장부터 · 건수 계산 없음';
 }
 /* ② 다시 계산 미리보기: 건수를 셀 수 있는 항목만 */
 function previewOf(k,v){
  if(k==='assign_minutes'){const a=unassignedOver(CR().get(k)),b=unassignedOver(v);return a===null||b===null?'':'지금 기준 넘김 '+a+'건 → 새 기준 '+b+'건';}
  return '';
 }
 function rowHtml(r,can){
  const S=st(),t=TAG[r.st],edit=can&&r.st==='cond'&&!!r.k,v=r.k?cur(r.k):undefined,changed=!!r.k&&Object.prototype.hasOwnProperty.call(S.draft,r.k),im=edit&&r.type==='num'?impact(r,v):'';
  let ctl='';
  if(r.type==='num')ctl='<div class="ra-num'+(edit?'':' off')+'"><button type="button" data-ra="dec" data-k="'+attr(r.k)+'"'+(edit&&v>r.min?'':' disabled')+' aria-label="'+attr(r.l)+' 줄이기">−</button><b class="'+(changed?'chg':'')+'">'+h(v)+'</b><button type="button" data-ra="inc" data-k="'+attr(r.k)+'"'+(edit&&v<r.max?'':' disabled')+' aria-label="'+attr(r.l)+' 늘리기">+</button></div><span class="ra-unit">'+h(r.unit)+'</span>';
  else if(r.type==='tg'){const on=r.st==='hold'?false:!!v;ctl='<button type="button" class="ra-tg'+(on?' on':'')+(edit?'':' off')+'" role="switch" aria-checked="'+on+'" aria-label="'+attr(r.l)+'" data-ra="toggle" data-k="'+attr(r.k)+'"'+(edit?'':' disabled')+'><i></i></button><span class="ra-unit">'+(on?'켜짐':'꺼짐')+'</span>';}
  else if(r.type==='chips'){const list=v||[];ctl='<div class="ra-chips">'+(list.length?list.map((c,i)=>edit?'<button type="button" class="ra-chip" data-ra="chip-del" data-k="'+attr(r.k)+'" data-i="'+i+'" title="눌러서 빼기"'+(list.length>1||r.empty?'':' disabled')+'>'+h(c)+'<i>×</i></button>':'<span class="ra-chip">'+h(c)+'</span>').join(''):'<span class="ra-none">'+(r.empty?'비어 있음 · 값 미정':'없음')+'</span>')
    +(edit?(S.adding===r.k?'<input class="ra-add" data-ra="add-input" data-k="'+attr(r.k)+'" maxlength="30" placeholder="새 항목 · Enter" aria-label="'+attr(r.l)+' 항목 추가">':'<button type="button" class="ra-plus" data-ra="add" data-k="'+attr(r.k)+'">+ 추가</button>'):'')+'</div>';}
  else ctl='<span class="ra-text">'+h(r.text)+'</span>';
  const ap=applyOf(r),note=(r.st==='fix'?'<span class="ra-lock">정책 항목 · 설정 변경 불가</span>':'')+PILL(ap,r.k);/* 항목마다 적용 상태 알약을 토글 옆에(ops_12 B⑤ · 시안 E) */
  const cf=CONF(r),cs=cf?CSTATE[cf[0]]:null;
  return '<div class="ra-row'+(changed?' chg':'')+'" data-k="'+attr(r.k||'')+'"><div class="ra-l"><div><b>'+h(r.l)+'</b><em style="color:'+t[1]+';background:'+t[2]+'">'+t[0]+'</em>'+(cf?'<em class="ra-conf" style="color:'+cs[0]+';background:'+cs[1]+'">'+h(cf[0])+'</em>':'')+(changed?'<em class="new">변경됨</em>':'')+'</div><span>'+h(r.d)+'</span>'+(cf?'<span class="ra-src">계산 시작점 · 예외 — '+h(cf[1])+'</span>':'')+(im?'<span class="ra-imp">'+h(im)+'</span>':'')+threeHtml(r)+'</div><div class="ra-r">'+ctl+note+'</div></div>';
 }
 const when=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate():'';};
 /* 기존 업무 처리 3택 — 지금 서버는 선택을 이력에만 남기고 값은 즉시 적용한다(예약 적용 · 기존 업무 유지 엔진은 Codex 서버 몫). 보장 못 하는 ② ③ 은 잠금, ① 은 사실대로 이름 붙인다 */
 const EXL={keep:'저장 즉시 모든 화면에 적용 · 선택은 이력에 기록',recalc:'기존 업무도 새 기준으로 다시 계산',ask:'담당자에게 확인 요청'};
 const EX_LOCK={recalc:'예약 적용 엔진 전 · 선택 불가',ask:'예약 적용 엔진 전 · 선택 불가'};
 const diffOf=(C,S,k)=>{const a=C.get(k),b=S.draft[k];if(!Array.isArray(a))return show(a)+' → '+show(b);const add=b.filter(x=>!a.includes(x)),del=a.filter(x=>!b.includes(x));return a.length+'개 → '+b.length+'개'+(add.length?' (+'+add.join(', ')+')':'')+(del.length?' (−'+del.join(', ')+')':'');};
 /* 저장 전 적용 범위 확인(promise_gap ③ 시안 3): 바꾸는 것 · 적용일 · 대상 · 기존 업무 3택 */
 function confirmHtml(S,C,keys){
  const F=S.confirm;if(!F)return '';
  const lines=keys.map(k=>{const r=C.SPEC[k],v=S.draft[k],pv=previewOf(k,v);return '<div class="ra-cf-row"><span>바꾸는 것</span><b>'+h(r.l+' '+diffOf(C,S,k))+'</b><span>대상</span><span>'+h(scopeOf(k,v))+(pv?' · 미리보기 '+h(pv):'')+'</span></div>';}).join('');
  const opts=[['keep','지금 기준을 읽는 모든 화면 · 기존 업무 계산도 새 값으로 바뀝니다 · 지난 요청의 기한 · 완료 판정은 다시 계산하지 않음'],['recalc',keys.map(k=>previewOf(k,S.draft[k])).filter(Boolean).join(' · ')||'미리보기 계산 없음'],['ask','담당이 건별로 고름']];
  const rec=C.meta().contract>=2;
  return '<div class="ra-cf" role="dialog" aria-label="적용 범위 확인"><header><b>기준을 바꿀 때 · 적용 범위 확인</b><span>'+(rec?'저장하면 이력에 누가 · 언제 · 무엇 · 적용일 · 대상이 남습니다':'이 서버는 적용일 · 대상을 이력에 남기지 않습니다(ops-rules v2 적용 전) · 값만 저장됩니다')+' · 값은 저장 즉시 적용되고 미래 적용일 · 기존 업무 유지는 예약 적용 엔진이 생기기 전까지 고를 수 없습니다</span></header>'
   +lines+'<div class="ra-cf-row"><span>적용일</span><b class="ra-cf-now">'+h(F.eff)+' · 오늘(저장 즉시)</b><span>기존 업무는</span><div class="ra-cf-opts">'+opts.map(o=>{const lock=EX_LOCK[o[0]];return '<button type="button" data-ra="existing" data-v="'+o[0]+'" aria-pressed="'+(F.existing===o[0])+'"'+(lock?' disabled title="'+attr(lock)+'"':'')+'><b>'+h(EXL[o[0]])+'</b><small>'+h(lock?lock+' · '+o[1]:o[1])+'</small></button>';}).join('')+'</div></div>'
   +(S.err?'<p class="ra-cf-err">'+h(S.err)+'</p>':'')+'<footer><button type="button" data-ra="cfclose">닫기</button><button type="button" class="save" data-ra="cfsave"'+(S.busy?' disabled':'')+'>'+(S.busy?'저장 중…':'이대로 저장')+'</button></footer></div>';
 }
 function render(){
  const host=document.getElementById('rules-admin');if(!host||!CR())return;
  if(!admin()){host.innerHTML='<p class="ra-empty">운영 기준 설정은 관리자 전용 화면입니다.</p>';return;}
  const S=st(),C=CR(),can=C.available()&&!S.busy,meta=C.meta(),keys=Object.keys(S.draft),ver=C.version();
  const nav='<nav class="ra-nav">'+C.SECTIONS.map(s=>'<button type="button" data-ra="nav" data-k="'+s[0]+'"><span>'+h(s[1])+'</span><i>'+s[3].length+'</i></button>').join('')
   +'<div class="ra-legend">'+[['fix','정책 항목 · 잠금'],['cond','관리자가 값 변경'],['hold','구현 안 함']].map(g=>'<span><em style="color:'+TAG[g[0]][1]+';background:'+TAG[g[0]][2]+'">'+TAG[g[0]][0]+'</em>'+g[1]+'</span>').join('')+'</div>'
   +'<div class="ra-hist"><b>마지막 변경</b><span>'+(meta.updated_at?h(when(meta.updated_at)+(meta.updated_by?' · '+meta.updated_by:'')):C.available()?'아직 없음 · 기본값으로 동작':'서버 적용 전 · 기본값으로 동작')+'</span>'
   +(meta.history&&meta.history.length?meta.history.slice(0,5).map(x=>{const r=C.SPEC[x.key],ex=x.existing?EXL[x.existing]||x.existing:'';return '<p>'+h(when(x.at)+' '+(x.by||''))+'<br>'+h((r?r.l:x.key)+' '+(x.before==null?show(C.DEFAULTS[x.key]):show(x.before))+' → '+show(x.after))+(x.effective_on||x.scope||ex?'<br><small>'+h([x.effective_on?'적용일 '+x.effective_on:'',x.scope?'대상 '+x.scope:'',ex].filter(Boolean).join(' · '))+'</small>':'')+'</p>';}).join(''):'')+'</div></nav>';
  /* 상단 묶음 숫자(시안 E): 적용 중 n · 값만 저장 n · 확정 전 n · 기준 버전 */
  const rows=C.ROWS.filter(r=>r.st!=='hold'),nOn=rows.filter(r=>applyOf(r)==='적용 중'||applyOf(r)==='임시 적용').length,nSave=rows.filter(r=>applyOf(r)==='값만 저장').length,nPre=rows.filter(r=>{const c=CONF(r);return c&&c[0]!=='회의 확정';}).length;
  const top='<div class="ra-top"><b>적용 중 '+nOn+'개</b><b>값만 저장 '+nSave+'개</b><b class="pre">확정 전 '+nPre+'개</b><span>'+h(ver.label)+' · 기준을 바꿔도 지난 요청의 기한 · 판정은 다시 계산하지 않음</span></div>'+(()=>{const T=rows.map(three).filter(Boolean),nd=T.filter(t=>t.d==='적용').length,nf=T.filter(t=>t.f==='적용').length,nn=T.filter(t=>t.d==='미연결'&&t.f==='미연결').length,nm=k=>(C.ROWS.find(r=>r.k===k)||{}).l||k;return '<div class="ra-top3"><span>누락 진단 적용 <b>'+nd+'</b></span><span>입력 강제 적용 <b>'+nf+'</b></span><span>미연결 <b>'+nn+'</b></span><small>연결 순서 · '+NEXT_WIRE.map(nm).map(h).join(' → ')+'</small></div>';})();
  const pend=[];C.SECTIONS.forEach(s=>s[3].forEach(r=>{if(r.k&&r.st!=='hold'&&!WIRED.has(r.k))pend.push((r.l)+' (→ '+(TARGET[r.k]||'적용 화면 미정')+')');}));
  const body=C.SECTIONS.map(s=>'<section class="ra-sec" id="ra-'+s[0]+'"><header><b>'+h(s[1])+'</b><span>'+h(s[2])+'</span></header>'+s[3].map(r=>rowHtml(r,can)).join('')+'</section>').join('')+(pend.length?'<section class="ra-sec ra-pend" id="ra-pending"><header><b>값만 저장 · 적용 예정</b><span>아래 설정값은 화면 계산에 연결되지 않았습니다 · 해당 기능 전체가 없다는 뜻은 아닙니다</span></header><p>'+pend.map(h).join(' · ')+'</p></section>':'');
  const gate=C.available()?'':'<div class="ra-gate">값을 바꾸려면 서버 적용(sql/ops-rules-v2-20261010.sql)이 필요합니다 — 그 전까지는 연결된 항목만 기본값으로 계산됩니다. 미연결 항목은 적용 상태를 확인해 주세요.</div>';
  const list=keys.map(k=>C.SPEC[k].l+' '+diffOf(C,S,k)).join(' · ');
  const bar=keys.length?'<div class="ra-bar" role="region" aria-label="변경 저장"><b>변경 '+keys.length+'건</b><span>'+h(list)+' · 저장하면 변경 이력에 남습니다. 적용 중인 항목만 연결된 화면 계산에 반영됩니다'+(S.err&&!S.confirm?'<em>'+h(S.err)+'</em>':'')+'</span><button type="button" data-ra="reset"'+(S.busy?' disabled':'')+'>되돌리기</button><button type="button" class="save" data-ra="save"'+(S.busy?' disabled':'')+'>'+(S.busy?'저장 중…':'저장')+'</button></div>':'';
  const scroll=document.scrollingElement?document.scrollingElement.scrollTop:0;
  host.innerHTML='<div class="ra-shell">'+gate+top+'<div class="ra-wrap">'+nav+'<div class="ra-main">'+body+'</div></div>'+(keys.length?confirmHtml(S,C,keys):'')+bar+'</div>';
  if(!host.__ra){host.__ra=true;host.addEventListener('click',onClick);host.addEventListener('keydown',onKey);host.addEventListener('focusout',e=>{if(e.target.matches&&e.target.matches('[data-ra="add-input"]'))commitAdd(e.target);});host.addEventListener('change',e=>{const t=e.target;if(t.matches&&t.matches('[data-ra-in="eff"]')&&st().confirm)st().confirm.eff=t.value;});}
  const inp=host.querySelector('[data-ra="add-input"]');if(inp)inp.focus();else if(document.scrollingElement)document.scrollingElement.scrollTop=scroll;
 }
 function commitAdd(el){const S=st(),k=el.dataset.k,v=String(el.value||'').trim();if(S.adding!==k)return;S.adding='';if(v){const list=(cur(k)||[]).slice();if(!list.includes(v)&&list.length<20){list.push(v);setDraft(k,list);}}render();}
 function onKey(e){const t=e.target;if(!t.matches||!t.matches('[data-ra="add-input"]'))return;if(e.key==='Enter'){e.preventDefault();commitAdd(t);}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();st().adding='';render();}}
 async function save(){
  const S=st(),F=S.confirm;if(S.busy||!Object.keys(S.draft).length||!F)return;
  if(F.eff!==KST()||F.existing!=='keep'){S.err='지금은 저장 즉시 적용만 고를 수 있습니다(미래 적용일 · 기존 업무 유지는 예약 적용 엔진 전).';return render();}
  const keys=Object.keys(S.draft),scope=keys.map(k=>CR().SPEC[k].l+': '+scopeOf(k,S.draft[k])).join(' / '),rec=CR().meta().contract>=2;
  S.busy=true;S.err='';render();
  /* 적용 조건(apply)은 서버가 적용 조건을 받는다고(contract 2) 응답한 뒤에만 보낸다 — v1 서버가 조용히 버린 것을 성공으로 안내하지 않는다(코덱스 검토 P1) */
  try{const r=await CR().save(S.draft,rec?{effective_on:F.eff,scope}:null);const bad=keys.filter(k=>JSON.stringify(r[k])!==JSON.stringify(CR().clean(k,S.draft[k])));if(bad.length)throw new Error('서버가 확인한 값이 요청과 다릅니다: '+bad.map(k=>CR().SPEC[k].l).join(', '));
   S.draft={};S.confirm=null;if(typeof R.toast==='function')R.toast('운영 기준을 저장했습니다 — 연결된 항목에 즉시 반영'+(rec?' · 이력에 적용일 '+F.eff+' · 대상 기록':' · 이 서버는 적용일 · 대상을 이력에 남기지 않음'));}
  catch(e){S.err='저장하지 못했습니다: '+(e.message||e);}
  finally{S.busy=false;try{R.paint();}catch(e){render();}}
 }
 function onClick(e){
  const b=e.target.closest('[data-ra]');if(!b||b.disabled)return;const a=b.dataset.ra,k=b.dataset.k,S=st(),C=CR(),r=C.SPEC[k];
  if(a==='nav'){const el=document.getElementById('ra-'+k);if(el)el.scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(a==='reset'){S.draft={};S.adding='';S.err='';S.confirm=null;return render();}
  if(a==='save'){S.confirm={eff:KST(),existing:'keep'};S.err='';return render();}/* 바로 보내지 않고 적용 범위부터 확인 */
  if(a==='cfclose'){S.confirm=null;S.err='';return render();}
  if(a==='existing'&&S.confirm){if(EX_LOCK[b.dataset.v])return;S.confirm.existing=b.dataset.v;return render();}
  if(a==='cfsave')return save();
  if(!r)return;
  if(a==='dec'||a==='inc'){const v=Math.max(r.min,Math.min(r.max,cur(k)+(a==='inc'?r.step:-r.step)));setDraft(k,v);return render();}
  if(a==='toggle'){setDraft(k,!cur(k));return render();}
  if(a==='add'){S.adding=k;return render();}
  if(a==='chip-del'){const list=(cur(k)||[]).slice();if(list.length<=1&&!r.empty)return;list.splice(Number(b.dataset.i),1);setDraft(k,list);return render();}
 }
 /* 화면에 들어올 때 서버 값을 한 번 더 읽는다(다른 관리자가 바꿨을 수 있다) */
 let fresh=0;
 function paint(){if(R.G.page!=='rules')return;render();if(CR()&&CR().available()&&Date.now()-fresh>15000){fresh=Date.now();CR().load(true).then(()=>{if(R.G.page==='rules'&&!Object.keys(st().draft).length)render();});}}
 root.addEventListener('crm-rules:changed',()=>{if(R.G&&R.G.page==='rules'&&!st().busy)render();});
 root.RulesAdmin={render:paint,state:st,applyOf,confOf:CONF,scopeOf,WIRED};
})(window);
