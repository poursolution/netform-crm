'use strict';

// Localhost-only role and click regression. Synthetic CRM rows; external traffic and writes are blocked.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.resolve(__dirname, '../../crm-security-lab/package.json'))('playwright');

const root = path.resolve(__dirname, '..');
function server() { return http.createServer((req, res) => { const rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '') || 'crm.html', target = path.resolve(root, rel); if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end(); return; } res.setHeader('Cache-Control', 'no-store'); fs.createReadStream(target).pipe(res); }); }

async function run() {
  const srv = server(); await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof paintTodayHome === 'function' && !!document.getElementById('today-home-root'));
    await page.evaluate(() => {
      const iso = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
      const old = new Date(Date.now() - 5 * 36e5).toISOString();
      B = { inquiryTrash: [], deals: [
        { id: 'deal-mine', site: '황윤선 기한초과 현장', assignee: '황윤선', code: 'consulting', grp: '영업·관리', stage: '컨설팅 설계', nextActionObj: { text: '관리소장 진행상황 확인', due: iso(-3), createdAt: old, status: 'open' } },
        { id: 'deal-other', site: '이필선 후속조치 현장', assignee: '이필선', code: 'sent', grp: '컨설팅·견적', stage: '견적 발송완료' }
      ], inquiries: [
        { id: 'inq-unassigned', site: '관리자 미배정 문의', brand: 'POUR솔루션', status: '접수', created_at: old },
        { id: 'inq-mine', site: '황윤선 응대지연 문의', brand: 'POUR솔루션', status: '배정완료', assignee: '황윤선', assigned_at: old, created_at: old }
      ].concat(Array.from({ length: 15 }, (_, i) => ({ id: `inq-extra-${i}`, site: `전체표시 문의 ${i + 1}`, brand: 'POUR솔루션', status: '접수', created_at: old }))) };
      LOCAL = { deals: {}, inquiries: {} }; AUTH_ON = true; G.page = 'today';
      document.getElementById('authGate').classList.remove('on');
      document.querySelectorAll('.apage').forEach(node => node.classList.remove('on'));
      document.getElementById('pg-today').classList.add('on');
      ME = { name: '송보람', role: 'admin' }; paintTodayHome();
      window.__todayOpened = null; todayOpenWork = (group, i) => { window.__todayOpened = { group, i }; };
    });

    assert.equal(await page.locator('.today-admin').count(), 1);
    assert.equal(await page.locator('.today-board').count(), 2);
    assert.equal(await page.locator('.today-board.inquiry').getByText('관리자 미배정 문의', { exact: true }).count(), 1);
    assert.equal(await page.locator('.today-board.pipeline').getByText('이필선 후속조치 현장', { exact: true }).count(), 1);
    assert.equal(await page.locator('.today-inquiry-head > span').count(), 7);
    assert.equal(await page.locator('.today-inquiry-row').count(), 17);
    assert.equal(await page.evaluate(() => { const el = document.querySelector('.today-inquiry-table'); return el.scrollWidth <= el.clientWidth; }), true);
    await page.locator('.today-inquiry-toolbar button[data-filter="delayed"]').click();
    assert.equal(await page.locator('.today-inquiry-row').count(), 1);
    await page.locator('.today-inquiry-toolbar button[data-filter="all"]').click();
    assert.ok((await page.locator('.today-work-main em').allTextContents()).every(Boolean));
    assert.ok((await page.locator('.today-work-main b').allTextContents()).every(text => text.startsWith('다음 조치')));

    await page.evaluate(() => { ME = { name: '황윤선', role: 'rep' }; paintTodayHome(); window.__todayOpened = null; });
    assert.equal(await page.locator('.today-admin').count(), 0);
    assert.equal(await page.locator('.today-rep').count(), 1);
    assert.equal(await page.locator('.today-rep-priority').count(), 1);
    assert.equal(await page.locator('.today-rep-routine').count(), 1);
    assert.equal(await page.getByText('이필선 후속조치 현장', { exact: true }).count(), 0);
    assert.equal(await page.getByText('관리자 미배정 문의', { exact: true }).count(), 0);
    assert.equal(await page.getByText('황윤선 기한초과 현장', { exact: true }).count(), 1);
    await page.locator('.today-rep-priority .today-work-card').first().click();
    assert.deepEqual(await page.evaluate(() => window.__todayOpened), { group: 'rep-priority', i: 0 });

    await page.setViewportSize({ width: 700, height: 900 });
    await page.evaluate(() => { ME = { name: '송보람', role: 'admin' }; G.todayAdminBoard = 'inquiry'; paintTodayHome(); window.__todayOpened = null; });
    assert.equal(await page.locator('.today-admin-switch').isVisible(), true);
    assert.equal(await page.locator('.today-board.inquiry').isVisible(), true);
    assert.equal(await page.locator('.today-board.pipeline').isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    await page.locator('.today-admin-switch button[data-board="pipeline"]').click();
    assert.equal(await page.locator('.today-board.inquiry').isVisible(), false);
    assert.equal(await page.locator('.today-board.pipeline').isVisible(), true);
    console.log(JSON.stringify({ status: 'PASS', admin_boards: 2, inquiry_rows_all: 17, inquiry_horizontal_scroll: false, inquiry_filters: 'PASS', rep_priority_first: true, foreign_rows_hidden: true, mobile_board_tabs: 'PASS', card_click: 'PASS', network_scope: 'localhost-only', business_writes: 0 }));
  } finally { await browser.close(); await new Promise(resolve => srv.close(resolve)); }
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
