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
  return root.G.insights;
 }
 function rows(){
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
  return {deals,inquiries};
 }
 function data(owner){const f=Object.assign({},state());if(owner)f.owner=owner;const r=rows();return M.summarize(r.deals,r.inquiries,f)}
 function btn(text,action,value,cls){return '<button type="button" class="'+(cls||'')+'" data-si-action="'+action+'" data-value="'+a(value||'')+'">'+h(text)+'</button>'}
 function options(values,selected){return values.map(v=>'<option value="'+a(v[0])+'"'+(String(v[0])===String(selected)?' selected':'')+'>'+h(v[1])+'</option>').join('')}
 function select(label,key,values,value){return '<label>'+h(label)+'<select data-si-filter="'+key+'" aria-label="'+h(label)+'">'+options(values,value)+'</select></label>'}
 function filters(){
  const f=state(),r=rows(),all=r.deals.concat(r.inquiries),years=new Set([String(new Date().getFullYear()),f.year]);
  all.forEach(x=>[x.created,x.wonAt].forEach(v=>{const d=M.date(v);if(d)years.add(d.slice(0,4))}));
  const names=[...new Set(all.map(x=>x.owner).filter(Boolean))].sort(root.repCompare),brands=[...new Set(all.map(x=>x.brand).filter(Boolean))].sort();
  return '<div class="si-filters">'+select('연도','year',[...years].filter(x=>x!=='전체').sort().reverse().map(x=>[x,x+'년']),f.year)+select('기간','month',[[0,'연간'],...Array.from({length:12},(_,i)=>[i+1,(i+1)+'월'])],f.month)+select('브랜드','brand',[['전체','전체 브랜드'],...brands.map(x=>[x,x])],f.brand)+select('담당자','owner',[['전체','전체 담당자'],...names.map(x=>[x,x])],f.owner)+'</div>';
 }
 function kpis(s,rep){
  const defs=rep?[['진행 영업',number(s.active.length)+'건','현재','active'],['예상금액',money(s.expected),'현재 진행 중','active'],['수주금액',money(s.wonAmount),'선택 기간 · 확정 금액','won'],['미접촉',number(s.active.filter(d=>d.issues.includes('contact')).length)+'건','최근 접촉 7일 이상','contact'],['Next 없음',number(s.active.filter(d=>d.issues.includes('missing')).length)+'건','행동 또는 기한 미입력','missing']]:[['문의',number(s.inquiries.length)+'건','선택 기간 접수','inquiries'],['진행중',number(s.active.length)+'건','현재 보유 파이프라인','active'],['예상 파이프라인 금액',money(s.expected),'현재 진행 중','active'],['수주금액',money(s.wonAmount),'선택 기간 · 확정 금액','won'],['관리필요',number(s.risk.length)+'건','영업 건 수 · 사유 중복 제외','risk']];
  return '<div class="si-kpis">'+defs.map(x=>'<button data-si-action="drill" data-value="'+x[3]+'"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></button>').join('')+'</div>';
 }
 function card(title,body,note){return '<section class="si-card"><header><h3>'+h(title)+'</h3>'+(note?'<p>'+h(note)+'</p>':'')+'</header>'+body+'</section>'}
 const empty=text=>'<p class="si-empty">'+h(text||'선택한 조건의 데이터가 없습니다.')+'</p>';
 function stages(s,owner){if(root.PipelineWorkspace&&root.PipelineStages){const f={...state(),owner:owner||state().owner},all=root.PipelineWorkspace.rows({brand:f.brand,owner:f.owner}),counts=root.PipelineStages.definitions.map(d=>({...d,count:all.filter(r=>r.group===d.key).length})),max=Math.max(1,...counts.map(x=>x.count));return card('현재 영업 흐름',counts.map(x=>'<button class="si-bar" data-si-action="stage" data-value="'+a(x.key)+'"><span>'+h(x.number+' '+x.label)+'</span><i style="--size:'+x.count/max*100+'%"></i><b>'+number(x.count)+'건</b></button>').join(''),'현재 적재 기준 · 확장은 기존 수주와 연결된 별도 기회');}return card('현재 영업 흐름',empty());}

 function risks(s){return card('지금 관리가 필요한 것','<div class="si-risk-links">'+Object.keys(labels).map(k=>btn(labels[k]+' '+number(s.active.filter(d=>d.issues.includes(k)).length)+'건','drill',k)).join('')+'</div>'+btn('전체 확인 →','drill','risk'),'한 영업 건에 여러 사유가 있을 수 있습니다.');}
 function people(s,limit){
  const names=[...new Set(s.deals.map(x=>x.owner))].filter(n=>root.repProfile(n).performanceIncluded&&root.repProfile(n).active).sort(root.repCompare);
  const r=names.map(name=>({name,s:M.summarize(s.deals,s.inquiries,Object.assign({},state(),{owner:name}))}));
  return card('담당자 현황','<div class="si-table-scroll"><table class="si-table si-people"><thead><tr><th>담당자</th><th>진행</th><th>예상금액</th><th>기간 수주</th><th>기한초과</th><th>Next 없음</th></tr></thead><tbody>'+r.slice(0,limit||r.length).map(x=>'<tr><td>'+btn(x.name,'person',x.name)+'</td><td>'+number(x.s.active.length)+'</td><td>'+money(x.s.expected)+'</td><td>'+money(x.s.wonAmount)+'</td><td>'+number(x.s.active.filter(d=>d.issues.includes('overdue')).length)+'</td><td>'+number(x.s.active.filter(d=>d.issues.includes('missing')).length)+'</td></tr>').join('')+'</tbody></table></div>'+(r.length?'':empty())+btn('성과 분석 전체보기 →','navigate','perf'),'개인 성과 대상 담당자 · 회사 합계에는 운영관리자 담당 건도 포함됩니다.');
 }
 function trend(s){const visible=s.trend.filter(x=>!state().month||x.month===Number(state().month)),max=Math.max(1,...visible.map(x=>x.amount));return card('기간 수주 실적',visible.map(x=>'<div class="si-bar"><span>'+x.month+'월 · '+x.count+'건</span><i style="--size:'+x.amount/max*100+'%"></i><b>'+money(x.amount)+'</b></div>').join(''),'계약 확정일 기준 · 금액 미입력 '+s.missingWon+'건');}
 function execution(s){const ready=s.active.filter(d=>!d.issues.includes('missing')).length;return card('실행 관리','<dl class="si-facts"><div><dt>다음 행동·기한 등록</dt><dd>'+ready+' / '+s.active.length+'건</dd></div><div><dt>다음 행동 기한초과</dt><dd>'+s.active.filter(d=>d.issues.includes('overdue')).length+'건</dd></div><div><dt>접촉 기록 없음</dt><dd>'+s.active.filter(d=>d.issues.includes('unknown')).length+'건</dd></div></dl>','현재 등록된 행동과 접촉 기록 기준');}
 function records(list,limit){return '<div class="si-records">'+(list.slice(0,limit||list.length).map(d=>'<div><span><b>'+h(d.site)+'</b><small>'+h(d.reason||d.stageLabel)+'</small></span>'+btn(d.type==='inq'&&d.owner==='미배정'?'배정':'처리','record',d.key)+'</div>').join('')||empty())+'</div>';}
 function recent(s){
  const seen=new Set(),logs=[];s.deals.forEach(d=>{const patch=root.itemPatch(d.item,'deal');[...(d.item.activities||[]),...(patch.activities||[])].forEach(x=>{const at=x.at||x.created_at||x.occurred_at,k=d.key+':'+(x.id||[at,x.type,x.note||x.result].join('|'));if(seen.has(k)||!M.inPeriod(at,state()))return;seen.add(k);logs.push({at,site:d.site,text:x.note||x.result||root.siteActivityTitle(x.type||'활동')})})});
  logs.sort((a,b)=>String(b.at).localeCompare(String(a.at)));return card('최근 활동',logs.length?'<ol class="si-activity">'+logs.slice(0,8).map(x=>'<li><time>'+h(M.date(x.at))+'</time><div><b>'+h(x.site)+'</b><p>'+h(x.text)+'</p></div></li>').join('')+'</ol>':empty('선택 기간에 기록된 활동이 없습니다.'));
 }
 function control(s){
  const f=state(),list=M.select(s,f.kind,f),size=20,pages=Math.max(1,Math.ceil(list.length/size));f.page=Math.min(f.page,pages);
  const kinds=[['risk','관리필요'],['active','진행중 전체'],['inquiries','기간 문의'],['won','기간 수주']];
  const stageOptions=[['all','전체 단계'],...s.stages.map(x=>[x.code,x.label])];
  return '<div class="si-control-filters">'+select('목록','kind',kinds,f.kind)+select('관리유형','issue',[['all','전체'],['urgent','긴급 · 기한초과'],...Object.entries(labels)],f.issue)+select('단계','stage',stageOptions,f.stage)+'<label>현장 검색<input data-si-search value="'+a(f.search)+'" placeholder="현장·담당자·사유" aria-label="현장 검색"></label></div>'+card('관리 대상 · '+number(list.length)+'건','<div class="si-table-scroll"><table class="si-table si-cases"><thead><tr><th>현장</th><th>담당자</th><th>현재 단계</th><th>확인할 내용</th><th>처리</th></tr></thead><tbody>'+list.slice((f.page-1)*size,f.page*size).map(d=>'<tr><td>'+h(d.site)+'</td><td>'+h(d.owner)+'</td><td><span class="si-badge">'+h(d.stageLabel)+'</span></td><td>'+h(f.kind==='won'?'수주 '+money(d.wonAmount)+(d.hasWonAmount?'':' · 금액 미입력'):d.reason||'현재 진행 중')+'</td><td>'+btn(d.type==='inq'&&d.owner==='미배정'?'배정':'처리','record',d.key)+'</td></tr>').join('')+'</tbody></table></div>'+(list.length?'':empty())+'<div class="si-pager">'+btn('이전','page',Math.max(1,f.page-1))+'<span>'+f.page+' / '+pages+'</span>'+btn('다음','page',Math.min(pages,f.page+1))+'</div>','진행 중·관리필요는 현재 상태, 문의·수주는 선택 기간 기준입니다.');
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
  else body=kpis(s,rep)+'<div class="si-grid">'+stages(s)+(page==='dash'?risks(s):rep?execution(s):trend(s))+'</div>'+(rep?card('현재 관리가 필요한 영업 · '+s.risk.length+'건',records(M.select(s,'risk',{}),8)+btn('전체 확인 →','drill','risk'))+recent(s):people(s,page==='dash'?8:0));
  host.innerHTML='<div class="si-shell"><nav class="si-nav" aria-label="영업 현황 화면">'+[['dash','영업 대시보드'],['control','컨트롤타워'],['perf','성과 분석']].map(x=>btn(x[1],'navigate',x[0],page===x[0]?'selected':'')).join('')+'</nav>'+filters()+(page==='perf'?'<div class="si-views" role="group" aria-label="분석 관점">'+btn('대표 보기','view','lead',f.view==='lead'?'selected':'')+btn('영업사원 보기','view','rep',rep?'selected':'')+'</div>':'')+'<p class="si-period">'+h(f.year)+'년 '+(f.month?f.month+'월':'연간')+' 접수·수주 / 파이프라인·관리필요는 현재 기준'+(s.missingWonDate?' · 수주 확정일 미입력 '+s.missingWonDate+'건 제외':'')+'</p>'+body+'</div>';
  host.onclick=onClick;host.onchange=onChange;host.onkeydown=e=>{if(e.target.matches('[data-si-search]')&&e.key==='Enter'){f.search=e.target.value;f.page=1;render()}};
 }
 function onChange(e){const el=e.target,key=el.dataset.siFilter;if(key){const f=state();f[key]=['month','page'].includes(key)?Number(el.value):el.value;f.page=1;if(key==='kind'){f.issue='all';f.stage='all'}render()}else if(el.matches('[data-si-search]')){state().search=el.value;state().page=1;render()}}
 function onClick(e){const b=e.target.closest('[data-si-action]');if(!b)return;const action=b.dataset.siAction,v=b.dataset.value,f=state();
  if(action==='navigate')root.goPage(v);
  if(action==='view'){f.view=v;render()}
  if(action==='page'){f.page=Number(v);render()}
  if(action==='stage'&&root.PipelineWorkspace){close(false);root.PipelineWorkspace.open(v,f);return;}
  if(action==='drill'||action==='stage'){f.kind=action==='stage'?'active':labels[v]?'risk':v;f.issue=labels[v]?v:'all';f.stage=action==='stage'?v:'all';f.search='';f.page=1;root.goPage('control')}
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
  close(false);if(!rows().deals.some(d=>d.owner===name))return;
  focusBefore=trigger||document.activeElement;const s=data(name),shade=document.createElement('div');
  shade.id='si-person';shade.className='modalshade on si-person';shade.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="si-person-title" class="si-person-box"><header><div><h2 id="si-person-title">'+h(name)+' 영업 현황</h2><p>'+h(state().year)+'년 '+(state().month?state().month+'월':'연간')+' · '+h(state().brand)+'</p></div>'+btn('닫기','close','','si-close')+'</header><div class="si-person-grid">'+card('담당자 요약','<dl class="si-facts"><div><dt>진행 영업</dt><dd>'+s.active.length+'건</dd></div><div><dt>예상금액</dt><dd>'+money(s.expected)+'</dd></div><div><dt>기간 수주</dt><dd>'+money(s.wonAmount)+'</dd></div><div><dt>수주 건수</dt><dd>'+s.won.length+'건</dd></div></dl>')+'<div>'+stages(s,name)+execution(s)+'</div>'+card('관리 필요 · '+s.risk.length+'건',records(M.select(s,'risk',{})))+'</div></section>';
  document.body.appendChild(shade);document.body.style.overflow='hidden';shade.onclick=e=>{if(e.target===shade)close();else onClick(e)};
  shade.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}if(e.key==='Tab'){const nodes=[...shade.querySelectorAll('button,select,input,[tabindex="0"]')],first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};shade.querySelector('button').focus();
 }
 root.addEventListener('phase1:identity-cleared',()=>{close(false);root.G.insights=null;['dash','control','perf'].forEach(p=>{const el=document.getElementById('si-'+p);if(el)el.innerHTML=''})});
 root.SalesInsights={render,close,data,rows};
})(window);
