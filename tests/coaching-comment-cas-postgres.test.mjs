import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const sql=readFileSync(new URL('../sql/20261009191116_coaching_comment_compare_and_save.sql',import.meta.url),'utf8');
const base=c=>({updated_at:c.updated_at,comment:c.comment,status:c.status});
test('coaching CAS rejects stale create/update/complete and preserves concurrent requests',async()=>{
 const db=new PGlite();
 const A='11111111-1111-4111-8111-111111111111',AA='22222222-2222-4222-8222-222222222222',B='33333333-3333-4333-8333-333333333333',BB='44444444-4444-4444-8444-444444444444';
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const call=async p=>(await db.query('select public.crm_rep_manager_comment_save_v2($1::jsonb) r',[JSON.stringify(p)])).rows[0].r;
 try{
  await db.exec(fixture);
  await db.exec(`create table crm_security.rep_manager_comments(rep_user_id uuid,week_start date,comment text,status text,created_by_auth_uid uuid,created_by_user_id uuid,completed_at timestamptz,created_at timestamptz,updated_at timestamptz,primary key(rep_user_id,week_start));alter table crm_security.rep_manager_comments enable row level security;revoke all on crm_security.rep_manager_comments from public,anon,authenticated,service_role;`);
  await db.exec(sql);await db.exec(sql);
  await db.query("insert into public.users values($1,$2,'Admin','admin',true),($3,$4,'Rep','rep',true)",[A,AA,B,BB]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day'),($3,$4,'rep','rep',true,now()+interval '1 day')",[A,AA,B,BB]);
  const wk=(await db.query("select date_trunc('week',now() at time zone 'Asia/Seoul')::date::text d")).rows[0].d;
  const p={rep_name:'Rep',week_start:wk,comment:'original',status:'open',expected:null};
  await as(BB);await assert.rejects(call(p),/forbidden/);
  await as(AA);const first=await call(p);assert.equal(first.ok,true);
  await assert.rejects(call({...p,comment:'stale create'}),/COACHING_CONFLICT/);
  const edited=await call({...p,expected:base(first.comment),comment:'edited'});
  assert.notEqual(edited.comment.updated_at,first.comment.updated_at);
  await assert.rejects(call({...p,expected:base(first.comment),comment:'overwrite'}),/COACHING_CONFLICT/);
  await assert.rejects(call({...p,expected:base(first.comment),status:'done'}),/COACHING_CONFLICT/);
  await assert.rejects(call({...p,expected:{...base(edited.comment),comment:'wrong'}}),/COACHING_CONFLICT/);
  const done=await call({...p,expected:base(edited.comment),comment:'edited',status:'done'});
  assert.ok(done.comment.completed_at);const reopened=await call({...p,expected:base(done.comment)});assert.equal(reopened.comment.completed_at,null);
  // The existing KPI append writer has no CAS argument: its changed row must invalidate the editor.
  await db.exec('reset role');await db.query("update crm_security.rep_manager_comments set comment=comment||E'\nrequest from another manager',updated_at=clock_timestamp()+interval '1 second' where rep_user_id=$1",[B]);
  await as(AA);await assert.rejects(call({...p,expected:base(reopened.comment),comment:'would lose request'}),/COACHING_CONFLICT/);
  await db.exec('reset role');assert.match((await db.query('select comment from crm_security.rep_manager_comments')).rows[0].comment,/request from another manager/);
  for(const expected of [undefined,{},true,'bad',{updated_at:'bad',comment:'x',status:'open'},{updated_at:'infinity',comment:'x',status:'open'},{updated_at:null,comment:'x',status:'open'}]){
   await as(AA);await assert.rejects(call({...p,expected}),/invalid coaching base/);
  }
  await db.exec('reset role');await db.query("insert into public.users values('55555555-5555-4555-8555-555555555555',null,'Rep','rep',true)");
  await as(AA);await assert.rejects(call(p),/담당자 계정 확인 필요/);
  await as('');await assert.rejects(call(p),/forbidden/);
  await db.exec('reset role;set role anon');await assert.rejects(call(p),/permission denied/);
  await db.exec('reset role;set role service_role');await assert.rejects(call(p),/permission denied/);
 }finally{await db.close();}
});
