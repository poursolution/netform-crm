'use strict';
/* 영업건 상세 기본 배치 검사(2026-10-05 대표 "두 개 중복되는 것 같은데 오른쪽만 남겨 줘" · "담당 정보는 접어 두게 · 담당 정보 ; 이필선")
   왼쪽 = 관리소장 · 같은 현장 다른 영업 · 담당 정보(접힘 · 이름) · 자료 · 다른 연락처 — '현장 정보' 없음.
   오른쪽 '이 단계 필수 정보' 하나: 맨 위 공종 · 예상 금액(다른 곳에서는 고칠 수 없다) + 이 단계가 묻는 항목. 종료 건도 같은 상자에서 입력(전용 서버 함수). 끄기: G.dealSiteInfoLeft=true */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealKeyman&&window.DealPanelsV2&&window.DealDetailV2&&window.PipelineListV2&&window.DetailActions&&window.OpsStore);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const S='aaaaaaaa-0000-4000-8000-000000000001';
   B={deals:[
    {id:'11111111-1111-4111-8111-111111111111',site:'[서울 도봉] 창동동아그린아파트',site_id:S,assignee:'황윤선',brand:'POUR솔루션',created:day(-60),code:'sent',stage_code:'sent',grp:'영업·관리',amt:38e7,manager_name:'김영수',manager_mobile:'01012345678',office_phone:'0212345678',
     contacts:[{person_key:'mobile:01012345678',name:'김영수',role:'관리소장',mobile:'01012345678',status:'current'},{person_key:'mobile:01011112222',name:'박영호',role:'이전 소장',mobile:'01011112222',status:'previous',ended_at:day(-3)},{person_key:'mobile:01077778888',name:'이회장',role:'입주자대표회장',mobile:'01077778888',status:'current'}],
     next_action:{id:'n1',text:'견적 후속 통화',due:day(2),status:'open'},
     activities:[{id:'a1',type:'전화',note:'소장 통화 — 견적 검토 중',at:at(-20)},{id:'a2',type:'업무',note:'관리소장 변경 — 이전 소장 기록',result:'박영호 · 010-1111-2222 · '+day(-3)+'까지 → 새 소장 김영수',at:at(-3)}],stage_contexts:{sent:{fields:{sent_date:day(-15),reaction:'가격 부담'}}}},
    {id:'22222222-2222-4222-8222-222222222222',site:'[서울 도봉] 창동동아그린아파트',site_id:S,assignee:'이필선',brand:'POUR솔루션',created:day(-500),updated:day(-400),code:'won',stage_code:'won',outcome:'won',won_amount:2e8,closed_at:day(-400),grp:'영업·관리',amt:2e8,workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄',activities:[]},
    {id:'33333333-3333-4333-8333-333333333333',site:'다른 현장',assignee:'황윤선',brand:'POUR솔루션',created:day(-30),code:'sent',stage_code:'sent',grp:'영업·관리',amt:1e8,manager_name:'최소장',manager_mobile:'01099998888',contacts:[],activities:[]}],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   window.__ops=[];window.queueDetailContactOperation=(op,payload,actionId)=>{const id='op-'+(__ops.length+1);__ops.push({id,op,payload,actionId});return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,object_id:o.payload.opportunity_id,operation:o.op,status:'done',payload:o.payload,ack:{ok:true,operation:o.op,activity_id:'srv-'+o.id,next_action_id:'srv-'+o.id}})).concat(__writes.map((w,i)=>w[0]==='contact_upsert'?{request_id:'req-'+(i+1),object_id:w[1].opportunity_id,operation:'contact_upsert',status:'done',payload:w[1],ack:{ok:true,operation:'contact_upsert',person_key:w[1].person_key,contact_id:'c-'+i}}:null).filter(Boolean));
   window.__sf=[];SB={rpc:async(name,args)=>{if(name==='crm_deal_stage_fields_update_v1'){__sf.push(args.p);const d=B.deals.find(x=>x.id===args.p.deal_id),cur=((d.stage_contexts||{})[args.p.stage_code]||{}).fields||{},fields=Object.assign({},cur);Object.entries(args.p.fields).forEach(([k,v])=>{if(v==null)delete fields[k];else fields[k]=v;});return {data:{ok:true,version:(d.version||1)+1,stage_context:{fields}}};}
   if(name==='crm_deal_closed_info_update_v1'){window.__ci=window.__ci||[];__ci.push(args.p);if(window.__ciMissing)return {error:{code:'PGRST202',message:'function not found'}};const d=B.deals.find(x=>x.id===args.p.deal_id),cur=((d.stage_contexts||{})[args.p.stage_code]||{}).fields||{},fields=Object.assign({},cur);Object.entries(args.p.fields||{}).forEach(([k,v])=>{if(v==null)delete fields[k];else fields[k]=v;});return {data:{ok:true,version:(d.version||1)+1,stage_code:args.p.stage_code,stage_context:{to:args.p.stage_code,fields},amount:args.p.amount!=null?args.p.amount:(d.amount??d.amt??null)}};}
   return {data:{ok:true,tasks:[]}};}};TOKEN='test';
   window.__ai=[];OpsStore.aiOn=()=>true;OpsStore.ai=async(kind)=>{__ai.push(kind);return {suggestion:kind==='next_action'?{how:'전화',what:'새 소장에게 기존 견적 조건 설명',days:1,why:'관리소장 변경 뒤 첫 응대가 없음'}:{opener:'안녕하세요 소장님',goal:'조건 확인',summary:''}};};
   window.__work=[];const fake={current:null,openWork:async(id,item)=>{fake.current=item;CUR_DETAIL={kind:'deal',key:dealKey(item),item};openWorkEdit();},save:async(item,payload)=>{if(item!==fake.current)throw Error('EDITOR_IDENTITY_MISMATCH');__work.push(payload);item.workItems=payload.work_items;item.primaryWork=payload.primary_work;closeNewDeal();renderDetail();}};window.Phase11=fake;
   G.pipeStageBOff=true;PipelineWorkspace.open('sent');
  });
  await page.waitForTimeout(200);
  await page.locator('#pipeline-list-v2 .plv-row',{hasText:'창동동아그린'}).locator('.plv-site').click();await page.waitForTimeout(600);
  const v=page.locator('#detailView.ddv.dv3');assert.equal(await v.count(),1,'정리된 상세');
  /* 2026-10-05 대표 "두 개 중복되는 것 같은데 오른쪽만 남겨 줘": 왼쪽에는 현장 정보가 없고, 오른쪽 '이 단계 필수 정보' 상자 하나 — 맨 위 공종 · 예상 금액, 그 아래 이 단계가 묻는 항목 */
  const L=v.locator('.dv3-left'),R=v.locator('.dw-right .da-stage-summary'),rows=()=>R.locator('.dv3-stage>.dv3-row>span:first-child').allInnerTexts();
  assert.deepEqual(await L.locator('.dv3-sec>header b').allInnerTexts(),['같은 현장 다른 영업','담당 정보','자료','다른 연락처'],'왼쪽에 현장 정보 없음');
  assert.equal(await L.locator('.dv3-row').count(),0);assert.equal(await v.locator('.dv3-sec>header b',{hasText:'현장 정보'}).count(),0);
  const labels=await rows();assert.deepEqual(labels.slice(0,2),['공종','예상 금액'],'오른쪽 상자 맨 위 = 공종 · 예상 금액 '+JSON.stringify(labels));assert.equal(new Set(labels).size,labels.length,'같은 항목이 두 번 나오지 않는다');assert.ok(labels.length>2,'이 단계 항목이 이어진다');
  assert.match(await R.locator('h3').innerText(),/^이 단계 필수 정보(\s*미입력 \d+)?$/);
  assert.equal(await R.evaluate(n=>{const m=n.querySelector('.dv3-miss'),k=n.querySelectorAll('.dv3-stage .dv3-val.empty, .dv3-stage .dv3-row>b.empty').length;return m?Number(m.textContent.replace(/\D/g,''))===k:k===0;}),true,'미입력 수 = 빈 줄 수');
  /* 담당 정보: 접어 둔 채 · 머리줄에 지금 담당 이름 · 영업 이력 칸 아래 */
  assert.deepEqual(await L.locator('.do-card').evaluate(n=>[[...n.querySelectorAll(':scope>header>*')].map(x=>x.textContent).filter(Boolean),n.querySelectorAll('.do-grid').length,n.previousElementSibling.querySelector('header b').textContent]),[['담당 정보','황윤선','펼치기'],0,'같은 현장 다른 영업']);
  /* 공종: 오른쪽 그 줄 아래에서 고친다 */
  await R.locator('.dv3-row.core',{hasText:'공종'}).locator('.dv3-val').click();await page.waitForTimeout(500);
  assert.equal(await R.locator('.dv3-slot[data-slot="work"] .dv3-work').count(),1,'공종 입력 상자는 오른쪽 상자 안');await R.locator('[data-dv3="workcancel"]').click();await page.waitForTimeout(200);
  /* 예상 금액: 그 자리 입력 또는 기존 금액 창이 이 상자 안에 */
  await R.locator('.dv3-row.core',{hasText:'예상 금액'}).locator('.dv3-val').click();await page.waitForTimeout(400);
  assert.equal(await R.evaluate(n=>!!n.querySelector('.dv3-row.core input.dv3-in')||!!n.querySelector('.dv3-slot[data-slot="site"]>*')),true,'예상 금액은 오른쪽 상자 안에서 고친다');
  await page.keyboard.press('Escape');await page.waitForTimeout(200);await page.evaluate(()=>{try{DetailActions.close();}catch(e){}const d=CUR_DETAIL.item;DealDetailV3.apply();});await page.waitForTimeout(300);
  /* 이 단계 항목: 그 자리 입력 → 진행 중 저장 함수 */
  {const b=R.locator('.dv3-stage .dv3-val[data-dv3="sfield"]').first();assert.ok(await b.count(),'눌러서 바로 입력하는 단계 항목');const key=await b.getAttribute('data-key'),n0=await page.evaluate(()=>__sf.length);await b.click();await page.waitForTimeout(200);
   const inp=R.locator('[data-dv3in="stage"][data-key="'+key+'"]');const multi=R.locator('.dv3-multi');if(await inp.count()){if(await inp.evaluate(n=>n.tagName)==='SELECT'){await inp.selectOption({index:1});}else{await inp.fill('확인함');await inp.press('Enter');}}else{assert.equal(await multi.count(),1,'여러 개 고르는 항목');await multi.locator('button:not(.done)').first().click();await multi.locator('.done').click();}await page.waitForTimeout(500);
   assert.equal(await page.evaluate(()=>__sf.length),n0+1,'단계 항목 저장');}
  /* 종료 건(수주): 공종 · 예상 금액 · 글 항목은 오른쪽에서 입력, 준공일 · 수주금액은 읽기 전용 — 종료 건 전용 함수로 저장 */
  await L.locator('.dv3-rel').first().click();await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.outcome),'won');
  {const k=await page.locator('#detailView .da-stage-summary .dv3-stage>.dv3-row').evaluateAll(l=>l.map(n=>[n.querySelector('span').textContent,n.querySelector('button.dv3-val')?'칸':'글']));
   assert.deepEqual(k,[['공종','칸'],['예상 금액','칸'],['확인된 준공일','글'],['준공 완료 확인','글'],['최종 수주금액(원)','글'],['이긴 이유','칸'],['경쟁사','칸'],['배운 점','칸']],'수주 건 오른쪽 상자 '+JSON.stringify(k));
   const R2=page.locator('#detailView .da-stage-summary');await R2.locator('.dv3-row.core',{hasText:'예상 금액'}).locator('.dv3-val').click();await page.waitForTimeout(200);
   const amt=R2.locator('.dv3-row.core input.dv3-in');await amt.fill('250,000,000');await amt.press('Enter');await page.waitForTimeout(400);
   assert.deepEqual(await page.evaluate(()=>__ci.slice(-1)[0]),{deal_id:'22222222-2222-4222-8222-222222222222',stage_code:'won',reason:'종료 건 상세에서 바로 입력',amount:250000000});
   await R2.locator('.dv3-row',{hasText:'경쟁사'}).locator('.dv3-val').click();await page.waitForTimeout(200);const c=R2.locator('[data-dv3in="stage"][data-key="competitor"]');await c.fill('한빛방수');await c.press('Enter');await page.waitForTimeout(400);
   assert.deepEqual(await page.evaluate(()=>__ci.slice(-1)[0].fields),{competitor:'한빛방수'});assert.equal(await page.evaluate(()=>[CUR_DETAIL.item.won_amount,CUR_DETAIL.item.outcome].join('|')),'200000000|won','수주금액 · 종료 상태 그대로');}
  /* 스위치: 예전처럼 왼쪽 '현장 정보' */
  await page.evaluate(()=>{G.dealSiteInfoLeft=true;renderDetail();});await page.waitForTimeout(500);
  assert.equal(await page.locator('#detailView .dv3-left .dv3-sec>header b',{hasText:'현장 정보'}).count(),1);assert.equal(await page.locator('#detailView .da-stage-summary .dv3-row.core').count(),0,'켜면 오른쪽 맨 위 줄은 빠진다');
  if(shot)await page.screenshot({path:shot+'-right-only.png'});
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',left_has_no_site_info:true,right_box_core_rows_first:true,owner_card_folded:true,work_and_amount_in_right_box:true,stage_field_inline:true,closed_deal_right_edit:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
