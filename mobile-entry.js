/* 모바일 결과 창 — 상담 결과 · 한 번만 쓰기 (2026-10-10 design_handoff_mobile_all 2번 · PC 상세 가운데 칸과 같은 입력 · 같은 저장 계획)
   ① 연락 결과(PC 값 5가지) ② 상담 내용(부재 · 번호 오류는 칸 없음) ③ 다음 업무(기존 일정 유지 · 변경 · 새 업무 · 없음) + [고객 정보 변경 ▾] + 저장 전 미리보기.
   현장 · 영업건 · 담당 · 연락처는 열려 있는 상세에서 이어받는다. 저장은 mobile-loop.js 와 같은 길(queueMobileContactOperation: 완료 → 기록 → 다음 업무)이고,
   기록 1건 저장이 일정 · 요청 · 고객 정보를 몰래 바꾸지 않는다 — 바뀌는 것은 미리보기 · 저장 뒤 화면에 구분해서 적는다.
   끄기: G.contactEntryOff=true → 예전 결과 창(mobile-loop.js). */
(function(root){
 'use strict';
 const CE=root.ContactEntry;if(!CE||typeof root.dealCallSheetM!=='function')return;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const day=v=>String(v||'').slice(0,10);
 const kst=v=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(v?new Date(v):new Date());}catch(e){return day(new Date().toISOString());}};
 const dealById=id=>(root.DEALS||[]).find(x=>String(x.id)===String(id));
 const openNext=d=>{const a=d&&d.nextAction;return a&&a.status==='open'?a:null;};
 const isPromise=a=>!!a&&(/약속/.test(String(a.type||''))||/^\s*고객\s*약속/.test(String(a.text||'')));
 const existingOf=d=>{const a=openNext(d);if(!a||!String(a.text||'').trim())return null;return {id:a.id||'',text:String(a.text).replace(/^\s*고객\s*약속\s*:?\s*/,'').trim()||String(a.text),due:day(a.due_at||a.due),type:a.type||'전화',promise:isPromise(a)};};
 /* 작성 중 내용 복원: 뒤로 가기 · 다른 창을 다녀와도 같은 현장이면 이어서(30분) */
 const KEY='crm:call-entry:v1',LIFE=30*60000;
 const store=()=>{try{return root.sessionStorage||null;}catch(e){return null;}};
 function loadDraft(id){try{const s=store(),j=s&&JSON.parse(s.getItem(KEY)||'null');if(j&&String(j.id)===String(id)&&Date.now()-Number(j.at||0)<LIFE)return j.s;}catch(e){}return null;}
 function saveDraft(id,S){try{const s=store();if(s)s.setItem(KEY,JSON.stringify({id:String(id),at:Date.now(),s:S}));}catch(e){}}
 function clearDraft(){try{const s=store();if(s)s.removeItem(KEY);}catch(e){}}
 let S=null,busy=false,progress={},last=null;
 const dateOptions=()=>{const t=kst(),mon=(()=>{const x=new Date(t+'T00:00:00Z'),w=x.getUTCDay();return CE.addDays(t,((8-w)%7)||7);})();return [['내일',CE.addDays(t,1)],['3일 후',CE.addDays(t,3)],['다음 주 월요일',mon]];};
 const ctxOf=d=>({today:kst(),existing:existingOf(d)});
 const planOf=d=>CE.plan(Object.assign({ch:'전화'},S),ctxOf(d));
 function fresh(d){
  const ex=existingOf(d),dflt=CE.defaults('연결됨',ex,kst());
  return {res:'',memo:'',mode:dflt.mode,purpose:dflt.purpose,date:dflt.date,reason:'',plan:'internal',info:false,touchedNext:false};
 }
 /* 결과를 고르면 다음 업무 제안도 그 결과에 맞게(직접 고친 뒤에는 건드리지 않는다) */
 function pickResult(d,res){
  S.res=res;
  if(!S.touchedNext){const dflt=CE.defaults(res,existingOf(d),kst());S.mode=dflt.mode;S.purpose=dflt.purpose;S.date=dflt.date;}
  if(CE.isBadfit(res))S.mode='none';
 }
 function sheetHtml(d){
  const ex=existingOf(d),pl=S.res?planOf(d):null,c=root.contactInfoM?root.contactInfoM(d):{};
  const chip=(act,v,on,label,cls)=>'<button type="button" class="ce-chip'+(cls?' '+cls:'')+(act==='res'&&S.ai&&S.ai.res===v?' ai':'')+'" data-ce="'+act+'" data-v="'+attr(v)+'" aria-pressed="'+!!on+'">'+h(label||v)+'</button>';
  const res='<section><b class="ce-q"><i>1</i>연락 결과 <small>PC 기준 값</small></b><div class="ce-chips">'+CE.VALUES.map(v=>chip('res',v,S.res===v)).join('')+'</div></section>';
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
   nx+='<div class="ce-dates">'+dateOptions().map(x=>'<button type="button" class="ce-date" data-ce="date" data-v="'+x[1]+'" aria-pressed="'+(S.date===x[1])+'">'+x[0]+'<small>'+h(CE.md(x[1]))+'</small></button>').join('')+'<label class="ce-date ce-pick" aria-pressed="'+(!!S.date&&!dateOptions().some(x=>x[1]===S.date))+'">날짜 선택<small>'+h(S.date?CE.md(S.date):'')+'</small><input type="date" data-ce-in="date" min="'+kst()+'" value="'+attr(S.date)+'"></label></div><p class="ce-sub">기존 일정의 날짜만 바뀝니다 — 할 일 이름은 그대로, 완료로 세지 않습니다</p>';
  }else if(S.mode==='keep'&&ex){
   nx+='<p class="ce-sub">기존 일정 그대로 — 이 기록은 일정을 완료로 세거나 바꾸지 않습니다</p>';
  }else if(S.mode==='none'){
   nx+='<input type="text" class="ce-in" data-ce-in="reason" maxlength="80" value="'+attr(S.reason)+'" placeholder="'+(CE.isBadfit(S.res)?'배드핏 사유 (필수)':'다음 일정이 없는 이유 (예: 내년 예산 · 3월 재확인)')+'" aria-label="사유">';
  }
  nx+='</section>';
  const info='<div class="ce-info"><button type="button" class="ce-infobtn" data-ce="info" aria-expanded="'+!!S.info+'">고객 정보 변경 '+(S.info?'▴':'▾')+' <small>바뀐 것만 · 공종 · 결정권자</small></button>'
   +(S.info?'<div class="ce-infobody"><div><span>공종</span><b>'+h(root.bizOf?root.bizOf(d):'')+'</b><button type="button" data-ce="edit-work">수정</button></div><div><span>결정권자 · 담당자</span><b>'+h((c.name?c.name+(c.role?' '+c.role:''):'미입력'))+'</b><button type="button" data-ce="edit-contact">수정</button></div><div><span>공사 시기 · 대표회의</span><b>PC 상세에서 입력</b></div></div>':'')+'</div>';
  const err=S.err?'<p class="ce-err" role="alert">'+h(S.err)+'</p>':'';
  const foot='<div class="ce-foot"><span class="ce-prev">'+(pl&&pl.ok?'<b>저장하면</b> '+h(pl.preview):h(pl&&pl.error||'연락 결과를 골라 주세요'))+'</span><button type="button" class="btn btn-primary ce-save" data-ce="save"'+(busy?' disabled':'')+'>'+(busy?'확인 중…':'기록 저장')+'</button></div>';
  return '<div class="ce">'+res+note+nx+info+err+'</div>'+foot;
 }
 function paint(d,fromState){
  const card=root.document.getElementById('sheetcard');if(!card)return;
  const keepTop=card.querySelector('.ce')?card.scrollTop:0,ta=card.querySelector('textarea[data-ce-in="memo"]');if(ta&&!fromState)S.memo=ta.value;
  const head=card.querySelector('.intro')?card.querySelector('.intro').outerHTML+'<div style="height:12px"></div>':'';
  card.innerHTML='<div class="sheet-grip"></div>'+(head||'')+sheetHtml(d);card.scrollTop=keepTop;
  saveDraft(d.id,S);
 }
 function open(){
  const d=dealById(root.G&&root.G.deal);if(!d)return;
  const c=root.contactInfoM?root.contactInfoM(d):{};
  S=loadDraft(d.id)||fresh(d);busy=false;progress={};S.err='';
  root.openSheet(root.intro('var(--blue-50)','var(--blue-dark)',root.IC.phone,'통화 어떻게 됐나요?',h(d.nm)+(c.name?' · '+h(c.name):'')),'');
  const card=root.document.getElementById('sheetcard');if(card)card.classList.add('ce-card');
  paint(d);wire(d);
 }
 let wired=false;
 function wire(d){
  const card=root.document.getElementById('sheetcard');if(!card)return;
  card._ceDeal=d.id;
  if(wired)return;wired=true;
  card.addEventListener('click',e=>{
   const b=e.target.closest('[data-ce]');if(!b||!card.classList.contains('ce-card'))return;const dd=dealById(card._ceDeal);if(!dd||busy)return;
   const a=b.dataset.ce,v=b.dataset.v;
   if(a==='res'){pickResult(dd,v);S.err='';paint(dd);}
   else if(a==='mode'){S.mode=v;S.touchedNext=true;S.err='';if(v==='new'&&!S.date){S.date=CE.addDays(kst(),1);}paint(dd);}
   else if(a==='date'){S.date=v;S.touchedNext=true;S.err='';paint(dd);}
   else if(a==='info'){S.info=!S.info;paint(dd);}
   else if(a==='edit-work'){saveDraft(dd.id,S);if(typeof root.workSheetM==='function')root.workSheetM();}
   else if(a==='edit-contact'){saveDraft(dd.id,S);if(typeof root.contactEditSheetM==='function')root.contactEditSheetM();}
   else if(a==='mic')mic(card,b);
   else if(a==='tidy')tidy(dd,card,b);
   else if(a==='undo'){S.memo=S.aiRaw||S.memo;S.aiRaw='';S.aiHint='원문으로 되돌렸습니다.';paint(dd,true);}
   else if(a==='save')save(dd,card);
   else if(a==='close'){root.closeSheet();root.render();}
   else if(a==='next'){root.closeSheet();const t=(root.G._today||[]).find(x=>!(typeof root.isDone==='function'&&root.isDone(x)));if(t&&typeof root.openTodayEntryM==='function'){root.G.deal=null;root.G.sub=null;root.openTodayEntryM(t.kind,t.ref);}else root.render();}
  });
  card.addEventListener('input',e=>{
   const t=e.target.closest('[data-ce-in]');if(!t||!card.classList.contains('ce-card'))return;const k=t.dataset.ceIn;
   if(k==='memo')S.memo=t.value;else if(k==='purpose'){S.purpose=t.value;S.touchedNext=true;}else if(k==='reason')S.reason=t.value;
   else if(k==='date'){S.date=t.value;S.touchedNext=true;const dd=dealById(card._ceDeal);if(dd&&/^\d{4}-\d{2}-\d{2}$/.test(t.value))paint(dd);}
   else if(k==='plan'){S.plan=t.checked?'customer':'internal';}
   const dd=dealById(card._ceDeal);if(dd&&k!=='date'){const pv=card.querySelector('.ce-prev'),pl=S.res?planOf(dd):null;if(pv)pv.innerHTML=pl&&pl.ok?'<b>저장하면</b> '+h(pl.preview):h(pl&&pl.error||'연락 결과를 골라 주세요');saveDraft(dd.id,S);}
  });
 }
 function mic(card,btn){
  const ta=card.querySelector('textarea[data-ce-in="memo"]'),hint=card.querySelector('.ce-hint'),SR=root.SpeechRecognition||root.webkitSpeechRecognition;
  if(!ta||!hint)return;
  if(!SR){hint.hidden=false;hint.textContent='이 휴대폰은 음성 입력을 지원하지 않습니다 — 직접 적어 주세요.';return;}
  if(btn._rec){try{btn._rec.stop();}catch(e){}return;}
  const r=new SR();r.lang='ko-KR';r.continuous=true;r.interimResults=true;const base=ta.value?ta.value.replace(/\s+$/,'')+' ':'';let fin='';
  r.onresult=ev=>{let itv='';for(let i=ev.resultIndex;i<ev.results.length;i++){const s=ev.results[i][0].transcript;if(ev.results[i].isFinal)fin+=s;else itv+=s;}ta.value=(base+fin+itv).slice(0,300);S.memo=ta.value;};
  r.onerror=ev=>{hint.hidden=false;hint.textContent='음성 인식이 안 됩니다('+(ev&&ev.error||'')+') — 직접 적어 주세요.';};
  r.onend=()=>{btn._rec=null;btn.textContent='말하기';btn.setAttribute('aria-pressed','false');if(ta.value){hint.hidden=false;hint.textContent='글자로 바꿨습니다 — 고칠 수 있습니다.';}};
  try{r.start();}catch(err){hint.hidden=false;hint.textContent='마이크를 시작할 수 없습니다 — 직접 적어 주세요.';return;}
  btn._rec=r;btn.textContent='그만';btn.setAttribute('aria-pressed','true');hint.hidden=false;hint.textContent='듣는 중… 끝나면 [그만]을 누르세요.';
 }
 /* AI로 정리(로그인 상태에서만): 원문 → 정리문(상담 내용 칸 교체 · 원문 되돌리기) + 결과 · 날짜는 '추천' 표시만 — 고르는 것은 사람이다. 서버 함수 crm-ai(memo_tidy)를 그대로 쓴다 */
  const AI_NAME={ongoing:'연결됨',recall:'연결됨',promise:'연결됨',absent:'부재'};
  async function tidy(d,card,btn){
   const ta=card.querySelector('textarea[data-ce-in="memo"]');if(!ta)return;const raw=ta.value.replace(/\s+/g,' ').trim();
   if(!raw){S.aiHint='먼저 말하거나 적어 주세요.';paint(d);return;}
   btn.disabled=true;btn.textContent='정리 중…';
   try{
    const r=await root.fetch(root.SUPABASE_URL+'/functions/v1/crm-ai',{method:'POST',headers:{apikey:root.SUPABASE_ANON,Authorization:'Bearer '+root.TOKEN,'Content-Type':'application/json'},body:JSON.stringify({kind:'memo_tidy',subject_type:'deal',subject_id:String(d.id),input:{site:d.nm||'',stage:String(d.code||''),today:kst(),raw}})});
    const j=await r.json().catch(()=>null);
    if(!r.ok||!j||j.ok!==true||!j.suggestion)throw new Error({AI_DISABLED:'AI 제안이 꺼져 있습니다',AI_NOT_CONFIGURED:'AI 키가 서버에 없습니다',FORBIDDEN:'AI 제안을 쓸 권한이 없습니다',AI_UPSTREAM:'AI 서버가 응답하지 않았습니다',AI_BAD_OUTPUT:'AI 답을 읽지 못했습니다'}[j&&j.error]||'AI 정리를 받지 못했습니다');
    const s=j.suggestion.suggestion||{};if(!s.memo)throw new Error('AI가 정리할 내용을 찾지 못했습니다');
    S.aiRaw=raw;S.memo=s.memo;S.ai={res:AI_NAME[s.result]||'',date:s.next&&s.next.date||''};
    const nx=s.next&&s.next.date?'다음 확인 '+s.next.date.slice(5).replace('-','/')+(s.next.text?' · '+s.next.text:''):'';
    S.aiHint='AI 정리(제안) — '+[AI_NAME[s.result]?'결과는 「'+AI_NAME[s.result]+'」':'',nx].filter(Boolean).join(' · ')+(S.ai.res||nx?' 로 추천합니다. ':'')+'상담 내용은 고칠 수 있고, 고르는 것은 직접 합니다.';
   }catch(e){S.aiHint=String(e&&e.message||e);}
   paint(d,true);
  }
 async function confirmOp(op,payload,actionId){
  const Q=root.Phase1.queue;let id=progress[op];
  if(id&&(Q.list().find(q=>q.request_id===id)||{}).status==='rejected'){delete progress[op];id=null;}
  if(!id){id=root.queueMobileContactOperation(op,payload,actionId);progress[op]=id;}
  await Q.flush();const row=Q.list().find(q=>q.request_id===id);
  if(!row||row.status!=='done'||!row.ack||row.ack.ok!==true)throw Error(row&&row.error||'서버 확인 대기 중 — 다시 누르면 같은 요청을 확인합니다.');
  return row;
 }
 async function save(d,card){
  if(busy)return;
  const ta=card.querySelector('textarea[data-ce-in="memo"]');if(ta)S.memo=ta.value;
  const ctx=ctxOf(d),pl=CE.plan(Object.assign({ch:'전화'},S),ctx);
  if(!pl.ok){S.err=pl.error;paint(d);return;}
  if(!root.Phase1||!root.Phase1.queue||typeof root.queueMobileContactOperation!=='function'){S.err='로그인 상태에서만 저장할 수 있습니다.';paint(d);return;}
  busy=true;S.err='';paint(d);
  const at=progress.at||(progress.at=new Date().toISOString()),ex=ctx.existing;
  try{
   const cur=openNext(d);
   if(pl.completeCurrent&&cur&&UUID.test(String(cur.id||''))&&!progress.completed){await confirmOp('next_action_complete',{opportunity_id:d.id},cur.id);progress.completed=true;cur.status='done';cur.completed_at=new Date().toISOString();}
   const activity={type:'전화',note:pl.note,result:'',occurred_at:at};
   const rec=await confirmOp('activity',{opportunity_id:d.id,...activity});
   d.activities=Array.isArray(d.activities)?d.activities:[];
   if(!d.activities.some(x=>x.id===rec.ack.activity_id))d.activities.push({id:rec.ack.activity_id,type:activity.type,note:activity.note,result:'',at,occurred_at:at,meaningful:pl.meaningful});
   if(pl.next){
    const next={type:pl.next.type,text:pl.next.text,due_at:pl.next.due};
    const sch=await confirmOp('next_action',{opportunity_id:d.id,...next});
    d.nextAction=d.nextActionObj={id:sch.ack.next_action_id,opportunity_id:d.id,type:next.type,text:next.text,due:next.due_at,due_at:next.due_at,status:'open'};
   }else if(pl.change){
    const next={type:pl.change.type,text:ex.promise?'고객 약속: '+pl.change.text:pl.change.text,due_at:pl.change.due};
    const sch=await confirmOp('next_action',{opportunity_id:d.id,...next});
    d.nextAction=d.nextActionObj={id:sch.ack.next_action_id,opportunity_id:d.id,type:next.type,text:next.text,due:next.due_at,due_at:next.due_at,status:'open'};
   }else if(pl.completeCurrent){d.nextAction=d.nextActionObj=null;}
   if(pl.meaningful)d.contactAt=at;d.lastAt=at;
   try{root.G.done[root.doneKey({ref:d.id})]=1;}catch(e){}
   last={pl,ctx};clearDraft();busy=false;S=null;progress={};
   const rows=CE.summary(pl,Object.assign({},ctx,{openRequests:[]}));
   const k={저장:'ok',완료:'ok',변경:'chg',신규:'new',남음:'left'};
   const c=root.document.getElementById('sheetcard');
   c.innerHTML='<div class="sheet-grip"></div><div class="ce-done"><b class="ce-dt">저장했습니다</b><small>'+h(d.nm)+'</small><ul>'+rows.map(r=>'<li class="'+k[r[0]]+'"><em>'+h(r[0])+'</em><span>'+h(r[1])+'</span></li>').join('')+'</ul><div class="ce-donebtn"><button type="button" class="btn btn-line" data-ce="close">닫기</button><button type="button" class="btn btn-primary" data-ce="next">다음 건으로</button></div></div>';
   try{root.saveLocal&&root.saveLocal();}catch(e){}
  }catch(e){busy=false;S.err=String(e&&e.message||e);paint(d);}
 }
 const old=root.dealCallSheetM;
 root.dealCallSheetM=function(){if(!CE.on())return old.apply(this,arguments);return open();};
 root.MobileEntry=Object.freeze({open,state:()=>S,last:()=>last,existingOf});
})(window);
