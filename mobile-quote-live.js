/* 모바일 견적 — 제출금액 만들기(PC와 같은 계산 모듈 QuoteAmounts + 같은 서버 함수 crm_quote_submit_confirm_v1).
 * 기준금액은 올릴 수 없고 가산(배수 → ㎡당 → 정액)만 입력한다. 확정은 서버가 다시 계산해 일치할 때만 저장한다. */
(function(w){
 'use strict';
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const won=n=>Number(n).toLocaleString('ko-KR')+'원';
 const num=v=>{const x=Number(String(v==null?'':v).replace(/,/g,'').trim());return Number.isFinite(x)?x:NaN;};
 const versions=d=>Array.isArray(d.quote_versions)?d.quote_versions:Array.isArray(d.quoteVersions)?d.quoteVersions:[];
 const done=x=>!!x&&(Number(x.submit_amount)>0||/^제출금액 확정/.test(String(x.reason||'')));
 let busy=false,msg='',mode='';
 function items(root){
  const q=k=>root.querySelector('[data-ql="'+k+'"]'),out=[];
  const mul=num(q('mul')?.value),ar=num(q('ar')?.value),are=num(q('are')?.value),fl=num(q('fl')?.value);
  if(q('mul')?.value.trim())out.push({type:'multiplier',value:mul});
  if(q('ar')?.value.trim()||q('are')?.value.trim())out.push({type:'area',value:ar,area:are});
  if(q('fl')?.value.trim())out.push({type:'flat',value:fl});
  return out;
 }
 function calc(d,root){
  const A=versions(d),last=A[A.length-1];if(!last||!w.QuoteAmounts)return null;
  const base=w.QuoteAmounts.baseOf(last),its=items(root);
  return {last,base,its,r:w.QuoteAmounts.markupMulti(base,its)};
 }
 function render(d){
  if(mode==='req')return renderReq(d);
  if(mode==='send')return renderSend(d);
  const A=versions(d),last=A[A.length-1];
  /* 견적 진행 · 도착 확인: 요청(단계 입력 quote_request · quote_due) → 견적팀 작업 → 기준금액 도착(견적 버전) → 제출금액 확정 */
  const F=ctxOf(d),due=String(F.quote_due||''),dd=/^\d{4}-\d{2}-\d{2}$/.test(due)?Math.round((Date.parse(due+'T00:00:00Z')-Date.parse(kst(0)+'T00:00:00Z'))/864e5):null;
  const stTxt=last?(done(last)?['제출금액 확정 · V'+esc(last.version_no),'#1f7a4d']:['견적 도착 · V'+esc(last.version_no)+' — 제출금액을 만들 차례','#2a52b8']):F.quote_request?(dd!==null&&dd<0?['예정일 '+(-dd)+'일 지남 · 아직 도착 전 — 견적팀에 확인','#b42318']:['견적팀 작업 중 — '+(dd===0?'오늘':dd!==null?dd+'일 뒤':'예정일 미정')+' 도착 예정','#6b7280']):null;
  const prog=F.quote_request||last?'<div style="background:#fff;border:1px solid #e8eaef;border-radius:14px;padding:12px 13px;display:flex;flex-direction:column;gap:6px;font-size:13.5px"><b style="font-size:12px;color:#6b7280">견적 진행</b>'
   +(F.quote_request?'<div style="display:flex;gap:8px"><span style="flex:none;color:#6b7280">요청</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(F.quote_request)+'</span></div>':'')
   +(due?'<div style="display:flex;gap:8px"><span style="flex:none;color:#6b7280">예정일</span><b style="color:'+(dd!==null&&dd<0&&!last?'#b42318':'#15171c')+'">'+esc(due.slice(5).replace('-','.'))+(dd===null?'':dd<0?' · '+(-dd)+'일 지남':dd===0?' · 오늘':' · D-'+dd)+'</b></div>':'')
   +(stTxt?'<b style="color:'+stTxt[1]+'">'+stTxt[0]+'</b>':'')+'</div>'
   :(d.code==='consulting'?'<span data-ql-act="toreq" role="button" tabindex="0" style="min-height:48px;border-radius:12px;border:1px solid #d9dde4;background:#fff;color:#15171c;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center">견적 요청 등록</span>':'');
  const rows=A.slice().reverse().map(v=>'<div style="display:flex;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid #eef0f3;font-size:14px"><b>V'+esc(v.version_no)+'</b><span style="color:#6b7280">기준 '+won(w.QuoteAmounts?w.QuoteAmounts.baseOf(v):v.amount)+'</span><b style="color:'+(done(v)?'#15171c':'#b42318')+'">'+(done(v)?won(v.submit_amount||v.amount):'제출금액 미확정')+'</b></div>').join('');
  let body;
  if(!last)body='<p style="font-size:14px;line-height:1.6;color:#374151">등록된 견적이 없습니다. 견적팀이 적산 기준금액을 올리면 여기서 제출금액을 만들 수 있습니다.</p>';
  else if(done(last))body='<p style="font-size:14px;line-height:1.6;color:#374151">V'+esc(last.version_no)+' 제출금액 <b>'+won(last.submit_amount||last.amount)+'</b>(VAT 별도)이 확정되어 있습니다. 새 기준금액 수정본이 올라오면 다시 가산할 수 있습니다.</p><span data-ql-act="tosend" role="button" tabindex="0" style="min-height:48px;border-radius:12px;background:#15171c;color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center">고객 발송 기록</span>';
  else{
   const f=(k,l,ph,m)=>'<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#374151">'+l+'<input data-ql="'+k+'" inputmode="decimal" placeholder="'+ph+'" style="height:46px;border:1px solid #d9dde4;border-radius:10px;padding:0 12px;font-size:16px"></label>';
   body='<div style="background:#fff;border:1px solid #e8eaef;border-radius:14px;padding:12px 13px;font-size:14px">V'+esc(last.version_no)+' 적산 기준금액 <b>'+won(w.QuoteAmounts?w.QuoteAmounts.baseOf(last):last.amount)+'</b><div style="font-size:12.5px;color:#6b7280;margin-top:4px">기준금액은 고칠 수 없습니다. 배수 → ㎡당 → 정액 순서로 가산합니다.</div></div>'
    +f('mul','배수','예: 1.52')+f('ar','㎡당 공과잡비(원)','예: 17000')+f('are','적용 면적(㎡)','예: 1000')+f('fl','정액 더하기(원)','예: 5000000')
    +'<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#374151">가산 메모(선택)<input data-ql="note" maxlength="200" style="height:46px;border:1px solid #d9dde4;border-radius:10px;padding:0 12px;font-size:16px"></label>'
    +'<div data-ql="preview" style="background:#f5f6f8;border-radius:12px;padding:12px;font-size:14px;line-height:1.55">가산을 입력하면 제출금액이 계산됩니다. 입력이 없으면 기준금액 그대로 제출합니다.</div>'
    +'<span data-ql-act="confirm" role="button" tabindex="0" style="min-height:48px;border-radius:12px;background:#15171c;color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center">제출금액 확정</span>';
  }
  return '<div class="approved-quote" data-quote-live style="display:flex;flex-direction:column;background:#f5f6f8"><div style="height:56px;flex:none;background:#fff;display:flex;align-items:center;gap:8px;padding:0 8px;border-bottom:1px solid #eef0f3"><span data-gs="back" role="button" tabindex="0" aria-label="뒤로" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px">‹</span><b style="font-size:17px">제출금액 만들기</b></div>'
   +'<div style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px"><div style="font-size:15px;font-weight:700">'+esc(d.nm)+'</div>'+(msg?'<div role="status" style="font-size:13.5px;color:#b42318">'+esc(msg)+'</div>':'')+prog+body+(rows?'<div><div style="font-size:13px;color:#6b7280;margin-bottom:4px">견적 버전</div>'+rows+'</div>':'')+'</div></div>';
 }
 function preview(root,d){
  const el=root.querySelector('[data-ql="preview"]');if(!el)return;
  const c=calc(d,root);if(!c)return;
  if(c.r.error&&c.its.length){el.innerHTML='<span style="color:#b42318">'+esc(c.r.error)+'</span>';return;}
  el.innerHTML='<b style="font-size:16px">'+won(c.r.submit)+'</b> <span style="color:#6b7280">고객 제출금액(VAT 별도, 10만원 아래 절삭)</span><div style="font-size:12.5px;color:#6b7280;margin-top:4px">내부 확인용 · 가산액 '+won(c.r.added)+' ('+c.r.pct+'%) — 고객 서류에는 나오지 않습니다</div>';
 }
 async function confirm(d,root,after){
  if(busy)return;
  const c=calc(d,root);
  if(!c||c.r.error||!(c.r.submit>0)){msg=c&&c.r.error||'제출금액을 계산할 수 없습니다.';return after();}
  if(!w.Phase1||typeof w.Phase1.rpc!=='function'){msg='서버에 연결된 상태에서만 확정할 수 있습니다.';return after();}
  busy=true;
  const payload={deal_id:String(d.id),version_no:Number(c.last.version_no)||undefined,items:c.its.map(x=>x.type==='area'?{type:'area',value:x.value,area:x.area}:{type:x.type,value:x.value}),display:'line',note:(root.querySelector('[data-ql="note"]')?.value||'').trim(),expected_submit:c.r.submit};
  try{
   const o=await w.Phase1.rpc('crm_quote_submit_confirm_v1',{p:payload});
   if(!o||o.ok!==true)throw Error('서버 응답을 확인하지 못했습니다');
   const row={version_no:o.version_no,amount:o.amount,base_amount:o.base_amount,submit_amount:o.submit_amount,markup_type:o.markup_type,markup_items:o.markup_items,reason:o.reason,created_at:o.server_at||new Date().toISOString()};
   d.quote_versions=versions(d).concat([row]);d.quote_amount=o.amount;msg='제출금액 '+won(o.amount)+'을 확정했습니다. (V'+o.version_no+')';
  }catch(e){msg=String(e&&e.message||e);}
  busy=false;after();
 }
 const shell=(d,inner)=>'<div class="approved-quote" data-quote-live style="display:flex;flex-direction:column;background:#f5f6f8"><div style="height:56px;flex:none;background:#fff;display:flex;align-items:center;gap:8px;padding:0 8px;border-bottom:1px solid #eef0f3"><span data-gs="back" role="button" tabindex="0" aria-label="뒤로" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px">‹</span><b style="font-size:17px">'+(mode==='send'?'고객 발송 기록':'견적 요청 등록')+'</b></div><div style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px"><div style="font-size:15px;font-weight:700">'+esc(d.nm)+'</div>'+(msg?'<div role="status" style="font-size:13.5px;color:#b42318">'+esc(msg)+'</div>':'')+inner+'</div></div>';
 const ctxOf=d=>((d.stage_contexts||{}).consulting||{}).fields||{};
 const kst=(add)=>new Date(Date.now()+9*36e5+add*864e5).toISOString().slice(0,10);
 function renderReq(d){
  const f=ctxOf(d),Q=Number(w.PipelineJudge?.rules?.().quote)||3;
  const inp='height:46px;border:1px solid #d9dde4;border-radius:10px;padding:0 12px;font-size:16px;background:#fff';
  return shell(d,(f.quote_request?'<div style="background:#fff;border:1px solid #e8eaef;border-radius:14px;padding:12px 13px;font-size:14px;line-height:1.55">이미 등록된 요청: '+esc(f.quote_request)+(f.quote_due?'<br>견적 예정일 '+esc(f.quote_due):'')+'</div>':'')
   +'<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#374151">요청 범위 · 메모(필수)<textarea data-ql="req" rows="4" maxlength="500" placeholder="예: 옥상 방수 1,200㎡ · 우레탄 도막 · 11월 착공 희망" style="border:1px solid #d9dde4;border-radius:10px;padding:10px 12px;font-size:16px;background:#fff">'+esc(f.quote_request||'')+'</textarea></label>'
   +'<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#374151">견적 예정일 (기본: 오늘 + '+Q+'일)<input data-ql="due" type="date" value="'+esc(f.quote_due||kst(Q))+'" style="'+inp+'"></label>'
   +'<div style="font-size:12.5px;color:#6b7280">등록하면 견적 요청 기록과 견적 예정일이 저장되고, 견적팀이 기준금액을 올리면 제출금액을 만들 수 있습니다.</div>'
   +'<span data-ql-act="req" role="button" tabindex="0" style="min-height:48px;border-radius:12px;background:#15171c;color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center">견적 요청 등록</span>');
 }
 function reqPreview(){}
 async function submitReq(d,root,after){
  if(busy)return;
  const req=(root.querySelector('[data-ql="req"]')?.value||'').trim(),due=root.querySelector('[data-ql="due"]')?.value||'';
  if(req.length<2){msg='요청 범위·메모를 입력해 주세요.';return after();}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||due<kst(0)){msg='견적 예정일은 오늘 이후 날짜로 입력해 주세요.';return after();}
  if(d.code!=='consulting'){msg='컨설팅 단계에서만 견적 요청을 등록할 수 있습니다.';return after();}
  if(!w.Phase1||typeof w.Phase1.rpc!=='function'){msg='서버에 연결된 상태에서만 등록할 수 있습니다.';return after();}
  busy=true;
  try{
   const r=await w.Phase1.rpc('crm_deal_stage_fields_update_v1',{p:{deal_id:String(d.id),stage_code:'consulting',fields:{quote_request:req,quote_due:due},reason:'모바일 견적 요청 등록'}});
   if(!r||r.ok!==true||!r.stage_context)throw Error('서버 확인 응답이 올바르지 않습니다.');
   d.stage_contexts=Object.assign({},d.stage_contexts||{},{consulting:r.stage_context});d.stageContexts=d.stage_contexts;
   if(r.version!=null)d.version=r.version;
   msg='견적 요청을 등록했습니다. 견적 예정일 '+due;
  }catch(e){msg=String(e&&e.message||e);}
  busy=false;after();
 } function renderSend(d){
  const A=versions(d),last=A[A.length-1],inp='height:46px;border:1px solid #d9dde4;border-radius:10px;padding:0 12px;font-size:16px;background:#fff';
  const lab=(l,h)=>'<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#374151">'+l+h+'</label>';
  return shell(d,'<div style="background:#fff;border:1px solid #e8eaef;border-radius:14px;padding:12px 13px;font-size:14px;line-height:1.55">'+(last?'V'+esc(last.version_no)+' 제출금액 <b>'+won(last.submit_amount||last.amount)+'</b>(VAT 별도)':'등록된 견적 없음')+'</div>'
   +lab('발송일','<input data-ql="sdate" type="date" value="'+kst(0)+'" max="'+kst(0)+'" style="'+inp+'">')
   +lab('받는 사람(필수)','<input data-ql="sto" maxlength="60" placeholder="예: 관리소장 김OO" style="'+inp+'">')
   +lab('보낸 방법','<select data-ql="sway" style="'+inp+'"><option>이메일</option><option>카카오톡</option><option>문자</option><option>직접 전달</option></select>')
   +lab('다음 확인일 (기본 +3일)','<input data-ql="snext" type="date" value="'+kst(3)+'" style="'+inp+'">')
   +'<div style="font-size:12.5px;color:#6b7280">저장하면 발송 기록과 다음 확인 연락 일정이 남습니다. 단계를 발송 완료로 옮기는 것은 상세의 [단계 변경]에서 합니다.</div>'
   +'<span data-ql-act="send" role="button" tabindex="0" style="min-height:48px;border-radius:12px;background:#15171c;color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center">발송 기록 저장</span>');
 }
 function submitSend(d,root,after){
  if(busy)return;
  const q=k=>root.querySelector('[data-ql="'+k+'"]')?.value||'',to=q('sto').trim(),sd=q('sdate'),nx=q('snext'),way=q('sway');
  if(to.length<2){msg='받는 사람을 입력해 주세요.';return after();}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(sd)||sd>kst(0)){msg='발송일은 오늘 이전 날짜로 입력해 주세요.';return after();}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(nx)||nx<sd||nx<kst(0)){msg='다음 확인일은 오늘 이후로 입력해 주세요.';return after();}
  if(typeof w.queueMobileContactOperation!=='function'){msg='이 기기에서는 기록을 저장할 수 없습니다.';return after();}
  try{
   const last=versions(d)[versions(d).length-1],cur=d.nextAction&&d.nextAction.status==='open'?d.nextAction:null;
   w.queueMobileContactOperation('activity',{opportunity_id:String(d.id),intent:'standalone',type:'견적발송',note:(last?'견적 V'+last.version_no+' ':'')+'발송 · '+way+' · 받는 사람 '+to+' · 발송일 '+sd,occurred_at:new Date().toISOString(),meaningful_contact:false});
   w.queueMobileContactOperation('next_action',{opportunity_id:String(d.id),intent:'standalone',type:'전화',text:'견적 발송 후 확인 연락',due_at:nx});
   msg='발송 기록을 저장했습니다(서버 반영 대기 중일 수 있음). 다음 확인 '+nx;
  }catch(e){msg='저장하지 못했습니다: '+String(e&&e.message||e);}
  after();
 } w.MobileQuoteLive=Object.freeze({render,preview,confirm,reset(m){msg='';busy=false;mode=m||'';},reqPreview,submitReq,submitSend,toSend(){mode='send';msg='';},toReq(){mode='req';msg='';}});
})(window);
