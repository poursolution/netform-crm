'use strict';
/* 대표 첫 화면 정리(2026-11-09 대표 「전부 진행」 · boss-simple.js) — 합성 자료(이름 · 현장은 지어낸 것)
   확인: 대표 계정(송보람 = 영업관리 화면) 오늘 업무는 그대로(대표 지시로 정할 것 3칸 되돌림)
        · 배지(관계 · 확장 · 데이터 정리) · 메뉴 아래 '조치 필요' 숨김 · 끄기(G.bossSimpleOff) = 예전 화면 · 영업담당자 화면은 그대로 · 칸 누르면 해당 상세 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
async function open(browser,o){
 const ctx=await browser.newContext({viewport:{width:1500,height:1000},timezoneId:'Asia/Seoul'});
 await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(String(e.message||e)));
 await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);
 await page.waitForFunction(()=>window.TodayV3&&window.BossSimple&&window.PipelineScope&&window.InquiryWorkbench&&typeof goPage==='function');
 await page.evaluate(o=>{
  const U=n=>'aaaaaaaa-0000-4000-8000-0000000000'+String(n).padStart(2,'0'),now=Date.now(),ago=d=>new Date(now-d*864e5).toISOString();
  const deal=(n,site,code,owner,amt,x)=>Object.assign({id:U(n),site,site_id:'s-'+n,assignee:owner,brand:'POUR솔루션',created:'2026-10-03',code,stage_code:code,amt,amount:amt,activities:[],workItems:[],workSummary:'',version:3},x);
  const inq=(n,site,owner,days)=>({id:U(50+n),site,brand:'POUR솔루션',status:owner?'배정완료':'접수',at:ago(days),created_at:ago(days),assignee:owner||'',assigned_at:owner?ago(days-0.1):null,raw:{'문의내용':'옥상 방수 견적'}});
  B={deals:[deal(1,'[가상] 한빛마을아파트','consulting','이필선',520000000,{activities:[{id:'a1',type:'전화',note:'[전화 · 연결됨] 견적 검토',at:ago(45)}],lastActivity:ago(45)}),
    deal(2,'[가상] 푸른숲아파트','sent','황윤선',380000000,{activities:[{id:'a2',type:'전화',note:'[전화 · 연결됨] 자료 확인',at:ago(33)}],lastActivity:ago(33)}),
    deal(3,'[가상] 새솔단지','consulting','이필선',90000000,{activities:[{id:'a3',type:'전화',note:'[전화 · 연결됨] 통화',at:ago(2)}],lastActivity:ago(2)}),
    deal(4,'[가상] 아주큰단지','consulting','황윤선',900000000,{activities:[{id:'a4',type:'전화',note:'[전화 · 연결됨] 통화',at:ago(3)}],lastActivity:ago(3)})],
   inquiries:[inq(1,'[가상] 별빛마을',null,2),inq(2,'[가상] 은하수아파트',null,0.5),inq(3,'[가상] 소나무단지','이필선',3),inq(4,'[가상] 강변마을','황윤선',1.5),inq(5,'[가상] 햇살아파트','이필선',0.2)],
   activities:[],inquiryTrash:[],inquiryCleanupArchived:[],expansion_pool:[],dups:[]};
  LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME=o.me;G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';window.saveLocal=()=>{};
  document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
  SB={rpc:async()=>({error:{code:'PGRST202',message:'Could not find the function'}})};TOKEN='test';
  if(o.off)G.bossSimpleOff=true;PipelineScope._reset();goPage('today');
 },o);
 await page.waitForTimeout(900);
 return {ctx,page,errs};
}
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const boss={id:'adm',name:'송보람',role:'admin'};
  /* ① 대표 계정: 오늘 업무는 그대로(2026-11-09 대표 "오늘 업무는 건들지 마" — 정할 것 3칸 되돌림) · 메뉴 배지 · 조치 필요 문구만 정리 */
  {const {ctx,page,errs}=await open(browser,{me:boss});
   assert.equal(await page.locator('#today-v2 .bs').count(),0,'오늘 업무에 정할 것 3칸 없음(되돌림)');
   assert.equal(await page.locator('#today-v2 .tv6').count(),1,'오늘 업무 = 예전 4구역 화면 그대로');
   assert.equal(await page.evaluate(()=>document.body.classList.contains('bs-on')),false,'디자인 그대로 — 배지 · 메뉴 아래 문구 · 종 숨김 되돌림(2026-11-09 대표 \"디자인 건들지 마\")');
   assert.deepEqual(errs,[]);await ctx.close();}
  /* ② 끄기 = 예전 화면 */
  {const {ctx,page,errs}=await open(browser,{me:boss,off:true});
   assert.equal(await page.locator('#today-v2 .bs').count(),0);assert.equal(await page.locator('#today-v2 .tv6').count(),1);
   assert.equal(await page.evaluate(()=>document.body.classList.contains('bs-on')),false);
   assert.deepEqual(errs,[]);await ctx.close();}
  /* ③ 영업담당자(관리자 아님) = 그대로 */
  {const {ctx,page,errs}=await open(browser,{me:{id:'r1',name:'이필선',role:'rep'}});
   assert.equal(await page.locator('#today-v2 .bs').count(),0,'영업담당자 화면은 그대로');
   assert.equal(await page.evaluate(()=>BossSimple.on()),false);
   assert.deepEqual(errs,[]);await ctx.close();}
  console.log('verify-boss-simple-browser: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
