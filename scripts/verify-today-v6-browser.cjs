'use strict';
/* PC 오늘 업무 v6 (2026-10-20 design_handoff_pc_today_v6 + 같은 날 대표 보완 "숫자 범위 · 업무 분류부터 통일") — 합성 자료 · 외부 연결 차단 · 저장 없음
   확인: '오늘 업무' 숫자 하나 = 기한 지남 + 오늘 처리(왼쪽 메뉴 배지 = 제목 = 첫 탭 = 기본 목록) · 회신 대기 · 기록 보완은 자기 탭에서만
         · 위 카드 복제 없음(같은 현장은 한 번) · 진단 · 기록 없음 칸 없음
         · 순서 = 기한 지남(넘긴 날 많은 순) → 오늘 처리(시각 순 → 약속) · 넘긴 날 = 확인된 기한을 넘긴 날 수(같은 날 = 오늘), 접수 · 배정 경과 안 섞음
         · 첫 응대가 된 문의 = '응대 중'(첫 연락 아님) · 색 = 브랜드 · 빨강(넘긴 날 · 기한 지남 탭)만 · [결과 기록] 흰 바탕 검정
         · 줄 클릭 = 상세 창 응대 기록 · 줄 아래 펼침 없음 · 글 잘림 없음 · 끄기 */
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
  await page.clock.setFixedTime(new Date('2026-10-20T13:40:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.TodayV2&&window.TodayV3&&window.TodayV6&&window.DayZones&&window.WorkRequest&&window.OpsStore);
  await page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(-30),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01077778888',last_activity_at:at(1)},extra||{});
   B={deals:[
    deal('late3','[합성] 기한 3일 지남',{code:'sent',stage_code:'sent',activities:[{id:'a1',type:'전화',note:'통화 완료 · 견적 설명',at:at(9),occurred_at:at(9),actor:'이필선',meaningful:true}],next_action:{id:'n3',type:'전화',text:'견적 검토 확인',due:day(-3),status:'open'}}),
    deal('today1','[합성] 오늘 14시 실측',{brand:'석민이앤씨',next_action:{id:'n4',type:'방문',text:'현장 실측',due:day(0)+'T14:00',status:'open'}}),
    deal('today2','[합성] 오늘 약속 시각 없음',{next_action:{id:'n5',type:'약속',text:'고객 약속: 견적서 보내기',due:day(0),status:'open'}}),
    deal('wait1','[합성] 회신 대기 현장',{code:'waiting',stage_code:'waiting',waiting_reason:'입대의 결과 회신 대기',expected_resume_at:day(4)}),
    deal('bid0','[합성] 입찰 정보 보완 현장',{code:'compete',stage_code:'compete',next_action:{id:'n1',type:'전화',text:'입찰 서류 확인',due:day(2),status:'open'}})],
    inquiries:[
     {id:'aaaaaaaa-1111-4111-8111-111111111111',site:'[합성] 첫 연락 전 문의',status:'배정완료',at:at(0.3),created_at:at(0.3),brand:'POUR솔루션',phone:'010-1234-5612',contact_name:'고객1',assignee:'이필선',assigned_to:'이필선',assigned_at:new Date(Date.now()-5*36e5).toISOString(),memo:'경사로 도장 문의',raw:{'문의내용':'견적 문의'}},
     {id:'aaaaaaaa-1111-4111-8111-222222222222',site:'[합성] 응대 중 문의',status:'응대중',at:at(20),created_at:at(20),brand:'POUR솔루션',phone:'010-1234-5613',contact_name:'고객2',assignee:'이필선',assigned_to:'이필선',assigned_at:at(20),first_response_at:at(10),responded_at:at(10),next_action_date:day(-1),next_action:{type:'전화',text:'견적 범위 · 금액 확인',due:day(-1),status:'open'},raw:{'문의내용':'옥상 방수 견적'}}],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   try{localStorage.setItem('crm.dz.assignSeen.v1',JSON.stringify({'aaaaaaaa-1111-4111-8111-111111111111':1,'aaaaaaaa-1111-4111-8111-222222222222':1}));}catch(e){}
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.today3=null;G.tower=null;G.towerRole=null;G.todayQueueOwner='전체';G.todayV3Off=false;G.dayZones=null;G.workReq=null;G.todayV6Off=false;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__open=[];TodayWorkQueue.open=(k,a)=>{__open.push([k,a||'']);};
   const mk=(id,target)=>({id,target_type:'deal',target_id:target,site:'',brand:'POUR솔루션',kind:'follow',label:'후속 연락 요청',to_scope:'user',to_name:'이필선',requested_by:'송보람',asks:['후속 연락 요청'],status:'sent',round:1,created_at:new Date().toISOString(),due_at:new Date(Date.now()+4*36e5).toISOString(),due_label:'오늘 17:40',memo:'',to_me:true,by_me:false});
   SB={rpc:async(n)=>n==='crm_work_request_list_v1'?{data:{ok:true,requests:[mk('r1','late3')]}}:{data:{ok:true,requests:[],tasks:[],entries:[],sites:[],rows:[],events:[],comments:[],units:[],advisory:[]}}};TOKEN='test';OpsStore.aiOn=()=>false;
   goPage('today');
  });
  await page.waitForSelector('#today-v2 .tv6 .tv6-tabs');await page.waitForTimeout(900);
  const V=page.locator('#today-v2 .tv6');
  const tabs=await V.locator('.tv6-tabs button').evaluateAll(l=>l.map(b=>[b.dataset.v,Number(b.querySelector('.n').textContent),b.querySelector('b:nth-child(2)').textContent,getComputedStyle(b.querySelector('.n')).color]));
  assert.deepEqual(tabs.map(t=>t[2]),['오늘 업무','기한 지남','오늘 처리','회신 대기','기록 보완'],'탭: 첫 칸 = 오늘 업무(실행 업무)');
  const n=Object.fromEntries(tabs.map(t=>[t[0],t[1]]));
  assert.equal(n.act,n.late+n.now,'오늘 업무 = 기한 지남 + 오늘 처리(회신 대기 · 기록 보완 제외)');
  const Z=await page.evaluate(()=>{const z=DayZones.last();return {now:z.now.length,late:(z.late||[]).length,wait:z.wait.length,fix:(z.fix||[]).length,total:z.total};});
  assert.deepEqual({late:n.late,now:n.now,wait:n.wait,fix:n.fix},{late:Z.late,now:Z.now,wait:Z.wait,fix:Z.fix},'탭 숫자 = 4구역 판정 그대로');
  assert.equal(Number(await page.locator('#todayBadge').textContent()),n.act,'왼쪽 메뉴 배지 = 오늘 업무 숫자');
  assert.match(one(await V.locator('.tv6-title').innerText()),new RegExp('^오늘 업무 '+n.act+'건 기한 지남 '+n.late+' \\+ 오늘 처리 '+n.now+' · 회신 대기 · 기록 보완은 따로'),'제목도 같은 숫자');
  assert.equal(tabs.find(t=>t[0]==='late')[3],'rgb(180, 35, 24)');assert.equal(tabs.find(t=>t[0]==='act')[3],'rgb(21, 23, 28)');
  /* 중복 · 설명 칸 없음 */
  assert.equal(await V.locator('.tv6-card,.tv6-top,.tv6-left').count(),0,'위 카드 복제 · 진단 · 기록 없음 칸 없음');
  assert.doesNotMatch(await V.innerText(),/오늘 진단|기록 없음 3가지|먼저 처리할 곳|뽑힌 이유|첫마디|놓치면/);
  /* 기본 목록 = 오늘 업무만 · 순서 · 숫자 */
  const rows=()=>V.locator('.tv6-row').evaluateAll(l=>l.map(r=>({site:r.querySelector('.c1 .t b').textContent,d:r.querySelector('.c1 .d').textContent,dc:getComputedStyle(r.querySelector('.c1 .d')).color,sub:r.querySelector('.sub').textContent.replace(/\s+/g,' ').trim(),task:r.querySelector('.c2 b').textContent,now:r.querySelector('.c3 span').textContent,rq:(r.querySelector('.c3 .rq')||{}).textContent||'',zone:r.dataset.zone,go:[getComputedStyle(r.querySelector('.go')).backgroundColor,getComputedStyle(r.querySelector('.go')).color]})));
  let R=await rows();
  assert.equal(R.length,n.act,'기본 목록 = 오늘 업무 숫자');assert.ok(R.every(r=>r.zone==='late'||r.zone==='now'),'기본 목록에 회신 대기 · 기록 보완 없음');
  assert.equal(new Set(R.map(r=>r.site)).size,R.length,'같은 현장 한 번');
  assert.deepEqual(R.map(r=>[r.site,r.d]),[['[합성] 기한 3일 지남','3일'],['[합성] 응대 중 문의','1일'],['[합성] 첫 연락 전 문의','오늘'],['[합성] 오늘 14시 실측','14:00'],['[합성] 오늘 약속 시각 없음','오늘']],'순서 · 넘긴 날: '+JSON.stringify(R.map(r=>[r.site,r.d])));
  assert.ok(R.filter(r=>r.zone==='late').every(r=>r.dc==='rgb(180, 35, 24)'),'넘긴 날 = 빨강');assert.ok(R.filter(r=>r.zone==='now').every(r=>r.dc==='rgb(21, 23, 28)'),'오늘 처리 = 검정');
  const resp=R.find(r=>/응대 중 문의/.test(r.site));assert.equal(resp.sub,'견적문의POUR솔루션 · 응대 중','첫 응대가 된 문의 = 응대 중(첫 연락 아님)');assert.equal(resp.task,'견적 범위 · 금액 확인','응대 중 문의 = 그 문의의 다음 업무');
  assert.equal(R.find(r=>/첫 연락 전/.test(r.site)).sub,'견적문의POUR솔루션 · 첫 연락');
  assert.equal(R.find(r=>/기한 3일/.test(r.site)).rq,'송보람 요청','요청 꼬리표에 시각을 또 쓰지 않음');
  assert.deepEqual(R[0].go,['rgb(255, 255, 255)','rgb(21, 23, 28)'],'[결과 기록] 흰 바탕 · 검정 글씨');
  assert.match(one(await V.locator('.tv6-lh').innerText()),/넘긴 날 = 확인된 업무 기한을 넘긴 날 수\(같은 날 넘김 = 오늘\)/,'기준은 목록 머리에 한 번');
  /* 다른 탭 */
  await V.locator('.tv6-tabs [data-v="wait"]').click();await page.waitForTimeout(200);R=await rows();assert.equal(R.length,n.wait);assert.ok(R.every(r=>r.zone==='wait'));assert.match(R[0].d,/^\d+\.\d+$/,'회신 대기 = 확인일');
  await V.locator('.tv6-tabs [data-v="fix"]').click();await page.waitForTimeout(200);R=await rows();assert.equal(R.length,n.fix);assert.ok(R.every(r=>r.zone==='fix'));
  await page.locator('#today-v2 .tv6 .tv6-tabs [data-v="act"]').click();await page.waitForTimeout(200);
  /* 클릭 = 상세 창 응대 기록 */
  await page.locator('#today-v2 .tv6-row',{hasText:'첫 연락 전 문의'}).locator('.c2').click();
  assert.deepEqual(await page.evaluate(()=>__open[__open.length-1]),['inq:aaaaaaaa-1111-4111-8111-111111111111','contact']);
  await page.locator('#today-v2 .tv6-row',{hasText:'기한 3일 지남'}).locator('.go').click();
  assert.deepEqual(await page.evaluate(()=>__open[__open.length-1]),['deal:late3','contact']);
  assert.equal(await page.locator('#today-v2 .tv6 .open,#today-v2 .tv6 .fold,#today-v2 .tv6 [data-t3="sms"],#today-v2 .tv6 [data-tel]').count(),0,'펼침 · 전화 · 문자 없음');
  assert.equal(await V.evaluate(v=>[...v.querySelectorAll('.tv6-row span,.tv6-row b')].every(s=>s.scrollWidth<=s.clientWidth+1||getComputedStyle(s).textOverflow==='ellipsis'||getComputedStyle(s.parentElement).textOverflow==='ellipsis')),true,'글 잘림 없음');
  if(process.env.T6_SHOT)await page.locator('#today-v2').screenshot({path:process.env.T6_SHOT});
  await page.evaluate(()=>{G.todayV6Off=true;TodayV2.render();});await page.waitForTimeout(300);
  assert.equal(await page.locator('#today-v2 .tv6').count(),0);assert.ok(await page.locator('#today-v2 .tv3 .dz').count()>=1,'끄기 = 예전 화면');
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',tabs:n,writes:0}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
