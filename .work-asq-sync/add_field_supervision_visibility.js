const fs = require('fs');
const path = require('path');

const root = __dirname;
const primary = path.join(root, '아파트스퀘어_감리업무_로드맵.html');
const current = path.join(root, '아파트스퀘어_감리업무_실전운영템플릿.html');
let html = fs.readFileSync(primary, 'utf8');

if (!html.includes('현장 본감리 PDF 14쪽 반영</span>')) {
  html = html.replace(
    '</style></head><body><header class="top"><div class="brand">APART SQUARE · 감리업무 통합 로드맵</div><button onclick="window.print()">인쇄 / PDF</button></header>',
    '.update-badge{display:inline-block;margin-left:10px;padding:5px 8px;border-radius:999px;background:#e7f1ed;color:var(--green);font-size:9px;letter-spacing:0}.top-actions{display:flex;gap:7px}.top .field-jump{border-color:var(--green);background:var(--green);color:#fff}@media(max-width:900px){.update-badge{display:none}}</style></head><body><header class="top"><div class="brand">APART SQUARE · 감리업무 통합 로드맵 <span class="update-badge">현장 본감리 PDF 14쪽 반영</span></div><div class="top-actions"><button class="field-jump" onclick="current=7;openKey=null;save()">현장감리 바로보기</button><button onclick="window.print()">인쇄 / PDF</button></div></header>'
  );
}

html = html.replace("store.getItem('integrated-stage')||0", "store.getItem('integrated-stage-field-v2')||7");
html = html.replace("store.setItem('integrated-stage',current)", "store.setItem('integrated-stage-field-v2',current)");

if (!html.includes('현장감리 바로보기')) throw new Error('header visibility update failed');
if (!html.includes("store.getItem('integrated-stage-field-v2')||7")) throw new Error('default stage update failed');

fs.writeFileSync(primary, html, 'utf8');
fs.writeFileSync(current, html, 'utf8');
console.log('Updated both files; field supervision opens by default.');
