const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = ['아파트스퀘어_감리업무_로드맵.html','아파트스퀘어_감리업무_실전운영템플릿.html'];

for (const name of files) {
  const file = path.join(root,name);
  let html = fs.readFileSync(file,'utf8');
  html = html.replace('onclick="current=${i};openKey=k(i,0);save()"','onclick="selectStage(${i})"');
  html = html.replace('function selectStage(i){current=i;openKey=k(i,0);save()}',"function selectStage(i){current=i;openKey=k(i,0);save();requestAnimationFrame(()=>document.getElementById('stageHead').scrollIntoView({behavior:'smooth',block:'start'}))}");
  if (!html.includes('function selectStage(i)')) html = html.replace('function toggle(i,e){',"function selectStage(i){current=i;openKey=k(i,0);save();requestAnimationFrame(()=>document.getElementById('stageHead').scrollIntoView({behavior:'smooth',block:'start'}))}function toggle(i,e){");
  if (html.includes('openKey=k(i,0);save()"><span class="dot">')) throw new Error(`broken step handler remains in ${name}`);
  if (!html.includes('onclick="selectStage(${i})"')) throw new Error(`new step handler missing in ${name}`);
  fs.writeFileSync(file,html,'utf8');
}
console.log('Fixed 12-stage navigation in both HTML files.');
