'use strict';
/* 진행 범위 하나 · 과거 이관 분리 — 화면 확인 (2026-10-05 대표 승인 · design_handoff_consistency ② ③ ④)
   합성 자료(이름 · 현장은 지어낸 것): 유효 단계의 진행 5건 + 예전 리드 단계 값 6건(과거 이관) + 수주 1 · 실주 1.
   확인: ① 파이프라인 · 오늘 업무 · 대시보드 · 주간 브리핑의 '진행'이 같은 숫자 ② 컨설팅 설계에 과거 이관이 섞이지 않는다
        ③ 과거 이관 · 분류 전 목록(예전 단계 탭 · 기록 있는 건 먼저 · 단계 값 없는 건은 재개 잠금) ④ [영업 재개] = 상세 창의 단계 올리기(서버에 저장된 예전 단계 값에서 출발)
        ⑤ 파이프라인 줄: 다음 행동 · 기한 · 공종 · 영업건 번호가 항상 보이고 같은 단지 진행 n건을 알린다 ⑥ 끄면 예전처럼 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1500,height:950},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineScope&&window.PipelineLegacy&&window.PipelineWorkspace&&window.TodayWorkQueue&&typeof goPage==='function');
  const setup=()=>page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const deal=(id,code,owner,o)=>Object.assign({id,site:'[경기 수원] 범위 확인 '+id,site_id:'s-'+id,assignee:owner,brand:'POUR솔루션',created:'2026-09-10',code,stage_code:code,amt:1e8,amount:1e8,activities:[],workItems:[],workSummary:''},o);
   B={deals:[
    deal('a1','consulting','이필선',{nextActionObj:{text:'1차 미팅',due:day(2),type:'방문'},workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄',workSummary:'옥상(우레탄)'}),
    deal('a2','sent','황윤선',{site:'[경기 수원] 한빛마을아파트',site_id:'s-same'}),
    deal('a3','rapport','이필선',{site:'[경기 수원] 한빛마을아파트',site_id:'s-same'}),
    deal('a4','contract','정정훈'),
    deal('a5','sent','이승우'),/* 직원 명단에는 있지만 영업 담당이 아닌 사람(대표)의 진행 건 */
    deal('l1','qualified','이필선',{created:'2025-03-02',brand:''}),
    deal('l2','potential','황윤선',{created:'2025-06-11',brand:''}),
    deal('l3','nurturing','이필선',{created:'2024-12-01',activities:[{id:'x1',type:'전화',note:'[전화 · 연결됨] 내년 검토',at:'2026-09-20T02:00:00Z'}]}),
    deal('l4','working','',{created:'2026-01-20'}),
    deal('l5','','한준엽',{created:'2025-08-28',stage:'서포트 단계',code:''}),
    deal('l6','qualified','김성준',{created:'2024-05-05'}),/* 직원 명단에 없는 이름 */
    deal('w1','won','이필선',{grp:'수주 성공',closed_at:'2026-06-10',won_amount:2e8}),
    deal('x1','lost','황윤선',{grp:'수주 실패',closed_at:'2026-07-01'})],
    inquiries:[],activities:[],inquiryTrash:[],inquiryCleanupArchived:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'adm',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.pipeRepYear='전체';window.saveLocal=()=>{};
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
  });
  await setup();
  /* ① 같은 숫자: 진행 범위(규칙) = 파이프라인 = 오늘 업무 */
  const N=await page.evaluate(()=>{PipelineScope._reset();const sp=PipelineScope.split();goPage('pipe');PipelineWorkspace.open('all');
   const live=PipelineWorkspace.rows().filter(r=>!['won','lost','expansion','legacy'].includes(r.group));
   return {scope:[sp.active.map(d=>d.id).sort().join(','),sp.legacy.map(d=>d.id).sort().join(',')],pipe:live.length,today:TodayWorkQueue.data().D.length,tower:B.deals.filter(towerActive).length,
    badge:document.querySelector('.menu [data-p="pipe"] .badge').textContent,title:document.querySelector('.menu [data-p="pipe"] .badge').title,
    menu:[...document.querySelectorAll('#pipeline-stage-menu .plv-mi')].map(b=>b.innerText.replace(/\s+/g,' ').trim()),head:(document.querySelector('.pk-sum')||{}).innerText,legacyBtn:(document.querySelector('.pk-head .pk-legacy')||{}).innerText};});
  assert.deepEqual(N.scope,['a1,a2,a3,a4,a5','l1,l2,l3,l4,l5,l6']);
  assert.deepEqual([N.pipe,N.today,N.tower,N.badge],[5,5,5,'5'],'파이프라인 · 오늘 업무 · 진행 판정이 같은 숫자');
  assert.match(N.title,/^기준: 현재 CRM 유효 단계.*과거 이관 · 분류 전 제외 · 모든 연도$/);
  /* ② 컨설팅 설계에는 진짜 컨설팅 설계만(예전 리드 단계 값이 섞이지 않는다) · 과거 이관은 맨 아래 따로 */
  assert.deepEqual(N.menu,['컨설팅 설계 1','자료 발송완료 2','관계관리 1','경쟁·입찰 0','계약·시공 1','수주 1','실주 1','과거 이관 · 분류 전 6']);
  assert.match(one(N.head),/^진행 5건 금액/);assert.equal(one(N.legacyBtn),'과거 이관 · 분류 전 6건');
  /* 대시보드 · 주간 브리핑도 같은 진행 건수 + 기준 한 줄 */
  await page.evaluate(()=>goPage('dash'));await page.waitForSelector('#si-dash .db-kpi');
  const kpi=await page.evaluate(()=>[...document.querySelectorAll('#si-dash .db-kpi')].map(b=>[b.querySelector('span').innerText,b.querySelector('small').innerText,b.title]).find(k=>k[0]==='진행 중 파이프라인'));
  assert.equal(kpi[1],'진행 5건 · 수주 · 실주 · 과거 이관 6건 제외');assert.match(kpi[2],/^기준: 현재 CRM 유효 단계/);
  await page.evaluate(()=>goPage('brief'));await page.waitForSelector('#brief-b .bb-ref');
  assert.match(one(await page.locator('#brief-b .bb-ref').innerText()),/^전체 현황 \(참고\) 진행 5건 \(성과 대상 담당 4건\) · 과거 이관 · 분류 전 6건 따로/);
  /* ③ 과거 이관 · 분류 전 목록 */
  await page.evaluate(()=>{goPage('pipe');PipelineWorkspace.open('legacy');});await page.waitForSelector('#pipeline-legacy .plg-row');
  const shot=async n=>{if(process.env.SHOT_DIR)await page.screenshot({path:require('node:path').join(process.env.SHOT_DIR,'scope-'+n+'.png')});};
  const L=page.locator('#pipeline-legacy');await shot('legacy');
  /* 정리안(2026-10-06 design_handoff_legacy): 제목 줄 숫자 3개 · 담당자별 재개 카드 · 탭 4개 + 예전 단계 선택칸 · v11 모양 줄 — 상세는 scripts/verify-pipeline-legacy-browser.cjs */
  assert.equal(one(await L.locator('.plg-head').innerText()),'과거 이관 · 분류 전 예전 시스템에서 옮겨 온 자료 · 진행 건수 · 메이드율 계산에 안 들어감 전체 6 · 담당자 확인 대상 4 · 담당 배정 후 확인 2 · 서버 보완 필요 0');
  assert.deepEqual(await L.locator('.plg-owner').evaluateAll(l=>l.map(n=>n.querySelector('b').textContent+' '+n.querySelector('span').textContent)),['이필선 2건','한준엽 1건','황윤선 1건','담당 없음 2건']);
  assert.deepEqual((await L.locator('.plg-tabs [role="tab"]').allInnerTexts()).map(one),['전체 6','담당자 확인 대상 4','담당 없음 2','서버 보완 필요 0']);
  const rows=await L.locator('.plg-row').evaluateAll(l=>l.map(r=>{const t=s=>r.querySelector(s).innerText.replace(/\s+/g,' ').trim();return [r.dataset.key,t('.prv-a span'),t('.prv-c'),t(':scope>button'),t('.prv-b')];}));
  assert.equal(rows[0][0],'l3','CRM 기록이 있는 건이 먼저');assert.equal(rows[0][2],'CRM 기록 있음 지난 응대 이력 이어서 사용');
  assert.deepEqual(rows.find(r=>r[0]==='l1').slice(1),['브랜드 미지정 · 예전 등록 2025.3','CRM 기록 없음 기존 연락·결과·현재 추진 여부 확인','영업 재개','예전 단계 · 검증된 고객 기존 담당 이필선']);
  assert.deepEqual(rows.find(r=>r[0]==='l5').slice(2,4),['CRM 기록 없음 기존 연락·결과·현재 추진 여부 확인','영업 재개'],'서버에 단계 값이 비어 있어도 영업 재개(출발 단계 unclassified · sql/transition-null-stage-v1-20261007.sql)');
  assert.deepEqual(rows.find(r=>r[0]==='l6').slice(3),['담당 배정','예전 단계 · 검증된 고객 기존 담당 김성준 · CRM 명단에 없음'],'명단에 없는 담당의 과거 이관 자료도 목록에 있다(배정이 필요한 자료)');
  assert.equal(rows.some(r=>r[3]==='서버 보완 요청'),false,'서버 보완 요청 줄이 없다');
  await L.locator('select[data-plg="old"]').selectOption('검증된 고객');await page.waitForTimeout(200);
  assert.deepEqual((await L.locator('.plg-row').evaluateAll(l=>l.map(r=>r.dataset.key))).sort(),['l1','l6']);
  /* ④ [영업 재개] → 상세 창: '컨설팅 설계'라고 적지 않고, 단계 올리기 띠가 열린다 */
  await L.locator('.plg-row[data-key="l1"]>button').click();await page.waitForSelector('#detailView.dv3 .dv3-move:not([hidden])',{timeout:5000});
  const D=await page.evaluate(()=>{const v=document.getElementById('detailView'),t=s=>{const n=v.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():'';};
   return {legacy:v.classList.contains('dv3-legacy'),badge:t('.dv3-stagebadge'),sub:t('.dv3-subrow .tx'),mv:t('.dv3-headact .mv'),band:t('.dv3-move .hd'),steps:getComputedStyle(v.querySelector('.ddv-steps')||v).display,
    stages:[...v.querySelectorAll('.dv3-moves [data-stage]')].map(b=>[b.textContent.trim(),b.classList.contains('cur'),b.getAttribute('aria-disabled')==='true']),now:t('.dvs-task .dvs-tt>b')+' | '+t('.dvs-task .dvs-aux'),btn:t('.dvs-task .dvs-primary')};});
  await shot('resume');
  assert.equal(D.legacy,true);assert.equal(D.badge,'과거 이관 · 분류 전');assert.match(D.sub,/예전 단계 검증된 고객$/);assert.doesNotMatch(D.sub,/컨설팅|일째/);
  assert.equal(D.mv,'영업 재개 ▴');assert.match(D.band,/^영업 재개 — 어느 단계로 올릴까요\? 단계 · 다음 행동 · 날짜를 정하면 그때부터 진행 건이 됩니다$/);
  assert.deepEqual(D.stages.filter(s=>['컨설팅 설계','자료 발송완료','관계관리','경쟁·입찰','계약·시공'].includes(s[0])).map(s=>s.slice(1)),[[false,false],[false,false],[false,false],[false,false],[false,false]],'다섯 단계 모두 고를 수 있고 지금 단계 표시는 없다');
  /* 과거 이관 건도 7단계 공통 틀(deal-frame7.js): 할 일 = 영업 재개 판단 · 주 버튼 [영업 재개] · 안내 한 줄 */
  assert.match(D.now,/^영업 재개 판단 \|/,D.now);/* 지침 줄은 오른쪽 정리에서 뺐다 — 안내는 주 버튼 [영업 재개]와 단계 정하는 창 */assert.equal(D.btn,'영업 재개');
  /* 단계를 고르면 기존 전환 창 — 출발 단계는 서버에 저장된 예전 값(검증된 고객)이다 */
  await page.locator('#detailView .dv3-moves [data-stage="relationship"]').click();await page.waitForSelector('#stage-transition-form');
  assert.match(one(await page.locator('#stage-transition-form header p').innerText()),/^과거 이관 · 검증된 고객 → /);
  await page.evaluate(()=>{try{StageTransitionUI.close();}catch(e){}try{closeDetail();}catch(e){}});await page.waitForTimeout(200);
  /* ⑤ 파이프라인 줄(2026-10-06 목록 줄 v11 · 펼침 없음): 공종 · 다음 업무 · 기한은 줄에 항상 보인다. 줄을 누르면 바로 상세 */
  await page.evaluate(()=>PipelineWorkspace.open('consulting'));await page.waitForSelector('#pipeline-stage-v3 .ps3-row');
  const r1=await page.evaluate(()=>{const r=document.querySelector('#pipeline-stage-v3 .ps3-row[data-key="a1"]'),t=s=>{const n=r.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():null;};return [document.querySelectorAll('#pipeline-stage-v3 .ps3-row').length,t('.prv-a>span'),t('.prv-c'),r.dataset.ps3];});
  assert.equal(r1[0],1,'컨설팅 설계 목록에 과거 이관이 없다');assert.match(r1[1],/ · 옥상\(우레탄\) · /);assert.match(r1[2],/^1차 미팅 (\d+일 지남|오늘까지|내일까지|\d{1,2}\/\d{1,2}까지)( 판정: .+)?$/);assert.equal(r1[3],'open','줄 = 바로 상세');
  await page.evaluate(()=>PipelineWorkspace.open('sent'));await page.waitForSelector('#pipeline-stage-v3 .ps3-row[data-key="a2"]');
  await shot('rows');
  assert.deepEqual(await page.evaluate(()=>{const r=document.querySelector('#pipeline-stage-v3 .ps3-row[data-key="a2"]'),t=s=>{const n=r.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():null;};return [t('.prv-c>small'),/ · 공종 미분류 · /.test(t('.prv-a>span')),t('.prv-c>b')];}),['판정 불가 · 기한 계산 안 함',true,'실제 발송 · 기존 증빙 확인']/* 발송일 · 연락 기록이 없는 건은 기한을 세지 않는다(2026-10-06 집계 ④) · stage7 ②: 발송일 없는 건의 다음 업무 = 실제 발송 · 기존 증빙 확인 */);
  /* ⑥ 끄면 예전처럼: 예전 단계 값이 컨설팅 설계로 들어온다 */
  const off=await page.evaluate(()=>{G.pipeScopeOff=true;PipelineWorkspace.open('all');const r=PipelineWorkspace.rows();const out=[r.filter(x=>x.group==='consulting').length,!!document.querySelector('#pipeline-stage-menu .plv-legacy')];G.pipeScopeOff=false;PipelineWorkspace.open('all');return out;});
  assert.deepEqual(off,[6,false]);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('pipeline scope ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
