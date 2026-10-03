'use strict';
/* 파이프라인 상세 오른쪽 작업 패널 4종 검사(2026-10-02 핸드오프 pipeline 추가): 연락처 등록 · 공종 분류 · 메시지 보내기 · 관리정보 수정.
   전부 상세 오른쪽 열 자리에서 열리고(화면 위 창 없음), 저장은 기존 경로(contact_upsert · Phase11.save · 관계관리 메시지 · 단계 정보 RPC). 쓰기는 가로챈다 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealPanelsV2&&window.DealDetailV2&&window.PipelineListV2&&window.DetailActions);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   B={deals:[{id:'11111111-1111-4111-8111-111111111111',site:'[서울 도봉] 창동동아그린아파트 옥상 방수',assignee:'황윤선',brand:'POUR솔루션',created:day(-60),code:'compete',stage_code:'compete',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01012345678',office_phone:'0212345678',
     next_action:{id:'n1',text:'PT 준비',due:day(2),status:'open'},activities:[{id:'a1',type:'전화',note:'통화 완료 · 진행 중',at:at(-3)}],stage_contexts:{compete:{fields:{competition_type:'PT'}}}}],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   window.__rpc=[];SB={rpc:async(name,args)=>{__rpc.push([name,args]);if(name==='crm_deal_stage_fields_update_v1')return {data:{ok:true,version:2,stage_context:{fields:Object.assign({competition_type:'PT'},args.p.fields)}}};return {data:{ok:true,tasks:[]}};}};
   /* 공종 저장 경로(Phase11): 서버 읽기·저장을 흉내 낸다 */
   /* 공종 저장 경로(Phase11): 시험에는 로그인이 없어 같은 약속(최신값 읽기 → 창 열기 → 저장)만 흉내 낸다 */
   window.__work=[];const fake={current:null,openWork:async(id,item)=>{fake.current=item;CUR_DETAIL={kind:'deal',key:dealKey(item),item};openWorkEdit();},save:async(item,payload)=>{if(item!==fake.current)throw Error('EDITOR_IDENTITY_MISMATCH');__work.push({operation:'opportunity_work_set',payload});item.workItems=payload.work_items;item.primaryWork=payload.primary_work;closeNewDeal();renderDetail();}};window.Phase11=fake;
   G.dealDetailV3Off=true;/* 상세 정리(2026-10-03 detail_panel)는 verify-deal-detail-v3 에서 */G.pipeStageBOff=true;/* 상세 검사는 v2 목록 줄로 연다(단계별 B안은 verify-pipeline-stage-b) */PipelineWorkspace.open('competition');
  });
  await page.waitForTimeout(200);
  await page.locator('#pipeline-list-v2 .plv-row .plv-site').first().click();await page.waitForTimeout(500);
  const v=page.locator('#detailView.ddv');assert.equal(await v.count(),1);
  const panel=page.locator('#detailView .dw-right #ddvPanel');
  const inColumn=async()=>page.evaluate(()=>{const p=document.getElementById('ddvPanel').getBoundingClientRect(),r=document.querySelector('#detailView .dw-right').getBoundingClientRect();return Math.abs(p.left-r.left)<=2&&Math.abs(p.width-r.width)<=2;});
  /* ── 1. 연락처 등록 ── */
  await page.evaluate(()=>openQuickContact('new'));await page.waitForTimeout(150);
  assert.equal(await panel.count(),1);assert.equal(await inColumn(),true,'오른쪽 열 자리');
  assert.equal(await page.evaluate(()=>document.getElementById('quickContactModal').classList.contains('on')),false,'화면 위 창은 뜨지 않음');
  assert.match(await panel.innerText(),/연락처 등록[\s\S]*지금 등록된 사람[\s\S]*김소장[\s\S]*동의 미확인[\s\S]*소장 바뀜[\s\S]*자동 채우기[\s\S]*역할[\s\S]*이름[\s\S]*휴대폰[\s\S]*대표 연락처로 지정[\s\S]*수신 동의[\s\S]*동의 받음[\s\S]*아직 안 물어봄[\s\S]*거부/);
  assert.equal(await panel.locator('[data-chips="consent"] [aria-pressed="true"]').innerText(),'아직 안 물어봄','기본값');
  assert.equal(await panel.locator('#qc-name').inputValue(),'','열 때마다 비움');
  if(shot)await page.screenshot({path:shot+'-contact.png'});
  /* 자동 채우기 + 소장 바뀜 + 동의 받음 → 기존 저장 경로 */
  await panel.locator('#dp-paste').fill('새로 오신 박새롬 소장님 010-9876-5432 입니다');await panel.locator('[data-dp="fill"]').click();
  assert.equal(await panel.locator('#qc-name').inputValue(),'박새롬');assert.equal(await panel.locator('#qc-mobile').inputValue(),'010-9876-5432');
  await panel.locator('[data-dp="replace"]').click();assert.equal(await panel.locator('#dp-replace-note').isVisible(),true);
  await panel.locator('[data-chips="consent"] [data-v="yes"]').click();
  await panel.locator('[data-dp="save"]').click();await page.waitForTimeout(400);
  const w=await page.evaluate(()=>__writes.filter(x=>['activity','contact_upsert'].includes(x[0])).map(x=>[x[0],x[1].manager_name||x[1].note,x[1].manager_role||x[1].result,x[1].sms_consent,x[1].kakao_consent,!!x[1].consent_at,x[1].is_primary]));
  assert.deepEqual(w[0].slice(0,2),['activity','관리소장 변경 — 이전 소장 기록']);assert.match(w[0][2],/김소장[\s\S]*까지 → 새 소장 박새롬/);
  assert.deepEqual(w[1],['contact_upsert','박새롬','관리소장',true,true,true,true],'기존 연락처·수신동의 저장 경로로 요청');
  assert.equal(await page.evaluate(()=>(B.deals[0].contacts||[]).filter(c=>c.status==='previous').map(c=>c.name+':'+c.role+':'+(c.ended_at?'날짜':'')).join(',')),'김소장:이전 소장:날짜','기존 소장은 지우지 않고 이전 소장으로');
  assert.match(await page.locator('#qc-err').innerText(),/서버 저장을 확인 중/);
  /* 시험에는 서버 응답이 없다 — 응답을 흉내 내 화면 반영까지 확인 */
  await page.evaluate(()=>{const id=__writes.filter(x=>x[0]==='contact_upsert').length&&'req-'+__writes.length,p=__writes.at(-1)[1];Phase1.queue.list=()=>[{request_id:id,operation:'contact_upsert',object_id:B.deals[0].id,status:'done',ack:{person_key:p.person_key,contact_id:'c0000000-0000-4000-8000-000000000001'}}];dispatchEvent(new Event('phase1:queue'));});await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>B.deals[0].manager_name),'박새롬','서버 확인 뒤 새 소장이 대표');
  assert.equal(await page.locator('#ddvPanel').count(),0,'저장되면 패널 닫힘');
  /* ── 2. 공종 분류 ── */
  await page.evaluate(()=>openWorkEdit());await page.waitForTimeout(400);
  assert.equal(await panel.count(),1);assert.equal(await inColumn(),true);
  assert.equal(await page.evaluate(()=>document.getElementById('newDealModal').classList.contains('on')),false);
  assert.match(await panel.innerText(),/공종 분류[\s\S]*추정 공종 · 옥상[\s\S]*키워드 추정[\s\S]*공종 표[\s\S]*옥상[\s\S]*재도장[\s\S]*지하주차장[\s\S]*기타[\s\S]*저장될 공종\s*미분류/);
  await panel.locator('[data-work="옥상>우레탄"]').click();assert.match(await panel.innerText(),/저장될 공종\s*단일/);
  await panel.locator('[data-work="재도장>외부"]').click();assert.match(await panel.innerText(),/저장될 공종\s*복합 2개/);
  assert.equal(await panel.locator('.dp-picked [aria-pressed="true"]').innerText(),'★ 옥상 우레탄','기본 대표 = 첫 번째');
  await panel.locator('[data-primary="재도장>외부"]').click();assert.equal(await panel.locator('.dp-picked [aria-pressed="true"]').innerText(),'★ 재도장 외부');
  if(shot)await page.screenshot({path:shot+'-work.png'});
  await panel.locator('[data-dp="save"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__work.map(q=>[q.operation,q.payload.primary_work,q.payload.work_items])),[['opportunity_work_set','재도장>외부',['옥상>우레탄','재도장>외부']]],'기존 공종 저장(Phase11)');
  /* ── 3. 메시지 보내기 ── */
  await page.evaluate(()=>contactSms());await page.waitForTimeout(300);
  assert.equal(await page.locator('#ddvPanel.dp-sms').count(),1);assert.equal(await inColumn(),true);
  assert.equal(await page.evaluate(()=>document.getElementById('kakaoModal').classList.contains('on')),false,'큰 창은 뜨지 않음');
  assert.equal(await page.locator('#ddvPanel #kakaoBody #rm-body').count(),1,'기존 본문(문구·발송 제한·예약)이 패널 안에');
  assert.match(await page.locator('#dp-sms-top').innerText(),/박새롬[\s\S]*010-9876-5432[\s\S]*(HOT|WARM|COOL|DORMANT) \d+/);
  assert.equal(await page.locator('#dp-sms-top .dp-ok, #dp-sms-top .dp-warn').count(),1,'보내도 되는지 한 줄');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#ddvPanel .rm-context,#ddvPanel .rel-intel')].every(n=>getComputedStyle(n).display==='none')),true,'6칸 표·관계 점수 박스는 감춤');
  if(shot)await page.screenshot({path:shot+'-sms.png'});
  await page.locator('#ddvPanel [data-dp="close"]').click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>!!REL_MSG+'|'+(document.getElementById('kakaoBody').closest('#kakaoModal')?'home':'moved')),'false|home','닫으면 원래 자리로');
  /* ── 4. 관리정보 수정 ── */
  await page.locator('#detailView .ddv-manage header .ddv-link',{hasText:'수정'}).click();await page.waitForTimeout(200);
  assert.equal(await page.locator('#ddvPanel.dp-info').count(),1);assert.equal(await inColumn(),true);assert.equal(await page.locator('#detailAction').count(),0);
  assert.match(await panel.innerText(),/관리정보 수정[\s\S]*관계 상태[\s\S]*마지막 연락[\s\S]*보냄[\s\S]*응답률[\s\S]*단계 진전[\s\S]*✦ 지금 할 일[\s\S]*30일 보류[\s\S]*추천 자료[\s\S]*이 단계에서 확인할 것[\s\S]*고객 반응[\s\S]*누가 결정하나[\s\S]*경쟁사[\s\S]*공사 예정 시기[\s\S]*입찰 예정일/);
  await panel.locator('[data-chips="customer_reaction"] [data-v="검토 중"]').click();
  await panel.locator('[data-chips="rival"] [data-v="있음"]').click();await panel.locator('#dp-rival').fill('타사 A');
  await panel.locator('[data-chips="construction_plan"] [data-v="내년 상반기"]').click();
  await panel.locator('.dp-list [data-check]:not([disabled])').first().click();
  assert.equal(await page.evaluate(()=>__writes.at(-1)[0]),'stage_check','체크리스트 = 기존 stage_check');
  if(shot)await page.screenshot({path:shot+'-info.png'});
  await panel.locator('[data-dp="save"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_deal_stage_fields_update_v1').map(x=>[x[1].p.stage_code,x[1].p.fields])),[['compete',{customer_reaction:'검토 중',competitor:'타사 A',construction_plan:'내년 상반기'}]],'고른 항목만 저장');
  assert.match(await page.locator('#detailView .ddv-manage').innerText(),/고객 반응\s*검토 중[\s\S]*경쟁사\s*타사 A[\s\S]*공사 예정\s*내년 상반기/,'왼쪽 관리 정보에 바로 반영');
  /* ── 5. 다음 할 일 설정 ── */
  await page.evaluate(()=>DetailActions.open('next'));await page.waitForTimeout(300);
  assert.equal(await page.locator('#ddvPanel.dp-next').count(),1,'예전 작업창 대신 새 패널');assert.equal(await inColumn(),true);assert.equal(await page.locator('#detailAction').count(),0,'예전 다음 할 일 작업창은 뜨지 않음');
  assert.match(await panel.innerText(),/다음 할 일 설정[\s\S]*계속 진행[\s\S]*나중에 다시[\s\S]*종료[\s\S]*✦ 추천[\s\S]*어떻게[\s\S]*전화[\s\S]*문자 · 카카오[\s\S]*방문[\s\S]*자료 준비[\s\S]*입찰 · 계약[\s\S]*기타[\s\S]*언제[\s\S]*오늘[\s\S]*내일[\s\S]*3일 뒤[\s\S]*다음 주[\s\S]*날짜 고르기[\s\S]*무엇을[\s\S]*누가[\s\S]*황윤선[\s\S]*현재 담당[\s\S]*이렇게 올라가요 · 오늘 업무 · 주간 브리핑/);
  assert.equal(await panel.locator('#dp-what').inputValue(),'','열 때마다 비움');assert.equal(await panel.locator('[data-how][aria-pressed="true"],[data-when][aria-pressed="true"]').count(),0);
  await panel.locator('[data-dp="save"]').click();assert.match(await panel.locator('#dp-err').innerText(),/어떻게 할지/);
  await panel.locator('[data-rec]').click();
  assert.equal(await panel.locator('#dp-what').inputValue(),'PT 일정 확인','추천을 누르면 아래 칸이 채워진다');assert.equal(await panel.locator('[data-when][aria-pressed="true"]').innerText(),'내일');assert.equal(await panel.locator('[data-how][aria-pressed="true"]').innerText(),'전화');
  await panel.locator('[data-how="방문"]').click();assert.match(await panel.locator('.dp-preview').innerText(),/방문 · PT 일정 확인/);
  if(shot)await page.screenshot({path:shot+'-next.png'});
  {const n0=await page.evaluate(()=>__writes.length);await panel.locator('[data-dp="save"]').click();await page.waitForTimeout(400);
   const w5=await page.evaluate(n=>__writes.slice(n).filter(x=>x[0]==='next_action').map(x=>[x[1].type,x[1].text,x[1].due_at===new Date(Date.now()+864e5).toLocaleDateString('en-CA'),x[1].assignee]),n0);
   assert.deepEqual(w5,[['현장방문','PT 일정 확인',true,'황윤선']],'기존 다음 할 일 저장 경로');assert.equal(await page.locator('#ddvPanel').count(),0,'저장되면 닫힘');}
  /* 지금 할 일 카드의 버튼도 새 패널 · 나중에 다시 · 종료 */
  await page.locator('#detailView button:visible',{hasText:'다음 할 일 · 날짜'}).first().click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#ddvPanel.dp-next').count(),1);assert.equal(await page.locator('#detailAction').count(),0);
  await panel.locator('[data-mode="later"]').click();assert.equal(await panel.locator('[data-when][aria-pressed="true"]').innerText(),'다음 주','나중에 다시 = 기본 다음 주');
  await panel.locator('[data-mode="end"]').click();assert.match(await panel.innerText(),/왜 끝나나요[\s\S]*다른 업체 선택[\s\S]*예산 없음[\s\S]*공사 안 함[\s\S]*연락 끊김[\s\S]*기타/);assert.equal(await panel.locator('.dp-foot [data-dp="save"]').innerText(),'종료하기');
  await panel.locator('[data-dp="save"]').click();assert.match(await panel.locator('#dp-err').innerText(),/왜 끝나는지/);
  await panel.locator('[data-end="예산 없음"]').click();if(shot)await page.screenshot({path:shot+'-next-end.png'});
  {const n0=await page.evaluate(()=>__writes.length);await panel.locator('[data-dp="save"]').click();await page.waitForTimeout(500);
   assert.equal(await page.locator('#sf-close_reason').inputValue(),'예산','기존 종료(진행상태 변경) 창이 고른 사유(운영 기준의 실주 원인)로 열림');assert.equal(await page.evaluate(n=>__writes.length-n,n0),0,'종료는 기존 창에서 확인 후 저장');
   await page.evaluate(()=>StageTransitionUI.close());await page.waitForTimeout(200);}
  /* 끄면 기존 창 */
  await page.evaluate(()=>{G.dealPanelsV2Off=true;openQuickContact('new');});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.getElementById('quickContactModal').classList.contains('on')),true);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',contact_panel:true,manager_replaced_kept_as_previous:true,consent_saved_existing_path:true,work_panel_phase11:true,message_panel_relocated:true,info_panel_chips_rpc:true,all_in_right_column:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
