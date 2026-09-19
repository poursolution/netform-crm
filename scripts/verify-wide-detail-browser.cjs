'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
async function run(){
 const server=http.createServer((req,res)=>{const target=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');fs.createReadStream(target).pipe(res)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Seoul'});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/crm.html`);await page.waitForFunction(()=>window.DetailWorkspace&&window.StageTransitionUI);
  await page.evaluate(()=>{
   B={deals:[{id:'wide-1',site:'가로 상세 검증 현장',site_id:'site-1',assignee:'이필선',brand:'기술자문',created:CUR_Y+'-09-01',code:'consulting',stage:'컨설팅 설계',grp:'영업·관리',amt:8000000,address:'서울시 검증로 10',contact:{managerName:'검증 담당자',managerMobile:'01000000000',officeTel:'0200000000'},activities:[{id:'server-1',occurred_at:'2026-09-19T13:00:00Z',type:'문자',detail:'서버 발송 결과',actor_name:'검증자'},{id:'server-2',occurred_at:'2026-09-19T13:00:10Z',type:'문자',detail:'서버 발송 결과',actor_name:'검증자'}]}],inquiries:[],activities:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=false;G.page='pipe';G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.pipeView='kb';
   document.getElementById('authGate').classList.remove('on');document.querySelectorAll('.apage').forEach(n=>n.classList.remove('on'));document.getElementById('pg-pipe').classList.add('on');
   window.__writes=0;window.pushWrite=(type)=>{if(type!=='opportunity_touch')++window.__writes};paint();
   // A background projection can reorder the cache after cards have rendered.
   KB5_CACHE=[{id:'wrong-cached-deal',site:'잘못된 현장'}];
  });
  await page.locator('.k5c[data-deal-key="wide-1"] .k5t').click();
  assert.equal(await page.locator('#dv-title').innerText(),'가로 상세 검증 현장');
  assert.equal(await page.locator('#detailView.dw-wide').isVisible(),true);
  assert.equal(await page.locator('.dw-left #contactCard').count(),1);
  assert.equal(await page.locator('.dw-center #nextActionCard').count(),1);
  assert.equal(await page.locator('.dw-right #dv-amt').count(),1);
  assert.equal(await page.evaluate(()=>unifiedTimeline({activities:[B.deals[0].activities[0]]},B.deals[0]).filter(x=>x.id).length),2);
  assert.match(await page.locator('#activityTimelineHost').innerText(),/서버 발송 결과/);
  const timelineCases=await page.evaluate(()=>{
   const signal={id:'signal-only',type:'문자',occurred_at:'2026-09-19T13:05:00Z'};
   const item={...B.deals[0],activities:[signal]},patch={activities:[{...signal,note:'예약 문자 발송',result:'검증용 본문',actor:'담당자'}]};
   const union=unifiedTimeline(patch,item).filter(x=>x.id==='signal-only');
   const structured=unifiedTimeline({}, {...item,activities:[{...signal,detail:{note:'캠페인 발송',result:'<img src=x onerror=alert(1)>'}}]});
   const escaped=unifiedTimelineHTML({}, {...item,activities:[{...signal,detail:{note:'캠페인 발송',result:'<img src=x onerror=alert(1)>'}}]});
   return {union,structured,escaped,missing:unifiedTimelineHTML({},item),sourceUnchanged:!signal.note};
  });
  assert.equal(timelineCases.union.length,1);assert.equal(timelineCases.union[0].body,'예약 문자 발송');assert.equal(timelineCases.union[0].result,'검증용 본문');assert.equal(timelineCases.union[0].who,'담당자');
  assert.equal(timelineCases.structured[0].body,'캠페인 발송');assert.ok(timelineCases.sourceUnchanged);
  assert.match(timelineCases.escaped,/&lt;img/);assert.doesNotMatch(timelineCases.escaped,/<img/);
  assert.match(timelineCases.missing,/상세 내용은 확인되지 않았습니다/);
  for(const width of [1920,1440,1280,1146]){
   await page.setViewportSize({width,height:900});
   const m=await page.locator('#detailView').evaluate(n=>{const r=n.getBoundingClientRect(),cols=[...n.querySelector('.dw-columns').children].map(x=>x.getBoundingClientRect());return {width:r.width,overflow:n.scrollWidth>n.clientWidth,ratio:cols[1].width/cols[0].width,sameTop:cols.every(c=>Math.abs(c.top-cols[0].top)<2)}});
   assert.ok(Math.abs(m.width-width*.94)<2);assert.equal(m.overflow,false);assert.equal(m.sameTop,true);assert.ok(Math.abs(m.ratio-2)<.03);
   assert.ok(await page.locator('.dw-left .pc-contact-person').first().evaluate(n=>n.getBoundingClientRect().width)>100,'contact identity stays readable at '+width);
   assert.ok(await page.locator('.dw-left .contactnum b').evaluateAll(nodes=>nodes.every(n=>{const r=document.createRange();r.selectNodeContents(n);return r.getClientRects().length===1&&n.scrollWidth<=n.clientWidth})), 'phone numbers stay on one line at '+width);
  }
  await page.evaluate(()=>DetailWorkspace.focusWide('activityFormCard'));
  await page.locator('#dv-act-note').fill('저장 전 메모 보존');
  await page.evaluate(()=>detailTabFocus('공종·금액'));
  await page.evaluate(()=>detailTabFocus('연락·활동'));
  assert.equal(await page.locator('#dv-act-note').inputValue(),'저장 전 메모 보존');
  await page.locator('.dw-right').getByRole('button',{name:'단계 변경',exact:true}).click();
  assert.equal(await page.locator('#dw-stage-editor #stage-transition-form').isVisible(),true);
  assert.equal(await page.locator('#stageTransitionModal').count(),0);
  await page.locator('#sf-cancel').click();assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  assert.equal(await page.locator('#dv-act-note').inputValue(),'저장 전 메모 보존');
  assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('#dv-body [id]')].map(n=>n.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)}),[]);
  assert.equal(await page.evaluate(()=>localDateTimeValue('2026-09-19T13:45:00Z')),'2026-09-19T22:45');
  await page.evaluate(()=>{window.__contactRead=relationshipContact;window.relationshipContact=()=>({name:'검증 담당자',role:'관리소장',mobile:'01000000000',consentAt:'2026-09-19T13:45:00Z'});openQuickContact('edit','test-person')});
  assert.equal(await page.locator('#qc-mobile').inputValue(),'01000000000');
  assert.equal(await page.locator('#qc-consent-at').inputValue(),'2026-09-19T22:45');
  await page.evaluate(()=>{closeQuickContact();window.relationshipContact=window.__contactRead});
  await page.evaluate(()=>{const h=document.createElement('div');h.id='test-campaign';h.innerHTML=campaignTemplatePanel();document.body.append(h)});
  await page.evaluate(()=>campaignUpdateBody('직접 작성 문구'));assert.equal(await page.locator('#cc-preview-next').isDisabled(),false);
  await page.evaluate(()=>campaignUpdateBody('   '));assert.equal(await page.locator('#cc-preview-next').isDisabled(),true);
  await page.evaluate(()=>document.getElementById('test-campaign').remove());
  for(const width of [768,390]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('#detailView').evaluate(n=>n.scrollWidth>n.clientWidth),false)}
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>{document.querySelectorAll('.dw-columns details').forEach(n=>n.open=false);document.querySelectorAll('.dw-columns>aside,.dw-columns>main').forEach(n=>n.scrollTop=0)});
  if(process.env.VERIFY_SCREENSHOT)await page.screenshot({path:process.env.VERIFY_SCREENSHOT});
  await page.locator('#detailView .backbtn').click();assert.equal(await page.locator('#detailView').isVisible(),false);assert.equal(await page.evaluate(()=>G.pipeView),'kb');
  const polling=await page.evaluate(async()=>{const oldRefresh=refreshOperationalDomains,oldToken=TOKEN;let calls=0;refreshOperationalDomains=async()=>++calls;TOKEN='synthetic';G.page='campaign';G.campaignTab='history';LAST_CAMPAIGN_SYNC=0;await syncCampaignNow(false);await syncCampaignNow(false);const dedup=calls===1;G.campaignTab='send';await syncCampaignNow(true);const draft=calls===1;const repaint=operationalPageNeedsPaint(['campaign_core']);refreshOperationalDomains=oldRefresh;TOKEN=oldToken;G.page='pipe';return {dedup,draft,repaint}});
  assert.deepEqual(polling,{dedup:true,draft:true,repaint:true});
  // Relationship contact and next schedule must remain one visible workflow.
  await page.evaluate(()=>{Object.assign(B.deals[0],{code:'rapport',stage_code:'rapport',stage:'유대관리'});G.page='relationship';G._detailPopup=true;drwDeal(JSON.stringify(B.deals[0]));});
  assert.equal(await page.locator('#rel-contact-save').count(),1);
  assert.equal(await page.evaluate(()=>document.getElementById('activityFormCard').closest('details')===document.getElementById('nextActionCard').closest('details')),true,'atomic inputs share one expanded section');
  assert.equal(await page.locator('#dv-act-note').isVisible(),true);
  assert.equal(await page.locator('#dv-na-date').isVisible(),true);
  assert.equal(await page.evaluate(()=>!!(document.getElementById('nextActionCard').compareDocumentPosition(document.getElementById('rel-contact-save'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'combined save follows both input groups');
  await page.locator('#dv-act-note').fill('연락 기록 초안');
  await page.locator('#dv-na-text').fill('다음 통화 초안');
  await page.locator('#dv-na-date').fill('2026-09-25');
  await page.evaluate(()=>{DetailWorkspace.focusWide('nextActionCard');DetailWorkspace.focusWide('activityFormCard');});
  assert.equal(await page.locator('#dv-act-note').inputValue(),'연락 기록 초안');
  assert.equal(await page.locator('#dv-na-text').inputValue(),'다음 통화 초안');
  assert.equal(await page.locator('#rel-contact-save').getAttribute('onclick'),'saveRelationshipContactAtomic()');
  assert.equal(await page.locator('#nextActionCard .dactions .dact.pri').isVisible(),false);
  for(const width of [1146,390]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.locator('#detailView').evaluate(n=>n.scrollWidth>n.clientWidth),false);
   assert.equal(await page.locator('#dv-act-note').isVisible(),true);
   assert.equal(await page.locator('#dv-na-date').isVisible(),true);
  }
  if(process.env.VERIFY_RELATIONSHIP_SCREENSHOT){await page.setViewportSize({width:1440,height:900});await page.screenshot({path:process.env.VERIFY_RELATIONSHIP_SCREENSHOT});}
  await page.locator('#detailView .backbtn').click();
  assert.equal(await page.evaluate(()=>window.__writes),0);assert.deepEqual(errors,[]);
  console.log('PASS: wide detail, responsive columns, inline stage, preserved drafts, server activities, local time, campaign preview; zero writes');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
}
run().catch(e=>{console.error(e.stack);process.exitCode=1});
