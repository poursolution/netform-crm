'use strict';
/* The original v2 visual contract has been replaced by the approved Claude A/B/C/D
 * source frames. Check those source declarations, responsive geometry, actual input
 * handoff and fail-closed legacy switches. This is not a test of an invented v2 skin.
 * Route/map behavior is covered by verify-mobile-route-browser.cjs; password,
 * admin/report/ICS entry gaps remain separately tracked;
 * their retired controls are not restored to make this visual smoke pass.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions,fixture}=require('../review-preview/review-environment.cjs');
const references=Object.fromEntries(JSON.parse(fs.readFileSync(fixture('guide42-screens.json'),'utf8')).map(row=>[row.id,row.html]));
const shot=process.argv[2]||'';
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch(launchOptions());
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul',reducedMotion:'reduce'});
  const errors=[],writes=[],external=[],checks=[];
  await context.route('**/*',route=>{
   const r=route.request();if(!['GET','HEAD'].includes(r.method())){writes.push(r.url());return route.abort();}
   if(new URL(r.url()).origin!==origin){external.push(r.url());return route.abort();}return route.continue();
  });
  await context.addInitScript(()=>{
   window.__visualSpeech={starts:0,aborts:0,instances:[]};
   class Recognition{constructor(){__visualSpeech.instances.push(this);}start(){__visualSpeech.starts++;this.onstart?.();}stop(){this.onend?.();}abort(){__visualSpeech.aborts++;}}
   window.SpeechRecognition=window.webkitSpeechRecognition=Recognition;
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  async function open(screen){
   await page.goto(origin+'/mobile.html?demo=1&review=visual&screen='+screen,{waitUntil:'domcontentloaded'});
   await page.locator('.approved-'+screen.toLowerCase()).waitFor();await page.evaluate(()=>document.fonts.ready);
  }
  async function safe(){
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.mobileApprovedView),'approved');
   assert.equal(await page.locator('#tabbar button,#scr .home-bar,#scr .mt-head,#scr .mt-list,#scr .mv-now,#scr .mv-dock,#scr .flow-strip').count(),0,'Retired v2 frames must not be rendered');
   assert.equal(await page.locator('#sheetcard .intro,#sheetcard .ml-chip,#sheetcard .ml-say').count(),0,'Retired result forms must not be rendered');
  }
  async function compare(screen,mode='tree'){
   const result=await page.evaluate(({html,screen,mode})=>{
    const b=document.createElement('div');b.innerHTML=html;const source=b.firstElementChild,actual=document.querySelector('.approved-'+screen.toLowerCase());
    const differences=[],pairs=[];
    const tree=(a,b,name)=>{const aa=[a,...a.querySelectorAll('*')],bb=[b,...b.querySelectorAll('*')];if(aa.length!==bb.length){differences.push(name+': node count '+aa.length+'/'+bb.length);return;}aa.forEach((n,i)=>pairs.push([name+':'+i,n,bb[i]]));};
    if(screen==='A'){
     // A now hosts the separately supplied Claude list/map toggle. Compare every
     // original A node and every added source node, rather than ignoring additions.
     const copy=actual.cloneNode(true),tabs=copy.querySelectorAll('.approved-route-tabs');
     if(tabs.length!==1)differences.push('A route toggle count '+tabs.length+'/1');
     else{
      const tab=tabs[0],body=copy.children[1];
      if(body.children[1]!==tab)differences.push('A route toggle: expected slot after summary');
      const reference=document.createElement('div');reference.innerHTML=window.MobileApprovedRouteSource;
      const expected=reference.firstElementChild,button=expected.querySelector('button').cloneNode(true);expected.replaceChildren();
      [['list','목록'],['route','오늘 동선']].forEach(([value,label],i)=>{
       const node=button.cloneNode(true),on=i===0;node.textContent=label;
       node.style.background=on?'#fff':'transparent';node.style.color=on?'#15171c':'#8b919c';node.style.boxShadow=on?'0 1px 2px rgba(0,0,0,0.1)':'none';expected.append(node);
       const actualButton=tab.children[i];
       if(!actualButton||actualButton.textContent!==label||actualButton.dataset.mr!=='view'||actualButton.dataset.v!==value||actualButton.getAttribute('aria-selected')!==String(on))differences.push('A route toggle: source label/action/selection '+value);
      });
      tree(tab,expected,'A approved route toggle');tab.remove();
     }
     tree(copy,source,'A source frame');
    }else if(mode==='listing'){
     pairs.push(['frame',actual,source]);[...actual.children].forEach((node,i)=>pairs.push(['region '+i,node,source.children[i]]));
     [...actual.children[3].children].forEach((node,i)=>tree(node,source.children[3].children[i],'row '+i));
    }else if(mode==='contact'){
     const [head,ctx,req,body,foot]=source.children;
     [['frame',actual,source],['head',actual.querySelector('.cd-head'),head],['back',actual.querySelector('.cd-back'),head.firstElementChild],['context',actual.querySelector('.cd-context'),ctx],['request',actual.querySelector('.cd-request'),req],['body',actual.querySelector('.cd-body'),body],['footer',actual.querySelector('.ce-foot'),foot],['memo',actual.querySelector('textarea'),body.children[1].children[1]],['next',actual.querySelector('.cd-next'),body.children[2].children[1]],['info',actual.querySelector('.ce-infobtn'),body.children[3]],['save',actual.querySelector('.ce-save'),foot.lastElementChild]].forEach(pair=>pairs.push(pair));
     const chips=body.children[0].children[1].children;
     actual.querySelectorAll('[data-ce="res"]').forEach(n=>pairs.push(['result '+n.textContent,n,chips[n.getAttribute('aria-pressed')==='true'?0:1]]));
    }else if(screen==='C'){
     // C may carry the 2026-10-22 defect-report row: a clone of the approved last "more" row
     // (same inline declarations, only the two texts differ). Compare it against that row, then the rest against the source.
     const copy=actual.cloneNode(true),defect=copy.querySelector('[data-gs="more"][data-value="하자 접수"]');
     if(defect){
      const prev=defect.previousElementSibling;
      if(!prev||prev.dataset.gs!=='more')differences.push('C defect row: expected after the last approved more row');
      else{const expected=prev.cloneNode(true);expected.dataset.value='하자 접수';expected.children[0].textContent='하자 접수';expected.children[1].textContent='사진 1장 · 본사 알림 ›';expected.setAttribute('aria-label','하자 접수');tree(defect,expected,'C defect row');}
      defect.remove();
     }
     // C may carry the 2026-10-22 mobile v6 sections (mobile-v6.js): the progress bar right after the identity block and
     // the stage history right before the approved history block. They are not approved source nodes — check their slots, then compare the rest.
     const cbody=copy.querySelector('.approved-detail-body'),progress=copy.querySelectorAll('.mv6-prog'),stageHist=copy.querySelectorAll('.mv6-hist');
     if(progress.length>1||stageHist.length>1||progress.length!==stageHist.length)differences.push('C v6 sections '+progress.length+'/'+stageHist.length);
     else if(progress.length){
      if(progress[0].previousElementSibling!==cbody.firstElementChild)differences.push('C v6 progress: expected right after the identity block');
      const next=stageHist[0].nextElementSibling;if(!next||!next.querySelector('[data-gs="history"]'))differences.push('C v6 stage history: expected right before the approved history block');
      progress[0].remove();stageHist[0].remove();
     }
     tree(copy,source,screen);
    }else tree(actual,source,screen);
    for(const [label,a,b]of pairs){if(!a||!b){differences.push(label+': missing source/bound node');continue;}for(const key of new Set([...a.style,...b.style]))if(a.style.getPropertyValue(key)!==b.style.getPropertyValue(key))differences.push(label+': '+key+' '+a.style.getPropertyValue(key)+' / '+b.style.getPropertyValue(key));}
    return {count:pairs.length,differences};
   },{html:references[screen],screen,mode});
   assert.deepEqual(result.differences,[],screen+' approved inline declarations');assert(result.count>10,'Meaningful source nodes compared');return result.count;
  }
  await open('A');const aCount=await compare('A');await safe();
  assert.deepEqual(await page.locator('.approved-a [data-gs="tab"]').allTextContents(),['오늘','내 현장','기록 · 등록','일정']);
  assert.equal(await page.locator('.approved-a [data-gs="task"]').count(),3);
  checks.push('A: '+aCount+' source nodes retain all supplied inline declarations, including the exact original A frame and separately approved list/map toggle');
  await open('B');const bCount=await compare('B','listing');
  assert.equal(await page.locator('.approved-row').count(),6);
  await page.locator('.approved-row').first().click();await page.locator('.approved-c').waitFor();
  const cCount=await compare('C');await safe();
  checks.push('B/C: '+(bCount+cCount)+' original nodes preserve source layout, with real list → detail navigation');
  for(const screen of ['A','B','C']){
   await open(screen);
   for(const width of [320,375,480]){
    await page.setViewportSize({width,height:812});
    const r=await page.locator('.approved-'+screen.toLowerCase()).evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,border:getComputedStyle(el).borderWidth,radius:getComputedStyle(el).borderRadius,doc:document.documentElement.scrollWidth,client:el.clientWidth,scroll:el.scrollWidth}));
    assert.equal(r.width,Math.min(width,480),'틀 없이 화면 폭(최대 480px)');assert.equal(r.height,812,'화면 높이');assert.equal(r.border,'0px','그림의 폰 목업 테두리를 앱에 넣지 않는다');assert.equal(r.radius,'0px');assert(r.doc<=width&&r.scroll<=r.client,screen+' has no horizontal overflow at '+width);
   }
   if(shot)await page.locator('.approved-'+screen.toLowerCase()).screenshot({path:shot+'-'+screen.toLowerCase()+'.png'});
  }
  checks.push('A/B/C: original 375×740 frames fit 320/375/480px without horizontal overflow');
  await page.setViewportSize({width:375,height:812});await open('D');
  const initial=await page.evaluate(()=>JSON.stringify({deals:DEALS,request:__review.request,rows:__review.rows,replies:__review.replies}));
  assert.deepEqual(await page.locator('[data-ce="res"]').allTextContents(),['연결됨','회신 받음','부재','번호 오류','배드핏']);
  assert.equal(await page.locator('[data-ce="save"]').isDisabled(),true);
  await page.locator('[data-ce="res"][data-v="연결됨"]').click();
  await page.locator('[data-ce-in="memo"]').fill('이미 확인한 상담 원문');
  assert.equal(await page.locator('[data-ce="save"]').isEnabled(),true);
  const dCount=await compare('D','contact');
  for(const width of [320,375,480]){
   await page.setViewportSize({width,height:812});
   const r=await page.locator('.approved-d').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,doc:document.documentElement.scrollWidth,
    memoHeight:el.querySelector('textarea').getBoundingClientRect().height,font:getComputedStyle(el.querySelector('textarea')).fontSize,
    results:[...el.querySelectorAll('[data-ce="res"]')].map(n=>({visual:n.getBoundingClientRect().height,hit:parseFloat(getComputedStyle(n,'::after').height)})),
    modes:[...el.querySelectorAll('[data-ce="mode"]')].map(n=>({visual:n.getBoundingClientRect().height,hit:parseFloat(getComputedStyle(n,'::after').height)})),save:el.querySelector('.ce-save').getBoundingClientRect().height}));
   assert.equal(r.width,Math.min(width,480));assert.equal(r.height,812);assert(r.doc<=width);assert.equal(r.memoHeight,96);assert.equal(r.font,'14.5px');
   assert(r.results.every(n=>n.visual===40&&n.hit>=44));assert(r.modes.every(n=>n.visual===38&&n.hit>=44));assert.equal(r.save,48);
  }
  if(shot)await page.locator('.approved-d').screenshot({path:shot+'-d.png'});
  checks.push('D: '+dCount+' source node declarations, five PC result values, three sections, correct required-input state and 44px hit areas separate from original visual sizes');
  // Voice only supplies reviewed draft text. It cannot infer a task/stage or save an activity.
  await page.setViewportSize({width:375,height:812});
  assert.equal(await page.evaluate(()=>__visualSpeech.starts),0);await page.locator('[data-ce="input-mic"]').click();await page.locator('.approved-i1').waitFor();
  assert.equal(await page.evaluate(()=>__visualSpeech.starts),0,'Opening speech never requests microphone automatically');
  await page.locator('[data-gs="input-mic"]').click();
  assert.equal(await page.evaluate(()=>__visualSpeech.starts),1);
  await page.evaluate(()=>{const s=__visualSpeech.instances.at(-1);s.onresult?.({resultIndex:0,results:[Object.assign([{transcript:'금요일 회의 후 다시 확인'}],{isFinal:true})]});s.onend?.();});
  await page.locator('.approved-i2').waitFor();
  const transcript=page.locator('[data-input-transcript]');assert.match(await transcript.innerText(),/금요일 회의 후 다시 확인/);
  await transcript.fill('담당자가 직접 확인하고 고친 상담 내용');await page.locator('[data-gs="input-review-save"]').click();await page.locator('.approved-d').waitFor();
  assert.equal(await page.locator('[data-ce-in="memo"]').inputValue(),'담당자가 직접 확인하고 고친 상담 내용');
  assert.equal(await page.locator('[data-ce="mode"][data-v="keep"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>JSON.stringify({deals:DEALS,request:__review.request,rows:__review.rows,replies:__review.replies})),initial,'Dictation and review cannot write CRM/task/request state');await safe();
  checks.push('D → I1 → I2 → D: explicit speech start, editable conversion, text-only draft transfer, existing task retained and zero CRM writes');
  await page.locator('[data-ce="close"]').click();await page.locator('.approved-c').waitFor();
  await page.evaluate(()=>{G.mobileV2Off=true;G.mobileHubOff=true;G.contactEntryOff=true;render();dealCallSheetM();});
  assert.equal(await page.locator('#sheetwrap.open').count(),0);await safe();assert.equal(await page.locator('.approved-c').count(),1);
  await page.locator('.approved-c [data-gs="back"]').click();await page.locator('.approved-a,.approved-b').first().waitFor();await safe();
  checks.push('Former v2/hub/contact switches never restore old layout or the retired three-value result sheet');
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const font='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';assert.deepEqual(external.filter(url=>url!==font),[]);
  console.log(JSON.stringify({test:'verify-mobile-v2',status:'PASS',passed:checks.length,checks,boundary:'Approved source visual/input smoke only; no production I/O. Route engine behavior is tested separately; missing password/admin/ICS entries are not restored or claimed verified.'},null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
