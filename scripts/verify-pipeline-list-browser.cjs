'use strict';
/* 파이프라인 기본 · 목록 화면 정리(2026-10-20 design_handoff_pipeline_list) — 대표님 계정(송보람) · 전체 칸반 + 단계 목록 캡처 · 표시 검사. 원래 틀: 파이프라인 단계 화면 v3 검사(2026-10-05 design_handoff_pipeline_v3 · 파이프라인 단계 v3.dc.html)
   컨설팅 설계 · 자료 발송완료 · 관계관리 · 경쟁·입찰 · 계약·시공 = 공통 컴포넌트 하나(#pipeline-stage-v3) · 단계마다 다른 것은 설정값(탭 3개 · 버튼 · 사유 · 체류 기준)뿐.
   위 [전체] + 상태 탭 3개(첫 상태 빨강) · 아래 왼쪽 진단(기준 넘김 · 평균 체류 / 왜 멈춰 있나 4개 / 뭘 해야 하나) · 오른쪽 리스트 | 보드.
   숫자는 전부 자료에서: 탭 합 = 전체 = 그 단계 건수 · 첫 사유 = 빨강 탭 = 기준 넘김. 글자 크기 · 버튼(96px · 연파랑)은 시안 그대로.
   수주 · 실주는 그대로(B안) · 끄면(G.pipeStageV3Off) 이전 화면. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'',dump=process.env.PV_DUMP==='1';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineStageV3&&window.PipelineStageB&&window.PipelineListV2&&window.PipelineWorkspace&&window.ListPager&&window.CommonFilterBar);  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()-n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-40),stage_entered_at:at(10),code,stage_code:code,grp:'영업·관리',amt:2e8},extra||{});
   B={deals:[
    /* 컨설팅: 일정 없음 · 미팅 예정 · 미팅 지남(완료) · 견적 준비 */
    deal('c-none','일정 없는 컨설팅','이필선','consulting',{brand:'석민이앤씨',stage_entered_at:at(35)}),
    deal('c-plan','미팅 예정 컨설팅','이필선','consulting',{next_action:{id:'n1',type:'현장방문',text:'1차 미팅',due:day(3),status:'open'},stage_contexts:{first_contact:{fields:{needs:'옥상 누수',work_scope:'옥상 전체',expected_timing:'10월'}}}}),
    deal('c-late','견적 늦은 컨설팅','황윤선','consulting',{amt:6e8,stage_entered_at:at(12),next_action:{id:'n2',type:'현장방문',text:'1차 미팅',due:day(-6),status:'open'},stage_contexts:{first_contact:{fields:{needs:'외벽 균열'}},consulting:{fields:{quote_request:'외벽 견적',quote_due:day(-1)}}}}),
    deal('c-ok','정상 컨설팅','황윤선','consulting',{brand:'',stage_entered_at:at(4),next_action:{id:'n3',type:'견적',text:'견적 작성',due:day(2),status:'open'},stage_contexts:{first_contact:{fields:{needs:'옥상 방수',work_scope:'옥상',expected_timing:'11월'}},consulting:{fields:{quote_request:'옥상 방수',quote_due:day(2)}}}}),
    /* 발송: 9일 전 발송 후속 없음 · 반응 기록 · 2일 전 발송 */
    deal('s-late','후속 없는 발송','이필선','sent',{amt:3.1e8,stage_contexts:{sent:{fields:{sent_date:day(-9),materials:['견적서']}}}}),
    deal('s-done','반응 기록된 발송','황윤선','sent',{stage_contexts:{sent:{fields:{sent_date:day(-10),reaction:'검토중',followup_date:day(3),decision_maker:'입대의 회장'}}},next_action:{id:'n4',text:'검토 결과 확인',due:day(3),status:'open'}}),
    deal('s-wait','대기 발송','이필선','sent',{stage_contexts:{sent:{fields:{sent_date:day(-2),decision_maker:'모름'}}}}),
    /* stage7 ②: 발송일 없는 건 = 넷째 칸(7일 계산 안 함) */
    deal('s-nodate','발송일 없는 발송','이필선','sent',{stage_entered_at:at(20),last_meaningful_contact_at:at(3)}),
    /* 관계: 다음 연락일 5일 지남 · 이틀 뒤 약속 · 다음 행동 없음(70일 무접촉) · 한 달 뒤 연락 */
    deal('r-over','연락일 지난 현장','이필선','rapport',{last_meaningful_contact_at:at(20),next_action:{id:'n5',text:'안부 전화',due:day(-5),status:'open'}}),
    deal('r-week','이번 주 약속 현장','황윤선','silent',{last_meaningful_contact_at:at(9),next_action:{id:'n6',text:'자료 전달',due:day(2),status:'open'},stage_contexts:{silent:{fields:{construction_plan:'2027.3'}}}}),
    deal('r-none','다음 행동 없는 현장','이필선','waiting',{created:day(-100),last_meaningful_contact_at:at(70),stage_entered_at:at(75)}),
    deal('r-far','한 달 뒤 연락 현장','황윤선','waiting',{last_meaningful_contact_at:at(12),next_action:{id:'n7',text:'공사 시기 확인',due:day(30),status:'open'}}),
    /* 경쟁: 마감 D-2 · PT D-6 · 마감 D-20 · 제출 완료 · 마감 지남 */
    deal('k-d2','입찰 D-2','이필선','bidding',{amt:4.2e8,stage_contexts:{bidding:{fields:{bid_deadline:day(2),bid_plan:'준비 중'}}}}),
    deal('k-pt','PT 앞둔 경쟁','황윤선','compete',{stage_contexts:{compete:{fields:{competition_type:'PT',competitor:'타사 A',meeting_date:day(6)}}}}),
    deal('k-run','마감 먼 입찰','이필선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:day(20)}}}}),
    deal('k-sub','제출한 입찰','이필선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:day(5),bid_plan:'제출 완료'}}}}),
    deal('k-past','마감 지난 입찰','황윤선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:day(-2)}}}}),
    /* stage7 ④: 결정 · 입찰 일정 없음 = 넷째 칸(D-7 계산 안 함) */
    deal('k-nodate','일정 없는 경쟁','이필선','compete',{last_meaningful_contact_at:at(2),stage_contexts:{compete:{fields:{competition_type:'경쟁견적'}}}}),
    /* 계약·시공: 계약정보 없음 · 인계 중 · 시공 중(9일 무연락) · 준공 단계 */
    deal('t-sign','계약 진행','이필선','contract'),
    deal('t-hand','인계 중','황윤선','construction',{stage_contexts:{contract:{fields:{contract_date:day(-5),contract_amount:3e8,special_terms:'야간 작업 불가'}},construction:{fields:{start_date:day(7),handover:'진행중'}}}}),
    deal('t-build','시공 중','이필선','construction',{last_meaningful_contact_at:at(9),stage_contexts:{contract:{fields:{contract_date:day(-20),contract_amount:3e8,special_terms:'-'}},construction:{fields:{start_date:day(-10),handover:'완료'}}}}),
    deal('t-fin','준공 확인 대기','황윤선','completion',{stage_contexts:{contract:{fields:{contract_date:day(-60),contract_amount:2.5e8}},construction:{fields:{handover:'완료'}}}}),
    deal('w-1','수주 현장','이필선','won',{outcome:'won',won_amount:1.4e8,closed_at:day(-34),completion_date:day(-34)}),
    deal('l-1','실주 현장','이필선','lost',{outcome:'lost',closed_at:day(-3)})
   ],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.psb=null;G.prb=null;G.ps3=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__open=null;window.__act=null;window.__drwReal=drwDeal;window.__daReal=window.DetailActions&&window.DetailActions.open;drwDeal=s=>{window.__open=JSON.parse(s).id;};window.DetailActions=Object.assign(window.DetailActions||{},{open:k=>{window.__act=k;}});
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:()=>true,noteMissing(){}});
   G.pipelineStage=null;goPage('pipe');
  });
  await page.waitForTimeout(700);
  const SH=process.env.PL_SHOT||'';
  if(SH)await page.screenshot({path:SH+'-all.png',fullPage:false});
  for(const k of ['sent','relationship','won','lost']){await page.evaluate(k=>PipelineWorkspace.open(k),k);await page.waitForTimeout(500);if(SH)await page.screenshot({path:SH+'-'+k+'.png',fullPage:false});}
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS'}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});