const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
const start=src.indexOf('function inquiryDealRefs('),end=src.indexOf('function flowIndex(',start);
assert.ok(start>=0&&end>start);
const c={B:{deals:[]},inqKey:q=>q.id||''};vm.createContext(c);
vm.runInContext(src.slice(start,end),c);
vm.runInContext(src.split(/\r?\n/).find(x=>x.startsWith('function inquiryHasMadeDeal(')),c);
const q={id:'q1',site:'이전이름',site_id:'s1'};
const cases=[
 ['동명 다른 현장',q,[{id:'d1',site:q.site,site_id:'s2'}],false],
 ['동일 현장의 별개 영업',q,[{id:'d1',site_id:'s1'}],false],
 ['개명 후 명시적 연결',q,[{id:'d1',site:'새이름',origin_inquiry_id:'q1'}],true],
 ['문의의 직접 참조',{...q,opportunity_id:'d1'},[{id:'d1'}],true],
 ['조회되지 않은 참조',{...q,opportunity_id:'d1'},[],false],
 ['다중 역참조',q,[{id:'d1',origin_inquiry_id:'q1'},{id:'d2',origin_inquiry_id:'q1'}],false],
 ['충돌 참조',{...q,opportunity_id:'d1',deal_id:'d2'},[{id:'d1'},{id:'d2'}],false],
 ['정방향 역방향 충돌',{...q,opportunity_id:'d1'},[{id:'d1'},{id:'d2',origin_inquiry_id:'q1'}],false],
 ['빈 문의',null,[],false]
];
for(const [label,inquiry,deals,expected] of cases){c.B.deals=deals;assert.equal(c.inquiryHasMadeDeal(inquiry),expected,label);assert.equal(c.inquiryHasMadeDeal(inquiry),!!c.linkedDeal(inquiry),label+' 상세/집계 일치');}
console.log('9 linkage cases passed; no production writes');
