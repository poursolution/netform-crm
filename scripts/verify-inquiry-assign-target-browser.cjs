'use strict';
/* 견적문의 상세의 배정 대상 검사(2026-10-04 대표 "이것도 안 돼" — 운영에서 실제로 있었던 일)
   같은 문의가 서버에 두 줄(홈페이지 접수 + 구글시트) 있을 때, 열어 둔 창의 문의가 아니라 목록에서 마지막으로 다시 그려진 다른 줄로 배정이 저장됐다
   (공용 상태 INQ_CTL_MODAL 을 목록의 줄 펼침 · 다시 그리기가 바꿈). 서버에는 성공으로 남고, 보고 있던 줄은 계속 미배정.
   → 배정 · 인계는 항상 지금 창의 문의로 간다. 영업이사(서버 확인 뒤 반영)는 확인이 끝날 때까지 버튼이 잠겨 같은 요청이 여러 번 가지 않는다. 서버가 거절하면 문구가 남고 다시 누를 수 있다. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1400,height:940},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-04T16:19:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryWorkbench&&window.InquiryDetailV2&&window.InquiryListV3);
  await page.evaluate(()=>{
   /* 운영에서 읽은 두 줄과 같은 모양: 같은 현장 · 같은 연락처 · 1초 차이 */
   const base={brand:'POUR솔루션',phone:'010-4336-8628',status:'접수',address:'서울시 성북구 보국문로32길 53',channel:'홈페이지',site_name:'[서울] 정릉중앙하이츠아파트',site:'[서울] 정릉중앙하이츠아파트',work_type:'옥상방수',work:'옥상방수',contact_name:'권오천',contact:'권오천',business_type:'견적문의',assigned_to:null,assignee_name:null,assignee:'',sales_assignee:'',detail:{inquiry:'옥상방수공사',workType:'옥상방수',channel:'홈페이지',phone:'010-4336-8628'}};
   const mk=(id,extra)=>Object.assign({},base,{id,created_at:'2026-09-18T00:45:11.690Z',received_at:'2026-09-18T00:45:11.690Z',at:'2026-09-18T00:45:11.690Z',updated_at:'2026-09-18T00:45:11.690Z'},extra||{});
   window.SHOWN='4b069f84-4780-457c-9164-55ebe85a5db9';window.TWIN='a27cf4e6-2f25-4fde-be81-0b0f9f38383e';window.THIRD='cccccccc-0000-4000-8000-000000000003';
   B={deals:[],inquiries:[mk(SHOWN,{inquiry_type:'견적문의',source_channel:'홈페이지'}),mk(TWIN,{inquiry_type:'관리소장'}),mk(THIRD,{site:'[경기 광주] 신영프로방스아파트',site_name:'[경기 광주] 신영프로방스아파트',phone:'031-798-3819',contact:'관리소직원',contact_name:'관리소직원'})],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];const assignmentQueue=[];window.pushWrite=(op,p)=>{__writes.push([op,p&&p.inquiry_id||'',p&&p.to||'']);const request_id='req-'+__writes.length;assignmentQueue.push({request_id,operation:op,object_id:p.inquiry_id,payload:p,status:'pending'});return request_id;};
   window.Phase1={profile:{auth_uid:'admin'},queue:{list:()=>assignmentQueue,flush:async()=>{for(const x of assignmentQueue){x.status='done';x.ack={assigned_to:'aaaaaaaa-0000-4000-8000-000000000001'};}}},read:async(resource,args)=>{const q=B.inquiries.find(q=>q.id===args.id),last=assignmentQueue.filter(x=>x.object_id===args.id).at(-1);return {data:{item:{...q,assigned_to:'aaaaaaaa-0000-4000-8000-000000000001',assignee_name:last.payload.to,status:'배정완료',assignment_history:[]}}};}};
   window.__calls=[];window.__mode='ok';window.__hold=null;
   SB={rpc:(name,args)=>{const p=args&&args.p||{};if(name!=='crm_inquiry_director_assign_v1')return Promise.resolve({error:{message:'CONTRACT_UNAVAILABLE'}});__calls.push([p.inquiry_id,p.to_name,p.reason]);
     if(__mode==='fail')return Promise.resolve({error:{message:'forbidden'}});
     return new Promise(res=>{window.__hold=()=>res({data:{ok:true,assigned_at:new Date().toISOString(),status:'배정완료'}});});}};
   goPage('inq');
  });
  await page.waitForTimeout(600);
  const owner=id=>page.evaluate(id=>{const q=inqCtlFind(id,false);return (inquiryRoutedOwner(q)||'미배정')+'|'+q.status;},id);
  const SHOWN=await page.evaluate(()=>SHOWN),TWIN=await page.evaluate(()=>TWIN),THIRD=await page.evaluate(()=>THIRD);
  const dlg=page.locator('#inq-inbox-dialog');
  const pick=async name=>{if(!(await dlg.locator('[data-idv="rep"][data-v="'+name+'"]').count())){const more=dlg.locator('[data-idv="showall"]');if(await more.count())await more.click();}await dlg.locator('[data-idv="rep"][data-v="'+name+'"]').click();await page.waitForTimeout(120);};
  /* 1. 창은 SHOWN 을 보여 주는데, 목록이 쌍둥이(TWIN) 줄의 배정 칸을 다시 그려 공용 상태가 TWIN 을 가리키게 된 상황 */
  await page.evaluate(()=>InquiryWorkbench.open(SHOWN));await page.waitForTimeout(600);
  assert.match(await dlg.innerText(),/정릉중앙하이츠아파트[\s\S]*담당자 배정/);
  await pick('전용성');await dlg.locator('[data-idv="reason"]').fill('전용성이사님 영업건');
  await page.evaluate(()=>{inqCtlAssignInline(inqCtlFind(TWIN,false));});
  assert.deepEqual(await page.evaluate(()=>INQ_CTL_MODAL.keys),[TWIN],'목록이 다시 그려지면 공용 상태는 다른 줄을 가리킨다(재현 조건)');
  await dlg.locator('[data-idv="assign"]').click();await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>__calls),[[SHOWN,'전용성','전용성이사님 영업건']],'배정은 지금 창의 문의로 간다');
  /* 2. 서버 확인을 기다리는 동안: 버튼 잠금 · 다시 눌러도 요청은 한 번 */
  assert.deepEqual(await dlg.locator('[data-idv="assign"]').evaluate(n=>[n.disabled,n.textContent]),[true,'서버 저장 확인 중…']);
  await page.evaluate(()=>{const b=document.querySelector('#inq-inbox-dialog [data-idv="assign"]');b.disabled=false;b.click();b.click();});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>__calls.length),1,'확인 중에는 같은 요청을 다시 보내지 않는다');
  await page.evaluate(()=>__hold());await page.waitForTimeout(900);
  assert.equal(await owner(SHOWN),'전용성|배정완료');assert.equal(await owner(TWIN),'미배정|접수','다른 줄은 건드리지 않는다');
  assert.equal(await dlg.locator('[data-idv="assign"]').count(),0,'서버 확인 뒤 창이 배정된 상태로 바뀐다');assert.match(await dlg.innerText(),/담당 전용성/);
  /* 3. 본사 영업(바로 반영)도 같은 규칙: 창의 문의로 저장 요청이 간다 */
  await page.evaluate(()=>InquiryWorkbench.open(THIRD));await page.waitForTimeout(600);
  await pick('이필선');await page.evaluate(()=>{inqCtlAssignInline(inqCtlFind(TWIN,false));});
  await dlg.locator('[data-idv="assign"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__writes.filter(w=>w[0]==='inquiry_assign')),[['inquiry_assign',THIRD,'이필선']]);
  assert.equal(await owner(THIRD),'이필선|배정완료');assert.equal(await owner(TWIN),'미배정|접수');
  /* 4. 서버가 거절하면: 문구가 남고 버튼이 다시 열린다 · 문의는 그대로 */
  await page.evaluate(()=>{__mode='fail';__calls.length=0;InquiryWorkbench.open(TWIN);});await page.waitForTimeout(600);
  await pick('조성용');await dlg.locator('[data-idv="assign"]').click();await page.waitForTimeout(900);
  assert.deepEqual(await page.evaluate(()=>__calls.map(c=>c.slice(0,2))),[[TWIN,'조성용']]);
  assert.match(await page.evaluate(()=>document.getElementById('inq-ctl-error').textContent),/^영업이사 배정을 저장하지 못했습니다: forbidden$/);
  assert.deepEqual(await dlg.locator('[data-idv="assign"]').evaluate(n=>[n.disabled,n.textContent]),[false,'조성용에게 배정']);
  assert.equal(await owner(TWIN),'미배정|접수');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',assign_targets_open_inquiry:true,director_locked_while_confirming:true,single_request:true,dialog_flips_after_server:true,direct_rep_same_rule:true,server_reject_shown_and_retry:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
