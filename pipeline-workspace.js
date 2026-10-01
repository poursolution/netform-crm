(function(root){
'use strict';
const S=root.PipelineStages,h=x=>root.esc(String(x??'')),attr=x=>root.escAttr(String(x??''));let actor='',expanded=true,seen=new Set(),booted=false;
/* 상세를 팝업으로만 여는(스플릿 없는) 단계 — v2 공통 틀 적용 단계가 늘 때마다 추가한다. */
const POPUP_STAGES=['consulting','sent','relationship','competition','construction','won','lost'];
function state(){const id=String(root.ME?.id||root.ME?.name||'');if(id!==actor){actor=id;root.G.pipelineStage='all';root.G.pipelineQueue={status:'all',page:1};}return root.G.pipelineQueue||(root.G.pipelineQueue={status:'all',page:1});}
function button(label,action,value,cls){return '<button type="button" class="'+(cls||'')+'" data-ps-action="'+action+'" data-value="'+attr(value||'')+'">'+h(label)+'</button>';}
function canonicalCode(d){const q=(root.Phase1?.queue?.list?.()||[]).filter(q=>String(q.object_id)===String(d.id)&&q.operation==='transition').at(-1);return q&&q.status!=='done'?q.payload?.from||root.dealStage(d):root.dealStage(d);}
function rows(filters){
 state();const f=filters||{brand:root.G.brand,owner:root.SalesScope.state().owner,work:root.G.workFilter,search:root.G.q};const admin=root.todayIsAdmin(),me=root.repN(root.ME?.name),authorized=(root.B?.deals||[]).filter(d=>admin||root.repN(d.assignee)===me),ids=new Set(),result=[];
 function matches(d,owner,site){return (f.unscoped||root.SalesScope.matches(owner,d))&&(f.unscoped||root.SalesFilterState.matchesBrand(d.brand))&&(!f.brand||f.brand==='전체'||d.brand===f.brand)&&(!f.owner||f.owner==='전체'||owner===f.owner)&&(!f.work||f.work==='전체'||root.workMatches(d,f.work))&&(!f.search||[site,owner,root.dealWorkSummary(d)].join(' ').toLowerCase().includes(f.search.toLowerCase()));}
 for(const d of authorized){const id=String(d.id||root.dealKey(d));if(ids.has(id))continue;ids.add(id);const owner=root.repN(d.assignee),site=d.site||'현장명 미입력',code=canonicalCode(d),outcome=root.outcomeOf(d),group=S.group(code,outcome);if(!group||group==='expansion'||!matches(d,owner,site))continue;
 const next=root.briefNext(d),meta=root.relationshipMeta(d),fields=(d.stage_contexts||root.itemPatch(d,'deal').stage_contexts||{})[code]?.fields||{},due=next?.due||next?.due_at||fields.contact_date||fields.followup_date||'',days=due?root.daysTo(due):null,active=!['won','lost'].includes(group),flags=[];
 if(active){if(!next?.text||!due)flags.push('missing');if(days!==null&&days<0)flags.push('overdue');if(meta.days===null||meta.days>=7)flags.push('contact');if(root.issueSet(d).includes('stale'))flags.push('stale');}
 result.push({key:id,item:d,owner,site,code,group,next,due,days,fields,flags,stall:typeof root.stageAge==='function'?root.stageAge(d):null,contactDays:meta.days,last:meta.meaningfulAt||fields.last_contact||'',amount:group==='won'?(root.hasWonAmt(d)?root.wonAmt(d):null):(d.amt==null||d.amt===''?null:root.oppAmt(d)),date:fields.bid_deadline||fields.meeting_date||fields.expected_contract||fields.start_date||fields.contract_date||'',reason:d.lost_reason||fields.close_reason||'미기록'});
 }
 const eligible=new Map(authorized.map(d=>[String(d.id),d]));for(const e of root.expansionRecords?.()||[]){const d=eligible.get(String(e.sourceOpportunityId));if(!d||root.ExpansionFlow.converted(e)||['종료','보류'].includes(e.status)||!matches(d,e.owner,e.site))continue;result.push({key:'exp:'+e.id,item:d,expansion:e,owner:e.owner,site:e.site,group:'expansion',code:'expansion',next:{text:e.needNote||e.candidates.join(' · ')},due:e.nextContactAt,days:e.nextContactAt?root.daysTo(e.nextContactAt):null,last:e.lastContactAt,amount:null,fields:{},flags:[],date:e.completionDate});}
 return result;
}
function open(key,filters){if(document.getElementById('detailAction')&&root.PipelineSplit?.active()){root.alert('입력 중인 작업창을 저장하거나 닫은 뒤 단계를 이동해 주세요.');return;}root.PipelineSplit?.release();state();if(filters)root.SalesScope.change('owner',filters.owner||'전체');root.G.pipelineWorkspace=true;root.G.pipelineStage=S.definition(key)?key:'all';root.G.pipelineQueue={status:'all',page:1};expanded=true;if(filters){root.G.q='';root.G.workFilter='전체';root.G.brand=filters.brand||'전체';root.G.rep=filters.owner||'전체';root.G.pipelinePeriod=filters.year+'년 '+(filters.month?filters.month+'월':'연간');}root.G.pipeView='kb';if(root.StageSpecs.get(key)?.specialWorkspace==='expansion'){root.G.pipelineWorkspace=false;if(filters)root.G.expansionOwner=filters.owner||'전체';root.goPage('expansion');sidebar();root.syncExpansionNow?.(false);return;}root.goPage('pipe');}
function sidebar(){
 const parent=document.querySelector('.menu [data-p="pipe"]');if(!parent||!root.B)return;state();if(!booted){booted=true;seen=new Set((root.Phase1?.queue?.list?.()||[]).filter(q=>q.status==='done').map(q=>q.request_id));parent.setAttribute('role','button');parent.tabIndex=0;parent.onclick=()=>{if(root.G.page==='pipe'&&root.G.pipelineWorkspace&&root.G.pipelineStage==='all'){expanded=!expanded;sidebar();}else open('all');};parent.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();parent.click();}};}
 let nav=document.getElementById('pipeline-stage-menu');if(!nav){nav=document.createElement('nav');nav.id='pipeline-stage-menu';nav.setAttribute('aria-label','파이프라인 단계');parent.after(nav);}
 const data=rows(),key=root.G.page==='pipe'&&root.G.pipelineWorkspace?root.G.pipelineStage:['relationship','expansion'].includes(root.G.page)?root.G.page:null;
 /* 메뉴 숫자는 진행 중인 영업건만(2026-09-30 대표: 수주·실주는 결과라 파이프라인 숫자에서 뺀다) — 단계별 숫자는 그대로 */
 const live=data.filter(liveRow).length;
 let badge=parent.querySelector('.badge');if(!badge){badge=document.createElement('span');badge.className='badge';parent.append(badge);}badge.textContent=live;badge.title='기준: 진행 중 영업건 · 수주·실주·확장 제외 · 모든 연도';
 if(key&&key!=='all')expanded=true;
 parent.setAttribute('aria-expanded',String(expanded));parent.setAttribute('aria-controls',nav.id);nav.hidden=!expanded;
 nav.innerHTML=S.definitions.filter(d=>d.key!=='expansion').map(d=>button(d.label+' '+data.filter(r=>r.group===d.key).length,'stage',d.key,key===d.key?'selected':'')).join('');nav.querySelector('.selected')?.setAttribute('aria-current','page');nav.onclick=click;
 /* 확장관리는 파이프라인에서 분리해 사이드바 단독 메뉴로 노출한다. 관계관리 단독 메뉴만 숨긴다. */
 document.querySelectorAll('.menu>.mi[data-p="relationship"]').forEach(n=>n.hidden=true);
 const expansionMenu=document.querySelector('.menu>.mi[data-p="expansion"]');
 if(expansionMenu){expansionMenu.hidden=false;let eb=expansionMenu.querySelector('.badge');if(!eb){eb=document.createElement('span');eb.className='badge';expansionMenu.append(eb);}eb.textContent=data.filter(r=>r.group==='expansion').length||'';}
}
function options(label,key,values,value){return '<label>'+h(label)+'<select data-ps-filter="'+key+'" aria-label="'+h(label)+'">'+values.map(v=>'<option value="'+attr(v)+'"'+(v===value?' selected':'')+'>'+h(v)+'</option>').join('')+'</select></label>';}
/* ── 시안1 정보 칸반: 금액·정체가 항상 보이는 단일 뷰 (수주·실주 포함, 확장 제외) ── */
function moneyShort(value){const n=Number(value)||0;if(!n)return '-';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');}
function kanbanYear(){return String(root.G.pipeRepYear||'전체');}
function kanbanYearMatch(r){const y=kanbanYear();return y==='전체'||!root.ConstructionYear||root.ConstructionYear.matches(r.item,y);}
function cardBadge(r){
 if(r.group==='won')return ['ok',r.item.closed_at?String(r.item.closed_at).slice(0,10):'수주'];
 if(r.group==='lost')return ['mut',r.item.closed_at?String(r.item.closed_at).slice(0,10):'실주'];
 if(r.flags.includes('overdue'))return ['hot',Math.abs(r.days)+'일 지남'];
 if(r.flags.includes('stale')&&r.stall!=null)return ['hot',r.stall+'일 정체'];
 if(r.group==='relationship'&&r.contactDays!=null&&r.contactDays>=30)return ['hot','마지막 연락 '+r.contactDays+'일 전'];
 if(r.days===0)return ['warn','오늘'];
 if(r.flags.includes('missing'))return ['warn','다음 할 일 없음'];
 if(r.days!=null&&r.days>0)return ['ok',r.days+'일 남음'];
 return ['mut','진행중'];
}
/* 공용 '진행' 판정 — 메뉴 숫자·상단 띠·단계 지표가 모두 이것만 쓴다 */
function liveRow(r){return !['won','lost','expansion'].includes(r.group);}
function liveBasis(){const y=kanbanYear();return '기준: 진행 중 영업건 · 수주·실주·확장 제외 · '+(y==='전체'?'모든 연도':'공사예정년도 '+y);}
/* ── 전체 파이프라인 칸반 v2 (2026-10-01 디자인 핸드오프 'Pipeline Kanban v2') ──
   7열이 한 화면에(실주는 96px 좁은 열), 카드는 현장명 + 한 줄(상태점·담당자·금액), 열마다 12장 + '더보기'(단계 페이지로).
   카드를 끌어 다른 열에 놓으면 그 단계의 기존 전환창(stage-transition, 한 일·결과·다음 할 일·사유 필수)이 열린다 —
   근거 없이 단계만 옮기지 않는 규칙은 그대로라 '놓자마자 이동·되돌리기'는 넣지 않았다. 저장되면 보드가 다시 그려진다. */
const PK_PER=12,PK_LOST=3;
const PK_COLS=[['consulting','컨설팅 설계','#8b8fa3'],['sent','자료 발송완료','#6f8fd6'],['relationship','관계관리','#4f74d9'],['competition','경쟁·입찰','#9a6bd6'],['construction','계약·시공','#d68a3a'],['won','수주','#3f9e64'],['lost','실주','#b8b8b2']];
function cardState(r){if(r.group==='won')return ['done','수주'];if(r.group==='lost')return ['ok',r.reason&&r.reason!=='미기록'?'실주 · '+r.reason:'실주'];if(r.flags.includes('overdue'))return ['over','기한 지남 · '+Math.abs(r.days)+'일'];if(r.flags.includes('missing'))return ['none','다음 할 일 없음'];return ['ok',r.days===0?'오늘 할 일':r.days>0?'진행 중 · '+r.days+'일 남음':'진행 중'];}
const PK_ORDER={over:0,none:1,ok:2,done:2};
function kanbanSort(items,key){if(key==='lost'||key==='won')return items.slice().sort((p,q)=>String(q.item.closed_at||'').localeCompare(String(p.item.closed_at||'')));return items.slice().sort((p,q)=>PK_ORDER[cardState(p)[0]]-PK_ORDER[cardState(q)[0]]||(Number(q.amount)||0)-(Number(p.amount)||0));}
function kanbanCard(r){
 const st=cardState(r),owner=r.owner||'미배정',amt=Number(r.amount)||0;
 // 카드 전체가 클릭 대상 — 누르면 해당 영업의 상세 화면이 열린다. 종료 건은 끌 수 없다.
 return '<button type="button" class="ps-kcard" draggable="'+(['won','lost'].includes(r.group)?'false':'true')+'" data-ps-action="record" data-value="'+attr(r.key)+'" data-group="'+attr(r.group)+'" title="'+attr(st[1])+'"><span class="ps-ksite">'+h(r.site)+'</span><span class="ps-kr2"><i class="ps-kdot '+st[0]+'"></i><span class="ps-kowner'+(owner==='미배정'?' none':'')+'">'+h(owner)+'</span><b>'+(amt?moneyShort(amt):'–')+'</b></span></button>';
}
function kanban(all){
 return '<div class="ps-kanban pk">'+PK_COLS.map(([key,name,color])=>{
  const items=kanbanSort(all.filter(r=>r.group===key),key),lost=key==='lost',shown=items.slice(0,lost?PK_LOST:PK_PER),more=items.length-shown.length;
  const amount=items.reduce((s,r)=>s+(Number(r.amount)||0),0);
  return '<section class="ps-kcol'+(lost?' lost':'')+'" data-pk-col="'+key+'" style="--stage-color:'+color+'"><div class="ps-khead"><div class="ps-kt"><i class="ps-kstage"></i>'+button(name,'stage',key,'ps-ktitle')+'<span class="ps-kn">'+items.length+'</span></div><div class="ps-kmoney">'+(lost?'종료':moneyShort(amount))+'</div></div>'
   +(lost?'<div class="ps-kdrop">여기로 끌어<br>실주 처리</div>':'')
   +'<div class="ps-kbody">'+shown.map(kanbanCard).join('')+'</div>'
   +(more>0?button('+ '+more+'건 더보기','stage',key,'ps-kmore'):'')+'</section>';
 }).join('')+'</div><div class="pk-legend"><span><i class="ps-kdot over"></i>기한 지남</span><span><i class="ps-kdot none"></i>할 일 없음</span><span><i class="ps-kdot ok"></i>진행 중</span><span>· 카드를 끌어 놓으면 단계 전환창이 열립니다 · 마우스를 올리면 상태 표시</span></div>';
}
/* 끌어 놓기 → 기존 단계 전환창. 그 단계로 바로 갈 수 없으면(전환 규칙) 이유를 알린다 */
let pkDrag=null;
function pkTargetCode(r,colKey){const def=S.definition(colKey),T=root.StageTransition,from=root.dealStage(r.item),choices=T&&typeof T.choices==='function'?T.choices(from):null;if(!def)return null;if(!choices)return def.codes[0];return def.codes.find(code=>choices.includes(code))||null;}
function pkDrop(colKey){
 const d=pkDrag;pkDrag=null;if(!d||d.group===colKey)return;const r=rows().find(x=>x.key===d.key);if(!r||r.expansion)return;
 const name=(PK_COLS.find(x=>x[0]===colKey)||[])[1]||colKey,code=pkTargetCode(r,colKey);
 if(!code){root.toast?.(r.site+' — 지금 단계에서는 «'+name+'»(으)로 바로 옮길 수 없습니다. 상세에서 가능한 단계를 확인해 주세요.','warn');return;}
 root.G._detailPopup=true;root.drwDeal(JSON.stringify(r.item));
 setTimeout(()=>{if(root.StageTransitionUI?.open)root.StageTransitionUI.open(r.item,false,code);else root.DetailActions?.open('stage');},60);
}
function pkBind(el){
 const board=el.querySelector('.ps-kanban.pk');if(!board)return;
 const clear=()=>board.querySelectorAll('.ps-kcol.over').forEach(n=>n.classList.remove('over'));
 board.addEventListener('dragstart',e=>{const card=e.target.closest('.ps-kcard');if(!card||card.getAttribute('draggable')!=='true')return;pkDrag={key:card.dataset.value,group:card.dataset.group};card.classList.add('dragging');try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',card.dataset.value);}catch(x){}});
 board.addEventListener('dragend',e=>{e.target.closest?.('.ps-kcard')?.classList.remove('dragging');clear();pkDrag=null;});
 board.addEventListener('dragover',e=>{const col=e.target.closest('.ps-kcol');if(!col||!pkDrag)return;e.preventDefault();if(col.dataset.pkCol!==pkDrag.group&&!col.classList.contains('over')){clear();col.classList.add('over');}});
 board.addEventListener('dragleave',e=>{const col=e.target.closest('.ps-kcol');if(col&&!col.contains(e.relatedTarget))col.classList.remove('over');});
 board.addEventListener('drop',e=>{const col=e.target.closest('.ps-kcol');if(!col)return;e.preventDefault();clear();board.querySelector('.ps-kcard.dragging')?.classList.remove('dragging');pkDrop(col.dataset.pkCol);});
}
/* 한 줄 머리: 제목 · 진행 N건 · 금액 · [연도|브랜드|담당자|공종] · 검색 — 브랜드 칩 줄·담당자 구분 줄·공종 줄을 여기로 접는다 */
function pkHead(all,source){
 const live=all.filter(liveRow),amount=live.reduce((s,r)=>s+(Number(r.amount)||0),0),basis=liveBasis();
 const seg=(html,on)=>'<label class="pk-segitem'+(on?' on':'')+'">'+html+'</label>';
 const sel=(aria,attrs,opts,value,first)=>'<select aria-label="'+attr(aria)+'" '+attrs+'>'+opts.map(v=>'<option value="'+attr(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+h(v==='전체'?first:v)+'</option>').join('')+'</select>';
 const years=root.ConstructionYear?root.ConstructionYear.options(root.B?.deals||[]):['전체'],y=kanbanYear();
 const year='<select aria-label="공사예정 연도" data-ps-filter="pipeRepYear">'+years.map(v=>'<option value="'+attr(v)+'"'+(String(v)===y?' selected':'')+'>'+h(v==='전체'?'전체 연도':v==='미입력'?'연도 미입력':v+'년')+'</option>').join('')+'</select>';
 const brands=['전체',...new Set(source.map(r=>r.item.brand).filter(Boolean))],owners=['전체',...new Set(source.map(r=>r.owner).filter(Boolean))].sort((a,b)=>a==='전체'?-1:b==='전체'?1:a.localeCompare(b,'ko'));
 const brand=root.G.brand||'전체',owner=root.SalesScope.state().owner||'전체',work=root.G.workFilter||'전체';
 return '<header class="pk-head"><h2>파이프라인</h2><div class="pk-sum" title="'+attr(basis)+'"><span>진행 <b>'+live.length+'건</b></span><span>금액 <b>'+moneyShort(amount)+'</b></span></div><div class="pk-spacer"></div>'
  +'<div class="pk-seg">'+seg(year,y!=='전체')+seg(sel('브랜드','data-pk-filter="brand"',brands,brand,'전체 브랜드'),brand!=='전체')+seg(sel('담당자','data-pk-filter="owner"',owners,owner,'전체 담당자'),owner!=='전체')+seg('<select aria-label="단계 공종" data-ps-filter="workFilter">'+root.workFilterOptions(root.G.workFilter).replace(/>전체</,'>전체 공종<')+'</select>',work!=='전체')+'</div>'
  +'<input class="pk-search" aria-label="단계 현장 검색" data-ps-filter="q" value="'+attr(root.G.q||'')+'" placeholder="현장 검색"></header>';
}
function metrics(list,key){const active=list.filter(liveRow),amount=list.reduce((s,r)=>s+(r.amount||0),0);const m=[['적재 영업',list.length+'건'],[key==='won'?'준공 처리금액':key==='expansion'?'확장 기회':'예상금액',key==='expansion'?list.length+'건':root.fmtAmt(amount)],['기한초과',active.filter(r=>r.flags.includes('overdue')).length+'건'],['다음 할 일 없음',active.filter(r=>r.flags.includes('missing')).length+'건']];if(key==='relationship')m.splice(2,2,['7일 이상·접촉 미확인',active.filter(r=>r.flags.includes('contact')).length+'건'],['장기정체',active.filter(r=>r.flags.includes('stale')).length+'건']);if(key==='competition')m.splice(2,2,['3일 안',list.filter(r=>r.date&&root.daysTo(r.date)>=0&&root.daysTo(r.date)<=3).length+'건'],['결정 일정 미등록',list.filter(r=>!r.date).length+'건']);return '<div class="ps-metrics">'+m.map(x=>'<div><span>'+h(x[0])+'</span><strong>'+h(x[1])+'</strong></div>').join('')+'</div>';}
function contractOf(r){return root.ContractSalesData?.state().items.find(x=>String(x.deal_id)===String(r.item.id));}
function detailCells(r,key){
 const f=r.fields,c=contractOf(r),cf=r.item.stage_contexts?.contract?.fields||{},empty='미입력',money=v=>v==null||v===''?empty:root.fmtAmt(v),last=r.last?String(r.last).slice(0,10):'접촉 미확인';
 if(key==='all')return [root.stageLabel(r.code),money(root.oppAmt(r.item))];
 if(key==='relationship')return [root.stageLabel(r.code),last,r.last?Math.max(0,-root.daysTo(r.last))+'일':'미확인'];
 if(key==='competition')return [f.competition_type||root.stageLabel(r.code),r.date||'일정 미등록',f.competitor||'경쟁사 미기록',f.bid_plan||f.remaining_issues||f.position||empty];
 if(key==='construction')return [c?(c.cancelled?'계약 취소':'실적 확정'):(cf.contract_status||f.contract_status||'체결 미확인'),c?.contract_date||cf.contract_date||empty,money(c?.balance??cf.contract_amount??f.contract_amount),c?.sales_owner_name||'귀속 미확인',r.item.stage_contexts?.construction?.fields?.start_date||empty];
 if(key==='won')return [money(c?.balance??cf.contract_amount),c?.contract_date||cf.contract_date||'계약일 미확인',c?.sales_owner_name||'귀속 미확인',root.stageLabel(r.code)];
 if(key==='lost')return [r.item.closed_at?.slice(0,10)||empty,money(r.amount),r.reason,f.competitor||r.item.competitor||'미기록'];
 if(key==='expansion')return [r.expansion.sourceWorkSummary,money(c?.balance??r.expansion.wonAmount),r.expansion.candidates.join(' · '),last];
 if(key==='sent')return [f.sent_date||empty,Array.isArray(f.materials)?f.materials.join(' · '):f.materials||empty,f.reaction||empty,f.followup_date||empty];
 return [root.dealWorkSummary(r.item),money(r.amount),f.quote_due||empty,last];
}
function management(r){const label=['won','lost'].includes(r.group)?'종료':r.days==null?'기한 미입력':r.days<0?Math.abs(r.days)+'일 지남':r.days===0?'오늘':r.days+'일 남음';return '<div class="ps-management"><span class="ps-due '+(r.days<0?'overdue':'')+'">'+h(label)+'</span>'+button('처리','process',r.key)+'</div>';}
function render(){
 root.G.pipelineWorkspace=true;/* 칸반 단일 뷰 — 구형 칸반·스플릿·포캐스트 전환은 사용하지 않는다 */
 const host=document.getElementById('pg-pipe');if(!host)return false;state();let el=document.getElementById('pipeline-stage-root');if(!el){el=document.createElement('div');el.id='pipeline-stage-root';host.append(el);}host.classList.add('ps-active');root.PipelineSplit?.beforePaint();
 const key=root.G.pipelineStage||'all',def=S.definition(key),all=rows(),list=def?all.filter(r=>r.group===key):all,f=state(),filtered=list.filter(r=>f.status==='all'||r.flags.includes(f.status));const source=rows({unscoped:true}),brands=['전체',...new Set(source.map(r=>r.item.brand).filter(Boolean))],owners=['전체',...new Set(source.map(r=>r.owner).filter(Boolean))];
 const work='<label>공종<select aria-label="단계 공종" data-ps-filter="workFilter">'+root.workFilterOptions(root.G.workFilter)+'</select></label>';
 let body='';if(def){body=root.StageWorkspaces?.[key]?'<div class="sw-workspace" data-workspace="'+key+'">'+root.StageWorkspaces.render(key,list)+(list.length?'':'<p class="ps-empty">현재 조건의 현장이 없습니다.</p>')+'</div>':'<p class="ps-empty">단계별 화면을 불러오지 못했습니다. 새로고침해 주세요.</p>';}else{body=kanban(all.filter(kanbanYearMatch));}
 if(def&&!POPUP_STAGES.includes(key)&&root.PipelineSplit.active())body=root.PipelineSplit.shell(key,body);
 const title=def?def.label:'전체 파이프라인';document.getElementById('ptitle').textContent=title;document.getElementById('psub').textContent=def?.description||'8개 단계의 현재 적재 현황과 업무를 확인합니다.';
 const yearSelect=!def&&root.ConstructionYear?'<label>연도<select aria-label="공사예정 연도" data-ps-filter="pipeRepYear">'+root.ConstructionYear.options(root.B?.deals||[]).map(y=>'<option value="'+attr(y)+'"'+(String(y)===kanbanYear()?' selected':'')+'>'+h(y==='전체'?'전체 연도':y==='미입력'?'미입력':y+'년')+'</option>').join('')+'</select></label>':'';
 /* 상단 단계 타일 스트립은 사이드바와 중복이라 전 단계에서 제거했다. */
 if(!def){el.classList.add('pk-mode');el.innerHTML=pkHead(all.filter(kanbanYearMatch),source)+body;}else{el.classList.remove('pk-mode');el.innerHTML='<header class="ps-heading"><div><small>파이프라인 / '+h(title)+'</small><h2>'+h(title)+'</h2><p>'+h(def?.description||'단계별 적재·금액·정체를 한 화면에서 확인하고, 카드를 누르면 상세로 이동합니다.')+'</p></div><b>'+list.length+'건</b></header>'+(!def?kpiStrip(all.filter(kanbanYearMatch)):'')+root.SalesFilters.controls(source.filter(r=>!def||r.group===key).map(r=>({brand:r.item.brand,owner:r.owner,item:r.item})))+'<div class="ps-filters">'+yearSelect+work+'<label>현장 검색<input aria-label="단계 현장 검색" data-ps-filter="q" value="'+attr(root.G.q||'')+'" placeholder="현장·담당자·공종"></label>'+button('검색','search')+'</div>'+'<p class="ps-note">'+(def?'현재 적재 기준 · 생성 연도와 무관하게 진행 영업 표시'+(root.G.pipelinePeriod?' · 이전 분석 기간 '+h(root.G.pipelinePeriod):''):'공사예정년도 기준 조회 · 칼럼 제목=단계 페이지 · 카드=상세 화면')+'</p>'+body;}
 el.onclick=click;el.onchange=e=>{const k=e.target.dataset.psFilter,pk=e.target.dataset.pkFilter;if(pk==='brand'){root.G.brand=e.target.value;f.page=1;root.paint();return;}if(pk==='owner'){root.SalesScope.change('owner',e.target.value);root.G.rep=e.target.value;f.page=1;root.paint();return;}if(k){root.G[k]=e.target.value;f.page=1;root.paint();}};if(!def)pkBind(el);el.onkeydown=e=>{if(e.key==='Enter'&&e.target.matches('[data-ps-filter="q"]')){root.G.q=e.target.value;f.page=1;root.paint();}};root.PipelineSplit.mount(list);sidebar();return true;
}
function click(e){const b=e.target.closest('[data-ps-action]');if(!b)return;const a=b.dataset.psAction,v=b.dataset.value;if(a==='stage')open(v);if(a==='triage-tab'){state().triage=v;state().page=1;root.paint();}if(a==='queue-more'){state().limit=(state().limit||60)+60;root.paint();}if(a==='view'){state().view=v;state().page=1;root.paint();}if(a==='status'){state().status=v;state().page=1;root.paint();}if(a==='owner'){const current=root.SalesScope.state().owner;root.SalesScope.change('owner',current===v?'전체':v);state().page=1;root.paint();}if(a==='relseg'){root.G.relSeg=v;state().page=1;root.paint();}if(a==='compseg'){root.G.compSeg=v;state().page=1;root.paint();}if(a==='consseg'){root.G.consSeg=v;state().page=1;root.paint();}if(a==='page'){state().page=Number(v);root.paint();}if(a==='search'){root.G.q=document.querySelector('[data-ps-filter="q"]')?.value||'';state().page=1;root.paint();}if(a==='contract-refresh'){Promise.resolve(root.ContractSalesData?.refresh()).then(refresh);return;}if(['record','process','contact','next','stage-edit','primary'].includes(a)){const r=rows().find(r=>r.key===v);if(!r)return;if(!POPUP_STAGES.includes(root.G.pipelineStage)&&root.PipelineSplit?.select(r,a))return;if(r.expansion){root.ExpansionPool.open(r.expansion.id);return;}root.G._detailPopup=true;root.drwDeal(JSON.stringify(r.item));if(a==='contact')root.DetailActions?.open('activity');if(a==='process')root.DetailActions?.open(r.flags.includes('missing')?'next':'activity');if(a==='stage-edit')root.DetailActions?.open('stage');}}
function refresh(){sidebar();if(root.G.page==='today')root.paintTodayHome();if(root.G.page==='pipe'&&root.G.pipelineWorkspace)render();if(['dash','perf','control'].includes(root.G.page))root.SalesInsights?.render();}
function acknowledgements(){setTimeout(()=>{if(!root.B)return;let changed=false;for(const q of root.Phase1?.queue?.list?.()||[]){if(seen.has(q.request_id)||q.status!=='done'||!q.ack)continue;seen.add(q.request_id);if(!['opportunity_touch','opportunity_favorite'].includes(q.operation))changed=true;if(['transition','close'].includes(q.operation)&&root.G.pipelineWorkspace&&root.G.page==='pipe'&&String(root.CUR_DETAIL?.item?.id)===String(q.object_id)){const d=root.B.deals.find(d=>String(d.id)===String(q.object_id)),key=d&&S.group(root.dealStage(d),root.outcomeOf(d));if(key){const wasOpen=document.getElementById('detailView')?.classList.contains('on');open(key);if(wasOpen){root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));}}}}if(changed)refresh();},0);}
root.addEventListener('phase1:queue',acknowledgements);root.addEventListener('phase1:identity-cleared',()=>{seen.clear();actor='';document.getElementById('pipeline-stage-root')?.replaceChildren();document.getElementById('pipeline-stage-menu')?.replaceChildren();});
root.addEventListener('contract-sales:changed',()=>{if(root.G.page==='pipe'&&['won','construction'].includes(root.G.pipelineStage))render();});
root.PipelineWorkspace={open,render,sidebar,rows,refresh};
})(window);
