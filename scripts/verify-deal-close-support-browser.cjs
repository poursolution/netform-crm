'use strict';
/* 지원 업무 종결(2026-10-22 회의록 10/1): PC 상세 [단계 바꾸기] → [지원 종결] → PC 와 같은 전환 입력(지원 종류 · 내용) → 저장 = close 명령(outcome support)
   · 화면 판정 outcomeOf='support' · 종료 묶음 '지원 종결' · 종료 필터에 '지원 종결' · 메이드율(dealResult)에서 실주가 아님
   모바일: 다음으로 시트에 [지원 종결] 칩 · 지원 종류 칩 · 저장 = pushWrite('close', outcome support) (합성 화면은 쓰기 차단까지만) */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const mobileServer=require('../review-preview/server.cjs');
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));await new Promise(r=>mobileServer.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(require('../review-preview/review-environment.cjs').launchOptions());
 try{
  /* ── PC ── */
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.StageTransitionUI&&window.PipelineListV2&&window.OpsStore&&window.CRMRules);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   B={deals:[{id:'11111111-1111-4111-8111-111111111111',site:'[합성] 지원 PT 아파트',site_id:'aaaaaaaa-0000-4000-8000-000000000001',assignee:'황윤선',brand:'POUR솔루션',created:day(-60),code:'compete',stage_code:'compete',grp:'경쟁·임박',amt:3e8,manager_name:'김영수',manager_mobile:'01000000000',contacts:[],version:2,
     next_action:{id:'n1',text:'PT 자료 전달',due:day(2),status:'open'},activities:[{id:'a1',type:'전화',note:'PT 지원 요청 받음',at:at(-5)}],stage_contexts:{compete:{fields:{competition_type:'PT'}}}}],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,JSON.parse(JSON.stringify(p))]);return 'req-'+__writes.length;};
   window.Phase1={...Phase1,profile:{auth_uid:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}};Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>[];
   SB={rpc:async()=>({data:{ok:true,tasks:[]}})};TOKEN='test';OpsStore.aiOn=()=>false;window.CRMRelease={has:()=>true,listed:()=>true,noteMissing(){},check(){},missing:()=>[]};
   G.pipeStageBOff=true;PipelineWorkspace.open('competition');
  });
  await page.waitForTimeout(200);
  await page.locator('#pipeline-list-v2 .plv-row',{hasText:'지원 PT'}).locator('.plv-site').click();await page.waitForTimeout(600);
  assert.equal(await page.locator('#detailView.ddv.dv3').count(),1,'상세');
  await page.locator('#detailView .dv3-headact [data-dv3="mv"]').click();await page.waitForTimeout(200);
  const band=page.locator('#detailView .dw-center>.dv3-move');
  const names=await band.locator('.dv3-moves button').allInnerTexts();
  assert.ok(names.includes('지원 종결'),'단계 바꾸기 띠에 [지원 종결]: '+names.join('/'));
  await band.locator('.dv3-moves button',{hasText:'지원 종결'}).click();await page.locator('#stage-transition-form').waitFor();
  assert.equal(await page.locator('#sf-target').inputValue(),'support','전환 대상 = support');
  assert.deepEqual(await page.locator('#sf-close_reason option').allInnerTexts().then(l=>l.filter(x=>/지원|기타/.test(x))),['PT 지원','기술자문 지원','자료 · 견적 지원','현장 확인 지원','기타']);
  /* v3 전환 띠는 select 를 숨기고 칩으로 고르므로 값은 같은 요소에 직접 넣고 change 를 알린다 */
  await page.evaluate(()=>{const set=(id,v,ev)=>{const el=document.getElementById(id);if(!el)return;el.value=v;el.dispatchEvent(new Event(ev,{bubbles:true}));};set('sf-close_reason','PT 지원','change');set('sf-close_detail','입대의 PT 지원 완료 · 시공사는 타사 선정','input');set('sf-memo','지원 업무로 끝남','input');});
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-1-form.png')});
  await page.evaluate(()=>document.querySelector('#stage-transition-form button[type="submit"]').click());await page.waitForTimeout(500);
  const w=await page.evaluate(()=>({writes:__writes.map(x=>x[0]),close:__writes.find(x=>x[0]==='close')?.[1]||null,err:document.getElementById('sf-error')?.innerText||'',d:(()=>{const d=B.deals[0];return {code:d.code,outcome:outcomeOf(d),bucket:closedBucket(d),result:CRMRules.dealResult(d),closed:isClosedCode(d.code),filter:(closedFilter('support')||{}).nm||''};})()}));
  assert.equal(w.err,'','입력 오류 없음');
  assert.ok(w.close,'close 명령이 나감: '+w.writes.join(','));
  assert.equal(w.close.outcome,'support');assert.equal(w.close.to,'support');assert.equal(w.close.from,'compete');assert.equal(w.close.stage_context.fields.close_reason,'PT 지원');assert.equal(w.close.won_amount,null);
  assert.deepEqual(w.d,{code:'support',outcome:'support',bucket:'지원 종결',result:'support_closed',closed:true,filter:'지원 종결'},'화면 판정: 지원 종결 · 실주 아님');
  /* 전송 검사(adapter): 서버로 가는 모양 */
  const norm=await page.evaluate(()=>{const c=__writes.find(x=>x[0]==='close')[1];return OperationalAdapter.normalize?OperationalAdapter.normalize('close',c.opportunity_id,c):null;}).catch(()=>null);
  if(norm)assert.equal(norm.outcome,'support','adapter 가 support 를 통과시킨다');
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-2-closed.png')});
  assert.deepEqual(errs,[],'PC 화면 오류 없음: '+errs.join(' | '));
  await ctx.close();

  /* ── 모바일 ── */
  const origin='http://127.0.0.1:'+mobileServer.address().port;
  const mctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'}),merr=[];
  await mctx.route('**/*',r=>{const q=r.request();return new URL(q.url()).origin===origin&&['GET','HEAD'].includes(q.method())?r.continue():r.abort();});
  const mp=await mctx.newPage();mp.setDefaultTimeout(10000);mp.on('pageerror',e=>merr.push(e.message));
  await mp.goto(origin+'/mobile.html?demo=1&review=hub&screen=B',{waitUntil:'domcontentloaded'});await mp.locator('.approved-b').waitFor();
  const m=await mp.evaluate(()=>{
   closeSheet();const id='77777777-7777-4777-8777-000000000002',today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
   const actor=Phase1.profile.user_id;G.user={...G.user,id:actor};G.mode='rep';G.deal=id;
   DEALS=[{id,site_id:'77777777-7777-4777-8777-000000001002',nm:'합성 지원 현장',code:'compete',sub:'방수',rep:G.user.nm,owner_id:actor,brand:'POUR솔루션',version:0,amt:1e8,manager_name:'합성 소장',manager_mobile:'',created_at:new Date().toISOString(),stageAt:new Date().toISOString(),lastAt:new Date().toISOString(),contactAt:new Date().toISOString(),activities:[],tl:[],nextAction:{id:'77777777-7777-4777-8777-000000000102',type:'전화',text:'PT 자료',due:today,due_at:today,status:'open'}}];
   window.toast=()=>{};nextSheet();const chips=[...document.querySelectorAll('#sheetcard .cchip')].map(b=>b.innerText.trim());
   closeSheetFlow('support');const opts=[...document.querySelectorAll('#sheetcard .cchip')].map(b=>b.innerText.trim()),title=document.querySelector('#sheetcard .intro')?.innerText||'';
   window.__mw=[];const orig=window.pushWrite;window.pushWrite=(op,p)=>{__mw.push([op,p]);return orig(op,p);};
   let thrown='';try{commitClose('support','PT 지원','입대의 PT 지원 완료 · 시공사는 타사','text');}catch(e){thrown=String(e.message||e);}
   return {chips,opts,title,writes:__mw,outcome:DEALS[0]?.outcome,thrown};
  });
  assert.ok(m.chips.includes('지원 종결'),'모바일 종료 칩에 [지원 종결]: '+m.chips.join('/'));
  assert.deepEqual(m.opts,['PT 지원','기술자문 지원','자료 · 견적 지원','현장 확인 지원','기타'],'지원 종류 칩');
  assert.match(m.title,/지원 종류/);
  const cw=m.writes.find(x=>x[0]==='close');assert.ok(cw,'close 명령: '+m.writes.map(x=>x[0]).join(','));assert.equal(cw[1].outcome,'support');assert.equal(cw[1].reason,'PT 지원 · 입대의 PT 지원 완료 · 시공사는 타사');assert.equal(cw[1].stage_code,'compete');
  assert.equal(m.outcome,'support');
  const okErr=e=>/합성 검토 화면에서 지원하지 않는 작업/.test(e);
  assert.ok(merr.every(okErr)&&(m.thrown===''||okErr(m.thrown)),'합성 화면의 쓰기 차단 외 오류 없음: '+merr.join(' | ')+' '+m.thrown);
  console.log('deal close support ok');
 }finally{await browser.close();srv.close();mobileServer.close();}
})().catch(e=>{console.error(e);process.exit(1)});
