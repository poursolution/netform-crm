'use strict';
/* 연락 판정 하나(ContactState · InquiryFlow.state) — 같은 현장 · 같은 문의는 어느 화면에서나 같은 줄 (2026-10-05 design_handoff_consistency ①)
   자료 모양은 운영에서 본 실제 경우를 본뜬 것(현장 이름 · 번호는 지어낸 것): 같은 문의가 1초 차이로 두 번 들어온 복제 줄 + 사흘 뒤 재문의 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function ctx(inquiries,extra){
 const w={console,Date,Intl,Math,JSON,Map,Set,WeakMap,Object,Array,String,Number,Promise,setTimeout,clearTimeout};
 w.window=w;w.globalThis=w;w.G={};w.OPS_RULES={liveFrom:'2026-10-01'};w.B={inquiries,deals:[],inquiryCleanupArchived:[]};w.LOCAL={};
 w.itemPatch=()=>({});w.actionObj=(it)=>it.nextActionObj||null;w.paint=()=>{};
 w.inquiryRoutedOwner=q=>q.assignee||q.assignee_name||'';
 Object.assign(w,extra||{});vm.createContext(w);
 vm.runInContext(read('contact-state.js'),w);vm.runInContext(read('inquiry-flow.js'),w);
 return w;
}
const row=(id,o)=>Object.assign({id,site:'[서울 강남] 한빛마을아파트',brand:'POUR솔루션',phone:'02-555-0100',status:'접수',received_at:'2026-09-18T08:31:29+00:00',raw:{}},o);
function sample(){
 return [
  row('a1',{sheet_row:41,assignee:'이필선',status:'현장방문예정',responded_at:'2026-09-21T04:38:47+00:00',raw:{'응대내용':'[2026. 9. 21. PM 1:38:47] 지하주차장 공사추진중 22일(화요일) 오전 현장방문예정'}}),
  row('a2',{received_at:'2026-09-18T08:31:30.397+00:00'}),
  row('b1',{sheet_row:57,assignee:'이필선',status:'배정완료',received_at:'2026-09-21T02:21:03+00:00',assigned_at:'2026-09-21T04:29:12+00:00'}),
  row('b2',{received_at:'2026-09-21T02:21:03.951+00:00'})];
}
const plain=m=>[...m.entries()].map(([k,v])=>[k,v.id]).sort();

test('복제 줄: 같은 현장 · 브랜드 · 전화 · 60초 안 · 손대지 않은 접수 줄만 원래 줄의 그림자',()=>{
 const L=sample(),w=ctx(L),CS=w.ContactState;
 assert.deepEqual(plain(CS.shadows(L)),[['a2','a1'],['b2','b1']]);
 /* 전화가 다르면 · 60초를 넘으면 · 브랜드가 다르면 · 담당이 있으면 · '따로 두기'로 정했으면 그림자가 아니다 */
 for(const o of [{phone:'02-555-0199'},{received_at:'2026-09-18T08:33:00+00:00'},{brand:'석민이앤씨'},{assignee:'한준엽'},{duplicate_resolution:'keep_separate'},{status:'배정완료'},{responded_at:'2026-09-19T01:00:00+00:00'}]){
  const M=[L[0],row('x',Object.assign({received_at:'2026-09-18T08:31:30.397+00:00'},o))];
  assert.equal(ctx(M).ContactState.shadows(M).size,0,JSON.stringify(o));}
 /* 둘 다 손대지 않은 줄이면 먼저 들어온 줄이 원래 줄 — 하나는 남는다 */
 const M=[row('p',{}),row('q',{received_at:'2026-09-18T08:31:30.4+00:00'})];assert.deepEqual(plain(ctx(M).ContactState.shadows(M)),[['q','p']]);
 /* 현장 이름이 없거나 자리 채움('-' · '미입력')이면 묶지 않는다 — 서로 다른 고객이 한 건으로 합쳐지지 않게 */
 for(const name of ['-','미입력','현장명 미입력','']){const J=[row('j1',{site:name,assignee:'이필선',status:'전화응대 완료',responded_at:'2026-09-21T04:38:47+00:00'}),row('j2',{site:name,received_at:'2026-09-18T08:31:30.4+00:00'}),row('j3',{site:name,assignee:'이필선',status:'배정완료',received_at:'2026-09-20T01:00:00+00:00'})],wj=ctx(J);
  assert.equal(wj.ContactState.shadows(J).size,0,name);assert.equal(wj.InquiryFlow.state(J[2]).firstConnectedAt,'',name);assert.equal(wj.ContactState.caseKey(J[0]),'',name);}
 /* 끄면 아무것도 그림자가 아니다 */
 const off=ctx(L);off.G.contactStateOff=true;assert.equal(off.ContactState.shadows(L).size,0);
});

