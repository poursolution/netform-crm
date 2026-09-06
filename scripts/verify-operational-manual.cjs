'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.resolve(__dirname, '../../crm-security-lab/package.json'))('playwright');

const expected = [
  'pc-dashboard.png',
  ...Array.from({ length: 9 }, (_, i) => `pc-inquiry-${String(i + 1).padStart(2, '0')}-${['list','quick-menu','detail','assign','reassign','consultant','hold','duplicate','trash'][i]}.png`),
  ...Array.from({ length: 10 }, (_, i) => `pc-pipeline-${String(i + 1).padStart(2, '0')}-${['board','split','activity','next-action','stage-quick','detail','work-amount','work-edit','transition','new-deal'][i]}.png`),
  'pc-expansion-01-pool.png',
  ...Array.from({ length: 8 }, (_, i) => `pc-message-${String(i + 1).padStart(2, '0')}-${['audience','template','preview','final','schedule','history','library','analysis'][i]}.png`),
  'pc-menu-customer-assets.png','pc-menu-salespeople.png','pc-menu-kpi.png','pc-menu-gyeongnam.png','pc-menu-weekly.png','pc-menu-sales-dashboard.png','pc-menu-performance.png','pc-menu-work-analysis.png','pc-menu-report.png','pc-menu-data-cleanup.png',
  'mobile-rep-01-today.png','mobile-rep-02-my-sales.png','mobile-rep-03-add-sales.png','mobile-rep-04-performance.png','mobile-deal-detail.png','mobile-admin-01-control.png','mobile-admin-02-pipeline.png','mobile-admin-03-performance.png','mobile-admin-04-report.png',
];

async function main() {
  const manual = path.resolve(__dirname, '../manual/index.html');
  const html = fs.readFileSync(manual, 'utf8');
  assert.ok(Buffer.byteLength(html) > 35000, 'manual must be detailed');
  assert.equal(/supabase|n8n|jwt|rpc|staging|production|uuid|receipt|409/i.test(html), false, 'operator manual contains implementation terminology');
  for (const asset of expected) {
    const file = path.resolve(__dirname, '../manual/assets', asset);
    assert.ok(fs.existsSync(file), `missing ${asset}`);
    assert.ok(fs.statSync(file).size > 5000, `small ${asset}`);
  }

  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(pathToFileURL(manual).href, { waitUntil: 'load' });
    await page.waitForFunction(() => document.images.length >= 48 && Array.from(document.images).every((img) => img.complete));
    const proof = await page.evaluate(() => ({
      title: document.title,
      sections: document.querySelectorAll('main .section').length,
      screenshots: document.querySelectorAll('main img').length,
      inquirySteps: document.querySelectorAll('#inquiry .shot-step').length,
      pipelineSteps: document.querySelectorAll('#pipeline .shot-step').length,
      messageSteps: document.querySelectorAll('#message .shot-step').length,
      mobileTabs: document.querySelectorAll('#mobile .phone-card').length,
      menuScreens: document.querySelectorAll('#all-menu .gallery-card').length,
      brokenImages: Array.from(document.querySelectorAll('main img')).filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src),
      technicalTerms: /supabase|n8n|jwt|rpc|staging|production|uuid|receipt|409/i.test(document.body.textContent),
      hasWhy: document.body.textContent.includes('왜 이 순서인가요?'),
      hasActualDataNotice: document.body.textContent.includes('실제 조회 시점'),
    }));
    assert.match(proof.title, /운영 매뉴얼/);
    assert.ok(proof.sections >= 7);
    assert.equal(proof.screenshots, 48);
    assert.equal(proof.inquirySteps, 9);
    assert.equal(proof.pipelineSteps, 10);
    assert.equal(proof.messageSteps, 8);
    assert.equal(proof.mobileTabs, 8);
    assert.equal(proof.menuScreens, 11);
    assert.deepEqual(proof.brokenImages, []);
    assert.equal(proof.technicalTerms, false);
    assert.equal(proof.hasWhy && proof.hasActualDataNotice, true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.resolve(__dirname, '../manual/manual-preview.png'), fullPage: false, animations: 'disabled' });
    console.log(JSON.stringify({ status: 'PASS', assets: expected.length, ...proof, page_errors: errors.length }));
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(`MANUAL_VERIFY_FAILED ${error.name || 'ERROR'} ${error.message || ''}`); process.exitCode = 1; });
