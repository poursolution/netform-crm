(function(root){
 'use strict';
 const D=root.ContractSalesData,h=v=>root.esc(String(v??''));
 const amount=n=>Number(n).toLocaleString('ko-KR')+'원';
 let dialog=null,focus=null;
 function filters(extra={}){return Object.assign({year:root.G.year,quarter:Object.hasOwn(extra,'month')?0:root.G.quarter||0,brand:root.G.brand,owner:root.G.rep},extra)}
 function html(f,compact){
  const s=D.summarize(f),period=(f.from?f.from+' ~ '+f.to:(f.year||'전체')+'년 '+(f.month?f.month+'월':f.quarter?f.quarter+'분기':'전체 기간'));
  const title='<header><div><h3>계약실적</h3><p>계약 체결일 기준 · 변경·취소는 발생일 반영</p><small>'+h(period)+' · '+h(f.owner||'전체')+' · CRM 영업실적</small></div><button type="button" data-contract-refresh>새로고침</button></header>';
  if(!s)return '<section class="contract-sales-panel">'+title+'<p role="status">'+(D.state().status==='loading'?'계약 이력을 불러오는 중입니다.':'계약 원장을 확인하지 못했습니다. 실적 금액은 확인 후 표시합니다.')+'</p></section>';
  /* 브리핑·리포트는 합계 한 줄만 — 담당자별·근거 상세 표는 성과 분석에서 확인 (2026-09-24). */
  if(compact)return '<section class="contract-sales-panel contract-sales-compact">'+title+'<div class="contract-sales-totals">'+[['신규 계약',s.newAmount],['변경 증감',s.amendmentAmount],['계약 취소',s.cancellationAmount],['순 계약실적',s.netAmount]].map(([label,n])=>'<div><span>'+label+'</span><strong>'+amount(n)+'</strong></div>').join('')+'</div><p>신규 계약 '+s.count+'건 · 계약 체결일 기준 · 담당자별·근거 상세는 성과 분석에서 확인합니다.</p></section>';
  return '<section class="contract-sales-panel">'+title+'<div class="contract-sales-totals">'+[['신규 계약',s.newAmount],['변경 증감',s.amendmentAmount],['계약 취소',s.cancellationAmount],['순 계약실적',s.netAmount]].map(([label,n])=>'<div><span>'+label+'</span><strong>'+amount(n)+'</strong></div>').join('')+'</div><p>신규 계약 '+s.count+'건 · 최초 계약과 조정 이력을 합산합니다. 과거 미확인 계약은 검토 후 반영합니다.</p><div class="contract-sales-scroll"><table><thead><tr><th>실적 귀속 담당자</th><th>계약건수</th><th>신규 계약</th><th>변경 증감</th><th>계약 취소</th><th>순 계약실적</th></tr></thead><tbody>'+s.rows.map(r=>'<tr><th>'+h(r.name||r.sales_owner)+'</th><td>'+r.count+'</td><td>'+amount(r.newAmount)+'</td><td>'+amount(r.amendmentAmount)+'</td><td>'+amount(r.cancellationAmount)+'</td><td>'+amount(r.netAmount)+'</td></tr>').join('')+'</tbody></table></div><section class="contract-sales-evidence"><strong>계약·조정 근거 '+s.events.length+'건</strong><div class="contract-sales-scroll"><table><thead><tr><th>발생일</th><th>구분</th><th>귀속 담당자</th><th>증감액</th><th>사유</th></tr></thead><tbody>'+(s.events.map(e=>'<tr><td>'+h(e.effective_date)+'</td><td>'+({signed:'계약 체결',amended:'변경 계약',cancelled:'계약 취소'}[e.kind])+'</td><td>'+h(e.sales_owner_name)+'</td><td>'+amount(e.amount_delta)+'</td><td>'+h(e.reason)+'</td></tr>').join('')||'<tr><td colspan="5">아직 기록된 계약·조정 근거가 없습니다.</td></tr>')+'</tbody></table></div></section></section>';
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
  /* 대시보드·컨트롤타워는 콘솔 KPI·근거 팝업이 대신한다 — 상세 원장 패널은 성과 분석에만 (2026-09-24). */
  if(page==='perf')mount(document.querySelector('#si-perf .si-shell'),filters(root.G.insights||{}));
  if(page==='report'){
   const host=document.getElementById('report-master');
   // Retain operational pipeline/risk sections, but retire their old revenue headline.
   host?.querySelectorAll('.ceo-summary .ceo-stat').forEach((n,i)=>{if(i<2)n.hidden=true});
   host?.querySelectorAll('#ceo-reps,#ceo-trend').forEach(n=>n.hidden=true);
   distinguishCompletion(host);mount(host,filters(),true);
  }
  if(page==='brief'){const host=document.getElementById('b-week'),w=root.briefWeekWindow(),end=new Date(w.start);end.setDate(end.getDate()-1);distinguishCompletion(host);mount(host,filters({year:null,quarter:0,from:w.prevStartKey,to:root.briefDateKey(end)}),true)}
  return r;
 };
 function distinguishCompletion(host){
  if(!host)return;
  const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);let n;
  while((n=walker.nextNode())){if(n.parentElement.closest('.contract-sales-host,script,style'))continue;n.nodeValue=n.nodeValue.replace(/수주금액/g,'준공 처리금액').replace(/누적 수주|이번 달 수주|지난주 수주 결과/g,'준공 처리 결과');}
 }
 const oldRep=root.repManagerRenderDrawer;
 if(oldRep)root.repManagerRenderDrawer=function(){const r=oldRep.apply(this,arguments),row=root.REP_MANAGER_ROWS?.[root.REP_MANAGER_DRAWER_INDEX];if(row)mount(document.getElementById('perfDrawerBody'),filters({owner:row.nm||row.name}));return r};
 root.addEventListener('contract-sales:changed',()=>{if(root.B&&root.ME)root.paint()});
 root.addEventListener('phase1:identity-cleared',()=>{close();document.querySelectorAll('.contract-sales-host').forEach(n=>n.remove())});
 root.ContractSalesUI={html,mount,filters,editor,detail};
})(window);
