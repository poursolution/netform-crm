const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const install=require('./pc-inquiry-fixture.cjs'),schedule=require('../schedule-contract'),response=require('../inquiry-response-contract'),flow=require('../inquiry-schedule-flow'),save=require('../pc-inquiry-save');
function setup(){
 const root={crypto,addEventListener:()=>{}},id=crypto.randomUUID(),f=install(root,id),records=new Map(),patch={};
 f.session=0;
 root.MobileSaveJournal={session:()=>String(f.session),assertSession:s=>{assert.equal(s,String(f.session),'session changed');},owner:()=>root.Phase1.profile.auth_uid+':'+root.Phase1.profile.user_id,assertOwner:o=>{assert.equal(o,root.MobileSaveJournal.owner(),'identity changed');},read:(k,id)=>records.has(id)?structuredClone(records.get(id)):null,write:(k,id,d)=>{if(f.quota)throw Error('quota');records.set(id,structuredClone(d));},drop:(k,id)=>records.delete(id)};
 root.InquiryFlow={kindOf:r=>['부재','번호오류'].includes(r)?'attempt':['연결됨','고객 회신','검토중','자료요청','견적요청','보류','거절'].includes(r)?'connected':'',readLine:s=>{const m=/^\[([^·]+) · ([^\]]+)\]\s*(.*)$/.exec(s);return m?{ch:m[1],res:m[2],text:m[3]}:null;},take:()=>{}};
 root.InquiryCommand={needsProgress:q=>q.status==='배정완료'};root.itemPatch=()=>patch;root.saveLocal=()=>{};
 root.ScheduleContract=schedule(root);root.InquiryResponseContract=response(root);root.InquiryScheduleFlow=flow(root);root.PCInquirySave=save(root);
 const q={id,status:'배정완료',raw:{}},options={ch:'전화',result:'연결됨',text:'상담 완료',next:'견적 준비',due:'2026-11-20',contact_result:'연결됨',customer_reaction:''};
 return {...f,f,root,q,options,records,patch,api:root.PCInquirySave,run:()=>root.PCInquirySave.save(q,options,{text:options.text},'detail')};
}
test('PC contact -> first response -> schedule; projects only confirmed server data',async()=>{const f=setup();assert.equal(await f.run(),true);assert.equal(f.logs.size,1);assert.equal(f.responses.size,1);assert.equal(f.schedules.size,1);assert.equal(f.q.status,'전화응대 완료');assert.equal(f.q.nextActionObj.id,f.rows[0].id);assert.equal(f.records.size,0);assert.equal(f.patch.nextActionObj.id,f.rows[0].id);});
test('absence records attempt without first-response or completion',async()=>{const f=setup();Object.assign(f.options,{result:'부재',contact_result:'부재'});await f.run();assert.equal(f.responses.size,0);assert.equal(f.q.status,'배정완료');assert(f.rows.every(x=>x.status==='open'));});
test('existing task is retained; differing proposed next action blocks before contact',async()=>{const f=setup(),row={id:crypto.randomUUID(),title:'기존 방문',due_on:'2026-11-20',action_type:'방문',status:'open',date_basis:'unconfirmed'};f.rows.push(row);f.q.nextActionObj={id:row.id,text:row.title,due:row.due_on};await assert.rejects(f.run,/기존 일정/);assert.equal(f.logs.size,0);f.options.next=row.title;await f.run();assert.equal(f.rows.length,1);assert.equal(f.schedules.size,0);assert.equal(f.responses.size,1);});
test('server-only unseen task blocks before contact',async()=>{const f=setup();f.rows.push({id:crypto.randomUUID(),title:'다른 기기 업무',due_on:'2026-11-20',status:'open',date_basis:'internal_plan'});await assert.rejects(f.run,/STALE/);assert.equal(f.logs.size,0);});
test('loss after each commit retries same IDs without duplicate records',async()=>{for(const name of ['crm_inquiry_command_v1','crm_inquiry_response_confirm_v1','crm_schedule_write_v1']){const f=setup();f.f.loss=name;await assert.rejects(f.run,/lost/);const original=f.records.get(f.id).progress.contact.request_id;f.root.PCInquirySave=save(f.root);await f.root.PCInquirySave.save(f.q,f.options,{},'detail');assert.equal(f.logs.size,1);assert.equal([...f.logs.values()][0].request_id,original);assert.equal(f.responses.size,1);assert.equal(f.rows.length,1);}});
test('inflight double click rejected while form state and status remain unchanged',async()=>{const f=setup();f.f.hold='crm_inquiry_command_v1';const running=f.run();while(!f.f.release)await new Promise(r=>setImmediate(r));assert.equal(f.q.status,'배정완료');await assert.rejects(f.run,/저장 확인 중/);f.f.release();await running;assert.equal(f.logs.size,1);});
test('unverified ok cannot progress state, schedule or erase pending input',async()=>{const f=setup();f.f.badAck=true;await assert.rejects(f.run,/저장 근거/);assert.equal(f.responses.size,0);assert.equal(f.rows.length,0);assert.equal(f.q.status,'배정완료');assert.equal(f.records.get(f.id).input.text,f.options.text);});
test('account change during RPC leaves original records unprojected',async()=>{const f=setup();f.f.hold='crm_inquiry_command_v1';const job=f.run();while(!f.f.release)await new Promise(r=>setImmediate(r));f.root.Phase1.profile={auth_uid:crypto.randomUUID(),user_id:crypto.randomUUID()};f.f.release();await assert.rejects(()=>job,/identity changed/);assert.equal(f.q.status,'배정완료');assert.equal(f.responses.size,0);});
test('task mutation after contact prevents response and schedule without deleting contact',async()=>{const f=setup();f.f.hold='crm_inquiry_command_v1';const job=f.run();while(!f.f.release)await new Promise(r=>setImmediate(r));f.f.mutate();f.f.release();await assert.rejects(()=>job,/STALE/);assert.equal(f.logs.size,1);assert.equal(f.responses.size,0);assert.equal(f.schedules.size,0);});
test('quota and disabled release prevent writes; pending new command never uses legacy path',async()=>{const f=setup();f.f.quota=true;await assert.rejects(f.run,/quota/);assert.equal(f.calls.length,0);f.f.quota=false;f.f.loss='crm_inquiry_command_v1';await assert.rejects(f.run);f.root.CRM_SCHEDULE_V1=false;assert.equal(f.api.route(f.q),true);await assert.rejects(f.run,/서버 저장 연결/);assert.equal(f.responses.size,0);});
test('reentry restores original text and absolute due date; altered retry blocked',async()=>{const f=setup();f.f.loss='crm_inquiry_command_v1';await assert.rejects(f.run);const s={};f.api.restore(f.id,s,'detail');assert.equal(s.text,f.options.text);assert.equal(s.due,f.options.due);f.options.text='새 내용';await assert.rejects(f.run,/입력이 바뀌/);assert.equal(f.logs.size,1);});
test('disabled feature with no authenticated journal leaves existing path untouched',()=>{const f=setup();f.root.CRM_SCHEDULE_V1=false;f.root.MobileSaveJournal.owner=()=>'';assert.equal(f.api.route(f.q),false);const s={text:'원래 입력'};f.api.restore(f.id,s,'detail');assert.equal(s.text,'원래 입력');});

