import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const sql=readFileSync(new URL('../sql/deal-win-type-v1-20261004.sql',import.meta.url),'utf8');
const sql2=readFileSync(new URL('../sql/deal-win-path-v2-20261004.sql',import.meta.url),'utf8');
/* 수주 유형 v1: 다시 실행해도 안전 · 표 직접 접근 차단 · 수주 확정 = 담당자 또는 관리자 · 협약시공사 수주에서 기술자문 발생 = 예 → 기술자문 관리 건 한 번만 자동 생성 · 실적 금액 = 낙찰금액(연결 계약은 더하지 않음) */
test('deal win type: own / partner_tech, advisory case auto-created once, audit trail',async()=>{
 const db=new PGlite();
 const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222',V='44444444-4444-4444-8444-444444444444',AV='55555555-5555-4555-8555-555555555555',W='66666666-6666-4666-8666-666666666666',AW='77777777-7777-4777-8777-777777777777';
 const D1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',D2='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',D3='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',S1='cccccccc-cccc-4ccc-8ccc-ccccccccccc1',OLD='dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
 try{
  await db.exec(fixture);
  await db.exec('alter table public.deals add column if not exists owner_id uuid, add column if not exists assignee_name text, add column if not exists site_id uuid, add column if not exists brand text, add column if not exists origin_business text, add column if not exists work_summary text');
  /* 운영에 이미 있는 표(기술자문 자료 · 낙찰실적 확정 · 현장)와 같은 모양 */
  await db.exec(`create table if not exists public.sites(site_id uuid primary key,site_name text);
   create table if not exists public.advisory_deals(advisory_id uuid default gen_random_uuid() primary key,site_id uuid,site_name text not null,work_name text,work_type text,contractor text,owner_name text,owner_kind text default '미지정' check (owner_kind in ('내부','외부','미지정')),bid_amount bigint,lrc bigint,exec_amount bigint,pour_amount bigint,advisory_fee bigint,settled bigint,contract_date date,start_date date,end_date date,status text not null default '진행중',origin_channel text,source_sheet text,source_row integer,raw jsonb default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
   create unique index if not exists uq_adv_src on public.advisory_deals(source_sheet,source_row);
   create table if not exists crm_security.advisory_attribution(advisory_id uuid primary key,decision text not null,origin_business text,source_deal_id uuid,performance_owner text,bid_amount bigint,bid_confirmed_at date);`);
  await db.exec(sql);await db.exec(sql);/* 두 번 실행해도 안전 */
  await db.exec(sql2);await db.exec(sql2);/* 영업 경로 · 금액 5개 열 + 채움 트리거 */
  await db.query("insert into public.users values($1,$2,'송보람','admin',true),($3,$4,'황윤선','rep',true),($5,$6,'정정훈','rep',true)",[U,AU,V,AV,W,AW]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day'),($3,$4,'rep','rep',true,now()+interval '1 day'),($5,$6,'rep','rep',true,now()+interval '1 day')",[U,AU,V,AV,W,AW]);
  await db.query("insert into public.sites values($1,'평택비전지웰푸르지오')",[S1]);
  await db.query("insert into public.deals(id,owner_id,assignee_name,site_id,brand,origin_business,work_summary) values($1,$2,'황윤선',$3,'석민이앤씨','석민이앤씨','옥상방수'),($4,$2,'황윤선',null,'POUR솔루션',null,null),($5,$2,'황윤선',$3,'석민이앤씨',null,null)",[D1,V,S1,D2,D3]);
  /* 예전부터 있던 확정 기술자문 낙찰 1건 + 보류 1건 */
  await db.query("insert into public.advisory_deals(advisory_id,site_name,contractor,bid_amount,advisory_fee,pour_amount) values($1,'옥련현대4차','코지건설',885000000,300000000,null)",[OLD]);
  await db.query("insert into crm_security.advisory_attribution values($1,'confirmed','석민이앤씨',null,'이필선',885000000,'2026-07-31')",[OLD]);
  const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
  const call=async(fn,p)=>(await db.query('select public.'+fn+'($1::jsonb) result',[JSON.stringify(p||{})])).rows[0].result;
  /* 표는 직접 못 읽는다. 읽기 함수는 로그인한 누구나 */
  await as(AV);
  for(const t of ['crm_deal_wins','crm_deal_win_events'])await assert.rejects(db.exec('select * from public.'+t),/permission denied/,t);
  const l0=await call('crm_deal_win_list_v1');
  assert.deepEqual(l0.rows,[]);assert.equal(l0.advisory.length,1,'확정된 기술자문 낙찰만');assert.equal(l0.advisory[0].contractor,'코지건설');assert.equal(Number(l0.advisory[0].bid_amount),885000000);assert.equal(Number(l0.advisory[0].advisory_fee),300000000);
  /* 필수값 · 권한 */
  const pt={deal_id:D1,type:'partner_tech',company:'코지건설',amount:1043900000,date:'2026-10-01',tech:true,tech_company:'코지건설',tech_amount:433650000,pour_amount:'136690000'};
  await assert.rejects(call('crm_deal_win_register_v1',{...pt,type:'transfer'}),/수주 유형/);
  await assert.rejects(call('crm_deal_win_register_v1',{...pt,company:''}),/낙찰 시공사/);
  await assert.rejects(call('crm_deal_win_register_v1',{...pt,amount:0}),/낙찰금액/);
  await assert.rejects(call('crm_deal_win_register_v1',{...pt,date:'2999-01-01'}),/낙찰일/);
  await assert.rejects(call('crm_deal_win_register_v1',{...pt,tech:'yes'}),/기술자문 발생/);
  await assert.rejects(call('crm_deal_win_register_v1',{...pt,tech_company:''}),/기술자문 계약 상대/);
  await assert.rejects(call('crm_deal_win_register_v1',{...pt,tech_amount:0}),/기술자문 계약금액/);
  await assert.rejects(call('crm_deal_win_register_v1',{...pt,deal_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}),/영업건을 찾을 수 없습니다/);
  await as(AW);await assert.rejects(call('crm_deal_win_register_v1',pt),/담당자 또는 관리자만/);
  /* 협약시공사 수주 · 기술자문: 실적 = 낙찰금액 그대로, 기술자문 관리 건 자동 생성 */
  await as(AV);
  const r1=await call('crm_deal_win_register_v1',pt),w1=r1.win;
  assert.equal(r1.advisory_created,true);assert.equal(w1.won_type,'partner_tech');assert.equal(Number(w1.award_amount),1043900000,'실적 금액 = 낙찰금액(자문료 · POUR 계약을 더하지 않는다)');
  assert.equal(w1.sales_channel_brand,'석민이앤씨');assert.equal(w1.performance_owner,'황윤선');assert.equal(w1.performance_owner_id,V);assert.equal(w1.tech_advisory,true);assert.equal(Number(w1.tech_advisory_amount),433650000);assert.equal(Number(w1.pour_contract_amount),136690000);assert.ok(w1.advisory_id);
  /* 영업 경로 5칸 · 금액 5개(더하지 않는다): 인센티브 실적 = 낙찰금액, 자사계약 = POUR 계약 */
  assert.equal(w1.inflow_brand,'석민이앤씨');assert.equal(w1.first_sales_company,'석민이앤씨');assert.equal(Number(w1.incentive_amount),1043900000);assert.equal(Number(w1.own_contract_amount),136690000);
  await db.exec('reset role');
  const ad=(await db.query('select * from public.advisory_deals where advisory_id=$1',[w1.advisory_id])).rows[0];
  assert.equal(ad.site_name,'평택비전지웰푸르지오');assert.equal(ad.site_id,S1);assert.equal(ad.contractor,'코지건설');assert.equal(Number(ad.bid_amount),1043900000);assert.equal(Number(ad.advisory_fee),433650000);assert.equal(Number(ad.pour_amount),136690000);
  assert.equal(ad.owner_name,'황윤선');assert.equal(ad.owner_kind,'내부');assert.equal(ad.origin_channel,'crm');assert.equal(ad.source_sheet,'crm:deal:'+D1);assert.equal(ad.work_name,'옥상방수');assert.equal(ad.raw.crm_deal_id,D1);assert.equal(ad.raw.tech_advisory_company,'코지건설');
  /* 다시 저장 = 같은 기술자문 관리 건의 값을 맞춘다(새로 만들지 않는다). 실적 귀속은 그대로 */
  await db.query("update public.deals set owner_id=$1,assignee_name='정정훈' where id=$2",[W,D1]);
  await as(AV);
  const r2=await call('crm_deal_win_register_v1',{...pt,amount:1050000000,pour_amount:''});
  assert.equal(r2.advisory_created,false);assert.equal(r2.win.advisory_id,w1.advisory_id);assert.equal(r2.win.performance_owner,'황윤선','실적 귀속 = 수주 확정 시점 담당자');assert.equal(r2.win.pour_contract_amount,null);
  await db.exec('reset role');
  assert.equal((await db.query("select count(*)::int n from public.advisory_deals where source_sheet like 'crm:deal:%'")).rows[0].n,1);
  assert.equal(Number((await db.query('select bid_amount from public.advisory_deals where advisory_id=$1',[w1.advisory_id])).rows[0].bid_amount),1050000000);
  /* 기술자문 발생 = 아니오: 관리 건을 만들지 않는다. 현장 연결이 없으면 화면이 보낸 현장명을 쓴다 */
  await as(AV);
  const r3=await call('crm_deal_win_register_v1',{deal_id:D2,type:'partner_tech',company:'여름건설',amount:98500000,date:'2026-09-20',tech:false});
  assert.equal(r3.advisory_created,false);assert.equal(r3.win.advisory_id,null);assert.equal(r3.win.tech_advisory,false);assert.equal(r3.win.sales_channel_brand,'POUR솔루션');
  await assert.rejects(call('crm_deal_win_register_v1',{deal_id:D2,type:'partner_tech',company:'여름건설',amount:98500000,date:'2026-09-20',tech:true,tech_company:'여름건설',tech_amount:30000000}),/현장명을 확인할 수 없습니다/);
  const r4=await call('crm_deal_win_register_v1',{deal_id:D2,type:'partner_tech',company:'여름건설',amount:98500000,date:'2026-09-20',tech:true,tech_company:'여름건설',tech_amount:30000000,site_name:'홍성미성'});
  assert.equal(r4.advisory_created,true);
  /* 직접 수주: 유형 · 계약 업체만 남긴다(실적은 계약실적 원장) */
  const r5=await call('crm_deal_win_register_v1',{deal_id:D3,type:'own',company:'석민이앤씨',amount:500000000,date:'2026-10-02'});
  assert.equal(r5.win.won_type,'own');assert.equal(r5.win.tech_advisory,false);assert.equal(r5.win.advisory_id,null);assert.equal(Number(r5.win.own_contract_amount),500000000,'직접 수주의 자사계약 = 낙찰금액');assert.equal(Number(r5.win.incentive_amount),500000000);
  /* 목록 · 거두기 */
  const l1=await call('crm_deal_win_list_v1');assert.equal(l1.rows.length,3);
  await as(AW);await assert.rejects(call('crm_deal_win_register_v1',{deal_id:D3,cancel:true}),/담당자 또는 관리자만/);
  await as(AU);
  assert.equal((await call('crm_deal_win_register_v1',{deal_id:D3,cancel:true})).win,null);
  await assert.rejects(call('crm_deal_win_register_v1',{deal_id:D3,cancel:true}),/확정된 수주가 없습니다/);
  assert.equal((await call('crm_deal_win_list_v1')).rows.length,2);
  /* 기록 */
  await db.exec('reset role');
  const ev=(await db.query('select deal_id,action,actor_name from public.crm_deal_win_events order by id')).rows;
  assert.deepEqual(ev.map(e=>e.action),['register','register','register','register','register','cancel']);assert.equal(ev[5].actor_name,'송보람');
 }finally{await db.close();}
});
