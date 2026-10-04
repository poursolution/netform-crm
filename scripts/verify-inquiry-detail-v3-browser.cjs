'use strict';
/* 견적문의 상세 v3 검사(2026-10-04 핸드오프 inquiry_v2 '견적문의 상세 v3' — 최종본)
   머리(브랜드 띠 · 공종 · 유입 / 현장명 + 고객 · 전화 / 접수일 · 담당 / 진행 4칸 / 상태 꼬리표 1개) · 왼쪽(고객이 남긴 말 · 핵심 정보 4줄 · 채울 정보 n / 9: 칩 → 그 자리 입력 → 저장하면 칩이 사라짐)
   · 가운데(응대 이력 + 탭 2개(응대 기록 · 내부 메모, 문자 보내기 없음) · 결과 칩 → 다음 행동 → 저장) · 오른쪽(지금 할 일 1개 · 첫마디 · 전화 / 다음 단계 / 근처 현장 · 담당 변경)
   저장은 기존 경로 그대로. 규칙 제안에는 AI 표식 없음. 끄면(G.inqDetailV3Off) v2 배치 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'',dump=process.env.IQ3_DUMP==='1';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-03T19:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryDetailV2&&window.InquiryWorkbench&&window.InquiryListV3);
  await page.evaluate(()=>{
   const A='22222222-2222-4222-8222-222222222222',U='11111111-1111-4111-8111-111111111111';
   B={deals:[],inquiries:[
     {id:A,site:'[충남 천안] 천안두정E편한세상2차',address:'충남 천안시 서북구 노태산로 145',status:'배정완료',at:'2026-10-01T11:48:00+09:00',created_at:'2026-10-01T11:48:00+09:00',brand:'POUR솔루션',phone:'010-5436-0662',contact_name:'신수진 시설팀장',work_type:'에폭시',assignee:'정정훈',assigned_to:'정정훈',assigned_at:'2026-10-01T12:00:00+09:00',raw:{'문의내용':'지하주차장 에폭시 일부 들뜸, 부분 보수 견적 받을 수 있는지 문의','상담채널':'전화','공사유형':'에폭시','건물주소':'충남 천안시 서북구 노태산로 145'}},
     {id:U,site:'[경기 용인] 동백 호수마을',status:'접수',at:'2026-10-03T10:00:00+09:00',created_at:'2026-10-03T10:00:00+09:00',brand:'석민이앤씨',phone:'',contact_name:'',raw:{'문의내용':'옥상 방수 견적 문의'}}],activities:[],inquiryTrash:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{window.__writes.push([op,p]);return 'req-'+window.__writes.length};
   window.__rpc=[];SB={rpc:async(name,args)=>{__rpc.push([name,args&&args.p]);if(name==='crm_inquiry_field_update_v1')return {data:{ok:true,value:args.p.value}};return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   goPage('inq');window.A=A;window.U=U;
  });
  await page.evaluate(()=>InquiryWorkbench.open(A));await page.waitForTimeout(400);
  const d=page.locator('#inq-inbox-dialog.idv.idv3');assert.equal(await d.count(),1,'상세 v3');
  const tx=sel=>d.locator(sel).evaluateAll(l=>l.map(n=>n.innerText.replace(/\s+/g,' ').trim()));
  if(dump){console.log(JSON.stringify({r1:await tx('.idv3-top .r1'),r2:await tx('.idv3-top .r2'),steps:await tx('.idv3-steps span'),c1:await tx('.idv3-c1'),chead:await tx('.idv3-chead'),ev:await tx('.idv3-ev'),comp:await tx('.idv3-composer'),c3:await tx('.idv3-c3')},null,1));if(shot)await page.screenshot({path:shot+'-open.png'});process.exit(0);}
  /* 머리: 브랜드 띠 + 이름 · 공종 · 유입 / 현장명 + 고객 · 전화 / 접수일 · 담당 / 진행 4칸 / 상태 꼬리표 1개 */
  assert.match((await tx('.idv3-top .r1'))[0],/^POUR솔루션 ?지하주차장.*부분 보수 · 전화 문의 ?첫 연락 전 · .+ ?×$/);assert.equal(await d.locator('.idv3-pill').count(),1,'상태 꼬리표는 하나');assert.equal(await d.locator('.idv3-pill.red').count(),1,'첫 연락이 늦으면 빨강');
  assert.match((await tx('.idv3-top .r2'))[0],/^\[충남 천안\] 천안두정E편한세상2차 ?신수진 시설팀장 · 010-5436-0662 ?2026\.10\.1 접수 · 담당 정정훈$/);assert.equal(await d.locator('.idv3-top').evaluate(n=>Math.round(n.getBoundingClientRect().width)===Math.round(n.parentElement.getBoundingClientRect().width)),true,'머리는 창 폭 전체(왼쪽 정렬)');
  assert.deepEqual(await tx('.idv3-steps span'),['접수','담당 배정','지금 · 현장방문 / 견적','파이프라인 전환']);
  assert.equal(await d.locator('.idv-top, .idv-missing, .idv-info, .idv-need, .idv-ctabs, .idv-nowbox').count(),0,'v2 머리 · 미입력 칸 · 보완 필요 상자 · 필수 확인 칩 · 회색 안내 문단 없음');
  assert.deepEqual(await d.locator('.idv3-body').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').map(x=>Math.round(parseFloat(x))).filter((x,i)=>i!==1)),[270,300],'270 · 가운데 · 300');
  /* 왼쪽: 고객이 남긴 말 · 핵심 정보 4줄 · 채울 정보 n / 9 */
  assert.equal(await d.locator('.idv3-quote').innerText(),'"지하주차장 에폭시 일부 들뜸, 부분 보수 견적 받을 수 있는지 문의"');
  assert.deepEqual(await tx('.idv3-info .k'),['주소','공종','유입','연락처']);assert.match((await tx('.idv3-info'))[0],/주소 ?충남 천안시 서북구 노태산로 145 ?공종 ?에폭시 ?유입 ?전화 ?연락처 ?시설팀장 · 010-5436-0662/);
  const missN=Number(await d.locator('.idv3-need .hd .n').innerText()),chips=await tx('.idv3-need .idv3-chip');assert.equal(chips.length,missN,'칩 수 = 채울 정보 수');assert.ok(chips.includes('경쟁사')&&chips.includes('결정권자'));
  assert.match((await tx('.idv3-need .hd'))[0],new RegExp('^채울 정보 ?'+missN+' ?/ 9 · 누르면 바로 입력$'));assert.equal(missN,7);assert.match((await tx('.idv3-need small'))[0],new RegExp('^채운 정보 '+(9-missN)+'개 · 현재 문제 · 공사 범위$'));
  await d.locator('.idv3-chip',{hasText:'경쟁사'}).click();await page.waitForTimeout(150);
  assert.equal(await d.locator('.idv3-fill input').getAttribute('placeholder'),'경쟁사 입력');await d.locator('.idv3-fill input').fill('타 업체 2곳 비교 중');await d.locator('.idv3-fill [data-idv="editsave"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(c=>c[0]==='crm_inquiry_field_update_v1').map(c=>c[1])),[{inquiry_id:'22222222-2222-4222-8222-222222222222',field:'competitor',value:'타 업체 2곳 비교 중'}],'칩 → 그 자리 입력 → 서버 저장 한 번');
  assert.equal(Number(await d.locator('.idv3-need .hd .n').innerText()),missN-1,'저장하면 칩이 사라짐');assert.equal((await tx('.idv3-need .idv3-chip')).includes('경쟁사'),false);assert.match((await tx('.idv3-need small'))[0],/경쟁사/);
  /* 가운데: 탭 2개 · 결과 칩 → 다음 행동 → 저장(한 줄은 선택) */
  assert.match((await tx('.idv3-chead'))[0],/^응대 이력 ?\d+건 · 시도 0 · 연결 0$/);
  assert.deepEqual(await tx('.idv3-tabs [role=tab]'),['응대 기록','내부 메모'],'문자 보내기 탭 없음');
  assert.deepEqual(await tx('.idv3-res .idv3-rc'),['연결됨','부재','검토중','자료요청','회신대기','배드핏']);
  assert.equal(await d.locator('#iq-res').getAttribute('placeholder'),'무슨 일이 있었는지 한 줄 (선택)');
  assert.match((await tx('.idv3-sug'))[0],/^다음 행동 ?결과를 고르면 제안$/);assert.equal(await d.locator('.idv3-sug em').count(),0,'규칙 제안에는 AI 표식 없음');assert.equal(await d.locator('.idv3-foot .idv-save.on').count(),0);
  await d.locator('.idv3-rc',{hasText:'회신대기'}).click();await page.waitForTimeout(150);
  assert.match((await tx('.idv3-sug'))[0],/^다음 행동 다시 연락 · 2026\.10\.6\(화\) ?바꾸기$/);assert.equal(await d.locator('.idv3-foot .idv-save.on').count(),1);
  const w0=await page.evaluate(()=>__writes.length);await d.locator('.idv3-foot .idv-save').click();await page.waitForTimeout(500);
  assert.ok(await page.evaluate(n=>__writes.length>n,w0),'기존 저장 경로로 저장');
  const ev=await tx('.idv3-ev');assert.match(ev[ev.length-1],/송보람|정정훈/);assert.match(ev[ev.length-1],/· 전화 · 회신대기 ?→ 다음 행동: 다시 연락 · 10\.6$/);
  assert.match((await tx('.idv3-chead'))[0],/시도 1 · 연결 0$/);
  assert.equal((await tx('.idv3-pill'))[0],'회신 대기 · 10.6 확인','머리 꼬리표 = 마지막 결과 + 다음 확인일');assert.equal(await d.locator('.idv3-pill.red').count(),0);
  /* 내부 메모 */
  await d.locator('.idv3-tabs [data-v="memo"]').click();await page.waitForTimeout(150);assert.equal(await d.locator('.idv3-res').count(),0);await d.locator('#spLogNote').fill('회장 의견 영향이 큰 현장');await d.locator('.idv3-foot .idv-save').click();await page.waitForTimeout(400);
  assert.match((await tx('.idv3-ev')).pop(),/· 내부 메모 ?회장 의견 영향이 큰 현장$/);await d.locator('.idv3-tabs [data-v="call"]').click();await page.waitForTimeout(150);
  /* 오른쪽: 지금 할 일 1개 · 첫마디 · 전화 / 다음 단계 / 근처 현장 · 담당 변경 */
  assert.match((await tx('.idv3-now'))[0],/^지금 할 일 ?다시 연락 · 10\.6 ?첫마디 ?"안녕하세요, 넷폼 .+ 지금 통화 괜찮으실까요\?" ?전화 010-5436-0662$/);
  assert.match((await tx('.idv3-next'))[0],/^다음 단계 · 현장방문 \/ 견적 ?현장방문 일정 ?견적서 발송 ?둘 중 하나 저장 → 파이프라인 ‘컨설팅 설계’로 자동 전환$/);
  assert.match((await tx('.idv3-bottom'))[0],/^근처 현장 ?0곳.*담당 변경$/);
  await d.locator('.idv3-next [data-v="visit"]').click();await page.waitForTimeout(150);assert.equal(await d.locator('.idv3-next [data-idv="visitDate"]').count(),1);assert.equal(await d.locator('.idv3-next [data-idv="handoff"]').isDisabled(),true);
  await d.locator('.idv3-next [data-v="visit"]').click();await page.waitForTimeout(150);
  if(shot)await page.screenshot({path:shot+'-v3.png'});
  /* 담당 변경 · 미배정 = 기존 배정 칸 */
  await d.locator('.idv3-bottom [data-idv="reassign"]').click();await page.waitForTimeout(200);assert.match(await d.locator('.idv3-c3 h3').innerText(),/담당 변경/);await d.locator('[data-idv="cancel-reassign"]').click();await page.waitForTimeout(150);
  await page.evaluate(()=>InquiryWorkbench.open(U));await page.waitForTimeout(400);
  assert.equal((await tx('.idv3-pill'))[0].startsWith('미배정'),true);assert.match(await d.locator('.idv3-c3 h3').innerText(),/담당자 배정/);assert.deepEqual(await tx('.idv3-steps span'),['접수','지금 · 담당 배정','현장방문 / 견적','파이프라인 전환']);
  assert.match((await tx('.idv3-info'))[0],/연락처 ?입력$/,'빈 핵심 정보는 그 자리에서 입력');
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:900,height:900});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.inqDetailV3Off=true;InquiryWorkbench.open(A);});await page.waitForTimeout(400);
  assert.equal(await page.locator('#inq-inbox-dialog.idv3').count(),0);assert.deepEqual(await page.locator('#inq-inbox-dialog .idv-ctabs [role=tab]').allInnerTexts(),['응대 기록','문자 보내기','내부 메모'],'끄면 v2 배치');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',head_one_pill_steps4:true,left_quote_info4_need9_inline:true,center_two_tabs_result_chips:true,optional_line_saves_existing_path:true,no_ai_badge_on_rule:true,right_one_todo_next_step_near:true,assign_uses_existing:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
