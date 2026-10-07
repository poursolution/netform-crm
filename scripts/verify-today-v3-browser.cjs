'use strict';
/* 오늘 업무 v3 검사(2026-10-04 핸드오프 today_v3): 역할별 5화면 — 구조는 같고 묶음만 다르다.
   큰 숫자 = 묶음 합계 = 목록 줄 수(카드 + 줄) · 띠(단계 · 담당자) 숫자도 같은 목록에서 · 첫 묶음 = 카드 한 줄 4장 · 빨강은 첫 묶음에만
   · 90일 넘게 기록 없는 건은 '밀린 건 정리'로 분리(접힘) · 오른쪽 일정 / 마감 / 기준 · 열기는 기존 경로 · 끄면(G.todayV3Off) 관제탑 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'',dump=process.env.T3_DUMP==='1';
const earlyBootFixture="<script>\nloadData=async function(){};AUTH_ON=true;ME={id:'boot-test',name:'테스트 관리자',role:'admin'};\nB={deals:[],inquiries:[{id:'11111111-1111-4111-8111-111111111111',site:'초기 로딩 검증 현장',status:'접수',at:new Date().toISOString(),created_at:new Date().toISOString(),brand:'POUR솔루션',phone:'01000000000',contact_name:'검증 고객',raw:{}}],activities:[],inquiryTrash:[],expansion_pool:[]};\nLOCAL={deals:{},inquiries:{}};G.page='today';G.year='전체';G.quarter=0;G.brand='전체';G.rep='전체';G.q='';G.today3=null;G.tower=null;G.todayAssistOff=true;\nwindow.saveLocal=function(){};window.pushWrite=function(){throw new Error('TEST_NO_WRITES')};\ndocument.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';\ngoPage('today');\ndocument.addEventListener('DOMContentLoaded',()=>{document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';});\n</script>";
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');if(t.endsWith('crm.html')&&new URL(req.url,'http://localhost').searchParams.get('boot')==='early')return res.end(fs.readFileSync(t,'utf8').replace('</body>',earlyBootFixture+'</body>'));fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.TodayV2&&window.TodayV3&&window.TodayTower&&window.TodayWorkQueue&&window.CommonFilterBar);
  /* 회귀: 저장된 로그인/빠른 응답으로 본문이 DOMContentLoaded 전에 그려져도 최신 화면과 필터가 나온다. */
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html?boot=early`);
  await page.waitForSelector('#today-v2 .tv3');
  assert.equal(await page.locator('#pg-today').evaluate(e=>e.classList.contains('today-v2')),true,'첫 진입에서 최신 오늘 업무가 자동 렌더됨');
  assert.equal(await page.locator('#pg-today > .cf-bar').isVisible(),true,'첫 진입에서 공통 필터 표시');
  assert.equal(await page.locator('#unibar').isVisible(),false,'이전 두 줄 필터 숨김');
  assert.equal(await page.locator('#today-home-root').isVisible(),false,'이전 목록 숨김');
  assert.match(await page.locator('#today-v2').innerText(),/초기 로딩 검증 현장/);
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);
  const seed=async(me)=>page.evaluate((me)=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const inq=(i,site,days,extra)=>Object.assign({id:'0000000'+i+'-0000-4000-8000-00000000000'+i,site,status:'배정완료',at:at(days),created_at:at(days),brand:'POUR솔루션',phone:'010-1234-56'+(10+i),contact_name:'고객'+i,assignee:'이필선',assigned_to:'이필선',assigned_at:at(days-0.1),memo:'옥상 방수 견적 문의',raw:{'문의내용':'견적 문의'}},extra||{});
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(0),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01077778888',last_activity_at:at(1)},extra||{});
   B={deals:[
     deal('bid1','[경기 고양] 햇빛마을23단지',{amt:4.2e8,code:'bidding',stage_code:'bidding',brand:'석민이앤씨',next_action:{id:'n1',type:'전화',text:'입찰 서류 확인',due:day(2),status:'open'},stage_contexts:{bidding:{fields:{bid_deadline:day(3)}}}}),
     deal('big1','성산시영아파트',{amt:3.8e8,code:'sent',stage_code:'sent',brand:'POUR공법',assignee:'김성민',last_activity_at:at(20),stage_contexts:{sent:{fields:{sent_date:day(-20)}}},next_action:{id:'n2',type:'전화',text:'견적 검토 확인',due:day(-5),status:'open'}}),
     deal('silent1','서울체육고등학교',{amt:1.1e8,code:'sent',stage_code:'sent',last_activity_at:at(9),stage_contexts:{sent:{fields:{sent_date:day(-9)}}},next_action:{id:'n3',type:'전화',text:'견적 검토 확인',due:day(-2),status:'open'}}),
     deal('con1','고덕아이파크',{amt:2.1e8,code:'contract',stage_code:'contract',assignee:'정정훈',brand:'아파트스퀘어',next_action:{id:'n4',type:'방문',text:'계약 미팅',due:day(1),status:'open'}}),
     deal('sup1','분당시범우성',{amt:4e7,code:'construction',stage_code:'construction',assignee:'정정훈',last_activity_at:at(1),stage_contexts:{contract:{fields:{contract_date:day(-20),contract_amount:3.4e8}}},activities:[{id:'a1',type:'메모',note:'[지원 요청] 추가 균열 보수 승인 요청 — 요청자 정정훈',at:at(1),occurred_at:at(1)}],next_action:{id:'n5',type:'방문',text:'현장 확인',due:day(2),status:'open'}}),
     deal('prom1','풍림1차아파트',{amt:2.4e8,code:'rapport',stage_code:'rapport',next_action:{id:'n6',type:'고객 약속',text:'고객 약속: 장기수선 회의 결과 확인',due:day(-3),status:'open'}}),
     deal('today1','상계주공7단지',{amt:2.6e8,next_action:{id:'n7',type:'방문',text:'현장 실측',due:day(0)+'T11:00',status:'open'}}),
     deal('quote1','동탄푸른마을',{amt:1.8e8,last_activity_at:at(5),stage_entered_at:at(5),stage_contexts:{consulting:{fields:{quote_due:day(-1)}}},next_action:{id:'n8',type:'전화',text:'견적 범위 확인',due:day(2),status:'open'}}),
     deal('stall1','byc하이시티',{amt:9e7,code:'rapport',stage_code:'rapport',last_activity_at:at(21)}),
     /* 팀장 · 상무 · 대표 본인 담당 */
     deal('lead1','이천신한아파트',{amt:4.4e8,code:'contract',stage_code:'contract',assignee:'한준엽',brand:'석민이앤씨',next_action:{id:'n10',type:'전화',text:'계약서 확인',due:day(3),status:'open'}}),
     deal('vp1','평동동남아파트',{amt:1.7e8,code:'rapport',stage_code:'rapport',assignee:'황윤선',brand:'석민이앤씨',next_action:{id:'n11',type:'전화',text:'회의 결과 확인',due:day(-12),status:'open'},last_activity_at:at(12)}),
     deal('ceo1','율량동아아파트',{amt:2.1e8,code:'rapport',stage_code:'rapport',assignee:'이승우',next_action:{id:'n12',type:'전화',text:'관계 연락',due:day(-4),status:'open'},last_activity_at:at(10)}),
     /* 밀린 건: 90일 넘게 기록 없음(마지막 의미 있는 연락 · 없으면 등록일부터 센다) — 오늘 할 일에서 빠진다 */
     deal('old1','오래된 현장 A',{amt:1.5e8,code:'rapport',stage_code:'rapport',last_activity_at:at(120),created:day(-300)}),
     deal('old2','오래된 현장 B',{amt:5e7,code:'rapport',stage_code:'rapport',assignee:'김성민',last_activity_at:at(200),created:day(-400)}),
     deal('old3','오래된 현장 C',{amt:8e7,code:'rapport',stage_code:'rapport',assignee:'이승우',last_activity_at:at(400),created:day(-500)})],
    inquiries:[inq(3,'인천SK스카이뷰',3),inq(7,'길음뉴타운9단지',3,{assignee:'',assigned_to:'',assigned_at:'',status:'미배정'})],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME=me;G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.today3=null;G.tower=null;G.towerRole=null;G.todayQueueOwner='전체';G.todayV3Off=false;G.todayAssistOff=true;/* 여기서는 묶음 3개(카드 + 목록) 구조를 본다 — 영업관리 표는 verify-today-assist */
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   window.__open=[];TodayWorkQueue.open=(k,a)=>{__open.push([k,a||'']);};/* 배정 창이 실제로 그 문의를 찾는지까지 본다(문의 번호 형식) — todayAssignInquiry 는 진짜 것을 그대로 */window.__assign=[];window.__alerts=[];window.alert=m=>{__alerts.push(String(m));};window.inqCtlOpenAssign=(m,k)=>{__assign.push([m,k,!!inqCtlFind(k)]);};
   goPage('today');
  },me);
  const snap=()=>page.evaluate(()=>{const v=document.querySelector('#today-v2 .tv3');if(!v)return null;const tx=n=>n?n.textContent.trim():'';
   return {role:v.dataset.role,total:Number(v.dataset.total),back:Number(v.dataset.back),hero:tx(v.querySelector('.tv3-hero .n')),leg:[...v.querySelectorAll('.tv3-hero .leg span')].map(tx),
    stage:[...v.querySelectorAll('.tv3-strip .ln')[0].querySelectorAll('button')].map(b=>tx(b.querySelector('span'))+' '+tx(b.querySelector('b'))),people:v.querySelectorAll('.tv3-strip .ln').length>1?[...v.querySelectorAll('.tv3-strip .ln')[1].querySelectorAll('button')].map(b=>tx(b.querySelector('span'))+' '+tx(b.querySelector('b'))):null,
    groups:[...v.querySelectorAll('.tv3-group')].map(g=>({t:[...g.querySelectorAll(':scope>header b')].map(tx).join(' '),why:tx(g.querySelector(':scope>header span')),bulk:tx(g.querySelector(':scope>header button')),cards:[...g.querySelectorAll('.tv3-card')].map(c=>tx(c.querySelector('header b'))+' | '+tx(c.querySelector('header em'))+' | '+tx(c.querySelector('.who b'))+' | '+tx(c.querySelector('.who small'))+' | '+[...c.querySelectorAll('.btns button')].map(tx).join('/')),hidden:(()=>{const m=/\/ ([\d,]+)건/.exec(tx(g.querySelector('.lpg-info')));return m?Number(m[1].replace(/,/g,''))-g.querySelectorAll('.tv3-row').length:0;})()/* 다른 쪽에 있는 줄(쪽 번호 · 2026-10-05 전체 지침) */,rows:[...g.querySelectorAll('.tv3-row')].map(r=>tx(r.querySelector('.c b'))+' | '+tx(r.querySelector('.c small'))+' | '+tx(r.querySelector('.d b'))+' '+tx(r.querySelector('.d small'))+' | '+tx(r.querySelector(':scope>button')))})),
    backT:tx(v.querySelector('.tv3-back .hd')),side:[...v.querySelectorAll('.tv3-side section')].map(s=>tx(s.querySelector('header b'))+' :: '+[...s.querySelectorAll('.tv3-ev,.tv3-due,.tv3-wk,.none')].map(tx).join(' ; ')),sub:tx(document.getElementById('psub')),badge:tx(document.getElementById('todayBadge'))};});
  const ROLES=[['rep',{id:'rep1',name:'이필선',role:'rep'}],['mgr',{id:'admin',name:'송보람',role:'admin'}],['lead',{id:'l1',name:'한준엽',role:'admin'}],['vp',{id:'v1',name:'황윤선',role:'admin'}],['ceo',{id:'c1',name:'이승우',role:'admin'}]];
  const S={};
  for(const [k,me] of ROLES){await seed(me);await page.waitForTimeout(700);S[k]=await snap();if(dump&&(k==='vp'||k==='ceo'))console.log('=====',k,'\n'+JSON.stringify(S[k],null,1));if(shot)await page.screenshot({path:shot+'-'+k+'.png',fullPage:true});
   const s=S[k];assert.ok(s,k+': v3 화면');assert.equal(s.role,k);assert.equal(await page.locator('#today-v2 .tt').count(),0,k+': 관제탑 대신 v3');
   /* 공통: 큰 숫자 = 묶음 합계 = 목록 줄 수 = 띠 합계 */
   const lines=s.groups.reduce((n,g)=>n+g.cards.length+g.rows.length+g.hidden,0),gsum=s.groups.reduce((n,g)=>n+Number((/(\d+)건$/.exec(g.t)||[0,0])[1]),0),ssum=s.stage.reduce((n,x)=>n+Number(x.split(' ').pop()),0);
   assert.equal(lines,s.total,k+': 목록 줄 수(카드 + 줄 + 다른 쪽의 줄) = 큰 숫자');assert.equal(gsum,s.total,k+': 묶음 합계 = 큰 숫자');assert.equal(ssum,s.total,k+': 단계 띠 합계 = 큰 숫자');
   assert.match(s.hero,new RegExp('^'+({mgr:'오늘 손댈 것',ceo:'오늘 결정 · 확인할 것'}[k]||'오늘 할 일')+s.total+'건 · '+s.groups.length+'묶음$'),k+': 큰 숫자 하나');
   assert.equal(s.leg[s.leg.length-1],'· 위 '+s.total+'건 = 앞 묶음 합계');assert.match(s.leg[s.leg.length-2],new RegExp('^밀린 건 '+s.back+'$'));
   assert.equal(s.badge,String(s.total||''),k+': 메뉴 숫자도 같은 값');
   assert.deepEqual(s.stage.map(x=>x.replace(/ \d+$/,'')),['견적문의','컨설팅 설계','자료 발송','관계관리','경쟁·입찰','계약·시공','수주·확장']);
   assert.equal(!!s.people,k==='mgr'||k==='lead',k+': 담당자 띠는 영업관리 · 팀장만');if(s.people)assert.equal(s.people.reduce((n,x)=>n+Number(x.split(' ').pop()),0),s.total,k+': 담당자 띠 합계 = 큰 숫자');
   /* 첫 묶음만 카드(한 줄 4장까지) · 빨강은 첫 묶음에만 */
   s.groups.forEach((g,i)=>{if(i===0)assert.ok(g.cards.length>=1&&g.cards.length<=4,k+': 첫 묶음 카드 1~4장');else assert.equal(g.cards.length,0,k+': 둘째 묶음부터는 목록');});
   assert.equal(await page.locator('#today-v2 .tv3-group:not(.first) .r').count(),0,k+': 빨강은 첫 묶음에만');
   assert.equal(await page.locator('#today-v2 .tv3-cards').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),4,k+': 카드 한 줄 4칸(빈칸 유지)');
   /* 밀린 건: 오늘 할 일과 분리 · 접혀 있음 */
   assert.equal([...s.groups.flatMap(g=>g.cards.concat(g.rows))].some(t=>/오래된 현장/.test(t)),false,k+': 90일 넘은 건은 묶음에 없음');
   assert.equal(await page.locator('#today-v2 .tv3-back .bd').count(),0,k+': 밀린 건은 접혀 있음');
  }
  if(dump){process.exit(0);}
  /* ── 역할별 묶음(README 표) ── */
  const titles=k=>S[k].groups.map(g=>g.t.replace(/ \d+건$/,''));
  assert.deepEqual(titles('mgr'),['오늘 안 넘기면 놓침','이번 주 새로 멈춘 건','계약 정보 빠짐']);assert.deepEqual(S.mgr.groups.map(g=>g.bulk),['문구 복사','문구 복사','문구 복사']/* 2026-10-06 집계 ⑦: [문구 복사] = 클립보드만 · [요청 보내기]는 요청 엔진이 있을 때 */);
  assert.equal(S.mgr.groups[0].why,'배정 30분 · 첫 연락 2시간 · 오늘 마감','시간 기준 = 운영 기준 값');
  assert.deepEqual(titles('rep'),['오늘 연락할 곳','이번 주 안에','정보 채우기'].filter((t,i)=>S.rep.groups.some(g=>g.t.startsWith(t))));
  assert.deepEqual(titles('lead'),['본인 영업 · 오늘','팀원 코칭 · 입찰 준비']);assert.equal(S.lead.groups[1].bulk,'문구 복사');
  assert.equal(titles('vp')[0],'오늘 연락할 곳');assert.ok(titles('vp').includes('상무님 결정 요청'));
  assert.equal(titles('ceo')[0],'대표님 결정 요청');assert.ok(titles('ceo').includes('큰 금액인데 멈춘 건'));assert.ok(titles('ceo').includes('본인 영업'));
  /* 영업관리: 배정 · 첫 연락 · 오늘 마감이 카드, 입찰 마감 · 지원 요청은 다루지 않음, 계약 정보 빠짐은 셋째 묶음 */
  const all=k=>S[k].groups.flatMap(g=>g.cards.concat(g.rows)).join('\n');
  assert.match(S.mgr.groups[0].cards.join('\n'),/담당 배정 안 됨[^\n]*\| 견적문의 \| 길음뉴타운9단지 \| 담당 미배정[^\n]*\| 배정\/재배정\/상세 보기/,'담당이 없는 건에는 [담당 화면] 대신 [상세 보기]');
  assert.doesNotMatch(all('mgr'),/마감 전 준비 안 됨|지원 요청/,'영업관리는 개입 범위만');
  assert.match(S.mgr.groups[2].rows.join('\n'),/고덕아이파크 \| 정정훈 · 2\.1억 · 계약정보 입력 안 함( · 판정: [^|]+)? \| -\s+\| 입력 요청/);assert.match(S.mgr.groups[2].rows.join('\n'),/이천신한아파트/);
  assert.match(S.mgr.backT,/^밀린 건 정리 3건이번 주 새로 멈춘 \d+건 · 이전부터 누적 \d+건(\(이관 전 기록 확인 필요 \d+건 포함 · 미응대로 평가하지 않음\))? · 90일 넘게 기록 없음 · 오늘 할 일과 따로 · 담당자에게 확인 순서 안내\(고객 반응 → 추진 상태 → 근거 남기고 정리\) 요청보기 ▼$/,'ops_12 B⑥: 이번 주 새로 멈춘 vs 이전부터 누적');
  /* 영업사원: 내 담당만 · 담당 칸 = 고객명 · 본인 밀린 건만 */
  assert.doesNotMatch(all('rep'),/성산시영|고덕아이파크|분당시범우성|이천신한|평동동남|율량동아/,'남의 현장 없음');
  assert.match(S.rep.groups[0].cards.join('\n'),/\| 담당 김소장 관리소장 · 010-7777-8888 \| [^\n]*\/문자\/결과 기록/);
  assert.match(S.rep.backT,/^내 밀린 건 1건/);assert.equal(S.rep.sub.replace(/^\d+월 \d+일 \(.\) · /,''),'내 영업만');
  /* 팀장: 본인 것이 카드, 팀원 것은 둘째 묶음(입찰 마감 · 지원 요청 · 미배정 포함) */
  assert.match(S.lead.groups[0].cards.join('\n'),/이천신한아파트/);assert.doesNotMatch(S.lead.groups[0].cards.concat(S.lead.groups[0].rows).join('\n'),/햇빛마을|길음뉴타운/);
  assert.match(S.lead.groups[1].rows.join('\n'),/햇빛마을23단지 \| 이필선 · 4\.2억 · 마감 전 준비 안 됨( · 판정: [^|]+)? \| D-3 입찰 마감 \| 독촉/);assert.match(S.lead.groups[1].rows.join('\n'),/분당시범우성[^\n]*지원 요청/);assert.match(S.lead.backT,/^팀 밀린 건 3건/);
  /* 상무: 본인 영업이 카드 · 결정 요청은 둘째 · 본인 밀린 건(없음) */
  assert.match(S.vp.groups[0].cards.join('\n'),/평동동남아파트/);assert.match(S.vp.groups.find(g=>g.t.startsWith('상무님 결정 요청')).rows.join('\n'),/분당시범우성/);assert.equal(S.vp.back,0);assert.equal(S.vp.backT,'');
  /* 대표: 결정 요청이 카드 · 3억 이상 14일 넘게 멈춘 건 · 본인 영업 · 본인 밀린 건 */
  assert.match(S.ceo.groups[0].cards.join('\n'),/분당시범우성/);assert.match(S.ceo.groups.find(g=>g.t.startsWith('큰 금액인데 멈춘 건')).rows.join('\n'),/성산시영아파트 \| 김성민 · 3\.8억/);
  assert.equal(S.ceo.groups.find(g=>g.t.startsWith('큰 금액인데 멈춘 건')).why,'3억 이상 · 14일 넘게 진전 없음');assert.match(S.ceo.groups.find(g=>g.t.startsWith('본인 영업')).rows.join('\n'),/율량동아아파트/);assert.match(S.ceo.backT,/^본인 밀린 건 1건/);
  /* 오른쪽: 일정 · 마감 · 기준(역할별 제목) */
  assert.deepEqual(S.mgr.side.map(x=>x.split(' :: ')[0]),['오늘 팀 일정','이번 주 팀 마감','팀 이번 주 기준']);assert.deepEqual(S.rep.side.map(x=>x.split(' :: ')[0]),['오늘 일정','이번 주 마감','내 이번 주']);
  assert.deepEqual(S.ceo.side.map(x=>x.split(' :: ')[0]),['오늘 일정','이번 주 결정 마감','회사 이번 주']);assert.deepEqual(S.vp.side.map(x=>x.split(' :: ')[0]),['오늘 일정','이번 주 마감','본인 이번 주']);
  assert.match(S.rep.side[0],/11:00현장 방문상계주공7단지/);assert.match(S.lead.side[1],/D-3햇빛마을23단지 입찰 마감/);assert.match(S.ceo.side[2],/이번 달 수주실적[\s\S]*영업 메이드율[\s\S]*계약 예정\(날짜 확인\)/);
  assert.equal(S.mgr.sub.replace(/^\d+월 \d+일 \(.\) · /,''),'영업관리 · 팀 전체');assert.equal(S.ceo.sub.replace(/^\d+월 \d+일 \(.\) · /,''),'대표 · 결정과 큰 흐름만');
  /* ── 동작(영업관리 화면) ── */
  await seed(ROLES[1][1]);await page.waitForTimeout(700);
  const v=page.locator('#today-v2 .tv3'),total=Number(await v.getAttribute('data-total'));
  /* 띠를 누르면 목록이 좁혀지고, 큰 숫자는 그대로. [해제] */
  await v.locator('.tv3-strip .ln').nth(0).locator('button',{hasText:'견적문의'}).click();await page.waitForTimeout(200);
  assert.equal(await v.locator('.tv3-card, .tv3-row').count(),Number((await v.locator('.tv3-strip .ln').nth(0).locator('button[aria-pressed="true"] b').innerText())));assert.equal(Number(await v.getAttribute('data-total')),total);
  assert.equal(await v.locator('.tv3-strip .ft button').innerText(),'견적문의 · 해제');await v.locator('.tv3-strip .ft button').click();await page.waitForTimeout(200);
  await v.locator('.tv3-strip .ln').nth(1).locator('button',{hasText:'정정훈'}).click();await page.waitForTimeout(200);
  assert.equal((await v.locator('.tv3-card .who small, .tv3-row .c small').allInnerTexts()).every(t=>/정정훈/.test(t)),true,'담당자 띠 = 그 사람 것만');await v.locator('.tv3-strip .ft button').click();await page.waitForTimeout(200);
  /* 카드: 펼치기 = 담당에게 보낼 말 · 놓치면 / 완료 기준 / 버튼 3개 */
  const c1=v.locator('.tv3-card').first();assert.equal(await c1.locator('.open').count(),0);await c1.locator('[data-t3="fold"]').click();await page.waitForTimeout(200);
  assert.match(await v.locator('.tv3-card').first().locator('.fold').innerText(),/담당에게 보낼 말 · 놓치면\s*접기 ▴[\s\S]*놓치면 [\s\S]*완료 기준 /);
  /* 배정 = 문의 배정 창, 줄 누르기 = 상세, 독촉 = 결과 남기기 */
  await v.locator('.tv3-card',{hasText:'길음뉴타운9단지'}).locator('.btns .main').click();assert.deepEqual(await page.evaluate(()=>__assign.map(x=>[x[0],x[2]])),[['assign',true]],'배정 = 문의 배정 창 · 그 문의를 찾는다');assert.deepEqual(await page.evaluate(()=>__alerts),[],'선택 안내가 뜨지 않는다');
  /* [담당 화면]: 눌렀을 때 아무 변화가 없으면 안 된다(2026-10-04 대표) — 담당이 없는 건 = [상세 보기](그 건의 상세), 담당이 있는 건 = 그 담당자로 좁히고 알려 준다 · 이미 그 화면이면 그렇다고 알려 준다 */
  {const before=(await page.evaluate(()=>__open)).length;await v.locator('.tv3-card',{hasText:'길음뉴타운9단지'}).locator('.btns button').nth(2).click();await page.waitForTimeout(150);
   assert.deepEqual(await page.evaluate(()=>__open.slice(-1)[0][0]),await page.evaluate(()=>'inq:'+inqKey(B.inquiries.find(q=>/길음뉴타운9단지/.test(q.site)))),'담당 없는 건의 [상세 보기] = 그 문의 상세');assert.equal((await page.evaluate(()=>__open)).length,before+1);await page.evaluate(()=>{__open.length=0;});
   const far=v.locator('.tv3-card .btns [data-t3="owner"]').first();if(await far.count()){const who=await far.getAttribute('data-v');await page.evaluate(()=>{window.__toasts=[];window.toast=m=>__toasts.push(String(m));});
    await far.click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>CommonFilterBar.owner()),who,'담당 화면 = 그 담당자로 좁힘');assert.match(await page.evaluate(()=>__toasts.join('|')),new RegExp(who+' 담당 화면으로 좁혔습니다'),'무엇이 바뀌었는지 알려 준다');
    const again=page.locator('#today-v2 .tv3-card .btns [data-t3="owner"]').first();if(await again.count()){await again.click();await page.waitForTimeout(200);assert.match(await page.evaluate(()=>__toasts.slice(-1)[0]),/^지금 .+ 담당 화면을 보고 있습니다/,'이미 그 화면이면 그렇다고 알려 준다');}
    await page.evaluate(()=>{CommonFilterBar.setOwner('전체');paint();});await page.waitForTimeout(300);}}
  await v.locator('.tv3-group[data-g="3"] .tv3-row').first().click();assert.equal((await page.evaluate(()=>__open)).length,1,'줄 = 상세 열기');
  await v.locator('.tv3-group[data-g="3"] .tv3-row').first().locator('button').click();assert.equal((await page.evaluate(()=>__open)).length,2,'버튼도 기존 경로');
  /* 밀린 건 정리: 펼치면 담당자별 건수 · 최장 일수 · [정리 요청], 목록 → 진행 / 보류 / 실주 / 배드핏 */
  await v.locator('.tv3-back .hd').click();await page.waitForTimeout(200);
  const bl=await v.locator('.tv3-bl').evaluateAll(l=>l.map(n=>[...n.children].filter(c=>!c.classList.contains('bar')).map(c=>c.textContent.trim()).join('|')));
  assert.deepEqual(bl.sort().map(x=>x.replace(/최장 \d+일/,'최장 n일')),['김성민|1건|최장 n일|문구 복사|목록','이승우|1건|최장 n일|문구 복사|목록','이필선|1건|최장 n일|문구 복사|목록']/* 2026-10-06 집계 ⑦: [문구 복사] = 클립보드만 · 요청 엔진이 켜지면 [요청 보내기]가 앞에 */);
  const olds=Object.fromEntries(bl.map(x=>[x.split('|')[0],Number((/최장 (\d+)일/.exec(x)||[0,0])[1])]));assert.ok(olds['이필선']>=299&&olds['이필선']<=300&&olds['김성민']>=399&&olds['김성민']<=400&&olds['이승우']>=499&&olds['이승우']<=500,'최장 일수 = 마지막 기록 뒤 지난 날');
  await v.locator('.tv3-bl',{hasText:'이필선'}).locator('[data-t3="backdo"]').click();await page.waitForTimeout(200);
  assert.match(await v.locator('.tv3-brow').first().innerText(),/오래된 현장 A\s*관계관리 · 1\.5억 · (299|300)일째\s*진행\s*보류\s*실주\s*배드핏/);
  await page.evaluate(()=>{window.__st=[];window.__drw=[];window.drwDeal=j=>{__drw.push(JSON.parse(j).id);};StageTransitionUI.open=(d,m,code)=>{__st.push([d.id,code]);};});
  await v.locator('.tv3-brow').first().locator('[data-v="hold"]').click();await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>[__drw,__st]),[['old1'],[['old1','waiting']]],'보류 = 상세 + 대기 전환 창(사유 입력은 기존 창)');
  assert.equal((await page.evaluate(()=>__writes)).length,0,'화면을 그리는 것만으로는 아무것도 저장하지 않음');
  if(shot)await page.screenshot({path:shot+'-mgr-back.png',fullPage:true});
  /* ── 실행 모드(시안 갱신 · 4차 1): 보기 모드와 같은 목록 · 같은 순서를 한 건씩, 저장은 상세와 같은 함수 ── */
  await seed(ROLES[0][1]);await page.waitForTimeout(700);
  await page.evaluate(()=>{window.__rec=[];window.__memo=[];window.__iq=[];DealDetailV3.record=async(d,o)=>{__rec.push([d.id,o.res,o.memo||'']);return {};};DealDetailV3.memo=async(d,note)=>{__memo.push([d.id,note]);};window.iqApply=(q,target)=>{__iq.push([q.site,target,document.getElementById('iq-res').value,document.getElementById('iq-next').value,document.getElementById('iq-due').value.length]);return true;};});
  const v3=page.locator('#today-v2 .tv3'),viewKeys=await v3.locator('.tv3-card, .tv3-row').evaluateAll(l=>l.map(n=>n.dataset.key));
  assert.match(await v3.locator('.tv3-go').innerText(),/^실행 모드로 처리 →\s*한 건씩 · 저장하면 다음 건$/);
  await v3.locator('.tv3-go').click();await page.waitForTimeout(250);
  const ex=page.locator('#today-v2 .tv3.tv3-ex');assert.equal(await ex.getAttribute('data-exec'),'on');
  assert.match(await ex.locator('.tv3-exbar').innerText(),/^실행 모드\s*오늘 할 일을 급한 순서대로 한 건씩 · 다 끝나면 목록으로 돌아옵니다\s*← 목록으로$/);
  assert.deepEqual(await ex.locator('.tv3-exlist button').evaluateAll(l=>l.map(n=>n.dataset.key)),viewKeys,'왼쪽 순서 = 보기 모드 목록 그대로');assert.deepEqual(await page.evaluate(()=>TodayV3.execQueue()),viewKeys);
  assert.match(await ex.locator('.tv3-exlist .hd').innerText(),/^오늘 순서 · 위 묶음 그대로\s*0 \/ 7$/);
  assert.match(await ex.locator('.tv3-excard').innerText(),/^1 \/ 7\s*석민이앤씨\s*경쟁·입찰\s*오늘 연락할 곳\s*김소장 관리소장 · 4\.2억\s*\[경기 고양\] 햇빛마을23단지\s*마감 전 준비 안 됨 · D-3$/);
  assert.deepEqual(await ex.locator('.tv3-brief .ln>span:first-child').allInnerTexts(),['마지막 연락','고객 요구','미해결','담당 · 연락처','다음 일정'],'통화 전 5줄');
  assert.match(await ex.locator('.tv3-brief .hd').innerText(),/^AI\s*전화 걸기 전 5줄\s*전화$/);assert.match(await ex.locator('.tv3-brief .say').innerText(),/^첫마디\s*안녕하세요, 넷폼 이필선입니다\./);
  assert.equal(await ex.locator('.tv3-brief .ln').nth(4).locator('.hot').innerText(),'D-3 입찰 마감','급한 줄은 빨강');if(shot)await page.screenshot({path:shot+'-exec.png'});
  assert.deepEqual(await ex.locator('.tv3-exrec .chips button').allInnerTexts(),['연결됨','부재','검토중','자료요청','회신대기','실주']);
  assert.match(await ex.locator('.tv3-exrec .nx').innerText(),/^AI\s*다음 행동\s*통화 결과를 고르면 제안$/);assert.equal(await ex.locator('.tv3-exrec .save.on').count(),0);
  assert.equal(await ex.locator('em.ai').count(),2,'AI 표식 = 5줄 제목 · 다음 행동(시안 그대로)');
  assert.match(await ex.locator('.tv3-exside section').first().innerText(),/^이 단계에서 확인할 것\s*경쟁·입찰\s*현설일\s*PT\s*경쟁 공법\s*의사결정자\s*예상 가격대\s*선배 팁\s*D-3 전에 경쟁 공법을 확인한 건의 낙찰률이 2배$/);assert.equal(await ex.locator('.tv3-exside .ck.ok').count(),0,'체크는 그 건의 기록에 값이 있을 때만');
  assert.match(await ex.locator('.tv3-exside section').nth(1).innerText(),/^이 건은 여기서도 같이 바뀝니다/);
  /* 결과 칩 → 다음 행동 → [저장하고 다음 건 →]: 상세와 같은 저장 함수, 다음 미처리 건으로 */
  await ex.locator('.tv3-exrec .save').click();await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>__rec),[],'결과를 고르기 전에는 저장하지 않음');
  await ex.locator('.tv3-exrec .chips button',{hasText:'회신대기'}).click();await page.waitForTimeout(150);
  assert.match(await ex.locator('.tv3-exrec .nx').innerText(),/^AI\s*다음 행동\s*회신 확인 · 3일 후$/);
  await ex.locator('.tv3-exrec .memo').fill('입찰 서류 메일로 보냄');await ex.locator('.tv3-exrec .save').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__rec),[['bid1','회신대기','입찰 서류 메일로 보냄']],'영업건 = 상세의 응대 기록 저장과 같은 함수');
  assert.match(await ex.locator('.tv3-exlist .hd').innerText(),/1 \/ 7$/);assert.equal(await ex.locator('.tv3-exlist button').first().evaluate(n=>n.classList.contains('dn')&&n.querySelector('i').textContent),'✓');
  assert.match(await ex.locator('.tv3-excard').innerText(),/^2 \/ 7[\s\S]*서울체육고등학교/,'저장하면 다음 건');assert.equal(await ex.locator('.tv3-exrec .memo').inputValue(),'');
  /* 왼쪽에서 골라 가기 · 문의는 목록의 줄 안 저장과 같은 함수 */
  await ex.locator('.tv3-exlist button',{hasText:'인천SK스카이뷰'}).click();await page.waitForTimeout(200);assert.match(await ex.locator('.tv3-excard').innerText(),/^6 \/ 7[\s\S]*견적문의[\s\S]*인천SK스카이뷰/);
  await ex.locator('.tv3-exrec .chips button',{hasText:'부재'}).click();await ex.locator('.tv3-exrec .save').click();await page.waitForTimeout(400);
  /* 부재 = 연락 시도(2026-10-05 견적문의 흐름 ①): 단계 진행(최초응대)이 아니라 다음 할 일만 — 저장은 목록 · 상세와 같은 명령(InquiryCommand) */
  assert.deepEqual(await page.evaluate(()=>__iq),[],'부재만으로는 단계 진행(iqApply)을 부르지 않는다');assert.equal(await page.evaluate(()=>__writes.filter(x=>x==='next_action').length),1,'문의 부재 = 다음 할 일 등록 1건');
  assert.equal(await page.evaluate(()=>{const q=B.inquiries.find(x=>/인천SK스카이뷰/.test(x.site||''));return [inqCtlFirstResponseAt(q),InquiryFlow.state(q).attempts].join('|');}),'|1','최초응대는 그대로 비어 있고 시도 1회');
  /* 나머지를 끝내면 완료 화면 → 목록으로 */
  for(let n=0;n<5;n++){await ex.locator('.tv3-exrec .chips button',{hasText:'연결됨'}).click();await ex.locator('.tv3-exrec .save').click();await page.waitForTimeout(300);}
  assert.equal(await ex.getAttribute('data-exec'),'done');assert.match(await ex.locator('.tv3-exdone').innerText(),/^오늘 할 일 끝 · 7 \/ 7\s*같은 기록이 상세 · 대시보드 · 브리핑에 그대로 반영됩니다\s*← 목록으로$/);
  assert.equal((await page.evaluate(()=>__rec)).length,6,'영업건 6건 저장');
  await ex.locator('.tv3-exdone button').click();await page.waitForTimeout(400);assert.equal(await page.locator('#today-v2 .tv3.tv3-ex').count(),0,'목록으로 돌아옴');assert.equal(await page.locator('#today-v2 .tv3 .tv3-hero').count(),1);
  /* 영업관리: 남의 건은 결과 칩이 처리 칩으로, 영업건이면 내부 메모 한 줄(담당의 다음 행동은 건드리지 않음) */
  await seed(ROLES[1][1]);await page.waitForTimeout(700);
  await page.evaluate(()=>{window.__rec=[];window.__memo=[];DealDetailV3.record=async(d,o)=>{__rec.push([d.id,o.res]);return {};};DealDetailV3.memo=async(d,note)=>{__memo.push([d.id,note]);};});
  await page.locator('#today-v2 .tv3 .tv3-go').click();await page.waitForTimeout(250);
  const mx=page.locator('#today-v2 .tv3.tv3-ex');assert.match(await mx.locator('.tv3-brief .hd').innerText(),/^AI\s*처리 전 5줄\s*배정$/);assert.match(await mx.locator('.tv3-brief .say').innerText(),/^보낼 말/);
  assert.deepEqual(await mx.locator('.tv3-exrec .chips button').allInnerTexts(),['처리함','담당에게 보냄','담당 확인함','보류','해당 없음']);
  await mx.locator('.tv3-brief .hd button').click();assert.equal((await page.evaluate(()=>__assign)).length,1,'[배정] = 문의 배정 창');
  await mx.locator('.tv3-exlist button',{hasText:'상계주공7단지'}).click();await page.waitForTimeout(200);
  await mx.locator('.tv3-exrec .chips button',{hasText:'담당에게 보냄'}).click();await page.waitForTimeout(100);assert.match(await mx.locator('.tv3-exrec .nx').innerText(),/담당 처리 확인 · 내일$/);
  await mx.locator('.tv3-exrec .save').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>[__rec,__memo]),[[],[['today1','[영업관리 · 담당에게 보냄] 다음 연락일 도래(오늘)']]],'남의 건 = 내부 메모만');
  await mx.locator('.tv3-exbar button').click();await page.waitForTimeout(400);assert.equal(await page.locator('#today-v2 .tv3.tv3-ex').count(),0);
  /* 좁은 화면 · 끄기 */
  /* 관리자 한마디(2026-10-05 관리팀 KPI v7): 받은 사람의 오늘 업무 맨 위 · 이번 주 · 처리 전인 것만 — 영업관리 화면에는 없다 */
  {const r=await page.evaluate(()=>{const keep=[ME,B.rep_manager_comments,G.todayWordOff],wk=repManagerWeekKey(0),out={};const word=()=>{paint();const n=document.querySelector('#today-v2 .tv3-word');return n?n.innerText.replace(/\s+/g,' ').trim():'';};
    B.rep_manager_comments=[{rep_name:'이필선',week_start:wk,comment:'· [KPI 요청] 실주 사유 입력 — 1건: 사유 없는 실주\n· [KPI 요청] 다음 할 일 등록률 — 2건',status:'open',created_by:'송보람',updated_at:new Date().toISOString()}];
    ME={id:'rep1',name:'이필선',role:'rep'};out.rep=word();out.first=!!document.querySelector('#today-v2 .tv3>.tv3-word:first-child');
    B.rep_manager_comments[0].status='done';out.done=word();B.rep_manager_comments[0].status='open';G.todayWordOff=true;out.off=word();G.todayWordOff=false;
    ME={id:'admin',name:'송보람',role:'admin'};out.mgr=word();ME=keep[0];B.rep_manager_comments=keep[1];G.todayWordOff=keep[2];paint();return out;});
   assert.match(r.rep,/^관리자 한마디 송보람 · \d+\/\d+ \[KPI 요청\] 실주 사유 입력 — 1건: 사유 없는 실주 \[KPI 요청\] 다음 할 일 등록률 — 2건$/,'담당자 화면 맨 위 관리자 한마디: '+r.rep);assert.equal(r.first,true);
   assert.deepEqual([r.done,r.off,r.mgr],['','',''],'처리된 것 · 끄기 · 영업관리 화면에는 없다');await page.waitForTimeout(300);}
  /* 노트북 폭(대표 화면 1207 × 914 · 2026-10-05 "봐봐"): 카드의 첫 버튼(class=main)에 화면 전체용 여백 규칙(body.shell-v2 .main · 941~1500px)이 걸려 버튼이 세로로 커지고, 4열이라 카드가 150px 로 찌그러졌다 → 버튼 3개는 같은 크기 한 줄, 카드 열 수는 목록 칸의 실제 폭으로 */
  await page.setViewportSize({width:1207,height:914});await page.waitForTimeout(300);
  {const m=await page.evaluate(()=>{const c=document.querySelector('#today-v2 .tv3-card'),cs=getComputedStyle,bs=[...c.querySelectorAll('.btns button')].map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),cs(b).paddingTop,cs(b).paddingBottom];});return {shell:document.body.classList.contains('shell-v2'),main:Math.round(document.querySelector('#today-v2 .tv3-main').getBoundingClientRect().width),w:Math.round(c.getBoundingClientRect().width),cols:cs(document.querySelector('#today-v2 .tv3-cards')).gridTemplateColumns.split(' ').length,bs};});
   assert.equal(m.shell,true);assert.ok(m.bs.every(b=>b[1]<=40&&b[2]==='8px'&&b[3]==='8px'&&Math.abs(b[0]-m.bs[0][0])<=2),'노트북 폭: 카드 버튼 3개 같은 크기 한 줄 '+JSON.stringify(m.bs));
   assert.equal(m.cols,2,'노트북 폭(목록 칸 '+m.main+'px): 카드 2열');assert.ok(m.w>=240,'카드 폭 '+m.w+'px');}
  if(shot)await page.screenshot({path:shot+'-laptop.png'});
  await page.setViewportSize({width:1100,height:900});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'옆으로 넘치지 않음');await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.todayV3Off=true;paint();});await page.waitForTimeout(500);
  assert.equal(await page.locator('#today-v2 .tv3').count(),0);assert.equal(await page.locator('#today-v2 .tt').count(),1,'끄면 관제탑');
  /* Live reassignment must survive both candidate selection and the old-record backlog split. */
  await seed(ROLES[1][1]);
  await page.evaluate(()=>{
   const now=Date.now(),at=new Date(now-864e5).toISOString();
   B.deals=[];LOCAL={deals:{},inquiries:{}};G.today3=null;G.todayV3Off=false;
   B.inquiries=Array.from({length:4},(_,n)=>({id:'90000000-0000-4000-8000-00000000000'+n,site:'재배정 검증 '+n,brand:'POUR솔루션',status:n?'응대중':'배정완료',assignee:'조민준',assigned_to:'조민준',assigned_at:at,assignment_history:[],received_at:'2026-03-11T04:15:00Z',at:'2026-03-11T04:15:00Z',responded_at:n?'2026-03-11T04:15:00Z':'',phone:'010-5555-000'+n,raw:{},activities:[{id:'91000000-0000-4000-8000-00000000000'+n,type:'담당자 변경',note:'경남지사 → 조민준',at,actor:'영업관리'}]}));
   OPS_RULES.liveFrom=new Date(now-2*864e5).toISOString().slice(0,10);ContactState._reset();paint();
  });
  await page.waitForTimeout(300);
  const re=await page.evaluate(()=>{
   const X=TodayWorkQueue.data(),M=TodayV3.build(X,X.rows,X.backlog);
   return {candidates:X.inquiry.filter(x=>x.reassignmentPending).length,visible:M.groups.flatMap(g=>g.items).map(i=>i.key),history:B.inquiries.map(q=>q.responded_at)};
  });
  assert.equal(re.candidates,4);assert.equal(new Set(re.visible).size,4,'all four newly reassigned inquiries remain live');
  for(let n=0;n<4;n++)assert.ok((await page.locator('#today-v2').innerText()).includes('재배정 검증 '+n));
  assert.deepEqual(re.history,['','2026-03-11T04:15:00Z','2026-03-11T04:15:00Z','2026-03-11T04:15:00Z']);
  if(shot)await page.screenshot({path:shot+'-reassignment.png',fullPage:true});

  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',five_roles:true,hero_equals_groups_equals_rows:true,strips_same_source:true,first_group_cards4:true,red_only_first:true,backlog_split_over_90:true,role_groups_readme:true,side_panels:true,existing_open_paths:true,no_write_on_render:true,exec_same_list_same_order:true,exec_saves_existing_paths:true,exec_manage_chips:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
