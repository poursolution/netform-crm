'use strict';
/* 정착 모드(2026-11-09 대표 「전부 진행」 · settle-mode.js) — 합성 자료(이름 · 현장은 지어낸 것) + 가짜 서버
   세 경우: ① 끔(G.settleOff) = 예전 필수 규칙 그대로 ② 켬 + 서버 SQL 설치 전 = 화면에서만 막던 것만 풀림(단계 칸은 그대로 필수)
            ③ 켬 + 서버 설치 확인(crm_settle_mode_v1) = 단계 칸 권장 · 실주 사유 1개 · 이관 자료 '정리 필요' 묶음 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
async function open(browser,mode){
 const ctx=await browser.newContext({viewport:{width:1500,height:950},timezoneId:'Asia/Seoul'});
 await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(String(e.message||e)));
 await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);
 await page.waitForFunction(()=>window.PipelineScope&&window.PipelineWorkspace&&window.StageTransitionUI&&window.DealDetailV3&&window.SettleMode&&window.ContactEntry&&typeof goPage==='function');
 await page.evaluate(async(mode)=>{
  const U=n=>'aaaaaaaa-0000-4000-8000-0000000000'+String(n).padStart(2,'0');
  const deal=(n,site,code,owner,o)=>Object.assign({id:U(n),site,site_id:'s-'+n,assignee:owner,brand:'POUR솔루션',created:'2025-06-10',code,stage_code:code,amt:0,amount:0,activities:[],workItems:[],workSummary:'',version:3},o);
  B={deals:[deal(1,'[가상] 한빛마을아파트','consulting','이필선',{created:'2026-10-05',amt:180000000,amount:180000000,nextActionObj:{id:'na1',type:'전화',text:'견적 요청 내용 확인',due:'2099-11-12',status:'open'}}),
   deal(2,'[가상] 푸른숲아파트','sent','황윤선',{created:'2026-10-06'}),deal(3,'[가상] 새솔단지','qualified','이필선',{created:'2025-04-02',amt:240000000,amount:240000000}),
   deal(4,'[가상] 별빛마을','nurturing','황윤선',{created:'2025-01-15'}),deal(5,'[가상] 은하수아파트','potential','',{created:'2025-12-01'})],
   inquiries:[],activities:[],inquiryTrash:[],inquiryCleanupArchived:[],expansion_pool:[]};
  LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;G.quickMoveOff=true;/* 창을 직접 보는 검사 — 바로 옮기기는 verify-quick-move */ME={id:'adm',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.pipeRepYear='전체';window.saveLocal=()=>{};
  document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
  SB={rpc:async(n)=>n==='crm_settle_mode_v1'&&mode==='ready'?{data:{ok:true,version:1}}:{error:{code:'PGRST202',message:'Could not find the function'}}};TOKEN='test';
  if(mode==='off')G.settleOff=true;await SettleMode.check(true);PipelineScope._reset();
 },mode);
 return {ctx,page,errs};
}
async function stageForm(page,dealIndex,to){
 await page.evaluate(i=>{goPage('pipe');G._detailPopup=true;drwDeal(JSON.stringify(B.deals[i]));},dealIndex);await page.waitForTimeout(400);
 await page.evaluate(to=>StageTransitionUI.open(CUR_DETAIL.item,false,to),to);await page.waitForSelector('#stage-transition-form');await page.waitForTimeout(400);
 const f=page.locator('#stage-transition-form');
 const r=await f.evaluate(f=>({req:[...f.querySelectorAll('label b[aria-label="필수"],legend b[aria-label="필수"]')].map(b=>b.parentElement.textContent.replace('*','').trim()),gate:!!f.querySelector('.sg-box'),picker:!!f.querySelector('.lr-cats'),locked:!!f.querySelector('footer .sf-primary.off,footer .sf-primary.sg-locked')}));
 await page.evaluate(()=>StageTransitionUI.close());return r;
}
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const plan=page=>page.evaluate(()=>[ContactEntry.plan({ch:'전화',res:'연결됨',memo:'',mode:'new',purpose:'',date:''},{today:'2026-11-09',existing:null}),ContactEntry.plan({ch:'전화',res:'연결됨',memo:'',mode:'none',reason:''},{today:'2026-11-09',existing:null}),
   ContactEntry.plan({ch:'전화',res:'연결됨',memo:'',mode:'change',date:'2026-11-20',reason:''},{today:'2026-11-09',existing:{text:'다시 연락',due:'2026-11-10',type:'전화',id:'aaaaaaaa-0000-4000-8000-00000000aa01'},scheduleV1:true})].map(p=>p.ok?'ok · '+p.parts.join(' · '):p.error));
  /* ① 끔 = 예전 그대로 */
  {const {ctx,page,errs}=await open(browser,'off');
   assert.deepEqual(await page.evaluate(()=>SettleMode.state()),{on:false,server:false});
   assert.deepEqual(await plan(page),['상담 내용을 한 줄 적어 주세요 (이번에 새로 확인한 것)','상담 내용을 한 줄 적어 주세요 (이번에 새로 확인한 것)','상담 내용을 한 줄 적어 주세요 (이번에 새로 확인한 것)']);
   assert.deepEqual(await stageForm(page,0,'sent'),{req:['무엇을 발송했나요?','수신자','발송일','다음 확인일'],gate:true,picker:false,locked:true});
   const lost=await stageForm(page,1,'lost');assert.deepEqual([lost.req,lost.picker],[['실주 원인','확인한 내용 · 고객 반응'],true]);
   await page.evaluate(()=>PipelineWorkspace.open('all'));await page.waitForTimeout(400);assert.equal(await page.locator('[data-pk-legacy]').count(),0,'끄면 정리 필요 묶음 없음');
   assert.deepEqual(errs,[]);await ctx.close();}
  /* ② 켬 + 서버 설치 전: 응대 · 기록 확인 줄 · 실주 상세는 풀리고, 서버가 검사하는 단계 칸은 그대로 필수 */
  {const {ctx,page,errs}=await open(browser,'pending');
   assert.deepEqual(await page.evaluate(()=>SettleMode.state()),{on:true,server:false});
   assert.deepEqual(await plan(page),['ok · 응대 기록 1건 저장 (실제 연결) · 다시 연락 일정 1건 등록 · 11.12 (목)','ok · 응대 기록 1건 저장 (실제 연결) · 다음 일정 없음','날짜 변경 사유를 입력해 주세요'],'날짜 변경 사유는 서버(SCHEDULE_REASON_REQUIRED)가 요구 → 그대로');
   const s=await stageForm(page,0,'sent');assert.deepEqual([s.req,s.gate],[['무엇을 발송했나요?','수신자','발송일','다음 확인일'],false],'단계 칸은 서버 설치 전까지 필수 · 기록 확인 줄은 없음');
   const lost=await stageForm(page,1,'lost');assert.deepEqual([lost.req,lost.picker],[['실주 원인'],false],'실주 = 사유 1개(상세는 화면이 정착 모드 표시로 채움)');
   assert.equal(await page.evaluate(()=>StageTransition.fillClose('lost',{close_reason:'가격 열세',close_detail:''}).close_detail),'정착 모드 · 상세 미입력 (가격 열세)');
   assert.deepEqual(errs,[]);await ctx.close();}
  /* ③ 켬 + 서버 설치 확인 */
  {const {ctx,page,errs}=await open(browser,'ready');
   assert.deepEqual(await page.evaluate(()=>SettleMode.state()),{on:true,server:true});
   assert.deepEqual(await stageForm(page,0,'sent'),{req:[],gate:false,picker:false,locked:false},'자료 발송: 필수 칸 없음(다음 할 일은 지금 잡힌 것 유지)');
   assert.deepEqual((await stageForm(page,0,'contract')).req,['계약금액(원)'],'계약금액은 그대로 필수');
   assert.deepEqual(await page.evaluate(()=>[StageTransition.validate('consulting','sent',{transition_date:'2026-11-09',fields:{}},'2026-11-09'),StageTransition.validate('compete','contract',{transition_date:'2026-11-09',fields:{}},'2026-11-09')]),[[],['계약금액(원)을(를) 입력해 주세요.']]);
   await page.evaluate(()=>PipelineWorkspace.open('all'));const L=page.locator('.ps-kcol[data-pk-col="legacy"]');await L.waitFor();
   /* 정리 필요 = 칸반 맨 왼쪽 칸(2026-11-09 대표 '밤티' 지적 뒤 — 별도 상자 · 줄 단추 없음, 다른 칸과 같은 카드) */
   assert.equal(await page.locator('[data-pk-legacy],.pk-lrow,.pk-lbtn').count(),0,'예전 회색 상자 · 줄 단추 없음');
   assert.equal(await page.locator('.ps-kanban.pk .ps-kcol').first().getAttribute('data-pk-col'),'legacy','맨 왼쪽 칸');
   assert.deepEqual([one(await L.locator('.ps-ktitle').innerText()),await L.locator('.ps-kn').innerText()],['정리 필요','3']);
   assert.deepEqual(await L.locator('.ps-kcard').evaluateAll(l=>l.map(n=>n.querySelector('.ps-ksite').textContent.trim())),['[가상] 새솔단지','[가상] 별빛마을','[가상] 은하수아파트'],'금액 큰 순');
   assert.match(one(await L.locator('.ps-kcard').first().innerText()),/끌어서 단계 정하기$/);
   assert.match(one(await L.locator('.ps-kcard').nth(2).innerText()),/담당부터 정하기$/);
   assert.match(one(await page.locator('.pk-sum').innerText()),/진행 중 2건/,'진행 숫자에는 이관 자료를 넣지 않음');
   assert.deepEqual(await L.locator('.ps-kcard').evaluateAll(l=>l.filter(e=>e.scrollWidth>e.clientWidth+1).length),0,'카드 글 넘침 없음');
   /* 컨설팅 설계 칸으로 끌면 = 단계 전환 창(정착 모드: 단계 + 다음 할 일 날짜) */
   await L.locator('.ps-kcard').first().dragTo(page.locator('.ps-kcol[data-pk-col="consulting"]'));await page.waitForSelector('#stage-transition-form');await page.waitForTimeout(300);
   assert.deepEqual(await page.locator('#stage-transition-form').evaluate(f=>[f.querySelector('#sf-target').value,[...f.querySelectorAll('label b[aria-label="필수"]')].map(b=>b.parentElement.textContent.replace('*','').trim())]),['consulting',['다음 할 일 날짜']]/* 전환일 * 는 b 태그 없이 글자로 붙어 있다 */);
   await page.evaluate(()=>StageTransitionUI.close());
   /* 실주 칸으로 끌면 = 실주 창(사유 1개) */
   await page.evaluate(()=>PipelineWorkspace.open('all'));await L.waitFor();
   await L.locator('.ps-kcard').nth(1).dragTo(page.locator('.ps-kcol[data-pk-col="lost"]'));await page.waitForSelector('#stage-transition-form');await page.waitForTimeout(300);
   assert.equal(await page.locator('#sf-target').inputValue(),'lost');
   assert.deepEqual(errs,[]);await ctx.close();}
  console.log('verify-settle-mode-browser: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
