'use strict';
// Isolated UI+client contract test. No network, real identity, database or messages.
const path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({timezoneId:'Asia/Seoul'});await page.route('**/*',r=>r.request().url()==='https://crm.test/'?r.fulfill({status:200,contentType:'text/html',body:'<div id="requests"></div>'}):r.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://crm.test/');
 for(const f of ['manager-request-client.js','pc-manager-requests.js'])await page.addScriptTag({path:path.resolve(__dirname,'..',f)});
 await page.evaluate(()=>{
  window.id=n=>'f6091600-0916-4000-8000-'+String(n).padStart(12,'0');
  window.saved=new Map();window.calls=[];window.fail=false;
  window.transport={profile:{auth_uid:id(9)},storage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},rpc:async(name,p)=>{
   if(name==='crm_manager_request_list_v1')return [];
   calls.push(JSON.parse(JSON.stringify(p)));if(fail)throw Error('test unavailable');return {ok:true,id:id(1),request_id:p.p_id,delivery:'not_sent'};
  }};
  window.client=ManagerRequestClient.createClient(transport);
  window.controller=PCManagerRequests.mount(window,document.querySelector('#requests'),client,{retryStore:client.retryStore,isAdmin:()=>true,openInquiry:()=>{}});
  window.openRequest=()=>controller.open({id:id(2),site:'테스트 현장',owner:'테스트 담당자'});
  window.future=new Date(Date.now()+86400000).toLocaleString('sv-SE',{timeZone:'Asia/Seoul'}).replace(' ','T');
 });
 await page.evaluate(()=>openRequest());
 await page.locator('[name=due]').fill(await page.evaluate(()=>future));
 await page.getByRole('button',{name:'요청 저장',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('요청 저장 완료'));
 assert.match(await page.locator('[role=status]').textContent(),/카카오 미발송/);
 assert.equal(await page.evaluate(()=>saved.size),0);assert.equal(await page.evaluate(()=>calls.length),1);
 await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('dialog'));
 await page.evaluate(()=>{fail=true;openRequest();});
 await page.locator('[name=kind]').selectOption('next');await page.locator('[name=due]').fill(await page.evaluate(()=>future));
 await page.getByRole('button',{name:'요청 저장',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('같은 요청'));
 assert.equal(await page.evaluate(()=>saved.size),1);
 await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('dialog'));
 await page.evaluate(()=>{fail=false;openRequest();});
 await page.getByRole('button',{name:'요청 저장',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('요청 저장 완료'));
 assert.deepEqual(await page.evaluate(()=>calls[1]),await page.evaluate(()=>calls[2]));assert.equal(await page.evaluate(()=>saved.size),0);
 await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('dialog'));
 await page.evaluate(()=>{
  const p={p_id:id(6),p_target:id(2),p_kind:'report',p_due:new Date(Date.now()+86400000).toISOString(),p_instruction:'보고 요청'};
  const signature=JSON.stringify({p_target:p.p_target,p_kind:p.p_kind,p_due:p.p_due,p_instruction:p.p_instruction});
  saved.set('manager-request-pending:'+id(2),JSON.stringify({payload:p,signature}));openRequest();
 });
 assert.match(await page.locator('[role=status]').textContent(),/이전 요청 확인/);
 assert.equal(await page.getByRole('button',{name:'요청 저장',exact:true}).isDisabled(),true);
 assert.equal(await page.evaluate(()=>calls.length),3);assert.equal(await page.evaluate(()=>saved.size),1);
 assert.deepEqual(errors,[]);console.log('PASS: actual UI/client normal save, unsent label, failed retry retention, identical resend, unsupported journal blocked without deletion');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
