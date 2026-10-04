import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const read=f=>readFileSync(new URL('../sql/'+f,import.meta.url),'utf8');
const store=read('ops-store-v1-20261002.sql'),rules=read('ops-rules-v1-20261004.sql'),approval=read('approval-inbox-v1-20261004.sql'),owner=read('deal-owner-v1-20261004.sql'),transfer=read('deal-transfer-v1-20261004.sql'),win=read('deal-win-type-v1-20261004.sql'),settle=read('settlement-v1-20261004.sql');
const ledger=readFileSync(new URL('../supabase/migrations/20260920160000_contract_sales_ledger.sql',import.meta.url),'utf8');
/* 승인 요청 창(시안 · 2026-10-04 보완): 승인 전에는 아무것도 바꾸지 않고, 승인되면 안내대로 반영한다 — 날짜는 요청에 적힌 실제 날(승인한 날로 대신하지 않는다)
   타사 이관 실적 = 이관일 · 낙찰일대로 실적 인정 / 결과 수정 = 수주 결과 · 낙찰일 · 낙찰금액, 직접 수주는 계약일 · 계약금액으로 계약 전환까지
   중복 리드 정산 = 실적 나눔(합 100%) + 정산 내역 / 특별 인센티브 = 정산 내역 별도 항목 / 귀속 변경 = 실적 귀속 / 전략수주 = 승인 기록.
   본인이 올린 요청은 다른 승인자가 처리한다. 반려는 아무것도 바꾸지 않는다. 계약실적 원장의 실적 귀속 방식은 그대로(계약 당시 담당). */
