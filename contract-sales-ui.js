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
   waiting.innerHTML='<section class="contract-sales-dialog" role="dialog" aria-modal="true" aria-labelledby="contract-sales-loading"><header><h2 id="contract-sales-loading">계약실적 확인</h2><button type="button" data-close aria-label="닫기">✕ 닫기</button></header><p role="status">기존 계약 이력을 확인합니다.</p><button type="button" data-retry>다시 조회</button></section>';
   document.body.append(waiting);waiting.querySelector('[data-close]').onclick=close;
   const retry=waiting.querySelector('[data-retry]');let loading=false;
   const load=async()=>{if(loading)return;loading=true;retry.disabled=true;waiting.querySelector('[role="status"]').textContent='계약 이력을 불러오는 중입니다.';try{await D.refresh();if(dialog!==waiting)return;if(D.state().status==='ready'){const original=focus;editor(deal);focus=original;}else waiting.querySelector('[role="status"]').textContent='계약 원장을 확인하지 못했습니다. 다시 조회해 주세요.';}finally{loading=false;retry.disabled=false;}};
   retry.onclick=load;waiting.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const buttons=[...waiting.querySelectorAll('button')].filter(b=>!b.disabled),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};waiting.querySelector('[data-close]').focus();load();return;
  }
  const id=String(root.dealKey(deal)),row=D.state().items.find(r=>r.deal_id===id);
  const shade=document.createElement('div');shade.className='contract-sales-shade';dialog=shade;
  shade.innerHTML='<form class="contract-sales-dialog" role="dialog" aria-modal="true" aria-labelledby="contract-sales-title"><header><h2 id="contract-sales-title">계약실적 기록</h2><button type="button" data-close aria-label="닫기">✕ 닫기</button></header><p>'+h(deal.site)+' · 실적 귀속 '+h(row?.sales_owner_name||deal.assignee)+'</p><p>계약 당시 담당자가 위 담당자와 일치하는지 확인하세요. 과거 담당자가 다른 계약은 검토 후 이관해야 합니다.</p><label>기록 구분<select name="kind">'+(row?'<option value="amended">변경 계약</option><option value="cancelled">계약 취소</option>':'<option value="signed">계약 체결 완료</option>')+'</select></label><label>발생일<input name="date" type="date" required></label><label data-amount>계약금액 또는 변경 증감액(원)<input name="amount" type="number" step="1" required'+(row?'':' placeholder="'+h(Number(deal.amount??deal.amt??0)>0?'참고: 예상금액 '+Number(deal.amount??deal.amt).toLocaleString('ko-KR')+'원 — 계약서 금액으로 입력':'계약서 금액으로 입력')+'"')+'></label><label>계약 확인 근거·변경 사유<textarea name="reason" required maxlength="8000"></textarea></label><label><input name="confirmed" type="checkbox" required> 계약 체결 또는 변경·취소 사실과 실적 귀속 담당자를 확인했습니다.</label><p role="alert"></p><button type="submit">기록 저장</button></form>';
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
 /* 영업건 상세에는 계약실적 버튼을 붙이지 않는다(2026-09-26 대표 '자꾸 계약실적이 나온다'). 변경·취소 기록은 성과 분석의 desk()에서만. */
 function detail(){}
 /* 관리자 전용 — 계약 변경·취소(와 과거 계약 수기 체결) 기록 대상 고르기 */
 function desk(){
  close();focus=document.activeElement;
  const shade=document.createElement('div');shade.className='contract-sales-shade';dialog=shade;
  shade.innerHTML='<section class="contract-sales-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-desk-title"><header><h2 id="cs-desk-title">계약 변경·취소 기록</h2><button type="button" data-close aria-label="닫기">✕ 닫기</button></header><p>계약 체결은 진행상태를 ‘계약 체결 완료’로 바꿀 때 자동으로 기록됩니다. 여기서는 금액 변경·계약 취소·과거 계약만 기록합니다.</p><label>현장 찾기<input type="search" data-q placeholder="아파트명·담당자"></label><div class="cs-desk-list" role="list"></div></section>';
  document.body.append(shade);shade.querySelector('[data-close]').onclick=close;shade.onkeydown=e=>{if(e.key==='Escape')close()};
  const list=shade.querySelector('.cs-desk-list'),q=shade.querySelector('[data-q]');
  const ledger=new Map((D.state().items||[]).map(r=>[String(r.deal_id),r]));
  const stageOf=d=>root.dealStage?root.dealStage(d):d.code;
  const missing=d=>!ledger.has(String(root.dealKey(d)));
  const rows=(root.B?.deals||[]).filter(d=>!missing(d)||['contract','construction','completion','won'].includes(stageOf(d))).sort((x,y)=>Number(missing(y))-Number(missing(x)));
  const todo=rows.filter(missing).length;
  if(todo)shade.querySelector('[data-q]').closest('label').insertAdjacentHTML('beforebegin','<p class="cs-desk-todo">계약 기록이 없는 계약·시공·준공·수주 <b>'+todo+'건</b> — 맨 위부터 계약서의 계약일·계약금액으로 입력해 주세요. 입력하면 그 달 매출에 잡힙니다.</p>');
  const paint=()=>{const k=q.value.trim();const hit=rows.filter(d=>!k||String(d.site||'').includes(k)||String(d.assignee||'').includes(k)).slice(0,60);
   list.innerHTML=hit.map(d=>{const r=ledger.get(String(root.dealKey(d)));return '<button type="button" role="listitem" data-k="'+h(root.dealKey(d))+'"><b>'+h(d.site||'현장명 미입력')+'</b><small>'+h(root.repN?root.repN(d.assignee):d.assignee)+' · '+(r?(r.cancelled?'계약 취소됨':h(r.contract_date)+' · '+amount(r.balance)):'계약 기록 없음')+'</small></button>';}).join('')||'<p>찾는 현장이 없습니다.</p>';};
  q.oninput=paint;list.onclick=e=>{const b=e.target.closest('[data-k]');if(!b)return;const d=rows.find(x=>String(root.dealKey(x))===b.dataset.k);if(d)editor(d);};
  if(D.state().status==='idle')D.refresh().then(()=>{if(dialog===shade)desk();});
  paint();q.focus();
 }
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
 /* 2026-09-25 대표 지시: 영업사원 관리 상세에도 계약실적 패널 금지 — 운영 화면 어디에도 계약실적 패널을 붙이지 않는다. */
 root.addEventListener('contract-sales:changed',()=>{if(root.B&&root.ME)root.paint()});
 root.addEventListener('phase1:identity-cleared',()=>{close();document.querySelectorAll('.contract-sales-host').forEach(n=>n.remove())});
 /* 기술자문 낙찰실적 확정 (2026-09-25 · 실적 정책 정본: docs/advisory-track-handoff-20260925.md)
    실적 = 낙찰금액(VAT 별도) · 귀속일 = 낙찰확정일 · 원천 브랜드(어디서 왔나)와 현재 사업(기술자문)은 분리.
    CRM이 아는 값은 미리 채운다 — 같은 현장의 영업 이력이 원천 브랜드 후보. 사람은 확인·선택만 한다.
    원본(advisory_deals)은 연동 대상이라 건드리지 않고 확정값만 별도 보관(advisory_id 1:1 → 중복 실적 없음). */
 const ADV_EXTRA=['기술자문 직접영업','기타 브랜드'];
 let advCache=null,advAt=0,advLoading=null;
 function advisoryRows(force){
  if(!force&&advCache&&Date.now()-advAt<300000)return Promise.resolve(advCache);
  if(advLoading)return advLoading;
  advLoading=root.SB.rpc('crm_advisory_attribution_v1',{}).then(r=>{
   if(r.error||r.data?.ok!==true)throw new Error(r.error?.message||'조회 실패');
   advCache=r.data.rows||[];advAt=Date.now();return advCache;
  }).finally(()=>{advLoading=null;});
  return advLoading;
 }
 const ro=w=>{const k=String(w).trim().slice(-1).charCodeAt(0)-0xAC00;return w+(k>=0&&k<11172&&k%28&&k%28!==8?'으로':'로');};/* 조사: 받침 있으면 '으로'(ㄹ 제외) */
 const advBucket=x=>({confirmed:'confirmed',hold:'hold',excluded:'excluded'})[x.attribution?.decision]||'pending';
 const advOutcome=c=>c.outcome==='won'?'수주':c.outcome==='lost'?'실주':c.lifecycle==='closed'?'종료':'진행';
 function advPrefill(x){
  const at=x.attribution||{},c=x.candidates||[];
  const origin=at.origin_business||(c.length===1?c[0].brand:'');
  const cand=c.find(k=>k.brand===origin);
  return {origin,src:at.source_deal_id||cand?.deal_id||'',owner:at.performance_owner||x.owner_name||cand?.owner||'',
   award:at.award_type||'bid',evidence:at.evidence_level||'admin_judgment',
   amount:at.bid_amount??x.bid_amount??'',date:String(at.bid_confirmed_at||x.contract_date||'').slice(0,10),
   dateGuess:!at.bid_confirmed_at&&!!x.contract_date,site:at.site_id||'',note:at.note||''};
 }
 const advReady=x=>{const p=advPrefill(x);return !!(p.origin&&p.owner&&Number(p.amount)>0&&p.date);};
 function advRow(x,i){
  const p=advPrefill(x),c=x.candidates||[],b=advBucket(x),confirmed=b==='confirmed';
  const people=[...new Set([...(root.SALES_PEOPLE_MASTER||[]).filter(k=>k.active!==false).map(k=>k.name),p.owner].filter(Boolean))];
  const why=c.length===1?'같은 현장 '+h(c[0].brand)+' 영업 '+c[0].deals+'건 확인 — 최초 '+h(String(c[0].opened||'').slice(0,7))+' · '+advOutcome(c[0])
   :c.length>1?'같은 현장에 여러 브랜드 영업 이력 — 처음 만난 브랜드를 고르세요(왼쪽이 먼저)'
   :x.site_id?'같은 현장 CRM 영업 이력 없음'+(x.untyped_history?' (브랜드 미지정 고객 기록 '+x.untyped_history+'건)':'')+' — 직접영업·기타·보류 중 선택'
   :'현장 미연결 — 영업 이력을 찾을 수 없습니다';
  const dup='<em class="avq-warn"'+(c.some(k=>k.has_contract&&k.brand===p.origin)?'':' hidden')+'>⚠ 이 영업건에 계약실적 원장 기록이 있습니다 — 같은 공사면 한쪽만 실적입니다</em>';
  const chip=(brand,src,sub)=>'<button type="button" class="avq-chip'+(p.origin===brand?' on':'')+'" data-origin="'+h(brand)+'" data-src="'+h(src||'')+'">'+h(brand)+(sub?'<small>'+sub+'</small>':'')+'</button>';
  const site=x.site_id?'<span class="avq-ok">연결됨</span>'
   :(x.site_candidates||[]).length?'<select data-site><option value="">연결 안 함</option>'+x.site_candidates.map(s=>'<option value="'+h(s.site_id)+'"'+(p.site===s.site_id?' selected':'')+'>'+h(s.site_name)+(s.address?' · '+h(String(s.address).slice(0,18)):'')+'</option>').join('')+'</select>'
   :'<span class="avq-no">미연결 · 후보 없음</span>';
  const at=x.attribution;
  return '<article class="avq-row '+b+'" data-i="'+i+'">'
   +'<header><b>'+h(x.site_name||'현장명 미상')+'</b><span class="avq-work">'+h(x.work_name||'')+'</span>'
   +'<span class="avq-tags">'+(b==='pending'&&c.length>1?'<i class="red">브랜드 귀속 확인 필요</i>':'')+(b!=='excluded'&&c.some(k=>k.has_contract)?'<i class="red">실적 중복 가능성</i>':'')+'<i>'+(x.channel==='jandi'?'잔디 연동':'이관')+'</i>'+(x.status?'<i>원본 '+h(x.status)+'</i>':'')+(x.contractor?'<i>시공사 '+h(x.contractor)+'</i>':'')+'</span></header>'
   +(at&&b!=='pending'?'<p class="avq-done">'+({confirmed:'✓ 확정',hold:'보류',excluded:'실적 제외'})[b]+(at.decided_by_name?' · '+h(at.decided_by_name):'')+(at.decided_at?' · '+h(String(at.decided_at).slice(0,10)):'')+(at.note?' — '+h(at.note):'')+'</p>':'')
   +'<div class="avq-origin"><span class="avq-lbl">원천 브랜드</span><span class="avq-chips">'
   +c.map(k=>chip(k.brand,k.deal_id,'영업 '+k.deals+'건 · '+h(String(k.opened||'').slice(0,4))+' '+advOutcome(k))).join('')
   +(c.length?'<span class="avq-sep"></span>':'')+ADV_EXTRA.map(k=>chip(k,'','')).join('')+'</span><small class="avq-why">'+why+'</small>'+dup+'</div>'
   +'<div class="avq-fields">'
   +'<label>구분<select data-award><option value="bid"'+(p.award==='bid'?' selected':'')+'>입찰 낙찰</option><option value="private_contract"'+(p.award==='private_contract'?' selected':'')+'>수의계약</option></select></label>'
   +'<label>귀속 담당자<select data-owner><option value="">선택</option>'+people.map(n=>'<option'+(n===p.owner?' selected':'')+'>'+h(n)+'</option>').join('')+'</select></label>'
   +'<label><span data-amt-lbl>'+(p.award==='private_contract'?'계약 공사금액':'낙찰금액')+'</span> · VAT 별도(원)<span class="avq-amt"><input type="number" step="1" min="1" data-amt value="'+h(p.amount)+'"><button type="button" data-vat title="입력값이 VAT 포함 금액이면 공급가액으로 환산">VAT 포함→÷1.1</button></span><small data-amt-view>'+(Number(p.amount)>0?amount(p.amount):'')+'</small></label>'
   +'<label><span data-date-lbl>'+(p.award==='private_contract'?'계약체결일':'낙찰확정일')+'</span><input type="date" data-date value="'+h(p.date)+'">'+(p.dateGuess?'<small>원본 계약일로 미리 채움 — 다르면 수정</small>':'')+'</label>'
   +'<label>근거<select data-evidence><option value="admin_judgment"'+(p.evidence==='admin_judgment'?' selected':'')+'>정황상 관리자 확인</option><option value="document"'+(p.evidence==='document'?' selected':'')+'>증빙 확인(공고·계약서)</option></select></label>'
   +'<label>현장 연결'+site+'</label></div>'
   +'<footer><input type="text" data-note list="avq-reasons" maxlength="500" placeholder="'+(confirmed?'정정 사유 (확정 실적 변경 시 필수)':'메모 · 보류/제외 사유')+'" value="'+(confirmed?'':h(p.note))+'">'
   +(b!=='hold'?'<button type="button" data-decide="hold">보류(확인 필요)</button>':'')+(b!=='excluded'?'<button type="button" data-decide="excluded">실적 제외</button>':'')
   +'<button type="button" class="primary" data-decide="confirmed">'+(confirmed?'정정 저장':p.origin?h(ro(p.origin))+' 확정':'확정')+'</button></footer>'
   +'<p class="avq-msg" role="status"></p></article>';
 }
 async function advisorySync(){
  close();focus=document.activeElement;
  const shade=document.createElement('div');shade.className='contract-sales-shade';dialog=shade;
  shade.innerHTML='<section class="contract-sales-dialog advisory-sync avq" role="dialog" aria-modal="true" aria-labelledby="adv-sync-title"><header><h2 id="adv-sync-title">기술자문 낙찰실적 확정</h2><button type="button" data-close aria-label="닫기">✕ 닫기</button></header>'
   +'<p class="avq-policy">실적 = <b>낙찰금액(VAT 별도)</b> · 귀속일 = <b>낙찰확정일</b> · 원천 브랜드는 처음 고객을 만난 브랜드입니다. 확정한 건만 성과 분석의 기술자문 낙찰실적에 합산됩니다.</p>'
   +'<div class="avq-sum" role="status">기술자문 건을 불러오는 중…</div><nav class="avq-tabs" role="tablist"></nav><div class="adv-sync-body avq-list"></div><datalist id="avq-reasons"><option value="과거자료 미확인"><option value="브랜드 귀속 확인 필요"><option value="낙찰금액 확인 필요"><option value="담당자 확인 필요"><option value="실적 중복 의심"><option value="낙찰 전(입찰 진행)"><option value="실제 공사 아님(원본 메모 행)"></datalist></section>';
  document.body.append(shade);
  shade.querySelector('[data-close]').onclick=close;
  shade.onkeydown=e=>{if(e.key==='Escape')close()};
  const sum=shade.querySelector('.avq-sum'),tabs=shade.querySelector('.avq-tabs'),list=shade.querySelector('.avq-list');
  let rows=[],tab='pending';
  try{rows=await advisoryRows(true);}catch(e){sum.textContent='불러오지 못했습니다: '+String(e.message||e)+' (서버 함수 적용 전이면 관리자 SQL 적용 후 다시 열어 주세요)';return;}
  const paint=()=>{
   const by={pending:[],hold:[],confirmed:[],excluded:[]};rows.forEach((x,i)=>by[advBucket(x)].push(i));
   const conf=by.confirmed.map(i=>rows[i]),confSum=conf.reduce((s,x)=>s+Number(x.attribution.bid_amount||0),0);
   const ready=by.pending.filter(i=>advReady(rows[i])).length;
   sum.innerHTML='<b>확정 '+conf.length+'건 · <strong title="'+amountFull(confSum)+'">'+amount(confSum)+'</strong></b> <span class="adv-chip n">VAT 별도</span>'
    +'<span>검증 대기 <b>'+by.pending.length+'</b>건'+(ready?' — 이 중 <b>'+ready+'</b>건은 값이 모두 채워져 버튼 한 번이면 확정':'')+'</span>'
    +(()=>{const lg=rows.filter(x=>x.channel!=='jandi'),dn=lg.filter(x=>x.attribution).length,pc=lg.length?Math.round(dn/lg.length*100):0;return '<span class="avq-prog" title="과거 이관분 공식화 진척(확정·보류·제외 모두 처리로 계산)">이관 '+lg.length+'건 처리 <b>'+dn+'/'+lg.length+'</b><i><em style="width:'+pc+'%"></em></i></span>';})()
    +'<small>전체 '+rows.length+'건(이관 '+rows.filter(x=>x.channel!=='jandi').length+' · 잔디 '+rows.filter(x=>x.channel==='jandi').length+') · 보류 '+by.hold.length+' · 제외 '+by.excluded.length+'</small>';
   tabs.innerHTML=[['pending','검증 대기'],['hold','보류'],['confirmed','확정'],['excluded','실적 제외']].map(([k,t])=>'<button type="button" role="tab" data-tab="'+k+'" aria-selected="'+(tab===k)+'"'+(tab===k?' class="on"':'')+'>'+t+' <b>'+by[k].length+'</b></button>').join('');
   const idx=by[tab].slice().sort((a,b)=>tab==='pending'?Number(advReady(rows[b]))-Number(advReady(rows[a])):0);
   list.innerHTML=idx.map(i=>advRow(rows[i],i)).join('')||'<p class="avq-empty">'+({pending:'검증 대기 건이 없습니다. 모두 확정·보류·제외되었습니다.',hold:'보류한 건이 없습니다.',confirmed:'아직 확정한 건이 없습니다.',excluded:'실적 제외한 건이 없습니다.'})[tab]+'</p>';
  };
  tabs.onclick=e=>{const t=e.target.closest('[data-tab]');if(!t)return;tab=t.dataset.tab;paint();list.scrollTop=0;};
  list.onchange=e=>{if(e.target.matches('[data-award]')){const r=e.target.closest('.avq-row'),pv=e.target.value==='private_contract';r.querySelector('[data-amt-lbl]').textContent=pv?'계약 공사금액':'낙찰금액';r.querySelector('[data-date-lbl]').textContent=pv?'계약체결일':'낙찰확정일';}};
  list.oninput=e=>{if(e.target.matches('[data-amt]')){const v=e.target.closest('label').querySelector('[data-amt-view]');v.textContent=Number(e.target.value)>0?amount(e.target.value):'';}};
  list.onclick=async e=>{
   const row=e.target.closest('.avq-row');if(!row)return;
   const x=rows[Number(row.dataset.i)],msg=row.querySelector('.avq-msg');
   const chipBtn=e.target.closest('[data-origin]');
   if(chipBtn){row.querySelectorAll('[data-origin]').forEach(n=>n.classList.toggle('on',n===chipBtn));
    const pb=row.querySelector('[data-decide="confirmed"]');if(advBucket(x)!=='confirmed')pb.textContent=ro(chipBtn.dataset.origin)+' 확정';
    const own=row.querySelector('[data-owner]'),cand=(x.candidates||[]).find(k=>k.deal_id&&k.deal_id===chipBtn.dataset.src);
    row.querySelector('.avq-warn').hidden=!cand?.has_contract;
    if(!own.value&&cand?.owner&&[...own.options].some(o=>o.value===cand.owner))own.value=cand.owner;return;}
   if(e.target.closest('[data-vat]')){const inp=row.querySelector('[data-amt]'),v=Number(inp.value);if(v>0){inp.value=String(Math.round(v/1.1));inp.dispatchEvent(new Event('input',{bubbles:true}));msg.textContent='VAT 포함값을 공급가액으로 환산했습니다('+amount(v)+' → '+amount(Math.round(v/1.1))+'). 확정 전 원본 금액을 한 번 더 확인해 주세요.';}return;}
   const btn=e.target.closest('[data-decide]');if(!btn)return;
   const decision=btn.dataset.decide,on=row.querySelector('[data-origin].on');
   const origin=on?.dataset.origin||'',src=on?.dataset.src||'',owner=row.querySelector('[data-owner]').value;
   const amt=Number(row.querySelector('[data-amt]').value),date=row.querySelector('[data-date]').value;
   const note=row.querySelector('[data-note]').value.trim(),site=row.querySelector('[data-site]')?.value||'';
   const award=row.querySelector('[data-award]').value,evidence=row.querySelector('[data-evidence]').value;
   const wasConfirmed=advBucket(x)==='confirmed';
   if(decision==='confirmed'){
    if(!origin){msg.textContent='원천 브랜드를 골라 주세요. 모르면 [보류(확인 필요)]를 누르세요.';return;}
    if(!owner){msg.textContent='실적을 귀속할 담당자를 골라 주세요.';return;}
    if(!Number.isSafeInteger(amt)||amt<=0){msg.textContent='낙찰금액(VAT 별도)을 원 단위 정수로 입력해 주세요.';return;}
    if(!date){msg.textContent=(award==='private_contract'?'계약체결일':'낙찰확정일')+'을 입력해 주세요.';return;}
    if(wasConfirmed&&!note){msg.textContent='확정된 실적을 바꾸려면 정정 사유를 적어 주세요.';return;}
   }else if(!note){msg.textContent=(decision==='hold'?'무엇을 확인해야 하는지':'실적에서 빼는 이유를')+' 메모에 적어 주세요.';row.querySelector('[data-note]').focus();return;}
   row.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);msg.textContent='서버 저장 확인 중…';
   try{
    const r=await root.SB.rpc('crm_advisory_attribution_decide_v1',{p:{advisory_id:x.advisory_id,expected_version:x.attribution?.version||0,decision,
     award_type:award,evidence_level:decision==='confirmed'?evidence:null,
     origin_business:origin||null,source_deal_id:src||null,performance_owner:owner||null,bid_amount:amt>0?amt:null,bid_confirmed_at:date||null,
     site_id:site||null,note:note||null,reason:wasConfirmed?note:null}});
    if(r.error)throw new Error(/VERSION_CONFLICT/.test(r.error.message||'')?'다른 곳에서 먼저 바뀌었습니다. 닫았다가 다시 열어 주세요.':r.error.message);
    if(r.data?.ok!==true||r.data.advisory_id!==x.advisory_id)throw new Error('서버 확인 응답이 올바르지 않습니다.');
    x.attribution={...r.data.attribution,decided_by_name:r.data.attribution?.decided_by_name||root.ME?.name};
    if(site&&!x.site_id){x.site_id=site;x.site_linked='confirmed';}
    advCache=rows;advAt=Date.now();paint();
    root.dispatchEvent(new CustomEvent('advisory-attribution:changed'));
   }catch(err){row.querySelectorAll('button,input,select').forEach(n=>n.disabled=false);msg.textContent=String(err.message||err);}
  };
  paint();
 }
 root.ContractSalesUI={html,mount,filters,editor,detail,desk,advisorySync,advisoryRows};
})(window);
