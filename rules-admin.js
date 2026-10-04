/* 운영 기준 설정 화면 (2026-10-04 디자인 핸드오프 'design_handoff_rules' · 운영 기준 설정.dc.html) — 사이드바 '설정 → 운영 기준 설정' · 관리자 전용
   왼쪽 목차 7묶음 + 꼬리표 설명 + 마지막 변경 · 변경 이력, 오른쪽 항목 줄(확정 = 잠금 "회의 확정 · 변경 불가" / 조건부 = − + 숫자 · 토글 · 칩 추가 / 보류 = 꺼짐 고정).
   값을 바꾸면 '변경됨' + 영향 한 줄 + 아래 남색 띠 [되돌리기] [저장]. 저장 = 서버(crm_ops_rules_v1)가 확인한 값만 모든 화면에 적용 + 변경 이력.
   값과 항목표는 CRMRules(ops-rules.js) 한곳에서 온다. 아직 화면에 연결되지 않은 조건부 항목은 '연결 예정'이라고 적는다(값은 저장된다). */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v)),CR=()=>R.CRMRules;
 const TAG={fix:['확정','#374151','#eef0f3'],cond:['조건부','#1d3f99','#eef3fe'],hold:['보류','#8a5a00','#fff4d6']};
 /* 지금 화면 계산에 실제로 쓰이는 조건부 항목(나머지는 값만 저장 — 연결 예정) */
 const WIRED=new Set(['stage_gates','assign_minutes','long_wait_contact_days','reasons_bad_fit','reasons_lost','contact_channels','transfer_result_check_days','reasons_transfer']);
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
  const note=r.st==='fix'?'<span class="ra-lock">회의 확정 · 변경 불가</span>':r.st==='cond'&&r.k&&!WIRED.has(r.k)?'<span class="ra-lock">화면 연결 예정 · 값은 저장됩니다</span>':'';
  return '<div class="ra-row'+(changed?' chg':'')+'"><div class="ra-l"><div><b>'+h(r.l)+'</b><em style="color:'+t[1]+';background:'+t[2]+'">'+t[0]+'</em>'+(changed?'<em class="new">변경됨</em>':'')+'</div><span>'+h(r.d)+'</span>'+(im?'<span class="ra-imp">'+h(im)+'</span>':'')+'</div><div class="ra-r">'+ctl+note+'</div></div>';
 }
 const when=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate():'';};
 function render(){
  const host=document.getElementById('rules-admin');if(!host||!CR())return;
  if(!admin()){host.innerHTML='<p class="ra-empty">운영 기준 설정은 관리자 전용 화면입니다.</p>';return;}
  const S=st(),C=CR(),can=C.available()&&!S.busy,meta=C.meta(),keys=Object.keys(S.draft);
  const nav='<nav class="ra-nav">'+C.SECTIONS.map(s=>'<button type="button" data-ra="nav" data-k="'+s[0]+'"><span>'+h(s[1])+'</span><i>'+s[3].length+'</i></button>').join('')
   +'<div class="ra-legend">'+[['fix','회의 확정 · 잠금'],['cond','관리자가 값 변경'],['hold','구현 안 함']].map(g=>'<span><em style="color:'+TAG[g[0]][1]+';background:'+TAG[g[0]][2]+'">'+TAG[g[0]][0]+'</em>'+g[1]+'</span>').join('')+'</div>'
   +'<div class="ra-hist"><b>마지막 변경</b><span>'+(meta.updated_at?h(when(meta.updated_at)+(meta.updated_by?' · '+meta.updated_by:'')):C.available()?'아직 없음 · 기본값으로 동작':'서버 적용 전 · 기본값으로 동작')+'</span>'
   +(meta.history&&meta.history.length?meta.history.slice(0,5).map(x=>{const r=C.SPEC[x.key];return '<p>'+h(when(x.at)+' '+(x.by||''))+'<br>'+h((r?r.l:x.key)+' '+(x.before==null?show(C.DEFAULTS[x.key]):show(x.before))+' → '+show(x.after))+'</p>';}).join(''):'')+'</div></nav>';
  const body=C.SECTIONS.map(s=>'<section class="ra-sec" id="ra-'+s[0]+'"><header><b>'+h(s[1])+'</b><span>'+h(s[2])+'</span></header>'+s[3].map(r=>rowHtml(r,can)).join('')+'</section>').join('');
  const gate=C.available()?'':'<div class="ra-gate">값을 바꾸려면 서버 적용(sql/ops-rules-v1-20261004.sql)이 필요합니다 — 그 전까지는 회의에서 정한 기본값으로 모든 화면이 계산됩니다.</div>';
  const diff=k=>{const a=C.get(k),b=S.draft[k];if(!Array.isArray(a))return show(a)+' → '+show(b);const add=b.filter(x=>!a.includes(x)),del=a.filter(x=>!b.includes(x));return a.length+'개 → '+b.length+'개'+(add.length?' (+'+add.join(', ')+')':'')+(del.length?' (−'+del.join(', ')+')':'');};
  const list=keys.map(k=>C.SPEC[k].l+' '+diff(k)).join(' · ');
  const bar=keys.length?'<div class="ra-bar" role="region" aria-label="변경 저장"><b>변경 '+keys.length+'건</b><span>'+h(list)+' · 저장하면 모든 화면에 바로 적용되고 변경 이력에 남습니다'+(S.err?'<em>'+h(S.err)+'</em>':'')+'</span><button type="button" data-ra="reset"'+(S.busy?' disabled':'')+'>되돌리기</button><button type="button" class="save" data-ra="save"'+(S.busy?' disabled':'')+'>'+(S.busy?'저장 중…':'저장')+'</button></div>':'';
  const scroll=document.scrollingElement?document.scrollingElement.scrollTop:0;
  host.innerHTML='<div class="ra-shell">'+gate+'<div class="ra-wrap">'+nav+'<div class="ra-main">'+body+'</div></div>'+bar+'</div>';
  if(!host.__ra){host.__ra=true;host.addEventListener('click',onClick);host.addEventListener('keydown',onKey);host.addEventListener('focusout',e=>{if(e.target.matches&&e.target.matches('[data-ra="add-input"]'))commitAdd(e.target);});}
  const inp=host.querySelector('[data-ra="add-input"]');if(inp)inp.focus();else if(document.scrollingElement)document.scrollingElement.scrollTop=scroll;
 }
 function commitAdd(el){const S=st(),k=el.dataset.k,v=String(el.value||'').trim();if(S.adding!==k)return;S.adding='';if(v){const list=(cur(k)||[]).slice();if(!list.includes(v)&&list.length<20){list.push(v);setDraft(k,list);}}render();}
 function onKey(e){const t=e.target;if(!t.matches||!t.matches('[data-ra="add-input"]'))return;if(e.key==='Enter'){e.preventDefault();commitAdd(t);}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();st().adding='';render();}}
 async function save(){
  const S=st();if(S.busy||!Object.keys(S.draft).length)return;S.busy=true;S.err='';render();
  try{await CR().save(S.draft);S.draft={};if(typeof R.toast==='function')R.toast('운영 기준을 저장했습니다 — 모든 화면에 적용됩니다');}
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
