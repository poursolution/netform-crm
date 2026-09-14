'use strict';
// All data is synthetic and every non-local request is blocked.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');
async function run(){
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1365,height:900}}),errors=[];
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.DetailWorkspace&&window.StageTransitionUI);
  await page.evaluate(()=>{
   FIELD_DEMO=true;AUTH_ON=false;ME={name:'송보람',role:'admin'};saveLocal=()=>{};window.writes=[];pushWrite=(...x)=>writes.push(x);
   const d={id:'b5d27a2a-5243-4acd-afb9-d973a15af9d1',site:'검증 고객아파트',brand:'POUR솔루션',assignee:'황윤선',code:'rapport',created:'2026-01-01',amt:10000000,relationshipReason:'내년도 사업 검토',manager_name:'검증소장',manager_mobile:'01000000000',office_phone:'0200000000',activities:[{at:'2026-09-10T12:00:00+09:00',type:'전화',note:'예산 편성 확인',result:'10월 재검토'}],nextActionObj:{text:'예산 확정 확인',due:'2026-09-18',type:'전화',status:'open'}};
   B={deals:[d],inquiries:[],users:[],sales_people:[],activities:[],sites:[],contacts:[],dups:[],expansion_pool:[],expansionPool:[],expansion_events:[],customerSupportActions:[],customer_support_actions:[],messageLogs:[],message_logs:[],campaigns:[],campaign_logs:[],repManagerComments:[],rep_manager_comments:[]};LOCAL={deals:{},inquiries:{}};
   G.page='relationship';G.relationshipFilter='all';G.relationshipOwner='전체';G._detailPopup=true;document.getElementById('authGate').classList.remove('on');document.getElementById('authGate').style.display='none';syncPage();drwDeal(JSON.stringify(d));
  });
  for(let repeat=0;repeat<3;repeat++){
   await page.evaluate(()=>renderDetail());
   for(const selector of ['#activityFormCard','#nextActionCard','#contactCard','.relm-detail-context','#execFiles'])assert.equal(await page.locator(selector).count(),1,selector+' must not accumulate across renders');
  }
  assert.equal(await page.locator('.dsec[data-sec="개요"] #contactCard').count(),0);
  assert.equal(await page.locator('.dsec[data-sec="연락·활동"] #contactCard').count(),1);
  assert.equal(await page.locator('#ct-office').isVisible(),false);
  await page.evaluate(()=>detailTabFocus('연락·활동',true));
  assert.equal(await page.locator('.pc-contact-directory').count(),1);
  assert.equal(await page.locator('.pc-contact-directory').getByRole('button',{name:'＋ 추가',exact:true}).count(),1);
  assert.ok(await page.locator('.pc-contact-directory a[href^="tel:"]').count()>0);
  assert.ok(await page.locator('.pc-contact-directory').getByRole('button',{name:'수정',exact:true}).count()>0);

  await page.locator('.pc-contact-directory').getByRole('button',{name:'수정',exact:true}).first().click();
  assert.equal(await page.locator('#quickContactModal').isVisible(),true);
  assert.ok((await page.locator('#qc-mobile').inputValue()).length>0);
  assert.equal(await page.locator('#qc-name').isVisible(),true);
  assert.equal(await page.locator('#qc-role').isVisible(),true);
  assert.equal(await page.locator('#qc-office').isVisible(),false);
  assert.equal(await page.locator('#qc-sms').count(),1);
  assert.equal(await page.locator('#qc-decision-role').count(),1);
  assert.equal(await page.locator('#qc-relation-tone').count(),1);
  assert.equal(await page.locator('#qc-decision-role').isDisabled(),true);
  assert.equal(await page.locator('#qc-relation-tone').isDisabled(),true);
  assert.equal(await page.locator('#pc-contact-relation-notice').count(),1);
  const controlsBefore=await page.locator('#quickContactBody input, #quickContactBody select').evaluateAll(nodes=>nodes.map(n=>[n.id,n.value,n.checked]));
  await page.locator('.pc-contact-editor-extra>summary').click();
  assert.equal(await page.locator('#qc-office').isVisible(),true);
  assert.deepEqual(await page.locator('#quickContactBody input, #quickContactBody select').evaluateAll(nodes=>nodes.map(n=>[n.id,n.value,n.checked])),controlsBefore);
  await page.locator('.pc-contact-editor-extra>summary').click();
  await page.evaluate(()=>quickContactErr('수신 동의 확인 일시를 입력해 주세요.'));
  await page.waitForFunction(()=>document.querySelector('.pc-contact-editor-extra').open);
  for(const width of [1280,1920]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.locator('#quickContactBody').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,'contact form must not overflow');
  }
  assert.equal(await page.evaluate(()=>writes.length),0,'opening/closing contact fields must not write');
  await page.evaluate(()=>closeQuickContact());
  await page.screenshot({path:path.resolve(root,'pc-contact-preview.png'),animations:'disabled'});
  const empty=await page.evaluate(()=>contactDirectoryHTML({id:'empty',site:'빈 현장',contacts:[]},{}));
  assert.match(empty,/등록된 현장 연락처가 없습니다/);
  assert.equal((empty.match(/openQuickContact/g)||[]).length,1);
  const primaryResult=await page.evaluate(async()=>{
   const item=CUR_DETAIL.item,previous=item.manager_mobile;
   item.contacts=[{person_key:'mobile:01011112222',name:'검증담당',mobile:'01011112222',role:'현장대리인',sms_consent:true,kakao_consent:false,consent_at:'2026-09-01T00:00:00Z',send_blocked:false,decision_role:'실무자',relationship_tone:'우호적'}];
   const originalList=Phase1.queue.list,originalFlush=Phase1.queue.flush;let command,requests=0,retries=0;
   Phase1.queue.flush=async()=>{retries++;};
   Phase1.queue.list=()=>command?[command]:[];
   pushWrite=(operation,payload)=>{requests++;command={request_id:'synthetic-primary',operation,object_id:item.id,payload,status:'pending'};return command.request_id;};
   pcSetPrimaryContact('mobile:01011112222');
   const unchangedBeforeAck=item.manager_mobile===previous;
   pcSetPrimaryContact('mobile:01011112222');
   command.status='uncertain';window.dispatchEvent(new Event('phase1:queue'));
   const unchangedOnFailure=item.manager_mobile===previous;
   const retryVisible=contactDirectoryHTML(item,itemPatch(item,'deal')).includes('대표 지정 재시도');
   pcSetPrimaryContact('mobile:01011112222');await Promise.resolve();await Promise.resolve();
   command.status='done';command.ack={person_key:'mobile:01011112222',contact_id:'ef51c1b5-3558-463f-bf14-e9f7bfdf51d2'};
   window.dispatchEvent(new Event('phase1:queue'));
   const result={unchangedBeforeAck,unchangedOnFailure,requests,retries,retryVisible,selected:item.manager_mobile,primary:command.payload.is_primary,sms:command.payload.sms_consent,consent:command.payload.consent_at,relation:item.contacts[0].relationship_tone};
   for(const status of ['rejected','conflict']){
    pcSetPrimaryContact('mobile:01011112222');command.status=status;window.dispatchEvent(new Event('phase1:queue'));
    if(contactDirectoryHTML(item,itemPatch(item,'deal')).includes('지정 확인 중'))throw Error('Rejected request left controls locked');
   }
   Phase1.queue.list=originalList;Phase1.queue.flush=originalFlush;return result;
  });
  assert.deepEqual(primaryResult,{unchangedBeforeAck:true,unchangedOnFailure:true,requests:1,retries:1,retryVisible:true,selected:'01011112222',primary:true,sms:true,consent:'2026-09-01T00:00:00Z',relation:'우호적'});
  const editResult=await page.evaluate(()=>{
   const item=CUR_DETAIL.item,oldName=item.contacts[0].name,originalList=Phase1.queue.list;let command,calls=0;
   Phase1.queue.list=()=>command?[command]:[];
   pushWrite=(operation,payload)=>{calls++;if(operation!=='contact_upsert')throw Error('unsupported operation');command={request_id:'synthetic-edit',operation,object_id:item.id,payload,status:'pending'};return command.request_id;};
   openQuickContact('edit','mobile:01011112222');
   const role=document.getElementById('qc-role').value;
   document.getElementById('qc-name').value='변경된 담당자';saveQuickContact();saveQuickContact();
   const before=item.contacts[0].name===oldName;
   command.status='rejected';window.dispatchEvent(new Event('phase1:queue'));
   const failure=item.contacts[0].name===oldName&&!!QUICK_CONTACT&&document.getElementById('qc-name').value==='변경된 담당자';
   saveQuickContact();command.status='done';command.ack={person_key:'mobile:01011112222',contact_id:'ef51c1b5-3558-463f-bf14-e9f7bfdf51d2'};window.dispatchEvent(new Event('phase1:queue'));
   const result={role,before,failure,calls,name:item.contacts[0].name,relation:item.contacts[0].relationship_tone,consent:command.payload.consent_at,closed:!QUICK_CONTACT};
   Phase1.queue.list=originalList;return result;
  });
  assert.deepEqual(editResult,{role:'현장대리인',before:true,failure:true,calls:2,name:'변경된 담당자',relation:'우호적',consent:'2026-09-01T00:00:00Z',closed:true});
  console.log(JSON.stringify({status:'PASS',compact_contacts:true,one_add:true,phone_link:true,edit_form:true,auxiliary_values_preserved:true,validation_reveals_fields:true,no_horizontal_overflow:true,empty_state:true,primary_after_ack:true,failed_primary_preserved:true,no_duplicate_primary_request:true,external_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
run().catch(e=>{console.error(e);process.exitCode=1});
