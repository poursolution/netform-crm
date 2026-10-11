const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('milestone SQL executes with real schedule contract, preserves all original tasks and receipts',async()=>{
 const db=new PGlite(),q=(s,p=[])=>db.query(s,p),exec=s=>db.exec(s),rpc=async(n,p)=>(await q(`select public.${n}($1::jsonb) r`,[JSON.stringify(p)])).rows[0].r;
 const auth=randomUUID(),user=randomUUID(),other=randomUUID(),otherAuth=randomUUID();let checks=0;
 try{
  // Reuse only the existing synthetic schema bootstrap; never evaluate its tests or load production data.
  const schema=/await exec\(`([\s\S]+?)`\);/.exec(read('tests/schedule-contract.test.cjs'));assert(schema,'shared schema fixture boundary');await exec(schema[1]);
  await exec(`alter table public.inquiries add column work_type text,add column raw jsonb,add column close_reason text;
   alter table crm_security.inquiry_audit_events add column actor_auth_uid uuid,add column actor_user_id uuid,add column before_data jsonb,add column after_data jsonb,add column reason text;
   alter table crm_security.inquiry_audit_events add constraint milestone_test_actions check(action in ('flow_visit','flow_quote_draft','flow_quote_send','inquiry_trash','inquiry_restore','inquiry_purge'));
  `);
  await q("insert into public.users values($1,$2,'합성 담당 A',true,'rep'),($3,$4,'합성 담당 B',true,'rep')",[user,auth,other,otherAuth]);
  await exec("insert into crm_security.access_review(user_id,reviewed_auth_uid,permission_role,source_role) select user_id,auth_uid,'rep','rep' from public.users");
  await exec(read('supabase/migrations/20261005034655_inquiry_flow_runtime.sql'));await exec(read('sql/inquiry-contact-two-results-20261007.sql'));await exec(read('sql/schedule-preserve-v1-20261011.sql'));
  const sql=read('sql/inquiry-milestone-preserve-v1-20261011.sql');await exec(sql);await exec(sql);
  await q("select set_config('test.auth',$1,false)",[auth]);
  const today=(await q("select (now() at time zone 'Asia/Seoul')::date::text d")).rows[0].d;
  const add=async()=>{await exec('reset role');const id=randomUUID();await q("insert into inquiries(id,assigned_to,status,brand,raw) values($1,$2,'배정완료','POUR','{}')",[id,user]);await exec('set role authenticated');return id;};
  const context=id=>rpc('crm_inquiry_milestone_context_v1',{inquiry_id:id});
  const cmd=async(id,extra)=>({inquiry_id:id,request_id:randomUUID(),expected_token:(await context(id)).token,...extra});
  const write=p=>rpc('crm_inquiry_milestone_save_v1',p);
  const id=await add();assert.equal((await context(id)).enabled,false);await assert.rejects(()=>write({inquiry_id:id,request_id:randomUUID(),expected_token:'0'.repeat(32),kind:'visit_done',date:today}),/RELEASE_DISABLED/);checks++;
  await assert.rejects(()=>q('select * from crm_security.inquiry_milestone_v1_events'),/permission denied/);await assert.rejects(()=>q('select crm_security.inquiry_milestone_v1_context($1)',[id]),/permission denied/);checks++;
  await exec('reset role;update crm_security.schedule_v1_settings set enabled=true;update crm_security.inquiry_milestone_v1_settings set enabled=true;');
  const task=randomUUID(),calendar=randomUUID();await q("insert into next_actions(id,inquiry_id,title,due_at,assignee_name) values($1,$2,'고객 약속 원래 일정',now()+interval '2 days','합성 담당 A')",[task,id]);
  await q("insert into crm_security.schedules(id,type,at,inquiry_id,title,status,created_by_name) values($1,'visit',$2,$3,'원래 방문','open','합성 담당 A')",[calendar,today,id]);
  const rows=async()=>({task:(await q('select to_jsonb(n) r from next_actions n where id=$1',[task])).rows[0].r,cal:(await q('select to_jsonb(c) r from crm_security.schedules c where id=$1',[calendar])).rows[0].r});
  const original=await rows();await exec('set role authenticated');
  const p=await cmd(id,{kind:'visit_done',date:today}),ack=await write(p);assert.equal(ack.promoted,false);assert.deepEqual(ack.completed_action_ids,[]);assert.deepEqual(ack.changed_calendar_ids,[]);assert.equal(ack.parent.first_response_at,null);assert.equal(ack.parent.responded_at,null);assert.equal(ack.state.qualified_at,null);assert.equal(ack.fact.precision,'day');checks++;
  assert.equal((await write(p)).event_id,ack.event_id);await assert.rejects(()=>write({...p,time:'01:00'}),/REQUEST_ID_REUSE/);assert.equal((await rpc('crm_inquiry_milestone_receipt_v1',{inquiry_id:id,request_id:p.request_id})).ack.event_id,ack.event_id);checks++;
  await exec('reset role');assert.deepEqual(await rows(),original);assert.equal((await q('select count(*)::int n from crm_security.inquiry_milestone_v1_events')).rows[0].n,1);await exec('set role authenticated');checks++;
  const metadata={method:'이메일',file_name:'synthetic-v1.pdf',recipient:{email:'fixture@example.invalid'},change_reason:'확인한 초안'};
  const quote=await write(await cmd(id,{kind:'quote_draft',amount:1200000,...metadata}));assert.equal(quote.state.quotes[0].amount,1200000);assert.equal(quote.state.quotes[0].sent_at,null);
  for(const key of Object.keys(metadata))await assert.rejects(async()=>write(await cmd(id,{kind:'quote_draft',amount:1200000,[key]:null})),/INVALID_INPUT/);checks++;
  const sent=await write(await cmd(id,{kind:'quote_sent',amount:1200000,date:today}));assert.equal(sent.quote_version_id,quote.quote_version_id);assert(sent.state.quotes[0].sent_at);assert.equal(sent.state.qualified_at,null);
  for(const key of Object.keys(metadata))assert.deepEqual(sent.state.quotes[0][key],metadata[key],key+' omitted preserves original evidence');checks++;
  await exec('reset role');assert.deepEqual(await rows(),original);assert.equal((await q('select count(*)::int n from next_actions where inquiry_id=$1',[id])).rows[0].n,1);await exec('set role authenticated');checks++;
  await assert.rejects(async()=>write(await cmd(id,{kind:'quote_draft',amount:1300000})),/CHANGE_REASON_REQUIRED/);await assert.rejects(async()=>write(await cmd(id,{kind:'visit_done',date:'2999-01-01'})),/INVALID_DATE/);checks++;
  const next=await add();const before=await context(next);const sc=await rpc('crm_schedule_list_v1',{target_type:'inquiry',target_id:next});const sp={target_type:'inquiry',target_id:next,request_id:randomUUID(),expected_token:sc.token,operation:'add',action_type:'방문',title:'현장방문 14:00',due_on:today,date_basis:'internal_plan'};
  const sa=await rpc('crm_schedule_write_v1',sp);const plan=await write(await cmd(next,{kind:'visit_planned',date:today,time:'14:00',schedule_request_id:sp.request_id,schedule_action_id:sa.action_id}));assert.equal(plan.parent.status,'현장방문예정');assert.equal(plan.state.visit_done_at,null);assert.equal(plan.parent.first_response_at,null);assert.notEqual(before.token,plan.token);checks++;
  await assert.rejects(async()=>write(await cmd(next,{kind:'visit_planned',date:today,time:'15:00',schedule_request_id:sp.request_id,schedule_action_id:sa.action_id})),/SCHEDULE_CONFLICT/);checks++;
  // Synthetic historical boundary: the real common add committed yesterday; response was lost.
  const oldId=await add(),oldSc=await rpc('crm_schedule_list_v1',{target_type:'inquiry',target_id:oldId}),oldRequest=randomUUID();
  const oldSa=await rpc('crm_schedule_write_v1',{target_type:'inquiry',target_id:oldId,request_id:oldRequest,expected_token:oldSc.token,operation:'add',action_type:'방문',title:'현장방문',due_on:today,date_basis:'internal_plan'});
  await exec('reset role');const yesterday=(await q("select ((now() at time zone 'Asia/Seoul')::date-1)::text d")).rows[0].d;
  await q("update next_actions set due_at=$1::date::timestamp at time zone 'Asia/Seoul' where id=$2",[yesterday,oldSa.action_id]);
  await q("update crm_security.schedule_v1_events set command=jsonb_set(command,'{due_on}',to_jsonb($1::text)),created_at=created_at-interval '1 day',after_data=(select to_jsonb(n) from next_actions n where n.id=$2) where request_id=$3",[yesterday,oldSa.action_id,oldRequest]);
  await exec('set role authenticated');const recovered=await write(await cmd(oldId,{kind:'visit_planned',date:yesterday,schedule_request_id:oldRequest,schedule_action_id:oldSa.action_id}));assert.equal(recovered.fact.date,yesterday);assert.equal(recovered.parent.next_action_date,today);assert.equal(recovered.state.visit_done_at,null);checks++;
  const stale=await cmd(next,{kind:'visit_done',date:today});await exec('reset role');await q("update next_actions set title='다른 기기 변경' where id=$1",[sa.action_id]);await exec('set role authenticated');await assert.rejects(()=>write(stale),/MILESTONE_STALE/);checks++;
  await q("select set_config('test.auth',$1,false)",[otherAuth]);await assert.rejects(()=>context(next),/FORBIDDEN/);await assert.rejects(()=>rpc('crm_inquiry_milestone_receipt_v1',{inquiry_id:id,request_id:p.request_id}),/FORBIDDEN/);checks++;
  await q("select set_config('test.auth',$1,false)",[auth]);await exec('reset role');await q("update inquiries set work_type='공법 협약' where id=$1",[next]);await exec('set role authenticated');assert.equal((await context(next)).writable,false);await assert.rejects(async()=>write(await cmd(next,{kind:'visit_done',date:today})),/STATE_CONFLICT/);checks++;
  console.log('milestone SQL checks: '+checks);
 }finally{await db.close();}
});
