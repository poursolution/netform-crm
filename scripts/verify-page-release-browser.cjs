'use strict';
/* 화면 떠날 때 DOM 해제 검사(2026-10-01): 메뉴 3회 순회 후 노드 수가 늘지 않고, 각 화면이 재진입 때 같은 내용으로 그려진다 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),assert=require('node:assert/strict');
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
   const codes=['consulting','sent','relationship','competition','contract','won','lost'];const deals=[],inqs=[];
   for(let i=0;i<120;i++){const c=codes[i%codes.length];deals.push({id:'d-'+i,site:'현장 '+i,assignee:['이필선','황윤선','한준엽'][i%3],brand:['POUR솔루션','석민이앤씨'][i%2],created:CUR_Y+'-0'+(1+i%9)+'-01',code:c,stage_code:c,grp:'영업·관리',amt:1e8*(1+i%5),outcome:c==='won'?'won':c==='lost'?'lost':null,lifecycle_status:['won','lost'].includes(c)?'closed':null,won_amount:c==='won'?1e8:null});}
   for(let i=0;i<80;i++)inqs.push({id:'q-'+i,site:'문의 현장 '+i,assignee:i%4?['이필선','황윤선','한준엽'][i%3]:'',status:['접수','배정완료','전화응대 완료','현장방문예정'][i%4],at:CUR_Y+'-09-'+String(1+i%28).padStart(2,'0')+'T09:00:00',brand:'POUR솔루션',raw:{'문의내용':'옥상 방수 문의 '+i}});
   B={deals,inquiries:inqs,activities:[]};LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};
   document.getElementById('authGate').classList.remove('on');window.pushWrite=()=>{};goPage('today');
  });
  const pages=['today','inq','pipe','expansion','sites','control','perf','repmanage','mgmt','brief','report','dup','work','campaign'];
  const count=()=>page.evaluate(()=>document.getElementsByTagName('*').length);
  const per={};
  for(let round=0;round<3;round++){
   for(const p of pages){
    await page.evaluate(p=>{try{goPage(p)}catch(e){}},p);await page.waitForTimeout(150);
    const n=await count();const own=await page.evaluate(p=>{const a=document.getElementById('pg-'+p);return a?a.getElementsByTagName('*').length+':'+(a.innerText||'').replace(/\s+/g,' ').trim().slice(0,40):'none'},p);(per[p]=per[p]||[]).push(n+' ('+own+')');
   }
  }
  const nodes=await page.evaluate(()=>{const m={};document.querySelectorAll('.apage').forEach(a=>m[a.id]=a.getElementsByTagName('*').length);m['body-direct']=[].filter.call(document.body.children,x=>!x.classList.contains('dash')).map(x=>x.id||x.className||x.tagName).join(',');return m});
  /* 2회차와 3회차가 같아야 한다(누적 없음) · 각 화면은 다시 들어와도 같은 내용으로 그려진다 */
  for(const p of pages){assert.equal(per[p][1],per[p][2],p+' 노드 누적');assert.ok(/^\d+ \(\d+:.+\)$/.test(per[p][2]),p+' 렌더');assert.equal(per[p][1].split(' (')[1],per[p][0].split(' (')[1],p+' 재진입 내용 동일');}
  const total2=Number(per.campaign[1].split(' ')[0]),peak=Math.max(...pages.map(p=>Number(per[p][2].split(' ')[0])));assert.ok(peak<4000,'전체 노드 상한 '+peak);assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',peak_nodes:peak,pages:pages.length,rounds:3}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
