'use strict';
// Synthetic localhost-only regression. No credentials, external requests, or business writes.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');
async function run(){
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1365,height:768}});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof saveBasics==='function'&&typeof inqCtlOpenSingle==='function');
  await page.evaluate(()=>{
   FIELD_DEMO=true;ME={name:'송보람',role:'admin'};saveLocal=()=>{};pushWrite=()=>{};
   const deal={id:'2f98178e-a70e-4c21-8304-2a6ad7b627e8',site:'동일이름 합성현장',brand:'POUR솔루션',assignee:'황윤선',code:'sent',stage_code:'sent',created:'2026-09-01',amt:100000,quoteAmt:90000,quote_versions:[{version_no:1,amount:90000}],wonAmt:70000,work:'방수',activities:[],version:1};
   const q={id:'69caf08e-daea-4eac-aa39-82c85f1f3d08',site:deal.site,brand:'POUR솔루션',assignee:'김성민',status:'접수',at:'2026-09-13',message:'별도 공사 <script>원문</script>',phone:'01000000000'};
   B={deals:[deal],inquiries:[q],users:[],sales_people:[],activities:[],sites:[],contacts:[],dups:[],expansion_pool:[],expansionPool:[],expansion_events:[],customerSupportActions:[],customer_support_actions:[],messageLogs:[],message_logs:[],campaigns:[],campaign_logs:[],repManagerComments:[],rep_manager_comments:[]};LOCAL={deals:{},inquiries:{}};
   G.page='inq';G._detailPopup=true;G.detailTab='개요';document.getElementById('authGate').style.display='none';
   window.fixture={deal,q};drwInq(JSON.stringify(q));
  });
  assert.equal(await page.evaluate(()=>linkedDeal(fixture.q)),null,'same site is not linkage');
  assert.equal(await page.evaluate(()=>CUR_DETAIL.kind),'inq');
  assert.equal(await page.locator('#dv-amt,#dv-qamt,#dv-wamt').count(),0);
  assert.match(await page.locator('#dv-body').textContent(),/별도 공사 <script>원문<\/script>/);
  assert.equal(await page.locator('#dv-body script').count(),0);
  await page.getByRole('button',{name:'문의 처리 화면 열기 →',exact:true}).click();
  assert.equal(await page.evaluate(()=>G.inqSelKey),'69caf08e-daea-4eac-aa39-82c85f1f3d08');
  assert.equal(await page.evaluate(()=>G.page),'inq');
  assert.equal(await page.locator('.sp-detail').count(),1,'same inquiry work surface is actually rendered');
  await page.evaluate(()=>{fixture.q.opportunity_id=fixture.deal.id;drwInq(JSON.stringify(fixture.q))});
  assert.equal(await page.evaluate(()=>CUR_DETAIL.kind),'inq');
  await page.getByRole('button',{name:'영업기회 열기 →',exact:true}).waitFor({state:'visible'});
  await page.screenshot({animations:'disabled',path:'C:/Users/Administrator/.codex/visualizations/2026/09/05/01a073a6-2a59-7320-9bc6-0eb52f2c7a2a/detail-p1-inquiry.png'});
  await page.getByRole('button',{name:'영업기회 열기 →',exact:true}).click();
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.id),await page.evaluate(()=>fixture.deal.id));
  assert.equal(await page.evaluate(()=>CUR_DETAIL.kind),'deal');
  console.log('P1: inquiry identity/navigation checked');
  const links=await page.evaluate(()=>{
   const q=fixture.q,d=fixture.deal;q.opportunity_id='missing';const missing=linkedDeal(q),blocked=inquiryLinkUnresolved(q);delete q.opportunity_id;
   d.origin_inquiry_id=q.id;const reverse=linkedDeal(q)?.id;B.deals.push({...d,id:'other'});const ambiguous=linkedDeal(q);B.deals.pop();delete d.origin_inquiry_id;
   return {missing,blocked,reverse,ambiguous};
  });assert.equal(links.missing,null);assert.equal(links.blocked,true);assert.equal(links.ambiguous,null);assert.ok(links.reverse);
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(fixture.deal));detailTabFocus('현장·견적',true)});
  for(const id of ['dv-qamt','dv-wamt'])assert.equal(await page.locator('#'+id).getAttribute('readonly'),'');
  await page.locator('#dv-amt').fill('200000');
  await page.evaluate(()=>{
   window.pendingRows=[];window.requestCount=0;window.queueMode='throw';
   Object.assign(Phase1.queue,{list:()=>pendingRows,flush:async()=>{if(queueMode==='reject'){pendingRows.at(-1).status='rejected';throw Error('SERVER_REJECTED')}if(queueMode==='pending')await new Promise(resolve=>window.releaseAmount=resolve)}});
   pushWrite=(op,payload)=>{requestCount++;OperationalAdapter.normalize(op,payload.opportunity_id,1,payload);if(queueMode==='throw')throw Error('ADAPTER_REJECTED');pendingRows.push({request_id:'request-'+requestCount,object_id:payload.opportunity_id,operation:op,status:'pending',payload});return 'request-'+requestCount};
  });
  assert.equal(await page.evaluate(()=>saveBasics()),false);
  assert.equal(await page.evaluate(()=>fixture.deal.amt),100000);
  assert.equal(await page.evaluate(()=>fixture.deal.wonAmt),70000);
  assert.equal(await page.evaluate(()=>{queueMode='reject';return saveBasics()}),false);
  assert.equal(await page.evaluate(()=>fixture.deal.amt),100000);
  console.log('P1: rejection checked');
  await page.evaluate(()=>{queueMode='pending';window.savingAmount=saveBasics()});
  assert.equal(await page.evaluate(()=>saveBasics()),false,'duplicate submit blocked');
  assert.equal(await page.locator('#dv-amount-save').isDisabled(),true,JSON.stringify(await page.evaluate(()=>({err:document.getElementById('dv-err').textContent,rows:pendingRows,mode:queueMode,requests:requestCount,pending:DETAIL_AMOUNT_PENDING,flush:String(Phase1.queue.flush)}))));
  assert.equal(await page.evaluate(()=>fixture.deal.amt),100000,'pending does not mutate');
  assert.equal(await page.evaluate(()=>pendingRows.at(-1).payload.won_amount),null,'won snapshot is never submitted');
  await page.evaluate(()=>{const row=pendingRows.at(-1);row.status='done';row.ack={amount:200000,quote_amount:90000,version:2};releaseAmount()});
  console.log('P1: ACK released');
  assert.equal(await page.evaluate(()=>savingAmount),true);
  assert.equal(await page.evaluate(()=>fixture.deal.amt),200000);
  assert.equal(await page.evaluate(()=>fixture.deal.quoteAmt),90000);
  assert.equal(await page.evaluate(()=>fixture.deal.wonAmt),70000);
  console.log('P1: ACK applied');
  await page.locator('#dv-amt').fill('0');
  await page.evaluate(()=>{window.savingAmount=saveBasics()});
  await page.evaluate(()=>{drwInq(JSON.stringify(fixture.q));const row=pendingRows.at(-1);row.status='done';row.ack={amount:0,quote_amount:90000,version:3};releaseAmount()});
  assert.equal(await page.evaluate(()=>savingAmount),true);
  assert.equal(await page.evaluate(()=>CUR_DETAIL.kind),'inq','ACK cannot switch the current detail');
  assert.equal(await page.evaluate(()=>fixture.deal.amt),0);
  assert.equal(await page.evaluate(()=>fixture.q.amt),undefined);
  assert.equal(await page.evaluate(()=>saveBasics()),false,'inquiry save guarded');
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(fixture.deal));detailTabFocus('현장·견적',true);briefAmountEditor()});
  await page.screenshot({path:'C:/Users/Administrator/.codex/visualizations/2026/09/05/01a073a6-2a59-7320-9bc6-0eb52f2c7a2a/detail-p1-amount.png'});
  const uncertain=await page.evaluate(async()=>{const n=requestCount;pendingRows.push({operation:'amount',object_id:fixture.deal.id,status:'uncertain'});document.getElementById('dv-amt').value='500000';const result=await saveBasics();pendingRows.pop();return {result,new_requests:requestCount-n,value:fixture.deal.amt}});
  assert.deepEqual(uncertain,{result:false,new_requests:0,value:0});
  await page.evaluate(()=>drwInq(JSON.stringify(fixture.q)));
  const routing=await page.evaluate(()=>{window.routeCalls=[];goPage=p=>routeCalls.push(p);inqCtlOpenSingle=key=>routeCalls.push(key);openInquiryWork();return routeCalls});
  assert.deepEqual(routing,['inq','69caf08e-daea-4eac-aa39-82c85f1f3d08']);
  console.log(JSON.stringify({status:'PASS',same_name_not_linked:true,explicit_navigation:true,reverse_lineage:true,ambiguous_link_blocked:true,inquiry_money_absent:true,escaped_inquiry_text:true,quote_won_readonly:true,rejected_and_pending_unchanged:true,ack_only_amount:true,zero_amount:true,double_click_blocked:true,navigation_during_save:true,external_writes:0}));
 }finally{await browser.close();await new Promise(r=>server.close(r))}
}
run().catch(e=>{console.error(e);process.exitCode=1});