const ContactEntry=require('../contact-entry');
function task(f,basis='internal_plan'){
 const row={id:crypto.randomUUID(),inquiry_id:f.id,title:'기존 방문',due_on:'2026-11-20',due_at:'2026-11-20T00:00:00+09:00',action_type:'방문',status:'open',date_basis:basis,completed_at:null};
 f.rows.push(row);f.q.nextActionObj={id:row.id,text:row.title,due:row.due_on,type:row.action_type,date_basis:basis};return row;
}
function plan(f,state){
 const ex=f.api.existing(f.q),s={ch:'전화',res:'연결됨',memo:'이번에 확인한 내용',mode:'keep',...state};
 const value=ContactEntry.plan(s,{existing:ex,today:'2026-10-11',scheduleV1:true});
 const mapped={'회신 받음':'고객 회신','번호 오류':'번호오류'}[s.res]||s.res;
 Object.assign(f.options,{plan:value,existing:ex,ch:s.ch,result:mapped,contact_result:mapped,text:s.memo,next:'',due:''});return value;
}
test('approved plan keep and none preserve existing task; none reason is recorded once',async()=>{
 for(const mode of ['keep','none']){const f=setup(),row=task(f),before=structuredClone(row),pl=plan(f,{mode,reason:mode==='none'?'고객이 회신 후 일정 결정':''});assert.equal(pl.ok,true);await f.run();assert.deepEqual(f.rows,[before]);assert.equal(f.schedules.size,0);assert.equal([...f.logs.values()][0].content,pl.note);assert.equal(f.q.nextActionObj.id,row.id);assert.equal(f.q.nextActionObj.status,'open');}
});
test('approved absence and invalid-number need no memo, new date or none reason',async()=>{
 for(const res of ['부재','번호 오류']){const f=setup(),pl=plan(f,{res,memo:'',mode:'none',reason:''});assert.equal(pl.ok,true,pl.error);await f.run();assert.equal(f.logs.size,1);assert.equal(f.responses.size,0);assert.equal(f.schedules.size,0);assert.equal(f.q.status,'배정완료');assert.equal([...f.logs.values()][0].next_check_date,null);assert.equal(f.q.openNextActions.length,0);}
});
test('new plan appends without completing existing; uses its explicit action type and date basis',async()=>{
 for(const datePlan of ['customer','internal']){const f=setup(),row=task(f),before=structuredClone(row);plan(f,{mode:'new',purpose:'현장 방문',date:'2026-11-21',plan:datePlan});await f.run();const command=f.calls.find(x=>x.name==='crm_schedule_write_v1').p;assert.equal(command.operation,'add');assert.equal(command.action_type,'방문');assert.equal(command.date_basis,datePlan==='customer'?'customer_agreed':'internal_plan');assert.deepEqual(f.rows[0],before);assert.equal(f.rows.length,2);assert.equal(f.q.nextActionObj.id,row.id);}
});
test('change preserves same task ID, original deadline audit and explicit reason',async()=>{
 const f=setup(),row=task(f),id=row.id;const pl=plan(f,{mode:'change',date:'2026-11-22',reason:'자료 수신 후 방문'});assert.equal(pl.ok,true);await f.run();const command=f.calls.find(x=>x.name==='crm_schedule_write_v1').p,ack=[...f.schedules.values()][0];assert.equal(command.operation,'reschedule');assert.equal(command.action_id,id);assert.equal(command.reason,'자료 수신 후 방문');assert.equal(command.date_basis,'internal_plan');assert.equal(ack.before.due_on,'2026-11-20');assert.equal(ack.after.id,id);assert.deepEqual(ack.completed_action_ids,[]);assert.deepEqual(ack.cancelled_action_ids,[]);assert.equal(f.rows.length,1);assert.equal(f.q.nextActionObj.due,'2026-11-22');assert.match([...f.logs.values()][0].content,/원래 2026-11-20/);
});
test('customer-agreed original cannot be rescheduled even if caller omits its promise metadata',async()=>{
 const f=setup();task(f,'customer_agreed');f.q.nextActionObj.date_basis='';plan(f,{mode:'change',date:'2026-11-22',reason:'관리자 내부 요청'});await assert.rejects(f.run,/CUSTOMER_AGREEMENT_REQUIRED/);assert.equal(f.logs.size,0);assert.equal(f.schedules.size,0);
});
test('badfit, unsupported result, unsupported task kind and unavailable gate reject before contact',async()=>{
 for(const mode of ['badfit','unknown','type','gate','info','requests','snapshot']){const f=setup();plan(f,{mode:'new',purpose:'다음 방문',date:'2026-11-21'});if(mode==='badfit')plan(f,{res:'배드핏',mode:'none',reason:'부적합'});if(mode==='unknown')f.options.result='미지원 결과';if(mode==='type')f.options.plan.next.type='자동종결';if(mode==='gate')f.root.CRM_SCHEDULE_V1=false;if(mode==='info')f.options.plan.info={construction_plan:'내년'};if(mode==='requests')f.options.plan.requests=[{id:crypto.randomUUID(),state:'done'}];if(mode==='snapshot')f.options.existing={id:crypto.randomUUID(),text:'다른 업무',due:'2026-11-20'};await assert.rejects(f.run);assert.equal(f.logs.size,0,mode);assert.equal(f.schedules.size,0,mode);}
});
test('plan and schedule snapshot cannot change after partial contact success; restore retains frozen plan',async()=>{
 const f=setup();task(f);const pl=plan(f,{mode:'change',date:'2026-11-22',reason:'자료 수신 후'});f.f.loss='crm_schedule_write_v1';await assert.rejects(f.run,/lost/);const held=structuredClone(f.records.get(f.id)),request=held.progress.contact.request_id,scheduleRequest=held.progress.inquirySchedule.request_id;assert.deepEqual(held.input.plan,pl);assert.deepEqual(held.progress.plan,pl);f.options.plan.change.due='2026-11-23';await assert.rejects(f.run,/입력이 바뀌/);assert.equal(f.logs.size,1);f.options.plan=structuredClone(held.input.plan);f.root.PCInquirySave=save(f.root);await f.root.PCInquirySave.save(f.q,f.options,{},'detail');assert.equal(f.logs.size,1);assert.equal([...f.logs.values()][0].request_id,request);assert.equal(f.schedules.size,1);assert.equal([...f.schedules.keys()][0],scheduleRequest);assert.equal(f.q.nextActionObj.due,'2026-11-22');
});
test('same actor session ended during contact blocks progression and projection',async()=>{
 const f=setup();plan(f,{mode:'none',reason:'다음 회의 후 결정'});f.f.hold='crm_inquiry_command_v1';const job=f.run();while(!f.f.release)await new Promise(r=>setImmediate(r));f.f.session++;f.f.release();await assert.rejects(()=>job,/session changed/);assert.equal(f.q.status,'배정완료');assert.equal(f.responses.size,0);assert.equal(f.schedules.size,0);assert.equal(f.records.size,1);
});
test('plan validation happens before any contact or journal write',async()=>{
 const f=setup();plan(f,{mode:'new',purpose:'현장 방문',date:'2026-11-21'});f.options.plan.completeCurrent=true;await assert.rejects(f.run,/지원하지 않는/);assert.equal(f.calls.length,0);assert.equal(f.records.size,0);
});

