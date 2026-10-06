'use strict';
/* 영업사원 관리 B안 검사(2026-10-03 "영업사원 관리도 비슷하게"): 왼쪽 팀 진단(막대 3칸 · 숫자 3 · 사유 · 할 일 · 몰린 사람 · 이번 주 진전) / 오른쪽 확인할 사람 · 정렬은 빨강 사유 순 · 열기는 기존 사람별 창 · 끄면 v2 묶음 표 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.RepsB&&window.StageBoard&&window.RepsV2&&typeof paintRepManagement==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-90),updated:day(-60),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,owner,days)=>({id:'0000000'+n+'-0000-4000-8000-00000000000'+n,site:'신규 문의 '+n,status:'배정완료',at:at(-days),created_at:at(-days),brand:'POUR솔루션',assignee:owner,assigned_to:owner,assigned_at:at(-days)});
   B={deals:[
     deal('d1','기한 지난 큰 현장','이필선','consulting',{amt:9e8,next_action:{id:'n1',text:'견적 확인',due:day(-12),status:'open'}}),
     deal('d2','할 일 없는 현장','이필선','sent',{amt:3e8}),
     deal('d3','정상 현장','황윤선','compete',{amt:5e8,created:day(-10),updated:day(-1),next_action:{id:'n3',text:'PT 준비',due:day(3),status:'open'},activities:[{id:'a3',type:'전화',note:'통화',at:at(-1)}]})],
    inquiries:[inq(1,'이필선',2),inq(2,'이필선',3),inq(3,'이필선',4)],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;G.repWindowOff=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p.rep_name,p.comment]);return 'req';};
   const mem={};Phase1.storage.getItem=k=>k in mem?mem[k]:null;Phase1.storage.setItem=(k,v)=>{mem[k]=String(v);};
   window.__open=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};window.__account=0;window.AccountAdmin={open:()=>{window.__account++;}};
   goPage('repmanage');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#reps-b');assert.equal(await v.count(),1,'B안 보드');assert.equal(await page.locator('#reps-v2').count(),0,'v2 묶음 표 없음');
  assert.equal(await page.evaluate(()=>document.getElementById('ptitle').textContent),'영업사원 관리');
  const n=await page.evaluate(()=>REP_MANAGER_ROWS.length);assert.ok(n>=3,'본사 영업사원 '+n+'명');
  assert.equal(await v.locator('.psb-row').count(),n,'한 줄 = 한 사람');
  assert.match(await v.locator('.rb-top').innerText(),new RegExp('영업사원\\s*'+n+'명 · .+ 기준'));
  const legs=await v.locator('.ps3-tabs .ps3-tab').evaluateAll(l=>l.map(b=>b.querySelector('.l').textContent+' '+b.querySelector('.n').textContent));
  assert.match(legs.join('|'),/^전체 \d+\|관리자 확인 필요 \d+\|확인 필요 \d+\|여유 · 흐름 정상 \d+$/,legs.join('|'));
  assert.match(await v.locator('.ps3-kpis').innerText(),/기준 넘김\s*\d+명[\s\S]*첫 연락 전 · 기한 초과\s*3건 · 1건[\s\S]*이번 주 진전/);
  const reasons=await v.locator('.ps3-reason>span>b:first-child').allInnerTexts();
  assert.deepEqual(reasons.slice(0,2),['첫 연락 전 3건 이상','다음 할 일 기한 초과'],JSON.stringify(reasons));
  assert.ok(reasons.includes('이번 주 코칭 약속 없음'),JSON.stringify(reasons));
  assert.match(await v.locator('.ps3-diag>.ps3-box').nth(2).innerText(),/그래서 뭘 해야 하나[\s\S]*첫 연락 전 3건 이상 1명[\s\S]*금요일까지 첫 연락 완료/);
  assert.match(await v.locator('.rb-load').innerText(),/누가 일이 몰렸나[\s\S]*이필선 · 12억[\s\S]*진행 2건[\s\S]*황윤선 · 5억/);
  assert.match(await v.locator('.rb-week').innerText(),/이번 주 진전[\s\S]*신규 기회 \d+/);
  /* 정렬: 이필선(빨강 2개) 먼저 */
  const first=v.locator('.psb-row').first();assert.equal(await first.getAttribute('data-key'),'이필선','문제 많은 사람부터');
  assert.match(await first.innerText(),/이필선[\s\S]*본사 영업 · 업무량 [^·]+ · Pipeline 12억[\s\S]*관리자 확인 필요[\s\S]*기한초과 1 · 정체 2 · 할 일 없음 1 · 첫 연락 전 3건 · 진행 2건[\s\S]*첫 연락 전 3건 이상[\s\S]*조치 \d+건[\s\S]*코칭 약속/);
  assert.match(await v.locator('.psb-row[data-key="황윤선"]').innerText(),/황윤선[\s\S]*Pipeline 5억[\s\S]*(여유|확인 필요)/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 막대 칸 · 보드 · 더보기(팀 비교 · 계정 관리) */
  await v.locator('.ps3-tabs .ps3-tab').nth(1).click();await page.waitForTimeout(150);assert.equal(await page.locator('#reps-b .psb-row').count(),1);
  await page.locator('#reps-b [data-sb="clear"]').click();await page.waitForTimeout(150);
  await page.locator('#reps-b [data-sb="view"][data-v="board"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#reps-b .ps3-col').count(),3);assert.equal(await page.locator('#reps-b .ps3-card').count(),n);
  await page.locator('#reps-b [data-sb="view"][data-v="list"]').click();await page.waitForTimeout(150);
  await page.locator('#reps-b .av-more summary').click();assert.deepEqual(await page.locator('#reps-b .av-menu button').allInnerTexts(),['팀 비교','계정 관리']);
  await page.locator('#reps-b .av-menu [data-rb="account"]').click();assert.equal(await page.evaluate(()=>window.__account),1,'계정 관리 = 기존 창');
  /* 열기 = 기존 사람별 창 · 코칭 약속 버튼 = 창 + 약속 칸 포커스 · 저장은 기존 경로 */
  await page.locator('#reps-b .psb-row').first().locator('.prv-a').click();await page.waitForTimeout(250);
  const d=page.locator('#repsDialog.on .rd-box');assert.equal(await d.count(),1,'v2 사람별 창');assert.match(await d.locator('.rd-head').innerText(),/이필선/);
  await page.keyboard.press('Escape');await page.waitForTimeout(150);
  await page.locator('#reps-b .psb-row').first().locator('[data-sb="act"]').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.matches('#repsDialog textarea')),true,'약속 칸 포커스');
  await page.locator('#repsDialog .rd-promise textarea').fill('금요일까지 신규 배정 첫 연락 완료');await page.locator('#repsDialog [data-rd="save"]').click();await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>__writes.map(w=>[w[0],w[1]])),[['rep_manager_comment','이필선']],'약속 저장 = 기존 경로');
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  assert.doesNotMatch(await page.locator('#reps-b .psb-row').first().innerText(),/이번 주 코칭 약속 없음/,'약속 뒤 사유 사라짐');
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.repsBOff=true;paintRepManagement();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#reps-b').count(),0);assert.equal(await page.locator('#reps-v2').count(),1,'끄면 v2 묶음 표');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',board_frame:true,one_row_one_person:true,diagnosis_3bars:true,reasons:true,side_boxes:true,sort_red_first:true,filters_more:true,open_existing_dialog:true,promise_existing_path:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
