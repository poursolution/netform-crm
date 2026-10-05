'use strict';
/* 문자 · 캠페인 B안 검사(2026-10-03 "파이프라인 기준으로"): 왼쪽 발송 진단(막대 3칸 · 숫자 3 · 사유 · 할 일 · 왜 못 보내나) / 오른쪽 확인할 묶음 · 정렬은 빨강 사유 순 · 보내기는 기존 창 · 끄면 v2 묶음 표 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.SmsB&&window.StageBoard&&window.SmsV2&&window.CommonFilterBar&&typeof paintCampaign==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const deal=(id,site,owner,code,contact,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-100),updated:day(-40),code,stage_code:code,grp:'영업·관리',amt:1e8,contacts:contact?[contact]:[]},extra||{});
   const ok=(n,name)=>({personKey:'p'+n,name,role:'관리소장',mobile:'010-1111-000'+n,smsConsent:true,consentAt:at(-30)});
   B={deals:[
     deal('11111111-1111-4111-8111-111111111111','[경기 용인] 역북금강아파트','황윤선','sent',ok(1,'김소장')),
     deal('22222222-2222-4222-8222-222222222222','[인천 서] 검암2차풍림아이원','황윤선','sent',{personKey:'p2',name:'박소장',role:'관리소장',mobile:'010-2222-0002'}),
     deal('33333333-3333-4333-8333-333333333333','번호 없는 현장','이필선','sent',{personKey:'p3',name:'최과장',role:'과장',mobile:''}),
     deal('44444444-4444-4444-8444-444444444444','침묵 현장','이필선','silent',ok(4,'이소장'),{brand:'석민이앤씨'})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],campaigns:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   siteContacts=d=>d.contacts||[];contactInfo=d=>(d.contacts||[])[0]||{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   goPage('campaign');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#sms-b');assert.equal(await v.count(),1,'B안 보드');assert.equal(await page.locator('#sms-v2').count(),0,'v2 묶음 표 없음');
  assert.equal(await page.locator('#pg-campaign>.cf-bar:not([hidden])').count(),1,'공통 필터줄');
  assert.equal(await page.evaluate(()=>document.getElementById('ptitle').textContent),'문자 · 캠페인');
  assert.deepEqual((await v.locator('.psb-axis .leg button').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')),['지금 보낼 때 · 병목 4','시즌 · 정기 관계 6','재활성 3']);
  assert.match(await v.locator('.psb-kpis').innerText(),/기준 넘김 \(빨강\)\s*\d+묶음[\s\S]*발송 가능\s*\d+명[\s\S]*이번 달 발송\s*0건\s*예약 0 · 실패·확인 0/);
  const reasons=await v.locator('.psb-reason span').allInnerTexts();
  assert.ok(reasons[0]==='병목 묶음 · 한 번도 안 보냄'||reasons[0]==='대상 있음 · 발송 가능 0명',JSON.stringify(reasons));
  assert.ok(reasons.includes('자동 제외 대상 있음'),JSON.stringify(reasons));
  assert.match(await v.locator('.sb-why').innerText(),/왜 못 보내나[\s\S]*문자 수신동의 없음 1명[\s\S]*휴대폰번호 없음 1명/);
  /* 묶음 줄: 자료 발송 후 무응답 = 대상 3 · 가능 1 · 발송 기록 없음 → 빨강 '한 번도 안 보냄' */
  const sent=v.locator('.psb-row[data-key="sent"]');assert.equal(await sent.count(),1);
  assert.match(await sent.innerText(),/자료 발송 후 무응답 — 후속 안내[\s\S]*병목 · 영업팀 · 영업 병목[\s\S]*지금 보낼 때[\s\S]*대상 3명 · 가능 1명 · 발송 기록 없음[\s\S]*병목 묶음 · 한 번도 안 보냄[\s\S]*0일[\s\S]*보내기/);
  const order=await v.locator('.psb-row').evaluateAll(a=>a.map(n=>n.dataset.key));
  assert.ok(order.indexOf('sent')<order.indexOf('yearend'),'빨강(병목) 먼저 '+JSON.stringify(order));
  assert.equal(await v.locator('.psb-row').count(),13,'묶음 13개');
  assert.match(await v.locator('.psb-row[data-key="yearend"]').innerText(),/연말 인사[\s\S]*시즌 · 전체 · 시즌 인사[\s\S]*(12월 15일|지남)/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 막대 칸 · 보드 · 머리 버튼 */
  await v.locator('.psb-axis .leg button').nth(2).click();await page.waitForTimeout(150);assert.equal(await page.locator('#sms-b .psb-row').count(),3);
  await page.locator('#sms-b [data-sb="clear"]').click();await page.waitForTimeout(150);
  await page.locator('#sms-b [data-sb="view"][data-v="board"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#sms-b .psb-col').count(),3);assert.equal(await page.locator('#sms-b .psb-card').count(),13);
  await page.locator('#sms-b [data-sb="view"][data-v="list"]').click();await page.waitForTimeout(150);
  assert.deepEqual(await page.locator('#sms-b .sb-top button').allInnerTexts().then(a=>a.filter(t=>!/테스트/.test(t))),['발송 이력','+ 문자 보내기']);
  /* 보내기 = 기존 v2 창(760px · 최종 확인란) · 발송 요청은 기존 campaignQueue 만 */
  await page.locator('#sms-b .psb-row[data-key="sent"] [data-sb="act"]').click();await page.waitForTimeout(250);
  const d=page.locator('#smsDialog.on .sd-box');assert.equal(await d.count(),1,'v2 보내기 창');assert.match(await d.locator('.sd-head').innerText(),/문자 보내기[\s\S]*자료 발송 후 무응답 — 후속 안내/);
  assert.deepEqual(await page.evaluate(()=>__writes.map(w=>w[0])),[],'여는 것만으로 발송 요청 없음');
  await page.keyboard.press('Escape');await page.waitForTimeout(150);
  /* 새 문자와 경남지사 진입도 최신 작성 창만 사용한다. 실제 발송 없음. */
  await page.locator('#sms-b [data-smb="new"]').click();
  assert.equal(await page.locator('#smsDialog.on').count(),1,'새 문자 최신 창');
  assert.equal(await page.locator('#campaign-root .cc-layout').count(),0,'구형 작성기 없음');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{window.__allForEntry=campaignAllTargets;window.campaignAllTargets=()=>__allForEntry().filter(t=>G.campaignRegion!=='경남지사'||t.deal.id==='11111111-1111-4111-8111-111111111111');campaignOpenGyeongnam();});
  assert.equal(await page.locator('#smsDialog.on').count(),1,'지사 문자 최신 창');
  assert.match(await page.locator('#smsDialog .sd-sum').innerText(),/대상\s*1명/,'지사 범위 유지');
  assert.equal(await page.locator('#campaign-root .cc-layout').count(),0);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{G.campaignRegion='전체';window.campaignAllTargets=__allForEntry;G.campaignCategory='all';const t=campaignAllTargets().find(t=>t.guard.ok);CAMPAIGN_STATE.selected={[t.key]:1};CAMPAIGN_STATE.body='보존할 작성 내용';G.campaignTab='send';paintCampaign();});
  assert.match(await page.locator('#smsDialog .sd-sum').innerText(),/대상\s*1명/,'선택 대상 보존');
  assert.equal(await page.locator('#smsDialog #sd-body').inputValue(),'보존할 작성 내용');
  assert.equal(await page.locator('#smsDialog #cc-final-approval').isChecked(),false,'최종 확인 초기화');
  assert.deepEqual(await page.evaluate(()=>__writes),[],'진입만으로 발송 안 함');
  if(shot)await page.screenshot({path:shot+'-current-entry.png'});
  await page.keyboard.press('Escape');
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.smsBOff=true;paintCampaign();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#sms-b').count(),0);assert.equal(await page.locator('#sms-v2').count(),1,'끄면 v2 묶음 표');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',board_frame:true,diagnosis_3bars:true,reasons:true,why_box:true,sort_red_first:true,filters:true,open_existing_dialog:true,no_send_on_open:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
