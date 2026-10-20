'use strict';
/* 견적문의 상세 · 지금 응대 중심 (2026-10-20 design_handoff_inquiry_respond) — 합성 자료 · 외부 연결 차단 · 저장 명령은 가로채 내용만 확인
   검수 5가지: ① 부재 기록에 불필요한 정보를 요구하나 ② 상담 내용을 두 번 쓰게 하나 ③ 날짜 변경이 새 업무를 만드나
              ④ 연락 한 번으로 복합 요청 전체가 완료되나 ⑤ PC · 모바일 결과가 같나(같은 값 · 같은 저장 계획)
   + 기록 없음 = 지연(빨강)으로 보지 않음 · 현장 정보 이어받음 · 보완 정보는 접힘 · 오른쪽 지도 중심 · 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(require('../review-preview/review-environment.cjs').launchOptions());
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-20T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryWorkbench&&window.InquiryTidy&&window.InquiryDetailV2&&window.ContactEntry&&window.InquiryCommand&&window.InquiryFlow);
  await page.evaluate(()=>{
   const id=n=>'33333333-3333-4333-8333-'+String(n).padStart(12,'0');
   B={deals:[],inquiries:[
    {id:id(1),site:'[합성] 응대 중 아파트',status:'응대중',at:'2026-10-01T01:00:00Z',created_at:'2026-10-01T01:00:00Z',brand:'POUR솔루션',phone:'010-0000-1111',contact_name:'관리소장',assignee:'송보람',assigned_to:'송보람',assigned_at:'2026-10-01T01:00:00Z',first_response_at:'2026-10-10T01:00:00Z',responded_at:'2026-10-10T01:00:00Z',nextActionObj:{id:'44444444-4444-4444-8444-000000000001',type:'전화',text:'다시 연락',due:'2026-10-22',status:'open'},raw:{'문의내용':'옥상 방수 견적 요청 · 최상층 누수','공사유형':'옥상방수','건물주소':'합성시 합성로 1','유입경로':'홈페이지'}},
    {id:id(2),site:'[합성] 기록 없는 아파트',status:'배정완료',at:'2026-07-02T07:21:00Z',created_at:'2026-07-02T07:21:00Z',brand:'POUR솔루션',phone:'010-0000-2222',contact_name:'관리과장',assignee:'송보람',assigned_to:'송보람',assigned_at:'2026-07-02T07:30:00Z',raw:{'문의내용':'아스팔트슁글 공사 · 면적 주면 물량 산출 가능한지 · 시공 상담 요청','공사유형':'아스팔트 슁글','건물주소':'합성시 합성로 2'}}],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';G.inqTidyOff=false;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   SB={rpc:async()=>({error:{message:'CONTRACT_UNAVAILABLE'}})};
   window.Phase1={profile:{auth_uid:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'송보람'},rpc:async()=>{throw Error('CONTRACT_UNAVAILABLE');}};
   window.__cmd=[];InquiryCommand.run=(op,q,o)=>{__cmd.push([op,JSON.parse(JSON.stringify(o||{}))]);return true;};const PS=PCInquirySave;window.PCInquirySave=Object.assign({},PS,{save:async(q,o)=>{__cmd.push(['pc_save',JSON.parse(JSON.stringify(o||{}))]);return {ok:true};}});/* 운영 기본(CRM_SCHEDULE_V1) = 공통 계획을 PCInquirySave 로 — 여기서는 넘어가는 계획만 확인 */
   window.__id=id;goPage('inq');
  });
  await page.waitForTimeout(400);
  const D=page.locator('#inq-inbox-dialog');
  const open=async n=>{await page.evaluate(()=>{try{InquiryWorkbench.close();}catch(e){}});await page.evaluate(k=>{const q=B.inquiries.find(x=>x.id===__id(k));InquiryWorkbench.open(inqKey(q));},n);await D.locator('.idv3-c2').waitFor();await page.waitForTimeout(150);};
  const comp=()=>D.locator('.idv3-composer');const prev=async()=>one(await comp().locator('.idv3-ceprev').innerText());const last=()=>page.evaluate(()=>__cmd[__cmd.length-1]);
  await open(1);
  /* ⑤ 연락 결과 = PC · 모바일 같은 값(ContactEntry) */
  const vals=await page.evaluate(()=>ContactEntry.VALUES.slice());assert.deepEqual(await comp().locator('.idv3-res').first().locator('button').allInnerTexts(),vals,'⑤ 연락 결과 = 공통 5값');
  assert.doesNotMatch(await comp().innerText(),/고객 반응/,'고객 반응 줄 없음(이번에 확인한 내용 한 칸)');
  assert.equal(await page.evaluate(()=>window.CRM_SCHEDULE_V1===true&&PCInquirySave.route(B.inquiries[0])),true,'운영 기본 = 일정 공통 저장');
  const planOk=o=>o.plan&&o.plan.ok===true&&o.plan.completeCurrent===false&&Array.isArray(o.plan.requests)&&!o.plan.requests.length&&typeof o.plan.note==='string'&&o.plan.note.trim()&&['연결됨','고객 회신','부재','번호오류'].includes(o.contact_result)&&Object.prototype.hasOwnProperty.call(o,'existing');
  /* ① 부재: 결과만 · 상담 칸 없음 · 기존 일정 유지가 기본 · 추가 입력 없이 저장 */
  await comp().locator('[data-idv="ce-res"][data-v="부재"]').click();await page.waitForTimeout(120);
  assert.equal(await comp().locator('textarea,[data-idv="text"]').count(),0,'① 부재 = 상담 내용 칸 없음');
  assert.deepEqual(await comp().locator('[data-idv="ce-mode"]').evaluateAll(l=>l.map(b=>[b.textContent,b.getAttribute('aria-pressed')])),[['다시 연락 · 10.22 · 유지','true'],['날짜 변경','false'],['새 업무','false'],['다음 일정 없음','false']],'기존 일정 유지가 기본');
  assert.equal(await prev(),'저장하면 · 연락 시도 1건 기록 · 기존 일정 유지 · 새 일정 없음');assert.equal(await comp().locator('input[data-idv^="ce-"]').count(),0,'① 추가 입력칸 없음');
  await comp().locator('[data-idv="save"]').click();await page.waitForFunction(()=>__cmd.length===1);
  let c=await last();assert.equal(c[0],'pc_save');assert.ok(planOk(c[1]),'공통 계획 그대로: '+JSON.stringify(c[1]));assert.deepEqual([c[1].result,c[1].contact_result,c[1].text,c[1].plan.mode,c[1].plan.next,c[1].plan.change,c[1].plan.attempt],['부재','부재','','keep',null,null,true],'① 부재 저장 = 결과만 · 기존 일정 그대로');
  /* ② 연결됨: 이번에 확인한 내용 한 칸(필수) / ③ 날짜 변경 = 같은 업무의 날짜만 */
  await open(1);await comp().locator('[data-idv="ce-res"][data-v="연결됨"]').click();await page.waitForTimeout(120);
  assert.equal(await comp().locator('textarea').count(),1,'② 상담 내용 칸 하나');assert.equal(await comp().locator('input[data-idv="text"]').count(),0);
  assert.match(await prev(),/^상담 내용을 한 줄 적어 주세요/,'실제 연결이면 확인한 내용 필수');assert.equal(await comp().locator('[data-idv="save"]').isDisabled(),true);
  await comp().locator('textarea').fill('최상층 3세대 누수 · 다음 주 방문 가능');
  await comp().locator('[data-idv="ce-mode"][data-v="change"]').click();await page.waitForTimeout(120);
  await comp().locator('[data-idv="ce-date"]').fill('2026-10-25');await page.waitForTimeout(150);
  assert.equal(await prev(),'날짜 변경 사유를 입력해 주세요','날짜 변경은 사유');
  await comp().locator('[data-idv="ce-reason"]').fill('고객 요청 · 입대의 뒤');await page.waitForTimeout(80);
  assert.match(await prev(),/^저장하면 · 응대 기록 1건 저장 \(실제 연결\) · 기존 일정 "다시 연락" 날짜만 변경 · 10\.25 \(일\)/);
  await comp().locator('[data-idv="save"]').click();await page.waitForFunction(()=>__cmd.length===2);
  c=await last();assert.ok(planOk(c[1]));assert.deepEqual([c[1].result,c[1].plan.mode,c[1].plan.next,c[1].plan.change&&c[1].plan.change.id,c[1].plan.change&&c[1].plan.change.text,c[1].plan.change&&c[1].plan.change.due],['연결됨','change',null,'44444444-4444-4444-8444-000000000001','다시 연락','2026-10-25'],'③ 날짜 변경 = 같은 업무(같은 번호) · 새 업무 없음');
  assert.equal(c[1].text,'최상층 3세대 누수 · 다음 주 방문 가능','② 상담 내용 한 번');assert.equal(await page.evaluate(o=>{const m=InquiryFlow.TWO.of('연결됨','관심 있음');return o.result===m.res&&o.contact_result===m.contact_result&&o.customer_reaction==='';},c[1]),true,'⑤ 모바일 응대와 같은 결과 변환');
  /* 새 업무는 기존 일정을 남기고 따로(공통 저장 경로) */
  await open(1);await comp().locator('[data-idv="ce-res"][data-v="회신 받음"]').click();await comp().locator('textarea').fill('자료 요청');await comp().locator('[data-idv="ce-mode"][data-v="new"]').click();await page.waitForTimeout(120);
  assert.match(await prev(),/^저장하면 · 응대 기록 1건 저장 \(실제 연결\) · 다시 연락 일정 1건 등록/,'새 업무 = 따로 등록(기존 일정 보존)');
  /* 기록 없는 문의: 회색(지연 판정 아님) · 부재 = 결과만(다음 일정 없음도 사유 없이) · 첫 연락 화면에 방문 · 견적 단계 없음 */
  await open(2);
  const pill=one(await D.locator('.idv3-top .idv3-pill').last().innerText());assert.match(pill,/^CRM 연락 기록 없음 · 접수 1\d\d일$/,pill);assert.equal(await D.locator('.idv3-top .idv3-pill.gray').count()>=1,true,'기록 없음 = 회색');
  await comp().locator('[data-idv="ce-res"][data-v="부재"]').click();await page.waitForTimeout(120);
  assert.equal(await prev(),'저장하면 · 연락 시도 1건 기록 · 다음 일정 없음','기존 일정이 없으면 부재 = 결과만');assert.equal(await comp().locator('input[data-idv^="ce-"]').count(),0);
  await comp().locator('[data-idv="save"]').click();await page.waitForFunction(()=>__cmd.length===3);c=await last();assert.ok(planOk(c[1]));assert.deepEqual([c[1].result,c[1].plan.mode,c[1].existing],['부재','none',null]);
  assert.doesNotMatch(one(await D.locator('.idv3-c3').innerText()),/지금 할 일|방문 결과 기록|견적 진행 기록/,'오른쪽 = 지도 중심 · 첫 연락 화면에 방문 · 견적 단계 없음');
  assert.match(one(await D.locator('.idv3-c1').innerText()),/현장 정보 이어받음 · 누르면 수정 .*알게 되면 보완 \d+개 · 펼치기/,'현장 정보 이어받음 · 보완 정보는 접힘(저장 필수 아님)');  if(process.env.IR_SHOT){await open(1);await comp().locator('[data-idv="ce-res"][data-v="연결됨"]').click();await page.waitForTimeout(150);await page.screenshot({path:process.env.IR_SHOT});}
  /* ④ 문의 요청은 연락 한 번으로 자동 완료되지 않음(요청 엔진 근거 판정) */
  assert.equal(await page.evaluate(()=>WorkRequest.evidence({id:'r1',target_type:'inquiry',target_id:__id(1),kind:'follow',label:'후속 연락 요청',asks:['후속 연락','견적 범위 확인'],status:'sent',created_at:'2026-10-19T00:00:00Z'})),null,'④ 문의 요청 = 연락 기록만으로 완료 안 됨');
  /* 끄기 */
  await page.evaluate(()=>{InquiryWorkbench.close();G.inqTidyOff=true;});await open(1);assert.equal(await D.locator('[data-idv="ce-res"]').count(),0,'끄기 = 예전 입력');
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',checks:['① 부재 = 결과만','② 상담 내용 한 번','③ 날짜 변경 = 같은 업무','④ 문의 요청 자동 완료 없음','⑤ PC · 모바일 같은 값 · 같은 계획'],writes:0}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
