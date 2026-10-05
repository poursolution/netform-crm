'use strict';
/* 관계관리 관리 구분 자동 분류(2026-10-05 design_handoff_relationship README '분류 규칙')
   집중 = 견적 발송 후 0–30일 · 일반 = 31–120일 · 대기 = 공사 예정 시기 내년 이후 또는 120일 지남 · 견적 발송일 없음 = 분류하지 않음(데이터 확인 필요) */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../relationship-segment.js');
const TODAY='2026-10-05',ago=n=>new Date(Date.parse(TODAY+'T00:00:00Z')-n*864e5).toISOString().slice(0,10),opt={today:TODAY};
const C=x=>S.classify(Object.assign({hasNext:true,due:ago(-3)},x),opt),T=v=>S.pickTiming([].concat(v),TODAY);
test('견적 발송일이 없으면 분류하지 않는다 — 마지막 접촉 369일 전인 건이 집중관리로 잡히지 않는다',()=>{
 const c=C({contactDays:369});assert.equal(c.bucket,'nodata');assert.deepEqual(c.rs,['nosent']);assert.equal(c.over,false);
 assert.equal(c.d,'발송일 없음');assert.equal(c.ds,'마지막 접촉 369일 전');assert.deepEqual(c.btn,['발송일 입력','sent']);
 assert.equal(C({contactDays:null,timing:T('2026')}).bucket,'nodata','올해 공사 예정만으로는 분류하지 않는다');assert.equal(C({}).ds,'접촉 기록 없음');
});
test('집중관리 = 견적 후 0–30일 · 줄에는 그 건의 경과일(연락 없는 n일 / 견적 후 n일)',()=>{
 const a=C({sent:ago(10)}),b=C({sent:ago(5),contactDays:2}),c=C({sent:ago(23),contactDays:12});
 assert.deepEqual([a.bucket,a.silent,a.d,a.ds,a.over],['focus',10,'10일째','견적 후 10일',true]);assert.deepEqual(a.rs,['focus7']);assert.equal(a.issue,'10일 연락 없음');assert.deepEqual(a.btn,['후속 연락','activity']);assert.equal(a.level,1);
 assert.deepEqual([b.bucket,b.d,b.ds,b.over,b.level],['focus','2일째','견적 후 5일',false,-1]);assert.equal(b.issue,'정상 · 다음 연락 10/8');assert.deepEqual(b.btn,['열기','']);
 assert.deepEqual([c.d,c.ds],['12일째','견적 후 23일'],'줄마다 그 건의 값');
 assert.equal(C({sent:ago(30)}).bucket,'focus');assert.equal(C({sent:ago(31)}).bucket,'normal','31일째부터 일반관리');
 const j=C({sent:ago(28),contactDays:1});assert.deepEqual([j.judge,j.judgeLeft,j.issue,j.level],[true,2,'30일 판단 2일 남음',0]);assert.deepEqual(j.btn,['판단','stage']);assert.deepEqual(j.rs,['shift']);
 const m=C({sent:ago(6),contactDays:1,meet:{date:'2026-10-18',kind:'대표회의'}});assert.equal(m.issue,'대표회의 10/18 · 경쟁 · 입찰로 이동');assert.deepEqual(m.btn,['단계 이동','stage']);assert.equal(m.chips.meet,true);
 const n=C({sent:ago(3),contactDays:1,hasNext:false,due:''});assert.equal(n.issue,'다음 행동 · 날짜 없음');assert.deepEqual(n.rs,['nonext']);assert.equal(n.level,0);
});
test('일반관리 = 견적 후 31–120일 · 30일 넘게 접촉 없으면 기준 넘김 · 4개월 도달',()=>{
 const a=C({sent:ago(45),contactDays:40,timing:T('2026.12')}),b=C({sent:ago(60),contactDays:5,timing:T('2026.12')}),c=C({sent:ago(110),contactDays:3}),d=C({sent:ago(50)});
 assert.deepEqual([a.bucket,a.d,a.ds,a.over],['normal','40일 전','견적 후 2개월',true]);assert.equal(a.issue,'30일 넘게 접촉 없음');assert.deepEqual(a.btn,['자료 보내기','activity']);
 assert.deepEqual([b.over,b.level,b.issue],[false,-1,'정상 · 다음 연락 10/8']);
 assert.deepEqual([c.m4,c.ds,c.issue,c.level],[true,'견적 후 4개월','4개월 도달 · 대기관리로 이동 예정',0]);assert.deepEqual(c.btn,['시기 확인','activity']);assert.ok(c.rs.includes('shift'));
 assert.deepEqual([d.d,d.over,d.issue],['기록 없음',true,'30일 넘게 접촉 없음 · 공사 시기 미확인'],'접촉 기록이 없으면 등록일로 대신하지 않는다');assert.deepEqual(d.btn,['시기 확인','activity']);
 assert.equal(C({sent:ago(120)}).bucket,'normal');assert.equal(C({sent:ago(121)}).bucket,'wait','120일이 지나면 대기관리');
});
test('대기관리 = 공사 예정 시기 내년 이후(발송일 없어도) 또는 120일 지남 · 연락일 지남 · 3개월 안이면 집중 복귀 대상',()=>{
 const a=C({timing:T('2027'),due:'',hasNext:false,contactDays:10}),b=C({sent:ago(200),due:ago(29)}),c=C({sent:ago(200),timing:T('2026-12-01'),contactDays:5}),d=C({sent:ago(150),contactDays:70,due:'',hasNext:false}),e=C({sent:ago(10),timing:T('2027 상반기')});
 assert.deepEqual([a.bucket,a.d,a.ds,a.over],['wait','2027년','연락일 없음',false]);assert.equal(a.issue,'다음 행동 · 날짜 없음');
 assert.deepEqual([b.bucket,b.late,b.lateDays,b.ds,b.over,b.d],['wait',true,29,'연락일 29일 지남',true,'시기 미정']);assert.deepEqual(b.btn,['안부 연락','activity']);assert.deepEqual(b.rs,['long60']);
 assert.deepEqual([c.bucket,c.near,c.d,c.ds],['wait',true,'2026.12','3개월 안']);assert.equal(c.issue,'공사 시기 3개월 안 → 집중관리 복귀');assert.deepEqual(c.btn,['집중관리로','focus']);assert.ok(c.rs.includes('shift'));
 assert.deepEqual([d.late,d.ds],[true,'70일째 연락 없음'],'다음 연락일이 없으면 마지막 접촉 2개월로');
 assert.equal(e.bucket,'wait','공사 시기가 내년 이후면 집중관리를 건너뛴다');assert.equal(e.near,true);
 const m=C({sent:ago(200),due:ago(3),mgr:{date:'2026-09-20'}});assert.equal(m.issue,'2개월 연락일 지남 · 관리소장 변경 9/20');assert.deepEqual(m.btn,['관계 재확인','activity']);assert.equal(m.chips.mgr,true);
 const ok=C({timing:T('2027.3'),contactDays:20,due:'2026-10-08'});assert.deepEqual([ok.over,ok.level,ok.ds,ok.issue],[false,-1,'다음 연락 10/8','정상 · 약속 연락 10/8']);
 /* [집중관리로]를 누른 날부터 30일 집중관리 */
 const back=C({sent:ago(200),focusFrom:ago(4),timing:T('2026-12-01'),contactDays:1});assert.deepEqual([back.bucket,back.returned,back.ds],['focus',true,'집중 복귀 4일']);
 assert.equal(C({sent:ago(200),focusFrom:ago(31)}).bucket,'normal','복귀 뒤 30일이 지나면 다시 날짜대로');
});
test('공사 예정 시기 읽기: 연도 없는 글은 읽지 않는다 · 지난 시기는 다시 확인할 것',()=>{
 assert.deepEqual([T('2027.3').label,T('2027-03-01T00:00').label,T('2026년 12월').label,T('2027 상반기').label,T(['2027']).label],['2027.3','2027.3','2026.12','2027 상반기','2027년']);
 assert.equal(T('10월'),null);assert.equal(T('내년 봄'),null);assert.equal(T(''),null);
 assert.deepEqual([T('2024').past,T('2026').past,T('2027').nextYear,T('2026').nextYear],[true,false,true,false]);
 assert.equal(T('2027').near,false,'연도만 있으면 3개월 안으로 보지 않는다');assert.equal(T('2026').near,true,'올해가 3개월 안에 끝날 때만');assert.equal(S.pickTiming(['2026'],'2026-03-01').near,false);
 assert.equal(S.pickTiming(['2025-03-01','2026'],TODAY).label,'2026년','지난 날짜보다 아직 안 지난 기록을 쓴다');assert.equal(S.pickTiming(['2026','2027-03-01'],TODAY).label,'2027.3','월까지 적힌 기록이 우선');
 assert.equal(S.dateKey('2026-09-30T15:30:00Z'),'2026-10-01','한국 날짜');assert.equal(S.dateKey('2026-02-31'),'');assert.equal(S.dateKey('2026.9.3'),'2026-09-03');
});
test('화면 · KPI 연결: 관계관리 계산은 이 함수를 쓰고 등록일 · 단계 진입일을 발송일로 쓰지 않는다',()=>{
 const t=fs.readFileSync(path.join(__dirname,'..','pipeline-stage-b.js'),'utf8').replace(/\r\n/g,'\n'),a=t.indexOf(' function segInput(r){'),b=t.indexOf('\n }',a),fn=t.slice(a,b);assert.ok(a>0&&b>a);
 assert.doesNotMatch(fn,/sentC\.push\([^;]*(d\.created|stage_entered|stageEntered|stageAge)/,'발송일 후보에 영업건 등록일 · 단계 진입일 없음');assert.match(fn,/ctxVals\(cx,'sent_date'\)/);assert.match(fn,/lastAgo=ago\(r\.last\);\n  const contact=lastAgo!==null\?lastAgo:\(r\.contactDays==null\?null:r\.contactDays\);/,'마지막 접촉 = 접촉 기록만');assert.doesNotMatch(fn,/activityAge/,'활동 · 등록일을 접촉일로 쓰지 않는다');
 assert.match(t,/if\(SEG\(\)\)\{const sq=segRules\(\),c=SEG\(\)\.classify\(segInput\(r\),/);assert.match(t,/OVER:\['focus7','month30','long60'\]/,'기준 넘김 = 집중 7일+ · 일반 30일+ · 대기 연락일 지남');
 assert.match(t,/if\(key==='relationship'&&SEG\(\)&&root\.PipelineRelB&&root\.PipelineRelB\.enabled\(\)\)return root\.PipelineRelB\.html\(list,model\(key,list\)\);/);
 const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');assert.ok(html.indexOf('relationship-segment.js?v=')<html.indexOf('pipeline-stage-b.js?v=')&&html.indexOf('pipeline-stage-b.js?v=')<html.indexOf('pipeline-rel-b.js?v='),'읽는 순서');
});
