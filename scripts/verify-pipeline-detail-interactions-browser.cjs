'use strict';

// Localhost-only end-to-end interaction matrix for the Pipeline detail drawer.
// All records are synthetic, FIELD_DEMO is enabled, and every external request is blocked.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
function server(){return http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),rel=(pathname==='/'?'crm.html':pathname.replace(/^\/+/,'')),target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res)})}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1365,height:768}});
  let externalRequests=0;await context.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();externalRequests++;return route.abort()});
  const errors=[],page=await context.newPage();page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof renderDetail==='function'&&typeof setActivityFilter==='function'&&typeof toggleExecFavorite==='function');
  const activityTypes=await page.evaluate(()=>{
   FIELD_DEMO=true;ME={name:'테스트 담당자',email:'test@crm.local'};
   const rows=ACTIVITY_TYPES.slice(0,12).map((type,i)=>({type,note:type+' 테스트 기록',result:'결과 '+i,at:new Date(Date.UTC(2026,8,9,8,i)).toISOString(),actor:'테스트 담당자'}));
   const deal={id:'2f98178e-a70e-4c21-8304-2a6ad7b627e8',site:'[서울 마포] UI 회귀테스트 아파트',brand:'POUR솔루션',assignee:'황윤선',code:'sent',stage_code:'sent',stage:'자료 발송완료',created:'2026-09-01',amt:120000000,quoteAmt:115000000,work:'옥상 방수',activities:rows,nextActionObj:{id:'2b3c7b82-42f0-47f4-b1d1-39127c66554e',type:'전화',text:'견적 검토 확인',due:'2026-09-12',assignee:'황윤선',status:'open'}};
   B={deals:[deal],inquiries:[],users:[],sales_people:[],activities:[],sites:[],contacts:[],dups:[],expansion_pool:[],expansionPool:[],expansion_events:[],customerSupportActions:[],customer_support_actions:[],messageLogs:[],message_logs:[],campaigns:[],campaign_logs:[],repManagerComments:[],rep_manager_comments:[]};
   LOCAL={deals:{},inquiries:{}};LOCAL.deals[deal.id]={activities:rows.slice()};
   G.page='pipe';G._detailPopup=true;G.detailTab='영업활동';G.actFilter='전체';G.utlAll=false;CUR_DETAIL={kind:'deal',key:dealKey(deal),item:deal};
   renderDetail();detailTabFocus('영업활동',true);
   const gate=document.getElementById('authGate');if(gate){gate.classList.remove('on');gate.style.display='none'}
   return ACTIVITY_TYPES.slice();
  });
  await page.waitForSelector('#activityTimelineHost .utlitem');
  const drawer=page.locator('#detailView'),note=page.locator('#dv-act-note'),result=page.locator('#dv-act-result');
  await note.fill('필터를 눌러도 남아야 하는 통화 메모');await result.fill('도면 요청 · 금요일 재통화');
  await page.evaluate(()=>{const d=document.getElementById('detailView');d.scrollTop=Math.min(220,d.scrollHeight-d.clientHeight)});
  const initialScroll=await drawer.evaluate(e=>e.scrollTop);assert.ok(initialScroll>0,'drawer must be scrollable for the regression');

  for(const type of ['전화','문자','카카오','이메일','현장방문','사진','자료전달','견적','후속접촉','PT','현장설명','입찰','회의','계약','메모','업무','기타','전체']){
   const before=await drawer.evaluate(e=>e.scrollTop);
   await page.locator(`.activity-filter button[data-type="${type}"]`).evaluate(e=>e.click());
   assert.equal(await note.inputValue(),'필터를 눌러도 남아야 하는 통화 메모');
   assert.equal(await result.inputValue(),'도면 요청 · 금요일 재통화');
   assert.equal(await drawer.evaluate(e=>e.scrollTop),before,`${type} filter changed drawer scroll`);
   assert.equal(await page.locator(`.activity-filter button[data-type="${type}"]`).evaluate(e=>e.classList.contains('on')),true);
  }

  const accordion=page.locator('#activityTimelineHost .utlhead').first(),item=page.locator('#activityTimelineHost .utlitem').first();
  const openBefore=await item.evaluate(e=>e.classList.contains('open')),scrollBeforeAccordion=await drawer.evaluate(e=>e.scrollTop);
  await accordion.evaluate(e=>e.click());
  assert.notEqual(await item.evaluate(e=>e.classList.contains('open')),openBefore);
  assert.equal(await drawer.evaluate(e=>e.scrollTop),scrollBeforeAccordion);
  assert.equal(await note.inputValue(),'필터를 눌러도 남아야 하는 통화 메모');

  const more=page.locator('#activityTimelineHost .utlmore');assert.equal(await more.count(),1);
  const scrollBeforeMore=await drawer.evaluate(e=>e.scrollTop);await more.evaluate(e=>e.click());
  assert.equal(await page.locator('#activityTimelineHost .utlitem').count(),12);
  assert.equal(await drawer.evaluate(e=>e.scrollTop),scrollBeforeMore);
  assert.equal(await note.inputValue(),'필터를 눌러도 남아야 하는 통화 메모');

  await page.locator('.exec-favorite').evaluate(e=>e.click());assert.equal(await page.locator('.exec-favorite').textContent(),'★ 즐겨찾기');
  await page.locator('.exec-favorite').evaluate(e=>e.click());assert.equal(await page.locator('.exec-favorite').textContent(),'☆ 즐겨찾기');

  for(const tab of ['개요','현장·견적','영업활동','일정','이력']){
   await page.locator(`.detailtabs button[data-tab="${tab}"]`).evaluate(e=>e.click());
   assert.equal(await page.locator(`.detailtabs button[data-tab="${tab}"]`).evaluate(e=>e.classList.contains('on')),true);
   assert.equal(await page.locator(`#dv-body .dsec[data-sec="${tab}"]`).evaluate(e=>getComputedStyle(e).display!=='none'),true);
   assert.equal(await page.locator('#dv-body .dsec').evaluateAll(rows=>rows.filter(e=>getComputedStyle(e).display!=='none').length),1);
  }

  // User-visible response matrix: a click must move to its editor/modal, not merely mutate hidden state.
  await page.evaluate(()=>{detailTabFocus('개요');document.getElementById('detailView').scrollTop=0});
  await page.locator('.bact button').filter({hasText:'다음 행동'}).evaluate(e=>e.click());await page.waitForTimeout(180);
  assert.equal(await page.locator('#dv-na-text').evaluate(e=>e===document.activeElement),true,'brief next action did not focus its editor');
  assert.equal(await page.locator('.dsec[data-sec="일정"]').evaluate(e=>getComputedStyle(e).display!=='none'),true);
  assert.ok(await drawer.evaluate(e=>e.scrollTop)>0,'brief next action left the user at the unchanged top of the drawer');

  const groups=await page.locator('#dv-na-type-picker .next-picker-buttons button').evaluateAll(rows=>rows.map(e=>e.dataset.group));
  for(const group of groups){
   const choice=page.locator(`#dv-na-type-picker .next-picker-buttons button[data-group="${group}"]`);await choice.evaluate(e=>e.click());
   assert.equal(await choice.getAttribute('aria-pressed'),'true',`${group} next-action choice gave no pressed feedback`);
  }
  await page.locator('#dv-na-text').fill('');await page.locator('#dv-na-date').fill('');
  await page.getByRole('button',{name:'다음 행동 저장',exact:true}).evaluate(e=>e.click());
  assert.match(await page.locator('#dv-err').textContent(),/유형·내용·기한·담당자/,'next-action validation gave no visible explanation');

  await page.evaluate(()=>briefAmountEditor());await page.waitForTimeout(120);
  const amountState=await page.evaluate(()=>({active:document.activeElement&&document.activeElement.id,exists:!!document.getElementById('dv-amt'),tab:G.detailTab,display:getComputedStyle(document.querySelector('.dsec[data-sec="현장·견적"]')).display,scroll:document.getElementById('detailView').scrollTop}));
  assert.equal(amountState.active,'dv-amt','amount shortcut did not focus the amount editor: '+JSON.stringify(amountState));
  assert.equal(await page.locator('.dsec[data-sec="현장·견적"]').evaluate(e=>getComputedStyle(e).display!=='none'),true);

  await page.locator('.stickytools button').filter({hasText:'활동 기록'}).evaluate(e=>e.click());await page.waitForTimeout(120);
  assert.equal(await page.locator('#dv-act-note').evaluate(e=>e===document.activeElement),true,'sticky activity action did not focus the activity editor');
  await page.locator('#dv-act-note').fill('');
  await page.getByRole('button',{name:'활동 저장',exact:true}).evaluate(e=>e.click());
  assert.match(await page.locator('#dv-err').textContent(),/활동 유형·무엇을 했는지·활동 일시/,'activity validation gave no visible explanation');

  await page.locator('.stickytools button').filter({hasText:'사업유형 전환'}).evaluate(e=>e.click());await page.waitForTimeout(80);
  assert.equal(await page.locator('#inlineBiz').count(),1,'business transition did not open its inline editor');
  await page.evaluate(()=>closeBiz());assert.equal(await page.locator('#inlineBiz').count(),0);
  await page.locator('.stickytools button').filter({hasText:'단계 전환'}).evaluate(e=>e.click());await page.waitForTimeout(80);
  assert.equal(await page.locator('#inlineTransition').count(),1,'stage transition did not open its inline editor');
  await page.evaluate(()=>closeTransition());assert.equal(await page.locator('#inlineTransition').count(),0);

  const ownerChoiceButtons=page.locator('#detailView button[aria-controls]'),ownerChoiceCount=await ownerChoiceButtons.count();
  for(let i=0;i<ownerChoiceCount;i++){
   const button=ownerChoiceButtons.nth(i),target=await button.getAttribute('aria-controls');
   assert.equal(await button.getAttribute('aria-expanded'),'false');await button.evaluate(e=>e.click());
   assert.equal(await button.getAttribute('aria-expanded'),'true',target+' owner choice did not open');
   assert.equal(await page.locator('#'+target).evaluate(e=>e.hidden),false);await button.evaluate(e=>e.click());
   assert.equal(await button.getAttribute('aria-expanded'),'false',target+' owner choice did not close');
  }
  const inventory=await page.locator('#detailView button:not([disabled])').evaluateAll(rows=>({total:rows.length,unwired:rows.filter(e=>!e.getAttribute('onclick')&&!e.getAttribute('aria-controls')).map(e=>({text:(e.textContent||'').trim(),html:e.outerHTML}))}));
  assert.deepEqual(inventory.unwired,[],'enabled detail buttons without a click handler: '+JSON.stringify(inventory.unwired));

  await page.evaluate(()=>dccGoActivity());await page.waitForTimeout(100);assert.equal(await page.locator('#dv-act-note').evaluate(e=>e===document.activeElement),true);
  await page.evaluate(()=>dccGoNext());await page.waitForTimeout(100);assert.equal(await page.locator('#dv-na-text').evaluate(e=>e===document.activeElement),true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'PASS',activity_filter_clicks:18,draft_preserved:true,scroll_preserved:true,timeline_accordion:true,timeline_more:true,favorite_toggle:true,detail_tabs:5,next_action_types:groups.length,shortcut_actions:4,validation_paths:2,inline_editors:2,owner_choices:ownerChoiceCount,wired_buttons:inventory.total,external_requests:externalRequests,business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
