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
function relationship(list){
 const items=list.slice().sort((a,b)=>(age(b)??99999)-(age(a)??99999));
 return stats([['17일 이상 미접촉',items.filter(r=>age(r)>=17).length],['7~16일 미접촉',items.filter(r=>age(r)>=7&&age(r)<17).length],['오늘 연락',items.filter(r=>r.days===0).length],['접촉 이력 미확인',items.filter(r=>age(r)==null).length],['연락일 미지정',items.filter(r=>r.days==null).length]])+group('접촉 필요 · 오래된 접촉부터',items,r=>card(r,'<strong class="sw-contact-age">'+h(age(r)==null?'유효접촉 미확인':age(r)+'일 미접촉')+'</strong>'+facts([['마지막 유효접촉',r.last],['관계 상태',root.stageLabel(r.code)],['고객 반응',r.fields.reaction||r.fields.statement],['다음 연락',r.due],['다음 행동',r.next?.text]]),'연락 기록','contact'));
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
 if(spec.summaryMetrics==='contract-ledger')summary=contractReport(list);
 else if(spec.summaryMetrics==='loss-reasons'){
  const month=root.G.lossResultMonth||new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
  items=items.filter(x=>!x.values.lossDate||String(x.values.lossDate).startsWith(month));
  const selected=items.filter(x=>x.values.lossDate),reasons=new Map();selected.forEach(x=>reasons.set(x.values.lossReason,(reasons.get(x.values.lossReason)||0)+1));
  summary='<label class="sw-period">실주 조회월 <input aria-label="실주 조회월" type="month" data-ps-filter="lossResultMonth" value="'+a(month)+'"></label>'+stats([['이번 조회월 실주',selected.length+'건'],['실주 예상금액',money(selected.reduce((s,x)=>s+(x.row.amount||0),0))],['금액 미입력',selected.filter(x=>x.row.amount==null).length],['실주일 미기록',items.length-selected.length]])+'<div class="sw-loss-reasons">'+[...reasons].map(([n,c])=>'<div><span>'+h(n)+'</span><meter min="0" max="'+Math.max(1,selected.length)+'" value="'+c+'"></meter><b>'+c+'건</b></div>').join('')+'</div>';
 }else summary=stats(spec.priorityRule.map((title,i)=>[title,items.filter(x=>x.priority===i).length]));
 const limit=root.G.pipelineQueue?.limit||60,shown=items.slice(0,limit);
 return summary+'<p class="ps-queue-count">'+shown.length+' / '+items.length+'건 표시</p>'+queue(key,shown)+(shown.length<items.length?btn('다음 60건 더 보기','queue-more',''):'');
}
// Compatibility names all resolve to the same renderer; no per-stage markup implementations.
root.StageWorkspaces={render,prepare,relationship,...Object.fromEntries(root.StageSpecs.all.filter(s=>!s.specialWorkspace).map(s=>[s.key,list=>render(s.key,list)]))};
})(window);
