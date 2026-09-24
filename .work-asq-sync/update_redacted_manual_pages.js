const fs = require('fs');
const path = require('path');

const root = __dirname;
const htmlPath = path.join(root, '아파트스퀘어_감리업무_로드맵.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const images = {
  'o-36-redacted': path.join(root, 'manual_full_ops', 'slide-36-redacted.png'),
  'g-39-redacted': path.join(root, 'manual_full_general', 'slide-39-redacted.png'),
};

const entries = Object.entries(images).map(([key, file]) => {
  const data = fs.readFileSync(file).toString('base64');
  return `${JSON.stringify(key)}:${JSON.stringify(`data:image/png;base64,${data}`)}`;
}).join(',');

const imageMapStart = 'const embeddedImages={';
if (!html.includes(imageMapStart)) throw new Error('embeddedImages map not found');
if (!html.includes('"o-36-redacted"')) {
  html = html.replace(imageMapStart, `${imageMapStart}${entries},`);
}

const oldWork = "['아임웹 현장·계정 생성','현장메뉴, 고객그룹과 계정을 만들고 해당 그룹만 접근하도록 설정합니다. 비밀번호가 표시된 원본 페이지는 화면에서 제외했습니다.','서비스',R('o',[31,32,33,34,35,37,38]).concat(R('g',[40]))]";
const newWork = "['아임웹 현장·계정 생성','현장메뉴, 고객그룹과 계정을 만들고 해당 그룹만 접근하도록 설정합니다. 계정 생성·전달 절차는 유지하고 비밀번호 값만 가린 매뉴얼을 사용합니다.','서비스',R('o',[31,32,33,34,35,36,37,38]).concat(R('g',[39,40]))]";
if (html.includes(oldWork)) html = html.replace(oldWork, newWork);
else if (!html.includes("R('o',[31,32,33,34,35,36,37,38])")) throw new Error('stage 7 work marker not found');

const oldFn = 'function imagePath([code,n]){return embeddedImages[`${code}-${n}`]}';
const newFn = "function imagePath([code,n]){const redacted=(code==='o'&&n===36)||(code==='g'&&n===39);return embeddedImages[redacted?`${code}-${n}-redacted`:`${code}-${n}`]}";
if (html.includes(oldFn)) html = html.replace(oldFn, newFn);
else if (!html.includes("n===36") || !html.includes("n===39")) throw new Error('imagePath marker not found');

fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`updated ${htmlPath}`);
