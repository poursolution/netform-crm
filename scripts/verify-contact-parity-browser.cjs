'use strict';
// Real PC composer and approved mobile D, identical synthetic records and confirmed queue contracts.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const env=require('../review-preview/review-environment.cjs'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'mobile.html';let file;
 for(const dir of [root,env.baseline]){const p=path.resolve(dir,rel);if(p.startsWith(dir+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile()){file=p;break;}}
 if(!file){res.writeHead(404);return res.end();}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'application/javascript; charset=utf-8');
 if(rel==='mobile.html')return res.end(fs.readFileSync(file,'utf8').replace('</body>','<script src="review-preview/fixture.js"></script></body>'));fs.createReadStream(file).pipe(res);
});
const ID='11111111-1111-4111-8111-111111111111',AID='99999999-9999-4999-8999-999999999999';
const cases=[
 {name:'connected new task preserves an existing task by blocking the unsupported add',ex:0,res:'연결됨',memo:'합성 고객 회의',mode:'new',purpose:'견적서 발송',after:4,blocked:true},
 {name:'connected new follow-up when no task exists',ex:null,res:'연결됨',memo:'합성 고객 회의',mode:'new',purpose:'견적서 발송',after:4},
 {name:'absence keeps a future customer task open',ex:5,res:'부재',mode:'keep'},
 {name:'earlier date cannot bypass the preserving schedule contract',ex:5,res:'회신 받음',memo:'합성 일정 협의',mode:'change',after:2,blocked:true},
 {name:'postpone retains the original task ID and reason',ex:5,res:'연결됨',memo:'합성 일정 협의',mode:'change',after:12,reason:'고객 회의 일정 변경'},
 {name:'wrong number creates contact verification without claiming connection',ex:null,res:'번호 오류',mode:'new',purpose:'연락처 확인',after:1},
 {name:'no next task requires a reason and creates only activity',ex:null,res:'연결됨',memo:'합성 검토 연기',mode:'none',reason:'내년 검토 시점 확인 필요'},
 {name:'bad fit recording does not close a deal or its existing task',ex:0,res:'배드핏',memo:'합성 자체 보수 완료',mode:'none',reason:'자체 보수 완료'},
 {name:'ACK failure retains input and retry uses the same activity ID',ex:0,res:'연결됨',memo:'합성 저장 실패 후 재시도 원문',mode:'keep',failOnce:true}
];
function installQueue(){
 const id='11111111-1111-4111-8111-111111111111';window.__ops=[];window.__flushReject=false;window.__flushes=0;
 window.Phase1={...Phase1,profile:{auth_uid:id,user_id:id,name:'합성 담당자',allowed_modes:['rep','admin']},rpc:async()=>{throw Error('Unexpected RPC');},queue:{list:()=>__ops,flush:async()=>{
  __flushes++;if(__flushReject){__flushReject=false;throw Error('합성 ACK 실패');}
  for(const row of __ops){if(row.status==='done')continue;const at=new Date().toISOString();row.ack={contract_version:1,ok:true,request_id:row.request_id,operation:row.operation,object_id:row.object_id,replayed:false,actor_auth_uid:id,actor_user_id:id,previous_version:0,version:1,activity_id:crypto.randomUUID(),audit_event_id:crypto.randomUUID(),meaningful_contact:!/부재|번호 오류/.test(row.payload.note),occurred_at:at,server_at:at};
   if(row.operation==='next_action')Object.assign(row.ack,{next_action_id:crypto.randomUUID(),cancelled_action_ids:[],due_at:row.payload.due_at,assignee_name:'합성 담당자'});
   if(row.payload.intent==='postpone')Object.assign(row.ack,{intent:'postpone',next_action_id:row.payload.action_id,previous_due_at:window.__existingDue,postpone_count:1,postpone_event_id:crypto.randomUUID()});OperationalAdapter.validateAck(row.ack,row);row.status='done';
  }
 }}};
 const enqueue=(operation,payload,actionId)=>{if(!['activity','next_action'].includes(operation))throw Error('Unexpected completion/write '+operation);const cmd=OperationalAdapter.normalize(operation,id,0,{intent:'standalone',...payload,...(actionId?{action_id:actionId}:{})});const q={...cmd,request_id:crypto.randomUUID(),auth_uid:id,user_id:id,status:'pending'};__ops.push(q);return q.request_id;};
 window.queueDetailContactOperation=enqueue;window.queueMobileContactOperation=enqueue;window.CRM_SCHEDULE_V1=false;
}
function initPC(c){
 const id='11111111-1111-4111-8111-111111111111',aid='99999999-9999-4999-8999-999999999999';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),day=n=>ContactEntry.addDays(today,n);window.__caseDate=day(c.after||0);window.__existingDue=c.ex===null?'':day(c.ex);window.__flushReject=!!c.failOnce;
 const task=c.ex===null?null:{id:aid,type:'전화',text:'대표회의 결과 확인',due:day(c.ex),due_at:day(c.ex),status:'open'};
 B={deals:[{id,site:'합성 일치 검증 현장',assignee:'합성 담당자',brand:'석민이앤씨',created:day(-34),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:0,version:0,manager_name:'합성 담당자',manager_mobile:'',contacts:[],activities:[],stage_contexts:{},next_action:task}],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
 LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id,name:'합성 담당자',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>{throw Error('Unexpected legacy write');};window.toast=()=>{};SB={rpc:async()=>({data:{ok:true,tasks:[],entries:[],sites:[]}})};OpsStore.aiOn=()=>false;try{closeDetail();}catch{}drwDeal(JSON.stringify(B.deals[0]));
}
function initMobile(c){
 closeSheet();sessionStorage.clear();const d=DEALS[0],today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),day=n=>ContactEntry.addDays(today,n);window.__caseDate=day(c.after||0);window.__existingDue=c.ex===null?'':day(c.ex);window.__flushReject=!!c.failOnce;
 d.nm='합성 일치 검증 현장';d.activities=[];d.tl=[];d.version=0;d.contactAt='';d.outcome='';d.nextAction=c.ex===null?null:{id:'99999999-9999-4999-8999-999999999999',type:'전화',text:'대표회의 결과 확인',due:day(c.ex),due_at:day(c.ex),status:'open'};d.nextActionObj=d.nextAction;Object.assign(MobileRequests.state(),{list:[],at:Date.now(),loaded:true,off:false});G.deal=d.id;G.sub=null;G.mobileV5Off=true;/* 같은 저장 명령 비교 = 예전 D 입력(끄기 경로) · v5 결과 화면은 verify-mobile-v5-result */render();MobileEntry.open();
}
const normalized=rows=>rows.map(r=>({operation:r.operation,object_id:r.object_id,type:r.payload.type||'',note:r.payload.note||'',text:r.payload.text||'',intent:r.payload.intent||'',due:r.payload.due_at||'',actionId:r.payload.action_id||''}));
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(env.launchOptions()),checks=[],errors=[],writes=[];
 async function make(width){const c=await browser.newContext({viewport:{width,height:1000},timezoneId:'Asia/Seoul'});await c.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){writes.push(r.request().method());return r.abort();}return new URL(r.request().url()).origin===origin?r.continue():r.abort();});const p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));return {context:c,page:p};}
 try{
  for(const c of cases){
   const pc=await make(1600),mo=await make(375);
   try{
    await pc.page.goto(origin+'/crm.html');await pc.page.waitForFunction(()=>window.DealDetailV3&&window.ContactEntry&&window.OperationalAdapter&&window.OpsStore);await pc.page.evaluate(installQueue);await pc.page.evaluate(initPC,c);await pc.page.evaluate(()=>DealDetailV3.openFrom('activity'));
    const pv=pc.page.locator('#detailView.dv3.dvt');await pv.locator('[data-dv3="rres"][data-v="'+c.res+'"]').click();if(c.memo)await pv.locator('#ddvComposer textarea').fill(c.memo);await pv.locator('[data-dv3="rmode"][data-v="'+c.mode+'"]').click();
    if(c.mode==='new')await pv.locator('[data-dv3rec="purpose"]').fill(c.purpose);
    if(['new','change'].includes(c.mode)){await pv.locator('[data-dv3="rdate"]').click();await pv.locator('[data-dv3rec="date"]').fill(await pc.page.evaluate(()=>__caseDate));}
    if(c.reason)await pv.locator('[data-dv3rec="reason"]').fill(c.reason);
    await mo.page.goto(origin+'/mobile.html?demo=1&review=contact&reset=1');await mo.page.locator('.approved-d').waitFor();await mo.page.evaluate(installQueue);await mo.page.evaluate(initMobile,c);const mv=mo.page.locator('.approved-d');
    await mv.locator('[data-ce="res"][data-v="'+c.res+'"]').click();if(c.memo)await mv.locator('[data-ce-in="memo"]').fill(c.memo);await mv.locator('[data-ce="mode"][data-v="'+c.mode+'"]').click();
    if(c.mode==='new')await mv.locator('[data-ce-in="purpose"]').fill(c.purpose);
    if(['new','change'].includes(c.mode)){await mv.locator('[data-ce="date-open"]').click();await mv.locator('[data-ce-in="date"]').fill(await mo.page.evaluate(()=>__caseDate));await mv.locator('.cd-date-sheet [data-ce="date-close"]').click();}
    if(c.reason)await mv.locator('[data-ce-in="reason"]').fill(c.reason);
    const pSave=pv.locator('#ddvComposer .idv-save'),mSave=mv.locator('[data-ce="save"]');
    if(c.blocked){await pSave.click();assert.equal(await mSave.isDisabled(),true);assert.deepEqual(await pc.page.evaluate(()=>__ops),[]);assert.deepEqual(await mo.page.evaluate(()=>__ops),[]);checks.push(c.name+' (both block without writes)');continue;}
    await pSave.click();await mSave.click();
    if(c.failOnce){await pv.locator('.dv3-recerr').waitFor();await mo.page.waitForFunction(()=>MobileEntry.state()?.err);const pa=await pc.page.evaluate(()=>__ops.map(x=>x.request_id)),ma=await mo.page.evaluate(()=>__ops.map(x=>x.request_id));assert.equal(pa.length,1);assert.equal(ma.length,1);assert.equal(await pc.page.evaluate(()=>CUR_DETAIL.item.activities.length),0);assert.equal(await mo.page.evaluate(()=>DEALS[0].activities.length),0);assert.equal(await pv.locator('#ddvComposer textarea').inputValue(),c.memo);assert.equal(await mv.locator('[data-ce-in="memo"]').inputValue(),c.memo);await pSave.click();await mSave.click();assert.deepEqual(await pc.page.evaluate(()=>__ops.map(x=>x.request_id)),pa);assert.deepEqual(await mo.page.evaluate(()=>__ops.map(x=>x.request_id)),ma);}
    await mo.page.waitForFunction(()=>MobileEntry.state()===null);await pc.page.waitForFunction(()=>__ops.length>0&&__ops.every(x=>x.status==='done'));
    const pr=await pc.page.evaluate(()=>structuredClone(__ops)),mr=await mo.page.evaluate(()=>structuredClone(__ops));assert(pr.length>0);assert.deepEqual(normalized(mr),normalized(pr),c.name);assert(!mr.some(x=>x.operation==='next_action_complete'));
    const projection=isPC=>{const d=isPC?CUR_DETAIL.item:DEALS[0],n=isPC?actionObj(d,itemPatch(d,'deal')):d.nextAction,ack=__ops.find(row=>row.operation==='next_action')?.ack;return {task:n?{type:n.type,text:n.text,due:n.due||n.due_at,status:n.status,idConfirmed:n.id===(ack?.next_action_id||'99999999-9999-4999-8999-999999999999')}:null,notes:(d.activities||[]).map(a=>a.note),stage:d.code||d.stage_code,outcome:d.outcome||'',completed:(d.completed_actions||[]).length};};
    const pp=await pc.page.evaluate(projection,true),mp=await mo.page.evaluate(projection,false);assert.deepEqual(mp,pp,'Confirmed activity/task projection matches: '+c.name);assert.equal(mp.notes.length,1);assert.equal(mp.completed,0);assert.equal(mp.outcome,'');if(mp.task){assert.equal(mp.task.idConfirmed,true);assert.equal(mp.task.status,'open');}assert.equal(await mo.page.locator('#scr .mv-now,#scr .mh-hub,#scr .flow-strip').count(),0);checks.push(c.name);
   }finally{await pc.context.close();await mo.context.close();}
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log(JSON.stringify({test:'PC and approved mobile D contact parity',passed:checks.length,checks,boundary:'Actual composer events and shared command/ACK validation with synthetic in-memory transport; production and network writes blocked.'},null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
