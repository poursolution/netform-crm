import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const sql=readFileSync(new URL('../sql/approval-inbox-v1-20261004.sql',import.meta.url),'utf8');
/* 예외 승인함 v1: 다시 실행해도 안전 · 표 직접 접근 차단 · 요청 = 로그인한 누구나 · 승인 / 반려 = 관리자만(반려는 사유 필수) · 대기 중인 것만 처리 · 바꿀 때마다 기록 · 다른 자료는 건드리지 않는다 */
test('approval inbox: request → admin approve / reject with reason, own-only reads, audit trail',async()=>{
 const db=new PGlite();
 const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222',V='44444444-4444-4444-8444-444444444444',AV='55555555-5555-4555-8555-555555555555',W='66666666-6666-4666-8666-666666666666',AW='77777777-7777-4777-8777-777777777777';
 const D1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',D2='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
 try{
  await db.exec(fixture);
  await db.exec(sql);await db.exec(sql);/* 두 번 실행해도 안전 */
  await db.query("insert into public.users values($1,$2,'송보람','admin',true),($3,$4,'이필선','rep',true),($5,$6,'정정훈','rep',true)",[U,AU,V,AV,W,AW]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day'),($3,$4,'rep','rep',true,now()+interval '1 day'),($5,$6,'rep','rep',true,now()+interval '1 day')",[U,AU,V,AV,W,AW]);
  await db.query('insert into public.deals(id) values($1),($2)',[D1,D2]);
  const dealsBefore=JSON.stringify((await db.query('select * from public.deals order by id')).rows);
  const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
  const call=async(fn,p)=>(await db.query('select public.'+fn+'($1::jsonb) result',[JSON.stringify(p||{})])).rows[0].result;
  /* 표는 직접 못 읽는다 */
  await as(AV);
  for(const t of ['crm_approval_requests','crm_approval_events'])await assert.rejects(db.exec('select * from public.'+t),/permission denied/,t);
  const l0=await call('crm_approval_list_v1');assert.deepEqual(l0.rows,[]);assert.equal(l0.admin,false);
  /* 요청: 종류 · 내용 · 사유 필수, 영업건은 있는 것만 */
  const rq={type:'owner_change',deal_id:D1,title:'[경기 용인] 수지삼성래미안 이필선 → 김성민',reason:'지역 재배치 · 계약은 김성민이 진행',payload:{from:'이필선',to:'김성민'}};
  await assert.rejects(call('crm_approval_request_v1',{...rq,type:'transfer'}),/요청 종류/);
  await assert.rejects(call('crm_approval_request_v1',{...rq,title:' '}),/요청 내용/);
  await assert.rejects(call('crm_approval_request_v1',{...rq,reason:''}),/요청 사유/);
  await assert.rejects(call('crm_approval_request_v1',{...rq,payload:[1]}),/invalid payload/);
  await assert.rejects(call('crm_approval_request_v1',{...rq,deal_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}),/영업건을 찾을 수 없습니다/);
  const r1=(await call('crm_approval_request_v1',rq)).request;
  assert.equal(r1.status,'pending');assert.equal(r1.requested_by,V);assert.equal(r1.requested_by_name,'이필선');assert.deepEqual(r1.payload,{from:'이필선',to:'김성민'});assert.equal(r1.decided_at,null);
  await assert.rejects(call('crm_approval_request_v1',rq),/같은 요청이 이미 승인 대기 중/);
  const r2=(await call('crm_approval_request_v1',{type:'result_fix',deal_id:D2,title:'[경기 화성] 동탄 실주 → 수주',reason:'재입찰로 낙찰 · 낙찰공고 첨부'})).request;
  /* 영업건 없이도 올릴 수 있다(중복 리드 정산 등) */
  await as(AW);
  const r3=(await call('crm_approval_request_v1',{type:'dup_lead',title:'[서울 강남] 풍림1차 황윤선 · 정정훈 동시 접촉',reason:'최초 연결 황윤선 9.11 · 정정훈 9.14'})).request;
  assert.equal(r3.deal_id,null);assert.equal(r3.requested_by_name,'정정훈');
  /* 읽기: 영업사원은 자기 요청만, 관리자는 전부 */
  assert.deepEqual((await call('crm_approval_list_v1')).rows.map(r=>r.id),[r3.id]);
  await as(AV);assert.deepEqual((await call('crm_approval_list_v1')).rows.map(r=>r.id).sort(),[r1.id,r2.id].sort());
  /* 승인 · 반려는 관리자만 */
  await assert.rejects(call('crm_approval_decide_v1',{id:r1.id,decision:'approve'}),/관리자만/);
  await as(AU);
  const la=await call('crm_approval_list_v1');assert.equal(la.admin,true);assert.equal(la.rows.length,3);
  await assert.rejects(call('crm_approval_decide_v1',{id:r1.id,decision:'ok'}),/invalid payload/);
  await assert.rejects(call('crm_approval_decide_v1',{id:'x',decision:'approve'}),/invalid payload/);
  await assert.rejects(call('crm_approval_decide_v1',{id:999999,decision:'approve'}),/요청을 찾을 수 없습니다/);
  await assert.rejects(call('crm_approval_decide_v1',{id:r2.id,decision:'reject'}),/반려 사유/);
  const a1=(await call('crm_approval_decide_v1',{id:r1.id,decision:'approve'})).request;
  assert.equal(a1.status,'approved');assert.equal(a1.decided_by,U);assert.equal(a1.decided_by_name,'송보람');assert.ok(a1.decided_at);assert.equal(a1.decision_reason,null);
  const a2=(await call('crm_approval_decide_v1',{id:r2.id,decision:'reject',reason:'낙찰공고 확인 안 됨'})).request;
  assert.equal(a2.status,'rejected');assert.equal(a2.decision_reason,'낙찰공고 확인 안 됨');
  await assert.rejects(call('crm_approval_decide_v1',{id:r1.id,decision:'reject',reason:'다시'}),/이미 처리된 요청/);
  /* 처리된 뒤에는 같은 종류를 다시 올릴 수 있다 · 거두기는 올린 사람 또는 관리자, 대기 중인 것만 */
  await as(AV);
  const r4=(await call('crm_approval_request_v1',rq)).request;assert.notEqual(r4.id,r1.id);
  await assert.rejects(call('crm_approval_request_v1',{cancel:true,id:r3.id}),/올린 사람 또는 관리자만/);
  await assert.rejects(call('crm_approval_request_v1',{cancel:true,id:r1.id}),/이미 처리된 요청/);
  assert.equal((await call('crm_approval_request_v1',{cancel:true,id:r4.id})).request.status,'cancelled');
  assert.deepEqual((await call('crm_approval_list_v1')).rows.map(r=>r.id).sort(),[r1.id,r2.id].sort(),'거둔 요청은 목록에서 빠진다');
  /* 기록 · 다른 자료는 그대로 */
  await db.exec('reset role');
  const ev=(await db.query('select request_id,action,actor_name from public.crm_approval_events order by id')).rows;
  assert.deepEqual(ev.map(e=>e.action),['request','request','request','approve','reject','request','cancel']);assert.equal(ev[3].actor_name,'송보람');
  assert.equal(JSON.stringify((await db.query('select * from public.deals order by id')).rows),dealsBefore,'영업건은 건드리지 않는다');
 }finally{await db.close();}
});
