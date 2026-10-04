'use strict';
/* 운영 기준 한곳(ops-rules.js) — 기본값은 회의 기준서(rules.json)와 같고, 메이드율 · 결과 구분 · 놓침은 이 함수들만 쓴다.
   조건부 값만 바꿀 수 있고(범위 검사), 확정 값은 바꿀 수 없다. 서버 함수(sql/ops-rules-v1-20261004.sql)의 허용 목록 · 범위와 같아야 한다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),R=require('../ops-rules.js'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('기본값 = 회의 기준서',()=>{
 assert.equal(R.get('assign_minutes'),30);assert.equal(R.get('first_contact_hours'),2);assert.equal(R.get('inactive_days'),7);assert.equal(R.get('quote_followup_days'),7);
 assert.equal(R.get('unreachable_attempts'),3);assert.equal(R.get('unreachable_interval_days'),1);assert.equal(R.get('long_wait_contact_days'),60);assert.equal(R.get('transfer_result_check_days'),14);
 assert.deepEqual(R.reasons('bad_fit'),['수행 불가 공종','규모 부적합','시공 불가 지역','기타']);
 assert.deepEqual(R.reasons('lost'),['관계 · 관리소장 변경','관계 · 입대의 · 회장 영향','관계 · 경쟁업체 기존 관계','공법 · 타 공법 선호','공법 · 특허 조건 불리','공법 · 설계 변경','가격 · 가격 경쟁','가격 · 예산 부족','가격 · 실행가 문제','사업 · 공사 취소','사업 · 연기','사업 · 예산 미확정']);
 assert.deepEqual(R.reasons('transfer'),['영업권 조율','영업권 중복','안전 · 시공조건','파트너사 협업','시공역량 문제','기타']);
 assert.deepEqual(R.get('contact_channels'),['전화','카카오','문자','이메일','방문','기타']);
 assert.equal(R.get('content_followup'),false,'보류 항목은 꺼짐');
});
test('메이드율 = (자사 수주 + 승인 타사 이관) ÷ (자사 수주 + 승인 타사 이관 + 파이프라인 실주)',()=>{
 assert.equal(R.madeRate(62,0,58),51.7);assert.equal(R.madeRate(60,2,58),51.7,'타사 이관(승인)도 성공');assert.equal(R.madeRate(0,0,0),null,'종료 건이 없으면 계산하지 않음');assert.equal(R.madeRate(3,1,0),100);
});
test('결과 구분: 타사 이관은 단계가 아니라 상태값 · 승인된 것만 수주',()=>{
 const g=globalThis;g.outcomeOf=d=>d.o||'open';g.itemPatch=()=>({});
 try{
  assert.equal(R.dealResult({o:'won'}),'won_own');assert.equal(R.dealResult({o:'lost'}),'lost');assert.equal(R.dealResult({o:'nocontact'}),'lost');assert.equal(R.dealResult({o:'badfit'}),'bad_fit');assert.equal(R.dealResult({o:'open'}),'in_progress');
  const T=x=>Object.assign({transfer_status:'transferred',award_result:'pending',incentive_eligible:false},x);
  assert.equal(R.dealResult({o:'open',transfer:T({})}),'transfer_pending','낙찰결과 대기 = 계산 제외');
  assert.equal(R.dealResult({o:'open',transfer:T({award_result:'transferred_won',award_amount:3e8})}),'transfer_pending','인정 전에는 실적 아님');
  assert.equal(R.dealResult({o:'open',transfer:T({award_result:'transferred_won',award_amount:3e8,incentive_eligible:true})}),'won_transfer');
  assert.equal(R.dealResult({o:'open',transfer:T({award_result:'transferred_won',rejected_reason:'사전 보고 없음'})}),'transfer_pending','관리자 제외 = 실적 · 메이드율 제외');
  assert.equal(R.dealResult({o:'open',transfer:T({award_result:'lost'})}),'lost');
  assert.equal(R.dealResult({o:'open',transfer:T({award_result:'cancelled'})}),'transfer_pending');
  assert.equal(R.dealResult({o:'won',transfer:{transfer_status:'cancelled'}}),'won_own','거둔 이관은 없는 것으로');
  assert.deepEqual(R.transferOf({transfer:T({award_result:'transferred_won',incentive_eligible:true,award_amount:'380000000',transfer_company:'코지건설',performance_owner:'이필선'})}).status,'approved');
 }finally{delete g.outcomeOf;delete g.itemPatch;}
 assert.deepEqual(R.performance(5e8,3e8),{own:5e8,partner:0,transfer:3e8,total:8e8,label:'수주실적'},'직접 · 협약 · 타사 이관은 나눠 보여 주고 합산');
});
test('놓침 판정은 이 기준만',()=>{
 const now=Date.parse('2026-10-07T10:00:00+09:00'),ago=m=>now-m*6e4;
 assert.equal(R.miss.assign(ago(29),now),false);assert.equal(R.miss.assign(ago(31),now),true,'접수 후 30분');
 assert.equal(R.miss.firstContact(ago(119),now),false);assert.equal(R.miss.firstContact(ago(121),now),true,'배정 후 2시간');
 assert.equal(R.miss.inactive(ago(6*1440),now),false);assert.equal(R.miss.inactive(ago(7*1440),now),true,'7일 이상 기록 없음');assert.equal(R.miss.inactive('',now),true);
 assert.equal(R.miss.quoteFollowup(ago(8*1440),'',now),true,'견적 후 7일 안 후속 없음 = 지연');assert.equal(R.miss.quoteFollowup(ago(8*1440),ago(2*1440),now),false);
 assert.equal(R.miss.nextAction('후속 통화','2026-10-09'),false);assert.equal(R.miss.nextAction('후속 통화',''),true,'다음 행동 + 날짜 둘 다');
 assert.equal(R.miss.transferCheck(ago(13*1440),now),false);assert.equal(R.miss.transferCheck(ago(14*1440),now),true);
 assert.equal(R.carePhase(ago(20*1440),now),'focus');assert.equal(R.carePhase(ago(60*1440),now),'general');assert.equal(R.carePhase(ago(150*1440),now),'long_wait');
});
test('조건부 값만 바뀐다 · 범위 밖 · 확정 값은 무시',()=>{
 try{
  R.apply({assign_minutes:20,first_contact_hours:5,inactive_days:30,long_wait_contact_days:500,reasons_lost:['가격','기타','단가 인상'],nearby_map:false,unknown:1});
  assert.equal(R.get('assign_minutes'),20);assert.equal(R.get('first_contact_hours'),2,'확정 값은 설정으로 못 바꿈');assert.equal(R.get('inactive_days'),7);assert.equal(R.get('long_wait_contact_days'),60,'범위(30~180) 밖은 버림');
  assert.deepEqual(R.reasons('lost'),['가격','기타','단가 인상']);assert.equal(R.get('nearby_map'),false);
  assert.equal(R.miss.assign(Date.now()-25*6e4),true,'바뀐 기준이 판정에 바로 쓰임');
  assert.equal(R.clean('assign_minutes',15.5),undefined);assert.equal(R.clean('reasons_bad_fit',[]),undefined);assert.equal(R.clean('content_followup',true),undefined,'보류 항목은 켤 수 없음');
 }finally{R.apply({});}
 assert.equal(R.get('assign_minutes'),30);
});
test('예전 화면이 읽는 기준(OPS_RULES)에도 같은 값',()=>{
 const g=globalThis;g.OPS_RULES={responseSlaHours:9,contactWarnDays:99};
 try{R.apply({assign_minutes:40,long_wait_contact_days:90});assert.equal(g.OPS_RULES.inquiryAssignMinutes,40);assert.equal(g.OPS_RULES.towerFirstResponseHours,2);assert.equal(g.OPS_RULES.responseSlaHours,2);assert.equal(g.OPS_RULES.contactWarnDays,7);assert.equal(g.OPS_RULES.stallDays,7);assert.equal(g.OPS_RULES.inquiryFollowDays,7);assert.equal(g.OPS_RULES.waitContactDays,90);}
 finally{R.apply({});delete g.OPS_RULES;}
});
test('예전 실주 사유는 뜻이 같은 것만 지금 원인으로',()=>{
 assert.equal(R.lostReason('가격 열세'),'가격 · 가격 경쟁');assert.equal(R.lostReason('고객 예산 무산'),'가격 · 예산 부족');assert.equal(R.lostReason('관리소장 변경'),'관계 · 관리소장 변경');assert.equal(R.lostReason('경쟁사 관계'),'관계 · 경쟁업체 기존 관계');
 /* 실주 원인 4분류 */
 assert.deepEqual(R.lostGroups().map(g=>[g[0],g[1].map(s=>s.l)]),[['관계',['관리소장 변경','입대의 · 회장 영향','경쟁업체 기존 관계']],['공법',['타 공법 선호','특허 조건 불리','설계 변경']],['가격',['가격 경쟁','예산 부족','실행가 문제']],['사업',['공사 취소','연기','예산 미확정']]]);
 assert.equal(R.lostCategory('가격 열세'),'가격');assert.equal(R.lostCategory('사업 · 연기'),'사업');assert.equal(R.lostCategory('견적 후 후속 지연'),'기타','분류가 없는 예전 사유는 기타');assert.equal(R.lostReason('견적 후 후속 지연'),'견적 후 후속 지연','뜻이 다른 것은 적힌 그대로');assert.equal(R.lostReason(''),'사유 미기록');
});
test('서버 함수의 허용 목록 · 범위 = 화면 항목표',()=>{
 const sql=read('sql/ops-rules-v1-20261004.sql'),lim=JSON.parse(sql.match(/lim constant jsonb:='(\{[^']+\})'/)[1]);
 const nums=R.ROWS.filter(r=>r.st==='cond'&&r.type==='num');assert.deepEqual(Object.keys(lim).sort(),nums.map(r=>r.k).sort());nums.forEach(r=>assert.deepEqual(lim[r.k],[r.min,r.max],r.k));
 const arr=name=>sql.match(new RegExp(name+" constant text\\[\\]:=array\\[([^\\]]+)\\]"))[1].split(',').map(s=>s.trim().replace(/'/g,'')).sort();
 assert.deepEqual(arr('bools'),R.ROWS.filter(r=>r.st==='cond'&&r.type==='tg').map(r=>r.k).sort());
 assert.deepEqual(arr('lists'),R.ROWS.filter(r=>r.st==='cond'&&r.type==='chips').map(r=>r.k).sort());
 assert.match(sql,/관리자만 운영 기준을 바꿀 수 있습니다/);assert.match(sql,/insert into public\.crm_rule_history/);
 assert.match(read('pc-manager-transport.js'),/'crm_ops_rules_v1'/);
});
test('메이드율은 한 함수로: 주간 브리핑 · 리포트 · 대시보드',()=>{
 assert.match(read('brief-b.js'),/const madeOf=\(w,l,t,p\)=>root\.CRMRules\?root\.CRMRules\.madeRate\(w,t\|\|0,l,p\|\|0\)/);
 ['brief-b.js','report-b.js','dash-b.js'].forEach(f=>assert.doesNotMatch(read(f),/pct\([^()]*\.count,[^()]*\.count\+[^()]*(loss|\.l\b)/,f+' — 메이드율을 따로 계산하지 않음'));
});
test('수주 유형 3가지: 직접 / 협약시공사 · 기술자문 / 타사 이관 — 실적 = 낙찰금액, 연결 계약은 더하지 않는다',()=>{
 assert.deepEqual(Object.keys(R.WON_TYPES),['won_own','won_partner_tech','won_transfer']);assert.equal(R.WON_TYPES.won_partner_tech.label,'협약시공사 수주 · 기술자문');
 assert.deepEqual(Object.keys(R.DEAL_FIELDS),['sales_channel_brand','award_company','award_amount','tech_advisory_company','tech_advisory_amount','pour_contract_amount']);
 /* 메이드율: 협약시공사 수주도 성공 */
 assert.equal(R.madeRate(1,1,2,2),66.7);assert.equal(R.madeRate(1,0,1),50,'넷째 값이 없어도 예전 그대로');assert.equal(R.madeRate(0,0,0,0),null);
 /* 수주실적: 3가지를 나눠 합산. 기술자문 계약금액 · POUR 계약금액은 매출 쪽 숫자 */
 assert.deepEqual(R.performance(5,3,10),{own:5,partner:10,transfer:3,total:18,label:'수주실적'});assert.equal(R.performance(5,3).total,8);
 assert.equal(R.revenue('own',500),500);assert.equal(R.revenue('partner_tech',1043900000,433650000,136690000),570340000);assert.equal(R.revenue('transfer',380000000),0);
 const win={win_status:'confirmed',won_type:'partner_tech',award_company:'코지건설',award_amount:1043900000,award_date:'2026-10-01',sales_channel_brand:'석민이앤씨',performance_owner:'황윤선',tech_advisory:true,tech_advisory_company:'코지건설',tech_advisory_amount:433650000,pour_contract_amount:136690000,advisory_id:'a1'};
 const w=R.winOf({win});assert.deepEqual([w.type,w.company,w.amount,w.tech,w.techAmount,w.pourAmount,w.owner,w.brand],['partner_tech','코지건설',1043900000,true,433650000,136690000,'황윤선','석민이앤씨']);
 assert.equal(R.winOf({win:{...win,win_status:'cancelled'}}).type,'');assert.equal(R.winOf({}).type,'');assert.equal(R.winOf({win:{...win,tech_advisory:false}}).techAmount,0,'기술자문 발생 = 아니오면 연결 계약 없음');
 assert.equal(R.dealResult({win}),'won_partner_tech');assert.equal(R.dealResult({win:{...win,won_type:'own'}}),'won_own');
 assert.equal(R.dealResult({win,transfer:{transfer_status:'transferred',award_result:'transferred_won',incentive_eligible:true}}),'won_transfer','인정된 타사 이관이 먼저');
 const sql=read('sql/deal-win-type-v1-20261004.sql');assert.match(sql,/won_type in \('own','partner_tech'\)/);assert.match(sql,/insert into public\.advisory_deals/);assert.match(sql,/'crm:deal:'\|\|v_deal/);
 ['crm_deal_win_list_v1','crm_deal_win_register_v1'].forEach(n=>{assert.match(read('pc-manager-transport.js'),new RegExp("'"+n+"'"));assert.match(sql,new RegExp('function public\\.'+n));});
});
test('금액 5개는 더하지 않는다 · 영업 경로 5칸 · Health Score (3차 기준값도 한곳)',()=>{
 const win={win_status:'confirmed',won_type:'partner_tech',award_company:'코지건설',award_amount:1043900000,award_date:'2026-09-12',sales_channel_brand:'석민이앤씨',performance_owner:'황윤선',tech_advisory:true,tech_advisory_company:'코지건설',tech_advisory_amount:433650000,pour_contract_amount:136690000};
 const d={amount:1120000000,brand:'석민이앤씨',assignee:'정정훈',win};
 assert.deepEqual(R.amounts(d),{estimated:1120000000,award:1043900000,own_contract:136690000,tech_advisory:433650000,incentive:1043900000,revenue:570340000},'인센티브 실적 = 낙찰금액 고정 · 회사 매출 = 자사계약 + 기술자문');
 assert.deepEqual(R.amounts({amount:5e8,win:{...win,won_type:'own',award_amount:5e8,tech_advisory:false}},4.8e8),{estimated:5e8,award:5e8,own_contract:4.8e8,tech_advisory:0,incentive:5e8,revenue:4.8e8},'직접 수주의 자사계약 = 계약실적 원장');
 assert.equal(R.amounts({amount:3e8}).award,0);assert.equal(R.amounts({amount:3e8},3e8).incentive,3e8,'원장만 있는 예전 계약 = 직접 수주');
 assert.equal(R.amounts({transfer:{transfer_status:'transferred',award_result:'transferred_won',award_amount:3.8e8,incentive_eligible:false}}).incentive,0,'타사 이관은 인정 전에는 실적 아님');
 assert.deepEqual(R.salesPath(d),{inflow_brand:'석민이앤씨',first_sales_company:'석민이앤씨',sales_owner:'황윤선',award_company:'코지건설',tech_advisory_company:'코지건설'});
 assert.deepEqual(R.PHASE3.sales_path,['inflow_brand','first_sales_company','sales_owner','award_company','tech_advisory_company']);assert.deepEqual(Object.keys(R.PHASE3.amounts),['estimated','award','own_contract','tech_advisory','incentive']);
 assert.deepEqual(R.healthScore({}),{score:100,red:false});assert.deepEqual(R.healthScore({no_contract_info:true,quote_no_contact_7d:true,no_next_action:true}),{score:25,red:true});
 assert.equal(R.PHASE2.change_events.types.length,8);assert.equal(R.PHASE2.approval_types.length,6);assert.equal(R.PHASE2.promise_keeping.warn_below,0.8);assert.equal(R.PHASE3.stage_dwell_days.rel,60);
 const sql=read('sql/deal-win-path-v2-20261004.sql');['inflow_brand','first_sales_company','own_contract_amount','incentive_amount'].forEach(c=>assert.match(sql,new RegExp('add column if not exists '+c)));
});
test('4차 플레이북: 단계별 확인할 것 5개 · 선배 팁 문구도 한곳(운영하며 조정)',()=>{
 const P=R.PHASE4;assert.deepEqual(Object.keys(P.playbook),['inq','cons','sent','rel','bid','con','won']);Object.values(P.playbook).forEach(l=>assert.equal(l.length,5));
 assert.deepEqual(P.playbook.bid,['현설일','PT','경쟁 공법','의사결정자','예상 가격대']);assert.deepEqual(Object.keys(P.playbook_tips),['inq','cons','sent','rel','bid','con','won']);assert.deepEqual(P.followup_sequence_days,[3,7,14,30]);
});
