(function(root){
 'use strict';
 const M=root.SalesInsightsModel,h=v=>root.esc(String(v??'')),a=v=>root.escAttr(String(v??''));
 const labels={stall:'진행 멈춤',promise:'고객 약속 미이행',overdue:'기한초과',missing:'다음 할 일 없음',contact:'마지막 연락 7일 이상 전',unknown:'연락 기록 없음',stale:'장기정체',amount:'예상금액 미입력'};
 let actor='',focusBefore=null;
 const number=n=>Number(n||0).toLocaleString('ko-KR');
 const money=n=>n>=100000000?(n/100000000).toLocaleString('ko-KR',{maximumFractionDigits:2})+'억':number(Math.round(n/10000))+'만원';
 function state(){
  const id=String(root.ME?.id||root.ME?.name||'');
  if(actor!==id){actor=id;root.G.insights=null;close(false)}
  if(!root.G.insights){const now=new Date();root.G.insights={year:String(now.getFullYear()),month:0,quarter:Math.ceil((now.getMonth()+1)/3),brand:'전체',owner:'전체',view:'lead',kind:'risk',issue:'all',stage:'all',search:'',page:1}}
  if(root.G.insights.quarter===undefined)root.G.insights.quarter=0;
  root.G.insights.brand=root.G.brand;root.G.insights.owner=root.SalesScope.state().owner;return root.G.insights;
 }
 function rows(unscoped=false){
  // B is ACL-filtered by the operational adapter. Apply the same per-user UI scope as Today.
  const admin=root.todayIsAdmin(),me=root.repN(root.ME?.name),base=root.B||{};
  const deals=(base.deals||[]).filter(d=>admin||root.repN(d.assignee)===me).map(d=>{
   const next=root.briefNext(d),meta=root.relationshipMeta(d),old=root.issueSet(d),issues=[];
   const due=next?.due&&Number.isFinite(Date.parse(next.due))?root.daysTo(next.due):null;
   if(due!==null&&due<0)issues.push('overdue');
   if(due!==null&&due<0&&(/약속/.test(String(next?.type||''))||/^\s*고객\s*약속/.test(String(next?.text||''))))issues.unshift('promise');/* 상세 '약속했어요' 칩=종류 '고객 약속', 결과 창 칩=문구 '고객 약속:' — 둘 다 *//* 고객 약속 미이행 — 관리자 예외 최우선 */
   if(!next?.text||due===null)issues.push('missing');
   if(meta.days!==null&&meta.days>=(root.OPS_RULES?.contactWarnDays??7))issues.push('contact');
   if(meta.days===null)issues.push('unknown');
   if(old.includes('stale'))issues.push('stale');
   if(!(root.oppAmt(d)>0)&&!root.amountUnknownReason(d))issues.push('amount');
   /* 흐름 멈춤(2026-09-25 컨설턴트 '행동의 연속성'): 단계는 그대로인데 고객 접촉과 다음 할 일이 끊긴 영업.
      같은 '자료 발송완료'라도 꾸준히 움직인 건과 발송 후 아무 기록 없는 건을 구분한다. 기준 일수 = OPS_RULES.stallDays */
   const stallN=Number(root.OPS_RULES?.stallDays??7),age=root.stageAge?root.stageAge(d):null;
   const stall=age!==null&&age>=stallN&&(meta.days===null||meta.days>=stallN)&&(issues.includes('missing')||issues.includes('overdue'));
   if(stall)issues.push('stall');
   const stallText=stall?root.stageLabel(root.dealStage(d))+' '+age+'일째 · 마지막 연락 '+(meta.days===null?'기록 없음':meta.days+'일 전')+' · '+(issues.includes('missing')?'다음 할 일 없음':'기한 '+Math.abs(due)+'일 지남'):'';
   return {key:'deal:'+root.dealKey(d),type:'deal',item:d,site:d.site||'현장명 미입력',owner:root.repN(d.assignee),brand:d.brand||'',created:d.created,active:root.towerActive(d)&&root.outcomeOf(d)==='open',won:root.isWon(d),wonAt:root.wonDate(d),wonAmount:root.hasWonAmt(d)?root.wonAmt(d):0,hasWonAmount:root.hasWonAmt(d),expected:root.oppAmt(d),stage:root.dealStage(d),stageLabel:root.stageLabel(root.dealStage(d)),issues,stallText,reason:stall?(issues.includes('promise')?'고객 약속 미이행 · ':'')+'진행 멈춤 — '+stallText:issues.map(k=>k==='overdue'?'기한 '+Math.abs(due)+'일 지남':k==='contact'?'마지막 연락 '+meta.days+'일 전':labels[k]).join(' · '),lastContact:meta.meaningfulAt||''};
  });
  const inquiries=root.operationalInquiries(base.inquiries||[]).filter(q=>admin||root.inquiryRoutedOwner(q)===me||root.inquiryConsultant(q)===me).map(q=>({key:'inq:'+String(q.id||root.inqKey(q)),type:'inq',item:q,site:q.site||'현장명 미입력',owner:root.inquiryRoutedOwner(q)||'미배정',brand:q.brand||'',created:root.inquiryDate(q),stage:'inquiry',stageLabel:q.status||'견적문의',issues:[],reason:root.inquiryRoutedOwner(q)?'문의 내용과 후속처리 확인':'담당자 배정 필요'}));
  return {deals:deals.filter(d=>unscoped||root.SalesScope.matches(d.owner,d.item)&&root.SalesFilterState.matchesBrand(d.brand)),inquiries:inquiries.filter(q=>unscoped||root.SalesScope.matches(q.owner,q.item)&&root.SalesFilterState.matchesBrand(q.brand))};
 }
 /* 계약실적 취합(2026-09-24 대표 지시): 원장이 준비되면 원장, 아니면 계약·시공 단계 영업건에 입력된 계약금액을 체결일 기준으로 취합. '확인 필요' 공백 금지. */
 function csFallback(f){
  try{
   const deals=(root.B&&root.B.deals)||[];if(!deals.length)return null;
   const inP=iso=>{if(!iso)return false;iso=String(iso);if(String(f.year)!=='전체'&&iso.slice(0,4)!==String(f.year))return false;const m=+iso.slice(5,7);if(Number(f.month))return m===Number(f.month);if(Number(f.quarter))return Math.ceil(m/3)===Number(f.quarter);return true};
   let amt=0,n=0;
   deals.forEach(d=>{
    const r=root.perfStageRank(root.dealStage(d)),won=root.outcomeOf(d)==='won';
    if(!(won||(r!==null&&r>=10)))return;
    if(f.owner&&f.owner!=='전체'&&root.repN(d.assignee)!==f.owner)return;
    if(f.brand&&f.brand!=='전체'&&d.brand!==f.brand)return;
    /* 날짜·금액 증거 없는 건은 임의 추정하지 않는다(체결일 정책) — 원장이 뜨면 원장이 정본 */
    if(!root.hasWonAmt(d))return;
    const at=d.contract_date||root.wonDate(d)||(won?d.closed:'');
    if(!at||!inP(at))return;
    amt+=Number(root.wonAmt(d))||0;n++;
   });
   return {netAmount:amt,signedCount:n,count:n,fallback:true};
  }catch(e){return null}
 }
 let csKicked=false;
 function csSum(f){
  const cs=root.ContractSalesData;
  const st=cs&&cs.state?cs.state():null;
  if(st&&st.status==='ready'&&cs.summarize)return cs.summarize(f)||csFallback(f);
  /* 분석 화면에서 원장 mount가 사라져 refresh 트리거가 없음(2026-09-24) — idle이면 여기서 직접 깨우고, 준비되면 다시 그린다 */
  if(st&&st.status==='idle'&&cs.refresh&&!csKicked){
   csKicked=true;
   try{cs.refresh()}catch(e){}
   let n=0;const t=setInterval(()=>{n++;const s2=cs.state();
    if(s2.status==='ready'||s2.status==='error'||n>24){clearInterval(t);
     if(s2.status==='ready'&&typeof root.paint==='function'){try{root.paint()}catch(e){}}}},500);
  }
  return csFallback(f);
 }
 function data(owner){const f=Object.assign({},state());if(owner)f.owner=owner;const r=rows();const summary=M.summarize(r.deals,r.inquiries,f);summary.contractSummary=csSum(f);return summary}
 function btn(text,action,value,cls){return '<button type="button" class="'+(cls||'')+'" data-si-action="'+action+'" data-value="'+a(value||'')+'">'+h(text)+'</button>'}
 function options(values,selected){return values.map(v=>'<option value="'+a(v[0])+'"'+(String(v[0])===String(selected)?' selected':'')+'>'+h(v[1])+'</option>').join('')}
 function select(label,key,values,value){return '<label>'+h(label)+'<select data-si-filter="'+key+'" aria-label="'+h(label)+'">'+options(values,value)+'</select></label>'}
 function yearOptions(){
  const f=state(),r=rows(true),years=new Set([String(new Date().getFullYear()),f.year]);
  r.deals.concat(r.inquiries).forEach(x=>[x.created,x.wonAt].forEach(v=>{const d=M.date(v);if(d)years.add(d.slice(0,4))}));
  return [...years].filter(x=>x!=='전체').sort().reverse().map(x=>[x,x+'년']);
 }
 /* 연도·분기는 별도 블록이 아니라 콘솔 앱바 안의 슬림 세그먼트로 (2026-09-24 지시). */
 function periodSeg(){
  const f=state();
  return '<span class="dc-period"><select data-si-filter="year" aria-label="연도">'+options(yearOptions(),f.year)+'</select><span class="dc-qseg" role="group" aria-label="기간">'+[[0,'연간'],[1,'1분기'],[2,'2분기'],[3,'3분기'],[4,'4분기']].map(([v,t])=>'<button type="button" data-si-action="quarter" data-value="'+v+'"'+(Number(f.quarter)===v&&!f.month?' class="on"':'')+'>'+t+'</button>').join('')+'</span></span>';
 }
 function filters(slim){
  const f=state(),r=rows(true),all=r.deals.concat(r.inquiries);
  return root.SalesFilters.controls(all)+(slim?'':'<div class="si-filters">'+select('연도','year',yearOptions(),f.year)+select('기간','month',[[0,'연간'],...Array.from({length:12},(_,i)=>[i+1,(i+1)+'월'])],f.month)+'</div>');
 }
 function kpis(s,rep){
  const defs=rep?[['진행 영업',number(s.active.length)+'건','현재','active'],['예상금액',money(s.expected),'현재 진행 중','active'],['계약실적',s.contractSummary?money(s.contractSummary.netAmount):'확인 필요','계약 체결일 기준','contract'],['마지막 연락 7일 이상 전',number(s.active.filter(d=>d.issues.includes('contact')).length)+'건','연락 기록 기준','contact'],['다음 할 일 없음',number(s.active.filter(d=>d.issues.includes('missing')).length)+'건','할 일 또는 날짜 미입력','missing']]:[['문의',number(s.inquiries.length)+'건','선택 기간 접수','inquiries'],['진행중',number(s.active.length)+'건','현재 보유 파이프라인','active'],['예상 파이프라인 금액',money(s.expected),'현재 진행 중','active'],['계약실적',s.contractSummary?money(s.contractSummary.netAmount):'확인 필요','계약 체결일 기준','contract'],['조치 필요',number(s.risk.length)+'건','영업 건 수 · 사유 중복 제외','risk']];
  return '<div class="si-kpis">'+defs.map(x=>'<button data-si-action="drill" data-value="'+x[3]+'"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></button>').join('')+'</div>';
 }
 function card(title,body,note){return '<section class="si-card"><header><h3>'+h(title)+'</h3>'+(note?'<p>'+h(note)+'</p>':'')+'</header>'+body+'</section>'}
 const empty=text=>'<p class="si-empty">'+h(text||'선택한 조건의 데이터가 없습니다.')+'</p>';
 function stages(s,owner){if(root.PipelineWorkspace&&root.PipelineStages){const f={...state(),owner:owner||state().owner},all=root.PipelineWorkspace.rows({brand:f.brand,owner:f.owner}),counts=root.PipelineStages.definitions.map(d=>({...d,count:all.filter(r=>r.group===d.key).length})),max=Math.max(1,...counts.map(x=>x.count));return card('현재 영업 흐름',counts.map(x=>'<button class="si-bar" data-si-action="stage" data-value="'+a(x.key)+'"><span>'+h(x.number+' '+x.label)+'</span><i style="--size:'+x.count/max*100+'%"></i><b>'+number(x.count)+'건</b></button>').join(''),'현재 적재 기준 · 확장은 기존 수주와 연결된 별도 기회');}return card('현재 영업 흐름',empty());}

 function risks(s){return card('지금 관리가 필요한 것','<div class="si-risk-links">'+Object.keys(labels).map(k=>btn(labels[k]+' '+number(s.active.filter(d=>d.issues.includes(k)).length)+'건','drill',k)).join('')+'</div>'+btn('전체 확인 →','drill','risk'),'한 영업 건에 여러 사유가 있을 수 있습니다.');}
 function people(s,limit){
  const names=[...new Set(s.deals.map(x=>x.owner).concat(root.ContractSalesData?.state().items.map(x=>x.sales_owner_name)||[]))].filter(n=>root.SalesScope.people().some(p=>p.name===n)).sort(root.repCompare);
  const r=names.map(name=>({name,s:M.summarize(s.deals,s.inquiries,Object.assign({},state(),{owner:name})),cs:csSum(Object.assign({},state(),{owner:name}))}));
  return card('담당자 현황','<div class="si-table-scroll"><table class="si-table si-people"><thead><tr><th>담당자</th><th>진행</th><th>예상금액</th><th>계약실적</th><th>기한초과</th><th>다음 할 일 없음</th></tr></thead><tbody>'+r.slice(0,limit||r.length).map(x=>'<tr><td>'+btn(x.name,'person',x.name)+'</td><td>'+number(x.s.active.length)+'</td><td>'+money(x.s.expected)+'</td><td>'+(x.cs?money(x.cs.netAmount):'확인 필요')+'</td><td>'+number(x.s.active.filter(d=>d.issues.includes('overdue')).length)+'</td><td>'+number(x.s.active.filter(d=>d.issues.includes('missing')).length)+'</td></tr>').join('')+'</tbody></table></div>'+(r.length?'':empty())+btn('성과 분석 전체보기 →','navigate','perf'),'선택한 영업 분석 대상 담당자 기준 · 미배정은 배정상태 필터에서 확인합니다.');
 }
 function trend(s){const f=state(),months=Array.from({length:12},(_,i)=>({month:i+1,s:csSum({...f,month:i+1,quarter:0})})).filter(x=>!f.month||x.month===Number(f.month));return card('월별 계약실적',months.map(x=>'<div class="si-bar"><span>'+x.month+'월</span><b>'+(x.s?money(x.s.netAmount):'확인 필요')+'</b></div>').join(''),'계약 체결일 기준 · 변경·취소는 발생일 반영');}
 function execution(s){const ready=s.active.filter(d=>!d.issues.includes('missing')).length;return card('실행 관리','<dl class="si-facts"><div><dt>다음 할 일·기한 등록</dt><dd>'+ready+' / '+s.active.length+'건</dd></div><div><dt>다음 할 일 기한초과</dt><dd>'+s.active.filter(d=>d.issues.includes('overdue')).length+'건</dd></div><div><dt>연락 기록 없음</dt><dd>'+s.active.filter(d=>d.issues.includes('unknown')).length+'건</dd></div></dl>','현재 등록된 다음 할 일과 연락 기록 기준');}
 function records(list,limit){return '<div class="si-records">'+(list.slice(0,limit||list.length).map(d=>'<div><span><b>'+h(d.site)+'</b><small>'+h(d.reason||d.stageLabel)+'</small></span>'+btn(d.type==='inq'&&d.owner==='미배정'?'배정':'처리','record',d.key)+'</div>').join('')||empty())+'</div>';}
 function recent(s){
  const seen=new Set(),logs=[];s.deals.forEach(d=>{const patch=root.itemPatch(d.item,'deal');[...(d.item.activities||[]),...(patch.activities||[])].forEach(x=>{const at=x.at||x.created_at||x.occurred_at,k=d.key+':'+(x.id||[at,x.type,x.note||x.result].join('|'));if(seen.has(k)||!M.inPeriod(at,state()))return;seen.add(k);logs.push({at,site:d.site,text:x.note||x.result||root.siteActivityTitle(x.type||'활동')})})});
  logs.sort((a,b)=>String(b.at).localeCompare(String(a.at)));return card('최근 활동',logs.length?'<ol class="si-activity">'+logs.slice(0,8).map(x=>'<li><time>'+h(M.date(x.at))+'</time><div><b>'+h(x.site)+'</b><p>'+h(x.text)+'</p></div></li>').join('')+'</ol>':empty('선택 기간에 기록된 활동이 없습니다.'));
 }
 /* 컨트롤타워 v3 (2026-09-24 승인 시안): "어디가 막혔고 누구에게 무엇을 시킬 것인가".
    ① 막힌 곳 문장 → ② 담당자별 문제·지시 → ③ 좁혀진 목록 + 일괄 지시(다음 업무 지정, PipelineBatch 재사용). */
 const ISSUE_DAYS=/([0-9]+)일/;
 function ctState(){if(!root.G.ct)root.G.ct={owner:'',issue:'all'};return root.G.ct}
 function ctDays(d){const m=String(d.reason||'').match(ISSUE_DAYS);return m?Number(m[1]):0}
 /* 지원 요청 집계: [지원 요청] 메모(14일 이내), 이후 [지원 처리] 메모가 있으면 해소 */
 function ctSupport(s){
  const map={};let n=0;
  s.active.forEach(d=>{
   const patch=root.itemPatch?root.itemPatch(d.item,'deal'):{};
   const rows=[...(d.item.activities||[]),...((patch&&patch.activities)||[])]
    .map(x=>({at:String(x.at||x.occurred_at||''),note:String(x.note||'')}))
    .sort((a,b)=>b.at.localeCompare(a.at));
   const req=rows.find(x=>x.note.startsWith('[지원 요청]'));
   if(!req)return;
   const days=root.daysTo?root.daysTo(req.at.slice(0,10)):null;
   if(days!==null&&days<-14)return;
   const resolved=rows.some(x=>x.note.startsWith('[지원 처리]')&&x.at>req.at);
   if(resolved)return;
   map[d.key]={text:req.note.replace('[지원 요청]','').trim().slice(0,80),at:req.at.slice(0,10)};n++;
  });
  return {map,n};
 }
 function ctVerdicts(s,f){
  const act=s.active,out=[];
  const conc=k=>{const list=act.filter(d=>d.issues.includes(k));if(!list.length)return null;const by={};list.forEach(d=>{by[d.owner]=(by[d.owner]||0)+1});const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];return {k,name:top[0],n:top[1],tot:list.length,old:Math.max(0,...list.filter(d=>d.owner===top[0]).map(ctDays))}};
  const pr=conc('promise');if(pr)out.push({cls:'',owner:pr.name,issue:'promise',kind:'risk',html:'<span class="who">'+h(pr.name)+'</span> — 🤝 고객 약속 미이행 <b>'+pr.tot+'건'+(pr.tot>pr.n?' 중 '+pr.n+'건':'')+'</b>. 고객과 약속한 날이 지났습니다.'+(pr.old?' 최장 <b>'+pr.old+'일</b>.':'')});
  const stl=conc('stall');if(stl&&!out.some(x=>x.owner===stl.name))out.push({cls:'',owner:stl.name,issue:'stall',kind:'risk',html:'<span class="who">'+h(stl.name)+'</span> — 진행 멈춤 <b>'+stl.tot+'건 중 '+stl.n+'건</b>. 단계는 그대로인데 연락과 다음 할 일이 끊겼습니다.'});
  const ov=conc('overdue');if(ov)out.push({cls:'',owner:ov.name,issue:'overdue',kind:'risk',html:'<span class="who">'+h(ov.name)+'</span> — 기한초과 <b>'+ov.tot+'건 중 '+ov.n+'건</b>이 몰려 있습니다.'+(ov.old?' 최장 <b>'+ov.old+'일 지남</b>.':'')});
  const ms=conc('missing');if(ms&&ms.name!==ov?.name)out.push({cls:'',owner:ms.name,issue:'missing',kind:'risk',html:'<span class="who">'+h(ms.name)+'</span> — 다음 할 일 없음 <b>'+ms.tot+'건 중 '+ms.n+'건</b>. 다음 할 일이 비어 있습니다.'});
  const ct7=conc('contact');if(ct7&&!out.some(x=>x.owner===ct7.name))out.push({cls:'w',owner:ct7.name,issue:'contact',kind:'risk',html:'<span class="who">'+h(ct7.name)+'</span> — 마지막 연락 7일 이상 전 <b>'+ct7.tot+'건 중 '+ct7.n+'건</b>.'+(ct7.old?' 최장 <b>마지막 연락 '+ct7.old+'일 전</b>.':'')});
  const un=s.inquiries.filter(q=>q.owner==='미배정');
  if(un.length){const old=Math.max(0,...un.map(q=>{const d0=M.date(q.created);return d0?Math.max(0,-root.daysTo(d0)):0}));out.push({cls:'w',owner:'미배정',issue:'all',kind:'inquiries',html:'미배정 문의 <b>'+un.length+'건</b>'+(old?' — 가장 오래된 건 <b>'+old+'일 지남</b>.':'.')+' 배정이 먼저입니다.'})}
  const sup=ctSupport(s);
  if(sup.n){const first=Object.values(sup.map)[0];out.unshift({cls:'w',owner:'',issue:'support',kind:'risk',html:'지원 요청 대기 <b>'+sup.n+'건</b> — '+h(first.text)+(sup.n>1?' 외':'')+' · 아래 목록에서 [처리]를 누르고 결정 한 줄을 남기면 빠집니다.'})}
  return out.slice(0,4);
 }
 function ctRepRows(s){
  const ct=ctState(),act=s.active,names=[...new Set(act.map(d=>d.owner))].filter(n=>n&&n!=='미배정');
  const rows=names.map(name=>{const mine=act.filter(d=>d.owner===name);
   const cnt=k=>mine.filter(d=>d.issues.includes(k)).length;
   return {name,total:mine.length,promise:cnt('promise'),overdue:cnt('overdue'),missing:cnt('missing'),contact:cnt('contact'),stale:cnt('stale'),old:Math.max(0,...mine.map(ctDays)),probs:cnt('promise')*5+cnt('overdue')*3+cnt('contact')*2+cnt('missing')};
  }).filter(x=>x.promise+x.overdue+x.missing+x.contact+x.stale>0).sort((a,b)=>b.probs-a.probs);
  const chip=(name,k,label,n,cls)=>n?'<button type="button" class="ct-tag '+cls+(ct.owner===name&&ct.issue===k?' sel':'')+'" data-si-action="ct-focus" data-value="'+a(name+'|'+k)+'">'+label+' '+n+'</button>':'';
  return rows.map(x=>'<div class="ct-reprow"><span class="who">'+btn(x.name,'person',x.name)+'<small>진행 '+x.total+'건</small></span><span class="ct-tags">'+chip(x.name,'promise','약속 미이행',x.promise,'hot')+chip(x.name,'overdue','기한초과',x.overdue,'hot')+chip(x.name,'contact','마지막 연락 7일 이상 전',x.contact,'warn')+chip(x.name,'missing','다음 할 일 없음',x.missing,'')+chip(x.name,'stale','장기정체',x.stale,'')+'</span><span class="ct-old">'+(x.old?'가장 오래된 <b>'+x.old+'일</b>':'')+'</span>'+btn('할 일 지정','ct-order',x.name,'ct-orderbtn')+'</div>').join('')||'<p class="dc-mut">현재 문제 신호가 있는 담당자가 없습니다.</p>';
 }
 /* 기술자문 낙찰실적(2026-09-25 승격): 확정한 건만 합산 · 낙찰확정일 기준 · VAT 별도. 상단 필터 연동 —
    기간=낙찰확정일, 담당자=귀속 담당자, 브랜드 칩=원천 브랜드(기술자문 칩·전체=전 건). 미확정은 '검증 대기'로만 표시. */
 let advBusy=false;
 function fillAdvisoryCard(){
  if(!document.getElementById('pf-advisory')||!root.ContractSalesUI?.advisoryRows||advBusy)return;
  advBusy=true;
  root.ContractSalesUI.advisoryRows().then(list=>{
   const b=document.getElementById('pf-advisory');if(!b)return;
   const f=state(),brand=root.G.brand||'전체',allBrand=brand==='전체'||brand==='기술자문';
   const inP=iso=>{if(!iso)return false;iso=String(iso);if(String(f.year)!=='전체'&&iso.slice(0,4)!==String(f.year))return false;const m=+iso.slice(5,7);if(Number(f.month))return m===Number(f.month);if(Number(f.quarter))return Math.ceil(m/3)===Number(f.quarter);return true};
   const conf=list.filter(x=>{const t=x.attribution;return t?.decision==='confirmed'&&inP(t.bid_confirmed_at)&&(f.owner==='전체'||t.performance_owner===f.owner)&&(allBrand||t.origin_business===brand)});
   const pending=list.filter(x=>!x.attribution).length,total=conf.reduce((n,x)=>n+Number(x.attribution.bid_amount||0),0);
   const group=key=>{const m={};conf.forEach(x=>{const k=x.attribution[key]||'-';m[k]=m[k]||{n:0,s:0};m[k].n++;m[k].s+=Number(x.attribution.bid_amount||0)});return Object.entries(m).sort((p,q)=>q[1].s-p[1].s)};
   const line=([k,v])=>'<div class="pf-adv-row"><span>'+h(k)+' <small>'+v.n+'건</small></span><b title="'+number(v.s)+'원">'+money(v.s)+'</b></div>';
   b.querySelector('.pf-adv-body').innerHTML='<div class="pf-adv-total"><b title="'+number(total)+'원">'+money(total)+'</b><span>확정 '+conf.length+'건'+(allBrand?'':' · 원천 '+h(brand))+'</span></div>'
    +(conf.length?'<div class="pf-adv-sub">원천 브랜드별</div>'+group('origin_business').slice(0,5).map(line).join('')+'<div class="pf-adv-sub">귀속 담당자</div>'+group('performance_owner').slice(0,4).map(line).join('')
     :'<p class="pf-adv-empty">이 기간에 확정된 기술자문 낙찰실적이 없습니다.</p>')
    +'<button type="button" class="pf-adv-cta" data-si-action="advisory-sync">'+(pending?'검증 대기 '+pending+'건 확정하기 →':'기술자문 낙찰실적 관리 →')+'</button>';
   b.hidden=false;
  }).catch(()=>{}).finally(()=>{advBusy=false;});
 }
 /* 데이터 위험(2026-09-25 컨설턴트 ⑥): 기술자문 실적의 확인 필요 항목을 컨트롤타워가 먼저 알린다. 클릭=확정 큐. */
 function fillDataRisk(){
  /* 데이터 위험 = CRM이 먼저 알려주는 예외(2026-09-25): 문의→영업 미전환(계보 결손) + 기술자문 실적 확인 항목. 클릭=처리 화면. */
  if(!document.getElementById('ct-datarisk'))return;
  const paint=list=>{
   const b=document.getElementById('ct-datarisk');if(!b)return;
   const items=[];
   const inq=root.InquiryConversion?.candidates?.()||[];
   if(inq.length)items.push(['red','견적 발송·영업 미전환',inq.length,'inquiry-convert']);
   if(list){
    const pend=list.filter(x=>!x.attribution),hold=list.filter(x=>x.attribution?.decision==='hold');
    [['red','브랜드 귀속 확인 필요',pend.filter(x=>(x.candidates||[]).length>1).length],
     ['red','실적 중복 의심',list.filter(x=>x.attribution?.decision!=='excluded'&&(x.candidates||[]).some(k=>k.has_contract)).length],
     ['org','기술자문 원천 브랜드 미확정',pend.length],['org','낙찰금액 미입력',pend.filter(x=>!x.bid_amount).length],
     ['org','기술자문 담당 미확정',pend.filter(x=>!x.owner_name).length],['yel','기술자문 현장 연결 필요',pend.filter(x=>!x.site_id).length],
     ['yel','낙찰확정일 없음',pend.filter(x=>!x.contract_date).length],['gry','기술자문 보류',hold.length]]
     .forEach(k=>{if(k[2]>0)items.push([k[0],k[1],k[2],'advisory-sync']);});
   }
   if(!items.length){b.hidden=true;return;}
   b.innerHTML='<div class="ct-dr"><b>데이터 위험</b><small>CRM이 먼저 알려주는 확인할 것 · 클릭=처리</small>'+items.map(([cls,t,n,act])=>'<button type="button" class="ct-drchip '+cls+'" data-si-action="'+act+'">'+t+' <b>'+n+'</b></button>').join('')+'</div>';
   b.hidden=false;
  };
  paint(null);
  if(root.ContractSalesUI?.advisoryRows&&root.CRMRelease?.has?.('crm_advisory_attribution_v1')!==false)root.ContractSalesUI.advisoryRows().then(paint).catch(()=>{});
 }
 root.addEventListener('crm-release:changed',()=>{if(['control','perf'].includes(root.G?.page))render();});/* 릴리스 계약: 빠진 서버 함수가 확인되면 해당 버튼을 즉시 숨김 */
 root.addEventListener('advisory-attribution:changed',()=>{if(root.G?.page==='perf')fillAdvisoryCard();if(root.G?.page==='control')fillDataRisk();});
 /* 운영 건강(2026-09-25 컨설턴트 P0-1): 운영 KPI는 Live만 평가한다 — OPS_RULES.liveFrom(대표 확정 2026-10-01) 이후
    생성됐거나 그 이후 실제 접촉이 기록된 영업. 나머지는 Legacy(과거 이관분)로 '정상화율'만 본다.
    과거 데이터를 운영 KPI에 섞으면 'Next Action 등록률 2%' 같은 무의미한 숫자가 나와 대시보드 신뢰를 잃는다. */
 /* 루프 끊김(2026-09-25 컨설턴트 Loop ⑭·⑮): 관리자는 단계별 목록이 아니라 '끊긴 루프'만 매일 처리한다.
    Live(OPS_RULES.liveFrom 이후 생성·조치) 건수를 크게, 과거 이관분은 괄호로 분리 — 두 모수를 섞지 않는다. 칩 클릭 = 아래 처리 목록 필터. */
 function loopStrip(s){
  const LIVE=String(root.OPS_RULES?.liveFrom||'2026-10-01'),day=v=>String(v||'').slice(0,10),far=Number(root.OPS_RULES?.loopContactDays??30);
  const r=rows(),act=r.deals.filter(d=>d.active),inq=r.inquiries;
  const liveD=d=>day(d.created)>=LIVE||day(d.lastContact)>=LIVE,liveQ=q=>day(q.item.created_at||q.item.createdAt||q.created)>=LIVE;
  const noContact=d=>{const m=root.relationshipMeta(d.item);if(m.days!==null)return m.days>=far;const c0=day(d.created);return !!c0&&root.daysTo&&-root.daysTo(c0)>=far};/* 접촉 기록이 아예 없으면 생성 후 경과일로 */
  const late=q=>q.owner!=='미배정'&&!(root.inqCtlFirstResponseAt&&root.inqCtlFirstResponseAt(q.item))&&!!(root.inquiryResponseLate&&root.inquiryResponseLate(q.item));
  const sup=ctSupport(s).n;
  const defs=[
   ['red','미배정 문의',inq.filter(q=>q.owner==='미배정'),liveQ,'미배정|all|inquiries'],
   ['red','첫 연락 지연',inq.filter(late),liveQ,'|all|inquiries'],
   ['red','약속 미이행',act.filter(d=>d.issues.includes('promise')),liveD,'|promise|risk'],
   ['red','진행 멈춤',act.filter(d=>d.issues.includes('stall')),liveD,'|stall|risk'],
   ['org','담당자 없는 영업',act.filter(d=>!d.owner||d.owner==='미배정'),liveD,'미배정|all|risk'],
   ['org','다음 할 일 없음',act.filter(d=>d.issues.includes('missing')),liveD,'|missing|risk'],
   ['yel','마지막 연락 '+far+'일 이상 전',act.filter(noContact),liveD,'|contact|risk']];
  const chip=([cls,label,list,isLive,val])=>{const n=list.filter(isLive).length,old=list.length-n;
   return '<button type="button" class="ct-drchip '+(n?cls:'z')+'" data-si-action="ct-focus" data-value="'+a(val)+'">'+label+' <b>'+n+'</b>'+(old?' <small>과거 '+number(old)+'</small>':'')+'</button>';};
  return '<div class="dc-p c12 ct-loop"><div class="ct-dr"><b>후속이 끊긴 건</b><small>매일 여기만 처리 · 큰 숫자='+h(Number(LIVE.slice(5,7))+'/'+Number(LIVE.slice(8,10)))+' 이후 · 작은 숫자=과거 이관</small>'+defs.map(chip).join('')
   +'<button type="button" class="ct-drchip '+(sup?'red':'z')+'" data-si-action="ct-focus" data-value="|support|risk">지원 요청 <b>'+sup+'</b></button></div></div>';
 }
 /* 흐름 품질(2026-09-26 컨설턴트 '행동의 연속성' 측정): 얼마나 많이 했나가 아니라 '결과 뒤에 다음이 이어졌나'.
    ① 결과→다음 할 일 연결: 고객 연락 결과(전화·부재·방문·문자·메일 등) 뒤 24시간 안에 다음 할 일이 등록됐거나 영업이 종료된 비율.
       방금(24시간 미만) 남긴 결과는 아직 판정하지 않는다.
    ② 다음 할 일 기한 내 처리: 기한이 지난(또는 이미 완료된) 다음 할 일 중 기한일까지 완료한 비율. 열린 채 기한이 지나면 미처리.
    ③ 고객 약속 기한 내 이행: ②를 고객 약속(종류에 '약속' 또는 '고객 약속:' 문구)만으로.
    데이터 = 서버가 이미 주는 activity_signals(종류·시각)·completed_actions(기한·완료일)·next_action — 새 서버 함수 없음.
    Live(10/1) 전에는 최근 30일 '시험 집계'로 보여 준다 — 숫자가 제대로 잡히는지 미리 보는 용도, 운영 KPI 아님. */
 const FLOW_Q={linkHours:24,target:{link:90,ontime:90,promise:95},contact:/전화|통화|부재|방문|문자|메일|카톡|카카오|미팅|연락/};
 function flowQuality(deals){
  const ld=v=>{const t=new Date(v);return Number.isFinite(t.getTime())?new Date(t.getTime()-t.getTimezoneOffset()*6e4).toISOString().slice(0,10):''};
  const LIVE=String(root.OPS_RULES?.liveFrom||'2026-10-01'),today=ld(Date.now()),started=today>=LIVE;
  const from=started?LIVE:ld(Date.now()-30*864e5),ts=v=>Date.parse(v||''),win=FLOW_Q.linkHours*3600e3,now=Date.now();
  const isPromise=x=>/약속/.test(String(x?.type||''))||/^\s*고객\s*약속/.test(String(x?.text||x?.title||''));
  const link={n:0,t:0,by:{},miss:[]},due={n:0,t:0,by:{}},prom={n:0,t:0,miss:[]},call={n:0,t:0,by:{},miss:[]};
  /* ④ 전화 후 결과 기록(2026-09-26 컨설턴트 '고객 접촉 후 결과가 기록된 비율'): 전화 버튼이 남긴 '전화 시도' 뒤
     2시간 안에 결과(다른 연락 기록 또는 다음 할 일)가 이어졌나. 2시간 안 된 시도는 판정 보류. */
  const ATTEMPT=/^\s*전화 시도/,callWin=2*3600e3;
  const add=(o,k,ok)=>{o.by[k]=o.by[k]||[0,0];o.by[k][1]++;if(ok)o.by[k][0]++;};
  deals.forEach(d=>{
   const it=d.item||{},acts=[].concat(it.activities||it.activity_signals||[]),owner=d.owner&&d.owner!=='미배정'?d.owner:'미배정';
   const sets=acts.filter(x=>x&&x.type==='next_action_set').map(x=>ts(x.at||x.occurred_at)).filter(Number.isFinite);
   const closedAt=ts(it.closed_at||it.closed);
   acts.forEach(x=>{
    const type=String(x?.type||''),at=ts(x?.at||x?.occurred_at);
    if(!Number.isFinite(at)||/^[a-z0-9_]+$/.test(type)||!FLOW_Q.contact.test(type)||ld(at)<from)return;
    if(ATTEMPT.test(String(x.note||''))){
     const after=t=>Number.isFinite(t)&&t>at&&t<=at+callWin;
     const ok=sets.some(after)||acts.some(y=>y!==x&&!ATTEMPT.test(String(y.note||''))&&!/^[a-z0-9_]+$/.test(String(y.type||''))&&after(ts(y.at||y.occurred_at)));
     if(!ok&&now-at<callWin)return;
     call.t++;if(ok)call.n++;add(call,owner,ok);if(!ok)call.miss.push({at,key:d.key,site:d.site,type:'전화',owner});
     return;/* 시도는 결과가 아니다 — 연결률 계산에서 뺀다 */
    }
    const inWin=t=>Number.isFinite(t)&&t>=at-6e5&&t<=at+win;
    const ok=sets.some(inWin)||inWin(closedAt);
    if(!ok&&now-at<win)return;/* 아직 24시간이 안 지남 — 판정 보류 */
    link.t++;if(ok)link.n++;add(link,owner,ok);
    if(!ok)link.miss.push({at,key:d.key,site:d.site,type,owner});
   });
   const open=it.nextActionObj||it.next_action,list=[].concat(Array.isArray(it.completed_actions)?it.completed_actions:[],open&&open.status!=='completed'&&(open.due_at||open.due)?[Object.assign({},open,{status:'open'})]:[]);
   list.forEach(x=>{
    const dd=String(x.due_at||x.due||'').slice(0,10);if(!dd||dd<from)return;
    const done=x.status==='completed'&&x.completed_at;
    if(!done&&dd>=today)return;/* 아직 기한 전 */
    const ok=!!done&&ld(x.completed_at)<=dd;
    due.t++;if(ok)due.n++;add(due,owner,ok);
    if(isPromise(x)){prom.t++;if(ok)prom.n++;else prom.miss.push({at:ts(dd),key:d.key,site:d.site,type:'약속 '+dd.slice(5).replace('-','/'),owner});}
   });
  });
  const pct=o=>o.t?Math.round(o.n/o.t*100):null;
  const tile=(label,o,target,sub)=>{const v=pct(o);return '<div class="hl-tile'+(v==null?' na':v>=target?' ok':' bad')+'"><span>'+label+'</span><b>'+(v==null?'-':v+'%')+'</b><small>'+(o.t?number(o.n)+' / '+number(o.t)+'건 · ':'')+sub+'</small></div>';};
  const low=o=>Object.entries(o.by).filter(([k,v])=>v[1]>=3&&k!=='미배정').map(([k,v])=>[k,Math.round(v[0]/v[1]*100),v]).sort((x,y)=>x[1]-y[1]).slice(0,3);
  const lowHtml=(label,o)=>{const l=low(o);return l.length?'<span class="hl-fq-low"><em>'+label+' 낮은 순</em>'+l.map(([k,p,v])=>btn(k+' '+p+'% ('+v[0]+'/'+v[1]+')','person',k)).join('')+'</span>':'';};
  const missHtml=(label,arr)=>{const m=arr.sort((x,y)=>y.at-x.at).slice(0,3);return m.length?'<span class="hl-fq-miss"><em>'+label+'</em>'+m.map(x=>btn(x.site+' · '+ld(x.at).slice(5).replace('-','/')+' '+x.type+' · '+x.owner,'record',x.key)).join('')+'</span>':'';};
  const head=started?Number(LIVE.slice(5,7))+'/'+Number(LIVE.slice(8,10))+' 이후':'참고용 집계 · 최근 30일 ('+Number(LIVE.slice(5,7))+'/'+Number(LIVE.slice(8,10))+'부터 정식)';
  return '<div class="hl-flow"><em>흐름 품질 — 연락 후 다음 할 일이 이어졌나 · '+h(head)+'</em><div class="hl-tiles hl-tiles4">'
   +tile('전화 후 결과 기록',call,95,call.t?'2시간 안 · 목표 95%':'아직 전화 기록 없음')
   +tile('연락 → 다음 할 일 연결',link,FLOW_Q.target.link,FLOW_Q.linkHours+'시간 안 · 목표 '+FLOW_Q.target.link+'%')
   +tile('다음 할 일 기한 내 처리',due,FLOW_Q.target.ontime,'목표 '+FLOW_Q.target.ontime+'%')
   +tile('고객 약속 기한 내 이행',prom,FLOW_Q.target.promise,prom.t?'목표 '+FLOW_Q.target.promise+'%':'아직 약속 없음')
   +'</div><div class="hl-fq-notes">'+missHtml('결과를 안 남긴 통화',call.miss)+missHtml('다음 할 일이 끊긴 연락',link.miss)+missHtml('못 지킨 약속',prom.miss)+lowHtml('연결률',link)+lowHtml('기한 처리',due)+'</div></div>';
 }
 function healthPanel(){
  const LIVE=String(root.OPS_RULES?.liveFrom||'2026-10-01'),started=new Date().toISOString().slice(0,10)>=LIVE;
  const r=rows(),act=r.deals.filter(d=>d.active),day=v=>String(v||'').slice(0,10);
  const isLive=d=>day(d.created)>=LIVE||day(d.lastContact)>=LIVE;
  const live=act.filter(isLive),legacy=act.filter(d=>!isLive(d));
  const hasOwner=d=>!!d.owner&&d.owner!=='미배정',hasNext=d=>!d.issues.includes('missing'),staged=d=>!!(d.item.stage_code||d.item.code);/* 단계 미분류 = 서버 stage_code 자체가 없음(과거 목록 원본 단계명 미매핑) */
  const pct=(n,t)=>t?Math.round(n/t*100):null,sla=Number(root.OPS_RULES?.responseSlaHours??2)*3600e3;
  const t0=q=>Date.parse(q.item.created_at||q.item.createdAt||q.created||'');
  const inq=r.inquiries.filter(q=>day(q.item.created_at||q.item.createdAt||q.created)>=LIVE);
  const due=inq.filter(q=>root.inquiryRespondedAt?.(q.item)||Date.now()-t0(q)>sla);
  const ok=due.filter(q=>{const at=Date.parse(root.inquiryRespondedAt?.(q.item)||'');return at&&at-t0(q)<=sla});
  const m={owner:pct(live.filter(hasOwner).length,live.length),next:pct(live.filter(hasNext).length,live.length),over:pct(live.filter(d=>d.issues.includes('overdue')).length,live.length),sla:pct(ok.length,due.length)};
  const tile=(label,val,target,good)=>'<div class="hl-tile'+(val==null?' na':good?' ok':' bad')+'"><span>'+label+'</span><b>'+(val==null?'-':val+'%')+'</b><small>'+target+'</small></div>';
  const norm=legacy.filter(d=>hasOwner(d)&&hasNext(d)&&staged(d)).length;
  const gaps=[['담당자 없음',legacy.filter(d=>!hasOwner(d)).length],['다음 할 일 없음',legacy.filter(d=>!hasNext(d)).length],['단계 미분류',legacy.filter(d=>!staged(d)).length]].filter(x=>x[1]);
  const liveDay=Number(LIVE.slice(5,7))+'월 '+Number(LIVE.slice(8,10))+'일';
  return '<div class="dc-p c12 hl-panel"><div class="dc-ph">운영 건강<small>'+h(liveDay)+' 이후 생성·조치된 영업만 평가 · 과거 이관분은 정리율로 따로</small></div><div class="dc-pb hl-grid">'
   +'<div class="hl-live"><em>'+h(Number(LIVE.slice(5,7))+'/'+Number(LIVE.slice(8,10)))+' 이후 운영 지표'+(live.length?' · 진행 '+number(live.length)+'건':'')+'</em><div class="hl-tiles">'
   +(started||live.length?tile('담당자 지정',m.owner,'목표 98% 이상',m.owner>=98)+tile('다음 할 일 등록',m.next,'목표 95% 이상',m.next>=95)+tile('기한초과',m.over,'목표 5% 미만',m.over!=null&&m.over<5)+tile('첫 연락 '+(sla/3600e3)+'시간 내 비율',m.sla,'목표 95% 이상',m.sla>=95)
     :'<p class="hl-wait">'+h(liveDay)+'부터 집계합니다. 지금은 과거 데이터를 정리하는 기간입니다.</p>')
   +'</div></div><div class="hl-legacy"><em>과거 건 정리율</em><div class="hl-norm"><b>'+(legacy.length?pct(norm,legacy.length)+'%':'-')+'</b><span>'+number(norm)+' / '+number(legacy.length)+'건 — 담당자·다음 할 일·단계가 모두 있는 진행 영업</span></div>'
   +'<div class="hl-gaps">'+gaps.map(([t,n])=>'<span>'+t+' <b>'+number(n)+'</b></span>').join('')+'</div></div>'+flowQuality(r.deals)+'</div></div>';
 }
 function control(s){
  const f=state(),ct=ctState();
  let list=M.select(s,f.kind,f);
  if(ct.owner)list=list.filter(d=>d.owner===ct.owner);
  const ctSup=ctSupport(s);
  s.active.forEach(d=>{if(ctSup.map[d.key]&&!d.issues.includes('support'))d.issues.push('support')});
  if(ct.issue==='support')list=list.filter(d=>ctSup.map[d.key]);
  else if(ct.issue&&ct.issue!=='all')list=list.filter(d=>d.issues.includes(ct.issue));
  const size=20,pages=Math.max(1,Math.ceil(list.length/size));f.page=Math.min(f.page,pages);
  const kinds=[['risk','조치 필요'],['active','진행중 전체'],['inquiries','기간 문의'],['won','기간 준공 처리']];
  const stageOptions=[['all','전체 단계'],...s.stages.map(x=>[x.code,x.label])];
  const chips=kinds.map(([k,t])=>'<button type="button" class="dc-kchip'+(f.kind===k?' on':'')+'" data-si-filterchip="kind" data-value="'+k+'">'+h(t)+' <b>'+number(M.select(s,k,f).length)+'</b></button>').join('')
   +(ct.owner||ct.issue!=='all'?'<button type="button" class="dc-kchip ct-clearchip" data-si-action="ct-clear">'+h((ct.owner?ct.owner:'')+(ct.issue!=='all'?' · '+(labels[ct.issue]||(ct.issue==='support'?'지원 요청':ct.issue)):''))+' ✕</button>':'');
  const filtersHtml='<div class="si-control-filters dc-cfilters">'+select('단계','stage',stageOptions,f.stage)+'<label>현장 검색<input data-si-search value="'+a(f.search)+'" placeholder="현장·담당자·사유" aria-label="현장 검색"></label></div>';
  const verdicts=ctVerdicts(s,f).map(v=>'<button type="button" class="ct-verdict '+v.cls+'" data-si-action="ct-focus" data-value="'+a(v.owner+'|'+v.issue+'|'+v.kind)+'">'+v.html+'</button>').join('')||'<p class="dc-mut">막힘 신호가 없습니다.</p>';
  const riskText=d=>{const raw=String(d.reason||'현재 진행 중');return h(raw).replace(/(기한 [0-9]+일 지남|[0-9]+일 기한초과)/g,'<span class="ct-hot">$1</span>').replace(/(마지막 연락 [0-9]+일 전|[0-9]+일 미접촉)/g,'<span class="ct-warn">$1</span>').replace(/(기한초과)/g,'<span class="ct-hot">$1</span>')};
  const table='<div class="si-table-scroll"><table class="si-table si-cases dc-table dc-cases"><thead><tr><th class="ct-selcol"><input type="checkbox" id="ct-all" aria-label="표시된 현장 모두 선택"></th><th>현장</th><th>담당자</th><th>현재 단계</th><th>왜 막혔나</th><th>조치</th></tr></thead><tbody>'+list.slice((f.page-1)*size,f.page*size).map(d=>'<tr><td class="ct-selcol">'+(d.type==='deal'?'<input type="checkbox" data-ct-sel="'+a(d.key)+'" aria-label="'+a(d.site)+' 선택">':'')+'</td><td class="ct-site"><b title="'+a(d.site)+'">'+h(d.site)+'</b></td><td>'+(d.owner&&d.owner!=='미배정'?btn(d.owner,'person',d.owner):h(d.owner))+'</td><td><span class="si-badge">'+h(d.stageLabel)+'</span></td><td>'+(f.kind==='won'?h('준공 처리금액 '+money(d.wonAmount)+(d.hasWonAmount?'':' · 금액 미입력')):(ctSup.map[d.key]?'<span class="ct-hot">지원 요청</span> — '+h(ctSup.map[d.key].text)+' <small>'+h(ctSup.map[d.key].at)+'</small> · ':'')+riskText(d))+'</td><td>'+(ctSup.map[d.key]&&d.type==='deal'?btn('처리','support-resolve',d.key,'ct-resolve'):btn(d.type==='inq'&&d.owner==='미배정'?'배정':'열기','record',d.key))+'</td></tr>').join('')+'</tbody></table></div>'+(list.length?'':empty());
  const bulk='<div class="ct-bulk">선택 <b id="ct-count">0</b>건 → '+btn('할 일 지정 (다음 할 일 일괄 등록)','ct-bulk','','ct-bulkbtn')+'<span class="dc-mut">지정한 할 일은 각 현장의 다음 할 일로 등록되어 담당자 오늘 업무에 뜹니다 · 문의 건은 배정으로 처리</span></div>';
  return '<div class="dc-topbar"><h2><i>◈</i>컨트롤타워</h2>'+'<span class="dc-nav">'+btn('전체 현황 ↗','navigate','dash')+btn('성과 분석 ↗','navigate','perf')+(root.ContractSalesUI?.advisorySync&&root.CRMRelease?.has?.('crm_advisory_attribution_v1')!==false?'<button type="button" data-si-action="advisory-sync">기술자문 낙찰실적 확정</button>':'')+'</span><span class="dc-live"><i></i>관리 대상 '+number(list.length)+'건</span></div>'+
   '<div class="dc-grid">'+
   loopStrip(s)+healthPanel()+(()=>{try{return weeklyReview();}catch(e){if(root.console&&root.console.warn)root.console.warn('weekly: '+e.message);return '';}})()+'<div class="dc-p c12 ct-datarisk" id="ct-datarisk" hidden></div>'+'<div class="dc-p c12"><div class="dc-ph">① 지금 막힌 곳<small>문장 클릭 = 아래 목록이 그 조건으로 좁혀짐</small></div><div class="dc-pb ct-verdicts">'+verdicts+'</div></div>'+
   '<div class="dc-p c12"><div class="dc-ph">② 담당자별 문제 · 지시<small>문제 칩 클릭=목록 필터 · 이름 클릭=성과 분석 · 할 일 지정=해당 담당자 문제 건 일괄 등록</small></div><div class="dc-pb">'+ctRepRows(s)+'</div></div>'+
   '<div class="dc-p c12"><div class="dc-ph">③ 처리 목록<small>진행 중·조치 필요=현재 상태 · 문의·준공=선택 기간 · 계약실적과 별도</small></div><div class="dc-pb"><div class="dc-kchips">'+chips+'</div>'+filtersHtml+table+bulk+'<div class="si-pager">'+btn('이전','page',Math.max(1,f.page-1))+'<span>'+f.page+' / '+pages+'</span>'+btn('다음','page',Math.min(pages,f.page+1))+'</div></div></div></div>';
 }
 /* ─── 대시보드 다크 콘솔 (2026-09-22) ─── */
 let lastDiags=[],lastAnimKey='';
 function repStats(s){
  const f=state(),curM=Number(f.month)||new Date().getMonth()+1,week=Date.now()-7*864e5;
  const names=[...new Set(s.deals.map(x=>x.owner).concat((root.ContractSalesData?.state().items||[]).map(x=>x.sales_owner_name)))].filter(n=>root.SalesScope.people().some(p=>p.name===n)&&(f.owner==='전체'||n===f.owner)).sort(root.repCompare);
  return names.map(name=>{
   const deals=s.deals.filter(d=>d.owner===name),act=deals.filter(d=>d.active);
   let weekly=0,last=null;const types={call:0,visit:0,quote:0};
   deals.forEach(d=>{const patch=root.itemPatch(d.item,'deal');[...(d.item.activities||[]),...(patch.activities||[])].forEach(x=>{const at=Date.parse(x.at||x.created_at||x.occurred_at||'');if(!Number.isFinite(at))return;if(at>=week){weekly++;const t=String(x.type||'')+String(x.note||'');if(/방문|미팅|현장/.test(t))types.visit++;else if(/견적|입찰|제안/.test(t))types.quote++;else types.call++}if(!last||at>last.at)last={at,site:d.site}})});
   const cs=csSum({...f,month:0,owner:name}),csM=csSum({...f,month:curM,quarter:0,owner:name});
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
  if(low&&(low.contact>0||low.weekly===0))out.push({name:low.name,kind:'contact',cls:'w',title:low.name+' — 주간 활동 최저 '+low.weekly+'건',sub:'마지막 연락 7일 이상 전 '+low.contact+'건'+(low.last?' · 마지막 활동 '+M.date(new Date(low.last.at).toISOString()):'')+' — 접촉이 끊김'});
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
    if(!filter.month&&f.quarter&&Math.ceil(Number(d.slice(5,7))/3)!==Number(f.quarter))return;
    out.push({at:d,site:r.brand||'-',owner:e.sales_owner_name,stageLabel:kindLabel[e.kind]||e.kind,reason:d+' · '+(e.reason||''),amt:e.amount_delta});});
  });
  return out.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
 }
 function evRow(d){return {site:d.site,owner:d.owner,stageLabel:d.stageLabel,reason:d.reason||'',amt:d.expected||d.amt||0,key:d.key}}
 function openEvidence(title,sub,list){
  close(false);focusBefore=document.activeElement;
  const shade=document.createElement('div');shade.id='si-person';shade.className='modalshade on si-person';
  shade.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="si-person-title" class="si-person-box si-evidence"><header><div><h2 id="si-person-title">'+h(title)+'</h2><p>'+h(sub||'')+'</p></div>'+btn('닫기','close','','si-close')+'</header><div class="si-table-scroll"><table class="si-table si-cases"><thead><tr><th>현장·구분</th><th>담당자</th><th>단계</th><th>근거</th><th>금액</th><th>조치</th></tr></thead><tbody>'+(list.map(d=>'<tr><td>'+h(d.site)+'</td><td>'+h(d.owner)+'</td><td><span class="si-badge">'+h(d.stageLabel||'')+'</span></td><td>'+h(d.reason||'')+'</td><td>'+(d.amt?money(d.amt):'-')+'</td><td>'+(d.key?btn('열기','record',d.key):'')+'</td></tr>').join('')||'<tr><td colspan="6">해당 조건의 근거가 없습니다.</td></tr>')+'</tbody></table></div></section>';
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
  /* 라벨은 HTML 오버레이 — preserveAspectRatio:none 가로 늘림이 SVG 텍스트 글리프를 찌그러뜨리기 때문 */
  const fx=x=>(x/W*100).toFixed(2)+'%';
  const lb='position:absolute;transform:translateX(-50%);pointer-events:none;white-space:nowrap;';
  return '<div style="position:relative">'+
   '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="none" style="overflow:visible;display:block">'+
   '<line x1="0" y1="'+base+'" x2="'+W+'" y2="'+base+'" stroke="#e8edf4"/><line x1="0" y1="'+((base+top)/2).toFixed(1)+'" x2="'+W+'" y2="'+((base+top)/2).toFixed(1)+'" stroke="#f0f3f8"/>'+
   '<path class="dc-draw" d="'+path+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+
   '<path class="dc-area" d="'+path+' L'+pts[li][0].toFixed(1)+','+base+' L16,'+base+' Z" fill="url(#'+gid+')"/>'+
   '<circle class="dc-dot" cx="'+pts[li][0].toFixed(1)+'" cy="'+pts[li][1].toFixed(1)+'" r="4" fill="'+color+'" stroke="#ffffff" stroke-width="2"/>'+
   '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+color+'" stop-opacity=".22"/><stop offset="1" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs>'+hits+'</svg>'+
   '<span style="'+lb+'left:'+fx(pts[li][0])+';top:'+Math.max(0,pts[li][1]-24).toFixed(0)+'px;font-size:12px;font-weight:800;color:#0f172a">'+h(fmt(vals[li]))+'</span>'+
   '<span style="'+lb+'left:'+fx(16)+';bottom:2px;font-size:11px;color:#8a97ab">1월</span>'+
   '<span style="'+lb+'left:'+fx(16+5*step)+';bottom:2px;font-size:11px;color:#8a97ab">6월</span>'+
   '<span style="'+lb+'left:'+fx(16+11*step)+';bottom:2px;font-size:11px;color:#8a97ab">12월</span>'+
   '</div>';
 }
 function dashConsole(s){
  const f=state(),curM=new Date().getMonth()+1,csY=csSum({...f,month:0}),csM=csSum({...f,month:curM,quarter:0});
  const mVals=Array.from({length:12},(_,i)=>{const x=csSum({...f,month:i+1,quarter:0});return x?Math.max(0,x.netAmount):0});
  const inqVals=Array.from({length:12},()=>0);
  rows().inquiries.forEach(q=>{const d=M.date(q.created);if(d&&(f.year==='전체'||d.slice(0,4)===String(f.year)))inqVals[Number(d.slice(5,7))-1]++});
  const rs=repStats(s);lastDiags=diagnose(rs);
  const feed=feedRows(s,10),weekTotal=rs.reduce((a,x)=>a+x.weekly,0);
  const brands=[...new Set((root.ContractSalesData?.state().items||[]).map(r=>r.brand).filter(Boolean))];
  const bStats=brands.map(b=>{const x=csSum({...f,brand:b});return {b,amt:x?Math.max(0,x.netAmount):0}}).sort((a,b)=>b.amt-a.amt).slice(0,4);
  const bTotal=Math.max(1,bStats.reduce((a,x)=>a+x.amt,0)),dColors=['#3B6CE4','#0E9F8A','#E08A00','#7A5AF8'];
  let off=0;const donut=bStats.map((x,i)=>{const len=x.amt/bTotal*239,seg='<circle data-si-action="brand-ev" data-value="'+a(x.b)+'" style="cursor:pointer" cx="50" cy="50" r="38" fill="none" stroke="'+dColors[i]+'" stroke-width="14" stroke-dasharray="'+Math.max(0,len-2).toFixed(1)+' 240" stroke-dashoffset="'+(-off).toFixed(1)+'"><title>'+h(x.b)+' '+money(x.amt)+'</title></circle>';off+=len;return seg}).join('');
  const stAll=root.PipelineWorkspace&&root.PipelineStages?root.PipelineWorkspace.rows({brand:f.brand,owner:f.owner}):[];
  const stCounts=root.PipelineStages?root.PipelineStages.definitions.map(d=>({...d,count:stAll.filter(r=>r.group===d.key).length})):[];
  const stMax=Math.max(1,...stCounts.map(x=>x.count));
  const p=(cls,head,note,body)=>'<div class="dc-p '+cls+'"><div class="dc-ph">'+head+(note?'<small>'+h(note)+'</small>':'')+'</div><div class="dc-pb">'+body+'</div></div>';
  const kpi=(label,val,sub,drill,cls)=>'<button type="button" class="dc-p dc-kpi c2 '+(cls||'')+'" data-si-action="drill" data-value="'+a(drill)+'"><span class="dc-ph">'+h(label)+'</span><b>'+h(val)+'</b><small>'+h(sub)+'</small></button>';
  const m0=x=>x===null||x===undefined?'확인 필요':money(x);
  const topbar='<div class="dc-topbar"><h2><i>◈</i>영업 대시보드</h2>'+'<span class="dc-nav">'+btn('성과 분석 ↗','navigate','perf')+btn('컨트롤타워 ↗','navigate','control')+'</span><span class="dc-live"><i></i>LIVE · '+h(new Date().toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})+' '+new Date().toTimeString().slice(0,5))+'</span></div>';
  const repTable='<div class="si-table-scroll"><table class="si-table si-people dc-table"><thead><tr><th>담당자</th><th>매출·월</th><th>매출·연</th><th>진행</th><th>예상금액</th><th>주간활동</th><th>문제</th><th>마지막 활동</th></tr></thead><tbody>'+rs.map(x=>{const prob=x.overdue+x.missing;return '<tr><td>'+btn(x.name,'person',x.name)+'</td><td><b>'+m0(x.mSales)+'</b></td><td><b>'+m0(x.ySales)+'</b></td><td>'+x.act.length+'</td><td>'+money(x.expected)+'</td><td>'+x.weekly+'건</td><td><span class="dc-pill'+(prob?'':' z')+'">'+prob+'</span></td><td class="dc-mut">'+(x.last?h(M.date(new Date(x.last.at).toISOString())+' '+x.last.site):'-')+'</td></tr>'}).join('')+'</tbody></table></div>';
  const diagBtns=lastDiags.map((d,i)=>'<button type="button" class="dc-diag '+d.cls+'" data-si-action="diag" data-value="'+i+'"><b>'+h(d.title)+'</b><small>'+h(d.sub)+'</small></button>').join('')||'<p class="dc-mut">현재 막힘 신호가 없습니다.</p>';
  const feedHtml=feed.map(x=>'<button type="button" class="dc-feed-row" data-si-action="record" data-value="'+a(x.key)+'"><time>'+h(M.date(x.at)||'')+'</time><span class="w">'+h(x.owner)+'</span><span class="t"><b>'+h(x.site)+'</b> '+h(x.text)+'</span><span class="m">'+(x.amt?money(x.amt):'')+'</span></button>').join('')||'<p class="dc-mut">기록된 활동이 없습니다.</p>';
  const actBars=[...rs].sort((a,b)=>b.weekly-a.weekly).slice(0,6).map(x=>{const t=Math.max(1,weekTotal);return '<button type="button" class="dc-hrow" data-si-action="rep-week" data-value="'+a(x.name)+'"><span>'+h(x.name)+'</span><span class="bar"><i style="width:'+(x.types.call/t*300)+'%"></i><i class="g" style="width:'+(x.types.visit/t*300)+'%"></i><i class="o" style="width:'+(x.types.quote/t*300)+'%"></i></span><b>'+x.weekly+'</b></button>'}).join('');
  return topbar+
   '<div class="dc-grid">'+
   kpi('이번 달 매출',m0(csM?csM.netAmount:null),'계약금액 기준 · '+curM+'월','contract')+
   kpi((f.month||f.quarter?'기간':'연 누적')+' 매출',m0(csY?csY.netAmount:null),'계약 '+(csY?csY.count:'-')+'건'+(f.quarter?' · '+f.quarter+'분기':''),'contract')+
   kpi('파이프라인',money(s.expected),'진행 '+number(s.active.length)+'건','active')+
   kpi('문의',number(s.inquiries.length)+'건','선택 기간 접수','inquiries')+
   kpi('조치 필요',number(s.risk.length)+'건','기한초과 '+s.active.filter(d=>d.issues.includes('overdue')).length+' · 다음 할 일 없음 '+s.active.filter(d=>d.issues.includes('missing')).length,'risk','bad')+
   kpi('주간 활동',number(weekTotal)+'건','최근 7일 전체','activity')+
   p('c5','매출 추이 · 월별','계약 체결일 기준 · 월 클릭=근거',dcLine(mVals,460,118,'#3B6CE4','dcg1',money,'cs-month'))+
   p('c4','문의 유입 · 월별','접수 기준 · 월 클릭=근거',dcLine(inqVals,380,118,'#0E9F8A','dcg2',v=>number(v)+'건','inq-month'))+
   p('c3','사업유형별 매출','조각 클릭=근거','<div class="dc-donut"><svg viewBox="0 0 100 100" width="92" height="92"><g transform="rotate(-90 50 50)">'+(donut||'<circle cx="50" cy="50" r="38" fill="none" stroke="#eef1f6" stroke-width="14"/>')+'</g><text x="50" y="48" text-anchor="middle" class="dn">'+h(m0(csY?csY.netAmount:null))+'</text><text x="50" y="61" text-anchor="middle" class="dl">'+(f.month?f.month+'월':'연 누적')+'</text></svg><div class="dc-dleg">'+(bStats.map((x,i)=>'<span><i style="background:'+dColors[i]+'"></i>'+h(x.b)+'<b>'+Math.round(x.amt/bTotal*100)+'%</b></span>').join('')||'<span class="dc-mut">계약 원장 확인 필요</span>')+'</div></div>')+
   p('c3','영업 퍼널','클릭=해당 단계 작업함',stCounts.map(x=>'<button type="button" class="dc-hrow" data-si-action="stage" data-value="'+a(x.key)+'"><span>'+h(x.number+' '+x.label)+'</span><span class="bar"><i style="width:'+(x.count/stMax*100)+'%"></i></span><b>'+number(x.count)+'건</b></button>').join('')+'<button type="button" class="dc-hrow hot" data-si-action="drill" data-value="risk"><span>조치 필요</span><span class="bar"><i class="r" style="width:'+(s.risk.length/stMax*100)+'%"></i></span><b>'+number(s.risk.length)+'</b></button>')+
   p('c6','담당자 종합','매출=계약금액 · 이름 클릭=상세',repTable)+
   p('c3','영업이 막힌 사람 · 판단근거','문장 클릭=근거 목록','<div class="dc-diags">'+diagBtns+'</div><div class="dc-riskchips">'+Object.keys(labels).map(k=>btn(labels[k]+' '+number(s.active.filter(d=>d.issues.includes(k)).length),'drill',k)).join('')+'</div>')+
   p('c8','전사 활동 피드','행 클릭=현장 상세','<div class="dc-feed">'+feedHtml+'</div>')+
   p('c4','이번 주 활동량 · 유형','담당자 클릭=활동 근거',actBars+'<div class="dc-legend"><span><i style="background:#3B6CE4"></i>전화·문자</span><span><i style="background:#0E9F8A"></i>방문·미팅</span><span><i style="background:#E08A00"></i>견적·입찰</span></div>')+
   '</div>';
 }
 /* ─── 성과 분석 다크 판정 보드 (2026-09-24) ─── */
 /* 성과 분석 제외 명단 (2026-09-25 지시): 외부 협력 인원은 판정 대상에서 뺀다. 데이터·필터에는 영향 없음. */
 /* 2026-09-25 장기원칙 ⑯: 이름 명단 대신 사람 마스터의 perfConsoleHidden 플래그 (2026-09-24 대표 지시 '성과분석에서 전용성·조성용 제외'는 시드 플래그로 이관) */
 function perfConsole(s){
  const f=state(),now=new Date(),curM=now.getMonth()+1;
  const csY=csSum({...f,month:0}),csM=csSum({...f,month:curM,quarter:0});
  const elapsed=String(f.year)===String(now.getFullYear())?now.getMonth()+1:12;
  const m0=x=>x===null||x===undefined?'확인 필요':money(x);
  const paceOf=(y,m)=>{if(y==null||m==null)return null;const avg=elapsed>1?(y-m)/(elapsed-1):y;if(!(avg>0))return m>0?150:null;return Math.round(m/avg*100)};
  const rs=repStats(s).filter(x=>!root.repProfile(x.name).perfConsoleHidden).map(x=>{
   const cs=csSum({...f,month:0,owner:x.name});
   const csCount=cs?cs.count:null,conv=csCount!=null&&(csCount+x.act.length)>0?Math.round(csCount/(csCount+x.act.length)*100):null;
   return {...x,csCount,conv,pace:paceOf(x.ySales,x.mSales)};
  }).sort((a,b)=>(b.ySales||0)-(a.ySales||0));
  lastDiags=diagnose(rs);
  const mVals=Array.from({length:12},(_,i)=>{const x=csSum({...f,month:i+1,quarter:0});return x?Math.max(0,x.netAmount):0});
  const avgAll=csY&&csM&&elapsed>1?(csY.netAmount-csM.netAmount)/(elapsed-1):null;
  const paceAll=paceOf(csY?csY.netAmount:null,csM?csM.netAmount:null);
  const cover=avgAll&&avgAll>0?(s.expected/avgAll).toFixed(1):null;
  const lag=rs.filter(x=>x.pace!=null&&x.pace<70).map(x=>x.name);
  const gauge=(pct,size,color)=>{const r=size===150?58:36,C=Math.round(2*Math.PI*r),sw=size===150?14:10,len=pct==null?0:Math.min(1.35,Math.max(0.02,pct/100))/1.5*C;
   return '<div class="pf-gauge dc-donut" style="width:'+size+'px;height:'+size+'px"><svg viewBox="0 0 '+(r*2+24)+' '+(r*2+24)+'" width="'+size+'" height="'+size+'"><g transform="rotate(-90 '+(r+12)+' '+(r+12)+')"><circle cx="'+(r+12)+'" cy="'+(r+12)+'" r="'+r+'" fill="none" stroke="#eef1f6" stroke-width="'+sw+'"/><circle cx="'+(r+12)+'" cy="'+(r+12)+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-dasharray="'+len.toFixed(1)+' '+(C+9)+'" stroke-linecap="round"/></g></svg><div class="pf-pct"><b>'+(pct==null?'-':pct+'%')+'</b><span>월평균 대비</span></div></div>'};
  const paceColor=p=>p==null?'#94a3b8':p>=100?'#0E9F8A':p>=70?'#3B6CE4':'#E08A00';
  const why=x=>{
   if(x.ySales==null)return {cls:'',text:'계약 원장 확인 후 판정이 표시됩니다.'};
   if(x.overdue>0){const st={};x.act.filter(d=>d.issues.includes('overdue')).forEach(d=>{st[d.stageLabel]=(st[d.stageLabel]||0)+1});const w=Object.entries(st).sort((a,b)=>b[1]-a[1])[0];
    return {cls:'bad',text:'기한초과 '+x.overdue+'건'+(w?' — '+w[0]+' 단계에 몰림':'')+' · 마감 관리가 병목'}}
   if((x.mSales||0)===0&&x.act.length>=3){const st={};x.act.forEach(d=>{st[d.stageLabel]=(st[d.stageLabel]||0)+1});const w=Object.entries(st).sort((a,b)=>b[1]-a[1])[0];
    return {cls:'bad',text:'이번 달 매출 0'+(w?' — '+w[0]+'에 '+w[1]+'건('+Math.round(w[1]/x.act.length*100)+'%) 정체':'')}}
   if(x.weekly===0||x.contact>=3)return {cls:'warn',text:'주간 활동 '+x.weekly+'건 · 마지막 연락 7일 이상 전 '+x.contact+'건 — 연락 유지 필요'};
   return {cls:'good',text:'페이스 정상 — 파이프라인 '+money(x.expected)+' 보유'}};
  const cards=rs.map((x,i)=>{const w=why(x),rank=i===0?'<span class="pf-rank">1위</span>':x.pace!=null&&x.pace<70?'<span class="pf-rank low">주의</span>':'<span class="pf-rank mid">'+(i+1)+'위</span>';
   return '<button type="button" class="dc-p pf-card c4" data-si-action="person" data-value="'+a(x.name)+'"><span class="pf-who">'+rank+'<b>'+h(x.name)+'</b><small>'+(x.last?h(M.date(new Date(x.last.at).toISOString())):'')+'</small></span>'+gauge(x.pace,96,paceColor(x.pace))+'<span class="pf-facts"><i>매출·연 <b>'+m0(x.ySales)+'</b></i><i>매출·월 <b>'+m0(x.mSales)+'</b></i><i>전환율 <b>'+(x.conv==null?'-':x.conv+'%')+'</b></i><i>진행 <b>'+x.act.length+'건</b></i><i>주간활동 <b>'+x.weekly+'건</b></i><i>문제 <b'+(x.overdue+x.missing?' class="pf-bad"':'')+'>'+(x.overdue+x.missing)+'건</b></i></span><span class="pf-why '+w.cls+'">'+h(w.text)+'</span></button>'}).join('');
  const verdict='<div class="dc-p pf-verdict c12"><div class="dc-ph">전사 판정<small>매출=계약금액 · 페이스=본인 월평균 대비 이번 달 · 목표 금액 등록 시 목표 기준으로 전환</small></div><div class="dc-pb pf-vgrid">'
   +gauge(paceAll,150,paceColor(paceAll))
   +'<div class="pf-sentence">'+(csY?
     f.year+'년 누적 매출 <b>'+m0(csY.netAmount)+'</b> · 월평균 '+(avgAll?money(avgAll):'-')+'. '+curM+'월은 <b>'+m0(csM?csM.netAmount:null)+'</b>'+(paceAll!=null?' — 월평균 대비 <b class="'+(paceAll>=100?'g':paceAll>=70?'':'w')+'">'+paceAll+'%</b>':'')+'.'
     +(cover?' 파이프라인 '+money(s.expected)+'은 월평균의 <b>'+cover+'개월치</b>입니다.':'')
     +(lag.length?'<br><span class="w">'+h(lag.join('·'))+' — 페이스 70% 미만</span>, 원인은 아래 카드의 문장에 있습니다.':'')
    :'계약 원장을 확인하지 못했습니다. 과거 수주 이관을 실행하면 판정이 표시됩니다.')+'</div>'
   +'<div class="pf-num"><b>'+m0(csY?csY.netAmount:null)+'</b><span>연 누적 매출 · 계약 '+(csY?csY.count:'-')+'건</span><em>이번 달 <b>'+m0(csM?csM.netAmount:null)+'</b> · 파이프라인 <b>'+money(s.expected)+'</b></em></div></div></div>';
  const table='<div class="si-table-scroll"><table class="si-table dc-table"><thead><tr><th>담당자</th><th>매출·연</th><th>매출·월</th><th>페이스</th><th>전환율</th><th>진행</th><th>주간활동</th><th>문제</th></tr></thead><tbody>'
   +rs.map(x=>'<tr><td>'+btn(x.name,'person',x.name)+'</td><td><b>'+m0(x.ySales)+'</b></td><td><b>'+m0(x.mSales)+'</b></td><td'+(x.pace!=null&&x.pace<70?' class="pf-bad"':'')+'>'+(x.pace==null?'-':x.pace+'%')+'</td><td>'+(x.conv==null?'-':x.conv+'%')+'</td><td>'+x.act.length+'</td><td>'+x.weekly+'건</td><td><span class="dc-pill'+(x.overdue+x.missing?'':' z')+'">'+(x.overdue+x.missing)+'</span></td></tr>').join('')+'</tbody></table></div>';
  return '<div class="dc-topbar">'+'<span class="dc-nav">'+btn('전체 현황 ↗','navigate','dash')+btn('컨트롤타워 ↗','navigate','control')+(root.ContractSalesUI?.advisorySync&&root.CRMRelease?.has?.('crm_advisory_attribution_v1')!==false?'<button type="button" data-si-action="advisory-sync">기술자문 낙찰실적 확정</button>':'')+'</span></div><div class="dc-grid">'+verdict+cards
   +'<div class="dc-p c8"><div class="dc-ph">월별 매출 추이<small>계약 체결일 기준 · 월 클릭=근거</small></div><div class="dc-pb">'+dcLine(mVals,460,118,'#3B6CE4','pfg1',money,'cs-month')+'</div></div>'
   +'<div class="dc-p c4"><div class="dc-ph">담당자 랭킹<small>이름 클릭=상세</small></div><div class="dc-pb" style="padding-top:4px">'+table+'</div></div>'
   +'<div class="dc-p c4" id="pf-advisory" hidden><div class="dc-ph">기술자문 낙찰실적<small>확정분만 · 낙찰확정일 기준 · VAT 별도</small></div><div class="dc-pb pf-adv-body"></div></div>'
   +'</div>';
 }
 function animateConsole(host){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  host.querySelectorAll('.dc-draw').forEach((el,i)=>{try{const L=el.getTotalLength();el.style.strokeDasharray=L;el.style.strokeDashoffset=L;el.style.transition='stroke-dashoffset 1s cubic-bezier(.3,.6,.3,1) '+(0.3+i*0.15)+'s';requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.strokeDashoffset=0}))}catch(e){}});
  host.querySelectorAll('.dc-area,.dc-dot').forEach(el=>{el.style.opacity=0;el.style.transition='opacity .5s ease 1.1s';requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.opacity=1}))});
  host.querySelectorAll('.dc-donut g circle[stroke-dasharray]').forEach((c,i)=>{const d=c.getAttribute('stroke-dasharray');c.setAttribute('stroke-dasharray','0 240');c.style.transition='stroke-dasharray .9s cubic-bezier(.3,.6,.3,1) '+(0.4+i*0.12)+'s';requestAnimationFrame(()=>requestAnimationFrame(()=>{c.setAttribute('stroke-dasharray',d)}))});
  host.querySelectorAll('.dc-kpi b,.pf-num>b,.pf-pct b').forEach(b=>{const m=b.textContent.match(/^([0-9,]+(?:\.[0-9]+)?)(.*)$/);if(!m)return;const target=parseFloat(m[1].replace(/,/g,'')),suffix=m[2],dec=(m[1].split('.')[1]||'').length,t0=performance.now(),ease=t=>1-Math.pow(1-t,3);
   const step=ts=>{const t=Math.min((ts-t0)/800,1);b.textContent=(target*ease(t)).toLocaleString('ko-KR',{minimumFractionDigits:dec,maximumFractionDigits:dec})+suffix;if(t<1)requestAnimationFrame(step)};requestAnimationFrame(step)});
 }
 /* 주간 영업점검(2026-09-26 컨설턴트 P1 '금요일 주간 점검'): 이번 주 월요일~오늘, '누가 바빴나'가 아니라 '어디서 흐름이 끊겼나'.
    금요일엔 펼쳐서, 다른 날엔 접어서. 잔디 자동 발송 전까지는 '문구 복사'(보낸 척 금지). */
 function weeklyReview(){
  const r=rows(),now=new Date(),ts=v=>Date.parse(v||''),mon=new Date(now);mon.setHours(0,0,0,0);mon.setDate(mon.getDate()-((mon.getDay()+6)%7));
  const w0=mon.getTime(),nextMon=w0+7*864e5,nextSun=nextMon+7*864e5,friday=now.getDay()===5;
  const md=t=>{const x=new Date(t);return (x.getMonth()+1)+'/'+x.getDate();},pct=(n,t)=>t?Math.round(n/t*100)+'%':'-';
  const ATT=/^\s*전화 시도/,isContact=x=>FLOW_Q.contact.test(String(x.type||''))&&!ATT.test(String(x.note||''))&&!/^[a-z0-9_]+$/.test(String(x.type||''));
  const isPromise=x=>/약속/.test(String(x?.type||''))||/^\s*고객\s*약속/.test(String(x?.text||''));
  /* 새 문의 · 첫 연락 */
  const inq=r.inquiries.filter(q=>ts(q.item.received_at||q.item.created_at||q.created)>=w0);
  const firstOk=inq.filter(q=>{const a=ts(q.item.received_at||q.item.created_at),f=ts(q.item.first_response_at);return Number.isFinite(f)&&f-a<=2*3600e3;}).length;
  const noFirst=inq.filter(q=>!q.item.first_response_at&&q.owner!=='미배정').length,unassigned=inq.filter(q=>q.owner==='미배정').length;
  /* 연락 결과 · 연결 · 결과 안 남긴 통화 · 약속 · 지원 */
  let contacts=0,linked=0,judged=0,calls=0,callsOpen=0,promDue=0,promKept=0,supIn=0,supDone=0;const promMiss=[];
  r.deals.forEach(d=>{
   const it=d.item,acts=[].concat(it.activities||it.activity_signals||[]),sets=acts.filter(x=>x&&x.type==='next_action_set').map(x=>ts(x.at||x.occurred_at));
   acts.forEach(x=>{const at=ts(x.at||x.occurred_at);if(!Number.isFinite(at)||at<w0)return;const note=String(x.note||'');
    if(note.startsWith('[지원 요청]'))supIn++;if(note.startsWith('[지원 처리]'))supDone++;
    if(ATT.test(note)){calls++;if(!acts.some(y=>y!==x&&!ATT.test(String(y.note||''))&&ts(y.at||y.occurred_at)>at&&ts(y.at||y.occurred_at)<=at+2*3600e3)&&Date.now()-at>2*3600e3)callsOpen++;return;}
    if(!isContact(x))return;contacts++;if(Date.now()-at<864e5)return;judged++;if(sets.some(t=>t>=at-6e5&&t<=at+864e5)||ts(it.closed_at)>=at)linked++;});
   const open=it.nextActionObj||it.next_action,list=[].concat(Array.isArray(it.completed_actions)?it.completed_actions:[],open&&open.status!=='completed'&&(open.due_at||open.due)?[Object.assign({},open,{status:'open'})]:[]);
   list.forEach(x=>{if(!isPromise(x))return;const due=ts(String(x.due_at||x.due||'').slice(0,10)+'T23:59:59');if(!Number.isFinite(due)||due<w0||due>Date.now())return;promDue++;const done=x.status==='completed'&&ts(x.completed_at)<=due;if(done)promKept++;else promMiss.push(d);});
  });
  /* 흐름 멈춤 · 담당자별 문제 한 줄 · 다음 주 */
  const act=r.deals.filter(d=>d.active),stall=act.filter(d=>d.issues.includes('stall')).sort((a,b)=>(Number(b.item.amt||b.expected||0))-(Number(a.item.amt||a.expected||0))).slice(0,5);
  const byRep={};act.forEach(d=>{const o=d.owner&&d.owner!=='미배정'?d.owner:null;if(!o)return;const R=byRep[o]=byRep[o]||{missing:0,promise:0,stall:0,overdue:0};if(d.issues.includes('missing'))R.missing++;if(d.issues.includes('promise'))R.promise++;if(d.issues.includes('stall'))R.stall++;else if(d.issues.includes('overdue'))R.overdue++;});
  const repLines=Object.entries(byRep).map(([k,v])=>[k,[v.promise?'약속 지남 '+v.promise:'',v.stall?'흐름 멈춤 '+v.stall:'',v.missing?'다음 할 일 없음 '+v.missing:'',v.overdue?'기한 지남 '+v.overdue:''].filter(Boolean)]).filter(x=>x[1].length).sort((a,b)=>b[1].length-a[1].length);
  const nextWeek=act.map(d=>{const a=d.item.nextActionObj||d.item.next_action,due=ts(String(a&&(a.due||a.due_at)||'').slice(0,10)+'T12:00:00');return {d,a,due};}).filter(x=>x.a&&Number.isFinite(x.due)&&x.due>=nextMon&&x.due<nextSun&&(isPromise(x.a)||['compete','imminent','bidding','contract'].includes(root.dealStage?root.dealStage(x.d.item):''))).sort((a,b)=>a.due-b.due).slice(0,6);
  const lines=['[주간 영업점검] '+md(w0)+'~'+md(now.getTime()),
   '· 새 문의 '+inq.length+'건 · 첫 연락 2시간 안 '+pct(firstOk,inq.length)+(noFirst?' · 아직 첫 연락 전 '+noFirst+'건':'')+(unassigned?' · 미배정 '+unassigned+'건':''),
   '· 연락 결과 '+contacts+'건 · 다음 할 일 연결 '+pct(linked,judged)+(callsOpen?' · 결과 안 남긴 통화 '+callsOpen+'건':''),
   '· 고객 약속 기한 '+promDue+'건 중 지킴 '+promKept+'건'+(supIn||supDone?' · 지원 요청 '+supIn+'건 / 처리 '+supDone+'건':''),
   stall.length?'· 흐름 멈춤: '+stall.map(d=>d.site).join(', '):'· 흐름 멈춤 없음',
   ...repLines.map(([k,v])=>'  - '+k+': '+v.join(' · ')),
   nextWeek.length?'· 다음 주 챙길 것: '+nextWeek.map(x=>md(x.due)+' '+x.d.site+' ('+(x.a.text||'')+')').join(' / '):''].filter(Boolean);
  const tiles=[['새 문의',inq.length+'건','첫 연락 2시간 안 '+pct(firstOk,inq.length)],['연락 결과',contacts+'건','다음 할 일 연결 '+pct(linked,judged)],['결과 안 남긴 통화',callsOpen+'건','전화 '+calls+'건 중'],['고객 약속',promKept+' / '+promDue,'기한 내 지킴'],['지원 요청',supIn+'건','처리 '+supDone+'건']];
  return '<details class="dc-p c12 wr-panel"'+(friday?' open':'')+'><summary class="dc-ph">이번 주 영업점검 <small>'+h(md(w0)+' ~ '+md(now.getTime()))+(friday?' · 금요일 점검':' · 금요일에 펼쳐서 확인')+' — 누가 바빴나가 아니라 어디서 흐름이 끊겼나</small></summary><div class="dc-pb wr-body">'
   +'<div class="wr-tiles">'+tiles.map(t=>'<div class="wr-tile"><span>'+t[0]+'</span><b>'+h(t[1])+'</b><small>'+h(t[2])+'</small></div>').join('')+'</div>'
   +'<div class="wr-cols"><section><h4>흐름 멈춤 상위 5</h4>'+(stall.length?stall.map(d=>btn(d.site+' · '+(d.owner||'미배정'),'record',d.key)).join(''):'<p class="dc-mut">흐름이 멈춘 진행 영업이 없습니다.</p>')+'</section>'
   +'<section><h4>담당자별 챙길 것</h4>'+(repLines.length?repLines.map(([k,v])=>'<p class="wr-rep">'+btn(k,'person',k)+' '+h(v.join(' · '))+'</p>').join(''):'<p class="dc-mut">담당자별로 끊긴 흐름이 없습니다.</p>')+'</section>'
   +'<section><h4>다음 주 챙길 약속·입찰·PT</h4>'+(nextWeek.length?nextWeek.map(x=>btn(md(x.due)+' '+x.d.site+' — '+(x.a.text||''),'record',x.d.key)).join(''):'<p class="dc-mut">다음 주 기한의 약속·입찰·PT 일정이 없습니다.</p>')+'</section></div>'
   +'<div class="wr-copy"><textarea readonly aria-label="주간 점검 요약 문구" rows="'+Math.min(10,lines.length+1)+'">'+h(lines.join('\n'))+'</textarea><button type="button" data-si-action="wr-copy">잔디용 문구 복사</button><small>자동 발송은 준비 중 — 복사해서 잔디에 붙여 넣어 주세요</small></div>'
   +'</div></details>';
 }
 /* 영업 패턴(2026-09-26 컨설턴트 '숨어 있는 신호'): 결과만으로는 안 보이던 과정의 패턴 — 행동과 결과를 잇는다.
    표본이 적으면 흐리게(10건 미만) · 담당자 비교는 '누가 바쁜가'가 아니라 '어느 과정에서 멈추나'를 보는 용도. */
 function patternsPanel(){
  const r=rows(true),deals=r.deals,ts=v=>Date.parse(v||''),MIN=10;
  const hist=it=>(it.stageHistory||it.stage_history||[]).map(x=>({to:String(x.to||x.to_stage||''),t:ts(x.at||x.changed_at)})).filter(x=>Number.isFinite(x.t));
  const acts=it=>(it.activities||it.activity_signals||[]).map(x=>({type:String(x.type||''),note:String(x.note||''),t:ts(x.at||x.occurred_at)})).filter(x=>Number.isFinite(x.t)&&!/^[a-z0-9_]+$/.test(x.type));
  const isContact=x=>FLOW_Q.contact.test(x.type)&&!/^\s*전화 시도/.test(x.note);
  const outcome=d=>typeof root.outcomeOf==='function'?root.outcomeOf(d.item):(d.won?'won':'open');
  const median=a=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
  const pct=(n,t)=>t?Math.round(n/t*100)+'%':'-';
  const faint=n=>n<MIN?' class="pt-faint"':'';
  /* ① 견적 발송 후 첫 후속 연락까지(일) vs 수주율 */
  const byRep={};
  deals.forEach(d=>{const o=d.owner&&d.owner!=='미배정'?d.owner:'미배정',R=byRep[o]=byRep[o]||{gaps:[],won:0,lost:0};
   const oc=outcome(d);if(oc==='won')R.won++;else if(oc==='lost')R.lost++;
   const sent=hist(d.item).filter(x=>x.to==='sent').sort((a,b)=>a.t-b.t)[0];if(!sent)return;
   const first=acts(d.item).filter(x=>isContact(x)&&x.t>sent.t).sort((a,b)=>a.t-b.t)[0];if(first)R.gaps.push((first.t-sent.t)/864e5);});
  const repRows=Object.entries(byRep).filter(([k,v])=>k!=='미배정'&&(v.gaps.length||v.won+v.lost)).sort((a,b)=>(median(a[1].gaps)??99)-(median(b[1].gaps)??99));
  const t1=repRows.length?'<div class="si-table-scroll"><table class="si-table pt-table"><thead><tr><th>담당자</th><th>견적 후 첫 후속</th><th>수주율</th></tr></thead><tbody>'+repRows.map(([k,v])=>{const m=median(v.gaps);return '<tr'+faint(v.gaps.length)+'><td>'+btn(k,'person',k)+'</td><td>'+(m==null?'-':(Math.round(m*10)/10)+'일')+' <small>'+v.gaps.length+'건</small></td><td>'+pct(v.won,v.won+v.lost)+' <small>종료 '+(v.won+v.lost)+'건</small></td></tr>';}).join('')+'</tbody></table></div>':empty('견적 발송 이력이 아직 없습니다.');
  /* ② 현장 방문 → 견적 */
  const SENT_OR_LATER=['sent','compete','imminent','bidding','contract','construction','completion','won'];
  const visited=deals.filter(d=>acts(d.item).some(x=>/방문/.test(x.type)||/^방문|현장 ?방문/.test(x.note)));
  const toQuote=visited.filter(d=>hist(d.item).some(x=>SENT_OR_LATER.includes(x.to))||SENT_OR_LATER.includes(String(d.item.stage_code||d.item.code||'')));
  /* ③ 경쟁·PT·입찰 이후 결과 */
  const COMP=['compete','imminent','bidding'],comp=deals.filter(d=>hist(d.item).some(x=>COMP.includes(x.to))||COMP.includes(String(d.item.stage_code||d.item.code||'')));
  const cw=comp.filter(d=>outcome(d)==='won').length,cl=comp.filter(d=>outcome(d)==='lost').length;
  /* ④ 브랜드별 문의 → 영업건 전환 */
  const linked=new Set(deals.map(d=>String(d.item.origin_inquiry_id||d.item.originInquiryId||'')).filter(Boolean));
  const byBrand={};r.inquiries.forEach(q=>{const b=q.brand||q.item.brand||'미분류',B=byBrand[b]=byBrand[b]||{n:0,c:0};B.n++;if(linked.has(String(q.item.id||''))||q.item.deal_id||q.item.opportunity_id)B.c++;});
  const brands=Object.entries(byBrand).sort((a,b)=>b[1].n-a[1].n).slice(0,6);
  const t4=brands.length?'<div class="si-table-scroll"><table class="si-table pt-table"><thead><tr><th>브랜드</th><th>문의</th><th>영업건 전환</th></tr></thead><tbody>'+brands.map(([b,v])=>'<tr'+faint(v.n)+'><td>'+h(b)+'</td><td>'+number(v.n)+'</td><td>'+pct(v.c,v.n)+' <small>'+v.c+'건</small></td></tr>').join('')+'</tbody></table></div>':empty('문의 데이터가 없습니다.');
  const tile=(label,val,sub,n)=>'<div class="pt-tile'+(n<MIN?' pt-faint':'')+'"><span>'+label+'</span><b>'+val+'</b><small>'+sub+'</small></div>';
  return '<div class="dc-p c12 pt-panel"><div class="dc-ph">영업 패턴<small>과정과 결과를 잇는 신호 · 표본 '+MIN+'건 미만은 흐리게 — 10월부터 기록이 쌓이면 의미가 생깁니다</small></div><div class="dc-pb pt-grid">'
   +'<section><h4>견적 발송 후 첫 후속 연락 · 담당자별</h4><p class="pt-q">견적을 빨리 보내도 후속이 늦으면 수주율이 낮아지는가?</p>'+t1+'</section>'
   +'<section><h4>과정 전환</h4><div class="pt-tiles">'+tile('현장 방문 → 견적',pct(toQuote.length,visited.length),'방문 '+visited.length+'건 중 '+toQuote.length+'건',visited.length)+tile('경쟁·PT·입찰 → 수주',pct(cw,cw+cl),'수주 '+cw+' · 실주 '+cl+' · 진행 중 '+(comp.length-cw-cl),cw+cl)+'</div>'
   +'<h4>브랜드별 문의 → 영업건 전환</h4><p class="pt-q">문의는 많은데 영업으로 안 이어지는 브랜드가 있는가?</p>'+t4+'</section></div></div>';
 }
 function render(){
  const page=root.G.page;if(!['dash','control','perf'].includes(page)||!root.B){lastAnimKey='';return}
  const f=state(),s=data(),host=document.getElementById('si-'+page);
  if(!host)return;
  document.getElementById('pg-'+page).classList.add('si-active');
  const rep=page==='perf'&&f.view==='rep',selected=rep&&f.owner!=='전체';
  let body='';
  if(page==='control')body=control(s);
  else if(rep&&!selected)body='<div class="si-grid">'+card('영업사원 선택',empty('상단 담당자 필터에서 확인할 영업사원을 선택해 주세요.'))+'</div>';
  else if(page==='dash')body=dashConsole(s);
  else if(page==='perf'&&!rep){body=perfConsole(s);try{body+='<div class="pt-wrap">'+patternsPanel()+'</div>';}catch(e){if(root.console&&root.console.warn)root.console.warn('patterns: '+e.message);}}
  else body=kpis(s,rep)+'<div class="si-grid">'+stages(s)+(rep?execution(s):trend(s))+'</div>'+(rep?card('현재 관리가 필요한 영업 · '+s.risk.length+'건',records(M.select(s,'risk',{}),8)+btn('전체 확인 →','drill','risk'))+recent(s):people(s,0));
  const dark=page==='dash'||page==='control'||(page==='perf'&&!rep);
  setTimeout(fillAdvisoryCard,0);setTimeout(fillDataRisk,0);
  host.innerHTML='<div class="si-shell'+(dark?' si-dark':'')+'">'+filters(dark)+(page==='perf'?'<div class="si-views" role="group" aria-label="분석 관점">'+btn('대표용 보기','view','lead',f.view==='lead'?'selected':'')+btn('영업사원용 보기','view','rep',rep?'selected':'')+'</div>':'')+'<p class="si-period">'+h(f.year)+'년 '+(f.month?f.month+'월':f.quarter?f.quarter+'분기':'연간')+' 접수·계약실적 / 파이프라인·조치 필요는 현재 기준'+(s.missingWonDate?' · 수주 확정일 미입력 '+s.missingWonDate+'건 제외':'')+'</p>'+body+'</div>';
  host.onclick=onClick;host.onchange=onChange;host.onkeydown=e=>{if(e.target.matches('[data-si-search]')&&e.key==='Enter'){f.search=e.target.value;f.page=1;render()}};
  // 진입 애니메이션은 페이지 전환 시 1회만 — 백그라운드 갱신 재렌더에는 재생하지 않는다.
  const animKey=page+'|'+actor+'|'+(rep?'rep':'lead');
  if(dark&&lastAnimKey!==animKey)animateConsole(host);
  lastAnimKey=animKey;
 }
 function onChange(e){const el=e.target,key=el.dataset.siFilter;if(key){const f=state();f[key]=['month','page'].includes(key)?Number(el.value):el.value;f.page=1;if(key==='kind'){f.issue='all';f.stage='all'}if(key==='owner')root.SalesScope.change('owner',el.value);render()}else if(el.matches('[data-si-search]')){state().search=el.value;state().page=1;render()}}
 function onClick(e){
  if(e.target.matches('#ct-all'))document.querySelectorAll('#si-control [data-ct-sel]').forEach(n=>{n.checked=e.target.checked});
  if(e.target.matches('[data-ct-sel],#ct-all')){const c=document.getElementById('ct-count');if(c)c.textContent=document.querySelectorAll('#si-control [data-ct-sel]:checked').length;return;}
  const chip=e.target.closest('[data-si-filterchip]');
  if(chip){const fc=state();fc[chip.dataset.siFilterchip]=chip.dataset.value;fc.issue='all';fc.stage='all';fc.page=1;render();return;}
  const b=e.target.closest('[data-si-action]');if(!b)return;const action=b.dataset.siAction,v=b.dataset.value,f=state();
  if(action==='advisory-sync'){root.ContractSalesUI?.advisorySync?.();return;}
  if(action==='inquiry-convert'){root.InquiryConversion?.open?.();return;}
  if(action==='navigate')root.goPage(v);
  if(action==='view'){f.view=v;render()}
  if(action==='quarter'){f.quarter=Number(v);f.month=0;f.page=1;render();return}
  if(action==='ct-clear'){const ct=ctState();ct.owner='';ct.issue='all';f.page=1;render();return}
  if(action==='ct-focus'){const parts=String(v).split('|'),ct=ctState();ct.owner=parts[0];ct.issue=parts[1]||'all';if(parts[2])f.kind=parts[2];f.issue='all';f.stage='all';f.search='';f.page=1;render();return}
  if(action==='ct-order'||action==='ct-bulk'){
   if(!root.PipelineBatch?.openRows)return;
   const ct=ctState(),d=data();let targets;
   if(action==='ct-order')targets=d.active.filter(x=>x.owner===v&&x.issues.length);
   else{const keys=new Set([...document.querySelectorAll('#si-control [data-ct-sel]:checked')].map(n=>n.dataset.ctSel));targets=d.deals.filter(x=>keys.has(x.key));}
   const ids=new Set(targets.map(x=>String(x.item.id)));
   const rows2=(root.PipelineWorkspace?.rows({})||[]).filter(r=>r.item&&ids.has(String(r.item.id)));
   if(!rows2.length){root.alert('지시할 파이프라인 건을 먼저 선택해 주세요.');return}
   root.PipelineBatch.openRows(rows2,'next');return;
  }
  if(action==='page'){f.page=Number(v);render()}
  if(action==='stage'&&root.PipelineWorkspace){const filters={...f,owner:b.closest('#si-person')?.dataset.owner||f.owner};close(false);root.PipelineWorkspace.open(v,filters);return;}
  if(action==='drill'&&v==='contract'){const panel=document.querySelector('#si-'+root.G.page+' .contract-sales-panel');if(panel){panel.scrollIntoView({block:'start',behavior:'smooth'});return;}openEvidence('계약실적 근거 · '+f.year+'년'+(f.month?' '+f.month+'월':''),'계약 체결·변경·취소 원장 기록 · 상세 표는 성과 분석에서',contractEvidence(f.month?{month:f.month}:{}));return;}
  if(root.G.page==='dash'||root.G.page==='perf'&&f.view==='lead'){
   const s=()=>data();
   if(action==='drill'){const d=s();let list=[],title='';
    if(v==='inquiries'){title='문의 · '+d.inquiries.length+'건';list=d.inquiries.map(evRow)}
    else if(v==='active'){title='진행 파이프라인 · '+d.active.length+'건';list=d.active.map(x=>({...evRow(x),reason:x.reason||'진행 중'}))}
    else if(v==='risk'){title='조치 필요 · '+d.risk.length+'건';list=M.select(d,'risk',f).map(evRow)}
    else if(labels[v]){const rows2=d.active.filter(x=>x.issues.includes(v));title=labels[v]+' · '+rows2.length+'건';list=rows2.map(evRow)}
    else if(v==='activity'){title='최근 7일 활동 근거';list=feedRows(s(),40).filter(x=>Date.parse(x.at)>=Date.now()-7*864e5).map(x=>({site:x.site,owner:x.owner,stageLabel:'활동',reason:M.date(x.at)+' · '+x.text,amt:x.amt,key:x.key}))}
    if(title){openEvidence(title,f.year+'년 '+(f.month?f.month+'월':f.quarter?f.quarter+'분기':'연간')+' · 클릭한 지표의 근거 목록',list);return}
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
  if(action==='person'){close(false);root.SalesScope.change('owner',v);f.view='lead';f.page=1;if(root.G.page==='perf')root.paint();else root.goPage('perf');return;}
  if(action==='close')close();
  if(action==='record')openRecord(v);
  if(action==='wr-copy'){const ta=document.querySelector('#si-control .wr-copy textarea'),txt=ta?ta.value:'',done=m=>{const b=document.querySelector('#si-control [data-si-action="wr-copy"]');if(b)b.textContent=m;};try{navigator.clipboard.writeText(txt).then(()=>done('복사했습니다 ✓'),()=>{if(ta){ta.focus();ta.select();}done('문구를 선택했습니다 — Ctrl+C');});}catch(e){if(ta){ta.focus();ta.select();}done('문구를 선택했습니다 — Ctrl+C');}}
  /* 관리자 개입(2026-09-26): 지원 요청 [처리] = 그 영업 상세 + 관리자 지원 처리 창 */
  if(action==='support-resolve'){openRecord(v);setTimeout(()=>{try{root.DetailActions?.open?.('support');}catch(e){}},450);}
 }
 function openRecord(key){
  // Recheck the current authorized bundle at click time; never keep stale row objects.
  const r=rows(),d=r.deals.concat(r.inquiries).find(x=>x.key===key);if(!d)return;
  close(false);root.G._detailPopup=true;
  if(d.type==='inq')root.drwInq(JSON.stringify(d.item));else root.drwDeal(JSON.stringify(d.item));
 }
 function close(restore=true){const node=document.getElementById('si-person');if(node){node.remove();document.body.style.overflow=''}if(restore&&focusBefore?.isConnected)focusBefore.focus();focusBefore=null}
 /* 담당자 클릭은 어느 화면에서든 해당 담당자로 스코프된 성과 분석으로 이동한다 (2026-09-24). */
 root.addEventListener('phase1:identity-cleared',()=>{close(false);root.G.insights=null;['dash','control','perf'].forEach(p=>{const el=document.getElementById('si-'+p);if(el)el.innerHTML=''})});
 root.SalesInsights={render,close,data,rows};
})(window);
