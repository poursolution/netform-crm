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
  assert.deepEqual(sizes,{today:'12px',bold:'13.6667px',plain:'13.6667px',key:'14.6667px'});
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
  for(const frame of frames)assert.deepEqual(frame,['13.6667px','13.6667px']);
  assert.equal(await page.locator('#today').evaluate(el=>getComputedStyle(el).fontSize),'12px');
  console.log('PASS 16 rerender/selection snapshots: stable before paint; Today unchanged');
  // Actual CRM menu CSS uses transition:.13s (implicitly all properties).
  // Sample every animation frame, not just the settled end state.
  await page.addStyleTag({content:'.mi{font-size:13px;transition:.13s}.mi.on{background:#eef}'});
  await page.evaluate(()=>{
   const menu=document.createElement('div');menu.className='mi';menu.id='menu';menu.textContent='파이프라인';
   menu.onclick=()=>menu.classList.toggle('on');document.body.append(menu);
  });
  await page.waitForTimeout(250);
  for(let click=0;click<3;click++){
   const samples=await page.evaluate(async()=>{
    const el=document.getElementById('menu'),values=[];el.click();
    const start=performance.now();
    while(performance.now()-start<250){await new Promise(requestAnimationFrame);values.push(getComputedStyle(el).fontSize)}
    return values;
   });
   console.log('transition frame sizes', [...new Set(samples)]);
   assert.ok(samples.every(size=>size==='13.6667px'),'reduced font size must remain stable throughout each click');
  }
  assert.equal(await page.locator('#today').getAttribute('data-pc-font-stable'),null);
  assert.equal(await page.locator('#today').evaluate(el=>getComputedStyle(el).fontSize),'12px');
  const transition=await page.locator('#menu').evaluate(el=>getComputedStyle(el).transitionProperty);
  assert.ok(transition.includes('background-color')&&transition.includes('transform'));
  assert.ok(!transition.includes('font')&&!transition.includes('all'));
  await page.evaluate(()=>{
   const panel=document.createElement('section');panel.id='size-matrix';
   panel.innerHTML='<h1>제목</h1><small>보조</small><button>버튼</button><strong style="font-size:32px">큰 값</strong><span style="font-size:20px">부모 <b>자식</b></span>';
   document.body.append(panel);
  });
  const readMatrix=()=>page.locator('#size-matrix').evaluate(el=>[...el.querySelectorAll('*')].map(n=>parseFloat(getComputedStyle(n).fontSize)));
  const expected=[24,13,14,32,20,20].map(n=>n-4/3);
  for(let round=0;round<3;round++){
   const values=await readMatrix();values.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<0.001,JSON.stringify(values)));
   await page.evaluate(()=>{document.getElementById('size-matrix').classList.toggle('selected');window.dispatchEvent(new Event('resize'))});
  }
  assert.equal(await page.locator('#today').getAttribute('data-pc-reduced'),null);
  console.log('PASS headings, small text, buttons, large values and inherited text: exactly -1pt, no cumulative reduction');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
