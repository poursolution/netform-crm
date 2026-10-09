/* 모바일 관리자 요청(2026-10-09): 새 요청 도착 팝업 → [응대 시작] / [확인 · 나중에 처리] → 확인 뒤 '오늘' 맨 위 작은 카드.
   닫기 · 확인(seen) · 응대 시작(working) · 완료(실제 기록 뒤 done)는 서로 다른 상태. 서버 함수는 PC 와 같은 것(transport.js 허용 목록). */
const test=require('node:test'),assert=require('node:assert/strict'),loose=require('node:assert'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'..'),source=fs.readFileSync(path.join(base,'mobile-request.js'),'utf8');
const now=Date.now(),iso=ms=>new Date(now+ms).toISOString(),tick=()=>new Promise(r=>setImmediate(r));
const req=(id,extra)=>Object.assign({id,target_type:'inquiry',target_id:'00000009-0000-4000-8000-000000000009',site:'[경기 수원] 수원장안힐스테이트',brand:'POUR솔루션',kind:'first',label:'첫 연락 요청',to_scope:'user',to_name:'이필선',asks:['고객 첫 연락'],due_at:iso(6*3600e3),due_label:'오늘 중',memo:'',status:'sent',round:1,requested_by:'송보람',created_at:iso(-600e3),updated_at:iso(-600e3),to_me:true,by_me:false},extra||{});
function setup(list,opts={}){
 const calls=[],ctx={console,setTimeout(){},document:{addEventListener(){},getElementById(){return null;}}};ctx.window=ctx;
 const rpc=(name,p)=>{calls.push({name,p});const r=list.find(x=>x.id===p.id);
  if(r&&p.action==='seen'&&r.status==='sent')r.status='seen';if(r&&p.action==='working')r.status='working';if(r&&p.action==='done'){r.status=p.absent?'absent':'done';r.result=p.result;r.next_text=p.next_text||null;r.next_due=p.next_due||null;}
  return Promise.resolve(name==='crm_work_request_list_v1'?{ok:true,requests:list.map(x=>Object.assign({},x))}:{ok:true,request:r?Object.assign({},r):undefined});};
 Object.assign(ctx,{G:Object.assign({user:{id:'me',nm:'이필선'},done:{},tab:'today',deal:null,sub:null},opts.G||{}),LIVE:true,DEMO:false,esc:String,escAttr:String,toast(m){calls.push({name:'toast',m});},render(){calls.push({name:'render'});},
  DEALS:opts.deals||[],ADMIN:{inquiries:opts.inquiries||[{key:'00000009-0000-4000-8000-000000000009',nm:'[경기 수원] 수원장안힐스테이트',status:'배정완료',raw:{id:'00000009-0000-4000-8000-000000000009'}}]},
  Phase1:{rpc:(name,args)=>{calls.push({name:'phase1',rpcName:name,args});return rpc(name,args.p||{});}}});
 vm.createContext(ctx);vm.runInContext(source,ctx);
 if(!opts.phase1)ctx.MobileRequest.use({rpc});
 return {api:ctx.MobileRequest,calls,ctx,S:ctx.G.mreq};
}
const replies=calls=>calls.filter(c=>c.name==='crm_work_request_reply_v1').map(c=>c.p.action);

