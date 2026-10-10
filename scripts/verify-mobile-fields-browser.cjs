'use strict';
/* 모바일 단계 정보 저장 — 공사 시기 · 견적 요청 (2026-10-10 대표 승인 · mobile_all) — 합성 자료. 서버 함수(crm_deal_stage_fields_update_v1)는 가짜 응답.
   확인: 허용 목록에 들어감 / 방문 결과 + 공사 시기 함께 변경(미리보기 · 저장 뒤 변경 표시) / 서버 확인 뒤에만 화면 값 변경 / 실패하면 아무것도 안 바뀜 / 견적 요청 = PC 와 같은 칸(quote_request · quote_due 평일 3일 · construction_plan) + 다음 업무 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,'')||'mobile.html',t=path.resolve(root,rel);if(!t.startsWith(root+path.sep)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',t.endsWith('.html')?'text/html; charset=utf-8':t.endsWith('.css')?'text/css':'application/javascript; charset=utf-8');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/mobile.html?demo=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ContactEntry&&window.MobileEntry&&window.MobileFields&&typeof render==='function'&&window.OperationalUI);
  /* 허용 목록: 모바일 transport 가 새 서버 함수를 막지 않는다 */
  const src=fs.readFileSync(path.join(root,'transport.js'),'utf8');
  ['crm_deal_stage_fields_update_v1','crm_work_request_list_v1','crm_work_request_reply_v1','crm_inquiry_command_v1','crm_inquiry_flow_list_v1'].forEach(n=>assert.ok(src.includes("'"+n+"'"),n+' 허용 목록에 있다'));
  const setup=()=>page.evaluate(()=>{
   const kst=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));window.__kst=kst;
   try{sessionStorage.removeItem('crm:call-entry:v1');}catch(e){}
   G.user=REPS.find(r=>r.role==='dual')||REPS[0];G.mode='rep';DEMO=true;window.toast=()=>{};
   DEALS=[{id:'d1',nm:'[수원] 견적 요청 현장',code:'consulting',sub:'방수',rep:G.user.nm,amt:1e8,activities:[],tl:[],manager_name:'박정호',manager_mobile:'01056464400',nextAction:{id:'11111111-1111-4111-8111-111111111111',type:'방문',text:'현장 방문',due:kst(0),due_at:kst(0),status:'open'}}];
   G._today=[];G.done={};G.deal='d1';G.sub=null;G.tab='today';render();
   window.__ops=[];window.__rpc=[];window.__fail=false;
   window.queueMobileContactOperation=(op,payload,actionId)=>{const id='op'+(__ops.length+1);__ops.push({id,op,payload,actionId});return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,status:'done',ack:{ok:true,operation:o.op,activity_id:'act-'+o.id,next_action_id:'nx-'+o.id}}));
   const real=window.__realPhase1||(window.__realPhase1=window.Phase1);
   window.Phase1=Object.assign({},real,{profile:Object.assign({},real.profile||{},{name:'테스트',allowed_modes:['rep']}),rpc:async(name,args)=>{__rpc.push([name,args]);if(__fail)throw Error('서버가 거절했습니다');const p=args.p;return {ok:true,version:7,stage_context:{fields:p.fields,stage:p.stage_code}};}});
  });
  await setup();
  const C=page.locator('#sheetcard'),txt=async s=>one(await C.locator(s).first().innerText());
  const open=()=>page.evaluate(()=>MobileEntry.open({ch:'방문'})).then(()=>page.waitForTimeout(300));
  /* ① 방문 결과 + 공사 시기 함께 변경 */
  await open();await C.locator('.ce-chip',{hasText:/^연결됨$/}).click();await C.locator('textarea[data-ce-in="memo"]').fill('옥상 실측함 · 내년 봄 공사로 보고 있음');
  await C.locator('.ce-infobtn').click();await page.waitForTimeout(100);
  assert.deepEqual(await C.locator('.ce-infobody [data-ce="iplan"]').allInnerTexts(),['올해','내년','그 이후','미정']);
  await C.locator('.ce-infobody [data-ce="iplan"]',{hasText:'내년'}).click();await page.waitForTimeout(100);
  assert.match(await txt('.ce-prev'),/ · 고객 정보 변경 · 공사 시기 내년$/,'바뀌는 것은 저장 전에 적는다');
  await page.evaluate(()=>{__fail=true;});
  await C.locator('.ce-save').click();await page.waitForTimeout(700);
  assert.deepEqual(await C.locator('.ce-done li').evaluateAll(l=>l.map(n=>n.innerText.replace(/\s+/g,' '))).then(l=>l.slice(-1)),['남음 공사 시기는 저장하지 못했습니다: 서버가 거절했습니다'],'공사 시기 저장이 실패해도 연락 기록은 남고 안내한다');
  assert.equal(await page.evaluate(()=>MobileFields.planOf(DEALS[0])),'','서버 확인이 없으면 화면 값은 안 바뀐다');
  assert.equal(await page.evaluate(()=>__ops.filter(o=>o.op==='activity').length),1);
  /* ② 정상: 서버 확인 뒤에만 반영 */
  await setup();await open();await C.locator('.ce-chip',{hasText:/^연결됨$/}).click();await C.locator('textarea[data-ce-in="memo"]').fill('옥상 실측함');await C.locator('.ce-infobtn').click();await C.locator('.ce-infobody [data-ce="iplan"]',{hasText:'내년'}).click();await page.waitForTimeout(100);
  await C.locator('.ce-save').click();await page.waitForTimeout(700);
  assert.deepEqual(await page.evaluate(()=>__rpc),[['crm_deal_stage_fields_update_v1',{p:{deal_id:'d1',stage_code:'consulting',fields:{construction_plan:'내년'},reason:'결과 남기기에서 함께 변경'}}]]);
  assert.equal(await page.evaluate(()=>MobileFields.planOf(DEALS[0])),'내년');
  assert.ok((await C.locator('.ce-done li').allInnerTexts()).some(t=>/공사 시기 → 내년/.test(t)),'저장 뒤 변경으로 표시');
  /* ③ 견적 요청: 방문 결과 저장 뒤 [견적 요청 등록] — PC 와 같은 칸 */
  await C.locator('[data-ce="quote"]').click();await page.waitForTimeout(300);
  assert.match(await txt('.intro'),/^견적 요청 등록/);
  assert.equal(await C.locator('textarea[data-mf-in="memo"]').inputValue(),'옥상 실측함','방문에서 쓴 내용을 이어받는다');
  assert.equal(await C.locator('[data-mf="plan"][aria-pressed="true"]').innerText(),'내년','공사 시기도 이어받는다');
  await page.evaluate(()=>{__rpc.length=0;__ops.length=0;});
  await C.locator('textarea[data-mf-in="memo"]').fill('옥상 방수 · 3개동 · 부분 보수 여부 확인 필요');
  assert.match(await txt('.ce-prev'),/^저장하면 견적 요청 기록 1건 \+ 견적 예정일 \d+\.\d+\(3일 · 평일\) 저장 · 다음 업무 "견적 회신 확인 · 견적 예정일 \d+\.\d+" · 자료가 없어 '자료 부족 · 가견적'으로 전달$/);
  await C.locator('.ce-save').click();await page.waitForTimeout(700);
  const due=await page.evaluate(()=>{let x=__kst(0),n=0;while(n<3){const t=new Date(x+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+1);x=t.toISOString().slice(0,10);const w=t.getUTCDay();if(w!==0&&w!==6)n++;}return x;});
  assert.deepEqual(await page.evaluate(()=>__rpc.map(r=>[r[0],r[1].p.fields])),[['crm_deal_stage_fields_update_v1',{quote_request:'자료 부족 · 가견적 — 옥상 방수 · 3개동 · 부분 보수 여부 확인 필요',quote_due:due,construction_plan:'내년'}]],'PC 견적 요청 등록과 같은 칸');
  assert.deepEqual(await page.evaluate(()=>__ops.map(o=>[o.op,o.payload.type,o.payload.text,o.payload.due_at])),[['next_action','후속접촉','견적 회신 확인 · 견적 예정일 '+(+due.slice(5,7))+'.'+(+due.slice(8,10)),due]],'다음 업무');
  assert.match(await txt('.ce-dt'),/^견적 요청을 등록했습니다$/);
  /* ④ 컨설팅 단계가 아니면 견적 요청 시트를 열지 않는다 */
  await page.evaluate(()=>{DEALS[0].code='sent';MobileFields.quoteSheet('');});await page.waitForTimeout(200);
  assert.equal(await page.locator('#sheetcard .intro').filter({hasText:'견적 요청 등록'}).count()?1:0,0,'다른 단계에서는 열지 않는다');
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('verify-mobile-fields: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
