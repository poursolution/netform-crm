'use strict';
/* 주소 동기화 검사(2026-10-01): 화면 이동·상세 열기가 해시에 적히고, 뒤로가기로 앱 안에서 되돌아간다 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PCRouter&&window.PipelineWorkspace);
  await page.evaluate(()=>{
   const mk=(id,code)=>({id,site:'현장 '+id,assignee:'이필선',brand:'POUR솔루션',created:CUR_Y+'-09-01',code,stage_code:code,grp:'영업·관리',amt:1e8});
   B={deals:[mk('d-1','consulting'),mk('d-2','sent')],inquiries:[],activities:[]};LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};
   document.getElementById('authGate').classList.remove('on');window.pushWrite=()=>{};goPage('today');
  });
  await page.waitForFunction(()=>location.hash==='#p=today',null,{timeout:5000});
  await page.evaluate(()=>goPage('pipe'));await page.waitForFunction(()=>location.hash==='#p=pipe');
  await page.evaluate(()=>drwDeal(JSON.stringify(B.deals[0])));await page.waitForFunction(()=>location.hash==='#p=pipe&deal=d-1');
  const open1=await page.evaluate(()=>document.getElementById('detailView').classList.contains('on'));assert.equal(open1,true,'상세 열림');
  await page.goBack();await page.waitForFunction(()=>location.hash==='#p=pipe');
  const open2=await page.evaluate(()=>document.getElementById('detailView').classList.contains('on'));assert.equal(open2,false,'뒤로가기로 상세 닫힘');
  await page.goBack();await page.waitForFunction(()=>location.hash==='#p=today');
  assert.equal(await page.evaluate(()=>G.page),'today','뒤로가기로 이전 화면');
  await page.goForward();await page.waitForFunction(()=>location.hash==='#p=pipe');assert.equal(await page.evaluate(()=>G.page),'pipe');
  /* 공유 링크: 해시로 들어오면 그 상세가 열린다 */
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html#p=pipe&deal=d-2`);await page.waitForFunction(()=>window.PCRouter);
  await page.evaluate(()=>{const mk=(id,code)=>({id,site:'현장 '+id,assignee:'이필선',brand:'POUR솔루션',created:CUR_Y+'-09-01',code,stage_code:code,grp:'영업·관리',amt:1e8});B={deals:[mk('d-1','consulting'),mk('d-2','sent')],inquiries:[],activities:[]};LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};document.getElementById('authGate').classList.remove('on');window.pushWrite=()=>{};});
  await page.waitForFunction(()=>G.page==='pipe'&&CUR_DETAIL&&CUR_DETAIL.key==='d-2'&&document.getElementById('detailView').classList.contains('on'),null,{timeout:8000});
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({status:'PASS',back_closes_detail:true,back_restores_page:true,deep_link:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
