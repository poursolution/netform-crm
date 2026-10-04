'use strict';
// Synthetic, network-isolated menu acceptance test. No customer writes or AI calls.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root+path.sep)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res);});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});}catch(e){srv.close();throw e;}
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.Gongjong);
  await page.evaluate(()=>{
   const deal=(id,site,amount,extra={})=>({id,site,amt:amount,assignee:'담당자',brand:'POUR솔루션',created:'2026-09-01',updated:'2026-09-02',code:'consulting',stage_code:'consulting',grp:'영업·관리',version:1,...extra});
   B={deals:[deal('d1','같은 현장',23e8,{site_id:'s1',work:'지하주차장 에폭시 견적 요청',created:'2026-09-20'}),deal('d2','같은 현장',10e8,{site_id:'s1',work:'과거 견적',workItems:['지하주차장>에폭시'],primaryWork:'지하주차장>에폭시'}),deal('d3','같은 현장',5e8,{site_id:'s2',work:'별도 지역 문의',activities:[{opportunity_id:'d2',note:'우레탄 방수'},{opportunity_id:'d3',note:'<p>감리선정 확정</p><ol><li><p><strong>[일정 &amp; 조정]</strong></p><p>4월 초 임시회의</p></li></ol><p></p>'}]}),deal('d4','분류된 현장',3e8,{workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄'}),deal('d5','미확인 현장',2e8,{work:'옥상 방수 상담'})],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'검증관리자',role:'admin'};
   Object.assign(G,{year:'전체',quarter:0,rep:'전체',brand:'전체',workFilter:'전체',q:''});
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__writes=[];window.__ai=[];window.__merge=[];window.__mergeFail=true;
   const fake={current:null,last:{state:'idle'},openWork:async(id,item)=>{fake.current=item;CUR_DETAIL={kind:'deal',key:dealKey(item),item};openWorkEdit();},save:async(item,p)=>{__writes.push([item.id,p]);item.workItems=p.work_items;item.primaryWork=p.primary_work;fake.last={state:'saved'};closeNewDeal();}};window.Phase11=fake;
   window.OpsStore={settings:async()=>({}),aiOn:()=>true,ai:async(kind,type,id,input)=>{__ai.push({kind,type,id,input});return {id:'ai-1',suggestion:{keys:['INVALID',id==='d1'?'지하주차장>에폭시':'옥상>우레탄'],primary:id==='d1'?'지하주차장>에폭시':'옥상>우레탄',basis:'이 건 상담 기록 확인'}};},decide:()=>{}};
   window.SB={rpc:async(name,{p})=>{if(name==='crm_gongjong_links_v1')return {data:{ok:true,links:[]}};if(name==='crm_gongjong_merge_v1'){__merge.push(p);return __mergeFail?{error:{code:'PGRST202',message:'missing'}}:{data:{ok:true,source_id:p.source_id,target_id:p.target_id,quote_version_id:'quote-1',request_id:p.request_id,quote_count:1}};}return {error:{code:'PGRST202'}};}};
   goPage('work');
  });
  const v=page.locator('#work-v2.gj-workspace');await v.waitFor();await page.waitForTimeout(100);
  assert.match(await v.locator('.gj-intro').innerText(),/영업기회 5건 중 공종 확정 2건/);
  assert.equal(await v.locator('.gj-group').count(),1,'different site IDs must not group');
  assert.deepEqual(await page.evaluate(()=>Gongjong.groups(B.deals).map(g=>g.map(d=>d.id))),[['d1','d2'],['d3'],['d4'],['d5']]);
  assert.equal(await page.evaluate(()=>Gongjong.prediction(B.deals[2])),null,'no sibling evidence');
  assert.equal(await v.locator('[data-deal="d5"] .gj-accept button').count(),0,'group-only inference cannot pick a detail');
  assert.equal(await page.evaluate(()=>__ai.length+__writes.length),0,'no automatic AI/write');
  await v.locator('[data-deal="d1"] [data-gj="detail"]').click();
  await page.locator('#gongjongDialog [data-gj="ai"]').click();await page.waitForTimeout(100);await page.locator('#gongjongDialog [data-gj="close"]').click();
  assert.match(await v.locator('[data-deal="d1"]').innerText(),/다른 건과 같은 공종/);
  assert.equal(Math.round((await v.locator('.gj-diagnosis').boundingBox()).width),340,'handoff diagnosis width');
  assert.equal(await v.locator('[data-deal="d1"] .gj-accept button').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(21, 23, 28)','black acceptance button');
  assert.equal(await v.locator('.gj-tabs button').first().evaluate(el=>getComputedStyle(el).borderRadius),'999px','handoff pill tabs');
  assert.ok((await v.locator('[data-deal="d3"] .gj-row').boundingBox()).height<70,'compact reference row');
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  await v.locator('[data-deal="d1"] [data-gj="accept"]').click();
  assert.equal(await v.locator('.gj-conflict').count(),1);assert.equal(await page.evaluate(()=>__writes.length),0);
  await v.locator('[data-gj="merge"]').click();await page.waitForTimeout(100);
  assert.match(await v.locator('.gj-error').innerText(),/아직 설치되지/);assert.equal(await page.evaluate(()=>Gongjong.model().rows.length),5,'failed merge never hides source');
  await v.locator('[data-gj="keep"]').click();await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>__writes.length),1);assert.match(await page.evaluate(()=>__writes[0][1].reason),/다른 공사/);
  assert.equal(await page.evaluate(()=>Gongjong.model().rows.length),5,'keep counts both');
  await v.locator('[data-deal="d3"] [data-gj="detail"]').click();
  const dialog=page.locator('#gongjongDialog');assert.equal(await dialog.locator('.gj-columns').count(),1);
  assert.equal(await dialog.locator('details,summary').count(),0);
  assert.doesNotMatch(await dialog.locator('main').innerText(),/우레탄 방수/);
  /* 기록 속 태그(<p> · <li> · <strong> · &amp;)는 줄바꿈 · 글자로 정리해 보여 준다(2026-10-04 대표 "<P> 이런 거 보기 힘드니까 정리") — AI 에 넘기는 기록은 원문 그대로 */
  {const t=await dialog.locator('main .gj-record p').allInnerTexts();assert.ok(t.includes('감리선정 확정\n· [일정 & 조정]\n4월 초 임시회의'),'기록 속 태그 정리: '+JSON.stringify(t));assert.doesNotMatch(await dialog.locator('main').innerText(),/<\/?(p|ol|li|strong)>|&amp;/);
   assert.deepEqual(await page.evaluate(()=>[tidyNoteHtml('면적 3 < 5 > 2 그대로'),tidyNoteHtml('줄1\n\n줄2'),sayLegacyNote('<p>통화 — 진행됨</p>')]),['면적 3 < 5 > 2 그대로','줄1\n\n줄2','통화 완료 · 진행 중'],'태그가 없는 글은 그대로 · 상세 응대 이력도 같은 정리');}
  await dialog.locator('[data-gj="ai"]').click();await page.waitForTimeout(100);
  assert.match(await dialog.locator('.gj-action').innerText(),/AI 추정 맞음/);
  assert.deepEqual(await page.evaluate(()=>__ai.filter(x=>x.id==='d3').map(x=>[x.kind,x.id,x.input.records])),[['work_guess','d3',['별도 지역 문의','<p>감리선정 확정</p><ol><li><p><strong>[일정 &amp; 조정]</strong></p><p>4월 초 임시회의</p></li></ol><p></p>']]]);
  assert.equal(await page.evaluate(()=>__writes.length),1,'AI remains a suggestion');
  if(shot)await page.screenshot({path:shot+'-detail.png'});
  await dialog.locator('[data-gj="confirm-ai"]').click();await page.waitForTimeout(100);
  assert.equal(await dialog.count(),0);assert.equal(await page.evaluate(()=>__writes.length),2);
  await v.locator('[data-gj="tab"][data-value="done"]').click();
  await v.locator('[data-deal="d1"] [data-gj="edit"]').click();await v.locator('[data-gj="save"]').click();
  await page.evaluate(()=>window.__mergeFail=false);await v.locator('[data-gj="merge"]').click();await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>Gongjong.model().rows.length),4);assert.equal(await v.locator('[data-deal="d1"]').count(),0);
  assert.match(await v.locator('[data-deal="d2"]').innerText(),/견적 버전/);
  await page.evaluate(()=>WorkV2.classify('d4',{single:true}));await page.locator('#workDialog.on').waitFor();
  assert.ok((await page.locator('#workDialog .wd-box').boundingBox()).width<=560);await page.locator('#workDialog [data-wd="close"]').first().click();
  await page.setViewportSize({width:390,height:844});assert.ok(await v.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'menu overflow');
  await page.evaluate(()=>{G.workV2Off=true;paintWorkAnalysis();});assert.equal(await page.locator('#work-v2').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: grouping, own-record AI, overlap keep/merge, failed ACK, aggregates, detail, external editor, narrow layout');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
