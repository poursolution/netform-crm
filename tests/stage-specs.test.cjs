const test=require('node:test'),assert=require('node:assert/strict');
const specs=require('../stage-specs.js'),stages=require('../pipeline-stages.js');
const days=date=>Math.round((Date.parse(date)-Date.parse('2026-09-20'))/86400000);
const classify=(key,v,r={item:{}})=>specs.priority(key,r,v,days);
test('eight stage rules share metadata; only relationship and expansion are special',()=>{
 assert.deepEqual(specs.all.map(s=>s.key),stages.definitions.map(s=>s.key));
 assert.deepEqual(specs.all.filter(s=>s.specialWorkspace).map(s=>s.key),['relationship','expansion']);
 assert.equal(new Set(Object.values(stages.colors)).size,8);
 assert.ok(specs.all.every(s=>Object.isFrozen(s)&&s.primaryAction&&s.detailHighlights));
});
test('consulting prioritizes missing needs, overdue quote, unset quote, missing amount, scheduled',()=>{
 const fixtures=[{quoteDue:'2026-09-19'}, {needs:'옥상',quoteDue:'2026-09-19'}, {needs:'옥상'}, {needs:'옥상',quoteDue:'2026-09-22'}, {needs:'옥상',quoteDue:'2026-09-22',amount:100}];
 assert.deepEqual(fixtures.map(v=>classify('consulting',v)),[0,1,2,3,4]);
});
test('follow-up and decision queues classify time boundaries explicitly',()=>{
 assert.deepEqual(['2026-09-19','2026-09-20',null,'2026-09-21'].map(followup=>classify('sent',{followup})),[0,1,2,3]);
 assert.deepEqual(['2026-09-19','2026-09-20','2026-09-21','2026-09-23','2026-09-27','2026-10-01',null].map(decisionDate=>classify('competition',{decisionDate})),[0,1,2,3,4,5,6]);
});
test('result stages keep a result queue; no stage opens contract performance from an operational screen',()=>{
 assert.equal(specs.get('won').queueLayout,'result');assert.equal(specs.get('won').primaryAction.key,'contact');
 /* 2026-09-26 대표 '자꾸 계약실적이 나온다': 운영 화면(상세·파이프라인)에는 계약실적 버튼·실적 귀속 칸을 두지 않는다 */
 assert.ok(specs.all.every(s=>s.primaryAction.key!=='contract'));
 assert.ok(specs.all.every(s=>!s.detailHighlights.includes('salesOwner')&&!(s.queueFields||[]).includes('salesOwner')&&!s.detailHighlights.includes('contractState')));
 assert.doesNotMatch(Object.values(specs.labels).join(' '),/계약실적/);
 assert.equal(specs.get('lost').primaryAction.key,'review');
});
test('contract attribution reads the ledger instead of current assignment or stage',()=>{
 const row={item:{assignee:'변경담당자',stage_contexts:{contract:{fields:{contract_amount:1}}}},fields:{},amount:3};
 const ledger={sales_owner_name:'계약당시담당자',balance:300000000,contract_date:'2026-09-18'};
 const value=specs.values(row,ledger);assert.equal(value.salesOwner,'계약당시담당자');assert.equal(value.contractAmount,300000000);
 assert.equal(specs.values(row,null).salesOwner,'확정 원장 확인 필요');assert.doesNotMatch(specs.values(row,null).contractState,/확정$/);
});
test('stable sorting uses business priority before dates',()=>{
 const rows=[{row:{key:'future'},values:{followup:'2026-09-21'},priority:3},{row:{key:'unset'},values:{},priority:2},{row:{key:'overdue'},values:{followup:'2026-09-19'},priority:0}];
 assert.deepEqual(rows.slice().sort((a,b)=>specs.compare('sent',a,b)).map(x=>x.row.key),['overdue','unset','future']);
 assert.equal(rows[0].row.key,'future');
});
test('workspace layout follows work type, only follow-up keeps the inspector open',()=>{
 assert.deepEqual(['consulting','sent','competition','construction','won','lost'].map(k=>specs.get(k).workspaceType),['triage','followup','schedule','operations','result','result']);
 assert.deepEqual(specs.all.filter(s=>s.inspector==='persistent').map(s=>s.key),['sent']);
});
test('old missing fields stay in backlog, real deadlines and recent intake activate triage',()=>{
 const old={item:{created:'2025-01-01'},next:{}};
 const backlog=specs.triage(old,{},days);assert.equal(backlog.today,false);assert.equal(backlog.info,true);assert.equal(backlog.backlog,true);
 const overdue=specs.triage({...old,due:'2026-09-19'}, {},days);assert.equal(overdue.today,true);assert.equal(overdue.reason,'다음 업무 기한 초과');
 assert.equal(specs.triage(old,{quoteDue:'2026-09-23'},days).today,true);
 assert.equal(specs.triage(old,{quoteDue:'2026-09-24'},days).today,false);
 assert.equal(specs.triage({item:{created:'2026-09-13'}},{},days).new,true);
 assert.equal(specs.triage({item:{created:'2026-09-12'}},{},days).new,false);
 assert.equal(specs.triage({item:{created:'2026-09-21'}},{},days).new,false);
 assert.equal(specs.triage({...old,due:'2026-09-19',item:{relationship_hold_until:'2026-09-21'}},{},days).today,false);
});
