'use strict';
/* 수주율 검사(2026-10-01): 실주 단계 화면에 브랜드·공종·담당자별 수주율 — 수주 ÷ (수주+실주), 표본 3건 미만은 흐리게 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineWorkspace&&window.StageWorkspaces);
  const r=await page.evaluate(()=>{
   const mk=(id,brand,owner,out)=>({id,site:'현장 '+id,assignee:owner,brand,created:CUR_Y+'-03-01',code:out,stage_code:out,grp:out==='won'?'수주 성공':'수주 실패',amt:1e8,outcome:out,lifecycle_status:'closed',won_amount:out==='won'?1e8:null,closed_at:CUR_Y+'-09-10',lost_reason:out==='lost'?'가격 열세':null});
   const deals=[];let n=0;
   [['POUR솔루션','이필선','won'],['POUR솔루션','이필선','won'],['POUR솔루션','이필선','lost'],['POUR솔루션','황윤선','lost'],['석민이앤씨','황윤선','won'],['석민이앤씨','황윤선','lost']].forEach(x=>deals.push(mk('w'+(n++),x[0],x[1],x[2])));
   B={deals,inquiries:[],activities:[]};LOCAL={deals:{},inquiries:{}};G.pipeListV2Off=true;/* 예전 단계 화면 검사 — 새 목록은 verify-pipeline-list-v2 */AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');window.pushWrite=()=>{};PipelineWorkspace.open('lost');
   return [].map.call(document.querySelectorAll('.sw-winrate'),b=>({title:b.querySelector('h4').textContent,rows:[].map.call(b.querySelectorAll(':scope>div'),d=>d.textContent.replace(/\s+/g,' ').trim()+(d.classList.contains('thin')?' [thin]':''))}));
  });
  const brand=r.find(x=>x.title==='브랜드별 수주율'),owner=r.find(x=>x.title==='담당자별 수주율');
  assert.ok(brand&&owner,'수주율 칸 표시 '+JSON.stringify(r.map(x=>x.title)));
  assert.ok(brand.rows.some(x=>/^POUR솔루션\s*50% 수주 2 · 실주 2$/.test(x)),'브랜드 '+brand.rows.join(' | '));
  assert.ok(brand.rows.some(x=>/^석민이앤씨\s*50% 수주 1 · 실주 1 \[thin\]$/.test(x)),'표본 적음 표시 '+brand.rows.join(' | '));
  assert.ok(owner.rows.some(x=>/^이필선\s*67% 수주 2 · 실주 1$/.test(x)),'담당자 '+owner.rows.join(' | '));
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',panels:r.length,brand:true,owner:true,thin:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
