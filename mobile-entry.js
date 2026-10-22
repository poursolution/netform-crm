/* 모바일 결과 창 — 상담 결과 · 한 번만 쓰기 (2026-10-10 design_handoff_mobile_all 2번 · PC 상세 가운데 칸과 같은 입력 · 같은 저장 계획)
   ① 연락 결과(PC 값 5가지) ② 상담 내용(부재 · 번호 오류는 칸 없음) ③ 다음 업무(기존 일정 유지 · 변경 · 새 업무 · 없음) + [고객 정보 변경 ▾] + 저장 전 미리보기.
   현장 · 영업건 · 담당 · 연락처는 열려 있는 상세에서 이어받는다. 저장은 queueMobileContactOperation으로 기록 → 선택한 일정 변경을 확인하고,
   기록 1건 저장이 일정 · 요청 · 고객 정보를 몰래 바꾸지 않는다 — 바뀌는 것은 미리보기 · 저장 뒤 화면에 구분해서 적는다.
   승인 셸에서는 끄기·로딩 실패로 예전 입력 창을 다시 열지 않는다. */
(function(root){
 'use strict';
 const CE=root.ContactEntry;if(!CE||typeof root.dealCallSheetM!=='function')return;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const day=v=>String(v||'').slice(0,10);
 const kst=v=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(v?new Date(v):new Date());}catch(e){return day(new Date().toISOString());}};
 const dealById=id=>(root.DEALS||[]).find(x=>String(x.id)===String(id));
 const openNext=d=>{const a=d&&d.nextAction;return a&&a.status==='open'?a:null;};
 const isPromise=a=>!!a&&(a.promise===true||a.date_basis==='customer_agreed'||/약속/.test(String(a.type||''))||/^\s*고객\s*약속/.test(String(a.text||'')));
 const existingOf=d=>{const a=openNext(d);if(!a||!String(a.text||'').trim())return null;return {id:a.id||'',text:String(a.text).replace(/^\s*고객\s*약속\s*:?\s*/,'').trim()||String(a.text),due:day(a.due||a.due_at),type:a.type||'전화',promise:isPromise(a)};};
 const actionDay=v=>{if(root.MobileScheduleModel?.day)return root.MobileScheduleModel.day(v)||'';const value=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value?value:value&&Number.isFinite(Date.parse(value))?kst(value):'';};
 const actionSnapshot=a=>a&&({id:String(a.id||'').toLowerCase(),text:String(a.text||a.title||'').replace(/^\s*고객\s*약속\s*:?\s*/,'').trim(),due:actionDay(a.due_on||a.due||a.due_at||a.scheduled_at),type:String(a.type||a.action_type||'전화'),promise:isPromise(a)});
 function selectedExisting(d,value){
  if(!value||!UUID.test(String(value.id||'')))throw Error('선택한 원래 업무를 다시 확인해 주세요.');
  const rows=Array.isArray(d.openNextActions)?d.openNextActions:[d.nextActionObj,d.nextAction].filter(Boolean);
  const a=rows.find(x=>String(x.id).toLowerCase()===String(value.id).toLowerCase()),current=actionSnapshot(a);
  if(!a||a.status!=='open'||a.opportunity_id&&String(a.opportunity_id)!==String(d.id)||!current.text||!current.due||JSON.stringify(current)!==JSON.stringify(actionSnapshot(value)))throw Error('선택한 업무가 바뀌었습니다. 원래 업무를 다시 열어 주세요.');
  return current;
 }
 const existingFor=d=>S&&String(activeID)===String(d.id)&&S.existing?S.existing:existingOf(d);
 const hasDraftInput=s=>!!s&&(!!s.res||!!s.memo||!!s.reason||!!s.cplan||s.touchedNext||Object.values(s.reqOn||{}).some(Boolean));
 /* 작성 중 내용 복원: 뒤로 가기 · 다른 창을 다녀와도 같은 현장이면 이어서(30분) */
 const KEY='crm:call-entry:v1',LIFE=30*60000;
 const store=()=>{try{return root.sessionStorage||null;}catch(e){return null;}};
 function loadDraft(id){const j=root.MobileSaveJournal.read('contact',id);if(j&&(j.progress?.signature||Date.now()-Number(j.at||0)<LIFE)){progress=j.progress||{};return JSON.parse(JSON.stringify(progress.input||j.input));}return null;}
 function saveDraft(id,input,strict=false){try{if(recoveryError)throw Error(recoveryError);assertSession();root.MobileSaveJournal.write('contact',id,{at:Date.now(),input,progress},owner);}catch(e){if(input)input.err=String(e.message||e);if(strict)throw e;}}
 function clearDraft(){root.MobileSaveJournal.drop('contact',activeID,owner);try{store()?.removeItem(KEY);}catch(e){}}
 let S=null,busy=false,progress={},last=null,lastMemo='',owner='',activeID='',progressMode='contact',recoveryError='',sessionToken='';
 function assertSession(){root.MobileSaveJournal.assertOwner(owner);root.MobileSaveJournal.assertSession(sessionToken);}
 function persistProgress(){if(recoveryError)throw Error(recoveryError);assertSession();if(progressMode==='reschedule')root.MobileSaveJournal.write('reschedule',activeID,{input:RS,progress},owner);else saveDraft(activeID,S,true);}
 const dateOptions=()=>{const t=kst(),mon=(()=>{const x=new Date(t+'T00:00:00Z'),w=x.getUTCDay();return CE.addDays(t,((8-w)%7)||7);})();return [['내일',CE.addDays(t,1)],['3일 후',CE.addDays(t,3)],['다음 주 월요일',mon]];};
 const MF=()=>root.MobileFields&&root.MobileFields.ready()?root.MobileFields:null;
 const curPlan=d=>{try{return root.MobileFields?root.MobileFields.planOf(d):'';}catch(e){return '';}};
 const ctxOf=d=>({today:kst(),existing:existingFor(d),currentPlan:curPlan(d),scheduleV1:root.ScheduleFlow?.enabled()===true});
 const MR=()=>root.MobileRequests&&root.MobileRequests.enabled()?root.MobileRequests:null;
 const reqsOf=d=>{if(String(d.id)===String(activeID)&&progress.requestSnapshot)return progress.requestSnapshot;const R=MR();return R?R.forDeal(d.id):[];};
 const V5=()=>root.MobileV5Result&&root.MobileV5Result.on()?root.MobileV5Result:null;
 const withInfo=()=>{const d=dealById(root.G&&root.G.deal),R=MR();return Object.assign({ch:'전화'},S,V5()&&d&&S?{memo:V5().memoOf(S,d,reqsOf(d),R)}:null,{info:S&&S.cplan?{construction_plan:S.cplan}:null,requests:d&&R&&S?reqsOf(d).map(r=>({id:r.id,title:R.labelOf(r),on:!!(S.reqOn&&S.reqOn[r.id])&&R.isContact(r)})):[]});};
 const signatureOf=input=>JSON.stringify(['ch','res','memo','mode','purpose','date','reason','plan','who','info','requests','retry'].map(k=>input[k]).concat(input.existing?[input.existing]:[]));
 /* 모바일 v5 '다시 연락' 칩(연락 시도에만): 시각은 업무에 저장하지 않으므로 기록 글 끝에 남긴다 */
 const planWith=(input,ctx)=>{const pl=CE.plan(input,ctx),at=pl.ok&&pl.attempt&&input.retry?String(input.retry).trim().slice(0,20):'';if(at)pl.note+=' · 다시 연락 '+at;return pl;};
 const planOf=d=>{const input=withInfo();if(progress.signature){if(progress.signature!==signatureOf(input))return {ok:false,error:'저장 확인 중 입력값이 바뀌었습니다. 원래 입력으로 재시도해 주세요.'};if(progress.pl&&progress.ctx)return progress.pl;}return planWith(input,ctxOf(d));};
 function fresh(d,selected){
  const ex=selected||existingOf(d),dflt=CE.defaults('연결됨',ex,kst());
  return {res:'',memo:'',mode:dflt.mode,purpose:dflt.purpose,date:dflt.date,reason:'',plan:'internal',info:false,touchedNext:false,reqOn:{}};
 }
 /* 결과를 고르면 다음 업무 제안도 그 결과에 맞게(직접 고친 뒤에는 건드리지 않는다) */
 function pickResult(d,res){
  S.res=res;
  if(!S.touchedNext){const dflt=CE.defaults(res,existingFor(d),kst());S.mode=dflt.mode;S.purpose=dflt.purpose;S.date=dflt.date;}
  if(CE.isBadfit(res))S.mode='none';
 }
 function sheetHtml(d){
  const ex=progress.signature&&progress.ctx?progress.ctx.existing:existingFor(d),pl=S.res?planOf(d):null,c=root.contactInfoM?root.contactInfoM(d):{};
  if(root.MobileContactView)return root.MobileContactView.render({s:S,d,ex,plan:pl,ce:CE,contact:c,requests:reqsOf(d),requestApi:MR(),busy,frozen:!!progress.signature,fields:MF(),currentPlan:curPlan(d),dateOptions:dateOptions(),today:kst(),v5:!!V5()});
  const chip=(act,v,on,label,cls)=>'<button type="button" class="ce-chip'+(cls?' '+cls:'')+(act==='res'&&S.ai&&S.ai.res===v?' ai':'')+'" data-ce="'+act+'" data-v="'+attr(v)+'" aria-pressed="'+!!on+'">'+h(label||v)+'</button>';
  const res='<section><b class="ce-q"><i>1</i>연락 결과 <small>PC 기준 값</small></b><div class="ce-chips">'+CE.VALUES.map(v=>chip('res',v,S.res===v)).join('')+'</div>'+(S.ch==='방문'?'<small class="ce-sub">방문 결과 — 연결됨 = 만났음 · 부재 = 담당자 없음 (일정이 취소 · 연기됐으면 [일정 바꾸기])</small>':'')+'</section>';
  const note=!S.res?'':CE.showNote(S.res)
   ?'<section><b class="ce-q"><i>2</i>상담 내용 <small>이번에 새로 확인한 것 한 번만</small></b><div class="ce-say"><textarea data-ce-in="memo" rows="3" maxlength="300" placeholder="예) 다음 주 대표회의에서 검토 · 금요일까지 견적서 보내 달라고 함">'+h(S.memo)+'</textarea><button type="button" class="ce-mic" data-ce="mic" aria-pressed="false">말하기</button>'+(root.TOKEN&&root.SUPABASE_URL?'<button type="button" class="ce-tidy" data-ce="tidy">AI로 정리</button>':'')+'<small class="ce-hint"'+(S.aiHint?'':' hidden')+'>'+h(S.aiHint||'')+(S.aiRaw?' <button type="button" class="ce-undo" data-ce="undo">원문으로</button>':'')+'</small></div></section>'
   :'<p class="ce-miss">부재 · 번호 오류는 상담 내용 칸 없음 · 연락 시도로만 기록</p>';
  const modes=CE.MODES.filter(m=>ex||(m[0]!=='keep'&&m[0]!=='change')).filter(m=>!CE.isBadfit(S.res)||m[0]==='none');
  let nx='<section><b class="ce-q"><i>3</i>다음 업무</b>'+(ex?'<p class="ce-ex"><em>기존 일정</em> '+h(ex.text)+(ex.due?' · '+h(CE.md(ex.due)):'')+(ex.promise?' · 고객 합의':'')+'</p>':'<p class="ce-ex none">지금 잡힌 다음 업무가 없습니다</p>')
   +'<div class="ce-chips ce-modes">'+modes.map(m=>chip('mode',m[0],S.mode===m[0],m[1],'sm')).join('')+'</div>';
  if(S.mode==='new'){
   nx+='<input type="text" class="ce-in" data-ce-in="purpose" maxlength="60" value="'+attr(S.purpose)+'" placeholder="할 일 (예: 견적서 발송)" aria-label="다음 업무 할 일">'
    +'<div class="ce-dates">'+dateOptions().map(x=>'<button type="button" class="ce-date'+(S.ai&&S.ai.date===x[1]?' ai':'')+'" data-ce="date" data-v="'+x[1]+'" aria-pressed="'+(S.date===x[1])+'">'+x[0]+'<small>'+h(CE.md(x[1]))+'</small></button>').join('')+'<label class="ce-date ce-pick" aria-pressed="'+(!!S.date&&!dateOptions().some(x=>x[1]===S.date))+'">날짜 선택<small>'+h(S.date?CE.md(S.date):'')+'</small><input type="date" data-ce-in="date" min="'+kst()+'" value="'+attr(S.date)+'"></label></div>'
    +'<label class="ce-agree"><input type="checkbox" data-ce-in="plan"'+(S.plan==='customer'?' checked':'')+'> 고객과 합의한 날짜</label>';
  }else if(S.mode==='change'&&ex){
   nx+='<div class="ce-dates">'+dateOptions().map(x=>'<button type="button" class="ce-date" data-ce="date" data-v="'+x[1]+'" aria-pressed="'+(S.date===x[1])+'">'+x[0]+'<small>'+h(CE.md(x[1]))+'</small></button>').join('')+'<label class="ce-date ce-pick" aria-pressed="'+(!!S.date&&!dateOptions().some(x=>x[1]===S.date))+'">날짜 선택<small>'+h(S.date?CE.md(S.date):'')+'</small><input type="date" data-ce-in="date" min="'+kst()+'" value="'+attr(S.date)+'"></label></div>'+(ex.due&&S.date&&(S.date>ex.due||root.ScheduleFlow?.enabled())?'<input type="text" class="ce-in" data-ce-in="reason" maxlength="80" value="'+attr(S.reason)+'" placeholder="날짜 변경 사유 (필수) — 원래 기한 · 새 기한 · 사유가 기록됩니다" aria-label="미루는 사유">':'')+'<p class="ce-sub">기존 일정의 날짜만 바뀝니다 — 할 일 이름은 그대로, 완료로 세지 않습니다</p>';
  }else if(S.mode==='keep'&&ex){
   nx+='<p class="ce-sub">기존 일정 그대로 — 이 기록은 일정을 완료로 세거나 바꾸지 않습니다</p>';
  }else if(S.mode==='none'){
   nx+='<input type="text" class="ce-in" data-ce-in="reason" maxlength="80" value="'+attr(S.reason)+'" placeholder="'+(CE.isBadfit(S.res)?'배드핏 사유 (필수)':'다음 일정이 없는 이유 (예: 내년 예산 · 3월 재확인)')+'" aria-label="사유">';
  }
  nx+='</section>';
  const RQ=MR(),rl=RQ&&d?reqsOf(d):[];
  const reqHtml=rl.length?'<section class="ce-reqs"><b class="ce-q"><i>4</i>이 기록으로 처리한 관리자 요청 <small>직접 고른 것만 · 자동 완료 없음</small></b>'+rl.map(r=>{const st=pl&&pl.requests?pl.requests.find(x=>x.id===r.id):null,can=RQ.isContact(r),why=!can?'이 요청은 PC 에서 처리합니다':!S.res?'':!st?'':st.state==='done'?'✓ 완료 조건 충족 — 저장하면 요청이 완료로 닫힙니다':st.state==='working'?'연락 시도로 기록 — 요청은 진행 중으로 남습니다':'완료 조건 미충족 — 다음 업무가 있어야 합니다 · 요청은 남음';return '<label class="ce-req'+(can?'':' off')+'"><input type="checkbox" data-ce-in="req" data-id="'+attr(r.id)+'"'+(S.reqOn&&S.reqOn[r.id]&&can?' checked':'')+(can?'':' disabled')+'><span><b>'+h(RQ.labelOf(r))+'</b><small>'+h((r.requested_by||'관리자')+' · 기한 '+RQ.dueTxt(r))+'</small>'+(why?'<em>'+h(why)+'</em>':'')+(can&&S.reqOn&&S.reqOn[r.id]?'<small>완료 조건 · '+h(RQ.COND.join(' · '))+'</small>':'')+'</span></label>';}).join('')+'</section>':'';
  const info='<div class="ce-info"><button type="button" class="ce-infobtn" data-ce="info" aria-expanded="'+!!S.info+'">고객 정보 변경 '+(S.info?'▴':'▾')+' <small>바뀐 것만 · 공종 · 결정권자</small></button>'
   +(S.info?'<div class="ce-infobody"><div><span>공종</span><b>'+h(root.bizOf?root.bizOf(d):'')+'</b><button type="button" data-ce="edit-work">수정</button></div><div><span>결정권자 · 담당자</span><b>'+h((c.name?c.name+(c.role?' '+c.role:''):'미입력'))+'</b><button type="button" data-ce="edit-contact">수정</button></div>'+(MF()&&!d.outcome?'<div><span>공사 시기</span><div class="ce-chips" style="grid-column:2/4">'+root.MobileFields.PLANS.map(v=>'<button type="button" class="ce-chip sm" data-ce="iplan" data-v="'+attr(v)+'" aria-pressed="'+((S.cplan||curPlan(d))===v)+'">'+h(v)+'</button>').join('')+'</div></div>':'<div><span>공사 시기</span><b>'+h(curPlan(d)||'미입력')+'</b></div>')+'<div><span>대표회의 일정</span><b>PC 상세에서 입력</b></div></div>':'')+'</div>';
  const err=S.err?'<p class="ce-err" role="alert">'+h(S.err)+'</p>':'';
  const foot='<div class="ce-foot"><span class="ce-prev">'+(pl&&pl.ok?'<b>저장하면</b> '+h(pl.preview):h(pl&&pl.error||'연락 결과를 골라 주세요'))+'</span><button type="button" class="btn btn-primary ce-save" data-ce="save"'+(busy?' disabled':'')+'>'+(busy?'확인 중…':'기록 저장')+'</button></div>';
  return '<div class="ce">'+res+note+nx+reqHtml+info+err+'</div>'+foot;
 }
 function paint(d,fromState){
  const card=root.document.getElementById('sheetcard');if(!card)return;
  const keepTop=card.querySelector('.ce')?card.scrollTop:0,ta=card.querySelector('textarea[data-ce-in="memo"]');if(ta&&!fromState)S.memo=ta.value;
  const head=card.querySelector('.intro')?card.querySelector('.intro').outerHTML+'<div style="height:12px"></div>':'';
  const fullPage=!!root.MobileContactView;
  card.classList.toggle('ce-page',fullPage);root.document.getElementById('sheetwrap')?.classList.toggle('ce-page-wrap',fullPage);
  const background=root.document.getElementById('scr');if(background)background.inert=fullPage;
  card.innerHTML=(fullPage?'':'<div class="sheet-grip"></div>'+(head||''))+sheetHtml(d);card.scrollTop=keepTop;
  saveDraft(d.id,S);
 }
 function open(opts){
  if(busy)return;
  if(root.MobileGuideShell&&(typeof root.MobileContactView?.render!=='function'||typeof root.MobileApprovedDSource!=='string')){root.toast('연락 결과 화면을 불러오지 못했습니다. 다시 열어 주세요.');return;}
  const d=dealById(root.G&&root.G.deal);if(!d)return;
  const c=root.contactInfoM?root.contactInfoM(d):{};
  let selected=null;
  try{if(opts?.existing){selected=selectedExisting(d,opts.existing);if(opts.ch==='방문'&&!/방문|실측|미팅/.test(selected.type))throw Error('방문 업무를 다시 확인해 주세요.');}}catch(e){root.toast(String(e.message||e));return false;}
  const requestedCh=opts?.ch;let ch=requestedCh==='방문'?'방문':'전화';
  owner=root.MobileSaveJournal?.owner()||'';sessionToken=root.MobileSaveJournal?.session()||'';activeID=d.id;progressMode='contact';progress={};recoveryError='';S=null;
  try{store()?.removeItem(KEY);S=loadDraft(d.id);}catch(e){recoveryError=String(e.message||e);}
  if(S&&!requestedCh)ch=S.ch||'전화';
  if(S&&((S.ch||'전화')!==ch||selected&&JSON.stringify(S.existing||existingOf(d))!==JSON.stringify(selected))){
   if(progress.signature||hasDraftInput(S)){root.toast('작성하던 결과가 남아 있습니다. 원래 업무의 입력을 먼저 확인해 주세요.');return false;}S=null;
  }
  S=S||fresh(d,selected);if(!progress.signature){S.ch=ch;if(selected)S.existing=selected;}
  busy=false;S.err=recoveryError;
  root.openSheet(root.intro('var(--blue-50)','var(--blue-dark)',root.IC.phone,ch==='방문'?'방문 어떻게 됐나요?':'통화 어떻게 됐나요?',h(d.nm)+(c.name?' · '+h(c.name):'')),'');
  const card=root.document.getElementById('sheetcard');if(card){card.classList.add('ce-card');card._ceMode='entry';}
  paint(d);wire(d);return true;
 }
 let wired=false;
 function wire(d){
  const card=root.document.getElementById('sheetcard');if(!card)return;
  card._ceDeal=d.id;
  if(wired)return;wired=true;
  card.addEventListener('click',e=>{
   const b=e.target.closest('[data-ce]');if(!b||!card.classList.contains('ce-card'))return;const dd=dealById(card._ceDeal);if(!dd)return;
   const a=b.dataset.ce,v=b.dataset.v;
   if(b.tagName==='A')e.preventDefault();
   if(a==='close'){root.closeSheet();root.render();return;}
   if(busy||card._ceMode==='entry'&&(!S||progress.signature&&a!=='save'))return;
   if(card._ceMode==='rs'){if(a==='rs-date'){RS.date=v;RS.err='';paintRs(dd);}else if(a==='rs-save')saveRs(dd);else if(a==='close'){root.closeSheet();root.render();}return;}
   if(a==='res'){pickResult(dd,v);S.err='';if(V5()){S.v5cancel=false;if(!root.ContactEntry.isAttempt(v)){S.v5retry='';S.retry='';}V5().syncRequests(S,dd,reqsOf(dd),MR());}paint(dd);}
   else if(a==='v5chk'&&V5()){S.v5chk=Object.assign({},S.v5chk,{[v]:!(S.v5chk&&S.v5chk[v])});V5().syncRequests(S,dd,reqsOf(dd),MR());paint(dd);}
   else if(a==='v5retry'&&V5()){V5().retry(S,v,existingFor(dd));V5().syncRequests(S,dd,reqsOf(dd),MR());paint(dd);}
   else if(a==='v5quote'&&V5()){S.v5quote=v;S.err='';paint(dd);}
   else if(a==='v5cancel'&&V5()){/* 방문 취소 · 연기 = 그 방문 업무의 날짜만 변경(일정 바꾸기) — 응대 결과는 만들지 않는다. 쓰던 결과 입력은 보관 */const ex0=existingFor(dd);if(!ex0)return root.toast('바꿀 방문 일정이 없습니다.');saveDraft(dd.id,S);reschedule({existing:ex0});}
   else if(a==='v5plan'&&V5()){S.plan=v==='customer'?'customer':'internal';S.touchedNext=true;S.err='';paint(dd);}
   else if(a==='mode'){S.mode=v;S.touchedNext=true;S.err='';if(v==='new'&&!S.date){S.date=CE.addDays(kst(),1);}paint(dd);}
   else if(a==='date'){S.date=v;S.datePanel=false;S.touchedNext=true;S.err='';paint(dd);}
   else if(a==='date-open'){S.datePanel=true;paint(dd);}
   else if(a==='date-close'){S.datePanel=false;paint(dd);}
   else if(a==='iplan'){S.cplan=v;S.err='';paint(dd);}
   else if(a==='quote'){
    try{
     if(!last||last.deal_id!==String(dd.id))throw Error('방문을 저장한 영업건을 다시 열어 주세요.');
     root.MobileSaveJournal.assertOwner(last.owner);root.MobileSaveJournal.assertSession(last.sessionToken);
     if(root.MobileFields)root.MobileFields.quoteSheet(lastMemo,last.deal_id);
    }catch(err){if(typeof root.toast==='function')root.toast(String(err.message||err));}
   }
   else if(a==='info'){if(root.MobileGuideShell)return root.toast('고객 정보 변경 화면은 Claude 원본 연결 작업 중입니다.');S.info=!S.info;paint(dd);}
   else if(a==='edit-work'){saveDraft(dd.id,S);if(root.MobileGuideShell)return root.toast('공종 수정 화면은 Claude 원본 연결 작업 중입니다.');if(typeof root.workSheetM==='function')root.workSheetM();}
   else if(a==='edit-contact'){saveDraft(dd.id,S);if(root.MobileGuideShell)return root.toast('연락처 수정 화면은 Claude 원본 연결 작업 중입니다.');if(typeof root.contactEditSheetM==='function')root.contactEditSheetM();}
   else if(a==='input-mic'){
    const handle=captureInputDraft();
    if(!handle.ok||!root.MobileInputFlow?.open(dd,'I-1',{draftHandle:handle}))return root.toast('현재 상담 입력을 먼저 확인해 주세요.');
    root.MobileGuideShell.state.detailView='input';root.render();
   }
   else if(a==='mic')mic(card,b);
   else if(a==='tidy')tidy(dd,card,b);
   else if(a==='undo'){S.memo=S.aiRaw||S.memo;S.aiRaw='';S.aiHint='원문으로 되돌렸습니다.';paint(dd,true);}
   else if(a==='save')save(dd,card);
   else if(a==='close'){root.closeSheet();root.render();}
   else if(a==='next'){root.closeSheet();const t=(root.G._today||[]).find(x=>!(typeof root.isDone==='function'&&root.isDone(x)));if(t&&typeof root.openTodayEntryM==='function'){root.G.deal=null;root.G.sub=null;root.openTodayEntryM(t.kind,t.ref);}else root.render();}
  });
  card.addEventListener('input',e=>{
   const t=e.target.closest('[data-ce-in]');if(!t||!card.classList.contains('ce-card'))return;const k=t.dataset.ceIn;
   if(busy||progress.signature||card._ceMode==='entry'&&!S)return;
   if(card._ceMode==='rs'){const dd0=dealById(card._ceDeal);if(k==='rs-reason'&&RS){RS.reason=t.value;const pv=card.querySelector('.ce-prev');if(pv&&dd0&&t.value.trim()){const ex=existingOf(dd0);pv.innerHTML='<b>저장하면</b> 기존 일정 "'+h(ex.text)+'" 날짜만 변경 · '+h(CE.md(RS.date))+' · 미룬 사유 기록 · 완료로 세지 않음';}}else if(k==='rs-date'&&RS){RS.date=t.value;RS.err='';if(dd0&&/^\d{4}-\d{2}-\d{2}$/.test(t.value))paintRs(dd0);}try{persistProgress();}catch(e){if(RS)RS.err=String(e.message||e);}return;}
   if(k==='memo')S.memo=t.value;else if(k==='purpose'){S.purpose=t.value;S.touchedNext=true;}else if(k==='reason')S.reason=t.value;
   else if(k==='date'){S.date=t.value;S.touchedNext=true;const dd=dealById(card._ceDeal);if(dd&&/^\d{4}-\d{2}-\d{2}$/.test(t.value))paint(dd);}
   else if(k==='plan'){S.plan=t.checked?'customer':'internal';}
   else if(k==='req'){S.reqOn=Object.assign({},S.reqOn,{[t.dataset.id]:t.checked});const dd1=dealById(card._ceDeal);if(dd1)paint(dd1);return;}
   const dd=dealById(card._ceDeal);if(dd&&k!=='date'){const pv=card.querySelector('.ce-prev'),pl=S.res?planOf(dd):null;if(pv)pv.textContent=V5()?V5().preview(pl,S,dd,existingFor(dd),reqsOf(dd),MR()):pl&&pl.ok?pl.preview:pl&&pl.error||'연락 결과를 골라 주세요';const saveButton=card.querySelector('[data-ce="save"]');if(saveButton&&card.classList.contains('ce-page'))saveButton.disabled=busy||!pl?.ok;saveDraft(dd.id,S);}
  });
 }
 function mic(card,btn){
  const ta=card.querySelector('textarea[data-ce-in="memo"]'),hint=card.querySelector('.ce-hint'),SR=root.SpeechRecognition||root.webkitSpeechRecognition;
  if(!ta||!hint)return;
  if(!SR){hint.hidden=false;hint.textContent='이 휴대폰은 음성 입력을 지원하지 않습니다 — 직접 적어 주세요.';return;}
  if(btn._rec){try{btn._rec.stop();}catch(e){}return;}
  const inputState=S,inputOwner=owner,wrap=root.document.getElementById('sheetwrap');
  const current=()=>S===inputState&&!busy&&!progress.signature&&card.contains(ta)&&wrap?.classList.contains('open')&&root.MobileSaveJournal.owner()===inputOwner&&root.MobileSaveJournal.session()===sessionToken;
  const r=new SR();r.lang='ko-KR';r.continuous=true;r.interimResults=true;
  const base=ta.value?ta.value.replace(/\s+$/,'')+' ':'';let fin='',lastValue=ta.value,ended=false,failed=false;
  const reset=()=>{btn._rec=null;btn.textContent='말하기';btn.setAttribute('aria-pressed','false');};
  const observer=new MutationObserver(()=>{if(!current())cancel();});
  const cleanup=()=>{observer.disconnect();ta.removeEventListener('input',manual);root.removeEventListener('phase1:identity-cleared',cancel);root.removeEventListener('phase1:profile',check);};
  const cancel=()=>{if(ended)return;ended=true;cleanup();if(current())reset();else btn._rec=null;try{r.abort();}catch(e){}};
  const check=()=>{if(!current())cancel();};
  r.onresult=ev=>{
   if(ended)return;if(!current()||ta.value!==lastValue){cancel();return;}
   let itv='';for(let i=ev.resultIndex;i<ev.results.length;i++){const s=ev.results[i][0].transcript;if(ev.results[i].isFinal)fin+=s;else itv+=s;}
   lastValue=(base+fin+itv).slice(0,300);ta.value=lastValue;S.memo=lastValue;
   ta.dispatchEvent(new Event('input',{bubbles:true}));
  };
  r.onerror=ev=>{if(ended)return;if(!current()){cancel();return;}failed=true;hint.hidden=false;hint.textContent='음성 인식이 안 됩니다('+(ev&&ev.error||'')+') — 직접 적어 주세요.';cancel();};
  r.onend=()=>{if(ended)return;ended=true;cleanup();if(!current())return;reset();if(!failed&&ta.value){hint.hidden=false;hint.textContent='글자로 바꿨습니다 — 고칠 수 있습니다.';}};
  // Only physical/manual input invalidates recognition; our synthetic input persists the draft.
  const manual=ev=>{if(ta.value!==lastValue)cancel();};
  ta.addEventListener('input',manual);
  observer.observe(card,{childList:true,subtree:true});if(wrap)observer.observe(wrap,{attributes:true,attributeFilter:['class']});
  root.addEventListener('phase1:identity-cleared',cancel);root.addEventListener('phase1:profile',check);
  try{r.start();}catch(err){failed=true;ended=true;cleanup();hint.hidden=false;hint.textContent='마이크를 시작할 수 없습니다 — 직접 적어 주세요.';return;}
  btn._rec=r;btn.textContent='그만';btn.setAttribute('aria-pressed','true');hint.hidden=false;hint.textContent='듣는 중… 끝나면 [그만]을 누르세요.';
 }
 /* AI로 정리(로그인 상태에서만): 원문 → 정리문(상담 내용 칸 교체 · 원문 되돌리기) + 결과 · 날짜는 '추천' 표시만 — 고르는 것은 사람이다. 서버 함수 crm-ai(memo_tidy)를 그대로 쓴다 */
  const AI_NAME={ongoing:'연결됨',recall:'연결됨',promise:'연결됨',absent:'부재'};
  async function tidy(d,card,btn){
   const ta=card.querySelector('textarea[data-ce-in="memo"]');if(!ta)return;const raw=ta.value.replace(/\s+/g,' ').trim();
   if(!raw){S.aiHint='먼저 말하거나 적어 주세요.';paint(d);return;}
   const inputState=S,inputOwner=owner,inputValue=ta.value,wrap=root.document.getElementById('sheetwrap');
   const current=()=>S===inputState&&!busy&&!progress.signature&&card.contains(ta)&&wrap?.classList.contains('open')&&root.MobileSaveJournal.owner()===inputOwner&&root.MobileSaveJournal.session()===sessionToken;
   btn.disabled=true;btn.textContent='정리 중…';
   try{
    const r=await root.fetch(root.SUPABASE_URL+'/functions/v1/crm-ai',{method:'POST',headers:{apikey:root.SUPABASE_ANON,Authorization:'Bearer '+root.TOKEN,'Content-Type':'application/json'},body:JSON.stringify({kind:'memo_tidy',subject_type:'deal',subject_id:String(d.id),input:{site:d.nm||'',stage:String(d.code||''),today:kst(),raw}})});
    const j=await r.json().catch(()=>null);
    if(!current()||ta.value!==inputValue)return;
    if(!r.ok||!j||j.ok!==true||!j.suggestion)throw new Error({AI_DISABLED:'AI 제안이 꺼져 있습니다',AI_NOT_CONFIGURED:'AI 키가 서버에 없습니다',FORBIDDEN:'AI 제안을 쓸 권한이 없습니다',AI_UPSTREAM:'AI 서버가 응답하지 않았습니다',AI_BAD_OUTPUT:'AI 답을 읽지 못했습니다'}[j&&j.error]||'AI 정리를 받지 못했습니다');
    const s=j.suggestion.suggestion||{};if(!s.memo)throw new Error('AI가 정리할 내용을 찾지 못했습니다');
    S.aiRaw=raw;S.ai={res:AI_NAME[s.result]||'',date:s.next&&s.next.date||''};
    /* 2026-10-22 회의록 8/27 음성 메모 구조화: 핵심 이슈 · 경쟁사 · 결정 일정 · 요구가 있으면 상담 내용에 표식 줄로 함께 남긴다(원문에 있던 것만 · 고칠 수 있다) */
    const lines=[s.memo];if(s.issue)lines.push('[핵심 이슈] '+s.issue);if(s.competitor)lines.push('[경쟁사] '+s.competitor);if(s.decision)lines.push('[결정 일정] '+s.decision);if(s.needs)lines.push('[고객 요구] '+s.needs);
    S.memo=lines.join('\n');
    const nx=s.next&&s.next.date?'다음 확인 '+s.next.date.slice(5).replace('-','/')+(s.next.text?' · '+s.next.text:''):'',tags=Array.isArray(s.tags)&&s.tags.length?'꼬리표 '+s.tags.join(' · '):'';
    S.aiHint='AI 정리(제안) — '+[AI_NAME[s.result]?'결과는 「'+AI_NAME[s.result]+'」':'',nx,tags].filter(Boolean).join(' · ')+(S.ai.res||nx?' 로 추천합니다. ':'')+(lines.length>1?'이슈 · 경쟁사 · 결정 일정을 표식 줄로 넣었습니다. ':'')+'상담 내용은 고칠 수 있고, 고르는 것은 직접 합니다.';
   }catch(e){if(!current()||ta.value!==inputValue)return;S.aiHint=String(e&&e.message||e);}
   finally{if(current()){btn.disabled=false;btn.textContent='AI로 정리';}}
   if(current())paint(d,true);
  }
 async function confirmOp(op,payload,actionId,slot){
  assertSession();
  const Q=root.Phase1.queue,key=slot||op;let id=progress[key];
  if(!id){id=root.queueMobileContactOperation(op,payload,actionId);progress[key]=id;persistProgress();}
  let failure;try{await Q.flush();}catch(e){failure=e;}const row=Q.list().find(q=>q.request_id===id);
  if(!row||row.status!=='done'||!row.ack||row.ack.ok!==true)throw Error(row&&row.error||'서버 확인 대기 중 — 다시 누르면 같은 요청을 확인합니다.');
  root.OperationalAdapter.validateAck(row.ack,row);
  assertSession();
  return row;
 }
 async function save(d,card){
  if(busy)return;
  const ta=card.querySelector('textarea[data-ce-in="memo"]');if(ta)S.memo=ta.value;
  if(!progress.signature&&S.existing){try{selectedExisting(d,S.existing);}catch(e){S.err=String(e.message||e);paint(d);return;}}
  const input=withInfo(),signature=signatureOf(input);
  if(progress.signature&&progress.signature!==signature){S.err='저장 확인 중 입력값이 바뀌었습니다. 원래 입력으로 재시도해 주세요.';paint(d);return;}
  const ctx=progress.ctx||ctxOf(d),pl=progress.pl||planWith(input,ctx);
  if(!pl.ok){S.err=pl.error;paint(d);return;}
  if(!root.Phase1||!root.Phase1.queue||typeof root.queueMobileContactOperation!=='function'){S.err='로그인 상태에서만 저장할 수 있습니다.';paint(d);return;}
  progress.signature=signature;progress.ctx=ctx;progress.pl=pl;progress.input=progress.input||JSON.parse(JSON.stringify(S));
  progress.requestSnapshot=progress.requestSnapshot||JSON.parse(JSON.stringify(reqsOf(d)));
  try{persistProgress();}catch(e){S.err=String(e.message||e);paint(d);return;}
  busy=true;S.err='';paint(d);
  const savingView=card.querySelector('.ce');
  const at=progress.at||(progress.at=new Date().toISOString()),ex=ctx.existing;
  try{
   persistProgress();
   const flow=pl.scheduleV1&&(pl.next||pl.change);
   if(flow)await root.ScheduleFlow.begin(d,pl,ctx.existing,progress,persistProgress);
   const cur=openNext(d);
   // Saving a contact result does not prove that the existing task is complete.
   const activity={type:S.ch==='방문'?'방문':'전화',note:pl.note,result:'',occurred_at:at};
   const rec=await confirmOp('activity',{opportunity_id:d.id,...activity});
   d.activities=Array.isArray(d.activities)?d.activities:[];
   if(!d.activities.some(x=>x.id===rec.ack.activity_id))d.activities.push({id:rec.ack.activity_id,type:activity.type,note:activity.note,result:'',at,occurred_at:at,meaningful:pl.meaningful});
   if(flow){
    const saved=await root.ScheduleFlow.finish(d,progress,rec.ack,persistProgress);assertSession();root.ScheduleFlow.project(d,saved);
   }else if(pl.next){
    const next={type:pl.next.type,text:pl.next.text,due_at:pl.next.due};
    const sch=await confirmOp('next_action',{opportunity_id:d.id,...next});
    d.nextAction=d.nextActionObj={id:sch.ack.next_action_id,opportunity_id:d.id,type:next.type,text:next.text,due:next.due_at,due_at:next.due_at,status:'open'};
   }else if(pl.change){
    const next={type:pl.change.type,text:ex.promise?'고객 약속: '+pl.change.text:pl.change.text,due_at:pl.change.due};
    const sch=await confirmOp('next_action',{opportunity_id:d.id,intent:'postpone',action_id:pl.change.id,due_at:next.due_at});
    d.nextAction=d.nextActionObj={...cur,id:sch.ack.next_action_id,opportunity_id:d.id,type:next.type,text:next.text,due:next.due_at,due_at:next.due_at,status:'open'};
   }else if(pl.completeCurrent){d.nextAction=d.nextActionObj=null;}
   if(pl.meaningful)d.contactAt=at;d.lastAt=at;
   // The task remains open until its own completion condition is confirmed.
   let infoErr=progress.infoError||'';
   if(pl.info&&!progress.infoHandled){try{await root.MobileFields.save(d,{construction_plan:pl.info.construction_plan},'결과 남기기에서 함께 변경');}catch(e){infoErr=String(e&&e.message||e);pl.info=null;}progress.infoHandled=true;progress.infoError=infoErr;persistProgress();}
   const resLabel=S.res;
   if(pl.requests&&pl.requests.length){
    progress.requestResults=progress.requestResults||{};
    for(const rq of pl.requests){
     if((rq.state!=='done'&&rq.state!=='working')||progress.requestResults[rq.id])continue;
     assertSession();
     const req=reqsOf(d).find(x=>x.id===rq.id);
     try{
      if(!req||!root.MobileRequests?.enabled())throw Error('요청 저장 연결을 확인해 주세요.');
      const saved=await root.MobileRequests.complete(req,{result:resLabel,absent:rq.state==='working',next_text:rq.next_text,next_due:rq.next_due,activity:rec.ack});
      assertSession();
      progress.requestResults[rq.id]={id:saved.id,status:saved.status};persistProgress();
     }catch(e){throw Error('응대 기록은 저장됐습니다. 관리자 요청 처리 확인이 남았습니다: '+String(e&&e.message||e));}
    }
   }
   assertSession();
   /* v5 방문 · 만남 = 그 방문 업무 완료(방문 결과가 그 업무의 완료 조건 · 기획 '끝난 일 · 방문') — 취소 · 연기(날짜 변경) · 담당 부재는 업무 그대로 */
   if(V5()&&S.ch==='방문'&&pl.meaningful&&!S.v5cancel&&pl.mode!=='change'&&ex&&UUID.test(String(ex.id||''))&&!progress.visitDone){
    await confirmOp('next_action_complete',{opportunity_id:d.id},ex.id,'visitDone');assertSession();progress.visitDone=String(ex.id);persistProgress();
    [d.nextAction,d.nextActionObj].concat(Array.isArray(d.openNextActions)?d.openNextActions:[]).filter(a=>a&&String(a.id)===String(ex.id)).forEach(a=>{a.status='done';a.completed_at=at;});
    if(Array.isArray(d.openNextActions))d.openNextActions=d.openNextActions.filter(a=>String(a.id)!==String(ex.id));
   }
   /* v5 요청 항목별 처리(crm_work_request_deal_contact_v1): 응대 기록이 서버에 확인된 뒤 이 현장의 첫 연락 · 후속 연락 요청마다 한 번. 다시 눌러도 같은 operation_id(서버가 한 번만 처리) */
   if(V5()&&MR()?.itemReady?.()){
    progress.requestResults=progress.requestResults||{};progress.requestOps=progress.requestOps||{};
    for(const rq of reqsOf(d)){
     if(progress.requestResults[rq.id])continue;const body=V5().requestBody(S,d,rq,pl,ctx.existing,MR());if(!body)continue;
     if(!progress.requestOps[rq.id]){progress.requestOps[rq.id]=root.crypto.randomUUID();persistProgress();}
     try{const x=await MR().completeItems(rq,Object.assign({},body,{operation_id:progress.requestOps[rq.id],activity:rec.ack}));assertSession();progress.requestResults[rq.id]={id:x.request_id,status:x.request.status,note:x.request.status==='done'?'':String(x.request.reply_note||'')};persistProgress();}
     catch(e){throw Error('응대 기록은 저장됐습니다. 관리자 요청 처리 확인이 남았습니다: '+String(e&&e.message||e));}
    }
   }
   /* v5 '정리됨' · 방문 → 견적 요청에 넘길 것(입력 · 요청 · 방문 기록 번호) — 지우기 전에 복사 */
   const v5done=V5()?{s:JSON.parse(JSON.stringify(S)),requests:JSON.parse(JSON.stringify(progress.requestSnapshot||[])),requestResults:Object.assign({},progress.requestResults||{}),activityId:rec.ack.activity_id,memo:input.memo,visitDone:progress.visitDone||''}:null;
   const ch0=S.ch;lastMemo=String(S.memo||'');last={pl,ctx,deal_id:String(d.id),owner,sessionToken};clearDraft();busy=false;S=null;progress={};
   const rows=CE.summary(pl,Object.assign({},ctx,{openRequests:[]}));if(infoErr)rows.push(['남음','공사 시기는 저장하지 못했습니다: '+infoErr]);
   const quoteOk=ch0==='방문'&&pl.meaningful&&!d.outcome&&String(d.code)==='consulting'&&root.MobileFields&&root.MobileFields.ready();
   const k={저장:'ok',완료:'ok',변경:'chg',신규:'new',남음:'left'};
   const c=root.document.getElementById('sheetcard');
   if(c.contains(savingView)&&c.classList.contains('ce-page')){
    savingView.classList.add('ce-done');
    c.querySelectorAll('input,textarea,button:not(.cd-back)').forEach(el=>el.disabled=true);
    const sb=c.querySelector('.ce-save');if(sb)sb.textContent='저장됨';
    const pv=c.querySelector('.ce-prev');if(pv)pv.textContent=rows.map(r=>r[1]).join(' · ');
    root.toast?.('저장됨 · '+rows.map(r=>r[1]).join(' · '));
    /* 2026-10-22 회의록 모바일: 저장 성공 = 토스트 + 짧은 진동(지원 기기만 · Android) */
    try{root.navigator?.vibrate?.(30);}catch(e){}
    if(v5done)V5().after(c,Object.assign(v5done,{d,pl,rows,api:MR()}));
   }else if(c.contains(savingView))c.innerHTML='<div class="sheet-grip"></div><div class="ce-done"><b class="ce-dt">저장했습니다</b><small>'+h(d.nm)+'</small><ul>'+rows.map(r=>'<li class="'+k[r[0]]+'"><em>'+h(r[0])+'</em><span>'+h(r[1])+'</span></li>').join('')+'</ul><div class="ce-donebtn"><button type="button" class="btn btn-line" data-ce="close">닫기</button><button type="button" class="btn btn-primary" data-ce="next">다음 건으로</button></div>'+(quoteOk?'<button type="button" class="btn btn-line" data-ce="quote" style="margin-top:8px">견적 요청 등록</button>':'')+'</div>';
   try{root.saveLocal&&root.saveLocal();}catch(e){}
  }catch(e){busy=false;if(pl.scheduleV1&&!progress.activity&&!progress.schedule?.prepared){progress={};saveDraft(activeID,S);}S.err=String(e&&e.message||e);if(card.contains(savingView))paint(d);}
 }
 /* ── 일정 바꾸기(2026-10-10 mobile_all 4번 흐름 7): 다른 기록 없이 지금 일정의 날짜만. 늦추면 사유 필수 → PC 와 같은 '[기한 변경] 원래 | 새 | 사유' 기록, 일정 이름은 그대로 · 완료로 세지 않는다 ── */
 let RS=null;
 function rsHtml(d){
  const ex=RS.existing||existingOf(d),later=!!(ex&&ex.due&&RS.date&&RS.date>ex.due),needReason=later||(root.ScheduleFlow?.enabled()===true&&RS.date!==ex.due);
  const pv=!RS.date?'새 날짜를 골라 주세요':needReason&&!RS.reason.trim()?'날짜 변경 사유를 입력해 주세요':'<b>저장하면</b> 기존 일정 "'+h(ex.text)+'" 날짜만 변경 · '+h(CE.md(RS.date))+(later?' · 미룬 사유 기록':'')+' · 완료로 세지 않음';
  return '<div class="ce"><section><b class="ce-q"><i>1</i>지금 일정</b><p class="ce-ex"><em>기존 일정</em> '+h(ex.text)+(ex.due?' · '+h(CE.md(ex.due)):'')+(ex.promise?' · 고객 합의':'')+'</p></section>'
   +'<section><b class="ce-q"><i>2</i>새 날짜</b><div class="ce-dates">'+dateOptions().map(x=>'<button type="button" class="ce-date" data-ce="rs-date" data-v="'+x[1]+'" aria-pressed="'+(RS.date===x[1])+'">'+x[0]+'<small>'+h(CE.md(x[1]))+'</small></button>').join('')+'<label class="ce-date ce-pick" aria-pressed="'+(!!RS.date&&!dateOptions().some(x=>x[1]===RS.date))+'">날짜 선택<small>'+h(RS.date?CE.md(RS.date):'')+'</small><input type="date" data-ce-in="rs-date" min="'+kst()+'" value="'+attr(RS.date)+'"></label></div></section>'
   +(needReason?'<section><b class="ce-q"><i>3</i>날짜 변경 사유 <small>필수</small></b><input type="text" class="ce-in" data-ce-in="rs-reason" maxlength="80" value="'+attr(RS.reason)+'" placeholder="예: 고객 요청 · 입대의 후 연락" aria-label="미루는 사유"><p class="ce-sub">미뤄도 지연 기록은 남습니다 · 관리팀 지표 \'기한 변경 n회\'로 따로 셉니다</p></section>':'')
   +(RS.err?'<p class="ce-err" role="alert">'+h(RS.err)+'</p>':'')+'</div><div class="ce-foot"><span class="ce-prev">'+pv+'</span><button type="button" class="btn btn-primary ce-save" data-ce="rs-save"'+(busy?' disabled':'')+'>'+(busy?'확인 중…':'일정 바꾸기')+'</button></div>';
 }
 function paintRs(d){const card=root.document.getElementById('sheetcard');if(!card||!RS)return;try{persistProgress();}catch(e){RS.err=String(e.message||e);}const keep=card.querySelector('.ce')?card.scrollTop:0,head=card.querySelector('.intro')?card.querySelector('.intro').outerHTML+'<div style="height:12px"></div>':'';card.innerHTML='<div class="sheet-grip"></div>'+head+rsHtml(d);card.scrollTop=keep;}
 /* opts.existing: 모바일 v5 방문 결과의 [취소 · 연기] — 고른 방문 업무의 날짜만 바꾼다(응대 결과를 만들지 않음 · 이전 날짜는 [기한 변경] 기록으로 남음) */
 function reschedule(opts){
  const pick=opts&&opts.existing&&V5()?opts.existing:null;
  if(root.MobileGuideShell&&!pick){root.toast('연락 결과의 기존 업무 날짜 변경을 이용해 주세요.');return;}
  const d=dealById(root.G&&root.G.deal);if(!d)return;
  const sel=pick||existingOf(d);
  if(!sel){if(typeof root.toast==='function')root.toast('바꿀 일정이 없습니다 — 결과 남기기에서 새 업무를 잡아 주세요');return;}
  if(busy)return;RS={date:'',reason:'',err:'',existing:sel};busy=false;progress={};owner=root.MobileSaveJournal?.owner()||'';sessionToken=root.MobileSaveJournal?.session()||'';activeID=d.id;progressMode='reschedule';recoveryError='';
  try{const saved=root.MobileSaveJournal.read('reschedule',d.id);if(saved){progress=saved.progress||{};RS=JSON.parse(JSON.stringify(progress.input||saved.input||RS));}}catch(e){recoveryError=String(e.message||e);RS.err=recoveryError;}
  root.openSheet(root.intro('var(--blue-50)','var(--blue-dark)',root.IC.phone,'일정 바꾸기',h(d.nm)),'');
  const card=root.document.getElementById('sheetcard');if(card){card.classList.add('ce-card');card._ceMode='rs';}
  paintRs(d);wire(d);
 }
 async function saveRs(d){
  if(busy||!RS)return;const ex=RS.existing;if(!ex)return;const T=kst(),later=!!(ex.due&&RS.date>ex.due);
  const modern=!!progress.schedule||root.ScheduleFlow?.enabled()===true;
  const issue=CE.rescheduleError(ex,RS.date,T,modern);if(issue){RS.err=issue;return paintRs(d);}
  const signature=JSON.stringify([RS.date,RS.reason]);if(progress.signature&&progress.signature!==signature){RS.err='저장 확인 중 입력값이 바뀌었습니다. 원래 입력으로 재시도해 주세요.';return paintRs(d);}
  if(!RS.date){RS.err='새 날짜를 골라 주세요';return paintRs(d);}
  if(RS.date<T){RS.err='새 날짜는 오늘 이후로 골라 주세요';return paintRs(d);}
  if((later||modern)&&!RS.reason.trim()){RS.err='미루는 사유를 입력해 주세요 (원래 기한 · 새 기한 · 사유가 기록됩니다)';return paintRs(d);}
  if(!root.Phase1||!root.Phase1.queue||typeof root.queueMobileContactOperation!=='function'){RS.err='로그인 상태에서만 저장할 수 있습니다.';return paintRs(d);}
  progress.signature=signature;progress.input=progress.input||JSON.parse(JSON.stringify(RS));try{persistProgress();}catch(e){RS.err=String(e.message||e);return paintRs(d);}busy=true;RS.err='';paintRs(d);
  const card=root.document.getElementById('sheetcard'),savingView=card.querySelector('.ce');
  try{
   const at=progress.at||(progress.at=new Date().toISOString());
   persistProgress();
   if(modern){
    await root.ScheduleFlow.begin(d,{change:{id:ex.id,due:RS.date,reason:RS.reason.trim()}},ex,progress,persistProgress);
    const saved=await root.ScheduleFlow.finish(d,progress,null,persistProgress);assertSession();root.ScheduleFlow.project(d,saved);
   }else{
   await confirmOp('activity',{opportunity_id:d.id,type:'메모',note:'[기한 변경 요청] 원래 '+ex.due+' | 새 '+RS.date+' | 사유 '+RS.reason.trim(),result:'',occurred_at:at},undefined,'rsmemo');
   const next={type:ex.type||'전화',text:(ex.promise?'고객 약속: ':'')+ex.text,due_at:RS.date},sch=await confirmOp('next_action',{opportunity_id:d.id,intent:'postpone',action_id:ex.id,due_at:RS.date},undefined,'rsnext');
   d.nextAction=d.nextActionObj={id:sch.ack.next_action_id,opportunity_id:d.id,type:next.type,text:next.text,due:next.due_at,due_at:next.due_at,status:'open'};

   }
   assertSession();root.MobileSaveJournal.drop('reschedule',activeID,owner);busy=false;const rows=[['변경','기존 일정 "'+ex.text+'" → '+CE.md(RS.date)+(later?' · 사유 '+RS.reason.trim():'')],['남음','할 일 이름은 그대로 · 완료로 세지 않음']];RS=null;
   const c=root.document.getElementById('sheetcard');
   if(c.contains(savingView))c.innerHTML='<div class="sheet-grip"></div><div class="ce-done"><b class="ce-dt">일정을 바꿨습니다</b><small>'+h(d.nm)+'</small><ul>'+rows.map(r=>'<li class="'+(r[0]==='변경'?'chg':'left')+'"><em>'+h(r[0])+'</em><span>'+h(r[1])+'</span></li>').join('')+'</ul><div class="ce-donebtn"><button type="button" class="btn btn-primary" data-ce="close" style="grid-column:1/-1">닫기</button></div></div>';
   try{root.saveLocal&&root.saveLocal();}catch(e){}
  }catch(e){busy=false;if(modern&&!progress.schedule?.prepared){progress={};try{persistProgress();}catch(_){}}RS.err=String(e&&e.message||e);if(card.contains(savingView))paintRs(d);}
 }
 const old=root.dealCallSheetM;
 const originalOpenSheet=root.openSheet,originalCloseSheet=root.closeSheet;
 function clearPage(){root.document.getElementById('sheetcard')?.classList.remove('ce-page');root.document.getElementById('sheetwrap')?.classList.remove('ce-page-wrap');const background=root.document.getElementById('scr');if(background)background.inert=false;}
 root.openSheet=function(){clearPage();return originalOpenSheet.apply(this,arguments);};
 root.closeSheet=function(){clearPage();return originalCloseSheet.apply(this,arguments);};
 root.dealCallSheetM=function(){if(!CE.on()){if(root.MobileGuideShell){root.toast('현재 연락 결과 입력이 꺼져 있습니다.');return;}return old.apply(this,arguments);}return open();};
 // A reviewed transcript may change only this exact local draft. It never saves an activity.
 const inputHandles=new WeakMap();
 const draftCopy=v=>JSON.parse(JSON.stringify(v));
 const targetStamp=d=>JSON.stringify([d.id,d.version,d.code,d.outcome,d.rep,d.site_id,d.contact_id,d.nextAction,d.openNextActions]);
 function captureInputDraft(){
  const d=dealById(activeID);
  if(!d||!S||busy||progress.signature||progressMode!=='contact'||String(root.G?.deal)!==String(activeID)||!root.myDeals?.().some(x=>String(x.id)===String(activeID)))return {ok:false,error:'INPUT_DRAFT_UNAVAILABLE'};
  try{
   saveDraft(activeID,S,true);
   const handle=Object.freeze({ok:true,dealId:String(activeID),memo:String(S.memo||''),draftStamp:JSON.stringify(S)});
   inputHandles.set(handle,{owner,sessionToken,id:String(activeID),input:JSON.stringify(S),target:targetStamp(d),at:Date.now()});
   return handle;
  }catch(e){return {ok:false,error:String(e.message||e)};}
 }
 function inputDraftCurrent(handle){
  const snap=inputHandles.get(handle),d=snap&&dealById(snap.id);
  try{
   if(!snap||!d||Date.now()-snap.at>LIFE||busy||progress.signature||progressMode!=='contact'||!S||JSON.stringify(S)!==snap.input||targetStamp(d)!==snap.target||String(root.G?.deal)!==snap.id||!root.myDeals?.().some(x=>String(x.id)===snap.id))return false;
   root.MobileSaveJournal.assertOwner(snap.owner);root.MobileSaveJournal.assertSession(snap.sessionToken);
   const saved=root.MobileSaveJournal.read('contact',snap.id);
   return !!saved&&!saved.progress?.signature&&JSON.stringify(saved.input)===snap.input;
  }catch{return false;}
 }
 function applyInputDraft(handle,memo){
  if(!inputDraftCurrent(handle))return {ok:false,error:'INPUT_DRAFT_CHANGED'};
  if(typeof memo!=='string'||!memo.trim()||memo.length>300)return {ok:false,error:'INPUT_MEMO_INVALID'};
  const snap=inputHandles.get(handle),updated=draftCopy(S);updated.memo=memo;
  try{saveDraft(snap.id,updated,true);}catch(e){return {ok:false,error:String(e.message||e)};}
  S=updated;inputHandles.delete(handle);open({ch:updated.ch,existing:updated.existing});return {ok:true,localOnly:true};
 }
 root.MobileEntry=Object.freeze({open,reschedule,state:()=>S,last:()=>last,existingOf,captureInputDraft,inputDraftCurrent,applyInputDraft});
})(window);
