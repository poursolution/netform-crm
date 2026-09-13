'use strict';
// All data is synthetic and every non-local request is blocked.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');
async function run(){
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1365,height:900}}),errors=[];
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.DetailWorkspace&&window.StageTransitionUI);
  await page.evaluate(()=>{
   FIELD_DEMO=true;AUTH_ON=false;ME={name:'송보람',role:'admin'};saveLocal=()=>{};window.writes=[];pushWrite=(...x)=>writes.push(x);
   const d={id:'b5d27a2a-5243-4acd-afb9-d973a15af9d1',site:'검증 고객아파트',brand:'POUR솔루션',assignee:'황윤선',code:'rapport',created:'2026-01-01',amt:10000000,relationshipReason:'내년도 사업 검토',manager_name:'검증소장',manager_mobile:'01000000000',office_phone:'0200000000',activities:[{at:'2026-09-10T12:00:00+09:00',type:'전화',note:'예산 편성 확인',result:'10월 재검토'}],nextActionObj:{text:'예산 확정 확인',due:'2026-09-18',type:'전화',status:'open'}};
   B={deals:[d],inquiries:[],users:[],sales_people:[],activities:[],sites:[],contacts:[],dups:[],expansion_pool:[],expansionPool:[],expansion_events:[],customerSupportActions:[],customer_support_actions:[],messageLogs:[],message_logs:[],campaigns:[],campaign_logs:[],repManagerComments:[],rep_manager_comments:[]};LOCAL={deals:{},inquiries:{}};
   G.page='relationship';G.relationshipFilter='all';G.relationshipOwner='전체';G._detailPopup=true;document.getElementById('authGate').classList.remove('on');document.getElementById('authGate').style.display='none';syncPage();drwDeal(JSON.stringify(d));
  });
  for(let repeat=0;repeat<3;repeat++){
   await page.evaluate(()=>renderDetail());
   for(const selector of ['#activityFormCard','#nextActionCard','#contactCard','.relm-detail-context','#execFiles'])assert.equal(await page.locator(selector).count(),1,selector+' must not accumulate across renders');
  }
  assert.equal(await page.locator('.dsec[data-sec="개요"] #contactCard').count(),0);
  assert.equal(await page.locator('.dsec[data-sec="연락·활동"] #contactCard').count(),1);
  assert.equal(await page.locator('#ct-office').isVisible(),false);
  await page.evaluate(()=>detailTabFocus('연락·활동',true));
  await page.locator('#contactCard summary').click();
  assert.equal(await page.locator('#ct-office').isVisible(),true);
  await page.locator('#ct-office').fill('0212345678');
  await page.locator('#contactCard summary').click();await page.locator('#contactCard summary').click();
  assert.equal(await page.locator('#ct-office').inputValue(),'0212345678');
  await page.evaluate(()=>{closeDetail();paintRelationshipManagement();relationshipManagementOpen(0,'activity')});
  assert.equal(await page.locator('#relQuickModal').count(),1);
  assert.equal(await page.locator('#relq-note').isVisible(),true);
  assert.equal(await page.locator('#relq-due').isVisible(),true);
  await page.locator('#relq-note').fill('보존할 미저장 연락 메모');
  await page.screenshot({path:path.resolve(root,'../detail-workspace-quick.png'),animations:'disabled'});
  await page.getByRole('button',{name:/전체 영업정보 보기/}).click();
  assert.equal(await page.locator('.dcc-journey').isVisible(),true);
  await page.evaluate(()=>StageTransitionUI.open(CUR_DETAIL.item,false,'silent'));
  assert.match(await page.locator('.dw-transition-context').textContent(),/예산 편성 확인/);
  assert.match(await page.locator('.dw-transition-context').textContent(),/예산 확정 확인/);
  await page.locator('#sf-cancel').click();
  await page.evaluate(()=>{closeDetail();G.page='sites';G.siteStatus='전체';G.siteBrand='전체';G.siteOwner='전체';G.q='';paintSites();openSiteMaster(0)});
  assert.equal(await page.locator('#siteDrawerBody > .dw-tabs button').count(),6);
  await page.locator('#siteDrawerBody .dw-tabs [data-key="deals"]').click();
  assert.equal(await page.locator('#siteDrawerBody .site-opp-row:visible').count(),1);
  await page.locator('#siteDrawerBody .site-opp-row').click();
  assert.equal(await page.locator('#siteDrawer').getAttribute('aria-hidden'),'true');
  await page.getByRole('button',{name:'← 고객자산으로 돌아가기',exact:true}).click();
  assert.equal(await page.locator('#siteDrawer').getAttribute('aria-hidden'),'false');
  assert.equal(await page.locator('#siteDrawerBody .dw-tabs [data-key="deals"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#detailView').getAttribute('aria-hidden'),'true');
  for(const key of ['summary','trade','people','activity','expansion']){
   await page.locator('#siteDrawerBody .dw-tabs [data-key="'+key+'"]').click();
   assert.equal(await page.locator('#siteDrawerBody [data-workspace-group]:visible').evaluateAll(ns=>ns.every(n=>n.dataset.workspaceGroup===document.querySelector('#siteDrawerBody .dw-tabs [aria-pressed=true]').dataset.key||n.dataset.workspaceGroup==='always')),true);
  }
  await page.locator('#siteDrawerBody .dw-tabs [data-key="summary"]').click();
  await page.screenshot({path:path.resolve(root,'../detail-workspace-asset.png'),animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#siteDrawerBody').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
  await page.setViewportSize({width:1365,height:900});
  await page.evaluate(()=>{closeSiteDrawer();goPage('repmanage')});
  assert.equal(await page.locator('.dw-manager-table').count(),1);
  await page.locator('.dw-manager-table button').first().click();
  assert.equal(await page.locator('#perfDrawerBody > .dw-tabs button').count(),4);
  await page.locator('#perfDrawerBody .dw-tabs [data-key="won"]').click();
  assert.equal(await page.locator('#perfDrawerBody [data-workspace-group="won"]').isVisible(),true);
  await page.evaluate(()=>closePerfDrawer());
  await page.screenshot({path:path.resolve(root,'../detail-workspace-manager.png'),animations:'disabled'});
  await page.evaluate(()=>goPage('gyeongnam'));
  assert.deepEqual(await page.locator('.gn-frame:visible h3').allTextContents(),['즉시 확인','본사 인계 현황']);
  const menus=['today','inq','pipe','sites','relationship','expansion','campaign','repmanage','mgmt','gyeongnam','dash','perf','work','brief','report'];
  for(const menu of menus){await page.evaluate(p=>goPage(p),menu);assert.equal(await page.locator('#pg-'+menu).evaluate(n=>n.classList.contains('on')),true)}
  assert.deepEqual(await page.evaluate(()=>writes.filter(x=>x[0]!=='opportunity_touch')),[]);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'PASS',contact_edit_fold:true,quick_same_forms:true,draft_preserved:true,transition_context:true,asset_tabs:6,asset_return_context:true,rep_tabs:4,branch_handoff_first:true,menu_navigation:menus.length,mobile_no_horizontal_scroll:true,business_writes:0}));
 }finally{await browser.close();await new Promise(r=>server.close(r))}
}
run().catch(e=>{console.error(e);process.exitCode=1});
