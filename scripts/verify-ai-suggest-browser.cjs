'use strict';
/* AI 제안 연결 검사(2026-10-02 · 서버 함수 crm-ai): 설정이 꺼져 있으면 버튼이 없고 서버를 부르지 않는다. 켜져 있으면 버튼을 눌렀을 때만 부른다.
   공종 추정(분류 창) · CRM에게 묻기(규칙으로 못 바꾼 질문) · 리포트 문장 · 중복 판단 · 영업사원 카드 첫마디. 결과는 제안 — 영업 데이터를 바꾸지 않는다.
   서버는 흉내(같은 약속) — 실제 함수 로직은 tests/crm-ai-handler.test.mjs 가 검사한다 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  /* 서버 함수 흉내 — 화면의 fetch 는 그대로(통신 보호 장치를 지나야 한다). 보호 장치가 막으면 요청이 여기 오지 않아 검사가 실패한다 */
  const AI_OUT={work_guess:{keys:['옥상>우레탄','재도장>외부'],primary:'옥상>우레탄',basis:'현장명 · 메모의 «옥상 우레탄»',confidence:'high'},ask_parse:{conditions:[{k:'owner',v:'이필선'},{k:'stage',v:'bidding'},{k:'drop',v:1}],note:'이필선 담당의 입찰 단계'},report_text:{cover:'롯데캐슬 입찰을 잡으면 9억이 들어옵니다',risk:'이번 달 수주는 아직 없습니다',now:'',people:'',real:'',ask:'',askWhy:'',promises:[{what:'진행 건마다 다음 연락일을 적는다',who:'영업팀',where:'주간 브리핑'}]},dup_judge:{probability:93,basis:'주소와 관리사무소 전화가 같음',action:'merge'},call_opener:{opener:'소장님, 넷폼 송보람입니다. 지난번 견적 보셨는지 여쭤보려고요.',goal:'검토 여부와 결정 일정 듣기',summary:'견적 발송 뒤 회신 없음'},next_action:{how:'전화',what:'견적 검토 확인',days:1,why:'기한이 지남'}};
  await page.route('**/functions/v1/crm-ai',async r=>{const req=r.request();if(req.method()!=='POST')return r.fulfill({status:405,body:'{}'});const b=req.postDataJSON(),hd=req.headers();
   await page.evaluate(x=>{window.__ai=(window.__ai||[]);__ai.push(x);},{kind:b.kind,auth:hd.authorization,input:b.input,id:b.subject_id});
   return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,cached:false,suggestion:{id:'s-'+b.kind,status:'proposed',suggestion:AI_OUT[b.kind]}})});});
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.OpsStore&&window.AskV2&&window.WorkV2&&window.DupV2&&window.TodayRepV2&&window.ReportV2&&typeof paint==='function');
  await page.evaluate(()=>{
   const ymd=d=>d.toLocaleDateString('en-CA'),day=n=>ymd(new Date(Date.now()+n*864e5)),at=d=>new Date(Date.now()-d*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(0),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   B={deals:[deal('d1','강동 롯데캐슬퍼스트','이필선','consulting',{amt:9e8,address:'서울 강동구 양재대로 1340',office_phone:'0212345678',next_action:{id:'n1',type:'전화',text:'견적 확인 전화',due:day(-3),status:'open'}}),deal('d2','강동롯데캐슬 퍼스트 아파트','이필선','bidding',{amt:3e8,address:'서울 강동구 양재대로 1340',office_phone:'0212345678',created:day(-400)})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   G.todayTowerOff=true;/* 영업사원 카드 첫마디 검사는 예전 화면(관제탑 카드의 AI 첫마디는 verify-today-tower) */LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};TOKEN='user-jwt';G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   if(!window.SUPABASE_URL)SUPABASE_URL='https://example.supabase.co';const fake={current:null,openWork:async(id,item)=>{fake.current=item;CUR_DETAIL={kind:'deal',key:dealKey(item),item};openWorkEdit();},save:async()=>{}};window.Phase11=fake;
   window.__flags={ai_enabled:false};window.__rpc=[];window.__ai=window.__ai||[];
   SB={rpc:async(name,args)=>{const p=(args&&args.p)||{};__rpc.push(name);
    if(name==='crm_ops_settings_v1'){if(p.set)Object.assign(__flags,p.set);return {data:{ok:true,settings:Object.assign({},__flags)}};}
    if(name==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:[]}};
    if(name==='crm_ai_suggestion_decide_v1')return {data:{ok:true,suggestion:{id:p.id,status:p.status}}};
    if(/_list_v1$|_get_v1$/.test(name))return {data:{ok:true,rows:[],snapshots:[],actions:[]}};
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   /* 서버 함수 흉내는 page.route(위) — 보호 장치를 지나는지까지 본다 */
   /* (이전 fetch 바꿔치기 제거) */
   goPage('work');
  });
  await page.waitForTimeout(600);
  /* 꺼져 있을 때: 버튼이 없고 서버 함수를 부르지 않는다 */
  assert.equal(await page.evaluate(()=>OpsStore.aiOn()),false);
  await page.locator('#work-v2 .plv-row .plv-cta').first().click();await page.waitForTimeout(400);
  assert.equal(await page.locator('#workDialog.on').count(),1);assert.equal(await page.locator('#workDialog [data-aiguess]').count(),0,'꺼져 있으면 AI 버튼 없음');
  await page.locator('#workDialog [data-wd="close"]').first().click();
  await page.keyboard.press('Control+k');await page.waitForTimeout(200);await page.locator('#akInput').fill('우주에서 제일 좋은 현장');await page.keyboard.press('Enter');await page.waitForTimeout(300);
  assert.match(await page.locator('#askDialog .ak-miss').innerText(),/아직 조건으로 못 바꿨어요/);assert.equal(await page.evaluate(()=>__ai.length),0,'꺼져 있으면 부르지 않는다');await page.keyboard.press('Escape');
  /* 켜기(관리자 설정) */
  await page.evaluate(async()=>{await OpsStore.setFlag('ai_enabled',true);paint();});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>OpsStore.aiOn()),true);
  /* 1. 공종 추정 */
  await page.locator('#work-v2 .plv-row',{hasText:'강동 롯데캐슬퍼스트'}).locator('.plv-cta').click();await page.waitForTimeout(400);
  const w=page.locator('#workDialog.on .wd-box');await w.locator('[data-aiguess]').click();await page.waitForTimeout(400);
  assert.match(await w.locator('.dp-ai').innerText(),/추정 공종 · 옥상 우레탄 \+ 재도장 외부[\s\S]*AI 추정 \(확신 높음\)/);
  assert.match(await w.innerText(),/저장될 공종\s*미분류/,'AI 결과만으로는 고르지 않는다');
  await w.locator('[data-guess]').click();await page.waitForTimeout(200);assert.match(await w.innerText(),/저장될 공종\s*복합 2개/);assert.equal(await w.locator('.dp-picked [aria-pressed="true"]').innerText(),'★ 옥상 우레탄');
  assert.equal(await page.evaluate(()=>__rpc.includes('crm_ai_suggestion_decide_v1')),true,'사람이 고르면 확정으로 기록');
  await w.locator('[data-wd="later"]').click();await page.waitForTimeout(300);await page.evaluate(()=>{document.getElementById('workDialog')?.classList.remove('on');});
  /* 2. 묻기: 규칙으로 못 바꾼 질문 → AI 해석(모르는 조건은 버린다) */
  await page.keyboard.press('Control+k');await page.waitForTimeout(200);await page.locator('#akInput').fill('필선이 입찰 들어간 데 어디야');await page.keyboard.press('Enter');await page.waitForTimeout(500);
  const ask=page.locator('#askDialog.on .ak-box');
  assert.deepEqual(await ask.locator('.ak-chip').evaluateAll(a=>a.map(c=>c.firstChild.textContent)),['담당 이필선','단계 입찰단계','진행 중']);assert.match(await ask.locator('.ak-sec').first().innerText(),/AI 해석/);
  assert.match(await ask.locator('.ak-row').innerText(),/강동롯데캐슬 퍼스트 아파트/);assert.equal(await ask.locator('.ak-row').count(),1);
  assert.equal(await page.evaluate(()=>__ai.at(-1).auth),'Bearer user-jwt','사용자 토큰으로 부른다');await page.keyboard.press('Escape');
  /* 3. 리포트 문장: 채우기만 하고 저장하지 않는다 */
  await page.evaluate(()=>(G.reportBOff=true,goPage('report')));await page.waitForTimeout(500);
  await page.locator('#report-v2 [data-rp="ai"]').click();await page.waitForTimeout(500);
  assert.match(await page.locator('#report-v2 .rp-slide.on').innerText(),/롯데캐슬 입찰을 잡으면 9억이 들어옵니다[\s\S]*이번 달 수주는 아직 없습니다/);
  assert.equal(await page.evaluate(()=>__rpc.includes('crm_report_snapshot_save_v1')),false,'AI 문장은 저장하지 않는다');
  assert.equal(await page.evaluate(()=>typeof __ai.at(-1).input.won_amount),'number','숫자만 넘긴다');
  /* 4. 중복 판단 */
  await page.evaluate(()=>goPage('dup'));await page.waitForTimeout(700);
  await page.locator('#dup-v2 .plv-row .plv-cta').first().click();await page.waitForTimeout(300);
  await page.locator('#dupDialog [data-dd-ai]').click();await page.waitForTimeout(400);
  assert.match(await page.locator('#dvAiOut').innerText(),/AI 판단 · 같은 건일 가능성 93% · 주소와 관리사무소 전화가 같음 · 제안: 합치기 \(참고용/);
  await page.locator('#dupDialog [data-dd="close"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('#dupDialog.on').count(),0,'중복 판단 창 닫힘');
  /* 5. 영업사원 카드 첫마디 */
  await page.evaluate(()=>{ME={id:'rep1',name:'이필선',role:'rep'};goPage('today');});await page.waitForTimeout(600);
  const card=page.locator('#today-v2 .trv-card').first();await card.locator('[data-trv="ai"]').click();await page.waitForTimeout(500);
  assert.match(await page.locator('#today-v2 .trv-card').first().innerText(),/견적 발송 뒤 회신 없음[\s\S]*검토 여부와 결정 일정 듣기[\s\S]*“소장님, 넷폼 송보람입니다\. 지난번 견적 보셨는지 여쭤보려고요\.”\s*AI/);
  /* 전체: 버튼을 누른 만큼만 불렀고, 영업 데이터는 바꾸지 않았다 */
  assert.deepEqual(await page.evaluate(()=>__ai.map(a=>a.kind)),['work_guess','ask_parse','report_text','dup_judge','call_opener']);
  assert.deepEqual(await page.evaluate(()=>__writes.filter(x=>x!=='opportunity_touch')),[],'AI 제안은 영업 데이터를 바꾸지 않는다');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',off_by_default_no_calls:true,work_guess:true,ask_parse_filtered:true,report_text_not_saved:true,dup_judge_reference_only:true,call_opener:true,user_token:true,no_business_writes:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
