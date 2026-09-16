const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH});
 try{
  const page=await browser.newPage();
  await page.setContent('<style>body{font-size:12px}#pg-today{font-size:12px}</style><div id="pg-today"><strong id="today" data-pc-text="16">현장</strong></div><div><strong id="bold" data-pc-text="16">현장</strong><span id="plain">다음 행동</span><strong id="key" data-pc-type="key">주요 값</strong></div>');
  await page.addStyleTag({path:path.join(__dirname,'../pc-typography.css')});
  await page.addScriptTag({path:path.join(__dirname,'../pc-typography.js')});
  await page.waitForFunction(()=>!document.querySelector('#today').hasAttribute('data-pc-text'));
  const sizes=await page.evaluate(()=>Object.fromEntries(['today','bold','plain','key'].map(id=>[id,getComputedStyle(document.getElementById(id)).fontSize])));
  assert.deepEqual(sizes,{today:'12px',bold:'15px',plain:'15px',key:'16px'});
  console.log('PASS computed font sizes:',JSON.stringify(sizes));
  // A click-style rerender must be corrected in the mutation microtask,
  // before the next paint, not one animation frame later.
  const frames=await page.evaluate(async()=>{
   const host=document.createElement('div');document.body.append(host);
   const results=[];
   for(let i=0;i<8;i++){
    host.innerHTML='<span class="row">현장 <strong style="font-size:1.2em">다음 행동</strong></span>';
    await new Promise(resolve=>queueMicrotask(resolve));
    results.push([...host.querySelectorAll('*')].map(el=>getComputedStyle(el).fontSize));
    host.classList.toggle('selected');
    await new Promise(resolve=>queueMicrotask(resolve));
    results.push([...host.querySelectorAll('*')].map(el=>getComputedStyle(el).fontSize));
   }
   return results;
  });
  for(const frame of frames)assert.deepEqual(frame,['15px','15px']);
  assert.equal(await page.locator('#today').evaluate(el=>getComputedStyle(el).fontSize),'12px');
  console.log('PASS 16 rerender/selection snapshots: stable before paint; Today unchanged');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