test('approval apply: real dates, contract signing in one approval, split shares, incentive settlement — nothing before approval',async()=>{
 const db=new PGlite();
 const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222',V='44444444-4444-4444-8444-444444444444',AV='55555555-5555-4555-8555-555555555555',W='66666666-6666-4666-8666-666666666666',AW='77777777-7777-4777-8777-777777777777';
 const X='88888888-8888-4888-8888-888888888881',AX='88888888-8888-4888-8888-888888888882',Y='99999999-9999-4999-8999-999999999991',AY='99999999-9999-4999-8999-999999999992';
 const D1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',D2='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',D3='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',D4='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
 const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
 try{
  await db.exec(fixture);
  await db.exec(`alter table public.deals add column if not exists owner_id uuid, add column if not exists assignee_name text, add column if not exists site_id uuid, add column if not exists brand text, add column if not exists origin_business text, add column if not exists work_summary text, add column if not exists list_fields jsonb default '{}'::jsonb, add column if not exists stage_contexts jsonb default '{}'::jsonb;
   create table if not exists public.sites(site_id uuid primary key,site_name text);create table if not exists public.organizations(id uuid primary key,name text);
   create table if not exists public.advisory_deals(advisory_id uuid default gen_random_uuid() primary key,site_id uuid,site_name text not null,work_name text,work_type text,contractor text,owner_name text,owner_kind text default '미지정',bid_amount bigint,lrc bigint,exec_amount bigint,pour_amount bigint,advisory_fee bigint,settled bigint,contract_date date,start_date date,end_date date,status text not null default '진행중',origin_channel text,source_sheet text,source_row integer,raw jsonb default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
   create unique index if not exists uq_adv_src on public.advisory_deals(source_sheet,source_row);
   create table if not exists crm_security.advisory_attribution(advisory_id uuid primary key,decision text not null,origin_business text,source_deal_id uuid,performance_owner text,bid_amount bigint,bid_confirmed_at date);`);
  await db.exec(ledger);/* 계약실적 원장(운영에 있는 그대로) */
  await db.exec(store);await db.exec(rules);await db.exec(settle);await db.exec(owner);await db.exec(transfer);await db.exec(win);
  await db.exec(approval);
  for(const s of [settle,owner,transfer,win,approval])await db.exec(s);/* 두 번 실행해도 안전 */
  /* 운영과 같게: 예외 승인자(이승우 · 황윤선)는 서버 권한이 admin(dual) */
  await db.query("insert into public.users values($1,$2,'송보람','admin',true),($3,$4,'이필선','rep',true),($5,$6,'정정훈','rep',true),($7,$8,'이승우','dual',true),($9,$10,'황윤선','dual',true)",[U,AU,V,AV,W,AW,X,AX,Y,AY]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day'),($3,$4,'rep','rep',true,now()+interval '1 day'),($5,$6,'rep','rep',true,now()+interval '1 day'),($7,$8,'admin','dual',true,now()+interval '1 day'),($9,$10,'admin','dual',true,now()+interval '1 day')",[U,AU,V,AV,W,AW,X,AX,Y,AY]);
  await db.query("insert into public.deals(id,owner_id,assignee_name,brand,list_fields) values($1,$2,'이필선','석민이앤씨','{\"site_name\":\"조치원자이\"}'),($3,$4,'정정훈','POUR솔루션','{\"site_name\":\"한빛\"}'),($5,$4,'정정훈','석민이앤씨','{\"site_name\":\"동탄푸른마을\"}'),($6,$7,'황윤선','석민이앤씨','{\"site_name\":\"풍림1차\"}')",[D1,V,D2,W,D3,D4,Y]);
  const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
  const call=async(fn,p)=>(await db.query('select public.'+fn+'($1::jsonb) result',[JSON.stringify(p||{})])).rows[0].result;
  const count=async t=>{await db.exec('reset role');return Number((await db.query('select count(*) n from '+t)).rows[0].n);};
  /* 내부 반영 함수 · 정산 표는 직접 못 쓴다 */
  await as(AV);
  await assert.rejects(db.query("select crm_security.deal_transfer_apply($1,'코지건설',1000,'x',current_date,current_date,$2,'이필선',$2,'이필선')",[D1,V]),/permission denied/);
  await assert.rejects(db.query("select crm_security.deal_win_apply($1,'won_own',1000,current_date,current_date,1000,'x',$2,'이필선')",[D1,V]),/permission denied/);
  await assert.rejects(db.query("select crm_security.settlement_add('incentive',$1,1,'이필선',null,1000,'2026-11','{}'::jsonb,$2,'이필선')",[D1,V]),/permission denied/);
  await assert.rejects(db.exec('select * from public.crm_settlement_items'),/permission denied/);
  /* 1. 타사 이관 실적: 이관일 · 낙찰일은 실제 날(오늘까지 · 낙찰일 ≥ 이관일) → 승인되면 그 날짜 그대로 실적 인정 */
  const tf={type:'transfer',deal_id:D1,title:'[세종] 조치원자이 코지건설 380,000,000원 (VAT 별도)',reason:'사전 보고 10.2 · 낙찰공고 첨부',payload:{company:'코지건설',amount:'380000000',transfer_date:day(-20),award_date:day(-3),evidence:{attachment_id:'att-1',file_name:'낙찰공고.pdf'}}};
  await assert.rejects(call('crm_approval_request_v1',{...tf,type:'xx'}),/요청 종류/);
  await assert.rejects(call('crm_approval_request_v1',{...tf,payload:{...tf.payload,company:''}}),/이관 업체와 낙찰금액/);
  await assert.rejects(call('crm_approval_request_v1',{...tf,payload:{...tf.payload,amount:'3.8억'}}),/이관 업체와 낙찰금액/);
  await assert.rejects(call('crm_approval_request_v1',{...tf,payload:{company:'코지건설',amount:'380000000'}}),/이관일 · 낙찰일/,'날짜 없이 올릴 수 없다(승인일로 대신하지 않는다)');
  await assert.rejects(call('crm_approval_request_v1',{...tf,payload:{...tf.payload,award_date:day(2)}}),/이관일 · 낙찰일/,'앞날은 안 된다');
  await assert.rejects(call('crm_approval_request_v1',{...tf,payload:{...tf.payload,award_date:day(-25)}}),/이관일 · 낙찰일/,'낙찰일은 이관일보다 앞설 수 없다');
  const r1=(await call('crm_approval_request_v1',tf)).request;
  assert.equal(await count('public.crm_deal_transfers'),0,'승인 전에는 실적을 만들지 않는다');
  await as(AX);
  const a1=await call('crm_approval_decide_v1',{id:r1.id,decision:'approve'});
  assert.deepEqual([a1.applied.award_result,a1.applied.award_company,Number(a1.applied.award_amount),a1.applied.incentive_eligible,a1.applied.approved_by_name,a1.applied.performance_owner,String(a1.applied.transfer_date).slice(0,10),String(a1.applied.award_date).slice(0,10)],['transferred_won','코지건설',380000000,true,'이승우','이필선',day(-20),day(-3)],'실적은 요청에 적힌 낙찰일 기준 — 승인한 날이 아니다');
  /* 이미 등록된 타사 이관(낙찰결과 전)에 올리면 이관 정보 · 귀속은 그대로, 낙찰결과 + 인정만 채운다 · 이미 인정된 건은 승인도 되돌린다 */
  await as(AW);
  await call('crm_deal_transfer_register_v1',{deal_id:D2,company:'한빛건설',reason:'영업권 조율',date:day(-30),reported:true,reported_at:day(-31)});
  const r2=(await call('crm_approval_request_v1',{...tf,deal_id:D2,title:'D2 한빛건설',payload:{company:'한빛건설',amount:'210000000',transfer_date:day(-30),award_date:day(-5)}})).request;
  await as(AY);const a2=await call('crm_approval_decide_v1',{id:r2.id,decision:'approve'});
  assert.deepEqual([a2.applied.transfer_reason,String(a2.applied.transfer_date).slice(0,10),String(a2.applied.award_date).slice(0,10),Number(a2.applied.award_amount),a2.applied.approved_by_name,a2.applied.performance_owner],['영업권 조율',day(-30),day(-5),210000000,'황윤선','정정훈']);
  await as(AW);const r2b=(await call('crm_approval_request_v1',{...tf,deal_id:D2,title:'D2 다시',payload:{company:'한빛건설',amount:'999',transfer_date:day(-30),award_date:day(-5)}})).request;
  await as(AX);await assert.rejects(call('crm_approval_decide_v1',{id:r2b.id,decision:'approve'}),/이미 실적이 인정된 타사 이관/);
  assert.equal((await call('crm_approval_list_v1')).rows.find(r=>r.id===r2b.id).status,'pending','반영에 실패하면 승인도 되돌린다');
  /* 2. 결과 수정(직접 수주): 낙찰일 · 낙찰금액 · 계약일 · 계약금액 → 승인 한 번에 수주 결과 + 계약 체결(계약실적 원장) */
  await as(AW);
  const rf={type:'result_fix',deal_id:D3,title:'[경기 화성] 동탄 실주 → 수주 · 직접',reason:'재입찰로 낙찰 · 낙찰공고 첨부',payload:{to_result:'won_own',amount:'180000000',award_date:day(-10),contract_date:day(-4),contract_amount:'180000000'}};
  await assert.rejects(call('crm_approval_request_v1',{...rf,payload:{to_result:'won'}}),/바꿀 결과/);
  await assert.rejects(call('crm_approval_request_v1',{...rf,payload:{...rf.payload,amount:''}}),/낙찰금액/);
  await assert.rejects(call('crm_approval_request_v1',{...rf,payload:{...rf.payload,award_date:day(3)}}),/낙찰일/);
  await assert.rejects(call('crm_approval_request_v1',{...rf,payload:{to_result:'won_own',amount:'180000000',award_date:day(-10)}}),/계약일\(오늘까지\) · 계약금액/,'직접 수주는 계약일 · 계약금액 필수');
  const r3=(await call('crm_approval_request_v1',rf)).request;
  assert.equal(await count('public.crm_deal_wins'),0);assert.equal(await count('crm_security.contract_sales'),0,'승인 전에는 결과 · 계약을 만들지 않는다');
  await as(AX);
  const a3=await call('crm_approval_decide_v1',{id:r3.id,decision:'approve'});
  assert.deepEqual([a3.applied.win_status,a3.applied.won_type,Number(a3.applied.award_amount),String(a3.applied.award_date).slice(0,10),a3.applied.award_company,a3.applied.performance_owner,a3.applied.contract],['confirmed','own',180000000,day(-10),'석민이앤씨','정정훈','signed']);
  await db.exec('reset role');
  const led=(await db.query('select h.balance,h.sales_owner_name,e.kind,e.effective_date::text d,e.amount_delta,e.reason from crm_security.contract_sales h join crm_security.contract_sales_events e on e.deal_id=h.deal_id where h.deal_id=$1',[D3])).rows;
  assert.equal(led.length,1);assert.deepEqual([Number(led[0].balance),led[0].sales_owner_name,led[0].kind,led[0].d,Number(led[0].amount_delta)],[180000000,'정정훈','signed',day(-4),180000000],'계약 체결일 = 요청에 적힌 계약일 · 실적 귀속 = 계약 당시 담당(원장 방식 그대로)');
  assert.match(led[0].reason,/예외 승인\(결과 수정\) · 재입찰로 낙찰 · 낙찰공고 첨부 · 승인 이승우/);
  /* 이미 계약이 있는 영업건의 결과 수정은 원장을 다시 건드리지 않는다 · 협약시공사 수주는 계약 없이 낙찰일 · 금액만 · 수주 → 실주 = 확정 취소 */
  await as(AW);const r3b=(await call('crm_approval_request_v1',{...rf,title:'금액 정정',payload:{...rf.payload,amount:'200000000',award_date:day(-9)}})).request;
  await as(AX);const a3b=await call('crm_approval_decide_v1',{id:r3b.id,decision:'approve'});
  assert.deepEqual([Number(a3b.applied.award_amount),String(a3b.applied.award_date).slice(0,10),a3b.applied.contract],[200000000,day(-9),'already_signed']);assert.equal(await count('crm_security.contract_sales_events'),1);
  await as(AW);const r3c=(await call('crm_approval_request_v1',{...rf,title:'협약시공사로 정정',payload:{to_result:'won_partner_tech',amount:'200000000',award_date:day(-9)}})).request;
  await as(AX);assert.deepEqual((a=>[a.won_type,a.contract])((await call('crm_approval_decide_v1',{id:r3c.id,decision:'approve'})).applied),['partner_tech',null]);
  await as(AW);const r3d=(await call('crm_approval_request_v1',{...rf,title:'수주 → 실주',payload:{to_result:'lost'}})).request;
  await as(AX);assert.equal((await call('crm_approval_decide_v1',{id:r3d.id,decision:'approve'})).applied.win_status,'cancelled');
  /* 3. 중복 리드 정산: 실적 나눔(계정 이름 + 비율, 합 100) → 승인되면 귀속을 비율로 나누고 정산 내역에 사람별 한 줄 */
  await as(AW);
  const dl={type:'dup_lead',deal_id:D1,title:'[세종] 조치원자이 이필선 · 정정훈 동시 접촉',reason:'두 사람이 같은 현장을 동시에 접촉',payload:{shares:[{name:'이필선',ratio:60},{name:'정정훈',ratio:40}],target:'이 영업건 수주실적 (낙찰금액)'}};
  await assert.rejects(call('crm_approval_request_v1',{...dl,payload:{shares:[{name:'이필선',ratio:60},{name:'정정훈',ratio:30}]}}),/합이 100%/);
  await assert.rejects(call('crm_approval_request_v1',{...dl,payload:{shares:[{name:'이필선',ratio:60},{name:'없는사람',ratio:40}]}}),/합이 100%/);
  await assert.rejects(call('crm_approval_request_v1',{...dl,payload:{shares:[{name:'이필선',ratio:100}]}}),/합이 100%/);
  const r4=(await call('crm_approval_request_v1',dl)).request;
  assert.deepEqual((await call('crm_deal_owner_list_v1')).rows,[],'승인 전에는 귀속을 바꾸지 않는다');
  await as(AX);const a4=await call('crm_approval_decide_v1',{id:r4.id,decision:'approve'});
  assert.equal(a4.owner.performance_owner,'이필선','한 사람만 적는 칸에는 비율이 가장 큰 사람');assert.deepEqual(a4.owner.shares,[{name:'이필선',ratio:60},{name:'정정훈',ratio:40}]);
  const s1=(await call('crm_settlement_list_v1',{deal_id:D1})).rows;
  assert.deepEqual(s1.map(r=>[r.kind,r.person,Number(r.ratio),Number(r.amount),r.approved_by_name]).sort(),[['split','이필선',60,228000000,'이승우'],['split','정정훈',40,152000000,'이승우']],'나눠 잡은 금액 = 그때 확정돼 있던 수주실적(인정된 타사 이관 3.8억) × 비율');
  assert.deepEqual((await call('crm_deal_owner_list_v1',{deal_id:D1})).events.slice(-1).map(e=>[e.action,e.to_owner,e.attribution,e.actor_name]),[['attribution_change','이필선 60% · 정정훈 40%','split','이승우']]);
  /* 4. 특별 인센티브: 대상자 · 방식(금액 또는 비율) · 지급 월 → 승인되면 정산 내역에 별도 항목 */
  await as(AW);
  const si={type:'special_incentive',deal_id:D3,title:'[경기 화성] 동탄 정정훈 수주실적의 +1%',reason:'고난도 재입찰 수주',payload:{target:'정정훈',mode:'ratio',value:'1',base:'180000000',amount:'1800000',pay_month:'2026-11'}};
  await assert.rejects(call('crm_approval_request_v1',{...si,payload:{...si.payload,target:'없는사람'}}),/대상자 · 방식/);
  await assert.rejects(call('crm_approval_request_v1',{...si,payload:{...si.payload,mode:'bonus'}}),/대상자 · 방식/);
  await assert.rejects(call('crm_approval_request_v1',{...si,payload:{...si.payload,pay_month:'2026.11'}}),/대상자 · 방식/);
  const r5=(await call('crm_approval_request_v1',si)).request;
  await as(AX);const a5=await call('crm_approval_decide_v1',{id:r5.id,decision:'approve'});
  assert.deepEqual([a5.applied.kind,a5.applied.person,Number(a5.applied.ratio),Number(a5.applied.amount),a5.applied.pay_month,a5.applied.approved_by_name],['incentive','정정훈',1,1800000,'2026-11','이승우']);
  await as(AW);assert.deepEqual((await call('crm_settlement_list_v1')).rows.map(r=>r.kind+':'+r.person).sort(),['incentive:정정훈','split:정정훈'],'영업사원은 자기 항목만 본다');
  await as(AU);assert.equal((await call('crm_settlement_list_v1')).rows.length,3,'관리자 · 승인자는 전부');
  /* 5. 전략수주: 승인 기록이 곧 반영 · 반려는 아무것도 바꾸지 않는다 · 본인이 올린 요청은 다른 승인자가(유지) */
  await as(AW);
  const r6=(await call('crm_approval_request_v1',{type:'strategic_win',deal_id:D3,title:'[대전] 싸이언스빌 할인 7%',reason:'레퍼런스 가치',payload:{fields:[]}})).request;
  const r7=(await call('crm_approval_request_v1',{...tf,deal_id:D3,title:'D3 타사 이관',payload:{company:'코지건설',amount:'100000000',transfer_date:day(-8),award_date:day(-2)}})).request;
  await as(AX);
  const a6=await call('crm_approval_decide_v1',{id:r6.id,decision:'approve'});assert.equal(a6.applied,null);assert.equal(a6.owner,null);
  assert.equal((await call('crm_approval_decide_v1',{id:r7.id,decision:'reject',reason:'사전 보고 없음'})).applied,null);
  assert.equal(await count('public.crm_deal_transfers'),2,'반려된 요청은 실적을 만들지 않는다');
  await as(AY);const r8=(await call('crm_approval_request_v1',{...tf,deal_id:D4,title:'D4',payload:{company:'코지건설',amount:'50000000',transfer_date:day(-8),award_date:day(-2)}})).request;
  await assert.rejects(call('crm_approval_decide_v1',{id:r8.id,decision:'approve'}),/본인이 올린 요청은 다른 승인자가/);
  await as(AX);assert.equal((await call('crm_approval_decide_v1',{id:r8.id,decision:'approve'})).applied.performance_owner,'황윤선');
  /* 영업건의 담당은 그대로 */
  await db.exec('reset role');
  assert.deepEqual((await db.query('select id::text,owner_id::text,assignee_name from public.deals order by id')).rows.map(r=>[r.owner_id,r.assignee_name]),[[V,'이필선'],[W,'정정훈'],[W,'정정훈'],[Y,'황윤선']]);
 }finally{await db.close();}
});
