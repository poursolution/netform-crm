/* 모바일 문의 응대 결과 — PC 와 같은 값 · 같은 저장 (2026-10-10 대표 승인 · design_handoff_mobile_all 1번 '연락 결과' · 2번 '상담 결과 · 한 번만 쓰기')
   예전 결과 3가지(진행됨 · 다음주 다시 · 못 받으심)를 PC 견적문의 상세와 같은 값(연결됨 · 회신 받음 · 부재 · 번호 오류 · 배드핏)으로. 부재 · 번호 오류는 연락 시도, 연결됨 · 회신 받음은 실제 연결.
   저장 = PC InquiryCommand.contactLog 와 같은 순서: ① 서버 응대 기록(crm_inquiry_command_v1 contact_log — 서버가 확인해 줘야 다음으로) → ② 첫 접촉이면 단계 진행(전화응대 완료, 기존 문의 응대 명령) → ③ 다음 행동일(inquiry_next_set).
   배드핏 = 종결(crm_inquiry_command_v1 close · bad_fit · 사유 필수) — 다음 할 일을 만들지 않는다. 문의는 다음 행동일이 필수(PC 와 같다).
   끄기: G.mobileInqOff=true → 예전 결과 3가지. */
(function(root){
 'use strict';
 const CE=root.ContactEntry;if(!CE)return;
 const RPC='crm_inquiry_command_v1';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const kst=n=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+(n||0)*864e5));}catch(e){return new Date(Date.now()+(n||0)*864e5).toISOString().slice(0,10);}};
 const enabled=()=>!(root.G&&(root.G.mobileInqOff||root.G.mobileV2Off||root.G.contactEntryOff))&&CE.on();
 const ready=()=>!!(root.Phase1&&typeof root.Phase1.rpc==='function'&&root.Phase1.profile);
 /* PC 결과 마스터(contact_result) 값 */
 const SERVER={'연결됨':'연결됨','회신 받음':'고객 회신','부재':'부재','번호 오류':'번호오류'};
 const BAD_REASONS=['수행불가 공종','규모 부적합','대상 고객 아님','서비스 범위 아님','기타'];
 const PRE=['접수','신규','담당자 배정','배정완료',''];
 const needsProgress=q=>PRE.includes(String(q&&q.status||''))&&!(q.responded_at||q.respondedAt||q.first_response_at||q.firstResponseAt||(q.raw&&q.raw.responded_at));
 const idOf=q=>String(q&&(q.id||q.key)||'');
 let S=null,busy=false,PROG={},wired=false;
 const uuid=()=>{try{return root.crypto.randomUUID();}catch(e){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});}};
 const state=()=>Object.assign({ch:'전화',mode:CE.isBadfit(S.res)?'none':'new'},S);
 const planOf=()=>CE.plan(state(),{today:kst(),existing:null});
 function pick(res){S.res=res;if(!S.touched){const d=CE.defaults(res,null,kst());S.purpose=d.purpose;S.date=d.date;}S.err='';}
 function html(){
  const pl=S.res?planOf():null,bad=CE.isBadfit(S.res);
  const chip=(act,v,on,cls)=>'<button type="button" class="ce-chip'+(cls?' '+cls:'')+'" data-mi="'+act+'" data-v="'+attr(v)+'" aria-pressed="'+!!on+'">'+h(v)+'</button>';
  const dates=[['내일',kst(1)],['3일 후',kst(3)],['다음 주',kst(7)]];
  const note=!S.res?'':CE.showNote(S.res)?'<section><b class="ce-q"><i>2</i>상담 내용 <small>'+(bad?'확인한 것(사유가 기타면 필수)':'이번에 새로 확인한 것 한 번만')+'</small></b><div class="ce-say"><textarea data-mi-in="memo" rows="3" maxlength="300" placeholder="예) 다음 주 대표회의에서 검토 · 금요일까지 견적서 보내 달라고 함">'+h(S.memo)+'</textarea><button type="button" class="ce-mic" data-mi="mic" aria-pressed="false">말하기</button><small class="ce-hint" hidden></small></div></section>':'<p class="ce-miss">부재 · 번호 오류는 상담 내용 칸 없음 · 연락 시도로만 기록</p>';
  let nx='';
  if(S.res){
   nx='<section><b class="ce-q"><i>3</i>'+(bad?'종결 사유':'다음 행동')+'</b>';
   if(bad)nx+='<div class="ce-chips">'+BAD_REASONS.map(r=>chip('reason',r,S.reason===r,'sm')).join('')+'</div><p class="ce-sub">배드핏은 종결입니다 — 다음 할 일을 만들지 않습니다(사유 필수)</p>';
   else nx+='<input type="text" class="ce-in" data-mi-in="purpose" maxlength="60" value="'+attr(S.purpose)+'" placeholder="다음 행동 (예: 다시 연락)" aria-label="다음 행동"><div class="ce-dates">'+dates.map(x=>'<button type="button" class="ce-date" data-mi="date" data-v="'+x[1]+'" aria-pressed="'+(S.date===x[1])+'">'+x[0]+'<small>'+h(CE.md(x[1]))+'</small></button>').join('')+'<label class="ce-date ce-pick" aria-pressed="'+(!!S.date&&!dates.some(x=>x[1]===S.date))+'">날짜 선택<small>'+h(S.date&&!dates.some(x=>x[1]===S.date)?CE.md(S.date):'')+'</small><input type="date" data-mi-in="date" min="'+kst()+'" value="'+attr(S.date)+'"></label></div>';
   nx+='</section>';
  }
  const err=S.err?'<p class="ce-err" role="alert">'+h(S.err)+'</p>':'';
  const prevTxt=!S.res?'연락 결과를 골라 주세요':bad&&!S.reason?'종결 사유를 골라 주세요':!pl.ok?pl.error:bad&&S.reason==='기타'&&!String(S.memo||'').trim()?'기타 사유는 상담 내용에 적어 주세요':null;
  const prev=prevTxt==null?'<b>저장하면</b> '+h(pl.preview.replace(/응대 기록 1건 저장 \(실제 연결\)/,'응대 기록 1건 저장 (실제 연결) · 서버 확인'))+(!bad&&CE.meaningful(S.res)&&needsProgress(S.q)?' · 첫 통화 완료로 단계 진행':''):h(prevTxt);
  return '<div class="ce"><section><b class="ce-q"><i>1</i>연락 결과 <small>PC 기준 값</small></b><div class="ce-chips">'+CE.VALUES.map(v=>chip('res',v,S.res===v)).join('')+'</div></section>'+note+nx+err+'</div><div class="ce-foot"><span class="ce-prev">'+prev+'</span><button type="button" class="btn btn-primary ce-save" data-mi="save"'+(busy?' disabled':'')+'>'+(busy?'서버 확인 중…':bad?'종결 저장':'기록 저장')+'</button></div>';
 }
 function paint(fromState){
  const card=root.document.getElementById('sheetcard');if(!card)return;
  const keep=card.querySelector('.ce')?card.scrollTop:0,ta=card.querySelector('textarea[data-mi-in="memo"]');if(ta&&!fromState)S.memo=ta.value;
  const head=card.querySelector('.intro')?card.querySelector('.intro').outerHTML+'<div style="height:12px"></div>':'';
  card.innerHTML='<div class="sheet-grip"></div>'+head+html();card.scrollTop=keep;
 }
 function open(q,i){
  if(!q)return;if(typeof root.inquiryStateM==='function'&&root.inquiryStateM(q)!=='assigned'&&!UUID.test(idOf(q))){if(typeof root.toast==='function')root.toast('담당이 정해진 문의만 결과를 남길 수 있습니다');return;}
  S={q,i:i==null?null:i,res:'',memo:'',purpose:'',date:'',reason:'',touched:false,err:''};busy=false;PROG={};
  root.openSheet(root.intro('var(--blue-50)','var(--blue-dark)',root.IC.phone,'통화 어떻게 됐나요?',h(q.nm||q.site||'')+(q.phone?' · '+h(root.phoneFmt?root.phoneFmt(q.phone):q.phone):'')),'');
  const card=root.document.getElementById('sheetcard');if(card){card.classList.add('ce-card');card._ceMode='inq';}
  paint();wire();
 }
 function wire(){
  const card=root.document.getElementById('sheetcard');if(!card||wired)return;wired=true;
  card.addEventListener('click',e=>{
   const b=e.target.closest('[data-mi]');if(!b||card._ceMode!=='inq'||!S||busy)return;const a=b.dataset.mi,v=b.dataset.v;
   if(a==='res'){pick(v);paint();}
   else if(a==='date'){S.date=v;S.touched=true;S.err='';paint();}
   else if(a==='reason'){S.reason=v;S.err='';paint();}
   else if(a==='mic')mic(card,b);
   else if(a==='save')save(card);
   else if(a==='close'){root.closeSheet();root.render();}
  });
  card.addEventListener('input',e=>{
   const t=e.target.closest('[data-mi-in]');if(!t||card._ceMode!=='inq'||!S)return;const k=t.dataset.miIn;
   if(k==='memo')S.memo=t.value;else if(k==='purpose'){S.purpose=t.value;S.touched=true;}else if(k==='date'){S.date=t.value;S.touched=true;if(/^\d{4}-\d{2}-\d{2}$/.test(t.value))return paint();}
   const pv=card.querySelector('.ce-prev');if(pv&&S.res&&k!=='date'){const pl=planOf();pv.innerHTML=pl.ok?'<b>저장하면</b> '+h(pl.preview):h(pl.error);}
  });
 }
 function mic(card,btn){
  const ta=card.querySelector('textarea[data-mi-in="memo"]'),hint=card.querySelector('.ce-hint'),SR=root.SpeechRecognition||root.webkitSpeechRecognition;if(!ta||!hint)return;
  if(!SR){hint.hidden=false;hint.textContent='이 휴대폰은 음성 입력을 지원하지 않습니다 — 직접 적어 주세요.';return;}
  if(btn._rec){try{btn._rec.stop();}catch(e){}return;}
  const r=new SR();r.lang='ko-KR';r.continuous=true;r.interimResults=true;const base=ta.value?ta.value.replace(/\s+$/,'')+' ':'';let fin='';
  r.onresult=ev=>{let itv='';for(let i=ev.resultIndex;i<ev.results.length;i++){const s=ev.results[i][0].transcript;if(ev.results[i].isFinal)fin+=s;else itv+=s;}ta.value=(base+fin+itv).slice(0,300);S.memo=ta.value;};
  r.onerror=ev=>{hint.hidden=false;hint.textContent='음성 인식이 안 됩니다('+(ev&&ev.error||'')+') — 직접 적어 주세요.';};
  r.onend=()=>{btn._rec=null;btn.textContent='말하기';btn.setAttribute('aria-pressed','false');if(ta.value){hint.hidden=false;hint.textContent='글자로 바꿨습니다 — 고칠 수 있습니다.';}};
  try{r.start();}catch(err){hint.hidden=false;hint.textContent='마이크를 시작할 수 없습니다 — 직접 적어 주세요.';return;}
  btn._rec=r;btn.textContent='그만';btn.setAttribute('aria-pressed','true');hint.hidden=false;hint.textContent='듣는 중… 끝나면 [그만]을 누르세요.';
 }
 /* 첫 접촉이면 단계 진행: 기존 문의 응대 명령(response_progress) 그대로 — 화면 상태 · 대기열은 recordInquiryResponse 와 같다 */
 function progressStatus(q){
  const label='진행됨 — 다음 잡음',at=root.isoNow?root.isoNow():new Date().toISOString();
  q.status='전화응대 완료';q.ps=String(at).slice(0,10)+' · '+q.status;if(q.raw){q.raw.status=q.status;q.raw.responded_at=at;}
  root.pushWrite('inquiry_assign',{inquiry_id:q.key,inquiry_row:q.raw&&q.raw.row||null,from:q.rep,to:q.rep,status:q.status,at,response:label});
  try{root.G.done['k:'+q.key+'|'+new Date().toISOString().slice(0,10)]=label;}catch(e){}
 }
 async function save(card){
  if(busy)return;const ta=card.querySelector('textarea[data-mi-in="memo"]');if(ta)S.memo=ta.value;
  const q=S.q,pl=planOf(),bad=CE.isBadfit(S.res);
  if(bad&&!S.reason){S.err='종결 사유를 골라 주세요';return paint(true);}
  if(!pl.ok){S.err=pl.error;return paint(true);}
  if(bad&&S.reason==='기타'&&!String(S.memo||'').trim()){S.err='기타 사유는 상담 내용에 적어 주세요';return paint(true);}
  const iid=idOf(q);
  if(!ready()){S.err='로그인 상태에서만 저장할 수 있습니다.';return paint(true);}
  if(!UUID.test(iid)){S.err='문의 식별자를 확인하지 못했습니다 — 목록을 새로 불러온 뒤 다시 시도해 주세요.';return paint(true);}
  busy=true;S.err='';paint(true);
  try{
   if(bad){
    const r=await root.Phase1.rpc(RPC,{p:{type:'close',inquiry_id:iid,kind:'bad_fit',reason:S.reason,detail:String(S.memo||'').trim(),attempts:0}});
    if(!r||r.ok!==true)throw Error('서버 확인 응답이 올바르지 않습니다.');
    q.status=r.status||'배드핏';q.close_reason=r.close_reason||('Bad Fit · '+S.reason);if(q.raw){q.raw.status=q.status;}
   }else{
    PROG.rid=PROG.rid||uuid();const at=PROG.at||(PROG.at=new Date().toISOString());
    const sres=SERVER[S.res];
    if(!PROG.logged){
     const r=await root.Phase1.rpc(RPC,{p:{type:'contact_log',inquiry_id:iid,request_id:PROG.rid,channel:'전화',result:sres,contact_result:sres,customer_reaction:'',content:String(CE.showNote(S.res)?S.memo||'':'').slice(0,4000),next_action:String(pl.next.purpose||'').slice(0,500),next_check_date:pl.next.due,occurred_at:at}});
     if(!r||r.ok!==true)throw Error('서버 확인 응답이 올바르지 않습니다.');PROG.logged=true;
    }
    if(CE.meaningful(S.res)&&needsProgress(q)&&!PROG.progressed){progressStatus(q);PROG.progressed=true;}
    if(!PROG.nexted){root.queueInquiryNextSet(iid,pl.next.purpose,pl.next.due);PROG.nexted=true;q.nextActionDate=q.next_action_date=pl.next.due;q.nextActionText=pl.next.purpose;}
    q.lastActivity=at;
   }
   const sI=S.i,res0=S.res,pl0=pl;busy=false;S=null;PROG={};
   try{if(sI!=null&&typeof root.markDone==='function')root.markDone(sI,res0);}catch(e){}
   const rows=bad?[['저장','응대 기록 1건 (실제 연결) · 서버 확인'],['완료','Bad Fit 종결 · 사유 '+pl0.reason],['남음','다음 할 일 없음 — 종결된 문의입니다']]:[['저장',(pl0.attempt?'연락 시도 1건':'응대 기록 1건 (실제 연결)')+' · 서버 확인'],['신규',pl0.next.purpose+' · '+CE.md(pl0.next.due)]];
   const k={저장:'ok',완료:'ok',신규:'new',남음:'left'};
   card.innerHTML='<div class="sheet-grip"></div><div class="ce-done"><b class="ce-dt">'+(bad?'종결했습니다':'저장했습니다')+'</b><small>'+h(q.nm||'')+'</small><ul>'+rows.map(r=>'<li class="'+k[r[0]]+'"><em>'+h(r[0])+'</em><span>'+h(r[1])+'</span></li>').join('')+'</ul><div class="ce-donebtn"><button type="button" class="btn btn-primary" data-mi="close" style="grid-column:1/-1">닫기</button></div></div>';
   try{root.saveLocal&&root.saveLocal();}catch(e){}
  }catch(e){busy=false;S.err=String(e&&e.message||e)+(PROG.logged?' — 응대 기록은 서버에 저장됐습니다. 다시 누르면 남은 것만 이어서 보냅니다.':'');paint(true);}
 }
 /* 예전 결과 창 대신 새 창: 오늘 업무의 문의 통화 결과 · 문의 상세의 연락 결과 */
 const baseFlow=root.callFlow;
 if(typeof baseFlow==='function')root.callFlow=function(i){const q=typeof root.todayInquiry==='function'?root.todayInquiry(i):null;if(q&&enabled())return open(q,i);return baseFlow.apply(this,arguments);};
 function decorate(){
  if(!enabled())return;const G=root.G,s=G&&G.sub;if(!s||s.t!=='inqAssigned')return;
  const scr=root.document.getElementById('scr'),body=scr&&scr.querySelector('.body');if(!body||body.querySelector('.mi-open'))return;
  const q=((root.ADMIN&&root.ADMIN.inquiries)||[]).find(x=>String(x.key)===String(s.key));if(!q)return;
  const btns=[...body.querySelectorAll('button.cchip[onclick*="recordInquiryResponse"]')];if(!btns.length)return;
  const card=btns[0].closest('.card'),sec=card&&card.previousElementSibling;
  const b=root.document.createElement('button');b.type='button';b.className='btn btn-primary mi-open';b.textContent='연락 결과 남기기';b.style.marginTop='8px';
  b.onclick=()=>open(q,null);
  if(card){card.replaceWith(b);if(sec&&sec.classList.contains('sec-h')){const sp=sec.querySelector('span');if(sp)sp.textContent='연결됨 · 회신 받음 · 부재 · 번호 오류 · 배드핏';}}
 }
 root.MobileInquiry=Object.freeze({enabled,open,decorate,state:()=>S,SERVER,BAD_REASONS,needsProgress});
})(window);
