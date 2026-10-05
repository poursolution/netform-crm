'use strict';
/* 목록 쪽 번호 검사(2026-10-05 대표 전체 지침 — "아래로 보기 말고, 최대 20건 냅두고 1,2,3,4,5")
   관계관리(대표 캡처의 '나머지 37건 더 보기' 화면) · 견적문의 목록 · 오늘 업무 묶음에서: 한 쪽 최대 20건 · 목록 아래 쪽 번호 · 누르면 그 쪽만 · 탭/칩을 바꾸면 1쪽 · '더 보기' 버튼 없음. */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ListPager&&window.PipelineStageB&&window.PipelineRelB&&window.PipelineWorkspace&&window.InquiryListV3&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()-n*864e5).toISOString(),Y=new Date().getFullYear();
   const pad=n=>String(n).padStart(2,'0');
   /* 관계관리 97곳(운영과 같은 수): 전부 견적 발송일 없음 · 브랜드 76 / 20 / 1 */
   const deals=Array.from({length:97},(_,i)=>({id:'r'+pad(i+1),site:'관계 현장 '+pad(i+1),assignee:['이필선','황윤선','김성민'][i%3],brand:i<76?'석민이앤씨':i<96?'POUR솔루션':'아파트스퀘어',created:day(-400),stage_entered_at:at(34),code:'rapport',stage_code:'rapport',grp:'영업·관리',amt:(200-i)*1e6}));
   /* 견적문의 45건 */
   const inq=i=>({id:'0000'+pad(i)+'00-0000-4000-8000-0000000000'+pad(i),site:'문의 현장 '+pad(i),status:'배정완료',at:at(i),created_at:at(i),received_at:at(i),brand:'POUR솔루션',assignee:'이필선',assigned_to:'이필선',assigned_at:at(i),phone:'010-1234-56'+pad(i),contact_name:'고객'+i});
   B={deals,inquiries:Array.from({length:45},(_,i)=>inq(i+1)),activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.psb=null;G.prb=null;G.inqV3=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:()=>true,noteMissing(){}});
   PipelineWorkspace.open('relationship');
  });
  await page.waitForTimeout(400);
  const one=s=>String(s).replace(/\s+/g,' ').trim();
  const pagerOf=sel=>page.locator(sel+' .lpg').first(),nums=sel=>pagerOf(sel).locator('.lpg-b').allInnerTexts();

  /* 1. 관계관리: 97곳 → 한 쪽 20곳 + 1 2 3 4 5 */
  const R='#pipeline-stage-b[data-stage="relationship"]',rows=page.locator(R+' .prb-table [role="row"]:not(.prb-thead)');
  const total=await page.evaluate(()=>{const S=G.prb;return S&&S.sub;});assert.ok(total,'관계관리 화면');
  const count=async()=>page.locator(R+' .prb-table .prb-row').count();
  const n1=await count();assert.ok(n1>0&&n1<=20,'한 쪽 최대 20곳: '+n1);
  const info=await pagerOf(R).locator('.lpg-info').innerText(),m=/^1–(\d+) \/ (\d+)곳$/.exec(info);assert.ok(m,'쪽 정보 '+info);
  const all=Number(m[2]),pages=Math.ceil(all/20);assert.equal(Number(m[1]),Math.min(20,all));assert.equal(n1,Math.min(20,all));assert.ok(all>20,'여러 쪽이 되는 자료: '+all);
  assert.deepEqual(await nums(R),['‹'].concat(Array.from({length:pages},(_,i)=>String(i+1)),['›']),'쪽 번호 1 2 3 …');
  assert.equal(await pagerOf(R).locator('.lpg-b.on').innerText(),'1');assert.equal(await pagerOf(R).locator('.lpg-b').first().isDisabled(),true,'1쪽에서는 이전 없음');
  assert.equal(await page.locator(R+' .prb-more, '+R+' .psb-more').count(),0);assert.doesNotMatch(await page.locator(R).innerText(),/더 ?보기/,"'나머지 n건 더 보기' 없음");
  assert.deepEqual(await pagerOf(R).evaluate(n=>{const s=getComputedStyle(n),b=getComputedStyle(n.querySelector('.lpg-b.on')),c=getComputedStyle(n.querySelector('.lpg-b:not(.on):not(:disabled)'));return [s.display,s.justifyContent,b.backgroundColor,b.color,b.height,c.backgroundColor,c.borderTopLeftRadius];}),['flex','center','rgb(21, 23, 28)','rgb(255, 255, 255)','30px','rgb(255, 255, 255)','8px']);
  const first1=await page.locator(R+' .prb-table .prb-row').first().innerText();
  if(shot){await pagerOf(R).scrollIntoViewIfNeeded();await page.waitForTimeout(150);await page.screenshot({path:shot.replace(/\.png$/,'-1-rel.png')});}
  await pagerOf(R).locator('.lpg-b',{hasText:/^2$/}).click();await page.waitForTimeout(250);
  assert.equal(await pagerOf(R).locator('.lpg-b.on').innerText(),'2');assert.match(await pagerOf(R).locator('.lpg-info').innerText(),new RegExp('^21–'+Math.min(40,all)+' / '+all+'곳$'));
  assert.equal(await count(),Math.min(20,all-20),'2쪽에는 2쪽 줄만 — 아래로 늘어나지 않는다');assert.notEqual(await page.locator(R+' .prb-table .prb-row').first().innerText(),first1);
  await pagerOf(R).locator('.lpg-b').last().click();await page.waitForTimeout(200);assert.equal(await pagerOf(R).locator('.lpg-b.on').innerText(),'3','› = 다음 쪽');
  await pagerOf(R).locator('.lpg-b',{hasText:new RegExp('^'+pages+'$')}).click();await page.waitForTimeout(200);
  assert.equal(await count(),all-(pages-1)*20,'마지막 쪽은 남은 줄만');assert.equal(await pagerOf(R).locator('.lpg-b').last().isDisabled(),true,'마지막 쪽에서는 다음 없음');
  /* 공통 필터(브랜드)를 바꾸면 1쪽으로, 20곳 이하면 쪽 번호가 사라진다 */
  const chip=async b=>{await page.locator('.cf-bar [data-sf-brand="'+b+'"]:visible').first().click();await page.waitForTimeout(250);};
  await chip('POUR솔루션');
  assert.equal(await count(),20,'POUR솔루션 20곳');assert.equal(await page.locator(R+' .lpg').count(),0,'20곳 이하면 쪽 번호 없음');
  await chip('전체');await pagerOf(R).locator('.lpg-b',{hasText:/^3$/}).click();await page.waitForTimeout(200);await chip('석민이앤씨');
  assert.match(await pagerOf(R).locator('.lpg-info').innerText(),/^1–20 \/ 76곳$/,'브랜드를 바꾸면 1쪽부터');assert.deepEqual(await nums(R),['‹','1','2','3','4','›']);
  /* 보드: 칸마다 20장까지 + 칸 아래 작은 쪽 번호 */
  await chip('전체');
  /* 보드 칸은 견적 발송일이 있는 현장만 나뉜다 — 30곳에 발송일(10일 전)을 넣어 한 칸을 20장 넘게 만든다 */
  await page.evaluate(()=>{const k=new Date(Date.now()-10*864e5).toLocaleDateString('en-CA');B.deals.slice(0,30).forEach(d=>{d.stage_contexts={sent:{fields:{sent_date:k}}};});paint();});await page.waitForTimeout(250);
  await page.locator(R+' .psb-views button',{hasText:'보드'}).click();await page.waitForTimeout(250);
  const cols=await page.locator(R+' .psb-col').evaluateAll(l=>l.map(c=>[Number(c.querySelector('.ch span').textContent),c.querySelectorAll('.prb-card,.psb-card,article,[data-prb="open"]').length,!!c.querySelector('.lpg.sm')]));
  for(const c of cols){assert.ok(c[1]<=20,'보드 칸도 20장까지 '+JSON.stringify(c));assert.equal(c[2],c[0]>20,'20장 넘는 칸에만 쪽 번호 '+JSON.stringify(c));}
  assert.ok(cols.some(c=>c[0]>20&&c[1]===20),'20장 넘는 칸이 있다 '+JSON.stringify(cols));
  const bc=page.locator(R+' .psb-col',{has:page.locator('.lpg.sm')}).first();await bc.locator('.lpg-b',{hasText:/^2$/}).click();await page.waitForTimeout(250);
  assert.equal(await page.locator(R+' .psb-col',{has:page.locator('.lpg.sm')}).first().locator('.lpg-b.on').innerText(),'2','보드 칸 안에서 쪽 넘김');
  await page.locator(R+' .psb-views button',{hasText:'리스트'}).click();await page.waitForTimeout(200);

  /* 2. 견적문의 목록: 45건 → 20 · 20 · 5 */
  await page.evaluate(()=>goPage('inq'));await page.waitForTimeout(500);
  const I='#inq-v3',irows=page.locator(I+' .il-table .il-row');
  assert.equal(await irows.count(),20);assert.match(await pagerOf(I).locator('.lpg-info').innerText(),/^1–20 \/ 45건$/);assert.deepEqual(await nums(I),['‹','1','2','3','›']);
  assert.equal(await page.locator(I+' .il-more').count(),0);
  await pagerOf(I).locator('.lpg-b',{hasText:/^3$/}).click();await page.waitForTimeout(250);
  assert.equal(await irows.count(),5);assert.match(await pagerOf(I).locator('.lpg-info').innerText(),/^41–45 \/ 45건$/);
  await page.locator(I+' [data-il="sort"]').last().click();await page.waitForTimeout(250);
  assert.match(await pagerOf(I).locator('.lpg-info').innerText(),/^1–20 \/ 45건$/,'정렬을 바꾸면 1쪽으로');
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-2-inq.png')});

  /* 3. 오늘 업무: 묶음마다 쪽 번호(접기 · 더 보기 없음) */
  await page.evaluate(()=>goPage('today'));await page.waitForTimeout(600);
  const T=page.locator('#today-v2');assert.doesNotMatch(await T.innerText(),/더 ?보기|접기 ▴/);
  const tp=T.locator('.lpg.sm');
  if(await tp.count()){const g=tp.first(),before=await g.locator('.lpg-b.on').innerText();assert.equal(before,'1');await g.locator('.lpg-b',{hasText:/^2$/}).click();await page.waitForTimeout(250);assert.equal(await T.locator('.lpg.sm').first().locator('.lpg-b.on').innerText(),'2');}

  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('list pager ok · 관계관리 '+all+'곳 '+pages+'쪽');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
