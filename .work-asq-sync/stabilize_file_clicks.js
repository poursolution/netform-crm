const fs = require('fs');

const files = [
  '아파트스퀘어_감리업무_실전운영템플릿.html',
  '아파트스퀘어_감리업무_로드맵.html',
  '아파트스퀘어_감리업무_로드맵_검증완료_20260913.html'
];

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');

  html = html.replace(
    '<button class="field-jump" onclick="current=7;openKey=null;save()">현장감리 바로보기</button><button onclick="window.print()">인쇄 / PDF</button>',
    '<button type="button" class="field-jump" id="fieldJump">현장감리 바로보기</button><button type="button" id="printBtn">인쇄 / PDF</button>'
  );

  html = html.replace(
    "const store=sessionStorage;let state=JSON.parse(store.getItem('integrated-roadmap')||'{}'),current=Math.max(0,Math.min(11,+store.getItem('integrated-stage-field-v2')||7)),openKey=null;",
    "const store=sessionStorage;const stepsEl=document.getElementById('steps'),stageHeadEl=document.getElementById('stageHead'),worksEl=document.getElementById('works'),completeEl=document.getElementById('complete'),fieldJumpEl=document.getElementById('fieldJump'),printBtnEl=document.getElementById('printBtn');let state=JSON.parse(store.getItem('integrated-roadmap')||'{}'),current=Math.max(0,Math.min(11,+store.getItem('integrated-stage-field-v2')||7)),openKey=null;"
  );

  html = html.replace('function render(){const s=stages[current];steps.innerHTML=', 'function render(){const s=stages[current];stepsEl.innerHTML=');
  html = html.replace('onclick="selectStage(${i})"', 'type="button" data-stage="${i}" aria-label="${i+1}단계 ${x.n}"');
  html = html.replace("}).join('');stageHead.innerHTML=", "}).join('');stageHeadEl.innerHTML=");
  html = html.replace("</div></div>`;works.innerHTML=s.works.map", "</div></div>`;worksEl.innerHTML=s.works.map");
  html = html.replace('class="work-summary" onclick="toggle(${i},event)"', 'class="work-summary" data-work="${i}" role="button" tabindex="0"');
  html = html.replace(/class="check" type="checkbox" \$\{v\.done\?'checked':''\} onclick="event\.stopPropagation\(\)" onchange="update\(\$\{i\},'done',this\.checked\)"/, 'class="check" type="checkbox" data-work="${i}" ${v.done?\'checked\':\'\'} aria-label="${w[0]} 완료"');
  html = html.replace(";complete.innerHTML=`<b>단계 완료", ";completeEl.innerHTML=`<b>단계 완료");

  const oldTail = "function selectStage(i){current=i;openKey=k(i,0);save();requestAnimationFrame(()=>document.getElementById('stageHead').scrollIntoView({behavior:'smooth',block:'start'}))}function toggle(i,e){if(e.target.closest('input,textarea,button,a'))return;openKey=openKey===k(current,i)?null:k(current,i);render()}function update(i,f,v){state[k(current,i)]={...(state[k(current,i)]||{}),[f]:typeof v==='string'?v.slice(0,2000):v};save()}['site','manager','date'].forEach";
  const newTail = "function selectStage(i){if(!Number.isInteger(i)||i<0||i>=stages.length)return;current=i;openKey=k(i,0);save();requestAnimationFrame(()=>stageHeadEl.scrollIntoView({behavior:'smooth',block:'start'}))}function toggle(i,e){if(e&&e.target.closest('input,textarea,button,a,summary'))return;openKey=openKey===k(current,i)?null:k(current,i);render()}function update(i,f,v){state[k(current,i)]={...(state[k(current,i)]||{}),[f]:typeof v==='string'?v.slice(0,2000):v};save()}stepsEl.addEventListener('click',e=>{const button=e.target.closest('[data-stage]');if(!button||!stepsEl.contains(button))return;selectStage(Number(button.dataset.stage))});worksEl.addEventListener('click',e=>{const summary=e.target.closest('[data-work].work-summary');if(!summary||!worksEl.contains(summary))return;toggle(Number(summary.dataset.work),e)});worksEl.addEventListener('keydown',e=>{const summary=e.target.closest('[data-work].work-summary');if(!summary||!worksEl.contains(summary)||!['Enter',' '].includes(e.key))return;e.preventDefault();toggle(Number(summary.dataset.work))});worksEl.addEventListener('change',e=>{if(!e.target.matches('input.check[data-work]'))return;update(Number(e.target.dataset.work),'done',e.target.checked)});fieldJumpEl.addEventListener('click',()=>selectStage(7));printBtnEl.addEventListener('click',()=>window.print());['site','manager','date'].forEach";
  if (!html.includes(oldTail)) throw new Error(`${file}: event tail not found`);
  html = html.replace(oldTail, newTail);

  const remainingHandlers = html.match(/on(?:click|change)="[^"]*"/g) || [];
  if (remainingHandlers.length) throw new Error(`${file}: inline handler remains: ${remainingHandlers.join(' | ')}`);
  for (const marker of ['stepsEl.addEventListener', 'worksEl.addEventListener', 'data-stage="${i}"', 'data-work="${i}"']) {
    if (!html.includes(marker)) throw new Error(`${file}: missing ${marker}`);
  }
  fs.writeFileSync(file, html, 'utf8');
  console.log(`stabilized ${file}`);
}

fs.copyFileSync(files[0], '아파트스퀘어_감리업무_로드맵_클릭수정완료.html');
console.log('created cache-busted delivery copy');
