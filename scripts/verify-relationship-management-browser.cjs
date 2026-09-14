'use strict';

// Localhost-only relationship page regression. Synthetic CRM rows; external traffic and writes are blocked.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');

const root=path.resolve(__dirname,'..');
function server(){return http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'crm.html',target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(res)})}
async function listenSafe(srv){for(const port of [4187,4188,4189,4190,4191]){try{await new Promise((resolve,reject)=>{const fail=error=>{srv.off('listening',ready);reject(error)},ready=()=>{srv.off('error',fail);resolve()};srv.once('error',fail);srv.once('listening',ready);srv.listen(port,'127.0.0.1')});return port}catch(error){if(error.code!=='EADDRINUSE')throw error}}throw new Error('No safe localhost verification port is available')}

async function run(){
 const srv=server(),port=await listenSafe(srv);
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof paintRelationshipManagement==='function'&&typeof relationshipManagerEscalation==='function');
  await page.evaluate(()=>{
   const day=n=>{const d=new Date();d.setDate(d.getDate()+n);const z=x=>String(x).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())};
   const at=n=>day(n)+'T12:00:00+09:00';
   B={inquiries:[],activities:[],inquiryTrash:[],deals:[
    {id:'rel-overdue',site:'기한초과 관계현장',assignee:'황윤선',brand:'POUR솔루션',code:'rapport',grp:'영업·관리',created:'2024-01-02',planned_construction_year:'2026',amt:100000000,relationshipReason:'내년도 사업 검토',lastMeaningfulContactAt:at(-30),nextActionObj:{text:'관리소장 공사계획 확인',due:day(-5),status:'open'}},
    {id:'rel-today',site:'오늘 연락 관계현장',assignee:'이필선',brand:'석민이앤씨',code:'silent',grp:'영업·관리',created:'2025-01-02',planned_construction_year:'2027',amt:80000000,relationshipReason:'예산 미확보',lastMeaningfulContactAt:at(-20),nextActionObj:{text:'예산 편성 여부 확인',due:day(0),status:'open'}},
    {id:'rel-missing',site:'정보누락 관계현장',assignee:'황윤선',brand:'POUR공법',code:'waiting',grp:'영업·관리',created:'2023-01-02',amt:50000000},
    {id:'rel-future',site:'예정 관계현장',assignee:'이필선',brand:'아파트스퀘어',code:'rapport',grp:'영업·관리',created:'2026-01-02',amt:20000000,stage_contexts:{construction:{fields:{start_date:'2028-04-01'}}},relationshipReason:'입주자대표회의 결정 대기',lastMeaningfulContactAt:at(-10),nextActionObj:{text:'입대의 결과 확인',due:day(10),status:'open'}},
    {id:'rel-stale',site:'장기 미접촉 현장',assignee:'황윤선',brand:'기술자문',code:'rapport',grp:'영업·관리',created:'2022-01-02',amt:30000000,contract_date:'2026-03-01',relationshipReason:'장기적인 관계 유지 필요',lastMeaningfulContactAt:at(-100),nextActionObj:{text:'안부 연락',due:day(100),status:'open'}},
    {id:'pipe-normal',site:'일반 파이프라인',assignee:'황윤선',brand:'POUR솔루션',code:'sent',grp:'영업·관리',created:'2026-01-02',amt:10000000}
   ]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=false;ME={name:'송보람',role:'admin'};G.page='relationship';G.relationshipFilter='all';G.relationshipOwner='전체';G.relationshipYear='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');window.__businessWrites=[];window.pushWrite=(op)=>{window.__businessWrites.push(op)};syncPage();
  });


  assert.equal(await page.locator('.relpc-kpis button').count(),4);
  assert.equal(await page.locator('.relpc-table tbody tr').count(),5);
  assert.equal(await page.locator('.relpc-years button').count(),8);
  await page.evaluate(()=>{B.deals[0].planned_construction_year='2034';B.deals[0].work_name='외벽 재도장';B.deals[0].manager_name='장기관리소장';paintRelationshipManagement()});
  await page.locator('.relpc-years').getByRole('button',{name:'2031 이후',exact:true}).click();
  assert.equal(await page.locator('.relpc-table tbody tr').count(),1);
  assert.match(await page.locator('.relpc-table tbody').innerText(),/2034년/);
  assert.match(await page.locator('.relpc-table tbody').innerText(),/외벽 재도장/);
  await page.getByRole('textbox',{name:'관계관리 현장 검색'}).fill('장기관리소장');
  await page.getByRole('button',{name:'검색',exact:true}).click();
  assert.equal(await page.locator('.relpc-table tbody tr').count(),1);
  await page.getByRole('button',{name:'초기화',exact:true}).click();
  assert.match(await page.locator('.relpc-table tbody tr').first().innerText(),/기한초과 관계현장/);
  assert.equal(await page.locator('.relm-matrix,.relm-customer').count(),0);
  async function secondary(name,index=0){await page.locator('.relpc-action-row').nth(index).click();await page.locator('#relpc-panel').getByRole('button',{name,exact:true}).click()}
  assert.deepEqual(await page.locator('.relpc-table th').allTextContents(),['현장 / 고객','관리 배경','이번에 할 일','다음 연락','실행']);
  assert.equal(await page.locator('.relpc-action-row').first().locator('td').count(),5);
  await page.getByRole('combobox',{name:'최근 접촉기간'}).selectOption('90');
  assert.equal(await page.locator('.relpc-table tbody tr').count(),1);
  await page.getByRole('button',{name:'초기화',exact:true}).click();
  await page.locator('.relpc-kpis button').filter({hasText:'오늘 연락'}).click();
  assert.equal(await page.locator('.relpc-table tbody tr').count(),1);
  await page.locator('.relpc-kpis button').filter({hasText:'이번주 예정'}).click();
  assert.equal(await page.locator('.relpc-table tbody tr').count(),1);
  await page.getByRole('button',{name:'초기화',exact:true}).click();
  await page.locator('.relpc-table tbody tr').first().click();
  assert.equal(await page.locator('#relpc-panel').count(),1);
  for(const word of ['내년도 사업 검토','관리소장 공사계획 확인','공사예정','2034년'])assert.match(await page.locator('#relpc-panel').innerText(),new RegExp(word));
  assert.equal(await page.locator('.relpc-summary-grid>div').count(),4);
  assert.equal(await page.locator('.relpc-next-card').count(),1);
  assert.equal(await page.locator('.relpc-timeline').count(),1);
  await page.getByRole('button',{name:'상세 패널 닫기'}).click();
  await page.locator('.relpc-table tbody tr').first().click();
  await page.locator('#relpc-full').click();
  assert.equal(await page.locator('#relpc-panel').count(),0);
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.id),'rel-overdue','full detail keeps the selected opportunity');
  assert.equal(await page.locator('.relm-detail-context').count(),1);
  await page.evaluate(()=>relationshipManagementDetailAction('owner'));
  assert.equal(await page.locator('#dv-assignee').count(),1,'existing assignee editor is retained');
  await page.evaluate(()=>relationshipManagementDetailAction('return'));
  assert.equal(await page.locator('#stage-transition-form').count(),1,'return uses the existing stage editor');
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.id),'rel-overdue','return does not create a duplicate deal');
  await page.evaluate(()=>closeDetail());
  await page.locator('.relpc-table tbody tr').first().getByRole('button',{name:'기록',exact:true}).click();
  assert.equal(await page.locator('#relq-note').isVisible(),true);
  assert.equal(await page.locator('#relq-due').isVisible(),true);
  await page.locator('#relq-meaningful').check();
  await page.locator('#relq-outcome').selectOption({label:'응답 없음'});
  assert.equal(await page.locator('#relq-result').inputValue(),'응답 없음');
  assert.equal(await page.locator('#relq-meaningful').isChecked(),false);
  await page.getByRole('button',{name:'장충금 예산 편성 시기 확인',exact:true}).click();
  assert.equal(await page.locator('#relq-next').inputValue(),'장충금 예산 편성 시기 확인');
  await page.getByRole('button',{name:'3개월 후',exact:true}).click();
  assert.match(await page.locator('#relq-due').inputValue(),/^\d{4}-\d{2}-\d{2}$/);
  await page.locator('#relq-save').click();
  assert.match(await page.locator('#relq-error').innerText(),/입력/);
  await page.locator('.relq-close').click();
  await secondary('일정등록');
  assert.equal(await page.locator('#relq-note').isVisible(),false);
  assert.equal(await page.locator('#relq-due').isVisible(),true);
  await page.locator('.relq-close').click();
  await secondary('메모');
  assert.equal(await page.locator('#relq-note').isVisible(),true);
  assert.equal(await page.locator('#relq-due').isVisible(),false);
  await page.locator('.relq-close').click();
  assert.deepEqual(await page.evaluate(()=>window.__businessWrites.filter(x=>x!=='opportunity_touch')),[]);
  // Synthetic queue only: successful save and uncertain acknowledgement retain one request.
  await page.evaluate(()=>{
   window.__savedQueue={flush:Phase1.queue.flush,list:Phase1.queue.list};window.__savedNote=window.pcRelationshipMemo;window.__savedNext=window.pcRelationshipNext;
   window.__requests=[];window.__confirm=false;
   const submit=(op,payload)=>{const id='test-'+__requests.length;__requests.push({request_id:id,op,payload});return id};
   window.pcRelationshipMemo=p=>submit('activity',p);window.pcRelationshipNext=p=>submit('next_action',p);
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__requests.map(r=>({...r,status:__confirm?'done':'pending',ack:__confirm?{operation:r.op}:null}));
  });
  await secondary('메모');
  await page.locator('#relq-note').fill('내부 확인 메모');
  await page.locator('#relq-save').click();
  assert.match(await page.locator('#relq-error').innerText(),/확인하지 못/);
  assert.equal(await page.locator('#relq-note').inputValue(),'내부 확인 메모');
  await page.evaluate(()=>window.__confirm=true);
  await page.locator('#relq-save').click();
  assert.equal(await page.locator('#relQuickModal').count(),0);
  assert.equal(await page.evaluate(()=>__requests.length),1,'uncertain retry reuses request');
  assert.equal(await page.evaluate(()=>__requests[0].payload.meaningful_contact),false);
  await secondary('일정등록');
  await page.locator('#relq-next').fill('다음 공사계획 확인');
  await page.locator('#relq-save').click();
  assert.equal(await page.locator('#relQuickModal').count(),0);
  assert.equal(await page.evaluate(()=>__requests[1].op),'next_action');
  assert.equal(await page.evaluate(()=>__requests.length),2,'schedule adds no contact activity');
  // A late response from the previous customer must not close the new draft.
  await page.evaluate(()=>{Phase1.queue.flush=()=>new Promise(resolve=>window.__releaseSave=resolve)});
  await secondary('메모');
  await page.locator('#relq-note').fill('첫 고객 저장');
  await page.locator('#relq-save').click();
  await page.locator('.relq-close').click();
  await secondary('메모',1);
  await page.locator('#relq-note').fill('두 번째 고객 작성 중');
  await page.evaluate(()=>window.__releaseSave());
  assert.equal(await page.locator('#relQuickModal').count(),1,'late save keeps new form open');
  assert.equal(await page.locator('#relq-note').inputValue(),'두 번째 고객 작성 중');
  await page.locator('.relq-close').click();
  await page.evaluate(()=>{Object.assign(Phase1.queue,__savedQueue);window.pcRelationshipMemo=__savedNote;window.pcRelationshipNext=__savedNext});
  await page.getByRole('button',{name:'상세필터',exact:true}).click();
  await page.getByRole('combobox',{name:'관계관리 공사 예정연도',exact:true}).selectOption('2027');
  assert.equal(await page.locator('.relpc-table tbody tr').count(),1);
  await page.getByRole('button',{name:'초기화',exact:true}).click();
  await page.getByRole('combobox',{name:'관계관리 담당자',exact:true}).selectOption('황윤선');
  assert.equal(await page.locator('.relpc-table tbody tr').count(),3);
  await page.evaluate(()=>{AUTH_ON=true;ME={name:'이필선',role:'rep'};G.relationshipOwner='전체';paintRelationshipManagement()});
  assert.equal(await page.locator('.relpc-table tbody tr').count(),2);
  assert.equal(await page.getByRole('combobox',{name:'관계관리 담당자',exact:true}).count(),0);
  await page.evaluate(()=>{AUTH_ON=false;ME={name:'송보람',role:'admin'};G.relationshipOwner='전체';paintRelationshipManagement();G._detailPopup=true;drwDeal(JSON.stringify(B.deals[5]));window.__businessWrites=[];StageTransitionUI.open(B.deals[5],false,'rapport')});
  await page.locator('#stage-transition-form button[type="submit"]').click();
  assert.match(await page.locator('#sf-error').innerText(),/관계관리 사유/);
  assert.equal(await page.evaluate(()=>B.deals[5].code),'sent');
  assert.deepEqual(await page.evaluate(()=>window.__businessWrites),[]);
  await page.locator('#sf-relationship_reason').selectOption('내년도 사업 검토');
  await page.locator('#sf-reaction').fill('내년 예산 편성 후 재검토');
  await page.locator('#sf-contact_date').fill('2026-10-15');
  await page.locator('#stage-transition-form button[type="submit"]').click();
  assert.equal(await page.evaluate(()=>B.deals[5].code),'rapport');
  assert.deepEqual(await page.evaluate(()=>window.__businessWrites),['transition','activity','next_action']);
  await page.evaluate(()=>closeDetail());
  for(const width of [1920,1440,1024]){
   await page.setViewportSize({width,height:1080});await page.evaluate(()=>paintRelationshipManagement());
   assert.equal(await page.evaluate(()=>{const e=document.querySelector('.relpc-table-wrap');return e.scrollWidth<=e.clientWidth}),true,'no horizontal table scroll at '+width);
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.evaluate(()=>{
   B.deals[3].activities=[{id:'contact-test',type:'전화',at:new Date().toISOString(),note:'옥상방수 공사 일정 확인',result:'내년 재검토'},{id:'memo-test',type:'메모',at:new Date().toISOString(),note:'내부 검토 전용 메모'}];
   B.deals[3].nextActionObj.text='';
   paintRelationshipManagement();
  });
  const futureRow=page.locator('.relpc-table tbody tr').filter({hasText:'예정 관계현장'});
  assert.equal(await futureRow.locator('.relpc-evidence').isVisible(),true);
  await futureRow.click();
  assert.match(await page.locator('.relpc-panel').innerText(),/옥상방수 공사 일정 확인/);
  await page.getByRole('button',{name:'상세 패널 닫기'}).click();
  assert.doesNotMatch(await futureRow.innerText(),/내부 검토 전용 메모/,'internal memo is not presented as customer contact');
  assert.match(await futureRow.innerText(),/다음 일정 없음/,'date without next action is still incomplete');
  await page.locator('.relpc-kpis button').filter({hasText:'다음 일정 없음'}).click();
  assert.equal(await futureRow.count(),1,'incomplete action is included in missing-schedule filter');
  await page.getByRole('button',{name:'초기화',exact:true}).click();
  await page.evaluate(()=>{B.deals[3].nextActionObj.text='입대의 결과 확인';paintRelationshipManagement()});
  assert.equal(await page.locator('.relpc-action-row[data-group]').count(),0);
  assert.match(await page.locator('.relpc-action-row').last().innerText(),/일정 없음/);
  assert.equal(await page.locator('.relpc-evidence').count(),6);
  assert.ok(await page.locator('.relpc-plan>strong').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=15));
  await page.waitForTimeout(80);
  assert.ok(await page.locator('.relpc-background small').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=13));
  assert.ok(await page.locator('.relpc-actions button').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=14));
  const typography=await page.evaluate(async()=>{
   const today=document.getElementById('pg-today'),current=document.querySelector('.apage.on'),sheet=document.querySelector('link[href^="pc-typography.css"]');
   const probes=[document.getElementById('ptitle'),document.querySelector('.side'),today].filter(Boolean);
   if(current)current.classList.remove('on');today.classList.add('on');
   const sample=()=>probes.flatMap(root=>[root,...root.querySelectorAll('*')]).filter(e=>e.getClientRects().length).map(e=>getComputedStyle(e).fontSize);
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const enabled=sample();sheet.disabled=true;const disabled=sample();sheet.disabled=false;
   today.classList.remove('on');if(current)current.classList.add('on');
   return {enabled,disabled};
  });
  assert.ok(typography.enabled.some((size,i)=>parseFloat(size)>parseFloat(typography.disabled[i])),'Today now uses shared larger type');
  assert.ok(!fs.readFileSync(path.join(root,'mobile.html'),'utf8').includes('pc-typography'),'mobile does not load PC typography');
  if(process.env.VERIFY_SCREENSHOT)await page.screenshot({path:process.env.VERIFY_SCREENSHOT,fullPage:true});
  await page.evaluate(()=>{const original=B.deals[3];B.deals=Array.from({length:51},(_,i)=>({...original,id:'scale-'+i,site:'대량검증 '+String(i).padStart(2,'0')}));G.relationshipPage=1;paintRelationshipManagement()});
  assert.equal(await page.locator('.relpc-table tbody tr').count(),50);
  await page.getByRole('button',{name:'50건 더보기'}).click();
  assert.equal(await page.locator('.relpc-table tbody tr').count(),51);
  await page.getByRole('textbox',{name:'관계관리 현장 검색'}).fill('대량검증 50');
  await page.getByRole('button',{name:'검색',exact:true}).click();
  assert.equal(await page.locator('.relpc-table tbody tr').count(),1);
  await page.getByRole('button',{name:'관리문자 준비',exact:true}).click();
  assert.equal(await page.evaluate(()=>G.page),'campaign');
  assert.deepEqual(await page.evaluate(()=>G.campaignOpportunityScope),['scale-50']);
  assert.equal(await page.evaluate(()=>CAMPAIGN_STATE.purpose),'관계 유지');
  assert.equal(await page.evaluate(()=>window.__businessWrites.includes('campaign_create')),false);
  console.log(JSON.stringify({status:'PASS',pc_customer_inbox:true,kpis:4,contact90:true,drawer:true,quick_actions:true,rep_scope:true,year_filter:true,transition_validation:true,campaign_scope:true,horizontal_scroll:false}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}
run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
