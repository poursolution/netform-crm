'use strict';
/* 기록률 KPI 검사(2026-10-01): 관리팀 KPI 아래 담당자별 첫 연락·활동·다음 할 일 기록률, 지난주 대비 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.RecordingKPI&&window.PipelineWorkspace);
  const r=await page.evaluate(()=>{
   const iso=d=>new Date(Date.now()-d*864e5).toISOString();
   const mk=(id,owner,extra)=>Object.assign({id,site:'현장 '+id,assignee:owner,brand:'POUR솔루션',created:CUR_Y+'-09-01',code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:1e8,activities:[]},extra||{});
   B={deals:[mk('a','이필선',{activities:[{type:'전화',note:'통화',at:iso(1)}],next_action:{id:'na-1',text:'견적 확인',due:iso(2).slice(0,10),status:'open'}}),mk('b','이필선',{activities:[{type:'전화',note:'통화',at:iso(10)}]}),mk('c','황윤선',{activities:[]})],
    inquiries:[{id:'q1',site:'문의1',assignee:'이필선',assigned_to:'이필선',status:'배정완료',at:iso(3),assigned_at:iso(3),first_response_at:iso(2)},{id:'q2',site:'문의2',assignee:'이필선',assigned_to:'이필선',status:'배정완료',at:iso(4),assigned_at:iso(4)}],activities:[]};
   LOCAL={deals:{},inquiries:{}};G.kpiV2Off=true;/* 예전 화면 검사 — 새 화면은 verify-kpi-v2 */AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');window.pushWrite=()=>{};goPage('mgmt');
   const s=RecordingKPI.stats('이필선',0);const panel=document.querySelector('#mgmt-root .rk-panel');
   return {s,has:!!panel,rows:panel?[].map.call(panel.querySelectorAll('tbody tr'),tr=>tr.textContent.replace(/\s+/g,' ').trim()):[]};
  });
  assert.equal(r.has,true,'패널 표시');
  assert.equal(r.s.deals,2);assert.equal(r.s.first,50,'첫 연락 기록률 1/2');assert.equal(r.s.activity,50,'7일 내 활동 1/2');assert.equal(r.s.next,50,'다음 할 일 1/2');
  assert.ok(r.rows.some(x=>/^이필선250%50%50%$/.test(x.replace(/\s/g,''))),'표 '+r.rows.join(' | '));
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',panel:true,first:r.s.first,activity:r.s.activity,next:r.s.next}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
