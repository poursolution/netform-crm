'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const p=path.join(root,new URL(req.url,'http://x').pathname.replace(/^\//,''));if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404).end();return}res.setHeader('content-type',p.endsWith('.html')?'text/html; charset=utf-8':'application/javascript');res.end(fs.readFileSync(p))});
(async()=>{await new Promise(r=>server.listen(4184,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 for(const width of [320,390]){const page=await browser.newPage({viewport:{width,height:844}});await page.goto('http://127.0.0.1:4184/mobile.html?demo=1');await page.waitForFunction(()=>window.G&&window.DEALS);
  await page.evaluate(()=>{DEMO=true;Phase1.profile={allowed_modes:['admin']};G.user={id:'admin-test',nm:'송보람'};G.mode='admin';G.tab='today';ADMIN.inquiries=[inquiryViewM({id:'inq-mobile-today',site:'모바일 견적문의',status:'접수',created_at:new Date(Date.now()-4*36e5).toISOString()})];DEALS.unshift(normalizeDeal({id:'deal-mobile-today',nm:'모바일 파이프라인',rep:'김성민',code:'consulting',lastAt:daysAgoIso(20),stageAt:daysAgoIso(20),nextAction:null,activities:[],amt:10000000}));render()});
  const adminText=await page.locator('#scr').innerText();assert.equal(await page.getByText('오늘 관리자 개입',{exact:true}).count(),1,adminText);assert.equal(await page.getByRole('button',{name:/견적문의 관리/}).count(),1);assert.equal(await page.getByText(/담당자 미배정/).count()>0,true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:/파이프라인 관리/}).click();assert.equal(await page.getByText('모바일 파이프라인',{exact:true}).count(),1);await page.getByText('모바일 파이프라인',{exact:true}).click();assert.equal(await page.evaluate(()=>String(G.deal)),'deal-mobile-today');
  await page.evaluate(()=>{G.deal=null;G.mode='rep';G.user={id:'rep-test',nm:'황윤선'};G.tab='today';render()});assert.equal(await page.getByText('오늘 우선순위',{exact:true}).count(),1);assert.equal(await page.getByText('오늘 업무',{exact:true}).count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.close();
 }
 console.log(JSON.stringify({pass:10,fail:0,widths:[320,390],writes:0}));
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
