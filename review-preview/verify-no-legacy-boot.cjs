'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const server = require('./server.cjs');
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(require('./review-environment.cjs').launchOptions());
  const checks = [];
  const hiddenApp = async page => page.evaluate(() => {
    const el = document.getElementById('stage');
    const css = el && getComputedStyle(el);
    return !el || css.display === 'none' || css.visibility === 'hidden';
  });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    await ctx.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const page = await ctx.newPage();
    let release, reached;
    const gate = new Promise(resolve => { release = resolve; });
    const shellRequested = new Promise(resolve => { reached = resolve; });
    await page.route('**/mobile-guide-shell.js*', async route => { reached(); await gate; await route.continue(); });
    const navigation = page.goto(origin + '/mobile.html?demo=1&screen=A');
    await shellRequested;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => document.documentElement.dataset.mobileApprovedView), 'pending');
    assert.equal(await hiddenApp(page), true, 'retired renderer must not flash while shell is delayed');
    checks.push('delayed shell: retired initial DOM remains invisible before DOMContentLoaded');
    release(); await navigation;
    await page.waitForFunction(() => document.documentElement.dataset.mobileApprovedView === 'approved');
    assert.equal(await page.locator('.approved-a').isVisible(), true);
    checks.push('approved renderer readiness reveals Claude A');

    await page.evaluate(() => { document.getElementById('scr').innerHTML = '<div class="home-bar">retired renderer</div>'; });
    await page.waitForFunction(() => document.documentElement.dataset.mobileApprovedView === 'pending');
    assert.equal(await hiddenApp(page), true);
    checks.push('stale direct renderer replacing approved root revokes visibility');

    const failed = await ctx.newPage();
    await failed.route('**/mobile-guide-shell.js*', route => route.abort('failed'));
    await failed.goto(origin + '/mobile.html?demo=1&review=contact');
    assert.equal(await failed.evaluate(() => document.documentElement.dataset.mobileApprovedView), 'pending');
    assert.equal(await hiddenApp(failed), true);
    assert.equal(await failed.locator('#sheetwrap').isVisible(), false);
    checks.push('failed shell: former review URL cannot reveal retired body or contact sheet');

    const failedGuard = await ctx.newPage();
    await failedGuard.route('**/mobile-approved-boot.js*', route => route.abort('failed'));
    await failedGuard.goto(origin + '/mobile.html?demo=1&screen=A');
    assert.equal(await hiddenApp(failedGuard), true, 'CSS must fail closed when boot JS fails');
    checks.push('failed boot script: head CSS still prevents fallback exposure');

    for (const asset of ['mobile-approved-d-source.js', 'mobile-contact-view.js']) {
      const missingD = await ctx.newPage();
      const errors = []; missingD.on('pageerror', error => errors.push(error.message));
      await missingD.route('**/' + asset + '*', route => route.abort('failed'));
      await missingD.goto(origin + '/mobile.html?demo=1&review=contact');
      await missingD.locator('.approved-bc').waitFor();
      assert.equal(await missingD.locator('.approved-bc').isVisible(), true);
      assert.equal(await missingD.locator('#sheetwrap').isVisible(), false);
      assert.equal(await missingD.locator('.approved-d').count(), 0);
      assert.equal(await missingD.locator('#sheetcard .intro,#sheetcard .sheet-grip').count(), 0);
      assert.deepEqual(errors, []);
      await missingD.evaluate(() => MobileEntry.open());
      assert.equal(await missingD.locator('#sheetwrap').isVisible(), false);
      checks.push('missing ' + asset + ': approved detail remains; contact open is blocked without former sheet fallback');
    }

    const contact = await ctx.newPage();
    await contact.goto(origin + '/mobile.html?demo=1&review=guide&screen=C');
    await contact.locator('.approved-bc').waitFor();
    await contact.evaluate(() => { window.__retiredContactWrites=[]; window.pushWrite=(...args)=>__retiredContactWrites.push(args); contactEditSheetM(); });
    await contact.locator('.approved-i3').waitFor();
    assert.equal(await contact.locator('#sheetwrap').isVisible(), false);
    await contact.evaluate(() => saveContactM());
    assert.deepEqual(await contact.evaluate(() => __retiredContactWrites), []);
    assert.equal(await contact.locator('.approved-i3').isVisible(), true);
    checks.push('retired contact entry opens approved I3; retired save cannot send a stale consent snapshot');

    const debug = await ctx.newPage();
    await debug.goto(origin + '/mobile.html?demo=1&debug=1&screen=A');
    assert.equal(await debug.locator('#flowwrap').isVisible(), false);
    assert.equal(await debug.locator('.mock-nav').isVisible(), false);
    checks.push('debug query cannot expose former flow map or mock navigation');

    const result = { at: new Date().toISOString(), passed: checks.length, checks,
      boundary: 'local synthetic preview only; initial visibility and renderer-failure protection; no production changes' };
    fs.writeFileSync(path.join(__dirname, 'no-legacy-boot-verification.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
