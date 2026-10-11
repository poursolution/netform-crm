'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const candidate=path.resolve(__dirname,'..'),raw=fs.readFileSync(require('./review-environment.cjs').fixture('quote-mobile44-frames.html'),'utf8');
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 try{
  const page=await browser.newPage();await page.route('**/*',route=>route.abort());await page.setContent('<div id="review"></div>');
  for(const file of ['mobile-approved-quote-source.js','mobile-approved-quote.js'])await page.addScriptTag({path:path.join(candidate,file)});
  const result=await page.evaluate(raw=>{
   const original=document.createElement('div');original.innerHTML=raw;
   const frames=[...original.querySelectorAll('div')].filter(node=>node.style.width==='375px'&&node.style.height==='760px'),source=Object.fromEntries(frames.map((frame,i)=>['K-'+(i+1),frame]));
   const card=node=>({title:node.children[0].children[0].textContent,tag:node.children[0].children[1].textContent,detail:node.children[1].textContent});
   const rows=node=>[...node.children].map((row,i)=>({id:'row-'+i,label:row.children[0].textContent,value:row.children[1].textContent}));
   const chips=node=>[...node.children].map((chip,i)=>({id:'chip-'+i,label:chip.textContent,selected:chip.style.background==='rgb(21, 23, 28)'}));
   const models={};for(const [screen,frame] of Object.entries(source)){
    const [head,context,b,footer]=frame.children,model={title:head.lastElementChild.textContent,context:context.textContent,preview:footer.firstElementChild.textContent};
    if(screen==='K-1')Object.assign(model,{inherited:card(b.children[1]),inheritedHint:b.children[0].lastElementChild.textContent,works:chips(b.children[3]),quantities:rows(b.children[5]),dates:chips(b.children[7])});
    if(screen==='K-2')Object.assign(model,{steps:[...b.children[0].children].map(row=>({title:row.children[1].children[0].textContent,detail:row.children[1].children[1].textContent,state:row.children[0].children[0].style.background==='rgb(21, 23, 28)'?2:row.children[0].children[0].style.borderColor==='rgb(59, 108, 228)'?1:0})),conflict:b.children[1].textContent,adjustment:card(b.children[2]),question:card(b.children[4])});
    if(screen==='K-3')Object.assign(model,{quote:card(b.children[0]),amountRows:rows(b.children[1]),pdf:{...card(b.children[2]),id:'fixture-pdf'},note:b.children[3].textContent});
    if(screen==='K-4')Object.assign(model,{quote:card(b.children[0]),options:chips(b.children[2]).map((chip,i)=>({...chip,value:rows(b.children[3])[i].value})),note:b.children[4].textContent});
    if(screen==='K-5')Object.assign(model,{dispatch:card(b.children[0]),next:card(b.children[1]),versions:rows(b.children[3]).map((row,i)=>({...row,replaced:i===1})),note:b.children[4].textContent});
    models[screen]=model;
   }
   const container=document.getElementById('review'),styles=node=>[node,...node.querySelectorAll('*')].map(n=>n.getAttribute('style'));
   const leaves=node=>[node,...node.querySelectorAll('*')].filter(n=>!n.children.length).map(n=>n.tagName==='INPUT'?n.value:n.textContent),comparison=[];
   for(const [screen,model] of Object.entries(models)){
    container.innerHTML=MobileApprovedQuote.render(screen,model);const actual=container.firstElementChild,expected=leaves(source[screen]);if(screen==='K-3')expected[expected.indexOf('견적 금액')]='적산 기준금액';
    comparison.push({screen,rawExact:MobileApprovedQuoteSource[screen]===source[screen].outerHTML,nodes:actual.querySelectorAll('*').length+1,sourceStyles:styles(source[screen]),actualStyles:styles(actual),expectedText:expected,actualText:leaves(actual),handlers:actual.querySelectorAll('[onclick],[onchange],[oninput]').length,frame:actual.className,body:!!actual.querySelector('.approved-quote-body')});
   }
   container.innerHTML=MobileApprovedQuote.renderK1({...models['K-1'],canEdit:true,quantities:models['K-1'].quantities.map(item=>({...item,editable:true}))});
   const inputs=[...container.querySelectorAll('input')].map(input=>({id:input.dataset.id,type:input.type,value:input.value,style:input.getAttribute('style'),max:input.maxLength,aria:input.getAttribute('aria-label')}));
   const sourceQuantityStyles=[...source['K-1'].children[2].children[5].children].map(row=>row.children[1].getAttribute('style'));
   container.innerHTML=MobileApprovedQuote.renderK4({...models['K-4'],options:models['K-4'].options.map(item=>({...item,selected:false})),optionsEnabled:true});
   const options=[...container.querySelectorAll('[data-gs="quote-option"]')].map(node=>({selected:node.getAttribute('aria-pressed'),disabled:node.getAttribute('aria-disabled'),background:node.style.background}));
   const literalAmounts=[...container.querySelectorAll('.approved-quote-row')].map(row=>row.children[1].textContent);
   container.innerHTML=MobileApprovedQuote.renderK2(models['K-2']);const adjustmentText=container.querySelector('.approved-quote-body').children[2].textContent,adjustmentControls=container.querySelector('.approved-quote-body').children[2].querySelectorAll('[data-gs],input').length;
   container.innerHTML=MobileApprovedQuote.renderK5({...models['K-5'],versions:models['K-5'].versions.map(row=>({...row,enabled:true}))});const history=[...container.querySelectorAll('[data-gs="quote-version"]')].map(node=>({id:node.dataset.id,text:node.textContent}));
   const blockedActions=[];for(const [screen,model] of Object.entries(models)){container.innerHTML=MobileApprovedQuote.render(screen,model);container.querySelectorAll('.approved-quote-footer [data-gs]').forEach(node=>blockedActions.push({screen,action:node.dataset.gs,disabled:node.getAttribute('aria-disabled')}));}
   container.innerHTML=MobileApprovedQuote.renderK3({...models['K-3'],context:'<img src=x>',quote:{title:'<script>bad()</script>',detail:'<img src=x>',tag:'<img src=x>'},amountRows:[{label:'fake customer price',value:'<img src=x>'}],pdf:{title:'<img>',detail:'<script>',tag:'<b>'},note:'<img src=x>',preview:'<script>'});const unsafe=container.querySelectorAll('img,script').length;
   let capped=false;try{MobileApprovedQuote.renderK5({...models['K-5'],versions:Array.from({length:21},()=>({label:'a',value:'b'}))});}catch(error){capped=error.message==='APPROVED_QUOTE_PAGE_EXCEEDS_20';}
   const empty=[];for(const screen of Object.keys(models)){container.innerHTML=MobileApprovedQuote.render(screen,{});empty.push({screen,text:container.textContent});}
   let writes=0;window.queueMobileContactOperation=()=>{writes++;};container.querySelectorAll('[data-gs]').forEach(node=>node.click());
   return {models,comparison,inputs,sourceQuantityStyles,options,literalAmounts,adjustmentText,adjustmentControls,history,blockedActions,unsafe,capped,empty,writes};
  },raw);
  for(const screen of result.comparison){assert.equal(screen.rawExact,true);assert.deepEqual(screen.actualStyles,screen.sourceStyles,screen.screen+' style difference');assert.deepEqual(screen.actualText,screen.expectedText,screen.screen+' text difference');assert.equal(screen.handlers,0);assert.match(screen.frame,/approved-quote/);assert.equal(screen.body,true);}
  assert.equal(result.inputs.length,2);assert.deepEqual(result.inputs.map(input=>input.style),result.sourceQuantityStyles);assert(result.inputs.every(input=>input.type==='text'&&input.max===120&&input.aria.includes('대략 수량')));
  assert(result.options.every(option=>option.selected==='false'&&option.disabled!=='true'&&option.background==='rgb(255, 255, 255)'));assert.deepEqual(result.literalAmounts,['6,800만 · VAT 별도','9,400만 · VAT 별도']);
  assert.match(result.adjustmentText,/답 기다림/);assert.equal(result.adjustmentControls,0);assert.equal(result.history.length,2);assert.match(result.history[1].text,/대체됨/);
  assert(result.blockedActions.every(action=>action.disabled==='true'));assert.equal(result.unsafe,0);assert.equal(result.capped,true);assert.equal(result.writes,0);assert(result.empty.every(row=>!/매탄임광|2억|9,400만|V2|10\.16/.test(row.text)));
  const report={at:new Date().toISOString(),passed:9,checks:['Five source44 rendered frames retain all original inline styles and node counts','Only approved K3 amount label changes to 적산 기준금액','K1 editable controls replace original quantity cells only and preserve their inline style','K2 pending adjustment does not become an approval or deadline change','K4 option selection is explicit and supplied amounts are never summed','K5 replaced versions remain view-only history; no save/send actions run','Every save/send/footer action is disabled without explicit caller permission','Bound strings cannot inject markup and lists require caller pagination above20','Absent model values do not expose fixed customer/version/amount examples'],sourceNodes:result.comparison.map(screen=>({screen:screen.screen,nodes:screen.nodes})),boundary:'Only original K1-K5 renderers. No nine-screen extrapolation, server calculation, quote creation, approval, dispatch, response or schedule writes.'};
  fs.writeFileSync(path.join(__dirname,'quote-original-fixtures.json'),JSON.stringify(result.models,null,2));fs.writeFileSync(path.join(__dirname,'approved-quote-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
