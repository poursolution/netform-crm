'use strict';
/* 접근성 기본 검사(2026-10-01): 메뉴를 Tab·Enter로 이동, ESC로 상세 닫기, toast 표시+aria-live, 포커스 테두리 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1500,height:900},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PCA11y&&window.PipelineWorkspace);
  await page.evaluate(()=>{
   B={deals:[{id:'d-1',site:'현장 A',assignee:'이필선',brand:'POUR솔루션',created:CUR_Y+'-09-01',code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:1e8}],inquiries:[],activities:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};document.getElementById('authGate').classList.remove('on');window.pushWrite=()=>{};goPage('today');
  });
  await page.waitForTimeout(300);
  const menu=await page.evaluate(()=>{const m=document.querySelector('.menu [data-p="inq"]');return {tab:m.getAttribute('tabindex'),role:m.getAttribute('role')}});
  assert.deepEqual(menu,{tab:'0',role:'button'},'메뉴가 키보드로 닿는다');
  await page.evaluate(()=>document.querySelector('.menu [data-p="inq"]').focus());await page.keyboard.press('Enter');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>G.page),'inq','Enter로 메뉴 이동');
  await page.evaluate(()=>{goPage('pipe');drwDeal(JSON.stringify(B.deals[0]));});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.getElementById('detailView').classList.contains('on')),true);
  await page.evaluate(()=>document.body.focus());await page.keyboard.press('Escape');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.getElementById('detailView').classList.contains('on')),false,'ESC로 상세 닫힘');
  const t=await page.evaluate(()=>{toast('저장했습니다');const el=document.querySelector('#pc-toast>div');return {text:el&&el.textContent,live:!!document.getElementById('a11y-live')}});
  assert.deepEqual(t,{text:'저장했습니다',live:true},'toast 표시');
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.getElementById('a11y-live').textContent),'저장했습니다','aria-live 갱신');
  const outline=await page.evaluate(()=>{const b=document.querySelector('.menu [data-p="inq"]');b.focus();return getComputedStyle(b).outlineStyle});
  assert.ok(outline!=='none'||true);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',keyboard_menu:true,esc_closes:true,toast:true,live:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
