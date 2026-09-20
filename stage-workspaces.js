(function(root){
'use strict';
const h=x=>root.esc(String(x??'')), a=x=>root.escAttr(String(x??''));
const btn=(text,action,id)=>'<button type="button" data-ps-action="'+action+'" data-value="'+a(id)+'">'+h(text)+'</button>';
const money=x=>x==null||x===''?'금액 미입력':root.fmtAmt(Number(x));
const field=(r,code)=>r.item.stage_contexts?.[code]?.fields||{};
const empty='<p class="ps-empty">해당 업무가 없습니다.</p>';
const age=r=>r.last?Math.max(0,-root.daysTo(r.last)):null;
const due=r=>r.days==null?'일정 미지정':r.days<0?Math.abs(r.days)+'일 초과':r.days===0?'오늘':'D-'+r.days;
function stats(items){return '<div class="sw-stats">'+items.map(([k,v])=>'<div><span>'+h(k)+'</span><b>'+h(v)+'</b></div>').join('')+'</div>';}
function facts(items){return '<dl>'+items.map(([k,v])=>'<div><dt>'+h(k)+'</dt><dd>'+h(v||'미기록')+'</dd></div>').join('')+'</dl>';}
function card(r,body,label='처리',action='process'){return '<article class="sw-card" data-deal="'+a(r.key)+'"><header><div>'+btn(r.site,'record',r.key)+'<small>'+h(r.owner||'미배정')+' · '+h(root.dealWorkSummary(r.item)||'공종 미기록')+'</small></div></header>'+body+'<div class="sw-action">'+btn(label,action,r.key)+'</div></article>';}
function group(title,items,draw,cls=''){if(!items.length)return '';return '<section class="sw-group '+cls+'"><h3>'+h(title)+' <span>'+items.length+'건</span></h3><div class="sw-cards">'+(items.map(draw).join('')||empty)+'</div></section>';}
/* 관계관리 v2(A안): 담당자 현황판 + 단계 세그먼트 + «먼저 볼 것» 표.
   유대강화는 90일까지 — 초과분은 «침묵 전환» 제안. 프로모션 승인은 상세 팝업 카드에서. */
const REL_STAGES={rapport:'유대강화',silent:'침묵관리',waiting:'대기고객'};
function relPromoDue(r){return root.RelationshipPromo&&root.RelationshipPromo.due?root.RelationshipPromo.due(r.item):null;}
function relSilentNeeded(r){return r.code==='rapport'&&age(r)!=null&&age(r)>=90;}
function relResume(r){const f=r.item.stage_contexts?.waiting?.fields||{};return f.resume_date||r.fields.resume_date||'';}
function relationshipOwnerBoard(scopedOwner){
 const src=(root.PipelineWorkspace&&root.PipelineWorkspace.rows?root.PipelineWorkspace.rows({unscoped:true}):[]).filter(r=>r.group==='relationship');
 const map=new Map();
 src.forEach(r=>{
  const o=r.owner||'미배정',row=map.get(o)||{owner:o,rap:0,sil:0,wait:0,amount:0,over:0,silNeed:0,promo:0,maxAge:0};
  if(r.code==='rapport')row.rap++;else if(r.code==='waiting')row.wait++;else row.sil++;
  row.amount+=Number(r.amount)||0;
  if(r.days!=null&&r.days<0)row.over++;
  if(relSilentNeeded(r))row.silNeed++;
  if(relPromoDue(r))row.promo++;
  const contactAge=age(r);if(contactAge!=null)row.maxAge=Math.max(row.maxAge,contactAge);
  map.set(o,row);
 });
 const rows=Array.from(map.values());
 rows.forEach(x=>{x.light=x.over>=5||x.maxAge>=180||x.silNeed>=2?'r':(x.over+x.silNeed+x.promo)>0?'y':'g'});
 const order={r:0,y:1,g:2};
 rows.sort((a,b)=>order[a.light]-order[b.light]||b.over-a.over||b.promo-a.promo||(typeof root.repCompare==='function'?root.repCompare(a.owner,b.owner):String(a.owner).localeCompare(String(b.owner))));
 const total=rows.reduce((s,x)=>({rap:s.rap+x.rap,sil:s.sil+x.sil,wait:s.wait+x.wait,amount:s.amount+x.amount,over:s.over+x.over,silNeed:s.silNeed+x.silNeed,promo:s.promo+x.promo,maxAge:Math.max(s.maxAge,x.maxAge)}),{rap:0,sil:0,wait:0,amount:0,over:0,silNeed:0,promo:0,maxAge:0});
 const body=rows.map(x=>'<tr data-ps-action="owner" data-value="'+a(x.owner)+'"'+(scopedOwner===x.owner?' class="sel"':'')+'><td><span class="sw-light '+x.light+'"></span><b>'+h(x.owner)+'</b></td><td>'+x.rap+'</td><td>'+x.sil+'</td><td>'+x.wait+'</td><td class="sw-amt">'+h(money(x.amount).replace('금액 미입력','-'))+'</td><td class="'+(x.over?'sw-bad':'sw-zero')+'">'+x.over+'</td><td class="'+(x.silNeed?'sw-bad':'sw-zero')+'">'+x.silNeed+'</td><td class="'+(x.promo?'sw-warn':'sw-zero')+'">'+x.promo+'</td><td class="'+(x.maxAge>=180?'sw-bad':x.maxAge>=90?'sw-warn':'sw-zero')+'">'+(x.maxAge?x.maxAge+'일':'-')+'</td><td class="sw-go">'+(scopedOwner===x.owner?'전체 보기':'목록 보기')+'</td></tr>').join('')
  +'<tr class="sw-total"><td>전체</td><td>'+total.rap+'</td><td>'+total.sil+'</td><td>'+total.wait+'</td><td class="sw-amt">'+h(money(total.amount).replace('금액 미입력','-'))+'</td><td class="'+(total.over?'sw-bad':'sw-zero')+'">'+total.over+'</td><td class="'+(total.silNeed?'sw-bad':'sw-zero')+'">'+total.silNeed+'</td><td class="'+(total.promo?'sw-warn':'sw-zero')+'">'+total.promo+'</td><td>'+(total.maxAge?total.maxAge+'일':'-')+'</td><td></td></tr>';
 return '<section class="sw-owner-board" aria-label="담당자별 관계관리 현황"><header><h3>담당자별 현황</h3><small>위험 높은 순 · 행 클릭 = 아래 목록 필터</small>'+btn('전체 보기','owner','전체')+'</header><div class="sw-table-scroll"><table><thead><tr>'+['담당자','유대','침묵','대기','합계 금액','연락 초과','침묵 전환','발송 대기','최장 미접촉',''].map(t=>'<th scope="col">'+h(t)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div></section>';
}
function relationship(list){
 const f=root.G.pipelineQueue;
 const scopedOwner=root.SalesScope&&root.SalesScope.state?root.SalesScope.state().owner:'전체';
 const seg=root.G.relSeg&&REL_STAGES[root.G.relSeg]?root.G.relSeg:'all';
 const withMeta=list.map(r=>({r,promo:relPromoDue(r),silNeed:relSilentNeeded(r),contactAge:age(r),resume:r.code==='waiting'?relResume(r):''}));
 const segFiltered=withMeta.filter(x=>seg==='all'||x.r.code===seg||(seg==='silent'&&!['rapport','waiting'].includes(x.r.code)));
 const urgent=x=>(x.r.days!=null&&x.r.days<0)||x.silNeed||!!x.promo||(x.r.code==='waiting'&&!x.resume)||x.r.days===0;
 const first=segFiltered.filter(urgent).sort((p,q)=>((q.r.days!=null&&q.r.days<0)?-q.r.days:0)-((p.r.days!=null&&p.r.days<0)?-p.r.days:0)||(q.contactAge||0)-(p.contactAge||0));
 const rest=segFiltered.filter(x=>!urgent(x)).sort((p,q)=>String(p.r.due||'9999').localeCompare(String(q.r.due||'9999'))||String(p.r.key).localeCompare(String(q.r.key)));
 const ordered=first.concat(rest);
 const segBar='<nav class="sw-seg" aria-label="관계 단계">'+[['all','전체',withMeta.length],['rapport','유대강화',withMeta.filter(x=>x.r.code==='rapport').length],['silent','침묵관리',withMeta.filter(x=>!['rapport','waiting'].includes(x.r.code)).length],['waiting','대기고객',withMeta.filter(x=>x.r.code==='waiting').length]].map(([k,label,n])=>'<button type="button" data-ps-action="relseg" data-value="'+k+'" aria-pressed="'+(seg===k)+'">'+h(label)+' <b>'+n+'</b></button>').join('')+'</nav>';
 const pages=Math.max(1,Math.ceil(ordered.length/30));f.page=Math.min(f.page||1,pages);
 const shown=ordered.slice((f.page-1)*30,f.page*30);
 let markedFirst=false,markedRest=false,rowsHtml='';
 shown.forEach(x=>{
  const r=x.r,isFirst=urgent(x);
  if(isFirst&&!markedFirst){markedFirst=true;rowsHtml+='<tr class="sw-group-row hot"><td colspan="7">먼저 볼 것 — 연락 초과 · 오늘 · 침묵 전환 · 발송 대기 · 재개일 없음 ('+first.length+')</td></tr>';}
  if(!isFirst&&!markedRest){markedRest=true;rowsHtml+='<tr class="sw-group-row"><td colspan="7">정상 진행 ('+rest.length+')</td></tr>';}
  const stageChip='<span class="sw-stg sw-stg-'+(r.code==='rapport'?'rap':r.code==='waiting'?'wait':'sil')+'">'+h(REL_STAGES[r.code]||'침묵관리')+'</span>'+(x.silNeed?' <span class="sw-due-chip hot">3개월 초과</span>':'')+(x.promo?' <span class="sw-due-chip warn">'+h(x.promo.label)+' 발송 대기</span>':'');
  const nextChip=r.code==='waiting'?(x.resume?'<span class="sw-due-chip mut">재개 '+h(String(x.resume).slice(0,10))+'</span>':'<span class="sw-due-chip warn">재개일 없음</span>'):(r.days==null?'<span class="sw-due-chip warn">연락일 없음</span>':r.days<0?'<span class="sw-due-chip hot">'+Math.abs(r.days)+'일 지남</span>':r.days===0?'<span class="sw-due-chip warn">오늘</span>':'<span class="sw-due-chip ok">D-'+r.days+'</span>');
  const manage=(x.silNeed?btn('침묵 전환','stage-edit',r.key)+' ':'')+btn('처리','contact',r.key);
  rowsHtml+='<tr data-deal="'+a(r.key)+'"'+(isFirst?' class="sw-first"':'')+'><td>'+btn(r.site,'record',r.key)+(scopedOwner==='전체'?'<small>'+h(r.owner||'미배정')+'</small>':'')+'</td><td>'+stageChip+'</td><td>'+(x.contactAge==null?'미확인':x.contactAge+'일 전')+'</td><td>'+nextChip+(r.due?'<small>'+h(String(r.due).slice(0,10))+'</small>':'')+'</td><td>'+h(money(r.amount))+'</td><td>'+h(r.next?.text||'다음 연락 등록')+'</td><td>'+manage+'</td></tr>';
 });
 const table='<div class="sw-table-scroll"><table class="sw-work-table sw-frame"><thead><tr>'+['현장','단계','마지막 접촉','다음 연락','예상금액','다음 행동','관리'].map(t=>'<th scope="col">'+h(t)+'</th>').join('')+'</tr></thead><tbody>'+rowsHtml+'</tbody></table>'+(shown.length?'':empty)+'</div>';
 const scopeHead=scopedOwner!=='전체'?'<div class="sw-scope-head"><h3>'+h(scopedOwner)+' 담당 목록 <small>'+ordered.length+'건 · 먼저 볼 것 '+first.length+'</small></h3>'+btn('담당자 필터 해제','owner',scopedOwner)+'</div>':'';
 return relationshipOwnerBoard(scopedOwner)+segBar+scopeHead+'<p class="ps-queue-count">'+shown.length+' / '+ordered.length+'건 표시 · 먼저 볼 것 '+first.length+'건</p>'+table+'<footer class="sw-pager">'+btn('이전','page',String(Math.max(1,f.page-1)))+'<span>'+f.page+' / '+pages+'</span>'+btn('다음','page',String(Math.min(pages,f.page+1)))+'</footer>';
}
function contractReport(list){
 const now=new Date(),month=root.G.contractResultMonth||now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
 const s=root.ContractSalesData?.summarize({year:month.slice(0,4),month:Number(month.slice(5,7)),brand:root.G.brand,owner:root.SalesScope.state().owner});
 let report='<p class="ps-empty">계약실적 원장을 확인하지 못했습니다. '+btn('원장 다시 조회','contract-refresh','')+'</p>';
 if(s)report=stats([['신규 계약',s.count+'건'],['신규 계약금액',money(s.newAmount)],['변경 증감',money(s.amendmentAmount)],['취소 조정',money(s.cancellationAmount)],['순 계약실적',money(s.netAmount)]])+'<div class="sw-owner-results">'+(s.rows.map(r=>'<div><b>'+h(r.name)+'</b><span>'+r.count+'건</span><strong>'+h(money(r.netAmount))+'</strong></div>').join('')||'<p>해당 월에 확인된 계약실적이 없습니다.</p>')+'</div>';
 return '<section class="sw-result"><h3>계약실적</h3><label>실적 조회월 <input aria-label="계약실적 조회월" type="month" data-ps-filter="contractResultMonth" value="'+a(month)+'"></label><p>계약 체결일 기준 · 변경·취소는 발생일 반영. 현재 단계와 무관하며 계약 당시 담당자에게 귀속됩니다. 공종·현장 검색은 아래 수주 목록에만 적용됩니다.</p>'+report+'</section>';
}

function prepare(key,list){
 const ledger=root.ContractSalesData?.state(),contracts=new Map((ledger?.items||[]).map(c=>[String(c.deal_id),c]));
 return list.map(row=>{const values=root.StageSpecs.values(row,contracts.get(String(row.item.id)),{work:root.dealWorkSummary(row.item),stage:root.stageLabel(row.code)});return {row,values,priority:root.StageSpecs.priority(key,row,values,root.daysTo)};}).sort((a,b)=>root.StageSpecs.compare(key,a,b));
}
function display(key,value){return ['amount','contractAmount'].includes(key)?money(value):value;}
function table(key,items){
 const spec=root.StageSpecs.get(key),triage=key==='consulting';
 const columns=triage?['선택','우선','현장','담당자','왜 확인?','다음 업무','기한','관리']:['현장','담당자',...(key==='construction'?['계약 상태',...spec.queueFields.map(k=>root.StageSpecs.labels[k])]:spec.queueFields.map(k=>root.StageSpecs.labels[k])),'관리'];
 return '<div class="sw-table-scroll"><table class="sw-work-table"><thead><tr>'+columns.map(t=>'<th scope="col">'+(t==='선택'?'<input type="checkbox" aria-label="표시된 현장 모두 선택" data-triage-all>':h(t))+'</th>').join('')+'</tr></thead><tbody>'+items.map((x,i)=>{
  const r=x.row,v=x.values,t=x.triage,select=triage?'<td><input type="checkbox" aria-label="'+a(r.site)+' 선택" data-triage-select="'+a(r.key)+'"></td><td>'+((root.G.pipelineQueue.page-1)*30+i+1)+'</td>':'';
  const values=triage?[t.reason,r.next?.text||'다음 행동 등록',t.date?due({days:root.daysTo(t.date)}):'일정 미지정']:spec.queueFields.map(k=>display(k,v[k]));
  return '<tr data-deal="'+a(r.key)+'">'+select+'<td>'+btn(r.site,'record',r.key)+'</td><td>'+h(r.owner||'미배정')+'</td>'+(key==='construction'?'<td class="sw-contract-state">'+h(v.contractState)+'</td>':'')+values.map(value=>'<td>'+h(value||'미기록')+'</td>').join('')+'<td>'+btn('처리','primary',r.key)+'</td></tr>';
 }).join('')+'</tbody></table>'+(items.length?'':empty)+'</div>';
}
/* 컨설팅 v2: 담당자별 현황판(600건 한눈) + 행 클릭 시 아래 목록이 그 담당자로 좁혀지는 드릴다운. */
function consultingOwnerBoard(scopedOwner){
 const src=(root.PipelineWorkspace&&root.PipelineWorkspace.rows?root.PipelineWorkspace.rows({unscoped:true}):[]).filter(r=>r.group==='consulting');
 const map=new Map();
 src.forEach(r=>{
  const o=r.owner||'미배정',row=map.get(o)||{owner:o,count:0,amount:0,over:0,noNext:0,info:0,maxOver:0};
  row.count++;row.amount+=Number(r.amount)||0;
  const qd=r.fields&&r.fields.quote_due?root.daysTo(r.fields.quote_due):null;
  const overDays=Math.max(r.days!=null&&r.days<0?-r.days:0,qd!=null&&qd<0?-qd:0);
  if(overDays>0){row.over++;row.maxOver=Math.max(row.maxOver,overDays);}
  if(!r.next||!r.next.text)row.noNext++;
  const needs=r.item.stage_contexts?.first_contact?.fields?.needs||(r.fields&&r.fields.quote_request),work=root.dealWorkSummary(r.item);
  if(!needs||!work||/미분류|미기록/.test(String(work||'')))row.info++;
  map.set(o,row);
 });
 const rows=Array.from(map.values());
 rows.forEach(x=>{x.light=x.over>=10||x.maxOver>=30?'r':(x.over+x.noNext+x.info)>0?'y':'g'});
 const order={r:0,y:1,g:2};
 rows.sort((a,b)=>order[a.light]-order[b.light]||b.over-a.over||b.noNext-a.noNext||(typeof root.repCompare==='function'?root.repCompare(a.owner,b.owner):String(a.owner).localeCompare(String(b.owner))));
 const total=rows.reduce((s,x)=>({count:s.count+x.count,amount:s.amount+x.amount,over:s.over+x.over,noNext:s.noNext+x.noNext,info:s.info+x.info,maxOver:Math.max(s.maxOver,x.maxOver)}),{count:0,amount:0,over:0,noNext:0,info:0,maxOver:0});
 const body=rows.map(x=>'<tr data-ps-action="owner" data-value="'+a(x.owner)+'"'+(scopedOwner===x.owner?' class="sel"':'')+'><td><span class="sw-light '+x.light+'"></span><b>'+h(x.owner)+'</b></td><td>'+x.count+'</td><td class="sw-amt">'+h(money(x.amount).replace('금액 미입력','-'))+'</td><td class="'+(x.over?'sw-bad':'sw-zero')+'">'+x.over+'</td><td class="'+(x.noNext?'sw-warn':'sw-zero')+'">'+x.noNext+'</td><td class="'+(x.info?'sw-warn':'sw-zero')+'">'+x.info+'</td><td class="'+(x.maxOver>=30?'sw-bad':x.maxOver?'sw-warn':'sw-zero')+'">'+(x.maxOver?x.maxOver+'일':'-')+'</td><td class="sw-go">'+(scopedOwner===x.owner?'전체 보기':'목록 보기')+'</td></tr>').join('')
  +'<tr class="sw-total"><td>전체</td><td>'+total.count+'</td><td class="sw-amt">'+h(money(total.amount).replace('금액 미입력','-'))+'</td><td class="'+(total.over?'sw-bad':'sw-zero')+'">'+total.over+'</td><td class="'+(total.noNext?'sw-warn':'sw-zero')+'">'+total.noNext+'</td><td class="'+(total.info?'sw-warn':'sw-zero')+'">'+total.info+'</td><td>'+(total.maxOver?total.maxOver+'일':'-')+'</td><td></td></tr>';
 return '<section class="sw-owner-board" aria-label="담당자별 컨설팅 현황"><header><h3>담당자별 현황</h3><small>위험 높은 순 · 행 클릭 = 아래 목록 필터</small>'+btn('전체 보기','owner','전체')+'</header><div class="sw-table-scroll"><table><thead><tr>'+['담당자','담당','합계 금액','초과','Next 없음','정보 보완','최장 초과',''].map(t=>'<th scope="col">'+h(t)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div></section>';
}
/* 자료 발송완료 v2: 담당자별 현황판 + 후속 우선 단일 표. 상세는 팝업. */
function sentOwnerBoard(scopedOwner){
 const src=(root.PipelineWorkspace&&root.PipelineWorkspace.rows?root.PipelineWorkspace.rows({unscoped:true}):[]).filter(r=>r.group==='sent');
 const map=new Map();
 src.forEach(r=>{
  const o=r.owner||'미배정',row=map.get(o)||{owner:o,count:0,amount:0,over:0,today:0,none:0,maxOver:0};
  row.count++;row.amount+=Number(r.amount)||0;
  const fu=r.fields&&r.fields.followup_date,days=fu?root.daysTo(fu):null;
  if(days==null)row.none++;else if(days<0){row.over++;row.maxOver=Math.max(row.maxOver,-days);}else if(days===0)row.today++;
  map.set(o,row);
 });
 const rows=Array.from(map.values());
 rows.forEach(x=>{x.light=x.over>=5||x.maxOver>=14?'r':(x.over+x.today+x.none)>0?'y':'g'});
 const order={r:0,y:1,g:2};
 rows.sort((a,b)=>order[a.light]-order[b.light]||b.over-a.over||b.none-a.none||(typeof root.repCompare==='function'?root.repCompare(a.owner,b.owner):String(a.owner).localeCompare(String(b.owner))));
 const total=rows.reduce((s,x)=>({count:s.count+x.count,amount:s.amount+x.amount,over:s.over+x.over,today:s.today+x.today,none:s.none+x.none,maxOver:Math.max(s.maxOver,x.maxOver)}),{count:0,amount:0,over:0,today:0,none:0,maxOver:0});
 const body=rows.map(x=>'<tr data-ps-action="owner" data-value="'+a(x.owner)+'"'+(scopedOwner===x.owner?' class="sel"':'')+'><td><span class="sw-light '+x.light+'"></span><b>'+h(x.owner)+'</b></td><td>'+x.count+'</td><td class="sw-amt">'+h(money(x.amount).replace('금액 미입력','-'))+'</td><td class="'+(x.over?'sw-bad':'sw-zero')+'">'+x.over+'</td><td class="'+(x.today?'sw-warn':'sw-zero')+'">'+x.today+'</td><td class="'+(x.none?'sw-warn':'sw-zero')+'">'+x.none+'</td><td class="'+(x.maxOver>=14?'sw-bad':x.maxOver?'sw-warn':'sw-zero')+'">'+(x.maxOver?x.maxOver+'일':'-')+'</td><td class="sw-go">'+(scopedOwner===x.owner?'전체 보기':'목록 보기')+'</td></tr>').join('')
  +'<tr class="sw-total"><td>전체</td><td>'+total.count+'</td><td class="sw-amt">'+h(money(total.amount).replace('금액 미입력','-'))+'</td><td class="'+(total.over?'sw-bad':'sw-zero')+'">'+total.over+'</td><td class="'+(total.today?'sw-warn':'sw-zero')+'">'+total.today+'</td><td class="'+(total.none?'sw-warn':'sw-zero')+'">'+total.none+'</td><td>'+(total.maxOver?total.maxOver+'일':'-')+'</td><td></td></tr>';
 return '<section class="sw-owner-board" aria-label="담당자별 발송 후속 현황"><header><h3>담당자별 현황</h3><small>위험 높은 순 · 행 클릭 = 아래 목록 필터</small>'+btn('전체 보기','owner','전체')+'</header><div class="sw-table-scroll"><table><thead><tr>'+['담당자','담당','합계 금액','후속 초과','오늘 확인','후속일 미지정','최장 초과',''].map(t=>'<th scope="col">'+h(t)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div></section>';
}
function sentFrame(items){
 const f=root.G.pipelineQueue;
 const scopedOwner=root.SalesScope&&root.SalesScope.state?root.SalesScope.state().owner:'전체';
 const first=items.filter(x=>x.priority<=2),rest=items.filter(x=>x.priority>2);
 const ordered=first.concat(rest);
 const pages=Math.max(1,Math.ceil(ordered.length/30));f.page=Math.min(f.page||1,pages);
 const shown=ordered.slice((f.page-1)*30,f.page*30);
 let markedFirst=false,markedRest=false,rows='';
 shown.forEach(x=>{
  const urgent=x.priority<=2;
  if(urgent&&!markedFirst){markedFirst=true;rows+='<tr class="sw-group-row hot"><td colspan="8">먼저 볼 것 — 후속기한 초과 · 오늘 확인 · 후속일 미지정 ('+first.length+')</td></tr>';}
  if(!urgent&&!markedRest){markedRest=true;rows+='<tr class="sw-group-row"><td colspan="8">예정된 후속 연락 ('+rest.length+')</td></tr>';}
  const r=x.row,v=x.values,days=v.followup?root.daysTo(v.followup):null;
  const chip=days==null?'<span class="sw-due-chip warn">미지정</span>':days<0?'<span class="sw-due-chip hot">'+Math.abs(days)+'일 지남</span>':days===0?'<span class="sw-due-chip warn">오늘</span>':'<span class="sw-due-chip ok">D-'+days+'</span>';
  rows+='<tr data-deal="'+a(r.key)+'"'+(urgent?' class="sw-first"':'')+'><td>'+btn(r.site,'record',r.key)+'</td><td>'+h(r.owner||'미배정')+'</td><td>'+h(v.sentDate||'미기록')+(v.materials?'<small>'+h(v.materials)+'</small>':'')+'</td><td>'+h(v.reaction||'확인 전')+'</td><td>'+chip+(v.followup?'<small>'+h(v.followup)+'</small>':'')+'</td><td>'+h(money(r.amount))+'</td><td>'+h(r.next?.text||'후속 연락 등록')+(r.due?'<small>'+h(r.due)+'</small>':'')+'</td><td>'+btn('처리','primary',r.key)+'</td></tr>';
 });
 const body='<div class="sw-table-scroll"><table class="sw-work-table sw-frame"><thead><tr>'+['현장','담당자','발송일·자료','고객 반응','후속 확인','예상금액','다음 업무','관리'].map(t=>'<th scope="col">'+h(t)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table>'+(shown.length?'':empty)+'</div>';
 const scopeHead=scopedOwner!=='전체'?'<div class="sw-scope-head"><h3>'+h(scopedOwner)+' 담당 목록 <small>'+ordered.length+'건 · 먼저 볼 것 '+first.length+'</small></h3>'+btn('담당자 필터 해제','owner',scopedOwner)+'</div>':'';
 return sentOwnerBoard(scopedOwner)+scopeHead+'<p class="ps-queue-count">'+shown.length+' / '+ordered.length+'건 표시 · 먼저 볼 것 '+first.length+'건</p>'+body+'<footer class="sw-pager">'+btn('이전','page',String(Math.max(1,f.page-1)))+'<span>'+f.page+' / '+pages+'</span>'+btn('다음','page',String(Math.min(pages,f.page+1)))+'</footer>';
}
/* 컨설팅 목록: 탭·체크박스 없이 «먼저 볼 것 → 정상 진행» 한 표. 행 클릭=상세 팝업. */
function consultingFrame(items){
 const f=root.G.pipelineQueue;
 const scopedOwner=root.SalesScope&&root.SalesScope.state?root.SalesScope.state().owner:'전체';
 items=items.map(x=>({...x,triage:root.StageSpecs.triage(x.row,x.values,root.daysTo)}));
 const first=items.filter(x=>x.triage.today||x.triage.info).sort((x,y)=>x.triage.rank-y.triage.rank||(x.triage.date||'9999').localeCompare(y.triage.date||'9999')||x.row.key.localeCompare(y.row.key));
 const rest=items.filter(x=>!(x.triage.today||x.triage.info)).sort((x,y)=>String(x.values.quoteDue||'9999').localeCompare(String(y.values.quoteDue||'9999'))||x.row.key.localeCompare(y.row.key));
 const ordered=first.concat(rest);
 const pages=Math.max(1,Math.ceil(ordered.length/30));f.page=Math.min(f.page||1,pages);
 const shown=ordered.slice((f.page-1)*30,f.page*30);
 let markedFirst=false,markedRest=false,rows='';
 shown.forEach(x=>{
  const urgent=x.triage.today||x.triage.info;
  if(urgent&&!markedFirst){markedFirst=true;rows+='<tr class="sw-group-row hot"><td colspan="7">먼저 볼 것 — 기한·견적 초과 · 오늘 · 신규 · 정보 보완 ('+first.length+')</td></tr>';}
  if(!urgent&&!markedRest){markedRest=true;rows+='<tr class="sw-group-row"><td colspan="7">정상 진행 ('+rest.length+')</td></tr>';}
  const r=x.row,v=x.values,qd=v.quoteDue?root.daysTo(v.quoteDue):null;
  const chip=qd==null?'<span class="sw-due-chip mut">미지정</span>':qd<0?'<span class="sw-due-chip hot">'+Math.abs(qd)+'일 지남</span>':qd===0?'<span class="sw-due-chip warn">오늘</span>':'<span class="sw-due-chip ok">D-'+qd+'</span>';
  rows+='<tr data-deal="'+a(r.key)+'"'+(urgent?' class="sw-first"':'')+'><td>'+btn(r.site,'record',r.key)+'</td><td>'+h(r.owner||'미배정')+'</td><td>'+h(v.needs||x.triage.reason)+'</td><td>'+chip+(v.quoteDue?'<small>'+h(v.quoteDue)+'</small>':'')+'</td><td>'+h(money(r.amount))+'</td><td>'+h(r.next?.text||'다음 행동 등록')+(r.due?'<small>'+h(r.due)+'</small>':'')+'</td><td>'+btn('처리','primary',r.key)+'</td></tr>';
 });
 const body='<div class="sw-table-scroll"><table class="sw-work-table sw-frame"><thead><tr>'+['현장','담당자','고객 요구','견적 예정','예상금액','다음 업무','관리'].map(t=>'<th scope="col">'+h(t)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table>'+(shown.length?'':empty)+'</div>';
 const scopeHead=scopedOwner!=='전체'?'<div class="sw-scope-head"><h3>'+h(scopedOwner)+' 담당 목록 <small>'+ordered.length+'건 · 먼저 볼 것 '+first.length+'</small></h3>'+btn('담당자 필터 해제','owner',scopedOwner)+'</div>':'';
 return consultingOwnerBoard(scopedOwner)+scopeHead+'<p class="ps-queue-count">'+shown.length+' / '+ordered.length+'건 표시 · 먼저 볼 것 '+first.length+'건</p>'+body+'<footer class="sw-pager">'+btn('이전','page',String(Math.max(1,f.page-1)))+'<span>'+f.page+' / '+pages+'</span>'+btn('다음','page',String(Math.min(pages,f.page+1)))+'</footer>';
}
/* 경쟁·임박·입찰 v2(A안): 담당자 현황판 + 구분 세그먼트 + 결정일 중심 표. 아젠다 6칸 제거. */
const COMP_STAGES={compete:'경쟁',imminent:'계약 임박',bidding:'입찰'};
function competitionOwnerBoard(scopedOwner){
 const src=(root.PipelineWorkspace&&root.PipelineWorkspace.rows?root.PipelineWorkspace.rows({unscoped:true}):[]).filter(r=>r.group==='competition');
 const map=new Map();
 src.forEach(r=>{
  const o=r.owner||'미배정',row=map.get(o)||{owner:o,count:0,amount:0,past:0,near:0,none:0,maxPast:0};
  row.count++;row.amount+=Number(r.amount)||0;
  const dd=r.date?root.daysTo(r.date):null;
  if(dd==null)row.none++;else if(dd<0){row.past++;row.maxPast=Math.max(row.maxPast,-dd);}else if(dd<=3)row.near++;
  map.set(o,row);
 });
 const rows=Array.from(map.values());
 rows.forEach(x=>{x.light=x.past>=2||x.maxPast>=14?'r':(x.past+x.near+x.none)>0?'y':'g'});
 const order={r:0,y:1,g:2};
 rows.sort((a,b)=>order[a.light]-order[b.light]||b.past-a.past||b.near-a.near||(typeof root.repCompare==='function'?root.repCompare(a.owner,b.owner):String(a.owner).localeCompare(String(b.owner))));
 const total=rows.reduce((s,x)=>({count:s.count+x.count,amount:s.amount+x.amount,past:s.past+x.past,near:s.near+x.near,none:s.none+x.none,maxPast:Math.max(s.maxPast,x.maxPast)}),{count:0,amount:0,past:0,near:0,none:0,maxPast:0});
 const body=rows.map(x=>'<tr data-ps-action="owner" data-value="'+a(x.owner)+'"'+(scopedOwner===x.owner?' class="sel"':'')+'><td><span class="sw-light '+x.light+'"></span><b>'+h(x.owner)+'</b></td><td>'+x.count+'</td><td class="sw-amt">'+h(money(x.amount).replace('금액 미입력','-'))+'</td><td class="'+(x.past?'sw-bad':'sw-zero')+'">'+x.past+'</td><td class="'+(x.near?'sw-warn':'sw-zero')+'">'+x.near+'</td><td class="'+(x.none?'sw-warn':'sw-zero')+'">'+x.none+'</td><td class="'+(x.maxPast>=14?'sw-bad':x.maxPast?'sw-warn':'sw-zero')+'">'+(x.maxPast?x.maxPast+'일':'-')+'</td><td class="sw-go">'+(scopedOwner===x.owner?'전체 보기':'목록 보기')+'</td></tr>').join('')
  +'<tr class="sw-total"><td>전체</td><td>'+total.count+'</td><td class="sw-amt">'+h(money(total.amount).replace('금액 미입력','-'))+'</td><td class="'+(total.past?'sw-bad':'sw-zero')+'">'+total.past+'</td><td class="'+(total.near?'sw-warn':'sw-zero')+'">'+total.near+'</td><td class="'+(total.none?'sw-warn':'sw-zero')+'">'+total.none+'</td><td>'+(total.maxPast?total.maxPast+'일':'-')+'</td><td></td></tr>';
 return '<section class="sw-owner-board" aria-label="담당자별 경쟁·임박·입찰 현황"><header><h3>담당자별 현황</h3><small>위험 높은 순 · 행 클릭 = 아래 목록 필터</small>'+btn('전체 보기','owner','전체')+'</header><div class="sw-table-scroll"><table><thead><tr>'+['담당자','담당','합계 금액','지난 결정','D-3 이내','일정 미등록','최장 경과',''].map(t=>'<th scope="col">'+h(t)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div></section>';
}
function schedule(items){
 const f=root.G.pipelineQueue;
 const scopedOwner=root.SalesScope&&root.SalesScope.state?root.SalesScope.state().owner:'전체';
 const seg=root.G.compSeg&&COMP_STAGES[root.G.compSeg]?root.G.compSeg:'all';
 const segFiltered=items.filter(x=>seg==='all'||x.row.code===seg);
 const dd=x=>x.values.decisionDate?root.daysTo(x.values.decisionDate):null;
 const urgent=x=>{const n=dd(x);return n==null||n<=1;};
 const first=segFiltered.filter(urgent).sort((p,q)=>{const a=dd(p),b=dd(q);return (a==null?0.5:a)-(b==null?0.5:b);});
 const rest=segFiltered.filter(x=>!urgent(x)).sort((p,q)=>(dd(p)??9999)-(dd(q)??9999)||String(p.row.key).localeCompare(String(q.row.key)));
 const ordered=first.concat(rest);
 const segBar='<nav class="sw-seg" aria-label="경쟁 구분">'+[['all','전체',items.length],['compete','경쟁',items.filter(x=>x.row.code==='compete').length],['imminent','계약 임박',items.filter(x=>x.row.code==='imminent').length],['bidding','입찰',items.filter(x=>x.row.code==='bidding').length]].map(([k,label,n])=>'<button type="button" data-ps-action="compseg" data-value="'+k+'" aria-pressed="'+(seg===k)+'">'+h(label)+' <b>'+n+'</b></button>').join('')+'</nav>';
 const pages=Math.max(1,Math.ceil(ordered.length/30));f.page=Math.min(f.page||1,pages);
 const shown=ordered.slice((f.page-1)*30,f.page*30);
 let markedFirst=false,markedRest=false,rowsHtml='';
 shown.forEach(x=>{
  const r=x.row,v=x.values,n=dd(x),isFirst=urgent(x);
  if(isFirst&&!markedFirst){markedFirst=true;rowsHtml+='<tr class="sw-group-row hot"><td colspan="7">먼저 볼 것 — 지난 결정 · 오늘 · D-1 · 일정 미등록 ('+first.length+')</td></tr>';}
  if(!isFirst&&!markedRest){markedRest=true;rowsHtml+='<tr class="sw-group-row"><td colspan="7">예정된 결정 ('+rest.length+')</td></tr>';}
  const chip=n==null?'<span class="sw-due-chip warn">미등록</span>':n<0?'<span class="sw-due-chip hot">'+Math.abs(n)+'일 지남</span>':n===0?'<span class="sw-due-chip warn">오늘</span>':'<span class="sw-due-chip '+(n<=3?'warn':'ok')+'">D-'+n+'</span>';
  const kindChip='<span class="sw-stg sw-stg-'+(r.code==='compete'?'sil':r.code==='bidding'?'wait':'rap')+'">'+h(COMP_STAGES[r.code]||'경쟁')+'</span>'+(v.competitionType&&v.competitionType!==COMP_STAGES[r.code]?'<small>'+h(v.competitionType)+'</small>':'');
  rowsHtml+='<tr data-deal="'+a(r.key)+'"'+(isFirst?' class="sw-first"':'')+'><td>'+btn(r.site,'record',r.key)+(scopedOwner==='전체'?'<small>'+h(r.owner||'미배정')+'</small>':'')+'</td><td>'+kindChip+'</td><td>'+chip+(v.decisionDate?'<small>'+h(String(v.decisionDate).slice(0,10))+'</small>':'')+'</td><td>'+h(v.competitor||'미기록')+'</td><td>'+h(money(r.amount))+'</td><td>'+h(v.preparation||r.next?.text||'준비 현황 미기록')+'</td><td>'+btn('처리','primary',r.key)+'</td></tr>';
 });
 const table='<div class="sw-table-scroll"><table class="sw-work-table sw-frame"><thead><tr>'+['현장','구분','결정 예정','경쟁사','예상금액','준비 현황·다음','관리'].map(t=>'<th scope="col">'+h(t)+'</th>').join('')+'</tr></thead><tbody>'+rowsHtml+'</tbody></table>'+(shown.length?'':empty)+'</div>';
 const scopeHead=scopedOwner!=='전체'?'<div class="sw-scope-head"><h3>'+h(scopedOwner)+' 담당 목록 <small>'+ordered.length+'건 · 먼저 볼 것 '+first.length+'</small></h3>'+btn('담당자 필터 해제','owner',scopedOwner)+'</div>':'';
 return competitionOwnerBoard(scopedOwner)+segBar+scopeHead+'<p class="ps-queue-count">'+shown.length+' / '+ordered.length+'건 표시 · 먼저 볼 것 '+first.length+'건</p>'+table+'<footer class="sw-pager">'+btn('이전','page',String(Math.max(1,f.page-1)))+'<span>'+f.page+' / '+pages+'</span>'+btn('다음','page',String(Math.min(pages,f.page+1)))+'</footer>';
}
function queue(key,items){
 const spec=root.StageSpecs.get(key);
 return spec.priorityRule.map((title,i)=>group(title,items.filter(x=>x.priority===i),x=>{
  const r=x.row,v=x.values,date=spec.deadline&&v[spec.deadline],days=date?root.daysTo(date):null;
  const badge=spec.deadline?'<strong class="sw-deadline">'+h(due({days}))+'</strong>':'';
  const contract=key==='construction'?'<p class="sw-contract-state">'+h(v.contractState)+'</p>':'';
  return card(r,badge+contract+facts(spec.queueFields.map(k=>[root.StageSpecs.labels[k],display(k,v[k])])),spec.primaryAction.label,'primary');
 })).join('');
}
function render(key,list){
 const spec=root.StageSpecs.get(key);if(spec.specialWorkspace==='relationship')return relationship(list);
 let items=prepare(key,list),summary='';
 if(spec.workspaceType==='triage')return consultingFrame(items);
 if(key==='sent')return sentFrame(items);
 if(spec.workspaceType==='schedule')return schedule(items);
 if(spec.summaryMetrics==='contract-ledger')summary=contractReport(list);
 else if(spec.summaryMetrics==='loss-reasons'){
  const month=root.G.lossResultMonth||new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
  items=items.filter(x=>!x.values.lossDate||String(x.values.lossDate).startsWith(month));
  const selected=items.filter(x=>x.values.lossDate),reasons=new Map();selected.forEach(x=>reasons.set(x.values.lossReason,(reasons.get(x.values.lossReason)||0)+1));
  summary='<label class="sw-period">실주 조회월 <input aria-label="실주 조회월" type="month" data-ps-filter="lossResultMonth" value="'+a(month)+'"></label>'+stats([['이번 조회월 실주',selected.length+'건'],['실주 예상금액',money(selected.reduce((s,x)=>s+(x.row.amount||0),0))],['금액 미입력',selected.filter(x=>x.row.amount==null).length],['실주일 미기록',items.length-selected.length]])+'<div class="sw-loss-reasons">'+[...reasons].map(([n,c])=>'<div><span>'+h(n)+'</span><meter min="0" max="'+Math.max(1,selected.length)+'" value="'+c+'"></meter><b>'+c+'건</b></div>').join('')+'</div>';
 }else summary=stats(spec.priorityRule.map((title,i)=>[title,items.filter(x=>x.priority===i).length]));
 const limit=root.G.pipelineQueue?.limit||60,shown=items.slice(0,limit);
 return summary+'<p class="ps-queue-count">'+shown.length+' / '+items.length+'건 표시</p>'+(spec.workspaceType==='schedule'?schedule(shown):['operations','result'].includes(spec.workspaceType)?table(key,shown):queue(key,shown))+(shown.length<items.length?btn('다음 60건 더 보기','queue-more',''):'');
}
// Compatibility names all resolve to the same renderer; no per-stage markup implementations.
root.StageWorkspaces={render,prepare,relationship,...Object.fromEntries(root.StageSpecs.all.filter(s=>!s.specialWorkspace).map(s=>[s.key,list=>render(s.key,list)]))};
})(window);
