'use strict';
/* 견적문의 흐름 v5 — 화살표 띠 4칸 + 확인 필요 칩 + 보드 4칸 (2026-10-13 design_handoff_inquiry_flow_v5 · 시안 '견적문의 흐름 v5.dc.html')
   합성 자료 8건(이름 · 현장은 지어낸 것): 접수 2(배정 지연 1) · 담당 배정 1(첫 연락 지연) · 접촉 · 상담 3(후속 지연 · 대표회의 D-2 · 정보 부족) · 방문 · 견적 2(방문 예정 · 견적 발송 예정).
   확인: 단계는 기록에서 계산 / 띠 4칸의 합 = 진행 중 전체 = 브랜드 '전체' / 확인 필요 칩 건수 · 누르면 해당 카드만 진하게(단계 자리 유지) / 띠를 누르면 그 단계만
        / 카드 = 브랜드 · 현장 · 근거 · 다음 · 기한(늦으면 빨강) · 꼬리표 · 글 넘침 없음 / 칸마다 8건 + 외 n건 + 쪽 번호 / 카드 클릭 = 기존 상세 창 · 진행 막대 4칸 근거
        / 견적 발송 완료 저장 → 그 자리에서 기존 전환 경로 호출(방문 완료는 넘기지 않음) / 끄면 v4 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(require('../review-preview/review-environment.cjs').launchOptions());
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-09T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryListV3&&window.InquiryDetailV2&&window.InquiryWorkbench&&window.InquiryV5);
  await page.evaluate(()=>{
   const at=(d,h)=>new Date(Date.now()-d*864e5-(h||0)*36e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
   const rep={assignee:'이필선',assigned_to:'이필선'};
   B={deals:[],inquiries:[
    {id:id(1),site:'[서울 성북] 길음뉴타운9단지',status:'접수',at:at(0,3),created_at:at(0,3),brand:'POUR솔루션',phone:'010-2281-4402',contact_name:'정미경',raw:{'문의내용':'옥상 방수 견적 요청드립니다.','상담채널':'홈페이지'}},
    {id:id(2),site:'[부산] 동부산훼미리타운4차',status:'접수',at:at(0,0.1),created_at:at(0,0.1),brand:'석민이앤씨',phone:'051-700-1100',contact_name:'박소장',raw:{'문의내용':'지하주차장 에폭시 문의.','상담채널':'전화'}},
    {id:id(3),site:'[경기 김포] 한강반도유보라',status:'배정완료',at:at(1),created_at:at(1),brand:'석민이앤씨',phone:'031-987-1150',contact_name:'이준호',...rep,assigned_at:at(0.9),raw:{'문의내용':'지하주차장 바닥 에폭시 들뜸 보수 문의.','상담채널':'전화'}},
    {id:id(4),site:'[경남] 혁신LH5단지',status:'배정완료',at:at(40),created_at:at(40),brand:'석민이앤씨',phone:'055-757-7977',contact_name:'관리소장',...rep,assigned_at:at(39),responded_at:at(30),raw:{'문의내용':'외벽 재도장 현장 확인 요청','상담채널':'전화'},activities:[{type:'전화',note:'첫 연락 — 현장 확인 요청',at:at(30),actor:'이필선'}]},
    {id:id(5),site:'[경기 수원] 매탄임광아파트',status:'배정완료',at:at(8),created_at:at(8),brand:'POUR공법',phone:'031-214-7710',contact_name:'관리소장',...rep,assigned_at:at(7.9),responded_at:at(5),raw:{'문의내용':'외벽 재도장 견적 · 대표회의 전 자료 필요','상담채널':'전화','대표회의':day(2),'공사유형':'외벽 재도장'},activities:[{type:'전화',note:'견적 범위 확인',at:at(5),actor:'이필선'}]},
    {id:id(6),site:'[서울 노원] 중계청구3차',status:'배정완료',at:at(2),created_at:at(2),brand:'아파트스퀘어',phone:'02-933-1180',contact_name:'홍성우',...rep,assigned_at:at(1.9),responded_at:at(1),raw:{'문의내용':'공법 설명 자료 요청','상담채널':'홈페이지'},activities:[{type:'전화',note:'자료 발송 안내',at:at(1),actor:'이필선'}]},
    {id:id(7),site:'[서울 은평] 녹번역e편한세상',status:'현장방문예정',at:at(4),created_at:at(4),brand:'POUR솔루션',phone:'02-300-1180',contact_name:'김소장',...rep,assigned_at:at(3.9),responded_at:at(3),raw:{'문의내용':'옥상 방수 견적','상담채널':'홈페이지'},activities:[{type:'전화',note:'방문 일정 협의',at:at(3),actor:'이필선'}]},
    {id:id(8),site:'[경기 광교] 광교한빛아파트',status:'견적서 발송예정',at:at(6),created_at:at(6),brand:'POUR솔루션',phone:'031-300-1180',contact_name:'최과장',...rep,assigned_at:at(5.9),responded_at:at(4),raw:{'문의내용':'옥상 방수 견적','상담채널':'전화'},activities:[{type:'전화',note:'견적 범위 확인',at:at(4),actor:'이필선'}]}],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';G.inqV3=null;G.inqV4=null;G.inqV5=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{window.__writes.push([op,p]);return 'req-'+window.__writes.length};
   SB={rpc:async()=>({error:{message:'CONTRACT_UNAVAILABLE'}})};
   window.Phase1={profile:{auth_uid:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'송보람'},rpc:async()=>{throw Error('CONTRACT_UNAVAILABLE');}};
   window.id=id;goPage('inq');
  });
  await page.waitForTimeout(500);
  const one=s=>String(s||'').replace(/\s+/g,' ').trim();
  const V=page.locator('#inq-v5'),nums=()=>V.locator('.i5-step .i5-n').evaluateAll(l=>l.map(b=>Number(b.textContent)));
  const chip=k=>V.locator('.i5-chip[data-v="'+k+'"]'),chipN=async k=>Number(await chip(k).locator('b').textContent());
  const col=i=>V.locator('.i5-col').nth(i),card=n=>V.locator('.i5-card',{hasText:n});
  /* ① v5 가 v4 자리를 대신하고, 위쪽(탭 · 브랜드 칩)은 그대로 */
  assert.equal(await V.count(),1);assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('inq-v4')).display),'none','v4 는 가려 둔다');
  assert.equal(await page.locator('#pg-inq .b2b-bar').count(),1,'위 탭 줄 그대로');
  /* ② 단계는 기록에서 계산 · 4칸의 합 = 진행 중 전체 = 브랜드 전체 */
  assert.deepEqual(await nums(),[2,1,3,2],'접수 2 · 담당 배정 1 · 접촉 · 상담 3 · 방문 · 견적 2');
  assert.deepEqual(await page.evaluate(()=>[InquiryV4.total(),InquiryListV2.brandStats()[0].n]),[8,8],'숫자는 하나');
  assert.deepEqual(await V.locator('.i5-step em').allInnerTexts(),['접수','담당 배정','접촉 · 상담','방문 · 견적']);
  assert.deepEqual((await V.locator('.i5-col header b').allInnerTexts()).map(one),['01 접수','02 담당 배정','03 접촉 · 상담','04 방문 · 견적']);
  assert.match(one(await col(3).locator('header small').innerText()),/^견적 발송되면 자동으로 파이프라인 · .+\(으\)로$/,'다음 조건 한 줄(만들어지는 단계 이름은 기존 전환 규칙에서 읽는다)');
  for(const [n,i] of [['길음뉴타운',0],['동부산훼미리',0],['한강반도',1],['혁신LH5',2],['매탄임광',2],['중계청구',2],['녹번역',3],['광교한빛',3]])assert.equal(await col(i).locator('.i5-card',{hasText:n}).count(),1,n+' → '+i+'번째 칸');
  /* ③ 확인 필요 칩 */
  assert.deepEqual([await chipN('asg'),await chipN('first'),await chipN('info'),await chipN('d3'),await chipN('follow')],[1,1,3,1,1],'미배정(배정 지연) 1 · 첫 연락 지연 1 · 정보 부족 3 · 대표회의 D-3 1 · 후속 지연 1');
  assert.deepEqual((await V.locator('.i5-chip').allInnerTexts()).map(t=>one(t).replace(/\s*\d+$/,'')),['미배정','첫 연락 지연','정보 부족','대표회의 D-3','후속 지연']);
  /* ④ 카드: 근거 · 다음 · 기한 · 꼬리표 */
  const u=card('길음뉴타운');assert.equal(one(await u.locator('.i5-tag').innerText()),'배정 지연');assert.match(one(await u.locator('.i5-due').innerText()),/^접수 후 .+ · 기준 30분$/);assert.match(await u.locator('.i5-due').getAttribute('class'),/late/);
  assert.equal(await card('동부산훼미리').locator('.i5-tag').count(),0,'기준 안의 미배정은 꼬리표 없음');assert.doesNotMatch(await card('동부산훼미리').locator('.i5-due').getAttribute('class'),/late/);
  assert.equal(one(await card('한강반도').locator('.i5-tag').innerText()),'첫 연락 지연');assert.match(one(await card('한강반도').locator('.i5-due').innerText()),/^배정 후 .+ · 기준 2시간$/);
  assert.match(one(await card('혁신LH5').locator('.i5-ev').innerText()),/^실제 연결 \d+\.\d+ · 정보 \d\/9$/);assert.equal(one(await card('혁신LH5').locator('.i5-due').innerText()),'30일째 연락 없음');assert.equal(one(await card('혁신LH5').locator('.i5-tag').innerText()),'후속 지연');
  assert.equal(one(await card('매탄임광').locator('.i5-tag').innerText()),'대표회의 D-3');assert.equal(one(await card('중계청구').locator('.i5-tag').innerText()),'정보 부족');
  assert.match(one(await card('녹번역').locator('.i5-ev').innerText()),/^방문 일정/);assert.match(one(await card('광교한빛').locator('.i5-ev').innerText()),/견적 예정/);
  assert.deepEqual(await V.locator('.i5-card').evaluateAll(l=>l.filter(c=>c.scrollWidth>c.clientWidth+1||[...c.children].some(x=>x.scrollWidth>x.clientWidth+1)).map(c=>c.textContent.slice(0,30))),[],'카드 글 넘침 없음');
  /* ⑤ 칩을 누르면 해당 카드만 진하게 · 단계 자리는 그대로 */
  await chip('follow').click();
  assert.match(await card('혁신LH5').getAttribute('class'),/hit/);assert.equal(await V.locator('.i5-card.hit').count(),1);assert.equal(await V.locator('.i5-card.dim').count(),7);
  assert.deepEqual(await nums(),[2,1,3,2],'칩은 단계 건수를 바꾸지 않는다');assert.equal(await V.locator('.i5-clear').count(),1);
  await V.locator('.i5-clear').click();assert.equal(await V.locator('.i5-card.dim, .i5-card.hit').count(),0);assert.equal(await V.locator('.i5-clear').count(),0);
  /* ⑥ 띠를 누르면 그 단계만(나머지 흐림) */
  await V.locator('.i5-step').nth(2).click();
  assert.deepEqual(await V.locator('.i5-col').evaluateAll(l=>l.map(c=>c.classList.contains('dim'))),[true,true,false,true]);assert.equal(await V.locator('.i5-step').nth(2).getAttribute('aria-pressed'),'true');
  await V.locator('.i5-step').nth(2).click();assert.equal(await V.locator('.i5-col.dim').count(),0);
  if(shot)await page.screenshot({path:shot,fullPage:true});
  /* ⑦ 카드 클릭 = 기존 상세 창 · 진행 막대 4칸 근거 */
  await card('매탄임광').click();const D=page.locator('#inq-inbox-dialog');await D.waitFor();if(process.argv[3]){await page.waitForTimeout(300);await page.screenshot({path:process.argv[3]});}
  const mini=D.locator('.idv3-steps.i5-mini>div');assert.equal(await mini.count(),4);
  assert.deepEqual(await mini.evaluateAll(l=>l.map(x=>x.className)),['done','done','cur',''],'끝난 단계 · 지금 · 남은 단계');
  assert.deepEqual((await mini.locator('b').allInnerTexts()).map(one),['✓ 01 접수','✓ 02 담당 배정','03 접촉 · 상담','04 현장방문 / 견적']);
  const ev=(await mini.locator('span').allInnerTexts()).map(one);assert.match(ev[1],/^배정 · /);assert.match(ev[2],/연결 · 정보 \d \/ 9$/);assert.equal(ev[3],'현장방문 · 견적 전');
  assert.equal(one(await D.locator('.idv3-next .lb').innerText()),'다음 단계 · 04 현장방문 / 견적');assert.match(one(await D.locator('.idv3-next small').innerText()),/견적서 발송\(완료\)을 저장하면 자동으로 파이프라인 · .+ 단계로 넘어갑니다 · 따로 넘기는 버튼 없음/);
  /* ⑧ 방문 완료는 넘기지 않고, 견적 발송 완료 저장은 그 자리에서 기존 전환 경로를 부른다 */
  await D.locator('[data-idv="step"][data-v="visit"]').click();await D.locator('[data-idv="visitMode"][data-v="완료"]').click();
  assert.equal(one(await D.locator('[data-idv="handoff"]').innerText()),'저장','방문 완료 = 저장만');
  await D.locator('[data-idv="step"][data-v="quote"]').click();await D.locator('[data-idv="quoteMode"][data-v="완료"]').click();await D.locator('[data-idv="quoteAmt"]').fill('1200');
  assert.equal(one(await D.locator('[data-idv="handoff"]').innerText()),'저장하고 파이프라인으로');
  await page.evaluate(()=>{window.__promo=[];window.autoPromote=q=>{__promo.push(q.id);return '파이프라인에 새 영업건을 만들었습니다';};
   const run=InquiryCommand.run;InquiryCommand.run=(type,q,o)=>type==='quote_send'?Promise.resolve({ok:true,promoted:false,label:'견적 발송 기록',msg:''}):run(type,q,o);});
  await D.locator('[data-idv="handoff"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>window.__promo),[await page.evaluate(()=>id(5))],'견적 발송 완료 저장 → 전환 경로 한 번');
  await page.evaluate(()=>InquiryWorkbench.close());
  /* ⑨ 칸마다 8건 + 외 n건 + 쪽 번호 */
  await page.evaluate(()=>{const at=d=>new Date(Date.now()-d*864e5).toISOString();for(let n=20;n<29;n++)B.inquiries.push({id:id(n),site:'[합성] 추가 단지 '+n,status:'배정완료',at:at(3),created_at:at(3),brand:'석민이앤씨',phone:'02-000-00'+n,contact_name:'소장',assignee:'이필선',assigned_to:'이필선',assigned_at:at(2.9),responded_at:at(1),raw:{'문의내용':'문의','상담채널':'전화'},activities:[{type:'전화',note:'통화',at:at(1),actor:'이필선'}]});InquiryV4.fresh();paint();});
  await page.waitForTimeout(300);assert.deepEqual(await nums(),[2,1,12,2]);
  assert.equal(await col(2).locator('.i5-card').count(),8);assert.equal(one(await col(2).locator('.i5-rest').innerText()),'외 4건 · 기한 급한 순');assert.equal(await col(2).locator('nav.lpg').count(),1);assert.equal(await col(0).locator('nav.lpg').count(),0);
  const first=one(await col(2).locator('.i5-card .i5-site').first().innerText());await col(2).locator('nav.lpg button[data-page="2"]:not(.lpg-arrow)').click();
  assert.equal(await col(2).locator('.i5-card').count(),4);assert.notEqual(one(await col(2).locator('.i5-card .i5-site').first().innerText()),first);
  /* ⑩ 끄면 v4 */
  assert.deepEqual(await page.evaluate(()=>{G.inqV5Off=true;paint();return [!!document.getElementById('inq-v5'),document.getElementById('pg-inq').classList.contains('inq-v5'),getComputedStyle(document.getElementById('inq-v4')).display!=='none'];}),[false,false,true]);
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log('inquiry v5 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
