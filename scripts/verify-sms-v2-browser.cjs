'use strict';
/* 문자 · 캠페인 v2 검사(2026-10-01 디자인 핸드오프 sms): 묶음 목록 + 문자 보내기 창.
   실제 발송은 막는다 — 발송 요청(pushWrite 'campaign_create')을 가로채 내용만 확인한다. 대상 추출·검수·개인화·발송 요청은 기존 함수. 끄면 예전 화면 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.SmsV2&&window.CommonFilterBar&&window.PipelineDiagnosis&&typeof paintCampaign==='function');
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
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   /* 연락처는 시험 자료의 contacts 를 그대로 쓴다 */
   siteContacts=d=>d.contacts||[];contactInfo=d=>(d.contacts||[])[0]||{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   goPage('campaign');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#sms-v2');assert.equal(await v.count(),1,'새 목록');
  assert.equal(await page.locator('#campaign-root .cc2-hero,#campaign-root .cc2-queue,#campaign-root .cc-home').count(),0,'예전 요약 줄·발송 큐 없음');
  assert.equal(await page.locator('#pg-campaign>.cf-bar:not([hidden])').count(),1,'공통 필터줄');
  assert.equal(await v.locator('.plv-owners').count(),0,'담당자별 칩 없음');
  assert.deepEqual(await v.locator('.plv-pills button').allInnerTexts(),['전체 13','병목 4','시즌 3','장기 관계 3','재활성 3']);
  /* 진단 */
  assert.deepEqual(await v.locator('.pd-kpi span').allInnerTexts(),['보낼 대상','발송 가능','이번 달 발송','발송 → 응답']);
  assert.match(await v.locator('.pd-kpis').innerText(),/보낼 대상\s*4명[\s\S]*발송 가능\s*2명\s*2명 자동 제외/);
  assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),['어디에 보낼까','언제 보낼까','왜 못 보내나']);
  assert.match(await v.locator('.pd-card').nth(2).innerText(),/문자 수신동의 없음[\s\S]*1[\s\S]*휴대폰번호 없음[\s\S]*1/);
  /* 묶음 표 */
  assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),['묶음 이름 · 출처','구분','대상','발송 가능','보낼 때','마지막 발송','']);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['지금 보낼 때','다가오는 시즌','정기 관계 문자','재활성']);
  assert.equal(await v.locator('.plv-row').count(),13);
  assert.match(await v.locator('.plv-row[data-bundle="sent"]').innerText(),/자료 발송 후 무응답 — 후속 안내[\s\S]*영업팀[\s\S]*병목[\s\S]*3명[\s\S]*1명[\s\S]*지금[\s\S]*기록 없음[\s\S]*보내기/);
  assert.equal(await v.locator('.plv-row[data-bundle="y3"] .plv-c .r').count(),1,'발송 가능 0은 빨강');
  assert.match(await v.locator('.plv-row[data-bundle="yearend"]').innerText(),/12월 15일[\s\S]*D-\d+/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  await v.locator('.plv-pills [data-value="soon"]').click();await page.waitForTimeout(150);assert.equal(await v.locator('.plv-row').count(),3);
  await v.locator('.plv-pills [data-value="all"]').click();await page.waitForTimeout(150);
  /* 보내기 창 */
  await v.locator('.plv-row[data-bundle="sent"] .plv-cta').click();await page.waitForTimeout(200);
  const d=page.locator('#smsDialog.on .sd-box');assert.equal(await d.count(),1);
  assert.match(await d.locator('.sd-head').innerText(),/문자 보내기[\s\S]*자료 발송 후 무응답 — 후속 안내[\s\S]*발송 이력/);
  assert.equal(await d.locator('.sd-steps span').count(),5);
  assert.match(await d.locator('.sd-sum').innerText(),/대상\s*3명[\s\S]*발송 가능\s*1명[\s\S]*자동 제외\s*2명/);
  assert.match(await d.locator('.sd-why').innerText(),/자동 제외 — [\s\S]*문자 수신동의 없음 1명[\s\S]*휴대폰번호 없음 1명|자동 제외 — [\s\S]*휴대폰번호 없음 1명[\s\S]*문자 수신동의 없음 1명/);
  assert.deepEqual(await d.locator('.sd-purpose button').allInnerTexts(),['안부 · 관계','점검 안내','시즌 인사','재제안']);
  assert.equal(await d.locator('.sd-rec').count(),3,'추천 문구');
  assert.equal(await d.locator('#sd-ad').isDisabled(),true,'수신거부 번호 미등록이면 자동 표기 잠금(예시 번호를 넣지 않음)');
  assert.equal(await d.locator('[data-sd="go"]').innerText(),'1명에게 보내기');
  /* 목적 칩을 누르면 추천 문구와 본문이 그 목적으로 바뀐다. 직접 쓴 문구는 지킨다 */
  {const before=await d.locator('.sd-rec b').allInnerTexts();const other=d.locator('.sd-purpose button[aria-pressed="false"]').first(),name=await other.innerText();await other.click();await page.waitForTimeout(150);
   assert.equal(await d.locator('.sd-purpose [aria-pressed="true"]').innerText(),name);assert.notDeepEqual(await d.locator('.sd-rec b').allInnerTexts(),before,'추천 문구가 목적에 맞게 바뀜');
   const body=await d.locator('#sd-body').inputValue();assert.ok(body.length>10,'본문도 새 목적의 첫 문구로');assert.equal(await d.locator('.sd-rec.on').count(),1);
   await d.locator('.sd-purpose button',{hasText:'시즌 인사'}).click();await page.waitForTimeout(150);assert.notEqual(await d.locator('#sd-body').inputValue(),body,'다른 목적 → 본문 변경');assert.match(await d.locator('#sd-body').inputValue(),/감사드립니다|기원/);
   await d.locator('#sd-body').fill('직접 쓴 문구입니다');await d.locator('.sd-purpose button',{hasText:'재제안'}).click();await page.waitForTimeout(150);assert.equal(await d.locator('#sd-body').inputValue(),'직접 쓴 문구입니다','직접 쓴 문구는 지킨다');assert.match((await d.locator('.sd-rec b').allInnerTexts()).join('|'),/가벼운 재접촉/);await d.locator('#sd-body').fill('');}
  /* 추천 문구 → 입력칸·미리보기(첫 대상 값으로 치환) */
  await d.locator('.sd-rec').first().click();await page.waitForTimeout(150);
  assert.ok((await d.locator('#sd-body').inputValue()).includes('[현장명]')||(await d.locator('#sd-body').inputValue()).length>10);
  assert.match(await d.locator('#sd-bubble').innerText(),/역북금강아파트|김소장/);assert.equal(await d.locator('#sd-bubble').innerText().then(t=>/\[현장명\]|\[고객호칭\]/.test(t)),false,'변수 치환');
  assert.match(await d.locator('#sd-bytes').innerText(),/^(SMS · \d+\/90 byte|LMS · \d+ byte)$/);
  await d.locator('[data-sd="var"]').first().click();assert.ok((await d.locator('#sd-body').inputValue()).endsWith('[고객호칭]'),'변수 칩은 문구 끝에 붙는다');
  if(shot)await page.screenshot({path:shot+'-dialog.png'});
  /* 확인란 없이 보내면 막힘 */
  await d.locator('[data-sd="go"]').click();assert.match(await d.locator('#sd-err').innerText(),/확인란/);assert.equal(await page.evaluate(()=>__writes.length),0);
  /* 예약 */
  await d.locator('[data-sd="mode"][data-value="schedule"]').click();await page.waitForTimeout(100);assert.equal(await d.locator('#sd-at').count(),1);assert.match(await d.locator('[data-sd="go"]').innerText(),/^예약 · 1명에게 보내기$/);
  await d.locator('[data-sd="mode"][data-value="now"]').click();await page.waitForTimeout(100);
  /* 확인 후 발송 = 기존 발송 요청 한 번(가로챔) */
  await d.locator('#cc-final-approval').check();await d.locator('[data-sd="go"]').click();await page.waitForTimeout(300);
  const w=await page.evaluate(()=>__writes.map(x=>[x[0],x[1].category_key,x[1].status,x[1].recipient_count,x[1].excluded_count,x[1].recipients.map(r=>r.phone),/\[현장명\]|\[고객호칭\]/.test(x[1].recipients[0].personalized_body)]));
  assert.deepEqual(w,[['campaign_create','sent','queued',1,0,['01011110001'],false]],'발송 가능 대상에게만, 개인화된 문구로 1회 요청');
  assert.equal(await page.locator('#smsDialog.on').count(),0);assert.equal(await page.evaluate(()=>G.campaignTab),'receipt','기존 접수 화면으로');
  /* 발송 가능 0명 묶음: 버튼 잠금 */
  await page.evaluate(()=>{campaignSetTab('home');});await page.waitForTimeout(200);
  await page.locator('#sms-v2 .plv-row[data-bundle="y3"] .plv-cta').click();await page.waitForTimeout(200);
  assert.equal(await page.locator('#smsDialog [data-sd="go"]').innerText(),'발송 가능 0명 · 보낼 수 없음');assert.equal(await page.locator('#smsDialog [data-sd="go"]').isDisabled(),true);
  await page.locator('#smsDialog [data-sd="close"]').click();
  /* 발송 이력 · 빈 묶음으로 시작 = 기존 화면 */
  await page.locator('#sms-v2 [data-sv="history"]').click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>G.campaignTab),'history');assert.equal(await page.locator('#sms-v2').count(),0);
  await page.evaluate(()=>campaignSetTab('home'));await page.waitForTimeout(150);
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.smsV2Off=true;paint();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#sms-v2').count(),0);assert.equal(await page.locator('#campaign-root .cc2-hero').count(),1,'끄면 예전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',list_frame:true,diagnosis:true,bundles:13,dialog:true,personalized_preview:true,confirm_required:true,single_queue_request:true,zero_blocked:true,real_send_blocked:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
