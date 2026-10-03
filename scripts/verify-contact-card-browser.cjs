'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 try{const page=await browser.newPage();await page.route('**/*',r=>r.abort());
  await page.setContent('<div id="detailView" class="ddv on"><div class="dw-right"></div></div>');
  await page.evaluate(()=>{
   window.G={};window.ME={id:'tester'};window.TOKEN='test';window.CUR_DETAIL={kind:'deal',item:{id:'11111111-1111-4111-8111-111111111111',site:'테스트 현장'}};
   window.esc=window.escAttr=s=>String(s).replace(/[&<>"']/g,'');window.phoneFmt=s=>s;window.relationshipContact=()=>({name:'기존 소장',mobile:'01000000000'});
   window.quickContactErr=()=>{};window.OpsStore={aiOn:()=>true,ai:async(kind,type,id,input)=>{window.request={kind,type,id,input};return await new Promise(resolve=>window.finish=resolve);}};
  });
  await page.addScriptTag({path:path.resolve(__dirname,'../deal-panels-v2.js')});
  const photo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=240;c.height=160;c.getContext('2d').fillText('test card',10,40);return c.toDataURL('image/png').split(',')[1];});
  const file={name:'card.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')};
  const open=()=>page.evaluate(()=>DealPanelsV2.open('contact','new'));
  await open();assert.equal(await page.locator('#dp-card-camera').getAttribute('capture'),'environment');
  await page.locator('#dp-card-file').setInputFiles(file);await page.waitForFunction(()=>!!window.finish);
  assert.equal(await page.locator('[data-dp="save"]').isDisabled(),true);
  await page.locator('#qc-name').fill('직접 쓴 이름');
  await page.evaluate(()=>finish({suggestion:{name:'인식 이름',mobile:'01012345678',role:'관리소장',office:'0212345678',email:'test@example.com'}}));
  await page.waitForFunction(()=>!document.querySelector('[data-dp="save"]').disabled);
  assert.equal(await page.locator('#qc-name').inputValue(),'직접 쓴 이름');assert.equal(await page.locator('#qc-mobile').inputValue(),'01012345678');
  assert.equal(await page.locator('#qc-email').inputValue(),'test@example.com');assert.equal(await page.locator('[data-chips="consent"] [aria-pressed="true"]').innerText(),'아직 안 물어봄');
  assert.equal(await page.evaluate(()=>request.input.image.media_type),'image/jpeg');
  // 닫은 패널의 느린 응답이 새 연락처 폼에 들어가면 안 된다.
  await open();await page.evaluate(()=>window.finish=null);await page.locator('#dp-card-file').setInputFiles(file);await page.waitForFunction(()=>!!window.finish);
  await page.evaluate(()=>{window.oldFinish=finish;DealPanelsV2.close();DealPanelsV2.open('contact','new');oldFinish({suggestion:{name:'이전 요청',mobile:'01099999999'}});});
  await page.waitForTimeout(50);assert.equal(await page.locator('#qc-name').inputValue(),'');
  await page.locator('#dp-card-file').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  await page.waitForFunction(()=>document.querySelector('#dp-card-status').textContent.includes('JPG'));
  assert.equal(await page.locator('[data-dp="save"]').isDisabled(),false);
  console.log('PASS: photo compression, autofill, edited-value protection, consent unchanged, late-response isolation, invalid-file recovery');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
