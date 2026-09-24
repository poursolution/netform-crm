const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve('아파트스퀘어_감리업무_로드맵.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const sourceDirs = { b: 'manual_full_boram', g: 'manual_full_general', o: 'manual_full_ops' };
const refs = new Set();
for (const match of html.matchAll(/R\('([bgo])',\[([^\]]+)\]\)/g)) {
  const code = match[1];
  for (const raw of match[2].split(',')) refs.add(`${code}-${Number(raw.trim())}`);
}
const images = {};
for (const ref of [...refs].sort()) {
  const [code, number] = ref.split('-');
  const imagePath = path.resolve(sourceDirs[code], `slide-${number}.png`);
  if (!fs.existsSync(imagePath)) throw new Error(`Missing manual image: ${imagePath}`);
  images[ref] = `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`;
}
const marker = "function imagePath([code,n]){return `${sources[code][0]}/slide-${n}.png`}";
if (!html.includes(marker)) throw new Error('imagePath marker not found');
html = html.replace(marker, `const embeddedImages=${JSON.stringify(images)};function imagePath([code,n]){return embeddedImages[\`${'${code}-${n}'}\`]}`);
fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`Embedded ${Object.keys(images).length} manual pages into ${htmlPath}`);
