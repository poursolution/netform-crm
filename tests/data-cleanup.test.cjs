const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../data-cleanup.js');
const row=(id,extra={})=>({ref:{type:'deal',id},name:'검증용 한빛아파트',address:'수원시 테스트로 12',mobile:'',office:'0311112222',siteId:'',works:['옥상>금속기와'],brand:'POUR',at:'2026-09-01',...extra});

const crossBrand=()=>[
 row('a',{ref:{type:'inquiry',id:'a'},name:'[서울 강동] 검증스테이',address:'서울 강동구 검증로 54',mobile:'01011110001',brand:'POUR솔루션',works:['누수'],at:'2026-10-06T04:19:00Z',status:'배드핏',owner:'담당A'}),
 row('b',{ref:{type:'inquiry',id:'b'},name:'[서울] 검증스테이',address:'서울시 강동구 검증로 54',mobile:'01011110002',brand:'POUR공법',works:['지하누수'],at:'2026-10-06T05:10:00Z',status:'접수',owner:''})];
test('다른 브랜드·다른 전화·서울 주소 표기 차이는 문의 검토 후보로만 찾는다',()=>{
 const [a,b]=crossBrand(),before=JSON.stringify([a,b]),r=C.classify(a,b);
 assert.equal(r.type,'inquiry');assert.equal(r.action,'defer');
 assert.ok(r.reasons.includes('연락처 서로 다름'));assert.ok(r.reasons.includes('공사 범위 확인 필요'));
 assert.match(r.text,/상태는 자동으로 복사하지 않습니다/);assert.equal(JSON.stringify([a,b]),before);
 assert.equal(C.classify(b,a).key,r.key);
});
test('서울특별시 표기도 같은 주소 검토에 포함한다',()=>{
 const [a,b]=crossBrand();b.address='서울특별시 강동구 검증로 54';assert.equal(C.classify(a,b).type,'inquiry');
});
test('번호·동·호가 다른 주소는 교차 브랜드 문의 후보로 묶지 않는다',()=>{
 for(const address of ['서울시 강동구 검증로 55','서울시 강동구 검증로 5-4','서울시 강동구 검증로 54 101동','서울시 강동구 검증로 54 101호']){
  const [a,b]=crossBrand();b.address=address;const r=C.classify(a,b);assert.ok(!r||r.type!=='inquiry',address);
 }
});
test('하이픈 제거로 같아진 번지를 교차 브랜드 주소 일치로 쓰지 않는다',()=>{
 const [a,b]=crossBrand();a.address='서울시 강동구 검증동 54-1';b.address='서울시 강동구 검증동 541';assert.notEqual(C.classify(a,b)?.type,'inquiry');
});
test('주소 없거나 접수 시각 미확인·1일 초과이면 교차 브랜드 후보를 단정하지 않는다',()=>{
 for(const patch of [{address:''},{address:'서울시 강동구'},{at:''},{at:'2026-10-08T04:19:00Z'}]){
  const [a,b]=crossBrand();Object.assign(b,patch);assert.notEqual(C.classify(a,b)?.type,'inquiry');
 }
});
test('기존 현장 ID가 같아도 다른 브랜드 새 접수는 문의 검토를 생략하지 않는다',()=>{
 const [a,b]=crossBrand();a.siteId=b.siteId='site-one';b.address=a.address;assert.equal(C.classify(a,b).type,'inquiry');
});
test('새 비교 화면도 교차 브랜드 후보를 확실한 중복으로 표시하지 않는다',()=>{
 const window={},document={readyState:'loading',addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dup-v2.js'),'utf8'),{window,document});
 assert.equal(window.DupV2.judge(C.classify(...crossBrand())),'maybe');
});
test('같은 현장 다른 공종은 Deal 병합이 아닌 Site 연결',()=>assert.equal(C.classify(row('1'),row('2',{works:['재도장>외부']})).action,'site_link'));
test('ASQ와 POUR는 다른 영업기회로 보존',()=>assert.equal(C.classify(row('1'),row('2',{brand:'아파트스퀘어'})).action,'site_link'));
test('동일 공종 가까운 시기는 검토만',()=>assert.equal(C.classify(row('1'),row('2')).action,'deal_review'));
test('같은 번호 다른 현장은 사람 이동 검토',()=>assert.equal(C.classify(row('1',{mobile:'010-1234-5678'}),row('2',{name:'다른 단지',address:'창원시 테스트로 3',mobile:'01012345678'})).action,'contact_move'));
test('이름 동일 주소 다름은 별도 현장',()=>assert.equal(C.classify(row('1'),row('2',{address:'서울시 테스트로 5'})).action,'separate'));
test('상담담당과 영업담당 차이는 판단 근거 아님',()=>assert.equal(C.classify(row('1',{owner:'황윤선',consultant:'조재연'}),row('2',{owner:'김성민'})).action,'deal_review'));
test('빈 주소/전화번호로 같은 현장 판정하지 않음',()=>assert.equal(C.classify(row('1',{name:'가람',address:'',office:''}),row('2',{name:'새빛',address:'',office:''})),null));
test('이름만 비슷하면 보류 추천',()=>assert.equal(C.classify(row('1',{address:'',office:''}),row('2',{address:'',office:'',works:[]})).action,'defer'));
test('중복 문의는 1일 이내 + 확인 가능한 식별정보 필요',()=>{const a=row('1',{ref:{type:'inquiry',id:'i1'}}),b=row('2',{ref:{type:'inquiry',id:'i2'},at:'2026-09-02'});assert.equal(C.classify(a,b).action,'inquiry_merge');assert.notEqual(C.classify(a,{...b,at:'2026-09-05'}).action,'inquiry_merge')});
test('과거 수주와 올해 영업은 각각 유지',()=>assert.equal(C.classify(row('1',{at:'2024-09-01'}),row('2')).action,'site_link'));
test('같은 record ID 자기 자신 제외',()=>assert.equal(C.classify(row('1'),row('1')),null));
test('Site와 이미 귀속된 자식 Deal을 중복 후보로 만들지 않음',()=>assert.equal(C.classify(row('o1',{ref:{type:'organization',id:'o1'}}),row('d1',{siteId:'o1'})),null));
test('같은 Site ID에 이미 연결된 정상 복수 영업은 현장 연결 후보에서 제외',()=>assert.equal(C.classify(row('1',{siteId:'site-a'}),row('2',{siteId:'site-a',works:['재도장>외부']})),null));
test('같은 Site ID라도 동일 공종 30일 이내 Deal은 중복 검토 유지',()=>assert.equal(C.classify(row('1',{siteId:'site-a'}),row('2',{siteId:'site-a'})).action,'deal_review'));
test('문의 → 이미 전환된 Deal은 중복 아님',()=>assert.equal(C.classify(row('i1',{ref:{type:'inquiry',id:'i1'},linkedDealId:'d1'}),row('d1')),null));
test('후보 pair key는 순서와 무관',()=>assert.equal(C.pairKey(row('1'),row('2')),C.pairKey(row('2'),row('1'))));
test('미확인 날짜로 중복 Deal 확정 안 함',()=>assert.notEqual(C.classify(row('1',{at:''}),row('2',{at:''})).action,'deal_review'));
test('CRM inline JS / modules parse',()=>{const html=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');for(const s of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);new vm.Script(fs.readFileSync(path.join(__dirname,'../data-cleanup-ui.js'),'utf8'))});
test('미배포 cleanup 계약은 원시 오류 대신 검토 전용 UI로 전환',()=>{const ui=fs.readFileSync(path.join(__dirname,'../data-cleanup-ui.js'),'utf8');assert.match(ui,/PHASE1_RPC_DENIED/);assert.match(ui,/검토 전용/);assert.match(ui,/S\.readOnly/)});
test('SQL: 원본 삭제 없음, 인증/충돌검사/감사 기록 있음',()=>{const sql=fs.readFileSync(path.join(__dirname,'../sql/20260905_data_cleanup.sql'),'utf8');assert.doesNotMatch(sql,/delete\s+from\s+public\.(deals|inquiries|organizations|contacts)/i);assert.match(sql,/auth\.uid\(\)/);assert.match(sql,/fingerprint' is distinct from/);assert.match(sql,/crm_cleanup_audit/);assert.match(sql,/revoke all on function/)});
