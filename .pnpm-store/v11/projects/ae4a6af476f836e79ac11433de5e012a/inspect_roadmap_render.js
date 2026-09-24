const fs = require('fs');
const html = fs.readFileSync('아파트스퀘어_감리업무_로드맵.html', 'utf8');
for (const marker of ['function instructionLines', 'function renderWorks', 'function workHtml', 'function render()']) {
  const i = html.indexOf(marker);
  console.log(`\n--- ${marker} @ ${i} ---\n${i >= 0 ? html.slice(i, i + 5000) : 'NOT FOUND'}`);
}
