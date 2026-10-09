'use strict';
/* 경남지사 B안 검사(2026-10-03 "파이프라인 기준으로"): 왼쪽 지사 진행 진단(막대 3칸 · 숫자 3 · 사유 · 할 일 · 지사 담당 현황) / 오른쪽 확인할 건 · 정렬은 빨강 사유 순 · 열기는 기존 확인 창 · 끄면 v2 묶음 표 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.GyeongnamB&&window.StageBoard&&window.GyeongnamV2&&window.InquiryWorkbench&&window.CommonFilterBar);
  const info=await page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString();
   const branch=(SALES_PEOPLE_MASTER||[]).filter(p=>p.team==='gyeongnam'&&p.role!=='branch_pool'&&p.active!==false).map(p=>p.name);
   const inq=(n,site,days,owner,extra)=>Object.assign({id:'0000000'+n+'-0000-4000-8000-00000000000'+n,site,status:'배정완료',at:at(days+1),created_at:at(days+1),brand:n%2?'POUR솔루션':'석민이앤씨',phone:'010-1234-56'+(10+n),contact_name:'고객'+n,assignee:owner,assigned_to:owner,assigned_at:at(days),assignment_group:'gyeongnam',raw:{'문의내용':'견적 문의 '+n,'상담채널':'전화'}},extra||{});
   B={deals:[],inquiries:[inq(1,'[부산] 이편한세상광안비치아파트',18,'경남지사'),inq(2,'[경남 거제] 한국전력공사',17,'경남지사'),inq(3,'[경남 창원] 응대 없는 현장',6,branch[0]),inq(4,'[경남 김해] 진행 중 현장',9,branch[0],{status:'상담중',firstActivity:at(5),activities:[{type:'전화',note:'소장 통화 — 방문 일정 협의',at:at(5),actor:branch[0]}]}),inq(5,'[서울] 본사 문의',3,'이필선',{assignment_group:''}),inq(6,'[경남 양산] 8일 무응답 현장',8,branch[0])],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;G.gnOwner='전체';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{window.__writes.push([op,p]);return 'req-'+window.__writes.length};
   goPage('gyeongnam');return {branch};
  });
  assert.ok(info.branch.length>=1,'지사 담당 목록');const rep=info.branch[0];
  await page.waitForTimeout(300);
  const v=page.locator('#gyeongnam-b');assert.equal(await v.count(),1,'B안 보드');assert.equal(await page.locator('#gyeongnam-v2').count(),0,'v2 묶음 표 없음');
  assert.equal(await page.locator('#pg-gyeongnam>.cf-bar:not([hidden])').count(),1,'공통 필터줄');
  assert.equal(await page.evaluate(()=>document.getElementById('ptitle').textContent),'경남지사');
  /* 공용 틀(2026-10-06 "리스트에서 이질감 없이"): 파이프라인 v3 와 같은 틀 — 상태 탭 4칸 · 진단 숫자 3개 · 사유 · 할 일 · 지사 담당 상자 */
  assert.deepEqual(await v.locator('.ps3-tabs .ps3-tab').evaluateAll(l=>l.map(b=>b.querySelector('.l').textContent+' '+b.querySelector('.n').textContent)),['전체 5','연결 확인 필요 4','니즈 확인 0','방문·견적 진행 1']/* contact_link ②: 3단계 · 연락 전은 1단계 안의 빨강 */);
  assert.match(await v.locator('.ps3-kpis').innerText(),/기준 넘김\s*3건[\s\S]*확인 필요\s*4건[\s\S]*평균 넘긴 후\s*\d+일/);
  const reasons=await v.locator('.ps3-reason>span>b:first-child').allInnerTexts();
  assert.deepEqual(reasons,['넘긴 지 16일 · 움직임 없음','넘긴 후 7일 · 지사 응대 없음','지사 실담당 미지정','지사 첫 연락 없음'],JSON.stringify(reasons));
  assert.match(await v.locator('.ps3-diag>.ps3-box').nth(2).innerText(),/그래서 뭘 해야 하나[\s\S]*넘긴 지 16일 · 움직임 없음 2건[\s\S]*넘긴 후 7일 · 지사 응대 없음 3건/);
  assert.deepEqual((await v.locator('.prv-head span').allInnerTexts()).map(t=>t.trim()),['현장 · 담당','현재 상황','걸린 사유 · 경과',''],'줄 = 파이프라인 v11 4칸');
  assert.match(await v.locator('.gb-team').innerText(),new RegExp('지사 담당은 움직이나[\\s\\S]*'+rep+'[\\s\\S]*넘겨받음 3 · 연락 1'));
  /* 정렬: 16일 넘은 둘(18일 → 17일) → 8일 무응답 → 6일 → 진행 중 */
  const order=await v.locator('.psb-row').evaluateAll(a=>a.map(n=>n.querySelector('.prv-a>b').textContent));
  assert.deepEqual(order,['[부산] 이편한세상광안비치아파트','[경남 거제] 한국전력공사','[경남 양산] 8일 무응답 현장','[경남 창원] 응대 없는 현장','[경남 김해] 진행 중 현장'],JSON.stringify(order));
  assert.match(await v.locator('.psb-row').first().innerText(),/이편한세상광안비치아파트[\s\S]*POUR솔루션 · 지사 미지정 · 문의[\s\S]*연결 확인 필요[\s\S]*지사 연락 없음[\s\S]*넘긴 지 16일 · 움직임 없음[\s\S]*18일[\s\S]*회수 검토/);
  assert.match(await v.locator('.psb-row').nth(2).innerText(),new RegExp('8일 무응답 현장[\\s\\S]*'+rep+'[\\s\\S]*연결 확인 필요[\\s\\S]*넘긴 후 7일 · 지사 응대 없음[\\s\\S]*8일[\\s\\S]*확인 요청'));
  assert.match(await v.locator('.psb-row').nth(4).innerText(),/진행 중 현장[\s\S]*방문·견적 진행[\s\S]*9일[\s\S]*진행 확인/);
  assert.equal(await v.locator('[onclick*="gnOpenOwner"],[data-gn="assign"],.psb-row button:has-text("실담당 지정")').count(),0,'본사 화면에 실담당 지정 버튼 없음');
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 지사 담당 칩 · 막대 칸 필터 · 보드 */
  const chips=await v.locator('.plv-chip').allInnerTexts();assert.ok(chips.some(c=>/^지사 미지정 2 · 멈춤 2$/.test(c)),chips.join('|'));assert.ok(chips.some(c=>c.startsWith(rep+' 3')),chips.join('|'));
  await v.locator('.plv-chip',{hasText:rep}).click();await page.waitForTimeout(150);assert.equal(await page.locator('#gyeongnam-b .psb-row').count(),3);
  await page.locator('#gyeongnam-b .plv-chip.on').click();await page.waitForTimeout(150);assert.equal(await page.locator('#gyeongnam-b .psb-row').count(),5);
  await page.locator('#gyeongnam-b .ps3-tabs .ps3-tab').nth(3).click();await page.waitForTimeout(150);assert.equal(await page.locator('#gyeongnam-b .psb-row').count(),1);
  await page.locator('#gyeongnam-b [data-sb="clear"]').click();await page.waitForTimeout(150);
  await page.locator('#gyeongnam-b [data-sb="view"][data-v="board"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#gyeongnam-b .ps3-col').count(),3);assert.equal(await page.locator('#gyeongnam-b .ps3-card').count(),5);
  await page.locator('#gyeongnam-b [data-sb="view"][data-v="list"]').click();await page.waitForTimeout(150);
  /* 열기 = 기존 확인 창(견적문의 상세 모달 + 지사 진행 확인) · 사유 버튼은 그 버튼에 포커스(자동 기록 없음) */
  await page.locator('#gyeongnam-b .psb-row').first().locator('.prv-a').click();await page.waitForTimeout(400);
  const d=page.locator('#inq-inbox-dialog.idv');assert.equal(await d.count(),1,'확인 창');
  assert.match(await d.locator('.idv-pill').innerText(),/^지사 미착수 · 18일$/);assert.match(await d.locator('.idv-c3').innerText(),/지사 진행 확인[\s\S]*지사에 확인 요청[\s\S]*본사 회수 검토/);
  await page.keyboard.press('Escape');await page.waitForTimeout(200);assert.equal(await page.locator('#inq-inbox-dialog.idv').count(),0);
  await page.locator('#gyeongnam-b .psb-row').first().locator('[data-sb="act"]').click();await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.matches('#inq-inbox-dialog [data-gnc="recall"]')),true,'회수 검토 버튼에 포커스');
  assert.deepEqual(await page.evaluate(()=>__writes.map(w=>w[0])),[],'자동 기록 없음');
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.gyeongnamBOff=true;paintGyeongnam();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#gyeongnam-b').count(),0);assert.equal(await page.locator('#gyeongnam-v2').count(),1,'끄면 v2 묶음 표');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',board_frame:true,diagnosis_3bars:true,reasons_order:true,sort_red_first:true,team_box:true,chips_filters:true,open_existing_confirm:true,no_auto_record:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