test('같은 현장의 다른 문의에 남긴 연락은 이 문의의 연락이다 — 이 문의가 접수된 뒤의 것만',()=>{
 const L=sample(),w=ctx(L),F=w.InquiryFlow;
 assert.equal(F.own(L[2]).firstConnectedAt,'','재문의 줄 자체에는 기록이 없다');
 assert.equal(F.state(L[2]).firstConnectedAt,'2026-09-21T04:38:47+00:00','같은 건의 통화가 재문의 줄에도 보인다');
 assert.equal(F.state(L[0]).firstConnectedAt,F.state(L[2]).firstConnectedAt,'두 줄의 판정이 같다');
 assert.equal(F.firstConnectedAt(L[2]),'2026-09-21T04:38:47+00:00');
 /* 지난해 문의의 통화는 올해 새 문의의 연락이 아니다 */
 const M=[row('old',{assignee:'이필선',status:'전화응대 완료',received_at:'2025-03-02T01:00:00+00:00',responded_at:'2025-03-02T03:00:00+00:00'}),row('new',{assignee:'이필선',status:'배정완료',received_at:'2026-10-02T01:00:00+00:00'})];
 const w2=ctx(M);assert.equal(w2.InquiryFlow.state(M[1]).firstConnectedAt,'');
 /* 다른 브랜드 문의의 통화는 섞지 않는다 */
 const N=[row('s',{brand:'석민이앤씨',assignee:'황윤선',status:'전화응대 완료',responded_at:'2026-09-22T03:00:00+00:00'}),row('t',{assignee:'이필선',status:'배정완료',received_at:'2026-09-21T02:21:03+00:00'})];
 assert.equal(ctx(N).InquiryFlow.state(N[1]).firstConnectedAt,'');
 /* 끄면 줄마다 따로 */
 const off=ctx(L);off.G.contactStateOff=true;assert.equal(off.InquiryFlow.state(L[2]).firstConnectedAt,'');
});

test('세 줄 · 한 줄 요약은 같은 판정에서 나온다(연락 시도 · 실제 연결 · 다음 행동)',()=>{
 const L=sample();L[2].nextActionObj={text:'재통화',due:'2026-10-06'};const w=ctx(L),CS=w.ContactState;
 const texts=x=>Array.from(CS.lines(x,'inq'),l=>l.label+' '+l.text);
 assert.deepEqual(texts(L[2]),['연락 시도 2026.9.21 · 연결됨','실제 연결 2026.9.21','다음 행동 재통화 · 10.6']);
 assert.deepEqual(texts(L[0]).slice(0,2),texts(L[2]).slice(0,2),'같은 현장 두 줄이 같은 문장');
 assert.equal(CS.recent(L[0],'inq'),'실제 연결 2026.9.21');assert.equal(CS.recent(L[2],'inq'),CS.recent(L[0],'inq'));
 /* 부재만 있으면: 시도 줄에 날짜 · 결과 · 횟수, 연결 줄은 '아직 없음' */
 const M=[row('m',{assignee:'이필선',status:'배정완료',activities:[{id:'1',type:'전화',note:'[전화 · 부재] ',at:'2026-09-21T02:00:00+00:00'},{id:'2',type:'전화',note:'[전화 · 부재] ',at:'2026-09-22T02:00:00+00:00'}],nextActionObj:{text:'재통화',due:'2026-10-06'}})];
 const C2=ctx(M).ContactState;
 assert.deepEqual(Array.from(C2.lines(M[0],'inq'),l=>l.label+' '+l.text),['연락 시도 2026.9.21 · 부재 · 2회','실제 연결 아직 없음','다음 행동 재통화 · 10.6']);
 assert.equal(C2.recent(M[0],'inq'),'연락 시도 2026.9.21 · 부재 · 2회 · 실제 연결 아직 없음');
});

