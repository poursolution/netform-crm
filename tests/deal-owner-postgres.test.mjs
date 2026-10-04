import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const read=f=>readFileSync(new URL('../sql/'+f,import.meta.url),'utf8');
const sql=read('deal-owner-v1-20261004.sql'),approval=read('approval-inbox-v1-20261004.sql'),rules=read('ops-rules-v1-20261004.sql'),store=read('ops-store-v1-20261002.sql'),transfer=read('deal-transfer-v1-20261004.sql');
/* 담당 · 귀속 분리 v1: 다시 실행해도 안전 · 표 직접 접근 차단 · 담당이 바뀌어도 귀속 유지(처음 바뀔 때 주담당 고정) · 귀속 변경은 승인 요청 → 예외 승인자 승인 뒤에만 반영 · 이전 귀속은 이력에
   · 고정된 귀속은 그 뒤 타사 이관 등록의 실적 귀속으로 들어간다 · 영업건(담당 · 단계)은 건드리지 않는다 */
test('deal owner: reassign keeps attribution, attribution change only after approver approval, audit trail, used by transfer registration',async()=>{
 const db=new PGlite();
 const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222',V='44444444-4444-4444-8444-444444444444',AV='55555555-5555-4555-8555-555555555555',W='66666666-6666-4666-8666-666666666666',AW='77777777-7777-4777-8777-777777777777';
 const K='33333333-3333-4333-8333-333333333331',AK='33333333-3333-4333-8333-333333333332',X='88888888-8888-4888-8888-888888888881',AX='88888888-8888-4888-8888-888888888882';
 const D1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',D2='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',D3='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
 try{
  await db.exec(fixture);
  await db.exec('alter table public.deals add column owner_id uuid, add column assignee_name text');
  await db.exec(store);await db.exec(rules);await db.exec(approval);await db.exec(transfer);
  await db.exec(sql);await db.exec(sql);/* 두 번 실행해도 안전 */
  await db.query("insert into public.users values($1,$2,'송보람','admin',true),($3,$4,'이필선','rep',true),($5,$6,'정정훈','rep',true),($7,$8,'김성민','rep',true),($9,$10,'이승우','dual',true)",[U,AU,V,AV,W,AW,K,AK,X,AX]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day'),($3,$4,'rep','rep',true,now()+interval '1 day'),($5,$6,'rep','rep',true,now()+interval '1 day'),($7,$8,'rep','rep',true,now()+interval '1 day'),($9,$10,'manager','dual',true,now()+interval '1 day')",[U,AU,V,AV,W,AW,K,AK,X,AX]);
  /* D1: 이필선 → 김성민 으로 이미 담당이 바뀐 영업건 · D2: 이필선 담당 · D3: 정정훈 담당 */
  await db.query("insert into public.deals(id,owner_id,assignee_name) values($1,$2,'김성민'),($3,$4,'이필선'),($5,$6,'정정훈')",[D1,K,D2,V,D3,W]);
  const dealsBefore=JSON.stringify((await db.query('select * from public.deals order by id')).rows);
  const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
  const call=async(fn,p)=>(await db.query('select public.'+fn+'($1::jsonb) result',[JSON.stringify(p||{})])).rows[0].result;
  /* 표 · 내부 함수는 직접 못 쓴다 */
  await as(AK);
  for(const t of ['crm_deal_owners','crm_deal_owner_events'])await assert.rejects(db.exec('select * from public.'+t),/permission denied/,t);
  await assert.rejects(db.query("select crm_security.deal_owner_apply($1,'이필선','김성민','x',$2,'김성민')",[D1,K]),/permission denied/);
  assert.deepEqual((await call('crm_deal_owner_list_v1')).rows,[]);
  /* 담당 변경 기록: 사유 · 귀속 선택 필수 · 관련된 사람만 */
  const re={deal_id:D1,from:'이필선',to:'김성민',reason:'지역 재배치 (경기 남부)',attribution:'keep',keep_owner:'이필선',first_owner:'이필선',first_connected_at:'2026-07-14'};
  await assert.rejects(call('crm_deal_owner_reassign_v1',{...re,reason:''}),/변경 사유/);
  await assert.rejects(call('crm_deal_owner_reassign_v1',{...re,attribution:'move'}),/실적 귀속을 골라/);
  await assert.rejects(call('crm_deal_owner_reassign_v1',{...re,to:'이필선'}),/바뀌기 전 · 후 담당/);
  await assert.rejects(call('crm_deal_owner_reassign_v1',{...re,keep_owner:'없는사람'}),/주담당은 계정에 있는 이름/);
  await assert.rejects(call('crm_deal_owner_reassign_v1',{...re,deal_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}),/영업건을 찾을 수 없습니다/);
  await as(AW);await assert.rejects(call('crm_deal_owner_reassign_v1',re),/담당자 또는 관리자만/);
  await as(AK);
  const o1=(await call('crm_deal_owner_reassign_v1',re)).owner;
  assert.equal(o1.performance_owner,'이필선','담당이 바뀌어도 귀속은 주담당에게');assert.equal(o1.performance_owner_id,V);assert.equal(o1.first_owner,'이필선');assert.equal(String(o1.first_connected_at).slice(0,10),'2026-07-14');
  /* 다시 바뀌어도(김성민 → 정정훈) 귀속은 그대로 — 화면이 다른 주담당을 보내도 바꾸지 않는다 */
  await as(AU);
  const o2=(await call('crm_deal_owner_reassign_v1',{...re,from:'김성민',to:'정정훈',reason:'업무량 재배분',keep_owner:'김성민'})).owner;
  assert.equal(o2.performance_owner,'이필선');assert.equal(o2.first_owner,'이필선');
  const l1=await call('crm_deal_owner_list_v1',{deal_id:D1});
  assert.equal(l1.rows.length,1);assert.deepEqual(l1.events.map(e=>[e.action,e.from_owner,e.to_owner,e.reason,e.attribution,e.actor_name]),[['reassign','이필선','김성민','지역 재배치 (경기 남부)','keep','김성민'],['reassign','김성민','정정훈','업무량 재배분','keep','송보람']]);
  assert.deepEqual((await call('crm_deal_owner_list_v1')).events,[],'영업건을 지정하지 않으면 이력은 주지 않는다');
  /* 귀속 변경 = 승인 요청 → 예외 승인자 승인 뒤에만 반영 */
  await as(AK);
  const rq={type:'owner_change',deal_id:D1,title:'[경기 용인] 수지삼성래미안 이필선 → 김성민',reason:'지역 재배치 · 계약은 김성민이 진행',payload:{from_owner:'이필선',to_owner:'김성민'}};
  await assert.rejects(call('crm_approval_request_v1',{...rq,payload:{from_owner:'이필선'}}),/바꿀 귀속은 사용 중인 계정 이름/);
  await assert.rejects(call('crm_approval_request_v1',{...rq,payload:{to_owner:'없는사람'}}),/바꿀 귀속은 사용 중인 계정 이름/);
  await assert.rejects(call('crm_approval_request_v1',{...rq,deal_id:null}),/바꿀 귀속은 사용 중인 계정 이름/);
  const r1=(await call('crm_approval_request_v1',rq)).request;
  assert.equal((await call('crm_deal_owner_list_v1')).rows[0].performance_owner,'이필선','승인 전에는 귀속을 바꾸지 않는다');
  await as(AU);await assert.rejects(call('crm_approval_decide_v1',{id:r1.id,decision:'approve'}),/예외 승인자만/);
  await as(AX);
  const a1=await call('crm_approval_decide_v1',{id:r1.id,decision:'approve'});
  assert.equal(a1.request.status,'approved');assert.equal(a1.request.decided_by_name,'이승우');assert.equal(a1.owner.performance_owner,'김성민');assert.equal(a1.owner.performance_owner_id,K);assert.equal(a1.owner.first_owner,'이필선','최초 담당은 그대로');
  const l2=await call('crm_deal_owner_list_v1',{deal_id:D1});
  assert.deepEqual(l2.events.slice(-1).map(e=>[e.action,e.from_owner,e.to_owner,e.attribution,e.actor_name,e.reason]),[['attribution_change','이필선','김성민','approved','이승우','지역 재배치 · 계약은 김성민이 진행']],'이전 귀속은 이력에 남는다');
  /* 반려는 아무것도 바꾸지 않는다 · 처음 고정하는 영업건(D2)은 요청의 현재 귀속을 최초 담당으로 남긴다 */
  await as(AK);
  const r2=(await call('crm_approval_request_v1',{...rq,payload:{from_owner:'김성민',to_owner:'정정훈'}})).request;
  const r3=(await call('crm_approval_request_v1',{...rq,deal_id:D2,title:'D2 이필선 → 김성민',payload:{from_owner:'이필선',to_owner:'김성민'}})).request;
  await as(AX);
  assert.equal((await call('crm_approval_decide_v1',{id:r2.id,decision:'reject',reason:'근거 부족'})).owner,null);
  const a3=await call('crm_approval_decide_v1',{id:r3.id,decision:'approve'});assert.equal(a3.owner.performance_owner,'김성민');assert.equal(a3.owner.first_owner,'이필선');
  const rows=(await call('crm_deal_owner_list_v1')).rows;assert.deepEqual(rows.map(r=>[r.deal_id,r.performance_owner]),[[D1,'김성민'],[D2,'김성민']]);
  /* 고정된 귀속은 그 뒤 타사 이관 등록의 실적 귀속으로 들어간다(지금 담당이 누구든) */
  await as(AW);
  await call('crm_deal_owner_reassign_v1',{deal_id:D3,from:'이필선',to:'정정훈',reason:'퇴사 인수인계',attribution:'keep',keep_owner:'이필선'});
  const tf=(await call('crm_deal_transfer_register_v1',{deal_id:D3,company:'코지건설',reason:'영업권 조율',date:'2026-10-03',reported:true,reported_at:'2026-10-02'})).transfer;
  assert.equal(tf.performance_owner,'이필선','실적 귀속 = 주담당');assert.equal(tf.performance_owner_id,V);
  /* 영업건은 건드리지 않는다 */
  await db.exec('reset role');
  assert.equal(JSON.stringify((await db.query('select * from public.deals order by id')).rows),dealsBefore);
  assert.equal(Number((await db.query('select count(*) n from public.crm_deal_owner_events')).rows[0].n),5);
 }finally{await db.close();}
});
