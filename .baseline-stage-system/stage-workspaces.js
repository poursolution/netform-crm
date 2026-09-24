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
function consulting(list){
 const bucket=r=>!(field(r,'first_contact').needs||r.fields.quote_request)?0:!r.fields.quote_due?1:2;
 const names=['요구사항 확인 필요','견적 일정 준비','견적·제안 준비'];
 return stats(names.map((n,i)=>[n,list.filter(r=>bucket(r)===i).length]))+names.map((n,i)=>group(n,list.filter(r=>bucket(r)===i),r=>card(r,facts([['고객 요구',field(r,'first_contact').needs||r.fields.quote_request],['필요한 자료',r.fields.required_materials],['견적 예정일',r.fields.quote_due],['예상금액',money(r.amount)],['다음 업무',r.next?.text]]),'진행','record'))).join('');
}
function sent(list){
 const items=list.map(r=>{const date=r.fields.followup_date||r.due;return {...r,due:date,days:date?root.daysTo(date):null};}).sort((a,b)=>(a.days??99999)-(b.days??99999));
 const sets=[['후속기한 초과',r=>r.days!=null&&r.days<0],['오늘 확인',r=>r.days===0],['후속일 미지정',r=>r.days==null],['예정된 후속 연락',r=>r.days>0]];
 return stats(sets.map(([n,f])=>[n,items.filter(f).length]))+sets.map(([n,f])=>group(n,items.filter(f),r=>card(r,'<strong class="sw-deadline">'+h(due(r))+'</strong>'+facts([['발송일',r.fields.sent_date],['전달 자료',Array.isArray(r.fields.materials)?r.fields.materials.join(' · '):r.fields.materials],['고객 반응',r.fields.reaction||'반응 미기록'],['다음 행동',r.next?.text],['후속 확인일',r.due]])))).join('');
}
function relationship(list){
 const items=list.slice().sort((a,b)=>(age(b)??99999)-(age(a)??99999));
 return stats([['17일 이상 미접촉',items.filter(r=>age(r)>=17).length],['7~16일 미접촉',items.filter(r=>age(r)>=7&&age(r)<17).length],['오늘 연락',items.filter(r=>r.days===0).length],['접촉 이력 미확인',items.filter(r=>age(r)==null).length],['연락일 미지정',items.filter(r=>r.days==null).length]])+group('접촉 필요 · 오래된 접촉부터',items,r=>card(r,'<strong class="sw-contact-age">'+h(age(r)==null?'유효접촉 미확인':age(r)+'일 미접촉')+'</strong>'+facts([['마지막 유효접촉',r.last],['관계 상태',root.stageLabel(r.code)],['고객 반응',r.fields.reaction||r.fields.statement],['다음 연락',r.due],['다음 행동',r.next?.text]]),'연락 기록','contact'));
}
function competition(list){
 const items=list.map(r=>({...r,days:r.date?root.daysTo(r.date):null})).sort((a,b)=>(a.days??99999)-(b.days??99999));
 const sets=[['지난 결정 일정 · 결과 확인',r=>r.days!=null&&r.days<0],['7일 이내 결정 일정',r=>r.days!=null&&r.days>=0&&r.days<=7],['이후 예정',r=>r.days>7],['일정 미등록',r=>r.days==null]];
 return stats(sets.map(([n,f])=>[n,items.filter(f).length]))+'<div class="sw-timeline">'+sets.map(([n,f])=>group(n,items.filter(f),r=>card(r,'<strong class="sw-deadline">'+h(due(r))+'</strong>'+facts([['결정 일정',r.date],['유형',r.fields.competition_type||root.stageLabel(r.code)],['예상금액',money(r.amount)],['경쟁사',r.fields.competitor],['준비 현황',r.fields.bid_plan||r.fields.remaining_issues||r.fields.position]]),'준비 확인','record'))).join('')+'</div>';
}
function construction(list){
 const state=root.ContractSalesData?.state(), find=r=>state?.items.find(c=>String(c.deal_id)===String(r.item.id));
 const bucket=r=>r.code==='completion'?3:r.code==='construction'?2:field(r,'contract').contract_status==='체결 완료'?1:0;
 return stats(['계약대기','계약완료','시공중','준공확인'].map((n,i)=>[n,list.filter(r=>bucket(r)===i).length]))+'<div class="sw-contracts">'+(list.map(r=>{const c=find(r),f=field(r,'contract');return card(r,'<p class="sw-contract-state">'+h(c?(c.cancelled?'계약 취소 · 조정 이력 보존':'영업실적 확정 · '+c.sales_owner_name+' · '+money(c.balance)):state?.status==='ready'?'계약실적 원장 미등록':'계약실적 원장 확인 필요')+'</p>'+facts([['계약금액',money(c?.balance??f.contract_amount??r.fields.contract_amount)],['계약일',c?.contract_date||f.contract_date],['실적 귀속',c?.sales_owner_name||'확정 원장 확인 필요'],['착공일',field(r,'construction').start_date],['현재 진행',root.stageLabel(r.code)],['시공팀 인계',field(r,'construction').handover]]),'상세','record');}).join('')||empty)+'</div>';
}
function won(list){
 const now=new Date(),month=root.G.contractResultMonth||now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
 const s=root.ContractSalesData?.summarize({year:month.slice(0,4),month:Number(month.slice(5,7)),brand:root.G.brand,owner:root.SalesScope.state().owner});
 let report='<p class="ps-empty">계약실적 원장을 확인하지 못했습니다. '+btn('원장 다시 조회','contract-refresh','')+'</p>';
 if(s)report=stats([['신규 계약',s.count+'건'],['신규 계약금액',money(s.newAmount)],['변경 증감',money(s.amendmentAmount)],['취소 조정',money(s.cancellationAmount)],['순 계약실적',money(s.netAmount)]])+'<div class="sw-owner-results">'+(s.rows.map(r=>'<div><b>'+h(r.name)+'</b><span>'+r.count+'건</span><strong>'+h(money(r.netAmount))+'</strong></div>').join('')||'<p>해당 월에 확인된 계약실적이 없습니다.</p>')+'</div>';
 return '<section class="sw-result"><h3>계약실적</h3><label>실적 조회월 <input aria-label="계약실적 조회월" type="month" data-ps-filter="contractResultMonth" value="'+a(month)+'"></label><p>계약 체결일 기준 · 변경·취소는 발생일 반영. 현재 단계와 무관하며 계약 당시 담당자에게 귀속됩니다. 공종·현장 검색은 아래 수주 목록에만 적용됩니다.</p>'+report+'</section>'+group('현재 수주 현장',list,r=>card(r,facts([['계약금액',money(root.ContractSalesData?.state().items.find(c=>String(c.deal_id)===String(r.item.id))?.balance)],['준공일',r.item.completion_date],['후속 업무','기존 거래의 추가 기회는 확장관리에서 확인']]),'상세','record'));
}
function lost(list){
 const month=root.G.lossResultMonth||new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
 const date=r=>r.item.closed_at||r.fields.close_date||'';
 const selected=list.filter(r=>String(date(r)).startsWith(month)),missing=list.filter(r=>!date(r));
 const reasons=new Map();selected.forEach(r=>reasons.set(r.reason,(reasons.get(r.reason)||0)+1));
 return '<label class="sw-period">실주 조회월 <input aria-label="실주 조회월" type="month" data-ps-filter="lossResultMonth" value="'+a(month)+'"></label>'+stats([['이번 조회월 실주',selected.length+'건'],['실주 예상금액',money(selected.reduce((s,r)=>s+(r.amount||0),0))],['금액 미입력',selected.filter(r=>r.amount==null).length],['실주일 미기록',missing.length]])+'<div class="sw-loss-reasons">'+[...reasons].map(([n,c])=>'<div><span>'+h(n)+'</span><meter min="0" max="'+Math.max(1,selected.length)+'" value="'+c+'"></meter><b>'+c+'건</b></div>').join('')+'</div>'+group('실주 사유와 재접촉 검토',selected,r=>card(r,facts([['실주사유',r.reason],['경쟁사',r.fields.competitor||r.item.competitor],['실주금액',money(r.amount)],['실주일',date(r)],['재접촉 가능성',r.fields.recontact_possibility||r.item.recontact_possibility||'검토 미기록']]),'사유 확인','record'))+group('실주일 확인 필요',missing,r=>card(r,facts([['실주사유',r.reason],['경쟁사',r.fields.competitor||r.item.competitor]]),'기록 확인','record'));
}
root.StageWorkspaces={consulting,sent,relationship,competition,construction,won,lost};
})(window);
