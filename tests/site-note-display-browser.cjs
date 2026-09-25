const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage();
  const src=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
  await page.addScriptTag({content:src.split(/\r?\n/).filter(x=>x.startsWith('function siteNoteDisplayText(')||x.startsWith('function siteActivityTitle(')).join('\n')});
  const result=await page.evaluate(()=>({
   html:siteNoteDisplayText('<p>첫 기록 &amp; 확인</p><p><strong>다음 기록</strong><br>재통화</p>'),
   unsafe:siteNoteDisplayText('<script>window.bad=1</script><img src=x onerror="window.bad=1"><p>내용</p>'),
   plain:siteNoteDisplayText('금액 < 100 · 미정'),label:siteActivityTitle('next_action_set'),executed:!!window.bad
  }));
  assert.equal(result.html,'첫 기록 & 확인\n다음 기록\n재통화');
  assert.equal(result.unsafe,'내용');assert.equal(result.executed,false);
  assert.equal(result.plain,'금액 < 100 · 미정');assert.equal(result.label,'다음 할 일 등록');
  console.log('PASS: inert rich-text conversion, plain text, Korean label; no source data writes');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
