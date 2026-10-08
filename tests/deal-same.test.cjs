const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../deal-same.js');
/* 영업건 상세 · 같은 정보 같은 판단(2026-10-08): 계약 정보 한 가지 근거 · 증빙 전 = 확인 필요 · 특이조건 · 진척 · 날짜 표기 */
const deal=(f,extra)=>Object.assign({id:'d1',stage_contexts:{contract:{fields:f}}},extra||{});
test('계약 정보: 입력됨 + 증빙 없음 = 확인 필요(없음이 아니다) · 증빙이 생기면 정상 · 비면 없음',()=>{
 const c=D.contract(deal({contract_date:'2026-01-26',contract_amount:1043900000}),null);
 assert.deepEqual([c.state,c.date,c.amount,c.proof],['check','2026-01-26',1043900000,false]);
 assert.equal(c.text,'계약 체결 · 2026.1.26 · 10.44억');assert.equal(c.sub,'계약 정보 입력됨 · 증빙 확인 필요');
 assert.equal(D.contract(deal({contract_date:'2026-01-26',contract_amount:1043900000,contract_document:'수령'}),null).state,'ok');
 assert.equal(D.contract(deal({contract_date:'2026-01-26',contract_amount:1043900000}),{contract_date:'2026-01-26',balance:1043900000}).state,'ok','확정 원장 = 증빙');
 assert.equal(D.contract(deal({}),null).state,'none');assert.equal(D.contract(deal({contract_date:'2026-01-26'}),null).state,'none','금액이 없으면 입력된 것이 아니다');
 assert.equal(D.contract(deal({contract_date:'2026-01-26',contract_amount:'1,043,900,000',contract_status:'체결 예정'}),null).text,'계약 예정 · 2026.1.26 · 10.44억');
});
test('계약 정보의 근거: 원장 > 계약 단계 칸 > 영업건 값 > 수주 확정(낙찰금액)',()=>{
 const w={win_status:'confirmed',award_amount:500000000,award_company:'코지건설'};
 assert.equal(D.contract({id:'x',contract_date:'2026-02-01',win:w},null).amount,500000000,'낙찰금액을 계약 금액으로 읽는다');
 assert.equal(D.contract({id:'x',contract_date:'2026-02-01',contract_amount:7e8,win:w},null).amount,7e8);
 assert.equal(D.contract({id:'x',contract_date:'2026-02-01',contract_amount:7e8},{balance:9e8,contract_date:'2026-02-02'}).amount,9e8);
 assert.equal(D.contract({id:'x',win:w},null).company,'코지건설');
});
test('특이조건: 비어 있으면 확인 필요 · 없음 / 있음(내용) 구분',()=>{
 assert.deepEqual(D.special(deal({})),{v:'확인 필요',text:'',set:false});
 assert.deepEqual(D.special(deal({special_terms:'없음'})),{v:'없음',text:'',set:true});
 assert.deepEqual(D.special(deal({special_terms:'확인 필요'})),{v:'확인 필요',text:'',set:true});
 assert.deepEqual(D.special(deal({special_terms:'하자보증 2년 구두 약속'})),{v:'있음',text:'하자보증 2년 구두 약속',set:true});
 assert.deepEqual(D.special(deal({special_terms:'있음 · 공기 단축'})),{v:'있음',text:'공기 단축',set:true});
});
test('진척: 단계 이동 · 낙찰 · 계약 체결도 진척 — 마지막 진척 날짜 · 내용(진척 없음 n일 아님)',()=>{
 const d={id:'p',stageHistory:[{to:'contract',at:'2026-10-03T14:20:00+09:00'}],win:{win_status:'confirmed',award_date:'2026-01-20',award_company:'코지건설',award_amount:1},stage_contexts:{contract:{fields:{contract_date:'2026-01-26',contract_amount:1043900000}}}};
 const P=D.lastProgress(d);assert.equal(P.last.date,'2026-10-03');assert.match(P.text,/^마지막 진척 10\.3 · /);
 assert.deepEqual(P.events.map(x=>x.kind),['stage','contract','win']);assert.doesNotMatch(P.text,/진척 없음/);
 assert.equal(D.lastProgress({id:'q'}).text,'진척 기록 없음');
});
test('이력 분류: 고객 접촉 / 내부 변경',()=>{
 assert.equal(D.histKind({type:'전화',note:'통화 연결'}),'customer');assert.equal(D.histKind({type:'방문',note:'현장 방문'}),'customer');
 assert.equal(D.histKind({type:'메모',note:'[내부] 계약 체결 기록'}),'internal');assert.equal(D.histKind({type:'기타',note:'[막힌 곳] 고객 | 대기'}),'internal');
 assert.equal(D.histKind({type:'단계 변경',note:'경쟁 → 계약'}),'internal');
});
test('날짜 · 금액 표기: 같은 사건 YYYY.M.D HH:MM(한국 시간) · 억 단위',()=>{
 assert.equal(D.stamp('2026-10-03T05:20:00Z'),'2026.10.3 14:20');assert.equal(D.stamp('2026-01-26'),'2026.1.26');
 assert.deepEqual([D.eok(1043900000,4),D.eok(433650000,4),D.eok(1120000000,2),D.eok(1043900000,2),D.eok(5e7,2)],['10.439억','4.3365억','11.2억','10.44억','5,000만']);
 assert.equal(D.md('2026-10-03'),'10.3');
});
