/* 받는 사람의 관리자 요청(2026-10-09): 새 요청 도착 팝업 → [응대 시작] / [확인 · 나중에 처리] → 확인 뒤 작은 카드.
   닫기(×) · 확인(seen) · 응대(working) · 완료(done)는 서로 다른 상태 — 열어 보거나 닫은 것만으로 확인 · 완료 처리하지 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),loose=require('node:assert'),/* vm 안에서 만든 배열 · 객체는 prototype 이 달라 strict 비교가 안 된다 */fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','work-request.js'),'utf8');
const now=Date.parse('2026-10-09T03:00:00Z');
class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
const req=(id,extra)=>Object.assign({id,target_type:'inquiry',target_id:'q'+id,site:'[경기 수원] 수원장안힐스테이트',brand:'POUR솔루션',kind:'first',label:'첫 연락 요청',to_scope:'user',to_name:'이필선',asks:['고객 첫 연락'],due_at:new Date(now+6*3600e3).toISOString(),due_label:'오늘 중',memo:'',status:'sent',round:1,requested_by:'송보람',created_at:new Date(now-600e3).toISOString(),updated_at:new Date(now-600e3).toISOString(),to_me:true,by_me:false},extra||{});
const tick=()=>new Promise(r=>setImmediate(r));
function setup(list,opts={}){
 const calls=[],context={Date:Clock,console,setTimeout(){},document:{addEventListener(){},getElementById(){return null;}}};context.window=context;
 Object.assign(context,{G:Object.assign({page:'today'},opts.G||{}),ME:{name:'이필선'},esc:String,escAttr:String,repN:v=>v,phoneFmt:v=>v,inqCtlFind:()=>null,B:{deals:[]},
  paint(){calls.push({name:'paint'});},goPage(p){calls.push({name:'goPage',page:p});},
  OpsStore:{has:()=>true,rpc:(name,args)=>{calls.push({name,args});const r=list.find(x=>x.id===args.id);
   if(r&&args.action==='seen'&&r.status==='sent')r.status='seen';if(r&&args.action==='working')r.status='working';return Promise.resolve({ok:true,request:r?Object.assign({},r):undefined});}}});
 vm.createContext(context);vm.runInContext(source,context);
 context.G.workReq={list,loaded:true,at:now,card:{},closing:{},seen:{}};
 return {api:context.WorkRequest,calls,context,S:context.G.workReq};
}
const replies=calls=>calls.filter(c=>c.name==='crm_work_request_reply_v1').map(c=>c.args.action);

