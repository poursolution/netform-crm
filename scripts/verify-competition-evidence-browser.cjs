'use strict';
// Synthetic records only; no production requests, writes, or notifications.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');fs.createReadStream(p).pipe(res);});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);
  await page.waitForFunction(()=>window.PipelineStageV3&&window.PipelineRowV11&&window.PipelineJudge);
  await page.evaluate(()=>{
   const day=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));
   const at=n=>new Date(Date.now()+n*864e5).toISOString();
   const deal=(id,extra)=>Object.assign({id,site:'검증 '+id,assignee:'이필선',brand:'POUR솔루션',created:day(-60),code:'bidding',stage_code:'bidding',grp:'영업·관리',amt:1e8,activities:[],stage_contexts:{}},extra);
   const next=(id,n)=>({id:'task-'+id,text:'재통화',due:day(n),status:'open'});
   B={deals:[
    deal('a-future',{stage_entered_at:at(-20),next_action:next('a',3)}),
    deal('b-unknown',{}),
    deal('c-late',{next_action:next('c',-37),activities:[{id:'call-c',type:'전화',note:'통화 완료 · 연결됨',at:at(-35),occurred_at:at(-35)}]}),
    deal('d-late',{next_action:next('d',-2)}),
    deal('e-deadline',{stage_entered_at:at(-10),stage_contexts:{bidding:{fields:{bid_deadline:day(-1)}}}}),
    deal('f-submitted',{stage_contexts:{bidding:{fields:{bid_plan:'제출 완료'}}}})
   ],inquiries:[],activities:[],expansion_pool:[],inquiryTrash:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};
   G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.ps3=null;G.dealSameOff=true;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   window.saveLocal=()=>{throw Error('unexpected save');};window.pushWrite=()=>{throw Error('unexpected write');};
   PipelineWorkspace.open('competition');
  });
  const V=page.locator('#pipeline-stage-v3');await V.waitFor();
  const kpi=(await V.locator('.ps3-kpis').innerText()).replace(/\s+/g,' ');
  assert.match(kpi,/후속 업무 지연 2건/);assert.match(kpi,/입찰 일정 없음 5 · 다음 행동일 없음 3/);
  assert.match(kpi,/진입일 입력 2 \/ 6건/);
  assert.match(await V.locator('.ps3-diag header').first().innerText(),/예상 6억/);
  assert.equal(await V.locator('[data-ps3="reason"][data-v="nodate"] .c').innerText(),'5','submitted record without a date still counts as missing');
  const listed=await V.locator('.prv-row').evaluateAll(xs=>xs.map(x=>x.dataset.key));
  assert.equal(listed[0],'c-late');
  assert.match(await V.locator('.prv-row[data-key="c-late"]').innerText(),/기존 업무 처리 확인 → 다음 행동 갱신/);
  assert.match(await V.locator('.prv-row[data-key="b-unknown"]').innerText(),/판정 불가/);
  await V.locator('[data-ps3="view"][data-v="board"]').click();
  const cards=V.locator('.ps3-card');
  const boardGroups=await V.locator('.ps3-col').evaluateAll(cols=>cols.map(c=>[...c.querySelectorAll('.ps3-card')].map(x=>x.dataset.key)));
  assert.deepEqual(boardGroups[3],listed.filter(k=>['a-future','b-unknown','c-late','d-late'].includes(k)));
  assert.match(await cards.filter({hasText:'검증 b-unknown'}).innerText(),/판정 불가 · 이관 기록 확인/);
  assert.match(await cards.filter({hasText:'검증 c-late'}).innerText(),/기존 후속 업무 처리 확인/);
  assert.match(await cards.filter({hasText:'검증 b-unknown'}).locator('.t .d').innerText(),/진입일 미확인/);
  assert.match(await cards.filter({hasText:'검증 a-future'}).innerText(),/진입 20일/);
  assert.match(await cards.filter({hasText:'검증 a-future'}).innerText(),/예상 1억/);
  assert.equal(await page.evaluate(()=>B.deals.find(d=>d.id==='c-late').next_action.status),'open','contact must not silently complete task');
  if(process.env.SHOT)await page.screenshot({path:process.env.SHOT});
  await page.evaluate(()=>{G.pipeStageV3Off=true;G.psb=null;PipelineWorkspace.open('competition');});
  const Bv=page.locator('#pipeline-stage-b');await Bv.locator('[data-psb="view"][data-v="board"]').click();
  assert.match(await Bv.locator('.psb-card[data-key="b-unknown"]').innerText(),/판정 불가 · 이관 기록 확인/);
  const fallback=await Bv.locator('.psb-col').first().locator('.psb-card').evaluateAll(xs=>xs.map(x=>x.dataset.key));
  assert.equal(fallback[0],'c-late','fallback board follows list due-date order');
  assert.deepEqual(errors,[]);console.log('competition evidence browser ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
