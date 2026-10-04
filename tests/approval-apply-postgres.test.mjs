import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const read=f=>readFileSync(new URL('../sql/'+f,import.meta.url),'utf8');
const store=read('ops-store-v1-20261002.sql'),rules=read('ops-rules-v1-20261004.sql'),approval=read('approval-inbox-v1-20261004.sql'),owner=read('deal-owner-v1-20261004.sql'),transfer=read('deal-transfer-v1-20261004.sql'),win=read('deal-win-type-v1-20261004.sql');
/* 승인 요청 창(시안): 승인 전에는 아무것도 바꾸지 않고, 승인되면 안내대로 반영한다
   타사 이관 실적 = 타사 이관 수주로 실적 인정 / 결과 수정 = 수주 결과 · 낙찰금액 / 중복 리드 정산 · 귀속 변경 = 실적 귀속 / 전략수주 · 특별 인센티브 = 승인 기록.
   본인이 올린 요청은 다른 승인자가 처리한다(유지). 반려는 아무것도 바꾸지 않는다. */
test('approval apply: nothing changes before approval; approved transfer / result fix / duplicate lead are applied as the dialog says',async()=>{
 const db=new PGlite();
 const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222',V='44444444-4444-4444-8444-444444444444',AV='55555555-5555-4555-8555-555555555555',W='66666666-6666-4666-8666-666666666666',AW='77777777-7777-4777-8777-777777777777';
 const X='88888888-8888-4888-8888-888888888881',AX='88888888-8888-4888-8888-888888888882',Y='99999999-9999-4999-8999-999999999991',AY='99999999-9999-4999-8999-999999999992';
 const D1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',D2='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',D3='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',D4='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
 try{
  await db.exec(fixture);
  await db.exec('alter table public.deals add column if not exists owner_id uuid, add column if not exists assignee_name text, add column if not exists site_id uuid, add column if not exists brand text, add column if not exists origin_business text, add column if not exists work_summary text');
  await db.exec(`create table if not exists public.sites(site_id uuid primary key,site_name text);
   create table if not exists public.advisory_deals(advisory_id uuid default gen_random_uuid() primary key,site_id uuid,site_name text not null,work_name text,work_type text,contractor text,owner_name text,owner_kind text default '미지정',bid_amount bigint,lrc bigint,exec_amount bigint,pour_amount bigint,advisory_fee bigint,settled bigint,contract_date date,start_date date,end_date date,status text not null default '진행중',origin_channel text,source_sheet text,source_row integer,raw jsonb default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
   create unique index if not exists uq_adv_src on public.advisory_deals(source_sheet,source_row);
   create table if not exists crm_security.advisory_attribution(advisory_id uuid primary key,decision text not null,origin_business text,source_deal_id uuid,performance_owner text,bid_amount bigint,bid_confirmed_at date);`);
  await db.exec(store);await db.exec(rules);await db.exec(owner);await db.exec(transfer);await db.exec(win);
  await db.exec(approval);await db.exec(approval);/* 두 번 실행해도 안전(종류 제약 넓히기 포함) */
  await db.query("insert into public.users values($1,$2,'송보람','admin',true),($3,$4,'이필선','rep',true),($5,$6,'정정훈','rep',true),($7,$8,'이승우','dual',true),($9,$10,'황윤선','dual',true)",[U,AU,V,AV,W,AW,X,AX,Y,AY]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day'),($3,$4,'rep','rep',true,now()+interval '1 day'),($5,$6,'rep','rep',true,now()+interval '1 day'),($7,$8,'manager','dual',true,now()+interval '1 day'),($9,$10,'manager','dual',true,now()+interval '1 day')",[U,AU,V,AV,W,AW,X,AX,Y,AY]);
  await db.query("insert into public.deals(id,owner_id,assignee_name,brand) values($1,$2,'이필선','석민이앤씨'),($3,$4,'정정훈','POUR솔루션'),($5,$4,'정정훈','석민이앤씨'),($6,$7,'황윤선','석민이앤씨')",[D1,V,D2,W,D3,D4,Y]);
  const dealsBefore=JSON.stringify((await db.query('select * from public.deals order by id')).rows);
  const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
  const call=async(fn,p)=>(await db.query('select public.'+fn+'($1::jsonb) result',[JSON.stringify(p||{})])).rows[0].result;
  const count=async t=>{await db.exec('reset role');return Number((await db.query('select count(*) n from public.'+t)).rows[0].n);};
  /* 내부 반영 함수는 직접 못 부른다 */
  await as(AV);
  await assert.rejects(db.query("select crm_security.deal_transfer_apply($1,'코지건설',1000,'x',$2,'이필선',$2,'이필선')",[D1,V]),/permission denied/);
  await assert.rejects(db.query("select crm_security.deal_win_apply($1,'won_own',1000,$2,'이필선')",[D1,V]),/permission denied/);
  /* 1. 타사 이관 실적: 이관 업체 · 낙찰금액 필수 → 승인 전에는 타사 이관이 없다 → 승인되면 실적 인정 */
  const tf={type:'transfer',deal_id:D1,title:'[세종] 조치원자이 코지건설 380,000,000원 (VAT 별도)',reason:'사전 보고 10.2 · 낙찰공고 첨부',payload:{company:'코지건설',amount:'380000000',evidence:{attachment_id:'att-1',file_name:'낙찰공고.pdf'}}};
  await assert.rejects(call('crm_approval_request_v1',{...tf,type:'xx'}),/요청 종류/);
  await assert.rejects(call('crm_approval_request_v1',{...tf,payload:{company:'',amount:'380000000'}}),/이관 업체와 낙찰금액/);
  await assert.rejects(call('crm_approval_request_v1',{...tf,payload:{company:'코지건설',amount:'3.8억'}}),/이관 업체와 낙찰금액/);
  await assert.rejects(call('crm_approval_request_v1',{...tf,deal_id:null}),/이관 업체와 낙찰금액/);
  const r1=(await call('crm_approval_request_v1',tf)).request;assert.equal(r1.type,'transfer');
  assert.equal(await count('crm_deal_transfers'),0,'승인 전에는 실적을 만들지 않는다');
  await as(AX);
  const a1=await call('crm_approval_decide_v1',{id:r1.id,decision:'approve'});
  assert.equal(a1.request.decided_by_name,'이승우');
  assert.deepEqual([a1.applied.transfer_status,a1.applied.award_result,a1.applied.award_company,Number(a1.applied.award_amount),Number(a1.applied.performance_amount),a1.applied.incentive_eligible,a1.applied.approved_by_name,a1.applied.performance_owner,a1.applied.created_by_name],['transferred','transferred_won','코지건설',380000000,380000000,true,'이승우','이필선','이필선'],'승인되면 타사 이관 수주로 실적 반영 · 귀속 = 그 영업건 담당');
  assert.match(a1.applied.award_evidence,/사전 보고 10\.2 · 낙찰공고 첨부 · 낙찰공고\.pdf/);assert.ok(a1.applied.award_date&&a1.applied.transfer_date);
  await as(AV);const tl=(await call('crm_deal_transfer_list_v1')).rows;assert.equal(tl.length,1);assert.equal(tl[0].incentive_eligible,true);
  /* 이미 등록된 타사 이관(낙찰결과 전)에 올리면 그 건에 낙찰결과 + 인정을 채운다(이관 정보 · 귀속은 그대로) */
  await as(AW);
  await call('crm_deal_transfer_register_v1',{deal_id:D2,company:'한빛건설',reason:'영업권 조율',date:'2026-10-01',reported:true,reported_at:'2026-09-30'});
  const r2=(await call('crm_approval_request_v1',{...tf,deal_id:D2,title:'D2 한빛건설',payload:{company:'한빛건설',amount:'210000000'}})).request;
  await as(AY);const a2=await call('crm_approval_decide_v1',{id:r2.id,decision:'approve'});
  assert.deepEqual([a2.applied.transfer_reason,String(a2.applied.transfer_date).slice(0,10),Number(a2.applied.award_amount),a2.applied.incentive_eligible,a2.applied.approved_by_name,a2.applied.performance_owner],['영업권 조율','2026-10-01',210000000,true,'황윤선','정정훈']);
  /* 이미 인정된 건을 다시 올려 승인하면 거절되고, 승인도 되돌려진다 */
  await as(AW);const r2b=(await call('crm_approval_request_v1',{...tf,deal_id:D2,title:'D2 다시',payload:{company:'한빛건설',amount:'999'}})).request;
  await as(AX);await assert.rejects(call('crm_approval_decide_v1',{id:r2b.id,decision:'approve'}),/이미 실적이 인정된 타사 이관/);
  assert.equal((await call('crm_approval_list_v1')).rows.find(r=>r.id===r2b.id).status,'pending','반영에 실패하면 승인도 되돌린다');
  /* 2. 결과 수정: 승인 전에는 수주 결과가 없다 → 승인되면 결과 · 낙찰금액이 바뀐다 */
  await as(AW);
  const rf={type:'result_fix',deal_id:D3,title:'[경기 화성] 동탄 실주 → 수주 · 직접 · 1.8억',reason:'재입찰로 낙찰 · 낙찰공고 첨부',payload:{fields:[],to_result:'won_own',amount:'180000000'}};
  await assert.rejects(call('crm_approval_request_v1',{...rf,payload:{to_result:'won'}}),/바꿀 결과와 금액/);
  await assert.rejects(call('crm_approval_request_v1',{...rf,payload:{to_result:'won_own'}}),/바꿀 결과와 금액/);
  const r3=(await call('crm_approval_request_v1',rf)).request;
  assert.equal(await count('crm_deal_wins'),0,'승인 전에는 결과를 바꾸지 않는다');
  await as(AX);
  const a3=await call('crm_approval_decide_v1',{id:r3.id,decision:'approve'});
  assert.deepEqual([a3.applied.win_status,a3.applied.won_type,Number(a3.applied.award_amount),a3.applied.award_company,a3.applied.performance_owner,a3.applied.tech_advisory],['confirmed','own',180000000,'석민이앤씨','정정훈',false]);
  await as(AW);const wl=(await call('crm_deal_win_list_v1')).rows;assert.equal(wl.length,1);assert.equal(wl[0].deal_id,D3);
  /* 금액 · 유형만 다시 고치기 → 낙찰일 · 업체는 그대로 / 수주 → 실주 = 확정 취소 */
  const r3b=(await call('crm_approval_request_v1',{...rf,title:'금액 정정',payload:{to_result:'won_partner_tech',amount:'200000000'}})).request;
  await as(AX);const a3b=await call('crm_approval_decide_v1',{id:r3b.id,decision:'approve'});
  assert.deepEqual([a3b.applied.won_type,Number(a3b.applied.award_amount),a3b.applied.award_company,String(a3b.applied.award_date)],['partner_tech',200000000,'석민이앤씨',String(a3.applied.award_date)]);
  await as(AW);const r3c=(await call('crm_approval_request_v1',{...rf,title:'수주 → 실주',payload:{to_result:'lost'}})).request;
  await as(AX);assert.equal((await call('crm_approval_decide_v1',{id:r3c.id,decision:'approve'})).applied.win_status,'cancelled');
  /* 3. 중복 리드 정산: 최초 연결 담당자가 정해져 있으면 승인 뒤 그 사람에게 실적 귀속 */
  await as(AW);
  await assert.rejects(call('crm_approval_request_v1',{type:'dup_lead',deal_id:D3,title:'x',reason:'y',payload:{to_owner:'없는사람'}}),/최초 연결 담당자는 사용 중인 계정 이름/);
  const r4=(await call('crm_approval_request_v1',{type:'dup_lead',deal_id:D3,title:'[서울 강남] 풍림1차 이필선 · 정정훈 동시 접촉',reason:'두 사람이 같은 현장을 동시에 접촉',payload:{from_owner:'정정훈',to_owner:'이필선'}})).request;
  assert.deepEqual((await call('crm_deal_owner_list_v1')).rows,[],'승인 전에는 귀속을 바꾸지 않는다');
  await as(AX);const a4=await call('crm_approval_decide_v1',{id:r4.id,decision:'approve'});assert.equal(a4.owner.performance_owner,'이필선');
  /* 4. 전략수주 · 특별 인센티브: 승인 기록이 곧 반영(다른 자료는 그대로) · 반려는 아무것도 바꾸지 않는다 */
  await as(AW);
  const r5=(await call('crm_approval_request_v1',{type:'strategic_win',deal_id:D3,title:'[대전] 싸이언스빌 할인 7%',reason:'레퍼런스 가치',payload:{fields:[]}})).request;
  const r6=(await call('crm_approval_request_v1',{...tf,deal_id:D3,title:'D3 타사 이관',payload:{company:'코지건설',amount:'100000000'}})).request;
  await as(AX);
  const a5=await call('crm_approval_decide_v1',{id:r5.id,decision:'approve'});assert.equal(a5.applied,null);assert.equal(a5.owner,null);
  const a6=await call('crm_approval_decide_v1',{id:r6.id,decision:'reject',reason:'사전 보고 없음'});assert.equal(a6.applied,null);
  assert.equal(await count('crm_deal_transfers'),2,'반려된 요청은 실적을 만들지 않는다');
  /* 5. 본인이 올린 요청은 다른 승인자가(유지) — 승인자 본인의 타사 이관 실적 요청 */
  await as(AY);const r7=(await call('crm_approval_request_v1',{...tf,deal_id:D4,title:'D4',payload:{company:'코지건설',amount:'50000000'}})).request;
  await assert.rejects(call('crm_approval_decide_v1',{id:r7.id,decision:'approve'}),/본인이 올린 요청은 다른 승인자가/);
  await as(AX);assert.equal((await call('crm_approval_decide_v1',{id:r7.id,decision:'approve'})).applied.performance_owner,'황윤선');
  /* 영업건(단계 · 담당)은 그대로 */
  await db.exec('reset role');
  assert.equal(JSON.stringify((await db.query('select * from public.deals order by id')).rows),dealsBefore);
 }finally{await db.close();}
});
