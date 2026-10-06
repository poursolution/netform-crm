'use strict';
/* 기술자문 원본 자료 — 표시 위치 · 프로젝트 기본 정보 화면 (2026-10-06 표시 위치 결정 · docs/ADVISORY_PROJECT_DISPLAY_DECISION_20261006.md)
   합성 자료(현장 · 업체 · 번호는 지어낸 것 — 운영 자료 아님) + 가짜 조회 함수(33건 = 20 + 13 · 계약 문서 없는 프로젝트 10건 · 같은 현장명에 번호가 다른 프로젝트 2건).
   확인: 고객 자산 제목 줄의 진입 / 조회가 연결되기 전에는 계약 문서 칸만 / 연결 뒤 [프로젝트 기본 정보 | 계약 문서] 탭 / 한 쪽 20건 · 다음 쪽은 누를 때 받아 옴
        / 문서 없음 꼬리표(미체결 아님) · 같은 이름 다른 번호 · 빈 값은 미기록(0원 아님) / 조회 중 · 실패 · 권한 없음 · 결과 없음 / 계약 문서 탭은 그대로 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.AssetB&&window.StageBoard&&window.AssetV2&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const S=(n)=>'aaaaaaaa-0000-4000-8000-00000000000'+n;
   const deal=(id,site,sid,owner,code,extra)=>Object.assign({id,site,site_id:S(sid),assignee:owner,brand:'POUR솔루션',created:day(-200),updated:day(-200),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   B={deals:[
     deal('d1','예현마을현대홈타운아파트',1,'황윤선','consulting',{amt:37e7,created:day(-150),updated:day(-120)}),
     deal('d2','예현마을현대홈타운아파트',1,'황윤선','lost',{outcome:'lost',amt:4e8,closed_at:day(-300),lost_reason:'가격 열세',created:day(-400),updated:day(-300)}),
     deal('d3','예현마을현대홈타운아파트',1,'황윤선','lost',{outcome:'lost',amt:35e7,closed_at:day(-250),created:day(-350),updated:day(-250)}),
     deal('d4','시범현대아파트',2,'이필선','consulting',{amt:2e7,created:day(-20),updated:day(-9),next_action:{id:'n1',text:'견적 확인 전화',due:day(3),status:'open'},activities:[{id:'a1',type:'전화',note:'소장 통화 — 견적 검토 중',at:at(-9)}]}),
     deal('d5','시범현대아파트',2,'이필선','won',{outcome:'won',won_amount:4e6,closed_at:day(-100),completion_date:day(-100),created:day(-160),updated:day(-100)}),
     deal('d6','오산 원동 e편한세상',3,'한준엽','lost',{outcome:'lost',amt:14e7,closed_at:day(-412),created:day(-500),updated:day(-412),brand:'석민이앤씨'}),
     deal('d7','수주 뒤 조용한 단지',4,'김성민','won',{outcome:'won',won_amount:3e7,closed_at:day(-80),completion_date:day(-80),created:day(-200),updated:day(-80),manager_name:'박소장',manager_mobile:'01011112222'})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;G.siteStatus='전체';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   goPage('sites');
  });

  await page.waitForTimeout(400);
  const one=s=>String(s||'').replace(/\s+/g,' ').trim();
  const pgS=page.locator('#pg-sites'),lib=pgS.locator('.advisory-library');
  /* ① 진입: 고객 자산 제목 줄 [기술자문 원본 자료 ▾] — 누르기 전에는 칸이 가려져 있다 */
  assert.equal(await page.evaluate(()=>!!(window.AssetC&&AssetC.enabled&&AssetC.enabled())||!!document.querySelector('#pg-sites .ac-title')),true,'지금 화면 = 고객 자산 목록 v2');
  const entry=pgS.locator('.ac-title [data-ac="advisory"]');
  assert.deepEqual([one(await entry.innerText()),await entry.getAttribute('aria-expanded'),await lib.evaluate(n=>getComputedStyle(n).display)],['기술자문 원본 자료 ▾','false','none']);
  await entry.click();await page.waitForTimeout(150);
  assert.deepEqual([one(await pgS.locator('.ac-title [data-ac="advisory"]').innerText()),await lib.evaluate(n=>getComputedStyle(n).display!=='none'),await lib.locator('h3').innerText()],['기술자문 원본 자료 ▴',true,'기술자문 원본 자료']);
  /* ② 운영 초기화로 기존 SB 조회 어댑터가 연결되어 탭이 생긴다. 외부 요청은 이 합성 검사에서 차단한다. */
  assert.deepEqual([await lib.locator('.adv-tabs').count(),await lib.locator('.adv-docs button.dact').first().innerText(),await page.evaluate(()=>TechnicalAdvisoryUI.libraryLabel())],[1,'계약 조회','기술자문 원본 자료']);
  assert.equal(await page.evaluate(()=>TechnicalAdvisoryUI.projects._state.loader===TechnicalAdvisoryUI.projects.read),true);
  /* ③ 연결(가짜 조회 함수): 33건 = 20 + 13 */
  await page.evaluate(()=>{
   const mk=n=>({source_project_id:'P-'+String(1000+n),revision:'r1',received_at:'2026-10-06T01:02:03Z',site_name:n===4||n===5?'[경기 수원] 같은이름아파트':'[합성] 현장 '+n,work_name:'옥상 방수 '+n,company_name:n%3?'합성건설':'',current_source_manager:'담당 '+(n%4),source_project_status:n%2?'진행':'계약',source_contract_document_type:n<=10?null:'용역계약서',source_printed_contract_date:n<=10?null:'2026-08-0'+(n%9+1),source_consulting_contract_amount:n===1?null:n===2?0:n*1100000,has_contract_document:n>10,operations:n===3?null:{schema_version:1,source_status:'시공',completed:n%5===0,progress_rate:n*2,start_date:'2026-09-01',completion_date:n%5===0?'2026-09-30':null}});
   const ALL=Array.from({length:33},(_,k)=>mk(k+1));
   window.ADV={calls:[],mode:'ok',ALL};
   window.advLoader=async({after})=>{ADV.calls.push(after);await new Promise(r=>setTimeout(r,30));if(ADV.mode==='denied')throw Object.assign(new Error('forbidden'),{code:'42501'});if(ADV.mode==='fail')throw new Error('READ_FAILED');if(ADV.mode==='empty')return {items:[],next_cursor:null};
    const from=after?ALL.findIndex(p=>p.source_project_id===after)+1:0,items=ALL.slice(from,from+20);return {items,next_cursor:from+20<ALL.length?items[items.length-1].source_project_id:null};};
   ADV.rpc=[];
   window.SB={rpc:async(name,args)=>{ADV.rpc.push({name,args});try{return {data:{ok:true,...await advLoader({after:args.p_after})}};}catch(error){return {error};}}};
   TechnicalAdvisoryUI.projects.connect(TechnicalAdvisoryUI.projects.read);
  });
  await page.waitForSelector('#pg-sites .advisory-library .adv-proj-row');
  assert.deepEqual(await page.evaluate(()=>ADV.rpc),[{name:'crm_advisory_project_read_v1',args:{p_after:null,p_deal_id:null}}],'실제 조회 어댑터는 기존 SB RPC로 한 쪽만 요청한다');
  assert.deepEqual(await lib.locator('.adv-tabs [role="tab"]').evaluateAll(l=>l.map(b=>[b.textContent,b.getAttribute('aria-selected')])),[['프로젝트 기본 정보','true'],['계약 문서','false']]);
  assert.deepEqual([await lib.locator('.adv-proj-row').count(),one(await lib.locator('.adv-count').innerText()),await page.evaluate(()=>ADV.calls.length+':'+ADV.calls[0])],[20,'받아 온 프로젝트 20건 · 다음 쪽이 더 있습니다 · 줄을 누르면 기본 정보가 열립니다','1:null']);
  assert.deepEqual((await lib.locator('.lpg .lpg-b').allInnerTexts()).map(one),['‹','1','2','›'],'다음 묶음이 있으면 그다음 쪽 번호까지만');assert.equal(await lib.locator('.lpg .lpg-info').count(),0,'전체 건수는 알 수 없으므로 적지 않는다');
  /* 줄: 문서 꼬리표 · 같은 현장명은 원본 번호로 가름 */
  assert.deepEqual(await lib.locator('.adv-proj-row').nth(0).evaluate(r=>[r.querySelector('.s b').textContent,r.querySelector('.s small').textContent,[...r.querySelectorAll('.adv-chip')].map(c=>c.textContent).join('|'),!!r.querySelector('.id')]),['[합성] 현장 1','옥상 방수 1 · 합성건설','진행|계약 문서 없음',false]);
  assert.deepEqual(await lib.locator('.adv-proj-row').nth(10).evaluate(r=>[...r.querySelectorAll('.adv-chip')].map(c=>c.textContent).join('|')),'진행|계약 문서 있음');
  assert.deepEqual(await lib.locator('.adv-proj-row .id').allInnerTexts(),['원본 P-1004','원본 P-1005'],'같은 현장명 · 다른 번호 = 다른 프로젝트');
  assert.match(await lib.locator('.adv-proj-row .adv-chip.x').first().getAttribute('title'),/미체결 확정이 아닙니다/);
  /* ④ 기본 정보: 빈 값은 미기록 — 0원 · 미진행으로 추정하지 않는다 */
  await lib.locator('.adv-proj-row').nth(0).click();await page.waitForTimeout(80);
  const D=async()=>Object.fromEntries(await lib.locator('.adv-proj-detail dl').evaluate(dl=>{const k=[...dl.querySelectorAll('dt')].map(n=>n.textContent),v=[...dl.querySelectorAll('dd')].map(n=>n.textContent);return k.map((x,i)=>[x,v[i]]);}));
  let d1=await D();
  assert.deepEqual([d1['원본 프로젝트 번호'],d1['기술자문 계약금액(원본)'],d1['원본 계약 문서 유형'],d1['원본 문서 표시일'],d1['준공 확인(원본)'],d1['공정률(원본)'],d1['CRM 수신']],['P-1001','미기록','미기록','미기록','준공 확인 전','2%','2026-10-06 01:02']);
  assert.match(one(await lib.locator('.adv-proj-detail .adv-note').innerText()),/^원본 기본 정보 실적 합산 안 함 기술자문 플랫폼에서 받은 정보입니다\. 기술자문 계약금액은 아파트 공사 계약실적이 아니고, 문서 표시일은 계약 체결일 확정값이 아닙니다\.$/);
  assert.equal(one(await lib.locator('.adv-nodoc').innerText()),'연결된 계약 문서가 없습니다 — 미체결 확정이 아닙니다. 문서가 연결되면 [계약 문서] 탭에 나타납니다.');
  await lib.locator('.adv-proj-row').nth(1).click();d1=await D();assert.equal(d1['기술자문 계약금액(원본)'],'0원','원본이 0 이라고 준 값은 0 그대로');
  await lib.locator('.adv-proj-row').nth(2).click();d1=await D();assert.deepEqual([d1['원본 진행 상태'],d1['공정률(원본)'],d1['준공 확인(원본)']],['미기록','미기록','미기록'],'진행 정보가 없으면 미기록');
  await lib.locator('.adv-proj-row').nth(14).click();d1=await D();assert.deepEqual([d1['기술자문 계약금액(원본)'],d1['준공 확인(원본)'],d1['준공일(원본 기재)'],await lib.locator('.adv-nodoc').count()],['1,650만원','준공 확인됨','2026-09-30',0]);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'advisory-projects.png'),fullPage:true});
  /* ⑤ 다음 쪽: 누를 때 받아 온다(커서) → 13건 · 전체 2쪽이 확정 */
  await lib.locator('.lpg .lpg-b',{hasText:/^2$/}).click();await page.waitForFunction(()=>ADV.calls.length===2&&!TechnicalAdvisoryUI.projects._state.busy);await page.waitForTimeout(60);
  assert.deepEqual([await page.evaluate(()=>ADV.calls[1]),await lib.locator('.adv-proj-row').count(),one(await lib.locator('.adv-count').innerText()),(await lib.locator('.lpg .lpg-b').allInnerTexts()).map(one).join(' ')],['P-1020',13,'받아 온 프로젝트 33건 · 줄을 누르면 기본 정보가 열립니다','‹ 1 2 ›']);
  await lib.locator('.lpg .lpg-b',{hasText:/^1$/}).click();await page.waitForTimeout(60);assert.deepEqual([await lib.locator('.adv-proj-row').count(),await page.evaluate(()=>ADV.calls.length)],[20,2],'이미 받은 쪽은 다시 조회하지 않는다');
  /* ⑥ 예외 상태: 권한 없음 · 실패(다시 조회) · 결과 없음 — 서로 다른 문장 */
  const stateOf=async mode=>{await page.evaluate(m=>{ADV.mode=m;return TechnicalAdvisoryUI.projects.reload();},mode);await page.waitForTimeout(80);return one(await lib.locator('.adv-proj-view').innerText());};
  assert.equal(await stateOf('denied'),'이 계정에는 기술자문 프로젝트 조회 권한이 없습니다.');
  assert.equal(await stateOf('fail'),'프로젝트 기본 정보를 조회하지 못했습니다. 다시 시도해 주세요. 다시 조회');
  assert.equal(await stateOf('empty'),'조회 권한이 있는 기술자문 프로젝트가 없습니다.');
  await page.evaluate(()=>{ADV.mode='fail';return TechnicalAdvisoryUI.projects.reload();});await page.waitForTimeout(60);await page.evaluate(()=>{ADV.mode='ok';});
  await lib.locator('[data-advproj="retry"]').click();await page.waitForSelector('#pg-sites .advisory-library .adv-proj-row');assert.equal(await lib.locator('.adv-proj-row').count(),20,'다시 조회로 돌아온다');
  /* ⑦ 계약 문서 탭 = 기존 칸 그대로 */
  await lib.locator('[data-advtab="docs"]').click();await page.waitForTimeout(60);
  assert.deepEqual([await lib.locator('.adv-proj').evaluate(n=>n.hidden),await lib.locator('.adv-docs').evaluate(n=>n.hidden),await lib.locator('.adv-docs button.dact').first().innerText(),one(await lib.locator('.adv-docs>p').first().innerText())],[true,false,'계약 조회','영업건 등록 여부와 관계없이 조회 권한이 있는 원본 계약을 확인합니다.']);
  await lib.locator('[data-advtab="proj"]').click();await page.waitForTimeout(60);assert.equal(await lib.locator('.adv-proj-row').count(),20);
  /* 문서 유무 없는 실제 RPC 명세: 유형이 있어도 꼬리표를 추정하지 않는다. 다음 쪽 실패는 받은 자료를 보존한다. */
  await page.evaluate(()=>{ADV.ALL.forEach(p=>delete p.has_contract_document);return TechnicalAdvisoryUI.projects.reload();});
  assert.equal(await lib.locator('.adv-proj-row .adv-chip.x').count(),0);
  assert.equal(await lib.getByText('계약 문서 있음',{exact:true}).count(),0);
  await page.evaluate(()=>{ADV.mode='fail';});await lib.locator('[data-advproj="page"][data-page="2"]').first().click();
  await page.waitForFunction(()=>TechnicalAdvisoryUI.projects._state.state==='failed');
  assert.equal(await lib.locator('.adv-proj-row').count(),20);assert.match(await lib.locator('.adv-proj-view').innerText(),/다음 쪽을 불러오지 못했습니다/);
  await page.evaluate(()=>{ADV.mode='ok';});await lib.locator('[data-advproj="page"][data-page="2"]').first().click();
  await page.waitForFunction(()=>TechnicalAdvisoryUI.projects._state.page===2&&!TechnicalAdvisoryUI.projects._state.busy);
  assert.equal(await lib.locator('.adv-proj-row').count(),13);
  await lib.locator('[data-advtab="docs"]').click();await lib.locator('[data-advtab="proj"]').click();
  assert.equal(await lib.locator('.adv-proj-row').count(),20,'탭 이동 후 첫 쪽');
  /* ⑧ 진입 버튼을 다시 누르면 칸이 닫힌다 · 자료는 바뀌지 않는다(조회만) */
  await pgS.locator('.ac-title [data-ac="advisory"]').click();await page.waitForTimeout(100);
  assert.deepEqual([await lib.evaluate(n=>getComputedStyle(n).display),await page.evaluate(()=>B.deals.length)],['none',7]);
  await page.evaluate(()=>window.dispatchEvent(new Event('phase1:identity-cleared')));
  assert.equal(await lib.locator('.adv-proj-row').count(),0,'계정 변경 시 이전 자료 제거');
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('advisory projects ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
