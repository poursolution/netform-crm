'use strict';
/* 오늘 업무 · 영업관리 표 검사(2026-10-04 대표 시안 캡처 '담당 배정 안 된 견적문의' + "계약정보빠짐도 마찬가지로 · 이번 주 새로 멈춘 것도")
   영업관리 화면: ① 오늘 안 넘기면 놓침(기존 카드 묶음 그대로 · 맨 위 — 대표 "기존 카드 상단으로 올려") ② 담당 배정 안 된 견적문의(표 — AI 요약 · AI 추천 담당 · 이유 · [추천대로 배정] [다른 사람] · 한 번에 배정, ①에 든 건을 다시 보여 주는 표라 합계에 두 번 세지 않음) ③ 이번 주 새로 멈춘 건(표) ④ 계약 정보 빠짐(표)
   추천은 규칙(협약문의 → B2B / 같은 현장 기존 담당 / 같은 지역 진행 현장 / 업무량) — 자료에 있는 것만. 배정 저장은 기존 경로(inquiry_assign) · 한 번에 배정은 두 번 눌러야 · 큰 숫자 = 묶음 합계 = 줄 수 유지 · 다른 역할 화면은 그대로 · 끄면 예전 묶음 3개 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.TodayAssist&&window.TodayV3&&window.TodayWorkQueue&&window.TodayTower&&window.CommonFilterBar);
  const seed=me=>page.evaluate((me)=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const inq=(i,site,days,extra)=>Object.assign({id:'0000000'+i+'-0000-4000-8000-00000000000'+i,site,status:'접수',at:at(days),created_at:at(days),brand:'POUR솔루션',phone:'010-1234-56'+(10+i),contact_name:'고객'+i+' 관리소장',assignee:'',assigned_to:'',assigned_at:'',work_type:'옥상방수',raw:{'문의내용':'옥상 누수 재발 · 최상층 2세대 피해','상담채널':'홈페이지','공사유형':'옥상방수'}},extra||{});
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(0),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01077778888',last_activity_at:at(1),next_action:{id:'n-'+id,type:'전화',text:'후속',due:day(5),status:'open'}},extra||{});
   B={deals:[
     deal('g1','[서울 강남] 진행 A',{assignee:'정정훈'}),deal('g2','[서울 강남] 진행 B',{assignee:'정정훈'}),deal('g3','[서울 강남] 진행 C',{assignee:'정정훈'}),
     deal('s1','[서울 서초] 서초래미안아파트',{assignee:'이필선',code:'won',stage_code:'won',outcome:'won',grp:'수주 성공',closed_at:at(300),won_amount:1e8,next_action:null}),
     deal('stall1','[경기 용인] 멈춘 현장',{assignee:'김성민',code:'sent',stage_code:'sent',amt:1.1e8,last_activity_at:at(12),stage_contexts:{sent:{fields:{sent_date:day(-12)}}},next_action:{id:'n3',type:'전화',text:'견적 검토 확인',due:day(-3),status:'open'}}),
     deal('con1','[경기 하남] 고덕아이파크',{amt:2.1e8,code:'contract',stage_code:'contract',assignee:'정정훈',brand:'아파트스퀘어',next_action:{id:'n4',type:'방문',text:'계약 미팅',due:day(4),status:'open'}}),
     deal('today1','[서울 노원] 상계주공7단지',{amt:2.6e8,next_action:{id:'n7',type:'방문',text:'현장 실측',due:day(0)+'T11:00',status:'open'}})],
    inquiries:[inq(1,'[서울 강남] 강변삼부아파트',16),
     inq(2,'[경기 오산] 세진빌',18,{brand:'석민이앤씨',phone:'',contact_name:'',work_type:'외벽',raw:{'문의내용':'외벽 균열 보수 견적 문의','상담채널':'전화','공사유형':'외벽'}}),
     inq(3,'[서울 서초] 서초래미안아파트',24,{raw:{'문의내용':'옥상 방수 · 같은 주소 기존 영업건 있음','상담채널':'전화','공사유형':'옥상방수'}}),
     inq(4,'문의-0482',24,{brand:'POUR공법',work_type:'기술 공법 협약 관련 문의',raw:{'문의내용':'POUR공법 협력사 등록 문의','상담채널':'홈페이지','공사유형':'기술 공법 협약 관련 문의'}}),
     inq(5,'[인천] 첫 연락 늦은 현장',3,{status:'배정완료',assignee:'이필선',assigned_to:'이필선',assigned_at:at(2.9)})],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME=me;G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.today3=null;G.todayAssist=null;G.tower=null;G.towerRole=null;G.todayQueueOwner='전체';G.todayV3Off=false;G.todayAssistOff=false;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   window.__open=[];TodayWorkQueue.open=(k,a)=>{__open.push([k,a||'']);};window.__assign=[];window.inqCtlOpenAssign=(m,k)=>{__assign.push([m,k,!!inqCtlFind(k)]);};window.__toasts=[];window.toast=m=>{__toasts.push(String(m));};window.__clip=[];try{navigator.clipboard.writeText=async t=>{__clip.push(t);};}catch(e){}
   goPage('today');
  },me);
  await seed({id:'admin',name:'송보람',role:'admin'});await page.waitForTimeout(800);
  const v=page.locator('#today-v2 .tv3');assert.equal(await v.getAttribute('data-role'),'mgr');
  /* 1. 묶음 4개: 카드(기존 그대로 · 맨 위) · 표 · 표 · 표 — 번호는 보이는 순서, 큰 숫자 = 묶음 합계 = 줄 수(배정 표는 ①의 건을 다시 보여 주는 것이라 빼고 센다) */
  const G4=await v.locator('.tv3-group').evaluateAll(l=>l.map(g=>[g.querySelector(':scope>header i').textContent,g.querySelector(':scope>header b').textContent,g.dataset.kind||'cards',g.querySelector(':scope>header .n').textContent,g.querySelectorAll('.ta-row:not(.hd),.tv3-card,.tv3-row').length]));
  assert.deepEqual(G4.map(g=>g.slice(0,3)),[['1','오늘 안 넘기면 놓침','cards'],['2','담당 배정 안 된 견적문의','assign'],['3','이번 주 새로 멈춘 건','stall'],['4','계약 정보 빠짐','contract']]);
  {/* 기존 카드 묶음: 맨 위 · 예전 문구 · 카드 4장 · 배정 안 된 건도 카드에 그대로([배정]) */
   const C=v.locator('.tv3-group').first(),n1=Number(G4[0][3].replace('건','')),n2=Number(G4[1][3].replace('건',''));
   assert.equal(await C.evaluate(g=>g.classList.contains('first')&&!g.classList.contains('ta-group')),true,'맨 위 묶음 = 기존 카드 묶음');
   assert.deepEqual(await C.locator(':scope>header').evaluate(n=>[n.querySelector('span').textContent,n.querySelector('button').textContent]),['배정 30분 · 첫 연락 2시간 · 오늘 마감','모두 담당에게 알림']);
   assert.equal(await C.locator('.tv3-card').count(),Math.min(4,n1),'카드 4장');assert.ok(n1>=n2&&n2===3,'배정 안 된 건도 카드 묶음에 그대로('+n1+' ≥ '+n2+')');
   assert.ok((await C.locator('.tv3-card .btns .main, .tv3-row>button').allInnerTexts()).includes('배정'),'카드 묶음의 [배정] 그대로');}
  const total=Number(await v.getAttribute('data-total')),G3=G4.filter(g=>g[2]!=='assign');assert.equal(G3.reduce((s,g)=>s+g[4],0),total,'줄 수 = 큰 숫자');assert.equal(G3.reduce((s,g)=>s+Number(g[3].replace('건','')),0),total,'묶음 합계 = 큰 숫자(배정 표는 두 번 세지 않는다)');
  assert.deepEqual(await v.locator('.tv3-hero .leg span.on').evaluateAll(l=>l.map(n=>n.textContent.replace(/ \d+$/,''))),['오늘 안 넘기면 놓침','이번 주 새로 멈춘 건','계약 정보 빠짐'],'막대 = 세는 묶음 3개');
  assert.match(await v.locator('.tv3-hero .n').innerText(),new RegExp('^오늘 손댈 것\\s*'+total+'건\\s*· 4묶음$'));
  /* 2. ② 담당 배정 안 된 견적문의: 머리 · 칸 · 줄 */
  const A=v.locator('.ta-group[data-kind="assign"]');
  assert.deepEqual(await A.locator(':scope>header').evaluate(n=>[n.querySelector('span').textContent,n.querySelector('.ta-all').textContent]),['AI 추천 담당을 그대로 쓰면 [추천대로 배정] 한 번','추천대로 3건 한 번에 배정']);
  assert.deepEqual(await A.locator('.ta-row.hd span').allInnerTexts(),['브랜드','현장','고객이 원한 것 · AI 요약','AI 추천 담당 · 이유','경과','']);
  const rows=await A.locator('.ta-row:not(.hd)').evaluateAll(l=>l.map(n=>({brand:n.querySelector('.ta-bd').textContent,site:n.querySelector('.ta-st b').textContent,sub:n.querySelector('.ta-st small').textContent,ai:n.querySelector('.ta-sm .ta-ai').textContent,sum:n.querySelector('.ta-sm b').textContent,tags:[...n.querySelectorAll('.ta-tg em')].map(e=>e.textContent+(e.className?':'+e.className:'')),rec:n.querySelector('.ta-rc b').textContent,why:n.querySelector('.ta-rc small').textContent,d:n.querySelector('.ta-d').innerText.replace(/\s+/g,' '),dRed:getComputedStyle(n.querySelector('.ta-d b')).color,btn:[...n.querySelectorAll('.ta-bt button')].map(b=>[b.textContent,b.disabled])})));
  assert.equal(rows.length,3,'협약문의는 오늘 업무 목록에 들어오지 않는다(B2B 탭에서 처리)');const by=Object.fromEntries(rows.map(r=>[r.site,r]));
  const k=by['[서울 강남] 강변삼부아파트'];assert.equal(k.ai,'AI');assert.equal(k.sum,'옥상 누수 재발 · 최상층 2세대 피해');assert.match(k.sub,/^홈페이지 · \d+\.\d+ 접수 · 고객1 관리소장$/);
  assert.deepEqual([k.rec,k.why],['정정훈','강남 진행 현장 3곳'].map((x,i)=>i?k.why:x));assert.match(k.why,/^.*강남.* 진행 현장 3곳/,'같은 지역 진행 현장이 많은 담당');assert.equal(k.rec,'정정훈');
  assert.deepEqual(k.btn,[['추천대로 배정',false],['다른 사람',false]]);assert.equal(k.dRed,'rgb(180, 35, 24)','경과는 빨강');assert.match(k.d,/^\d+일 접수 후$/);
  const o=by['[경기 오산] 세진빌'];assert.ok(o.tags.includes('연락처 없음:r'));assert.match(o.sub,/전화 · \d+\.\d+ 접수 · 연락처 없음/);assert.match(o.why,/연락처 먼저 확인$/,'연락처 없으면 먼저 확인 표시');
  const s=by['[서울 서초] 서초래미안아파트'];assert.equal(s.rec,'이필선');assert.match(s.why,/^같은 현장 기존 담당 \(\d{4} 수주\)$/);assert.ok(s.tags.includes('같은 현장 기존 건:y'));
  /* 협약문의가 목록에 들어오는 경우의 추천 = B2B 담당(규칙 함수로 확인) */
  assert.deepEqual(await page.evaluate(()=>{const r=TodayAssist.recFor(B.inquiries[3]);return [r.label,r.why];}),['조재연 (B2B)','협약 · 제휴 문의 → B2B 자동 추천']);
  assert.equal(await A.locator('.ta-note').innerText(),'추천 기준: 같은 현장 기존 담당 > 같은 지역 진행 현장 > 업무량 · 협약문의는 조재연 자동 추천 · 연락처 없으면 먼저 확인 표시');
  assert.equal(await A.locator('.ta-row:not(.hd) .ta-bt .go').first().evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(21, 23, 28)','추천대로 배정 = 검정 채움');
  assert.equal(await A.locator('.ta-row:not(.hd)').first().evaluate(n=>{const d=n.querySelector('.ta-d').getBoundingClientRect(),b=n.querySelector('.ta-bt').getBoundingClientRect();return d.right<=b.left+1&&getComputedStyle(n.querySelector('.ta-bt')).borderTopWidth==='0px';}),true,'버튼 칸이 경과 칸을 덮지 않는다 · 버튼 묶음에 테두리 없음');
  if(shot)await page.screenshot({path:shot+'-assist.png',fullPage:true});
  /* 3. [추천대로 배정] = 기존 배정 저장 경로로 그 담당에게 · 표에서 빠지고 큰 숫자도 줄어든다 */
  await A.locator('.ta-row',{hasText:'강변삼부아파트'}).locator('[data-ta="assign"]').click();await page.waitForTimeout(500);
  const w=await page.evaluate(()=>__writes.filter(x=>x[0]==='inquiry_assign').map(x=>[x[1].to,x[1].from,x[1].reason]));
  assert.equal(w.length,1);assert.equal(w[0][0],'정정훈');assert.match(w[0][2],/^오늘 업무 · 추천대로 배정 — .*진행 현장 3곳/);
  assert.equal(await page.evaluate(()=>repN(inquiryRoutedOwner(B.inquiries[0]))),'정정훈');assert.match(await page.evaluate(()=>__toasts.slice(-1)[0]),/강변삼부아파트 → 정정훈 배정/);
  assert.equal(await page.locator('#today-v2 .ta-group[data-kind="assign"] .ta-row:not(.hd)').count(),2,'배정한 줄은 표에서 빠진다');
  assert.equal(await page.evaluate(()=>__open.length),0,'버튼을 눌러도 상세는 열리지 않는다');
  /* [다른 사람] = 기존 배정 창(그 문의를 찾는다) · 줄을 누르면 상세 */
  await page.locator('#today-v2 .ta-group[data-kind="assign"] .ta-row',{hasText:'세진빌'}).locator('.ta-bt button').nth(1).click();await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>__assign.map(x=>[x[0],x[2]])),[['assign',true]]);
  await page.locator('#today-v2 .ta-group[data-kind="assign"] .ta-row',{hasText:'세진빌'}).locator('.ta-st b').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__open.length),1,'줄 = 상세');
  /* 4. 한 번에 배정: 두 번 눌러야 저장 · 다른 곳을 누르면 풀림 */
  const all=()=>page.locator('#today-v2 .ta-all');
  assert.equal(await all().innerText(),'추천대로 2건 한 번에 배정','남은 줄 수만큼');
  await all().click();await page.waitForTimeout(250);assert.equal(await all().innerText(),'한 번 더 누르면 2건 배정');assert.equal(await page.evaluate(()=>__writes.filter(x=>x[0]==='inquiry_assign').length),1,'한 번만 눌러서는 저장하지 않는다');
  await page.locator('#today-v2 .tv3-hero .n').click();await page.waitForTimeout(150);assert.equal(await all().innerText(),'추천대로 2건 한 번에 배정','다른 곳을 누르면 확인이 풀린다');
  await all().click();await page.waitForTimeout(200);await all().click();await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>__writes.filter(x=>x[0]==='inquiry_assign').map(x=>x[1].to).slice(1).sort()),['이필선',await page.evaluate(()=>repN(inquiryRoutedOwner(B.inquiries[1])))].sort());
  assert.equal(await page.evaluate(()=>__toasts.slice(-1)[0]),'2건 배정');
  assert.equal(await page.locator('#today-v2 .ta-group[data-kind="assign"]').count(),0,'다 배정하면 표가 사라진다');
  assert.equal(await page.locator('#today-v2 .tv3-group>header i').first().innerText(),'1','남은 묶음 번호는 1부터');
  /* 5. ③ 이번 주 새로 멈춘 건 · ④ 계약 정보 빠짐: 같은 표 틀 */
  const St=page.locator('#today-v2 .ta-group[data-kind="stall"]'),Ct=page.locator('#today-v2 .ta-group[data-kind="contract"]');
  assert.deepEqual(await St.locator('.ta-row.hd span').allInnerTexts(),['브랜드','현장','멈춘 이유 · AI 요약','AI 추천 행동 · 이유','경과','']);
  const sr=await St.locator('.ta-row:not(.hd)').first().evaluate(n=>({site:n.querySelector('.ta-st b').textContent,ai:n.querySelector('.ta-sm .ta-ai').textContent,rec:n.querySelector('.ta-rc b').textContent,dRed:getComputedStyle(n.querySelector('.ta-d b')).color,btn:[...n.querySelectorAll('.ta-bt button')].map(b=>b.textContent)}));
  assert.equal(sr.ai,'AI');assert.match(sr.rec,/^.+ · .+$/,'담당 · 할 일');assert.match(sr.btn[0],/^추천대로 /);assert.notEqual(sr.dRed,'rgb(180, 35, 24)','빨강은 첫 표에만');
  assert.equal(await St.locator(':scope>header button').innerText(),'담당별 코멘트','묶음 버튼은 그대로');
  assert.deepEqual(await Ct.locator('.ta-row.hd span').allInnerTexts(),['브랜드','현장','빠진 정보 · AI 요약','AI 추천 행동 · 이유','경과','']);
  const cr=await Ct.locator('.ta-row:not(.hd)').first().evaluate(n=>({site:n.querySelector('.ta-st b').textContent,tags:[...n.querySelectorAll('.ta-tg em')].map(e=>e.textContent),rec:n.querySelector('.ta-rc b').textContent,btn:[...n.querySelectorAll('.ta-bt button')].map(b=>b.textContent)}));
  assert.equal(cr.site,'[경기 하남] 고덕아이파크');assert.deepEqual(cr.tags,['계약일 없음','계약금액 없음']);assert.match(cr.rec,/^정정훈 · /);assert.deepEqual(cr.btn,['입력 요청','바로 입력']);
  await Ct.locator('[data-ta="askfill"]').first().click();await page.waitForTimeout(200);
  assert.match(await page.evaluate(()=>__clip.slice(-1)[0]),/^정정훈님, 고덕아이파크 계약 정보\(.+\)가 비어 있어 수주실적에 안 잡힙니다\. 오늘 안에 계약일 · 계약금액 입력 부탁드립니다\.$/);assert.match(await page.evaluate(()=>__toasts.slice(-1)[0]),/입력 요청 문구를 복사했습니다/);
  {const n=await page.evaluate(()=>__open.length);await Ct.locator('.ta-bt button',{hasText:'바로 입력'}).first().click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__open.length),n+1,'바로 입력 = 그 건의 상세');}
  if(shot)await page.screenshot({path:shot+'-assist-after.png',fullPage:true});
  /* 6. 다른 역할은 그대로 · 끄면 예전 묶음 3개 */
  await seed({id:'rep1',name:'이필선',role:'rep'});await page.waitForTimeout(700);assert.equal(await page.locator('#today-v2 .ta-group').count(),0,'영업사원 화면은 그대로');
  await seed({id:'admin',name:'송보람',role:'admin'});await page.evaluate(()=>{G.todayAssistOff=true;paint();});await page.waitForTimeout(700);
  assert.equal(await page.locator('#today-v2 .ta-group').count(),0);assert.deepEqual(await page.locator('#today-v2 .tv3-group>header b:first-of-type').allInnerTexts(),['오늘 안 넘기면 놓침','이번 주 새로 멈춘 건','계약 정보 빠짐'],'끄면 예전 묶음 3개');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',existing_cards_on_top:true,four_groups_numbered_in_order:true,total_equals_groups_equals_rows:true,assign_table_as_design:true,rec_rules_from_data:true,assign_through_existing_path:true,other_person_opens_existing_window:true,bulk_needs_two_clicks:true,stall_and_contract_tables:true,other_roles_untouched:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
