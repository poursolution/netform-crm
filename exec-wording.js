/* 대표 판단 문구 · 업무량 · 왜 이 판단인지 (2026-10-07 design_handoff_exec_wording · 시안 '대표 판단 문구 시안.dc.html')
   배치는 그대로. 문구와 숫자 계산만 한 곳(ExecWording)에서 낸다 — 영업 대시보드 · 영업사원 관리 · 영업 인사이트가 같은 함수를 부른다.
     ① closeSplit  종결 문의를 5분류(부적합 · 중복 · 협약 → B2B 전환 · 고객 취소 · 사유 미확인). 유입 품질 판단은 부적합만 기준
     ② waitSplit   영업건 전환 대기를 나눔(첫 연락 전 기한 안 / 2시간 넘김 · 응대 중 정상 / 7일 무연락 · 담당 미배정). 진행 중은 이탈이 아니다. 한 건은 한 곳에만 셈
     ③ actionSplit 조치 필요 = 기한 지남 + 다음 할 일 없음 + 담당 미배정 + 그 밖 — 한 건은 한 사유(우선순위 순), 합계 = 제목 숫자
     ④ loadOf      담당자 업무량 5칸(오늘 처리 · 이번 주 일정 · 첫 연락 전 · 관리 고객 · 기록 보완) + 신규 배정 판단(가능 / 여유 없음 / 기록 보완 먼저 / 첫 연락 먼저)
     ⑤ advance     단계 전진 = 다음 단계로 이동 + 근거 기록 · 월~금 · 뒤로 이동 · 종결 제외(대시보드 · 영업사원 관리 같은 함수)
     ⑥ postpone    기한 미루기 = 원래 기한 · 새 기한 · 사유(필수)를 '[기한 변경]' 기록으로 남김 — 미뤄도 지연 기록은 그대로, KPI '기한 변경 n회'
     ⑦ openWhy     판정 문구를 누르면 '왜 이 판단인지'(사유별 건수 · 판정 조건 · 제외 · 기준 시각 · 대상 목록 — 측정 기준 근거 패널과 같은 모양)
   설정값이 아닌 기준(신규 배정 판단 문턱)은 '잠정'으로 적는다. 끄기: G.execWordingOff=true → 예전 문구 */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const on=()=>!(R.G&&R.G.execWordingOff);
 const J=()=>R.PipelineJudge||null;
 const KST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 const todayKey=()=>KST.format(new Date());
 const dk=v=>{const j=J();return j?j.dayKey(v):String(v||'').slice(0,10);};
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const addDays=(k,n)=>{const d=new Date(k+'T00:00:00');d.setDate(d.getDate()+n);return KST.format(d);};
 const diffDays=(a,b)=>Math.round((Date.parse(b+'T00:00:00')-Date.parse(a+'T00:00:00'))/864e5);
 const OPS=()=>R.OPS_RULES||{};
 const FIRST_H=()=>Number(OPS().towerFirstResponseHours)||2;
 const FOLLOW_D=()=>Number(OPS().inquiryFollowDays)||7;
 const stamp=()=>{const n=new Date(),p=v=>String(v).padStart(2,'0');return n.getFullYear()+'.'+(n.getMonth()+1)+'.'+n.getDate()+' '+p(n.getHours())+':'+p(n.getMinutes())+' 기준';};
 const patch=(d,k)=>{try{return (R.itemPatch&&R.itemPatch(d,k||'deal'))||{};}catch(e){return {};}};
 const ownerOfInq=q=>{try{return R.inquiryRoutedOwner?R.inquiryRoutedOwner(q)||'':'';}catch(e){return '';}};
 const siteOf=x=>String((x&&(x.site||x.site_name))||'현장명 미입력');
 /* ── ① 종결 5분류 ── */
 const CLOSE=[['bad','부적합 (배드핏)','#d14a3f'],['dup','중복 문의','#9aa0ab'],['b2b','협약 문의 → B2B 전환','#3b6ce4'],['cancel','고객 취소 · 계획 없음','#9aa0ab'],['unk','사유 미확인','#b8c0e0']];
 function closeKind(q){
  let c=null;try{c=R.InquiryFlow&&R.InquiryFlow.closeOf?R.InquiryFlow.closeOf(q):null;}catch(e){}
  const txt=[c&&c.reason,c&&c.detail,q&&q.close_reason,q&&q.status].map(v=>String(v||'')).join(' ');
  if(/중복/.test(txt))return 'dup';
  if(!c)return 'unk';
  if(c.kind==='bad_fit')return 'bad';
  if(c.kind==='transfer')return 'b2b';
  if(c.kind==='consult_end'||c.kind==='unreachable')return 'cancel';
  return 'unk';
 }
 /* 합계 = 종결 건수. 사유별로 한 건은 한 곳 */
 function closeSplit(list){
  list=list||[];const by={};CLOSE.forEach(c=>by[c[0]]=[]);list.forEach(q=>by[closeKind(q)].push(q));
  const parts=CLOSE.map(c=>({k:c[0],l:c[1],c:c[2],n:by[c[0]].length,list:by[c[0]]}));
  return {total:list.length,parts,bad:by.bad.length,unknown:by.unk.length,by};
 }
 /* ── ② 영업건 전환 대기 ── */
 const WAIT=[['firstOk','첫 연락 전 · 기한 안','#9aa0ab'],['firstLate','첫 연락 전 · '+'2시간 넘김','#d14a3f'],['talkOk','응대 중 · 정상','#9aa0ab'],['talkStale','응대 중 · 7일 넘게 연락 없음','#e08a80'],['noOwner','담당 미배정','#b8c0e0']];
 function waitKind(q,now){
  let fr='';try{fr=R.inqCtlFirstResponseAt?R.inqCtlFirstResponseAt(q)||'':'';}catch(e){}
  if(!fr){
   let assigned=false,at='';try{assigned=!!R.inquiryAssigned(q);at=R.inquiryAssignedAt(q)||'';}catch(e){}
   if(!assigned||!at)return 'noOwner';
   const t=Date.parse(at);return Number.isFinite(t)&&(now-t)/36e5>FIRST_H()?'firstLate':'firstOk';
  }
  let last=Date.parse(fr);try{const c=R.ContactState&&R.ContactState.of?R.ContactState.of(q,'inq'):null;[c&&c.lastAttemptAt,c&&c.lastConnectedAt].forEach(v=>{const t=Date.parse(v||'');if(Number.isFinite(t)&&(!Number.isFinite(last)||t>last))last=t;});}catch(e){}
  return Number.isFinite(last)&&(now-last)/864e5>FOLLOW_D()?'talkStale':'talkOk';
 }
 function waitSplit(list){
  list=list||[];const now=Date.now(),by={};WAIT.forEach(w=>by[w[0]]=[]);list.forEach(q=>by[waitKind(q,now)].push(q));
  const parts=WAIT.map(w=>({k:w[0],l:w[1].replace('2시간',FIRST_H()+'시간').replace('7일',FOLLOW_D()+'일'),c:w[2],n:by[w[0]].length,list:by[w[0]]})).filter(p=>p.k!=='noOwner'||p.n>0);
  const first=by.firstOk.length+by.firstLate.length+by.noOwner.length,talk=by.talkOk.length+by.talkStale.length,delay=by.firstLate.length+by.talkStale.length;
  return {total:list.length,parts,first,talk,delay,by};
 }
 /* ── ③ 조치 필요 = 한 건 한 사유 ── */
 const ACT=[['overdue','기한 지남'],['missing','다음 할 일 없음'],['unassigned','담당 미배정'],['other','그 밖 · 연락 · 정체 · 정보 부족']];
 function actionKind(d){
  const is=d&&d.issues||[];
  if(is.includes('overdue')||is.includes('promise'))return 'overdue';
  if(is.includes('missing'))return 'missing';
  if(is.includes('unassigned'))return 'unassigned';
  return 'other';
 }
 function actionSplit(risk){
  risk=risk||[];const by={};ACT.forEach(a=>by[a[0]]=[]);risk.forEach(d=>by[actionKind(d)].push(d));
  const parts=ACT.map(a=>({k:a[0],l:a[1],n:by[a[0]].length,list:by[a[0]]})).filter(p=>p.n>0||p.k!=='other');
  return {total:risk.length,parts,by,text:parts.filter(p=>p.n>0||p.k!=='other').map(p=>p.l+' '+p.n).join(' + ')+(risk.length?' = '+risk.length:'')};
 }
 /* ── ⑤ 단계 전진: 다음 단계로 이동 + 근거 기록 · 월~금 · 뒤로 이동 · 종결 제외 ── */
 const rankOf=c=>{try{return R.perfStageRank?R.perfStageRank(c):null;}catch(e){return null;}};
 const ORD=['first_contact','consulting','sent','rapport','silent','waiting','compete','imminent','bidding','contract','construction','completion'];
 const isEndStage=c=>/^(won|lost|badfit|nocontact|closed|completion)/.test(String(c||''));
 function evidenceOf(x,d,to){
  if(String(x.reason||x.note||x.evidence||x.memo||'').trim())return true;
  const cx=(d&&(d.stage_contexts||patch(d).stage_contexts))||{};const c=cx[to];return !!(c&&c.fields&&Object.keys(c.fields).some(k=>c.fields[k]!=null&&c.fields[k]!==''));
 }
 /* 한 영업건의 그 주(월~금) 인정된 전진 — {ok:이동 기록, evidence:근거 있음} */
 function advanceOf(d,w){
  w=w||J().week(0);let out=null;
  try{(R.briefAllStageEvents(d)||[]).forEach(x=>{
   const at=dk(x.at||x.changed_at||x.created_at),from=x.from||x.before||x.old_stage,to=x.to||x.after||x.new_stage;
   if(!at||at<w.mon||at>w.fri)return;
   const rf=rankOf(from),rt=rankOf(to);if(rf===null||rt===null||rt<=rf)return;/* 뒤로 이동 · 같은 자리 제외 */
   if(isEndStage(to))return;/* 종결(수주 · 실주 · 준공)은 전진으로 세지 않는다 */
   const ev=evidenceOf(x,d,to);if(!out||(ev&&!out.evidence))out={at,from,to,evidence:ev};
  });}catch(e){}
  return out;
 }
 const advanced=(d,w)=>{const a=advanceOf(d,w);return !!(a&&a.evidence);};
 function advanceStats(deals,w){
  const ok=[],noEv=[];(deals||[]).forEach(d=>{const a=advanceOf(d,w);if(!a)return;(a.evidence?ok:noEv).push({d,a});});
  return {ok,noEv,n:ok.length};
 }
 const ADVANCE_RULE='다음 단계로 이동 + 근거 기록 있음 · 대상: 영업 담당 전체 · 기간 월~금 · 뒤로 이동 · 종결은 제외';
 /* ── ④ 업무량 5칸 + 신규 배정 판단 ── */
 const SCHED=[['PT',/PT/],['입찰',/입찰/],['현설',/현설|현장\s*설명/],['미팅',/미팅|회의/],['방문',/방문|실측|실사/]];
 const LIMIT={busy:6,fix:20};/* 잠정 기준(설정값 아님): 오늘 처리 6건 이상 = 여유 없음 · 기록 보완 20건 이상 = 기록 보완 먼저 */
 function firstBefore(name){
  let L=[];try{L=R.operationalInquiries(R.B&&R.B.inquiries||[]);}catch(e){}
  return L.filter(q=>{
   try{if(R.repN(ownerOfInq(q))!==name)return false;if(q.deleted_at||q.deletedAt)return false;if(R.isClosedInq&&R.isClosedInq(q))return false;if(R.inqCtlConverted&&R.inqCtlConverted(q))return false;return !(R.inqCtlFirstResponseAt&&R.inqCtlFirstResponseAt(q));}catch(e){return false;}
  });
 }
 function loadOf(r,wsRows){
  const T=todayKey(),j=J(),w=j?j.week(0):{mon:T,fri:T},cur=r.current||[],name=r.nm;
  const due=[],sched=[],miss=[];
  cur.forEach(d=>{
   let a=null;try{a=R.actionObj(d,patch(d));}catch(e){}
   const k=a&&(a.due||a.due_at)?dk(a.due||a.due_at):'';
   if(k&&k<=T)due.push({d,k,over:k<T,a});
   else if(k&&k>=w.mon&&k<=w.fri){const s=[a.type,a.text].join(' '),hit=SCHED.find(x=>x[1].test(s));if(hit)sched.push({d,k,kind:hit[0],a});}
   try{let g='';try{g=R.PipelineStages.group(R.dealStage(d))||'';}catch(e){}const b=j.basis(d,g),mk=j.missKind(d,b);if(mk==='cur'||mk==='past')miss.push({d,mk});}catch(e){}
  });
  /* 이번 주 일정에는 오늘 처리에 이미 든 건(기한 도래)을 또 세지 않는다 · 오늘 날짜 일정은 오늘 처리 */
  const fb=firstBefore(name),now=Date.now(),late=fb.filter(q=>{try{const a=Date.parse(R.inquiryAssignedAt(q)||'');return Number.isFinite(a)&&(now-a)/36e5>FIRST_H();}catch(e){return false;}});
  const rel={focus:0,normal:0,wait:0,hold:0,unk:0};let relUnknown=!Array.isArray(wsRows);
  (wsRows||[]).forEach(x=>{try{if(x.group!=='relationship'||R.repN(x.owner)!==name)return;const s=R.RelV12.state(x);if(rel[s.key]!=null)rel[s.key]++;else rel.unk++;}catch(e){relUnknown=true;}});
  const kinds={};sched.forEach(s=>kinds[s.kind]=(kinds[s.kind]||0)+1);
  const schedText=sched.length?sched.length+' · '+Object.keys(kinds).map(k=>k+' '+kinds[k]).join(' · '):'0';
  const relN=Object.values(rel).reduce((a,n)=>a+n,0),relText=relUnknown?'집계 미확인':relN?[rel.focus?'집중 '+rel.focus:'',rel.normal?'일반 '+rel.normal:'',rel.wait?'대기 '+rel.wait:'',rel.hold?'보류 '+rel.hold:'',rel.unk?'분류 미확인 '+rel.unk:''].filter(Boolean).join(' · '):'0';
  const noNext=cur.filter(d=>{try{const a=R.actionObj(d,patch(d));return !(a&&String(a.text||'').trim()&&dk(a.due||a.due_at));}catch(e){return true;}}),stale=Number(r.stale)||0;
  let judge='가능';
  if(fb.length)judge='첫 연락 먼저';else if(due.length>=LIMIT.busy)judge='여유 없음';else if(noNext.length||stale||rel.unk||relUnknown||miss.length>=LIMIT.fix)judge='기록 보완 먼저';
  return {name,due,sched,first:fb,late,miss,noNext,stale,rel,relN,relUnknown,relText,schedText,judge,counts:{due:due.length,sched:sched.length,first:fb.length,fix:miss.length}};
 }
 function loadAll(rows){let ws=null;try{ws=R.PipelineWorkspace.rows({unscoped:true});}catch(e){}return (rows||[]).map(r=>loadOf(r,ws));}
 const JUDGE_STYLE={'가능':['#1f7a4d','#e8f6ee'],'기록 보완 먼저':['#3d4b8c','#edf0fb'],'여유 없음':['#b42318','#fdecec'],'첫 연락 먼저':['#b42318','#fdecec']};
 /* ── ⑦ 왜 이 판단인지: 모달 · 측정 기준 근거 패널과 같은 모양(km-panel) ── */
 const WS=()=>R.G.ew||(R.G.ew={why:null,page:1});
 const rowH=r=>'<div class="km-row"'+(r.k?' role="button" tabindex="0" data-ew="open" data-kind="'+attr(r.kind||'deal')+'" data-v="'+attr(r.k)+'"':'')+'><span class="km-s1" title="'+attr(r.s+' · '+r.w)+'"><b>'+h(r.s)+'</b>'+(r.w?' · '+h(r.w):'')+'</span><span class="km-j '+(r.cls||'na')+'">'+h(r.j)+'</span><span class="km-e" title="'+attr(r.e)+'">'+h(r.e)+'</span></div>';
 function whyHtml(spec,page){
  const rows=spec.rows||[],pg=R.ListPager?R.ListPager.cut(rows,page||1):{rows,page:1,pages:1,total:rows.length,from:0,to:rows.length};
  return '<div class="ew-card" role="dialog" aria-modal="true" aria-label="왜 이 판단인지"><section class="km-panel"><header><b>왜 이 판단인지 보기 · '+h(spec.title)+'</b><span>'+h(spec.hint||'판정 문구를 누르면')+'</span><i class="ew-sp"></i><button type="button" class="ew-x" data-ew="close" aria-label="닫기">닫기 ✕</button></header>'
   +'<div class="ew-pb"><div class="ew-tiles">'+(spec.tiles||[]).map(t=>'<div><span>'+h(t[0])+'</span><b>'+h(t[1])+'</b></div>').join('')+'</div>'
   +'<dl class="ew-dl"><dt>판정 조건</dt><dd>'+h(spec.cond)+'</dd><dt>제외</dt><dd>'+h(spec.exc)+'</dd><dt>근거 날짜</dt><dd>'+h(stamp())+(spec.basis?' · '+h(spec.basis):'')+'</dd></dl>'
   +(spec.sum?'<p class="ew-sum">'+h(spec.sum)+'</p>':'')+'</div>'
   +'<div class="km-pr"><div class="km-rh"><span>현장 · 담당</span><span>판정</span><span>근거 · 보완할 것</span></div>'+(pg.rows.length?pg.rows.map(rowH).join(''):'<p class="km-none">해당하는 건이 없습니다</p>')+(R.ListPager?R.ListPager.html(pg,{ns:'ew',small:true}):'')+'</div></section></div>';
 }
 function paintWhy(){
  const S=WS();let ov=document.getElementById('ew-why');
  if(!S.why){if(ov)ov.remove();return;}
  let spec=null;try{spec=S.why();}catch(e){spec=null;}
  if(!spec){S.why=null;if(ov)ov.remove();return;}
  if(!ov){ov=document.createElement('div');ov.id='ew-why';ov.className='ew-ov';document.body.appendChild(ov);}
  ov.innerHTML=whyHtml(spec,S.page);
 }
 function openWhy(fn){const S=WS();S.why=fn;S.page=1;paintWhy();}
 function closeWhy(){const S=WS();S.why=null;paintWhy();}
 const rowOfDeal=(d,j,cls,e)=>({kind:'deal',k:String(R.dealKey?R.dealKey(d.item||d):''),s:siteOf(d.item||d),w:String(d.owner||(d.item&&R.repN?R.repN(d.item.assignee):'')||'미배정'),j,cls,e});
 const rowOfInq=(q,j,cls,e)=>({kind:'inq',k:String(R.inqKey?R.inqKey(q):q.id||''),s:siteOf(q),w:String(ownerOfInq(q)||'미배정'),j,cls,e});
 /* 문구별 근거(스펙): 호출하는 화면이 자료를 넘긴다 */
 function specClose(bad,total){
  const sp=closeSplit(bad),first3=[['부적합',sp.bad],['사유 미확인',sp.unknown],['그 밖 분류',sp.total-sp.bad-sp.unknown]];
  const rows=[];sp.parts.forEach(p=>p.list.forEach(q=>{let c=null;try{c=R.InquiryFlow.closeOf(q);}catch(e){}rows.push(rowOfInq(q,p.l.replace(/ \(.*\)$/,'').replace(/ → .*$/,''),p.k==='bad'?'bad':p.k==='unk'?'na':'ok',[c&&c.label,c&&c.reason].filter(Boolean).join(' · ')||'종결 사유 없음 · 분류 필요'));}));
  return {title:'종결 '+sp.total+'건 · 사유별 분류',tiles:first3,cond:'견적문의 가운데 영업건으로 이어지지 않고 닫힌 것 · 사유 5분류(부적합 · 중복 · 협약 → B2B 전환 · 고객 취소 · 사유 미확인) · 한 건은 한 분류',exc:'영업건으로 전환된 문의 · 진행 중 문의 · 휴지통',basis:'유입 품질 판단은 부적합 '+sp.bad+'건만 기준 · 사유 미확인 '+sp.unknown+'건은 분류 후 다시 판단',sum:sp.parts.map(p=>p.n).join(' + ')+' = '+sp.total,rows};
 }
 function specWait(list){
  const sp=waitSplit(list),rows=[];
  const J2={firstOk:['기한 안','ok'],firstLate:['2시간 넘김','bad'],talkOk:['정상','ok'],talkStale:['7일 무연락','bad'],noOwner:['담당 미배정','bad']};
  sp.parts.forEach(p=>p.list.forEach(q=>{const j=J2[p.k];rows.push(rowOfInq(q,j[0].replace('2시간',FIRST_H()+'시간').replace('7일',FOLLOW_D()+'일'),j[1],p.l));}));
  rows.sort((a,b)=>(a.cls==='bad'?0:1)-(b.cls==='bad'?0:1));
  return {title:'영업건 전환 대기 '+sp.total+'건',tiles:[['첫 연락 전',sp.first+'건'],['응대 중',sp.talk+'건'],['지연 확인 필요',sp.delay+'건']],cond:'적합 문의 가운데 아직 영업건으로 옮겨지지 않은 것 · 첫 연락 전(배정 후 '+FIRST_H()+'시간 기준) · 응대 중('+FOLLOW_D()+'일 넘게 연락 없으면 지연) · 한 건은 한 곳에만',exc:'부적합 · 종결 문의 · 이미 영업건이 된 문의 · 진행 중은 이탈로 부르지 않음',sum:sp.parts.map(p=>p.n).join(' + ')+' = '+sp.total,rows};
 }
 function specAction(risk,hint){
  const sp=actionSplit(risk),rows=[];
  const J2={overdue:['기한 지남','bad'],missing:['다음 할 일 없음','bad'],unassigned:['담당 미배정','bad'],other:['그 밖','na']};
  sp.parts.forEach(p=>p.list.forEach(d=>{const j=J2[p.k];rows.push(rowOfDeal(d,j[0],j[1],String(d.reason||'').replace(/ · /g,' · ')||j[0]));}));
  const top=sp.parts.filter(p=>p.k!=='other'||p.n>0);
  return {title:'조치 필요 '+sp.total+'건',tiles:top.slice(0,3).map(p=>[p.l.replace(/ · .*$/,''),p.n+'건']),cond:'진행 중 영업건 가운데 기한 지남 · 다음 할 일 없음 · 담당 미배정(그 밖: 연락 · 정체 · 정보 부족) 중 하나 · 한 건은 한 사유로만 셈(기한 지남 → 다음 할 일 없음 → 담당 미배정 → 그 밖)',exc:'수주 · 실주 · 종료 · 과거 이관 · 보류 재개일 전 · 고객 합의 대기',sum:sp.text,rows,hint};
 }
 function specLoad(L){
  const row=(x,j,cls,e)=>rowOfDeal({item:x.d,owner:L.name},j,cls,e);
  const rows=[];
  L.due.forEach(x=>rows.push(row(x,x.over?'기한 지남':'오늘까지',x.over?'bad':'ok',(x.a&&x.a.text||'다음 할 일')+' · '+md(x.k))));
  L.first.forEach(q=>rows.push(rowOfInq(q,'첫 연락 전','bad','배정 후 첫 연락 기록 없음')));
  L.sched.forEach(x=>rows.push(row(x,x.kind,'ok','이번 주 '+md(x.k)+' · '+(x.a&&x.a.text||''))));
  L.miss.forEach(x=>rows.push(row(x,'기록 보완',x.mk==='cur'?'bad':'na',x.mk==='cur'?'현재 업무 · 기록 없음':'과거 이관 · 자료 확인')));
  const st=JUDGE_STYLE[L.judge]||JUDGE_STYLE['가능'];
  return {title:L.name+' · 신규 배정 '+L.judge,tiles:[['오늘 처리',L.due.length+'건'],['첫 연락 전',L.first.length+'건'],['기록 보완',L.miss.length+'건']],cond:'오늘 처리(기한 도래 · 초과) · 이번 주 일정(미팅 · 현설 · PT · 입찰 · 방문) · 첫 연락 전 · 관리 고객(집중 · 일반 · 대기) · 기록 보완 5칸으로 판단 — 첫 연락 전이 있으면 첫 연락 먼저 → 오늘 처리 '+LIMIT.busy+'건 이상이면 여유 없음 → 기록 보완 '+LIMIT.fix+'건 이상이면 기록 보완 먼저 → 다음 행동 미등록·정체·관계 분류 미확인이 있으면 기록 보완 먼저 → 그 밖 가능',exc:'수주 · 실주 · 종료 · 과거 이관(진행 범위 밖) · 문턱 숫자는 잠정 기준(설정값 아님)',sum:'판단 = '+L.judge,rows,_st:st};
 }
 /* ── ⑥ 기한 미루기 ── */
 const openDue=d=>{let a=null;try{a=R.actionObj(d,patch(d));}catch(e){}const k=a&&(a.due||a.due_at)?dk(a.due||a.due_at):'';return {a,k};};
 /* 원래 기한 · 새 기한 · 사유 창. 미루는 것(새 기한이 더 늦음)일 때만. 사유는 필수 — 저장은 호출한 화면이 하고, 성공 뒤 logPostpone 으로 기록을 남긴다 */
 function postponeAsk(d,newDue){
  return new Promise(res=>{
   const cur=openDue(d),old=cur.k,nd=dk(newDue);
   if(!on()||!old||!nd||nd<=old)return res({ok:true,postpone:false});
   const over=diffDays(old,todayKey()),late=over>0?over+'일 지남':over===0?'오늘까지':(-over)+'일 남음';
   const ov=document.createElement('div');ov.className='ew-ov ew-pp';ov.id='ew-postpone';
   ov.innerHTML='<form class="ew-card ew-form" role="dialog" aria-modal="true" aria-label="기한 미루기"><h3>기한 미루기 · '+h(siteOf(d))+'</h3><dl class="ew-dl"><dt>원래 기한</dt><dd>'+h(md(old))+' <b class="'+(over>0?'r':'')+'">'+h(late)+'</b></dd><dt>새 기한</dt><dd>'+h(md(nd))+'</dd><dt>사유 *</dt><dd><textarea data-ew-reason rows="2" placeholder="예: 고객 요청 · 입대의 후 연락" aria-label="미루는 사유"></textarea></dd></dl><p class="ew-hint">미뤄도 지연 기록은 남음 · KPI \'기한 변경 n회\'로 따로 셈</p><p class="ew-err" role="alert"></p><div class="ew-act"><button type="button" data-ew-cancel>취소</button><button type="submit" class="pri">미루기 저장</button></div></form>';
   document.body.appendChild(ov);const f=ov.querySelector('form'),t=ov.querySelector('textarea'),er=ov.querySelector('.ew-err');
   const done=v=>{ov.remove();res(v);};
   f.onsubmit=e=>{e.preventDefault();const reason=t.value.replace(/\s+/g,' ').trim();if(!reason){er.textContent='미루는 사유를 입력해 주세요.';t.focus();return;}done({ok:true,postpone:true,from:old,to:nd,reason,over});};
   ov.querySelector('[data-ew-cancel]').onclick=()=>done({ok:false,cancel:true});
   ov.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();done({ok:false,cancel:true});}});
   setTimeout(()=>t.focus(),30);
  });
 }
 const postponeInfo=(from,to,reason)=>({ok:true,postpone:true,from,to,reason,over:Math.max(0,diffDays(from,todayKey()))});
 const MARK=/^\[기한 변경\]\s*(.*)$/;
 const markText=g=>'[기한 변경] 원래 '+g.from+(g.over>0?' ('+g.over+'일 지남)':'')+' | 새 '+g.to+' | 사유 '+g.reason;
 /* 성공한 뒤 기록: 서버 활동(내부 메모) + 이 PC 의 postponeLog 에 사유 */
 async function logPostpone(d,g){
  if(!g||!g.postpone)return;
  try{const p=patch(d);const L=p.postponeLog;if(Array.isArray(L)&&L.length){const last=L[L.length-1];if(last&&!last.reason)last.reason=g.reason;}}catch(e){}
  try{if(R.DealDetailV3&&R.DealDetailV3.memo)await R.DealDetailV3.memo(d,markText(g));}catch(e){}
 }
 /* 이번 주(월~금) 기한 변경 횟수 — 기록 표식 '[기한 변경]' 을 센다 */
 function postponeCount(deals,w){
  const j=J();w=w||(j?j.week(0):null);let n=0,list=[];
  (deals||(R.B&&R.B.deals)||[]).forEach(d=>{[].concat(d.activities||[],patch(d).activities||[]).forEach(a=>{const m=MARK.exec(String(a&&a.note||'').replace(/\s*\[연결 [^\]]*\]/g,''));if(!m)return;const at=dk(a.at||a.occurred_at||a.created_at);if(w&&(!at||at<w.mon||at>w.fri))return;n++;list.push({d,at,text:m[1]});});});
  return {n,list};
 }
 /* ── 이벤트 ── */
 function onClick(e){
  const b=e.target.closest&&e.target.closest('[data-ew-why],[data-ew]');if(!b)return;
  if(b.dataset.ewWhy){const f=EWHY[b.dataset.ewWhy];if(typeof f==='function'){e.preventDefault();e.stopPropagation();f(b);}return;}
  const a=b.dataset.ew;
  if(a==='close'){closeWhy();return;}
  if(a==='page'){WS().page=Number(b.dataset.page)||1;paintWhy();return;}
  if(a==='open'){const kind=b.dataset.kind,v=b.dataset.v;closeWhy();try{R.KpiB.openTarget(kind==='inq'?'inq':'deal',v);}catch(x){}return;}
 }
 /* 화면이 data-ew-why="이름" 을 달고, 이름별 근거를 EWHY 에 둔다(그리는 화면이 자료를 가진 함수로 등록) */
 const EWHY={};
 function register(name,fn){EWHY[name]=fn;}
 function boot(){
  if(document.__ew)return;document.__ew=true;document.addEventListener('click',onClick,true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&WS().why){closeWhy();}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.ExecWording={on,CLOSE,WAIT,closeKind,closeSplit,waitKind,waitSplit,ACT,actionKind,actionSplit,advanceOf,advanced,advanceStats,ADVANCE_RULE,LIMIT,JUDGE_STYLE,firstBefore,loadOf,loadAll,specClose,specWait,specAction,specLoad,openWhy,closeWhy,paintWhy,register,postponeAsk,postponeInfo,logPostpone,postponeCount,markText,MARK,stamp};
})(window);
