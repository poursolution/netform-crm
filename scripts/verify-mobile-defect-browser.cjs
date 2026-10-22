'use strict';
/* 하자 사진 간이 접수(2026-10-22): 상세 더보기 [하자 접수] → 부위 · 긴급 · 내용 · 사진 → [접수] = 저장소 올리기(POST /storage/v1/object/defect-photos/<uid>/<deal>/…) + crm_defect_report_create_v1 → 응대 기록에 [하자] 표식 · 잔디 알림(켜져 있을 때만)
   합성 화면이라 저장소 · 서버 명령 · 잔디는 가짜로 받는다(쓰기 0). 서버 함수가 없으면(CRMRelease.listed false) 줄이 안 보인다. */
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
const SHOT=process.env.SHOT_DIR||'';
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;const errors=[];
 try{
  browser=await chromium.launch(launchOptions());
  const c=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
  await c.route('**/*',r=>{const u=new URL(r.request().url());if(!['GET','HEAD'].includes(r.request().method()))return r.abort();return u.origin===origin?r.continue():r.abort();});
  const page=await c.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(origin+'/mobile.html?demo=1&review=hub&screen=B',{waitUntil:'domcontentloaded'});await page.locator('.approved-b').waitFor();
  await page.evaluate(()=>{
   closeSheet();delete window.__approvedBCExample;const id='77777777-7777-4777-8777-000000000003',actor=Phase1.profile.user_id;G.user={...G.user,id:actor};G.mode='rep';
   DEALS=[{id,site_id:'77777777-7777-4777-8777-000000001003',nm:'합성 하자 현장',code:'rapport',sub:'방수',rep:G.user.nm,owner_id:actor,brand:'POUR솔루션',version:0,amt:1e8,manager_name:'합성 소장',manager_mobile:'01000000000',created_at:new Date().toISOString(),stageAt:new Date().toISOString(),lastAt:new Date().toISOString(),contactAt:new Date().toISOString(),activities:[],tl:[],nextAction:null}];
   window.__calls=[];window.CRMRelease={has:()=>true,listed:()=>true,noteMissing(){},check(){},missing:()=>[]};
   window.TOKEN='synthetic';window.SUPABASE_URL='https://x.supabase.co';window.SUPABASE_ANON='anon';Phase1.profile.auth_uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
   const realFetch=window.fetch;window.fetch=async(url,init)=>{const u=String(url);if(u.includes('/storage/v1/object/defect-photos/')){__calls.push(['storage',u.split('/defect-photos/')[1],init.headers['Content-Type']]);return new Response('{"Key":"ok"}',{status:200});}if(u.includes('/functions/v1/crm-jandi')){__calls.push(['jandi',JSON.parse(init.body)]);return new Response(JSON.stringify({ok:true,event:'defect_reported',links:2}),{status:200});}return realFetch(url,init);};
   Phase1.rpc=async(name,args)=>{__calls.push(['rpc',name,args]);if(name==='crm_defect_report_create_v1')return {ok:true,policy:'defect-report-v1',id:'r1',deal_id:args.p.deal_id,status:'접수',activity_id:'a1',photo_path:args.p.photo_path,note:'[하자] '+args.p.part+(args.p.memo?' · '+args.p.memo:'')+(args.p.urgent?' · 긴급':'')+(args.p.photo_path?' · 사진 1장':'')+' | 접수 2026-10-22 | 담당 '+G.user.nm+' | 약속 없음 | 미해결',at:new Date().toISOString(),duplicate:false};return {ok:true};};
   G.deal=id;G.tab='mine';render();
  });
  await page.locator('.approved-c').waitFor();
  const row=page.locator('.approved-c [data-gs="more"][data-value="하자 접수"]');
  assert.equal(await row.count(),1,'더보기 끝에 [하자 접수] 줄');assert.match(await row.innerText(),/하자 접수[\s\S]*사진 1장 · 본사 알림/);
  await row.click();await page.locator('.md-screen').waitFor();
  assert.match(await page.locator('.md-head b').innerText(),/하자 접수 · 합성 하자 현장/);
  assert.equal(await page.locator('[data-defect="submit"]').isDisabled(),true,'부위 전엔 잠김');
  await page.locator('.md-chip',{hasText:'옥상'}).click();await page.locator('[data-defect="memo"]').fill('우수관 주변 누수 · 소장님 요청');await page.locator('[data-defect="urgent"]').check();
  /* 사진: 작은 PNG 한 장 */
  const png=await page.screenshot({clip:{x:0,y:0,width:24,height:24}});/* 진짜 PNG 한 장(합성 화면 일부) */
  await page.locator('[data-defect="photo"]').setInputFiles({name:'defect.png',mimeType:'image/png',buffer:png});
  await page.locator('.md-photo.has img').waitFor();
  assert.equal(await page.locator('[data-defect="submit"]').isDisabled(),false);
  if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-defect-form.png')});
  await page.locator('[data-defect="submit"]').click();await page.locator('.md-done, .md-err').first().waitFor();
  if(await page.locator('.md-err').count())throw new Error('접수 오류: '+await page.locator('.md-err').innerText()+' · calls='+JSON.stringify(await page.evaluate(()=>__calls.map(c=>c.slice(0,2)))));
  const calls=await page.evaluate(()=>__calls);
  const st=calls.find(c=>c[0]==='storage'),rpc=calls.find(c=>c[0]==='rpc'&&c[1]==='crm_defect_report_create_v1'),jd=calls.find(c=>c[0]==='jandi');
  assert.ok(st,'저장소에 올림');assert.match(st[1],/^aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/77777777-7777-4777-8777-000000000003\/\d+\.jpg$/,'경로 = 내 uid/영업건/시각.jpg: '+st[1]);assert.equal(st[2],'image/jpeg','JPEG 로 줄여서');
  assert.ok(rpc,'접수 명령');assert.deepEqual([rpc[2].p.deal_id,rpc[2].p.part,rpc[2].p.urgent,rpc[2].p.memo,rpc[2].p.photo_path],['77777777-7777-4777-8777-000000000003','옥상',true,'우수관 주변 누수 · 소장님 요청',st[1]]);assert.match(rpc[2].p.request_id,/^[0-9a-f-]{36}$/);
  assert.ok(jd,'잔디 사건 알림');assert.equal(jd[1].kind,'event');assert.equal(jd[1].event,'defect_reported');assert.match(jd[1].title,/\[하자 접수\] 합성 하자 현장/);assert.match(jd[1].links[0].url,/mobile\.html\?open=deal%3A77777777-7777-4777-8777-000000000003$/);
  assert.match(await page.locator('.md-done').innerText(),/접수했습니다[\s\S]*\[하자\] 옥상 · 우수관 주변 누수 · 소장님 요청 · 긴급 · 사진 1장 \| 접수 2026-10-22 \| 담당 [^|]+\| 약속 없음 \| 미해결[\s\S]*본사\(잔디\)에 알렸습니다/);
  assert.match(await page.evaluate(()=>DEALS[0].activities[0].note),/^\[하자\] 옥상 · 우수관 주변 누수 · 소장님 요청 · 긴급 · 사진 1장 \| 접수 2026-10-22 \| 담당 .+ \| 약속 없음 \| 미해결$/,'화면 응대 기록에도 표식');
  if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-defect-done.png')});
  await page.locator('.md-done [data-gs="back"]').click();await page.locator('.approved-c').waitFor();
  /* 서버 함수 없으면 줄이 안 보인다 */
  await page.evaluate(()=>{window.CRMRelease={has:()=>true,listed:()=>false,noteMissing(){},check(){},missing:()=>[]};render();});
  assert.equal(await page.locator('.approved-c [data-gs="more"][data-value="하자 접수"]').count(),0);
  assert.deepEqual(errors,[],'화면 오류 없음: '+errors.join(' | '));
  console.log(JSON.stringify({status:'PASS',storage:1,rpc:1,jandi:1,writes:0}));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
