const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const S=require('../message-salutation.js');
const site='평택비전지웰푸르지오아파트';
test('자동 호칭은 이름 대신 현장과 선택된 연락처 직함',()=>{
 for(const role of ['관리소장','입주자대표회장','시설과장'])assert.equal(S.greeting(site,{name:'백 승우',role}),site+' '+role+'님, 안녕하세요.\n\n');
});
test('현장·직함 누락 시 안전한 fallback',()=>{
 assert.equal(S.address(site,{name:'백 승우'}),site+' 관계자님');
 assert.equal(S.address('',{role:'입주자대표회장'}),'입주자대표회장님');
 assert.equal(S.address('현장명 미입력',{}),'관계자님');
 assert.equal(S.address(site,{role:'관리소장',messageRole:''}),site+' 관계자님');
});
test('중복 님과 불필요한 공백 제거, 원본 이름 보존',()=>{
 const c={name:'백 승우',role:' 시설과장님님 '};const before=JSON.stringify(c);
 assert.equal(S.address('  OO아파트 ',c),'OO아파트 시설과장님');assert.equal(JSON.stringify(c),before);
});
test('새 고객호칭과 과거 관리소장명 변수 호환, 직접 작성한 이름은 덮어쓰지 않는다',()=>{
 const c={name:'백 승우',role:'입주자대표회장'};
 for(const t of ['[고객호칭]','[고객호칭]님','[관리소장명]님'])assert.equal(S.personalize(t,site,c),site+' 입주자대표회장님');
 assert.equal(S.personalize('백 승우님께 직접 쓴 내용',site,c),'백 승우님께 직접 쓴 내용');
});
const pc=fs.readFileSync(require.resolve('../crm.html'),'utf8'),mobile=fs.readFileSync(require.resolve('../mobile.html'),'utf8');
function between(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return src.slice(i,j)}
function ctx(){return vm.createContext({MessageSalutation:S,dealStage:d=>d.code,dealWorkSummary:()=> '옥상',dealWorkSummaryM:()=> '옥상',relationshipMeta:()=>({days:0,outboundDays:4}),rmMetaM:()=>({days:0,outboundDays:4}),relSignature:()=>'',rmSignatureM:()=>'',relationshipSeasonalTemplate:()=>null,rmSeasonalM:()=>null,contextualLatestQuote:()=>({quote:{version_no:2,amount:100}}),ctxQuoteM:()=>({quote:{version_no:2}}),fmtAmt:x=>String(x),contextualMessagePurpose:()=> '견적 후속',G:{campaignCategory:'rapport'},campaignCategory:()=>({key:'rapport',label:'유대강화',group:'영업단계별'}),campaignActor:()=> '영업담당'})}
test('실제 PC·모바일 기본/견적 템플릿 생성기가 같은 호칭을 사용',()=>{
 const c=ctx();vm.runInContext(between(pc,'function relationshipTemplates(item,c){','function relationshipGuard()'),c);
 vm.runInContext(between(mobile,'function rmTemplatesM(d,c){','function rmGuardM()'),c);
 c._ctxRelationshipTemplates=c.relationshipTemplates;c._ctxTemplatesM=c.rmTemplatesM;
 vm.runInContext(pc.split(/\r?\n/).filter(l=>l.startsWith('relationshipTemplates=function(item,c)')).at(-1),c);
 vm.runInContext(between(mobile.slice(mobile.lastIndexOf('var _ctxTemplatesM=')),'rmTemplatesM=function(d,c){','var _ctxSheetM='),c);
 for(const code of ['first_contact','consulting','sent','rapport','silent','waiting','contract','expansion']){
  const d={code,site,nm:site},contact={name:'백 승우',role:'입주자대표회장'};
  for(const t of [...c.relationshipTemplates(d,contact),...c.rmTemplatesM(d,contact)]){assert.ok(t.body.startsWith(site+' 입주자대표회장님'),code);assert.ok(!t.body.includes('백 승우'))}
 }
});
test('실제 일괄발송 템플릿·미리보기에서 연락처별 직함을 치환',()=>{
 const c=ctx();vm.runInContext(between(pc,'function campaignTemplateSet(){','function campaignPickTemplate('),c);
 vm.runInContext(pc.split(/\r?\n/).find(l=>l.startsWith('function campaignPersonalize(')),c);
 for(const role of ['관리소장','입주자대표회장',''])for(const t of c.campaignTemplateSet()){
  const body=c.campaignPersonalize(t.body,{deal:{site},contact:{name:'백 승우',role},owner:'영업담당',work:'옥상'});
  assert.ok(body.startsWith(site+' '+(role||'관계자')+'님'));assert.ok(!body.includes('백 승우'));assert.ok(!body.includes('님님'));
 }
});
test('PC와 모바일에서 공유 모듈 로드, HTML 내부 JS 문법 검사',()=>{
 for(const html of [pc,mobile]){assert.match(html,/src="message-salutation.js/);for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);}
});
