'use strict';

// Read-only screenshot capture for the operator manual. Forms and previews may
// be opened, but no business save/assignment/send action is submitted.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.resolve(__dirname, '../../crm-security-lab/package.json'))('playwright');

const REF = 'rprechiaglyjaydkmxsu';
const STAGING_ORIGIN = `https://${REF}.supabase.co`;
const LOCAL_ORIGIN = 'http://127.0.0.1:4181';
const OUT = path.resolve(__dirname, '../manual/assets');
const CREDENTIALS = 'C:/Users/Administrator/crm-staging-private/auth-synthetic-20260905.json';
const files = [];
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS, 'utf8'));
if (credentials.project_ref !== REF) throw new Error('WRONG_PROJECT');

function account(kind) {
  const found = credentials.accounts.find((item) => item.kind === kind);
  if (!found) throw new Error(`MISSING_${kind}`);
  return found;
}

async function newContext(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light' });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const rpc = url.pathname.replace('/rest/v1/rpc/', '');
    const isLocal = url.origin === LOCAL_ORIGIN;
    const isRead = url.origin === STAGING_ORIGIN && (
      url.pathname.startsWith('/auth/v1/') ||
      ['crm_profile_scoped_v2', 'crm_operational_source_v1', 'crm_read_scoped_v2', 'crm_expansion_context'].includes(rpc)
    );
    if (!isLocal && !isRead) return route.abort();
    if (!isLocal && !url.pathname.startsWith('/auth/v1/') && !url.pathname.includes('/rest/v1/rpc/')) return route.abort();
    return route.continue();
  });
  return context;
}

async function loginPc(page, user) {
  await page.goto(`${LOCAL_ORIGIN}/crm.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#au-name').fill(user.name);
  await page.locator('#au-pw').fill(user.password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForFunction(() => !!window.Phase1?.profile && Array.isArray(window.B?.deals));
  await page.waitForTimeout(350);
}

async function loginMobile(page, user) {
  await page.goto(`${LOCAL_ORIGIN}/mobile.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#lg-nm').fill(user.name);
  await page.locator('#lg-pw').fill(user.password);
  await page.getByRole('button', { name: '로그인하기', exact: true }).click();
  await page.waitForFunction(() => !!window.Phase1?.profile && Array.isArray(window.DEALS));
  await page.waitForFunction(() => window.LIVE === true && !window.LOAD_ERR, null, { timeout: 30000 });
  await page.waitForTimeout(350);
}

async function shot(page, name, options = {}) {
  await page.waitForTimeout(160);
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.parentElement && node.parentElement.closest('script,style')) return;
      node.nodeValue = node.nodeValue.replace(/Supabase/gi, '실시간').replace(/n8n/gi, '자동화');
    });
  });
  const locator = options.locator ? page.locator(options.locator) : null;
  const target = locator && await locator.count() ? locator : page;
  await target.screenshot({ path: path.join(OUT, name), fullPage: !locator && !!options.fullPage, animations: 'disabled' });
  files.push(name);
}

async function pcRoute(page, route) {
  await page.locator(`.mi[data-p="${route}"]`).click();
  await page.waitForFunction((value) => window.G?.page === value, route);
  await page.waitForTimeout(180);
}

async function closePcOverlays(page) {
  await page.evaluate(() => {
    ['closeInquiryControlModal', 'closeNewDeal', 'closeTransition', 'closeRelationshipMessage', 'closeQuickContact'].forEach((name) => {
      try { if (typeof window[name] === 'function') window[name](); } catch (_) {}
    });
    const detail = document.getElementById('detailView');
    if (detail) detail.classList.remove('on');
    document.body.style.overflow = '';
  });
}

