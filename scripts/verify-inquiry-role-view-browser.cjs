'use strict';

// Localhost-only role-view regression with synthetic inquiries. No CRM reads or writes.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.resolve(__dirname, '../../crm-security-lab/package.json'))('playwright');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
function server() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const rel = pathname === '/' ? 'crm.html' : pathname.replace(/^\/+/, '');
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
    fs.createReadStream(target).pipe(res);
  });
}

async function run() {
  const srv = server();
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof paintInq === 'function' && typeof inqCtlRoleView === 'function');
    await page.evaluate(() => {
      const base = { brand: 'POUR솔루션', created_at: '2026-09-10T00:00:00+09:00', valid_inquiry: true };
      B = {
        deals: [], inquiryTrash: [], inquiryCleanupArchived: [],
        inquiries: [
          { ...base, id: 'inq-1', site: '황윤선 최초응대 대기', assignee: '황윤선', status: '배정완료', assigned_at: '2026-09-10T00:30:00+09:00' },
          { ...base, id: 'inq-2', site: '황윤선 다음행동 필요', assignee: '황윤선', status: '응대중', assigned_at: '2026-09-10T01:00:00+09:00', responded_at: '2026-09-10T01:20:00+09:00' },
          { ...base, id: 'inq-3', site: '이필선 문의', assignee: '이필선', status: '배정완료', assigned_at: '2026-09-10T01:10:00+09:00' },
          { ...base, id: 'inq-4', site: '관리자 미배정 문의', assignee: '', status: '접수' }
        ]
      };
      LOCAL = { deals: {}, inquiries: {} };
      G.page = 'inq'; G.inqPeriodMode = 'snapshot'; G.brand = '전체'; G.rep = '전체'; G.workFilter = '전체'; G.q = ''; G.inqBucket = '전체'; G.inqView = 'console'; delete G._inqRoleApplied;
      AUTH_ON = true; ME = { name: '관리자', role: 'admin' };
      document.getElementById('authGate').classList.remove('on');
      document.querySelectorAll('.apage').forEach(node => node.classList.remove('on'));
      document.getElementById('pg-inq').classList.add('on');
      paintInq();
    });

    assert.equal(await page.locator('.inq-ctl-head h2').textContent(), '견적문의 접수·배정');
    assert.equal(await page.getByRole('button', { name: '관리자 운영' }).count(), 1);
    assert.equal(await page.locator('.inq-ctl-row:not(.head)').count(), 4);
    assert.equal(await page.locator('.inq-ctl-bulk').count(), 1);
    assert.equal(await page.locator('.inq-ctl-row:not(.head) input[type="checkbox"]').count(), 4);

    await page.evaluate(() => {
      ME = { name: '황윤선', role: 'rep' };
      G.inqRoleView = 'admin';
      paintInq();
    });
    assert.equal(await page.locator('.inq-ctl-head h2').textContent(), '내 견적문의');
    assert.match(await page.locator('.inq-ctl-tabs button.on').textContent(), /내 할 일/);
    assert.equal(await page.getByRole('button', { name: '관리자 운영' }).count(), 0);
    assert.equal(await page.evaluate(() => G.inqView), 'split');
    assert.equal(await page.locator('.sp-wrap.mine').count(), 1);
    assert.equal(await page.locator('.sp-row').count(), 2);
    assert.equal(await page.locator('.sp-row', { hasText: '이필선 문의' }).count(), 0);
    assert.equal(await page.locator('.sp-row', { hasText: '관리자 미배정 문의' }).count(), 0);
    assert.equal(await page.locator('.sp-detail').count(), 1);
    assert.equal(await page.getByRole('button', { name: /상담·영업담당/ }).count(), 0);
    assert.equal(await page.locator('.sp-acts button').count(), 3);
    assert.equal(await page.locator('.inq-ctl-bulk').count(), 0);
    assert.equal(await page.locator('.sp-row input[type="checkbox"]').count(), 0);

    const before = await page.evaluate(() => G.inqSelKey);
    await page.locator('.sp-row:not(.on)').first().click();
    assert.notEqual(await page.evaluate(() => G.inqSelKey), before);
    await page.getByRole('button', { name: /다음 행동/ }).last().click();
    assert.equal(await page.locator('#spNextText').count(), 1);
    await page.locator('.sp-form').getByRole('button', { name: '취소' }).click();
    await page.getByRole('button', { name: /상태 변경/ }).click();
    assert.equal(await page.locator('#spStatus').count(), 1);
    await page.locator('.sp-form').getByRole('button', { name: '취소' }).click();
    await page.getByRole('button', { name: /활동 기록/ }).click();
    assert.equal(await page.locator('#spLogNote').count(), 1);
    await page.locator('.sp-form').getByRole('button', { name: '취소' }).click();
    console.log(JSON.stringify({ status: 'PASS', admin_rows: 4, rep_rows: 2, rep_default: '내 할 일 + 한 화면 처리', admin_bulk_hidden_for_rep: true, admin_assignment_hidden_for_rep: true, foreign_inquiries_hidden: true, detail_selection: 'PASS', inline_actions: ['next_action', 'status', 'activity'], network_scope: 'localhost-only', business_writes: 0 }));
  } finally {
    await browser.close();
    await new Promise(resolve => srv.close(resolve));
  }
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
