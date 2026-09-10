const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const S=require('../stage-transition.js'),MoneyInput=require('../money-input.js');
const date='2026-09-05',completion={completion_date:'2026-09-04',completion_checks:['공사 완료','준공검사 완료'],contract_amount:1043900000};
const input=fields=>({transition_date:date,fields});
test('입찰 낙찰은 계약으로, 준공에서만 Closed Won 선택',()=>{assert.deepEqual(S.normal.bidding,['contract']);assert.deepEqual(S.normal.contract,['construction']);assert.ok(!S.choices('bidding').includes('won'));assert.ok(S.choices('completion').includes('won'));assert.deepEqual(S.choices('won'),[])});
test('입찰 → 준공은 보정사유와 실제 준공확인 필요',()=>{assert.ok(S.validate('bidding','completion',input(completion),date).some(x=>x.includes('사유')));assert.deepEqual(S.validate('bidding','completion',{...input(completion),skip_reason:'미입력된 계약·시공 이력 보정'},date),[]);assert.ok(S.validate('construction','completion',input({...completion,completion_checks:['공사 완료']}),date).length)});
test('준공 및 전환 미래일·잘못된 날짜 차단',()=>{assert.ok(S.validate('construction','completion',input({...completion,completion_date:'2026-09-06'}),date).length);assert.ok(!S.validDate('2026-02-30'));assert.ok(S.validate('completion','won',{...input(completion),transition_date:'2026-09-06'},date).length)});
test('자료 발송은 실제 Version·수신자·발송일·후속일 질문',()=>{const x={materials:['견적서'],quote_version:'v2',recipient:'관리소장',sent_date:date,followup_date:'2026-09-08'};assert.deepEqual(S.validate('consulting','sent',input(x),date),[]);assert.ok(S.validate('consulting','sent',input({...x,quote_version:''}),date).length);assert.ok(S.validate('consulting','sent',input({...x,followup_date:'2026-09-01'}),date).length);assert.equal(S.next('sent',x).due,'2026-09-08')});
test('경쟁지원 없음 중복·잘못된 금액·공백 필수값 차단',()=>{assert.ok(S.validate('sent','compete',input({competition_type:'PT',support:['없음','PT자료']}),date).length);assert.ok(S.validate('completion','won',input({...completion,contract_amount:NaN}),date).length);assert.ok(S.validate('first_contact','consulting',input({quote_request:'  ',quote_due:date}),date).length);assert.doesNotThrow(()=>S.validate('consulting','sent',input({materials:{}}),date))});
test('이동만으로 Next나 고객 접촉을 만들지 않는다',()=>{assert.equal(S.next('compete',{}),null);assert.match(S.summary('completion',completion),/1,043,900,000/)});

