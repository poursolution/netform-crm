'use strict';
/* 새 영업 등록 v2 검사(2026-10-05 design_handoff_new_deal · 새 영업 등록 v2.dc.html)
   상단 [+ 새 영업] → 가운데 창(최대 960px): 어떻게 시작했나요 *(카드 4) · 현장명 · 주소 + 중복 감지 · 공종 칩(여러 개 = 복합공종) · 브랜드 * · 담당 *(기본 = 나) · 예상 금액 ·
   처음 만난 사람(이름 + 연락처 하나 이상) · 시작 근거 한 줄 *(직접 입력 | 음성 기록) · 첫 다음 행동 * + 날짜 *.
   등록 = 견적문의를 거치지 않고 파이프라인 · 컨설팅 설계로 바로(기존 영업 생성 명령 하나 + 유입 구분 · 소개한 사람 · 첫 다음 행동). 유입 구분은 인바운드 통계와 따로.
   서버가 새 약속을 받지 않으면 · 확장관리의 '다음 영업'이면 · 끄면 예전 창. 서버 규칙은 tests/new-deal-outbound.test.mjs. */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.NewDealV2&&window.OperationalAdapter&&window.PipelineStageV3&&typeof openNewDeal==='function'&&typeof saveNewDeal==='function');
  const SITE='55555555-5555-4555-8555-555555555555';
  const seed=(me,server)=>page.evaluate(([me,server,SITE])=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   B={deals:[{id:'won-1',site:'[경기 수원] 호매실경남아너스빌',site_id:SITE,assignee:'이필선',brand:'POUR솔루션',created:day(-400),code:'won',stage_code:'won',outcome:'won',won_amount:2e8,closed_at:'2025-06-10',completion_date:'2025-06-10',grp:'수주 성공',address:'경기 수원시 권선구 호매실로 1',workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄',workSummary:'옥상(우레탄)',manager_name:'최소장',manager_mobile:'01022223333',office_phone:'0312345678',manager_role:'관리소장'}],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME=me;G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.newDealV2Off=false;G.ps3=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,JSON.parse(JSON.stringify(p))]);return 'req-'+__writes.length;};
   window.__toasts=[];window.toast=m=>{__toasts.push(String(m));};window.__opened=[];window.open=(u)=>{__opened.push(String(u));return null;};
   const real=window.__realPhase1||(window.__realPhase1=window.Phase1);window.__rpc=[];
   const P=Object.assign({},real,{rpc:async name=>{__rpc.push(name);if(name!=='crm_new_deal_contract_v1')throw Error('AUTH_REQUIRED');if(window.__server==='missing')throw Object.assign(Error('Could not find the function'),{code:'PGRST202'});return {ok:true,policy:'new-deal-outbound-v1',one_phone:true,first_action:true};}});
   Object.defineProperty(P,'profile',{get:()=>null});window.Phase1=P;window.__server=server;NewDealV2._reset();NewDealV2.close();
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:()=>true,noteMissing(){}});
   goPage('today');
  },[me,server,SITE]);
  const M=page.locator('#newDealV2'),one=s=>String(s).replace(/\s+/g,' ').trim(),f=k=>M.locator('[data-nd2-f="'+k+'"]');
  const openIt=async()=>{await page.evaluate(()=>openNewDeal());await page.waitForTimeout(250);};
  const err=()=>M.locator('[data-nd2-err]').innerText();

  /* ── 영업사원(이필선)으로: 담당 기본 = 나 ── */
  await seed({id:'rep1',name:'이필선',role:'rep'},'ok');await page.waitForTimeout(300);
  await page.locator('button',{hasText:/^\+\s*새 영업$/}).first().click();await M.waitFor();
  assert.equal(await page.locator('#newDealModal.on').count(),0,'예전 창은 열리지 않는다');
  const bx=await M.locator('.nd2-box').boundingBox();assert.equal(Math.round(bx.width),960,'창 폭 960');assert.ok(Math.abs((bx.x+bx.width/2)-800)<=1,'가운데');assert.ok(bx.y+bx.height<=1000,'한 화면 '+JSON.stringify(bx));
  assert.equal(one(await M.locator('.nd2-head').innerText()),'새 영업 등록 문의 없이 우리가 먼저 시작한 영업 · 아웃바운드 · 소개 · 재영업 ×');
  assert.deepEqual((await M.locator('.nd2-src').allInnerTexts()).map(one),['아웃바운드 직접 연락 · 방문 발굴','소개 소장님 · 고객 · 협력사 소개','기존 고객 재영업 수주 현장의 다른 공사','현장 발굴 · 기타 입찰 공고 · 전시회 등']);
  assert.deepEqual(await M.locator('.nd2-src').evaluateAll(l=>l.map(b=>[b.getAttribute('aria-pressed'),getComputedStyle(b).borderTopColor,getComputedStyle(b).backgroundColor])),[['true','rgb(59, 108, 228)','rgb(245, 248, 255)'],['false','rgb(227, 230, 236)','rgb(255, 255, 255)'],['false','rgb(227, 230, 236)','rgb(255, 255, 255)'],['false','rgb(227, 230, 236)','rgb(255, 255, 255)']]);
  /* 칸 이름 · 필수 * 는 이름 바로 옆 */
  assert.deepEqual((await M.locator('.nd2-t, .nd2-lab>b, .nd2-f').evaluateAll(l=>l.map(n=>(n.matches('.nd2-f')?[...n.childNodes].filter(c=>c.nodeType===3||c.tagName==='SPAN').map(c=>c.nodeType===3?c.textContent:[...c.childNodes].filter(x=>x.nodeType===3||x.tagName==='EM').map(x=>x.textContent).join('')).join(''):n.textContent).replace(/\s+/g,' ').trim()))),['어떻게 시작했나요 *','현장명','현장 주소','공종 *','브랜드 *','담당 *','예상 금액','처음 만난 사람','어떻게 시작됐는지 한 줄 *','첫 다음 행동 *','날짜 *']);
  assert.deepEqual(await M.locator('.nd2-wg').evaluateAll(l=>l.map(g=>[g.querySelector('span').textContent,[...g.querySelectorAll('.nd2-chip')].map(c=>c.textContent)])),[['옥상',['싱글','금속기와','듀얼','우레탄','PVC']],['재도장',['외+내부','외부','내부']],['지하주차장',['에폭시','배면차수','지하주차장 재도장']],['기타',['기타']]]);
  assert.deepEqual(await M.locator('.nd2-wk').evaluate(n=>[n.textContent,getComputedStyle(n).color]),['아직 선택 안 함','rgb(180, 35, 24)']);
  assert.deepEqual(await f('brand').evaluate(s=>[...s.options].map(o=>o.textContent)),['POUR솔루션','석민이앤씨','POUR공법','아파트스퀘어']);
  assert.deepEqual(await f('owner').evaluate(s=>[s.value,s.selectedOptions[0].textContent]),['이필선','이필선 (나)'],'담당 기본 = 나');
  assert.deepEqual(await f('role').evaluate(s=>[...s.options].map(o=>o.textContent)),['관리소장','입대의 회장','관리과장','기타']);
  assert.deepEqual(await f('act').evaluate(s=>[...s.options].map(o=>o.textContent)),['1차 현장미팅','전화 · 니즈 확인','자료 발송','견적 요청']);
  assert.deepEqual((await M.locator('.nd2-mode button').allInnerTexts()),['직접 입력','음성 기록']);
  assert.equal(one(await M.locator('.nd2-foot').innerText()),'등록하면 파이프라인 · 컨설팅 설계 (미팅 전)로 바로 들어갑니다 · 유입 = 아웃바운드 (견적문의 · 인바운드 통계와 따로 집계) 취소 영업 등록');
  /* 글꼴은 CRM 본문 글꼴 그대로(2026-10-05 "디자인이 투박해졌는데" — 'Pretendard' 만 적어 맑은 고딕으로 떨어졌던 것) · 안쪽 스크롤 없이 한 화면 */
  assert.deepEqual(await M.evaluate(m=>{const b=getComputedStyle(document.body).fontFamily;return [getComputedStyle(m).fontFamily===b,getComputedStyle(m.querySelector('input')).fontFamily===b,getComputedStyle(m.querySelector('.nd2-src b')).letterSpacing];}),[true,true,'normal']);
  assert.equal(await M.locator('.nd2-body').evaluate(n=>n.scrollHeight<=n.clientHeight+1),true,'안쪽 스크롤 없음');
  /* 아래 줄: 안내 글은 왼쪽 · 버튼은 오른쪽 끝(간격 조정 때 기본 꾸밈이 빠지면 버튼이 글 뒤에 붙는다) */
  assert.deepEqual(await M.evaluate(m=>{const f=m.querySelector('.nd2-foot'),r=f.getBoundingClientRect(),b=[...f.querySelectorAll('button')].pop().getBoundingClientRect(),c=getComputedStyle(f);return [c.display,c.borderTopWidth,Math.round(r.right-b.right)];}),['flex','1px',22],'아래 줄 버튼은 오른쪽 끝');
  /* 날짜 칸: 시안 모양(2026.10.8 (수)) · 사흘 뒤(주말이면 월요일)로 채워 둠 · 누르면 달력 */
  const dflt=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+3);if(d.getDay()===6)d.setDate(d.getDate()+2);else if(d.getDay()===0)d.setDate(d.getDate()+1);return [d.toLocaleDateString('en-CA'),d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate()+' ('+'일월화수목금토'[d.getDay()]+')'];});
  assert.deepEqual([await f('due').inputValue(),await M.locator('[data-nd2-due]').inputValue()],dflt);
  assert.deepEqual(await M.locator('[data-nd2-due]').evaluate(i=>[i.readOnly,i.type,getComputedStyle(i).backgroundColor]),[true,'text','rgb(255, 255, 255)']);
  assert.deepEqual(await M.locator('.nd2-foot .pri').evaluate(b=>[getComputedStyle(b).backgroundColor,getComputedStyle(b).color]),['rgb(59, 108, 228)','rgb(255, 255, 255)']);
  /* 노랑 · 검정 큰 상자 없음: 기존 근거 상자(.reasonbox)를 쓰지 않는다 */
  assert.equal(await M.locator('.reasonbox').count(),0);
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-1-empty.png')});

  /* 필수 확인: 위에서부터 한 줄씩 */
  const save=()=>M.locator('[data-nd2="save"]').click();
  await save();assert.equal(await err(),'현장명을 입력해 주세요.');
  /* 중복 감지: 같은 현장일 수 있어요 → [다른 현장] / [이 현장에 다른 공사로 추가] */
  await f('site').fill('호매실경남아너스빌');
  assert.equal(one(await M.locator('.nd2-dup').innerText()),'같은 현장일 수 있어요 [경기 수원] 호매실경남아너스빌 이필선 · 수주 2025 · 옥상(우레탄) 이 현장에 다른 공사로 추가 다른 현장');
  assert.deepEqual(await M.locator('.nd2-dup').evaluate(n=>[getComputedStyle(n).backgroundColor,getComputedStyle(n).borderTopColor]),['rgb(253, 240, 238)','rgb(245, 223, 168)']);
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-2-dup.png')});
  await M.locator('[data-nd2="skip"]').click();assert.equal(await M.locator('.nd2-dup').count(),0,'[다른 현장] = 알림 닫기');
  await f('site').fill('전혀다른현장');assert.equal(await M.locator('.nd2-dup').count(),0);
  await f('office').fill('031-234-5678');assert.equal(await M.locator('.nd2-dup').count(),0,'[다른 현장]이라고 한 현장은 다시 묻지 않는다');
  await f('office').fill('');await f('site').fill('[서울 마포] 새로찾은아파트');
  await save();assert.equal(await err(),'공종을 하나 이상 골라 주세요.');
  await M.locator('.nd2-chip',{hasText:/^우레탄$/}).click();assert.equal(await M.locator('.nd2-wk').innerText(),'1개 · 단일');
  await M.locator('.nd2-chip',{hasText:/^에폭시$/}).click();assert.deepEqual(await M.locator('.nd2-wk').evaluate(n=>[n.textContent,getComputedStyle(n).color]),['2개 · 복합공종','rgb(21, 23, 28)']);
  assert.deepEqual(await M.locator('.nd2-chip.on').evaluateAll(l=>l.map(c=>[c.textContent,getComputedStyle(c).backgroundColor])),[['우레탄','rgb(21, 23, 28)'],['에폭시','rgb(21, 23, 28)']]);
  await f('amount').fill('억단위');await save();assert.match(await err(),/^예상 금액은 1\.5억/);
  await f('amount').fill('1.5억');await save();assert.equal(await err(),'처음 만난 사람의 이름을 입력해 주세요.');
  await f('cname').fill('박회장');await save();assert.equal(await err(),'휴대폰이나 관리사무소 대표전화 가운데 하나는 입력해 주세요.');
  await f('mobile').fill('0101234');await save();assert.equal(await err(),'휴대폰 번호를 확인해 주세요.');
  await f('mobile').fill('');await f('office').fill('0212345678');await f('cname').click();assert.equal(await f('office').inputValue(),'02-1234-5678','번호 모양 맞춤');
  await f('role').selectOption('입대의 회장');
  await save();assert.equal(await err(),'어떻게 시작됐는지 한 줄(5자 이상)을 남겨 주세요.');
  await M.locator('#nd2-why-text').fill('동탄 현장 소장님 소개 · 내년 재도장 입찰 예정');
  const due=await page.evaluate(()=>new Date(Date.now()+3*864e5).toLocaleDateString('en-CA'));
  await f('due').fill(due);assert.match(await M.locator('[data-nd2-due]').inputValue(),/^\d{4}\.\d{1,2}\.\d{1,2} \([일월화수목금토]\)$/);
  /* 소개: 소개한 사람 · 연락처(선택) */
  await M.locator('.nd2-src',{hasText:'소개'}).first().click();await page.waitForTimeout(150);
  assert.deepEqual(await M.locator('.nd2-ref input').evaluateAll(l=>l.map(i=>i.placeholder)),['소개한 사람 (예: 김OO 소장 · 동탄푸른마을)','소개한 사람 연락처 · 선택']);
  assert.deepEqual([await f('site').inputValue(),await f('cname').inputValue(),await M.locator('#nd2-why-text').inputValue(),await f('due').inputValue()],['[서울 마포] 새로찾은아파트','박회장','동탄 현장 소장님 소개 · 내년 재도장 입찰 예정',due],'유입 방식을 바꿔도 적은 것은 남는다');
  await f('refName').fill('김OO 소장 · 동탄푸른마을');await f('refPhone').fill('010-9999-8888');
  await f('act').selectOption('call');assert.match(one(await M.locator('.nd2-foot>span').innerText()),/컨설팅 설계 \(미팅 전\)로 바로 들어갑니다 · 유입 = 소개 /);
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-3-filled.png')});
  await save();await page.waitForTimeout(300);
  assert.equal(await M.count(),0,'등록하면 창이 닫힌다');
  const w=await page.evaluate(()=>__writes);assert.equal(w.length,1);assert.equal(w[0][0],'opportunity_create');
  const p=w[0][1];
  assert.deepEqual([p.name,p.brand,p.owner,p.amount,p.work_scope_type,p.primary_work,p.work_items,p.work_summary,p.work_name],['[서울 마포] 새로찾은아파트','POUR솔루션','이필선',150000000,'multi','옥상>우레탄',['옥상>우레탄','지하주차장>에폭시'],'옥상(우레탄) + 지하주차장(에폭시)','옥상(우레탄) + 지하주차장(에폭시)']);
  assert.deepEqual([p.manager_name,p.manager_role,p.office_phone,p.manager_mobile,p.person_key],['박회장','입대의 회장','0212345678',undefined,'office:0212345678:박회장'],'연락처 하나(대표전화)만으로 등록');
  assert.deepEqual([p.source_type,p.referrer_name,p.referrer_phone,p.first_action_type,p.first_action_title,p.first_action_due,p.reason,p.reason_source,p.origin_source,p.site_id],['referral','김OO 소장 · 동탄푸른마을','01099998888','전화','전화 · 니즈 확인',due,'동탄 현장 소장님 소개 · 내년 재도장 입찰 예정','text','direct',undefined]);
  /* 전송 어댑터(서버와 같은 규칙)를 통과한다 */
  const norm=await page.evaluate(p=>{try{return OperationalAdapter.normalize('opportunity_create','99999999-9999-4999-8999-999999999999',0,Object.assign({},p,{surface:'pc'}));}catch(e){return {err:String(e.message||e)};}},p);
  assert.equal(norm.err,undefined,'어댑터 통과: '+JSON.stringify(norm));
  const np=norm.payload||norm;assert.deepEqual([np.source_type,np.manager_role,np.person_key,np.office_phone,np.manager_mobile,np.first_action_due],['referral','입대의 회장','office:0212345678:박회장','0212345678',undefined,due]);
  /* 화면: 견적문의를 거치지 않고 파이프라인 · 컨설팅 설계(미팅 전)에 바로 */
  const nd=await page.evaluate(()=>{const d=B.deals[B.deals.length-1];return {code:d.code,site:d.site,assignee:d.assignee,src:NewDealV2.sourceOf(d),out:NewDealV2.isOutbound(d),inb:NewDealV2.sourceOf(B.deals[0]),next:d.next_action&&[d.next_action.type,d.next_action.text,d.next_action.due,d.next_action.status],inq:B.inquiries.length};});
  assert.deepEqual(nd,{code:'first_contact',site:'[서울 마포] 새로찾은아파트',assignee:'이필선',src:'referral',out:true,inb:'inbound',next:['전화','전화 · 니즈 확인',due,'open'],inq:0},'유입 구분은 영업건에 남고 견적문의는 생기지 않는다');
  assert.match(await page.evaluate(()=>__toasts.join(' | ')),/새로찾은아파트 · 옥상\(우레탄\) \+ 지하주차장\(에폭시\) 영업을 등록했습니다 — 파이프라인 · 컨설팅 설계 · 유입 소개/);
  await page.evaluate(()=>PipelineWorkspace.open('consulting'));await page.waitForTimeout(400);
  assert.deepEqual(await page.locator('#pipeline-stage-v3 .ps3-row').evaluateAll(l=>l.map(r=>[r.querySelector('.prv-a b').textContent.trim(),r.dataset.tab,r.querySelector('button').textContent])),[['[서울 마포] 새로찾은아파트','0','연락 기록']],'컨설팅 설계 · 미팅 전');/* 목록 줄 v11: 버튼 = 업무 동사 */

  /* ── 재영업: [기존 현장 찾기] → 같은 현장의 다른 공사 · 관리소장 승계 ── */
  await page.evaluate(()=>{__writes.length=0;});await openIt();
  await M.locator('.nd2-src',{hasText:'기존 고객 재영업'}).click();await page.waitForTimeout(150);
  assert.match(one(await M.locator('.nd2-re>span').innerText()),/^기존 고객 현장을 고르면 지난 공사 · 관리소장 · 이력이 자동으로 이어집니다 · \[기존 현장 찾기\]$/);
  await M.locator('[data-nd2="find"]').click();await f('findQ').fill('호매실');await page.waitForTimeout(150);
  assert.equal(one(await M.locator('.nd2-find button').first().innerText()),'[경기 수원] 호매실경남아너스빌 이필선 · 수주 2025 · 옥상(우레탄)');
  await M.locator('.nd2-find button').first().click();await page.waitForTimeout(150);
  assert.equal(one(await M.locator('.nd2-dup.on').innerText()),'이 현장의 다른 공사로 등록 [경기 수원] 호매실경남아너스빌 이필선 · 수주 2025 · 옥상(우레탄) 연결 풀기');
  assert.deepEqual([await f('site').inputValue(),await f('site').evaluate(i=>i.readOnly),await f('address').inputValue(),await f('cname').inputValue(),await f('mobile').inputValue(),await f('office').inputValue()],['[경기 수원] 호매실경남아너스빌',true,'경기 수원시 권선구 호매실로 1','최소장','010-2222-3333','031-234-5678'],'현장 · 관리소장 승계');
  await M.locator('.nd2-chip',{hasText:/^지하주차장 재도장$/}).click();await M.locator('#nd2-why-text').fill('지난 옥상 공사 뒤 지하주차장 문의');await f('due').fill(due);
  await save();await page.waitForTimeout(300);
  const p2=(await page.evaluate(()=>__writes))[0][1];
  assert.deepEqual([p2.source_type,p2.site_id,p2.name,p2.manager_mobile,p2.office_phone,p2.person_key,p2.first_action_type,p2.work_scope_type],['re_sales',SITE,'[경기 수원] 호매실경남아너스빌','01022223333','0312345678','mobile:01022223333','현장방문','single']);
  await page.evaluate(()=>PipelineWorkspace.open('consulting'));await page.waitForTimeout(400);
  assert.deepEqual(await page.locator('#pipeline-stage-v3 .ps3-tab .n').allInnerTexts(),['2','1','1','0'],'1차 현장미팅을 잡은 건은 미팅 예정');
  /* 중복 알림에서 바로 [이 현장에 다른 공사로 추가] · 지도 확인 */
  await openIt();await f('site').fill('호매실 경남아너스빌');await M.locator('[data-nd2="link"]').click();await page.waitForTimeout(150);
  assert.equal(await M.locator('.nd2-dup.on').count(),1);await M.locator('[data-nd2="unlink"]').click();await page.waitForTimeout(100);assert.equal(await f('site').evaluate(i=>i.readOnly),false);
  await M.locator('[data-nd2="map"]').click();assert.match((await page.evaluate(()=>__opened)).join(' '),/map\.kakao\.com\/link\/search\//);
  await page.keyboard.press('Escape');await page.waitForTimeout(100);assert.equal(await M.count(),0,'Esc = 닫기');assert.equal((await page.evaluate(()=>__writes)).length,1,'닫으면 아무것도 보내지 않는다');

  /* ── 관리자(영업을 맡지 않는 사람): 담당 기본값 없음 ── */
  await seed({id:'admin',name:'송보람',role:'admin'},'ok');await page.waitForTimeout(300);await openIt();
  assert.equal(await f('owner').inputValue(),'','영업을 맡을 수 없는 사람은 기본 담당이 아니다');assert.equal(await f('owner').evaluate(s=>[...s.options].some(o=>/\(나\)/.test(o.textContent))),false);
  await M.locator('[data-nd2="close"]').first().click();
  /* ── 서버가 아직 새 약속을 받지 않으면 예전 창 ── */
  await seed({id:'rep1',name:'이필선',role:'rep'},'missing');await page.waitForTimeout(300);await openIt();
  assert.equal(await M.count(),0);assert.equal(await page.locator('#newDealModal.on').count(),1,'서버 적용 전에는 예전 창');assert.equal(await page.locator('#nd-office-tel').count(),1);
  await page.evaluate(()=>closeNewDeal());
  /* ── 끄기 · 확장관리의 '다음 영업'은 예전 창 그대로 ── */
  await seed({id:'rep1',name:'이필선',role:'rep'},'ok');await page.waitForTimeout(300);
  await page.evaluate(()=>{G.newDealV2Off=true;openNewDeal();});await page.waitForTimeout(250);assert.equal(await M.count(),0);assert.equal(await page.locator('#newDealModal.on').count(),1,'끄면 예전 창');
  await page.evaluate(()=>{closeNewDeal();G.newDealV2Off=false;});
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('new deal v2 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
