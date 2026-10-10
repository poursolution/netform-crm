/* 오늘 업무 4구역 — 기록 부족 ≠ 영업 정체 · 하루 마감 (2026-10-10 design_handoff_day_zones §4-3 · §5 · 시안 '기록 부족 vs 영업 정체' · '하루 업무 구역 · 마감 요약')
   day-zones.js 위에 얹는다(판정 · 숫자는 관제탑 · 판정 함수 그대로 — 여기서는 '기록이 없는 것'과 '실제로 멈춘 것'을 가를 뿐).
   · [활동 여부 확인] 칸: CRM 에 접촉 기록이 없는 영업건은 바로 '연락 요청'으로 잇지 않는다 — 상황 4가지 중 하나를 고른다.
     ① 통화했는데 기록 안 함 → 그 날짜로 통화 결과 등록  ② 고객이 나중에 연락 달라고 함 → 약속일 · 대기 사유 → 회신 대기 구역
     ③ 담당도 모름 → 고객 연락 업무 생성(이때만)  ④ 다른 영업건으로 진행 중 → 그 영업건을 적어 두고 이 건은 상세에서 한 건씩 정리
   · 기록 상태 4가지: 활동 확인 필요 / 회신 대기(사유 + 확인일) / 무기한 대기(사유만) / 실제 정체(활동이 확인됐는데 움직임 없음). 지연 · 평가 = 실제 정체만.
   · 진전 확인: 근거 보기 안에 다음 단계 조건 5가지(결정권자 · 자료 · 방문 · 경쟁사 · 결정 일정) — 연락은 많은데 조건이 안 채워지면 '연락 반복 · 진전 없음'.
   · 하루 마감 요약: 오늘 완료 · 미완료 약속(사유 + 다음 처리일이 있어야 마감) · 내일 이어갈 일 → 요약 글을 그대로 복사해 공유.
   저장은 기존 길만: 응대 기록(DealDetailV3.record) · 다음 할 일(next) · 내부 메모(memo '[활동 확인] …' · '[마감] …'). 새 서버 함수 · 새 칸 없음.
   끄기: G.dayExtraOff=true */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const on=()=>!(R.G&&R.G.dayExtraOff)&&!!R.DayZones;
 const st=()=>R.DayZones.state();
 const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
 const ms=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?Date.UTC(+m[1],+m[2]-1,+m[3]):NaN;};
 const add=(k,n)=>{const t=ms(k);return Number.isFinite(t)?new Date(t+n*864e5).toISOString().slice(0,10):'';};
 const weekday=k=>{let x=k;for(let i=0;i<3;i++){const g=new Date(ms(x)).getUTCDay();if(g===0||g===6)x=add(x,1);else break;}return x;};
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const dayKey=v=>{try{const J=R.PipelineJudge;const k=J&&J.dayKey?J.dayKey(v):'';if(k)return k;}catch(e){}const t=new Date(v||'');return Number.isFinite(t.getTime())?t.toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}):'';};
 const cut=(v,n)=>{v=String(v||'').replace(/\s+/g,' ').trim();return v.length>n?v.slice(0,n-1)+'…':v;};
 const patchOf=d=>{try{return R.itemPatch(d,'deal')||{};}catch(e){return {};}};
 const actsOf=d=>{const seen=new Set();return [].concat(Array.isArray(d.activities)?d.activities:[],Array.isArray(patchOf(d).activities)?patchOf(d).activities:[]).filter(a=>{if(!a)return false;const k=a.id||String(a.at||a.occurred_at)+'|'+String(a.note||'').slice(0,30);if(seen.has(k))return false;seen.add(k);return true;});};
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const rerender=()=>{try{R.TodayV2.render();}catch(e){try{R.paint();}catch(e2){}}};
 /* ── 기록이 있는가 · 활동을 확인했는가 ── */
 const TOUCH=/전화|문자|카카오|카톡|방문|이메일|메일|통화/,MARK=/^\[활동 확인\]/;
 function noRecord(d){
  if(d.last_meaningful_contact_at||d.lastMeaningfulContactAt)return false;
  try{const v=R.ContactState&&R.ContactState.of(d,'deal');if(v&&(v.attempts>0||v.lastConnectedAt||v.lastAttemptAt))return false;}catch(e){}
  return !actsOf(d).some(a=>TOUCH.test(String(a.type||'')));
 }
 const checked=d=>actsOf(d).some(a=>MARK.test(String(a.note||'').trim()));
 const STALL=['month','silent','stallbig','stall'];
 const needsCheck=i=>on()&&!!i&&i.x&&i.x.type==='deal'&&(STALL.includes(i.rk)||i.rk==='first')&&noRecord(i.x.item)&&!checked(i.x.item);
 /* 실제 정체 = 활동이 확인됐는데도 움직임이 없는 건. 대기 사유만 있고 확인일이 없는 건은 '무기한 대기'로 따로 센다(정체로 겹쳐 세지 않는다) */
 const indefinite=d=>{try{const w=R.DayZones.waitingOf(d);return !!(w&&w.indefinite);}catch(e){return false;}};
 const realStall=i=>!!i&&i.x&&i.x.type==='deal'&&STALL.includes(i.rk)&&!needsCheck(i)&&!indefinite(i.x.item);
 const WORD='활동 여부 확인 필요';
 /* ── 진전 확인: 다음 단계 조건 5가지(단계 정보 · 기록에서) ── */
 function progress(d){
  const cx=d.stage_contexts||patchOf(d).stage_contexts||{},vals=k=>Object.keys(cx).map(c=>cx[c]&&cx[c].fields&&cx[c].fields[k]).filter(v=>v!=null&&v!==''&&!(Array.isArray(v)&&!v.length));
  let next=null;try{next=R.actionObj(d,patchOf(d));}catch(e){}
  const dm=vals('decision_maker').concat([d.decision_maker]).map(v=>String(v||'').trim()).filter(Boolean).some(v=>!/^(모름|미확인|확인 ?필요)$/.test(v));
  const mat=vals('materials').length>0||vals('required_materials').length>0||vals('submitted_materials').length>0;
  const visit=actsOf(d).some(a=>/방문|미팅|실측/.test(String(a.type||'')))||!!(next&&/방문|미팅|실측/.test(String(next.type||'')+' '+String(next.text||'')))||vals('meeting_date').length>0;
  const comp=vals('competitor').length>0||!!String(d.competitor||'').trim()||vals('competition_flag').some(v=>String(v)==='없음');
  const date=vals('decision_date').length>0||vals('bid_deadline').length>0||vals('board_meeting').length>0||vals('expected_contract').length>0;
  const list=[['결정권자 확인',dm],['요청 자료 확보',mat],['방문 확정',visit],['경쟁사 파악',comp],['결정 일정',date]];
  return {list,ok:list.filter(x=>x[1]).length,all:list.length};
 }
 function progressHtml(d,contact){
  if(!on())return '';const P=progress(d),flat=contact>=3&&P.ok<=1;
  return '<i>진전</i><b class="dx-prog">'+P.list.map(x=>'<em class="'+(x[1]?'ok':'')+'">'+(x[1]?'✓ ':'')+h(x[0])+'</em>').join('')+'<small class="'+(flat?'r':'')+'">'+(flat?'연락 '+contact+'회 · 조건 '+P.ok+' / '+P.all+' — 연락 반복 · 진전 없음':'다음 단계 조건 '+P.ok+' / '+P.all)+'</small></b>';
 }
 /* ── [활동 여부 확인] 칸 ── */
 const SITS=[['담당이 통화했는데 기록을 안 했음','기존 통화 결과 등록 (날짜 · 결과 · 다음 일정)'],['고객이 나중에 연락 달라고 함','약속일 · 대기 사유 등록 → 회신 대기로'],['담당도 진행 상황을 모름','고객 연락 업무 생성 → 추진 여부 확인'],['이미 다른 영업건으로 진행 중','관련 영업건 연결 · 이 건 업무 정리']];
 const RES=['연결됨','부재','검토중','자료요청','회신대기'];
 const siblings=d=>{try{return (R.DealUnits&&R.DealUnits.siblings?R.DealUnits.siblings(d):[]).filter(x=>{try{return R.isOpen(x)||R.isWon(x);}catch(e){return true;}});}catch(e){return [];}};
 const sibName=x=>{let t='';try{t=R.DealUnits.tagOf(x)||'';}catch(e){}let no='';try{no=R.dealNo?R.dealNo(x):'';}catch(e){}return [t||'공종 미분류',no||('#'+String(x.id).slice(0,6)),R.repN(x.assignee)||'미배정'].filter(Boolean).join(' · ');};
 function openChk(key){const S=st();S.why='';S.chk=S.chk&&S.chk.key===key?null:{key,sit:-1,date:today(),res:'',memo:'',due:'',why:'',sib:'',busy:false,err:'',P:{}};}
 function chkHtml(i,S){
  const C=S.chk;if(!C||C.key!==i.key)return '';const d=i.x.item,t0=today(),sibs=siblings(d);
  const pill=(act,v,onn,label)=>'<button type="button" data-dz="'+act+'" data-key="'+attr(i.key)+'" data-v="'+attr(v)+'" aria-pressed="'+!!onn+'"'+(C.busy?' disabled':'')+'>'+h(label||v)+'</button>';
  let form='',go='';
  if(C.sit===0){form='<label><span>통화한 날</span><input type="date" data-dx="date" max="'+t0+'" value="'+attr(C.date)+'" aria-label="통화한 날"></label><div class="dx-f"><span>결과</span><div class="dx-pills">'+RES.map(r=>pill('chkres',r,C.res===r)).join('')+'</div></div><label class="wide"><span>메모</span><input type="text" data-dx="memo" maxlength="80" value="'+attr(C.memo)+'" placeholder="한 줄 (선택)" aria-label="메모"></label>';go='기존 통화 결과 등록';}
  else if(C.sit===1){form='<label><span>약속일 · 다음 확인일</span><input type="date" data-dx="due" min="'+t0+'" value="'+attr(C.due)+'" aria-label="약속일"></label><label class="wide"><span>대기 사유</span><input type="text" data-dx="why" maxlength="60" value="'+attr(C.why)+'" placeholder="예: 12월 입대의 후 연락 달라고 함" aria-label="대기 사유"></label>';go='회신 대기로';}
  else if(C.sit===2){const due=C.due||weekday(t0);form='<label><span>연락 예정일</span><input type="date" data-dx="due" min="'+t0+'" value="'+attr(due)+'" aria-label="연락 예정일"></label><span class="dx-ro"><span>만들 업무</span>추진 여부 확인 연락 · '+h(R.repN(d.assignee)||'담당 미정')+'</span>';go='연락 업무 만들기';}
  else if(C.sit===3){form=sibs.length?'<div class="dx-f wide"><span>진행 중인 영업건</span><div class="dx-pills">'+sibs.slice(0,6).map(x=>pill('chksib',String(x.id),C.sib===String(x.id),sibName(x))).join('')+'</div></div>':'<p class="dx-none">같은 현장의 다른 영업건이 CRM 에 없습니다 — 상세에서 현장 이력을 확인해 주세요</p>';go=sibs.length?'연결 기록 · 이 건 정리하러 가기':'';}
  return '<div class="dz-chk" data-key="'+attr(i.key)+'"><span>활동 여부 확인 · 기록 없음 ≠ 연락 안 함</span><div class="dx-sits" role="group" aria-label="상황">'+SITS.map((s,n)=>'<button type="button" data-dz="chksit" data-key="'+attr(i.key)+'" data-v="'+n+'" aria-pressed="'+(C.sit===n)+'"'+(C.busy?' disabled':'')+'><b>'+h(s[0])+'</b><small>'+h(s[1])+'</small></button>').join('')+'</div>'
   +(C.sit>=0?'<div class="dx-form">'+form+'</div>':'')+(C.err?'<em role="alert">'+h(C.err)+'</em>':'')
   +'<div class="dx-foot"><small>상황을 고른 뒤에만 저장됩니다 · 연락 업무는 ③에서만 새로 만듭니다</small><i></i><button type="button" data-dz="chkclose" data-key="'+attr(i.key)+'"'+(C.busy?' disabled':'')+'>닫기</button>'+(go?'<button type="button" class="pri" data-dz="chksave" data-key="'+attr(i.key)+'"'+(C.busy?' disabled':'')+'>'+(C.busy?'확인 중…':h(go))+'</button>':'')+'</div></div>';
 }
 async function chkSave(i){
  const S=st(),C=S.chk,D=R.DealDetailV3;if(!C||C.busy)return;const d=i.x.item,t0=today();
  if(!D||!D.memo||!D.next||!D.record){C.err='상세 저장 기능을 불러오지 못했습니다';return rerender();}
  const bad=m=>{C.err=m;rerender();};
  if(C.sit===0){if(!/^\d{4}-\d{2}-\d{2}$/.test(C.date)||C.date>t0)return bad('통화한 날은 오늘까지의 날짜로 넣어 주세요');if(!C.res)return bad('통화 결과를 골라 주세요');}
  else if(C.sit===1){if(!/^\d{4}-\d{2}-\d{2}$/.test(C.due)||C.due<t0)return bad('약속일을 오늘 이후로 정해 주세요');if(!String(C.why).trim())return bad('대기 사유를 적어 주세요');}
  else if(C.sit===2){const due=C.due||weekday(t0);if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||due<t0)return bad('연락 예정일을 오늘 이후로 정해 주세요');C.due=due;}
  else if(C.sit===3){if(!C.sib)return bad('진행 중인 영업건을 골라 주세요');}
  else return bad('상황을 골라 주세요');
  C.busy=true;C.err='';rerender();
  try{
   if(C.sit===0){const at=C.date===t0?new Date().toISOString():C.date+'T12:00:00+09:00';
    if(!C.P.rec){await D.record(d,{ch:'전화',res:C.res,memo:'뒤늦게 등록(활동 확인)'+(String(C.memo).trim()?' · '+String(C.memo).trim():''),at,P:C.P.r||(C.P.r={})});C.P.rec=true;}
    await D.memo(d,'[활동 확인] 통화했는데 미기록 → '+md(C.date)+' 통화 결과 등록 · '+C.res,C.P.m||(C.P.m={}));toast('통화 결과를 '+md(C.date)+' 날짜로 등록했습니다');}
   else if(C.sit===1){const why=String(C.why).trim();
    if(!C.P.nx){await D.next(d,{type:'전화',text:'고객 회신 대기: '+cut(why,48),due:C.due,P:C.P.n||(C.P.n={})});C.P.nx=true;}
    await D.memo(d,'[활동 확인] 고객이 나중에 연락 요청 · 확인일 '+md(C.due)+' · '+why,C.P.m||(C.P.m={}));toast('회신 대기로 옮겼습니다 · 확인일 '+md(C.due));}
   else if(C.sit===2){
    if(!C.P.nx){await D.next(d,{type:'전화',text:'추진 여부 확인 연락',due:C.due,P:C.P.n||(C.P.n={})});C.P.nx=true;}
    await D.memo(d,'[활동 확인] 담당도 진행 상황 모름 → 고객 연락 업무 '+md(C.due),C.P.m||(C.P.m={}));toast('고객 연락 업무를 만들었습니다 · '+md(C.due));}
   else{const x=siblings(d).find(s=>String(s.id)===C.sib);
    await D.memo(d,'[활동 확인] 다른 영업건으로 진행 중 — '+(x?sibName(x):C.sib)+' · 이 건 정리 검토',C.P.m||(C.P.m={}));
    S.chk=null;try{R.saveLocal&&R.saveLocal();}catch(e){}rerender();toast('연결을 남겼습니다 — 이 건의 보류 · 실주는 상세의 [단계 바꾸기]에서 한 건씩 정리해 주세요');
    try{R.G._detailPopup=true;R.drwDeal(JSON.stringify(d));}catch(e){}return;}
   S.chk=null;try{R.saveLocal&&R.saveLocal();}catch(e){}
  }catch(e){C.busy=false;C.err='저장하지 못했습니다: '+String(e&&e.message||e)+' — 다시 누르면 같은 요청을 확인합니다';}
  rerender();
 }
 /* ── 기록 상태 4가지 ── */
 function counts(Z){return {check:Z.now.filter(needsCheck).length,wait:Z.wait.length,nowait:(Z.nowait||[]).length,stall:Z.now.filter(realStall).length};}
 const RS=[['check','활동 확인 필요','기록 없음 · 이관 자료 · 담당 확인 전'],['wait','회신 대기','대기 사유 + 다음 확인일 있음'],['nowait','무기한 대기','대기 사유는 있는데 확인일 없음'],['stall','실제 정체','활동이 확인됐는데 움직임 없음']];
 function stripHtml(Z,S){
  if(!on())return '';const c=counts(Z);
  return '<div class="dx-rs" role="group" aria-label="기록 상태"><span>기록 상태</span>'+RS.map(r=>'<button type="button" data-dz="rs" data-v="'+r[0]+'" aria-pressed="'+((S.rs||'')===r[0])+'" title="'+attr(r[2])+'"'+(r[0]==='stall'&&c.stall?' class="r"':'')+'>'+h(r[1])+' <b>'+c[r[0]]+'</b></button>').join('')+'<small>지연 · 평가 = 실제 정체만</small></div>';
 }
 const passRs=(i,S)=>!S.rs||S.rs==='wait'||(S.rs==='check'?needsCheck(i):S.rs==='stall'?realStall(i):true);
 /* ── 하루 마감 요약 ── */
 function closeModel(Z,X){
  const t0=today(),me=Z.me,team=Z.team,D=(X&&X.D)||(R.B&&R.B.deals)||[],mine=d=>team||(R.repN(d.assignee)||'')===me;
  const site=d=>String(d.site||d.site_name||'현장명 미입력').replace(/^\[[^\]]*\]\s*/,'');
  const done=[],tomorrow=[],nextDay=weekday(add(t0,1));
  D.forEach(d=>{try{if(!mine(d))return;
    const cd=(Array.isArray(d.completed_actions)?d.completed_actions:[]).filter(a=>dayKey(a.completed_at)===t0);
    const ta=actsOf(d).filter(a=>dayKey(a.at||a.occurred_at)===t0&&TOUCH.test(String(a.type||'')));
    if(cd.length||ta.length)done.push({key:'deal:'+d.id,text:site(d)+' · '+cut(cd.length?cd[0].text:String(ta[0].note||ta[0].type),34)});
    if(R.isOpen(d)){let a=null;try{a=R.actionObj(d,patchOf(d));}catch(e){}const due=a&&String(a.due||a.due_at||'').slice(0,10);if(a&&a.text&&due&&due>t0&&due<=nextDay)tomorrow.push({key:'deal:'+d.id,text:site(d)+' · '+cut(a.text,34)});}
   }catch(e){}});
  const open=Z.now.filter(i=>i.x.type==='deal'&&i.rk==='promise'&&(team||i.x.owner===me)).map(i=>{let a=null;try{a=R.actionObj(i.x.item,patchOf(i.x.item));}catch(e){}return {key:i.key,i,site:site(i.x.item),task:String(a&&a.text||i.x.next||i.missTxt||'약속'),type:String(a&&a.type||'전화'),due:String(a&&(a.due||a.due_at)||'').slice(0,10)};});
  return {t0,nextDay,done,open,tomorrow};
 }
 function closeText(M,S,me){
  const C=S.close||{},saved=C.saved||{};
  const L=['[하루 마감 '+md(M.t0)+' · '+me+']','오늘 완료 '+M.done.length+'건'+(M.done.length?': '+M.done.map(x=>x.text).join(' / '):''),
   '미완료 약속 '+M.open.length+'건'+(M.open.length?': '+M.open.map(x=>x.site+' '+cut(x.task,24)+(saved[x.key]?' · 사유: '+saved[x.key].why+' → '+md(saved[x.key].due):'')).join(' / '):''),
   '내일 이어갈 일 '+M.tomorrow.length+'건'+(M.tomorrow.length?': '+M.tomorrow.map(x=>x.text).join(' / '):'')];
  if(C.extra&&C.extra.length)L.push('마감 처리(미룸) '+C.extra.length+'건: '+C.extra.join(' / '));
  return L.join('\n');
 }
 function closeHtml(Z,X,S){
  const M=closeModel(Z,X),C=S.close||(S.close={saved:{},draft:{},extra:[]}),P=R.ListPager,PER=20;
  const left=M.open.filter(x=>!C.saved[x.key]).length;
  const col=(t,n,cls,body)=>'<section class="dx-col '+cls+'"><header><b>'+h(t)+'</b><b class="n">'+n+'</b></header>'+body+'</section>';
  const list=(rows,k,empty)=>{const pg=P?P.cut(rows,P.page(S,k),PER):{rows:rows.slice(0,PER),pages:1};return (pg.rows.length?'<ul>'+pg.rows.map(x=>'<li title="'+attr(x.text)+'">'+h(x.text)+'</li>').join('')+'</ul>':'<p class="dx-none">'+h(empty)+'</p>')+(P&&pg.pages>1?P.html(pg,{ns:'dz',v:k,small:true,info:false}):'');};
  const openPg=P?P.cut(M.open,P.page(S,'clo'),PER):{rows:M.open.slice(0,PER),pages:1};
  const openBody=openPg.rows.length?openPg.rows.map(x=>{const sv=C.saved[x.key],dr=C.draft[x.key]||{};
    return '<div class="dx-open'+(sv?' ok':'')+'" data-key="'+attr(x.key)+'"><b title="'+attr(x.site+' · '+x.task)+'">'+h(x.site)+' · '+h(cut(x.task,30))+'</b>'
     +(sv?'<span>사유: '+h(sv.why)+' → '+h(md(sv.due))+'</span>':'<div><input type="text" data-dx="cwhy" data-key="'+attr(x.key)+'" maxlength="60" value="'+attr(dr.why||'')+'" placeholder="못 한 사유" aria-label="못 한 사유"><input type="date" data-dx="cdue" data-key="'+attr(x.key)+'" min="'+attr(add(M.t0,1))+'" value="'+attr(dr.due||'')+'" aria-label="다음 처리일"><button type="button" data-dz="clsave" data-key="'+attr(x.key)+'"'+(C.busy===x.key?' disabled':'')+'>'+(C.busy===x.key?'확인 중…':'저장')+'</button></div>')
     +(C.err&&C.errKey===x.key?'<em role="alert">'+h(C.err)+'</em>':'')+'</div>';}).join('')+(P&&openPg.pages>1?P.html(openPg,{ns:'dz',v:'clo',small:true,info:false}):''):'<p class="dx-none">미완료 약속이 없습니다</p>';
  return '<div class="dx-close"><div class="dx-chead"><b>하루 마감 요약 · '+h(md(M.t0))+'</b><span>미완료 약속은 사유 + 다음 처리일이 있어야 마감 · 요약은 그대로 팀장 · 관리자에게 공유(별도 보고서 없음)</span><i></i><button type="button" data-dz="clback">목록으로</button></div>'
   +'<div class="dx-cols">'+col('오늘 완료',M.done.length,'g',list(M.done,'cld','오늘 완료한 기록이 없습니다'))+col('미완료 약속',M.open.length,'r',openBody)+col('내일 이어갈 일',M.tomorrow.length,'',list(M.tomorrow,'clt',md(M.nextDay)+' 예정 업무가 없습니다'))+'</div>'
   +'<div class="dx-cfoot"><span>'+(left?'미완료 약속 '+left+'건에 사유 · 다음 처리일을 넣어야 마감할 수 있습니다':'마감할 수 있습니다')+'</span><i></i><button type="button" class="pri" data-dz="clcopy"'+(left?' disabled':'')+'>요약 복사 · 공유</button></div>'+(C.copied?'<textarea class="dx-copy" readonly aria-label="마감 요약">'+h(C.copied)+'</textarea>':'')+'</div>';
 }
 async function closeSave(key,Z,X){
  const S=st(),C=S.close,D=R.DealDetailV3;if(!C||C.busy)return;const M=closeModel(Z,X),x=M.open.find(o=>o.key===key);if(!x)return;const dr=C.draft[key]||{},why=String(dr.why||'').trim(),due=String(dr.due||'');
  const bad=m=>{C.err=m;C.errKey=key;rerender();};
  if(!why)return bad('못 한 사유를 적어 주세요');if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||due<=M.t0)return bad('다음 처리일은 내일 이후로 정해 주세요');
  if(!D||!D.next||!D.memo)return bad('상세 저장 기능을 불러오지 못했습니다');
  const P=(C.P||(C.P={}))[key]||(C.P[key]={});C.busy=key;C.err='';rerender();
  try{
   if(!P.nx){await D.next(x.i.x.item,{type:x.type,text:x.task,due,P:P.n||(P.n={})});P.nx=true;}
   await D.memo(x.i.x.item,'[마감] 미완료 · '+cut(x.task,40)+(x.due?' · 원래 '+md(x.due):'')+' → 다음 처리 '+md(due)+' · 사유: '+why,P.m||(P.m={}));
   C.saved[key]={why,due};C.extra.push(x.site+' '+cut(x.task,24)+' · 사유: '+why+' → '+md(due));try{R.saveLocal&&R.saveLocal();}catch(e){}
  }catch(e){C.err='저장하지 못했습니다: '+String(e&&e.message||e);C.errKey=key;}
  C.busy='';rerender();
 }
 function closeCopy(Z,X){
  const S=st(),C=S.close;if(!C)return;const M=closeModel(Z,X);if(M.open.some(x=>!C.saved[x.key]))return;const text=closeText(M,S,Z.me);C.copied=text;
  const done=()=>toast('마감 요약을 복사했습니다 — 팀장 · 관리자에게 그대로 붙여 넣어 공유해 주세요');
  try{const p=R.navigator&&R.navigator.clipboard&&R.navigator.clipboard.writeText(text);if(p&&p.then)p.then(done,()=>toast('아래 글을 직접 복사해 주세요','warn'));else toast('아래 글을 직접 복사해 주세요','warn');}catch(e){toast('아래 글을 직접 복사해 주세요','warn');}
  rerender();
 }
 /* ── 누르기(day-zones.js 가 모르는 동작을 넘겨받는다) ── */
 function onAction(a,b,S,Z,X){
  const key=b.dataset.key,find=()=>Z&&Z.now.find(x=>x.key===key);
  if(a==='chk'){openChk(key);rerender();return true;}
  if(a==='chkclose'){S.chk=null;rerender();return true;}
  if(a==='chksit'){if(S.chk){S.chk.sit=Number(b.dataset.v);S.chk.err='';}rerender();return true;}
  if(a==='chkres'){if(S.chk)S.chk.res=b.dataset.v;rerender();return true;}
  if(a==='chksib'){if(S.chk)S.chk.sib=b.dataset.v;rerender();return true;}
  if(a==='chksave'){const i=find();if(i)chkSave(i);return true;}
  if(a==='rs'){const v=b.dataset.v;if(v==='wait'){S.rs='';S.zone='wait';}else{S.rs=S.rs===v?'':v;S.zone='now';}S.why='';S.chk=null;if(R.ListPager)R.ListPager.reset(S);rerender();return true;}
  if(a==='close'){S.closing=true;S.close=S.close||{saved:{},draft:{},extra:[]};rerender();return true;}
  if(a==='clback'){S.closing=false;rerender();return true;}
  if(a==='clsave'){closeSave(key,Z,X);return true;}
  if(a==='clcopy'){closeCopy(Z,X);return true;}
  return false;
 }
 function onInput(e){
  const t=e.target;if(!t||!t.matches||!t.matches('#today-v2 [data-dx]'))return;const S=st(),k=t.dataset.dx;
  if(k==='cwhy'||k==='cdue'){const C=S.close;if(!C)return;const d=C.draft[t.dataset.key]||(C.draft[t.dataset.key]={});d[k==='cwhy'?'why':'due']=t.value;return;}
  if(S.chk&&['date','memo','due','why'].includes(k))S.chk[k]=t.value;
 }
 if(R.document){R.document.addEventListener('input',onInput,true);R.document.addEventListener('change',onInput,true);}
 root.DayExtra={on,noRecord,checked,needsCheck,realStall,progress,progressHtml,chkHtml,stripHtml,passRs,counts,closeModel,closeHtml,closeText,onAction,WORD,SITS,RS};
})(window);
