'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const candidate=path.resolve(__dirname,'..'),baseline=require('./review-environment.cjs').baseline;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 try{
  const page=await browser.newPage({viewport:{width:480,height:812}});await page.route('**/*',r=>r.abort());await page.setContent('<div id="review"></div>');
  for(const file of [path.join(baseline,'list-pager.js'),path.join(candidate,'mobile-approved-h-source.js'),path.join(candidate,'mobile-approved-h.js')])await page.addScriptTag({path:file});
  const evidence=await page.evaluate(()=>{
   let writes=0;window.queueMobileContactOperation=()=>{writes++;throw Error('No writes allowed');};
   const box=document.createElement('div');box.innerHTML=MobileApprovedHSource;const original=box.firstElementChild;
   const groups=[...original.children[1].children].map(card=>({count:Number(card.children[0].lastElementChild.textContent),rows:[...card.children].slice(1).map(row=>({text:row.textContent}))}));
   const model={dateLabel:'10.10',done:groups[0],open:groups[1],tomorrow:groups[2],canClose:false};
   const review=document.getElementById('review');review.innerHTML=MobileApprovedH.render(model);const actual=review.firstElementChild;
   const styles=node=>[node,...node.querySelectorAll('*')].map(n=>n.getAttribute('style'));
   const result={originalStyles:styles(original),actualStyles:styles(actual),originalText:original.textContent.replace(/\s+/g,' '),actualText:actual.textContent.replace(/\s+/g,' '),originalInputs:original.querySelectorAll('input,select,textarea').length,actualInputs:actual.querySelectorAll('input,select,textarea').length,back:actual.children[0].children[0].dataset.gs,backTab:actual.children[0].children[0].dataset.tab,saveAction:actual.children[2].children[0].dataset.gs};
   const live=MobileDayCloseModel.read();review.innerHTML=MobileApprovedH.render(live);result.liveCounts=[...review.querySelectorAll('.approved-h>div:nth-child(2)>div')].map(n=>n.firstElementChild.lastElementChild.textContent);result.liveCloseDisabled=review.querySelector('[data-gs="day-close"]').getAttribute('aria-disabled');result.liveCloseReason=review.querySelector('[data-gs="day-close"]').title;
   const rows=Array.from({length:25},(_,i)=>({key:'task:'+i,dealId:'11111111-1111-4111-8111-111111111111',text:'업무 '+i}));
   review.innerHTML=MobileApprovedH.render({...model,done:{count:25,rows,page:1}});result.firstPageRows=review.querySelectorAll('[data-task-key]').length;result.pager=!!review.querySelector('[data-gs="day-close-page"][data-group="done"][data-page="2"]');result.targetAction=review.querySelector('[data-task-key]')?.dataset.gs;result.targetId=review.querySelector('[data-task-key]')?.dataset.id;
   review.innerHTML=MobileApprovedH.render({...model,done:{count:25,rows,page:2}});result.secondPageRows=review.querySelectorAll('[data-task-key]').length;result.secondPageFirst=review.querySelector('[data-task-key]')?.textContent;
   review.querySelector('[data-gs="day-close"]').click();result.writes=writes;return result;
  });
  assert.deepEqual(evidence.actualStyles,evidence.originalStyles);assert.equal(evidence.actualText,evidence.originalText);assert.equal(evidence.originalInputs,0);assert.equal(evidence.actualInputs,0);
  assert.equal(evidence.back,'tab');assert.equal(evidence.backTab,'today');assert.equal(evidence.saveAction,'day-close');
  assert.deepEqual(evidence.liveCounts,['확인 필요','확인 필요','확인 필요']);assert.equal(evidence.liveCloseDisabled,'true');assert.match(evidence.liveCloseReason,/마감 저장 연결/);
  assert.equal(evidence.firstPageRows,20);assert.equal(evidence.secondPageRows,5);assert.equal(evidence.secondPageFirst,'업무 20');assert.equal(evidence.pager,true);assert.equal(evidence.targetAction,'deal');assert.equal(evidence.targetId,'11111111-1111-4111-8111-111111111111');assert.equal(evidence.writes,0);
  const report={at:new Date().toISOString(),passed:7,checks:['Exact guide42 H inline declarations retained','Original example text retained through model binding','Original H has no reason/date fields; no fields added','Back/action data bindings only','Unavailable live completion/closing data remains unknown and disabled','Common pager caps each list at20; authorized row target is retained','Renderer does not save, complete, reschedule or share'],boundary:'Source/model synthetic checks only. No live task-completion projection, day-close write or share-delivery contract exists in this renderer.'};
  fs.writeFileSync(path.join(__dirname,'approved-h-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
