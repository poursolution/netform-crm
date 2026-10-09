/* 운영 기준 설정 화면 (2026-10-04 디자인 핸드오프 'design_handoff_rules' · 운영 기준 설정.dc.html) — 사이드바 '설정 → 운영 기준 설정' · 관리자 전용
   왼쪽 목차 7묶음 + 꼬리표 설명 + 마지막 변경 · 변경 이력, 오른쪽 항목 줄(확정 = 잠금 "정책 항목 · 설정 변경 불가" / 조건부 = − + 숫자 · 토글 · 칩 추가 / 보류 = 꺼짐 고정).
   값을 바꾸면 '변경됨' + 영향 한 줄 + 아래 남색 띠 [되돌리기] [저장]. 저장 = 서버(crm_ops_rules_v1)가 확인한 값만 모든 화면에 적용 + 변경 이력.
   값과 항목표는 CRMRules(ops-rules.js) 한곳에서 온다. 아직 화면에 연결되지 않은 조건부 항목은 '연결 예정'이라고 적는다(값은 저장된다). */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v)),CR=()=>R.CRMRules;
 const TAG={fix:['확정','#374151','#eef0f3'],cond:['조건부','#1d3f99','#eef3fe'],hold:['보류','#c0392b','#fdeceb']};
 /* 지금 화면 계산에 실제로 쓰이는 항목(ops_12 B⑤ '적용 중' 알약 · 2026-10-07 코드 대조: CRMRules.get · OPS_RULES sync 로 읽히는 열쇠) — 나머지는 '설정 연결 미적용' */
 const WIRED=new Set(['approvers','stage_gates','assign_minutes','first_contact_hours','inactive_days','quote_followup_days','long_wait_contact_days','care_focus_months','care_general_months','unreachable_attempts','unreachable_interval_days','transfer_result_check_days','reasons_bad_fit','reasons_lost','reasons_transfer','contact_channels','owner_keep_on_reassign','auto_owner_attribution']);
 /* 2026-10-07 stage7_2 ④ — 항목마다 확정 / 잠정 + 출처 · 결정일 · 승인(시안의 출처 그대로 · 모르는 항목에는 만들어 넣지 않는다). 키 = 항목 열쇠, 열쇠가 없는 안내 줄은 이름 */
 const META={'고객관리 기간':['기간 잠정 · 해석 미확정','2026-10-02 회의 지침 · 연락 주기와 관리 기간을 구분'],care_focus_months:['잠정','회의록 · 승인 전'],care_general_months:['잠정 · 해석 미확정','회의록 · 승인 전 · 발송일부터 총 기간으로 둔 기본값'],long_wait_contact_days:['일수 환산 미확정','2026-10-02 회의: 2개월 1회 · 현재 계산은 설정 일수'],quote_request_days:['잠정','운영 제안 · 회의 확정 전']};
 const CONF=r=>META[r.k||r.l]||null;
 /* 적용 예정: 값은 저장되지만 아직 어느 화면 계산에도 안 쓰이는 규칙 + 앞으로 들어갈 화면 */
 const TARGET={next_action_required:'단계 이동 창',year_required_on_convert:'관계관리 재분류',owner_change_log:'상세 담당 변경'};
 const PILL=on=>'<span class="ra-pill" style="color:'+(on?'#1f7a4d':'#6b7280')+';background:'+(on?'#e8f6ee':'#f3f4f6')+'">'+(on?'적용 중':'설정 연결 미적용')+'</span>';
 function st(){const g=R.G;if(!g.rulesAdmin)g.rulesAdmin={draft:{},adding:'',busy:false,err:''};return g.rulesAdmin;}
 const admin=()=>{try{return !!R.todayIsAdmin();}catch(e){return false;}};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const cur=k=>{const S=st();return Object.prototype.hasOwnProperty.call(S.draft,k)?S.draft[k]:CR().get(k);};
 function setDraft(k,v){const S=st();if(same(v,CR().get(k)))delete S.draft[k];else S.draft[k]=v;S.err='';}
 const show=v=>Array.isArray(v)?v.join(' · '):typeof v==='boolean'?(v?'켜짐':'꺼짐'):String(v);
 /* 영향 한 줄: 계산할 수 있는 것은 실제 자료로, 아니면 바뀌는 동작을 그대로 적는다 */
 function unassignedOver(minutes){
  let n=0;try{const now=Date.now();(R.operationalInquiries(R.B.inquiries||[])||[]).forEach(q=>{if(R.inquiryAssigned(q))return;if(R.inqCtlConverted(q))return;if(typeof R.isClosedInq==='function'&&R.isClosedInq(q))return;const t=Date.parse(R.inquiryCreatedAt(q)||'');if(Number.isFinite(t)&&(now-t)/6e4>minutes)n++;});}catch(e){return null;}
  return n;
 }
 function impact(r,v){
  const base=CR().get(r.k);if(same(v,base))return '';
  if(r.k==='assign_minutes'){const a=unassignedOver(base),b=unassignedOver(v);return a===null||b===null?'접수 후 '+v+'분이 지나면 배정 필요로 표시됩니다':'바꾸면 지금 배정 기준을 넘긴 문의 '+a+'건 → '+b+'건';}
  if(r.k==='unreachable_attempts')return '최초 문의 '+v+'회 시도 후 별도 후속관리로 넘어갑니다';
  if(r.k==='unreachable_interval_days')return '시도와 시도 사이를 '+v+'일로 봅니다';
  if(r.k==='long_wait_contact_days')return '장기 대기 고객 후속 확인 간격이 '+v+'일로 바뀝니다';
  if(r.k==='transfer_result_check_days')return '이관 후 '+v+'일에 담당자 오늘 업무에 결과 확인 생성';
  if(r.k==='nearby_radius_km')return '반경 '+v+'km 안의 현장이 지도에 표시됩니다';
  return '';
 }
 function rowHtml(r,can){
  const S=st(),t=TAG[r.st],edit=can&&r.st==='cond'&&!!r.k,v=r.k?cur(r.k):undefined,changed=!!r.k&&Object.prototype.hasOwnProperty.call(S.draft,r.k),im=edit&&r.type==='num'?impact(r,v):'';
  let ctl='';
  if(r.type==='num')ctl='<div class="ra-num'+(edit?'':' off')+'"><button type="button" data-ra="dec" data-k="'+attr(r.k)+'"'+(edit&&v>r.min?'':' disabled')+' aria-label="'+attr(r.l)+' 줄이기">−</button><b class="'+(changed?'chg':'')+'">'+h(v)+'</b><button type="button" data-ra="inc" data-k="'+attr(r.k)+'"'+(edit&&v<r.max?'':' disabled')+' aria-label="'+attr(r.l)+' 늘리기">+</button></div><span class="ra-unit">'+h(r.unit)+'</span>';
  else if(r.type==='tg'){const on=r.st==='hold'?false:!!v;ctl='<button type="button" class="ra-tg'+(on?' on':'')+(edit?'':' off')+'" role="switch" aria-checked="'+on+'" aria-label="'+attr(r.l)+'" data-ra="toggle" data-k="'+attr(r.k)+'"'+(edit?'':' disabled')+'><i></i></button><span class="ra-unit">'+(on?'켜짐':'꺼짐')+'</span>';}
  else if(r.type==='chips'){const list=v||[];ctl='<div class="ra-chips">'+list.map((c,i)=>edit?'<button type="button" class="ra-chip" data-ra="chip-del" data-k="'+attr(r.k)+'" data-i="'+i+'" title="눌러서 빼기"'+(list.length>1?'':' disabled')+'>'+h(c)+'<i>×</i></button>':'<span class="ra-chip">'+h(c)+'</span>').join('')
    +(edit?(S.adding===r.k?'<input class="ra-add" data-ra="add-input" data-k="'+attr(r.k)+'" maxlength="30" placeholder="새 항목 · Enter" aria-label="'+attr(r.l)+' 항목 추가">':'<button type="button" class="ra-plus" data-ra="add" data-k="'+attr(r.k)+'">+ 추가</button>'):'')+'</div>';}
  else ctl='<span class="ra-text">'+h(r.text)+'</span>';
  const note=(r.st==='fix'?'<span class="ra-lock">정책 항목 · 설정 변경 불가</span>':'')+(r.k&&r.st!=='hold'?PILL(WIRED.has(r.k)):'');/* 항목마다 적용 중(초록) / 설정 연결 미적용(회색) 알약을 토글 옆에(ops_12 B⑤) */
  const cf=CONF(r),cfOk=cf&&cf[0]==='확정';
  return '<div class="ra-row'+(changed?' chg':'')+'"><div class="ra-l"><div><b>'+h(r.l)+'</b><em style="color:'+t[1]+';background:'+t[2]+'">'+t[0]+'</em>'+(cf?'<em class="ra-conf" style="color:'+(cfOk?'#1f7a4d':'#c0392b')+';background:'+(cfOk?'#e8f6ee':'#fdeceb')+'">'+h(cf[0])+'</em>':'')+(changed?'<em class="new">변경됨</em>':'')+'</div><span>'+h(r.d)+'</span>'+(cf?'<span class="ra-src">출처 · '+h(cf[1])+'</span>':'')+(im?'<span class="ra-imp">'+h(im)+'</span>':'')+'</div><div class="ra-r">'+ctl+note+'</div></div>';
 }
 const when=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate():'';};
 function render(){
  const host=document.getElementById('rules-admin');if(!host||!CR())return;
  if(!admin()){host.innerHTML='<p class="ra-empty">운영 기준 설정은 관리자 전용 화면입니다.</p>';return;}
  const S=st(),C=CR(),can=C.available()&&!S.busy,meta=C.meta(),keys=Object.keys(S.draft);
  const nav='<nav class="ra-nav">'+C.SECTIONS.map(s=>'<button type="button" data-ra="nav" data-k="'+s[0]+'"><span>'+h(s[1])+'</span><i>'+s[3].length+'</i></button>').join('')
   +'<div class="ra-legend">'+[['fix','정책 항목 · 잠금'],['cond','관리자가 값 변경'],['hold','구현 안 함']].map(g=>'<span><em style="color:'+TAG[g[0]][1]+';background:'+TAG[g[0]][2]+'">'+TAG[g[0]][0]+'</em>'+g[1]+'</span>').join('')+'</div>'
   +'<div class="ra-hist"><b>마지막 변경</b><span>'+(meta.updated_at?h(when(meta.updated_at)+(meta.updated_by?' · '+meta.updated_by:'')):C.available()?'아직 없음 · 기본값으로 동작':'서버 적용 전 · 기본값으로 동작')+'</span>'
   +(meta.history&&meta.history.length?meta.history.slice(0,5).map(x=>{const r=C.SPEC[x.key];return '<p>'+h(when(x.at)+' '+(x.by||''))+'<br>'+h((r?r.l:x.key)+' '+(x.before==null?show(C.DEFAULTS[x.key]):show(x.before))+' → '+show(x.after))+'</p>';}).join(''):'')+'</div></nav>';
  const pend=[];C.SECTIONS.forEach(s=>s[3].forEach(r=>{if(r.k&&r.st!=='hold'&&!WIRED.has(r.k))pend.push((r.l)+' (→ '+(TARGET[r.k]||'적용 화면 미정')+')');}));
  const body=C.SECTIONS.map(s=>'<section class="ra-sec" id="ra-'+s[0]+'"><header><b>'+h(s[1])+'</b><span>'+h(s[2])+'</span></header>'+s[3].map(r=>rowHtml(r,can)).join('')+'</section>').join('')+(pend.length?'<section class="ra-sec ra-pend" id="ra-pending"><header><b>적용 예정</b><span>아래 설정값은 화면 계산에 연결되지 않았습니다 · 해당 기능 전체가 없다는 뜻은 아닙니다</span></header><p>'+pend.map(h).join(' · ')+'</p></section>':'');
  const gate=C.available()?'':'<div class="ra-gate">값을 바꾸려면 서버 적용(sql/ops-rules-v1-20261004.sql)이 필요합니다 — 그 전까지는 연결된 항목만 기본값으로 계산됩니다. 미연결 항목은 적용 상태를 확인해 주세요.</div>';
  const diff=k=>{const a=C.get(k),b=S.draft[k];if(!Array.isArray(a))return show(a)+' → '+show(b);const add=b.filter(x=>!a.includes(x)),del=a.filter(x=>!b.includes(x));return a.length+'개 → '+b.length+'개'+(add.length?' (+'+add.join(', ')+')':'')+(del.length?' (−'+del.join(', ')+')':'');};
  const list=keys.map(k=>C.SPEC[k].l+' '+diff(k)).join(' · ');
  const bar=keys.length?'<div class="ra-bar" role="region" aria-label="변경 저장"><b>변경 '+keys.length+'건</b><span>'+h(list)+' · 저장하면 변경 이력에 남습니다. 적용 중인 항목만 연결된 화면 계산에 반영됩니다'+(S.err?'<em>'+h(S.err)+'</em>':'')+'</span><button type="button" data-ra="reset"'+(S.busy?' disabled':'')+'>되돌리기</button><button type="button" class="save" data-ra="save"'+(S.busy?' disabled':'')+'>'+(S.busy?'저장 중…':'저장')+'</button></div>':'';
  const scroll=document.scrollingElement?document.scrollingElement.scrollTop:0;
  host.innerHTML='<div class="ra-shell">'+gate+'<div class="ra-wrap">'+nav+'<div class="ra-main">'+body+'</div></div>'+bar+'</div>';
  if(!host.__ra){host.__ra=true;host.addEventListener('click',onClick);host.addEventListener('keydown',onKey);host.addEventListener('focusout',e=>{if(e.target.matches&&e.target.matches('[data-ra="add-input"]'))commitAdd(e.target);});}
  const inp=host.querySelector('[data-ra="add-input"]');if(inp)inp.focus();else if(document.scrollingElement)document.scrollingElement.scrollTop=scroll;
 }
 function commitAdd(el){const S=st(),k=el.dataset.k,v=String(el.value||'').trim();if(S.adding!==k)return;S.adding='';if(v){const list=(cur(k)||[]).slice();if(!list.includes(v)&&list.length<20){list.push(v);setDraft(k,list);}}render();}
 function onKey(e){const t=e.target;if(!t.matches||!t.matches('[data-ra="add-input"]'))return;if(e.key==='Enter'){e.preventDefault();commitAdd(t);}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();st().adding='';render();}}
 async function save(){
  const S=st();if(S.busy||!Object.keys(S.draft).length)return;S.busy=true;S.err='';render();
  try{await CR().save(S.draft);S.draft={};if(typeof R.toast==='function')R.toast('운영 기준을 저장했습니다 — 연결된 항목에만 반영됩니다');}
  catch(e){S.err='저장하지 못했습니다: '+(e.message||e);}
  finally{S.busy=false;try{R.paint();}catch(e){render();}}
 }
 function onClick(e){
  const b=e.target.closest('[data-ra]');if(!b||b.disabled)return;const a=b.dataset.ra,k=b.dataset.k,S=st(),C=CR(),r=C.SPEC[k];
  if(a==='nav'){const el=document.getElementById('ra-'+k);if(el)el.scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(a==='reset'){S.draft={};S.adding='';S.err='';return render();}
  if(a==='save')return save();
  if(!r)return;
  if(a==='dec'||a==='inc'){const v=Math.max(r.min,Math.min(r.max,cur(k)+(a==='inc'?r.step:-r.step)));setDraft(k,v);return render();}
  if(a==='toggle'){setDraft(k,!cur(k));return render();}
  if(a==='add'){S.adding=k;return render();}
  if(a==='chip-del'){const list=(cur(k)||[]).slice();if(list.length<=1)return;list.splice(Number(b.dataset.i),1);setDraft(k,list);return render();}
 }
 /* 화면에 들어올 때 서버 값을 한 번 더 읽는다(다른 관리자가 바꿨을 수 있다) */
 let fresh=0;
 function paint(){if(R.G.page!=='rules')return;render();if(CR()&&CR().available()&&Date.now()-fresh>15000){fresh=Date.now();CR().load(true).then(()=>{if(R.G.page==='rules'&&!Object.keys(st().draft).length)render();});}}
 root.addEventListener('crm-rules:changed',()=>{if(R.G&&R.G.page==='rules'&&!st().busy)render();});
 root.RulesAdmin={render:paint,state:st};
})(window);
