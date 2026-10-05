'use strict';
/* 공통 움직임 기준(motion.css · motion.js) — 2026-10-05 대표 "애니메이션 좀 넣어 줘, 과하지 않은 선에서" · 디자인 기준 design_handoff_motion
   확인: 토큰 한 곳 / 탭을 바꾸면 줄이 nfIn(0.18초) / 화면 이동에는 움직임 없음 / 기기 '동작 줄이기'면 꺼짐 / 끄기 스위치 / 자동 검사에서는 기본 꺼짐(다른 검사에 영향 없음)
   / 처리한 줄이 목록에서 빠지면 그 자리에서 접힘(그림자 줄) / 막대는 앞 길이에서 새 길이로 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1500,height:950},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.Motion&&window.PipelineWorkspace&&typeof goPage==='function');
  /* 자동 검사에서는 기본 꺼짐 — 다른 화면 검사의 색 · 위치 확인에 영향을 주지 않는다 */
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('nf-motion')),false);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const deal=(id,o)=>Object.assign({id,site:'[경기 수원] 움직임 확인 '+id,site_id:'s-'+id,assignee:'이필선',brand:'POUR솔루션',created:day(-20),code:'consulting',stage_code:'consulting',grp:'컨설팅 설계',amount:1e8,activities:[],workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄',workSummary:'옥상(우레탄)'},o);
   B={deals:['d1','d2','d3','d4'].map((id,i)=>deal(id,i%2?{nextActionObj:{text:'1차 미팅',due:day(2),type:'방문'}}:{})),inquiries:[],activities:[],inquiryTrash:[],inquiryCleanupArchived:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'adm',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';window.saveLocal=()=>{};
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   G.motionTest=true;Motion.sync();goPage('pipe');PipelineWorkspace.open('consulting');
  });
  await page.waitForSelector('#pipeline-stage-v3 .ps3-row');
  /* 토큰은 한 곳(:root) · 길이는 0.12 ~ 0.24초(막대 0.3초) */
  assert.deepEqual(await page.evaluate(()=>['--nf-fast','--nf-base','--nf-slow','--nf-bar'].map(k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim())),['.12s','.18s','.24s','.3s']);
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('nf-motion')),true);
  /* 화면 이동 · 그냥 다시 그리기에는 줄 움직임이 없다(페이지 전환은 쓰지 않는다) */
  const rowAnim=()=>page.evaluate(()=>{const r=document.querySelector('#pipeline-stage-v3 .ps3-row');return r?getComputedStyle(r).animationName:'';});
  assert.equal(await rowAnim(),'none');
  await page.evaluate(()=>{goPage('today');goPage('pipe');PipelineWorkspace.open('consulting');});await page.waitForSelector('#pipeline-stage-v3 .ps3-row');
  assert.deepEqual(await page.evaluate(()=>[[...document.documentElement.classList].filter(c=>/^nf-/.test(c)).sort().join(' '),getComputedStyle(document.querySelector('.apage.on')).animationName]),['nf-motion','none']);
  /* 탭을 바꾸면: 줄이 아래에서 4px 올라오며 0.18초 동안 나타난다 — 잠깐 붙었다 떨어진다 */
  const tabs=page.locator('#pipeline-stage-v3 [role="tab"],#pipeline-stage-v3 [data-ps3="tab"]');assert.ok(await tabs.count()>=2,'탭이 있다');
  await tabs.nth(1).click();
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('nf-list')),true);
  await page.evaluate(()=>PipelineWorkspace.open('consulting'));
  await tabs.nth(0).click();await page.waitForSelector('#pipeline-stage-v3 .ps3-row');
  assert.deepEqual(await page.evaluate(()=>{const c=getComputedStyle(document.querySelector('#pipeline-stage-v3 .ps3-row'));return [c.animationName,c.animationDuration];}),['nfIn','0.18s']);
  await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('nf-list')),false);assert.equal(await rowAnim(),'none');
  /* 버튼 · 줄: 색이 부드럽게 바뀐다(0.12초) */
  assert.match(await page.evaluate(()=>getComputedStyle(document.querySelector('#pipeline-stage-v3 .ps3-row')).transitionDuration),/^0\.12s/);
  assert.match(await page.evaluate(()=>getComputedStyle(document.querySelector('#pipeline-stage-v3 .ps3-row button')).transitionProperty),/background-color/);
  /* 막대: 길이가 바뀌면 앞 길이에서 새 길이로(0.3초) */
  const bar=await page.evaluate(async()=>{const u=document.querySelector('#pipeline-stage-v3 i>u[style*="width"]');if(!u)return null;const before=u.style.width;Motion.bars();u.style.width=before==='40%'?'70%':'40%';Motion.bars();const a=u.getAnimations();return [a.length,a[0]&&a[0].effect.getTiming().duration];});
  if(bar)assert.deepEqual(bar,[1,300]);
  /* 처리한 줄이 목록에서 빠지면 그 자리에서 연초록 → 접힘(그림자 줄은 잠깐 있다가 사라진다) */
  const ghost=await page.evaluate(async()=>{const row=document.querySelector('#pipeline-stage-v3 .ps3-row[data-key]'),key=row.dataset.key,btn=document.createElement('button');btn.type='button';btn.textContent='기록 저장';btn.style.display='none';row.appendChild(btn);btn.click();btn.remove();
   B.deals=B.deals.filter(x=>!key.endsWith(String(x.id)));PipelineWorkspace.open('consulting');await new Promise(r=>setTimeout(r,80));
   const g=document.querySelector('.nf-ghost');const out=[!!g,g?getComputedStyle(g).position:'',!!document.querySelector('#pipeline-stage-v3 .ps3-row[data-key="'+key+'"]')];await new Promise(r=>setTimeout(r,700));out.push(document.querySelectorAll('.nf-ghost').length);return out;});
  assert.deepEqual(ghost,[true,'fixed',false,0]);
  /* 기기의 '동작 줄이기' · 끄기 스위치 → 전부 꺼진다 */
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>Motion.sync()),false);
  await tabs.nth(1).click();assert.deepEqual(await page.evaluate(()=>[document.documentElement.classList.contains('nf-list'),document.documentElement.classList.contains('nf-motion')]),[false,false]);
  await page.emulateMedia({reducedMotion:'no-preference'});assert.equal(await page.evaluate(()=>Motion.sync()),true);
  assert.equal(await page.evaluate(()=>{G.motionOff=true;return Motion.sync();}),false);
  /* 쓰지 않는 것: 숫자가 올라가는 효과 · 튕김 · 페이지 전환 · 모달 확대 */
  const css=fs.readFileSync(path.join(root,'motion.css'),'utf8'),js=fs.readFileSync(path.join(root,'motion.js'),'utf8');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g,''),/scale\(|bounce|cubic-bezier\([^)]*[2-9]\.\d|1\.\d+\)/);assert.doesNotMatch(js,/textContent\s*=|innerText\s*=|goPage/);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('motion ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
