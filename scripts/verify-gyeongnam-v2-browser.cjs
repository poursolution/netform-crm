'use strict';
/* 경남지사 v2 검사(2026-10-01 디자인 핸드오프 gyeongnam): 본사 확인용 — 목록(공통 필터줄·지사 담당 칩·진단·묶음 표) + 확인 창(견적문의 상세 모달 재사용).
   본사는 이 화면에서 실담당을 배정하지 않는다. 확인 요청·회수 검토는 기존 내부 메모 저장 경로로 기록만 남긴다. 끄면 예전 화면 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.GyeongnamV2&&window.InquiryDetailV2&&window.InquiryWorkbench&&window.CommonFilterBar&&window.PipelineDiagnosis);
  const info=await page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString();
   const branch=(SALES_PEOPLE_MASTER||[]).filter(p=>p.team==='gyeongnam'&&p.role!=='branch_pool'&&p.active!==false).map(p=>p.name);
   const inq=(n,site,days,owner,extra)=>Object.assign({id:'0000000'+n+'-0000-4000-8000-00000000000'+n,site,status:'배정완료',at:at(days+1),created_at:at(days+1),brand:n%2?'POUR솔루션':'석민이앤씨',phone:'010-1234-56'+(10+n),contact_name:'고객'+n,assignee:owner,assigned_to:owner,assigned_at:at(days),assignment_group:'gyeongnam',raw:{'문의내용':'견적 문의 '+n,'상담채널':'전화'}},extra||{});
   B={deals:[],inquiries:[inq(1,'[부산] 이편한세상광안비치아파트',18,'경남지사'),inq(2,'[경남 거제] 한국전력공사',17,'경남지사'),inq(3,'[경남 창원] 응대 없는 현장',6,branch[0]),inq(4,'[경남 김해] 진행 중 현장',9,branch[0],{status:'상담중',firstActivity:at(5),activities:[{type:'전화',note:'소장 통화 — 방문 일정 협의',at:at(5),actor:branch[0]}]}),inq(5,'[서울] 본사 문의',3,'이필선',{assignment_group:''})],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{window.__writes.push([op,p]);return 'req-'+window.__writes.length};
   goPage('gyeongnam');return {branch};
  });
  assert.ok(info.branch.length>=1,'지사 담당 목록');const rep=info.branch[0];
  await page.waitForTimeout(250);
  const v=page.locator('#gyeongnam-v2');assert.equal(await v.count(),1,'새 목록');
  /* 예전 영역 없음: 단계 숫자 5칸·미처리 두 목록·인계 원장·담당자별 흐름 표 */
  assert.equal(await page.locator('#gyeongnam-root .gn2-funnel,#gyeongnam-root .gn2-qcard,#gyeongnam-root .gn-frame,#gyeongnam-root .gn-handoff').count(),0);
  assert.equal(await page.locator('#pg-gyeongnam>.cf-bar:not([hidden])').count(),1,'공통 필터줄');
  assert.match(await page.evaluate(()=>document.getElementById('psub').textContent),/처리는 지사가, 확인은 본사가/);
  /* 진단 */
  assert.deepEqual(await v.locator('.pd-kpi span').allInnerTexts(),['넘긴 건','지사 미착수','지사 첫 연락','영업기회 · 수주']);
  assert.match(await v.locator('.pd-kpis').innerText(),/넘긴 건\s*4건[\s\S]*지사 미착수\s*2건[\s\S]*평균 18일[\s\S]*지사 첫 연락\s*1건/);
  assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),['어디서 멈췄나','언제 넘겼나','지사 담당은 움직이나']);
  assert.match(await v.locator('.pd-card').nth(0).innerText(),/넘김\s*4[\s\S]*지사 실담당 지정\s*2[\s\S]*지사 첫 연락\s*1[\s\S]*영업기회\s*0[\s\S]*수주\s*0/);
  assert.match(await v.locator('.pd-action').innerText(),/본사가 할 일[\s\S]*지사 미착수 2건[\s\S]*16일 넘은 건 2건/);
  /* 묶음 표: 같은 건이 한 번만 */
  assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),['현장 · 지사 담당','넘긴 날','지사 담당','지사 첫 연락','현재 단계','넘긴 후','']);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['지사 미착수','지사 응대 없음','영업 진행 확인됨']);
  assert.deepEqual(await v.locator('.plv-ghead span').allInnerTexts(),['2건','1건','1건']);
  assert.equal(await v.locator('.plv-row').count(),4,'본사 문의는 제외, 중복 없음');
  assert.match(await v.locator('.plv-row').first().innerText(),/이편한세상광안비치아파트[\s\S]*지사 미지정[\s\S]*미지정[\s\S]*없음[\s\S]*문의[\s\S]*18일[\s\S]*진행 확인/);
  assert.equal(await v.locator('[onclick*="gnOpenOwner"],button:has-text("실담당 지정")').count(),0,'본사 화면에 실담당 지정 버튼 없음');
  /* 지사 담당 칩 */
  const chips=await v.locator('.plv-chip').allInnerTexts();assert.match(chips[0],/^지사 미지정 2 · 멈춤 2$/);assert.ok(chips.some(c=>c.startsWith(rep+' 2')),chips.join('|'));
  await v.locator('.plv-chip',{hasText:rep}).click();await page.waitForTimeout(150);assert.equal(await v.locator('.plv-row').count(),2);
  await v.locator('.plv-chip.on').click();await page.waitForTimeout(150);assert.equal(await v.locator('.plv-row').count(),4);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 확인 창: 견적문의 상세 모달 + 진행 막대 5칸 + 오른쪽 '지사 진행 확인' */
  await v.locator('.plv-row').first().locator('.plv-site').click();await page.waitForTimeout(400);
  const d=page.locator('#inq-inbox-dialog.idv');assert.equal(await d.count(),1,'확인 창');
  assert.match(await d.locator('.idv-pill').innerText(),/^지사 미착수 · 18일$/);
  assert.deepEqual(await d.locator('.idv-steps span').allInnerTexts(),['본사 → 지사','지금 · 지사 실담당','지사 첫 연락','영업기회','수주']);
  assert.match(await d.locator('.idv-quote').innerText(),/견적 문의 1/);
  assert.deepEqual((await d.locator('.idv-thread .idv-bubble').allInnerTexts()).slice(0,2),['견적문의가 접수되었습니다.','본사 → 경남지사 인계']);
  const c3=d.locator('.idv-c3');
  assert.match(await c3.innerText(),/지사 진행 확인[\s\S]*본사 확인용 · 처리는 지사에서[\s\S]*넘긴 후\s*18일[\s\S]*지사 실담당\s*미지정[\s\S]*지사 연락 기록\s*없음[\s\S]*현재 단계\s*문의[\s\S]*넘긴 지 18일 동안 지사에서 움직임이 없어요[\s\S]*지사에 확인 요청[\s\S]*본사 회수 검토[\s\S]*경남지사 담당 현황/);
  assert.equal(await c3.locator('.idv-assign,.idv-rep').count(),0,'배정 칸 없음');
  if(shot)await page.screenshot({path:shot+'-confirm.png'});
  /* 지사에 확인 요청 = 기존 내부 메모 저장 경로로 기록 → 초록 표시 */
  await c3.locator('[data-gnc="request"]').click();await page.waitForTimeout(600);
  const memo=await page.evaluate(()=>{const q=B.inquiries[0],p=itemPatch(q,'inq')||{};return [...(q.activities||[]),...(p.activities||[])].map(a=>String(a.note||'')).filter(n=>n.startsWith('[지사 확인 요청]'));});
  assert.equal(memo.length,1,'메모 기록 1건');assert.match(memo[0],/넘긴 지 18일[\s\S]*요청 송보람/);
  assert.match(await page.locator('#inq-inbox-dialog .idv-c3').innerText(),/지사에 확인 요청함 · 지사장 응답 대기/);
  assert.equal(await page.locator('#inq-inbox-dialog .idv-c3 [data-gnc="request"]').count(),0);
  /* 닫으면 경남지사 화면으로 돌아오고 목록에 표시 */
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>G.page),'gyeongnam');
  assert.match(await page.locator('#gyeongnam-v2 .plv-row').first().innerText(),/확인 요청함/);
  /* 진행 중인 건: 막대·상태 */
  await page.locator('#gyeongnam-v2 .plv-ghead[data-plv-group="ok"] + .plv-row .plv-site').click();await page.waitForTimeout(400);
  assert.match(await d.locator('.idv-pill').innerText(),/^영업 진행 확인됨 · 9일$/);
  assert.deepEqual(await d.locator('.idv-steps span').allInnerTexts(),['본사 → 지사','지사 실담당','지사 첫 연락','지금 · 영업기회','수주']);
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(300);
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.gyeongnamV2Off=true;paint();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#gyeongnam-v2').count(),0);assert.equal(await page.locator('#gyeongnam-root .gn2-funnel').count(),1,'끄면 예전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',list_frame:true,diagnosis:true,groups_no_duplicates:true,branch_owner_chips:true,no_direct_assign:true,confirm_window:true,request_recorded_as_memo:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
