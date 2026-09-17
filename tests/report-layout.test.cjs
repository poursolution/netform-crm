const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
test('대표 보고 하단 리스크/의사결정 영역과 남은 참조 제거',()=>{
 assert.doesNotMatch(html,/id="ceo-risk"|핵심 리스크 & 대표 의사결정|\briskRows\b|\bdecisionRows\b/);
 assert.match(html,/이번 달 움직임 & 실주 분석/);
 assert.match(html,/핵심 리스크.*report-critical/);
 assert.match(html,/reportJump\(\\'report-due30\\'\)/);
});
test('요약 버튼이 현재 필터의 정확한 목록을 연다',()=>{
 const src=html.slice(html.indexOf('function reportJump('),html.indexOf('\nfunction ',html.indexOf('function reportJump(')+1));
 const deals=[{id:1,risk:true,critical:true,due:0,rank:7},{id:2,risk:true,critical:false,due:30,rank:10},{id:3,risk:true,critical:true,due:31,rank:9},{id:4,risk:false,critical:false,due:-1,rank:9},{id:5,risk:false,critical:false,due:2,rank:4}];
 let opened;const ctx={reportOpenDeals:()=>deals,briefIsRisk:d=>d.risk,reportCritical:d=>d.critical,briefNext:d=>({due:String(d.due)}),daysTo:Number,dealStage:d=>d.rank,perfStageRank:r=>r,openReportDrill:(title,sub,rows)=>{opened=rows},document:{getElementById:()=>null}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 ctx.reportJump('report-critical');assert.deepEqual(opened.map(d=>d.id),[1,3]);
 ctx.reportJump('report-due30');assert.deepEqual(opened.map(d=>d.id),[1,2]);
});
test('대표 리포트의 진행 Pipeline은 등록연도와 무관한 현재 snapshot을 사용한다',()=>{
 const fn=html.match(/function reportOpenDeals\(\)\{([^\n]+)\}/);
 assert.ok(fn,'reportOpenDeals must exist');
 assert.match(fn[1],/reportRawDeals\(\)\.filter\(towerActive\)/);
 assert.doesNotMatch(fn[1],/inPeriod|created/);
 assert.match(html,/현재 SNAPSHOT · 등록일 무관/);
});
