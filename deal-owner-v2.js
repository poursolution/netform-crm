/* 영업건 상세 · 담당자 변경 창 v2 (2026-10-04 대표 시안 캡처 '담당자변경 이미지') — 담당자 변경 창의 모양만. 가운데 패널 그대로.
   지금 → 새 담당 / 누구에게 *(사람별 진행 건수 · 업무량) / 왜 *(칩 + 한 줄 더) / 실적은 누구에게(유지 (기본) · 새 담당에게 넘기기) / [취소] [담당자 변경 저장] / 변경 이력
   ■ 저장 경로는 그대로: 이 화면의 값을 기존 칸(#dv-assignee · #rs-asg-text · DealOwner.state().attr)에 옮긴 뒤 기존 saveAssigneeChange() 를 부른다
     — 담당 변경(assign) · 사유 · 배정 이력 · 실적 귀속 기록(crm_deal_owner_reassign_v1) · 귀속 변경 승인 요청이 전과 같이 일어난다.
   ■ 고를 수 있는 사람 = 기존 선택 상자의 선택지 그대로(조직 · 활성 여부 검사 포함). 진행 건수 · 업무량 판정 = 영업사원 관리와 같은 계산(repFlowData · 여유/보통/많음/관리 부하).
   ■ 사람 아래 한 줄은 자료에서만: 같은 지역 진행 n곳 → 같은 브랜드 진행 n건 → 직함. 관리 부하면 '배정 비추천'.
   끄기: G.dealOwnerV2Off=true → 예전 담당자 관리 상자 */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const WHY=['지역 재배치','업무량 재분배','브랜드 담당 변경','고객 요청','퇴사 · 휴직'];
 const enabled=()=>!R.G.dealOwnerV2Off&&typeof R.saveAssigneeChange==='function';
 const rep=v=>{try{return R.repN(v)||'';}catch(e){return String(v||'').trim();}};
 const st=()=>R.G.dealOwnerV2||(R.G.dealOwnerV2={id:'',to:'',why:'',more:''});
 const cur=()=>{const c=R.CUR_DETAIL;return c&&c.kind==='deal'&&c.item?c.item:null;};
 const sel=()=>document.getElementById('dv-assignee');
 const host=()=>{const s=sel(),a=document.getElementById('detailAction');return s&&a&&a.contains(s)?a:null;};
 const DO=()=>R.DealOwner&&R.DealOwner.enabled&&R.DealOwner.enabled()?R.DealOwner:null;
 const region=d=>{const m=/^\s*\[([^\]]+)\]/.exec(String(d&&d.site||''));if(!m)return '';const t=m[1].trim().split(/\s+/);return t[t.length-1]||'';};
 const active=d=>{try{return R.isOpen(d);}catch(e){return true;}};
 /* 사람별 진행 건수 · 업무량: 영업사원 관리와 같은 계산 */
 function loads(){
  const m=new Map();
  try{const rows=R.repFlowData(true)||[],scores=rows.map(r=>r.load.score),min=scores.length?Math.min.apply(null,scores):0;
   rows.forEach(r=>{const lv=r.risk>=4?['관리 부하','r']:r.load.score<=min?['여유','g']:r.load.score>min+16?['많음','k']:['보통','k'];m.set(rep(r.nm),{open:Number(r.load.open)||0,label:lv[0],tone:lv[1]});});}catch(e){}
  return m;
 }
 function people(d){
  const s=sel();if(!s)return [];const from=rep(d.assignee),L=loads(),rg=region(d),br=String(d.brand||'').trim(),deals=(R.B&&R.B.deals)||[];
  const rank={'여유':0,'보통':1,'많음':2,'관리 부하':3};
  return [...s.options].filter(o=>o.value&&!o.disabled&&rep(o.value)!==from).map((o,i)=>{const name=rep(o.value),mine=deals.filter(x=>x!==d&&rep(x.assignee)===name&&active(x)),near=rg?mine.filter(x=>region(x)===rg).length:0,same=br?mine.filter(x=>String(x.brand||'').trim()===br).length:0,l=L.get(name)||{open:mine.length,label:'',tone:'k'};
   let title='';try{const p=R.repProfile(name);title=String(p.title||'').trim();}catch(e){}
   const sub=l.label==='관리 부하'?'배정 비추천':near?rg+' 인근 진행 '+near+'곳':same?br+' 진행 '+same+'건':title||'진행 중인 같은 지역 · 브랜드 영업 없음';
   return {value:o.value,name,sub,open:l.open,label:l.label,tone:l.tone,near,i};}).sort((a,b)=>((a.label==='관리 부하')-(b.label==='관리 부하'))||b.near-a.near||(rank[a.label]??1)-(rank[b.label]??1)||a.open-b.open||a.i-b.i);/* 관리 부하는 맨 아래 · 같은 지역 경험 → 업무량 여유 → 진행 건수 적은 순 */
 }
 function historyRows(d){
  const D=DO();let out=[];
  try{if(D)out=D.history(d).map(x=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(x.k||''));return [m?m[1]+'.'+Number(m[2])+'.'+Number(m[3]):'',x.t];});}catch(e){out=[];}
  if(!out.length){const a=host();if(a)out=[...a.querySelectorAll('.dcard .historytbl .historyrow:not(.head)')].map(r=>{const c=[...r.children].map(x=>x.textContent.trim());return [c[0]||'',[c[1],c[2]].filter(Boolean).join(' · ')];});}
  return out;
 }
 function html(d){
  const S=st(),from=rep(d.assignee)||'미배정',P=people(d),to=P.some(p=>p.value===S.to)?rep(S.to):'';if(!to)S.to='';
  const D=DO(),withAttr=!!(D&&host()&&host().querySelector('.do-attr')),I=withAttr?D.info(d):null,keep=I&&I.perf?I.perf:from,same=!!to&&to===keep,A=D?D.state():{attr:'keep'};
  if(same)A.attr='keep';
  const ready=!!to&&!!S.why,H=historyRows(d);
  return '<div class="ow2-flow"><div><span>지금</span><b>'+h(from)+'</b></div><i aria-hidden="true">→</i><div class="'+(to?'':'empty')+'"><span>새 담당</span><b>'+h(to||'선택하세요')+'</b></div></div>'
   +'<b class="ow2-lb">누구에게 *</b><div class="ow2-people" role="radiogroup" aria-label="새 담당">'+(P.map(p=>'<button type="button" role="radio" data-ow2="to" data-v="'+attr(p.value)+'" aria-checked="'+(S.to===p.value)+'"><span><b>'+h(p.name)+'</b><span>'+h(p.sub)+'</span></span><em class="'+p.tone+'">진행 '+p.open+(p.label?' · '+p.label:'')+'</em></button>').join('')||'<p class="ow2-none">바꿀 수 있는 담당자가 없습니다.</p>')+'</div>'
   +'<b class="ow2-lb">왜 *</b><div class="ow2-chips" role="group" aria-label="변경 사유">'+WHY.map(w=>'<button type="button" data-ow2="why" data-v="'+attr(w)+'" aria-pressed="'+(S.why===w)+'">'+w+'</button>').join('')+'</div><input class="ow2-more" data-ow2-f="more" maxlength="200" placeholder="한 줄 더 (선택)" value="'+attr(S.more)+'">'
   +(withAttr?'<b class="ow2-lb">실적은 누구에게</b><div class="ow2-attr" role="radiogroup" aria-label="실적 귀속"><button type="button" role="radio" data-ow2="attr" data-v="keep" aria-checked="'+(A.attr!=='request')+'"><b>'+h(keep)+' 유지 (기본)</b><span>지금까지 영업한 사람에게 · 바로 저장</span></button><button type="button" role="radio" data-ow2="attr" data-v="request" aria-checked="'+(A.attr==='request')+'"'+(same?' disabled':'')+'><b>새 담당에게 넘기기</b><span>'+(same?'새 담당이 이미 주담당입니다':'예외 승인함으로 올라감 · 승인 후 바뀜')+'</span></button></div>':'')
   +'<p class="ow2-hint">'+h(ready?from+' → '+to+' · '+S.why+(S.more.trim()?' · '+S.more.trim():''):'누구에게 · 왜를 고르면 저장할 수 있습니다')+'</p>'
   +'<div class="ow2-act"><button type="button" data-ow2="cancel">취소</button><button type="button" class="go" data-ow2="save"'+(ready?'':' disabled')+'>담당자 변경 저장</button></div>'
   +'<div class="ow2-hist"><b>변경 이력</b>'+(H.length?H.map(x=>'<div><span>'+h(x[0])+'</span>'+(x[0]?' · ':'')+h(x[1])+'</div>').join(''):'<div class="m">아직 변경 이력이 없습니다</div>')+'</div>';
 }
 function render(){
  const a=host(),d=cur();
  if(!a||!d||!enabled()){document.querySelectorAll('#detailAction.ow2-on').forEach(n=>{n.classList.remove('ow2-on');n.querySelector('.ow2')?.remove();});return;}
  const S=st();if(S.id!==String(d.id)){S.id=String(d.id);S.to='';S.why='';S.more='';}
  const card=sel().closest('.dcard');if(!card)return;
  let box=a.querySelector('.ow2');
  if(!box){box=document.createElement('div');box.className='ow2';card.before(box);box.addEventListener('click',onClick);box.addEventListener('input',e=>{if(e.target.matches('[data-ow2-f="more"]')){st().more=e.target.value;const hint=box.querySelector('.ow2-hint'),S2=st(),x=cur();if(hint&&S2.to&&S2.why&&x)hint.textContent=(rep(x.assignee)||'미배정')+' → '+rep(S2.to)+' · '+S2.why+(S2.more.trim()?' · '+S2.more.trim():'');}});}
  a.classList.add('ow2-on');
  const el=document.activeElement,keep=el&&box.contains(el)&&el.matches('[data-ow2-f="more"]')?[el.selectionStart,el.selectionEnd]:null;
  box.innerHTML=html(d);
  if(keep){const n=box.querySelector('[data-ow2-f="more"]');if(n){n.focus();try{n.setSelectionRange(keep[0],keep[1]);}catch(e){}}}
 }
 /* 이 화면의 값을 기존 칸에 옮기고 기존 저장을 부른다 */
 function save(){
  const d=cur(),S=st(),s=sel(),t=document.getElementById('rs-asg-text');if(!d||!s||!S.to||!S.why)return;
  s.value=S.to;s.dispatchEvent(new Event('change',{bubbles:true}));
  const reason=S.why+(S.more.trim()?' · '+S.more.trim():'');
  if(t){t.value=reason;try{R.reasonGate('rs-asg');}catch(e){}}
  const before=rep(d.assignee);
  R.saveAssigneeChange();
  if(rep(d.assignee)!==before){S.to='';S.why='';S.more='';}
  setTimeout(render,0);
 }
 function onClick(e){
  const b=e.target.closest('[data-ow2]');if(!b||b.disabled)return;const a=b.dataset.ow2,S=st();
  if(a==='to'){S.to=S.to===b.dataset.v?'':b.dataset.v;render();return;}
  if(a==='why'){S.why=S.why===b.dataset.v?'':b.dataset.v;render();return;}
  if(a==='attr'){const D=DO();if(D)D.state().attr=b.dataset.v;render();return;}
  if(a==='cancel'){S.to='';S.why='';S.more='';const x=host();(x&&x.querySelector('.ddv-back'))?.click();return;}
  if(a==='save')save();
 }
 /* 담당 정보 상자 · 실적 귀속 선택이 그려진 뒤(DealOwner.decorate)에 이 화면을 얹는다 */
 function boot(){
  const D=R.DealOwner;
  if(D&&typeof D.decorate==='function'&&!D.decorate.__ow2){const base=D.decorate;const w=function(){const r=base.apply(this,arguments);try{render();}catch(e){if(R.console)R.console.warn('[담당자 변경 v2]',e);}return r;};w.__ow2=true;D.decorate=w;}
  const A=R.DetailActions;
  if(A&&typeof A.open==='function'&&!A.open.__ow2){const base=A.open;const w=function(){const r=base.apply(this,arguments);try{render();}catch(e){}return r;};w.__ow2=true;A.open=w;}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.DealOwnerV2={enabled,render,state:st,WHY,people};
})(window);
