'use strict';

/* Read-only browser regression for source-brand and current-business dual attribution. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.resolve(__dirname, '../../crm-security-lab/package.json'))('playwright');
const root = path.resolve(__dirname, '..');

function server() {
  return http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '') || 'crm.html';
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) { res.writeHead(404); return res.end(); }
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(target).pipe(res);
  });
}

async function run() {
  const srv = server();
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const port = srv.address().port;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/crm.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof paintTowerOrigin === 'function' && typeof BusinessAttribution === 'object');
    await page.evaluate(() => {
      document.body.innerHTML = '<main style="padding:32px"><section class="card" id="d-origin"></section></main>';
      B = { deals: [
        { id: 'asq-open', site: 'ASQ 진행', brand: '기술자문', originBusiness: '아파트스퀘어', currentBusiness: '기술자문', assignee: '황윤선', code: 'sent', grp: '컨설팅·견적', created: '2026-09-01', amt: 100000000 },
        { id: 'asq-won', site: 'ASQ 수주', brand: '기술자문', origin_business: '아파트스퀘어', current_business: '기술자문', assignee: '황윤선', code: 'won', grp: '수주 성공', created: '2026-09-02', amt: 90000000, won_amount: 70000000 },
        { id: 'asq-native', site: 'ASQ 유지', brand: '아파트스퀘어', originBusiness: '아파트스퀘어', currentBusiness: '아파트스퀘어', assignee: '황윤선', code: 'first_contact', grp: '영업·관리', created: '2026-09-03', amt: 30000000 },
        { id: 'tech-native', site: '기술자문 직접', brand: '기술자문', originBusiness: '기술자문', currentBusiness: '기술자문', assignee: '황윤선', code: 'sent', grp: '컨설팅·견적', created: '2026-09-04', amt: 20000000 }
      ] };
      Object.assign(G, { year: 2026, quarter: 0, brand: '기술자문', rep: '전체', workFilter: '전체', q: '' });
      inPeriod = () => true;
      workMatches = () => true;
      paintTowerOrigin();
    });
    const cells = await page.locator('tr.origin-focus td').allTextContents();
    assert.equal(cells[0], '아파트스퀘어');
    assert.equal(cells[1], '3');
    assert.equal(cells[3], '2');
    const banner = await page.locator('.origin-flow-banner').innerText();
    assert.match(banner, /아파트스퀘어가 만든 기술자문 기여/);
    assert.match(banner, /2건/);
    assert.match(await page.locator('.origin-axis-note').innerText(), /두 표의 합계를 더하지 않습니다/);
    console.log(JSON.stringify({ status: 'PASS', asq_origin_count: 3, advisory_converted_count: 2, network_scope: 'localhost-only', business_writes: 0 }));
  } finally {
    await browser.close();
    await new Promise(resolve => srv.close(resolve));
  }
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
