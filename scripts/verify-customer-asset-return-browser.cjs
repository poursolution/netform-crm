'use strict';

// Localhost-only regression for canonical Site return navigation. No CRM reads or writes.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const launchOptions=()=>({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
function server(){return http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),rel=pathname==='/'?'crm.html':pathname.replace(/^\/+/,''),target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res)})}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch(launchOptions());
 try{
  const context=await browser.newContext();
  let externalRequests=0,businessWrites=0;
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();externalRequests++;if(/crm_write_command|n8n/i.test(url.href))businessWrites++;return route.abort()});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof paintSites==='function'&&typeof openSiteMaster==='function'&&window.DetailWorkspace);
  await page.evaluate(()=>{
   const deal=(id,address)=>({id,site_id:id.replace('deal','site'),site:'한빛아파트',address,brand:'POUR솔루션',work:'옥상 방수',work_name:'옥상 방수',assignee:'황윤선',code:'review',stage:'검토',grp:'Pipeline',amt:100000000,created:'2026-08-01',activities:[],nextActionObj:{id:'11111111-1111-4111-8111-111111111111',text:'현장 확인',due:'2026-09-30',status:'open'}});
   const make=(key,address,dealId)=>{const d=deal(dealId,address);return {key,norm:'한빛아파트',name:'한빛아파트',names:{한빛아파트:1},canonicalAddress:address,addresses:[address],deals:[d],inquiries:[],open:[d],won:[],lost:[],brands:['POUR솔루션'],owners:['황윤선'],contacts:[],primary:null,totalAmount:100000000,wonAmount:0,openAmount:100000000,lostAmount:0,started:'2026-08-01',firstInquiry:'',firstDeal:'2026-08-01',lastAt:'2026-09-01',lastDays:16,health:'active'};};
   const customers=[make('id:site-suwon','경기 수원시 팔달구 1','deal-suwon'),make('id:site-yongin','경기 용인시 기흥구 2','deal-yongin')];
   B={deals:customers.flatMap(s=>s.deals),inquiries:[],activities:[],contacts:[],sites:[],dups:[],cleanup_events:[],cleanup_moves:[],expansion_pool:[],expansionPool:[],expansion_events:[],asq_projects:[]};
   siteMasterData=()=>customers;
   G.page='sites';G.q='';G.siteStatus='전체';G.siteBrand='전체';G.siteOwner='전체';G.siteAddress='전체';G.workFilter='전체';G.siteSort='관계우선';G.sitePage=1;G.sitePageKey=null;
   document.getElementById('authGate').classList.remove('on');
   document.querySelectorAll('.apage').forEach(node=>node.classList.remove('on'));
   document.getElementById('pg-sites').classList.add('on');
   paintSites();
  });
  const rows=page.locator('.site-table-row.data');
  assert.equal(await rows.count(),2);
  assert.deepEqual(await rows.evaluateAll(nodes=>nodes.map(n=>n.querySelector(':scope > span:first-child strong').textContent)),['한빛아파트','한빛아파트']);
  await page.evaluate(()=>openSiteMaster(SITE_MASTER_CACHE.findIndex(s=>s.key==='id:site-yongin')));
  await page.waitForSelector('#siteDrawer.on',{state:'attached'});
  await page.locator('#siteDrawerBody .dw-tabs [data-key="deals"]').click();
  assert.match(await page.locator('#siteDrawerBody .site-hero p').textContent(),/용인시/);
  await page.evaluate(()=>openSiteDeal(0));
  await page.waitForSelector('#detailView.on .dw-asset-back');
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.id),'deal-yongin');
  assert.equal(await page.evaluate(()=>Object.prototype.hasOwnProperty.call(CUR_DETAIL.item,'last_viewed_at')),false);
  const failedActivity=await page.evaluate(()=>{
   const item=CUR_DETAIL.item,before=(item.activities||[]).length;
   document.getElementById('dv-act-note').value='인증 없는 합성 저장';
   const result=addDetailActivity();
   return {result,activities:(item.activities||[]).length,before,worked:Object.prototype.hasOwnProperty.call(item,'last_worked_at'),error:document.getElementById('dv-err').textContent};
  });
  assert.equal(failedActivity.result,false);assert.equal(failedActivity.activities,failedActivity.before);assert.equal(failedActivity.worked,false);assert.match(failedActivity.error,/기존 이력은 변경하지 않았습니다/);
  const failedCompletion=await page.evaluate(()=>{
   const item=CUR_DETAIL.item,p=currentPatch(),before=JSON.stringify(actionObj(item,p)),completed=(p.completedActions||[]).length,result=completeNextAction();
   return {result,before,after:JSON.stringify(actionObj(item,p)),completedBefore:completed,completedAfter:(p.completedActions||[]).length,worked:Object.prototype.hasOwnProperty.call(item,'last_worked_at'),error:document.getElementById('dv-err').textContent};
  });
  assert.equal(failedCompletion.result,false);assert.equal(failedCompletion.after,failedCompletion.before);assert.equal(failedCompletion.completedAfter,failedCompletion.completedBefore);assert.equal(failedCompletion.worked,false);assert.match(failedCompletion.error,/기존 일정을 유지합니다/);
  const failedTodayCompletion=await page.evaluate(()=>{
   const item=CUR_DETAIL.item,p=currentPatch(),before=JSON.stringify(actionObj(item,p)),completed=(p.completedActions||[]).length,activities=(p.activities||item.activities||[]).length,result=todoDone(dealKey(item));
   return {result,before,after:JSON.stringify(actionObj(item,p)),completedBefore:completed,completedAfter:(p.completedActions||[]).length,activitiesBefore:activities,activitiesAfter:(p.activities||item.activities||[]).length};
  });
  assert.equal(failedTodayCompletion.result,false);assert.equal(failedTodayCompletion.after,failedTodayCompletion.before);assert.equal(failedTodayCompletion.completedAfter,failedTodayCompletion.completedBefore);assert.equal(failedTodayCompletion.activitiesAfter,failedTodayCompletion.activitiesBefore);
  const failedIssueCompletion=await page.evaluate(()=>{
   const item=CUR_DETAIL.item,p=currentPatch(),before=JSON.stringify({action:actionObj(item,p),completed:p.completedActions||[],activities:p.activities||item.activities||[]});
   const active=towerActive;towerActive=()=>true;IssueModal.bind('browser-completion-failure','overdue',[item]);IssueModal.open('browser-completion-failure');IssueModal.action(0,'complete');document.getElementById('issue-result').value='브라우저 실패 보존 확인';IssueModal.save();towerActive=active;
   return {before,after:JSON.stringify({action:actionObj(item,p),completed:p.completedActions||[],activities:p.activities||item.activities||[]}),error:document.getElementById('issue-error').textContent};
  });
  assert.equal(failedIssueCompletion.after,failedIssueCompletion.before);assert.match(failedIssueCompletion.error,/기존 일정을 유지합니다/);
  await page.evaluate(()=>IssueModal.close());
  const failedInquiryCompletion=await page.evaluate(()=>{
   const q={id:'33333333-3333-4333-8333-333333333333',site:'문의 완료 실패 현장',status:'배정완료',nextActionObj:{id:'44444444-4444-4444-8444-444444444444',text:'견적 확인 전화',due:'2026-09-30',status:'open'},activities:[]};
   B.inquiries=[q];SPLIT_CACHE=[q];G.inqSelKey=inqKey(q);const p=detailPatchFor('inq',inqKey(q)),before=JSON.stringify({q,p}),transport=pushWrite,dialog=alert;let message='';pushWrite=()=>{throw Error('TEST_QUEUE_REJECTED')};alert=text=>{message=String(text)};const result=splitDoneAction();pushWrite=transport;alert=dialog;
   return {result,before,after:JSON.stringify({q,p}),message};
  });
  assert.equal(failedInquiryCompletion.result,false);assert.equal(failedInquiryCompletion.after,failedInquiryCompletion.before);assert.match(failedInquiryCompletion.message,/기존 일정을 유지합니다/);
  await page.locator('#detailView .dw-asset-back').click();
  await page.waitForSelector('#siteDrawer.on');
  assert.match(await page.locator('#siteDrawerBody .site-hero p').textContent(),/용인시/);
  assert.equal(await page.locator('#siteDrawerBody .dw-tabs [data-key="deals"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>SITE_MASTER_CACHE.findIndex(s=>s.key==='id:site-yongin')),1);
  assert.equal(businessWrites,0);
  console.log(JSON.stringify({status:'PASS',duplicate_name_sites:2,restored_site_key:'id:site-yongin',restored_tab:'deals',today_completion_failure_preserved:true,issue_completion_failure_preserved:true,inquiry_completion_failure_preserved:true,blocked_external_reads:externalRequests,business_writes:businessWrites}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
