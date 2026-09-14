(function(root){
'use strict';
const defaults={quarter:0,rep:'전체',brand:'전체',workFilter:'전체'};
function resetValue(key){return key==='year'?CUR_Y:defaults[key]}
function set(key,value){
 if(!['year','quarter','rep','brand','workFilter'].includes(key))return;
 G[key]=key==='quarter'?Number(value):value;
 if(key==='year')G.quarter=0;
 if(key==='quarter'&&G.quarter&&G.year==='전체')G.year=CUR_Y;
 G.stageCol=null;G.splitKey=null;G.quickStageCodes=null;G.reportStageCodes=null;G.reportStageLabel='';
 paint();
}
function clear(key){set(key,resetValue(key))}
function reset(){G.year=CUR_Y;Object.assign(G,defaults);G.stageCol=null;G.splitKey=null;G.quickStageCodes=null;G.reportStageCodes=null;G.reportStageLabel='';paint()}
function owner(value,input){
 const match=assignableReps().find(n=>n===value||repDisplay(n)===value);
 if(!value||value==='전체 담당자')return set('rep','전체');
 if(match)return set('rep',match);
 input.value=G.rep==='전체'?'':repDisplay(G.rep);
}
function dismissPeriod(el,focus){
 if(!el)return;el.querySelector('[data-period="year"]').value=G.year;el.querySelector('[data-period="quarter"]').value=G.quarter;el.open=false;
 if(focus)el.querySelector('summary').focus();
}
if(root.document)root.document.addEventListener('click',event=>{const el=root.document.querySelector('.pipe-period[open]');if(el&&!el.contains(event.target))dismissPeriod(el,false);const owner=root.document.querySelector('.pipe-owner[open]');if(owner&&!owner.contains(event.target))owner.open=false;});
function render(){
 const host=document.getElementById('p-brands');if(!host)return;
 const option=(value,label,current)=>'<option value="'+escAttr(value)+'" '+(String(current)===String(value)?'selected':'')+'>'+esc(label)+'</option>';
 const years=Array.from(new Set(['전체',String(Number(CUR_Y)-2),String(Number(CUR_Y)-1),CUR_Y,G.year]));
 const chips=[];
 ['year','quarter','rep','brand','workFilter'].forEach(key=>{if(G[key]==null||G[key]===resetValue(key))return;let label=G[key];if(key==='year')label=G.year==='전체'?'전체 연도':G.year+'년';if(key==='quarter')label=G.quarter+'분기';if(key==='rep')label=repDisplay(G.rep);chips.push('<button data-clear="'+key+'" aria-label="'+escAttr(label)+' 필터 해제">'+esc(label)+' <span aria-hidden="true">×</span></button>')});
 host.innerHTML='<div class="pipe-toolbar-controls">'
 +'<details class="pipe-period"><summary>'+(G.year==='전체'?'전체 연도':esc(G.year)+'년')+' · '+(G.quarter?G.quarter+'분기':'연간')+' <span aria-hidden="true">▾</span></summary><div class="pipe-period-panel"><strong>조회기간</strong><label>연도<select aria-label="조회 연도" data-period="year">'+years.map(y=>option(y,y==='전체'?'전체 연도':y+'년',G.year)).join('')+'</select></label>'
 +'<label>기간<select aria-label="조회 분기" data-period="quarter">'+option(0,'연간',G.quarter)+[1,2,3,4].map(q=>option(q,q+'분기',G.quarter)).join('')+'</select></label><div class="pipe-period-buttons"><button type="button" class="pipe-period-cancel">취소</button><button type="button" class="pipe-period-apply">적용</button></div></div></details>'
 +'<details class="pipe-owner"><summary>'+esc(G.rep==='전체'?'전체 담당자':repDisplay(G.rep))+' <span aria-hidden="true">▾</span></summary><div class="pipe-owner-panel"><input class="pipe-owner-input" aria-label="영업담당자 검색 및 선택" placeholder="이름 검색" type="search"><div class="pipe-owner-options">'+['전체'].concat(assignableReps()).map(n=>'<button type="button" data-owner="'+escAttr(n)+'" aria-pressed="'+(G.rep===n)+'">'+esc(n==='전체'?'전체 담당자':repDisplay(n))+(G.rep===n?' ✓':'')+'</button>').join('')+'</div><p class="pipe-owner-empty" hidden>검색된 담당자가 없습니다.</p></div></details>'
 +'<select aria-label="사업유형" data-filter="brand">'+['전체'].concat(BRANDS).map(b=>option(b,b==='전체'?'전체 사업':b,G.brand)).join('')+'</select>'
 +'<select aria-label="공종" data-filter="workFilter">'+workFilterOptions(G.workFilter)+'</select>'
 +'<div class="pipe-toolbar-actions"><nav aria-label="파이프라인 보기">'+[['kb','칸반'],['split','스플릿'],['fc','포캐스트']].map(([v,label])=>'<button data-view="'+v+'" aria-pressed="'+(G.pipeView===v)+'">'+label+'</button>').join('')+'</nav><button class="pipe-add" type="button">＋ 영업 추가</button></div></div>'
 +(chips.length?'<div class="pipe-applied"><span>적용 필터</span>'+chips.join('')+'<button class="pipe-reset">전체 초기화</button></div>':'');
 host.querySelectorAll('[data-filter]').forEach(el=>el.onchange=()=>set(el.dataset.filter,el.value));
 host.querySelector('.pipe-period-apply').onclick=()=>{G.year=host.querySelector('[data-period="year"]').value;set('quarter',host.querySelector('[data-period="quarter"]').value);const summary=document.querySelector('.pipe-period summary');if(summary)summary.focus();};
 const period=host.querySelector('.pipe-period');
 period.onkeydown=function(e){if(e.key==='Escape'){e.preventDefault();dismissPeriod(this,true);}};
 period.querySelector('summary').onclick=()=>{period.querySelector('[data-period="year"]').value=G.year;period.querySelector('[data-period="quarter"]').value=G.quarter;};
 host.querySelector('.pipe-period-cancel').onclick=()=>dismissPeriod(period,true);
 const ownerBox=host.querySelector('.pipe-owner'),ownerInput=host.querySelector('.pipe-owner-input');
 ownerInput.oninput=function(){const query=this.value.trim().toLowerCase();let count=0;ownerBox.querySelectorAll('[data-owner]').forEach(button=>{button.hidden=!button.textContent.toLowerCase().includes(query);if(!button.hidden)count++;});ownerBox.querySelector('.pipe-owner-empty').hidden=!!count;};
 ownerBox.querySelector('summary').onclick=()=>{ownerInput.value='';ownerInput.oninput();};
 ownerBox.onkeydown=function(e){if(e.key==='Escape'){e.preventDefault();this.open=false;this.querySelector('summary').focus();}};
 ownerBox.querySelectorAll('[data-owner]').forEach(button=>button.onclick=()=>{const value=button.dataset.owner;if(value!=='전체'&&!assignableReps().includes(value))return;set('rep',value);const summary=document.querySelector('.pipe-owner summary');if(summary)summary.focus();});
 host.querySelectorAll('[data-clear]').forEach(el=>el.onclick=()=>clear(el.dataset.clear));
 host.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{G.stageCol=null;G.consoleMacro=null;setPipeView(el.dataset.view)});
 host.querySelector('.pipe-add').onclick=()=>openNewDeal();
 const resetButton=host.querySelector('.pipe-reset');if(resetButton)resetButton.onclick=reset;
 inlineFilters(host);
}
// Copy the existing rendered controls, not their counting or selection logic.
// The canonical global controls stay in place for all other CRM pages.
function inlineFilters(host){
 const period=document.querySelector('#periodbar .period-controls'),picker=document.querySelector('#reptabs .rep-filter-picker');
 if(!period||!picker)return;
 const bar=document.createElement('div');bar.className='pipe-inline-filters';bar.setAttribute('aria-label','파이프라인 조회조건');
 const label=text=>{const span=document.createElement('span');span.className='pipe-inline-label';span.textContent=text;return span};
 bar.append(label('조회기간'));
 const year=period.querySelector('select').cloneNode(true),segment=period.querySelector('.period-segment').cloneNode(true);
 bar.append(year,segment,label('영업담당자'));
 const owner=picker.cloneNode(true);owner.classList.add('pipe-inline-owner');bar.append(owner);
 const search=owner.querySelector('input');search.removeAttribute('oninput');search.oninput=()=>{const q=search.value.trim().toLowerCase();owner.querySelectorAll('.rep-filter-option').forEach(b=>b.hidden=!b.dataset.search.toLowerCase().includes(q))};
 owner.querySelector('summary').onclick=()=>{search.value='';search.oninput()};
 owner.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();owner.open=false;owner.querySelector('summary').focus()}};
 const badge=period.querySelector('.yoybadge');if(badge)bar.append(badge.cloneNode(true));
 const work=host.querySelector('[data-filter="workFilter"]');bar.append(label('공종'),work);
 host.querySelector('.pipe-period').remove();host.querySelector('.pipe-owner').remove();
 host.prepend(bar);
}
if(root.document)root.document.addEventListener('click',e=>{const el=document.querySelector('.pipe-inline-owner[open]');if(el&&!el.contains(e.target))el.open=false});
root.PipelineToolbar={render,set,clear,reset};
})(window);
