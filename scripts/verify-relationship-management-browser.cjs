'use strict';

// Localhost-only relationship page regression. Synthetic CRM rows; external traffic and writes are blocked.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');

const root=path.resolve(__dirname,'..');
function server(){return http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'crm.html',target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(res)})}
async function listenSafe(srv){for(const port of [4187,4188,4189,4190,4191]){try{await new Promise((resolve,reject)=>{const fail=error=>{srv.off('listening',ready);reject(error)},ready=()=>{srv.off('error',fail);resolve()};srv.once('error',fail);srv.once('listening',ready);srv.listen(port,'127.0.0.1')});return port}catch(error){if(error.code!=='EADDRINUSE')throw error}}throw new Error('No safe localhost verification port is available')}

async function run(){
 const srv=server(),port=await listenSafe(srv);
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof paintRelationshipManagement==='function'&&typeof relationshipManagerEscalation==='function');
  await page.evaluate(()=>{
   const day=n=>{const d=new Date();d.setDate(d.getDate()+n);const z=x=>String(x).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())};
   const at=n=>day(n)+'T12:00:00+09:00';
   B={inquiries:[],activities:[],inquiryTrash:[],deals:[
    {id:'rel-overdue',site:'기한초과 관계현장',assignee:'황윤선',brand:'POUR솔루션',code:'rapport',grp:'영업·관리',created:'2024-01-02',relationshipReason:'내년도 사업 검토',lastMeaningfulContactAt:at(-30),nextActionObj:{text:'관리소장 공사계획 확인',due:day(-5),status:'open'}},
    {id:'rel-today',site:'오늘 연락 관계현장',assignee:'이필선',brand:'석민이앤씨',code:'silent',grp:'영업·관리',created:'2025-01-02',relationshipReason:'예산 미확보',lastMeaningfulContactAt:at(-20),nextActionObj:{text:'예산 편성 여부 확인',due:day(0),status:'open'}},
    {id:'rel-missing',site:'정보누락 관계현장',assignee:'황윤선',brand:'POUR공법',code:'waiting',grp:'영업·관리',created:'2023-01-02'},
    {id:'rel-future',site:'예정 관계현장',assignee:'이필선',brand:'아파트스퀘어',code:'rapport',grp:'영업·관리',created:'2026-01-02',relationshipReason:'입주자대표회의 결정 대기',lastMeaningfulContactAt:at(-10),nextActionObj:{text:'입대의 결과 확인',due:day(10),status:'open'}},
    {id:'rel-stale',site:'장기 미접촉 현장',assignee:'황윤선',brand:'기술자문',code:'rapport',grp:'영업·관리',created:'2022-01-02',relationshipReason:'장기적인 관계 유지 필요',lastMeaningfulContactAt:at(-100),nextActionObj:{text:'안부 연락',due:day(100),status:'open'}},
    {id:'pipe-normal',site:'일반 파이프라인',assignee:'황윤선',brand:'POUR솔루션',code:'sent',grp:'영업·관리',created:'2026-01-02',amt:10000000}
   ]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=false;ME={name:'송보람',role:'admin'};G.page='relationship';G.relationshipFilter='all';G.relationshipOwner='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');window.__businessWrites=[];window.pushWrite=(op)=>{window.__businessWrites.push(op)};syncPage();
  });

  assert.equal(await page.locator('.relm-row').count(),5);
  assert.match(await page.locator('.relm-kpi.today b').innerText(),/^1건$/);
  assert.match(await page.locator('.relm-kpi.overdue b').innerText(),/^1건$/);
  assert.match(await page.locator('.relm-kpi.stale b').innerText(),/^1건$/);
  assert.equal(await page.getByText('일반 파이프라인',{exact:true}).count(),0);
  await page.locator('.relm-toolbar button').filter({hasText:'관리필요'}).click();
  assert.equal(await page.locator('.relm-row').count(),2);
  await page.locator('.relm-kpi').first().click();
  await page.locator('.relm-toolbar select').selectOption('황윤선');
  assert.equal(await page.locator('.relm-row').count(),3);

  await page.evaluate(()=>{AUTH_ON=true;ME={name:'이필선',role:'rep'};G.relationshipOwner='전체';G.relationshipFilter='all';paintRelationshipManagement()});
  assert.equal(await page.locator('.relm-row').count(),2);
  assert.equal(await page.locator('.relm-toolbar select').count(),0);

  await page.evaluate(()=>{AUTH_ON=false;ME={name:'송보람',role:'admin'};G.relationshipOwner='전체';G.relationshipFilter='all';paintRelationshipManagement();G._detailPopup=true;drwDeal(JSON.stringify(B.deals[5]));window.__businessWrites=[];StageTransitionUI.open(B.deals[5],false,'rapport')});
  assert.equal(await page.locator('#sf-relationship_reason').count(),1);
  assert.equal(await page.locator('#sf-contact_date').count(),1);
  await page.locator('#stage-transition-form button[type="submit"]').click();
  assert.match(await page.locator('#sf-error').innerText(),/관계관리 사유/);
  assert.equal(await page.evaluate(()=>B.deals[5].code),'sent');
  assert.deepEqual(await page.evaluate(()=>window.__businessWrites),[]);

  await page.evaluate(()=>{closeDetail();paintRelationshipManagement()});
  const pcNoOverflow=await page.evaluate(()=>document.getElementById('relationship-root').scrollWidth<=document.getElementById('relationship-root').clientWidth);
  assert.equal(pcNoOverflow,true);
  if(process.env.VERIFY_SCREENSHOT)await page.screenshot({path:process.env.VERIFY_SCREENSHOT,fullPage:true});
  await page.setViewportSize({width:375,height:812});await page.evaluate(()=>paintRelationshipManagement());
  const mobileNoOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
  assert.equal(mobileNoOverflow,true);
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals[5]));window.__businessWrites=[];StageTransitionUI.open(B.deals[5],false,'rapport')});
  await page.locator('#sf-relationship_reason').selectOption('내년도 사업 검토');
  await page.locator('#sf-reaction').fill('내년 예산 편성 후 재검토');
  await page.locator('#sf-contact_date').fill('2026-10-15');
  await page.locator('#stage-transition-form button[type="submit"]').click();
  assert.equal(await page.evaluate(()=>B.deals[5].code),'rapport');
  assert.equal(await page.evaluate(()=>B.deals[5].relationshipReason),'내년도 사업 검토');
  assert.deepEqual(await page.evaluate(()=>window.__businessWrites),['transition','activity','next_action']);
  console.log(JSON.stringify({status:'PASS',relationship_rows:5,need_filter:2,rep_scope:2,entry_reason_required:true,relationship_transition_success:true,pipeline_return_same_opportunity:true,non_relationship_excluded:true,pc_horizontal_scroll:false,mobile_horizontal_scroll:false,network_scope:'localhost-only',blocked_save_writes:0,simulated_success_writes:['transition','activity','next_action']}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
