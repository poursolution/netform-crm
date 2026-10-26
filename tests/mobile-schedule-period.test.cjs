const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../mobile-schedule-model.js');
const now='2026-10-26T12:00:00+09:00';
const root=(deals=[])=>({G:{user:{id:'synthetic-user'}},Phase1:{profile:{auth_uid:'synthetic-auth',user_id:'synthetic-user'}},myDeals:()=>deals});
const read=(selectedDay,at=now,deals=[])=>create(root(deals)).read({selectedDay,now:Date.parse(at)});

test('다음 주의 미확인 약속 설명은 선택 기간을 가리키고 0%로 바뀌지 않는다',()=>{
 const m=read('2026-11-02'),metric=m.metrics[2];
 assert.deepEqual([m.start,m.end,m.weekLabel],['2026-11-02','2026-11-08','다음 주']);
 assert.equal(m.metrics[0].label,'다음 주 연락');
 assert.equal(metric.state,'unknown');
 for(const field of ['value','numerator','denominator','percent'])assert.equal(metric[field],null);
 assert.equal(metric.reason,'선택한 주는 아직 지나지 않았습니다 (2026-11-02 ~ 2026-11-08)');
 assert.doesNotMatch(metric.reason,/이번 주/);
});

test('이번 주·지난주·두 주 전후 이름이 같은 주의 모든 날짜에서 일치한다',()=>{
 const cases=[['2026-10-19','지난주'],['2026-10-25','지난주'],['2026-10-26','이번 주'],['2026-11-01','이번 주'],['2026-11-02','다음 주'],['2026-11-08','다음 주'],['2026-11-09','2주 뒤'],['2026-10-12','2주 전']];
 for(const [selected,label] of cases){const m=read(selected);assert.equal(m.weekLabel,label,selected);assert.equal(m.metrics[0].label,label+' 연락',selected);assert(m.metrics[2].reason.includes(m.start+' ~ '+m.end));}
});

test('지난 주의 빈 일정은 미래 주 안내와 구분한다',()=>{
 const m=read('2026-10-19');
 assert.equal(m.metrics[2].state,'unknown');
 assert.equal(m.metrics[2].reason,'선택한 주의 지난 일정이 없습니다 (2026-10-19 ~ 2026-10-25)');
});

test('연도 경계를 넘어도 월요일부터 일요일의 선택 주를 유지한다',()=>{
 const current=read('2027-01-03','2026-12-30T12:00:00+09:00');
 assert.deepEqual([current.start,current.end,current.weekLabel],['2026-12-28','2027-01-03','이번 주']);
 const next=read('2027-01-04','2026-12-30T12:00:00+09:00');
 assert.deepEqual([next.start,next.end,next.weekLabel],['2027-01-04','2027-01-10','다음 주']);
});

test('한국시간 일요일 자정 전후에 주 이름만 올바르게 전환한다',()=>{
 const before=read('2026-10-26','2026-10-25T14:59:59Z');
 const after=read('2026-10-26','2026-10-25T15:00:00Z');
 assert.equal(before.today,'2026-10-25');assert.equal(before.weekLabel,'다음 주');
 assert.equal(after.today,'2026-10-26');assert.equal(after.weekLabel,'이번 주');
 assert.deepEqual([before.start,before.end],[after.start,after.end]);
});

test('기존 연락·계획·지난 일정의 분자·분모와 취소·미확인 제외 판정은 유지한다',()=>{
 const d={id:'deal-one',nm:'합성 현장',lastMeaningfulContactAt:'2026-10-22T09:00:00+09:00',nextAction:{id:'next',status:'open'},openNextActions:[
  {id:'done',due_on:'2026-10-20',status:'done',completed_at:'2026-10-20T09:00:00+09:00'},
  {id:'overdue',due_on:'2026-10-21',status:'open'},
  {id:'cancel',due_on:'2026-10-21',status:'cancelled'},
  {id:'unknown',due_on:'2026-10-22',status:'done'},
  {id:'outside',due_on:'2026-10-27',status:'open'}
 ]};
 const m=read('2026-10-22',now,[d,{id:'deal-two',nm:'합성 두 번째 현장',openNextActions:[]}]);
 assert.deepEqual(m.metrics.map(x=>[x.numerator,x.denominator,x.percent]),[[1,2,50],[1,2,50],[1,2,50]]);
 assert.equal(m.metrics[0].value,'1 / 2곳');assert.equal(m.metrics[2].value,'1 / 2');
 assert.equal(m.weekRows.length,3);assert.equal(m.coverage.unknownCompletionCount,1);
});

test('미래 날짜에 완료 기록이 있더라도 지난 일정 비율을 만들어 내지 않는다',()=>{
 const m=read('2026-11-02',now,[{id:'d',nm:'합성 현장',openNextActions:[{id:'future',due_on:'2026-11-02',status:'done',completed_at:'2026-10-26T09:00:00+09:00'}]}]);
 assert.equal(m.weekRows.length,1);assert.equal(m.metrics[2].state,'unknown');assert.equal(m.metrics[2].percent,null);
 assert.match(m.metrics[2].reason,/아직 지나지 않았습니다/);
});

test('조회 실패 시 선택 주 이름은 보존하고 측정값을 생성하지 않는다',()=>{
 const r=root();r.myDeals=()=>{throw Error('SYNTHETIC_READ_FAILURE');};
 const m=create(r).read({selectedDay:'2026-11-02',now:Date.parse(now)});
 assert.equal(m.ok,false);assert.equal(m.status,'read-error');assert.equal(m.weekLabel,'다음 주');assert.equal(m.metrics[0].label,'다음 주 연락');
 assert(m.metrics.every(x=>x.state==='unknown'&&x.percent===null));
});

test('잘못된 선택 날짜는 기존 오류 상태로 남는다',()=>{
 const m=read('2026-02-30');assert.equal(m.ok,false);assert.equal(m.error,'CALENDAR_DATE_INVALID');assert.deepEqual(m.days,[]);assert(m.metrics.every(x=>x.percent===null));
});
