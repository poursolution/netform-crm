'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const candidate=path.resolve(__dirname,'..'),baseline=require('./review-environment.cjs').baseline,raw=JSON.parse(fs.readFileSync(require('./review-environment.cjs').fixture('guide42-screens.json'),'utf8'));
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 try{
  const page=await browser.newPage();await page.route('**/*',route=>route.abort());await page.setContent('<div id="review"></div>');
  for(const name of ['list-pager.js','mobile-approved-gj-source.js','mobile-approved-gj.js'])await page.addScriptTag({path:path.join(fs.existsSync(path.join(candidate,name))?candidate:baseline,name)});
  const result=await page.evaluate(originals=>{
   const source={};for(const key of ['G','J-2']){const box=document.createElement('div');box.innerHTML=MobileApprovedGJSource[key];source[key]=box.firstElementChild;}
   const gRows=[...source.G.children[2].children].slice(1,-1),jRows=[...source['J-2'].children[1].children].slice(3,7);
   const modelG={candidates:gRows.map((row,i)=>({id:'evidence-'+i,meta:row.children[0].textContent,text:row.children[1].textContent,documents:i?[]:['document-v1'],recipient:i?'':'recipient-snapshot',sentAt:i?'':'2026-06-02T09:00:00+09:00'})),selectedId:'evidence-0',canContinue:true};
   const sheet=source['J-2'].children[1],modelJ={title:sheet.children[1].textContent,subtitle:sheet.children[2].textContent,fields:jRows.map((row,i)=>({id:'field-'+i,label:row.children[0].textContent,value:row.children[1].textContent,state:i===2?'missing':i===3?'derived':'present'})),reason:sheet.children[7].textContent};
   const checks=[],container=document.getElementById('review'),styles=node=>[node,...node.querySelectorAll('*')].map(n=>n.getAttribute('style'));
   const expectedText=node=>[node,...node.querySelectorAll('*')].filter(n=>!n.children.length).map(n=>n.textContent);
   for(const key of ['G','J-2']){
    container.innerHTML=key==='G'?MobileApprovedGJ.renderG(modelG):MobileApprovedGJ.renderJ2(modelJ);
    const actual=container.firstElementChild,expected=expectedText(source[key]);if(key==='G')expected[expected.indexOf('"견적 메일로 보냈습니다"')+1]='참고';
    checks.push({key,rawExact:MobileApprovedGJSource[key]===originals[key],sourceStyles:styles(source[key]),actualStyles:styles(actual),expectedText:expected,actualText:expectedText(actual),nodes:actual.querySelectorAll('*').length+1,inputs:actual.querySelectorAll('input,select,textarea').length,handlers:actual.querySelectorAll('[onclick],[onchange],[oninput]').length,rootClass:actual.className,bodyClass:actual.querySelector('.approved-gj-body')?.className});
   }
   container.innerHTML=MobileApprovedGJ.renderG(modelG);
   const selection={email:container.querySelector('[data-gs="g-evidence"]')?.dataset.id,emailPressed:container.querySelector('[data-gs="g-evidence"]')?.getAttribute('aria-pressed'),chatAction:container.querySelector('[data-gs="g-reference"]')?.textContent,chatDisabled:container.querySelector('[data-gs="g-reference"]')?.getAttribute('aria-disabled'),nextEnabled:container.querySelector('[data-gs="g-next"]').getAttribute('aria-disabled')!=='true'};
   const complete=modelG.candidates[0],variants=[{...complete,documents:[]},{...complete,recipient:''},{...complete,sentAt:''},{...complete,sentAt:'not-a-date'},{...complete,sentAt:'2026-02-30'},{...complete,sentAt:'1'},{...complete,canSelect:false},{...complete,canSelect:'false'},{...complete,id:''}];
   const invalidStates=variants.map(candidate=>{container.innerHTML=MobileApprovedGJ.renderG({candidates:[candidate],selectedId:candidate.id,canContinue:true});return {state:MobileApprovedGJ.evidenceState(candidate),enabledCandidate:container.querySelectorAll('[data-gs="g-evidence"]:not([aria-disabled="true"])').length,nextDisabled:container.querySelector('[data-gs="g-next"]').getAttribute('aria-disabled')};});
   container.innerHTML=MobileApprovedGJ.renderG({candidates:[complete],canContinue:true});const implicitNext=container.querySelector('[data-gs="g-next"]').getAttribute('aria-disabled');
   container.innerHTML=MobileApprovedGJ.renderG({...modelG,canContinue:false});const callerBlock=container.querySelector('[data-gs="g-next"]').getAttribute('aria-disabled');
   container.innerHTML=MobileApprovedGJ.renderJ2({...modelJ,canTransition:true});const stageDisabled=container.querySelector('[data-gs="j2-transition"]').getAttribute('aria-disabled'),fieldActions=[...container.querySelectorAll('[data-gs="j2-field"]')].map(n=>({id:n.dataset.field,state:n.dataset.state}));
   container.innerHTML=MobileApprovedGJ.renderJ2({...modelJ,title:'<img src=x onerror=alert(1)>',fields:[{id:'<script>',label:'<img src=x>',value:'<script>bad()</script>',state:'missing'}],reason:'<img src=x>'});
   const unsafeJ2=container.querySelectorAll('img,script').length;
   container.innerHTML=MobileApprovedGJ.renderG({...modelG,candidates:[{...complete,id:'<script>',meta:'<img src=x>',text:'<script>bad()</script>'}],note:'<img src=x>'});const unsafeG=container.querySelectorAll('img,script').length;
   let gLimit=false,jLimit=false,badState=false;try{MobileApprovedGJ.renderG({candidates:Array.from({length:21},()=>complete)});}catch(e){gLimit=e.message==='APPROVED_EVIDENCE_PAGE_EXCEEDS_20';}
   try{MobileApprovedGJ.renderJ2({fields:Array.from({length:21},()=>modelJ.fields[0])});}catch(e){jLimit=e.message==='APPROVED_STAGE_FIELD_PAGE_EXCEEDS_20';}
   try{MobileApprovedGJ.renderJ2({fields:[{...modelJ.fields[0],state:'guessed'}]});}catch(e){badState=e.message==='APPROVED_STAGE_FIELD_STATE_REQUIRED';}
   const pg=ListPager.cut(Array.from({length:21},(_,i)=>({...complete,id:'evidence-'+i})),1);container.innerHTML=MobileApprovedGJ.renderG({candidates:pg.rows,pager:ListPager.html(pg,{ns:'evidence',unit:'건'})});const paging={rows:container.querySelectorAll('.approved-g-evidence').length,page2:!!container.querySelector('[data-evidence="page"][data-page="2"]')};
   let writes=0;window.queueMobileContactOperation=()=>{writes++;throw Error('NO_WRITES');};container.querySelectorAll('[data-gs]').forEach(node=>node.click());
   const original=MobileApprovedGJSource;window.MobileApprovedGJSource={};let missingSource=false;try{MobileApprovedGJ.renderG({});}catch(e){missingSource=e.message==='APPROVED_GJ_SOURCE_MISSING';}window.MobileApprovedGJSource=original;
   return {checks,selection,invalidStates,implicitNext,callerBlock,stageDisabled,fieldActions,unsafeJ2,unsafeG,gLimit,jLimit,badState,paging,writes,missingSource};
  },Object.fromEntries(['G','J-2'].map(id=>[id,raw.find(row=>row.id===id).html])));
  for(const screen of result.checks){assert.equal(screen.rawExact,true);assert.deepEqual(screen.actualStyles,screen.sourceStyles);assert.deepEqual(screen.actualText,screen.expectedText);assert.equal(screen.inputs,0);assert.equal(screen.handlers,0);assert.match(screen.rootClass,/approved-gj/);assert.equal(screen.bodyClass,'approved-gj-body');}
  assert.deepEqual(result.selection,{email:'evidence-0',emailPressed:'true',chatAction:'참고',chatDisabled:'true',nextEnabled:true});
  assert(result.invalidStates.every(item=>item.state.selectable===false&&item.enabledCandidate===0&&item.nextDisabled==='true'));
  assert.equal(result.implicitNext,'true');assert.equal(result.callerBlock,'true');assert.equal(result.stageDisabled,'true');assert.deepEqual(result.fieldActions,[{id:'field-0',state:'present'},{id:'field-1',state:'present'},{id:'field-2',state:'missing'}]);
  assert.equal(result.unsafeJ2+result.unsafeG,0);assert.equal(result.gLimit,true);assert.equal(result.jLimit,true);assert.equal(result.badState,true);assert.deepEqual(result.paging,{rows:20,page2:true});assert.equal(result.writes,0);assert.equal(result.missingSource,true);
  const report={at:new Date().toISOString(),passed:9,checks:['G and J-2 raw source strings match guide42 verbatim','Every source inline style retained without added form fields or inline handlers','Guide43 section20 changes incomplete chat evidence from selection to disabled reference','Document/recipient/valid date and caller eligibility required before explicit evidence selection','Next requires explicit selected evidence and caller permission; no implicit completion','J-2 binds only caller-supplied PC field states and keeps the original transition disabled','Text bindings cannot create injected HTML','20-row limit and existing ListPager navigation retained','Missing approved source fails closed; renderer does not call persistence'],sourceNodes:result.checks.map(item=>({screen:item.key,nodes:item.nodes})),referenceDiscrepancy:'G original step labels use 11.5px; guide43 section20 says minimum12px. Original styles preserved as instructed; needs design-source resolution.',boundary:'Pure source/model/DOM tests only; evidence lookup, persistence, PC transition validation and follow-up deduplication are not implemented in these renderers.'};
  fs.writeFileSync(path.join(__dirname,'approved-gj-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
