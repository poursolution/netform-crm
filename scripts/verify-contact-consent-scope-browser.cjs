'use strict';
/* 영업건 상세보기 정리 검사(2026-10-03 design_handoff_detail_panel):
   왼쪽 5구역(관리소장 · 같은 현장 다른 영업 · 현장 정보 · 자료 · 다른 연락처) · 같은 사람 한 번 · 전화 버튼 하나 ·
   수정 · 공종 · 정보 · 자료 보기는 누른 자리에서 펼쳐지고 오른쪽 '지금 할 일'은 그대로 · AI 판단 카드 없음(지금 할 일 안) · 필수 정보 중복 제거 · 창 크기 · 끄기
   연락하고 결과 남기기 = 지금 할 일 카드 안(수단 · 결과 · 메모 · 다음 행동일 · 저장) · 단계 바꾸기 = 머리글 띠(오른쪽 그대로 · 칩 · 옮기기) · 소장이 바뀌었어요 = 관리소장 카드 안 상자 */
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
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;G.siteHistoryOff=true;G.dealSiteInfoLeft=true;/* 이 검사는 '같은 현장 다른 영업' + 왼쪽 '현장 정보'가 있는 예전 배치를 본다 — 기본 배치(오른쪽만)는 verify-deal-right-only-browser.cjs */
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

  await page.evaluate(()=>{
   const d=B.deals[0];d.manager_name='테스트 소장';d.manager_mobile='010-1234-5678';d.contacts[0].mobile=d.manager_mobile;d.contacts[0].name=d.manager_name;
   drwDeal(JSON.stringify(d));
   const stale=document.createElement('div');stale.id='stale-contact-fixture';stale.hidden=true;
   stale.innerHTML='<input id="qc-name" value=""><input id="qc-mobile" value=""><input id="qc-role" value="담당자"><input id="qc-decision-role" value=""><input id="qc-relation-tone" value=""><div id="qc-err"></div>';
   document.body.prepend(stale);
  });
  await page.locator('.dv3-left [data-dv3="cons"][data-k="sms"]').click();
  await page.waitForTimeout(150);
  let writes=await page.evaluate(()=>__writes.filter(w=>w[0]==='contact_upsert'));
  assert.equal(writes.length,1,'consent must read the selected contact, not stale duplicate inputs');
  assert.equal(writes[0][1].manager_name,'테스트 소장');assert.equal(writes[0][1].manager_mobile,'01012345678');
  assert.equal(writes[0][1].sms_consent,true);assert.equal(writes[0][1].kakao_consent,false);
  assert.equal(await page.locator('#stale-contact-fixture #qc-err').innerText(),'');
  await page.locator('.dv3-left [data-dv3="cons"][data-k="kakao"]').click();
  writes=await page.evaluate(()=>__writes.filter(w=>w[0]==='contact_upsert'));
  assert.equal(writes.length,2);assert.equal(writes[1][1].sms_consent,true);assert.equal(writes[1][1].kakao_consent,true);
  await page.locator('.dv3-left [data-dv3="cons"][data-k="sms"]').click();
  writes=await page.evaluate(()=>__writes.filter(w=>w[0]==='contact_upsert'));
  assert.equal(writes.length,3);assert.equal(writes[2][1].sms_consent,false);assert.equal(writes[2][1].kakao_consent,true);
  await page.evaluate(()=>{const d=CUR_DETAIL.item;d.manager_mobile='010-1234';d.contacts[0].mobile=d.manager_mobile;d.contact={name:'테스트 소장',mobile:d.manager_mobile,role:'관리소장'};itemPatch(d,'deal').contact=d.contact;renderDetail();});
  await page.locator('.dv3-left [data-dv3="cons"][data-k="sms"]').click();
  assert.equal(await page.evaluate(()=>__writes.filter(w=>w[0]==='contact_upsert').length),3,'invalid selected number must still be blocked');
  assert.equal(await page.locator('#stale-contact-fixture #qc-err').innerText(),'','validation belongs to active form');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',duplicate_inputs_isolated:true,hyphenated_mobile:true,both_channels_preserved:true,invalid_number_blocked:true}));
 }finally{await browser.close();await new Promise(r=>srv.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
