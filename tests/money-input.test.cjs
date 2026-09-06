const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../money-input.js');
test('금액은 천 단위 쉼표, 빈칸·0·소수 구분',()=>{for(const [a,b] of [['1043900000','1,043,900,000'],['150000000','150,000,000'],['0','0'],['',''],['12000.5','12,000.5'],['0001200','1,200']])assert.equal(M.format(a),b)});
test('저장값은 쉼표 없는 숫자, 재표시해도 동일',()=>{for(const n of [0,1000,1043900000,150000000,12000.5])assert.equal(M.parse(M.format(n)),n)});
test('잘못된 금액을 임의 숫자로 바꾸지 않는다',()=>{for(const s of ['1e8','-100','abc','1.2.3','9007199254740992']){assert.ok(Number.isNaN(M.parse(s)));assert.equal(M.format(s),s)}});
test('중간 입력과 범위 선택의 커서를 숫자 기준으로 유지',()=>{
 const el={value:'1043900000',selectionStart:4,selectionEnd:7,setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b},setCustomValidity(s){this.error=s}};
 M.update(el);assert.equal(el.value,'1,043,900,000');assert.equal(el.selectionStart,5);assert.equal(el.selectionEnd,9);assert.equal(el.error,'');
});
const pc=fs.readFileSync(require.resolve('../crm.html'),'utf8'),mobile=fs.readFileSync(require.resolve('../mobile.html'),'utf8');
test('PC·모바일 금액 입력칸은 data-money, 숫자형 입력 제한 대신 숫자 키보드',()=>{
 for(const [html,ids] of [[pc,['dv-qamt','dv-amt','dv-wamt','nd-amt','exec-qv-amt']],[mobile,['pamt','qv-amt-m']]]){
  assert.match(html,/src="money-input.js/);
  for(const id of ids){const tag=html.match(new RegExp('<input id="'+id+'"[^>]+>'))[0];assert.match(tag,/data-money/);assert.match(tag,/inputmode="decimal"/);assert.doesNotMatch(tag,/type="number"/)}
 }
});
test('PC 실제 견적 저장 함수가 서버에 숫자를 보낸다',()=>{
 const values={'#exec-qv-amt':{value:'1,043,900,000'},'#exec-qv-reason':{value:'범위 조정'}},writes=[];
 const c=vm.createContext({MoneyInput:M,CUR_DETAIL:{kind:'deal',item:{id:'test'}},itemPatch:()=>({}),$:id=>values[id],execQuoteVersions:()=>[],isoNow:()=> '2026-09-05',ME:{name:'테스트'},repN:()=>'',saveLocal(){},pushWrite:(op,p)=>writes.push(p),renderDetail(){},detailTabFocus(){},showDetailErr(){}});
 vm.runInContext(pc.split(/\r?\n/).find(l=>l.startsWith('function saveExecQuoteVersion()')),c);c.saveExecQuoteVersion();assert.equal(writes[0].amount,1043900000);
 values['#exec-qv-amt'].value='1e8';c.saveExecQuoteVersion();assert.equal(writes.length,1);
});
test('모바일 실제 견적 저장 함수도 숫자 저장',()=>{
 const d={id:'test',tl:[]},writes=[];
 const c=vm.createContext({MoneyInput:M,DEALS:[d],G:{deal:'test',user:{nm:'테스트'}},document:{getElementById:id=>({value:id==='qv-amt-m'?'1,043,900,000':'범위 조정'})},quoteVersionsM:()=>[],isoNow:()=> '2026-09-05',toast(){},amtTxt:x=>String(x),pushWrite:(op,p)=>writes.push(p),closeSheet(){},render(){}});
 vm.runInContext(mobile.split(/\r?\n/).find(l=>l.startsWith('function saveQuoteVersionM()')),c);c.saveQuoteVersionM();assert.equal(writes[0].amount,1043900000);
});