test('change target, original deadline and impossible date are checked before contact',async()=>{
 for(const field of ['id','from','due']){const f=setup();task(f);plan(f,{mode:'change',date:'2026-11-22',reason:'자료 확보 후 방문'});f.options.plan.change[field]=field==='id'?crypto.randomUUID():field==='from'?'2026-11-19':'2026-02-30';await assert.rejects(f.run,/INVALID_INPUT/);assert.equal(f.logs.size,0);assert.equal(f.responses.size,0);assert.equal(f.schedules.size,0);}
});
test('mobile journal restores form and original plan without reconstructing a default schedule',async()=>{
 const f=setup();task(f);const pl=plan(f,{mode:'keep'}),form={ch:'전화',res:'연결됨',memo:'이번에 확인한 내용',mode:'keep',_inquiryContext:{existing:f.options.existing,today:'2026-10-11'}};f.f.loss='crm_inquiry_command_v1';await assert.rejects(()=>f.api.save(f.q,f.options,form,'mobile-d'),/lost/);const restored={memo:'새 기본값'},held=f.api.pending(f.id);f.api.restore(f.id,restored,'mobile-d');assert.equal(restored.memo,form.memo);assert.deepEqual(restored._inquiryContext,form._inquiryContext);assert.deepEqual(held.input.plan,pl);assert.deepEqual(held.progress.existing,f.options.existing);await f.api.save(f.q,{...f.options,plan:held.input.plan,existing:held.input.existing},restored,'mobile-d');assert.equal(f.logs.size,1);assert.equal(f.rows.length,1);assert.equal(f.schedules.size,0);
});

