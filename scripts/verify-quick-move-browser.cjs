'use strict';
/* 단계 바로 옮기기(2026-11-10 대표 피드백 ③ · quick-move.js) — 합성 자료(현장 이름은 지어낸 것)
   확인: 꼭 채울 칸이 없는 단계 = 창 없이 알림 → 4초 뒤 같은 저장 길 · 쓰기 단계(OperationalAdapter) 통과 · 다음 할 일 3일 후
        · [되돌리기] = 저장 없음 · [입력하고 옮기기] = 창 · 실주 · 계약 · 보류 = 창 · 끄기 G.quickMoveOff · 단계를 안 고르면 창 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1400,height:900},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);
  await page.waitForFunction(()=>window.StageTransitionUI&&window.QuickMove&&window.DealFrame7&&window.OperationalAdapter&&typeof goPage==='function');
  await page.evaluate(async()=>{
   const mk=(n,code)=>({id:'d000000'+n+'-0000-4000-8000-00000000000'+n,site:'[가상] 현장'+n,assignee:'송보람',brand:'석민이앤씨',created:'2026-08-01',code,stage_code:code,amt:1e8,amount:1e8,activities:[{id:'a'+n,type:'전화',note:'통화',at:'2026-11-01T10:00:00+09:00'}],workItems:[],version:3});
   B={deals:[mk(1,'sent'),mk(2,'consulting')],inquiries:[],activities:[],inquiryTrash:[],inquiryCleanupArchived:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__w=[];window.pushWrite=(op,p)=>{__w.push([op,JSON.parse(JSON.stringify(p))]);return 'q'+__w.length;};
   SB={rpc:async n=>n==='crm_settle_mode_v1'?{data:{ok:true,version:1}}:{error:{message:'X'}}};await SettleMode.check(true);
   goPage('pipe');await new Promise(r=>setTimeout(r,300));G._detailPopup=true;drwDeal(JSON.stringify(B.deals[0]));
  });
  await page.waitForTimeout(400);
  const add3=await page.evaluate(()=>{const x=new Date();x.setDate(x.getDate()+3);return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-');});
  /* ① 상세의 단계 고르기 → 창 없이 알림 → 4초 뒤 저장 */
  await page.evaluate(()=>{__w.length=0;document.querySelector('[data-dv3="mv"]').click();});
  await page.locator('[data-dv3="mvpick"]',{hasText:/^관계관리$/}).click();
  await page.waitForSelector('#qm-toast');
  assert.equal(await page.locator('#stage-transition-form').count(),0,'창을 열지 않음');
  assert.match(await page.locator('#qm-toast').innerText(),/옮깁니다 · 다음 할 일 \d+\/\d+ 진행 상황 확인/);
  assert.equal(await page.evaluate(()=>__w.filter(w=>w[0]==='transition').length),0,'4초 안에는 저장 안 함');
  await page.waitForTimeout(4300);
  const r1=await page.evaluate(()=>{const t=__w.find(w=>w[0]==='transition');let adapter='';try{OperationalAdapter.normalize('transition',t[1].opportunity_id,3,t[1]);adapter='ok';}catch(e){adapter=e.message;}return {code:CUR_DETAIL.item.code,adapter,note:t[1].note,next:CUR_DETAIL.item.nextActionObj&&CUR_DETAIL.item.nextActionObj.due,toast:!!document.getElementById('qm-toast')};});
  assert.equal(r1.code,'rapport');assert.equal(r1.adapter,'ok','쓰기 단계 통과');assert.match(r1.note,/단계 이동: 자료 발송완료 → /);assert.equal(r1.next,add3,'다음 할 일 = 3일 후');assert.equal(r1.toast,false);
  /* ② 되돌리기 · 입력하고 옮기기 · 창을 여는 단계 · 끄기 · 단계 안 고름 */
  const r2=await page.evaluate(async()=>{
   __w.length=0;drwDeal(JSON.stringify(B.deals[1]));await new Promise(r=>setTimeout(r,400));const d=CUR_DETAIL.item;const wait=ms=>new Promise(r=>setTimeout(r,ms));const form=()=>!!document.getElementById('stage-transition-form');
   StageTransitionUI.open(d,false,'compete');await wait(100);document.querySelector('#qm-toast [data-qm="undo"]').click();await wait(4300);
   const undo={transitions:__w.filter(w=>w[0]==='transition').length,code:d.code};
   StageTransitionUI.open(d,false,'compete');await wait(100);document.querySelector('#qm-toast [data-qm="full"]').click();await wait(300);const full=form();StageTransitionUI.close();
   const opens={};for(const to of ['lost','contract','waiting']){StageTransitionUI.open(d,false,to);await wait(200);opens[to]=form()&&!document.getElementById('qm-toast');StageTransitionUI.close();}
   G.quickMoveOff=true;StageTransitionUI.open(d,false,'compete');await wait(200);const off=form();StageTransitionUI.close();G.quickMoveOff=false;
   StageTransitionUI.open(d,false);await wait(200);const none=form();StageTransitionUI.close();
   return {undo,full,opens,off,none};
  });
  assert.deepEqual(r2.undo,{transitions:0,code:'consulting'},'되돌리기 = 저장 없음');
  assert.equal(r2.full,true,'입력하고 옮기기 = 창');
  assert.deepEqual(r2.opens,{lost:true,contract:true,waiting:true},'실주 · 계약(금액) · 보류는 창');
  assert.equal(r2.off,true,'끄기 G.quickMoveOff');assert.equal(r2.none,true,'단계를 안 고르면 창');
  assert.deepEqual(errs,[]);await ctx.close();
  console.log('verify-quick-move-browser: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
