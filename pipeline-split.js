(function(root){
'use strict';
const h=x=>root.esc(String(x??'')),a=x=>root.escAttr(String(x??''));
let selected='',stage='',identity='';
const active=()=>root.G.page==='pipe'&&root.G.pipelineWorkspace&&root.PipelineStages.definition(root.G.pipelineStage)&&!root.StageSpecs.get(root.G.pipelineStage)?.specialWorkspace;
function selector(key){
 const rows=root.PipelineWorkspace.rows({work:'',search:''});
 return '<nav class="ps-stage-selector" aria-label="업무 단계 선택">'+root.PipelineStages.definitions.map(d=>'<button type="button" style="--stage-color:'+d.color+'" data-ps-action="stage" data-value="'+d.key+'" aria-current="'+(key===d.key?'page':'false')+'"><small>'+d.number+'</small><span>'+h(d.label)+'</span><b>'+rows.filter(r=>r.group===d.key).length+'</b></button>').join('')+'</nav>';
}
function release(){const v=document.getElementById('detailView');if(!v?.classList.contains('ps-embedded'))return;root.DetailActions?.close(false);document.body.append(v);v.classList.remove('ps-embedded','on');v.setAttribute('aria-hidden','true');root.CUR_DETAIL=null;root.G._detailPopup=false;}
function beforePaint(){const v=document.getElementById('detailView');if(v?.classList.contains('ps-embedded')){if(active())document.body.append(v);else release();}}
function shell(key,content){
 const actor=String(root.ME?.id||root.ME?.name||'');if(identity!==actor||stage!==key){selected='';stage=key;identity=actor;}
 const optional=root.StageSpecs.get(key).inspector==='on-demand';
 return '<div class="ps-split'+(optional?' ps-inspector-demand':'')+(selected?' ps-inspector-open':'')+'" style="--stage-color:'+root.PipelineStages.definition(key).color+'"><section class="ps-split-queue" aria-label="단계 현장 목록">'+content+'</section><section id="ps-split-detail" aria-label="선택 현장 상세"><p class="ps-empty">현장을 선택하면 상세와 업무를 확인할 수 있습니다.</p></section></div>';
}
function closeInspector(){if(document.getElementById('detailAction')){root.alert('입력 중인 작업창을 저장하거나 닫은 뒤 상세를 닫아 주세요.');return;}const id=selected;release();selected='';root.PipelineWorkspace.render();document.querySelectorAll('[data-deal]').forEach(n=>{if(n.dataset.deal===id)n.querySelector('[data-ps-action="record"]')?.focus();});}
function select(r,action){
 if(!active()||!r||r.group!==root.G.pipelineStage)return false;
 const host=document.getElementById('ps-split-detail'),v=document.getElementById('detailView');if(!host||!v)return false;
 if(document.getElementById('detailAction')&&selected!==r.key){root.alert('입력 중인 작업창을 저장하거나 닫은 뒤 다른 현장을 선택해 주세요.');return true;}
 selected=r.key;
 if(String(root.CUR_DETAIL?.item?.id)!==String(r.item.id)||!v.classList.contains('ps-embedded')){
  root.DealDetailWorkspace.open(r.item.id,{source:r.group,host});
 }else host.replaceChildren(v);
 host.closest('.ps-split').classList.add('ps-inspector-open');
 const close=document.createElement('button');close.type='button';close.className='ps-inspector-close';close.textContent='상세 닫기';close.onclick=closeInspector;host.prepend(close);
 v.setAttribute('role','region');v.removeAttribute('aria-modal');v.setAttribute('aria-label','선택 현장 상세');document.body.style.overflow='';
 document.querySelectorAll('.ps-split-queue [data-deal]').forEach(n=>{const on=n.dataset.deal===selected;n.classList.toggle('ps-selected',on);n.querySelector('[data-ps-action="record"]')?.setAttribute('aria-pressed',String(on));});
 if(action)root.DealDetailWorkspace.run(action);
 return true;
}
function mount(list){
 if(!active())return;
 const r=list.find(r=>r.key===selected),byId=new Map(list.map(r=>[r.key,r]));
 if(r)select(r);else{release();selected='';document.querySelector('.ps-split')?.classList.remove('ps-inspector-open');}
 document.querySelectorAll('.ps-split-queue .sw-card').forEach(n=>{
  const row=byId.get(n.dataset.deal);if(!row)return;
  const actions=n.querySelector('.sw-action');if(!actions)return;
  const spec=root.StageSpecs.get(row.group),buttons=[[spec.primaryAction.label,'primary']];if(spec.queueLayout!=='result')buttons.push(...[['연락','contact'],['다음 할 일','next'],['진행상태 변경','stage-edit']].filter(x=>x[1]!==spec.primaryAction.key));
  actions.innerHTML=buttons.map(([label,key])=>'<button type="button" data-ps-action="'+key+'" data-value="'+a(row.key)+'">'+label+'</button>').join('');
 });
}
function dedicated(){
 // 확장관리는 사이드바 단독 메뉴 — 파이프라인처럼 상단 단계 스트립 없이 바로 내용을 보여준다.
 document.querySelector('#pg-expansion > .ps-dedicated-stages')?.remove();
 if(root.G.page!=='relationship')return;
 const host=document.getElementById('pg-'+root.G.page);if(!host)return;
 let bar=host.querySelector(':scope > .ps-dedicated-stages');if(!bar){bar=document.createElement('div');bar.className='ps-dedicated-stages';host.prepend(bar);}
 bar.innerHTML=selector(root.G.page);bar.onclick=e=>{const b=e.target.closest('[data-ps-action="stage"]');if(b)root.PipelineWorkspace.open(b.dataset.value);};
}
root.addEventListener('phase1:identity-cleared',()=>{release();selected='';identity='';});
// Keep the original form nodes and draft until the user finishes that action.
document.addEventListener('click',e=>{if(active()&&document.getElementById('detailAction')&&e.target.closest('.sales-filterbar,.ps-stage-selector,.ps-filters')){e.preventDefault();e.stopImmediatePropagation();root.alert('입력 중인 작업창을 저장하거나 닫은 뒤 필터와 단계를 변경해 주세요.');}},true);
root.PipelineSplit={active,selector,shell,select,mount,release,beforePaint,dedicated};
})(window);
