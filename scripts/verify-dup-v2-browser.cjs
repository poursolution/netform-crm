'use strict';
/* 데이터 정리 · 검토 v2 검사(2026-10-02 핸드오프 dup): 안내 줄 알약 · 진단 · 판단 띠 · 묶음 표(확실 → 애매 → 다른 건) · 비교 창(760px · 다른 값 노란 칸).
   후보 계산 · 근거 · 처리 이력은 기존 그대로. 검토 전용일 때는 합치기 · 연결 버튼이 잠긴다. 한 번에 승인은 잠김. 쓰기 없음. 끄면 예전 화면 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DupV2&&window.DataCleanupUI&&window.CleanupCore&&typeof paint==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*3600e3).toISOString();
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(-90),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,site,extra)=>Object.assign({id:'0000000'+n+'-0000-4000-8000-00000000000'+n,site,status:'접수',brand:'POUR솔루션',assignee:'',at:at(-n),created_at:at(-n)},extra||{});
   B={deals:[
     deal('d1','강동 롯데캐슬퍼스트',{address:'서울 강동구 양재대로 1340',office_phone:'0212345678'}),deal('d2','강동롯데캐슬 퍼스트 아파트',{address:'서울 강동구 양재대로 1340',office_phone:'0212345678',assignee:'황윤선',created:day(-400)}),
     deal('d3','평택 비전지웰푸르지오 1단지',{address:'경기 평택시 비전동 1'}),deal('d4','평택 비전지웰푸르지오 2단지',{address:'경기 평택시 비전동 99'}),
     deal('d5','창동 동아그린아파트'),deal('d6','창동동아그린 아파트',{assignee:'황윤선'})],
    inquiries:[inq(1,'역북금강아파트',{address:'경기 용인시 역북동 5',office_phone:'0311112222',workItems:['재도장>외부'],primaryWork:'재도장>외부'}),inq(2,'역북금강아파트',{address:'경기 용인시 역북동 5',office_phone:'0311112222',workItems:['재도장>외부'],primaryWork:'재도장>외부'})],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   window.__rpc=[];SB={rpc:async(n,a)=>{__rpc.push(n);if(n==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:[]}};return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   /* This case explicitly models a DB without consultation RPCs; the production allowlist now includes them. */
   const has=CRMRelease.has;CRMRelease.has=n=>!['crm_inquiry_consultation_preview_v1','crm_inquiry_consultation_write_v1'].includes(n)&&has(n);
   goPage('dup');
  });
  await page.waitForTimeout(600);
  const v=page.locator('#dup-v2');assert.equal(await v.count(),1,'새 화면');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#dups>*:not(dialog)')].every(n=>getComputedStyle(n).display==='none')),true,'예전 목록은 감춤');
  const cases=await page.evaluate(()=>DataCleanupUI.active().map(c=>c.type+':'+c.action+':'+DupV2.judge(c)));
  assert.deepEqual(cases.slice().sort(),['inquiry:inquiry_merge:work','site:defer:maybe','site:separate:diff','site:site_merge:work'].sort(),JSON.stringify(cases));
  assert.deepEqual(await v.locator('.plv-pills button').allInnerTexts(),['전체 4','같은 공사 · 합치기 검토 2','같은 현장 · 다른 공사 0','애매 · 확인 필요 1','확인 불가 0','다른 건 1','처리 완료 0']);
  assert.deepEqual(await v.locator('.pd-kpi span').allInnerTexts(),['검토 후보','같은 공사','같은 현장 · 다른 공사','애매']);
  assert.match(await v.locator('.pd-kpis').innerText(),/검토 후보\s*4건[\s\S]*같은 공사\s*2건[\s\S]*같은 현장 · 다른 공사\s*0건[\s\S]*애매\s*1건/);
  assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),['무엇이 겹치나','왜 생기나','생기는 곳']);
  assert.match(await v.locator('.pd-card').nth(0).innerText(),/현장\s*3[\s\S]*문의\s*1/);assert.match(await v.locator('.pd-card').nth(1).innerText(),/1일 내 재접수\s*1/);
  assert.match(await v.locator('.pd-action').innerText(),/다시 안 생기게[\s\S]*같은 전화 · 1일 내 재접수 1건[\s\S]*애매한 건은 주 1회 10분 검토/);assert.equal(await v.locator('.pd-toggle').count(),0);
  assert.match(await v.locator('.dv-band').innerText(),/4건 중 2건은 같은 공사로 보여요 · 같은 현장 · 다른 공사 0건 · 사람이 볼 건 1건입니다[\s\S]*승인하기 전에는 데이터가 바뀌지 않습니다[\s\S]*검토 전용/);
  assert.equal(await v.locator('.dv-band button').isDisabled(),true,'한 번에 승인은 구조 확인 뒤(잠김)');
  assert.equal(await page.evaluate(()=>['periodbar','reptabs'].every(id=>getComputedStyle(document.getElementById(id)).display==='none')),true,'예전 조회기간 · 담당자 줄 감춤');
  assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),['대상 (A ↔ B) · 종류','판단','근거','제안','']);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['같은 공사 · 합치기 검토','같은 현장 · 다른 공사','애매 · 확인 필요','확인 불가','다른 건']);
  assert.deepEqual(await v.locator('.plv-ghead span').allInnerTexts(),['2건','0건','1건','0건','1건'],'묶음 건수 = 알약 건수(실제 건수)');
  assert.deepEqual(await v.locator('.plv-row .plv-cta').allInnerTexts(),['승인','승인','비교하기','확인']);
  assert.equal(await page.evaluate(()=>/%/.test(document.querySelector('#dup-v2 .plv-table').innerText)),false,'확률(%)을 지어내지 않는다');
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 비교 창 */
  await v.locator('.plv-row',{hasText:'강동 롯데캐슬퍼스트'}).locator('.plv-cta').click();await page.waitForTimeout(200);
  const d=page.locator('#dupDialog.on .dv-box');assert.equal(await d.count(),1);assert.equal(await page.evaluate(()=>Math.round(document.querySelector('.dv-box').getBoundingClientRect().width)),760);
  assert.match(await d.locator('.dv-judge.g').innerText(),/판단 · 같은 공사 · 합치기 검토[\s\S]*근거: 주소 동일 · 관리사무소 전화 동일[\s\S]*제안: 합치기[\s\S]*확률은 표시하지 않습니다/);
  assert.deepEqual(await d.locator('.dv-cmp>div:not(.dv-ch) span').allInnerTexts(),['종류','이름','주소','관리사무소 전화','담당','사업유형','단계','금액','등록','접수 시각','연락처 끝자리']);
  assert.deepEqual(await d.locator('.dv-cmp>div.diff span').allInnerTexts(),['이름','담당','등록','접수 시각'],'서로 다른 값만 노란 칸');
  assert.equal(await d.locator('.dv-cmp>div.diff em').first().evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 248, 225)');
  assert.match(await d.locator('.dv-note').innerText(),/대표 기록은 '먼저 등록'으로 자동 정하지 않습니다[\s\S]*어떤 원본도 지우지 않습니다[\s\S]*검토 전용이라 아래 버튼이 잠겨 있습니다/);
  assert.deepEqual(await d.locator('.dv-foot button').allInnerTexts(),['다른 건 · 그대로 두기','현장만 묶기','합치기 실행']);assert.equal(await d.locator('.dv-foot button:disabled').count(),3,'검토 전용 = 잠김');
  if(shot)await page.screenshot({path:shot+'-compare.png'});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#dupDialog.on').count(),0);
  /* 서버 처리 경로가 켜진 상태: 버튼 → 기존 «미리보기 → 확인 → 처리» 창(고른 처리 방식으로) + 처리 이력 */
  await page.evaluate(async()=>{window.CRM_CLEANUP_WRITE=true;TOKEN='t';SB.rpc=async(n)=>{__rpc.push(n);if(n==='crm_cleanup_state')return {data:{ok:true,reviews:[{pair_key:'x',action:'site_link',actor:'송보람',source_name:'옛 현장',target_name:'새 현장',note:'같은 단지 확인',created_at:'2026-09-30T01:00:00Z'}],links:[],sites:[],moves:[]}};if(n==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:[]}};return {error:{message:'not in test'}};};await DataCleanupUI.refresh();});await page.waitForTimeout(400);
  assert.equal((await v.locator('.plv-pills button').allInnerTexts())[6],'처리 완료 1');
  await v.locator('.plv-row',{hasText:'역북금강아파트'}).locator('.plv-cta').click();await page.waitForTimeout(200);
  /* 문의끼리: 예전 [연결만] 자리는 상담 연결 버튼(inquiry-consultation-link.js) — 서버 함수가 허용 목록에 없으면 잠긴 채 보인다 */
  assert.equal(await d.locator('.dv-foot button:disabled:not([data-icl])').count(),0);assert.deepEqual(await d.locator('.dv-foot [data-icl]').evaluateAll(l=>l.map(b=>[b.textContent.trim(),b.disabled,b.title])),[['같은 상담으로 연결',true,'서버 적용 뒤에 열립니다']]);assert.equal(await d.locator('[data-dd="inquiry_activity"]').count(),0,'옛 연결만 경로 없음');
  await d.locator('.dv-foot [data-dd="inquiry_merge"]').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#dupDialog.on').count(),0);assert.equal(await page.locator('#cleanup-dialog').count(),1,'기존 처리 창');assert.equal(await page.locator('#cleanup-action').inputValue(),'inquiry_merge','고른 처리 방식으로 열림');
  assert.equal(await page.locator('#cleanup-save').isDisabled(),true,'미리보기 전에는 처리할 수 없음');
  await page.evaluate(()=>DataCleanupUI.close());await page.waitForTimeout(200);
  await page.locator('#dup-v2 .plv-pills [data-value="done"]').click();await page.waitForTimeout(200);
  assert.match(await page.locator('#dup-v2 .dv-hist').innerText(),/옛 현장 → 새 현장[\s\S]*연결만 · 송보람 · 2026-09-30[\s\S]*같은 단지 확인/);
  await page.locator('#dup-v2 .plv-pills [data-value="maybe"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('#dup-v2 .plv-row').count(),1);
  assert.deepEqual(await page.evaluate(()=>__writes),[],'이 화면은 직접 저장하지 않는다');assert.equal(await page.evaluate(()=>__rpc.filter(n=>n==='crm_cleanup_apply').length),0);
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.dupV2Off=true;paint();});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.getElementById('dup-v2').hidden&&document.querySelector('#dups .cleanup-head')!==null&&getComputedStyle(document.querySelector('#dups .cleanup-head')).display!=='none'),true,'끄면 예전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',pills_counts_match:true,diagnosis:true,rule_bands_no_percent:true,bulk_approve_locked:true,compare_dialog_diff_cells:true,readonly_locked:true,write_goes_through_existing_preview:true,history:true,no_writes:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
