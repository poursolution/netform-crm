'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),server=require('./server.cjs');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await page.goto(origin+'/mobile.html?demo=1&screen=A');
  await page.addScriptTag({url:origin+'/mobile-approved-ej-source.js'});await page.addScriptTag({url:origin+'/mobile-approved-ej.js'});
  const result=await page.evaluate(()=>{
   const site='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
   const models={E:{query:'수원 영통벽산',similarCount:1,similarReason:'같은 주소 현장'},'J-4':{selectedId:site,query:'매탄임광 · 수원 영통구 매탄동',similarLabel:'비슷한 현장 1곳 · 같은 주소',rows:[{id:site,name:'[수원] 매탄임광아파트',subtitle:'외벽 재도장 · 관계관리 · 김성민 · 옥상 실주 2025',owner:'김성민'}]}};
   const out=[];for(const key of ['E','J-4']){
    const source=document.createElement('div'),bound=document.createElement('div');source.innerHTML=MobileApprovedEJSource[key];bound.innerHTML=key==='E'?MobileApprovedEJ.renderE(models[key]):MobileApprovedEJ.renderJ4(models[key]);
    const aa=[...source.querySelectorAll('*')],bb=[...bound.querySelectorAll('*')],differences=[];
    aa.forEach((a,i)=>{const b=bb[i];if(!b){differences.push({i,missing:true});return;}for(const prop of new Set([...a.style,...b.style]))if(a.style.getPropertyValue(prop)!==b.style.getPropertyValue(prop))differences.push({i,prop,source:a.style.getPropertyValue(prop),actual:b.style.getPropertyValue(prop)});});
    const sourceLeaves=aa.filter(n=>!n.children.length).map(n=>n.textContent),actualLeaves=bb.filter(n=>!n.children.length).map(n=>n.tagName==='INPUT'?n.value:n.textContent);
    out.push({key,nodes:aa.length,boundNodes:bb.length,differences,sourceLeaves,actualLeaves,input:{type:bound.querySelector('input').type,required:bound.querySelector('input').required,maxLength:bound.querySelector('input').maxLength,ariaLabel:bound.querySelector('input').getAttribute('aria-label')},actions:[...bound.querySelectorAll('[data-gs]')].map(n=>({action:n.dataset.gs,entry:n.dataset.entry,id:n.dataset.id})),inlineHandlers:bound.querySelectorAll('[onclick],[onchange],[oninput]').length});
   }
   const unsafe=document.createElement('div');unsafe.innerHTML=MobileApprovedEJ.renderJ4({query:'<img src=x onerror=alert(1)>',rows:[{id:site,name:'<script>bad()</script>',subtitle:'<img src=x>',owner:'<img src=x>'}]});
   let capped=false;try{MobileApprovedEJ.renderJ4({rows:Array.from({length:21},()=>({id:site}))});}catch(e){capped=e.message==='APPROVED_REGISTRATION_PAGE_EXCEEDS_20';}
   const multi=document.createElement('div');multi.innerHTML=MobileApprovedEJ.renderJ4({query:'같은 이름',rows:[{id:site,name:'같은 이름'},{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'같은 이름'}]});
   const primary=multi.querySelectorAll('[data-gs="j4-existing"]')[2];
   return {screens:out,untrustedTextCreatesMarkup:unsafe.querySelectorAll('img,script').length,capped,multiSelection:{id:primary.dataset.id,disabled:primary.getAttribute('aria-disabled')},scope:'original E/J-4 renderer only; pure model-to-DOM; route and create API integration not asserted'};
  });
  for(const s of result.screens){assert.equal(s.nodes,s.boundNodes);assert.deepEqual(s.differences,[]);assert.deepEqual(s.actualLeaves,s.sourceLeaves);assert.equal(s.inlineHandlers,0);assert.equal(s.input.type,'text');assert.equal(s.input.required,true);assert.equal(s.input.maxLength,s.key==='E'?300:1000);}
  assert.equal(result.untrustedTextCreatesMarkup,0);assert.equal(result.capped,true);assert.deepEqual(result.multiSelection,{id:'',disabled:'true'});
  assert.deepEqual(result.screens[0].actions.slice(0,4).map(x=>[x.action,x.entry]),[['e-activity',undefined],['e-newsite','start'],['e-card','materials'],['e-card','schedule']]);
  fs.writeFileSync(path.join(__dirname,'approved-ej-verification.json'),JSON.stringify({at:new Date().toISOString(),...result},null,2));
  console.log(JSON.stringify({screens:result.screens.map(x=>({key:x.key,nodes:x.nodes,styleDifferences:x.differences.length,exactExampleText:true})),safeText:true,pagingLimit:20,multipleCandidatesRequireSelection:true,scope:result.scope},null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
