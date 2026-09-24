(function(root){
 'use strict';
 const M=root.SalesInsightsModel,h=v=>root.esc(String(v??'')),a=v=>root.escAttr(String(v??''));
 const labels={overdue:'기한초과',missing:'Next 없음',contact:'7일 이상 미접촉',unknown:'접촉 기록 없음',stale:'장기정체',amount:'예상금액 미입력'};
 let actor='',focusBefore=null;
 const number=n=>Number(n||0).toLocaleString('ko-KR');
 const money=n=>n>=100000000?(n/100000000).toLocaleString('ko-KR',{maximumFractionDigits:2})+'억':number(Math.round(n/10000))+'만원';
 function state(){
  const id=String(root.ME?.id||root.ME?.name||'');
  if(actor!==id){actor=id;root.G.insights=null;close(false)}
  if(!root.G.insights){const now=new Date();root.G.insights={year:String(now.getFullYear()),month:now.getMonth()+1,brand:'전체',owner:'전체',view:'lead',kind:'risk',issue:'all',stage:'all',search:'',page:1}}
  root.G.insights.brand=root.G.brand;root.G.insights.owner=root.SalesScope.state().owner;return root.G.insights;
 }
 function rows(unscoped=false){
  // B is ACL-filtered by the operational adapter. Apply the same per-user UI scope as Today.
  const admin=root.todayIsAdmin(),me=root.repN(root.ME?.name),base=root.B||{};
  const deals=(base.deals||[]).filter(d=>admin||root.repN(d.assignee)===me).map(d=>{
   const next=root.briefNext(d),meta=root.relationshipMeta(d),old=root.issueSet(d),issues=[];
   const due=next?.due&&Number.isFinite(Date.parse(next.due))?root.daysTo(next.due):null;
   if(due!==null&&due<0)issues.push('overdue');
   if(!next?.text||due===null)issues.push('missing');
   if(meta.days!==null&&meta.days>=7)issues.push('contact');
   if(meta.days===null)issues.push('unknown');
   if(old.includes('stale'))issues.push('stale');
   if(!(root.oppAmt(d)>0)&&!root.amountUnknownReason(d))issues.push('amount');
   return {key:'deal:'+root.dealKey(d),type:'deal',item:d,site:d.site||'현장명 미입력',owner:root.repN(d.assignee),brand:d.brand||'',created:d.created,active:root.towerActive(d)&&root.outcomeOf(d)==='open',won:root.isWon(d),wonAt:root.wonDate(d),wonAmount:root.hasWonAmt(d)?root.wonAmt(d):0,hasWonAmount:root.hasWonAmt(d),expected:root.oppAmt(d),stage:root.dealStage(d),stageLabel:root.stageLabel(root.dealStage(d)),issues,reason:issues.map(k=>k==='overdue'?Math.abs(due)+'일 기한초과':k==='contact'?meta.days+'일 미접촉':labels[k]).join(' · '),lastContact:meta.meaningfulAt||''};
  });
  const inquiries=root.operationalInquiries(base.inquiries||[]).filter(q=>admin||root.inquiryRoutedOwner(q)===me||root.inquiryConsultant(q)===me).map(q=>({key:'inq:'+String(q.id||root.inqKey(q)),type:'inq',item:q,site:q.site||'현장명 미입력',owner:root.inquiryRoutedOwner(q)||'미배정',brand:q.brand||'',created:root.inquiryDate(q),stage:'inquiry',stageLabel:q.status||'견적문의',issues:[],reason:root.inquiryRoutedOwner(q)?'문의 내용과 후속처리 확인':'담당자 배정 필요'}));
  return {deals:deals.filter(d=>unscoped||root.SalesScope.matches(d.owner,d.item)&&root.SalesFilterState.matchesBrand(d.brand)),inquiries:inquiries.filter(q=>unscoped||root.SalesScope.matches(q.owner,q.item)&&root.SalesFilterState.matchesBrand(q.brand))};
 }
 function data(owner){const f=Object.assign({},state());if(owner)f.owner=owner;const r=rows();const summary=M.summarize(r.deals,r.inquiries,f);summary.contractSummary=root.ContractSalesData?.summarize(f);return summary}
 function btn(text,action,value,cls){return '<button type="button" class="'+(cls||'')+'" data-si-action="'+action+'" data-value="'+a(value||'')+'">'+h(text)+'</button>'}
 function options(values,selected){return values.map(v=>'<option value="'+a(v[0])+'"'+(String(v[0])===String(selected)?' selected':'')+'>'+h(v[1])+'</option>').join('')}
 function select(label,key,values,value){return '<label>'+h(label)+'<select data-si-filter="'+key+'" aria-label="'+h(label)+'">'+options(values,value)+'</select></label>'}
 function filters(){
  const f=state(),r=rows(true),all=r.deals.concat(r.inquiries),years=new Set([String(new Date().getFullYear()),f.year]);
  all.forEach(x=>[x.created,x.wonAt].forEach(v=>{const d=M.date(v);if(d)years.add(d.slice(0,4))}));
  const brands=[...new Set(all.map(x=>x.brand).concat(f.brand==='전체'?[]:[f.brand]).filter(Boolean))].sort();
  return root.SalesFilters.controls(all)+'<div class="si-filters">'+select('연도','year',[...years].filter(x=>x!=='전체').sort().reverse().map(x=>[x,x+'년']),f.year)+select('기간','month',[[0,'연간'],...Array.from({length:12},(_,i)=>[i+1,(i+1)+'월'])],f.month)+'</div>';
 }
 function kpis(s,rep){
  const defs=rep?[['진행 영업',number(s.active.length)+'건','현재','active'],['예상금액',money(s.expected),'현재 진행 중','active'],['계약실적',s.contractSummary?money(s.contractSummary.netAmount):'확인 필요','계약 체결일 기준','contract'],['미접촉',number(s.active.filter(d=>d.issues.includes('contact')).length)+'건','최근 접촉 7일 이상','contact'],['Next 없음',number(s.active.filter(d=>d.issues.includes('missing')).length)+'건','행동 또는 기한 미입력','missing']]:[['문의',number(s.inquiries.length)+'건','선택 기간 접수','inquiries'],['진행중',number(s.active.length)+'건','현재 보유 파이프라인','active'],['예상 파이프라인 금액',money(s.expected),'현재 진행 중','active'],['계약실적',s.contractSummary?money(s.contractSummary.netAmount):'확인 필요','계약 체결일 기준','contract'],['관리필요',number(s.risk.length)+'건','영업 건 수 · 사유 중복 제외','risk']];
  return '<div class="si-kpis">'+defs.map(x=>'<button data-si-action="drill" data-value="'+x[3]+'"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></button>').join('')+'</div>';
 }
 function card(title,body,note){return '<section class="si-card"><header><h3>'+h(title)+'</h3>'+(note?'<p>'+h(note)+'</p>':'')+'</header>'+body+'</section>'}
 const empty=text=>'<p class="si-empty">'+h(text||'선택한 조건의 데이터가 없습니다.')+'</p>';
 function stages(s,owner){if(root.PipelineWorkspace&&root.PipelineStages){const f={...state(),owner:owner||state().owner},all=root.PipelineWorkspace.rows({brand:f.brand,owner:f.owner}),counts=root.PipelineStages.definitions.map(d=>({...d,count:all.filter(r=>r.group===d.key).length})),max=Math.max(1,...counts.map(x=>x.count));return card('현재 영업 흐름',counts.map(x=>'<button class="si-bar" data-si-action="stage" data-value="'+a(x.key)+'"><span>'+h(x.number+' '+x.label)+'</span><i style="--size:'+x.count/max*100+'%"></i><b>'+number(x.count)+'건</b></button>').join(''),'현재 적재 기준 · 확장은 기존 수주와 연결된 별도 기회');}return card('현재 영업 흐름',empty());}

 function risks(s){return card('지금 관리가 필요한 것','<div class="si-risk-links">'+Object.keys(labels).map(k=>btn(labels[k]+' '+number(s.active.filter(d=>d.issues.includes(k)).length)+'건','drill',k)).join('')+'</div>'+btn('전체 확인 →','drill','risk'),'한 영업 건에 여러 사유가 있을 수 있습니다.');}
 function people(s,limit){
  const names=[...new Set(s.deals.map(x=>x.owner).concat(root.ContractSalesData?.state().items.map(x=>x.sales_owner_name)||[]))].filter(n=>root.SalesScope.people().some(p=>p.name===n)).sort(root.repCompare);
  const r=names.map(name=>({name,s:M.summarize(s.deals,s.inquiries,Object.assign({},state(),{owner:name})),cs:root.ContractSalesData?.summarize(Object.assign({},state(),{owner:name}))}));
  return card('담당자 현황','<div class="si-table-scroll"><table class="si-table si-people"><thead><tr><th>담당자</th><th>진행</th><th>예상금액</th><th>계약실적</th><th>기한초과</th><th>Next 없음</th></tr></thead><tbody>'+r.slice(0,limit||r.length).map(x=>'<tr><td>'+btn(x.name,'person',x.name)+'</td><td>'+number(x.s.active.length)+'</td><td>'+money(x.s.expected)+'</td><td>'+(x.cs?money(x.cs.netAmount):'확인 필요')+'</td><td>'+number(x.s.active.filter(d=>d.issues.includes('overdue')).length)+'</td><td>'+number(x.s.active.filter(d=>d.issues.includes('missing')).length)+'</td></tr>').join('')+'</tbody></table></div>'+(r.length?'':empty())+btn('성과 분석 전체보기 →','navigate','perf'),'선택한 영업 분석 대상 담당자 기준 · 미배정은 배정상태 필터에서 확인합니다.');
 }
 function trend(s){const f=state(),months=Array.from({length:12},(_,i)=>({month:i+1,s:root.ContractSalesData?.summarize({...f,month:i+1})})).filter(x=>!f.month||x.month===Number(f.month));return card('월별 계약실적',months.map(x=>'<div class="si-bar"><span>'+x.month+'월</span><b>'+(x.s?money(x.s.netAmount):'확인 필요')+'</b></div>').join(''),'계약 체결일 기준 · 변경·취소는 발생일 반영');}
 function execution(s){const ready=s.active.filter(d=>!d.issues.includes('missing')).length;return card('실행 관리','<dl class="si-facts"><div><dt>다음 행동·기한 등록</dt><dd>'+ready+' / '+s.active.length+'건</dd></div><div><dt>다음 행동 기한초과</dt><dd>'+s.active.filter(d=>d.issues.includes('overdue')).length+'건</dd></div><div><dt>접촉 기록 없음</dt><dd>'+s.active.filter(d=>d.issues.includes('unknown')).length+'건</dd></div></dl>','현재 등록된 행동과 접촉 기록 기준');}
 function records(list,limit){return '<div class="si-records">'+(list.slice(0,limit||list.length).map(d=>'<div><span><b>'+h(d.site)+'</b><small>'+h(d.reason||d.stageLabel)+'</small></span>'+btn(d.type==='inq'&&d.owner==='미배정'?'배정':'처리','record',d.key)+'</div>').join('')||empty())+'</div>';}
 function recent(s){
  const seen=new Set(),logs=[];s.deals.forEach(d=>{const patch=root.itemPatch(d.item,'deal');[...(d.item.activities||[]),...(patch.activities||[])].forEach(x=>{const at=x.at||x.created_at||x.occurred_at,k=d.key+':'+(x.id||[at,x.type,x.note||x.result].join('|'));if(seen.has(k)||!M.inPeriod(at,state()))return;seen.add(k);logs.push({at,site:d.site,text:x.note||x.result||root.siteActivityTitle(x.type||'활동')})})});
  logs.sort((a,b)=>String(b.at).localeCompare(String(a.at)));return card('최근 활동',logs.length?'<ol class="si-activity">'+logs.slice(0,8).map(x=>'<li><time>'+h(M.date(x.at))+'</time><div><b>'+h(x.site)+'</b><p>'+h(x.text)+'</p></div></li>').join('')+'</ol>':empty('선택 기간에 기록된 활동이 없습니다.'));
 }
 function control(s){
  const f=state(),list=M.select(s,f.kind,f),size=20,pages=Math.max(1,Math.ceil(list.length/size));f.page=Math.min(f.page,pages);
  const kinds=[['risk','관리필요'],['active','진행중 전체'],['inquiries','기간 문의'],['won','기간 준공 처리']];
  const stageOptions=[['all','전체 단계'],...s.stages.map(x=>[x.code,x.label])];
  return '<div class="si-control-filters">'+select('목록','kind',kinds,f.kind)+select('관리유형','issue',[['all','전체'],['urgent','긴급 · 기한초과'],...Object.entries(labels)],f.issue)+select('단계','stage',stageOptions,f.stage)+'<label>현장 검색<input data-si-search value="'+a(f.search)+'" placeholder="현장·담당자·사유" aria-label="현장 검색"></label></div>'+card('관리 대상 · '+number(list.length)+'건','<div class="si-table-scroll"><table class="si-table si-cases"><thead><tr><th>현장</th><th>담당자</th><th>현재 단계</th><th>확인할 내용</th><th>처리</th></tr></thead><tbody>'+list.slice((f.page-1)*size,f.page*size).map(d=>'<tr><td>'+h(d.site)+'</td><td>'+h(d.owner)+'</td><td><span class="si-badge">'+h(d.stageLabel)+'</span></td><td>'+h(f.kind==='won'?'준공 처리금액 '+money(d.wonAmount)+(d.hasWonAmount?'':' · 금액 미입력'):d.reason||'현재 진행 중')+'</td><td>'+btn(d.type==='inq'&&d.owner==='미배정'?'배정':'처리','record',d.key)+'</td></tr>').join('')+'</tbody></table></div>'+(list.length?'':empty())+'<div class="si-pager">'+btn('이전','page',Math.max(1,f.page-1))+'<span>'+f.page+' / '+pages+'</span>'+btn('다음','page',Math.min(pages,f.page+1))+'</div>','진행 중·관리필요는 현재 상태, 문의·준공 처리는 선택 기간 기준이며 계약실적과 별도입니다.');
 }
 /* ─── 대시보드 다크 콘솔 (2026-09-22) ─── */
 let lastDiags=[];
 function repStats(s){
  const f=state(),curM=Number(f.month)||new Date().getMonth()+1,week=Date.now()-7*864e5;
  const names=[...new Set(s.deals.map(x=>x.owner).concat((root.ContractSalesData?.state().items||[]).map(x=>x.sales_owner_name)))].filter(n=>root.SalesScope.people().some(p=>p.name===n)).sort(root.repCompare);
  return names.map(name=>{
   const deals=s.deals.filter(d=>d.owner===name),act=deals.filter(d=>d.active);
   let weekly=0,last=null;const types={call:0,visit:0,quote:0};
   deals.forEach(d=>{const patch=root.itemPatch(d.item,'deal');[...(d.item.activities||[]),...(patch.activities||[])].forEach(x=>{const at=Date.parse(x.at||x.created_at||x.occurred_at||'');if(!Number.isFinite(at))return;if(at>=week){weekly++;const t=String(x.type||'')+String(x.note||'');if(/방문|미팅|현장/.test(t))types.visit++;else if(/견적|입찰|제안/.test(t))types.quote++;else types.call++}if(!last||at>last.at)last={at,site:d.site}})});
   const cs=root.ContractSalesData?.summarize({...f,month:0,owner:name}),csM=root.ContractSalesData?.summarize({...f,month:curM,owner:name});
   return {name,act,weekly,types,last,ySales:cs?cs.netAmount:null,mSales:csM?csM.netAmount:null,expected:act.reduce((a,d)=>a+(d.expected||0),0),
    overdue:act.filter(d=>d.issues.includes('overdue')).length,missing:act.filter(d=>d.issues.includes('missing')).length,contact:act.filter(d=>d.issues.includes('contact')).length};
  });
 }
 function diagnose(rs){
  const out=[],m0=x=>x===null?'확인 필요':money(x);
  const byW=[...rs].filter(x=>x.act.length).sort((a,b)=>b.weekly-a.weekly),top=byW[0];
  if(top&&top.weekly>0&&top.overdue>0){const st={};top.act.filter(d=>d.issues.includes('overdue')).forEach(d=>{st[d.stageLabel]=(st[d.stageLabel]||0)+1});const w=Object.entries(st).sort((a,b)=>b[1]-a[1])[0];
   out.push({name:top.name,kind:'overdue',cls:'',title:top.name+' — 주간 활동 최다 '+top.weekly+'건 · 기한초과 '+top.overdue+'건',sub:'기한초과가 '+(w?w[0]+' 단계에 '+w[1]+'건 몰림':'누적')+' · 이번 달 매출 '+m0(top.mSales)+' — 마감 관리에서 막힘'});}
  const zero=rs.filter(x=>(x.mSales||0)===0&&x.act.length>=3&&x.name!==top?.name).sort((a,b)=>b.expected-a.expected)[0];
  if(zero){const st={};zero.act.forEach(d=>{st[d.stageLabel]=(st[d.stageLabel]||0)+1});const w=Object.entries(st).sort((a,b)=>b[1]-a[1])[0];
   out.push({name:zero.name,kind:'stall',cls:'',title:zero.name+' — 이번 달 매출 0 · 파이프라인 '+money(zero.expected),sub:(w?w[0]+' 단계에 '+w[1]+'건('+Math.round(w[1]/zero.act.length*100)+'%) 정체':'단계 정체')+' — 다음 단계 전환이 안 됨'});}
  const low=[...rs].filter(x=>x.act.length&&!out.some(o=>o.name===x.name)).sort((a,b)=>a.weekly-b.weekly)[0];
  if(low&&(low.contact>0||low.weekly===0))out.push({name:low.name,kind:'contact',cls:'w',title:low.name+' — 주간 활동 최저 '+low.weekly+'건',sub:'7일+ 미접촉 '+low.contact+'건'+(low.last?' · 마지막 활동 '+M.date(new Date(low.last.at).toISOString()):'')+' — 접촉이 끊김'});
  return out.slice(0,3);
 }
 function feedRows(s,limit){
  const out=[],seen=new Set();
  s.deals.forEach(d=>{const patch=root.itemPatch(d.item,'deal');[...(d.item.activities||[]),...(patch.activities||[])].forEach(x=>{const at=x.at||x.created_at||x.occurred_at;if(!at)return;const k=d.key+':'+(x.id||at+'|'+(x.note||x.result||''));if(seen.has(k))return;seen.add(k);out.push({at,owner:d.owner,site:d.site,text:x.note||x.result||root.siteActivityTitle(x.type||'활동'),amt:d.expected||d.wonAmount||0,key:d.key})})});
  out.sort((a,b)=>String(b.at).localeCompare(String(a.at)));return out.slice(0,limit||10);
 }
 function contractEvidence(filter){
  const f=state(),out=[],kindLabel={signed:'계약 체결',amended:'변경 계약',cancelled:'계약 취소'};
  (root.ContractSalesData?.state().items||[]).forEach(r=>{
   if(filter.brand&&r.brand!==filter.brand)return;
   if(filter.owner&&r.sales_owner_name!==filter.owner)return;
   (r.events||[]).forEach(e=>{const d=String(e.effective_date||'');
    if(f.year&&f.year!=='전체'&&!d.startsWith(String(f.year)))return;
    if(filter.month&&Number(d.slice(5,7))!==Number(filter.month))return;
    out.push({at:d,site:r.brand||'-',owner:e.sales_owner_name,stageLabel:kindLabel[e.kind]||e.kind,reason:d+' · '+(e.reason||''),amt:e.amount_delta});});
  });
  return out.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
 }
 function evRow(d){return {site:d.site,owner:d.owner,stageLabel:d.stageLabel,reason:d.reason||'',amt:d.expected||d.amt||0,key:d.key}}
 function openEvidence(title,sub,list){
  close(false);focusBefore=document.activeElement;
  const shade=document.createElement('div');shade.id='si-person';shade.className='modalshade on si-person';
  shade.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="si-person-title" class="si-person-box si-evidence"><header><div><h2 id="si-person-title">'+h(title)+'</h2><p>'+h(sub||'')+'</p></div>'+btn('닫기','close','','si-close')+'</header><div class="si-table-scroll"><table class="si-table si-cases"><thead><tr><th>현장·구분</th><th>담당자</th><th>단계</th><th>근거</th><th>금액</th><th>처리</th></tr></thead><tbody>'+(list.map(d=>'<tr><td>'+h(d.site)+'</td><td>'+h(d.owner)+'</td><td><span class="si-badge">'+h(d.stageLabel||'')+'</span></td><td>'+h(d.reason||'')+'</td><td>'+(d.amt?money(d.amt):'-')+'</td><td>'+(d.key?btn('열기','record',d.key):'')+'</td></tr>').join('')||'<tr><td colspan="6">해당 조건의 근거가 없습니다.</td></tr>')+'</tbody></table></div></section>';
  document.body.appendChild(shade);document.body.style.overflow='hidden';
  shade.onclick=e=>{if(e.target===shade)close();else onClick(e)};
  shade.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};
  shade.querySelector('button').focus();
 }
 function dcLine(vals,W,H,color,gid,fmt,action){
  const base=H-24,top=14,max=Math.max(1,...vals),step=(W-44)/Math.max(1,vals.length-1);
  const pts=vals.map((v,i)=>[16+i*step,base-(v/max)*(base-top)]);
  let li=vals.length-1;while(li>0&&!vals[li])li--;
  const path='M'+pts.slice(0,li+1).map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L');
  const hits=action?pts.map((p,i)=>'<rect data-si-action="'+action+'" data-value="'+(i+1)+'" x="'+(p[0]-step/2).toFixed(1)+'" y="0" width="'+step.toFixed(1)+'" height="'+H+'" fill="transparent" style="cursor:pointer"><title>'+(i+1)+'월 · '+h(fmt(vals[i]))+'</title></rect>').join(''):'';
  return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="none" style="overflow:visible">'+
   '<line x1="0" y1="'+base+'" x2="'+W+'" y2="'+base+'" stroke="#1c2946"/><line x1="0" y1="'+((base+top)/2).toFixed(1)+'" x2="'+W+'" y2="'+((base+top)/2).toFixed(1)+'" stroke="#16223c"/>'+
   '<path class="dc-draw" d="'+path+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+
   '<path class="dc-area" d="'+path+' L'+pts[li][0].toFixed(1)+','+base+' L16,'+base+' Z" fill="url(#'+gid+')"/>'+
   '<circle class="dc-dot" cx="'+pts[li][0].toFixed(1)+'" cy="'+pts[li][1].toFixed(1)+'" r="4" fill="'+color+'" stroke="#0c1424" stroke-width="2"/>'+
   '<text class="dc-dot" x="'+pts[li][0].toFixed(1)+'" y="'+(pts[li][1]-9).toFixed(1)+'" text-anchor="middle" style="font-weight:700;fill:#e6ecf7">'+h(fmt(vals[li]))+'</text>'+
   '<text x="16" y="'+(H-8)+'" text-anchor="middle">1월</text><text x="'+(16+5*step).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">6월</text><text x="'+(16+11*step).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">12월</text>'+
   '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+color+'" stop-opacity=".22"/><stop offset="1" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs>'+hits+'</svg>';
 }
 function dashConsole(s){
  const f=state(),curM=Number(f.month)||new Date().getMonth()+1,csY=root.ContractSalesData?.summarize({...f,month:0}),csM=root.ContractSalesData?.summarize({...f,month:curM});
  const mVals=Array.from({length:12},(_,i)=>{const x=root.ContractSalesData?.summarize({...f,month:i+1});return x?Math.max(0,x.netAmount):0});
  const inqVals=Array.from({length:12},()=>0);
  rows().inquiries.forEach(q=>{const d=M.date(q.created);if(d&&(f.year==='전체'||d.slice(0,4)===String(f.year)))inqVals[Number(d.slice(5,7))-1]++});
  const rs=repStats(s);lastDiags=diagnose(rs);
  const feed=feedRows(s,10),weekTotal=rs.reduce((a,x)=>a+x.weekly,0);
  const brands=[...new Set((root.ContractSalesData?.state().items||[]).map(r=>r.brand).filter(Boolean))];
  const bStats=brands.map(b=>{const x=root.ContractSalesData?.summarize({...f,brand:b});return {b,amt:x?Math.max(0,x.netAmount):0}}).sort((a,b)=>b.amt-a.amt).slice(0,4);
  const bTotal=Math.max(1,bStats.reduce((a,x)=>a+x.amt,0)),dColors=['#5B8DEF','#2FC6AE','#F2A93B','#9D86FF'];
  let off=0;const donut=bStats.map((x,i)=>{const len=x.amt/bTotal*239,seg='<circle data-si-action="brand-ev" data-value="'+a(x.b)+'" style="cursor:pointer" cx="50" cy="50" r="38" fill="none" stroke="'+dColors[i]+'" stroke-width="14" stroke-dasharray="'+Math.max(0,len-2).toFixed(1)+' 240" stroke-dashoffset="'+(-off).toFixed(1)+'"><title>'+h(x.b)+' '+money(x.amt)+'</title></circle>';off+=len;return seg}).join('');
  const stAll=root.PipelineWorkspace&&root.PipelineStages?root.PipelineWorkspace.rows({brand:f.brand,owner:f.owner}):[];
  const stCounts=root.PipelineStages?root.PipelineStages.definitions.map(d=>({...d,count:stAll.filter(r=>r.group===d.key).length})):[];
  const stMax=Math.max(1,...stCounts.map(x=>x.count));
  const p=(cls,head,note,body)=>'<div class="dc-p '+cls+'"><div class="dc-ph">'+head+(note?'<small>'+h(note)+'</small>':'')+'</div><div class="dc-pb">'+body+'</div></div>';
  const kpi=(label,val,sub,drill,cls)=>'<button type="button" class="dc-p dc-kpi c2 '+(cls||'')+'" data-si-action="drill" data-value="'+a(drill)+'"><span class="dc-ph">'+h(label)+'</span><b>'+h(val)+'</b><small>'+h(sub)+'</small></button>';
  const m0=x=>x===null||x===undefined?'확인 필요':money(x);
  const topbar='<div class="dc-topbar"><h2><i>◈</i>영업 상황실</h2><span class="dc-nav">'+btn('성과 분석 ↗','navigate','perf')+btn('컨트롤 타워 ↗','navigate','control')+'</span><span class="dc-live"><i></i>LIVE · '+h(new Date().toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})+' '+new Date().toTimeString().slice(0,5))+'</span></div>';
  const repTable='<div class="si-table-scroll"><table class="si-table si-people dc-table"><thead><tr><th>담당자</th><th>매출·월</th><th>매출·연</th><th>진행</th><th>예상금액</th><th>주간활동</th><th>문제</th><th>마지막 활동</th></tr></thead><tbody>'+rs.map(x=>{const prob=x.overdue+x.missing;return '<tr><td>'+btn(x.name,'person',x.name)+'</td><td><b>'+m0(x.mSales)+'</b></td><td><b>'+m0(x.ySales)+'</b></td><td>'+x.act.length+'</td><td>'+money(x.expected)+'</td><td>'+x.weekly+'건</td><td><span class="dc-pill'+(prob?'':' z')+'">'+prob+'</span></td><td class="dc-mut">'+(x.last?h(M.date(new Date(x.last.at).toISOString())+' '+x.last.site):'-')+'</td></tr>'}).join('')+'</tbody></table></div>';
  const diagBtns=lastDiags.map((d,i)=>'<button type="button" class="dc-diag '+d.cls+'" data-si-action="diag" data-value="'+i+'"><b>'+h(d.title)+'</b><small>'+h(d.sub)+'</small></button>').join('')||'<p class="dc-mut">현재 막힘 신호가 없습니다.</p>';
  const feedHtml=feed.map(x=>'<button type="button" class="dc-feed-row" data-si-action="record" data-value="'+a(x.key)+'"><time>'+h(M.date(x.at)||'')+'</time><span class="w">'+h(x.owner)+'</span><span class="t"><b>'+h(x.site)+'</b> '+h(x.text)+'</span><span class="m">'+(x.amt?money(x.amt):'')+'</span></button>').join('')||'<p class="dc-mut">기록된 활동이 없습니다.</p>';
  const actBars=[...rs].sort((a,b)=>b.weekly-a.weekly).slice(0,6).map(x=>{const t=Math.max(1,weekTotal);return '<button type="button" class="dc-hrow" data-si-action="rep-week" data-value="'+a(x.name)+'"><span>'+h(x.name)+'</span><span class="bar"><i style="width:'+(x.types.call/t*300)+'%"></i><i class="g" style="width:'+(x.types.visit/t*300)+'%"></i><i class="o" style="width:'+(x.types.quote/t*300)+'%"></i></span><b>'+x.weekly+'</b></button>'}).join('');
  return topbar+
   '<div class="dc-grid">'+
   kpi('이번 달 매출',m0(csM?csM.netAmount:null),'계약금액 기준 · '+curM+'월','contract')+
   kpi((f.month?'기간':'연 누적')+' 매출',m0(csY?csY.netAmount:null),'계약 '+(csY?csY.count:'-')+'건','contract')+
   kpi('파이프라인',money(s.expected),'진행 '+number(s.active.length)+'건','active')+
   kpi('문의',number(s.inquiries.length)+'건','선택 기간 접수','inquiries')+
   kpi('관리필요',number(s.risk.length)+'건','기한초과 '+s.active.filter(d=>d.issues.includes('overdue')).length+' · Next없음 '+s.active.filter(d=>d.issues.includes('missing')).length,'risk','bad')+
   kpi('주간 활동',number(weekTotal)+'건','최근 7일 전체','activity')+
   p('c5','매출 추이 · 월별','계약 체결일 기준 · 월 클릭=근거',dcLine(mVals,460,118,'#5B8DEF','dcg1',money,'cs-month'))+
   p('c4','문의 유입 · 월별','접수 기준 · 월 클릭=근거',dcLine(inqVals,380,118,'#2FC6AE','dcg2',v=>number(v)+'건','inq-month'))+
   p('c3','사업유형별 매출','조각 클릭=근거','<div class="dc-donut"><svg viewBox="0 0 100 100" width="92" height="92"><g transform="rotate(-90 50 50)">'+(donut||'<circle cx="50" cy="50" r="38" fill="none" stroke="#1a2745" stroke-width="14"/>')+'</g><text x="50" y="48" text-anchor="middle" class="dn">'+h(m0(csY?csY.netAmount:null))+'</text><text x="50" y="61" text-anchor="middle" class="dl">'+(f.month?f.month+'월':'연 누적')+'</text></svg><div class="dc-dleg">'+(bStats.map((x,i)=>'<span><i style="background:'+dColors[i]+'"></i>'+h(x.b)+'<b>'+Math.round(x.amt/bTotal*100)+'%</b></span>').join('')||'<span class="dc-mut">계약 원장 확인 필요</span>')+'</div></div>')+
   p('c3','영업 퍼널','클릭=해당 단계 작업함',stCounts.map(x=>'<button type="button" class="dc-hrow" data-si-action="stage" data-value="'+a(x.key)+'"><span>'+h(x.number+' '+x.label)+'</span><span class="bar"><i style="width:'+(x.count/stMax*100)+'%"></i></span><b>'+number(x.count)+'건</b></button>').join('')+'<button type="button" class="dc-hrow hot" data-si-action="drill" data-value="risk"><span>관리필요</span><span class="bar"><i class="r" style="width:'+(s.risk.length/stMax*100)+'%"></i></span><b>'+number(s.risk.length)+'</b></button>')+
   p('c6','담당자 종합','매출=계약금액 · 이름 클릭=상세',repTable)+
   p('c3','영업이 막힌 사람 · 판단근거','문장 클릭=근거 목록','<div class="dc-diags">'+diagBtns+'</div><div class="dc-riskchips">'+Object.keys(labels).map(k=>btn(labels[k]+' '+number(s.active.filter(d=>d.issues.includes(k)).length),'drill',k)).join('')+'</div>')+
   p('c8','전사 활동 피드','행 클릭=현장 상세','<div class="dc-feed">'+feedHtml+'</div>')+
   p('c4','이번 주 활동량 · 유형','담당자 클릭=활동 근거',actBars+'<div class="dc-legend"><span><i style="background:#5B8DEF"></i>전화·문자</span><span><i style="background:#2FC6AE"></i>방문·미팅</span><span><i style="background:#F2A93B"></i>견적·입찰</span></div>')+
   '</div>';
 }
 function animateConsole(host){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  host.querySelectorAll('.dc-draw').forEach((el,i)=>{try{const L=el.getTotalLength();el.style.strokeDasharray=L;el.style.strokeDashoffset=L;el.style.transition='stroke-dashoffset 1s cubic-bezier(.3,.6,.3,1) '+(0.3+i*0.15)+'s';requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.strokeDashoffset=0}))}catch(e){}});
  host.querySelectorAll('.dc-area,.dc-dot').forEach(el=>{el.style.opacity=0;el.style.transition='opacity .5s ease 1.1s';requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.opacity=1}))});
  host.querySelectorAll('.dc-donut g circle[stroke-dasharray]').forEach((c,i)=>{const d=c.getAttribute('stroke-dasharray');c.setAttribute('stroke-dasharray','0 240');c.style.transition='stroke-dasharray .9s cubic-bezier(.3,.6,.3,1) '+(0.4+i*0.12)+'s';requestAnimationFrame(()=>requestAnimationFrame(()=>{c.setAttribute('stroke-dasharray',d)}))});
  host.querySelectorAll('.dc-kpi b').forEach(b=>{const m=b.textContent.match(/^([0-9,]+(?:\.[0-9]+)?)(.*)$/);if(!m)return;const target=parseFloat(m[1].replace(/,/g,'')),suffix=m[2],dec=(m[1].split('.')[1]||'').length,t0=performance.now(),ease=t=>1-Math.pow(1-t,3);
   const step=ts=>{const t=Math.min((ts-t0)/800,1);b.textContent=(target*ease(t)).toLocaleString('ko-KR',{minimumFractionDigits:dec,maximumFractionDigits:dec})+suffix;if(t<1)requestAnimationFrame(step)};requestAnimationFrame(step)});
 }
 function render(){
  const page=root.G.page;if(!['dash','control','perf'].includes(page)||!root.B)return;
  const f=state(),s=data(),host=document.getElementById('si-'+page);
  if(!host)return;
  document.getElementById('pg-'+page).classList.add('si-active');
  const rep=page==='perf'&&f.view==='rep',selected=rep&&f.owner!=='전체';
  let body='';
  if(page==='control')body=control(s);
  else if(rep&&!selected)body='<div class="si-grid">'+card('영업사원 선택',empty('상단 담당자 필터에서 확인할 영업사원을 선택해 주세요.'))+'</div>';
  else if(page==='dash')body=dashConsole(s);
  else body=kpis(s,rep)+'<div class="si-grid">'+stages(s)+(rep?execution(s):trend(s))+'</div>'+(rep?card('현재 관리가 필요한 영업 · '+s.risk.length+'건',records(M.select(s,'risk',{}),8)+btn('전체 확인 →','drill','risk'))+recent(s):people(s,0));
  host.innerHTML='<div class="si-shell'+(page==='dash'?' si-dark':'')+'">'+filters()+(page==='perf'?'<div class="si-views" role="group" aria-label="분석 관점">'+btn('대표 보기','view','lead',f.view==='lead'?'selected':'')+btn('영업사원 보기','view','rep',rep?'selected':'')+'</div>':'')+'<p class="si-period">'+h(f.year)+'년 '+(f.month?f.month+'월':'연간')+' 접수·계약실적 / 파이프라인·관리필요는 현재 기준'+(s.missingWonDate?' · 수주 확정일 미입력 '+s.missingWonDate+'건 제외':'')+'</p>'+body+'</div>';
  root.ContractSalesUI?.mount(host.querySelector('.si-shell'),f);host.onclick=onClick;host.onchange=onChange;host.onkeydown=e=>{if(e.target.matches('[data-si-search]')&&e.key==='Enter'){f.search=e.target.value;f.page=1;render()}};
  // Keep metrics steady instead of replaying zero-to-total animations on refresh.
 }
 function onChange(e){const el=e.target,key=el.dataset.siFilter;if(key){const f=state();f[key]=['month','page'].includes(key)?Number(el.value):el.value;f.page=1;if(key==='kind'){f.issue='all';f.stage='all'}if(key==='owner')root.SalesScope.change('owner',el.value);render()}else if(el.matches('[data-si-search]')){state().search=el.value;state().page=1;render()}}
 function onClick(e){const b=e.target.closest('[data-si-action]');if(!b)return;const action=b.dataset.siAction,v=b.dataset.value,f=state();
  if(action==='navigate')root.goPage(v);
  if(action==='view'){f.view=v;render()}
  if(action==='page'){f.page=Number(v);render()}
  if(action==='stage'&&root.PipelineWorkspace){const filters={...f,owner:b.closest('#si-person')?.dataset.owner||f.owner};close(false);root.PipelineWorkspace.open(v,filters);return;}
  if(action==='drill'&&v==='contract'){document.querySelector('#si-'+root.G.page+' .contract-sales-panel')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(root.G.page==='dash'){
   const s=()=>data();
   if(action==='drill'){const d=s();let list=[],title='';
    if(v==='inquiries'){title='문의 · '+d.inquiries.length+'건';list=d.inquiries.map(evRow)}
    else if(v==='active'){title='진행 파이프라인 · '+d.active.length+'건';list=d.active.map(x=>({...evRow(x),reason:x.reason||'진행 중'}))}
    else if(v==='risk'){title='관리필요 · '+d.risk.length+'건';list=M.select(d,'risk',f).map(evRow)}
    else if(labels[v]){const rows2=d.active.filter(x=>x.issues.includes(v));title=labels[v]+' · '+rows2.length+'건';list=rows2.map(evRow)}
    else if(v==='activity'){title='최근 7일 활동 근거';list=feedRows(s(),40).filter(x=>Date.parse(x.at)>=Date.now()-7*864e5).map(x=>({site:x.site,owner:x.owner,stageLabel:'활동',reason:M.date(x.at)+' · '+x.text,amt:x.amt,key:x.key}))}
    if(title){openEvidence(title,f.year+'년 '+(f.month?f.month+'월':'연간')+' · 클릭한 지표의 근거 목록',list);return}
   }
   if(action==='cs-month'){openEvidence(f.year+'년 '+v+'월 매출 근거','계약 체결·변경·취소 원장 기록',contractEvidence({month:v}));return}
   if(action==='inq-month'){const list=rows().inquiries.filter(q=>{const d0=M.date(q.created);return d0&&(f.year==='전체'||d0.slice(0,4)===String(f.year))&&Number(d0.slice(5,7))===Number(v)}).map(evRow);openEvidence(f.year+'년 '+v+'월 문의 근거','접수 기준 '+list.length+'건',list);return}
   if(action==='brand-ev'){openEvidence(v+' 매출 근거','계약 원장 기록',contractEvidence({brand:v}));return}
   if(action==='diag'){const d0=lastDiags[Number(v)];if(!d0)return;const d=s();let list=[];
    if(d0.kind==='overdue')list=d.active.filter(x=>x.owner===d0.name&&x.issues.includes('overdue')).map(evRow);
    else if(d0.kind==='contact')list=d.active.filter(x=>x.owner===d0.name&&(x.issues.includes('contact')||x.issues.includes('unknown'))).map(evRow);
    else list=d.active.filter(x=>x.owner===d0.name).map(x=>({...evRow(x),reason:x.reason||x.stageLabel}));
    openEvidence(d0.title,d0.sub,list);return}
   if(action==='rep-week'){const list=feedRows(s(),60).filter(x=>x.owner===v&&Date.parse(x.at)>=Date.now()-7*864e5).map(x=>({site:x.site,owner:x.owner,stageLabel:'활동',reason:M.date(x.at)+' · '+x.text,amt:x.amt,key:x.key}));openEvidence(v+' · 이번 주 활동 근거',list.length+'건',list);return}
  }
  if(action==='drill'||action==='stage'){root.SalesFilterState.enter('control');f.kind=action==='stage'?'active':labels[v]?'risk':v;f.issue=labels[v]?v:'all';f.stage=action==='stage'?v:'all';f.search='';f.page=1;root.goPage('control')}
  if(action==='person')openPerson(v,b);
  if(action==='close')close();
  if(action==='record')openRecord(v);
 }
 function openRecord(key){
  // Recheck the current authorized bundle at click time; never keep stale row objects.
  const r=rows(),d=r.deals.concat(r.inquiries).find(x=>x.key===key);if(!d)return;
  close(false);root.G._detailPopup=true;
  if(d.type==='inq')root.drwInq(JSON.stringify(d.item));else root.drwDeal(JSON.stringify(d.item));
 }
 function close(restore=true){const node=document.getElementById('si-person');if(node){node.remove();document.body.style.overflow=''}if(restore&&focusBefore?.isConnected)focusBefore.focus();focusBefore=null}
 function openPerson(name,trigger){
  close(false);if(!rows().deals.some(d=>d.owner===name)&&!root.ContractSalesData?.state().items.some(r=>r.sales_owner_name===name))return;
  focusBefore=trigger||document.activeElement;const s=data(name),shade=document.createElement('div');
  shade.id='si-person';shade.dataset.owner=name;shade.className='modalshade on si-person';shade.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="si-person-title" class="si-person-box"><header><div><h2 id="si-person-title">'+h(name)+' 영업 현황</h2><p>'+h(state().year)+'년 '+(state().month?state().month+'월':'연간')+' · '+h(state().brand)+'</p></div>'+btn('닫기','close','','si-close')+'</header><div class="si-person-grid">'+card('담당자 요약','<dl class="si-facts"><div><dt>진행 영업</dt><dd>'+s.active.length+'건</dd></div><div><dt>예상금액</dt><dd>'+money(s.expected)+'</dd></div><div><dt>계약실적</dt><dd>'+(s.contractSummary?money(s.contractSummary.netAmount):'확인 필요')+'</dd></div><div><dt>계약 건수</dt><dd>'+(s.contractSummary?s.contractSummary.count:'확인 필요')+'건</dd></div></dl>')+'<div>'+stages(s,name)+execution(s)+'</div>'+card('관리 필요 · '+s.risk.length+'건',records(M.select(s,'risk',{})))+'</div></section>';
  document.body.appendChild(shade);root.ContractSalesUI?.mount(shade.querySelector('.si-person-box'),Object.assign({},state(),{owner:name}));document.body.style.overflow='hidden';shade.onclick=e=>{if(e.target===shade)close();else onClick(e)};
  shade.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}if(e.key==='Tab'){const nodes=[...shade.querySelectorAll('button,select,input,[tabindex="0"]')],first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};shade.querySelector('button').focus();
 }
 root.addEventListener('phase1:identity-cleared',()=>{close(false);root.G.insights=null;['dash','control','perf'].forEach(p=>{const el=document.getElementById('si-'+p);if(el)el.innerHTML=''})});
 root.SalesInsights={render,close,data,rows};
})(window);
