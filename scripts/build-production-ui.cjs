'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const operationalUi = require('./build-operational-full-ui.cjs');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'staging-operational-full');
const output = path.resolve(root, '..', 'deploy', 'netform-crm-production-pages');
const ref = 'ymfbmpnizxvqsamnczow';
const stagingRef = 'rprechiaglyjaydkmxsu';
const publishableKey = 'sb_publishable_Lrv2O_5Nr96a1HQF6n65zA_7OsqCz3X';
const allowedHosts = "['poursolution.github.io','127.0.0.1','localhost'].includes(location.hostname)";
const runtimeAssetVersion = '20260907-mapping-3';
const accounts = {
  '황윤선': 'hwangyunseon', '이필선': 'ipilseon', '한준엽': 'hanjunyeop',
  '정정훈': 'jeongjeonghun', '김성민': 'kimseongmin', '이승우': 'iseungwoo',
  '송보람': 'songboram', '조현식': 'johyeonsik', '조재연': 'jojaeyeon',
  '주현진': 'juhyeonjin', '한인규': 'haningyu', '경남지사': 'gyeongnam'
};
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name), dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
    else throw Error(`UNSUPPORTED_SOURCE_ENTRY:${src}`);
  }
}

function productionText(text, file) {
  let next = text
    .replaceAll(stagingRef, ref)
    .replaceAll('crm:staging:', 'crm:production:')
    .replaceAll('/* Staging common transport only.', '/* Production common transport only.')
    .replace("||!['127.0.0.1','localhost'].includes(location.hostname)", `||!${allowedHosts}`)
    .replaceAll('테스트 계정 비밀번호', '본인 핸드폰 번호')
    .replaceAll('대소문자와 특수문자를 그대로 입력하세요.', '하이픈은 넣어도 되고 안 넣어도 됩니다.')
    .replaceAll('inputmode="text"', 'inputmode="numeric"')
    .replace("pw=(document.getElementById('au-pw').value||''),", "pw=(document.getElementById('au-pw').value||'').replace(/[^0-9]/g,''),")
    .replace("pw=(G.lgPw||'');", "pw=(G.lgPw||'').replace(/[^0-9]/g,'');")
    .replaceAll('Staging Phase 1: 로그인 연결 완료 · 업무별 read 계약은 후속 Phase에서 연결합니다. 전체 실적 데이터로 해석하지 마세요.', '운영 데이터를 불러오는 중입니다.')
    .replaceAll('Staging · 업무 데이터 unavailable', '운영 · 데이터 연결 중')
    .replaceAll('src="/phase1-config.js"', 'src="./phase1-config.js"')
    .replaceAll('src="/operational-adapter.js"', 'src="./operational-adapter.js"')
    .replaceAll('src="/transport.js"', `src="./transport.js?v=${runtimeAssetVersion}"`)
    .replaceAll('src="/operational-overlay.js"', `src="./operational-overlay.js?v=${runtimeAssetVersion}"`)
    .replaceAll('src="/work-editor.js"', 'src="./work-editor.js"')
    .replace(/^ +$/gm, '');
  if (next.includes('nfrnd.app.n8n.cloud')) {
    throw Error(`LEGACY_WRITE_ENDPOINT_DRIFT:${file}`);
  }
  return next;
}

function build() {
  operationalUi.build();
  if (!fs.existsSync(source)) throw Error(`MISSING_ASSEMBLED_SOURCE:${source}`);
  copyTree(source, output);
  const runtimeFiles = [];
  for (const file of fs.readdirSync(output, { withFileTypes: true })) {
    if (!file.isFile() || !/\.(?:html|js|css)$/.test(file.name)) continue;
    const target = path.join(output, file.name);
    const transformed = productionText(fs.readFileSync(target, 'utf8'), file.name);
    fs.writeFileSync(target, transformed);
    runtimeFiles.push(file.name);
  }
  const config = {
    project_ref: ref,
    url: `https://${ref}.supabase.co`,
    publishable_key: publishableKey,
    accounts: Object.entries(accounts).map(([name, id]) => ({ name, email: `${id}@crm.netform.co.kr` }))
  };
  fs.writeFileSync(path.join(output, 'phase1-config.js'), `window.PHASE1_CONFIG=${JSON.stringify(config)};\n`);
  runtimeFiles.push('phase1-config.js');
  const combined = runtimeFiles.map(file => fs.readFileSync(path.join(output, file), 'utf8')).join('\n');
  const transport = fs.readFileSync(path.join(output, 'transport.js'), 'utf8');
  if (!combined.includes(ref) || combined.includes(stagingRef) || combined.includes('nfrnd.app.n8n.cloud')) throw Error('PRODUCTION_ENDPOINT_GUARD_FAILED');
  if (!transport.includes(allowedHosts) || !transport.includes(`const REF='${ref}'`)) throw Error('PRODUCTION_HOST_GUARD_FAILED');
  const manifest = {
    project_ref: ref,
    status: 'PRODUCTION_31_OP_UI_ASSEMBLED_PENDING_E2E',
    source_commit: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    approved_dashboard_commit: '842a5dd',
    connected_operations: JSON.parse(fs.readFileSync(path.join(source, 'operational-full-ui-manifest.json'), 'utf8')).connected_operations,
    operation_count: 31,
    allowed_hosts: ['poursolution.github.io', '127.0.0.1', 'localhost'],
    external_n8n_body_accessed: false,
    files_sha256: Object.fromEntries(runtimeFiles.sort().map(file => [file, hash(fs.readFileSync(path.join(output, file)))]))
  };
  fs.writeFileSync(path.join(output, 'production-ui-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { output, files: runtimeFiles.length, status: manifest.status };
}

function applyToRoot() {
  const result = build();
  for (const entry of fs.readdirSync(output, { withFileTypes: true })) {
    if (entry.name === 'source-manifest.json' || entry.name === 'operational-full-ui-manifest.json') continue;
    const src = path.join(output, entry.name), dst = path.join(root, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
  return { ...result, applied_to_root: true };
}

if (require.main === module) console.log(JSON.stringify(process.argv.includes('--apply-root') ? applyToRoot() : build(), null, 2));
module.exports = { build, applyToRoot, output, ref };
