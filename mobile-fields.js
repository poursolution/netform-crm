/* 모바일 단계 정보 저장 — 공사 시기 · 견적 요청 (2026-10-10 대표 승인 · design_handoff_mobile_all 1번 '문의 정보 보완' · 흐름 9번 견적 요청)
   PC 영업건 상세와 같은 서버 함수(crm_deal_stage_fields_update_v1: 현재 단계의 단계 정보 몇 칸만 저장)를 모바일 허용 목록(transport.js)에 넣어 쓴다.
   서버가 로그인 · 담당 · 단계별 허용 칸을 그대로 검사하고, 응답(ok · stage_context)을 확인한 뒤에만 화면 값을 바꾼다 — 실패하면 아무것도 바뀌지 않는다.
   견적 요청 = PC '견적 요청 등록' 화면(deal-frame7 quote)과 같은 칸: quote_request · quote_due(평일 3일) · construction_plan + 다음 업무 '견적 회신 확인 · 견적 예정일'. 도면 · 사진 올리기는 기존 사진 · 자료 올리기를 쓴다. */
(function(root){
 'use strict';
 const RPC='crm_deal_stage_fields_update_v1',PLANS=['올해','내년','그 이후','미정'],QUOTE_DAYS=3;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const kst=n=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+(n||0)*864e5));}catch(e){return new Date(Date.now()+(n||0)*864e5).toISOString().slice(0,10);}};
 const addDays=(k,n)=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+n)).toISOString().slice(0,10):'';};
 const addWeekdays=(k,n)=>{let x=k;for(let i=0;i<n;){x=addDays(x,1);const w=new Date(x+'T00:00:00Z').getUTCDay();if(w!==0&&w!==6)i++;}return x;};
 const dealById=id=>(root.DEALS||[]).find(x=>String(x.id)===String(id));
 const closed=d=>!!(d&&d.outcome);
 const ready=()=>!!(root.Phase1&&typeof root.Phase1.rpc==='function'&&root.Phase1.profile);
 const ctxAll=d=>d&&(d.stage_contexts||d.stageContexts)||{};
 const planOf=d=>{let out='';Object.keys(ctxAll(d)).forEach(k=>{const v=ctxAll(d)[k]&&ctxAll(d)[k].fields&&ctxAll(d)[k].fields.construction_plan;if(!out&&v)out=String(v);});return out;};
 /* 현재 단계의 단계 정보 몇 칸 저장(PC DealDetailV3.stageFields 와 같은 요청 · 같은 응답 확인) */
 async function save(d,fields,reason){
  if(!d)throw Error('영업건을 찾지 못했습니다.');if(closed(d))throw Error('종료된 영업건은 단계 정보를 바꿀 수 없습니다.');
  if(!ready())throw Error('로그인 상태에서만 저장할 수 있습니다.');
  const code=String(d.code||''),P={deal_id:String(d.id),stage_code:code,fields,reason:String(reason||'').trim()||'모바일에서 바로 입력'};
  const r=await root.Phase1.rpc(RPC,{p:P});
  if(!r||r.ok!==true||!r.stage_context)throw Error('서버 확인 응답이 올바르지 않습니다.');
  const ctx=r.stage_context;d.stage_contexts=Object.assign({},d.stage_contexts||{},{[code]:ctx});d.stageContexts=d.stage_contexts;if(r.version!=null)d.version=r.version;
  try{root.saveLocal&&root.saveLocal();}catch(e){}
  return ctx;
 }
 /* ── 견적 요청 시트 ── */
 let Q=null,busy=false;
 const filesOf=d=>{try{return (root.dealAttachmentsM?root.dealAttachmentsM(d):[]).length;}catch(e){return 0;}};
 const mdk=k=>{const m=/^\d{4}-(\d{2})-(\d{2})/.exec(String(k||''));return m?(+m[1])+'.'+(+m[2]):'';};
 function plan(d){
  const due=addWeekdays(kst(0),QUOTE_DAYS),memo=String(Q.memo||'').trim(),files=filesOf(d),pl=Q.plan||'';
  if(!memo)return {ok:false,error:'범위 · 메모를 한 줄 적어 주세요 (예: 옥상 방수 · 3개동 · 부분 보수 여부 확인 필요)'};
  if(!pl)return {ok:false,error:'공사 시기를 골라 주세요'};
  const fields={quote_request:(files?'':'자료 부족 · 가견적 — ')+memo,quote_due:due,construction_plan:pl},next={type:'후속접촉',text:'견적 회신 확인 · 견적 예정일 '+mdk(due),due_at:due};
  return {ok:true,fields,next,due,files,preview:'견적 요청 기록 1건 + 견적 예정일 '+mdk(due)+'('+QUOTE_DAYS+'일 · 평일) 저장 · 다음 업무 "'+next.text+'"'+(files?'':' · 자료가 없어 \'자료 부족 · 가견적\'으로 전달')};
 }
 function html(d){
  const p=plan(d),files=filesOf(d);
  return '<div class="ce"><section><b class="ce-q"><i>1</i>범위 · 메모 <small>방문에서 확인한 것 한 번만</small></b><div class="ce-say"><textarea data-mf-in="memo" rows="3" maxlength="300" placeholder="예) 옥상 방수 · 3개동 · 부분 보수 여부 확인 필요">'+h(Q.memo)+'</textarea></div></section>'
   +'<section><b class="ce-q"><i>2</i>공사 시기</b><div class="ce-chips">'+PLANS.map(v=>'<button type="button" class="ce-chip" data-mf="plan" data-v="'+attr(v)+'" aria-pressed="'+(Q.plan===v)+'">'+h(v)+'</button>').join('')+'</div></section>'
   +'<section><b class="ce-q"><i>3</i>도면 · 현장 사진 <small>'+(files?'올려 둔 자료 '+files+'개':'아직 없음')+'</small></b><p class="ce-sub">'+(files?'올려 둔 자료가 이 견적 요청에 함께 갑니다':'없으면 \'자료 부족 · 가견적\'으로 전달됩니다 — 사진 · 자료는 현장 상세의 [사진]에서 올릴 수 있습니다')+'</p></section>'
   +(Q.err?'<p class="ce-err" role="alert">'+h(Q.err)+'</p>':'')+'</div><div class="ce-foot"><span class="ce-prev">'+(p.ok?'<b>저장하면</b> '+h(p.preview):h(p.error))+'</span><button type="button" class="btn btn-primary ce-save" data-mf="save"'+(busy?' disabled':'')+'>'+(busy?'확인 중…':'견적 요청 등록')+'</button></div>';
 }
 function paint(d){const card=root.document.getElementById('sheetcard');if(!card)return;const keep=card.scrollTop,head=card.querySelector('.intro')?card.querySelector('.intro').outerHTML+'<div style="height:12px"></div>':'';card.innerHTML='<div class="sheet-grip"></div>'+head+html(d);card.scrollTop=keep;}
 function quoteSheet(prefill){
  const d=dealById(root.G&&root.G.deal);if(!d)return;
  if(closed(d)||String(d.code)!=='consulting'){if(typeof root.toast==='function')root.toast('견적 요청은 컨설팅 설계 단계에서만 등록합니다');return;}
  Q={memo:String(prefill||'').slice(0,300),plan:planOf(d)||'',err:''};busy=false;
  root.openSheet(root.intro('var(--blue-50)','var(--blue-dark)',root.IC.chart,'견적 요청 등록',h(d.nm)),'');
  const card=root.document.getElementById('sheetcard');if(card){card.classList.add('ce-card');card._ceMode='mf';card._ceDeal=d.id;}
  paint(d);wire();
 }
 let wired=false;
 function wire(){
  const card=root.document.getElementById('sheetcard');if(!card||wired)return;wired=true;
  card.addEventListener('click',async e=>{
   const b=e.target.closest('[data-mf]');if(!b||card._ceMode!=='mf'||busy)return;const d=dealById(card._ceDeal);if(!d||!Q)return;const a=b.dataset.mf;
   if(a==='plan'){Q.plan=b.dataset.v;Q.err='';paint(d);}
   else if(a==='close'){root.closeSheet();root.render();}
   else if(a==='save'){
    const ta=card.querySelector('textarea[data-mf-in="memo"]');if(ta)Q.memo=ta.value;
    const p=plan(d);if(!p.ok){Q.err=p.error;return paint(d);}
    if(!ready()||typeof root.queueMobileContactOperation!=='function'){Q.err='로그인 상태에서만 저장할 수 있습니다.';return paint(d);}
    busy=true;Q.err='';paint(d);
    try{
     await save(d,p.fields,'모바일 견적 요청 등록');
     /* 다음 업무: 지금 열린 일정이 있으면 같은 업무를 새 날짜로 — 서버가 열린 업무를 하나로 유지(PC 와 같다) */
     const Qu=root.Phase1.queue;let id=Q.nid;if(!id){id=root.queueMobileContactOperation('next_action',{opportunity_id:d.id,type:p.next.type,text:p.next.text,due_at:p.next.due_at});Q.nid=id;}
     await Qu.flush();const row=Qu.list().find(q=>q.request_id===id);
     if(!row||row.status!=='done'||!row.ack||row.ack.ok!==true)throw Error((row&&row.error)||'견적 요청은 저장했지만 다음 업무를 확인하지 못했습니다 — 다시 누르면 같은 요청을 확인합니다.');
     d.nextAction=d.nextActionObj={id:row.ack.next_action_id,opportunity_id:d.id,type:p.next.type,text:p.next.text,due:p.next.due_at,due_at:p.next.due_at,status:'open'};
     busy=false;const q0=Q;Q=null;
     card.innerHTML='<div class="sheet-grip"></div><div class="ce-done"><b class="ce-dt">견적 요청을 등록했습니다</b><small>'+h(d.nm)+'</small><ul><li class="ok"><em>저장</em><span>견적 요청 기록 · 견적 예정일 '+h(mdk(p.due))+'</span></li><li class="new"><em>신규</em><span>'+h(p.next.text)+'</span></li><li class="chg"><em>변경</em><span>공사 시기 → '+h(q0.plan)+'</span></li></ul><div class="ce-donebtn"><button type="button" class="btn btn-primary" data-mf="close" style="grid-column:1/-1">닫기</button></div></div>';
    }catch(err){busy=false;Q.err=String(err&&err.message||err);paint(d);}
   }
  });
  card.addEventListener('input',e=>{const t=e.target.closest('[data-mf-in]');if(!t||card._ceMode!=='mf'||!Q)return;Q.memo=t.value;const d=dealById(card._ceDeal),pv=card.querySelector('.ce-prev');if(d&&pv){const p=plan(d);pv.innerHTML=p.ok?'<b>저장하면</b> '+h(p.preview):h(p.error);}});
 }
 root.MobileFields=Object.freeze({save,quoteSheet,planOf,ready,PLANS,RPC});
})(window);