async function captureInquiry(page) {
  await pcRoute(page, 'inq');
  await shot(page, 'pc-inquiry-01-list.png');
  const keys = await page.evaluate(() => {
    const rows = B.inquiries || [];
    const assigned = rows.find((q) => inquiryAssigned(q));
    const unassigned = rows.find((q) => !inquiryAssigned(q));
    return { any: rows[0] ? inqKey(rows[0]) : '', assigned: assigned ? inqKey(assigned) : '', unassigned: unassigned ? inqKey(unassigned) : '' };
  });
  if (!keys.any) return;

  await page.evaluate((key) => inqCtlOpenMenu(key), keys.any);
  await shot(page, 'pc-inquiry-02-quick-menu.png');
  await closePcOverlays(page);
  await page.evaluate((key) => inqCtlOpenSingle(key), keys.any);
  await shot(page, 'pc-inquiry-03-detail.png');
  await page.evaluate((key) => inqCtlOpenAssign('assign', key), keys.unassigned || keys.any);
  await shot(page, 'pc-inquiry-04-assign.png');
  await closePcOverlays(page);
  await page.evaluate((key) => inqCtlOpenAssign('reassign', key), keys.assigned || keys.any);
  await shot(page, 'pc-inquiry-05-reassign.png');
  await closePcOverlays(page);
  await page.evaluate((key) => inqCtlOpenConsultant(key), keys.any);
  await shot(page, 'pc-inquiry-06-consultant.png');
  await closePcOverlays(page);
  await page.evaluate((key) => inqCtlOpenReason('hold', key), keys.any);
  await shot(page, 'pc-inquiry-07-hold.png');
  await closePcOverlays(page);
  await page.evaluate((key) => inqCtlOpenDuplicate(key), keys.any);
  await shot(page, 'pc-inquiry-08-duplicate.png');
  await closePcOverlays(page);
  await page.evaluate((key) => inqCtlOpenTrash(key), keys.any);
  await shot(page, 'pc-inquiry-09-trash.png');
  await closePcOverlays(page);
}

async function capturePipeline(page) {
  await pcRoute(page, 'pipe');
  await page.evaluate(() => { G.pipeView = 'kb'; paint(); });
  await shot(page, 'pc-pipeline-01-board.png');
  const hasDeal = await page.evaluate(() => {
    const d = (B.deals || []).find((x) => isOpen(x)) || (B.deals || [])[0];
    if (!d) return false;
    window.__manualDeal = d;
    openPipeSplit(d);
    return true;
  });
  if (!hasDeal) return;
  await shot(page, 'pc-pipeline-02-split.png');
  await page.evaluate(() => splitForm('act'));
  await shot(page, 'pc-pipeline-03-activity.png');
  await page.evaluate(() => splitForm(null));
  await page.evaluate(() => splitForm('next'));
  await shot(page, 'pc-pipeline-04-next-action.png');
  await page.evaluate(() => splitForm(null));
  await page.evaluate(() => splitForm('stage'));
  await shot(page, 'pc-pipeline-05-stage-quick.png');
  await page.evaluate(() => splitForm(null));
  await page.evaluate(() => drwDeal(JSON.stringify(window.__manualDeal)));
  await shot(page, 'pc-pipeline-06-detail.png');
  await page.evaluate(() => detailTabFocus('공종·금액'));
  await shot(page, 'pc-pipeline-07-work-amount.png');
  await page.evaluate(() => openWorkEdit());
  await shot(page, 'pc-pipeline-08-work-edit.png');
  await closePcOverlays(page);
  await page.evaluate(() => { CUR_DETAIL = { kind: 'deal', key: dealKey(window.__manualDeal), item: window.__manualDeal }; openTransition(); });
  await shot(page, 'pc-pipeline-09-transition.png');
  await closePcOverlays(page);
  await page.evaluate(() => openNewDeal());
  await shot(page, 'pc-pipeline-10-new-deal.png');
  await closePcOverlays(page);
}

async function ensureExpansionTrainingRow(page) {
  return page.evaluate(() => {
    const first = expansionRecords()[0];
    return { id: first ? first.id : '' };
  });
}

async function captureExpansion(page) {
  await pcRoute(page, 'expansion');
  const row = await ensureExpansionTrainingRow(page);
  await shot(page, 'pc-expansion-01-pool.png');
  if (!row.id) return;
  const details = page.locator('.exp-pool-card details').first();
  if (await details.count()) await details.evaluate((el) => { el.open = true; });
  await shot(page, 'pc-expansion-02-history.png');
  const dateInput = page.locator('.exp-pool-card input[type="date"]').first();
  if (await dateInput.count()) await dateInput.focus();
  await shot(page, 'pc-expansion-03-next-contact.png');
  await page.evaluate((id) => expansionOpenNew(id), row.id);
  await page.waitForTimeout(450);
  await shot(page, 'pc-expansion-04-convert.png');
  await closePcOverlays(page);
}

async function ensureCampaignTarget(page) {
  await page.evaluate(() => {
    // A seasonal category includes the broadest set of current records. No
    // contact or eligibility value is altered for the manual.
    G.campaignCategory = 'lunar';
    paint();
  });
}

