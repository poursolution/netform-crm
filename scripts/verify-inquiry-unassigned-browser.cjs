'use strict';

// Localhost-only exception-queue regression with synthetic inquiries. External traffic and writes are blocked.
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
    const rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '') || 'crm.html';
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream'); fs.createReadStream(target).pipe(res);
  });
}

async function run() {
  const srv = server(); await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof inquiryUnassignedMeta === 'function' && typeof paintTodayHome === 'function');
    await page.evaluate(() => {
      const ago = hours => new Date(Date.now() - hours * 36e5).toISOString();
      const base = { brand: 'POUR솔루션', status: '접수', valid_inquiry: true };
      B = { deals: [], inquiryTrash: [], inquiries: [
        { ...base, id: 'old-legacy', site: '오래된 기존 미배정', created_at: ago(72), code: 'first_contact' },
        { ...base, id: 'sync-failed', site: '동기화 실패 문의', created_at: ago(24), assignment_sync: { status: 'failed', error_code: 'TARGET_USER_AMBIGUOUS', error_message: 'active user name matched more than once', attempted_at: ago(23) } },
        { ...base, id: 'manual-return', site: '수동 회수 문의', created_at: ago(12), assignment_history: [{ from_owner: '김성민', to_owner: '미배정', reason: '담당 권역 재검토', changed_at: ago(2) }] },
        { ...base, id: 'assigned', site: '정상 배정 문의', created_at: ago(6), status: '배정완료', assignee: '김성민', assigned_at: ago(5) },
        { ...base, id: 'duplicate-empty', site: '[서울 서초] 중복 운영 문의', phone: '010-1111-2222', work: '옥상방수', created_at: ago(4), assigned_to: null, assignee_name: '', assignment_history: [] },
        { ...base, id: 'duplicate-owned', site: '[서울 서초] 중복 운영 문의', phone: '010-1111-2222', work: '옥상방수', created_at: ago(3), status: '배정완료', assigned_to: '김성민', assignee_name: '김성민', assignment_history: [] }
      ] };
      LOCAL = { deals: {}, inquiries: {} }; AUTH_ON = true; ME = { name: '송보람', role: 'admin' }; WRITE_Q = [];
      window.__testWrites = []; pushWrite = (operation, payload) => { window.__testWrites.push({ operation, payload }); return 'browser-test-write'; };
      G.page = 'today'; G.todayInquiryFilter = 'all'; G.inqPeriodMode = 'snapshot'; G.brand = '전체'; G.rep = '전체'; G.workFilter = '전체'; G.q = '';
      document.getElementById('authGate').classList.remove('on');
      document.querySelectorAll('.apage').forEach(node => node.classList.remove('on'));
      document.getElementById('pg-today').classList.add('on'); paintTodayHome();
    });

    assert.equal(await page.locator('.today-inquiry-toolbar button[data-filter="unassigned"]').textContent(), '미배정 3');
    assert.equal(await page.locator('.today-inquiry-row').first().locator('.site strong').textContent(), '오래된 기존 미배정');
    const allText = await page.locator('.today-board.inquiry').textContent();
    assert.match(allText, /사유 미기록 · 기존 데이터/);
    assert.match(allText, /담당자 계정 일치 실패/);
    assert.match(allText, /수동 회수/);
    await page.locator('.today-inquiry-toolbar button[data-filter="unassigned"]').click();
    assert.equal(await page.locator('.today-inquiry-row').count(), 3);
    assert.equal(await page.locator('.today-inquiry-action:not(.secondary)').count(), 3);
    assert.equal(await page.getByText('[서울 서초] 중복 운영 문의', { exact: true }).count(), 0);
    await page.locator('.today-inquiry-action:not(.secondary)').first().click();
    assert.equal(await page.locator('#inquiryControlModal.on').count(), 1);
    assert.match(await page.locator('#inquiryControlTitle').textContent(), /영업담당 배정/);
    await page.locator('.inq-ctl-rep[data-r="김성민"]').click();
    await page.locator('#inq-ctl-confirm').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.today-inquiry-toolbar button[data-filter="unassigned"]').textContent(), '미배정 2');
    assert.equal(await page.getByText('오래된 기존 미배정', { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.__testWrites.filter(row => row.operation === 'inquiry_assign').length), 1);

    await page.evaluate(() => {
      G.page = 'inq'; G.inqRoleView = 'admin'; G.inqBucket = '전체'; G.inqView = 'console'; G.inqPage = 1; delete G._inqRoleApplied;
      document.querySelectorAll('.apage').forEach(node => node.classList.remove('on')); document.getElementById('pg-inq').classList.add('on'); paintInq();
    });
    assert.equal(await page.locator('.inq-ctl-assign-now').count(), 2);
    assert.equal(await page.locator('.inq-ctl-row:not(.head)').first().locator('.inq-ctl-site strong').textContent(), '동기화 실패 문의');
    assert.match(await page.locator('.inq-ctl-row:not(.head)').first().locator('.inq-ctl-assignee').textContent(), /담당자 계정 일치 실패/);
    await page.locator('.inq-ctl-assign-now').first().click();
    assert.equal(await page.locator('#inquiryControlModal.on').count(), 1);
    assert.equal(await page.evaluate(() => WRITE_Q.length), 0);
    const reloadTruth = await page.evaluate(() => {
      closeInquiryControlModal();
      const userId = '33333333-3333-4333-8333-333333333333';
      B = { deals: [], users: [{ id: userId, name: '김성민' }], inquiries: [
        { id: 'server-owned', assigned_to: userId, assignee_name: '김성민', assignment_history: [] },
        { id: 'server-empty', assigned_to: null, assignee_name: '', assignment_history: [] }
      ] };
      const staleLocal = JSON.stringify({ deals: {}, inquiries: {
        'server-owned': { assigned_to: null, assignee_name: '', assignee: '' },
        'server-empty': { assigned_to: '정정훈', assignee_name: '정정훈', assignee: '정정훈' }
      } });
      const getItem = Phase1.storage.getItem;
      Phase1.storage.getItem = key => key === LOCAL_KEY ? staleLocal : getItem.call(Phase1.storage, key);
      try { applyOverrides(); } finally { Phase1.storage.getItem = getItem; }
      return B.inquiries.map(q => ({ id: q.id, owner: inquiryRoutedOwner(q), assigned: inquiryAssigned(q) }));
    });
    assert.deepEqual(reloadTruth, [
      { id: 'server-owned', owner: '김성민', assigned: true },
      { id: 'server-empty', owner: '', assigned: false }
    ]);
    console.log(JSON.stringify({ status: 'PASS', unassigned_before: 3, unassigned_after: 2, duplicate_pair: 'assigned-representative', reason_evidence: ['unrecorded', 'sync_failure', 'manual_unassign'], oldest_first: true, direct_assignment: 'saved-and-reflected', reload_server_truth: 'PASS', speculative_reasoning: false, network_scope: 'localhost-only', captured_writes: 1, external_writes: 0 }));
  } finally { await browser.close(); await new Promise(resolve => srv.close(resolve)); }
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