test('viewing the top block never marks the request seen; it shows a compact summary row instead of the full card',()=>{
 const {api,calls}=setup([req('1')]),html=api.topHtml();
 assert.deepEqual(replies(calls),[],'열어 보기만으로는 서버에 아무것도 보내지 않는다');
 assert.match(html,/class="wrq-sum"/);assert.match(html,/관리자 요청<\/em><b>미완료 1건<\/b>/);assert.match(html,/확인 전 1건/);assert.match(html,/data-wr="popshow"/);
 assert.match(html,/class="wrq-row"/);assert.match(html,/고객 연락 · 오늘까지/);assert.match(html,/class="st nw">확인 전</);assert.match(html,/data-wr="start"[^>]*>처리하기</);
 assert.doesNotMatch(html,/class="wrq-in"/,'확인 전에는 펼친 카드(전화 · 결과 · 5단계)가 없다');assert.doesNotMatch(html,/wrq-steps/);
});
test('popup opens once per new request; closing it records nothing and keeps the request unconfirmed',()=>{
 const list=[req('1')],{api,calls,S}=setup(list);
 api.popCheck();loose.deepEqual((api.popModel()||[]).map(r=>r.id),['1']);
 api.popClose();assert.equal(api.popModel(),null);assert.deepEqual(replies(calls),[],'닫기 ≠ 확인');assert.equal(list[0].status,'sent');
 api.popCheck();assert.equal(api.popModel(),null,'이미 보여 준 요청은 다시 띄우지 않는다');
 assert.match(api.topHtml(),/확인 전 1건.*새 요청 보기/,'작은 카드에 확인 전 + [새 요청 보기]');
 api.popShow();loose.deepEqual((api.popModel()||[]).map(r=>r.id),['1'],'[새 요청 보기]로 다시 연다');api.popClose();
 list.push(req('2',{site:'[서울 송파] 가락현대TWELVE'}));api.popCheck();loose.deepEqual((api.popModel()||[]).map(r=>r.id),['2'],'새로 온 것만 팝업');
 assert.equal(S.open['1'],undefined);
});
test('acknowledge = seen only; the request stays open as a compact row until the result is saved',async()=>{
 const list=[req('1')],{api,calls}=setup(list);
 api.popCheck();api.popAck(['1']);await tick();
 assert.deepEqual(replies(calls),['seen']);assert.equal(list[0].status,'seen');assert.equal(api.popModel(),null);
 const html=api.topHtml();assert.match(html,/미완료 1건/);assert.doesNotMatch(html,/확인 전/);assert.match(html,/class="st ">확인함</);assert.doesNotMatch(html,/class="wrq-in"/);
 assert.equal(api.steps(list[0])[1].t,'이필선 확인함');assert.equal(api.steps(list[0])[1].s,2,'지금 단계 = 담당 확인(확인함)');assert.equal(api.steps(list[0])[0].s,1);
 api.popAck(['1']);await tick();assert.deepEqual(replies(calls),['seen'],'이미 확인한 건은 다시 보내지 않는다');
});
test('start = working and expands only that request; fold collapses it without changing status',async()=>{
 const list=[req('1'),req('2',{site:'[서울 송파] 가락현대TWELVE'})],{api,calls,S}=setup(list);
 api.popCheck();api.start('1');await tick();
 assert.deepEqual(replies(calls),['working']);assert.equal(list[0].status,'working');assert.equal(list[1].status,'sent');assert.equal(api.popModel(),null,'응대 시작하면 팝업은 닫힌다');
 let html=api.topHtml();assert.equal((html.match(/class="wrq-in"/g)||[]).length,1,'그 건만 펼침');assert.match(html,/data-wr="fold"/);assert.match(html,/data-wr="dial"/);assert.match(html,/class="wrq-row"/,'나머지는 작은 줄');
 assert.match(html,/확인 전 1건/,'아직 확인 전인 다른 건 수');
 api.fold('1');html=api.topHtml();assert.doesNotMatch(html,/class="wrq-in"/);assert.match(html,/class="st wk">응대 중</);assert.equal(list[0].status,'working');
 api.start('1');await tick();assert.deepEqual(replies(calls),['working'],'처리 중인 건은 다시 보내지 않는다');assert.equal(S.open['1'],true);
});
test('start from another page moves to Today',()=>{
 const {api,calls}=setup([req('1')],{G:{page:'inq'}});api.popCheck();api.start('1');
 assert.ok(calls.some(c=>c.name==='goPage'&&c.page==='today'));
});
test('popup text: requester · site · what to do · deadline only, per request kind',()=>{
 const {api}=setup([]);
 loose.deepEqual(api.popText(req('1')),{who:'송보람님이 고객 응대를 요청했습니다.',site:'[경기 수원] 수원장안힐스테이트',task:'고객에게 연락한 뒤 통화 결과와 다음 일정을 등록해주세요.',due:'처리 기한: 오늘 중',start:'응대 시작'});
 loose.deepEqual(api.popText(req('2',{kind:'branch',label:'지사 확인 요청',due_label:'내일 12시'})),{who:'송보람님이 지사 확인을 요청했습니다.',site:'[경기 수원] 수원장안힐스테이트',task:'담당자를 지정하고 고객 첫 연락 진행 여부를 본사에 회신해주세요.',due:'처리 기한: 내일 12시',start:'회신하기'});
 const t=api.popText(req('3',{kind:'contract',label:'계약정보 입력 요청',due_at:new Date(now-3600e3).toISOString(),due_label:'오늘 17:00'}));
 assert.equal(t.who,'송보람님이 계약정보 입력을 요청했습니다.');assert.equal(t.due,'처리 기한: 오늘 17:00 · 지남');assert.equal(t.start,'처리 시작');
 assert.equal(api.popText(req('4',{kind:'handover',label:'재배정 인계'})).start,'인수 확인하기');
 assert.match(api._row(req('5',{kind:'branch',label:'지사 확인 요청',due_label:'내일 12시'})),/본사 회신 · 기한 내일 12시/);
 assert.match(api._row(req('6',{due_at:new Date(now-3600e3).toISOString(),due_label:'오늘 17:00'})),/고객 연락 · 오늘 17:00까지<em>기한 지남<\/em>/);
});
test('G.wrqPopOff restores the previous behaviour: expanded card and auto-seen on open',()=>{
 const list=[req('1')],{api,calls}=setup(list,{G:{wrqPopOff:true}}),html=api.topHtml();
 assert.match(html,/class="wrq-in"/);assert.doesNotMatch(html,/wrq-sum|wrq-row|data-wr="fold"/);assert.deepEqual(replies(calls),['seen']);
 api.popCheck();assert.equal(api.popModel(),null);
});
