'use strict';
/* PC 오늘 업무 v6 (2026-10-20 design_handoff_pc_today_v6) — 합성 자료(현장 · 이름은 지어낸 것) · 외부 연결 차단 · 저장 없음
   확인: 제목 → 5칸 탭(숫자 = 4구역 판정 · 전체 = 합) → 왼쪽 오늘 진단 · 기록 없음 3가지 / 오른쪽 먼저 처리할 곳 카드(기한 지남 · 오늘 처리만) → 처리할 업무 줄
         · 카드 · 줄 같은 표기(현장 + 경과 숫자 한 번 · 할 일 · [견적문의/파이프라인] · 브랜드 · 단계) · 경과 = 확인된 기한 기준 · 없으면 '기한 ?'
         · 색: 브랜드(띠 · 이름) · 빨강(기한 지난 숫자 · 기한 지남 탭 숫자)만, 꼬리표 · [결과 기록] 은 회색 · 흰 바탕 검정 글씨
         · 탭 누르면 목록 필터 · 카드 · 줄 클릭 = 상세 창(견적문의 = 문의 상세 · 파이프라인 = 영업건 상세, 응대 기록부터) · 줄 아래 펼침 없음 · 글 잘림 없음 · 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1400},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.TodayV2&&window.TodayV3&&window.TodayV6&&window.DayZones&&window.WorkRequest&&window.OpsStore);
  await page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(-30),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01077778888',last_activity_at:at(1)},extra||{});
   B={deals:[
    deal('late3','[합성] 기한 지남 현장',{code:'sent',stage_code:'sent',activities:[{id:'a1',type:'전화',note:'통화 완료 · 견적 설명',at:at(9),occurred_at:at(9),actor:'이필선',meaningful:true}],next_action:{id:'n3',type:'전화',text:'견적 검토 확인',due:day(-3),status:'open'}}),
    deal('today1','[합성] 오늘 실측 현장',{brand:'석민이앤씨',next_action:{id:'n4',type:'방문',text:'현장 실측',due:day(0)+'T14:00',status:'open'}}),
    deal('wait1','[합성] 회신 대기 현장',{code:'waiting',stage_code:'waiting',waiting_reason:'입대의 결과 회신 대기',expected_resume_at:day(4)}),
    deal('bid0','[합성] 입찰 정보 보완 현장',{code:'compete',stage_code:'compete',next_action:{id:'n1',type:'전화',text:'입찰 서류 확인',due:day(2),status:'open'}})],
    inquiries:[{id:'aaaaaaaa-1111-4111-8111-111111111111',site:'[합성] 견적문의 현장',status:'배정완료',at:at(0.3),created_at:at(0.3),brand:'POUR솔루션',phone:'010-1234-5612',contact_name:'고객1',assignee:'이필선',assigned_to:'이필선',assigned_at:new Date(Date.now()-5*36e5).toISOString(),memo:'경사로 도장 문의',raw:{'문의내용':'견적 문의'}}],activities:[],inquiryTrash:[],expansion_pool:[]};
   try{localStorage.setItem('crm.dz.assignSeen.v1',JSON.stringify({'aaaaaaaa-1111-4111-8111-111111111111':1}));}catch(e){}
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.today3=null;G.tower=null;G.towerRole=null;G.todayQueueOwner='전체';G.todayV3Off=false;G.dayZones=null;G.workReq=null;G.todayV6Off=false;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__open=[];TodayWorkQueue.open=(k,a)=>{__open.push([k,a||'']);};
   const mk=(id,target)=>({id,target_type:'deal',target_id:target,site:'',brand:'POUR솔루션',kind:'follow',label:'후속 연락 요청',to_scope:'user',to_name:'이필선',requested_by:'송보람',asks:['후속 연락 요청'],status:'sent',round:1,created_at:new Date().toISOString(),due_at:new Date(Date.now()+7*36e5).toISOString(),due_label:'오늘 17:00',memo:'',to_me:true,by_me:false});
   SB={rpc:async(n)=>n==='crm_work_request_list_v1'?{data:{ok:true,requests:[mk('r1','late3')]}}:{data:{ok:true,requests:[],tasks:[],entries:[],sites:[],rows:[],events:[],comments:[],units:[],advisory:[]}}};TOKEN='test';OpsStore.aiOn=()=>false;
   goPage('today');
  });
  await page.waitForSelector('#today-v2 .tv6 .tv6-tabs');await page.waitForTimeout(900);
  const V=page.locator('#today-v2 .tv6');
  assert.match(one(await V.locator('.tv6-title').innerText()),/^오늘 업무 오늘 할 일 · 기한 지난 일 · 회신 기다리는 일 · 기록만 채울 일 · \d+\.\d+ \d{2}:\d{2} 기준/);
  const tabs=await V.locator('.tv6-tabs button').evaluateAll(l=>l.map(b=>[b.dataset.v,Number(b.querySelector('.n').textContent),b.querySelector('b:nth-child(2)').textContent,getComputedStyle(b.querySelector('.n')).color]));
  assert.deepEqual(tabs.map(t=>t[2]),['전체','기한 지남','오늘 처리','회신 대기','기록 보완'],'5칸 탭');
  const n=Object.fromEntries(tabs.map(t=>[t[0],t[1]]));
  assert.equal(n.all,n.late+n.now+n.wait+n.fix,'전체 = 네 칸 합');
  const Z=await page.evaluate(()=>{const z=DayZones.last();return {now:z.now.length,late:(z.late||[]).length,wait:z.wait.length,fix:(z.fix||[]).length};});
  assert.deepEqual({late:n.late,now:n.now,wait:n.wait,fix:n.fix},Z,'탭 숫자 = 4구역 판정(DayZones) 그대로');
  assert.ok(n.late>=2&&n.now>=1&&n.wait>=1,'합성 자료: 기한 지남(현장 · 문의) · 오늘 · 회신 대기: '+JSON.stringify(n));
  assert.equal(tabs.find(t=>t[0]==='late')[3],'rgb(180, 35, 24)','기한 지남 탭 숫자만 빨강');assert.equal(tabs.find(t=>t[0]==='now')[3],'rgb(21, 23, 28)');
  /* 왼쪽 오늘 진단 */
  const left=one(await V.locator('.tv6-left').innerText());
  assert.match(left,new RegExp('오늘 진단 '+n.all+'건 지금 먼저 기한 지남 '+n.late+' · 오늘 처리 '+n.now+' 관리자 요청 붙은 것 1건 고객 약속 오늘 1건 기한 미확인 0건'),left);/* 오늘 방문 = 기존 판정의 '오늘 약속'(rk promise) */
  assert.match(left,/이번 주 연락 \d+ \/ \d+곳/,'이번 주 처리 = 오늘 업무 v3 와 같은 주간 함수');
  assert.match(left,/기록 없음 3가지 .*현재 업무 미수행 \d+ .*과거 자료 미확인 \d+ .*해당 없음 \d+/,'기록 없음 3가지(PipelineJudge.missCounts)');
  /* 카드: 기한 지남 · 오늘 처리만 · 같은 표기 · 색 */
  const cards=await V.locator('.tv6-card').evaluateAll(l=>l.map(c=>({site:c.querySelector('.t b').textContent,d:c.querySelector('.d').textContent,dc:getComputedStyle(c.querySelector('.d')).color,task:c.querySelector('.k').textContent,sub:c.querySelector('.sub').textContent.replace(/\s+/g,' ').trim(),kd:getComputedStyle(c.querySelector('.kd')).color,bl:getComputedStyle(c).borderLeftColor,brand:getComputedStyle(c.querySelector('.sub b')).color})));
  assert.equal(cards.length,n.late+n.now,'카드 = 기한 지남 + 오늘 처리');
  const late=cards.find(c=>/기한 지남 현장/.test(c.site)),tod=cards.find(c=>/오늘 실측/.test(c.site)),inq=cards.find(c=>/견적문의 현장/.test(c.site));
  assert.equal(late.d,'3일');assert.equal(late.dc,'rgb(180, 35, 24)','지난 경과 숫자 = 빨강');assert.equal(late.task,'견적 검토 확인');assert.equal(late.sub,'파이프라인POUR솔루션 · 자료 발송완료');
  assert.equal(late.bl,'rgb(31, 157, 85)','왼쪽 띠 = 브랜드 색');assert.equal(late.brand,'rgb(31, 157, 85)','브랜드 이름 = 브랜드 색');
  assert.equal(late.kd,'rgb(75, 85, 99)','[파이프라인] 꼬리표 = 회색');
  assert.equal(tod.d,'14:00','오늘 = 시각');assert.equal(tod.dc,'rgb(21, 23, 28)');assert.equal(tod.bl,'rgb(232, 89, 12)');
  assert.equal(inq.d,'3시간','문의 첫 연락 기준이 지난 시간');assert.match(inq.sub,/^견적문의POUR솔루션 · 첫 연락$/);
  assert.equal(cards[0].site,late.site,'기한 지남 먼저(가장 오래 지난 것)');
  /* 줄 */
  const rows=()=>V.locator('.tv6-row').evaluateAll(l=>l.map(r=>({site:r.querySelector('.c1 .t b').textContent,d:r.querySelector('.c1 .d').textContent,task:r.querySelector('.c2 b').textContent,now:r.querySelector('.c3 span').textContent,rq:(r.querySelector('.c3 .rq')||{}).textContent||'',go:r.querySelector('.go').textContent,goStyle:[getComputedStyle(r.querySelector('.go')).backgroundColor,getComputedStyle(r.querySelector('.go')).color]})));
  let R=await rows();assert.equal(R.length,n.all,'전체 탭 = 모든 줄');
  const lr=R.find(r=>/기한 지남 현장/.test(r.site));assert.equal(lr.d,'3일');assert.match(lr.now,/통화 완료 · 견적 설명/,'지금 상황 = 마지막 기록');assert.equal(lr.rq,'송보람 요청 · 오늘 17:00','관리자 요청 꼬리표');
  assert.deepEqual(lr.goStyle,['rgb(255, 255, 255)','rgb(21, 23, 28)'],'[결과 기록] = 흰 바탕 · 검정 글씨');
  const wr=R.find(r=>/회신 대기 현장/.test(r.site));assert.match(wr.now,/입대의 결과 회신 대기/);assert.match(wr.d,/^\d+\.\d+$/,'회신 대기 = 확인일');
  assert.equal(R.every(r=>r.go==='결과 기록'),true);
  /* 탭 → 필터 */
  await V.locator('.tv6-tabs [data-v="wait"]').click();await page.waitForTimeout(200);R=await rows();assert.equal(R.length,n.wait);assert.ok(R.every(r=>/회신 대기/.test(r.site)));
  await V.locator('.tv6-tabs [data-v="late"]').click();await page.waitForTimeout(200);R=await rows();assert.equal(R.length,n.late);
  await page.locator('#today-v2 .tv6 .tv6-tabs [data-v="all"]').click();await page.waitForTimeout(200);
  /* 클릭 = 상세 창 */
  await page.locator('#today-v2 .tv6-card',{hasText:'견적문의 현장'}).click();
  assert.deepEqual(await page.evaluate(()=>__open[__open.length-1]),['inq:aaaaaaaa-1111-4111-8111-111111111111','contact'],'견적문의 = 문의 상세 응대 기록');
  await page.locator('#today-v2 .tv6-row',{hasText:'오늘 실측 현장'}).locator('.c2').click();
  assert.deepEqual(await page.evaluate(()=>__open[__open.length-1]),['deal:today1','contact'],'파이프라인 = 영업건 상세 응대 기록');
  await page.locator('#today-v2 .tv6-row',{hasText:'기한 지남 현장'}).locator('.go').click();
  assert.deepEqual(await page.evaluate(()=>__open[__open.length-1]),['deal:late3','contact'],'[결과 기록] = 같은 창');
  assert.equal(await page.locator('#today-v2 .tv6 .dz-table,#today-v2 .tv6 .open,#today-v2 .tv6 .fold').count(),0,'줄 아래 펼침 없음');
  /* 글 잘림 없음(넘치면 말줄임) */
  assert.equal(await V.evaluate(v=>[...v.querySelectorAll('.tv6-card span,.tv6-card b,.tv6-row span,.tv6-row b')].every(s=>s.scrollWidth<=s.clientWidth+1||getComputedStyle(s).textOverflow==='ellipsis'||getComputedStyle(s.parentElement).textOverflow==='ellipsis')),true,'글 잘림 없음');
  if(process.env.T6_SHOT)await page.locator('#today-v2').screenshot({path:process.env.T6_SHOT});
  /* 끄기 */
  await page.evaluate(()=>{G.todayV6Off=true;TodayV2.render();});await page.waitForTimeout(300);
  assert.equal(await page.locator('#today-v2 .tv6').count(),0);assert.ok(await page.locator('#today-v2 .tv3 .dz').count()>=1,'끄기 = 예전 4구역 화면');
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',tabs:n,cards:cards.length,writes:0}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
