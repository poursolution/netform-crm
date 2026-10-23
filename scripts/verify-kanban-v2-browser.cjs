'use strict';
/* 칸반 v2 검사(2026-10-01 디자인 핸드오프): 정렬·12장 제한·더보기, 필터 드롭다운, 끌어 놓기 → 기존 단계 전환창(직접 이동 없음) */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1500,height:950},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineWorkspace&&window.StageTransitionUI);
  await page.evaluate(()=>{
   /* 한국 날짜(화면 판정과 같은 기준). toISOString(UTC)이면 한국 0~9시에 하루 어긋나 '4일 지남'이 '5일 지남'이 됐다 */
   const day=d=>new Date(Date.now()+d*864e5+9*36e5).toISOString().slice(0,10);
   const mk=(id,code,amt,extra)=>Object.assign({id,site:'현장 '+id,assignee:'이필선',brand:'POUR솔루션',created:CUR_Y+'-05-01',code,stage_code:code,grp:'영업·관리',amt},extra||{});
   const deals=[mk('ok-big','consulting',9e8,{next_action:{id:'n1',text:'통화',due:day(5),status:'open'}}),mk('none-small','consulting',1e8),mk('none-big','consulting',5e8),mk('over','consulting',1e7,{next_action:{id:'n2',text:'통화',due:day(-4),status:'open'}}),mk('sent-1','sent',2e8,{assignee:'황윤선',brand:'석민이앤씨'})];
   for(let i=0;i<14;i++)deals.push(mk('rel-'+i,'rapport',1e7*(i+1)));
   for(let i=0;i<5;i++)deals.push(mk('lost-'+i,'lost',1e8,{outcome:'lost',lifecycle_status:'closed',grp:'수주 실패',closed_at:'2026-09-0'+(i+1)+'T09:00:00'}));
   B={deals,inquiries:[],activities:[]};LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.pipeRepYear='전체';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.__writes=0;window.pushWrite=()=>{window.__writes++};
   window.__opened=null;window.__transition=null;drwDeal=s=>{window.__opened=JSON.parse(s).id};StageTransitionUI.open=(item,m,to)=>{window.__transition={id:item.id,to}};
   PipelineWorkspace.open('all');
  });
  const col=k=>page.locator('.ps-kcol[data-pk-col="'+k+'"]');
  /* pipeline_list ④(2026-10-20): 정렬 = 확인된 기한 급한 순(지남 → 가까운 날) → 기한 없음(금액 큰 순) · 셋째 줄 = 먼저 볼 이유(항상 보임 · 어떤 기한인지) */
  assert.deepEqual(await col('consulting').locator('.ps-kcard').evaluateAll(ns=>ns.map(n=>n.dataset.value)),['over','ok-big','none-big','none-small']);
  assert.deepEqual(await col('consulting').locator('.ps-kdot').evaluateAll(ns=>ns.map(n=>n.className.replace('ps-kdot ',''))),['over','ok','none','none']);
  assert.deepEqual(await col('consulting').locator('.ps-kr3').evaluateAll(ns=>ns.map(n=>[n.textContent,n.classList.contains('r')])),[['연락 약속 '+(()=>{const d=new Date(Date.now()-4*864e5+9*36e5);return (d.getUTCMonth()+1)+'.'+d.getUTCDate();})()+' · 4일 지남',true],['연락 약속 · '+(()=>{const d=new Date(Date.now()+5*864e5+9*36e5);return (d.getUTCMonth()+1)+'/'+d.getUTCDate();})()+'까지',false],['판정 불가 · 이관 전 기록 확인',false],['판정 불가 · 이관 전 기록 확인',false]],'셋째 줄 = 먼저 볼 이유 · 기한 지남만 빨강');
  /* 칸마다 한 쪽 최대 20건 + 쪽 번호('+n건 더보기' 없음) · 실주도 같은 규칙(최근 종료 순) */
  assert.equal(await col('relationship').locator('.ps-kcard').count(),14);
  assert.equal(await page.locator('.ps-kmore').count(),0,'더보기 단추 없음');
  assert.equal(await col('lost').locator('.ps-kcard').count(),5);
  assert.equal(await col('lost').locator('.ps-kcard').first().getAttribute('data-value'),'lost-4','최근 실주가 위');
  assert.equal(await col('lost').locator('.ps-kcard').first().getAttribute('draggable'),'false');
  await page.evaluate(()=>{for(let i=0;i<25;i++)B.deals.push({id:'many-'+i,site:'많은 현장 '+i,assignee:'이필선',brand:'POUR솔루션',created:CUR_Y+'-05-01',code:'sent',stage_code:'sent',grp:'영업·관리',amt:1e7});PipelineWorkspace.render();});
  assert.equal(await col('sent').locator('.ps-kcard').count(),20,'한 쪽 20건');assert.equal(await col('sent').locator('nav.lpg .lpg-b.on').innerText(),'1');
  await col('sent').locator('nav.lpg .lpg-b[data-page="2"]:not(.lpg-arrow)').click();await page.waitForTimeout(150);
  assert.equal(await col('sent').locator('.ps-kcard').count(),6,'2쪽 = 나머지 6건');assert.equal(await col('relationship').locator('.ps-kcard').count(),14,'다른 칸 쪽은 그대로');
  await page.evaluate(()=>{B.deals=B.deals.filter(d=>!/^many-/.test(d.id));PipelineWorkspace.render();});
  /* 범위 문구: 진행 중 n건(진행 5단계 · 영업건 단위) · 예상금액 합(금액 미확인 n건 제외) · 끝난 영업은 따로 */
  assert.match((await page.locator('.pk-sum').innerText()).replace(/\s+/g,' '),/진행 중 19건 진행 5단계 · 영업건 단위 예상금액 합 [\d.,]+(억|만) 끝난 영업 · 수주 0 · 실주 5/);
  assert.match(await page.locator('.pk-legend').innerText(),/셋째 줄 = 먼저 볼 이유/);assert.doesNotMatch(await page.locator('.pk-legend').innerText(),/마우스를 올리면/);
  /* 브랜드·담당자 드롭다운 */
  await page.selectOption('[data-pk-filter="brand"]','석민이앤씨');
  assert.equal(await page.locator('.ps-kcard').count(),1);assert.equal(await page.evaluate(()=>G.brand),'석민이앤씨');
  await page.selectOption('[data-pk-filter="brand"]','전체');
  await page.selectOption('[data-pk-filter="owner"]','황윤선');
  assert.equal(await page.locator('.ps-kcard').count(),1);
  await page.selectOption('[data-pk-filter="owner"]','전체');
  /* 끌어 놓기 → 상세 + 그 단계 전환창(직접 저장 없음) */
  const drop=async(key,to)=>page.evaluate(([key,to])=>{const card=document.querySelector('.ps-kcard[data-value="'+key+'"]'),target=document.querySelector('.ps-kcol[data-pk-col="'+to+'"]'),dt=new DataTransfer();card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));const over=target.classList.contains('over');target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));card.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));return over},[key,to]);
  const key=await page.evaluate(()=>document.querySelector('.ps-kcol[data-pk-col="sent"] .ps-kcard').dataset.value);
  await page.evaluate(()=>{window.__opened=null;window.__transition=null});
  assert.equal(await drop(key,'relationship'),true,'놓을 열 강조');
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>({o:window.__opened,t:window.__transition})),{o:'sent-1',t:{id:'sent-1',to:'rapport'}},'관계관리로 놓으면 전환창');
  await page.evaluate(()=>{window.__opened=null;window.__transition=null});
  await drop(key,'lost');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__transition&&window.__transition.to),'lost','실주 열에 놓으면 실주 전환창');
  await page.evaluate(()=>{window.__opened=null;window.__transition=null});
  await drop(key,'sent');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__transition),null,'같은 열은 아무 일 없음');
  assert.equal(await page.evaluate(()=>window.__writes),0,'놓기만으로는 저장되지 않는다');
  /* 칸 제목 → 단계 목록 화면(더보기 단추는 없다 — 칸마다 쪽 번호) */
  await col('relationship').locator('.ps-ktitle').click();assert.equal(await page.evaluate(()=>G.pipelineStage),'relationship');
  assert.equal(await page.locator('#pipeline-stage-root.pk-mode').count(),0,'단계 화면은 기존 모양');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',sort:true,limit12:true,lost3:true,filters:true,drop_opens_transition:true,no_direct_write:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