async function captureCampaign(page) {
  await pcRoute(page, 'campaign');
  await ensureCampaignTarget(page);
  await page.evaluate(() => { G.campaignTab = 'send'; G.campaignStep = 1; paint(); });
  await shot(page, 'pc-message-01-audience.png');
  await page.evaluate(() => {
    const first = campaignAllTargets()[0];
    CAMPAIGN_STATE.selected = first ? { [first.key]: 1 } : {};
    G.campaignStep = 2;
    paint();
  });
  await shot(page, 'pc-message-02-template.png');
  await page.evaluate(() => { const first = campaignTemplateSet()[0]; if (first) { CAMPAIGN_STATE.templateKey = first.key; CAMPAIGN_STATE.body = first.body; } G.campaignStep = 3; paint(); });
  await shot(page, 'pc-message-03-preview.png');
  await page.evaluate(() => { G.campaignStep = 4; paint(); });
  await shot(page, 'pc-message-04-final.png');
  await page.evaluate(() => campaignSetTab('schedule'));
  await shot(page, 'pc-message-05-schedule.png');
  await page.evaluate(() => campaignSetTab('history'));
  await shot(page, 'pc-message-06-history.png');
  await page.evaluate(() => campaignSetTab('templates'));
  await shot(page, 'pc-message-07-library.png');
  await page.evaluate(() => campaignSetTab('analysis'));
  await shot(page, 'pc-message-08-analysis.png');
}

async function capturePc(browser) {
  const context = await newContext(browser, { width: 1440, height: 980 });
  const page = await context.newPage();
  try {
    await loginPc(page, account('ADMIN'));
    await pcRoute(page, 'today');
    await shot(page, 'pc-dashboard.png');
    await captureInquiry(page);
    await capturePipeline(page);
    await captureExpansion(page);
    await captureCampaign(page);
    for (const [route, name] of [['sites','pc-menu-customer-assets.png'],['repmanage','pc-menu-salespeople.png'],['mgmt','pc-menu-kpi.png'],['gyeongnam','pc-menu-gyeongnam.png'],['brief','pc-menu-weekly.png'],['dash','pc-menu-sales-dashboard.png'],['perf','pc-menu-performance.png'],['work','pc-menu-work-analysis.png'],['report','pc-menu-report.png'],['dup','pc-menu-data-cleanup.png']]) {
      await closePcOverlays(page); await pcRoute(page, route); await shot(page, name);
    }
  } finally { await context.close(); }
}

async function mobileNavShot(page, route, name) {
  await page.evaluate((value) => nav(value), route);
  await page.waitForTimeout(180);
  await shot(page, name, { fullPage: true });
}

async function captureMobile(browser) {
  const repContext = await newContext(browser, { width: 390, height: 844 });
  const rep = await repContext.newPage();
  try {
    await loginMobile(rep, account('INTERNAL_REP'));
    await rep.evaluate(() => switchMode('rep'));
    await mobileNavShot(rep, 'today', 'mobile-rep-01-today.png');
    await mobileNavShot(rep, 'mine', 'mobile-rep-02-my-sales.png');
    await mobileNavShot(rep, 'find', 'mobile-rep-03-add-sales.png');
    await mobileNavShot(rep, 'my', 'mobile-rep-04-performance.png');
    const deal = await rep.evaluate(() => { const d = (DEALS || [])[0]; if (!d) return false; G.deal = d.id; nav('deal'); return true; });
    if (deal) await shot(rep, 'mobile-deal-detail.png', { fullPage: true });
  } finally { await repContext.close(); }

  const adminContext = await newContext(browser, { width: 390, height: 844 });
  const admin = await adminContext.newPage();
  try {
    await loginMobile(admin, account('ADMIN'));
    await admin.evaluate(() => switchMode('admin'));
    await mobileNavShot(admin, 'ctrl', 'mobile-admin-01-control.png');
    await mobileNavShot(admin, 'pipe', 'mobile-admin-02-pipeline.png');
    await mobileNavShot(admin, 'perf', 'mobile-admin-03-performance.png');
    await mobileNavShot(admin, 'rpt', 'mobile-admin-04-report.png');
  } finally { await adminContext.close(); }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const name of fs.readdirSync(OUT)) {
    if (/^(pc-|mobile-).+\.png$/.test(name)) fs.unlinkSync(path.join(OUT, name));
  }
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try { await capturePc(browser); await captureMobile(browser); }
  finally { await browser.close(); }
  console.log(JSON.stringify({ status: 'PASS', captured: files.length, files, production_requests: 0, business_writes: 0 }));
}

main().catch((error) => { console.error(`MANUAL_CAPTURE_FAILED ${error.name || 'ERROR'} ${error.message || ''}`); process.exitCode = 1; });
