'use strict';
/* 운영 기준 설정 화면 검사(2026-10-04 핸드오프 rules): 설정 → 운영 기준 설정 · 관리자 전용
   목차 7묶음 · 꼬리표(확정 = 잠금 / 조건부 = − + · 토글 · 칩 추가 / 보류 = 꺼짐 고정) · 변경됨 + 영향 한 줄 + 남색 띠 [되돌리기] [저장]
   저장 = 서버(crm_ops_rules_v1)가 확인한 값만 적용 → 모든 화면이 같은 기준(견적문의 배정 기준 · 실주 원인 목록 등) · 변경 이력. 서버 함수가 없으면 기본값 + 잠금 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.CRMRules&&window.RulesAdmin&&window.OpsStore&&window.InquiryListV3);
  await page.evaluate(()=>{
   const at=m=>new Date(Date.now()-m*6e4).toISOString(),U=n=>'0000000'+n+'-0000-4000-8000-00000000000'+n;
   const inq=(n,site,m)=>({id:U(n),site,status:'접수',at:at(m),created_at:at(m),received_at:at(m),brand:'POUR솔루션',phone:'010-1111-222'+n});
   /* 미배정 문의 3건: 접수 후 15분 · 35분 · 50분 → 기준 30분이면 2건, 40분이면 1건, 20분이면 2건(15분은 아직) */
   B={deals:[],inquiries:[inq(1,'[서울] 15분 전 문의',15),inq(2,'[경기] 35분 전 문의',35),inq(3,'[인천] 50분 전 문의',50)],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   /* 서버 흉내: 저장하면 값과 변경 이력을 돌려준다 */
   window.__rules={};window.__hist=[];window.__calls=[];
   SB={rpc:async(name,args)=>{__calls.push([name,JSON.parse(JSON.stringify(args.p||{}))]);if(name==='crm_ops_rules_v1'){const set=args.p&&args.p.set,ap=(args.p&&args.p.apply)||{};if(set)Object.keys(set).forEach(k=>{__hist.unshift({key:k,before:__rules[k]===undefined?null:__rules[k],after:set[k],by:'송보람',at:new Date().toISOString(),effective_on:ap.effective_on||null,scope:ap.scope||null,existing:ap.existing||null});__rules[k]=set[k];});return {data:{ok:true,contract:2,version:__hist.length,rules:__rules,updated_at:__hist.length?__hist[0].at:null,updated_by_name:__hist.length?'송보람':null,history:__hist.slice(0,20)}};}if(name==='crm_ops_settings_v1')return {data:{ok:true,settings:{}}};return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   goPage('rules');
  });
  await page.waitForTimeout(500);
  const v=page.locator('#rules-admin .ra-shell');assert.equal(await v.count(),1);
  assert.equal(await page.locator('#ptitle').innerText(),'운영 기준 설정');assert.match(await page.locator('#psub').innerText(),/적용 중인 설정만 연결된 화면 계산에 반영됩니다 · 관리자 전용/);
  assert.equal(await page.locator('.menu [data-p="rules"]').isVisible(),true,'사이드바 설정 → 운영 기준 설정');
  /* 목차 7묶음 + 꼬리표 설명 */
  assert.deepEqual(await v.locator('.ra-nav>button').evaluateAll(a=>a.map(n=>n.querySelector('span').textContent+' '+n.querySelector('i').textContent)),['시간 기준 16'/* 2026-10-07 관계관리 v12: 집중 · 일반관리 기간(개월) 조건부 2항목 + stage7 ① 미팅 후 견적 요청 등록(보류 · 운영 제안) + 2026-10-10 admin_request E: 진행 중 연락두절 · 기록 입력 마감 */,'결과 · 실적 7','사유 목록 3','응대 기록 3','사람 · 관계 9','공개 · 권한 4'/* + 중요 요청(팝업) */,'보류 · 추후 1']);
  assert.deepEqual((await v.locator('.ra-legend span').allInnerTexts()).map(s=>s.replace(/\s+/g,' ')),['확정 정책 항목 · 잠금','조건부 관리자가 값 변경','보류 구현 안 함']);
  assert.equal(await v.locator('.ra-sec').count(),8);/* 7묶음 + stage7_2 ④ '적용 예정' 한 묶음 */
  /* 2026-10-10 admin_request E: 상단 묶음 숫자 · 확정 상태 4가지 · 적용 상태 3가지 · 계산 시작점 */
  assert.match(await v.locator('.ra-top').innerText(),/^적용 중 \d+개\s*값만 저장 \d+개\s*확정 전 \d+개\s*기준 v0 · 기본값 · 기준을 바꿔도 지난 요청의 기한 · 판정은 다시 계산하지 않음$/);
  const topN=await v.locator('.ra-top b').allInnerTexts();assert.equal(Number(topN[2].replace(/\D/g,''))>=8,true,'확정 전 = 잠정 · 근거 확인 필요 · 해석 미확정 항목 수');
  const row=l=>page.locator('#rules-admin .ra-row',{has:page.locator('.ra-l b',{hasText:new RegExp('^'+l+'$')})});
  /* 관계관리 v12(2026-10-07): 집중 · 일반관리 기간(개월)은 조건부 숫자 — 7일 · 월 1회 · 2개월은 회의 결정이라 설정 밖 */
  assert.match(await row('집중관리 기간').innerText(),/집중관리 기간\s*조건부[\s\S]*−\s*1\s*\+\s*개월/);assert.match(await row('일반관리 기간').innerText(),/일반관리 기간\s*조건부[\s\S]*−\s*3\s*\+\s*개월/);
  assert.match(await row('고객관리 기간').innerText(),/해석 미확정[\s\S]*연락 주기와 관리 기간을 구분/);
  assert.doesNotMatch(await row('고객관리 기간').innerText(),/송보람 승인|회의 확정/);
  assert.match(await row('집중관리 기간').innerText(),/임시 적용/);
  assert.match(await row('일반관리 기간').innerText(),/임시 적용/);
  assert.match(await row('연락두절 시도 간격').innerText(),/운영 기본값 · 근거 확인 필요/);
  assert.match(await row('견적 발송 후 후속').innerText(),/회의 확정[\s\S]*계산 시작점 · 예외 — 실제 발송일부터 · 발송일 없으면 판정 제외/);
  assert.match(await row('장기 대기 연락 주기').innerText(),/회의 확정[\s\S]*달력 2개월 1회\(60일 아님\) · 고객 약속일 우선[\s\S]*임시 적용/);
  assert.match(await row('최초 문의 연락두절').innerText(),/근거 확인 필요[\s\S]*며칠 간격 약 3회[\s\S]*적용 중/);
  assert.match(await row('진행 중 연락두절').innerText(),/진행 중 연락두절\s*조건부\s*회의 확정[\s\S]*월 간격 약 3회[\s\S]*−\s*3\s*\+\s*회\s*값만 저장/);
  assert.match(await row('기록 입력 마감').innerText(),/기록 입력 마감\s*조건부\s*회의 확정[\s\S]*−\s*12\s*\+\s*시\s*적용 중/);
  assert.match(await row('중요 요청 \\(팝업\\)').innerText(),/해석 미확정[\s\S]*비어 있음 · 값 미정[\s\S]*\+ 추가[\s\S]*적용 중/);
  assert.match(await row('귀속 기준').innerText(),/해석 미확정[\s\S]*문의 수신 · 배정 · 실제 연결 중/);
  assert.match(await row('실주 원인').innerText(),/회의 확정[\s\S]*실주 대신 보류 검토 안내/);
  assert.match(await row('주담당 자동 귀속').innerText(),/승인 근거 확인 필요/);
  assert.match(await row('다음 행동 필수').innerText(),/값만 저장/);
  assert.match(await row('향후 연도 건 집중관리 제외').innerText(),/값만 저장/);
  /* 단계 이동 필수조건(2차 기능 2) = 조건부 · 관리자가 켜고 끈다 */
  assert.match(await row('단계 이동 필수조건').innerText(),/단계 이동 필수조건\s*조건부[\s\S]*단계별 필수값이 비면 \[옮기기\]를 잠급니다/);
  /* 예외 승인자(2026-10-04 대표 지정) = 조건부 목록 · 기본 이승우 · 황윤선 */
  assert.match(await row('예외 승인자').innerText(),/예외 승인자\s*조건부[\s\S]*한 사람만 승인해도 됩니다[\s\S]*이승우[\s\S]*황윤선/);
  /* 확정 = 잠금 */
  assert.match(await row('첫 연락').innerText(),/첫 연락\s*확정[\s\S]*2\s*\+?\s*시간\s*정책 항목 · 설정 변경 불가/);assert.equal(await row('첫 연락').locator('.ra-num button').first().isDisabled(),true);
  assert.match(await row('영업 메이드율').innerText(),/\(자사 수주 \+ 승인 타사 이관\) ÷ \(자사 수주 \+ 승인 타사 이관 \+ 파이프라인 실주\)\s*정책 항목 · 설정 변경 불가/);
  /* 보류 = 꺼짐 고정 */
  assert.match(await row('콘텐츠 후속관리').innerText(),/보류[\s\S]*꺼짐/);assert.equal(await row('콘텐츠 후속관리').locator('.ra-tg').isDisabled(),true);
  /* 조건부: − + → 변경됨 + 영향 한 줄(실제 건수) + 남색 띠 */
  assert.equal(await page.locator('#rules-admin .ra-bar').count(),0,'바꾸기 전에는 띠 없음');
  await row('담당 배정').locator('[data-ra="inc"]').click();await page.waitForTimeout(100);
  assert.match(await row('담당 배정').innerText(),/담당 배정\s*조건부\s*회의 확정\s*변경됨[\s\S]*바꾸면 지금 배정 기준을 넘긴 문의 2건 → 1건[\s\S]*40\s*\+\s*분/);
  assert.match(await page.locator('#rules-admin .ra-bar').innerText(),/^변경 1건\s*담당 배정 30 → 40 · 저장하면 변경 이력에 남습니다\. 적용 중인 항목만 연결된 화면 계산에 반영됩니다\s*되돌리기\s*저장$/);
  await page.locator('#rules-admin [data-ra="reset"]').click();await page.waitForTimeout(100);assert.equal(await page.locator('#rules-admin .ra-bar').count(),0,'되돌리기');assert.equal(await page.evaluate(()=>__calls.filter(c=>c[1].set).length),0,'저장 전에는 서버에 안 보냄');
  /* 세 가지 바꾸고 저장: 숫자 · 토글 · 칩 추가 */
  await row('담당 배정').locator('[data-ra="dec"]').click();await page.waitForTimeout(80);
  await row('주변 현장 지도').locator('.ra-tg').click();await page.waitForTimeout(80);
  await row('실주 원인').locator('[data-ra="add"]').click();await page.waitForTimeout(80);await page.keyboard.type('단가 인상');await page.keyboard.press('Enter');await page.waitForTimeout(120);
  assert.match(await page.locator('#rules-admin .ra-bar').innerText(),/^변경 3건\s*담당 배정 30 → 20 · 주변 현장 지도 켜짐 → 꺼짐 · 실주 원인 12개 → 13개 \(\+단가 인상\) · 저장하면/);
  assert.equal(await page.locator('#periodbar:visible, #reptabs:visible, #unibar:visible').count(),0,'설정 화면에는 조회기간 · 담당자 막대 없음');
  if(shot)await page.screenshot({path:shot+'-edit.png',fullPage:true});
  /* promise_gap ③: [저장] = 바로 보내지 않고 적용 범위 확인(바꾸는 것 · 적용일 · 대상 · 기존 업무 3택) → [이대로 저장] */
  await page.locator('#rules-admin [data-ra="save"]').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>__calls.filter(c=>c[1].set).length),0,'확인 전에는 서버에 안 보냄');
  const cf=page.locator('#rules-admin .ra-cf');assert.equal(await cf.count(),1);
  assert.match(await cf.innerText(),/기준을 바꿀 때 · 적용 범위 확인[\s\S]*바꾸는 것\s*담당 배정 30 → 20\s*대상\s*견적문의 · 미배정 · 접수 후 20분 넘김 2건 \(지금 기준 2건\)[\s\S]*주변 현장 지도 켜짐 → 꺼짐\s*대상\s*영업건 상세 지도[\s\S]*실주 원인 12개 → 13개[\s\S]*적용일[\s\S]*기존 업무는[\s\S]*기존 업무 그대로 · 새 건부터[\s\S]*다시 계산[\s\S]*담당자에게 확인 요청/);
  assert.equal(await cf.locator('[data-ra="existing"][aria-pressed="true"]').innerText().then(t=>/그대로/.test(t)),true,'기본 = 그대로 · 새 건부터');
  await cf.locator('[data-ra="existing"][data-v="recalc"]').click();await page.waitForTimeout(80);
  await cf.locator('[data-ra-in="eff"]').fill('2026-10-13');await page.waitForTimeout(80);
  await cf.locator('[data-ra="cfsave"]').click();await page.waitForTimeout(500);
  const ap=await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_ops_rules_v1'&&c[1].set).map(c=>c[1].apply));
  assert.equal(ap.length,1);assert.equal(ap[0].effective_on,'2026-10-13');assert.equal(ap[0].existing,'recalc');assert.match(ap[0].scope,/담당 배정: 견적문의 · 미배정/);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_ops_rules_v1'&&c[1].set).map(c=>c[1].set)),[{assign_minutes:20,nearby_map:false,reasons_lost:['관계 · 관리소장 변경','관계 · 입대의 · 회장 영향','관계 · 경쟁업체 기존 관계','공법 · 타 공법 선호','공법 · 특허 조건 불리','공법 · 설계 변경','가격 · 가격 경쟁','가격 · 예산 부족','가격 · 실행가 문제','사업 · 공사 취소','사업 · 연기','사업 · 예산 미확정','단가 인상']}],'바뀐 조건부 값만 서버로');
  assert.equal(await page.locator('#rules-admin .ra-bar').count(),0,'저장 뒤 띠 사라짐');
  assert.deepEqual(await page.evaluate(()=>[CRMRules.get('assign_minutes'),CRMRules.get('nearby_map'),CRMRules.reasons('lost').at(-1),OPS_RULES.inquiryAssignMinutes,OPS_RULES.towerFirstResponseHours]),[20,false,'단가 인상',20,2],'서버가 확인한 값이 공통 기준으로');
  assert.match(await page.locator('#rules-admin .ra-hist').innerText(),/마지막 변경\s*\d{4}\.\d+\.\d+ · 송보람[\s\S]*담당 배정 30 → 20\s*적용일 2026-10-13 · 대상 담당 배정: 견적문의[\s\S]*기존 업무도 새 기준으로 다시 계산/,'변경 이력(누가 · 언제 · 전 → 후 · 적용일 · 대상 · 선택)');
  assert.match(await page.locator('#rules-admin .ra-top').innerText(),/기준 v3 · /,'기준 버전 = 이력 건수');
  assert.equal(await page.locator('#rules-admin .ra-cf').count(),0,'저장 뒤 확인 창 사라짐');
  /* 모든 화면이 같은 기준: 견적문의 배정 기준 · 실주 원인 · 배드핏 사유 */
  await page.evaluate(()=>goPage('inq'));await page.waitForTimeout(400);
  assert.match(await page.locator('#inq-v3 .il-tab[data-v="unassigned"] small').innerText(),/^20분 안에 담당 지정$/);
  assert.deepEqual(await page.evaluate(()=>{const d=document.createElement('select');d.innerHTML=reasonOptionsFor('lost');return [...d.options].map(o=>o.textContent).slice(1);}),['관계 · 관리소장 변경','관계 · 입대의 · 회장 영향','관계 · 경쟁업체 기존 관계','공법 · 타 공법 선호','공법 · 특허 조건 불리','공법 · 설계 변경','가격 · 가격 경쟁','가격 · 예산 부족','가격 · 실행가 문제','사업 · 공사 취소','사업 · 연기','사업 · 예산 미확정','단가 인상']);
  assert.deepEqual(await page.evaluate(()=>inqBadFitReasons()),['수행불가 공종','규모 부적합','대상 고객 아님','서비스 범위 아님','기타']);
  assert.deepEqual(await page.evaluate(()=>StageTransition.definitions.lost.fields.find(f=>f.key==='close_reason').options),['관계 · 관리소장 변경','관계 · 입대의 · 회장 영향','관계 · 경쟁업체 기존 관계','공법 · 타 공법 선호','공법 · 특허 조건 불리','공법 · 설계 변경','가격 · 가격 경쟁','가격 · 예산 부족','가격 · 실행가 문제','사업 · 공사 취소','사업 · 연기','사업 · 예산 미확정','단가 인상'],'단계 바꾸기(실주)의 사유 선택도 같은 목록');
  assert.equal(await page.evaluate(()=>BriefB.lib.made(62,58)),51.7,'메이드율 = 공통 계산 함수');
  /* 서버 함수가 없으면: 기본값으로 동작 · 값은 잠금 · 안내 */
  await page.evaluate(()=>{window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>n!=='crm_ops_rules_v1'});goPage('rules');});await page.waitForTimeout(300);
  assert.match(await page.locator('#rules-admin .ra-gate').innerText(),/서버 적용\(sql\/ops-rules-v2-20261010\.sql\)/);assert.equal(await row('담당 배정').locator('[data-ra="inc"]').isDisabled(),true);
  await page.evaluate(()=>{window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>true});});
  /* 관리자 전용 */
  await page.evaluate(()=>{ME={id:'rep1',name:'이필선',role:'rep'};SalesScope.sidebar&&SalesScope.sidebar();paint();});await page.waitForTimeout(300);
  assert.match(await page.locator('#rules-admin').innerText(),/관리자 전용 화면입니다/);
  /* 좁은 화면 */
  await page.evaluate(()=>{ME={id:'admin',name:'송보람',role:'admin'};paint();});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',sections7:true,apply_scope_confirm:true,conf_apply_states:true,fixed_locked:true,hold_off:true,conditional_edit_impact_bar:true,save_server_confirmed:true,history:true,one_rule_everywhere:true,gate_without_server:true,admin_only:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
