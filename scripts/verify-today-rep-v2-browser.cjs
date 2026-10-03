'use strict';
/* 오늘 업무 · 영업사원 화면 v2 검사(2026-10-02 핸드오프 today 추가 2a): 급한 곳 머리줄 · 카드(처음 4장 · 더보기 · 색 · 내용 순서) · 결과 6개 · 나머지 묶음 표.
   목록 · 열기는 기존 TodayWorkQueue. 결과는 그 건 상세에 채워서 열 뿐 직접 저장하지 않는다. 관리자 화면은 그대로. 끄면 이전 영업사원 화면 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.TodayV2&&window.TodayRepV2&&window.TodayWorkQueue&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const inq=(i,site,days,extra)=>Object.assign({id:'0000000'+i+'-0000-4000-8000-00000000000'+i,site,status:'배정완료',at:at(days),created_at:at(days),brand:'POUR솔루션',phone:'010-1234-56'+(10+i),contact_name:'고객'+i,assignee:'이필선',assigned_to:'이필선',assigned_at:at(days-0.1),memo:'옥상 방수 견적 문의',raw:{'문의내용':'견적 문의'}},extra||{});
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(0),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01077778888'},extra||{});
   B={deals:[
     deal('late1','기한 지난 현장 A',{next_action:{id:'n1',type:'전화',text:'견적 확인 전화',due:day(-5),status:'open'}}),deal('late2','기한 지난 현장 B',{amt:5e8,code:'bidding',stage_code:'bidding',next_action:{id:'n2',type:'전화',text:'입찰 조건 확인',due:day(-2),status:'open'}}),
     deal('today1','오늘 약속 현장',{next_action:{id:'n3',type:'방문',text:'현장 실사',due:day(0)+'T14:00',status:'open'}}),deal('soon1','입찰 임박 현장',{code:'bidding',stage_code:'bidding',next_action:{id:'n4',type:'전화',text:'입찰 서류 확인',due:day(2),status:'open'},stage_contexts:{bidding:{fields:{bid_deadline:day(3)}}}}),
     deal('later1','다음 주 현장',{next_action:{id:'n5',type:'전화',text:'안부 전화',due:day(6),status:'open'}}),deal('other','남의 현장',{assignee:'황윤선',next_action:{id:'n6',text:'x',due:day(-9),status:'open'}})],
    inquiries:[inq(3,'첫 연락 늦은 현장',3),inq(5,'첫 연락 늦은 현장 2',2)],activities:[],inquiryTrash:[],expansion_pool:[]};
   G.todayTowerOff=true;/* 관제탑(2026-10-03) 뒤에 남는 예전 영업사원 화면 검사 */LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};goPage('today');
  });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>todayIsAdmin()),false,'영업사원으로 열림');
  const v=page.locator('#today-v2 .trv');assert.equal(await v.count(),1,'영업사원 새 화면');
  assert.equal(await page.locator('#today-v2 .twq-urgent, #today-v2 .tv-seg, #today-v2 .tv-list').count(),0,'가로 카드 줄 · 견적문의/파이프라인 탭 없음');
  const model=await page.evaluate(()=>{const X=TodayWorkQueue.data(),rows=X.rows.concat(TodayRepV2.upcoming(X.rows,X.D)),sp=TodayRepV2.split(rows);return {urgent:sp.urgent.map(u=>u.tone+':'+u.x.item.site),rest:sp.rest.map(x=>x.item.site)};});
  assert.deepEqual(model.urgent,['r:첫 연락 늦은 현장','r:첫 연락 늦은 현장 2','b:오늘 약속 현장','a:입찰 임박 현장','r:기한 지난 현장 A','r:기한 지난 현장 B'],'급한 순서: 첫 연락 늦음 → 오늘 약속 → 입찰 임박 → 기한 지남 '+JSON.stringify(model));assert.deepEqual(model.rest,['다음 주 현장']);
  /* ① 머리줄 */
  assert.match(await v.locator('.trv-head').innerText(),/급한 곳 6[\s\S]*늦음 4[\s\S]*오늘 약속 1[\s\S]*마감 임박 1[\s\S]*\+ 2곳 더보기/);
  assert.equal(await page.evaluate(()=>document.getElementById('psub').textContent),'필선님 · 오늘 7곳 · 급한 6곳부터');
  /* ② 카드: 처음 4장 · 급한 순서 · 색 */
  const cards=v.locator('.trv-card');assert.equal(await cards.count(),4,'처음에는 4장');
  assert.deepEqual(await cards.evaluateAll(a=>a.map(c=>c.dataset.tone)),['r','r','b','a']);
  assert.deepEqual(await cards.locator('.trv-why').allInnerTexts(),['첫 연락 3일 늦음','첫 연락 2일 늦음','오늘 14:00 약속','입찰 마감 D-3'],'급한 이유는 며칠 · 몇 시까지');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.trv-grid')).gridTemplateColumns.split(' ').length),4,'4열');
  assert.equal(await cards.first().evaluate(n=>{const s=getComputedStyle(n);return s.borderTopWidth+'|'+s.borderTopColor+'|'+s.animationName;}),'4px|rgb(229, 72, 77)|trv-pop');
  await v.locator('[data-trv="more"]').click();await page.waitForTimeout(200);const c0=page.locator('#today-v2 .trv-card').filter({hasText:'기한 지난 현장 B'});
  assert.match(await c0.innerText(),/후속 기한 2일 지남\s*파이프라인[\s\S]*기한 지난 현장 B[\s\S]*김소장[\s\S]*010-7777-8888[\s\S]*입찰\s*5억[\s\S]*원한 것[\s\S]*지난 기록[\s\S]*목표\s*입찰 조건 확인[\s\S]*“안녕하세요, 넷폼 이필선입니다\.[\s\S]*놓치면[\s\S]*전화\s*문자\s*결과/);
  assert.deepEqual(await c0.locator('.trv-steps i').evaluateAll(a=>a.map(i=>i.style.background)),['rgb(157, 180, 238)','rgb(157, 180, 238)','rgb(157, 180, 238)','rgb(229, 72, 77)','rgb(230, 233, 238)'],'단계 막대: 지난 단계 · 현재(카드 색) · 남은 단계');
  assert.match(await page.locator('#today-v2 .trv-card').filter({hasText:'기한 지난 현장 A'}).locator('.trv-why').innerText(),/^견적 회신 5일 지남$/);await page.locator('#today-v2 [data-trv="more"]').click();await page.waitForTimeout(200);
  assert.match(await cards.filter({hasText:'첫 연락 늦은 현장 2'}).innerText(),/첫 연락 2일 늦음\s*견적문의[\s\S]*고객5[\s\S]*옥상 방수 견적 문의/);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.trv-why,.trv-chip,.trv-miss')].every(n=>getComputedStyle(n).whiteSpace==='nowrap')),true,'급한 이유 · 경로 칩 · 놓치면은 한 줄');
  if(shot)await page.screenshot({path:shot+'-cards.png',fullPage:true});
  /* ③ 나머지 묶음 표: 카드에 안 들어간 곳 · 빈 묶음 숨김 */
  assert.deepEqual(await v.locator('.trv-thead span').allInnerTexts(),['현장 · 고객','고객이 원한 것','단계','금액','경과','']);
  assert.deepEqual(await v.locator('.trv-ghead').allInnerTexts().then(a=>a.map(t=>t.replace(/\s+/g,' '))),['기한 지남 2 · 늦은 순서대로','내일 · 이번 주 1 · 미리 준비'],'빈 묶음은 숨김');
  assert.deepEqual(await v.locator('.trv-row .c b').allInnerTexts(),['기한 지난 현장 A','기한 지난 현장 B','다음 주 현장']);assert.match(await v.locator('.trv-row').first().innerText(),/김소장 관리소장[\s\S]*설계[\s\S]*2억[\s\S]*5일/);
  /* 더보기 → 나머지 급한 곳이 카드로 */
  await v.locator('[data-trv="more"]').click();await page.waitForTimeout(200);
  assert.equal(await page.locator('#today-v2 .trv-card').count(),6);assert.equal(await page.locator('#today-v2 [data-trv="more"]').innerText(),'접기 ↑');
  assert.deepEqual(await page.locator('#today-v2 .trv-card').evaluateAll(a=>a.slice(4).map(c=>c.dataset.tone)),['r','r']);assert.deepEqual(await page.locator('#today-v2 .trv-row .c b').allInnerTexts(),['다음 주 현장']);
  await page.locator('#today-v2 [data-trv="more"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('#today-v2 .trv-card').count(),4);
  /* [결과] → 결과 6개(2열) → 고르면 그 건 상세가 결과가 채워진 채 열린다(직접 저장하지 않음) */
  await page.locator('#today-v2 [data-trv="more"]').click();await page.waitForTimeout(200);
  const cB=page.locator('#today-v2 .trv-card',{hasText:'기한 지난 현장 B'});
  await cB.locator('[data-trv="result"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.locator('#today-v2 .trv-results button').allInnerTexts(),['실사 잡음','견적 요청','나중에 다시','안 받음','번호 틀림','관심 없음']);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.trv-results')).gridTemplateColumns.split(' ').length),2,'2열');
  if(shot)await page.screenshot({path:shot+'-result.png'});
  await page.locator('#today-v2 .trv-results button',{hasText:'견적 요청'}).click();await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(()=>!!CUR_DETAIL&&CUR_DETAIL.item.id),'late2','그 건 상세가 열림');
  assert.equal(await page.locator('#detailView.on .idv-input textarea').inputValue(),'통화 완료 — 견적 요청 받음','결과 문구가 채워짐');
  assert.deepEqual(await page.evaluate(()=>__writes.filter(x=>x!=='opportunity_touch')),[],'고르는 것만으로는 저장하지 않는다');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(300);
  /* [전화] → 결과 6개가 열린다 · 행을 누르면 상세 */
  await page.evaluate(()=>{window.__tel=[];document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href^="tel:"]');if(a){e.preventDefault();__tel.push(a.getAttribute('href'));}},true);});
  await page.locator('#today-v2 .trv-card',{hasText:'기한 지난 현장 A'}).locator('[data-trv="call"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>__tel),['tel:01077778888'],'기존 전화 연결');assert.equal(await page.locator('#today-v2 .trv-card',{hasText:'기한 지난 현장 A'}).locator('.trv-results').count(),1);
  await page.locator('#today-v2 .trv-row',{hasText:'다음 주 현장'}).locator('.c').click();await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>CUR_DETAIL&&CUR_DETAIL.item.id),'later1','행 = 상세');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(300);
  /* 좁은 화면: 카드는 240px 아래로 줄지 않고, 넘치지 않는다 */
  await page.setViewportSize({width:1100,height:900});await page.waitForTimeout(1500);/* 등장 애니메이션이 끝난 뒤에 잰다 */
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.trv-card')].every(c=>c.getBoundingClientRect().width>=239)),true,'카드 최소 폭 240 '+await page.evaluate(()=>JSON.stringify([innerWidth,getComputedStyle(document.querySelector('.trv-grid')).gridTemplateColumns,[...document.querySelectorAll('.trv-card')].map(c=>Math.round(c.getBoundingClientRect().width))])));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  /* 관리자 화면은 그대로 · 끄기 */
  await page.evaluate(()=>{G.todayRepV2Off=true;paint();});await page.waitForTimeout(400);
  assert.equal(await page.locator('#today-v2 .trv').count(),0);assert.equal(await page.locator('#today-v2 .tv-list').count(),1,'끄면 이전 영업사원 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',rep_only:true,head_counts:true,four_cards_then_more:true,tone_order_colors:true,card_content_order:true,results_prefill_detail_no_direct_write:true,rest_table_groups:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
