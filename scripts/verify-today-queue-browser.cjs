'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const launchOptions=()=>({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
async function run(){
 const srv=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'crm.html',file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}fs.createReadStream(file).pipe(res)});
 await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch(launchOptions());
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:'+srv.address().port+'/crm.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.TodayWorkQueue);
  await page.evaluate(()=>{
   const day=n=>{const d=new Date();d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
   const recent=new Date(Date.now()-5*36e5).toISOString();
   const deal=(id,owner,code,due)=>({id,site:id+' 현장',assignee:owner,code,grp:'영업·관리',created:day(-30),lastMeaningfulContactAt:day(-1),nextActionObj:{text:'고객 진행상황 확인',due:day(due),status:'open'}});
   B={inquiryTrash:[],inquiries:[{id:'inq-unassigned',site:'미배정 문의',brand:'POUR솔루션',created_at:recent,status:'접수'},{id:'inq-owned',site:'김성민 문의',brand:'POUR솔루션',created_at:recent,assigned_at:recent,assignee:'김성민',status:'배정완료'}],deals:[deal('pipe-late','김성민','consulting',-3),deal('pipe-today','이필선','sent',0),deal('rel-today','김성민','rapport',0),deal('rel-late','이필선','waiting',-7)],expansion_pool:[{id:'exp-a',source_opportunity_id:'won-a',site:'확장 김성민',owner_name:'김성민',next_contact_at:day(0),expansion_status:'접촉 예정'},{id:'exp-b',source_opportunity_id:'won-b',site:'확장 이필선',owner_name:'이필선',next_contact_at:day(-2),expansion_status:'관계 관리중'},{id:'exp-done',source_opportunity_id:'won-done',site:'전환 완료 확장',owner_name:'김성민',next_contact_at:day(-2),created_opportunity_id:'new-deal'},{id:'exp-held',source_opportunity_id:'won-held',site:'보류 확장',owner_name:'김성민',next_contact_at:day(-2),expansion_status:'보류/휴면'},{id:'exp-inferred',source_opportunity_id:'won-inferred',site:'계산일 확장',owner_name:'김성민',completion_date:day(-40),expansion_status:'신규 대상'}]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={name:'송보람',role:'admin'};G.page='today';G.q='무관한 검색';G.rep='없는 담당자';G.expansionYear='2024';G.expansionOwner='없는 담당자';
   document.getElementById('authGate').classList.remove('on');document.querySelectorAll('.apage').forEach(n=>n.classList.remove('on'));document.getElementById('pg-today').classList.add('on');
   window.__writes=[];pushWrite=(op,p)=>{window.__writes.push({op,p});return 'test'};
   window.__opened=null;drwDeal=text=>window.__opened={type:'deal',id:JSON.parse(text).id};drwInq=text=>window.__opened={type:'inq',id:JSON.parse(text).id};ExpansionPool.open=id=>window.__opened={type:'expansion',id};todayAssignInquiry=id=>window.__opened={type:'assign',id};dccGoActivity=()=>window.__contact=true;
   goPage('today');
  });
  assert.equal(await page.locator('.twq-admin-boards').count(),1);
  assert.equal(await page.locator('.today-admin-inquiry').count(),1);
  assert.equal(await page.locator('.today-admin-pipeline').count(),1);
  assert.equal(await page.locator('.today-admin-inquiry .twq-row').count(),2);
  assert.equal(await page.locator('.today-admin-pipeline .twq-row').count(),7);
  assert.equal(await page.locator('.twq-counts').count(),1);
  assert.equal(await page.locator('.twq-row').count(),9);
  for(const width of [1920,1440,1280]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(()=>new Promise(requestAnimationFrame));
   const typography=await page.evaluate(()=>({
    sizes:Array.from(document.querySelectorAll('.twq-admin-boards tbody td,.twq-admin-boards tbody td *')).filter(n=>!n.closest('small')).map(n=>getComputedStyle(n).fontSize),
    secondary:Array.from(document.querySelectorAll('.twq-admin-boards tbody td small,.twq-admin-boards tbody td small *')).map(n=>getComputedStyle(n).fontSize),
    headers:Array.from(document.querySelectorAll('.twq-list th')).every(n=>getComputedStyle(n).whiteSpace==='nowrap'),
    types:Array.from(document.querySelectorAll('.twq-list td[data-label="유형"]')).every(n=>n.scrollWidth<=n.clientWidth),
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
   }));
   assert.ok(typography.sizes.every(x=>x==='12px'),'core text size '+width);
   assert.ok(typography.secondary.length>0&&typography.secondary.every(x=>x==='11px'),'secondary text size '+width);
   console.log('PASS computed typography '+width+': both boards core=12px, secondary=11px');
   assert.equal(typography.headers,true);if(!typography.types)console.log(await page.locator('.twq-list col').evaluateAll(ns=>ns.map(n=>({width:getComputedStyle(n).width,table:n.closest('table').clientWidth}))));assert.equal(typography.types,true,'type overflow '+width);assert.equal(typography.overflow,false);
  }
  await page.setViewportSize({width:1440,height:1000});
  assert.equal(await page.locator('.twq-row').first().getAttribute('data-key'),'inq:inq-unassigned');
  assert.equal(await page.getByText('전환 완료 확장',{exact:true}).count(),0);
  assert.equal(await page.getByText('보류 확장',{exact:true}).count(),0);
  assert.match(await page.locator('[data-key="expansion:won-inferred"].twq-row').textContent(),/계산 일정/);
  assert.equal(await page.evaluate(()=>TodayWorkQueue.data().rows.filter(x=>x.key==='deal:rel-today').length),1);
  await page.getByRole('combobox',{name:'오늘 업무 담당자'}).selectOption('김성민');
  assert.equal(await page.getByRole('combobox',{name:'오늘 업무 유형'}).count(),0);
  await page.locator('.twq-counts [data-filter="overdue"]').click();assert.equal(await page.locator('.today-admin-inquiry .twq-row').count(),1);assert.equal(await page.locator('.today-admin-pipeline .twq-row').count(),1);
  await page.locator('.twq-counts [data-filter="all"]').click();
  await page.locator('.twq-row[data-key="expansion:won-a"] .twq-action').click();
  assert.deepEqual(await page.evaluate(()=>window.__opened),{type:'expansion',id:'exp-a'});
  await page.getByRole('combobox',{name:'오늘 업무 담당자'}).selectOption('전체');
  await page.locator('.twq-row[data-key="deal:rel-late"] .twq-action').click();
  assert.deepEqual(await page.evaluate(()=>window.__opened),{type:'deal',id:'rel-late'});assert.equal(await page.evaluate(()=>window.__contact),true);
  await page.locator('.twq-row[data-key="inq:inq-unassigned"] .twq-action').click();assert.deepEqual(await page.evaluate(()=>window.__opened),{type:'assign',id:'inq-unassigned'});
  await page.locator('.twq-row[data-key="deal:pipe-late"] .twq-site').click();assert.deepEqual(await page.evaluate(()=>window.__opened),{type:'deal',id:'pipe-late'});
  for(const width of [1440,1024,760,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'overflow at '+width)}
  await page.setViewportSize({width:1440,height:1000});
  if(process.env.TODAY_WORK_SCREENSHOT)await page.screenshot({path:process.env.TODAY_WORK_SCREENSHOT,fullPage:true});
  await page.evaluate(()=>{ME={name:'김성민',role:'rep'};paintTodayHome()});
  assert.equal(await page.getByRole('combobox',{name:'오늘 업무 담당자'}).count(),0);
  assert.equal(await page.locator('.twq-row').count(),5);
  assert.equal(await page.locator('.today-rep-priority').count(),1);assert.equal(await page.locator('.today-rep-routine').count(),1);
  assert.equal(await page.locator('.twq-row[data-key="deal:rel-today"]').count(),1);
  assert.equal(await page.evaluate(()=>TodayWorkQueue.data().rows.every(x=>x.owner==='김성민')),true);
  // A previously visible admin row cannot be opened after the current role changes.
  await page.evaluate(()=>{window.__opened=null;TodayWorkQueue.open('deal:rel-late')});assert.equal(await page.evaluate(()=>window.__opened),null);
  await page.evaluate(()=>{ME={name:'송보람',role:'admin'};const at=new Date(Date.now()-36e5).toISOString();B.inquiries=Array.from({length:51},(_,i)=>({id:'page-'+i,site:'페이지 현장 '+i,created_at:at,brand:'POUR솔루션',status:'접수'}));B.deals=[];B.expansion_pool=[];paintTodayHome()});
  assert.equal(await page.locator('.twq-row').count(),20);await page.getByRole('navigation',{name:'견적문의 관리 페이지'}).getByRole('button',{name:'3',exact:true}).click();assert.equal(await page.locator('.twq-row').count(),11);
  await page.getByRole('textbox',{name:'오늘 업무 검색'}).fill('페이지 현장 50');await page.getByRole('button',{name:'검색',exact:true}).click();assert.equal(await page.locator('.twq-row').count(),1);
  assert.equal(await page.evaluate(()=>G.todayInquiryPage),1);
  assert.equal(await page.evaluate(()=>window.__writes.length),0);
  console.log(JSON.stringify({status:'PASS',admin_boards:['inquiry','pipeline'],independent_pages:true,types:4,independent_compound_filters:true,counter_list_agreement:true,exact_id_navigation:4,role_scope:true,stale_role_click_blocked:true,expansion_inference_label:true,converted_held_excluded:true,pagination_51_rows:true,viewports:[1440,1024,760,390],external_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}
run().catch(e=>{console.error(e.stack);process.exitCode=1});
