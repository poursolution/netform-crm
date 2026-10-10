'use strict';
// Synthetic fixtures only. No production requests, persistence, or messages.
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
   window.__day=day;
   const deal=(i,owner)=>({id:'sent-'+i,site:'검증 발송 '+i,assignee:owner,brand:i<12?'POUR솔루션':'석민이앤씨',created:day(-60),code:'sent',stage_code:'sent',grp:'영업·관리',amt:1e8,activities:[],stage_contexts:{},manager_mobile:'01000000000'});
   B={deals:Array.from({length:24},(_,i)=>deal(i,i===0?'':i<18?'이필선':'송보람')),inquiries:[],activities:[],expansion_pool:[],inquiryTrash:[]};
   B.deals[1].next_action={id:'callback',text:'고객 요청 재연락',due:day(-2),status:'open'};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};
   G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.ps3=null;G.dealSameOff=true;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   window.saveLocal=()=>{throw Error('unexpected save');};window.pushWrite=()=>{throw Error('unexpected write');};
   PipelineWorkspace.open('sent');
  });
  const V=page.locator('#pipeline-stage-v3');await V.waitFor();
  assert.equal(await page.evaluate(()=>PipelineListV2.brandStats()[0].n),24,'brand count includes the same known non-sales owners as the list');
  assert.equal(await V.locator('.ps3-tab[data-v="-1"] .n').innerText(),'24');
  assert.match((await V.locator('.ps3-kpis').innerText()).replace(/\s+/g,' '),/발송 후 후속 지연 판정 가능 0 \/ 24 판정 불가 · 발송일 미확인 24건 확인 완료 · 기한 안 – 실제 지연 – 다음 업무 · 기존 발송 자료 · 수신자 · 발송일 확인/);
  assert.match(await V.locator('.ps3-todo').innerText(),/실제 발송 여부와 기존 증빙을 먼저 확인/);
  assert.equal(await V.locator('.prv-row[data-key="sent-0"] button').innerText(),'담당 배정');
  await V.locator('[data-ps3="view"][data-v="board"]').click();
  assert.equal(await V.locator('.ps3-card').count(),20);
  assert.equal(await V.locator('.ps3-card[data-key="sent-0"] button').innerText(),'담당 배정');
  assert.match(await V.locator('.ps3-card[data-key="sent-0"] .nx').innerText(),/담당자 배정/);
  await page.evaluate(()=>{window.__sentAct=null;PipelineStageB.open=(key,act)=>{window.__sentAct={key,act};};});
  await V.locator('.ps3-card[data-key="sent-0"] button').click();
  assert.deepEqual(await page.evaluate(()=>__sentAct),{key:'sent-0',act:'owner'});
  // Brand exclusion for chips retains every other scope, including authorization.
  assert.deepEqual(await page.evaluate(()=>{
   SalesFilterState.selectBrand('POUR솔루션');const selected=PipelineWorkspace.rows().length,all=PipelineListV2.brandStats()[0].n;
   SalesScope.change('owner','이필선');const ownerRows=PipelineWorkspace.rows().length,ownerCount=PipelineListV2.brandStats()[0].n;
   G.q='검증 발송 1';const searchCount=PipelineListV2.brandStats()[0].n;
   G.q='';G.salesScope={type:'all',owner:'전체',organization:'all',assignment:'all'};SalesFilterState.selectBrand('전체');
   ME={id:'sales',name:'이필선',role:'sales'};PipelineWorkspace.open('sent');const own=PipelineWorkspace.rows().length,ownChip=PipelineListV2.brandStats()[0].n;
   ME={id:'admin',name:'송보람',role:'admin'};PipelineWorkspace.open('sent');
   return {selected,all,ownerRows,ownerCount,searchCount,own,ownChip};
  }),{selected:12,all:24,ownerRows:11,ownerCount:17,searchCount:9,own:17,ownChip:17});
  const result=await page.evaluate(()=>{
   const r=PipelineWorkspace.rows().find(x=>x.key==='sent-1'),snapshot=JSON.stringify(r.item);
   const evalCase=(date,values,activities)=>{const d={...r.item,activities:activities||[],stage_contexts:{sent:{fields:{sent_date:date}}}};return PipelineStageB.CFG.sent.calc({...r,item:d,fields:{sent_date:date}},values||{},PipelineStageB.rules()).bucket;};
   const old=__day(-10),recent=__day(-1),log=(type,note)=>[{id:type,type,note,at:recent+'T12:00:00+09:00'}];
   return {callback:evalCase(old),memo:evalCase(old,{},log('내부 메모','자료 확인')),missed:evalCase(old,{},log('전화','부재중')),connected:evalCase(old,{},log('전화','통화 완료 · 연결됨')),reaction:evalCase(old,{reaction:'검토중'}),noDate:evalCase('',{reaction:'검토중'}),invalid:evalCase('bad-date'),future:evalCase(__day(1)),unchanged:snapshot===JSON.stringify(r.item)};
  });
  assert.deepEqual(result,{callback:'late',memo:'late',missed:'late',connected:'done',reaction:'done',noDate:'nodate',invalid:'nodate',future:'nodate',unchanged:true});
  await page.evaluate(()=>{G.pipeStageV3Off=true;G.psb=null;PipelineWorkspace.open('sent');});
  const Bv=page.locator('#pipeline-stage-b');await Bv.locator('[data-psb="view"][data-v="board"]').click();
  assert.equal(await Bv.locator('.psb-card').count(),20,'fallback does not drop undated sends');
  assert.equal(await Bv.locator('.psb-card[data-key="sent-0"] button').innerText(),'담당 배정');
  assert.match((await Bv.locator('.psb-kpis').innerText()).replace(/\s+/g,' '),/판정 가능 0 \/ 24건/);
  assert.deepEqual(errors,[]);console.log('sent evidence browser ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
