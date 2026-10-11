const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch(require('./review-environment.cjs').launchOptions());
 try{
 const p=await b.newPage({viewport:{width:600,height:850}});await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/mobile.html?demo=1&screen=A');await p.locator('.approved-a').waitFor();await p.evaluate(()=>document.fonts.ready);
 const capture=async name=>p.locator('.approved-a').screenshot({path:path.join(__dirname,name)});
 await capture('approved-a-implemented.png');
 const source=await p.evaluate(()=>MobileApprovedASource);
 const actual=await p.locator('.approved-a').evaluate(el=>[...el.querySelectorAll('*')].map(n=>({tag:n.tagName,style:n.getAttribute('style'),text:n.childElementCount?null:n.textContent}))); 
 await p.evaluate(html=>{const el=document.createElement('div');el.innerHTML=html;const expected=el.firstElementChild;expected.id='a-reference';expected.style.fontFamily='ClaudeMobilePretendard';expected.style.letterSpacing='normal';document.body.append(expected);},source);
 const expected=await p.locator('#a-reference').evaluate(el=>[...el.querySelectorAll('*')].map(n=>({tag:n.tagName,style:n.getAttribute('style'),text:n.childElementCount?null:n.textContent})));
 // Normalized inline style is compared semantically; binding must not redesign any node.
 assert.equal(actual.length,expected.length);
 const differences=await p.evaluate(()=>{
  const aa=[...document.querySelector('.approved-a').querySelectorAll('*')],bb=[...document.querySelector('#a-reference').querySelectorAll('*')];
  return aa.flatMap((n,i)=>{const other=bb[i];const keys=[...new Set([...n.style,...other.style])];return keys.filter(k=>n.style.getPropertyValue(k)!==other.style.getPropertyValue(k)).map(k=>({i,k,actual:n.style.getPropertyValue(k),expected:other.style.getPropertyValue(k)}));});
 });
 assert.deepEqual(differences,[]);
 assert.deepEqual(actual.map(n=>n.text),expected.map(n=>n.text));
 await p.evaluate(()=>document.querySelector('#a-reference').remove());
 await p.locator('.approved-a [data-gs="tab"][data-tab="mine"]').click();await p.locator('.gs-row').first().click();await p.locator('[data-gs="contact"]').click();await p.locator('.ce-page .cd-back').click();
 assert(await p.locator('.gs-now').isVisible());assert.equal(await p.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip').count(),0);
 await p.locator('[data-gs="back"]').click();assert(await p.locator('.gs-list').isVisible());
 assert.deepEqual(errors,[]);
 const out={at:new Date().toISOString(),source:'user selected 8766/?screen=A, guide42-screens.json A',inlineStyleDifferences:differences,exactExampleText:true,routing:'A → B → C → D → C → B, no legacy listing/detail',boundary:'synthetic example and local candidate only; other tabs/data bindings incomplete'};
 fs.writeFileSync(path.join(__dirname,'approved-a-verification.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
 }finally{await b.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
