'use strict';
/* 견적문의 상세 정리 (2026-10-20 design_handoff_pc_today_inquiry 2 · 3) — 합성 자료(현장 · 이름은 지어낸 것) · 외부 연결 차단 · 저장 없음
   확인: 가운데 맨 위 고객 문의 요약(이번 문의 / 추후 계획 · '내년쯤' = 일정 미확인 · 원문 보기) 고정 → 이번 응대 기록 → 응대 이력
         · 왼쪽 원문 큰 칸 없음 · 문의 정보 한 곳(채울 정보 칸 따로 없음) · 이 단지 영업 이력 그대로
         · 오른쪽 첫마디 · 전화 · 문자 버튼 없음 · 지금 할 일 + 기한 · 다음 단계 = 방문 결과 기록 · 견적 진행 기록 · '모바일에서 전화 · 문자 · 방문 일정'
         · 3 ① 공종이 원문과 다르면 '확인'(값은 그대로) · 3 ② 최초 응대 시각은 있는데 연락 기록 0 = '연결일 확인 필요' · 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(require('../review-preview/review-environment.cjs').launchOptions());
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-20T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryListV3&&window.InquiryWorkbench&&window.InquiryTidy&&window.InquiryDetailV2);
  await page.evaluate(()=>{
   const id=n=>'22222222-2222-4222-8222-'+String(n).padStart(12,'0');
   B={deals:[],inquiries:[
    /* 실제 사례와 같은 모양: 원문 = 경사로 빨간색 도장 + 내년쯤 옥상 · 외벽, 시트 공사유형 = 아스콘, 10.10 '다음주 다시'로 최초 응대 시각만 찍히고 연락 기록 없음 */
    {id:id(1),site:'[합성] 경사로 도장 아파트',status:'응대중',at:'2026-08-24T01:37:32Z',created_at:'2026-08-24T01:37:32Z',brand:'POUR솔루션',phone:'010-0000-1111',contact_name:'관리과장',assignee:'송보람',assigned_to:'송보람',work_type:'아스콘',first_response_at:'2026-10-10T06:29:24Z',responded_at:'2026-10-10T06:29:24Z',next_action_date:'2026-10-17',next_action:{type:'전화',text:'다시 연락',due:'2026-10-17',status:'open'},
     raw:{'문의내용':'아파트 경사로 부분시공 문의 주심.\n6년차 아파트로 아파트 내 경사로 부분에 빨간색 도장 시공이 가능한지 문의 주심.\n면적이 크진 않으나, 추후 내년쯤 옥상이나 외벽 등 다른 공사도 예정이라고 하심','공사유형':'아스콘','상담채널':'전화','유입경로':'인터넷검색','건물주소':'합성시 합성로 1'}},
    {id:id(2),site:'[합성] 첫 연락 전 아파트',status:'배정완료',at:'2026-10-20T00:00:00Z',created_at:'2026-10-20T00:00:00Z',brand:'석민이앤씨',phone:'010-0000-2222',contact_name:'김소장',assignee:'송보람',assigned_to:'송보람',assigned_at:'2026-10-20T00:00:00Z',raw:{'문의내용':'옥상 방수 견적 요청드립니다.','공사유형':'옥상 방수','상담채널':'홈페이지'}}],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';G.inqTidyOff=false;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   SB={rpc:async()=>({error:{message:'CONTRACT_UNAVAILABLE'}})};
   window.Phase1={profile:{auth_uid:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'송보람'},rpc:async()=>{throw Error('CONTRACT_UNAVAILABLE');}};
   window.__id=id;goPage('inq');
  });
  await page.waitForTimeout(400);
  const open=async n=>{await page.evaluate(k=>{const q=B.inquiries.find(x=>x.id===__id(k));InquiryWorkbench.open(inqKey(q));},n);await page.locator('#inq-inbox-dialog .idv3-c2').waitFor();await page.waitForTimeout(200);};
  await open(1);
  const D=page.locator('#inq-inbox-dialog');
  /* 가운데: 요약 → 이번 응대 기록 → 응대 이력 */
  const order=await D.locator('.idv3-c2').evaluate(c=>[...c.children].map(n=>n.classList.contains('idv3-sum')?'sum':n.classList.contains('idv3-composer')?'rec':n.classList.contains('idv3-chead')?'head':n.classList.contains('idv3-thread')?'thread':n.className));
  assert.deepEqual(order,['sum','rec','head','thread'],'가운데 순서');
  const sum=one(await D.locator('.idv3-sum').innerText());
  assert.match(sum,/^고객 요청 원문 보기 › 이번 문의 아파트 경사로 부분시공 문의 주심 · 6년차 아파트로 아파트 내 경사로 부분에 빨간색 도장 시공이 가능한지/,sum);
  assert.match(sum,/추후 계획 면적이 크진 않으나, 추후 내년쯤 옥상이나 외벽 등 다른 공사도 예정이라고 하심 · 일정 미확인$/,'내년쯤 = 일정 미확인: '+sum);
  assert.equal(await D.locator('.idv3-sum').evaluate(e=>getComputedStyle(e).position),'sticky','요약 고정');
  await D.locator('[data-idv="orig-toggle"]').click();await page.waitForTimeout(150);
  assert.match(one(await D.locator('.idv3-sum .orig').innerText()),/^아파트 경사로 부분시공 문의 주심\. 6년차/,'원문 보기 = 원문 그대로');
  assert.match(one(await D.locator('.idv3-top-rec').innerText()),/^이번 응대 기록/);
  /* 왼쪽: 원문 큰 칸 없음 · 문의 정보 한 곳 · 공종 확인 */
  const left=one(await D.locator('.idv3-c1').innerText());
  assert.doesNotMatch(left,/고객이 남긴 말|채울 정보/,'원문 큰 칸 · 채울 정보 칸 따로 없음');
  assert.match(left,/현장 정보 이어받음 · 누르면 수정/);/* inquiry_respond: 현장 정보 이어받음 · 보완 정보 접힘 */
  assert.match(left,/공종 기타\(아스콘\)\? · 원문은 경사로 도장 · 확인/,'3 ① 공종 확인(값은 그대로): '+left);
  /* 오른쪽: 첫마디 · 전화 · 문자 없음 · 모바일 안내 · 다음 단계 이름 */
  const right=one(await D.locator('.idv3-c3').innerText());
  assert.doesNotMatch(right,/첫마디/);assert.equal(await D.locator('.idv3-c3 [data-idv="dial"],.idv3-c3 [data-idv="sms-open"]').count(),0,'전화 · 문자 버튼 없음');
  assert.match(right,/모바일에서 전화 · 문자 · 방문 일정/);
  assert.match(right,/방문 결과 기록 견적 진행 기록/,'다음 단계 이름');
  assert.doesNotMatch(right,/지금 할 일/,'inquiry_respond: 지금 할 일은 가운데 다음 업무와 같아 오른쪽에서 뺌');
  assert.doesNotMatch(one(await D.locator('.idv3-top .r1').innerText()),/옥상 방수/,'머리 줄: 추후 계획(내년 옥상)을 지금 문의로 쓰지 않음');
  /* 3 ② 연결일 확인 */
  assert.match(one(await D.locator('.idv3-top').innerText()),/연결일 확인 필요 · 첫 응대 10\.10 \/ 이력 연락 0/,'3 ② 연결일 확인 필요');
  if(process.env.IT_SHOT)await page.screenshot({path:process.env.IT_SHOT});
  /* 두 번째 문의: 원문과 공종이 같으면 확인 없음 · 연락 기록이 없어도 최초 응대 전이면 경고 없음 · 첫 연락 기한 */
  await page.evaluate(()=>InquiryWorkbench.close());await open(2);
  assert.doesNotMatch(one(await D.locator('.idv3-c1').innerText()),/확인$|· 확인/);
  assert.doesNotMatch(one(await D.locator('.idv3-top').innerText()),/연결일 확인 필요/);
  assert.match(one(await D.locator('.idv3-sum').innerText()),/이번 문의 옥상 방수 견적 요청드립니다 추후 계획 언급 없음$/);
  assert.match(one(await D.locator('.idv3-top').innerText()),/CRM 연락 기록 없음 · 접수 0일/,'기록 없음 = 회색 · 접수일만');
  /* 끄기 */
  await page.evaluate(()=>{InquiryWorkbench.close();G.inqTidyOff=true;});await open(1);
  assert.equal(await D.locator('.idv3-sum').count(),0);assert.match(one(await D.locator('.idv3-c1').innerText()),/고객이 남긴 말/,'끄기 = 예전 배치');
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',order,writes:0}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});

