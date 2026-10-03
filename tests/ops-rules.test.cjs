'use strict';
/* 운영 기준 한곳(ops-rules.js) — 기본값은 회의 기준서(rules.json)와 같고, 메이드율 · 결과 구분 · 놓침은 이 함수들만 쓴다.
   조건부 값만 바꿀 수 있고(범위 검사), 확정 값은 바꿀 수 없다. 서버 함수(sql/ops-rules-v1-20261004.sql)의 허용 목록 · 범위와 같아야 한다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),R=require('../ops-rules.js'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('기본값 = 회의 기준서',()=>{
 assert.equal(R.get('assign_minutes'),30);assert.equal(R.get('first_contact_hours'),2);assert.equal(R.get('inactive_days'),7);assert.equal(R.get('quote_followup_days'),7);
 assert.equal(R.get('unreachable_attempts'),3);assert.equal(R.get('unreachable_interval_days'),1);assert.equal(R.get('long_wait_contact_days'),60);assert.equal(R.get('transfer_result_check_days'),14);
 assert.deepEqual(R.reasons('bad_fit'),['수행 불가 공종','규모 부적합','시공 불가 지역','기타']);
 assert.deepEqual(R.reasons('lost'),['가격','관리소장 변경','타 공법 선호','경쟁사 관계','예산','공사 취소','기타']);
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
 assert.deepEqual(R.performance(5e8,3e8),{own:5e8,transfer:3e8,total:8e8,label:'수주실적'},'자사 · 타사 이관은 나눠 보여 주고 합산');
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
 assert.equal(R.lostReason('가격 열세'),'가격');assert.equal(R.lostReason('고객 예산 무산'),'예산');assert.equal(R.lostReason('관리소장 변경'),'관리소장 변경');assert.equal(R.lostReason('견적 후 후속 지연'),'견적 후 후속 지연','뜻이 다른 것은 적힌 그대로');assert.equal(R.lostReason(''),'사유 미기록');
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
 assert.match(read('brief-b.js'),/const madeOf=\(w,l,t\)=>root\.CRMRules\?root\.CRMRules\.madeRate\(w,t\|\|0,l\)/);
 ['brief-b.js','report-b.js','dash-b.js'].forEach(f=>assert.doesNotMatch(read(f),/pct\([^()]*\.count,[^()]*\.count\+[^()]*(loss|\.l\b)/,f+' — 메이드율을 따로 계산하지 않음'));
});
