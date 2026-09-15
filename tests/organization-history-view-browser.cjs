const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();const root=path.join(__dirname,'..');
 await page.setContent('<main><div id="list"></div><h3 id="title"></h3><div id="detail"></div></main>');
 await page.addScriptTag({path:path.join(root,'organization-history-view.js')});
 const crm=fs.readFileSync(path.join(root,'crm.html'),'utf8');
 await page.addScriptTag({content:crm.split(/\r?\n/).find(x=>x.startsWith('function siteNoteDisplayText('))});
 await page.evaluate(()=>{
  window.pending={};window.fail=false;window.invalidations=0;
  window.view=OrganizationHistoryView.create({listRoot:document.querySelector('#list'),detailRoot:document.querySelector('#detail'),titleRoot:document.querySelector('#title'),toPlainText:siteNoteDisplayText,reader:{list:async()=>{if(window.fail)throw Error();return [{id:'a',name:'동명 아파트',note_count:1},{id:'b',name:'동명 아파트',note_count:1}];},notes:id=>new Promise(resolve=>{window.pending[id]=resolve;}),invalidate:()=>window.invalidations++}});
 });
 await page.evaluate(()=>view.refresh());assert.equal(await page.locator('#list button').count(),2);
 await page.locator('[data-organization-id=a]').click();await page.locator('[data-organization-id=b]').click();
 await page.evaluate(()=>pending.b([{id:'b1',occurred_at:'2023-01-01',actor:'담당자',body:'<p>예산 확인</p><script>window.bad=1</script>'}]));
 await page.evaluate(()=>pending.a([{id:'a1',body:'늦게 도착한 다른 고객 메모'}]));
 assert.match(await page.locator('#detail').innerText(),/예산 확인/);assert.match(await page.locator('#detail').innerText(),/2023-01-01/);assert.doesNotMatch(await page.locator('#detail').innerText(),/늦게 도착|<p>|script/);assert.equal(await page.evaluate(()=>!!window.bad),false);
 await page.locator('[data-organization-id=a]').click();await page.evaluate(()=>view.clear());await page.evaluate(()=>pending.a([{id:'stale',body:'로그아웃 뒤 메모'}]));
 assert.equal(await page.locator('#detail').innerText(),'');assert.equal(await page.locator('#list').innerText(),'');
 await page.evaluate(()=>{window.fail=true;return view.refresh();});assert.match(await page.locator('[role=alert]').innerText(),/실패/);
 console.log('PASS: same-name separate rows, original 2023 date, safe rich-text display, stale selection/session responses discarded, errors visible. Mock browser only.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
