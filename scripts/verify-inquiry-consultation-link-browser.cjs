'use strict';
/* 상담 연결 · 표시 위치 (2026-10-06 design_handoff_consultation_link · 시안 '상담 연결 위치 시안.dc.html') — 합성 문의 2건(이름 · 번호는 지어낸 것) + 가짜 서버(미리보기 · 쓰기)
   확인: ① 문의 비교 창 footer 의 예전 [연결만] 자리 = [같은 상담으로 연결](관리자만 · 옛 inquiry_activity 버튼 없음) → 근거 체크 3 + 메모 → 3개 모두 체크해야 [저장] → 재조회 결과로 '✓ 연결됨' · 버튼 [연결 해제]
        ② v4 오른쪽 상세 머리 아래 연결 줄(상대 브랜드 · 현장 · 담당 · 상태 · [열기] · [해제]) · [열기] = 상대 문의로
        ③ 전체 상세: 연결 줄 + 응대 이력 토글 [이 문의 | 연결된 상담] · 두 문의 기록 합침 · 브랜드 꼬리표 · [해제] 사유 필수 → 해제 뒤 줄 사라짐
        ④ 서버 거절(STALE_PREVIEW) = 창 안 한 줄 · 완료 표시 없음 ⑤ 일반 담당자 = 버튼 없음 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';/* 두 번째 인자 = 캡처 저장 폴더(없으면 캡처 안 함) */
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryConsultationLink&&window.InquiryConsultationClient&&window.DupV2&&window.InquiryV4&&window.InquiryDetailV2&&window.InquiryWorkbench&&window.DataCleanupUI&&typeof goPage==='function');
  await page.evaluate(()=>{
   const at=(d,h)=>new Date(Date.now()-d*864e5-(h||0)*36e5).toISOString();
   const A='aaaaaaaa-1111-4111-8111-111111111111',P='bbbbbbbb-2222-4222-8222-222222222222';window.A=A;window.P=P;
   B={deals:[],inquiries:[
    {id:A,site:'[서울 강동] 성내스테이',status:'배정완료',at:at(0,6),created_at:at(0,6),brand:'POUR솔루션',phone:'010-4400-1750',contact_name:'김소장',assignee:'이필선',assigned_to:'이필선',assigned_at:at(0,5),responded_at:at(0,2),address:'서울 강동구 성내로 54',raw:{'문의내용':'누수 관련 견적문의','상담채널':'홈페이지','건물주소':'서울 강동구 성내로 54'},activities:[{id:'ev-a1',type:'전화',note:'기존 인젝션 부위 재누수 · 가능한 공법 설명',at:at(0,2),actor:'이필선'}]},
    {id:P,site:'[서울] 성내스테이',status:'접수',at:at(0,5),created_at:at(0,5),brand:'POUR공법',phone:'010-4400-1618',contact_name:'관리소장',address:'서울시 강동구 성내로 54',raw:{'문의내용':'1층~지하2층 누수, 방문견적 요청','상담채널':'구글시트','건물주소':'서울시 강동구 성내로 54'}}],
    activities:[],inquiryTrash:[],inquiryCleanupArchived:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   /* 가짜 서버: 미리보기 · 쓰기(버전 검사) — 계정은 UUID */
   const PV='crm_inquiry_consultation_preview_v1',WR='crm_inquiry_consultation_write_v1';
   window.SRV={active:false,version:0,at:'',calls:[],deny:''};
   window.CRM_RPC_ALLOW=[PV,WR];
   /* Phase1 은 얼어 있는 객체(profile 은 getter) — 검사에서는 같은 모양의 가짜로 바꿔 끼운다 */
   const O=window.Phase1;window.Phase1=Object.assign({},O,{queue:O.queue,profile:{auth_uid:'cccccccc-3333-4333-8333-333333333333',user_id:'dddddddd-4444-4444-8444-444444444444',permission_role:'admin'},storage:window.localStorage});
   Phase1.rpc=async(n,a)=>{SRV.calls.push([n,JSON.parse(JSON.stringify(a))]);
    if(n===PV){const l=a.p_left,r=a.p_right;return {ok:true,left_id:l,right_id:r,active:SRV.active,expected:{relationship_version:SRV.version,rows:{[l]:'v'+SRV.version,[r]:'v'+SRV.version}},inquiries:[{id:l},{id:r}],linked_at:SRV.active?SRV.at:null,linked_by:SRV.active?'송보람':null};}
    if(n===WR){if(SRV.deny){const e=new Error(SRV.deny);e.code='PT409';throw e;}if(a.p_expected.relationship_version!==SRV.version){const e=new Error('STALE_PREVIEW');e.code='PT409';throw e;}SRV.active=a.p_operation==='link';SRV.version++;SRV.at=new Date().toISOString();return {ok:true,request_id:a.p_request_id,left_id:a.p_left,right_id:a.p_right,operation:a.p_operation,active:SRV.active,event_id:crypto.randomUUID(),version:SRV.version,saved_at:SRV.at};}
    throw new Error('CONTRACT_UNAVAILABLE');};
   /* 비교 창: 데이터 정리 후보 하나(문의 ↔ 문의 · 애매) */
   const q=B.inquiries,row=(x,i)=>({ref:{type:'inquiry',id:x.id},name:x.site,address:x.address,at:x.created_at,mobile:x.phone.replace(/\D/g,''),customer:x.contact_name,owner:x.assignee||'',brand:x.brand,raw:x.raw});
   window.CASE={key:'inq|'+A+'|'+P,type:'inquiry',action:'defer',reasons:['주소 표기 정규화 일치','다른 브랜드','1일 이내 문의 접수'],text:'공사 범위 확인 필요',a:row(q[0]),b:row(q[1])};
   DataCleanupUI.cases=()=>[CASE];DataCleanupUI.active=()=>[CASE];DataCleanupUI.readOnly=()=>false;DataCleanupUI.state=()=>({reviews:[]});
   goPage('inq');
  });
  await page.waitForTimeout(400);
  const D=page.locator('#dupDialog');
  const footTexts=()=>D.locator('.dv-foot button').evaluateAll(l=>l.map(b=>b.textContent.trim()));
  /* ① 비교 창: [연결만] 자리 = [같은 상담으로 연결] · 옛 버튼 없음 */
  await page.evaluate(()=>DupV2.open(0));await page.waitForSelector('#dupDialog.on .dv-foot [data-icl="link"]:not([disabled])',{timeout:5000});
  assert.deepEqual(await footTexts(),['다른 건 · 그대로 두기','같은 상담으로 연결','현장만 묶기','합치기 실행']);
  assert.equal(await D.locator('[data-dd="inquiry_activity"]').count(),0,'옛 연결만 버튼 없음');
  assert.equal(await D.locator('.icl-pane').count(),0,'누르기 전엔 근거 칸 없음: '+(await D.locator('.icl-pane').allInnerTexts()).join(' / '));
  await D.locator('[data-icl="link"]').click();
  assert.equal(await D.locator('.icl-pane .icl-ck').count(),3);
  assert.deepEqual(await D.locator('.icl-pane .icl-ck').evaluateAll(l=>l.map(b=>b.textContent.trim())),['같은 주소(표기만 다름)','같은 공사 요청','고객 · 담당자 확인']);
  assert.equal(await D.locator('.dv-foot [data-icl="save-link"]').isDisabled(),true,'체크 전엔 저장 잠김');
  assert.ok((await D.locator('.icl-pane').evaluate(n=>n.compareDocumentPosition(n.parentElement.querySelector('.dv-foot'))))&4,'근거 칸은 footer 위');
  for(let i=0;i<3;i++)await D.locator('.icl-ck').nth(i).click();
  assert.equal(await D.locator('.dv-foot [data-icl="save-link"]').isDisabled(),false,'3개 체크 → 저장 열림');
  await D.locator('[data-icl="memo"]').fill('고객이 같은 누수 건이라고 설명');
  if(shot)await page.screenshot({path:path.join(shot,'consult-1-compare-form.png')});
  await D.locator('.dv-foot [data-icl="save-link"]').click();
  await page.waitForSelector('#dupDialog .icl-done',{timeout:5000});
  if(shot)await page.screenshot({path:path.join(shot,'consult-2-compare-linked.png')});
  assert.match(one(await D.locator('.icl-done').innerText()),/^✓ 같은 상담으로 연결됨 .*송보람 · 서버 재조회 확인$/);
  assert.deepEqual(await footTexts(),['다른 건 · 그대로 두기','연결 해제','현장만 묶기','합치기 실행']);
  const calls=await page.evaluate(()=>SRV.calls.map(c=>c[0]+(c[1].p_operation?':'+c[1].p_operation:'')));
  assert.deepEqual(calls,['crm_inquiry_consultation_preview_v1','crm_inquiry_consultation_write_v1:link','crm_inquiry_consultation_preview_v1'],'미리보기 → 쓰기 → 재조회');
  assert.equal(await page.evaluate(()=>SRV.calls[1][1].p_reason),'같은 주소(표기만 다름) · 같은 공사 요청 · 고객 · 담당자 확인 · 고객이 같은 누수 건이라고 설명');
  assert.equal(await page.evaluate(()=>[B.inquiries[0].assignee,B.inquiries[1].assignee||'',B.inquiries[0].status,B.inquiries[1].status].join('|')),'이필선||배정완료|접수','연결만으로 담당 · 상태 변화 없음');
  await page.evaluate(()=>DupV2.close());
  /* ② v4 오른쪽 상세: 머리 아래 연결 줄 · [열기] = 상대 문의 */
  await page.evaluate(()=>InquiryV4.select(A));await page.waitForSelector('#inq-v4 .i4-detail .icl-box .icl-line',{timeout:5000});
  const V=page.locator('#inq-v4 .i4-detail');
  assert.equal(await V.locator('.icl-box').evaluate(n=>n.previousElementSibling.matches('header.i4-dh')),true,'머리 바로 아래');
  assert.match(one(await V.locator('.icl-line').first().innerText()),/^같은 상담으로 연결됨 POUR공법 \[서울\] 성내스테이 · 미배정 · 접수 열기 .*송보람 해제$/);
  if(shot)await page.screenshot({path:path.join(shot,'consult-3-v4-line.png')});
  await V.locator('[data-icl="open"]').click();await page.waitForFunction(()=>InquiryV4.selected()===P);
  await page.waitForFunction(()=>/POUR솔루션/.test(document.querySelector('#inq-v4 .i4-detail .icl-line')?.textContent||''));
  assert.match(one(await V.locator('.icl-line').first().innerText()),/POUR솔루션 \[서울 강동\] 성내스테이 · 이필선 · 배정완료/);
  /* ③ 전체 상세: 연결 줄 + 토글 [이 문의 | 연결된 상담] · 합친 기록 · 꼬리표 */
  await page.evaluate(()=>InquiryWorkbench.open(A));await page.waitForSelector('#inq-inbox-dialog.idv3 .inq-dialog>.icl-box .icl-line',{timeout:5000});
  const F=page.locator('#inq-inbox-dialog');
  assert.equal(await F.locator('.inq-dialog>.icl-box').evaluate(n=>n.previousElementSibling.classList.contains('idv3-top')),true);
  assert.deepEqual(await F.locator('.idv3-chead .isd-scope [role=tab]').evaluateAll(l=>l.map(b=>b.textContent.trim()+':'+b.getAttribute('aria-selected'))),['이 문의:true','연결된 상담:false']);
  await F.locator('.idv3-chead [data-icl="scope"][data-v="link"]').click();await page.waitForSelector('#inq-inbox-dialog .idv3-thread[data-icl="link"]',{timeout:3000});
  const tags=await F.locator('.idv3-thread .idv3-ev .icl-tag').evaluateAll(l=>l.map(b=>b.textContent.trim()));
  assert.ok(tags.includes('POUR솔루션')&&tags.includes('POUR공법'),'두 문의 기록이 함께 · 브랜드 꼬리표 '+tags.join(','));
  assert.ok(/두 문의의 기록을 원본 사건 기준으로 합침/.test(await F.locator('.idv3-thread').innerText()));
  assert.deepEqual(await F.locator('.idv3-chead .isd-scope [role=tab]').evaluateAll(l=>l.map(b=>b.getAttribute('aria-selected'))),['false','true']);
  if(shot)await page.screenshot({path:path.join(shot,'consult-4-full-linked-scope.png')});
  await F.locator('.idv3-chead [data-icl="scope"][data-v="now"]').click();await page.waitForFunction(()=>{const t=document.querySelector('#inq-inbox-dialog .idv3-thread');return t&&!t.dataset.icl;});
  /* [해제]: 사유 필수 → 해제 뒤 줄 사라짐 · 서버 호출 unlink */
  await F.locator('[data-icl="unlink-d"]').click();await page.waitForSelector('#inq-inbox-dialog [data-icl="reason-d"]');
  assert.equal(await F.locator('[data-icl="save-unlink-d"]').isDisabled(),true,'사유 전엔 잠김');
  await F.locator('[data-icl="reason-d"]').fill('다른 동 · 별개 공사로 확인');
  assert.equal(await F.locator('[data-icl="save-unlink-d"]').isDisabled(),false);
  await F.locator('[data-icl="save-unlink-d"]').click();await page.waitForFunction(()=>!document.querySelector('#inq-inbox-dialog .icl-box'),null,{timeout:5000});
  assert.equal(await page.evaluate(()=>SRV.active),false);
  assert.deepEqual(await page.evaluate(()=>{const w=SRV.calls.filter(c=>c[0].endsWith('write_v1')).pop()[1];return [w.p_operation,w.p_reason];}),['unlink','다른 동 · 별개 공사로 확인']);
  assert.equal(await F.locator('.idv3-chead .isd-scope').count(),0,'해제하면 토글도 사라짐(단지 이력 없음)');
  await page.evaluate(()=>InquiryWorkbench.close());
  /* ④ 서버 거절 = 창 안 한 줄 · 완료 표시 없음 */
  await page.evaluate(()=>{SRV.deny='STALE_PREVIEW';DupV2.open(0);});await page.waitForSelector('#dupDialog.on .dv-foot [data-icl="link"]:not([disabled])',{timeout:5000});
  await D.locator('[data-icl="link"]').click();for(let i=0;i<3;i++)await D.locator('.icl-ck').nth(i).click();await D.locator('.dv-foot [data-icl="save-link"]').click();
  await page.waitForSelector('#dupDialog .icl-err',{timeout:5000});
  assert.equal(one(await D.locator('.icl-err').innerText()),'다른 곳에서 먼저 바뀐 자료입니다 — 창을 닫고 다시 열어 확인해 주세요');
  assert.equal(await D.locator('.icl-done').count(),0,'거절이면 완료 표시 없음');
  assert.equal(await page.evaluate(()=>SRV.active),false);
  await page.evaluate(()=>{SRV.deny='';DupV2.close();});
  /* 다시 연결(정상) → ⑤ 일반 담당자: 비교 창 버튼 없음 · 상세 줄은 보이되 [해제] 없음 */
  await page.evaluate(()=>DupV2.open(0));await page.waitForSelector('#dupDialog.on .dv-foot [data-icl="link"]:not([disabled])');
  await D.locator('[data-icl="link"]').click();for(let i=0;i<3;i++)await D.locator('.icl-ck').nth(i).click();await D.locator('.dv-foot [data-icl="save-link"]').click();await page.waitForSelector('#dupDialog .icl-done');
  await page.evaluate(()=>{DupV2.close();ME={id:'rep',name:'이필선',role:'rep'};DupV2.open(0);});await page.waitForSelector('#dupDialog.on');
  assert.deepEqual(await footTexts(),['다른 건 · 그대로 두기','현장만 묶기','합치기 실행'],'일반 담당자는 연결 버튼 없음');
  assert.equal(await D.locator('[data-dd="inquiry_activity"]').count(),0);
  await page.evaluate(()=>{DupV2.close();InquiryV4.select(A);InquiryV4.render();});await page.waitForSelector('#inq-v4 .i4-detail .icl-line');
  assert.equal(await V.locator('[data-icl="unlink-d"]').count(),0,'일반 담당자 줄에는 [해제] 없음');
  assert.match(one(await V.locator('.icl-line').first().innerText()),/같은 상담으로 연결됨 POUR공법/);
  assert.deepEqual(errs,[]);
  console.log('verify-inquiry-consultation-link: OK');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
