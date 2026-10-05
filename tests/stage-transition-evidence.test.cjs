const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../stage-transition.js');
const deal=notes=>({id:'own',legacy_notes:notes.map((body,i)=>({id:String(i),body,occurred_at:'2025-02-14'}))});
test('과거 메모의 실제 발송 내용과 본문 날짜를 가져오며 가져온 날짜를 발송일로 사용하지 않는다',()=>{
 const r=S.evidence(deal(['25년 2월 3일 / 솔루션제안서, 견적서, 시방서 발송']),{},'sent');
 assert.deepEqual(r.fields.materials,['견적서','제안서']);assert.equal(r.fields.sent_date,'2025-02-03');assert.match(r.sources.sent_date.text,/25년/);assert.equal(r.fields.recipient,undefined);
 const unknown=S.evidence(deal(['2월 12일 제안서 발송완료']),{},'sent');assert.equal(unknown.fields.sent_date,undefined);assert.deepEqual(unknown.fields.materials,['제안서']);
});
test('실제 PT·입찰만 확인하고 예정·유도·미진행·타사 기록은 가져오지 않는다',()=>{
 for(const body of ['추후 프레젠테이션 유도 - 회장이 대표를 설득해서 PT진행유도','PT 진행 완료 예정','PT 미실시','PT 진행하지 않음','타사 PT 진행 완료','입찰 참여 완료 예정']){
  const r=S.evidence(deal([body]),{},'compete');assert.deepEqual(r.fields,{});assert.deepEqual(r.pending,[]);assert.deepEqual(r.review,[]);
 }
 const r=S.evidence(deal(['2025년 2월 12일 PT 진행 완료']),{},'compete');assert.equal(r.fields.competition_type,'PT');assert.equal(r.fields.meeting_date,'2025-02-12');
 const missing=S.evidence(deal(['PT 진행 완료','입찰 참여 완료']),{},'contract');assert.equal(missing.pending.length,2);assert.equal(missing.fields.bid_result,undefined);assert.equal(missing.review.length,2);
});
test('기존 저장값을 우선하고 충돌 날짜·다른 영업건·단계전환 기록은 자동 적용하지 않는다',()=>{
 const d=deal(['2025년 2월 3일 PT 진행 완료','2025년 2월 12일 PT 진행 완료']);
 d.activities=[{deal_id:'other',note:'2025년 2월 20일 PT 진행 완료'},{type:'단계전환',note:'2025년 2월 21일 PT 진행 완료'}];
 const before=JSON.stringify(d),r=S.evidence(d,{},'compete');assert.equal(r.fields.meeting_date,undefined);assert.ok(r.pending.some(x=>/서로 다른 기록/.test(x)));assert.equal(JSON.stringify(d),before);
 d.stage_contexts={compete:{fields:{competition_type:'경쟁견적',meeting_date:'2025-02-01'}}};
 const saved=S.evidence(d,{},'compete');assert.equal(saved.fields.competition_type,undefined);assert.equal(saved.fields.meeting_date,undefined);
});
test('기록은 읽기만 하며 계약실적·계약일·낙찰결과를 추정하지 않는다',()=>{
 const d=deal(['2025년 2월 12일 PT 진행 완료','입찰 참여 완료','계약금액 1억원 / 계약 완료']);
 const original=JSON.stringify(d),r=S.evidence(d,{},'contract');assert.deepEqual(r.fields,{});assert.equal(JSON.stringify(d),original);assert.ok(r.review.length);assert.equal(r.pending.length,1);
});
test('HTML 메모와 응대 활동은 안전한 텍스트로 읽고 명시된 입찰 항목만 가져온다',()=>{
 const d=deal(['<p>입찰 참여 완료</p><p>입찰 마감일: 2025-02-12</p><p>입찰 조건: 면허 보유</p>']);
 const r=S.evidence(d,{},'bidding');assert.equal(r.fields.bid_deadline,'2025-02-12');assert.equal(r.fields.bid_terms,'면허 보유');assert.doesNotMatch(r.sources.bid_terms.text,/<p>/);
});
