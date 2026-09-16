const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const root=path.join(__dirname,'..');
 const js=fs.readFileSync(path.join(root,'pc-typography.js'),'utf8');
 const crm=fs.readFileSync(path.join(root,'crm.html'),'utf8');
 assert.doesNotMatch(js,/MutationObserver|querySelectorAll\(['"]body \*|data-pc-reduced|style\.setProperty/);
 assert.doesNotMatch(crm,/src="pc-typography\.js/);
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH});
 try{
  const page=await browser.newPage();
  await page.setContent('<style>#pg-today{font-size:12px}</style><div id="pg-today"><strong id="today">현장</strong></div><div id="roles"><span data-pc-type="page-title">A</span><span data-pc-type="section-title">B</span><span data-pc-type="key">C</span><span data-pc-type="body">D</span><span data-pc-type="support">E</span></div>');
  await page.addStyleTag({path:path.join(root,'pc-typography.css')});
  const sizes=await page.locator('#roles span').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).fontSize));
  assert.deepEqual(sizes,['20px','15px','16px','13px','11px']);
  assert.equal(await page.locator('#today').evaluate(el=>getComputedStyle(el).fontSize),'12px');
  await page.locator('#roles').evaluate(el=>el.insertAdjacentHTML('beforeend','<span id="new-row">새 행</span>'));
  assert.deepEqual(await page.locator('#new-row').evaluate(el=>({style:el.getAttribute('style'),attrs:[...el.attributes].map(a=>a.name)})),{style:null,attrs:['id']});
  console.log('PASS static five-role typography; Today and rerenders remain untouched');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
