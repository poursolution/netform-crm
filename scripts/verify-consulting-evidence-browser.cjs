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
   const day=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));window.DAY=day;
   const d=(i,extra)=>Object.assign({id:'consult-'+i,site:'검증 컨설팅 '+i,assignee:i===0?'':i<8?'이필선':'송보람',brand:'POUR솔루션',created:day(-60),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:1e8,activities:[],stage_contexts:{},manager_mobile:'01000000000'},extra||{});
   B={deals:Array.from({length:10},(_,i)=>d(i)),inquiries:[],activities:[],expansion_pool:[],inquiryTrash:[]};
   B.deals[1].activities=[{id:'connected',type:'전화',note:'통화 완료 · 연결됨',at:day(-20)+'T12:00:00+09:00'}];
   B.deals[2].next_action={id:'visit',type:'현장방문',text:'방문 예정',due:day(-10),status:'open'};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};
   G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.ps3=null;G.dealSameOff=true;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   window.saveLocal=()=>{throw Error('unexpected save');};window.pushWrite=()=>{throw Error('unexpected write');};
   PipelineWorkspace.open('consulting');
  });
  const V=page.locator('#pipeline-stage-v3');await V.waitFor();
  assert.equal(await page.evaluate(()=>PipelineListV2.brandStats()[0].n),10);
  assert.equal(await V.locator('.ps3-tab[data-v="0"] .n').innerText(),'10','missing date and expired plan are not completed meetings');
  assert.match(await V.locator('.prv-row[data-key="consult-1"] .prv-c>b').innerText(),/기존 통화 내용·미팅 진행 여부 확인/);
  assert.equal(await V.locator('.prv-row[data-key="consult-0"] button').innerText(),'담당 배정');
  assert.doesNotMatch(await V.locator('.ps3-miss').innerText(),/현재 업무 미수행|과거 자료 미확인/);
  const before=await page.evaluate(()=>JSON.stringify(B));
  const cases=await page.evaluate(()=>{
   const r=PipelineWorkspace.rows()[0],calc=d=>{const rr={...r,item:d,due:'',next:null,fields:{}};return {bucket:PipelineStageB.consultingEvidence(rr).bucket,meeting:PipelineJudge.meetingOf(d)};};
   const base={...r.item,stage_contexts:{},activities:[]};
   const activity=(type,note,n)=>({...base,activities:[{type,note,at:DAY(n)+'T12:00:00+09:00'}]});
   return {memo:calc(activity('내부 메모','미팅 완료',-2)),planned:calc(activity('방문','시간이 맞으면 방문 예정',-2)),cancelled:calc(activity('방문','방문 취소',-2)),future:calc(activity('방문','미팅 완료',2)),done:calc(activity('방문','1차 미팅 완료',-2)),dateOnly:calc({...base,stage_contexts:{consulting:{fields:{meeting_date:DAY(-2)}}}}),quote:calc({...base,stage_contexts:{consulting:{fields:{quote_request:'견적 요청'}}}})};
  });
  for(const k of ['memo','planned','cancelled','future','dateOnly'])assert.deepEqual(cases[k],{bucket:'none',meeting:''},k);
  assert.equal(cases.done.bucket,'done');assert.ok(cases.done.meeting);assert.deepEqual(cases.quote,{bucket:'done',meeting:''});
  await V.locator('[data-ps3="view"][data-v="board"]').click();
  assert.equal(await V.locator('.ps3-card[data-key="consult-0"] button').innerText(),'담당 배정');
  assert.match(await V.locator('.ps3-card[data-key="consult-2"]').innerText(),/실행 여부 확인/);
  await page.evaluate(()=>{window.__act=null;PipelineStageB.open=(key,act)=>{window.__act={key,act};};});
  await V.locator('.ps3-card[data-key="consult-0"] button').click();assert.deepEqual(await page.evaluate(()=>__act),{key:'consult-0',act:'owner'});
  await page.evaluate(()=>{G.pipeStageV3Off=true;PipelineWorkspace.open('consulting');});
  const F=page.locator('#pipeline-stage-b');await F.locator('[data-psb="view"][data-v="board"]').click();
  assert.equal(await F.locator('.psb-card').count(),10);assert.equal(await F.locator('.psb-card[data-key="consult-0"] button').innerText(),'담당 배정');
  assert.equal(await page.evaluate(()=>JSON.stringify(B)),before);assert.deepEqual(errors,[]);console.log('consulting evidence browser ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
