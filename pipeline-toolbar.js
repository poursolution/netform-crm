(function(root){
'use strict';
const defaults={quarter:0,rep:'전체',brand:'전체',workFilter:'전체'};
// Compatibility hook for older callers. Pipeline controls are now owned here
// and no longer borrowed from the global period/representative containers.
function restoreControls(){}
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
 const canChooseOwner=!root.ME||root.ME.role==='admin'||root.ME.permission_role==='admin';
 const option=(value,label,current)=>'<option value="'+escAttr(value)+'" '+(String(current)===String(value)?'selected':'')+'>'+esc(label)+'</option>';
 const years=Array.from(new Set(['전체',String(Number(CUR_Y)-2),String(Number(CUR_Y)-1),CUR_Y,G.year]));
 let evidence='';if(G.year!=='전체'&&typeof operationalInquiries==='function'){const py=String(Number(G.year)-1),count=y=>operationalInquiries(B.inquiries||[]).filter(q=>q.at&&q.at.slice(0,4)===y&&(!G.quarter||Math.ceil(Number(q.at.slice(5,7))/3)===G.quarter)).length,current=count(G.year),previous=count(py);if(previous>=20)evidence='작년 대비 '+(current>=previous?'+':'')+Math.round((current-previous)/previous*100)+'%';else if(current>0)evidence=py+'년 '+previous+'건 · '+G.year+'년 '+current+'건'}
 const chips=[];
 ['year','quarter','rep','brand','workFilter'].forEach(key=>{if(G[key]==null||G[key]===resetValue(key))return;let label=G[key];if(key==='year')label=G.year==='전체'?'전체 연도':G.year+'년';if(key==='quarter')label=G.quarter+'분기';if(key==='rep')label=repDisplay(G.rep);chips.push('<button data-clear="'+key+'" aria-label="'+escAttr(label)+' 필터 해제">'+esc(label)+' <span aria-hidden="true">×</span></button>')});
 host.innerHTML='<div class="pipe-toolbar-controls">'
 +'<details class="pipe-period"><summary>'+(G.year==='전체'?'전체 연도':esc(G.year)+'년')+' · '+(G.quarter?G.quarter+'분기':'연간')+' <span aria-hidden="true">▾</span></summary><div class="pipe-period-panel"><strong>조회기간</strong><label>연도<select aria-label="조회 연도" data-period="year">'+years.map(y=>option(y,y==='전체'?'전체 연도':y+'년',G.year)).join('')+'</select></label>'
 +'<label>기간<select aria-label="조회 분기" data-period="quarter">'+option(0,'연간',G.quarter)+[1,2,3,4].map(q=>option(q,q+'분기',G.quarter)).join('')+'</select></label><div class="pipe-period-buttons"><button type="button" class="pipe-period-cancel">취소</button><button type="button" class="pipe-period-apply">적용</button></div></div></details>'
 +(canChooseOwner?'<details class="pipe-owner"><summary>'+esc(G.rep==='전체'?'전체 담당자':repDisplay(G.rep))+' <span aria-hidden="true">▾</span></summary><div class="pipe-owner-panel"><input class="pipe-owner-input" aria-label="영업담당자 검색 및 선택" placeholder="이름 검색" type="search"><div class="pipe-owner-options">'+['전체'].concat(assignableReps()).map(n=>'<button type="button" data-owner="'+escAttr(n)+'" aria-pressed="'+(G.rep===n)+'">'+esc(n==='전체'?'전체 담당자':repDisplay(n))+(G.rep===n?' ✓':'')+'</button>').join('')+'</div><p class="pipe-owner-empty" hidden>검색된 담당자가 없습니다.</p></div></details>':'<span class="pipe-owner-self" aria-label="현재 담당자">'+esc(repDisplay(root.ME.name))+'</span>')
 +'<select aria-label="사업유형" data-filter="brand">'+['전체'].concat(BRANDS).map(b=>option(b,b==='전체'?'전체 사업':b,G.brand)).join('')+'</select>'
 +'<select aria-label="공종" data-filter="workFilter">'+workFilterOptions(G.workFilter)+'</select>'
 +(evidence?'<span class="pipe-evidence">'+esc(evidence)+'</span>':'')
 +'<div class="pipe-toolbar-actions"><nav aria-label="파이프라인 보기">'+[['kb','단계 보드'],['split','스플릿'],['fc','포캐스트']].map(([v,label])=>'<button data-view="'+v+'" aria-pressed="'+(G.pipeView===v)+'">'+label+'</button>').join('')+'</nav><button class="pipe-add" type="button">＋ 영업 추가</button></div></div>'
 +(chips.length?'<div class="pipe-applied"><span>적용 필터</span>'+chips.join('')+'<button class="pipe-reset">전체 초기화</button></div>':'');
 host.querySelectorAll('[data-filter]').forEach(el=>el.onchange=()=>set(el.dataset.filter,el.value));
 host.querySelector('.pipe-period-apply').onclick=()=>{G.year=host.querySelector('[data-period="year"]').value;set('quarter',host.querySelector('[data-period="quarter"]').value);const summary=document.querySelector('.pipe-period summary');if(summary)summary.focus();};
 const period=host.querySelector('.pipe-period');
 period.onkeydown=function(e){if(e.key==='Escape'){e.preventDefault();dismissPeriod(this,true);}};
 period.querySelector('summary').onclick=()=>{period.querySelector('[data-period="year"]').value=G.year;period.querySelector('[data-period="quarter"]').value=G.quarter;};
 host.querySelector('.pipe-period-cancel').onclick=()=>dismissPeriod(period,true);
 const ownerBox=host.querySelector('.pipe-owner'),ownerInput=host.querySelector('.pipe-owner-input');
 if(ownerBox&&ownerInput){
  ownerInput.oninput=function(){const query=this.value.trim().toLowerCase();let count=0;ownerBox.querySelectorAll('[data-owner]').forEach(button=>{button.hidden=!button.textContent.toLowerCase().includes(query);if(!button.hidden)count++;});ownerBox.querySelector('.pipe-owner-empty').hidden=!!count;};
  ownerBox.querySelector('summary').onclick=()=>{ownerInput.value='';ownerInput.oninput();};
  ownerBox.onkeydown=function(e){if(e.key==='Escape'){e.preventDefault();this.open=false;this.querySelector('summary').focus();}};
  ownerBox.querySelectorAll('[data-owner]').forEach(button=>button.onclick=()=>{const value=button.dataset.owner;if(value!=='전체'&&!assignableReps().includes(value))return;set('rep',value);const summary=document.querySelector('.pipe-owner summary');if(summary)summary.focus();});
 }
 host.querySelectorAll('[data-clear]').forEach(el=>el.onclick=()=>clear(el.dataset.clear));
 host.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{G.stageCol=null;G.consoleMacro=null;setPipeView(el.dataset.view)});
 host.querySelector('.pipe-add').onclick=()=>openNewDeal();
 const resetButton=host.querySelector('.pipe-reset');if(resetButton)resetButton.onclick=reset;
}
root.PipelineToolbar={render,set,clear,reset,restoreControls};
})(window);
