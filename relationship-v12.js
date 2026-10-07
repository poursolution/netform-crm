/* 관계관리 v12 — 집중 · 일반 · 대기 · 보류 · 미확인 (2026-10-07 design_handoff_relationship_v12 · 시안 '관계관리 v12.dc.html')
   파이프라인 관계관리 단계만. 목록 줄(v11 4칸)은 그대로, 위 상태 · 분류 기준 · 알림 기준만 바꾼다(pipeline-stage-v3.js 의 관계관리 설정이 이 모듈을 쓴다).
   상태(기준 · 연락 · 근거):
     집중관리 = 견적 발송 후 1개월(설정 care_focus_months) · 7일 안 후속(회의 결정) / 일반관리 = 집중 이후 ~ 3개월(설정 care_general_months) · 최소 월 1회(회의 결정)
     대기 = 향후 추진 가능 · 2개월 1회(회의 결정 · long_wait_contact_days) / 보류 = 고객이 중단 사유를 밝힘 · 재검토일에 확인(주기 미확정)
     미확인 · 기준일 확인 필요 = 견적 발송일 없음 · 자동 분류 안 함 · 재분류 대상
   분류 저장 = 기존 내부 메모 경로(DealDetailV3.memo) + 표식 '[관계 상태] 상태 | 사유 | 다음 확인일 | 재검토일 | 공사 예정 연도' · 다음 확인일은 다음 행동(DealDetailV3.next)으로. 새 저장소 없음.
   기간이 지나도 자동 전환하지 않는다 — '전환 검토 요청'(집중 1개월 지남 → 일반 검토 / 일반 3개월 지남 → 대기 · 보류 검토 / 보류 재검토일 도래). 기존 건은 일괄 대기로 바꾸지 않는다(발송일 없으면 미확인).
   고객과 약속한 연락일(다음 행동 날짜)이 있으면 그 날짜 우선. 끄기: G.relV12Off=true → 예전 관계관리 탭(다음 연락일 지남 · 이번 주 · 장기 대기) */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const on=()=>!(root.G&&root.G.relV12Off);
 const KST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 const today=()=>KST.format(new Date()),dayKey=v=>{const s=String(v||'');if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const t=Date.parse(s);return Number.isFinite(t)?KST.format(new Date(t)):'';};
 const addDays=(k,n)=>{const d=new Date(k+'T00:00:00');d.setDate(d.getDate()+n);return KST.format(d);};
 const diff=(a,b)=>Math.round((Date.parse(b+'T00:00:00')-Date.parse(a+'T00:00:00'))/864e5);
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?m[1]+'.'+(+m[2])+'.'+(+m[3]):'';};
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 const KEYS=['focus','normal','wait','hold','unk'],LABEL={focus:'집중관리',normal:'일반관리',wait:'대기',hold:'보류',unk:'미확인 · 기준일 확인 필요'};
 const FROM={'집중관리':'focus','일반관리':'normal','대기':'wait','보류':'hold'};
 const YEARS=['올해','향후 연도','미정'];
 /* 설정값: 집중 · 일반 기간(개월) = 운영 기준 설정(CRMRules care_focus_months · care_general_months) · 7일 · 월 1회 · 2개월은 회의 결정 */
 function rules(){
  let f=1,g=3,wait=60,focus=7,month=30;
  try{f=Number(root.CRMRules.get('care_focus_months'))||1;g=Number(root.CRMRules.get('care_general_months'))||3;wait=Number(root.CRMRules.get('long_wait_contact_days'))||60;}catch(e){}
  try{const O=root.OPS_RULES||{};focus=Number(O.focusContactDays)||7;month=Number(O.monthContactDays)||30;}catch(e){}
  return {focusMonths:f,generalMonths:g,focusEnd:f*30,normalEnd:(f+g)*30,focus,month,wait};
 }
 const CYC=()=>{const q=rules();return {focus:[q.focus,q.focus+'일 후속'],normal:[q.month,'월 1회'],wait:[q.wait,Math.round(q.wait/30)+'개월 1회'],hold:[null,'재검토일'],unk:[null,'기준일 확인 필요']};};
 /* 상태 칸 6개(전체 + 5): 이름 · 기준 한 줄 · 근거 */
 function tabs(){
  const q=rules(),m=q.focusMonths,g=q.generalMonths;
  return [['집중관리','견적 후 '+m+'개월 · '+q.focus+'일 안 후속 통화',q.focus+'일 = 회의 결정 · '+m+'개월 = 잠정(설정)'],['일반관리','견적 후 '+m+'~'+(m+g)+'개월 · 최소 월 1회','월 1회 = 회의 결정 · 기간 = 잠정(설정)'],['대기','향후 추진 가능 · '+Math.round(q.wait/30)+'개월 1회',Math.round(q.wait/30)+'개월 = 회의 결정'],['보류','고객이 중단 사유를 밝힘 · 재검토일에 확인','주기 미확정 · 재검토일만'],['미확인 · 기준일 확인 필요','견적 발송일 · 반응 · 시기 모름','자동 분류 안 함 · 재분류 대상']];
 }
 const WORKS=[['od','다음 연락일 지남'],['wk','이번 주 연락'],['nx','다음 행동 미등록']];
 /* ── 표식 읽기: 가장 나중 기록이 정본 ── */
 function markOf(d){
  let p={};try{p=root.itemPatch?root.itemPatch(d,'deal')||{}:{};}catch(e){}
  let best=null;[].concat(d.activities||[],p.activities||[]).forEach(a=>{const m=/^\[관계 상태\]\s*(.*)$/.exec(String(a&&a.note||'').replace(/\s*\[연결 [^\]]*\]/g,''));if(!m)return;const at=dayKey(a.at||a.occurred_at||'');if(best&&at<best.at)return;const p2=m[1].split('|').map(x=>x.trim());best={state:FROM[p2[0]]||'',reason:p2[1]||'',next:dayKey(p2[2])||'',review:dayKey(p2[3])||'',year:p2[4]||'',at};});
  return best&&best.state?best:null;
 }
 const sentOf=d=>{const cx=d.stage_contexts||{};let v='';Object.keys(cx).some(s=>{const f=cx[s]&&cx[s].fields;if(f&&f.sent_date){v=f.sent_date;return true;}return false;});return dayKey(v);};
 function week(){const t=today(),d=new Date(t+'T00:00:00'),dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);const mon=KST.format(d);return {mon,fri:addDays(mon,4)};}
 /* ── 한 건의 상태 ── */
 function state(r){
  const d=r.item,T=today(),q=rules(),C=CYC(),mk=markOf(d),sent=sentOf(d),el=sent?Math.max(0,diff(sent,T)):null;
  let key=mk?mk.state:(sent?(el<=q.focusEnd?'focus':'normal'):'unk');
  const explicit=!!mk,cyc=C[key],last=(()=>{let n=null;try{n=root.PipelineStageB&&typeof root.PipelineStageB.lastDays==='function'?root.PipelineStageB.lastDays(r):null;}catch(e){}if(n==null){const c=r.contactDays;n=c==null?null:c;}return n;})();
  const lastKey=last==null?'':addDays(T,-last);
  const promised=dayKey(r.due),hasNext=!!(r.next&&r.next.text&&promised);
  let due='',dueWhy='';
  if(promised){due=promised;dueWhy='약속 연락일';}
  else if(key==='hold'){due=mk&&mk.review||'';dueWhy=due?'재검토일':'';}
  else if(key!=='unk'&&cyc[0]){const base=lastKey||sent;if(base){due=addDays(base,cyc[0]);dueWhy=(lastKey?'연락':'견적')+' + '+cyc[0]+'일';}}
  const n=due?diff(T,due):null;
  /* 전환 검토(자동 전환 금지) */
  let review='';
  if(key==='focus'&&el!==null&&el>q.focusEnd)review='toNormal';
  else if(key==='normal'&&el!==null&&el>q.normalEnd)review='toWait';
  else if(key==='hold'&&mk&&mk.review&&mk.review<=T)review='holdDue';
  /* 기준일 한 줄. 표식 없이 견적 발송일로 자리만 잡은 건은 '담당 분류 전'을 붙인다(일괄 분류가 아니라 기본 자리라는 뜻) */
  const base=(key==='unk'?'발송일 없음 · 기간 계산 안 함':key==='focus'?(sent?'견적 '+md(sent)+' · 집중 D+'+el:'분류 '+md(mk.at)+' · 집중'):key==='normal'?(sent?'견적 '+md(sent)+' · 일반 '+Math.max(1,Math.round(el/30))+'개월째':'분류 '+md(mk.at)+' · 일반'):key==='wait'?md(mk.at)+' 전환'+(mk.year?' · '+mk.year:''):'재검토 '+(mk.review?md(mk.review):'미정'))+(!mk&&key!=='unk'?' · 분류 전':'');
  const nowText=key==='unk'?(last==null?'CRM 연락 기록 없음':'마지막 연락 '+last+'일 전'):review==='toNormal'?'집중 '+q.focusMonths+'개월 지남 → 일반관리 검토':review==='toWait'?'일반 '+(q.focusMonths+q.generalMonths)+'개월 지남 → 대기 · 보류 검토':review==='holdDue'?'보류 재검토일 도래 → 추진 여부':(mk&&mk.reason?mk.reason:(last==null?'CRM 연락 기록 없음':'마지막 연락 '+last+'일 전'));
  const od=n!==null&&n<0,W=week(),wk=!!due&&due>=W.mon&&due<=W.fri&&!od,nx=!hasNext;
  const task=key==='unk'?'상태 재분류':review?'전환 검토 · 사유 · 다음 확인일':hasNext?String(r.next.text).trim():key==='focus'?'수신 · 반응 확인 통화':key==='normal'?'월 1회 진행 확인':key==='wait'?'공사 시기 · 예산 확인':'재검토일에 추진 여부';
  const btn=key==='unk'?['분류하기','classify']:review?['전환 검토','classify']:od?['연락 기록','activity']:nx?['다음 행동','next']:['연락 기록','activity'];
  return {key,label:LABEL[key],explicit,mark:mk,sent,elapsed:el,cycle:cyc[0],cycleLabel:cyc[1],tag:LABEL[key].split(' · ')[0]+' · '+cyc[1],base,now:nowText,due,dueWhy,n,od,wk,nx,review,task,btn,classified:explicit||!!sent,last};
 }
 const tabIndex=s=>KEYS.indexOf(s.key);
 const REVIEW=[['toNormal','집중 1개월 지남 → 일반관리 검토'],['toWait','일반 3개월 지남 → 대기 · 보류 검토'],['holdDue','보류 재검토일 도래']];
 function reviewLabel(k){const q=rules();return k==='toNormal'?'집중 '+q.focusMonths+'개월 지남 → 일반관리 검토':k==='toWait'?'일반 '+(q.focusMonths+q.generalMonths)+'개월 지남 → 대기 · 보류 검토':'보류 재검토일 도래';}
 /* ── 왼쪽: 전환 검토 요청 · 기존 건 재분류 ── */
 function leftHtml(items,S){
  const st_=items.map(x=>(x.it&&x.it.rv)||x.rv||state(x.row)),rev=REVIEW.map(([k])=>({k,l:reviewLabel(k),n:st_.filter(s=>s.review===k).length})),revN=rev.reduce((a,r)=>a+r.n,0);
  const total=items.length,done=st_.filter(s=>s.classified).length,pct=total?Math.round(done*100/total):0;
  return '<section class="ps3-box rv-box"><header><b>전환 검토 요청 <em class="r">'+revN+'</em></b></header><p class="rv-note">기간이 지나도 자동으로 바꾸지 않음 · 담당이 사유 · 다음 확인일을 넣고 전환</p>'
   +rev.map(r=>'<button type="button" class="rv-rev'+(S.reason===r.k?' on':'')+'" data-ps3="reason" data-v="'+r.k+'" aria-pressed="'+(S.reason===r.k)+'"><span>'+h(r.l)+'</span><b>'+r.n+'</b></button>').join('')+'</section>'
   +'<section class="ps3-box rv-box"><header><b>기존 '+total+'건 재분류</b></header><p class="rv-note">일괄 대기로 바꾸지 않음. 견적 발송일 · 고객 반응 · 사유 · 다음 확인일을 보고 담당이 고름.</p><div class="rv-prog"><span>분류 끝남</span><b>'+done+' / '+total+'</b></div><span class="rv-bar"><i style="width:'+pct+'%"></i></span></section>';
 }
 /* ── 분류 · 전환 창 ── */
 const st=()=>root.G.rv12||(root.G.rv12={dlg:null});
 function openClassify(key){
  let r=null;try{r=root.PipelineWorkspace.rows().find(x=>x.key===key)||root.PipelineWorkspace.rows({unscoped:true}).find(x=>x.key===key)||null;}catch(e){}
  if(!r){toast('현장을 찾지 못했습니다','warn');return;}
  const s=state(r),q=rules();
  st().dlg={key,r,s,state:s.key==='unk'?(s.sent?(s.elapsed<=q.focusEnd?'focus':'normal'):'focus'):s.review==='toNormal'?'normal':s.review==='toWait'?'wait':s.key,reason:'',next:'',review:'',year:'',busy:false,err:''};render();
 }
 function close(){st().dlg=null;document.getElementById('rv-dlg')?.remove();}
 function render(){
  const D=st().dlg;let ov=document.getElementById('rv-dlg');if(!D){ov?.remove();return;}
  if(!ov){ov=document.createElement('div');ov.id='rv-dlg';ov.className='rv-shade';document.body.append(ov);ov.addEventListener('mousedown',e=>{if(e.target===ov)close();});
   ov.addEventListener('input',e=>{const D2=st().dlg,k=e.target.dataset&&e.target.dataset.rvIn;if(D2&&k)D2[k]=e.target.value;});ov.addEventListener('change',e=>{const D2=st().dlg,k=e.target.dataset&&e.target.dataset.rvIn;if(D2&&k)D2[k]=e.target.value;});}
  const s=D.s,need=D.state==='wait'||D.state==='hold',rows=[['focus','집중관리','견적 후 '+rules().focusMonths+'개월 · '+rules().focus+'일 안 후속'],['normal','일반관리','최소 월 1회'],['wait','대기','향후 추진 가능 · '+Math.round(rules().wait/30)+'개월 1회 · 사유 + 다음 확인일 필수'],['hold','보류','고객이 중단 사유를 밝힘 · 사유 + 재검토일 필수']];
  ov.innerHTML='<section class="rv-box2" role="dialog" aria-modal="true" aria-label="관계 상태 분류"><header><b>'+h(s.key==='unk'?'상태 분류':'전환 검토')+'</b><span>'+h(D.r.site||'')+' · 지금 '+h(s.label)+(s.review?' · '+h(reviewLabel(s.review)):'')+'</span><i></i><button type="button" class="rv-x" data-rv="close" aria-label="닫기">✕</button></header>'
   +'<div class="rv-states" role="radiogroup">'+rows.map(x=>'<button type="button" role="radio" data-rv="state" data-v="'+x[0]+'" aria-checked="'+(D.state===x[0])+'"><b>'+x[1]+'</b><span>'+h(x[2])+'</span></button>').join('')+'</div>'
   +'<label class="rv-f"><span>사유'+(need?' *':'')+'</span><input data-rv-in="reason" maxlength="120" placeholder="'+(D.state==='hold'?'고객이 밝힌 중단 사유':D.state==='wait'?'대기 사유 (예: 2027 봄 공사 · 장기수선 반영 대기)':'한 줄 (선택)')+'" value="'+attr(D.reason)+'"></label>'
   +'<div class="rv-two"><label class="rv-f"><span>다음 확인일 *</span><input type="date" data-rv-in="next" min="'+today()+'" value="'+attr(D.next)+'"></label>'+(D.state==='hold'?'<label class="rv-f"><span>재검토일 *</span><input type="date" data-rv-in="review" min="'+today()+'" value="'+attr(D.review)+'"></label>':'<label class="rv-f"><span>공사 예정 연도</span><select data-rv-in="year"><option value="">선택</option>'+YEARS.map(y=>'<option'+(D.year===y?' selected':'')+'>'+y+'</option>').join('')+'</select></label>')+'</div>'
   +(D.state==='hold'?'<label class="rv-f"><span>공사 예정 연도</span><select data-rv-in="year"><option value="">선택</option>'+YEARS.map(y=>'<option'+(D.year===y?' selected':'')+'>'+y+'</option>').join('')+'</select></label>':'')
   +'<p class="rv-hint">\'미정\'이라고 실주 처리하지 않습니다 · 다음 확인일은 다음 할 일로 등록됩니다 · 기록은 응대 이력에 남습니다</p>'
   +(D.err?'<p class="rv-err">'+h(D.err)+'</p>':'')+'<footer><button type="button" data-rv="close">취소</button><button type="button" class="go" data-rv="save"'+(D.busy?' disabled':'')+'>'+(D.busy?'저장 중…':'저장')+'</button></footer></section>';
 }
 async function save(){
  const D=st().dlg;if(!D||D.busy)return;const need=D.state==='wait'||D.state==='hold';
  if(need&&!String(D.reason).trim()){D.err='사유를 적어 주세요.';return render();}
  if(!D.next){D.err='다음 확인일을 골라 주세요.';return render();}
  if(D.state==='hold'&&!D.review){D.err='보류는 재검토일이 필요합니다.';return render();}
  D.busy=true;D.err='';render();
  const d=D.r.item,name={focus:'집중관리',normal:'일반관리',wait:'대기',hold:'보류'}[D.state];
  try{
   await root.DealDetailV3.memo(d,'[관계 상태] '+name+' | '+(String(D.reason).trim()||'사유 없음')+' | '+D.next+' | '+(D.review||'없음')+' | '+(D.year||'미정'),{});
   try{await root.DealDetailV3.next(d,{type:'전화',text:name+' · '+(D.state==='hold'?'재검토 전 확인':D.state==='wait'?'공사 시기 · 예산 확인':'진행 확인'),due:D.next});}catch(e){}
   close();toast(name+'(으)로 분류했습니다 · 다음 확인일 '+md(D.next));try{root.paint();}catch(e){}
  }catch(e){D.busy=false;D.err='저장하지 못했습니다: '+String(e&&e.message||e);render();}
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('#rv-dlg [data-rv]');if(!b)return;const D=st().dlg;if(!D)return;const a=b.dataset.rv;e.preventDefault();e.stopPropagation();
  if(a==='close')return close();
  if(a==='state'){D.state=b.dataset.v;D.err='';return render();}
  if(a==='save')return save();
 },true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&st().dlg){close();}},true);
 root.RelV12={on,rules,tabs,WORKS,KEYS,LABEL,CYC,state,tabIndex,leftHtml,reviewLabel,REVIEW,openClassify,markOf,sentOf,week};
})(window);
