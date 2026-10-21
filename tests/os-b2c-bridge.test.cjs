'use strict';
/* OS ↔ CRM 연결 어댑터 검사(2026-10-21 · 잔디 03_송보람 작업지시 '필수 자체 시험' 6가지 + 공통 예시 봉투 검증)
   서버 · 잔디 · 실데이터 없음 — 메모리 가짜 CRM(fakeTransport). 시험 자료는 묶음의 예시(개인정보 없음) + 합성 레코드 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const B=require('../os-b2c-bridge.js');
const {validate:pkgValidate}=require('./fixtures/os-handoff/validate-handoff.cjs');
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/os-handoff/01_연결예시.json'),'utf8'));
const item=(id,extra)=>Object.assign({id,received_at:'2026-10-20 09:10',brand:'POUR솔루션',source:'direct',region:'TEST-지역',site_name:'TEST 현장 '+id,address:'TEST 주소',building_type:'아파트',complex_info:'-',customer_type:'관리사무소',customer_name:'TEST 담당',phone:'010-0000-0000',work_types:['옥상방수'],content:'TEST 문의 내용',consult_channel:'전화',inflow_path:'홈페이지',owner:'',assigned_at:'',status:'NEW',history:[]},extra||{});
const envOf=i=>JSON.parse(JSON.stringify(fixtures[i]));

test('예시 봉투 4건: 묶음 검증기와 어댑터 검증기가 같은 판정(0 오류)',()=>{
 fixtures.forEach(f=>{assert.deepEqual(pkgValidate(f),[]);assert.deepEqual(B.validate(f),[]);});
 const bad=JSON.parse(JSON.stringify(fixtures[0]));bad.caseRef=null;bad.unresolved=[];assert.ok(pkgValidate(bad).length&&B.validate(bad).length,'caseRef null 인데 사유 없음 = 둘 다 거부');
});
test('OS → CRM 입력 변환: B2C id · 내부 ID · 표시번호 · 공사 참조를 raw 에 보존, request_id 는 handoffKey 로 결정적',()=>{
 const env=envOf(0),it=item(env.source.id);
 const f=B.fromHandoff(env,it);assert.equal(f.ok,true,JSON.stringify(f.errors));
 assert.equal(f.payload.site_name,it.site_name);assert.equal(f.payload.raw.os_b2c_id,'TEST-b2c-101동');assert.equal(f.payload.raw.os_internal_id,'TEST-INTERNAL-101동');assert.equal(f.payload.raw.display_no,null);
 assert.deepEqual(f.payload.raw.case_ref,env.caseRef);assert.equal(f.payload.raw.documents[0].version,'v1');
 assert.match(f.request_id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 assert.equal(f.request_id,B.fromHandoff(envOf(0),item(env.source.id)).request_id,'같은 handoffKey = 같은 request_id(재시도 = replay)');
 assert.notEqual(f.request_id,B.fromHandoff(envOf(2),item(env.source.id)).request_id,'범위 2 = 다른 handoffKey = 다른 request_id');
 /* 다른 문의 레코드를 섞으면 거부 */
 assert.equal(B.fromHandoff(env,item('TEST-b2c-102동별도')).ok,false);
 /* caseRef 없는 봉투: 이름으로 채우지 않고 null 유지 + 사유 */
 const u=B.fromHandoff(envOf(3),item('TEST-b2c-101동'));assert.equal(u.ok,true);assert.equal(u.payload.raw.case_ref,null);assert.match(u.unresolved[0],/공사 건 미확정/);
});
test('연결 전 상태 · 전송 · 재시도(같은 handoffKey) · 연결 실패',()=>{
 const T=B.fakeTransport(),br=B.createBridge(T),env=envOf(0),it=item(env.source.id);
 assert.equal(br.state(env.handoffKey).link,'unlinked','연결 전');
 assert.equal(br.pull(env).ok,false);assert.match(br.pull(env).envelope.unresolved.join(' '),/CRM ID 없음/);
 T.fail=true;const r0=br.send(env,it);assert.equal(r0.link,'retryable');assert.match(r0.lastError,/연결 실패/);assert.equal(br.state(env.handoffKey).link,'retryable');
 T.fail=false;const r1=br.send(env,it);assert.equal(r1.link,'linked');assert.equal(r1.crmId,'TEST-CRM-1');assert.equal(r1.replayed,false);
 const r2=br.send(env,it);assert.equal(r2.replayed,true);assert.equal(r2.crmId,'TEST-CRM-1','재시도 = 새 문의 안 만듦');
 assert.equal(T.byId.size,1);
 const out=br.pull(env);assert.equal(out.ok,true);assert.deepEqual(pkgValidate(out.envelope),[]);assert.equal(out.envelope.mode,'prepared');assert.equal(out.envelope.result.crmId,'TEST-CRM-1');assert.equal(out.envelope.result.originalInquiryId,'TEST-b2c-101동');assert.equal(out.envelope.result.osContract,false);
 /* 조회 실패: 이전 정상 결과 유지 */
 T.fail=true;const p=br.pull(env);assert.equal(p.ok,false);assert.match(p.reason,/이전 결과 유지/);assert.equal(p.envelope.result.crmId,'TEST-CRM-1');T.fail=false;
});
test('CRM 응답 재수신 · 다른 문의 응답 · 지연(이전) 응답 · 수주 ≠ OS 계약 완료',()=>{
 const T=B.fakeTransport(),br=B.createBridge(T),env=envOf(0),it=item(env.source.id);br.send(env,it);
 const first=br.pull(env);assert.equal(first.ok,true);
 const again=br.receive(env,T.status('TEST-CRM-1'));assert.equal(again.duplicate,true,'같은 응답 두 번 = 변경 없음');
 /* 다른 문의 응답 */
 const env2=envOf(1);br.send(env2,item(env2.source.id));const other=br.receive(env,T.status('TEST-CRM-2'));assert.equal(other.ok,false);assert.match(other.reason,/다른 문의 응답/);
 /* 진행 → 수주: osContract 는 항상 false · 라벨에 '계약 체결 완료 아님' */
 T.progress('TEST-CRM-1',{inquiry:{status:'영업건'},deal:{stage:'won',outcome:'won'},at:'2026-10-22T10:00:00+09:00'});
 const won=br.pull(env);assert.equal(won.ok,true);assert.equal(won.envelope.result.code,'crm_won');assert.equal(won.envelope.result.osContract,false);assert.match(won.envelope.result.status,/OS 계약 체결 완료 아님/);
 /* 지연 응답(이전 시각) */
 const stale=T.status('TEST-CRM-1');stale.inquiry.updated_at='2026-10-21T09:00:00+09:00';stale.deal=null;stale.inquiry.status='접수';
 const s=br.receive(env,stale);assert.equal(s.ok,false);assert.equal(s.stale,true);assert.equal(br.state(env.handoffKey).crm.state.code,'crm_won','이전 응답이 최신 결과를 덮지 않음');
});
test('수정 주체 분리: OS 배정은 owner 만, CRM 진행은 status 만',()=>{
 const T=B.fakeTransport(),br=B.createBridge(T),env=envOf(0),it=item(env.source.id,{owner:'TEST 담당A'});br.send(env,it);br.pull(env);
 const m=br.assign(env.handoffKey,'TEST 담당B');assert.equal(m.osOwner,'TEST 담당B');assert.equal(m.osOwnerBy,'os');assert.equal(m.crm.status,'접수','OS 배정 변경이 CRM 상태를 바꾸지 않음');
 T.progress('TEST-CRM-1',{inquiry:{status:'진행'},at:'2026-10-22T11:00:00+09:00'});br.pull(env);
 assert.equal(br.state(env.handoffKey).osOwner,'TEST 담당B','CRM 진행 반영이 OS 배정을 바꾸지 않음');assert.equal(br.state(env.handoffKey).crmBy,'crm');
});
test('시험 자료에 실제 개인정보 없음',()=>{
 const s=fs.readFileSync(path.join(__dirname,'fixtures/os-handoff/01_연결예시.json'),'utf8')+fs.readFileSync(__filename,'utf8');
 const phones=s.match(/01[016789]-?\d{3,4}-?\d{4}/g)||[];assert.ok(phones.every(x=>/0000-?0000$/.test(x)),'실제 휴대폰 번호 없음(0000 자리표시만): '+phones.join(','));
});
