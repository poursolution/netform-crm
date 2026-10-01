'use strict';
/* 공통 오류 표시 검사(2026-10-01): 읽기 실패 → 띠 + 다시 시도(loadData 재실행), 5xx → 기능 이름으로 표시, 성공하면 사라짐 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PCErrorState&&window.PipelineWorkspace);
  await page.evaluate(()=>{B={deals:[],inquiries:[],activities:[]};LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};document.getElementById('authGate').classList.remove('on');window.pushWrite=()=>{};goPage('today');});
  /* 읽기 실패 */
  await page.evaluate(()=>{window.__retries=0;window.loadData=async()=>{window.__retries++;window.dispatchEvent(new CustomEvent('crm:read-state',{detail:{label:'데이터 최신',ready:true,detail:''}}));};window.dispatchEvent(new CustomEvent('crm:read-state',{detail:{label:'일부 데이터 최신 · 문의 갱신 필요',ready:false,detail:'문의: 조회 실패'}}));});
  const b1=await page.evaluate(()=>{const b=document.getElementById('crm-error-banner');return b&&{inMain:b.parentElement.classList.contains('main'),text:b.textContent,retry:!!b.querySelector('[data-act=retry]')}});
  assert.ok(b1&&b1.inMain&&b1.retry&&/불러오지 못했습니다/.test(b1.text)&&/문의: 조회 실패/.test(b1.text),'읽기 실패 띠 '+JSON.stringify(b1));
  await page.click('#crm-error-banner [data-act=retry]');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__retries),1,'다시 시도가 loadData 실행');
  assert.equal(await page.evaluate(()=>!!document.getElementById('crm-error-banner')),false,'성공하면 띠 사라짐');
  /* 5xx */
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('crm:rpc-error',{detail:{name:'crm_site_link_review_list_v1',status:500,message:'division by zero'}})));
  const b2=await page.evaluate(()=>{const b=document.getElementById('crm-error-banner');return b&&b.textContent});
  assert.ok(/과거자료 연결 검토 목록 — 서버 오류 500/.test(b2)&&/division by zero/.test(b2),'5xx 표시 '+b2);
  await page.click('#crm-error-banner [data-act=close]');
  assert.equal(await page.evaluate(()=>!!document.getElementById('crm-error-banner')),false);
  /* 전송 계층이 5xx를 알린다 */
  const t=fs.readFileSync(path.join(root,'pc-manager-transport.js'),'utf8');assert.match(t,/crm:rpc-error/);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',read_fail_banner:true,retry:true,rpc_5xx:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
