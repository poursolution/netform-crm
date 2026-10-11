'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 try{
  const page=await browser.newPage({viewport:{width:480,height:812}});await page.route('**/*',r=>r.abort());await page.setContent('<div id="review"></div>');
  for(const name of ['mobile-approved-j1-source.js','mobile-approved-j1.js','mobile-stage-confirmation-model.js'])await page.addScriptTag({path:path.join(root,name)});
  const result=await page.evaluate(()=>{
   let writes=0,legacyReads=0;window.pushWrite=()=>{writes++;throw Error('Writes forbidden');};window.stageGuideAutoM=()=>{legacyReads++;throw Error('Legacy completion forbidden');};
   const original=document.createElement('div');original.innerHTML=MobileApprovedJ1Source;const frame=original.firstElementChild,body=frame.children[1],checkBox=body.children[2],id='11111111-1111-4111-8111-111111111111';
   const model={dealId:id,name:body.children[0].textContent,task:body.children[1].children[1].textContent,actionLabel:body.children[1].children[2].textContent,context:checkBox.children[0].lastElementChild.textContent,checks:[...checkBox.children].slice(1).map((row,i)=>({label:row.children[1].children[0].textContent,detail:row.children[1].children[1].textContent,verified:i===0,confirmedAt:i===0?'2026-09-30':'',evidence:i===0?{kind:'activity',id}:undefined}))};
   const review=document.getElementById('review');review.innerHTML=MobileApprovedJ1.render(model);const actual=review.firstElementChild;
   const styles=node=>[node,...node.querySelectorAll('*')].map(n=>n.getAttribute('style'));
   const out={expectedStyles:styles(frame),actualStyles:styles(actual),expectedText:frame.textContent.replace(/\s+/g,' '),actualText:actual.textContent.replace(/\s+/g,' '),evidenceLinks:review.querySelectorAll('[data-gs="stage-confirmation-evidence"]').length,evidenceId:review.querySelector('[data-gs="stage-confirmation-evidence"]').dataset.evidenceId,confirmedAt:review.querySelector('[data-gs="stage-confirmation-evidence"]').dataset.confirmedAt,back:review.querySelector('[data-gs="stage-confirmation-back"]')!==null};
   const malformed=[{verified:true},{verified:true,confirmedAt:'2026-09-30'},{verified:true,confirmedAt:'2026-02-30',evidence:{kind:'activity',id}},{verified:true,confirmedAt:'2026-09-30',evidence:{kind:'memo-keyword',id}}];
   out.rejectedUnproven=malformed.every(x=>!MobileApprovedJ1.evidenceValid(x));
   review.innerHTML=MobileApprovedJ1.render({...model,checks:malformed});out.maxRows=review.querySelectorAll('[data-confirmed]').length;out.unprovenCompleted=review.querySelectorAll('[data-confirmed="true"]').length;
   const live=MobileStageConfirmationModel.read({id,nm:'[테스트] 현장',stage_checklist:{consulting:{0:true}},activities:[{id,note:'견적 발송 자료 도면 확인 회의 확인',at:'2026-09-30'}],nextAction:{status:'open',text:'현장 확인'}});
   out.liveAvailable=live.available;out.liveChecks=live.checks;out.liveTask=live.task;out.legacyReads=legacyReads;
   review.innerHTML=MobileApprovedJ1.render({...live,name:'<img src=x onerror=alert(1)>'});out.injectedImages=review.querySelectorAll('img').length;out.inputCount=review.querySelectorAll('input,textarea,select').length;
   review.querySelector('[data-gs="pending-task"]').click();out.writes=writes;return out;
  });
  assert.deepEqual(result.actualStyles,result.expectedStyles);assert.equal(result.actualText,result.expectedText);assert.equal(result.back,true);
  assert.equal(result.evidenceLinks,1);assert.equal(result.evidenceId,'11111111-1111-4111-8111-111111111111');assert.equal(result.confirmedAt,'2026-09-30');
  assert.equal(result.rejectedUnproven,true);assert.equal(result.maxRows,3);assert.equal(result.unprovenCompleted,0);assert.equal(result.liveAvailable,false);assert.deepEqual(result.liveChecks,[]);assert.equal(result.liveTask,'현장 확인');assert.equal(result.legacyReads,0);assert.equal(result.injectedImages,0);assert.equal(result.inputCount,0);assert.equal(result.writes,0);
  const report={at:new Date().toISOString(),passed:8,checks:['Exact guide42 J-1 inline style declarations retained','Original example text preserved through binding','Confirmed row links explicit activity id and confirmation date','No evidence/date/validity means no completed styling','At most three questions and no read-check input','Live checkbox/keyword data does not invent confirmed questions','Dynamic text is escaped','Renderer never writes or auto-completes'],boundary:'Synthetic renderer/read-boundary checks. Existing stage_check booleans do not supply the shared evidence-backed situation checklist required by guide43 §15/20.'};
  fs.writeFileSync(path.join(__dirname,'approved-j1-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
