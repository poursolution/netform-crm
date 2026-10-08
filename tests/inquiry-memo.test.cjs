const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../inquiry-memo.js'),BG=require('../boot-guard.js');
/* 견적문의 · 과거 메모의 통화 · 약속(2026-10-08) — 규칙은 후보만 찾는다: 통화 기록 · 약속 · 날짜 · 한국 날짜 일수 */
test('메모에서 통화 후보와 약속 후보를 찾는다(시안의 천안두정 메모)',()=>{
 const tx='관리소장 통화 완료. 옥상 누수 3세대. 사진 이메일로 받기로 함. 다음 날 방문 가능하다고 함.',r=M.parse(tx,'2026-01-07');
 assert.deepEqual(r.calls.map(c=>[c.date,c.phrase]),[['2026-01-07','관리소장 통화 완료']]);
 assert.deepEqual(r.promises.map(p=>[p.type,p.title]),[['material','사진 이메일로 받기'],['visit','다음 날 현장 방문']]);
 assert.equal(M.marked(tx,r.ranges),'<mark class="im-call">관리소장 통화 완료</mark>. 옥상 누수 3세대. <mark class="im-pro">사진 이메일로 받기로 함</mark>. <mark class="im-pro">다음 날 방문 가능하다고 함</mark>.');
});
test('통화가 아닌 말 · 이미 지난 일은 후보로 만들지 않는다',()=>{
 for(const s of ['부재 통화 안 됨.','통화 예정','전화 안 받음','통화 불가'])assert.equal(M.parse(s,'2026-02-01').calls.length,0,s);
 for(const s of ['사진 받음','방문 완료','견적 발송함'])assert.equal(M.parse(s,'2026-02-01').promises.length,0,s);
});
test('문장 속 날짜: 9.30 같은 점은 문장을 끊지 않고, 기준일에서 멀리 앞서면 전년으로 본다',()=>{
 const r=M.parse('9.30 통화 완료. 견적서 보내기로 함.','2026-02-01');
 assert.equal(r.calls[0].date,'2025-09-30');assert.equal(r.promises[0].type,'quote');
 const r2=M.parse('1/20 관리소장님과 통화. 도면 카톡으로 보내준다고 함. 대표회의 2/3 예정','2026-02-01');
 assert.equal(r2.calls[0].date,'2026-01-20');assert.deepEqual(r2.promises.map(p=>p.title),['도면 카카오톡으로 보내기','회의 일정 확인']);
});
test('한국 날짜 일수 — 접속 PC 시간대와 무관하게 자정 기준',()=>{
 assert.equal(M.diff('2026-09-30T23:30:00+09:00','2026-10-08T10:00:00+09:00'),8);
 assert.equal(M.days('2026-09-30T23:30:00+09:00','2026-10-08T10:00:00+09:00'),8,'7일 10시간이어도 한국 날짜로는 8일');
 assert.equal(M.days('2026-10-07T23:30:00+09:00','2026-10-08T10:00:00+09:00'),0,'하루(24시간)가 안 되면 0');
 assert.equal(M.span('2026-10-08T00:30:00+09:00','2026-10-08T23:00:00+09:00'),'22시간');
 assert.equal(M.md('2026-01-07T00:10:00+09:00'),'1.7');assert.equal(M.ymd('2026-01-06T09:00:00+09:00'),'2026.1.6');
 assert.equal(M.addDays('2026-10-08',7),'2026-10-15');
});
test('이관 메모 읽기: 시각이 찍힌 줄과 시각 미기록 줄을 나눈다',()=>{
 const q={raw:{'응대내용':'시각 없는 메모\n[2026-01-07 10:00:00] 관리소장 통화 완료.\n[2026-02-03 11:00:00] 사진 받음'}};
 assert.deepEqual(M.memosOf(q).map(m=>[m.at,m.src]),[['2026-01-07','이관 메모'],['2026-02-03','이관 메모'],['','이관 메모 · 시각 미기록']].sort((a,b)=>String(a[0]||'~').localeCompare(String(b[0]||'~'))));
});
test('연락처 후보: 이관 기록 · 같은 현장의 다른 문의에서만 찾는다',()=>{
 const q={id:'a',site:'[광주] 문흥라인동산',raw:{'응대내용':'소장 010-3333-4444 통화'}};
 const got=M.phones(q);assert.deepEqual(got.map(p=>[p.digits,p.from]),[['01033334444','이관 메모 · 시트 원문']]);
});
test('불러오기 실패 안내: 원인 문구와 다시 시도 주소',()=>{
 assert.equal(BG.reason({},['phase1-config.js']),'phase1-config.js 를 불러오지 못했습니다');
 assert.equal(BG.reason({},[]),'접속 설정(phase1-config.js)이 실행되지 않았습니다');
 assert.equal(BG.reason({PHASE1_CONFIG:{}},['pc-manager-transport.js']),'pc-manager-transport.js 를 불러오지 못했습니다');
 assert.match(BG.reason({PHASE1_CONFIG:{}},[]),/서버 연결 모듈\(pc-manager-transport\.js\)이 실행되지 않았습니다/);
 assert.equal(BG.reason({PHASE1_CONFIG:{},Phase1:{}},[]),'운영 데이터 연결이 10초 넘게 끝나지 않았습니다');
 assert.equal(BG.retryUrl({href:'https://poursolution.github.io/netform-crm/crm.html?view=pc#p=inq'},1760000000000),'https://poursolution.github.io/netform-crm/crm.html?view=pc&_r=1760000000000#p=inq');
});
