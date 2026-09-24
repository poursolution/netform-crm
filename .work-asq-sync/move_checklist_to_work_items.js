const fs=require('fs');
const source='아파트스퀘어_감리업무_로드맵_착공서류반영완료.html';
let html=fs.readFileSync(source,'utf8');

// Remove the old stage-level checklist dataset. Checklists now belong to work items.
const dataStart=html.indexOf('const stageChecklists=[');
const dataEnd=html.indexOf('const store=sessionStorage;',dataStart);
if(dataStart<0||dataEnd<0)throw new Error('stage checklist dataset not found');
html=html.slice(0,dataStart)+html.slice(dataEnd);

html=html.replace("let checklistState=JSON.parse(store.getItem('integrated-required-checks')||'{}'),state=", "let checklistState=JSON.parse(store.getItem('integrated-work-checks-v2')||'{}'),checkWorkIndex=0,state=");
html=html.replace('const done=x.works.every((_,w)=>state[k(i,w)]?.done)&&stageChecklistDone(i),blocked=', 'const done=x.works.every((_,w)=>state[k(i,w)]?.done),blocked=');
html=html.replace('<p>주 책임 · ${s.owner}</p><button type="button" class="checklist-open" data-open-checklist>필수 체크리스트 <strong>${checklistProgress(current)}</strong></button>', '<p>주 책임 · ${s.owner}</p>');
html=html.replace("const v=state[k(current,i)]||{},opened=openKey===k(current,i),refs=w[3],guide=fieldGuides[w[0]],flow=workflowFor(w,guide,s);return", "const v=state[k(current,i)]||{},opened=openKey===k(current,i),refs=w[3],guide=fieldGuides[w[0]],flow=workflowFor(w,guide,s),workChecks=workChecklistFor(w,guide,s),workCheckDone=workChecks.filter((_,ci)=>checklistState[workCheckKey(current,i,ci)]).length;return");
html=html.replace('<div class="manual-count">${guide?\'실행 기준\':refs.length?`화면 ${refs.length}개`:\'업무 기준\'}</div><span class="work-chevron"', '<div class="manual-count">${guide?\'실행 기준\':refs.length?`화면 ${refs.length}개`:\'업무 기준\'}</div><button type="button" class="work-check-button" data-work-check="${i}">체크리스트 <strong>${workCheckDone}/${workChecks.length}</strong></button><span class="work-chevron"');
html=html.replace('completeEl.innerHTML=`<b>업무 ${done}/${s.works.length} · 필수체크 ${checklistProgress(current)}</b> · 업무와 필수 체크를 모두 완료하면', 'completeEl.innerHTML=`<b>단계 업무 ${done}/${s.works.length}</b> · 각 업무의 체크리스트를 확인한 뒤 업무 완료를 체크하면');

const oldFunctionsStart=html.indexOf('function checklistProgress(si)');
const selectStart=html.indexOf('function selectStage(i){',oldFunctionsStart);
if(oldFunctionsStart<0||selectStart<0)throw new Error('old checklist functions not found');
const workFunctions=`const preconstructionDocumentChecks=[
{t:'① 착공계(착공신고서)',d:'현장명·시공사·착공일·작성일·서명 또는 날인을 확인합니다.'},
{t:'② 현장대리인 선임계·자격증 사본',d:'선임계의 성명과 자격증 사본의 성명·종목·유효 여부를 대조합니다.'},
{t:'③ 예정공정표',d:'계약 공사기간, 주요 공정, 감리 확인시점과 준공예정일을 확인합니다.'},
{t:'④ 안전관리계획서',d:'위험요인·작업방법·안전담당자·비상연락망·보호구 계획을 확인합니다.'},
{t:'⑤ 산재·고용보험 가입증명',d:'시공사·사업장·해당 공사 적용 여부와 증명서 유효기간을 확인합니다.'},
{t:'⑥ 사용자재 목록·시험성적서',d:'제품명·제조사·규격과 시험성적서의 대상 제품이 일치하는지 확인합니다.'},
{t:'⑦ MSDS·자재공급승인원',d:'사용자재별 MSDS와 공급승인원이 빠짐없이 연결됐는지 확인합니다.'},
{t:'서류 최신본·현장 일치',d:'모든 서류가 같은 현장과 시공사를 가리키며 최신 작성본인지 확인합니다.'},
{t:'미수령·보완사항 회신기한',d:'누락 또는 보완필요 문서마다 담당자·요청일·재회신 기한을 기록합니다.'},
{t:'착공 가능 여부 분리 판단',d:'서류 수령 완료와 실제 작업 시작 가능 여부를 별도로 판정해 기록합니다.'}
];
function workChecklistFor(w,guide,s){if(w[0]==='착공 전 본감리 준비')return preconstructionDocumentChecks;const flow=workflowFor(w,guide,s);return flow.flatMap(section=>section.items.map((item,i)=>({t:section.label+' '+(i+1),d:item})))}function workCheckKey(si,wi,ci){return 'wc'+si+'-'+wi+'-'+ci}function workChecklistProgress(si,wi){const w=stages[si].works[wi],list=workChecklistFor(w,fieldGuides[w[0]],stages[si]),done=list.filter((_,i)=>checklistState[workCheckKey(si,wi,i)]).length;return done+'/'+list.length}function renderWorkChecklist(){const s=stages[current],w=s.works[checkWorkIndex],list=workChecklistFor(w,fieldGuides[w[0]],s),done=list.filter((_,i)=>checklistState[workCheckKey(current,checkWorkIndex,i)]).length;checkStepEl.textContent='STEP '+String(current+1).padStart(2,'0')+' · '+s.n;checkTitleEl.textContent=w[0]+' 체크리스트';checkCountEl.textContent=done+' / '+list.length;checkBarEl.style.width=(list.length?done/list.length*100:0)+'%';requiredListEl.innerHTML=list.map((x,i)=>'<li><label><input type="checkbox" data-required="'+i+'" '+(checklistState[workCheckKey(current,checkWorkIndex,i)]?'checked':'')+'><span><b>'+x.t+'</b>'+x.d+'</span></label></li>').join('');checkNoteEl.textContent=done===list.length?'이 업무의 필수 확인이 완료됐습니다. 결과와 증빙을 확인한 뒤 업무 완료를 체크하세요.':'미확인 '+(list.length-done)+'개 · 이 목록은 “'+w[0]+'” 업무에서 실제로 챙길 항목입니다.';checkDialogEl.classList.toggle('checklist-ok',done===list.length)}function openWorkChecklist(wi){checkWorkIndex=wi;renderWorkChecklist();checkDialogEl.showModal()}
`;
html=html.slice(0,oldFunctionsStart)+workFunctions+html.slice(selectStart);

