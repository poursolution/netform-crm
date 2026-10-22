'use strict';
/* 2026-10-22 모바일 v6 1단계: 오늘 요약 숫자 칸 · 영업건 상세 진행 바 + 단계 이력(mobile-v6.js) */
const {test}=require('node:test');
const assert=require('node:assert/strict');
globalThis.PipelineStages=require('../pipeline-stages.js');
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
 assert.match(html,/data-v6="mine" data-gs="tab" data-tab="mine"/);
 assert.match(html,/data-v6="visit" data-mr="view" data-v="route"/);
 assert.ok(!/data-v6="late" data-/.test(html));
 assert.ok(!/data-v6="unassigned" data-/.test(html));
});

test('진행 바: CRM 진행상태 6칸, 지금 단계 앞은 done', ()=>{
 const m=V6.progress({code:'rapport',outcome:null,stage_history:[]});
 assert.deepEqual(m.steps.map(s=>s.label),['컨설팅 설계단계','자료 발송완료','관계관리','경쟁·임박·입찰','계약·시공','수주']);
 assert.deepEqual(m.steps.map(s=>s.state),['done','done','cur','','','']);
 assert.equal(m.current,'관계관리');
});

test('진행 바: 실주는 바 대신 실주 표시, 확장관리는 수주까지 채움', ()=>{
 const lost=V6.progress({code:'compete',outcome:'lost'});
 assert.equal(lost.lost,true);
 assert.match(V6.progressHtml(lost),/실주로 끝난 영업건입니다/);
 assert.ok(!/mv6-bar/.test(V6.progressHtml(lost)));
 assert.equal(V6.progress({code:'expansion'}).steps[5].state,'cur');
});

test('단계 이력: 최근 것 먼저 · 같은 단계 같은 날은 한 번 · 누가 · 사유', ()=>{
 const m=V6.progress({code:'sent',stage_history:[
  {id:1,from:'first_contact',to:'consulting',actor:'김영업',reason:'첫 통화',at:'2026-10-01T01:00:00Z'},
  {id:2,from:'consulting',to:'sent',actor:'김영업',reason:'설계안 발송',at:'2026-10-05T05:30:00Z'},
  {id:3,from:'consulting',to:'sent',actor:'김영업',reason:'중복',at:'2026-10-05T06:00:00Z'}]});
 assert.deepEqual(m.rows.map(r=>r.label),['자료 발송완료','컨설팅 설계단계']);
 const html=V6.progressHtml(m);
 assert.match(html,/2026\.10\.05 14:30 · 김영업/);
 assert.match(html,/설계안 발송/);
});

test('단계 이력: PC 모양(stageHistory) · 서버 모양(to_stage · changed_at · actor_name) 모두 읽는다', ()=>{
 const m=V6.progress({code:'sent',stageHistory:[{to:'sent',at:'2026-10-05',who:'',actor:'박팀장'}],stage_history:[{to_stage:'consulting',changed_at:'2026-10-01T00:00:00Z',actor_name:'김영업'}]});
 assert.deepEqual(m.rows.map(r=>r.who),['박팀장','김영업']);
});

test('단계 이력: 5건까지, 나머지는 PC 안내 한 줄', ()=>{
 const H=Array.from({length:7},(_,i)=>({to:i%2?'sent':'consulting',at:'2026-10-0'+(i+1)+'T00:00:00Z'}));
 const m=V6.progress({code:'sent',stage_history:H});
 assert.equal(m.rows.length,5);assert.equal(m.older,2);
 assert.match(V6.progressHtml(m),/이전 2건은 PC 상세/);
});

test('단계 이력: 가벼운 첫 조회만 온 동안은 불러오는 중, 이력 없으면 진입일 한 줄 또는 없음 안내', ()=>{
 assert.match(V6.progressHtml(V6.progress({code:'sent',stage_history:[],mobile_today_partial:true})),/불러오는 중/);
 const since=V6.progress({code:'sent',stage_history:[],stage_entered_at:'2026-09-30T00:00:00Z'});
 assert.equal(since.rows.length,1);assert.match(V6.progressHtml(since),/자료 발송완료 진입/);
 assert.match(V6.progressHtml(V6.progress({code:'sent'})),/단계 변경 기록이 없습니다/);
});

test('글자는 그대로 넣지 않고 바꿔 넣는다(사유 · 이름)', ()=>{
 const html=V6.progressHtml(V6.progress({code:'sent',stage_history:[{to:'sent',at:'2026-10-05T00:00:00Z',actor:'<b>x</b>',reason:'"<img>'}]}));
 assert.ok(!/<img>|<b>x<\/b>/.test(html));
});
