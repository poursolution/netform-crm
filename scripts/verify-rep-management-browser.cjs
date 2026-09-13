const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function server() {
  return http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '') || 'crm.html';
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
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
    await page.waitForFunction(() => typeof paintRepManagement === 'function' && typeof repManagerRenderDrawer === 'function');
    await page.evaluate(() => {
      AUTH_ON = false;
      ME = { name: '송보람', role: 'admin' };
      B = { deals: [], inquiries: [] };
      const names = ['정정훈', '김성민', '이필선', '한준엽', '황윤선', '조현식'];
      const rows = names.map((nm, i) => ({
        nm, assigned: 18 - i, responded: 16 - i, opps: 10 - i, compete: 5 - (i % 3), won: i % 3,
        wonAmount: (i + 1) * 45000000, pipeline: (i + 2) * 90000000, near: (i + 1) * 30000000,
        current: [], deals: [], riskDeals: [], risk: i < 3 ? 5 - i : i % 2, unresponded: i % 2,
        noNext: i < 4 ? 2 : 0, overdue: i < 3 ? 1 : 0, stale: i % 3, crmIncomplete: 0,
        weekTracked: 2, weekAdvanced: i % 3, weekCompete: i % 2, weekBid: i % 2, weekWon: i % 2,
        weekNew: 2 + i, weekClosed: i % 2, weekSchedule: 3 + i,
        stages: [
          { label: '초기·설계', codes: ['first_contact', 'consulting'], n: 5 + i },
          { label: '자료발송', codes: ['sent'], n: 3 + i },
          { label: '관계관리', codes: ['rapport', 'silent', 'waiting'], n: 2 + i },
          { label: '경쟁·입찰', codes: ['compete', 'bidding'], n: 1 + i },
          { label: '계약·시공', codes: ['contract', 'construction'], n: i }
        ],
        load: { score: 42 + i * 9, open: 12 + i, recent: 2 + i },
        diagnosis: { k: i < 2 ? 'critical' : i === 2 ? 'watch' : 'ok', title: i < 2 ? '관리 개입 필요' : '흐름 정상', text: i < 2 ? '기한초과 현장을 먼저 확인하세요.' : '이번 주 영업 흐름이 정상입니다.' }
      }));
      repFlowData = () => rows;
      repSupportRows = () => [];
      repManagerComments = () => [];
      document.getElementById('authGate').classList.remove('on');
      document.querySelectorAll('.apage').forEach(n => n.classList.remove('on'));
      const target = document.getElementById('pg-repmanage');
      if (target) target.classList.add('on');
      G.repManagerView = 'people';
      paintRepManagement();
    });

    assert.equal(await page.locator('.rm-person-card').count(), 6);
    assert.equal(await page.locator('.rm-intervention-strip button').count(), 3);
    assert.match(await page.locator('.rm-control-head').innerText(), /Pipeline[\s\S]*계약완료[\s\S]*Stage 전진[\s\S]*수주임박[\s\S]*관리필요/);

    await page.getByRole('button', { name: '팀 비교', exact: true }).click();
    assert.equal(await page.locator('.rm-team-board').count(), 1);
    assert.match(await page.locator('.rm-team-board').innerText(), /현재 Stage 분포[\s\S]*지난 7일 영업 움직임[\s\S]*실행 관리[\s\S]*업무량 균형/);

    await page.getByRole('button', { name: '사람별 관리', exact: true }).click();
    await page.locator('.rm-person-card').first().click();
    assert.equal(await page.locator('.rm-drawer-tabs button').count(), 5);
    for (const tab of ['현황', '문제현장', '활동·진전', '업무량', '코칭·약속']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      assert.equal(await page.locator('.rm-drawer-tabs button.on').innerText(), tab);
      assert.equal(await page.locator('.rm-drawer-panel').count(), 1);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { closePerfDrawer(); G.repManagerView = 'people'; paintRepManagement(); });
    assert.equal(await page.locator('.rm-person-card').count(), 6);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    await page.locator('.rm-person-card').first().click();
    assert.equal(await page.locator('.rm-drawer-tabs button').count(), 5);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);

    console.log(JSON.stringify({ status: 'PASS', people_cards: 6, interventions: 3, team_compare: true, drawer_tabs: 5, mobile_overflow: false, external_writes: 0 }));
  } finally {
    await browser.close();
    await new Promise(resolve => srv.close(resolve));
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
