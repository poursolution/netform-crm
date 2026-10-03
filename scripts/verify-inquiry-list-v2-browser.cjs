'use strict';
/* 견적문의 목록 v2 검사(2026-10-01 디자인 핸드오프): 우선순위 묶음·정렬·알약 필터·브랜드·검색·역할·더보기·상세 열기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),assert=require('node:assert/strict');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||u.hostname==='cdn.jsdelivr.net'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryListV2&&window.InquiryWorkbench);
  const info=await page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString();
   const mk=(i,site,days,owner,extra)=>Object.assign({id:'0000000'+i+'-0000-4000-8000-00000000000'+i,site,status:owner?'배정완료':'접수',at:at(days),created_at:at(days),brand:['POUR솔루션','석민이앤씨','POUR공법'][i%3],phone:i%4===3?'':'010-1234-56'+String(10+i),contact_name:['김소장','박과장','이대표'][i%3],assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(days-0.2):null,work_type:i%3?'옥상':'' ,raw:{'문의내용':['옥상 누수가 있어 방수 견적 요청드립니다. 15개동입니다.','외벽 재도장 견적 문의합니다','지하주차장 에폭시 견적 부탁드립니다'][i%3],'고객유형':['관리사무소','입주자대표회의','건설사'][i%3],'상담채널':['전화','홈페이지','카카오'][i%3]}},extra||{});
   const inq=[mk(1,'[경기 용인] 신갈현대아파트',21,''),mk(2,'정릉중앙하이츠빌2단지',9,''),mk(3,'[서울 강북] 번동한진아파트',0,''),
    mk(4,'동부센트레빌리지 4차',16,'이필선',{first_response_at:at(15),activities:[{type:'전화',note:'소장님 통화 — 견적 범위 확인',at:at(12)}]}),mk(5,'오뚜기 포승공장',11,'황윤선',{first_response_at:at(10),activities:[{type:'문자',note:'자료 발송 안내',at:at(9)}]}),
    mk(6,'[경기 여주] 꽃누리 하우스',0,'한준엽'),mk(7,'수원 영통 신나무실',0,'이필선'),
    mk(8,'화성 병점 우남퍼스트빌',4,'이필선',{first_response_at:at(3),activities:[{type:'전화',note:'현장 방문 일정 조율',at:at(2)}],nextActionObj:{text:'방문 일정 확정',due:new Date(Date.now()+3*864e5).toISOString().slice(0,10)}}),mk(9,'평택 비전 동문굿모닝힐',3,'황윤선',{first_response_at:at(2),activities:[{type:'방문',note:'현장 실측 완료',at:at(1)}]})];
   B={deals:[],inquiries:inq,activities:[],inquiryTrash:[]};LOCAL={deals:{},inquiries:{}};G.inqV3Off=true;/* 목록 v3(2026-10-03) 뒤에 남는 v2 목록 검사 */AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.pushWrite=()=>{};goPage('inq');
   const v=document.getElementById('inq-v2');
   return {on:document.getElementById('pg-inq').classList.contains('inq-v2'),tabs:v?[].map.call(v.querySelectorAll('.iv-tab'),b=>b.textContent.trim()):[],heads:v?[].map.call(v.querySelectorAll('.iv-ghead'),b=>b.textContent.replace(/\s+/g,' ').trim()):[],rows:v?[].map.call(v.querySelectorAll('.iv-row'),r=>r.dataset.group+':'+r.querySelector('.iv-site b').textContent+'|'+r.querySelector('.iv-cta').textContent):[],pills:[].map.call(document.querySelectorAll('#pg-inq>.cf-bar .cf-pill'),b=>b.textContent.trim()),title:document.getElementById('ptitle').textContent+'|'+document.getElementById('psub').textContent,inpage:!!v?.querySelector('h2'),owner:!!document.querySelector('#pg-inq>.cf-bar [data-cf=owner]'),more:!!v?.querySelector('.inq-work-tools'),fits:document.documentElement.scrollWidth<=innerWidth};
  });
  assert.equal(info.on,true,'v2 켜짐');
  assert.deepEqual(info.tabs,['전체9','지금 배정 필요3','7일 넘게 연락 없음2','오늘 들어온 문의2','진행 중2']);
  assert.deepEqual(info.rows.map(x=>x.split(':')[0]),['assign','assign','assign','stale','stale','today','today','active','active'],'묶음 순서');
  assert.match(info.rows[0],/신갈현대아파트\|배정$/,'묶음 안은 경과일 큰 순 · 미배정은 [배정]');
  assert.match(info.rows[5],/\|첫 연락$/);assert.match(info.rows[7],/\|후속 연락$/);
  assert.deepEqual(info.pills,['전체 9','석민이앤씨 3','POUR솔루션 3','POUR공법 3','아파트스퀘어 0']);
  assert.equal(info.title,'견적문의|위에서부터 처리하세요 · 배정 → 첫 연락 → 후속 연락 → 영업건 전환','제목은 상단 제목줄에만');assert.equal(info.inpage,false,'본문 큰 제목 없음');assert.equal(info.owner,true,'담당자 선택');
  assert.equal(info.more,true,'더보기 옮겨짐');assert.equal(info.fits,true);
  assert.equal(await page.evaluate(()=>['#sg-signals','#sg-panel'].every(s=>getComputedStyle(document.querySelector(s)).display==='none')),true,'예전 목록 숨김');
  /* 묶음 알약·제목줄 */
  await page.click('.iv-tab[data-v="stale"]');
  assert.deepEqual(await page.locator('.iv-row').evaluateAll(ns=>ns.map(n=>n.dataset.group)),['stale','stale']);
  assert.equal(await page.locator('.iv-ghead em').innerText(),'전체 보기');
  await page.click('.iv-ghead');assert.equal(await page.locator('.iv-row').count(),9,'제목줄로 전체 복귀');
  /* 브랜드 알약(기존 공통 필터 처리기) */
  await page.click('.cf-pill[data-sf-brand="석민이앤씨"]');
  assert.equal(await page.locator('.iv-row').count(),3);assert.equal(await page.locator('#pg-inq>.cf-bar .cf-pill.on').innerText().then(t=>t.replace(/\s+/g,' ').trim()),'석민이앤씨 3');
  await page.click('.cf-pill[data-sf-brand="전체"]');assert.equal(await page.locator('.iv-row').count(),9);
  /* 검색 */
  await page.fill('#pg-inq>.cf-bar .cf-search','오뚜기');await page.press('#pg-inq>.cf-bar .cf-search','Enter');
  assert.equal(await page.locator('.iv-row').count(),1);assert.equal(await page.evaluate(()=>G.q),'오뚜기');
  await page.fill('#pg-inq>.cf-bar .cf-search','');await page.press('#pg-inq>.cf-bar .cf-search','Enter');assert.equal(await page.locator('.iv-row').count(),9);
  /* 행 클릭 → 기존 상세, [배정] → 상세의 배정 칸 */
  await page.click('.iv-row[data-group="active"] .iv-site');
  assert.equal(await page.locator('#inq-inbox-dialog').count(),1,'행 클릭 → 상세');
  await page.evaluate(()=>InquiryWorkbench.close());
  await page.locator('.iv-row[data-group="assign"] .iv-cta').first().click();
  assert.equal(await page.locator('#inq-inbox-dialog.idv .idv-rep').count()>0,true,'[배정] → 새 상세의 배정 칸');
  await page.evaluate(()=>InquiryWorkbench.close());
  /* 더보기: 공종·상태·담당자 구분 필터와 예전 목록 전환 */
  await page.click('#inq-v2 .inq-work-tools>summary');
  assert.equal(await page.locator('#inq-v2 .inq-tools-body .inq-work-filters select[name="work"]').count(),1);
  assert.equal(await page.locator('#inq-v2 .inq-tools-body .sf-period').count(),1,'연도·분기는 더보기에');
  await page.click('#inq-v2 .iv-legacy');
  assert.equal(await page.evaluate(()=>!document.getElementById('inq-v2')&&getComputedStyle(document.querySelector('#sg-panel')).display!=='none'),true,'예전 목록으로 전환');
  await page.evaluate(()=>{G.inqV2Off=false;paint();});
  /* 담당자 선택(공통 필터줄) — '내 담당'을 대신한다. 선택하면 해제 단추, 화면을 옮겨도 유지 */
  await page.selectOption('#pg-inq>.cf-bar [data-cf="owner"]','이필선');
  assert.equal(await page.locator('.iv-row').count(),3,'이필선 담당 3건');assert.equal(await page.locator('#pg-inq>.cf-bar .cf-clear').count(),1);
  await page.selectOption('#pg-inq>.cf-bar [data-cf="owner"]','미배정');assert.deepEqual(await page.locator('.iv-row').evaluateAll(ns=>[...new Set(ns.map(n=>n.dataset.group))]),['assign']);
  await page.evaluate(()=>goPage('today'));await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.querySelector('#pg-today>.cf-bar [data-cf="owner"]')?.value+'|'+G.todayQueueOwner),'미배정|미배정','오늘 업무에서도 같은 담당자');
  assert.match(await page.evaluate(()=>document.getElementById('psub').textContent),/^\d+월 \d+일 \(.\) · 영업관리 · 팀 전체/);
  await page.evaluate(()=>goPage('inq'));await page.click('#pg-inq>.cf-bar .cf-clear');assert.equal(await page.locator('.iv-row').count(),9);
  /* 좁은 화면 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',groups:4,rows:info.rows.length,pills:true,search:true,open_detail:true,more:true,legacy:true,narrow:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
