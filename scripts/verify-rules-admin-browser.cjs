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
   SB={rpc:async(name,args)=>{__calls.push([name,JSON.parse(JSON.stringify(args.p||{}))]);if(name==='crm_ops_rules_v1'){const set=args.p&&args.p.set;if(set)Object.keys(set).forEach(k=>{__hist.unshift({key:k,before:__rules[k]===undefined?null:__rules[k],after:set[k],by:'송보람',at:new Date().toISOString()});__rules[k]=set[k];});return {data:{ok:true,rules:__rules,updated_at:__hist.length?__hist[0].at:null,updated_by_name:__hist.length?'송보람':null,history:__hist.slice(0,20)}};}if(name==='crm_ops_settings_v1')return {data:{ok:true,settings:{}}};return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   goPage('rules');
  });
  await page.waitForTimeout(500);
  const v=page.locator('#rules-admin .ra-shell');assert.equal(await v.count(),1);
  assert.equal(await page.locator('#ptitle').innerText(),'운영 기준 설정');assert.match(await page.locator('#psub').innerText(),/모든 화면이 이 값으로 놓침 · 메이드율 · 수주실적을 계산합니다 · 관리자 전용/);
  assert.equal(await page.locator('.menu [data-p="rules"]').isVisible(),true,'사이드바 설정 → 운영 기준 설정');
  /* 목차 7묶음 + 꼬리표 설명 */
  assert.deepEqual(await v.locator('.ra-nav>button').evaluateAll(a=>a.map(n=>n.querySelector('span').textContent+' '+n.querySelector('i').textContent)),['시간 기준 10','결과 · 실적 7','사유 목록 3','응대 기록 3','사람 · 관계 9','공개 · 권한 2','보류 · 추후 1']);
  assert.deepEqual((await v.locator('.ra-legend span').allInnerTexts()).map(s=>s.replace(/\s+/g,' ')),['확정 회의 확정 · 잠금','조건부 관리자가 값 변경','보류 구현 안 함']);
  assert.equal(await v.locator('.ra-sec').count(),7);
  const row=l=>page.locator('#rules-admin .ra-row',{has:page.locator('.ra-l b',{hasText:new RegExp('^'+l+'$')})});
  /* 확정 = 잠금 */
  assert.match(await row('첫 연락').innerText(),/첫 연락\s*확정[\s\S]*2\s*\+?\s*시간\s*회의 확정 · 변경 불가/);assert.equal(await row('첫 연락').locator('.ra-num button').first().isDisabled(),true);
  assert.match(await row('영업 메이드율').innerText(),/\(자사 수주 \+ 승인 타사 이관\) ÷ \(자사 수주 \+ 승인 타사 이관 \+ 파이프라인 실주\)\s*회의 확정 · 변경 불가/);
  /* 보류 = 꺼짐 고정 */
  assert.match(await row('콘텐츠 후속관리').innerText(),/보류[\s\S]*꺼짐/);assert.equal(await row('콘텐츠 후속관리').locator('.ra-tg').isDisabled(),true);
  /* 조건부: − + → 변경됨 + 영향 한 줄(실제 건수) + 남색 띠 */
  assert.equal(await page.locator('#rules-admin .ra-bar').count(),0,'바꾸기 전에는 띠 없음');
  await row('담당 배정').locator('[data-ra="inc"]').click();await page.waitForTimeout(100);
  assert.match(await row('담당 배정').innerText(),/담당 배정\s*조건부\s*변경됨[\s\S]*바꾸면 지금 배정 기준을 넘긴 문의 2건 → 1건[\s\S]*40\s*\+\s*분/);
  assert.match(await page.locator('#rules-admin .ra-bar').innerText(),/^변경 1건\s*담당 배정 30 → 40 · 저장하면 모든 화면에 바로 적용되고 변경 이력에 남습니다\s*되돌리기\s*저장$/);
  await page.locator('#rules-admin [data-ra="reset"]').click();await page.waitForTimeout(100);assert.equal(await page.locator('#rules-admin .ra-bar').count(),0,'되돌리기');assert.equal(await page.evaluate(()=>__calls.filter(c=>c[1].set).length),0,'저장 전에는 서버에 안 보냄');
  /* 세 가지 바꾸고 저장: 숫자 · 토글 · 칩 추가 */
  await row('담당 배정').locator('[data-ra="dec"]').click();await page.waitForTimeout(80);
  await row('주변 현장 지도').locator('.ra-tg').click();await page.waitForTimeout(80);
  await row('실주 원인').locator('[data-ra="add"]').click();await page.waitForTimeout(80);await page.keyboard.type('단가 인상');await page.keyboard.press('Enter');await page.waitForTimeout(120);
  assert.match(await page.locator('#rules-admin .ra-bar').innerText(),/^변경 3건\s*담당 배정 30 → 20 · 주변 현장 지도 켜짐 → 꺼짐 · 실주 원인 7개 → 8개 \(\+단가 인상\) · 저장하면/);
  assert.equal(await page.locator('#periodbar:visible, #reptabs:visible, #unibar:visible').count(),0,'설정 화면에는 조회기간 · 담당자 막대 없음');
  if(shot)await page.screenshot({path:shot+'-edit.png',fullPage:true});
  await page.locator('#rules-admin [data-ra="save"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_ops_rules_v1'&&c[1].set).map(c=>c[1].set)),[{assign_minutes:20,nearby_map:false,reasons_lost:['가격','관리소장 변경','타 공법 선호','경쟁사 관계','예산','공사 취소','기타','단가 인상']}],'바뀐 조건부 값만 서버로');
  assert.equal(await page.locator('#rules-admin .ra-bar').count(),0,'저장 뒤 띠 사라짐');
  assert.deepEqual(await page.evaluate(()=>[CRMRules.get('assign_minutes'),CRMRules.get('nearby_map'),CRMRules.reasons('lost').at(-1),OPS_RULES.inquiryAssignMinutes,OPS_RULES.towerFirstResponseHours]),[20,false,'단가 인상',20,2],'서버가 확인한 값이 공통 기준으로');
  assert.match(await page.locator('#rules-admin .ra-hist').innerText(),/마지막 변경\s*\d{4}\.\d+\.\d+ · 송보람[\s\S]*담당 배정 30 → 20/,'변경 이력(누가 · 언제 · 전 → 후)');
  /* 모든 화면이 같은 기준: 견적문의 배정 기준 · 실주 원인 · 배드핏 사유 */
  await page.evaluate(()=>goPage('inq'));await page.waitForTimeout(400);
  assert.match(await page.locator('#inq-v3 .il-tab[data-v="unassigned"] small').innerText(),/^20분 안에 담당 지정$/);
  assert.deepEqual(await page.evaluate(()=>{const d=document.createElement('select');d.innerHTML=reasonOptionsFor('lost');return [...d.options].map(o=>o.textContent).slice(1);}),['가격','관리소장 변경','타 공법 선호','경쟁사 관계','예산','공사 취소','기타','단가 인상']);
  assert.deepEqual(await page.evaluate(()=>inqBadFitReasons()),['수행 불가 공종','규모 부적합','시공 불가 지역','기타']);
  assert.deepEqual(await page.evaluate(()=>StageTransition.definitions.lost.fields.find(f=>f.key==='close_reason').options),['가격','관리소장 변경','타 공법 선호','경쟁사 관계','예산','공사 취소','기타','단가 인상'],'단계 바꾸기(실주)의 사유 선택도 같은 목록');
  assert.equal(await page.evaluate(()=>BriefB.lib.made(62,58)),51.7,'메이드율 = 공통 계산 함수');
  /* 서버 함수가 없으면: 기본값으로 동작 · 값은 잠금 · 안내 */
  await page.evaluate(()=>{window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>n!=='crm_ops_rules_v1'});goPage('rules');});await page.waitForTimeout(300);
  assert.match(await page.locator('#rules-admin .ra-gate').innerText(),/서버 적용/);assert.equal(await row('담당 배정').locator('[data-ra="inc"]').isDisabled(),true);
  await page.evaluate(()=>{window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>true});});
  /* 관리자 전용 */
  await page.evaluate(()=>{ME={id:'rep1',name:'이필선',role:'rep'};SalesScope.sidebar&&SalesScope.sidebar();paint();});await page.waitForTimeout(300);
  assert.match(await page.locator('#rules-admin').innerText(),/관리자 전용 화면입니다/);
  /* 좁은 화면 */
  await page.evaluate(()=>{ME={id:'admin',name:'송보람',role:'admin'};paint();});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',sections7:true,fixed_locked:true,hold_off:true,conditional_edit_impact_bar:true,save_server_confirmed:true,history:true,one_rule_everywhere:true,gate_without_server:true,admin_only:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
