'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const root = path.join(__dirname, '..');
  for (const file of ['crm.html', 'mobile.html']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /src="account-password.js\?v=/);
    assert.match(source, /onclick="CRMPassword.open\(\)"/);
  }
  const browser = await chromium.launch({headless: true, executablePath: process.env.EDGE_PATH});
  try {
    for (const width of [375, 1280]) {
      const page = await browser.newPage({viewport: {width, height: 800}});
      await page.setContent('<button id="trigger" onclick="CRMPassword.open()">비밀번호 변경</button>');
      await page.addStyleTag({path: path.join(root, 'account-password.css')});
      await page.evaluate(() => {
        window.Phase1 = {profile: {auth_uid: 'test-user'}};
        window.calls = [];
        window.outcome = 'success';
        window.SB = {auth: {
          getUser: async () => ({data: {user: {id: 'test-user'}}}),
          updateUser: async payload => {
            window.calls.push(payload);
            if (window.outcome === 'pending') await new Promise(resolve => {window.release = resolve;});
            return window.outcome === 'error' ? {error: {code: 'invalid_current_password'}} : {data: {user: {id: 'test-user'}}};
          }
        }};
      });
      await page.addScriptTag({path: path.join(root, 'account-password.js')});
      await page.locator('#trigger').click();
      const box = await page.locator('dialog').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, 'dialog fits viewport');
      await page.getByLabel('현재 비밀번호', {exact: true}).fill('old-example-password');
      await page.getByLabel('새 비밀번호', {exact: true}).fill('  New password!  ');
      await page.getByLabel('새 비밀번호 확인', {exact: true}).fill('mismatch');
      await page.locator('button[type=submit]').click();
      await page.getByRole('status').filter({hasText: '일치하지 않습니다'}).waitFor();
      assert.equal(await page.evaluate(() => calls.length), 0);
      for (const outcome of ['error', 'success']) {
        await page.evaluate(value => {window.outcome = value;}, outcome);
        await page.getByLabel('현재 비밀번호', {exact: true}).fill('old-example-password');
        await page.getByLabel('새 비밀번호', {exact: true}).fill('  New password!  ');
        await page.getByLabel('새 비밀번호 확인', {exact: true}).fill('  New password!  ');
        await page.locator('button[type=submit]').click();
        await page.getByRole('status').filter({hasText: outcome === 'error' ? '현재 비밀번호를 확인' : '비밀번호를 변경했습니다'}).waitFor();
        assert.deepEqual(await page.locator('input').evaluateAll(fields => fields.map(f => f.value)), ['', '', '']);
      }
      assert.deepEqual(await page.evaluate(() => calls[1]), {password: '  New password!  ', current_password: 'old-example-password'});
      await page.getByRole('button', {name: '닫기', exact: true}).click();
      await page.locator('dialog').waitFor({state: 'detached'});
      assert.equal(await page.locator('dialog').count(), 0);
      assert.equal(await page.locator('#trigger').evaluate(el => el === document.activeElement), true);
      await page.locator('#trigger').click();
      await page.evaluate(() => {window.outcome = 'pending';});
      await page.getByLabel('현재 비밀번호', {exact: true}).fill('old-example-password');
      await page.getByLabel('새 비밀번호', {exact: true}).fill('  New password!  ');
      await page.getByLabel('새 비밀번호 확인', {exact: true}).fill('  New password!  ');
      await page.locator('button[type=submit]').click();
      assert.equal(await page.locator('button[type=submit]').isDisabled(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog').isVisible(), true);
      await page.evaluate(() => {Phase1.profile = null; window.dispatchEvent(new Event('phase1:identity-cleared')); window.release();});
      await page.locator('dialog').waitFor({state: 'detached'});
      await page.locator('#trigger').click();
      assert.equal(await page.locator('dialog').count(), 0);
      await page.close();
    }
    const server = http.createServer((req, res) => {
      const target = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {res.writeHead(404); res.end(); return;}
      res.setHeader('Content-Type', target.endsWith('.html') ? 'text/html; charset=utf-8' : target.endsWith('.css') ? 'text/css' : 'application/javascript');
      fs.createReadStream(target).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      for (const width of [320, 375]) {
        const page = await browser.newPage({viewport: {width, height: 800}});
        await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}/mobile.html?demo=1`);
        for (const allowed_modes of [['rep'], ['rep', 'admin']]) {
          await page.evaluate(modes => {
            window.Phase1 = {profile: {auth_uid: 'test-user', allowed_modes: modes}};
            window.SB = {auth: {}};
            G.user = {id: 'test-user', nm: '테스트담당자'};
            G.mode = 'rep'; G.tab = 'today'; G.sub = null; G.deal = null;
            render();
          }, allowed_modes);
          const buttons = await page.locator('.home-bar button').evaluateAll(elements => elements.map(el => ({text: el.textContent, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right})));
          assert.ok(buttons.every(b => b.left >= 0 && b.right <= width), `mobile header fits ${width}px: ${JSON.stringify(buttons)}`);
          await page.getByRole('button', {name: '비밀번호 변경', exact: true}).click();
          await page.getByRole('dialog').waitFor();
          await page.getByRole('button', {name: '취소', exact: true}).click();
          await page.getByRole('dialog').waitFor({state: 'detached'});
        }
        await page.close();
      }
    } finally {await new Promise(resolve => server.close(resolve));}
    console.log('PASS password dialog at 375/1280px and real mobile header at 320/375px: validation, errors, cleanup, focus, in-flight lock, logout, rep/admin entry points');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