test('cached plan cannot conceal a changed memo on a partial-save retry',async()=>{
 const f=setup();plan(f,{mode:'none',reason:'회의 후 연락'});f.f.loss='crm_inquiry_command_v1';await assert.rejects(f.run,/lost/);const original=f.options.text,held=structuredClone(f.records.get(f.id));f.options.text='저장 대기 중 추가한 중요한 내용';await assert.rejects(f.run,/입력이 바뀌/);assert.equal(f.logs.size,1);assert.equal(f.responses.size,0);assert.deepEqual(f.records.get(f.id),held);f.options.text=original;await f.run();assert.equal(f.logs.size,1);
});
test('explicit ContactEntry new plan must carry its own type and date basis',async()=>{
 for(const field of ['type','plan']){const f=setup();plan(f,{mode:'new',purpose:'방문하기',date:'2026-11-21'});delete f.options.plan.next[field];await assert.rejects(f.run,/INVALID_INPUT/);assert.equal(f.logs.size,0);assert.equal(f.schedules.size,0);}
});
test('guard changes after confirmed contact stay blocked across retry without replacing evidence',async()=>{
 const f=setup();task(f);plan(f,{mode:'change',date:'2026-11-21',reason:'현장 자료 수신'});f.f.loss='crm_inquiry_command_v1';await assert.rejects(f.run,/lost/);const id=f.records.get(f.id).progress.contact.request_id;f.f.mutate();await assert.rejects(f.run,/STALE/);await assert.rejects(f.run,/STALE/);assert.equal(f.logs.size,1);assert.equal(f.responses.size,0);assert.equal(f.schedules.size,0);assert.equal(f.records.get(f.id).progress.contact.request_id,id);assert.equal(f.q.nextActionObj.due,'2026-11-20');
});

test('local browser inquiry fixture is exactly the PC synthetic RPC function',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),sandbox={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../review-preview/inquiry-rpc-fixture.js'),'utf8'),sandbox);
 assert.equal(sandbox.window.__installReviewInquiryRPC.toString(),install.toString());
});
