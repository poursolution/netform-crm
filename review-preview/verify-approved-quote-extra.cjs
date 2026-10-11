'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),design=require('./review-environment.cjs').fixture('quote-v3-44-frames.html');
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[];
 try{
  const page=await browser.newPage({viewport:{width:480,height:812}});await page.route('**/*',r=>r.abort());
  await page.setContent(fs.readFileSync(design,'utf8'));
  const original=await page.locator('div[style]').evaluateAll(es=>es.filter(e=>e.getAttribute('style').includes('width:375px')&&e.getAttribute('style').includes('border:8px solid #15171c')).map(e=>e.outerHTML));
  assert.equal(original.length,4);await page.setContent('<div id="review"></div>');
  for(const f of ['mobile-approved-quote-extra-source.js','mobile-approved-quote-extra.js'])await page.addScriptTag({path:path.join(root,f)});
  const output=await page.evaluate(original=>{
   let writes=0;window.fetch=()=>{writes++;throw Error('No network');};window.pushWrite=()=>{writes++;throw Error('No writes');};
   const result=[],kinds=['simple','standards','method','markup'],review=document.getElementById('review');
   const signature=e=>[e,...e.querySelectorAll('*')].map(n=>({tag:n.tagName,style:n.getAttribute('style')}));
   for(let i=0;i<4;i++){
    const kind=kinds[i],raw=document.createElement('div');raw.innerHTML=original[i];const f=raw.firstElementChild,[head,context,body,foot]=f.children;
    const model={title:head.lastElementChild.textContent,context:context.textContent};
    if(kind==='markup')Object.assign(model,{type:'area',baseAmount:body.children[0].lastElementChild.textContent,area:body.children[3].lastElementChild.firstElementChild.textContent,value:body.children[4].lastElementChild.firstElementChild.textContent,additionalAmount:body.children[5].lastElementChild.textContent,submitAmount:foot.firstElementChild.lastElementChild.textContent});
    else Object.assign(model,{rows:[...body.children].map(row=>({label:row.firstElementChild.firstElementChild.textContent,value:row.firstElementChild.lastElementChild.textContent,detail:row.lastElementChild.textContent})),pre:foot.firstElementChild.textContent});
    review.innerHTML=MobileApprovedQuoteExtra.render(kind,model);const actual=review.firstElementChild;
    result.push({kind,sourceMatches:MobileApprovedQuoteExtraSource[kind]===original[i],source:signature(f),actual:signature(actual),expectedText:f.textContent.replace(/\s+/g,' '),actualText:actual.textContent.replace(/\s+/g,' '),allBlocked:[...actual.querySelectorAll('[data-gs="quote-extra-action"]')].every(e=>e.getAttribute('aria-disabled')==='true'&&e.title.length>0),inputCount:actual.querySelectorAll('input,textarea,select').length,back:actual.querySelector('[data-gs="back"]')!==null});
    [...actual.querySelectorAll('[data-gs="quote-extra-action"]')].forEach(e=>e.click());
   }
   const variants=[];
   for(const type of ['area','multiplier','flat','none','combined']){
    review.innerHTML=MobileApprovedQuoteExtra.render('markup',{type,baseAmount:'SERVER_BASE',area:'SERVER_AREA',value:'SERVER_VALUE',additionalAmount:'SERVER_MARKUP',submitAmount:'SERVER_TOTAL'});
    const frame=review.firstElementChild,body=frame.children[2];variants.push({type,rows:body.children.length,pressed:frame.querySelectorAll('[aria-pressed="true"]').length,actual:frame.textContent,inputs:frame.querySelectorAll('input,textarea,select').length});
   }
   const defaults=kinds.map(kind=>{review.innerHTML=MobileApprovedQuoteExtra.render(kind);return {kind,text:review.textContent};});
   review.innerHTML=MobileApprovedQuoteExtra.render('simple',{context:'<img src=x onerror=alert(1)>',rows:[{label:'<script>alert(1)</script>',value:'S',detail:'D'}]});
   return {result,variants,defaults,writes,injected:review.querySelectorAll('img,script').length};
  },original);
  for(const row of output.result){assert(row.sourceMatches);assert.deepEqual(row.actual,row.source,row.kind+' exact nodes/styles');assert.equal(row.actualText,row.expectedText,row.kind+' example text');assert(row.allBlocked);assert(row.back);assert.equal(row.inputCount,0);}
  checks.push('Four mobile source frames exactly match rendered approved source44; no PC frame borrowed');
  checks.push('Every source node, inline style and original example string survives field binding');
  for(const v of output.variants){assert.equal(v.pressed,v.type==='combined'?0:1);assert.equal(v.rows,{area:6,multiplier:5,flat:5,none:4,combined:6}[v.type]);assert(v.actual.includes('SERVER_BASE'));assert(v.actual.includes('SERVER_MARKUP'));assert(v.actual.includes('SERVER_TOTAL'));assert.equal(v.inputs,0);}
  checks.push('Server display strings are preserved without arithmetic; approved one-method alternatives reuse the existing row templates');
  checks.push('Combined markup has no selected method, added field or invented formula');
  for(const d of output.defaults)assert(!/170,000,000|187,000,000|179,500,000|매탄임광|동탄푸른마을|2026-0/.test(d.text),d.kind+' must not leak example data into unknown model');
  checks.push('Unknown models show confirmation-needed values instead of the source example money or customer');
  assert.equal(output.writes,0);assert.equal(output.injected,0);
  checks.push('All save/finalize/basis/type actions remain blocked with reason; dynamic text is escaped; no writes or new inputs');
  const report={at:new Date().toISOString(),passed:checks.length,checks,boundary:'Renderer-only synthetic checks. Shared quote data/calculation/permission and save contracts must be supplied by PC/server implementation. Source44 phone examples do not specify actual item/method editors or composite markup inputs. No production data, save, send or deployment.'};
  fs.writeFileSync(path.join(__dirname,'approved-quote-extra-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
