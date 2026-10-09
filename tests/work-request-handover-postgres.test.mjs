import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const read=f=>readFileSync(new URL('../sql/'+f,import.meta.url),'utf8');
const A='11111111-1111-4111-8111-111111111111',V='22222222-2222-4222-8222-222222222222',W='33333333-3333-4333-8333-333333333333';
const D='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('handover: atomic assignment, frozen attribution, ACK retry, stale/unauthorized rejection and manual acceptance',async()=>{
 const db=new PGlite();
 try{
  await db.exec(fixture);
  await db.exec(`alter table public.users add column created_at timestamptz default now(),add column email text;
   alter table public.deals add column owner_id uuid,add column assignee_name text,add column assignee_email text,add column version integer default 1,
   add column updated_at timestamptz,add column list_name text,add column brand text;
   create table public.next_actions(id uuid primary key,deal_id uuid,inquiry_id uuid,action_type text,title text,due_at timestamptz,assignee_name text,status text,completed_at timestamptz,source_activity_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
   create table crm_security.sales_directors(name text,active boolean);
   create function crm_security.approval_approver(uuid) returns boolean language sql as $$select false$$;
   create function public.crm_approval_request_v1(jsonb) returns jsonb language plpgsql as $$begin raise exception 'approval unavailable'; end$$;
   insert into public.users(user_id,auth_uid,name,role,active) values('${A}','${A}','관리자','admin',true),('${V}','${V}','이전담당','rep',true),('${W}','${W}','신규담당','rep',true);
   insert into crm_security.access_review values('${A}','${A}','admin','admin',true,now()+interval '1 day'),('${V}','${V}','rep','rep',true,now()+interval '1 day'),('${W}','${W}','rep','rep',true,now()+interval '1 day');
   insert into public.deals(id,owner_id,assignee_name,list_name,brand) values('${D}','${V}','이전담당','검증 현장','POUR솔루션');`);
  await db.exec(read('deal-owner-v1-20261004.sql'));
  await db.exec(read('work-request-v1-20261005.sql'));
  for(let n=0;n<2;n++){
   await db.exec(read('work-request-handover-20261007.sql'));
   await db.exec(read('deal-reassign-handover-20261007.sql'));
  }
  const as=async u=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);await db.exec('set role authenticated');};
  const call=async(fn,p)=>(await db.query('select public.'+fn+'($1::jsonb) r',[JSON.stringify(p)])).rows[0].r;
  const p={request_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',deal_id:D,from:'이전담당',to:'신규담당',reason:'지역 재배치',attribution:'keep',memo:'자료 회신 확인'};
  await as(V);await assert.rejects(call('crm_deal_reassign_handover_v1',p),/관리자/);
  await as(A);await assert.rejects(db.exec('select * from crm_security.deal_reassignment_receipts'),/permission denied/);
  await db.exec('reset role');
  await db.exec(`insert into public.next_actions(id,deal_id,action_type,title,due_at,assignee_name,status) values
   ('00000000-0000-4000-8000-000000000001','${D}','견적','견적 발송','2026-12-01 09:00+09','이전담당','open'),
   ('00000000-0000-4000-8000-000000000002','${D}','방문','방문 확인','2026-12-03 10:00+09',' 이전담당 ','open'),
   ('00000000-0000-4000-8000-000000000003','${D}','전화','완료한 연락','2026-09-01 09:00+09','이전담당','completed'),
   ('00000000-0000-4000-8000-000000000004','${D}','지원','다른 담당 업무',null,'관리자','open'),
   ('00000000-0000-4000-8000-000000000005','${D}','확인','담당 확인 필요',null,null,'open'),
   ('00000000-0000-4000-8000-000000000006',null,'문의','다른 대상 업무',null,'이전담당','open');`);
  const tasksBefore=(await db.query('select * from public.next_actions order by id')).rows;
  await as(A);
  const ack=await call('crm_deal_reassign_handover_v1',p);
  assert.equal(ack.assignee,'신규담당');assert.equal(ack.version,2);assert.equal(ack.request.kind,'handover');assert.equal(ack.request.to_name,'신규담당');
  assert.equal(ack.owner.performance_owner,'이전담당');assert.deepEqual(await call('crm_deal_reassign_handover_v1',p),ack);
  await db.exec('reset role');
  const tasksAfter=(await db.query('select * from public.next_actions order by id')).rows;
  assert.deepEqual(tasksAfter.map(x=>x.assignee_name),['신규담당','신규담당','이전담당','관리자',null,'이전담당']);
  for(let i=0;i<tasksBefore.length;i++){
   const {assignee_name:beforeOwner,updated_at:beforeAt,...before}=tasksBefore[i];
   const {assignee_name:afterOwner,updated_at:afterAt,...after}=tasksAfter[i];
   assert.deepEqual(after,before,'task identity, deadline, status and evidence remain unchanged');
   if(i>=2)assert.deepEqual(tasksAfter[i],tasksBefore[i]);
  }
  assert.equal(ack.transferred_next_actions.length,2);
  assert.equal(ack.transferred_next_actions[0].from,'이전담당');
  assert.equal(ack.transferred_next_actions[0].to,'신규담당');
  const event=(await db.query('select detail from public.activities where id=$1',[ack.activity_id])).rows[0].detail;
  assert.deepEqual(event.transferred_next_actions,ack.transferred_next_actions);
  await as(A);
  await assert.rejects(call('crm_deal_reassign_handover_v1',{...p,memo:'다른 요청'}),/같은 요청 번호/);
  await assert.rejects(call('crm_deal_reassign_handover_v1',{...p,request_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}),/이미 변경/);
  const rq={target_type:'deal',target_id:D,to_name:'신규담당',to_scope:'user',due_at:new Date(Date.now()+86400000).toISOString(),kind:'handover',label:'재배정 인계'};
  await assert.rejects(call('crm_work_request_create_v1',rq),/같은 요청/);
  await assert.rejects(call('crm_work_request_handover_v1',{...rq,to_name:'이전담당'}),/현재 담당자/);
  await as(V);await assert.rejects(call('crm_work_request_reply_v1',{id:ack.request.id,action:'done',result:'인수 확인'}),/받는 사람만/);
  await as(W);assert.equal((await call('crm_work_request_reply_v1',{id:ack.request.id,action:'done',result:'인수 확인'})).request.status,'done');
  await as(A);
  // Failed approval rolls back owner change, handover and audit together.
  await assert.rejects(call('crm_deal_reassign_handover_v1',{...p,request_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',from:'신규담당',to:'이전담당',attribution:'request'}),/approval unavailable/);
  await db.exec('reset role');
  assert.equal((await db.query('select assignee_name from public.deals')).rows[0].assignee_name,'신규담당');
  assert.deepEqual((await db.query('select * from public.next_actions order by id')).rows,tasksAfter,'failed approval rolls back task owners as well');
  for(const table of ['public.activities','public.crm_deal_owner_events','crm_security.work_requests','crm_security.deal_reassignment_receipts'])assert.equal((await db.query('select count(*)::int n from '+table)).rows[0].n,1,table);
  // Old support/label records remain readable and block duplicate handovers.
  await db.exec("update crm_security.work_requests set kind='support',status='sent'");
  await as(A);await assert.rejects(call('crm_work_request_handover_v1',rq),/같은 요청/);
  // A new reassignment retires the old pending request, preserves it, and creates a new one.
  const again=await call('crm_deal_reassign_handover_v1',{...p,request_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',from:'신규담당',to:'이전담당'});
  assert.equal(again.request.kind,'handover');assert.equal(again.owner.performance_owner,'이전담당');
  await db.exec('reset role');
  const rows=(await db.query('select status,kind from crm_security.work_requests order by created_at')).rows;
  assert.deepEqual(rows,[{status:'cancelled',kind:'support'},{status:'sent',kind:'handover'}]);
  assert.equal((await db.query('select assignee_name from public.next_actions where id=$1',[tasksBefore[0].id])).rows[0].assignee_name,'이전담당');
  await as(A);assert.deepEqual(await call('crm_deal_reassign_handover_v1',p),ack,'old retry returns original receipt without reapplying task transfer');
  await db.exec('reset role');
  assert.equal((await db.query('select assignee_name from public.next_actions where id=$1',[tasksBefore[0].id])).rows[0].assignee_name,'이전담당');
  assert.equal((await db.query("select has_function_privilege('anon','public.crm_deal_reassign_handover_v1(jsonb)','execute') allowed")).rows[0].allowed,false);
  // A display name alone is not proof of task ownership (duplicate names or ownerless imports).
  await db.exec(`insert into public.users(user_id,name,role,active) values('44444444-4444-4444-8444-444444444444','이전담당','rep',false);`);
  await as(A);
  const ambiguous=await call('crm_deal_reassign_handover_v1',{...p,request_id:'ffffffff-ffff-4fff-8fff-ffffffffffff'});
  assert.deepEqual(ambiguous.transferred_next_actions,[]);
  await db.exec('reset role');
  assert.equal((await db.query('select assignee_name from public.next_actions where id=$1',[tasksBefore[0].id])).rows[0].assignee_name,'이전담당');
  await db.exec(`update public.deals set owner_id=null,assignee_name='이전담당' where id='${D}';
    update public.users set name='동명이인 별도' where user_id='44444444-4444-4444-8444-444444444444';`);
  await as(A);
  const ownerless=await call('crm_deal_reassign_handover_v1',{...p,request_id:'99999999-9999-4999-8999-999999999999'});
  assert.deepEqual(ownerless.transferred_next_actions,[]);
  await db.exec('reset role');
  assert.equal((await db.query('select assignee_name from public.next_actions where id=$1',[tasksBefore[0].id])).rows[0].assignee_name,'이전담당');
 }finally{await db.close();}
});
