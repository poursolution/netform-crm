/* 모바일 견적 — 제출금액 만들기(PC와 같은 계산 모듈 QuoteAmounts + 같은 서버 함수 crm_quote_submit_confirm_v1).
 * 기준금액은 올릴 수 없고 가산(배수 → ㎡당 → 정액)만 입력한다. 확정은 서버가 다시 계산해 일치할 때만 저장한다. */
(function(w){
 'use strict';
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const won=n=>Number(n).toLocaleString('ko-KR')+'원';
 const num=v=>{const x=Number(String(v==null?'':v).replace(/,/g,'').trim());return Number.isFinite(x)?x:NaN;};
 const versions=d=>Array.isArray(d.quote_versions)?d.quote_versions:Array.isArray(d.quoteVersions)?d.quoteVersions:[];
 const done=x=>!!x&&(Number(x.submit_amount)>0||/^제출금액 확정/.test(String(x.reason||'')));
 let busy=false,msg='';
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
  const A=versions(d),last=A[A.length-1];
  const rows=A.slice().reverse().map(v=>'<div style="display:flex;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid #eef0f3;font-size:14px"><b>V'+esc(v.version_no)+'</b><span style="color:#6b7280">기준 '+won(w.QuoteAmounts?w.QuoteAmounts.baseOf(v):v.amount)+'</span><b style="color:'+(done(v)?'#15171c':'#b42318')+'">'+(done(v)?won(v.submit_amount||v.amount):'제출금액 미확정')+'</b></div>').join('');
  let body;
  if(!last)body='<p style="font-size:14px;line-height:1.6;color:#374151">등록된 견적이 없습니다. 견적팀이 적산 기준금액을 올리면 여기서 제출금액을 만들 수 있습니다.</p>';
  else if(done(last))body='<p style="font-size:14px;line-height:1.6;color:#374151">V'+esc(last.version_no)+' 제출금액 <b>'+won(last.submit_amount||last.amount)+'</b>(VAT 별도)이 확정되어 있습니다. 새 기준금액 수정본이 올라오면 다시 가산할 수 있습니다.</p>';
  else{
   const f=(k,l,ph,m)=>'<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#374151">'+l+'<input data-ql="'+k+'" inputmode="decimal" placeholder="'+ph+'" style="height:46px;border:1px solid #d9dde4;border-radius:10px;padding:0 12px;font-size:16px"></label>';
   body='<div style="background:#fff;border:1px solid #e8eaef;border-radius:14px;padding:12px 13px;font-size:14px">V'+esc(last.version_no)+' 적산 기준금액 <b>'+won(w.QuoteAmounts?w.QuoteAmounts.baseOf(last):last.amount)+'</b><div style="font-size:12.5px;color:#6b7280;margin-top:4px">기준금액은 고칠 수 없습니다. 배수 → ㎡당 → 정액 순서로 가산합니다.</div></div>'
    +f('mul','배수','예: 1.52')+f('ar','㎡당 공과잡비(원)','예: 17000')+f('are','적용 면적(㎡)','예: 1000')+f('fl','정액 더하기(원)','예: 5000000')
    +'<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#374151">가산 메모(선택)<input data-ql="note" maxlength="200" style="height:46px;border:1px solid #d9dde4;border-radius:10px;padding:0 12px;font-size:16px"></label>'
    +'<div data-ql="preview" style="background:#f5f6f8;border-radius:12px;padding:12px;font-size:14px;line-height:1.55">가산을 입력하면 제출금액이 계산됩니다. 입력이 없으면 기준금액 그대로 제출합니다.</div>'
    +'<span data-ql-act="confirm" role="button" tabindex="0" style="min-height:48px;border-radius:12px;background:#15171c;color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center">제출금액 확정</span>';
  }
  return '<div class="approved-quote" data-quote-live style="display:flex;flex-direction:column;background:#f5f6f8"><div style="height:56px;flex:none;background:#fff;display:flex;align-items:center;gap:8px;padding:0 8px;border-bottom:1px solid #eef0f3"><span data-gs="back" role="button" tabindex="0" aria-label="뒤로" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px">‹</span><b style="font-size:17px">제출금액 만들기</b></div>'
   +'<div style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px"><div style="font-size:15px;font-weight:700">'+esc(d.nm)+'</div>'+(msg?'<div role="status" style="font-size:13.5px;color:#b42318">'+esc(msg)+'</div>':'')+body+(rows?'<div><div style="font-size:13px;color:#6b7280;margin-bottom:4px">견적 버전</div>'+rows+'</div>':'')+'</div></div>';
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
 w.MobileQuoteLive=Object.freeze({render,preview,confirm,reset(){msg='';busy=false;}});
})(window);