test("기록이 없으면 '연락 안 함'으로 단정하지 않는다 — 운영 시작일 전 자료는 이관 전 기록 확인 필요",()=>{
 const L=[row('o',{assignee:'이필선',status:'배정완료',received_at:'2026-08-03T01:00:00+00:00'}),row('n',{site:'새빛타운',assignee:'이필선',status:'배정완료',received_at:'2026-10-03T01:00:00+00:00'})],CS=ctx(L).ContactState;
 assert.equal(CS.recent(L[0],'inq'),'CRM 연락 기록 없음 (이관 전 기록 확인 필요)');
 assert.equal(CS.recent(L[1],'inq'),'CRM 연락 기록 없음');
 assert.equal(CS.lines(L[0],'inq')[0].text,'CRM 연락 기록 없음 (이관 전 기록 확인 필요)');assert.equal(CS.lines(L[0],'inq')[1].text,'아직 없음');assert.equal(CS.lines(L[0],'inq')[2].text,'없음');
 /* 영업건: 활동 · 넘어온 문의 · 마지막 의미 있는 연락을 같이 본다 */
 const q=row('q1',{assignee:'이필선',status:'전화응대 완료',responded_at:'2026-09-21T04:38:47+00:00'});
 const w=ctx([q],{relationshipMeta:d=>({meaningfulAt:d.contactAt||'',outboundAt:''}),dealInquiryRefs:d=>d.origin_inquiry_id?[String(d.origin_inquiry_id)]:[]});
 const D=w.ContactState;
 assert.equal(D.recent({id:'d1',created:'2025-04-01',activities:[]},'deal'),'CRM 연락 기록 없음 (이관 전 기록 확인 필요)');
 assert.equal(D.recent({id:'d2',created:'2026-10-02',activities:[]},'deal'),'CRM 연락 기록 없음');
 assert.equal(D.recent({id:'d3',created:'2026-10-02',origin_inquiry_id:'q1',activities:[]},'deal'),'최근 연락 2026.9.21','문의 때의 통화가 영업건에도 보인다');
 assert.equal(D.recent({id:'d4',created:'2025-04-01',contactAt:'2026-08-11T02:00:00+00:00',activities:[]},'deal'),'최근 연락 2026.8.11');
 assert.deepEqual(D.lines({id:'d5',created:'2026-10-02',activities:[{id:'x',type:'전화',note:'[전화 · 부재] ',at:'2026-10-03T02:00:00+00:00'}],nextActionObj:{text:'재통화',due:'2026-10-06'}},'deal').map(l=>l.text).join(' | '),'2026.10.3 · 부재 | 아직 없음 | 재통화 · 10.6');
});

test("화면 문구: '첫 연락 기록 없음' · '연락 안 함' 같은 단정 문구를 쓰지 않는다",()=>{
 const files=fs.readdirSync(root).filter(f=>/\.js$/.test(f)&&!/^contact-state\.js$/.test(f)).concat(['crm.html']);
 const bad=[];for(const f of files){const t=read(f);for(const re of [/'첫 연락 기록 없음/,/'최근 연락 기록 없음'/,/[':]\s*'연락 기록 없음'/,/first:'첫 연락 (안 함|기록 없음)'/,/'배정 후 미연락'/])if(re.test(t))bad.push(f+' '+re);}
 assert.deepEqual(bad,[]);
 /* 오늘 업무의 지난 기록 한 줄 · 견적문의 목록 · 복제 줄 분리는 같은 모듈을 쓴다 */
 const html=read('crm.html');assert.match(html,/function todayRecent\(item,type\)\{[^\n]*ContactState\.recent\(item,type\)/);assert.match(html,/ContactState\.shadows\(all\)/);
 assert.ok(html.indexOf('contact-state.js?v=')<html.indexOf('inquiry-flow.js?v='),'판정 모듈을 먼저 싣는다');
 assert.match(read('inquiry-list-v3.js'),/ContactState\.recent\(q,'inq'\)/);assert.match(read('inquiry-flow.js'),/CS\.siblings\(q\)/);
});
