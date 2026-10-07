'use strict';
/* 고객 자산 v2 목록 검사(2026-10-04 design_handoff_asset_v2)
   위: 관계 상태 밑줄 탭(재접촉 · 위험 숫자 빨강 · 0은 흐리게) · 담당자별 위험 알약(위험 많은 순 · 누르면 목록 + 위 담당자 칸) · [관계 기준 ▾] · 확인할 단지 n곳 + 정렬 기준 + [필터 · 해제]
   아래: 왼쪽 '단지에 쌓인 금액'(누적 수주 · 지금 진행 중 · 위험한 진행 금액) · '왜 멈춰 있나'(누르면 좁혀짐) / 오른쪽 목록(누적 수주 · 진행 중을 줄마다 크게 · 상태 꼬리표 한 번 · 이유 줄은 금액 · 사유만 · 마지막 연락 28일+ 빨강 · 버튼)
   금액: 누적 수주 = 확정된 수주의 낙찰금액 합(협약시공사 · 기술자문은 낙찰금액) · 진행 중 = 열린 영업건 예상금액 합. 줄 = 같은 단지 상세. 보드 보기 · 끄기 스위치는 이전 목록 */
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
  // Keep date-only fixture ages stable across the UTC/KST date boundary.
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.AssetC&&window.AssetB&&window.AssetV2&&window.StageBoard&&window.CRMRules&&window.DealWin);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const S=(n)=>'aaaaaaaa-0000-4000-8000-00000000000'+n;
   const deal=(id,site,sid,owner,code,extra)=>Object.assign({id,site,site_id:S(sid),assignee:owner,brand:'POUR솔루션',created:day(-200),updated:day(-200),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   B={deals:[
     deal('d1','예현마을현대홈타운아파트',1,'황윤선','consulting',{amt:37e7,created:day(-150),updated:day(-120),brand:'석민이앤씨'}),
     deal('d2','예현마을현대홈타운아파트',1,'황윤선','lost',{outcome:'lost',amt:4e8,closed_at:day(-300),lost_reason:'가격 열세',created:day(-400),updated:day(-300),brand:'석민이앤씨'}),
     deal('d3','예현마을현대홈타운아파트',1,'황윤선','lost',{outcome:'lost',amt:35e7,closed_at:day(-250),created:day(-350),updated:day(-250),brand:'석민이앤씨'}),
     deal('d4','시범현대아파트',2,'이필선','consulting',{amt:2e7,created:day(-20),updated:day(-9),next_action:{id:'n1',text:'견적 확인 전화',due:day(3),status:'open'},activities:[{id:'a1',type:'전화',note:'소장 통화 — 견적 검토 중',at:at(-9)}]}),
     deal('d5','시범현대아파트',2,'이필선','won',{outcome:'won',won_amount:4e6,closed_at:day(-100),completion_date:day(-100),created:day(-160),updated:day(-100)}),
     deal('d6','오산 원동 e편한세상',3,'한준엽','lost',{outcome:'lost',amt:14e7,closed_at:day(-412),created:day(-500),updated:day(-412),brand:'석민이앤씨'}),
     deal('d7','수주 뒤 조용한 단지',4,'김성민','won',{outcome:'won',won_amount:3e7,closed_at:day(-80),completion_date:day(-80),created:day(-200),updated:day(-80),manager_name:'박소장',manager_mobile:'01011112222'}),
     /* 협약시공사 · 기술자문 수주: 누적 수주 = 낙찰금액(예상금액 · 기술자문료가 아니다) */
     deal('d8','수주 뒤 조용한 단지',4,'김성민','won',{outcome:'won',amt:9e8,closed_at:day(-85),created:day(-90),updated:day(-85)})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;G.siteStatus='전체';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   /* 수주 유형 저장소(서버 확인된 자료)에 협약시공사 · 기술자문 수주 1건 */
   DealWin._take({rows:[{deal_id:'d8',win_status:'confirmed',won_type:'partner_tech',award_company:'코지건설',award_amount:5e8,award_date:day(-85),tech_advisory:true,tech_advisory_amount:1e8,performance_owner:'김성민'}],advisory:[]});
   goPage('sites');
  });
  await page.waitForTimeout(900);
  const v=page.locator('#site-master .ac');assert.equal(await v.count(),1);
  assert.equal(await page.locator('#ptitle').innerText(),'고객 자산');assert.equal(await page.locator('#psub').innerText(),'');
  /* 제목 줄: 제목 + 한 줄 설명 + [기술자문 원본 자료 ▾](2026-10-06 표시 위치 결정 — 이 화면에서 사라졌던 기술자문 칸의 진입) + [관계 기준 ▾] — 더보기 메뉴는 없다 */
  assert.equal(await v.locator('.ac-title').innerText().then(s=>s.replace(/\s+/g,' ')),'고객 자산 단지별로 쌓인 금액 · 진행 중 금액 · 관계 상태 기술자문 원본 자료 ▾ 관계 기준 ▾');
  assert.deepEqual(await v.locator('.ac-title').evaluate(n=>[getComputedStyle(n.querySelector('b')).fontSize,getComputedStyle(n.querySelector('span')).color]),['20px','rgb(75, 85, 99)']);
  assert.equal(await v.locator('.av-more,[data-ac-address]').count(),0);assert.equal(await v.locator('.ac-title [data-ac="advisory"]').count(),1);assert.deepEqual(await v.locator('.ac-top>*').evaluateAll(l=>l.map(n=>n.className)),['ac-title','ac-tabs','ac-people','ac-listhd']);
  /* 1. 관계 상태 = 밑줄 탭 · 숫자 색 */
  assert.deepEqual(await v.locator('.ac-tabs [role=tab]').evaluateAll(l=>l.map(n=>[n.querySelector('span').textContent,n.querySelector('b').textContent,n.querySelector('b').className,n.getAttribute('aria-selected')])),[['전체','4','','true'],['활성','1','','false'],['재접촉 필요','0','zero','false'],['관계위험','1','hot','false'],['기존고객','1','','false'],['휴면','1','','false']]);
  assert.deepEqual(await v.locator('.ac-tabs [role=tab]').evaluateAll(l=>[getComputedStyle(l[0]).borderBottomColor,getComputedStyle(l[1]).borderBottomColor,getComputedStyle(l[3].querySelector('b')).color,getComputedStyle(l[2].querySelector('b')).color]),['rgb(21, 23, 28)','rgba(0, 0, 0, 0)','rgb(180, 35, 24)','rgb(201, 205, 213)']);
  /* 2. 담당자별 위험 = 알약(위험 많은 순) */
  assert.deepEqual(await v.locator('.ac-people>button:not(.ac-moreppl)').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.querySelector('span').textContent,(n.querySelector('em')||{}).textContent||'',n.className])),[['황윤선','1곳','위험 1',''],['김성민','1곳','','none'],['이필선','1곳','','none'],['한준엽','1곳','','none']]);
  /* 3. 관계 기준 접기 */
  assert.equal(await v.locator('.ac-rules').count(),0);await v.locator('[data-ac="rule"]').click();
  assert.deepEqual(await v.locator('.ac-rules>div').allInnerTexts(),['진행 중 단지 30일 안에 한 번 연락','수주 고객 2개월에 한 번 관계 연락','실주 단지 사유 확인 후 재제안 시기 등록']);await v.locator('[data-ac="rule"]').click();
  /* 4. 목록 제목 · 열 · 줄: 누적 수주 · 진행 중을 크게, 상태 꼬리표 한 번, 이유 줄은 금액 · 사유만 */
  assert.equal(await v.locator('.ac-listhd').innerText().then(s=>s.replace(/\s+/g,' ')),'확인할 단지 4곳 오래 연락 안 한 순 리스트 보드');
  assert.deepEqual(await v.locator('.ac-head>span').allInnerTexts(),['단지 · 담당 · 관리소장','누적 수주','진행 중','지금 상태','마지막 연락','']);
  const rows=()=>v.locator('.ac-row').evaluateAll(l=>l.map(n=>({site:n.querySelector('.ac-site>b').textContent,sub:n.querySelector('.ac-site>span').textContent,acc:[...n.querySelectorAll('.ac-amt')[0].children].map(c=>c.textContent),prog:[...n.querySelectorAll('.ac-amt')[1].children].map(c=>c.textContent),tag:n.querySelector('.ac-state>span').textContent,why:n.querySelector('.ac-state>small').textContent,days:n.querySelector('.ac-days').textContent,late:n.querySelector('.ac-days').classList.contains('late'),act:n.querySelector('.ac-act').textContent})));
  const R=await rows();
  assert.deepEqual(R.map(r=>r.site),['오산 원동 e편한세상','예현마을현대홈타운아파트','수주 뒤 조용한 단지','시범현대아파트'],'오래 연락 안 한 순');
  const by=Object.fromEntries(R.map(r=>[r.site,r]));
  assert.deepEqual(by['예현마을현대홈타운아파트'],{site:'예현마을현대홈타운아파트',sub:'석민이앤씨 · 황윤선 · 관리소장 미확인',acc:['0원','수주 없음'],prog:['3.7억','1건 진행'],tag:'관계위험',why:'진행 3.7억 · 실주 2건 · 120일 연락 없음',days:'120일',late:true,act:'연락'});
  assert.deepEqual(by['수주 뒤 조용한 단지'],{site:'수주 뒤 조용한 단지',sub:'POUR솔루션 · 김성민 · 박소장 관리소장',acc:['5.3억','2건'],prog:['0원','진행 없음'],tag:'기존고객',why:'수주 고객 · 2개월 관계 연락 시기',days:'80일',late:true,act:'안부 연락'},'협약시공사 수주 = 낙찰금액 5억(예상 9억 · 기술자문료 1억 아님) + 직접 수주 3,000만');
  assert.deepEqual([by['시범현대아파트'].acc,by['시범현대아파트'].prog,by['시범현대아파트'].tag,by['시범현대아파트'].days,by['시범현대아파트'].late,by['시범현대아파트'].act],[['400만','1건'],['2,000만','1건 진행'],'활성','9일',false,'열기']);
  assert.match(by['시범현대아파트'].why,/^수주 1건 · .*중$/);assert.doesNotMatch(R.map(r=>r.why).join(' '),/관계위험|재접촉 필요|기존고객|활성|휴면/,'이유 줄에 꼬리표와 같은 말을 쓰지 않는다');
  assert.deepEqual([by['오산 원동 e편한세상'].tag,by['오산 원동 e편한세상'].acc,by['오산 원동 e편한세상'].prog,by['오산 원동 e편한세상'].act],['휴면',['0원','수주 없음'],['0원','진행 없음'],'열기']);
  const r0=v.locator('.ac-row',{has:page.locator('.ac-site>b',{hasText:'예현마을'})});
  assert.deepEqual(await r0.evaluate(n=>[getComputedStyle(n).borderLeftColor,getComputedStyle(n).gridTemplateColumns.split(' ').slice(1,3).join(' '),getComputedStyle(n.querySelectorAll('.ac-amt b')[0]).color,getComputedStyle(n.querySelectorAll('.ac-amt b')[1]).color,getComputedStyle(n.querySelectorAll('.ac-amt b')[1]).fontSize,getComputedStyle(n.querySelector('.ac-state>span')).color,getComputedStyle(n.querySelector('.ac-state>span')).backgroundColor,getComputedStyle(n.querySelector('.ac-days')).color]),['rgb(232, 89, 12)','110px 110px','rgb(201, 205, 213)','rgb(29, 63, 153)','14px','rgb(180, 35, 24)','rgb(253, 236, 236)','rgb(180, 35, 24)']);
  assert.equal(await v.locator('.ac-foot').innerText(),'누적 수주 = 이 단지에서 지금까지 수주한 낙찰금액 합 · 진행 중 = 열려 있는 영업건 예상금액 합');
  /* 5. 왼쪽: 단지에 쌓인 금액 · 왜 멈춰 있나 */
  assert.deepEqual(await v.locator('.ac-num').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent))),[['누적 수주 (전 단지)','5.3억','수주한 단지 2곳 · 평균 2.7억'],['지금 진행 중','3.9억','현재 영업기회 2건 · 3.9억 / 과거 미정리 · 이관 0건 · 0원 · 단지 2곳'],['위험한 진행 금액','3.7억','관계위험 · 재접촉 필요 단지에 걸린 금액']]);
  assert.deepEqual(await v.locator('.ac-num b').evaluateAll(l=>l.map(n=>getComputedStyle(n).color)),['rgb(21, 23, 28)','rgb(29, 63, 153)','rgb(180, 35, 24)']);
  const why=await v.locator('.ac-why button').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.querySelector('b.n').textContent,n.querySelector('span').textContent]));
  assert.deepEqual(why.slice(0,2),[['관계위험 · 진행 금액 걸림','1','3.7억 걸림'],['실주 2회 · 수주 없음','1','재제안 시기 미등록']]);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 6. 탭 · 알약 · 사유 = 목록 필터, [필터 · 해제] */
  await v.locator('.ac-tabs [role=tab]',{hasText:'관계위험'}).click();await page.waitForTimeout(200);
  assert.equal(await v.locator('.ac-listhd').innerText().then(s=>s.replace(/\s+/g,' ')),'확인할 단지 1곳 진행 금액이 걸린 곳 먼저 관계위험 · 해제 리스트 보드');assert.deepEqual((await rows()).map(r=>r.site),['예현마을현대홈타운아파트']);
  await v.locator('[data-ac="clear"]').click();await page.waitForTimeout(200);assert.equal((await rows()).length,4);
  await v.locator('.ac-people>button',{hasText:'김성민'}).click();await page.waitForTimeout(250);
  assert.deepEqual((await rows()).map(r=>r.site),['수주 뒤 조용한 단지']);assert.equal(await page.evaluate(()=>SalesScope.state().owner),'김성민','위 담당자 칸과 같이 바뀐다');
  assert.equal(await v.locator('.ac-people>button[aria-pressed="true"]').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(21, 23, 28)');
  assert.match(await v.locator('[data-ac="clear"]').innerText(),/^김성민 · 해제$/);await v.locator('[data-ac="clear"]').click();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>SalesScope.state().owner||'전체'),'전체');
  await v.locator('.ac-why button',{hasText:'실주 2회'}).click();await page.waitForTimeout(200);
  assert.deepEqual((await rows()).map(r=>r.site),['예현마을현대홈타운아파트']);assert.match(await v.locator('[data-ac="clear"]').innerText(),/^실주 2회 · 수주 없음 · 해제$/);
  await v.locator('[data-ac="clear"]').click();await page.waitForTimeout(200);
  /* 7. 줄 · 버튼 = 같은 단지 상세 */
  await r0.locator('.ac-act').click();await page.waitForTimeout(500);
  assert.equal(await page.locator('#avTitle').innerText(),'예현마을현대홈타운아파트');await page.evaluate(()=>{const b=document.querySelector('[data-ad="close"]');if(b)b.click();});await page.waitForTimeout(200);
  /* 8. 보드 보기 · 끄기 = 이전 목록(B안) */
  await v.locator('[data-ac="board"]').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#site-master .ac').count(),0);assert.equal(await page.locator('#site-master .ps3-board').count(),1);
  await page.locator('#site-master [data-sb="view"][data-v="list"]').click();await page.waitForTimeout(300);assert.equal(await page.locator('#site-master .ac').count(),1,'리스트로 돌아오면 v2 목록');
  await page.evaluate(()=>{G.assetCOff=true;paintSites();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#site-master .ac').count(),0);assert.equal(await page.locator('#site-master .sb').count(),1);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',tabs_underline_counts:true,owner_pills_by_risk:true,rules_fold:true,rows_money_big_tag_once:true,amounts_by_rules:true,side_money_and_why:true,filters_sync_owner:true,open_same_detail:true,board_and_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
