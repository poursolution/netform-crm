'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],errors=[],writes=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812}});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await context.addInitScript(()=>{window.__voices=[];class Voice{constructor(){__voices.push(this);}start(){this.onstart?.();}abort(){}stop(){this.onend?.();}}window.SpeechRecognition=Voice;});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  await page.goto(origin+'/mobile.html?demo=1&review=guide&screen=D');await page.locator('.approved-d').waitFor();await page.evaluate(()=>document.fonts.ready);
  for(const width of [320,375,480]){
   await page.setViewportSize({width,height:812});
   const bounds=await page.locator('.approved-d').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,micHeight:el.querySelector('[data-ce="input-mic"]').getBoundingClientRect().height}));
   assert.equal(bounds.overflow,false);assert.equal(bounds.pageOverflow,false);assert.equal(bounds.micHeight,48);
   if(width===375)await page.locator('.approved-d').screenshot({path:path.join(__dirname,'approved-d-mic-implemented.png')});
  }
  checks.push('Supplied 48px microphone component stays inside Claude D at320/375/480 without horizontal overflow');
  await page.locator('[data-ce-in="memo"]').fill('원래 상담 문장');
  const original=await page.evaluate(()=>structuredClone(MobileEntry.state()));
  await page.locator('[data-ce="input-mic"]').click();await page.locator('.approved-i1').waitFor();
  assert.equal(await page.evaluate(()=>__voices.length),0);
  await page.locator('.approved-i1 [data-input-transcript]').click();await page.locator('.approved-i2').waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-input-transcript')),true);
  await page.locator('[data-input-transcript]').fill('직접 고친 상담 문장');await page.locator('[data-gs="input-review-save"]').click();await page.locator('.approved-d').waitFor();
  assert.deepEqual(await page.evaluate(()=>structuredClone(MobileEntry.state())),{...original,memo:'직접 고친 상담 문장'});
  checks.push('Actual D microphone entry opens I1 without recording; its text area opens I2 direct editing and applies only memo to D');
  await page.locator('[data-ce="input-mic"]').click();await page.locator('[data-gs="input-mic"]').click();
  await page.evaluate(()=>{const v=__voices.at(-1);window.__lateVoice=v.onresult;v.onresult({results:[Object.assign([{transcript:'부분 인식'}],{isFinal:false})]});});
  await page.locator('.approved-i1 [data-input-transcript]').click();await page.locator('.approved-i2').waitFor();
  assert.equal(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');
  await page.locator('[data-input-transcript]').fill('담당자가 확인하고 고친 내용');
  await page.evaluate(()=>__lateVoice({results:[Object.assign([{transcript:'늦은 음성'}],{isFinal:true})]}));
  assert.equal(await page.locator('[data-input-transcript]').textContent(),'담당자가 확인하고 고친 내용');
  await page.locator('[data-gs="input-review-save"]').click();await page.locator('.approved-d').waitFor();
  checks.push('Switching from active speech to existing I2 stops recognition, requires explicit correction, and ignores late provider results');
  const noVoice=await browser.newContext();await noVoice.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await noVoice.addInitScript(()=>{window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;});const unsupported=await noVoice.newPage();
  await unsupported.goto(origin+'/mobile.html?demo=1&review=guide&screen=D');await unsupported.locator('.approved-d').waitFor();
  assert.equal(await unsupported.locator('[data-ce="input-mic"]').count(),0);assert(await unsupported.locator('[data-ce-in="memo"]').isEditable());
  checks.push('Unsupported device retains D direct input and does not show a nonfunctional voice launch button');
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const report={at:new Date().toISOString(),passed:checks.length,checks,boundary:'Local synthetic data and fake speech; no real microphone, OCR, production writes or deployment.'};
  fs.writeFileSync(path.join(__dirname,'stage8-entry-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
