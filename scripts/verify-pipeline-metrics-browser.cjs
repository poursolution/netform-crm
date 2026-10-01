'use strict';
/* 파이프라인 3지표 검사(2026-10-01): 주간 브리핑·성과 분석·영업사원 관리가 같은 값을 보이고, 건수는 파이프라인 메뉴 숫자와 같다 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineMetrics&&window.PipelineWorkspace);
  await page.evaluate(()=>{
   const mk=(id,code,amt,extra)=>Object.assign({id,site:'현장 '+id,assignee:'이필선',brand:'POUR솔루션',created:CUR_Y+'-09-01',code,stage_code:code,grp:'영업·관리',amt},extra||{});
   B={deals:[mk('a','consulting',1e8),mk('b','sent',2e8),mk('c','bidding',3e8),mk('d','contract',4e8),mk('w','won',5e8,{outcome:'won',lifecycle_status:'closed',won_amount:5e8}),mk('l','lost',6e8,{outcome:'lost',lifecycle_status:'closed'})],inquiries:[],activities:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');window.pushWrite=()=>{};goPage('pipe');
  });
  const s=await page.evaluate(()=>({s:PipelineMetrics.summary(),badge:document.querySelector('.menu [data-p="pipe"] .badge').textContent}));
  assert.equal(s.s.count,4,'수주·실주 제외 4건');assert.equal(String(s.s.count),s.badge,'메뉴 숫자와 같은 건수');
  assert.equal(s.s.total,10e8);assert.equal(s.s.nearCount,2,'입찰·계약 2건');assert.equal(s.s.near,7e8);
  assert.ok(s.s.weighted>0&&s.s.weighted<s.s.total,'가중 예상은 전체보다 작다');
  /* 영업사원 관리 새 화면은 자체 숫자 4개가 이 띠를 대신한다(띠 없음). 예전 화면에서는 세 화면 모두 같은 띠 */
  await page.evaluate(()=>goPage('repmanage'));await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>document.querySelectorAll('#pg-repmanage>.pm-strip').length),0,'영업사원 관리 새 화면에는 공통 기준 띠가 없다');
  assert.equal(await page.evaluate(()=>{goPage('brief');return 0;}),0);await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>document.querySelectorAll('#pg-brief>.pm-strip').length),0,'주간 브리핑 새 화면에도 공통 기준 띠가 없다');
  await page.evaluate(()=>{G.repsV2Off=true;G.briefV2Off=true;});
  const texts=[];
  for(const p of ['brief','perf','repmanage']){await page.evaluate(p=>goPage(p),p);await page.waitForTimeout(450);texts.push(await page.evaluate(p=>{const el=document.querySelector('#pg-'+p+'>.pm-strip');return el?el.textContent.replace(/\s+/g,' ').trim():null},p));}
  assert.ok(texts.every(Boolean),'세 화면 모두 띠 표시 '+JSON.stringify(texts));
  assert.equal(new Set(texts).size,1,'세 화면의 값이 같다');
  assert.match(texts[0],/전체 진행.*4건.*가중 예상.*확정 임박.*2건/);
  /* 본문 숫자도 같은 지표(2026-10-01): 주간 브리핑 '진행 파이프라인', 대시보드 '파이프라인' KPI */
  await page.evaluate(()=>goPage('brief'));await page.waitForTimeout(450);
  const briefStat=await page.evaluate(()=>{const b=[...document.querySelectorAll('.brief-stat')].find(x=>/진행 파이프라인/.test(x.textContent));return b?b.textContent.replace(/\s+/g,' '):null});
  if(briefStat!==null)assert.match(briefStat,/진행 파이프라인\s*4건/,'브리핑 본문 '+briefStat);
  await page.evaluate(()=>goPage('dash'));await page.waitForTimeout(900);
  const dashKpi=await page.evaluate(()=>{const b=[...document.querySelectorAll('.dc-kpi')].find(x=>x.querySelector('.dc-ph')?.textContent==='파이프라인');return b?{text:b.textContent.replace(/\s+/g,' '),action:b.dataset.siAction,value:b.dataset.value}:null});
  assert.ok(dashKpi&&/진행 4건/.test(dashKpi.text)&&dashKpi.action==='navigate'&&dashKpi.value==='pipe','대시보드 KPI '+JSON.stringify(dashKpi));
  /* 다시 들어와도 한 개만 */
  await page.evaluate(()=>{goPage('today');goPage('brief');});await page.waitForTimeout(450);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('#pg-brief .pm-strip').length),1);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',count:s.s.count,same_on_pages:3,matches_badge:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
