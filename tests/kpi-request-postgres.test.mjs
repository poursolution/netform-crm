import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const sql=readFileSync(new URL('../sql/20261009171018_kpi_request_history_and_ack.sql',import.meta.url),'utf8');
const base=readFileSync(new URL('../sql/ops-store-v1-20261002.sql',import.meta.url),'utf8');
test('KPI pages cover 399 tied rows; request delivery is atomic, permission checked, idempotent',async()=>{
 const db=new PGlite();
 const A='11111111-1111-4111-8111-111111111111',AA='22222222-2222-4222-8222-222222222222',B='33333333-3333-4333-8333-333333333333',BB='44444444-4444-4444-8444-444444444444';
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const call=async(fn,p={})=>(await db.query('select public.'+fn+'($1::jsonb) r',[JSON.stringify(p)])).rows[0].r;
 try{
  await db.exec(fixture);await db.exec(base);
  await db.exec(`create table crm_security.rep_manager_comments(rep_user_id uuid,week_start date,comment text,status text,created_by_auth_uid uuid,created_by_user_id uuid,completed_at timestamptz,created_at timestamptz,updated_at timestamptz,primary key(rep_user_id,week_start));`);
  await db.exec(sql);await db.exec(sql);
  await db.query("insert into public.users values($1,$2,'Admin','admin',true),($3,$4,'Rep','rep',true)",[A,AA,B,BB]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day'),($3,$4,'rep','rep',true,now()+interval '1 day')",[A,AA,B,BB]);
  await db.query(`insert into public.kpi_actions(id,promise_key,action,target_type,target_id,actor,actor_name,created_at)
   select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'kpi:3','test','deal',i::text,$1,'Admin','2026-01-01' from generate_series(1,399) i`,[A]);
  await as(AA);
  const first=await call('crm_kpi_action_list_v2',{limit:200});assert.equal(first.actions.length,200);assert.equal(first.has_more,true);
  await db.exec('reset role');await db.query("insert into public.kpi_actions(promise_key,action,actor,actor_name) values('kpi:3','concurrent',$1,'Admin')",[A]);await as(AA);
  const second=await call('crm_kpi_action_list_v2',{limit:200,cursor:first.next_cursor});
  assert.equal(second.actions.length,199);assert.equal(second.has_more,false);assert.equal(second.next_cursor,null);
  assert.equal(new Set([...first.actions,...second.actions].map(x=>x.id)).size,399,'tie breaker prevents lost/duplicate rows; upper bound excludes a later insertion');
  assert.equal((await call('crm_kpi_action_list_v2',{limit:999})).actions.length,200);
  await assert.rejects(call('crm_kpi_action_list_v2',{cursor:{}}),/invalid cursor/);
  const week=(await db.query("select date_trunc('week',now() at time zone 'Asia/Seoul')::date::text d")).rows[0].d;
  const p={request_id:'55555555-5555-4555-8555-555555555555',rep_name:'Rep',week_start:week,promise_key:'kpi:3',line:'자료 확인',targets:[{target_type:'deal',target_id:'d1',action:'요청'}]};
  await as(BB);await assert.rejects(call('crm_kpi_request_send_v1',p),/forbidden/);
  assert.equal((await call('crm_kpi_action_list_v2')).actions.length,200,'existing authenticated read scope retained');
  await as(AA);const ack=await call('crm_kpi_request_send_v1',p);assert.equal(ack.ok,true);assert.equal(ack.actions.length,1);assert.equal(ack.comment.status,'open');
  assert.deepEqual(await call('crm_kpi_request_send_v1',p),ack,'lost ACK retry returns same action IDs');
  await assert.rejects(call('crm_kpi_request_send_v1',{...p,line:'changed'}),/payload mismatch/);
  const p2={...p,request_id:'66666666-6666-4666-8666-666666666666',line:'후속 확인'};
  const ack2=await call('crm_kpi_request_send_v1',p2);assert.equal(ack2.comment.comment,'· [KPI 요청] 자료 확인\n· [KPI 요청] 후속 확인','append preserves earlier coaching');
  await assert.rejects(call('crm_kpi_request_send_v1',{...p2,request_id:'77777777-7777-4777-8777-777777777777',targets:[p.targets[0],p.targets[0]]}),/duplicate targets/);
  await db.exec('reset role');
  await db.exec(`create function public.fail_kpi_action() returns trigger language plpgsql as $$ begin raise exception 'forced audit failure'; end $$;create trigger kpi_test_failure before insert on public.kpi_actions for each row execute function public.fail_kpi_action();`);
  await as(AA);await assert.rejects(call('crm_kpi_request_send_v1',{...p2,request_id:'88888888-8888-4888-8888-888888888888',line:'must roll back'}),/forced audit failure/);
  await db.exec('reset role');
  const rows=(await db.query('select * from crm_security.rep_manager_comments')).rows;assert.equal(rows.length,1);assert.equal(rows[0].comment,ack2.comment.comment,'failed audit rolls comment back');
  assert.equal((await db.query('select count(*)::int n from crm_security.kpi_request_receipts')).rows[0].n,2);
  await as(AA);await assert.rejects(db.exec('select * from crm_security.kpi_request_receipts'),/permission denied/);
  await as('');await assert.rejects(call('crm_kpi_action_list_v2'),/forbidden/);
  await db.exec('reset role;set role anon');await assert.rejects(call('crm_kpi_action_list_v2'),/permission denied/);await assert.rejects(call('crm_kpi_request_send_v1',p),/permission denied/);
 }finally{await db.close();}
});
