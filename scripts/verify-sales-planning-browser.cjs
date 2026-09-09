'use strict';

/* Read-only browser regression for the planned-year filter and its visible counts. */
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/crm.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof constructionYearFilterHTML === 'function' && typeof ExternalPerformance === 'object');
    await page.evaluate(() => {
      document.body.innerHTML = '<main style="padding:40px"><div id="p-flow"></div><div class="btabs" id="p-brands"></div><div id="p-top"></div><div id="p-main"></div></main>';
      B = { deals: [
        { site: '2027 계획', brand: 'POUR솔루션', assignee: '고영운', grp: '영업·관리', code: 'first_contact', created: '2026-09-01', stageContexts: { imminent: { fields: { expected_contract: '2027-06-01' } } } },
        { site: '2028 착공', brand: 'POUR솔루션', assignee: '고영운', grp: '영업·관리', code: 'contract', created: '2026-09-01', stageContexts: { construction: { fields: { start_date: '2028-02-01' } } } },
        { site: '일정 미정', brand: 'POUR솔루션', assignee: '고영운', grp: '영업·관리', code: 'sent', created: '2026-09-01' }
      ] };
      Object.assign(G, { year: '2026', quarter: 0, brand: '전체', rep: '전체', workFilter: '전체', q: '', pipeOrigin: null, pipePeriodMode: 'snapshot', constructionYear: '전체', pipeStatus: '전체', pipeSub: '전체', pipeAge: '전체', pipeView: 'kb' });
      inPeriod = () => true;
      workMatches = () => true;
      metricDealMatch = () => true;
      paintPipeBase = () => {
        document.getElementById('p-brands').innerHTML = '<span class="bt" data-brand="전체">전체<span class="c">3</span></span><span class="bt" data-brand="POUR솔루션">POUR솔루션<span class="c">3</span></span><div class="viewtg"><span class="clk">칸반</span><span class="clk">빠른관리</span></div>';
      };
      paint = () => paintPipe();
      paintPipe();
    });
    const options = await page.locator('.plan-year-filter select option').allTextContents();
    assert.ok(options.includes('2027년'));
    assert.ok(options.includes('2028년'));
    assert.ok(options.includes('미입력 일정'));
    assert.equal(await page.locator('.plan-year-filter .missing').textContent(), '일정 미입력 1건');
    await page.locator('.plan-year-filter select').selectOption('2027');
    assert.equal(await page.evaluate(() => G.constructionYear), '2027');
    assert.equal(await page.evaluate(() => pipeFiltered().map(deal => deal.site).join(',')), '2027 계획');
    assert.equal(await page.locator('[data-brand="전체"] .c').textContent(), '1');
    console.log(JSON.stringify({ status: 'PASS', variants: ['전체', '2027', '2028', '미입력'], network_scope: 'localhost-only', business_writes: 0 }));
  } finally {
    await browser.close();
    await new Promise(resolve => srv.close(resolve));
  }
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
