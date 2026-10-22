'use strict';
/* 2026-10-22 모바일 v6 1단계: 오늘 요약 숫자 칸 · 영업건 상세 진행 바 + 단계 이력(mobile-v6.js) */
const {test}=require('node:test');
const assert=require('node:assert/strict');
globalThis.PipelineStages=require('../pipeline-stages.js');
require('../list-pager.js');/* globalThis.ListPager */
const V6=require('../mobile-v6.js');

test('요약: 기한 지남 · 내 담당 · 오늘 방문 3칸, 관리자만 미배정 칸', ()=>{
 assert.deepEqual(V6.summary({late:2,mine:33,visit:0,unassigned:null}).cells.map(c=>c.key),['late','mine','visit']);
 assert.deepEqual(V6.summary({late:2,mine:33,visit:0,unassigned:22}).cells.map(c=>c.key),['late','mine','visit','unassigned']);
});

test('요약: 0 은 숫자 대신 "아직 없음", 붉은 글자는 기한 지남이 있을 때만', ()=>{
 const html=V6.summaryHtml(V6.summary({late:0,mine:5,visit:0,unassigned:null}));
 assert.equal((html.match(/아직 없음/g)||[]).length,2);
 assert.ok(!/mv6-cell red/.test(html));
 assert.match(V6.summaryHtml(V6.summary({late:3,mine:5,visit:1})),/mv6-cell red" data-v6="late"><b>3<\/b>/);
});

test('요약: 내 담당 → 내 현장 탭, 오늘 방문 → 오늘 동선, 기한 지남 · 미배정은 누를 곳 없음', ()=>{
 const html=V6.summaryHtml(V6.summary({late:1,mine:2,visit:3,unassigned:4}));
 assert.match(html,/data-v6="mine" data-gs="tab" data-tab="mine" data-scope="open"/,'내 담당 = 진행 중만 여는 목록');
 assert.match(html,/data-v6="visit" data-mr="view" data-v="route"/);
 assert.ok(!/data-v6="late" data-/.test(html));
 assert.ok(!/data-v6="unassigned" data-/.test(html));
});

test('진행 바: CRM 진행상태 6칸, 지금 단계 앞은 done', ()=>{
 const m=V6.progress({code:'rapport',outcome:null,stage_history:[]});
 assert.deepEqual(m.steps.map(s=>s.label),['컨설팅','발송','관계','경쟁','계약','수주'],'바 아래는 짧은 이름');
 assert.deepEqual(m.steps.map(s=>s.full),['컨설팅 설계단계','자료 발송완료','관계관리','경쟁·임박·입찰','계약·시공','수주']);
 assert.deepEqual(m.steps.map(s=>s.state),['done','done','cur','','','']);
 assert.equal(m.current,'관계관리');
});

test('진행 바: 실주는 바 대신 실주 표시, 확장관리는 수주까지 채움', ()=>{
 const lost=V6.progress({code:'compete',outcome:'lost'});
 assert.equal(lost.lost,true);
 assert.match(V6.barHtml(lost),/실주로 끝난 영업건입니다/);
 assert.ok(!/mv6-bar/.test(V6.barHtml(lost)));
 assert.equal(V6.progress({code:'expansion'}).steps[5].state,'cur');
});

test('단계 이력: 최근 것 먼저 · 같은 날 다른 기록은 합치지 않음 · 누가 · 사유', ()=>{
 const m=V6.progress({code:'sent',stage_history:[
  {id:1,from:'first_contact',to:'consulting',actor:'김영업',reason:'첫 통화',at:'2026-10-01T01:00:00Z'},
  {id:2,from:'consulting',to:'sent',actor:'김영업',reason:'설계안 발송',at:'2026-10-05T05:30:00Z'},
  {id:3,from:'sent',to:'consulting',actor:'김영업',reason:'자료 보완(되돌림)',at:'2026-10-05T06:00:00Z'},
  {id:4,from:'consulting',to:'sent',actor:'김영업',reason:'보완본 재발송',at:'2026-10-05T07:00:00Z'}]});
 assert.deepEqual(m.rows.map(r=>r.label),['자료 발송완료','컨설팅 설계단계','자료 발송완료','컨설팅 설계단계'],'같은 날 되돌림 · 재진입은 각각');
 const html=V6.historyHtml(m);
 assert.match(html,/2026\.10\.05 14:30 · 김영업/);
 assert.match(html,/설계안 발송/);assert.match(html,/보완본 재발송/);
});

test('단계 이력: 같은 기록(같은 id 또는 같은 단계 · 같은 시각)만 한 번 — PC 사본과 서버 기록이 겹칠 때', ()=>{
 const m=V6.progress({code:'sent',stageHistory:[{id:7,to:'sent',at:'2026-10-05T05:30:00Z'}],stage_history:[{id:7,to:'sent',changed_at:'2026-10-05T05:30:00Z',actor_name:'김영업'},{to_stage:'consulting',changed_at:'2026-10-01T00:00:00Z'},{to_stage:'consulting',changed_at:'2026-10-01T00:00:00Z'}]});
 assert.equal(m.rows.length,2);
});

test('단계 이력: PC 모양(stageHistory) · 서버 모양(to_stage · changed_at · actor_name) 모두 읽는다', ()=>{
 const m=V6.progress({code:'sent',stageHistory:[{to:'sent',at:'2026-10-05',who:'',actor:'박팀장'}],stage_history:[{to_stage:'consulting',changed_at:'2026-10-01T00:00:00Z',actor_name:'김영업'}]});
 assert.deepEqual(m.rows.map(r=>r.who),['박팀장','김영업']);
});

test('단계 이력: 한 쪽 5건 · 나머지는 모바일에서 쪽 번호로(PC 로 넘기지 않음)', ()=>{
 const H=Array.from({length:7},(_,i)=>({to:i%2?'sent':'consulting',at:'2026-10-0'+(i+1)+'T00:00:00Z'}));
 const m=V6.progress({code:'sent',stage_history:H});
 assert.equal(m.rows.length,5);assert.equal(m.total,7);
 const html=V6.historyHtml(m);
 assert.ok(!/PC 상세/.test(html),'PC 로 보내는 안내 없음');
 assert.match(html,/<b>단계 이력<\/b><span>7건<\/span>/);
 assert.match(html,/data-v6h="page" data-page="2"/,'2쪽 버튼');
 const p2=V6.progress({code:'sent',stage_history:H},{page:2});
 assert.equal(p2.rows.length,2);assert.equal(p2.rows[1].at,'2026-10-01T00:00:00Z','2쪽 = 가장 오래된 기록까지');
});

test('단계 이력: 가벼운 첫 조회만 온 동안은 불러오는 중, 이력 없으면 진입일 한 줄 또는 없음 안내', ()=>{
 assert.match(V6.historyHtml(V6.progress({code:'sent',stage_history:[],mobile_today_partial:true})),/불러오는 중/);
 const since=V6.progress({code:'sent',stage_history:[],stage_entered_at:'2026-10-12T00:00:00Z'});
 assert.equal(since.rows.length,1);assert.match(V6.historyHtml(since),/자료 발송완료 진입/);
 assert.match(V6.historyHtml(V6.progress({code:'sent'})),/단계 변경 기록이 없습니다/);
});

test('진행 바 칸에는 지금 단계 이름을 다시 쓰지 않는다(진행상태 칩과 중복), 단계 이력은 따로', ()=>{
 const m=V6.progress({code:'compete',stage_history:[{to:'compete',at:'2026-10-18T00:00:00Z'}]});
 const bar=V6.barHtml(m);
 assert.ok(!/<header|단계 이력/.test(bar));assert.match(bar,/aria-current="step"><i><\/i><span>경쟁<\/span>/);
 assert.match(V6.historyHtml(m),/^<section class="mv6-hist"[^>]*><header><b>단계 이력<\/b>/);
});

test('이관일: 운영 시작(2026-10-01) 전 진입일은 PC 처럼 "이관 자료 · 실제 진입일 미확인"', ()=>{
 const html=V6.historyHtml(V6.progress({code:'rapport',stage_history:[],stage_entered_at:'2026-08-31T15:04:00Z'}));
 assert.match(html,/<li class="legacy"><b>관계관리<\/b><span>2026\.08\.31 \(이관일\)<\/span><small>이관 자료 · 실제 진입일 미확인<\/small>/);
 assert.ok(!/관계관리 진입/.test(html),'이관일을 진입일처럼 쓰지 않는다');
});

test('이관일: 운영 시작 전이라도 사람이 바꾼 기록은 그대로, 시스템 · 이관 기록만 이관 자료', ()=>{
 const m=V6.progress({code:'sent',stage_history:[{to:'sent',at:'2026-09-20T01:00:00Z',actor:'김영업',reason:'설계안 발송'},{to:'consulting',at:'2026-09-01T00:04:00Z',actor:'시스템 이관'}]});
 assert.deepEqual(m.rows.map(r=>r.legacy),[false,true]);
 const html=V6.historyHtml(m);
 assert.match(html,/<li><b>자료 발송완료<\/b><span>2026\.09\.20 10:00 · 김영업/);
 assert.match(html,/<li class="legacy"><b>컨설팅 설계단계<\/b><span>2026\.09\.01 \(이관일\)/);
});

test('이관일 기준은 OPS_RULES.liveFrom 이 있으면 그 값', ()=>{
 globalThis.OPS_RULES={liveFrom:'2026-08-01'};
 try{assert.equal(V6.progress({code:'rapport',stage_entered_at:'2026-08-31T15:04:00Z'}).rows[0].legacy,false);}finally{delete globalThis.OPS_RULES;}
});

test('글자는 그대로 넣지 않고 바꿔 넣는다(사유 · 이름)', ()=>{
 const html=V6.historyHtml(V6.progress({code:'sent',stage_history:[{to:'sent',at:'2026-10-05T00:00:00Z',actor:'<b>x</b>',reason:'"<img>'}]}));
 assert.ok(!/<img>|<b>x<\/b>/.test(html));
});
