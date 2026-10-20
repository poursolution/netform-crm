'use strict';
/* 파이프라인 7단계 · 지금 응대 중심 (2026-10-20 design_handoff_pipeline_7stage_rules · 시안 '파이프라인 상세 · 지금 응대 중심') — 합성 자료(이름 · 금액 · 날짜는 지어낸 것)
   확인: ① 상단 단계 띠 = 6칸(5단계 + 수주 | 실주 한 칸) · 지금 파랑 · 지나온 ✓ · 칸마다 근거 한 줄
         ② 불일치 5건: 컨설팅 목록 = 상세 · 경쟁 연락 업무의 완료 조건 ≠ 접수증 · 수주 정보 = '수정' 창(새 확정 X) · 실주 [사유 기록] = 실주 기록 입력으로 바로 · 재영업 '미정' = 기록 완료
         ③ 왼쪽 = 배경만(누구와 · 결정 미확인 · 이 현장 · 링크 한 줄 / 0건 칸 · 미입력 줄 · PC 전화 · 문자 없음)
         ④ 가운데 = 연 업무 하나 + 저장 하나(일반 응대 입력 같이 안 뜸) · 발송 확인: 후보만으로 저장 X · 보냈음 → 발송일 · 받는 분 · 자료 / 안 보냄 / 확인 불가
         ⑤ 오른쪽 = 상황 한 문장 · 판단 순서(지금 파랑) · 다음 업무 '확인 뒤 정해짐' · 응대 이력 = 접수 · 연락 시도 · 실제 연결 / 수주 창 문구 · 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(require('../review-preview/review-environment.cjs').launchOptions()),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealFrame7&&window.DealSame&&window.SiteHistory&&window.DealWin&&window.PipelineStageB&&window.PipelineJudge&&window.InlineFix&&window.ListPager);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const id=n=>'2222222'+n+'-2222-4222-8222-222222222222';
   const act=(i,type,note,at,who)=>({id:i,type,note,at,actor:who||'이필선',meaningful:true});
   const mk=(n,site,code,extra)=>Object.assign({id:id(n),site,assignee:'이필선',brand:'POUR솔루션',created:'2026-06-22',code,stage_code:code,amt:57400000,manager_name:'임석재',manager_mobile:'01052493880',contacts:[{person_key:'mobile:01052493880',name:'임석재',role:'관리소장',mobile:'01052493880',status:'current'}],activities:[]},extra||{});
   B={deals:[
    mk(0,'[경기 안양] 미팅 기록 없는 컨설팅','consulting',{next_action:{id:'n0',text:'견적 요청 등록',type:'후속접촉',due:day(-7),status:'open'}}),
    mk(1,'[경기 평택] 오뚜기 포승공장','sent',{address:'경기 평택시 포승읍 포승공단',activities:[act('a11','이메일','포승공장 견적서 첨부 발송',day(-20)+'T11:00:00+09:00'),act('a12','메모','자료 바로 발송하기로 함',day(-21)+'T09:00:00+09:00'),act('a13','전화','임석재 소장 · 부재',day(-10)+'T15:28:00+09:00')]}),
    mk(2,'[경기 평택] 안 보낸 발송 단지','sent',{activities:[act('a21','메모','자료 보내기로 함',day(-5)+'T09:00:00+09:00')]}),
    mk(3,'[경기 고양] 햇빛마을23단지','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:day(5)}}},next_action:{id:'n3',text:'재통화 시도',type:'전화',due:day(1),status:'open'}}),
    mk(4,'[경기 용인] 수지삼성래미안','won',{outcome:'won',won_amount:140000000,closed_at:'2026-03-12',amt:140000000}),
    mk(5,'[대구] 강북이진캐스빌','lost',{outcome:'lost',closed_at:'2026-05-07'}),
    mk(6,'[대구] 사유 기록된 실주 단지','lost',{outcome:'lost',closed_at:'2026-05-08',stage_contexts:{lost:{fields:{close_reason:'공사 시기 연기·취소',reengage:'미정'}}}}),
    mk(7,'[경기 평택] 평택비전지웰푸르지오','contract',{amt:1120000000,stage_contexts:{contract:{fields:{contract_date:'2026-01-26',contract_amount:1043900000}}}})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.pushWrite=()=>'req';window.__rpc=[];
   SB={rpc:async(n,a)=>{__rpc.push([n,a]);if(n==='crm_deal_win_list_v1')return {data:{ok:true,rows:[],advisory:[]}};
    if(n==='crm_deal_stage_fields_update_v1'||n==='crm_deal_closed_info_update_v1'){const p=a.p||{},dd=B.deals.find(x=>x.id===(p.deal_id||p.opportunity_id)),code=p.stage_code||'sent',cur=((dd&&dd.stage_contexts||{})[code]||{}).fields||{};return {data:{ok:true,deal_id:p.deal_id,fields:p.fields||{},version:2,stage_context:{to:code,fields:Object.assign({},cur,p.fields||{})}}};}
    return {data:{ok:true,tasks:[],entries:[],sites:[],requests:[],links:[],rows:[]}};}};TOKEN='test';OpsStore.aiOn=()=>false;
   window.__open=async(i)=>{try{closeDetail();}catch(e){}await DealWin.load();drwDeal(JSON.stringify(B.deals[i]));};
  });
  const V=page.locator('#detailView');
  const open=async i=>{await page.evaluate(i=>window.__open(i),i);await page.waitForSelector('#detailView.dv8 .dvs-task .dv8-lb');await page.waitForTimeout(500);};
  const snap=()=>page.evaluate(()=>{const v=document.getElementById('detailView'),t=s=>{const n=v.querySelector(s);return n&&n.offsetParent!==null?n.innerText.replace(/\s+/g,' ').trim():null;},vis=n=>!!n&&getComputedStyle(n).display!=='none'&&n.offsetParent!==null;
   const dr=v.querySelector('.dv7-drawer');
   return {steps:[...v.querySelectorAll('.dv8-steps>div')].map(n=>[n.className,n.querySelector('b').textContent,n.querySelector('span').textContent]),
    sit:t('.dv8-sit'),due:t('.dv8-due'),seq:[...v.querySelectorAll('.dv8-seq>div')].map(n=>[n.className,n.textContent.trim()]),next:t('.dv8-next'),ai:t('.dvs-task .dv7-ai'),
    open:[...v.querySelectorAll('.dvs-task .dv8-open')].filter(vis).map(b=>b.textContent.trim()),
    drawer:dr&&!dr.hidden?dr.dataset.p:'',title:t('.dv7-phead .t>b'),sub:t('.dv7-phead .t>span'),now:t('.dv8-now'),
    composer:vis(v.querySelector('#ddvComposer')),
    left:t('.dv8-left'),leftCall:[...v.querySelectorAll('.dw-left [data-dv3="call"],.dw-left [data-dv3="sms"]')].filter(vis).length,links:[...v.querySelectorAll('.dv8-links button')].map(b=>b.textContent.trim()),
    hist:t('.ddv-talk .idv-chead')};});
  /* ① 컨설팅(미팅 기록 없음 · 다음 업무는 '견적 요청 등록'): 목록 할 일 = 상세 할 일 · 근거 확정 전엔 다음 업무 '확인 뒤 정해짐' */
  await open(0);let s=await snap();
  const li0=await page.evaluate(()=>{const x=PipelineStageB.itemOf('consulting',B.deals[0]);return {task:x.task,why:x.why};});
  assert.equal(li0.why,'미팅 여부 확인 필요');assert.equal(s.now.split(' 저장하면 끝남')[0],li0.task,'① 컨설팅: 상세 할 일 = 목록 할 일(예전: 목록 미팅 확인 ↔ 상세 견적 요청 등록)');
  assert.doesNotMatch(s.now,/견적 요청 등록/);
  assert.equal(s.sit,'컨설팅 설계 단계지만 미팅 진행 여부가 확인되지 않음');assert.match(s.next,/미팅 확인 뒤 정해짐/);assert.equal(s.ai,null);
  assert.deepEqual(s.steps.map(x=>[x[0],x[1]]),[['cur','컨설팅 설계'],['todo','자료 발송완료'],['todo','관계관리'],['todo','경쟁 · 입찰'],['todo','계약 · 시공'],['todo','수주 | 실주']],'단계 띠 6칸 · 수주 | 실주 한 칸');
  assert.equal(s.steps[5][2],'결과 전');assert.equal(s.drawer,'','연락 업무는 업무 화면 없이 가운데 응대 입력칸이 그 업무');assert.equal(s.composer,true);
  assert.deepEqual(s.seq.map(x=>x[0]),['cur','','','']);
  /* ② 자료 발송완료(발송일 없음): 열자마자 가운데 = 발송 내역 확인 하나 · 일반 입력칸 같이 안 뜸 · 후보 '근거 있음' / '약속일 뿐' */
  await open(1);s=await snap();
  assert.deepEqual(s.steps.slice(0,2).map(x=>[x[0],x[1],x[2]]),[['done','✓ 컨설팅 설계','2026.6.22 등록'],['cur','자료 발송완료','발송 근거 확인 전']]);
  assert.equal(s.drawer,'work');assert.equal(s.title,'발송 내역 확인');assert.match(s.sub,/^저장하면 끝남 · 실제 발송 여부 확정/);assert.equal(s.composer,false,'업무 화면이 열려 있으면 일반 응대 입력은 숨김');
  assert.equal(s.sit,'자료 발송완료 단계지만 발송 근거가 없음');assert.match(s.next,/^다음 업무 발송 확인 뒤 정해짐$/);assert.deepEqual(s.open,[],'가운데에 업무가 열려 있으면 오른쪽 주 버튼 없음');
  assert.deepEqual(s.seq.map(x=>x[1]),['1기존 발송 근거 확인','2실제 발송 여부 확정','3보냈으면 수령 · 반응 확인 / 안 보냈으면 발송 준비','4후속 업무 연결']);assert.equal(s.seq[0][0],'cur');
  const cands=await V.locator('.dv8-cand').evaluateAll(l=>l.map(b=>[b.querySelector('b').textContent,b.querySelector('em').textContent]));
  assert.deepEqual(cands.map(c=>c[1]),['보냄 · 근거 있음','약속일 뿐'],'찾은 기록 = 후보 표식');
  /* 왼쪽 = 배경만 */
  /* 2026-10-20 대표: 같은 단지 영업은 예전 '이 단지 영업 이력' 상자(지금 영업건 / 이 단지 지난 영업 n · 줄마다 날짜 · 결과 · 금액)를 왼쪽에 그대로 — 줄인 단추 대신 */
  assert.match(s.left,/^누구와 이야기하나 임석재 관리소장 · 연락 상대 010-5249-3880 결정 미확인 이 현장 경기 평택시 포승읍 포승공단 지금 영업건 .*지금 이 건 .*이 단지 지난 영업 0 없음 · 첫 영업/);
  assert.doesNotMatch(s.left,/미입력|자료 0|다른 연락처 0|같은 현장 진행/);assert.equal(await V.locator('.dv8-left .sth').count(),1,'왼쪽 = 이 단지 영업 이력 상자');assert.equal(s.leftCall,0,'PC 전화 · 문자 버튼 없음');assert.deepEqual(s.links,['연락처 · 관계자','현장 정보','자료','이력 추가']);
  assert.match(s.hist,/접수 0 · 연락 시도 2 · 실제 연결 0$/,'응대 이력 = 접수 · 연락 시도 · 실제 연결 따로');
  /* 후보만 고르면 저장 안 됨 → [보냈음] + 발송일 · 받는 분 · 자료 */
  await V.locator('.dv8-cand').first().click();await page.waitForTimeout(150);
  assert.equal(await V.locator('[data-dv3="wsave"][data-row="sendv"]').isDisabled(),true,'후보를 골라도 실제 발송 여부를 고르기 전엔 저장 불가');
  await V.locator('[data-dv3="wpick"][data-f="sent"][data-v="보냈음"]').click();await page.waitForTimeout(150);
  assert.equal(await V.locator('[data-dv3f="recipient"]').inputValue(),'임석재 관리소장');
  await V.locator('[data-dv3="wsave"][data-row="sendv"]').click();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>__rpc.filter(c=>c[0]==='crm_deal_stage_fields_update_v1').length),0,'보낸 자료를 안 고르면 저장하지 않는다');
  await V.locator('[data-dv3="wmulti"][data-v="견적서"]').click();await page.waitForTimeout(150);
  await V.locator('[data-dv3="wsave"][data-row="sendv"]').click();await page.waitForTimeout(400);
  const sv=await page.evaluate(()=>__rpc.filter(c=>c[0]==='crm_deal_stage_fields_update_v1').map(c=>c[1].p.fields));
  assert.equal(sv.length,1);assert.deepEqual(Object.keys(sv[0]).sort(),['materials','recipient','sent_basis','sent_date','sent_state']);assert.deepEqual(sv[0].materials,['견적서']);assert.equal(sv[0].sent_state,'보냄');assert.match(sv[0].sent_basis,/^이메일 /);
  s=await snap();assert.equal(s.drawer,'','저장하면 그 업무만 끝나고 닫힌다');assert.match(s.sit,/^자료 발송 \d+\.\d+ · 임석재 관리소장 · 고객 반응 기록 전$/);assert.match(s.now,/^수령 · 반응 확인 저장하면 끝남 · 고객 반응 결과 기록/);assert.equal(s.composer,true);
  /* 링크 = 가운데 패널(연락처 · 관계자) · 닫으면 입력칸 */
  await V.locator('.dv8-links [data-v="people"]').click();await page.waitForTimeout(200);s=await snap();
  assert.equal(s.drawer,'people');assert.equal(s.composer,false);assert.match(await V.locator('.dv7-drawer .dv8-pn').innerText(),/다른 연락처/);
  await V.locator('[data-dv3="p7close"]').click();await page.waitForTimeout(150);assert.equal((await snap()).composer,true);
  /* 안 보냄 → 발송 준비 업무 · 확인 불가는 확인한 곳 필수 */
  await open(2);await V.locator('[data-dv3="wpick"][data-f="sent"][data-v="확인 불가"]').click();await page.waitForTimeout(150);
  await V.locator('[data-dv3="wsave"][data-row="sendv"]').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__rpc.filter(c=>c[0]==='crm_deal_stage_fields_update_v1').length),1,'확인 불가는 어디까지 확인했는지 적어야 저장');
  await V.locator('[data-dv3="wpick"][data-f="sent"][data-v="안 보냄"]').click();await page.waitForTimeout(150);
  await V.locator('[data-dv3="wsave"][data-row="sendv"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(c=>c[0]==='crm_deal_stage_fields_update_v1').map(c=>c[1].p.fields)[1]),{sent_state:'안 보냄'});
  /* ③ 경쟁 · 입찰: 다음 업무가 '재통화 시도'면 완료 조건 = 연락 결과(제출 접수증 아님) */
  await open(3);s=await snap();
  assert.match(s.now,/^재통화 시도 저장하면 끝남 · 연락 결과 기록 \(입찰 제출 완료와 별개\)$/);assert.doesNotMatch(s.now,/접수증/);assert.equal(s.drawer,'');
  /* ④ 수주(결과 정보 빠짐): 목록 [수주 정보] = '수주 정보 수정' 창(새 확정 X) · 상세 가운데 = 수주 결과 · 사후 연락은 확장관리 */
  const li4=await page.evaluate(()=>PipelineStageB.itemOf('won',B.deals[4]));assert.deepEqual(li4.btn,['수주 정보','win']);
  await open(4);s=await snap();
  assert.equal(s.drawer,'work');assert.equal(s.title,'수주 정보 보완');assert.match(s.sub,/새 수주 · 실적은 생기지 않음/);
  assert.deepEqual(s.steps.map(x=>x[0]),['done','done','done','done','done','cur']);assert.equal(s.steps[5][1],'수주');
  assert.match(await V.locator('.dv7-drawer .dv7-work').innerText(),/계약실적 \(원장\)\s*원장 미등록\s*계약금액 \(영업건 기록\)\s*1억 4,000만원[\s\S]*사후 연락 · 하자 · 추가 공사는 확장관리 업무입니다/);
  await V.locator('[data-dv3="wingo"]').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#wn-dialog header b').innerText(),'수주 정보 수정');assert.equal(await page.locator('#wn-dialog [data-wn="save"]').innerText(),'수정 저장');
  assert.equal(await page.locator('#wn-dialog .wn-note').innerText(),'낙찰금액은 수주 결과(VAT 별도)로 남습니다. 계약실적은 계약 체결일 · 확인된 공사 계약금액 기준으로 따로 집계합니다. 이 영업건의 수주 정보만 고칩니다 — 새 수주 · 실적은 생기지 않습니다.');
  await page.locator('#wn-dialog [data-wn="close"]').first().click();
  /* ⑤ 실주: 목록 [사유 기록] = 실주 기록 입력으로 바로(단계 선택 창 X) · 재영업 '미정' = 기록 완료 */
  const li5=await page.evaluate(()=>PipelineStageB.itemOf('lost',B.deals[5]));assert.deepEqual(li5.btn,['사유 기록','stagefields']);
  await page.evaluate(()=>{try{closeDetail();}catch(e){}PipelineStageB.open(dealKey(B.deals[5]),'stagefields');});await page.waitForSelector('#detailView.dv8 .dvs-task .dv8-lb');await page.waitForTimeout(700);
  s=await snap();assert.equal(s.drawer,'work');assert.equal(s.title,'실주 기록 완성');assert.equal(await V.locator('.dv3-move').evaluate(n=>n.hidden||getComputedStyle(n).display==='none'),true,'단계 바꾸기 창은 열리지 않는다');
  assert.match(s.sub,/재영업 여부\(예 · 아니오 · 미정\)/);
  const li6=await page.evaluate(()=>PipelineStageB.itemOf('lost',B.deals[6]));assert.equal(li6.bucket,'rec','재영업 미정도 기록 완료');assert.equal(li6.rs.includes('relist'),false);
  await open(6);s=await snap();assert.equal(s.sit,'실주 기록 완료 · 재영업 미정');
  /* 계약 · 시공: 계약 정보는 있으나 계약서 없음 = 목록과 같은 '계약서 확인' */
  await open(7);s=await snap();assert.equal(s.title,'계약서 확인');assert.equal(s.sit,'계약 정보는 있으나 계약서 근거가 없음');
  /* 2026-10-20 대표 "명함 캡처 인식이 사라졌다": 새 관리소장 등록 상자에 명함 촬영 · 사진 선택 + 캡처 붙여넣기(연락처 패널과 같은 AI 인식) */
  await open(1);await V.locator('[data-dv3="p7"][data-v="people"]').click();await page.waitForTimeout(400);await V.locator('[data-dv3="replace"]').first().click();await page.waitForTimeout(400);
  assert.equal(await V.locator('.dv3-repl [data-dv3="replcard"]').count(),2,'새 관리소장 등록 = 명함 촬영 · 사진 선택');assert.equal(await V.locator('.dv3-repl input[data-dv3card]').count(),2);assert.match(await V.locator('.dv3-repl .cardst').innerText(),/명함 사진 · 캡처를 넣으면/);
  assert.equal(await page.evaluate(()=>typeof DealPanelsV2.readCard==='function'&&typeof DealPanelsV2.pastedImage==='function'),true,'연락처 패널과 같은 인식 함수');
  if(process.env.DR_SHOT){await open(1);await page.screenshot({path:process.env.DR_SHOT});
   /* 가운데 패널(연락처 · 관계자 → 새 관리소장 등록) · 계약서 확인 주 버튼 — 단추 모양 확인용 */
   await open(7);await page.screenshot({path:process.env.DR_SHOT.replace(/\.png$/,'-contract.png')});
   await V.locator('[data-dv3="p7"][data-v="people"]').click();await page.waitForTimeout(400);const rp=V.locator('[data-dv3="replace"]');if(await rp.count())await rp.first().click();await page.waitForTimeout(400);
   await page.screenshot({path:process.env.DR_SHOT.replace(/\.png$/,'-people.png')});
   const ed=V.locator('[data-dv3="editc"]');if(await ed.count()){await ed.first().click();await page.waitForTimeout(500);await page.screenshot({path:process.env.DR_SHOT.replace(/\.png$/,'-edit.png')});const fo=page.locator('#detailView [data-dp="fillopen"]');if(await fo.count()){await fo.first().click();await page.waitForTimeout(300);await page.screenshot({path:process.env.DR_SHOT.replace(/\.png$/,'-edit2.png')});}console.log('edit panel: fillopen='+await fo.count()+' cardpick='+await page.locator('#detailView [data-card-pick]').count());}
   await V.locator('[data-dv3="p7"][data-v="files"]').click();await page.waitForTimeout(400);await page.screenshot({path:process.env.DR_SHOT.replace(/\.png$/,'-files.png')});}
  /* 끄기: 예전 7칸 막대 · 예전 배치 */
  await page.evaluate(()=>{G.dealRespondOff=true;});await page.evaluate(i=>window.__open(i),1);await page.waitForSelector('#detailView.dv7r .dvs-task .dv7-lb');await page.waitForTimeout(400);
  assert.equal(await V.locator('.dv7-bar').count(),1);assert.equal(await V.locator('.dv8-steps').count(),0);assert.equal(await page.evaluate(()=>document.getElementById('detailView').classList.contains('dv8')),false);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',checks:['단계 띠 6칸','컨설팅 목록 = 상세','발송 확인 후보 · 보냈음 · 안 보냄 · 확인 불가','경쟁 연락 ≠ 접수증','수주 정보 = 수정 창','실주 사유 바로 · 미정 = 완료','계약서 확인','왼쪽 배경 · 링크 패널','끄기']}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
