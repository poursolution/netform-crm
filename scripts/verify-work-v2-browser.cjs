'use strict';
/* 공종 분석 v2 검사(2026-10-01 디자인 핸드오프 work): 분류 상태 알약 · 진단 · 묶음 표 + 분류(기존 공종 분류·수정 창) → 저장되면 다음 미분류 건.
   추정 공종은 키워드 추정으로 보여 주기만 한다(저장 없음). 끄면 예전 화면 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.WorkV2&&window.PipelineDiagnosis&&typeof paintWorkAnalysis==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const deal=(id,site,owner,code,amt,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-30),updated:day(-5),code,stage_code:code,grp:'영업·관리',amt},extra||{});
   B={deals:[
     deal('d1','강동 롯데캐슬퍼스트 옥상 방수','황윤선','waiting',23e8),
     deal('d2','평택비전지웰푸르지오 지하주차장 에폭시','황윤선','bidding',10e8),
     deal('d3','근거 없는 현장','이필선','consulting',5e8),
     deal('d4','단일 공종 현장','이필선','sent',3e8,{workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄'}),
     deal('d5','복합 공종 현장','한준엽','compete',2e8,{workItems:['옥상>우레탄','재도장>외부'],primaryWork:'옥상>우레탄'})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   /* 분류 창은 기존 창을 그대로 쓴다 — 시험에서는 열렸는지만 기록하고, 저장은 자료를 직접 바꿔 흉내 낸다 */
   window.__edits=[];openWorkEdit=()=>{__edits.push(CUR_DETAIL.item.id);const m=document.getElementById('newDealModal'),b=document.getElementById('newDealBody');b.innerHTML='<div class="work-picker" id="nd-work-picker">공종 선택</div>';m.classList.add('on');};
   goPage('work');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#work-v2');assert.equal(await v.count(),1,'새 화면');
  assert.deepEqual(await v.locator('.plv-pills button').allInnerTexts(),['전체 5','분류 필요 3','단일 공종 1','복합 공종 1']);
  assert.deepEqual(await v.locator('.pd-kpi span').allInnerTexts(),['영업기회','진행 중 금액','매출','공종 미분류']);
  assert.match(await v.locator('.pd-kpis').innerText(),/영업기회\s*5건[\s\S]*진행 중 금액\s*43억[\s\S]*공종 미분류\s*3건\s*60% · 분석 불가/);
  assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),['무엇이 비었나','어디에 돈이 쌓였나','얼마짜리인가']);
  assert.match(await v.locator('.pd-card').nth(1).innerText(),/키워드 추정 기준 · 분류 전[\s\S]*옥상\s*28[\s\S]*지하주차장\s*10[\s\S]*근거 부족\s*5/);
  assert.match(await v.locator('.pd-action').innerText(),/미분류 3건 · 38억[\s\S]*금액 큰 20건부터/);
  assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),['현장 · 담당','단계','담당','금액','등록','추정 공종','']);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['분류 필요 · 금액 큰 순','단일 공종','복합 공종']);
  assert.deepEqual(await v.locator('.plv-ghead span').allInnerTexts(),['3건','1건','1건']);
  assert.match(await v.locator('.plv-row').first().innerText(),/강동 롯데캐슬퍼스트[\s\S]*23억[\s\S]*옥상[\s\S]*키워드 추정[\s\S]*분류하기/);
  assert.match(await v.locator('.plv-row[data-deal="d3"]').innerText(),/근거 부족[\s\S]*분류하기/);
  assert.match(await v.locator('.plv-row[data-deal="d4"]').innerText(),/옥상\(우레탄\)[\s\S]*확정[\s\S]*수정/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 분류하기 → 기존 분류 창 + 추정 안내 */
  await v.locator('.plv-row').first().locator('.plv-cta').click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__edits),['d1']);
  assert.match(await page.locator('#wv-hint').innerText(),/추정 공종 · 옥상[\s\S]*근거:[\s\S]*«옥상»[\s\S]*저장하면 다음 미분류 건이 이어서 열립니다/);
  /* 저장(흉내) → 행이 단일 공종으로 옮겨지고, 다음 미분류 건(금액 큰 순)이 이어서 열린다 */
  await page.evaluate(()=>{const d=B.deals[0];d.workItems=['옥상>우레탄'];d.primaryWork='옥상>우레탄';document.getElementById('newDealModal').classList.remove('on');paint();});await page.waitForTimeout(500);
  assert.deepEqual(await page.locator('#work-v2 .plv-pills button').allInnerTexts(),['전체 5','분류 필요 2','단일 공종 2','복합 공종 1'],'묶음 건수 = 알약 건수');
  assert.deepEqual(await page.evaluate(()=>__edits),['d1','d2'],'다음 미분류 건이 이어서 열림');
  assert.match(await page.locator('#wv-hint').innerText(),/추정 공종 · 지하주차장/);
  /* 나중에(닫기) → 이어 열지 않는다 */
  await page.evaluate(()=>{document.getElementById('newDealModal').classList.remove('on');paint();});await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__edits),['d1','d2']);
  /* 알약 · 좁은 화면 · 끄기 */
  await page.locator('#work-v2 .plv-pills [data-value="multi"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#work-v2 .plv-row').count(),1);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.workV2Off=true;paint();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#work-v2').count(),0);assert.ok((await page.locator('#work-analysis').innerText()).length>20,'끄면 예전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',pills_counts_match:true,diagnosis:true,groups:true,keyword_guess_shown_not_saved:true,classify_existing_dialog:true,chain_next:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
