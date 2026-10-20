'use strict';
/* 아홉 메뉴 문구 정리(design_handoff_nine_menus · 2026-10-20) 캡처 — 검사가 아니라 화면 확인용. NM_SHOT=경로 접두어 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const srv=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000}});await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();await page.goto('http://127.0.0.1:'+srv.address().port+'/crm.html');await page.waitForFunction(()=>window.PipelineWorkspace&&window.KpiV7);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
   const mk=(id,code,extra)=>Object.assign({id,site:'현장 '+id,assignee:'이필선',brand:'POUR솔루션',created:'2026-05-01',code,stage_code:code,grp:'영업·관리',amt:2e8},extra||{});
   const deals=[mk('s1','sent',{stage_contexts:{sent:{fields:{sent_date:day(-12)}}}}),mk('s2','sent'),mk('s3','sent'),mk('s4','sent',{assignee:'황윤선'}),mk('c1','consulting'),mk('w1','won',{outcome:'won',won_amount:1.4e8,closed_at:day(-30)}),mk('l1','lost',{outcome:'lost',closed_at:day(-3)})];
   B={deals,inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   /* 서버 응답 흉내(검사 verify-work-v2 와 같음): 합치기 이력 · AI 추천 — 없으면 공종 분석이 '합치기 이력 확인 못 함 · 금액 집계 보류' 상태로 그려진다 */
   window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.OpsStore={settings:async()=>({}),aiOn:()=>true,ai:async()=>({id:'ai-1',suggestion:{keys:['옥상>우레탄'],primary:'옥상>우레탄',basis:'기록 확인'}}),decide:()=>{}};
   window.SB={rpc:async(name)=>name==='crm_gongjong_links_v1'?{data:{ok:true,links:[]}}:{error:{code:'PGRST202'}}};
  });
  const pre=process.env.NM_SHOT||'';
  const shot=async(name,fn)=>{await page.evaluate(fn);await page.waitForTimeout(500);if(pre)await page.screenshot({path:pre+'-'+name+'.png'});console.log('shot',name);};
  await shot('kpi',()=>{goPage('mgmt');setTimeout(()=>{try{const b=document.querySelector('#kpi-v7 [data-k7="tab"][data-v="stage"]');if(b)b.click();}catch(e){}},200);});
  await shot('work',()=>goPage('work'));
  await shot('report',()=>goPage('report'));
  await shot('sms',()=>goPage('campaign'));
  await shot('reps',()=>goPage('repmanage'));
  await shot('expansion',()=>goPage('expansion'));
  console.log(JSON.stringify({status:'PASS'}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
