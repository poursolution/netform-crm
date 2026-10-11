import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Extend only the disposable fixture with the existing production table shapes used by schedule v1.
export async function install(db,sql){
 await db.exec(`alter table public.deals add owner_id uuid,add version integer default 1,add updated_at timestamptz,
  add stage_code text,add lifecycle_status text,add outcome text,add next_action text,add next_action_date date;
 create table crm_security.object_scope(user_id uuid,deal_id uuid,inquiry_id uuid,expires_at timestamptz,can_write boolean);
 create table public.stage_history(id uuid primary key default gen_random_uuid(),inquiry_id uuid,from_stage text,to_stage text,reason text,actor_id uuid,actor_name text,changed_at timestamptz);`);
 await db.exec(sql('schedule-preserve-v1-20261011.sql'));
 await db.exec(sql('inquiry-response-preserve-v1-20261011.sql'));
}

export function register({test,getDB,as,owner,inq,connectedReview,readReview,followup,followupBody,call,writeReview,reviewBody}){
 const db=()=>getDB();
 const list=()=>call({target_type:'inquiry',target_id:inq},'crm_schedule_list_v1');
 const write=p=>call(p,'crm_schedule_write_v1');
 async function start(origin='internal_plan'){
  await db().exec('reset role; update crm_security.schedule_v1_settings set enabled=true');
  await as(owner);const c=await connectedReview();
  const a=await followup(followupBody(c,{plan_origin:origin,...(origin==='customer_agreed'?{agreement_note:'고객과 제출일 합의'}:{})}));
  const next=(await db().query("select ((now() at time zone 'Asia/Seoul')::date+5)::text d")).rows[0].d;
  return {a,next};
 }
 async function change(a,next){return {request_id:randomUUID(),target_type:'inquiry',target_id:inq,expected_token:(await list()).token,operation:'reschedule',action_id:a.next_action_id,due_on:next,date_basis:'internal_plan',reason:'내부 준비일 변경'};}
 async function snapshot(){await db().exec('reset role');const data=(await db().query(`select jsonb_build_object('tasks',(select jsonb_agg(to_jsonb(n) order by id) from next_actions n),
 'parent',(select to_jsonb(i) from inquiries i where id=$1),'events',(select count(*) from crm_security.schedule_v1_events)) v`,[inq])).rows[0].v;await as(owner);return data;}
 test('combined: customer agreement from objective followup is recognized by schedule reader',async()=>{
  const {a}=await start('customer_agreed');const n=(await list()).items.find(n=>n.id===a.next_action_id);assert.equal(n.date_basis,'customer_agreed');
 });
 test('combined: internal reschedule cannot move a customer-agreed objective followup',async()=>{
  const {a,next}=await start('customer_agreed'),p=await change(a,next),before=await snapshot();
  await assert.rejects(write(p),/SCHEDULE_CUSTOMER_AGREEMENT_REQUIRED/);assert.deepEqual(await snapshot(),before);
 });
 test('combined: ordinary objective followup reschedules the same ID and retry does not duplicate it',async()=>{
  const {a,next}=await start(),p=await change(a,next),before=await snapshot();const ack=await write(p);assert.equal(ack.action_id,a.next_action_id);
  assert.equal(ack.after.status,'open');assert.equal((await write(p)).replayed,true);const after=await snapshot();assert.equal(after.tasks.length,before.tasks.length);
  assert.deepEqual(after.tasks.filter(n=>n.id!==a.next_action_id),before.tasks.filter(n=>n.id!==a.next_action_id));
  assert.equal((await readReview()).followup_candidates.find(n=>n.id===a.next_action_id).plan_origin,'unknown');
 });
 test('combined: schedule mutation invalidates an older objective followup snapshot',async()=>{
  const {a,next}=await start(),review=await readReview();await write(await change(a,next));const before=await snapshot();
  await assert.rejects(followup(followupBody(review,{operation_id:randomUUID(),title:'추가 견적 업무'})),/REQUEST_PLAN_CHANGED/);assert.deepEqual(await snapshot(),before);
 });
 test('combined: objective addition invalidates an older schedule snapshot',async()=>{
  const {a,next}=await start(),p=await change(a,next);await followup(followupBody(await readReview(),{operation_id:randomUUID(),title:'현장 방문 준비',ask:'현장방문 필요 여부 확인'}));
  const before=await snapshot();await assert.rejects(write(p),/SCHEDULE_STALE/);assert.deepEqual(await snapshot(),before);
 });
 test('combined: objective receipt replay after reschedule preserves the newer date',async()=>{
  const {a,next}=await start();
  // Original operation is in the immutable receipt; obtain its exact persisted payload.
  await db().exec('reset role');const p=(await db().query('select payload from crm_security.work_request_followup_events where next_action_id=$1',[a.next_action_id])).rows[0].payload;await as(owner);
  await write(await change(a,next));const before=await snapshot(),ack=await followup(p);assert.equal(ack.replayed,true);assert.deepEqual(await snapshot(),before);
 });
 test('combined: full request completion leaves schedule-created and objective-created tasks open',async()=>{
  const {a,next}=await start();const c=await list();await write({request_id:randomUUID(),target_type:'inquiry',target_id:inq,expected_token:c.token,operation:'add',action_type:'방문',title:'기존 업무와 별도 확인',due_on:next,date_basis:'internal_plan'});
  const before=await snapshot();const ack=await writeReview(reviewBody(await readReview(),{decisions:[{ask:'연락 후 견적 필요 여부 확인',value:'needed',note:'기존 견적 업무 연결',next_action_id:a.next_action_id},{ask:'현장방문 필요 여부 확인',value:'not_needed',note:'고객 방문 불필요 확인'}]}));
  assert.equal(ack.request_complete,true);assert.deepEqual((await snapshot()).tasks,before.tasks);
 });
 test('combined: first response cannot be stamped twice after compound contact confirmation',async()=>{
  await start();const review=await readReview(),before=await snapshot();
  await assert.rejects(call({inquiry_id:inq,request_id:randomUUID(),contact_log_id:review.contact_proof.contact_log_id,expected_token:(await list()).token},'crm_inquiry_response_confirm_v1'),/INQUIRY_RESPONSE_STATE_CONFLICT/);
  assert.deepEqual(await snapshot(),before);
 });
 test('combined: changed agreement evidence is not displayed as current but still cannot be silently moved',async()=>{
  const {a,next}=await start('customer_agreed');await db().exec('reset role');await db().query('update next_actions set title=$1 where id=$2',['내용 확인 필요',a.next_action_id]);await as(owner);
  assert.equal((await list()).items.find(n=>n.id===a.next_action_id).date_basis,'unconfirmed');
  await assert.rejects(write(await change(a,next)),/SCHEDULE_CUSTOMER_AGREEMENT_REQUIRED/);
 });
 test('combined: provenance helper cannot be called directly by a signed-in user',async()=>{
  const {a}=await start('customer_agreed');
  await assert.rejects(db().query('select crm_security.schedule_v1_provenance($1::jsonb)',[JSON.stringify({id:a.next_action_id,inquiry_id:inq})]),/permission denied/);
  await db().exec('reset role');
  const rows=(await db().query(`select rolname,has_function_privilege(oid,'crm_security.schedule_v1_provenance(jsonb)','execute') allowed
   from pg_roles where rolname in ('anon','authenticated','service_role')`)).rows;
  assert.ok(rows.length>=2);for(const r of rows)assert.equal(r.allowed,false,r.rolname);
 });
 test('combined: internal followup provenance is retained through reschedule',async()=>{
  const {a,next}=await start();assert.equal((await list()).items.find(n=>n.id===a.next_action_id).date_basis,'internal_plan');
  await write(await change(a,next));assert.equal((await list()).items.find(n=>n.id===a.next_action_id).date_basis,'internal_plan');
 });
 test('combined: unrelated customer agreement never labels or protects an internal task',async()=>{
  const {a,next}=await start('customer_agreed');const b=await followup(followupBody(await readReview(),{operation_id:randomUUID(),title:'별도 내부 방문 계획',ask:'현장방문 필요 여부 확인',plan_origin:'internal_plan'}));
  const c=await list();assert.equal(c.items.find(n=>n.id===a.next_action_id).date_basis,'customer_agreed');assert.equal(c.items.find(n=>n.id===b.next_action_id).date_basis,'internal_plan');
  await write(await change(b,next));assert.equal((await list()).items.find(n=>n.id===a.next_action_id).date_basis,'customer_agreed');
 });
}
