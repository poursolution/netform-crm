(function(root){
 'use strict';
 const D=root.ContractSalesData,h=v=>root.esc(String(v??''));
 /* 2026-09-25 캡처 지적: 원 단위 전체 자릿수가 카드에서 줄바꿈 — 억/만 축약 + 정확값은 툴팁 */
 const amount=n=>{n=Number(n)||0;const s=n<0?'-':'',v=Math.abs(n);
  if(v>=1e8)return s+(Math.round(v/1e6)/100).toLocaleString('ko-KR')+'억';
  if(v>=1e4)return s+Math.round(v/1e4).toLocaleString('ko-KR')+'만원';
  return s+v.toLocaleString('ko-KR')+'원';};
 const amountFull=n=>Number(n).toLocaleString('ko-KR')+'원';
 let dialog=null,focus=null;
 function filters(extra={}){return Object.assign({year:root.G.year,quarter:Object.hasOwn(extra,'month')?0:root.G.quarter||0,brand:root.G.brand,owner:root.G.rep},extra)}
 function html(f,compact){
  const s=D.summarize(f),period=(f.from?f.from+' ~ '+f.to:(f.year||'전체')+'년 '+(f.month?f.month+'월':f.quarter?f.quarter+'분기':'전체 기간'));
  const title='<header><div><h3>계약실적</h3><p>계약 체결일 기준 · 변경·취소는 발생일 반영</p><small>'+h(period)+' · '+h(f.owner||'전체')+' · CRM 영업실적</small></div><button type="button" data-contract-refresh>새로고침</button></header>';
  if(!s)return '<section class="contract-sales-panel">'+title+'<p role="status">'+(D.state().status==='loading'?'계약 이력을 불러오는 중입니다.':'계약 원장을 확인하지 못했습니다. 실적 금액은 확인 후 표시합니다.')+'</p></section>';
  /* 브리핑·리포트는 합계 한 줄만 — 담당자별·근거 상세 표는 성과 분석에서 확인 (2026-09-24). */
  if(compact)return '<section class="contract-sales-panel contract-sales-compact">'+title+'<div class="contract-sales-totals">'+[['신규 계약',s.newAmount],['변경 증감',s.amendmentAmount],['계약 취소',s.cancellationAmount],['순 계약실적',s.netAmount]].map(([label,n])=>'<div><span>'+label+'</span><strong title="'+amountFull(n)+'">'+amount(n)+'</strong></div>').join('')+'</div><p>신규 계약 '+s.count+'건 · 계약 체결일 기준 · 담당자별·근거 상세는 성과 분석에서 확인합니다.</p></section>';
  return '<section class="contract-sales-panel">'+title+'<div class="contract-sales-totals">'+[['신규 계약',s.newAmount],['변경 증감',s.amendmentAmount],['계약 취소',s.cancellationAmount],['순 계약실적',s.netAmount]].map(([label,n])=>'<div><span>'+label+'</span><strong title="'+amountFull(n)+'">'+amount(n)+'</strong></div>').join('')+'</div><p>신규 계약 '+s.count+'건 · 최초 계약과 조정 이력을 합산합니다. 과거 미확인 계약은 검토 후 반영합니다.</p><div class="contract-sales-scroll"><table><thead><tr><th>실적 귀속 담당자</th><th>계약건수</th><th>신규 계약</th><th>변경 증감</th><th>계약 취소</th><th>순 계약실적</th></tr></thead><tbody>'+s.rows.map(r=>'<tr><th>'+h(r.name||r.sales_owner)+'</th><td>'+r.count+'</td><td>'+amount(r.newAmount)+'</td><td>'+amount(r.amendmentAmount)+'</td><td>'+amount(r.cancellationAmount)+'</td><td>'+amount(r.netAmount)+'</td></tr>').join('')+'</tbody></table></div><section class="contract-sales-evidence"><strong>계약·조정 근거 '+s.events.length+'건</strong><div class="contract-sales-scroll"><table><thead><tr><th>발생일</th><th>구분</th><th>귀속 담당자</th><th>증감액</th><th>사유</th></tr></thead><tbody>'+(s.events.map(e=>'<tr><td>'+h(e.effective_date)+'</td><td>'+({signed:'계약 체결',amended:'변경 계약',cancelled:'계약 취소'}[e.kind])+'</td><td>'+h(e.sales_owner_name)+'</td><td>'+amount(e.amount_delta)+'</td><td>'+h(e.reason)+'</td></tr>').join('')||'<tr><td colspan="5">아직 기록된 계약·조정 근거가 없습니다.</td></tr>')+'</tbody></table></div></section></section>';
 }
 function mount(host,f,compact){if(!host)return;host.querySelector(':scope > .contract-sales-host')?.remove();const box=document.createElement('div');box.className='contract-sales-host';box.innerHTML=html(f,compact);host.prepend(box);box.querySelector('[data-contract-refresh]').onclick=()=>D.refresh();if(D.state().status==='idle')D.refresh()}
 function close(){dialog?.remove();dialog=null;if(focus?.isConnected)focus.focus();focus=null}
 function editor(deal){
  close();focus=document.activeElement;
  if(D.state().status!=='ready'){
   const waiting=document.createElement('div');waiting.className='contract-sales-shade';dialog=waiting;
   waiting.innerHTML='<section class="contract-sales-dialog" role="dialog" aria-modal="true" aria-labelledby="contract-sales-loading"><header><h2 id="contract-sales-loading">계약실적 확인</h2><button type="button" data-close>닫기</button></header><p role="status">기존 계약 이력을 확인합니다.</p><button type="button" data-retry>다시 조회</button></section>';
   document.body.append(waiting);waiting.querySelector('[data-close]').onclick=close;
   const retry=waiting.querySelector('[data-retry]');let loading=false;
   const load=async()=>{if(loading)return;loading=true;retry.disabled=true;waiting.querySelector('[role="status"]').textContent='계약 이력을 불러오는 중입니다.';try{await D.refresh();if(dialog!==waiting)return;if(D.state().status==='ready'){const original=focus;editor(deal);focus=original;}else waiting.querySelector('[role="status"]').textContent='계약 원장을 확인하지 못했습니다. 다시 조회해 주세요.';}finally{loading=false;retry.disabled=false;}};
   retry.onclick=load;waiting.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const buttons=[...waiting.querySelectorAll('button')].filter(b=>!b.disabled),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};waiting.querySelector('[data-close]').focus();load();return;
  }
  const id=String(root.dealKey(deal)),row=D.state().items.find(r=>r.deal_id===id);
  const shade=document.createElement('div');shade.className='contract-sales-shade';dialog=shade;
  shade.innerHTML='<form class="contract-sales-dialog" role="dialog" aria-modal="true" aria-labelledby="contract-sales-title"><header><h2 id="contract-sales-title">계약실적 기록</h2><button type="button" data-close>닫기</button></header><p>'+h(deal.site)+' · 실적 귀속 '+h(row?.sales_owner_name||deal.assignee)+'</p><p>계약 당시 담당자가 위 담당자와 일치하는지 확인하세요. 과거 담당자가 다른 계약은 검토 후 이관해야 합니다.</p><label>기록 구분<select name="kind">'+(row?'<option value="amended">변경 계약</option><option value="cancelled">계약 취소</option>':'<option value="signed">계약 체결 완료</option>')+'</select></label><label>발생일<input name="date" type="date" required></label><label data-amount>계약금액 또는 변경 증감액(원)<input name="amount" type="number" step="1" required></label><label>계약 확인 근거·변경 사유<textarea name="reason" required maxlength="8000"></textarea></label><label><input name="confirmed" type="checkbox" required> 계약 체결 또는 변경·취소 사실과 실적 귀속 담당자를 확인했습니다.</label><p role="alert"></p><button type="submit">기록 저장</button></form>';
  document.body.append(shade);const form=shade.querySelector('form');form.querySelector('[data-close]').onclick=close;
  form.elements.kind.onchange=()=>{const cancel=form.elements.kind.value==='cancelled';form.querySelector('[data-amount]').hidden=cancel;form.elements.amount.required=!cancel};
  let request=null,busy=false;
  form.oninput=()=>{if(!busy)request=null};
  form.onsubmit=async e=>{
   e.preventDefault();if(busy)return;
   if(D.state().status!=='ready'){form.querySelector('[role="alert"]').textContent='계약 원장을 먼저 새로고침해 주세요.';return}
   request=request||{deal_id:id,request_id:crypto.randomUUID(),kind:form.elements.kind.value,effective_date:form.elements.date.value,expected_version:row?.version||0,reason:form.elements.reason.value.trim(),...(form.elements.kind.value==='cancelled'?{}:{amount_delta:Number(form.elements.amount.value)})};
   busy=true;form.querySelectorAll('input,select,textarea,button').forEach(x=>x.disabled=true);
   try{await D.write(request);close();root.paint()}
   catch(err){form.querySelector('[role="alert"]').textContent=String(err.message||'저장 결과를 확인하지 못했습니다.');}
   finally{busy=false;form.querySelectorAll('input,select,textarea,button').forEach(x=>x.disabled=false)}
  };
  shade.onkeydown=e=>{if(e.key==='Escape'&&!busy)close();if(e.key==='Tab'){const nodes=[...form.querySelectorAll('input,select,textarea,button')].filter(x=>!x.disabled&&x.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};form.querySelector('[data-close]').focus();
 }
 function detail(){
  if(root.CUR_DETAIL?.kind!=='deal')return;const host=document.getElementById('dv-body');if(!host)return;
  host.querySelector('[data-contract-edit]')?.remove();const b=document.createElement('button');b.type='button';b.dataset.contractEdit='';b.className='dact';b.textContent='계약실적 · 변경·취소 이력';b.onclick=()=>editor(root.CUR_DETAIL.item);host.prepend(b);
 }
 const oldDetail=root.dccDecorateDetail;if(oldDetail)root.dccDecorateDetail=function(){const r=oldDetail.apply(this,arguments);detail();return r};
 const oldPaint=root.paint;root.paint=function(){const r=oldPaint.apply(this,arguments);const page=root.G.page;
  /* 분석 3화면(대시보드·컨트롤타워·성과 분석)에는 상세 원장 패널을 붙이지 않는다 —
     매출 근거는 각 화면의 클릭 팝업으로, 합계는 리포트·브리핑의 컴팩트 패널로 (2026-09-24). */
  /* 리포트에도 계약실적 패널·수치 숨김 오버레이를 붙이지 않는다 (2026-09-24 대표 지시) — 리포트 자체 수치는 원장 동일 계산 */
  /* 주간 브리핑에는 계약실적 패널을 붙이지 않는다 (2026-09-24 대표 지시) — 매출 수치는 브리핑 판정 문장·성과 분석에서 */
  return r;
 };
 function distinguishCompletion(host){
  if(!host)return;
  const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);let n;
  while((n=walker.nextNode())){if(n.parentElement.closest('.contract-sales-host,script,style'))continue;n.nodeValue=n.nodeValue.replace(/수주금액/g,'준공 처리금액').replace(/누적 수주|이번 달 수주|지난주 수주 결과/g,'준공 처리 결과');}
 }
 const oldRep=root.repManagerRenderDrawer;
 if(oldRep)root.repManagerRenderDrawer=function(){const r=oldRep.apply(this,arguments),row=root.REP_MANAGER_ROWS?.[root.REP_MANAGER_DRAWER_INDEX];if(row)mount(document.getElementById('perfDrawerBody'),filters({owner:row.nm||row.name}),true);return r};
 root.addEventListener('contract-sales:changed',()=>{if(root.B&&root.ME)root.paint()});
 root.addEventListener('phase1:identity-cleared',()=>{close();document.querySelectorAll('.contract-sales-host').forEach(n=>n.remove())});
 /* 기술자문 → 계약실적 반영 (2026-09-25 대표 승인 · 레거시 문서는 금액·계약일만 채우면 반영)
    현장·담당·문서 연결·중복 방지는 자동. 임의 추정 금지 — 금액·날짜는 계약서를 보고 확정한다. */
 async function advisorySync(){
  close();focus=document.activeElement;
  const shade=document.createElement('div');shade.className='contract-sales-shade';dialog=shade;
  shade.innerHTML='<section class="contract-sales-dialog advisory-sync" role="dialog" aria-modal="true" aria-labelledby="adv-sync-title"><header><h2 id="adv-sync-title">기술자문 → 계약실적 반영</h2><button type="button" data-close>닫기</button></header><p role="status">미반영 계약을 조회하는 중…</p><div class="adv-sync-body"></div></section>';
  document.body.append(shade);
  shade.querySelector('[data-close]').onclick=close;
  shade.onkeydown=e=>{if(e.key==='Escape')close()};
  const status=shade.querySelector('[role="status"]'),body=shade.querySelector('.adv-sync-body');
  let items=[];
  try{
   const res=await root.SB.rpc('crm_advisory_ledger_pending_v1',{});
   if(res.error||res.data?.ok!==true)throw new Error(res.error?.message||'조회 실패');
   items=res.data.items||[];
  }catch(e){status.textContent='조회하지 못했습니다: '+String(e.message||e);return;}
  if(!items.length){status.textContent='미반영 기술자문 계약이 없습니다. 모두 원장에 반영되어 있습니다.';return;}
  const ready=items.filter(x=>x.deal_id);
  status.textContent=ready.length
     ?('미반영 '+items.length+'건 — 낙찰금액(VAT 별도)·낙찰확정일을 확인해 건별로 반영합니다. 반영된 건은 다시 나타나지 않습니다(문서ID 기준).')
     :('미반영 '+items.length+'건 — 모두 CRM 영업건 연결이 없어 여기서는 반영하지 않습니다. 기술자문 실적은 낙찰 기반 실적 구조(원천 브랜드·낙찰금액 VAT 별도·낙찰확정일, 구축 중)에서 집계됩니다.');
  body.innerHTML=items.map((x,i)=>{
   const mapped=!!x.deal_id;
   return '<div class="adv-sync-row'+(mapped?'':' hold')+'" data-i="'+i+'">'
    +'<b>'+h(x.site_name||'현장 미상')+'</b>'
    +'<span>'+(x.source_manager?'원본 담당 '+h(x.source_manager)+' · ':'')+(x.document_url?'<a href="'+h(x.document_url)+'" target="_blank" rel="noopener noreferrer">계약서 보기 ↗</a>':'계약서 링크 없음')+'</span>'
    +(mapped
      ?'<div class="adv-sync-form"><label>낙찰금액 · VAT 별도(원)<input type="number" step="1" min="1" data-amt value="'+(x.amount??'')+'"></label><label>낙찰확정일<input type="date" data-date value="'+h(String(x.effective_date||'').slice(0,10))+'"></label><button type="button" data-apply-one>'+(x.has_row?'증감 반영':'계약 반영')+'</button></div>'
      :'<em>'+(x.deal_count===0?'연결된 CRM 영업건 없음 — 기술자문 낙찰 실적 구조(구축 중)에서 집계됩니다.':'현장에 영업건 '+x.deal_count+'건 — 귀속 영업건을 특정할 수 없어 보류합니다.')+'</em>')
    +'<p class="adv-sync-msg" role="status"></p></div>';
  }).join('');
  body.querySelectorAll('[data-apply-one]').forEach(btn=>{btn.onclick=async()=>{
   const row=btn.closest('.adv-sync-row'),x=items[Number(row.dataset.i)];
   const amt=Number(row.querySelector('[data-amt]').value),date=row.querySelector('[data-date]').value;
   const msg=row.querySelector('.adv-sync-msg');
   if(!Number.isSafeInteger(amt)||amt<=0){msg.textContent='계약금액을 원 단위 정수로 입력해 주세요.';return;}
   if(!date){msg.textContent='계약 체결일을 선택해 주세요.';return;}
   btn.disabled=true;msg.textContent='서버 반영 확인 중…';
   try{
    await D.write({deal_id:String(x.deal_id),request_id:crypto.randomUUID(),
     kind:x.has_row?'amended':'signed',effective_date:date,expected_version:x.expected_version,
     reason:'기술자문 계약 반영 · 문서 '+x.document_id+(x.source_manager?' · 원본 담당 '+x.source_manager:''),
     amount_delta:amt});
    row.classList.add('done');msg.textContent='✓ 원장에 반영되었습니다 ('+amount(amt)+' · '+date+').';
    row.querySelectorAll('input,button').forEach(n=>n.disabled=true);
    x.expected_version+=1;x.has_row=true;root.paint?.();
   }catch(e){btn.disabled=false;msg.textContent=String(e.message||e);}
  };});
 }
 root.ContractSalesUI={html,mount,filters,editor,detail,advisorySync};
})(window);
