const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const crm=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
const source=crm.split(/\r?\n/).find(line=>line.startsWith('function inqCtlScopeActive('));
assert.ok(source,'missing inqCtlScopeActive');
const sidebarCount=crm.split(/\r?\n/).find(line=>line.includes('var un=operationalInquiries(B.inquiries)'));
assert.ok(sidebarCount,'missing inquiry sidebar badge update');

const storeStatuses=['POUR스토어 이관대기','POUR스토어 접수완료','자재 견적안내','자재 구매완료','미구매 종료'];
const closedStatuses=new Set(['수주','실주','배드핏','연락두절','종결','종료',...storeStatuses]);
const context={
  B:{inquiries:[]},
  INQ_STORE_STATUSES:storeStatuses,
  operationalInquiries:rows=>rows,
  inqCtlScope:rows=>rows,
  isClosedInq:q=>closedStatuses.has(q.status||'')
};
vm.createContext(context);
vm.runInContext(source,context);

test('종결된 중복 원본은 활성 문의와 미배정 후보에서 제외',()=>{
  context.B.inquiries=[
    {id:'duplicate',status:'종결',assignee_name:null},
    {id:'real-unassigned',status:'접수',assignee_name:null},
    {id:'assigned',status:'배정완료',assignee_name:'이필선'}
  ];
  assert.deepEqual(context.inqCtlScopeActive().map(row=>row.id),['real-unassigned','assigned']);
});

test('스토어 이관 상태는 종결 상태여도 전용 운영 탭 추적을 위해 유지',()=>{
  context.B.inquiries=[{id:'store',status:'POUR스토어 이관대기',assignee_name:null}];
  assert.deepEqual(context.inqCtlScopeActive().map(row=>row.id),['store']);
});

test('사이드 메뉴 미배정 배지도 종결 문의를 제외하고 공통 배정 판정을 사용',()=>{
  assert.match(sidebarCount,/!isClosedInq\(q\)&&!inquiryAssigned\(q\)/);
  assert.doesNotMatch(sidebarCount,/!q\.assignee/);
});