const eventStart=html.indexOf("stageHeadEl.addEventListener('click'");
const stepsStart=html.indexOf("stepsEl.addEventListener('click'",eventStart);
if(eventStart<0||stepsStart<0)throw new Error('old checklist listeners not found');
const newListeners="requiredListEl.addEventListener('change',e=>{if(!e.target.matches('[data-required]'))return;checklistState[workCheckKey(current,checkWorkIndex,Number(e.target.dataset.required))]=e.target.checked;store.setItem('integrated-work-checks-v2',JSON.stringify(checklistState));renderWorkChecklist();render()});checkCloseEl.addEventListener('click',()=>checkDialogEl.close());checkDialogEl.addEventListener('click',e=>{if(e.target===checkDialogEl)checkDialogEl.close()});";
html=html.slice(0,eventStart)+newListeners+html.slice(stepsStart);

const oldWorkClick="worksEl.addEventListener('click',e=>{const summary=e.target.closest('[data-work].work-summary');if(!summary||!worksEl.contains(summary))return;toggle(Number(summary.dataset.work),e)})";
const newWorkClick="worksEl.addEventListener('click',e=>{const checkButton=e.target.closest('[data-work-check]');if(checkButton&&worksEl.contains(checkButton)){e.stopPropagation();openWorkChecklist(Number(checkButton.dataset.workCheck));return}const summary=e.target.closest('[data-work].work-summary');if(!summary||!worksEl.contains(summary))return;toggle(Number(summary.dataset.work),e)})";
if(!html.includes(oldWorkClick))throw new Error('work click listener not found');
html=html.replace(oldWorkClick,newWorkClick);

const extraCss=`<style id="work-checklist-ui-v2">.checklist-open{display:none!important}.work-summary{grid-template-columns:42px minmax(250px,1fr) 92px 82px 112px 22px}.work-check-button{border:1px solid #e36c38;background:#fff7f1;color:#b94f24;font-weight:900;font-size:10px;padding:8px 9px;cursor:pointer;white-space:nowrap}.work-check-button:hover{background:#f07b45;color:#fff}.work-check-button strong{display:inline-block;margin-left:4px;background:#f07b45;color:#fff;border-radius:999px;padding:2px 5px}.work-check-button:hover strong{background:#fff;color:#b94f24}@media(max-width:900px){.work-summary{grid-template-columns:34px 1fr 104px 20px}.owner,.manual-count{display:none}.work-check-button{font-size:9px;padding:7px 6px}}</style>`;
html=html.replace('</body>',extraCss+'</body>');

for(const marker of ['data-work-check="${i}"','function openWorkChecklist(wi)','preconstructionDocumentChecks','integrated-work-checks-v2'])if(!html.includes(marker))throw new Error('missing '+marker);
if(html.includes('data-open-checklist'))throw new Error('stage checklist button remains');

const outputs=['아파트스퀘어_감리업무_실전운영템플릿.html','아파트스퀘어_감리업무_로드맵.html','아파트스퀘어_감리업무_로드맵_업무별체크리스트.html'];
for(const file of outputs){fs.writeFileSync(file,html,'utf8');console.log('updated '+file)}
