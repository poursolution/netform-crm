const fs = require('fs');
const path = require('path');
const { createWorker, OEM } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/tesseract.js');

async function main() {
const root = process.argv[2];
const mode = process.argv[3] || 'edge';
const only = process.argv[4] || '';
const files = fs.readdirSync(root).filter(f => /\.jpg$/i.test(f)).sort((a, b) => a.localeCompare(b, 'ko'));
const groups = new Map();
for (const file of files) {
  const match = file.match(/^(.*)-(\d+)\.jpg$/i);
  if (!match) continue;
  const key = match[1];
  const item = { file, page: Number(match[2]) };
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(item);
}

const selected = [];
for (const [key, items] of groups) {
  if (only && !key.includes(only)) continue;
  items.sort((a, b) => a.page - b.page);
  const picks = mode === 'all' ? items : [items[0], items[items.length - 1]];
  for (const item of picks) selected.push({ key, ...item });
}

const cachePath = path.join(root, '.tess-cache');
fs.mkdirSync(cachePath, { recursive: true });
const worker = await createWorker('kor+eng', OEM.LSTM_ONLY, { cachePath, logger: () => {} });
const out = [];
for (const item of selected) {
  const result = await worker.recognize(path.join(root, item.file));
  const text = result.data.text || '';
  const lines = text.split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const keywordLines = lines.filter(line => /계약|아파트|설계|감리|방문|주\s*[0-9일이삼]+\s*회|금액|보수|용역비|기간|착수|완료|준공|지급|선금|잔금|부가가치세|VAT|대표회의|갑|을/.test(line));
  out.push({ contract: item.key, page: item.page, chars: text.trim().length, keywordLines, preview: lines.slice(0, 25) });
}
await worker.terminate();
if (mode === 'all') {
  const aggregate = [];
  for (const [contract] of groups) {
    const rows = out.filter(x => x.contract === contract);
    aggregate.push({
      contract,
      pages: rows.length,
      keywordLines: rows.flatMap(x => x.keywordLines.map(line => `p${x.page}: ${line}`)).slice(0, 180)
    });
  }
  process.stdout.write(JSON.stringify(aggregate, null, 2));
} else {
  process.stdout.write(JSON.stringify(out, null, 2));
}
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
