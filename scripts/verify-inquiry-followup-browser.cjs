'use strict';
/* Actual shared inquiry save against localhost-only synthetic RPCs. No production access. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const install=require('../tests/pc-inquiry-fixture.cjs');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1500,height:950},timezoneId:'Asia/Seoul'});
 await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.clock.setFixedTime(new Date('2026-10-21T10:00:00+09:00'));
 await page.goto('http://127.0.0.1:'+srv.address().port+'/crm.html');await page.waitForFunction(()=>window.InquiryListV3&&window.PCInquirySave&&window.InquiryScheduleFlow&&window.MobileSaveJournal);
 await page.addScriptTag({content:'window.__installInquiryTest='+install.toString()});
 const out=await page.evaluate(async()=>{
  const rows=[];function check(ok,message){if(!ok)throw Error(message);}
  function setup(status='전화응대 완료',hasExisting=false){
   const id=crypto.randomUUID(),f=__installInquiryTest(window,id),q={id,site:'합성 문의',status,assignee:'정정훈',assigned_to:f.uid,raw:{},first_response_at:status==='배정완료'?null:'2026-09-10T01:00:00Z'};
   Object.assign(f.state,{status,first_response_at:q.first_response_at,responded_at:q.first_response_at});
   Phase1.queue={list:()=>[],flush:async()=>{}};Phase1.subscribe=()=>()=>{};ME={id:f.uid,name:'정정훈',role:'rep'};B={deals:[],inquiries:[q],activities:[],inquiryTrash:[],expansion_pool:[]};LOCAL={deals:{},inquiries:{}};window.saveLocal=()=>{};window.__legacy=[];window.pushWrite=(...a)=>{__legacy.push(a);throw Error('legacy write forbidden');};
   let row;if(hasExisting){row={id:crypto.randomUUID(),inquiry_id:id,title:'약속한 자료 확인',action_type:'전화',due_on:'2026-10-28',due_at:'2026-10-28T00:00:00+09:00',status:'open',date_basis:'customer_agreed',completed_at:null};f.rows.push(row);q.nextActionObj={id:row.id,text:row.title,due:row.due_on,type:row.action_type,date_basis:row.date_basis};}
   const options={res:'[전화 · 연결됨] 고객과 자료 확인',next:row?.title||'자료 확인',due:'2026-10-28'};
   return {f,q,row,options,run:()=>InquiryListV3.record(q,options)};
  }
  for(const status of ['전화응대 완료','견적서 발송예정']){const x=setup(status,true),before=JSON.stringify(x.f.rows);check(await x.run()===true,'followup ACK');check(x.q.status===status,'no backward stage');check(x.f.responses.size===0&&x.f.schedules.size===0&&x.f.logs.size===1,'followup only contacts');check(JSON.stringify(x.f.rows)===before,'same original task');check(__legacy.length===0,'no legacy fallback');rows.push('followup '+status);}
  {const x=setup('배정완료');check(await x.run()===true,'first response ACK');check(x.f.logs.size===1&&x.f.responses.size===1&&x.f.schedules.size===1,'first response then schedule');check(x.q.status==='전화응대 완료'&&x.q.first_response_at,'server first response only');rows.push('first response');}
  {const x=setup('배정완료');x.options.res='[전화 · 부재]';check(await x.run()===true,'attempt ACK');check(x.f.logs.size===1&&x.f.responses.size===0&&x.q.status==='배정완료'&&x.f.schedules.size===1,'attempt does not complete contact');rows.push('absence');}
  {const x=setup('전화응대 완료',true),before=JSON.stringify(x.f.rows);x.options.due='2026-10-29';let error='';try{await x.run()}catch(e){error=e.message}check(/기존 일정/.test(error)&&x.f.logs.size===0,'reject unconfirmed replacement before contact');check(JSON.stringify(x.f.rows)===before,'original appointment preserved');rows.push('existing task conflict');}
  {const x=setup('배정완료');x.f.hold='crm_inquiry_command_v1';const job=x.run();for(let n=0;n<200&&!x.f.release;n++)await new Promise(r=>setTimeout(r,5));check(x.f.release&&x.q.status==='배정완료'&&!x.q.nextActionObj,'no projection before ACK');let duplicate='';try{await x.run()}catch(e){duplicate=e.message}check(/저장 확인 중/.test(duplicate),'duplicate in-flight blocked');x.f.release();check(await job===true&&x.f.logs.size===1,'one activity after ACK');rows.push('ACK and double click');}
  {const x=setup('배정완료');x.f.loss='crm_schedule_write_v1';let error='';try{await x.run()}catch(e){error=e.message}check(error&&x.f.logs.size===1&&x.f.schedules.size===1,'partial commit retained');const held=PCInquirySave.pending(x.q.id),request=held.progress.contact.request_id;check(await x.run()===true,'retry remaining save');check(x.f.logs.size===1&&x.f.schedules.size===1&&Array.from(x.f.logs.values())[0].request_id===request,'same UUID no duplicate schedule');rows.push('partial retry');}
  {const x=setup('배정완료');x.f.badAck=true;let error='';try{await x.run()}catch(e){error=e.message}check(/저장 근거/.test(error)&&x.q.status==='배정완료'&&x.f.responses.size===0&&x.f.schedules.size===0,'invalid ACK not projected');check(PCInquirySave.pending(x.q.id).form.res===x.options.res,'original input retained');rows.push('invalid ACK');}
  {const x=setup();x.options.res='사진 전달 약속';let error='';try{await x.run()}catch(e){error=e.message}check(/연락 결과/.test(error)&&x.f.calls.length===0,'free text never invents connection');rows.push('no inferred contact');}
  {const x=setup();CRMRelease.has=()=>false;let error='';try{await x.run()}catch(e){error=e.message}check(error&&x.f.calls.length===0&&__legacy.length===0,'unavailable server has no fallback');rows.push('gate closed');}
  return rows;
 });
 assert.equal(out.length,10);assert.deepEqual(errs,[]);const src=f=>fs.readFileSync(path.join(root,f),'utf8');assert.match(src('today-v3.js'),/await root.InquiryListV3.record/);assert.match(src('inquiry-workbench.js'),/Promise.resolve\(root.InquiryListV3.record/);
 console.log(JSON.stringify({status:'PASS',checks:out,external_writes:0,shared_save:true}));
}finally{await browser.close();await new Promise(r=>srv.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
