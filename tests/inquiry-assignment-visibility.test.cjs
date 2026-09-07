const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const crm=fs.readFileSync(require('node:path').join(__dirname,'..','crm.html'),'utf8');
const names=['inquiryRecordedOwner','inquirySalesOwner','inquiryRoutedOwner','inquiryAssigned'];
const source=names.map(name=>{
  const line=crm.split(/\r?\n/).find(row=>row.startsWith('function '+name+'('));
  assert.ok(line,'missing '+name);
  return line;
}).join('\n');
const profiles={
  '황윤선':{id:'name:황윤선',active:true,salesRep:true,role:'sales'},
  '조재연':{id:'name:조재연',active:true,salesRep:false,role:'consultation'},
  '한인규':{id:'name:한인규',active:false,salesRep:false,role:'inactive'},
  '경남지사':{id:'name:경남지사',active:true,salesRep:false,role:'branch_pool'}
};
const context={
  repN:value=>String(value||'').trim()||'미배정',
  repProfile:name=>profiles[name]||{id:'legacy:'+name,active:true,salesRep:false,role:'unknown'}
};
vm.createContext(context);
vm.runInContext(source,context);

test('현행 영업담당은 정상 배정으로 표시',()=>{
  const inquiry={assignee_name:'황윤선',assigned_to:'uuid-sales'};
  assert.equal(context.inquirySalesOwner(inquiry),'황윤선');
  assert.equal(context.inquiryRoutedOwner(inquiry),'황윤선');
  assert.equal(context.inquiryAssigned(inquiry),true);
});

test('과거 배정자는 현재 역할이 달라도 미배정으로 지우지 않음',()=>{
  for(const name of ['조재연','한인규']){
    const inquiry={assignee_name:name,assigned_to:'uuid-legacy'};
    assert.equal(context.inquirySalesOwner(inquiry),'');
    assert.equal(context.inquiryRecordedOwner(inquiry),name);
    assert.equal(context.inquiryRoutedOwner(inquiry),name);
    assert.equal(context.inquiryAssigned(inquiry),true);
  }
});

test('담당자 원본이 비어 있을 때만 실제 미배정',()=>{
  assert.equal(context.inquiryRecordedOwner({assignee_name:'',assigned_to:null}),'');
  assert.equal(context.inquiryAssigned({assignee_name:'',assigned_to:null}),false);
});

test('중복건 같은 미등록 표시는 담당자 배정으로 계산하지 않음',()=>{
  assert.equal(context.inquiryRecordedOwner({assignee_name:'중복건',assigned_to:null}),'');
  assert.equal(context.inquiryAssigned({assignee_name:'서비스운영팀',assigned_to:null}),false);
});

test('경남지사 Pool 배정도 계속 배정 상태로 유지',()=>{
  assert.equal(context.inquiryRoutedOwner({assignee_name:'경남지사'}),'경남지사');
  assert.equal(context.inquiryAssigned({assignee_name:'경남지사'}),true);
});
