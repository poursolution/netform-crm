'use strict';
/* 오늘 업무 · 관제탑 검사(2026-10-03 핸드오프 today_tower): 로그인 역할에 따라 같은 틀에서 카드 · 목록 내용이 바뀐다.
   영업사원 = 내 담당만 · 영업관리 = 팀 전체(마감 · 지원 요청 제외) · 팀장 = 팀 전체 + 마감 · 지원 요청 · 상무/대표 = 지원 요청 + 내 담당, 7칸 '팀 놓침'.
   분류(긴급 · 중요 · 관리)는 README 표대로 실제 필드로 계산한다. 열기 · 저장은 기존 TodayWorkQueue 경로. 끄면(G.todayTowerOff) 이전 화면 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.TodayV2&&window.TodayTower&&window.TodayWorkQueue&&window.CommonFilterBar);
  const seed=async(me)=>page.evaluate((me)=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const inq=(i,site,days,extra)=>Object.assign({id:'0000000'+i+'-0000-4000-8000-00000000000'+i,site,status:'배정완료',at:at(days),created_at:at(days),brand:'POUR솔루션',phone:'010-1234-56'+(10+i),contact_name:'고객'+i,assignee:'이필선',assigned_to:'이필선',assigned_at:at(days-0.1),memo:'옥상 방수 견적 문의',raw:{'문의내용':'견적 문의'}},extra||{});
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(0),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01077778888',last_activity_at:at(1)},extra||{});
   B={deals:[
     /* 긴급: 입찰 D-3(팀장 · 영업사원) · 고액 발송 후 12일 무응답 · 계약정보 누락(팀) · 지원 요청(팀장 이상) */
     deal('bid1','햇빛마을23단지',{amt:4.2e8,code:'bidding',stage_code:'bidding',brand:'석민이앤씨',next_action:{id:'n1',type:'전화',text:'입찰 서류 확인',due:day(2),status:'open'},stage_contexts:{bidding:{fields:{bid_deadline:day(3)}}}}),
     deal('big1','성산시영아파트',{amt:3.8e8,code:'sent',stage_code:'sent',brand:'POUR공법',assignee:'김성민',last_activity_at:at(12),stage_contexts:{sent:{fields:{sent_date:day(-12)}}},next_action:{id:'n2',type:'전화',text:'견적 검토 확인',due:day(-5),status:'open'}}),
     deal('silent1','서울체육고등학교',{amt:1.1e8,code:'sent',stage_code:'sent',last_activity_at:at(9),stage_contexts:{sent:{fields:{sent_date:day(-9)}}},next_action:{id:'n3',type:'전화',text:'견적 검토 확인',due:day(-2),status:'open'}}),
     deal('con1','고덕아이파크',{amt:2.1e8,code:'contract',stage_code:'contract',assignee:'정정훈',brand:'아파트스퀘어',next_action:{id:'n4',type:'방문',text:'계약 미팅',due:day(1),status:'open'}}),
     deal('sup1','분당시범우성',{amt:4e7,code:'construction',stage_code:'construction',assignee:'정정훈',last_activity_at:at(1),stage_contexts:{contract:{fields:{contract_date:day(-20),contract_amount:3.4e8}}},activities:[{id:'a1',type:'메모',note:'[지원 요청] 추가 균열 보수 승인 요청 — 요청자 정정훈',at:at(1),occurred_at:at(1)}],next_action:{id:'n5',type:'방문',text:'현장 확인',due:day(2),status:'open'}}),
     /* 중요: 약속일 지남 · 오늘 약속 · 견적 지연 · 30일 미접촉 */
     deal('prom1','풍림1차아파트',{amt:2.4e8,code:'rapport',stage_code:'rapport',next_action:{id:'n6',type:'고객 약속',text:'고객 약속: 장기수선 회의 결과 확인',due:day(-3),status:'open'}}),
     deal('today1','상계주공7단지',{amt:2.6e8,next_action:{id:'n7',type:'방문',text:'현장 실측',due:day(0)+'T11:00',status:'open'}}),
     deal('quote1','동탄푸른마을',{amt:1.8e8,last_activity_at:at(5),stage_entered_at:at(5),next_action:{id:'n8',type:'전화',text:'견적 범위 확인',due:day(2),status:'open'}}),
     /* 관리: 다음 할 일 없음 · 남의 현장(영업사원에겐 안 보임) */
     deal('stall1','byc하이시티',{amt:9e7,code:'rapport',stage_code:'rapport',last_activity_at:at(21)}),
     deal('other1','남의 현장',{assignee:'이서준',next_action:{id:'n9',text:'x',due:day(-9),status:'open'}})],
    inquiries:[inq(3,'인천SK스카이뷰',3),inq(7,'길음뉴타운9단지',3,{assignee:'',assigned_to:'',assigned_at:'',status:'미배정'})],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME=me;G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.tower=null;G.towerRole=null;G.todayQueueOwner='전체';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};goPage('today');
  },me);
  const sites=sel=>page.locator(sel).evaluateAll(a=>a.map(n=>n.textContent.trim()));
  /* ① 영업사원 */
  await seed({id:'rep1',name:'이필선',role:'rep'});await page.waitForTimeout(600);
  const tt=page.locator('#today-v2 .tt');assert.equal(await tt.count(),1,'관제탑 틀');assert.equal(await tt.getAttribute('data-role'),'rep');
  assert.equal(await page.locator('#today-v2 .trv, #today-v2 .tv-list, #today-v2 .tv-board').count(),0,'예전 화면 없음');
  assert.match(await tt.locator('.tt-head h1').innerText(),/^오늘 일정 1건 · 긴급 \d+건$/);
  assert.equal(await tt.locator('.tt-roles').count(),0,'영업사원에겐 역할 전환 없음');
  const cellsRep=await tt.locator('.tt-cell').evaluateAll(a=>a.map(c=>c.querySelector('.n').textContent+'|'+c.querySelector('.t b').textContent+'|'+c.querySelector('.m').textContent));
  assert.deepEqual(cellsRep.map(x=>x.split('|')[0]),['견적문의','컨설팅 설계','자료 발송완료','관계관리','경쟁·입찰','계약·시공','수주·확장'],'7칸');
  assert.equal(await tt.locator('.tt-reps').count(),0,'영업사원에겐 담당자 줄 없음');
  const repModel=await page.evaluate(()=>{const X=TodayWorkQueue.data();return TodayTower.model(X,X.rows,'rep').mine.map(i=>i.rk+':'+i.urg+':'+i.x.item.site);});
  assert.deepEqual(repModel.sort(),['deadline:now:햇빛마을23단지','first:today:인천SK스카이뷰','promise:today:상계주공7단지','promise:today:풍림1차아파트','quote:today:동탄푸른마을','silent:now:서울체육고등학교','stall:week:byc하이시티'].sort(),'영업사원 분류: 내 담당만 · 미배정 · 남의 현장 · 팀 전용(계약정보 · 지원 요청) 없음 '+JSON.stringify(repModel));
  /* 카드 3장 = 긴급만, 순서: 마감 D-3 → 발송 후 무응답 */
  assert.deepEqual(await sites('#today-v2 .tt-card .who strong'),['햇빛마을23단지','서울체육고등학교']);
  const c0=tt.locator('.tt-card').first();
  assert.match(await c0.innerText(),/마감 전 준비 안 됨 · D-3\s*파이프라인 · 경쟁·입찰\s*석민이앤씨\s*햇빛마을23단지[\s\S]*원한 것[\s\S]*지난 기록[\s\S]*금액\s*4\.2억[\s\S]*첫마디 · 놓치면[\s\S]*완료 기준 제안서 업로드 \+ 제출일 확정\s*제안 준비\s*문자\s*결과 기록/);
  await c0.locator('[data-tt="fold"]').click();await page.waitForTimeout(200);
  assert.match(await tt.locator('.tt-card').first().locator('.open').innerText(),/“안녕하세요, 넷폼 이필선입니다\.[\s\S]*놓치면 제안 없이 마감을 맞습니다/);
  assert.equal(await tt.locator('.tt-card').first().locator('[data-tt="ai"]').count(),0,'AI가 꺼져 있으면 첫마디 버튼 없음');
  /* AI 첫마디(기존 call_opener · 제안만): 켜져 있을 때 버튼 → 서버 함수(가짜) → 문장 교체 */
  await page.route('**/functions/v1/crm-ai',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,suggestion:{id:'s1',status:'proposed',suggestion:{opener:'소장님, 넷폼 이필선입니다. 입찰 서류 한 가지만 확인드리려고요.',goal:'제출 조건 확인',summary:'현설 참석'}}})}));
  await page.evaluate(()=>{window.__flags={ai_enabled:true};SB={rpc:async(name,args)=>name==='crm_ops_settings_v1'?{data:{ok:true,settings:{ai_enabled:true}}}:{data:{ok:true,rows:[],suggestions:[]}}};TOKEN='t';});await page.evaluate(async()=>{await OpsStore.settings(true).catch(()=>{});});await page.evaluate(()=>TodayV2.render());await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>OpsStore.aiOn()),true,'검사용 AI 켜짐');{await page.locator('#today-v2 .tt-card').first().locator('[data-tt="ai"]').click();await page.waitForTimeout(400);assert.match(await page.locator('#today-v2 .tt-card').first().locator('.open p').innerText(),/^“소장님, 넷폼 이필선입니다\. 입찰 서류 한 가지만 확인드리려고요\.”\s*AI$/);}
  await page.unroute('**/functions/v1/crm-ai');
  /* 목록: 중요 · 관리 → 단계 순, 각 단계 안에서 중요 먼저 */
  assert.deepEqual(await sites('#today-v2 .tt-ghead b'),['중요 · 관리','견적문의','컨설팅 설계','관계관리']);
  assert.deepEqual(await sites('#today-v2 .tt-row .site b'),['인천SK스카이뷰','동탄푸른마을','상계주공7단지','풍림1차아파트','byc하이시티']);
  const r0=tt.locator('.tt-row').first();assert.match(await r0.innerText(),/POUR솔루션\s*인천SK스카이뷰[\s\S]*첫 연락 안 함[\s\S]*3일\s*접수 후\s*전화/);
  assert.equal(await r0.locator('.bd').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(31, 157, 85)','브랜드색은 브랜드 이름표에만');
  /* 칩 · 이유 · 브랜드 필터 */
  await tt.locator('.tt-chip[data-tt="urg"][data-v="today"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('#today-v2 .tt-card').count(),0);assert.deepEqual(await sites('#today-v2 .tt-row .site b'),['인천SK스카이뷰','동탄푸른마을','상계주공7단지','풍림1차아파트']);
  await page.locator('#today-v2 .tt-chip[data-tt="urg"][data-v="today"]').click();await page.locator('#today-v2 .tt-chip[data-tt="brand"][data-v="석민이앤씨"]').click();await page.waitForTimeout(200);assert.deepEqual(await sites('#today-v2 .tt-card .who strong'),['햇빛마을23단지']);
  await page.locator('#today-v2 .tt-chip[data-tt="brand"][data-v="석민이앤씨"]').click();await page.locator('#today-v2 .tt-cell[data-v="sent"]').click();await page.waitForTimeout(200);
  assert.match(await page.locator('#today-v2 .tt-filter>b').innerText(),/자료 발송완료에서 놓친 것/);assert.deepEqual(await sites('#today-v2 .tt-card .who strong'),['서울체육고등학교']);
  await page.locator('#today-v2 .tt-stages header button[data-tt="stage"]').click();await page.waitForTimeout(200);
  /* 오른쪽: 오늘 일정(위험 한 줄) · 마감 · 기준 */
  assert.match(await page.locator('#today-v2 .tt-side section').nth(0).innerText(),/오늘 일정[\s\S]*11:00\s*현장 방문\s*상계주공7단지\s*현장 실측\s*다음 연락일 도래\(오늘\)/);
  assert.match(await page.locator('#today-v2 .tt-side section').nth(1).innerText(),/이번 주 다가오는 마감\s*D-3\s*햇빛마을23단지\s*입찰 마감/);
  assert.match(await page.locator('#today-v2 .tt-side section').nth(2).innerText(),/내 이번 주 기준[\s\S]*첫 응답 완료율 \(2시간 안\)[\s\S]*다음 행동 등록률[\s\S]*이번 주 연락/);
  /* 주 행동 → 기존 상세 경로(직접 저장 없음) · 전화는 tel: */
  await page.evaluate(()=>{window.__tel=[];document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href^="tel:"]');if(a){e.preventDefault();__tel.push(a.getAttribute('href'));}},true);});
  await page.locator('#today-v2 .tt-row',{hasText:'풍림1차아파트'}).locator('button[data-tt="act"]').click();await page.waitForTimeout(800);
  assert.deepEqual(await page.evaluate(()=>__tel),['tel:01077778888']);assert.equal(await page.evaluate(()=>CUR_DETAIL&&CUR_DETAIL.item.id),'prom1','전화 = 그 건 상세(연락 기록)');
  assert.deepEqual(await page.evaluate(()=>__writes.filter(x=>x!=='opportunity_touch')),[],'여는 것만으로 저장하지 않는다');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(300);
  if(shot)await page.screenshot({path:shot+'-rep.png',fullPage:true});
  /* ② 영업관리(관리자 계정) */
  await seed({id:'admin',name:'송보람',role:'admin'});await page.waitForTimeout(600);
  assert.equal(await page.locator('#today-v2 .tt').getAttribute('data-role'),'mgr');
  assert.match(await page.locator('#today-v2 .tt-head h1').innerText(),/^매출이 막힌 곳 · 긴급 \d+건$/);
  assert.deepEqual(await page.locator('#today-v2 .tt-roles button').allInnerTexts(),['영업사원','영업관리','팀장','상무','대표'],'관리자는 역할 비교 전환');
  const mgrModel=await page.evaluate(()=>{const X=TodayWorkQueue.data();return TodayTower.model(X,X.rows,'mgr').mine.map(i=>i.rk+':'+i.urg+':'+i.x.item.site).sort();});
  assert.ok(mgrModel.includes('assign:now:길음뉴타운9단지')&&mgrModel.includes('contract:now:고덕아이파크')&&mgrModel.includes('stallbig:now:성산시영아파트'),'영업관리: 미배정 · 계약정보 누락 · 고액 정체 '+JSON.stringify(mgrModel));
  assert.ok(!mgrModel.some(s=>/^deadline|^decide/.test(s)),'영업관리에는 마감 · 지원 요청(팀장 영역) 없음 '+JSON.stringify(mgrModel));
  assert.deepEqual(await sites('#today-v2 .tt-card .who strong'),['길음뉴타운9단지','고덕아이파크','성산시영아파트'],'카드: 배정 → 계약정보 → 고액');
  assert.match(await page.locator('#today-v2 .tt-card').nth(2).innerText(),/담당 김성민[\s\S]*담당에게 보낼 말 · 놓치면[\s\S]*독촉\s*재배정\s*담당 화면/);
  await page.locator('#today-v2 .tt-card').nth(2).locator('[data-tt="fold"]').click();await page.waitForTimeout(200);assert.match(await page.locator('#today-v2 .tt-card').nth(2).locator('.open p').innerText(),/^“성민님, 성산시영아파트 건 — 고액 견적 후속 없음\. 오늘 중 처리하고 결과 남겨 주세요\.”$/);
  const reps=await page.locator('#today-v2 .tt-rep').evaluateAll(a=>a.map(n=>n.querySelector('span b').textContent+':'+n.querySelector(':scope>b').textContent));
  assert.ok(reps[0].startsWith('이필선:'),'담당자 줄: 놓침 많은 순 '+JSON.stringify(reps));
  assert.match(await page.locator('#today-v2 .tt-row',{hasText:'인천SK스카이뷰'}).innerText(),/이필선 · /,'영업관리 목록 줄에는 담당 포함');
  if(shot)await page.screenshot({path:shot+'-mgr.png',fullPage:true});
  /* ③ 팀장 · ④ 상무 · ⑤ 대표 (관리자 미리보기 전환 = 로그인 이름 매핑과 같은 규칙) */
  await page.locator('#today-v2 .tt-roles button',{hasText:'팀장'}).click();await page.waitForTimeout(400);
  const leadModel=await page.evaluate(()=>{const X=TodayWorkQueue.data();return TodayTower.model(X,X.rows,'lead').mine.map(i=>i.rk+':'+i.x.item.site).sort();});
  assert.ok(leadModel.includes('decide:분당시범우성')&&leadModel.includes('deadline:햇빛마을23단지')&&leadModel.includes('assign:길음뉴타운9단지'),'팀장: 지원 요청 · 마감 · 배정 '+JSON.stringify(leadModel));
  assert.deepEqual(await sites('#today-v2 .tt-card .who strong'),['분당시범우성','길음뉴타운9단지','햇빛마을23단지'],'팀장 카드: 결정(지원 요청) 최상단 → 배정 → 마감');
  assert.match(await page.locator('#today-v2 .tt-card').first().innerText(),/지원 요청 1일째[\s\S]*\[지원 요청\] 추가 균열 보수 승인 요청[\s\S]*결정 기록/);
  await page.locator('#today-v2 .tt-roles button',{hasText:'상무'}).click();await page.waitForTimeout(400);
  assert.match(await page.locator('#today-v2 .tt-head h1').innerText(),/^결정 \+ 내 영업/);
  assert.deepEqual(await sites('#today-v2 .tt-card .who strong'),['분당시범우성'],'상무: 결정 요청 + 내 담당(없음)');
  assert.ok((await page.locator('#today-v2 .tt-cell .m').allInnerTexts()).some(t=>/^팀 놓침 \d+$/.test(t)),'상무 칸 숫자 = 팀 놓침');
  await page.locator('#today-v2 .tt-roles button',{hasText:'대표'}).click();await page.waitForTimeout(400);
  assert.match(await page.locator('#today-v2 .tt-head h1').innerText(),/^최고 결정/);assert.deepEqual(await sites('#today-v2 .tt-card .who strong'),['분당시범우성']);
  if(shot)await page.screenshot({path:shot+'-ceo.png',fullPage:true});
  /* 이름 매핑: 황윤선(상무) · 한준엽(팀장) · 이승우(대표)로 로그인하면 전환 없이 그 역할 — 팀 자료가 오는 계정(관리자 권한)만 */
  assert.deepEqual(await page.evaluate(()=>{G.towerRole=null;return [['황윤선',true],['한준엽',true],['이승우',true],['송보람',true],['이필선',false]].map(([n,admin])=>{ME={id:n,name:n,role:admin?'admin':'rep'};return TodayTower.roleOf({admin});});}),['vp','lead','ceo','mgr','rep']);
  assert.equal(await page.evaluate(()=>{ME={id:'황윤선',name:'황윤선',role:'rep'};return TodayTower.roleOf({admin:false});}),'rep','팀 자료가 안 오는 계정은 내 담당 화면');
  /* 좁은 화면 · 끄기 */
  await seed({id:'rep1',name:'이필선',role:'rep'});await page.waitForTimeout(500);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.todayTowerOff=true;paint();});await page.waitForTimeout(400);
  assert.equal(await page.locator('#today-v2 .tt').count(),0);assert.equal(await page.locator('#today-v2 .trv').count(),1,'끄면 이전 영업사원 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',five_roles:true,rep_scope:true,mgr_scope_no_deadline:true,lead_decide_first:true,vp_ceo_team_miss:true,cards_lists_rules:true,filters:true,side_panels:true,open_via_existing_path:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
