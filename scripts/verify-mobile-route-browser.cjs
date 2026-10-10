'use strict';
/* 모바일 오늘 동선 (2026-10-10 대표 승인 · mobile_all) — 합성 자료. 현장 좌표 서버 함수(crm_site_geo_list_v1)와 카카오 지도는 가짜.
   확인: [목록 | 오늘 동선] 전환 / 오늘 방문 일정만 · 가까운 곳부터 순서 · 직선거리 기준 이동 시간 / 내 위치(눌렀을 때만) / 좌표 없는 현장 따로 / 근처 관계관리 현장 추천만
         / 지도 핀 번호 · 순서선 / 좌표 · 지도가 안 되면 목록만 + 이유 / 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,'')||'mobile.html',t=path.resolve(root,rel);if(!t.startsWith(root+path.sep)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',t.endsWith('.html')?'text/html; charset=utf-8':t.endsWith('.css')?'text/css':'application/javascript; charset=utf-8');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/mobile.html?demo=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.MobileRoute&&typeof render==='function'&&window.OperationalUI);
  assert.ok(fs.readFileSync(path.join(root,'transport.js'),'utf8').includes("'crm_site_geo_list_v1'"),'좌표 읽기 함수가 모바일 허용 목록에 있다');
  const setup=o=>page.evaluate(o=>{
   const kst=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));window.__kst=kst;
   G.user=REPS.find(r=>r.role==='dual')||REPS[0];G.mode='rep';DEMO=true;window.toast=()=>{};const me=G.user.nm;
   const mk=(id,nm,site,due,text,type,code)=>({id,nm,code:code||'consulting',sub:'방수',rep:me,amt:1e8,site_id:site,activities:[],tl:[],manager_name:'소장',manager_mobile:'01011112222',nextAction:due==null?null:{id:'a-'+id,type:type||'방문',text:text||'현장 방문',due:kst(due),due_at:kst(due),status:'open'}});
   DEALS=[mk('A','[수원] 방문 A','s1',0,'옥상 실측'),mk('B','[수원] 방문 B','s2',0,'현설 참석'),mk('C','[수원] 좌표 없는 현장','s3',0,'상담'),mk('F','[수원] 내일 방문','s1',1,'방문'),mk('T','[수원] 전화 일정','s1',0,'전화 확인','전화'),
          mk('D','[수원] 관계관리 근처','s4',9,'안부 연락','전화','rapport'),mk('E','[부산] 관계관리 먼 곳','s5',9,'안부 연락','전화','rapport')];
   G._today=[];G.done={};G.deal=null;G.sub=null;G.tab='today';window.__rpc=[];
   const real=window.__realPhase1||(window.__realPhase1=window.Phase1);
   window.Phase1=Object.assign({},real,{profile:Object.assign({},real.profile||{},{name:'테스트',allowed_modes:['rep']}),rpc:async(name,args)=>{__rpc.push([name,args]);if(o.fail)throw Error('연결 실패');
    return {kakao_js_key:o.key===false?'':'testkey',sites:[['s1',37.2636,127.0286,'address','주소1','A'],['s2',37.2750,127.0100,'address','주소2','B'],['s3',null,null,'none','','C'],['s4',37.2700,127.0300,'address','주소4','D'],['s5',35.1796,129.0756,'address','주소5','E']]};}});
   MobileRoute._set('st','idle');MobileRoute._set('sdk','none');MobileRoute._set('me',null);MobileRoute._set('meErr','');MobileRoute._set('view','list');MobileRoute._set('key','');
   window.kakao=o.map===false?undefined:{maps:{load:cb=>cb(),Map:class{constructor(){window.__map=(window.__map||0)+1;}setBounds(){}},LatLng:class{constructor(a,b){this.a=a;this.b=b;}},LatLngBounds:class{extend(){}},Polyline:class{constructor(){window.__poly=(window.__poly||0)+1;}},CustomOverlay:class{constructor(o){window.__ov=(window.__ov||[]).concat([o.content.replace(/<[^>]*>/g,'')]);}}}};
   window.__map=0;window.__poly=0;window.__ov=[];render();},o);
  await setup({});
  const S=page.locator('#scr'),tab=l=>S.locator('.mr-tabs button',{hasText:l}).click().then(()=>page.waitForTimeout(500));
  /* ① 전환 줄 */
  assert.deepEqual(await S.locator('.mr-tabs button').allInnerTexts(),['목록','오늘 동선']);assert.equal(await S.locator('.mr').count(),0,'기본은 목록');
  await tab('오늘 동선');
  /* ② 오늘 방문 일정만(내일 · 전화 제외) · 가까운 곳 순서 · 좌표 없는 현장 따로 */
  assert.match(await S.locator('.mr .sec-h').innerText().then(one),/^오늘 동선 2곳 이동 약 \d+분 · 직선거리 [\d.]+km 기준$/);
  assert.deepEqual(await S.locator('.mr-list li b').allInnerTexts(),['[수원] 방문 A','[수원] 방문 B'],'첫 곳에서 가까운 순서');
  assert.match(await S.locator('.mr-list li em').first().innerText(),/^출발$/);assert.match(await S.locator('.mr-list li em').nth(1).innerText(),/^\+\d+분 · [\d.]+km$/);
  assert.deepEqual(await S.locator('.mr-miss button').allInnerTexts(),['[수원] 좌표 없는 현장'],'위치를 못 찾은 현장은 따로');
  assert.deepEqual(await S.locator('.mr-near button span').allInnerTexts(),['[수원] 관계관리 근처'],'근처 5km 안 관계관리 현장만(먼 곳 제외) · 추천만');
  assert.equal(await page.evaluate(()=>DEALS.find(d=>d.id==='D').nextAction.due===__kst(9)),true,'추천이 일정을 만들거나 바꾸지 않는다');
  /* ③ 지도: 번호 핀 2개 + 순서선 */
  assert.equal(await page.evaluate(()=>[__map,__poly,__ov.join(',')].join('|')),'1|1|1,2');
  assert.deepEqual(await page.evaluate(()=>__rpc.map(r=>r[0]).filter(n=>/geo/.test(n))),['crm_site_geo_list_v1'],'좌표는 한 번만 읽는다');
  /* ④ 내 위치(눌렀을 때만): B 쪽에서 시작하면 B 가 먼저 */
  assert.equal(await page.evaluate(()=>window.__geo||0),0,'위치는 자동으로 묻지 않는다');
  await page.evaluate(()=>{window.__geo=0;navigator.geolocation.getCurrentPosition=(ok)=>{window.__geo++;ok({coords:{latitude:37.2751,longitude:127.0101}});};});
  await S.locator('.mr-loc').click();await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>__geo),1);assert.deepEqual(await S.locator('.mr-list li b').allInnerTexts(),['[수원] 방문 B','[수원] 방문 A'],'내 위치에서 가까운 곳부터');
  assert.match(await S.locator('.mr-list li em').first().innerText(),/^\+\d+분 · \d+m$/);assert.match(await S.locator('.mr-bar span').innerText(),/^내 위치에서 가까운 곳부터$/);
  assert.equal(await page.evaluate(()=>__ov.slice(-3).join(',')),'1,2,','번호 핀 1 · 2 + 내 위치 표시(글자 없음)');
  /* ⑤ 줄 = 그 현장 상세 */
  await S.locator('.mr-list li button').first().click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>G.deal),'B');
  /* ⑥ 좌표 저장소 실패 → 순서 목록만 + 이유 */
  await setup({fail:true});await page.evaluate(()=>{});await tab('오늘 동선');await page.waitForTimeout(300);
  assert.match(await S.locator('.mr-note').innerText().then(one),/현장 좌표를 불러오지 못해 지도를 표시하지 않습니다/);assert.equal(await S.locator('#mr-map').count(),0);
  /* ⑦ 지도 키 없음 · 지도 SDK 오류 */
  await setup({key:false});await tab('오늘 동선');await page.waitForTimeout(300);assert.match(await S.locator('.mr-note').innerText().then(one),/지도 키가 등록되지 않아 순서 목록만 보여 드립니다/);assert.equal(await S.locator('.mr-list li').count(),2,'순서 목록은 그대로');
  /* ⑧ 오늘 방문이 없으면 */
  await setup({});await page.evaluate(()=>{DEALS.forEach(d=>{if(d.nextAction&&/방문/.test(d.nextAction.type))d.nextAction.due=__kst(3),d.nextAction.due_at=__kst(3);});render();});await tab('오늘 동선');
  assert.match(await S.locator('.mr-none').innerText().then(one),/^오늘 방문 일정이 없습니다/);
  /* ⑨ 끄기 */
  await setup({});await page.evaluate(()=>{G.mobileRouteOff=true;render();});await page.waitForTimeout(250);assert.equal(await S.locator('.mr-tabs').count(),0);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('verify-mobile-route: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
