'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','crm.html'),'utf8');
const source=html.slice(html.indexOf('function unifiedTimeline(p,item){'),html.indexOf('var SRC_LABEL='));
function timeline(p={},item={},inquiries=[]){const c={inqOfDeal:()=>inquiries,parseJandi:()=>({fields:[]}),jandiTime:x=>x,bizHistOf:()=>[]};vm.runInNewContext(source,c);return JSON.parse(JSON.stringify(c.unifiedTimeline(p,item)));}
const at='2026-10-05T01:00:00Z';
test('중앙 이력은 영업건과 패치의 단계·담당자 변경을 모두 보존한다',()=>{
 const item={stageHistory:[{at,from:'sent',to:'contract',actor:'관리자',reason:'계약 체결'}],assignmentHistory:[{at,from:'이필선',to:'조민준',actor:'관리자',reason:'지사 이관'}]};
 const p={stageHistory:[{at:'2026-10-06T01:00:00Z',from:'contract',to:'construction'}],assignmentHistory:[]};
 const before=JSON.stringify({item,p}),rows=timeline(p,item);
 assert.equal(rows.filter(x=>x.ttl==='단계 전환').length,2);assert.ok(rows.some(x=>x.ttl==='담당자 변경'&&x.body==='이필선 → 조민준'&&x.result==='지사 이관'));
 assert.equal(JSON.stringify({item,p}),before);
});
test('연결된 견적문의의 서버 배정 이력도 현재 담당자로 덮어쓰지 않는다',()=>{
 const q={at,assignee:'조민준',assignment_history:[{id:'a1',changed_at:at,from_owner:'이필선',to_owner:'경남지사',actor_name:'관리자',reason:'이관'},{id:'a2',changed_at:'2026-10-06T01:00:00Z',from_owner:'경남지사',to_owner:'조민준',actor_name:'관리자'}]};
 const rows=timeline({}, {},[q]).filter(x=>x.ttl==='담당자 변경');assert.deepEqual(rows.map(x=>x.body),['경남지사 → 조민준','이필선 → 경남지사']);
});
test('같은 변경의 응대·원본·패치 사본은 한 번, 별개 변경은 모두 표시한다',()=>{
 const h={at,from:'이필선',to:'조민준',actor:'관리자',reason:'이관'};
 const item={assignmentHistory:[h],activities:[{id:'activity1',at,type:'담당자변경',actor:'관리자',note:'이필선 → 조민준',result:'이관'}]};
 const rows=timeline({assignmentHistory:[h,{...h,at:'2026-10-05T02:00:00Z'}]},item);
 assert.equal(rows.length,2);assert.equal(rows.filter(x=>x.at===at).length,1);
});
test('같은 분의 별도 배정과 다른 단계 사건을 합치지 않는다',()=>{
 const rows=timeline({}, {assignmentHistory:[{at,from:'A',to:'B'},{at:'2026-10-05T01:00:30Z',from:'A',to:'B'}],stageHistory:[{at,from:'sent',to:'contract'}]});
 assert.equal(rows.length,3);
});
function bubbles(rows){
 const src=fs.readFileSync(require('node:path').join(__dirname,'..','deal-detail-v2.js'),'utf8');
 const body=src.slice(src.indexOf(' const NAMES='),src.indexOf(' /* 2026-10-03 대표: 기록마다'));
 const c={root:{unifiedTimeline:()=>rows,currentPatch:()=>({}),STAGE_MASTER:{}}};vm.runInNewContext(body,c);return JSON.parse(JSON.stringify(c.bubbles({})));
}
test('가운데 렌더러도 서로 다른 사건 ID와 같은 분의 기록을 보존한다',()=>{
 const rows=timeline({}, {stageHistory:[{id:'s1',at,from:'sent',to:'contract',reason:'확인'},{id:'s2',at:'2026-10-05T01:00:30Z',from:'sent',to:'contract',reason:'확인'}],assignmentHistory:[{id:'o1',at,from:'A',to:'B'},{id:'o2',at:'2026-10-05T01:00:30Z',from:'A',to:'B'}]});
 assert.equal(bubbles(rows).length,4);assert.equal(bubbles(rows.concat(rows)).length,4);
});
test('정보가 없는 변경을 지어내지 않고 원래 연락 기록을 유지한다',()=>{
 const rows=timeline({}, {activities:[{id:'call',at,type:'전화',note:'고객 통화'}],assignmentHistory:[{},null,{from:'A',to:'B'}]});
 assert.equal(rows.length,1);assert.equal(rows[0].body,'고객 통화');
});
