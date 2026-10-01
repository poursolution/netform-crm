'use strict';
/* 견적문의 상세 모달 v2 검사(2026-10-01 디자인 핸드오프 ③): 3열·진행 막대·말풍선·입력칸·배정·다음 단계 —
   저장은 기존 함수(배정·연락 결과·메모·체크·상태 변경)를 그대로 부르는지 확인한다 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryDetailV2&&window.InquiryWorkbench);
  await page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString();
   const U='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222';
   B={deals:[{id:'d1',site:'[경기 용인] 신갈현대아파트',assignee:'이필선',brand:'POUR솔루션',created:CUR_Y+'-06-01',code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:12e7}],
    inquiries:[{id:U,site:'[경기 용인] 동백 호수마을',address:'경기도 용인시 기흥구',status:'접수',at:at(3),created_at:at(3),brand:'POUR솔루션',phone:'010-1111-2222',contact_name:'김소장',work_type:'옥상',raw:{'문의내용':'옥상 누수가 심해 방수 견적을 요청드립니다.','고객유형':'관리사무소','상담채널':'전화'}},
     {id:A,site:'[경기 용인] 구갈 한양',status:'배정완료',at:at(2),created_at:at(2),brand:'석민이앤씨',phone:'010-3333-4444',contact_name:'박과장',assignee:'이필선',assigned_to:'이필선',assigned_at:at(1.5),raw:{'문의내용':'외벽 재도장 견적 문의합니다.','상담채널':'홈페이지'},activities:[{type:'전화',note:'소장님 통화 — 범위 확인',at:at(1),actor:'이필선'}]}],activities:[],inquiryTrash:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};/* 시험 환경엔 로그인 저장소가 없다 */window.__writes=[];window.pushWrite=(op,p)=>{window.__writes.push([op,p]);return 'req-'+window.__writes.length};goPage('inq');
   window.U=U;window.A=A;
  });
  /* 미배정 문의: 머리·진행 막대·배정 칸 */
  await page.evaluate(()=>InquiryWorkbench.open(U));await page.waitForTimeout(300);
  const d=page.locator('#inq-inbox-dialog.idv');assert.equal(await d.count(),1,'새 모달');
  assert.equal(await d.locator('.inq-now-card').count(),0,'요약 띠 없음');
  assert.match(await d.locator('.idv-pill').innerText(),/^미배정 · 3일 지남$/);
  assert.deepEqual(await d.locator('.idv-steps span').allInnerTexts(),['접수','지금 · 담당 배정','현장방문 · 견적','파이프라인 인계']);
  assert.equal(await d.evaluate(n=>getComputedStyle(n.querySelector('.idv-body')).gridTemplateColumns.split(' ').length),3);
  assert.match(await d.locator('.idv-quote').innerText(),/옥상 누수/);
  assert.match(await d.locator('.idv-missing').innerText(),/보완 필요 \d+개/);
  assert.equal(await d.locator('.idv-primary').innerText(),'담당자를 선택하세요');assert.equal(await d.locator('.idv-primary').isDisabled(),true);
  const reps=await d.locator('.idv-rep').evaluateAll(ns=>ns.map(n=>n.dataset.v));assert.ok(reps.includes('__branch__')&&reps.length>=2,'추천 담당자 + 지사 '+reps.join(','));
  assert.equal(await d.locator('.idv-composer.idv-locked').count(),1,'배정 전에는 입력칸 잠금');
  if(shot)await page.screenshot({path:shot+'-unassigned.png'});
  await d.locator('.idv-link[data-idv="showall"]').click();
  await d.locator('.idv-rep[data-v="이필선"]').click();
  assert.equal(await d.locator('.idv-primary').innerText(),'이필선에게 배정');
  await d.locator('.idv-primary').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>inquiryRoutedOwner(inqCtlFind(U,false))),'이필선','기존 배정 경로로 저장');
  assert.equal(await page.evaluate(()=>__writes.filter(w=>w[0]==='inquiry_assign').length),1,'배정 쓰기 1건');
  assert.equal(await page.locator('#inq-inbox-dialog.idv').count(),1,'모달은 닫히지 않는다');
  assert.match(await d.locator('.idv-c3 h3').innerText(),/이필선 담당/);
  assert.match(await page.locator('#idv-toast').innerText(),/이필선 배정[\s\S]*되돌리기/);
  /* 근처 현장(기존 같은 지역 로직) */
  assert.match(await d.locator('.idv-near').innerText(),/근처 현장 1곳[\s\S]*신갈현대아파트/);
  /* 입력칸: 통화 기록은 다음 할 일·날짜가 있어야 저장(기존 규칙) */
  await d.locator('.idv-input textarea').fill('소장님과 통화, 다음 주 방문 요청');
  await d.locator('.idv-save').click();
  assert.match(await d.locator('#iq-msg').innerText(),/다음 할 일과 날짜/);
  const due=await page.evaluate(()=>{const x=new Date(Date.now()+3*864e5);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')});
  await d.locator('#iq-next').fill('방문 일정 확정 전화');await d.locator('#iq-due').fill(due);
  await d.locator('.idv-save').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>__writes.filter(w=>w[0]==='inquiry_status'&&w[1].intent==='progress').length),1,'연락 결과 = 기존 progress 명령');
  assert.match(await d.locator('.idv-thread').innerText(),/소장님과 통화, 다음 주 방문 요청/);
  assert.match(await d.locator('.idv-thread .idv-next').last().innerText(),/다음 할 일: 방문 일정 확정 전화/);
  assert.equal(await d.locator('.idv-input textarea').inputValue(),'','저장 후 입력 초기화');
  /* 확인 항목 → 기존 체크 명령 */
  await d.locator('.idv-toggle').click();await d.locator('.idv-checks button').first().click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>__writes.filter(w=>w[0]==='stage_check').length),1);
  assert.equal(await d.locator('.idv-checks button.on').count(),1);
  /* 내부 메모 → 기존 기록 함수 */
  await d.locator('[data-idv="tab"][data-v="memo"]').click();await d.locator('.idv-input textarea').fill('가격 민감 — 비교 견적 중');await d.locator('.idv-save').click();await page.waitForTimeout(200);
  assert.equal(await d.locator('.idv-msg.memo').count(),1,'메모 말풍선');
  /* 다음 단계: 현장방문 일정 → 기존 상태 변경(자동 유입 규칙은 기존 그대로) */
  await d.locator('[data-idv="step"][data-v="visit"]').click();
  assert.equal(await d.locator('[data-idv="handoff"]').isDisabled(),true);
  await d.locator('[data-idv="visitDate"]').fill(due);
  await d.locator('[data-idv="handoff"]').click();await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>inqCtlFind(U,false).status),'현장방문예정','상태 변경');
  assert.equal(await page.locator('#inq-inbox-dialog.idv').count(),1);
  assert.equal(await d.locator('.idv-steps .done').count()>=3,true,'진행 막대 전진');
  if(shot)await page.screenshot({path:shot+'-assigned.png'});
  /* 딤 클릭으로 닫기, 예전 창 전환 스위치 */
  await page.mouse.click(5,5);assert.equal(await page.locator('#inq-inbox-dialog').count(),0,'딤 클릭 닫기');
  await page.evaluate(()=>{G.inqDetailV2Off=true;InquiryWorkbench.open(A)});
  assert.equal(await page.locator('#inq-inbox-dialog.idv').count(),0);assert.equal(await page.locator('#inq-inbox-dialog .inq-dialog-columns').count(),1,'끄면 예전 창');
  await page.evaluate(()=>{G.inqDetailV2Off=false;InquiryWorkbench.close()});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>InquiryWorkbench.open(A));await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',header:true,assign_existing_path:true,composer_progress:true,check:true,memo:true,next_step_status:true,legacy_switch:true,narrow:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
