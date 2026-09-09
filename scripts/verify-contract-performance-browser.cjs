'use strict';

/* Localhost-only browser regression for per-rep confirmed contract totals. */
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
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof paintPerf === 'function' && typeof ContractPerformance === 'object');
    await page.evaluate(() => {
      document.body.innerHTML = '<main><div id="f-kpis"></div><div id="f-tbl"></div><div id="perfDrawer" aria-hidden="true"><div id="perfDrawerTitle"></div><div id="perfDrawerBody"></div></div></main>';
      B = { deals: [
        { id: 'won-real', site: '실제 계약', brand: '기술자문', assignee: '황윤선', code: 'won', grp: '수주 성공', closed_at: '2026-08-20', amount: 120000000, won_amount: 70000000 },
        { id: 'won-missing', site: '금액 확인 필요', brand: '기술자문', assignee: '황윤선', code: 'won', grp: '수주 성공', closed_at: '2026-09-01', amount: 50000000 },
        { id: 'open-large', site: '진행 중', brand: '기술자문', assignee: '황윤선', code: 'contract', grp: '계약·시공', created: '2026-07-01', amount: 900000000 }
      ], inquiries: [], users: [] };
      Object.assign(G, { year: '2026', quarter: 0, brand: '전체', rep: '전체', workFilter: '전체', q: '' });
      managementStats = () => ({ D: [], overdue: [], nextMissing: [], stale: [] });
      targetInquiries = () => [];
      paintPerf();
    });
    const text = await page.locator('#f-kpis, #f-tbl').allTextContents();
    const joined = text.join(' ');
    assert.match(joined, /7,000만/);
    assert.match(joined, /2건/);
    assert.match(joined, /확정금액 미입력 1건/);
    assert.doesNotMatch(joined, /1억2,000만|1\.2억/);
    await page.evaluate(() => openPerfDrawer('황윤선'));
    const drawer = await page.locator('#perfDrawerBody').innerText();
    assert.match(drawer, /계약완료 근거 현장/);
    assert.match(drawer, /실제 계약/);
    assert.match(drawer, /금액 확인 필요/);
    assert.match(drawer, /금액 미입력/);
    console.log(JSON.stringify({ status: 'PASS', confirmed_total: 70000000, contract_count: 2, missing_amount: 1, network_scope: 'localhost-only', writes: 0 }));
  } finally {
    await browser.close();
    await new Promise(resolve => srv.close(resolve));
  }
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