function harness(mobile=false,code='bidding'){
 const nodes={},checks={},writes=[],patch={},d={id:'fixture',code,site:'테스트 아파트',nm:'테스트 아파트',assignee:'테스트',rep:'테스트',activities:[],tl:[],nextAction:{text:'기존 약속'}};
 let html='';
 function parse(s){html=s;for(const k of Object.keys(nodes))if(k.startsWith('sf-')||k==='stage-transition-form')delete nodes[k];for(const k of Object.keys(checks))delete checks[k];
  for(const m of s.matchAll(/<(input|select|textarea|form|button|div)\b[^>]*\bid="([^"]+)"[^>]*>/g)){let value=(m[0].match(/value="([^"]*)"/)||[])[1]||'';if(m[1]==='select'){const body=s.slice(m.index+m[0].length).split('</select>')[0];const opts=[...body.matchAll(/<option value="([^"]*)"([^>]*)>/g)];value=(opts.find(x=>x[2].includes('selected'))||opts[0]||[])[1]||''}nodes[m[2]]={value,textContent:'',scrollIntoView(){},querySelector:sel=>nodes[sel.slice(1)],querySelectorAll:sel=>(checks[(sel.match(/name="([^"]+)"/)||[])[1]]||[]).filter(x=>x.checked)}}
  for(const m of s.matchAll(/<input type="checkbox" name="([^"]+)" value="([^"]*)" ([^>]*)>/g))(checks[m[1]]??=[]).push({value:m[2],checked:m[3].includes('checked')});
 }
 const host={set innerHTML(s){parse(s)},remove(){delete nodes['stage-transition-form']}};nodes.inlineTransition=host;nodes['dv-body']={appendChild(){}};
 const c={StageTransition:S,MoneyInput,document:{getElementById:id=>nodes[id],createElement:()=>host},alert(){},toast(){},G:{deal:d.id,user:{nm:'관리자'}},DEALS:[d],quoteVersionsM:()=>[],nextOptions:()=>[['contract','계약']],openSheet:(t,s)=>parse(s),closeSheet(){},commitClose(){},moveTo(){},moveToLegacy(){},exReason(){},commitMove(){},amtSheet(){},amtOk(){},render(){},meId:()=> 'tester',pushWrite:(op,p)=>writes.push({op,p}),stageLabel:k=>k};
 if(!mobile)Object.assign(c,{CUR_DETAIL:{kind:'deal',item:d},dealStage:x=>x.code,itemPatch:()=>patch,execQuoteVersions:()=>[],openTransition(){},confirmTransition(){},splitForm(){},splitDealSel:()=>d,drwDeal(){},spSaveStage(){},repN:x=>x,applyStageTarget(){},ME:{name:'관리자'},logActivity(){},saveLocal(){},renderDetail(){},showDetailErr(){},saveMsg:x=>x,ensureExpansionRecord:(x,at)=>writes.push({op:'pool',at})});
 else delete nodes['dv-body'];
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../stage-transition-ui.js'),'utf8'),c);
 return {c,d,writes,nodes,checks,html:()=>html,set:(k,v)=>nodes['sf-'+k].value=v,open:to=>c.StageTransitionUI.open(d,mobile,to)};
}
for(const mobile of [false,true])test((mobile?'모바일':'PC')+' 실제 폼: 누락 차단 → 구조화 전환 → 금액 숫자·날짜·이력 유지',()=>{
 const h=harness(mobile);h.open('completion');h.c.StageTransitionUI.save();assert.equal(h.writes.length,0);assert.equal(h.d.code,'bidding');assert.doesNotMatch(h.html(),/무엇을 했는지|id="tr-result"/);
 h.set('date',date);h.set('completion_date','2026-09-04');h.set('contract_amount','1,043,900,000');h.set('skip','계약·시공 미입력 이력 보정');h.checks['sf-completion_checks'].slice(0,2).forEach(x=>x.checked=true);h.c.StageTransitionUI.save();
 assert.equal(h.d.code,'completion');const p=h.writes.find(x=>x.op==='transition').p;assert.equal(p.stage_context.fields.contract_amount,1043900000);assert.equal(p.transition_date,date);assert.match(p.note,/계약·시공 미입력/);assert.ok(!h.writes.some(x=>x.op==='next_action'));assert.equal(h.d.nextAction.text,'기존 약속');assert.equal(h.d.stageHistory[0].structured.to,'completion');
});
test('준공 확인 후 Closed Won → 실제 준공일을 기준으로 확장 Pool',()=>{const h=harness(false,'completion');h.open('won');h.set('date',date);h.set('completion_date','2026-09-04');h.set('contract_amount','100,000');h.checks['sf-completion_checks'].forEach(x=>x.checked=true);h.c.StageTransitionUI.save();assert.equal(h.d.outcome,'won');assert.equal(h.writes.find(x=>x.op==='pool').at,'2026-09-04')});
test('관계관리 진입은 사유·다음 연락일을 필수 저장하고 같은 영업기회를 유지한다',()=>{const h=harness(false,'sent');h.open('rapport');h.c.StageTransitionUI.save();assert.equal(h.writes.length,0);assert.match(h.nodes['sf-error'].textContent,/관계관리 사유/);h.set('date',date);h.set('relationship_reason','내년도 사업 검토');h.set('reaction','내년 예산 편성 후 재검토');h.set('contact_date','2026-10-15');h.c.StageTransitionUI.save();assert.equal(h.d.code,'rapport');assert.equal(h.d.relationshipReason,'내년도 사업 검토');assert.equal(h.d.nextActionObj.due,'2026-10-15');assert.equal(h.writes.filter(x=>['transition','activity','next_action'].includes(x.op)).length,3)});
test('모바일 기존 금액확정 우회 호출로 입찰을 수주 종료할 수 없다',()=>{const h=harness(true);h.c.amtOk('won');assert.equal(h.writes.length,0);assert.equal(h.d.code,'bidding')});
test('취소는 아무것도 저장하지 않는다',()=>{const h=harness();h.open('contract');h.c.StageTransitionUI.close();assert.equal(h.writes.length,0);assert.equal(h.d.code,'bidding')});
test('PC·모바일 스크립트 연결 및 전체 inline JS 구문검사',()=>{for(const file of ['crm.html','mobile.html']){const html=fs.readFileSync(require.resolve('../'+file),'utf8');assert.match(html,/src="stage-transition-ui.js/);for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1])}});
