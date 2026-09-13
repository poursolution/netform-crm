const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
function server() {
  return http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '') || 'crm.html';
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', target.endsWith('.html') ? 'text/html; charset=utf-8' : target.endsWith('.css') ? 'text/css' : 'application/javascript');
    fs.createReadStream(target).pipe(res);
  });
}

(async () => {
  const srv = server();
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof paintDashboardControlSummary === 'function');
    await page.evaluate(() => {
      AUTH_ON = false;
      ME = { name: '송보람', role: 'admin' };
      B = { deals: [], inquiries: [] };
      const names = ['황윤선', '이필선', '한준엽', '정정훈', '김성민', '조현식'];
      const deals = names.map((name, i) => ({ id: `d${i}`, site: `${name} 현장`, assignee: name, code: i < 2 ? 'compete' : 'consulting', grp: 'A', amount: (i + 1) * 80000000, created: '2026-09-01' }));
      const inquiries = names.map((name, i) => ({ id: `q${i}`, site: `${name} 현장`, assignee: name, created_at: '2026-09-02', status: i % 2 ? '응대완료' : '배정완료' }));
      dashboardInquiryScope = () => inquiries;
      dashboardSnapshotDeals = () => deals;
      towerBase = () => deals;
      wonInPeriod = () => [];
      liveActs = () => [];
      metricReady = () => true;
      inqMadeStats = () => ({ _n: 6, _made: 3 });
      inquiryHasMadeDeal = q => Number(q.id.slice(1)) < 3;
      inquiryResponded = q => q.status === '응대완료';
      towerRepSnapshot = () => ({ rows: names.map((nm, i) => ({ nm, p: (i + 1) * 80000000, c: i < 2 ? (i + 1) * 30000000 : 0, w: i * 10000000, risk: i % 3, riskAmt: 0 })) });
      repFlowData = () => names.map((nm, i) => ({ nm, weekTracked: 1, weekAdvanced: i % 3 }));
      G.year = '2026'; G.quarter = 0; G.rep = '전체'; G.brand = '전체'; G.dashboardAnalysisTab = 'overview';
      document.getElementById('authGate').classList.remove('on');
      document.querySelectorAll('.apage').forEach(n => n.classList.remove('on'));
      document.getElementById('pg-dash').classList.add('on');
      paintDashboardControlSummary();
    });

    assert.equal(await page.locator('.dashboard-compact-money>div>button').count(), 5);
    assert.equal(await page.locator('.dashboard-compact-flow>div>button').count(), 5);
    assert.equal(await page.locator('.dashboard-compact-issues>div>button').count(), 3);
    assert.equal(await page.locator('.dashboard-rep-row').count(), 6);
    assert.equal(await page.locator('#d-analysis-tabs button').count(), 7);
    assert.equal(await page.locator('#dh-panel-flow').isHidden(), true);

    await page.getByRole('button', { name: '영업흐름', exact: true }).click();
    assert.equal(await page.locator('#dh-panel-flow').isVisible(), true);
    await page.getByRole('button', { name: '사업유형', exact: true }).click();
    assert.equal(await page.locator('#dh-panel-brand').isVisible(), true);
    await page.getByRole('button', { name: '집계 기준 ⓘ', exact: true }).click();
    assert.equal(await page.locator('#dh-panel-criteria').isVisible(), true);
    assert.match(await page.locator('#dh-panel-criteria').innerText(), /견적문의 연결률 50%[\s\S]*결과와 Process 분리[\s\S]*운영관리자/);
    await page.getByRole('button', { name: '전체현황', exact: true }).click();
    assert.equal(await page.locator('#d-analysis').evaluate(el => el.classList.contains('overview-selected')), true);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { G.dashboardAnalysisTab = 'overview'; paintDashboardControlSummary(); });
    assert.equal(await page.locator('.dashboard-compact-money>div>button').count(), 5);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    console.log(JSON.stringify({ status: 'PASS', kpis: 5, flow_steps: 5, issues: 3, reps: 6, analysis_tabs: 7, mobile_overflow: false, external_writes: 0 }));
  } finally {
    await browser.close();
    await new Promise(resolve => srv.close(resolve));
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