test('load goes through Phase1.rpc with the {p:…} wrapper and pops only unseen sent requests; legacy bundle excluded',async()=>{
 const list=[req('1'),req('L',{label:'과거 자료 재개',kind:'support'}),req('2',{status:'seen',site:'B'})],{api,calls}=setup(list,{phase1:true});
 api.load(true);await tick();await tick();
 const p1=calls.find(c=>c.name==='phase1');assert.equal(p1.rpcName,'crm_work_request_list_v1');loose.deepEqual(p1.args,{p:{days:30}});
 assert.equal((api.popModel()||[]).map(r=>r.id).join(),'1','확인 전(sent) 이면서 아직 안 보여 준 것만 · 묶음 제외');
 assert.equal(api.incoming().length,2,'묶음은 모바일 카드에서도 빠진다');
 assert.deepEqual(replies(calls),[],'읽기만으로는 아무것도 쓰지 않는다');
});
test('compact card: viewing never marks seen; rows show site · task · deadline · state · [처리하기]',()=>{
 const {api,calls}=setup([req('1'),req('2',{status:'working',site:'[서울 송파] 가락현대TWELVE',kind:'follow',due_label:'오늘 17:00'})]);
 api.state().list=[req('1'),req('2',{status:'working',site:'[서울 송파] 가락현대TWELVE',kind:'follow',due_label:'오늘 17:00'})];api.state().loaded=true;
 const html=api.topHtml();
 assert.match(html,/<em>관리자 요청<\/em><b>미완료 2건<\/b>/);assert.match(html,/확인 전 1건/);assert.match(html,/data-mrq="show"/);
 assert.match(html,/수원장안힐스테이트<\/b><span>고객 연락 · 오늘까지</);assert.match(html,/class="st nw">확인 전</);
 assert.match(html,/가락현대TWELVE<\/b><span>후속 연락 · 오늘 17:00까지</);assert.match(html,/class="st wk">응대 중</);
 assert.equal((html.match(/data-mrq="start"/g)||[]).length,2);assert.deepEqual(replies(calls),[]);
});
test('ack = seen only and the request stays; close records nothing; [새 요청 보기] reopens',async()=>{
 const list=[req('1')],{api,calls}=setup(list);api.state().list=list;api.state().loaded=true;
 api.popCheck();assert.equal((api.popModel()||[]).length,1);
 api.popClose();assert.equal(api.popModel(),null);assert.deepEqual(replies(calls),[]);assert.equal(list[0].status,'sent');
 api.popCheck();assert.equal(api.popModel(),null,'한 번 보여 준 것은 다시 띄우지 않는다');
 api.popShow();assert.equal((api.popModel()||[]).length,1);
 api.ack(['1']);await tick();assert.deepEqual(replies(calls),['seen']);assert.equal(list[0].status,'seen');assert.equal(api.popModel(),null);
 assert.match(api.topHtml(),/class="st ">확인함</);assert.doesNotMatch(api.topHtml(),/확인 전/);
 api.ack(['1']);await tick();assert.deepEqual(replies(calls),['seen'],'이미 확인한 건은 다시 보내지 않는다');
});
test('start = working + opens the result input screen (inquiry → first-contact screen, deal → detail)',async()=>{
 const list=[req('1'),req('2',{target_type:'deal',target_id:'deal-9',site:'[서울] 영업건'})],{api,calls,ctx}=setup(list,{deals:[{id:'deal-9',nm:'[서울] 영업건',activities:[]}]});
 api.state().list=list;api.state().loaded=true;api.popCheck();
 api.start('1');await tick();
 assert.deepEqual(replies(calls),['working']);assert.equal(list[0].status,'working');assert.equal(api.popModel(),null,'응대 시작하면 팝업은 닫힌다');
 loose.deepEqual(ctx.G.sub,{t:'inqAssigned',key:'00000009-0000-4000-8000-000000000009'});assert.equal(ctx.G.tab,'today');assert.ok(calls.some(c=>c.name==='render'));
 api.start('2');await tick();assert.equal(ctx.G.deal,'deal-9');assert.equal(ctx.G.sub,null);assert.equal(ctx.G.tab,'mine');assert.equal(list[1].status,'working');
 api.start('2');await tick();assert.deepEqual(replies(calls),['working','working'],'처리 중인 건은 다시 보내지 않는다');
});
test('missing target on this phone: toast, request untouched',async()=>{
 const list=[req('1',{target_id:'nope'})],{api,calls}=setup(list);api.state().list=list;api.state().loaded=true;
 api.start('1');await tick();assert.ok(calls.some(c=>c.name==='toast'&&/찾지 못했습니다/.test(c.m)));
});
test('auto-complete only from real saved results after the request: inquiry label / deal activity (+next), absent stays absent',async()=>{
 const deals=[{id:'deal-9',nm:'[서울] 영업건',activities:[{type:'전화',note:'통화 완료 · 진행 중',occurred_at:iso(-10e3)}],nextAction:{text:'진행 상황 확인 전화',due_at:iso(3*864e5),status:'open'}},
  {id:'deal-8',nm:'옛 기록',activities:[{type:'전화',note:'통화',occurred_at:iso(-5*864e5)}]},{id:'deal-7',nm:'부재',activities:[{type:'부재',note:'전화 부재 — 못 받으심',occurred_at:iso(-10e3)}]}];
 const list=[req('d9',{target_type:'deal',target_id:'deal-9',status:'working'}),req('d8',{target_type:'deal',target_id:'deal-8'}),req('d7',{target_type:'deal',target_id:'deal-7',kind:'follow'}),req('q1'),req('c1',{kind:'contract',target_type:'deal',target_id:'deal-9'})];
 const {api,calls,ctx}=setup(list,{deals});api.state().list=list;api.state().loaded=true;
 assert.equal(api.evidence(list[1]),null,'요청 전 기록은 근거가 아니다');assert.equal(api.evidence(list[3]),null,'문의 응대 전');assert.equal(api.evidence(list[4]),null,'연락 요청이 아닌 종류는 모바일에서 자동 완료하지 않는다');
 loose.deepEqual(api.evidence(list[0]),{result:'응대 기록 확인',absent:false,next_text:'진행 상황 확인 전화',next_due:iso(3*864e5).slice(0,10)});
 assert.equal(api.evidence(list[2]).absent,true);
 ctx.G.done['k:00000009-0000-4000-8000-000000000009|'+new Date().toISOString().slice(0,10)]='전화 못 받음 — 다시 시도';
 loose.deepEqual(api.evidence(list[3]),{result:'부재',absent:true});
 api.autoClose();await tick();
 const done=calls.filter(c=>c.name==='crm_work_request_reply_v1'&&c.p.action==='done').map(c=>[c.p.id,c.p.result,c.p.absent,c.p.auto]).sort();
 assert.deepEqual(done,[['d7','부재',true,true],['d9','응대 기록 확인',false,true],['q1','부재',true,true]]);
 assert.equal(list[0].status,'done');assert.equal(list[2].status,'absent');assert.equal(list[1].status,'sent');assert.equal(list[4].status,'sent');
});
test('popup text per kind, mobile.html wiring, transport allow-list: list · reply only (no create · reask on mobile)',()=>{
 const {api}=setup([]);
 loose.deepEqual(api.popText(req('1')),{who:'송보람님이 고객 응대를 요청했습니다.',site:'[경기 수원] 수원장안힐스테이트',task:'고객에게 연락한 뒤 통화 결과와 다음 일정을 등록해주세요.',due:'처리 기한: 오늘 중',start:'응대 시작'});
 assert.equal(api.popText(req('2',{kind:'contract',label:'계약정보 입력 요청',due_at:iso(-3600e3),due_label:'오늘 17:00'})).due,'처리 기한: 오늘 17:00 · 지남');
 const html=fs.readFileSync(path.join(base,'mobile.html'),'utf8'),t=fs.readFileSync(path.join(base,'transport.js'),'utf8');
 assert.ok(html.indexOf('mobile-v2.js')<html.indexOf('mobile-request.js'),'mobile-v2 다음에 불러온다(render 를 감싼다)');assert.match(html,/mobile-request\.css/);
 const m=t.match(/rpcAllow=new Set\(\[([^\]]+)\]/);assert.ok(m);const names=[...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x=>x[1]);
 assert.ok(names.includes('crm_work_request_list_v1')&&names.includes('crm_work_request_reply_v1'));assert.ok(!names.includes('crm_work_request_create_v1')&&!names.includes('crm_work_request_reask_v1'));
});
test('off switch and demo mode: nothing loads, nothing paints',()=>{
 const {api,calls}=setup([req('1')],{G:{mobileRequestOff:true}});api.load(true);assert.equal(calls.length,0);assert.equal(api.on(),false);
 const {api:b,calls:c2,ctx}=setup([req('1')],{phase1:true});ctx.DEMO=true;b.load(true);assert.equal(c2.length,0);
});
