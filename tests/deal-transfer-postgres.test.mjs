import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const sql=readFileSync(new URL('../sql/deal-transfer-v1-20261004.sql',import.meta.url),'utf8');
const rules=readFileSync(new URL('../sql/ops-rules-v1-20261004.sql',import.meta.url),'utf8');
const store=readFileSync(new URL('../sql/ops-store-v1-20261002.sql',import.meta.url),'utf8');
/* 타사 이관 v1: 다시 실행해도 안전 · 표 직접 접근 차단 · 등록/낙찰결과 = 담당자 또는 관리자 · 실적 인정 = 관리자만(사전 보고 + 확인 3개) · 바꿀 때마다 기록 */
test('deal transfer: register → award → admin approval, pre-report required, audit trail',async()=>{
 const db=new PGlite();
 const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222',V='44444444-4444-4444-8444-444444444444',AV='55555555-5555-4555-8555-555555555555',W='66666666-6666-4666-8666-666666666666',AW='77777777-7777-4777-8777-777777777777';
 const D1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',D2='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
 try{
  await db.exec(fixture);
  await db.exec('alter table public.deals add column owner_id uuid, add column assignee_name text');
  await db.exec(sql);await db.exec(sql);/* 두 번 실행해도 안전 */
  await db.query("insert into public.users values($1,$2,'송보람','admin',true),($3,$4,'이필선','rep',true),($5,$6,'정정훈','rep',true)",[U,AU,V,AV,W,AW]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day'),($3,$4,'rep','rep',true,now()+interval '1 day'),($5,$6,'rep','rep',true,now()+interval '1 day')",[U,AU,V,AV,W,AW]);
  await db.query("insert into public.deals(id,owner_id,assignee_name) values($1,$2,'이필선'),($3,$2,'이필선')",[D1,V,D2]);
  const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
  const call=async(fn,p)=>(await db.query('select public.'+fn+'($1::jsonb) result',[JSON.stringify(p||{})])).rows[0].result;
  /* 표는 직접 못 읽는다 */
  await as(AV);
  for(const t of ['crm_deal_transfers','crm_deal_transfer_events'])await assert.rejects(db.exec('select * from public.'+t),/permission denied/,t);
  assert.deepEqual((await call('crm_deal_transfer_list_v1')).rows,[]);
  /* 등록: 필수값 · 담당자만 */
  const reg={deal_id:D1,company:'코지건설',reason:'영업권 조율',date:'2026-10-03',reported:true,reported_at:'2026-10-02',memo:'10.2 한준엽 팀장 협의 후 이관',expected_amount:'400000000'};
  await assert.rejects(call('crm_deal_transfer_register_v1',{...reg,company:''}),/이관 업체/);
  await assert.rejects(call('crm_deal_transfer_register_v1',{...reg,reason:''}),/이관 사유/);
  await assert.rejects(call('crm_deal_transfer_register_v1',{...reg,date:'2026-13-40'}),/이관일/);
  await assert.rejects(call('crm_deal_transfer_register_v1',{...reg,reported:'yes'}),/사전 보고/);
  await assert.rejects(call('crm_deal_transfer_register_v1',{...reg,deal_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}),/영업건을 찾을 수 없습니다/);
  await as(AW);await assert.rejects(call('crm_deal_transfer_register_v1',reg),/담당자 또는 관리자만/);
  await as(AV);
  const r1=(await call('crm_deal_transfer_register_v1',reg)).transfer;
  assert.equal(r1.transfer_status,'transferred');assert.equal(r1.award_result,'pending');assert.equal(r1.performance_owner,'이필선','실적 귀속 = 이관 전 담당자');assert.equal(r1.performance_owner_id,V);assert.equal(r1.incentive_eligible,false);assert.equal(Number(r1.expected_amount),4e8);
  assert.equal((await call('crm_deal_transfer_list_v1')).rows.length,1);
  /* 낙찰결과: 수주는 업체 · 낙찰일 · 금액 · 증빙 필수 */
  const aw={deal_id:D1,result:'transferred_won',company:'코지건설',date:'2026-10-20',amount:380000000,evidence:'낙찰공고 캡처 · 자료 탭 첨부'};
  await assert.rejects(call('crm_deal_transfer_award_v1',{...aw,amount:0}),/낙찰금액/);
  await assert.rejects(call('crm_deal_transfer_award_v1',{...aw,evidence:''}),/증빙/);
  await assert.rejects(call('crm_deal_transfer_award_v1',{...aw,result:'won'}),/invalid payload/);
  await assert.rejects(call('crm_deal_transfer_award_v1',{deal_id:D1,result:'lost'}),/실주 사유/);
  await assert.rejects(call('crm_deal_transfer_award_v1',{...aw,deal_id:D2}),/등록된 타사 이관이 없습니다/);
  const r2=(await call('crm_deal_transfer_award_v1',aw)).transfer;
  assert.equal(r2.award_result,'transferred_won');assert.equal(Number(r2.award_amount),380000000);assert.equal(Number(r2.performance_amount),380000000,'실적 금액 = 낙찰금액 그대로');assert.equal(r2.incentive_eligible,false,'승인 전에는 실적 아님');
  await assert.rejects(call('crm_deal_transfer_register_v1',reg),/낙찰결과가 등록된 건은/);
  /* 실적 인정: 관리자만 · 확인 3개 모두 */
  await assert.rejects(call('crm_deal_transfer_approve_v1',{deal_id:D1,decision:'approve',checks:{reported:true,result:true,amount:true}}),/관리자만/);
  await as(AU);
  await assert.rejects(call('crm_deal_transfer_approve_v1',{deal_id:D1,decision:'approve',checks:{reported:true,result:true,amount:false}}),/모두 확인/);
  await assert.rejects(call('crm_deal_transfer_approve_v1',{deal_id:D1,decision:'reject'}),/제외 사유/);
  const r3=(await call('crm_deal_transfer_approve_v1',{deal_id:D1,decision:'approve',checks:{reported:true,result:true,amount:true}})).transfer;
  assert.equal(r3.incentive_eligible,true);assert.equal(r3.approved_by,U);assert.equal(r3.approved_by_name,'송보람');assert.ok(r3.approved_at);
  await as(AV);await assert.rejects(call('crm_deal_transfer_award_v1',aw),/실적이 인정된 건은/);
  /* 미보고 이관: 등록은 되지만 실적 인정 불가 · 제외는 사유와 함께 */
  const r4=(await call('crm_deal_transfer_register_v1',{...reg,deal_id:D2,reported:false,reported_at:'2026-10-02'})).transfer;
  assert.equal(r4.transfer_reported,false);assert.equal(r4.transfer_reported_at,null);
  await call('crm_deal_transfer_award_v1',{...aw,deal_id:D2});
  await as(AU);
  await assert.rejects(call('crm_deal_transfer_approve_v1',{deal_id:D2,decision:'approve',checks:{reported:true,result:true,amount:true}}),/사전 보고되지 않은/);
  const r5=(await call('crm_deal_transfer_approve_v1',{deal_id:D2,decision:'reject',reason:'사전 보고 없음'})).transfer;
  assert.equal(r5.incentive_eligible,false);assert.equal(r5.rejected_reason,'사전 보고 없음');
  /* 실주 · 취소 결과 + 등록 거두기 */
  await as(AV);
  const r6=(await call('crm_deal_transfer_award_v1',{deal_id:D2,result:'lost',note:'타사도 낙찰 실패'})).transfer;
  assert.equal(r6.award_result,'lost');assert.equal(r6.performance_amount,null);assert.equal(r6.rejected_reason,null);assert.ok(r6.award_date);
  const r7=(await call('crm_deal_transfer_award_v1',{deal_id:D2,result:'cancelled'})).transfer;assert.equal(r7.award_result,'cancelled');
  await assert.rejects(call('crm_deal_transfer_register_v1',{deal_id:D2,cancel:true}),/낙찰결과가 등록된 건은/);
  /* 기록 */
  await db.exec('reset role');
  const ev=(await db.query('select deal_id,action,actor_name from public.crm_deal_transfer_events order by id')).rows;
  assert.deepEqual(ev.map(e=>e.action),['register','award','approve','register','award','reject','award','award']);assert.equal(ev[2].actor_name,'송보람');
  /* 운영 기준 SQL 도 함께 설치돼야 한다(같은 저장소 표를 쓴다) */
  await db.exec(store);await db.exec(rules);await db.exec(rules);
  await as(AU);const rr=await call('crm_ops_rules_v1',{set:{assign_minutes:20,reasons_transfer:['영업권 조율','기타']}});
  assert.equal(rr.rules.assign_minutes,20);assert.equal(rr.changed,2);assert.equal(rr.history.length,2);assert.equal(rr.updated_by_name,'송보람');
  await assert.rejects(call('crm_ops_rules_v1',{set:{assign_minutes:5}}),/범위를 벗어난/);await assert.rejects(call('crm_ops_rules_v1',{set:{first_contact_hours:5}}),/바꿀 수 없는 항목/);
  await as(AV);await assert.rejects(call('crm_ops_rules_v1',{set:{assign_minutes:30}}),/관리자만/);assert.equal((await call('crm_ops_rules_v1')).rules.assign_minutes,20);
 }finally{await db.close();}
});
